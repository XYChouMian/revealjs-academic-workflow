#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""academic-presentation 验收脚本（确定性检查 + 可选浏览器视觉检查）。

用法：
  python validate.py <deck_dir>            # 静态检查（快，不需要浏览器）
  python validate.py <deck_dir> --visual   # 追加 Playwright 浏览器检查与逐页截图

产出：<deck>/output/validation-report.md 与 .json，退出码 = P0+P1 数量。
等级：P0 阻断 / P1 重要 / P2 记录不阻断。禁止通过隐藏溢出等方式"通过"验收。
"""
import json
import os
import re
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path

import yaml

SCRIPT_DIR = Path(__file__).resolve().parent
NO_CITE_OK = {"cover", "section"}
VOID_TAGS = {"img", "br", "hr", "meta", "link", "input", "source", "wbr"}
IMAGE_MODES = {"side", "side-dominant", "wide-hero"}
TABLE_MODES = {"standard", "spacious", "compact"}
CARD_MODES = {"standard", "hierarchy"}


class Defects:
    def __init__(self):
        self.items = []

    def add(self, level, code, msg, slide=""):
        self.items.append({"level": level, "code": code, "slide": slide, "msg": msg})

    @property
    def blocking(self):
        return sum(1 for d in self.items if d["level"] in ("P0", "P1"))

    def counts(self):
        return {lv: sum(1 for d in self.items if d["level"] == lv) for lv in ("P0", "P1", "P2")}


class BalanceChecker(HTMLParser):
    """跟踪标签配对与每个 section 的可见文本。"""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.errors = []
        self.sections = []          # [{attrs, text, has_notes, has_cite}]
        self.cur = None
        self.skip_depth = 0         # pre/code/script/style 内文本不参与公式配平
        self.in_notes = False       # Presenter Notes 不参与公式配平统计

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "section":
            self.cur = {"id": a.get("data-slide-id", a.get("id", "")), "text": "",
                        "has_notes": False, "has_cite": False, "raw": ""}
        elif self.cur is not None and tag == "aside" and "notes" in (a.get("class") or ""):
            self.cur["has_notes"] = True
            self.in_notes = True
        elif self.cur is not None and tag == "div" and "cite" in (a.get("class") or ""):
            self.cur["has_cite"] = True
        if tag in ("pre", "code", "script", "style", "textarea"):
            self.skip_depth += 1
        if tag not in VOID_TAGS:
            self.stack.append(tag)

    def handle_endtag(self, tag):
        if tag in ("pre", "code", "script", "style", "textarea"):
            self.skip_depth = max(0, self.skip_depth - 1)
        if tag == "aside":
            self.in_notes = False
        if tag in VOID_TAGS:
            return
        if not self.stack:
            self.errors.append(f"多余的闭合标签 </{tag}>")
            return
        if self.stack[-1] == tag:
            self.stack.pop()
        elif tag in self.stack:
            self.errors.append(f"标签交叉嵌套: 期待 </{self.stack[-1]}> 实际 </{tag}>")
            while self.stack and self.stack[-1] != tag:
                self.stack.pop()
            if self.stack:
                self.stack.pop()
        else:
            self.errors.append(f"未打开的闭合标签 </{tag}>")
        if tag == "section" and self.cur is not None:
            self.sections.append(self.cur)
            self.cur = None

    def handle_data(self, data):
        if self.cur is not None and not self.in_notes:
            self.cur["raw"] += data
            if not self.skip_depth:
                self.cur["text"] += data


def check_yaml(data, D):
    deck = data.get("deck") or {}
    if not deck.get("title"):
        D.add("P1", "yaml-deck-title", "deck.title 缺失")
    slides = data.get("slides") or []
    if not slides:
        D.add("P0", "yaml-empty", "slides 为空")
        return []
    seen = {}
    for i, s in enumerate(slides):
        sid = s.get("slide_id") or f"<第{i+1}页缺 slide_id>"
        content = s.get("content") or {}
        if sid in seen:
            D.add("P0", "yaml-dup-id", f"slide_id 重复: {sid}", sid)
        seen[sid] = True
        if s.get("layout") == "html":
            continue
        if not s.get("title") and s.get("layout") not in NO_CITE_OK:
            D.add("P1", "yaml-title", "缺少 title", sid)
        if not (s.get("notes") or "").strip():
            D.add("P1", "yaml-notes", "缺少 Presenter Notes（notes 字段为空）", sid)
        if s.get("layout") not in NO_CITE_OK and not (s.get("sources") or s.get("cite")):
            D.add("P2", "yaml-sources", "内容页缺 sources/cite，论断不可追溯", sid)
        if s.get("layout") not in NO_CITE_OK and not (s.get("cite") or "").strip():
            D.add("P2", "yaml-cite", "页面无 cite 引用脚注", sid)
        if s.get("layout") == "table":
            rows = content.get("rows") or []
            mode = content.get("table_mode", "compact" if content.get("dense") else "standard")
            if rows and len(rows) <= 6 and mode != "spacious":
                ncell = sum(len(r) for r in rows)
                avg = sum(len(str(c)) for r in rows for c in r) / max(1, ncell)
                if avg < 40:
                    D.add("P2", "table-mode-hint",
                          f"行数 {len(rows)} ≤6 且单元格较短（均值 {avg:.0f} 字符）——建议 table_mode: spacious 撑满版面", sid)
        if s.get("layout") == "image-text" and content.get("image_mode", "side") not in IMAGE_MODES:
            D.add("P1", "yaml-image-mode", f"image_mode 必须是 {sorted(IMAGE_MODES)}", sid)
        if s.get("layout") == "table" and content.get("table_mode", "compact" if content.get("dense") else "standard") not in TABLE_MODES:
            D.add("P1", "yaml-table-mode", f"table_mode 必须是 {sorted(TABLE_MODES)}", sid)
        if s.get("layout") in {"compare", "roadmap"} and content.get("card_mode", "standard") not in CARD_MODES:
            D.add("P1", "yaml-card-mode", f"card_mode 必须是 {sorted(CARD_MODES)}", sid)
        if s.get("layout") == "section" and content.get("point_mode", "standard") not in {"standard", "hierarchy"}:
            D.add("P1", "yaml-point-mode", "point_mode 必须是 ['standard', 'hierarchy']", sid)
        if s.get("layout") == "conclusion" and content.get("conclusion_mode", "standard") not in {"standard", "cards"}:
            D.add("P1", "yaml-conclusion-mode", "conclusion_mode 必须是 ['standard', 'cards']", sid)
        if content.get("fit_text"):
            fit = content["fit_text"]
            try:
                invalid = not isinstance(fit, dict) or int(fit.get("min", 20)) < 18 or int(fit.get("max", 24)) < int(fit.get("min", 20))
            except (TypeError, ValueError):
                invalid = True
            if invalid:
                D.add("P1", "yaml-fit-text", "fit_text 需为字典，且 18 <= min <= max", sid)
    return slides


def check_resources(html_text, out_dir, D):
    refs = re.findall(r'(?:src|href)="([^"]+)"', html_text)
    for ref in set(refs):
        if ref.startswith(("http://", "https://", "//")):
            D.add("P1", "net-ref", f"生成页引用了外部网络资源（应使用本地 vendor/）: {ref}")
            continue
        if ref.startswith(("data:", "#", "mailto:")):
            continue
        p = (out_dir / ref).resolve()
        if not p.exists():
            D.add("P0", "missing-res", f"资源不存在: {ref}")
    # 孤儿资源（P2 提示，不强制清理）。引用前缀有两种：assets/...（相对 output，构建时
    # 由 deck assets 复制而来）与 ../assets/...（相对 output/index.html 的旧写法），均归一化。
    deck_assets = out_dir.parent / "assets"
    if deck_assets.exists():
        referenced = set()
        for r in refs:
            if r.startswith("../assets/"):
                referenced.add(r[len("../assets/"):])
            elif r.startswith("assets/"):
                referenced.add(r[len("assets/"):])
        for f in deck_assets.rglob("*"):
            if f.is_file() and f.relative_to(deck_assets).as_posix() not in referenced:
                D.add("P2", "orphan-asset", f"assets/ 中未被引用: assets/{f.relative_to(deck_assets).as_posix()}")


def check_math_balance(sections, D):
    for sec in sections:
        text = sec["raw"]
        if text.count("\\(") != text.count("\\)"):
            D.add("P1", "math-paren", f"行内公式 \\( \\) 不配平: \\(×{text.count(chr(92)+chr(40))} \\)×{text.count(chr(92)+chr(41))}", sec["id"])
        if text.count("\\[") != text.count("\\]"):
            D.add("P1", "math-bracket", "显示公式 \\[ \\] 不配平", sec["id"])
        if text.count("$") % 2:
            D.add("P1", "math-dollar", "单 $ 数量为奇数，可能存在未闭合行内公式", sec["id"])


def check_mermaid(html_text, sections, D):
    blocks = re.findall(r'<pre class="mermaid">(.*?)</pre>', html_text, re.S)
    for i, b in enumerate(blocks):
        if not b.strip():
            D.add("P1", "mermaid-empty", f"第 {i+1} 个 mermaid 块为空")


def check_density(sections, D):
    for sec in sections:
        bullets = sec["raw"].count("<li>")
        chars = len(sec["text"].strip())
        if bullets > 9:
            D.add("P2", "dense-bullets", f"要点数过多（{bullets} 条 > 9），建议拆页或下放 Notes", sec["id"])
        if chars > 1600:
            D.add("P2", "dense-text", f"可见文本量偏大（{chars} 字符），存在溢出风险", sec["id"])


def _unquoted_part(text):
    """返回 text 中位于引号串之外的部分：跳过 "..."（含 \\ 转义）与 '...'。
    用于把 `["$\\tau$", "b"]` 这类行内列表里的合法转义排除在检查之外。"""
    out, i, n = [], 0, len(text)
    while i < n:
        ch = text[i]
        if ch in "\"'":
            q = ch
            i += 1
            while i < n and text[i] != q:
                if q == "\"" and text[i] == "\\":
                    i += 1
                i += 1
            i += 1
        else:
            out.append(ch)
            i += 1
    return "".join(out)


def _double_quoted_parts(text):
    """提取 text 中双引号串的内容片段（原样保留 \\x 转义对；跳过 '...' 单引号串）。"""
    parts, i, n = [], 0, len(text)
    while i < n:
        ch = text[i]
        if ch == '"':
            i += 1
            buf = []
            while i < n and text[i] != '"':
                if text[i] == "\\" and i + 1 < n:
                    buf.append(text[i:i + 2])
                    i += 2
                else:
                    buf.append(text[i])
                    i += 1
            parts.append("".join(buf))
            i += 1
        elif ch == "'":
            i += 1
            while i < n:
                if text[i] == "'":
                    if i + 1 < n and text[i + 1] == "'":
                        i += 2
                        continue
                    break
                i += 1
            i += 1
        else:
            i += 1
    return parts


def check_yaml_escapes(raw_text, D):
    """YAML 引号与 LaTeX 反斜杠的三类事故（全部 P1，带行号与修法）：
    1. 未引号标量含 `\\\\`（双反斜杠原样进 MathJax → 报错）；
    2. 未引号标量含 `\\"`（字面渲染成引号）；
    3. 双引号串内"单反斜杠+字母"（疑似 LaTeX）：`\\s` 等非法转义会解析报错，而 `\\t`/`\\n`/`\\L`/`\\P`
       是合法转义——`\tau` 静默变"制表符+au"、`\Lambda` 变"U+2028+ambda"，解析成功但文字已坏。
    双引号串内的合法写法 `\\\\tau`（双反斜杠）与 `\\"` 不受影响。"""
    import re as _re
    # 单反斜杠+字母，且前面不是另一个反斜杠（排除正确双写的 \\tau）
    dq_escape = _re.compile(r'(?<!\\)\\[A-Za-z]')
    for i, line in enumerate(raw_text.splitlines(), 1):
        s = line.strip()
        if s.startswith("- "):
            s = s[2:].strip()
        if not s or s[0] in "'|>" or s.startswith("#"):
            continue
        unq = _unquoted_part(s)
        if "\\\\" in unq:
            D.add("P1", "yaml-escape",
                  f"第 {i} 行：未引号标量含双反斜杠 \\\\——MathJax 会收到 \\\\ 而报错。"
                  f"修法：整段放双引号串内并写 \\\\，或去引号只用单反斜杠 \\")
        if '\\"' in unq:
            D.add("P1", "yaml-escape",
                  f"第 {i} 行：未引号标量含 \\\" ——会字面渲染成引号。修法：改用中文引号“”")
        for seg in _double_quoted_parts(s):
            m = dq_escape.search(seg)
            if m:
                D.add("P1", "yaml-escape",
                      f"第 {i} 行：双引号串内出现 \\{m.group(0)[1]}…（单反斜杠+字母，疑似 LaTeX）——"
                      f"YAML 会把 \\t、\\n、\\L、\\P 当合法转义静默替换成控制字符/行分隔符，"
                      f"\\s 等则直接解析报错。修法：双引号内写双反斜杠（\\\\tau），"
                      f"或去掉引号/改用单引号包裹并保留单反斜杠（$\\tau$）")
                break


def run_static(deck_dir, D):
    deck_dir = Path(deck_dir)
    out_dir = deck_dir / "output"
    yaml_path = deck_dir / "content" / "slides.yaml"
    if not yaml_path.exists():
        D.add("P0", "no-yaml", f"缺少 {yaml_path}")
        return None, ""
    try:
        raw_text = yaml_path.read_text(encoding="utf-8")
        data = yaml.safe_load(raw_text)
    except yaml.YAMLError as ex:
        D.add("P0", "yaml-parse", f"slides.yaml 解析失败: {ex}")
        return None, ""
    check_yaml_escapes(raw_text, D)
    slides = check_yaml(data, D)
    index = out_dir / "index.html"
    if not index.exists():
        D.add("P0", "no-html", "output/index.html 不存在，先运行 build.py")
        return slides, ""
    html_text = index.read_text(encoding="utf-8")
    parser = BalanceChecker()
    parser.feed(html_text)
    for err in parser.errors:
        D.add("P0", "html-balance", err)
    if parser.stack:
        D.add("P0", "html-balance", f"未闭合标签: {parser.stack}")
    n_yaml = len(slides)
    n_html = len(parser.sections)
    if n_yaml != n_html:
        D.add("P0", "slide-count", f"页面数不一致: yaml={n_yaml}, html={n_html}")
    for sec in parser.sections:
        if not sec["has_notes"]:
            D.add("P1", "html-notes", "生成页缺少 <aside class=\"notes\">", sec["id"])
    check_resources(html_text, out_dir, D)
    check_math_balance(parser.sections, D)
    check_mermaid(html_text, parser.sections, D)
    check_density(parser.sections, D)
    return slides, html_text


def run_visual(deck_dir, D):
    deck_dir = Path(deck_dir)
    out_dir = deck_dir / "output"
    script = SCRIPT_DIR / "visual_check.mjs"
    if not script.exists():
        D.add("P1", "visual-unavailable", "visual_check.mjs 不存在")
        return None
    try:
        proc = subprocess.run(
            ["node", str(script), os.path.abspath(str(out_dir))],
            capture_output=True, text=True, encoding="utf-8", timeout=600, cwd=str(script.parent))
    except FileNotFoundError:
        D.add("P1", "visual-unavailable", "node 不可用，跳过视觉检查（静态检查仍有效）")
        return None
    except subprocess.TimeoutExpired:
        D.add("P1", "visual-timeout", "浏览器视觉检查超时（>600s）")
        return None
    report_path = out_dir / "visual-report.json"
    if not report_path.exists():
        D.add("P1", "visual-failed", f"视觉检查未产出报告。stdout={proc.stdout[-400:]} stderr={proc.stderr[-400:]}")
        return None
    vr = json.loads(report_path.read_text(encoding="utf-8"))
    for err in vr.get("console_errors", []):
        D.add("P1", "console-error", f"浏览器控制台错误: {err}")
    for fail in vr.get("request_failed", []):
        D.add("P1", "request-failed", f"资源加载失败: {fail}")
    for pg in vr.get("pages", []):
        sid = pg.get("id", f"page-{pg.get('index')}")
        for ov in pg.get("overflow", []):
            D.add("P1", "overflow",
                  f"元素超出幻灯片边界({ov['direction']} {ov['px']:.0f}px): <{ov['tag']} class={ov['class']}> {ov['text'][:40]!r}", sid)
        co = pg.get("cite_overlap")
        if co:
            D.add("P1", "overlap-cite",
                  f"内容与引用脚注重叠({co['px']:.0f}px): <{co['tag']} class={co['class']}> {co['text'][:40]!r}", sid)
        if pg.get("scroll_overflow"):
            D.add("P1", "scroll-overflow", "页面内容总高度超过幻灯片边界（垂直溢出）", sid)
        if pg.get("mermaid_total", 0) > pg.get("mermaid_rendered", 0):
            D.add("P1", "mermaid-not-rendered", "存在未成功渲染的 Mermaid 图", sid)
        if pg.get("mermaid_error"):
            D.add("P0", "mermaid-error", f"Mermaid 渲染报错: {pg['mermaid_error'][:200]}", sid)
        if pg.get("mathjax_expected") and not pg.get("mathjax_any"):
            D.add("P1", "mathjax-not-rendered", "页面含公式但未见 MathJax 渲染产物", sid)
        if pg.get("mathjax_error"):
            D.add("P0", "mathjax-error", f"MathJax 公式解析错误: {pg['mathjax_error'][:200]}", sid)
        if pg.get("sparse"):
            D.add("P2", "sparse-page",
                  f"版面下半部留白约 {pg.get('bottom_gap')}px：内容集中于上半部。表格页改用 "
                  f"table_mode: spacious；要点页增行距或补实质要点；卡片页用 card_mode: hierarchy", sid)
    return vr


def write_report(deck_dir, D, visual_used):
    out_dir = Path(deck_dir) / "output"
    counts = D.counts()
    lines = ["# 验收报告", "",
             f"- 退出判定：{'✅ 通过（无 P0/P1）' if D.blocking == 0 else f'❌ 存在 {D.blocking} 个 P0/P1 缺陷'}",
             f"- P0={counts['P0']}  P1={counts['P1']}  P2={counts['P2']}（视觉检查：{'已执行' if visual_used else '未执行'}）", ""]
    if D.items:
        lines += ["| 等级 | 页面 | 代码 | 说明 |", "|---|---|---|---|"]
        for d in sorted(D.items, key=lambda x: ("P0", "P1", "P2").index(x["level"])):
            lines.append(f"| {d['level']} | {d['slide']} | {d['code']} | {d['msg'].replace('|', '│')} |")
    else:
        lines.append("无缺陷记录。")
    (out_dir / "validation-report.md").write_text("\n".join(lines), encoding="utf-8")
    (out_dir / "validation-report.json").write_text(
        json.dumps({"counts": counts, "defects": D.items}, ensure_ascii=False, indent=2), encoding="utf-8")


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    args = sys.argv[1:]
    visual = "--visual" in args
    args = [a for a in args if not a.startswith("--")]
    if len(args) != 1:
        sys.exit(__doc__)
    D = Defects()
    slides, _ = run_static(args[0], D)
    vr = run_visual(args[0], D) if visual else None
    write_report(args[0], D, vr is not None)
    counts = D.counts()
    print(f"[validate] P0={counts['P0']} P1={counts['P1']} P2={counts['P2']} "
          f"→ {'通过' if D.blocking == 0 else '未通过（见 output/validation-report.md）'}")
    for d in D.items:
        if d["level"] in ("P0", "P1"):
            print(f"  {d['level']} [{d['slide']}] {d['code']}: {d['msg'][:150]}")
    sys.exit(0 if D.blocking == 0 else min(D.blocking, 125))


if __name__ == "__main__":
    main()
