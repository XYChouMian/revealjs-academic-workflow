#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""academic-presentation 构建脚本。

职责边界：本脚本只做「slides.yaml → output/index.html」的确定性转换，
不包含任何学术结论、不改写内容、不做样式发明。

用法：
  python build.py <deck_dir>                    # 构建
  python build.py checkpoint <deck_dir> <label> # 保存可恢复检查点（批量修改前必做）
  python build.py restore   <deck_dir> <label>  # 回退到检查点（大范围损坏时立即使用）

deck 目录契约：
  <deck>/content/slides.yaml    唯一内容源
  <deck>/content/deck.css       可选，deck 级样式追加
  <deck>/assets/                图片与独立图形资源（构建时自动复制进 output/）
  <deck>/一键构建.bat            双击构建入口（构建时若缺失自动放置模板，不覆盖已有）
  <deck>/一键导出PDF.bat         导出已有 output/index.html（不触发构建）
  <deck>/output/                全部生成物（可随时删除重建）
"""
import html as html_lib
import json
import math
import re
import shutil
import sys
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
TEMPLATE_DIR = REPO_ROOT / "templates" / "academic-reveal"
TEMPLATE = TEMPLATE_DIR / "reveal-base.html"
CUSTOM_CSS = TEMPLATE_DIR / "custom.css"
BAT_TEMPLATE = TEMPLATE_DIR / "一键构建.bat"
PDF_BAT_TEMPLATE = TEMPLATE_DIR / "一键导出PDF.bat"
VENDOR = REPO_ROOT / "vendor"

KNOWN_LAYOUTS = {
    "cover", "section", "bullets", "image", "image-text",
    "compare", "table", "roadmap", "conclusion", "chapter-overview",
    "ending", "html", "multi-image",
}
IMAGE_MODES = {"side", "side-dominant", "wide-hero"}
TABLE_MODES = {"standard", "spacious", "compact"}
CARD_MODES = {"standard", "hierarchy"}

# 各布局允许的 content 顶层字段（与渲染器同步维护）。渲染器不认识的字段会被
# 静默丢弃——这里在构建期硬校验，杜绝"字段写了不生效"的事故。
LAYOUT_FIELDS = {
    "cover": {"subtitle", "concern", "meta"},
    "html": {"html"},
    "section": {"no", "points", "point_mode"},
    "bullets": {"lead", "bullets", "callout", "box", "mermaid"},
    "image": {"src", "caption", "alt", "white_background", "image", "bullets", "mermaid"},
    "image-text": {"image", "side", "image_mode", "bullets", "callout", "mermaid"},
    "multi-image": {"mode", "images", "columns", "rows", "gap", "callout"},
    "compare": {"cols", "card_mode", "callout", "fit_text", "mermaid"},
    "table": {"headers", "rows", "highlight_row", "table_mode", "dense", "note", "mermaid"},
    "roadmap": {"steps", "card_mode", "fit_text", "mermaid", "note"},
    "conclusion": {"takeaways", "open", "next", "conclusion_mode", "labels", "callout"},
    "chapter-overview": set(),
    "ending": {"subtitle", "prompt", "meta"},
}


ALERT_FIELDS = {"note", "callout", "box"}
for _fields in LAYOUT_FIELDS.values():
    _fields.update(ALERT_FIELDS)


def alerts_html(content):
    """All layouts share the same ordered, non-shrinking reminder region."""
    parts = []
    for kind in ("note", "callout", "box"):
        value = content.get(kind)
        if value is None:
            continue
        if isinstance(value, str):
            value = {"text": value}
        if not isinstance(value, dict) or not isinstance(value.get("text"), str):
            raise ValueError(f"content.{kind} 需为字符串或 {{label, text}}，text 必须为字符串")
        unknown = set(value) - {"label", "text", "style"}
        if unknown:
            raise ValueError(f"content.{kind} 不支持字段: {unknown}")
        if not value["text"].strip():
            continue
        label = f'<strong class="alert-label">{e(value["label"])}</strong> ' if value.get("label") else ""
        extra = " alert-main" if kind == "callout" and value.get("style") == "main" else ""
        parts.append(f'<div class="slide-alert alert-{kind}{extra}">{label}{e(value["text"])}</div>')
    return '<div class="slide-alerts">\n' + "\n".join(parts) + "\n</div>\n" if parts else ""


def e(text):
    """yaml 文本直接嵌入 HTML（内容源允许内联 <b>/<i>/公式/下标等标记），
    仅做最小防御：None → 空串。"""
    return "" if text is None else str(text)


def ul(items, cls=""):
    if not items:
        return ""
    c = f' class="{cls}"' if cls else ""
    lis = "\n".join(f"      <li>{e(it)}</li>" for it in items)
    return f"    <ul{c}>\n{lis}\n    </ul>"


def hierarchy_card(item, index="", fit_text=None):
    """将可选的三层卡片内容渲染为稳定的语义结构；旧 items 写法仍由各布局保留。"""
    parts = ['<div class="hierarchy-card">\n']
    if index:
        parts.append(f'  <div class="card-index">{e(index)}</div>\n')
    if item.get("thesis"):
        parts.append(f'  <p class="card-thesis">{e(item["thesis"])}</p>\n')
    if item.get("detail"):
        fit = fit_text if isinstance(fit_text, dict) else {}
        attrs = ""
        if fit:
            min_px = int(fit.get("min", 20))
            max_px = int(fit.get("max", 24))
            min_lh = float(fit.get("min_line_height", 1.42))
            max_lh = float(fit.get("max_line_height", 1.58))
            attrs = (f' data-fit-text="1" data-fit-min="{min_px}" data-fit-max="{max_px}"'
                     f' data-fit-line-min="{min_lh}" data-fit-line-max="{max_lh}"')
        # 文本包在块级 span 内：行内公式不会被 .card-detail 的 flex 布局拆散（v1.4）
        parts.append(f'  <p class="card-detail"><span class="cd-text"{attrs}>{e(item["detail"])}</span></p>\n')
    if item.get("cue"):
        parts.append(f'  <div class="card-cue">{e(item["cue"])}</div>\n')
    parts.append('</div>')
    return "".join(parts)


def hierarchy_list(items):
    """章节导读卡：接受 {term, detail, cue}，不影响旧的字符串 points。"""
    if not items:
        return ""
    rows = []
    for item in items:
        if not isinstance(item, dict):
            rows.append(f'      <li>{e(item)}</li>')
            continue
        term = f'<b>{e(item.get("term", ""))}</b>' if item.get("term") else ""
        detail = f'<span>{e(item.get("detail", ""))}</span>' if item.get("detail") else ""
        cue = f'<em>{e(item.get("cue", ""))}</em>' if item.get("cue") else ""
        rows.append(f'      <li>{term}{detail}{cue}</li>')
    return '    <ul class="small hierarchy-list">\n' + "\n".join(rows) + '\n    </ul>'


def kicker_html(slide):
    k = e(slide.get("kicker", "")).strip()
    return f'  <div class="kicker">{k}</div>\n' if k else ""


def cite_html(slide):
    c = e(slide.get("cite", "")).strip()
    return f'  <div class="cite">{c}</div>\n' if c else ""


def notes_html(slide):
    return f'  <aside class="notes">{e(slide.get("notes", ""))}</aside>\n'


def sources_comment(slide):
    src = slide.get("sources") or []
    if not src:
        return ""
    joined = "; ".join(str(s) for s in src)
    return f"  <!-- 证据来源: {joined} -->\n"


def mermaid_block(content):
    m = (content or {}).get("mermaid", "").strip()
    if not m:
        return ""
    return f'  <div class="mermaid tex2jax_ignore">{m}</div>\n'


# ---------------- 各布局渲染器：输入 content 字典，输出 section 内部 HTML ----------------

def r_cover(slide):
    c = slide.get("content", {})
    parts = [kicker_html(slide)]
    parts.append(f"  <h1>{e(slide.get('title',''))}</h1>\n")
    if c.get("subtitle"):
        parts.append(f'  <div class="sub">{e(c["subtitle"])}</div>\n')
    if c.get("concern"):
        parts.append(f'  <div class="concern">{e(c["concern"])}</div>\n')
    meta = c.get("meta")
    if meta:
        body = "<br>\n    ".join(e(m) for m in meta) if isinstance(meta, list) else e(meta)
        parts.append(f'  <div class="meta">\n    {body}\n  </div>\n')
    return "".join(parts)


def r_section(slide):
    c = slide.get("content", {})
    parts = [kicker_html(slide)]
    if c.get("no"):
        parts.append(f'  <div class="no">{e(c["no"])}</div>\n')
    parts.append(f"  <h2>{e(slide.get('title',''))}</h2>\n")
    points = hierarchy_list(c.get("points", [])) if c.get("point_mode") == "hierarchy" else ul(c.get("points", []), cls="small")
    if points:
        parts.append(points + "\n")
    return "".join(parts)


def r_bullets(slide):
    c = slide.get("content", {})
    parts = [kicker_html(slide), f"  <h2>{e(slide.get('title',''))}</h2>\n"]
    if c.get("lead"):
        parts.append(f'  <p class="small">{e(c["lead"])}</p>\n')
    parts.append(ul(c.get("bullets", [])) + "\n")
    parts.append(mermaid_block(c))
    return "".join(parts)


def _attr(text):
    return html_lib.escape(e(text), quote=True)


def _figure(img):
    src = _attr(img.get("src", ""))
    background = img.get("white_background", "original")
    if background not in {"original", "blend"}:
        raise ValueError("image.white_background 必须是 original 或 blend")
    blend_class = " figure-white-blend" if background == "blend" else ""
    if img.get("max_height"):
        print(f"[build] 提示: image.max_height 已废弃（v1.4 起图片自动适配剩余高度），已忽略 max_height={img['max_height']}")
    cap = f'<div class="figcap">{e(img.get("caption",""))}</div>' if img.get("caption") else ""
    return f'  <div class="figure{blend_class}">\n    <img src="{src}" alt="{_attr(img.get("alt", img.get("caption","")))}">\n{cap}  </div>\n'


def r_image(slide):
    c = slide.get("content", {})
    parts = [kicker_html(slide), f"  <h2>{e(slide.get('title',''))}</h2>\n", _figure(c)]
    if c.get("bullets"):
        parts.append(ul(c["bullets"], cls="small") + "\n")
    parts.append(mermaid_block(c))
    return "".join(parts)


def r_image_text(slide):
    c = slide.get("content", {})
    mode = c.get("image_mode", "side")
    side = "image-text" if c.get("side", "left") == "left" else "text-image"
    img_col = f'<div class="col image-visual">{_figure(c.get("image", {}))}</div>\n'
    text_col = "<div class=\"col small image-copy\">\n" + ul(c.get("bullets", [])) + "\n"
    text_col += "</div>\n"
    cols = img_col + text_col if mode == "wide-hero" or side == "image-text" else text_col + img_col
    parts = [kicker_html(slide), f"  <h2>{e(slide.get('title',''))}</h2>\n",
             f'  <div class="cols image-mode-{mode} {side}" style="align-items:center;">\n{cols}  </div>\n']
    parts.append(mermaid_block(c))
    return "".join(parts)


def check_multi_image(c):
    """Shared build/static-validation schema; manual coordinates never silently disappear."""
    mode = c.get("mode", "auto")
    if mode not in {"auto", "manual"}:
        raise ValueError("multi-image.mode 必须是 auto 或 manual")
    def positive(v):
        return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) and v > 0
    gap = c.get("gap", 16)
    if not (positive(gap) or type(gap) in (int, float) and gap == 0):
        raise ValueError("multi-image.gap 必须是有限非负数")
    images = c.get("images")
    if not isinstance(images, list) or len(images) < 2:
        raise ValueError("multi-image.images 需要至少两张图片")
    if mode == "manual":
        for key in ("columns", "rows"):
            values = c.get(key)
            if not isinstance(values, list) or not values or not all(positive(v) for v in values):
                raise ValueError(f"multi-image.{key} 需要非空正数权重列表")
    elif "columns" in c or "rows" in c:
        raise ValueError("multi-image 的 columns/rows 仅适用于 manual 模式")
    occupied = []
    for i, item in enumerate(images, 1):
        if not isinstance(item, dict):
            raise ValueError(f"multi-image.images[{i}] 必须是字典")
        allowed = {"src", "title", "content", "content_position", "alt", "white_background", "row", "column", "rowspan", "colspan"}
        if set(item) - allowed:
            raise ValueError(f"multi-image.images[{i}] 未知字段: {set(item) - allowed}")
        if not isinstance(item.get("src"), str) or not item["src"].strip():
            raise ValueError(f"multi-image.images[{i}] 缺少 src")
        for key in ("title", "alt"):
            if key in item and not isinstance(item[key], str):
                raise ValueError(f"multi-image.images[{i}].{key} 需要字符串")
        text = item.get("content", "")
        if "content_position" in item and item["content_position"] not in ("bottom", "right", "left"):
            raise ValueError(f"multi-image.images[{i}].content_position 必须是 bottom、right 或 left")
        if not isinstance(text, str) and not (isinstance(text, list) and all(isinstance(v, str) for v in text)):
            raise ValueError(f"multi-image.images[{i}].content 需要字符串或字符串列表")
        if item.get("white_background", "original") not in {"original", "blend"}:
            raise ValueError(f"multi-image.images[{i}].white_background 必须是 original 或 blend")
        coords = ("row", "column", "rowspan", "colspan")
        if mode == "auto" and any(k in item for k in coords):
            raise ValueError("multi-image 的位置字段仅适用于 manual 模式")
        if mode == "manual":
            r, col, rs, cs = (item.get(k, 1 if k.endswith("span") else None) for k in coords)
            if any(type(v) is not int or v < 1 for v in (r, col, rs, cs)):
                raise ValueError(f"multi-image.images[{i}] 行列与跨度必须是从 1 开始的整数")
            if r + rs - 1 > len(c["rows"]) or col + cs - 1 > len(c["columns"]):
                raise ValueError(f"multi-image.images[{i}] 网格位置越界")
            rect = (r, col, r + rs, col + cs)
            if any(r < b[2] and rect[2] > b[0] and col < b[3] and rect[3] > b[1] for b in occupied):
                raise ValueError(f"multi-image.images[{i}] 网格位置重叠")
            occupied.append(rect)


def r_multi_image(slide):
    c = slide.get("content", {})
    check_multi_image(c)
    mode = c.get("mode", "auto")
    style = f'--multi-gap:{c.get("gap", 16)}px;'
    if mode == "manual":
        style += "grid-template-columns:" + " ".join(f"minmax(0,{v}fr)" for v in c["columns"]) + ";"
        style += "grid-template-rows:" + " ".join(f"minmax(0,{v}fr)" for v in c["rows"]) + ";"
    parts = [kicker_html(slide), f'<h2>{e(slide.get("title", ""))}</h2>',
             f'<div class="multi-images" data-mode="{mode}" data-multi-state="pending" style="{style}">']
    for index, item in enumerate(c["images"]):
        pos = ""
        if mode == "manual":
            pos = f' style="grid-row:{item["row"]}/span {item.get("rowspan", 1)};grid-column:{item["column"]}/span {item.get("colspan", 1)};"'
        placement = item.get("content_position", "auto" if mode == "auto" else "bottom")
        parts.append(f'<div class="multi-panel" data-image-index="{index}" data-content-position="{placement}"{pos}>')
        if item.get("title"):
            parts.append(f'<h3 class="multi-title">{e(item["title"])}</h3>')
        parts.append(_figure(item))
        text = item.get("content")
        if text:
            body = ul(text) if isinstance(text, list) else e(text)
            parts.append(f'<div class="multi-copy">{body}</div>')
        parts.append('</div>')
    parts.append('</div>')
    return "\n".join(parts) + "\n"


def r_compare(slide):
    c = slide.get("content", {})
    mode = c.get("card_mode", "standard")
    parts = [kicker_html(slide), f"  <h2>{e(slide.get('title',''))}</h2>\n", f'  <div class="cols card-mode-{mode}">\n']
    for idx, col in enumerate(c.get("cols", []), 1):
        cls = "col card" if col.get("highlight") else "col card"
        extra = ' style="border-color:var(--good);background:#f4faf5;"' if col.get("highlight") else ""
        parts.append(f'    <div class="{cls}"{extra}>\n')
        parts.append(f"      <h3>{e(col.get('title',''))}</h3>\n")
        if mode == "hierarchy":
            parts.append("      " + hierarchy_card(col, col.get("index", str(idx)), c.get("fit_text")) + "\n")
        elif col.get("html"):
            parts.append(f"      {e(col['html'])}\n")
        else:
            body = ul(col.get("items", []))
            for i, line in enumerate(body.split("\n")):
                parts.append(f"  {line}\n")
        parts.append("    </div>\n")
    parts.append("  </div>\n")
    parts.append(mermaid_block(c))
    return "".join(parts)


def r_table(slide):
    c = slide.get("content", {})
    mode = c.get("table_mode", "compact" if c.get("dense") else "standard")
    wrap = f' table-mode-{mode}' if mode != "standard" else ''
    parts = [kicker_html(slide), f"  <h2>{e(slide.get('title',''))}</h2>\n"]
    if wrap:
        parts.append(f'  <div class="{wrap.strip()}">\n')
    heads = "".join(f"<th>{e(h)}</th>" for h in c.get("headers", []))
    parts.append(f'    <table class="cmp">\n      <thead><tr>{heads}</tr></thead>\n      <tbody>\n')
    hl = c.get("highlight_row")
    for i, row in enumerate(c.get("rows", [])):
        cls = ' class="me"' if hl is not None and i == hl else ""
        tds = "".join(f"<td>{e(cell)}</td>" for cell in row)
        parts.append(f'        <tr{cls}>{tds}</tr>\n')
    parts.append("      </tbody>\n    </table>\n")
    if wrap:
        parts.append("  </div>\n")
    parts.append(mermaid_block(c))
    return "".join(parts)


def r_roadmap(slide):
    c = slide.get("content", {})
    parts = [kicker_html(slide), f"  <h2>{e(slide.get('title',''))}</h2>\n"]
    steps = c.get("steps", [])
    if steps:
        mode = c.get("card_mode", "standard")
        parts.append(f'  <div class="cols card-mode-{mode}">\n')
        for idx, st in enumerate(steps, 1):
            parts.append('    <div class="col card">\n')
            parts.append(f"      <h3>{e(st.get('phase',''))}</h3>\n")
            if mode == "hierarchy":
                parts.append("      " + hierarchy_card(st, st.get("index", f"{idx:02d}"), c.get("fit_text")) + "\n")
            else:
                body = ul(st.get("items", []), cls="small")
                for line in body.split("\n"):
                    parts.append(f"  {line}\n")
            parts.append("    </div>\n")
        parts.append("  </div>\n")
    parts.append(mermaid_block(c))
    return "".join(parts)


def r_conclusion(slide):
    c = slide.get("content", {})
    parts = [kicker_html(slide), f"  <h2>{e(slide.get('title',''))}</h2>\n"]
    mode = c.get("conclusion_mode", "standard")
    labels = c.get("labels") or {}
    if mode == "cards":
        parts.append('  <div class="conclusion-grid">\n')
    for key, default_label, style in (("takeaways", "已形成的认识", "note-box"),
                                      ("open", "尚未解决的问题", "tbd-box"),
                                      ("next", "下一步需要补充的证据", "tbd-box")):
        label = labels.get(key, default_label)
        items = c.get(key, [])
        if items:
            extra = " conclusion-card" if mode == "cards" else ""
            parts.append(f'  <div class="{style} small{extra}" style="margin:8px 0;">\n')
            parts.append(f"    <b>{label}</b>\n")
            body = ul(items)
            for line in body.split("\n"):
                parts.append(f"  {line}\n")
            parts.append("  </div>\n")
    if mode == "cards":
        parts.append("  </div>\n")
    return "".join(parts)


def r_chapter_overview(slide, chapters):
    """自动列出正文 ending 之前的 section；YAML 不维护第二份目录。"""
    parts = [kicker_html(slide), f"  <h2>{e(slide.get('title',''))}</h2>\n",
             f'  <div class="chapter-overview-list count-{len(chapters)}">\n']
    for i, chapter in enumerate(chapters, 1):
        parts.append(f'    <a class="chapter-overview-item" href="#/{_attr(chapter["id"])}">\n')
        parts.append(f'      <span class="chapter-overview-number">{i:02d}</span>\n')
        parts.append(f'      <span class="chapter-overview-title">{e(chapter["title"])}</span>\n')
        parts.append('      <span class="chapter-overview-arrow" aria-hidden="true">→</span>\n')
        parts.append("    </a>\n")
    parts.append("  </div>\n")
    return "".join(parts)


def r_ending(slide):
    c = slide.get("content", {})
    parts = [kicker_html(slide), f"  <h1>{e(slide.get('title',''))}</h1>\n"]
    if c.get("subtitle"):
        parts.append(f'  <div class="ending-subtitle">{e(c["subtitle"])}</div>\n')
    if c.get("prompt"):
        parts.append(f'  <div class="ending-prompt">{e(c["prompt"])}</div>\n')
    if c.get("meta"):
        meta = c["meta"]
        text = " · ".join(e(v) for v in meta) if isinstance(meta, list) else e(meta)
        parts.append(f'  <div class="ending-meta">{text}</div>\n')
    return "".join(parts)


def r_html(slide):
    """逃生舱：整页原生 HTML（迁移已验证页面时使用）。"""
    c = slide.get("content", {})
    html = e(c.get("html", "")).strip()
    if not html:
        raise ValueError(f"[{slide.get('slide_id')}] layout=html 需要 content.html")
    if "<section" in html:
        return html  # 完全自带
    inner = html
    parts = [kicker_html(slide)]
    t = slide.get("title")
    if t:
        parts.append(f"  <h2>{e(t)}</h2>\n")
    return "".join(parts) + inner + "\n"


RENDERERS = {
    "cover": r_cover, "section": r_section, "bullets": r_bullets,
    "image": r_image, "image-text": r_image_text, "compare": r_compare,
    "table": r_table, "roadmap": r_roadmap, "conclusion": r_conclusion,
    "ending": r_ending,
    "multi-image": r_multi_image,
    "html": r_html,
}


def render_slide(slide, idx, chapters):
    layout = slide.get("layout")
    if layout not in KNOWN_LAYOUTS:
        raise ValueError(f"[{slide.get('slide_id', idx)}] 未知 layout: {layout!r}，可用: {sorted(KNOWN_LAYOUTS)}")
    sid = slide.get("slide_id", f"slide-{idx+1}")
    content = slide.get("content") or {}
    nonstr = [k for k in content if not isinstance(k, str)]
    if nonstr:
        raise ValueError(f"[{sid}] content 存在非字符串键 {nonstr!r}——常见原因是 YAML 把 no/yes/on/off/"
                         f"true/false 等裸键解析为布尔值，请给键加引号（如 \"no\": \"01\"）")
    allowed = LAYOUT_FIELDS.get(layout, set())
    unknown = set(content) - allowed
    if unknown:
        raise ValueError(f"[{sid}] layout={layout} 不支持字段: {', '.join(sorted(unknown))}；"
                         f"该布局可用: {', '.join(sorted(allowed))}（写字段前先对照渲染器支持范围）")
    if layout == "image-text" and content.get("image_mode", "side") not in IMAGE_MODES:
        raise ValueError(f"[{sid}] image_mode 必须是 {sorted(IMAGE_MODES)}")
    if layout == "table" and content.get("table_mode", "compact" if content.get("dense") else "standard") not in TABLE_MODES:
        raise ValueError(f"[{sid}] table_mode 必须是 {sorted(TABLE_MODES)}")
    if layout in {"compare", "roadmap"} and content.get("card_mode", "standard") not in CARD_MODES:
        raise ValueError(f"[{sid}] card_mode 必须是 {sorted(CARD_MODES)}")
    if layout == "section" and content.get("point_mode", "standard") not in {"standard", "hierarchy"}:
        raise ValueError(f"[{sid}] point_mode 必须是 ['standard', 'hierarchy']")
    if layout == "conclusion" and content.get("conclusion_mode", "standard") not in {"standard", "cards"}:
        raise ValueError(f"[{sid}] conclusion_mode 必须是 ['standard', 'cards']")
    if content.get("fit_text"):
        fit = content["fit_text"]
        if not isinstance(fit, dict) or int(fit.get("min", 20)) < 18 or int(fit.get("max", 24)) < int(fit.get("min", 20)):
            raise ValueError(f"[{sid}] fit_text 需为字典，且 18 <= min <= max")
    attrs = f' id="{_attr(sid)}" data-slide-id="{_attr(sid)}"'
    # 每页输出布局类（CSS 纵向撑满与页面级定位的稳定锚点）；cover/section 追加既有行为类
    cls = f"layout-{layout}"
    if layout == "cover":
        cls += " cover"
    elif layout == "section":
        cls += " section-slide"
    elif layout == "ending":
        cls += " ending-slide"
    attrs += f' class="{cls}"'
    body = r_chapter_overview(slide, chapters) if layout == "chapter-overview" else RENDERERS[layout](slide)
    body += alerts_html(content)
    # 供视觉检查判断"该页应出现公式渲染产物"（排除 mermaid 源码块，其内容由 MathJax skip）
    probe = re.sub(r'<(?:pre|div) class="mermaid(?: tex2jax_ignore)?">.*?</(?:pre|div)>', "", body, flags=re.S)
    if "$" in probe or "\\(" in probe or "\\[" in probe:
        attrs += ' data-math="1"'
    return f'<section{attrs}>\n{sources_comment(slide)}{body}{cite_html(slide)}{notes_html(slide)}</section>\n'


def build(deck_dir):
    deck_dir = Path(deck_dir)
    slides_yaml = deck_dir / "content" / "slides.yaml"
    out_dir = deck_dir / "output"
    if not slides_yaml.exists():
        sys.exit(f"[build] 缺少唯一内容源: {slides_yaml}")
    try:
        data = yaml.safe_load(slides_yaml.read_text(encoding="utf-8"))
    except yaml.YAMLError as ex:
        hint = "注意：行内列表含 [ ] 等字符需加引号"
        if "unknown escape character" in str(ex):
            hint = ("双引号串内 \\ 是转义符：LaTeX 命令须写双反斜杠（\"$\\\\tau$\"），"
                    "或去掉引号/改用单引号包裹并保留单反斜杠（$\\tau$）")
        sys.exit(f"[build] slides.yaml 语法错误（{hint}）:\n{ex}")
    deck_meta = data.get("deck", {})
    chapter_nav = deck_meta.get("chapter_nav", False)
    if not isinstance(chapter_nav, bool):
        sys.exit("[build] deck.chapter_nav 必须是 true 或 false")
    aspect_ratio = deck_meta.get("aspect_ratio", "16:9")
    aspect_sizes = {"16:9": (1280, 720), "4:3": (960, 720)}
    if aspect_ratio not in aspect_sizes:
        sys.exit("[build] deck.aspect_ratio 必须是 '16:9' 或 '4:3'")
    slide_width, slide_height = aspect_sizes[aspect_ratio]
    aspect_class = "ratio-16-9" if aspect_ratio == "16:9" else "ratio-4-3"
    slides = data.get("slides") or []
    if not slides:
        sys.exit("[build] slides.yaml 中没有任何页面")

    seen = set()
    for i, s in enumerate(slides):
        sid = s.get("slide_id")
        if not sid:
            raise ValueError(f"第 {i+1} 页缺少 slide_id")
        if sid in seen:
            raise ValueError(f"slide_id 重复: {sid}")
        seen.add(sid)

    ending_indices = [i for i, slide in enumerate(slides) if slide.get("layout") == "ending"]
    if len(ending_indices) > 1:
        sys.exit("[build] ending 页面只能有一个；它定义正文与附录的唯一边界")
    main_end = ending_indices[0] if ending_indices else len(slides)
    chapters = []
    for i, slide in enumerate(slides[:main_end]):
        if slide.get("layout") == "section":
            title = re.sub(r"<[^>]*>", "", html_lib.unescape(str(slide.get("title", ""))))
            chapters.append({"index": i, "id": slide["slide_id"], "title": title})
    overview_indices = [i for i, slide in enumerate(slides) if slide.get("layout") == "chapter-overview"]
    if overview_indices and not chapters:
        sys.exit("[build] chapter-overview 无可展示的正文 section；请在 ending 前添加章节页")
    if any(i >= main_end for i in overview_indices):
        sys.exit("[build] chapter-overview 必须位于 ending 之前")
    if overview_indices and len(chapters) > 8:
        sys.exit(f"[build] chapter-overview 当前最多展示 8 章，检测到 {len(chapters)} 章；请合并正文章节")

    try:
        slides_html = "\n".join(render_slide(s, i, chapters) for i, s in enumerate(slides))
    except ValueError as ex:
        sys.exit(f"[build] {ex}")
    template = TEMPLATE.read_text(encoding="utf-8")
    # JSON 数据不作为 HTML 执行；转义 < 防止标题中的 </script> 提前结束数据块。
    chapter_data = json.dumps({"chapters": chapters if chapter_nav else [], "mainEnd": main_end},
                              ensure_ascii=False).replace("<", "\\u003c")
    deck_css_tag = ""
    if (deck_dir / "content" / "deck.css").exists():
        deck_css_tag = '\n<link rel="stylesheet" href="deck.css">'
    html = (template
            .replace("{{DECK_TITLE}}", e(deck_meta.get("title", "学术汇报")))
            .replace("{{DECK_CSS_TAG}}", deck_css_tag)
            .replace("{{ASPECT_CLASS}}", aspect_class)
            .replace("{{SLIDE_WIDTH}}", str(slide_width))
            .replace("{{SLIDE_HEIGHT}}", str(slide_height))
            .replace("{{CHAPTER_DATA}}", chapter_data)
            .replace("{{SLIDES}}", slides_html))

    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "index.html").write_text(html, encoding="utf-8")
    if VENDOR.exists():
        dst = out_dir / "vendor"
        if dst.exists():
            shutil.rmtree(dst)
        shutil.copytree(VENDOR, dst)
    (out_dir / "custom.css").write_text(CUSTOM_CSS.read_text(encoding="utf-8"), encoding="utf-8")
    shutil.copy2(TEMPLATE_DIR / "multi-image.js", out_dir / "multi-image.js")
    if (deck_dir / "content" / "deck.css").exists():
        shutil.copy2(deck_dir / "content" / "deck.css", out_dir / "deck.css")
    # deck 的图件目录整体复制进 output（与 vendor 同策略：清理重建，避免改名后残留孤儿文件）。
    # 有了这步，构建后无需再手动 cp assets。
    deck_assets = deck_dir / "assets"
    out_assets = out_dir / "assets"
    if deck_assets.exists():
        if out_assets.exists():
            shutil.rmtree(out_assets)
        shutil.copytree(deck_assets, out_assets)
    # 双击构建入口：skill 模板自动放置到 deck 根目录（仅缺失时放置，不覆盖已有定制）
    bat_dst = deck_dir / "一键构建.bat"
    if BAT_TEMPLATE.exists() and not bat_dst.exists():
        shutil.copy2(BAT_TEMPLATE, bat_dst)
        print("[build] 已放置 一键构建.bat（双击 = 编译 + 浏览器放映；成功自动关窗，出错停窗）")
    pdf_bat_dst = deck_dir / "一键导出PDF.bat"
    if PDF_BAT_TEMPLATE.exists() and not pdf_bat_dst.exists():
        shutil.copy2(PDF_BAT_TEMPLATE, pdf_bat_dst)
        print("[build] 已放置 一键导出PDF.bat（导出已有 HTML，不自动重新构建）")
    (out_dir / "build-manifest.json").write_text(json.dumps(
        {"deck": deck_meta.get("title", ""), "slides": len(slides),
         "aspect_ratio": aspect_ratio, "slide_width": slide_width, "slide_height": slide_height,
         "chapter_nav": chapter_nav,
         "slide_ids": [s["slide_id"] for s in slides]}, ensure_ascii=False, indent=2),
        encoding="utf-8")
    print(f"[build] 完成: {out_dir / 'index.html'}（{len(slides)} 页，vendor 已就位）")


def checkpoint(deck_dir, label):
    deck_dir = Path(deck_dir)
    cp_dir = deck_dir / ".checkpoints" / label
    if cp_dir.exists():
        sys.exit(f"[checkpoint] 检查点已存在，换一个标签: {cp_dir}")
    cp_dir.mkdir(parents=True)
    for sub in ("content", "output"):
        src = deck_dir / sub
        if src.exists():
            shutil.copytree(src, cp_dir / sub,
                            ignore=shutil.ignore_patterns("screenshots", ".checkpoints"))
    print(f"[checkpoint] 已保存: {cp_dir}")


def restore(deck_dir, label):
    deck_dir = Path(deck_dir)
    cp_dir = deck_dir / ".checkpoints" / label
    if not cp_dir.exists():
        sys.exit(f"[restore] 检查点不存在: {cp_dir}")
    for sub in ("content", "output"):
        src, dst = cp_dir / sub, deck_dir / sub
        if src.exists():
            if dst.exists():
                shutil.rmtree(dst)
            shutil.copytree(src, dst)
    print(f"[restore] 已回退到检查点 {label}，请重新运行 validate 验证受影响内容")


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    args = [a for a in sys.argv[1:] if a.strip()]
    if len(args) >= 3 and args[0] in ("checkpoint", "restore"):
        (checkpoint if args[0] == "checkpoint" else restore)(args[1], args[2])
    elif len(args) == 1:
        build(args[0])
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
