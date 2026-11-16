---
name: academic-presentation
description: >
  从科研资料（调研报告、论文、实验结果、开题材料）自动生成 Reveal.js 学术演示文稿，
  并保证可验证、可回退、可复用。Use whenever the user asks to create, rebuild, extend,
  or fix an academic presentation / 汇报 PPT / slides / deck / 演示稿 — 包括导师汇报、
  组会汇报、博士开题、论文方法讲解、调研进展汇报、实验结果展示，或将 markdown/tex/报告
  转为 Reveal.js 网页幻灯片。也适用于"给现有演示稿加页/改页/查问题"类请求。
---

# academic-presentation · 学术演示文稿生产技能

**版本：v1.6.1（2026-11-16）。** `chapter-overview` 改为一章一行的纵向目录，按章数自动分配可读行高。v1.6.0 新增自动章节总览与 `ending` 正文/附录边界。v1.5.1 的 `decks/starter/` 为唯一功能示例，覆盖全部布局。v1.5.0 的 `deck.chapter_nav: true` 一行启用自动章节导航。v1.4.3 普通内容页统一标题顶部位置，表格伸展仅作用于表格容器。v1.0 骨架与离线依赖保持冻结。v1.2 固化内容层级、舒适表格、
显式图片比例模式与字号/行高自适应；v1.3 根因修复“内容堆上半部、下半部大块留白”（布局类 +
内容区纵向撑满 + sparse-page 检查）；v1.4 实现“排版免操心”六项（图片自适应、字段 schema 硬校验、
YAML 转义检查、卡片 detail 公式兼容、cite 碰撞检测、表格模式提示）；v1.4.1 一键构建 bat 与
assets 自动复制；v1.4.2 自动页码页脚——`slideNumber: 'c/t'`（每页统一显示 当前页/总页数），
custom.css 将其页脚化（与 cite 同基线、右对齐内容边距、去 vendor 深色 chip），并隐藏常驻
回退箭头让页码独享角落。注意：slideNumber 只接受 'c' 与 'c/t' 精确字面量，带空格会静默退化
为裸页号。改动明细与回归见 `decks/TEST-REPORT.md`；未实现项见其 § 后续改进清单。

**核心原则：固化可靠的生产流程与技术能力，而非固化某一次汇报的内容。**
学术判断属于内容阶段，确定性检查属于脚本；HTML 是展示容器，不是图形生产工具。

## 何时使用 / 何时不用

- ✅ 科研汇报、开题、组会、论文讲解、调研综合 → Reveal.js 幻灯片
- ✅ 修复/扩展现有 Reveal.js deck（先找到或重建 deck 目录，不要直接改生成物）
- ❌ 需要 .pptx 文件交付 → 用 presentations:pptx 技能
- ❌ 单纯改四份调研报告正文 → 直接编辑，不走本流程

## 六阶段流水线（严格顺序，阶段通过即冻结）

| 阶段 | 关键动作 | 完成门槛 | 冻结物 |
|---|---|---|---|
| 1 资料分析与内容策划 | 定听众/时长/核心认识；定向读取，不通读 | 叙事连贯、证据分级、方向候选明确 | `content/slides.yaml` |
| 2 视觉资源管理 | 论文 Figure 优先；必要时画独立 SVG | 资源清单齐、无装饰图 | `assets/` + 清单 |
| 3 技术骨架验证 | 三张代表页（文字图/公式图/SVG+Notes） | validate --visual 全过 | 模板（已验证，勿重写） |
| 4 批量生成 | 由 slides.yaml 构建 | build 无错、首份 checkpoint | `output/index.html` |
| 5 自动验收与视觉检查 | 批量检查 → 集中看截图 | 报告无 P0/P1 | `validation-report.md` |
| 6 定向修复与交付 | 集中登记、定向修、最多两轮 | 触达停止条件 | 交付说明 |

各阶段的输入/操作范围/失败处理/允许修改的文件，**必须**先读
[references/presentation-workflow.md](references/presentation-workflow.md) 再执行。
已知故障模式与历史修复见 [references/design-lessons.md](references/design-lessons.md)——
遇到渲染异常先查该文件，不要重新发明修复。

## Deck 目录契约

```text
<deck>/                          # 建议放 decks/<名称>/
├── content/slides.yaml          # 唯一内容源（页面全部学术内容在这里）
├── content/evidence.md          # 可选：证据摘要/核查记录摘录
├── content/deck.css             # 可选：deck 级样式追加（公共样式不足时才用）
├── assets/                      # papers/ diagrams/ results/ icons/
├── assets-manifest.md           # 资源清单（路径/来源/含义/原图或重绘/已验证）
└── output/                      # 全部生成物，可随时删除重建
    ├── index.html  vendor/  custom.css
    ├── screenshots/  validation-report.md  visual-report.json
```

## 命令速查（从仓库根目录执行）

```bash
python src/academic-presentation/build.py <deck>                  # 构建（yaml → html + vendor）
python src/academic-presentation/validate.py <deck>               # 静态检查（快）
python src/academic-presentation/validate.py <deck> --visual      # + 浏览器逐页截图与溢出/渲染检查
python src/academic-presentation/build.py checkpoint <deck> <标签>  # 批量修改/公共样式改动前必做
python src/academic-presentation/build.py restore   <deck> <标签>   # 大范围损坏立即整体回退
```

退出码 = P0+P1 数量；0 才算通过。P2 只记录，不自动开新一轮修改。

## slides.yaml 最小 schema

```yaml
deck: { title, author, date, chapter_nav: false }  # 可选开关，true 启用自动章节导航
slides:
  - slide_id: s01-cover            # 唯一、稳定
    layout: cover                  # 另含 section/bullets/image/image-text/compare/table/roadmap/conclusion/chapter-overview/ending/html
    kicker: 第一部分 · 问题与任务    # 可选眉题
    title: 页标题
    content: { … }                 # 各 layout 字段见 references/presentation-workflow.md 附录A
    cite: 页脚引用行                # 建议含 作者, 年份, 公式/图号
    sources: [报告一 §2.1, Zaki & Wang 2021 eq.(7)]   # 证据来源，可追溯
    notes: Presenter Notes         # 必填；复杂解释放这里，不塞正文
```

每页一个中心观点；复杂解释放 notes；技术细节可入附录页，不得为压缩正文丢证据。
`layout: html` 是逃生舱（整页原生 HTML，用于迁移已验证页面），禁止当作常规手段。

## 硬性规则（违反任何一条 = 流程失败）

1. 阶段 3 未通过前，禁止批量生成正式页面；模板与 vendor 已验证，禁止重写或换版本。
2. 视觉资源优先级：论文 Figure > 实验图 > 已有示意图 > 独立绘图工具生成的 SVG 文件 > 简单 HTML/CSS。
   禁止内联 SVG 手绘复杂架构、禁止装饰性粒子/背景、禁止 Base64 内嵌、禁止每页强制配图。
3. 严格区分证据等级：原论文证明的事实 / 调研报告的解释 / 跨文献推断 / 未验证假设，不得混写为确定性结论。
4. 不得伪造论文图、数据或引用来源；cite 行缺失的内容页视 P2 缺陷登记。
5. 公共 CSS/JS 或批量文本修改前必须 checkpoint；改后全局回归（所有受影响 deck 重跑 validate --visual）。
6. 批量操作导致大范围损坏 → 立即 restore 整体回退，禁止逐处手工猜修。
7. 禁止缩小整体字体、隐藏溢出、裁切内容来"通过"验收；溢出 = 修内容或拆页。
8. 最多两轮集中修复；达到停止条件立即交付，不自主润色。
9. 已完成的文献核查（如 核查进度.md）必须复用，不重复搜索阅读；大文件定向读取。
10. 汇报进展时只说：已产出的产物 / 当前阻断 / 下一步。
11. 图文页先判断图片是否承担主叙事及其纵横比，再显式选择 `image_mode`：近方图用 `side`、
   中等横图用 `side-dominant`、极宽主图用 `wide-hero`；不得将所有图片塞入等宽半栏。
12. 有效利用版面靠信息层级，不靠重复文字或缩小字体：卡片可用 `thesis/detail/cue`，表格优先
   用 `table_mode: spacious` 保持可读性。视觉检查须人工确认主图、文字栏、卡片和表格均舒适可读。
13. 主要可见文字的硬下限为 **18px**：眉题不低于 20px，正文/表格优先 20px 以上；引用和图注也不得
   低于 18px。表格优先增加行高与单元格上下留白，不以压缩行距换空间。
14. 仅在分层卡片等有明确可用高度的区域可声明 `fit_text: {min, max, min_line_height, max_line_height}`；
   浏览器在上下限内联动字号和行高，选择不溢出的最大组合。不得把它用于整页正文或作为缩小文字的手段。
