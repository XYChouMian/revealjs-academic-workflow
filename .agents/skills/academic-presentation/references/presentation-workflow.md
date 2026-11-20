# 学术演示文稿生产工作流 · 详细阶段规范

本文件是 `academic-presentation` Skill 的执行规范：各阶段的输入、操作范围、产物、
完成门槛、失败处理、允许修改的文件与进入下一阶段的条件。阶段通过即冻结，
禁止在下游阶段无故重开上游工作。全部阶段默认自主执行，仅重大目标冲突才向用户澄清。

流水线：**资料分析 → 内容策划 → 证据核查 → 视觉资源准备 → 技术骨架验证 → 批量生成 → 自动验收 → 定向修复 → 交付**
（证据核查融入阶段 1；骨架已随本 Skill 验证过时阶段 3 可只做复检）。

---

## 阶段 1：资料分析与内容策划

**输入**：用户提供的报告/论文/数据；项目内既有核查记录（如 `核查进度.md`）、
`references.bib`、既有 deck。**操作范围**：只读资料 + 写 `content/slides.yaml`、`content/evidence.md`。

1. 先定五要素：听众与背景 / 汇报目的 / 时长 / 资料来源 / 需要听众讨论或决定的问题。
2. 多报告整合时，读取顺序：目录 → 摘要 → 结论 → 对比表 → 既有核查记录 → 按需读关键正文节。
   **不得为了表现工作充分而通读全部文献**；已完成的正文级核查直接复用（查 `核查进度.md` 汇总结论）。
3. 文献介绍统一叙事：**研究困难 → 已有方法局限 → 作者的机制 → 实际结果 → 对当前研究的启发**。
   重点讲"为什么这样设计"，不是罗列模型结构与术语。
4. 证据分级并写进 `sources` 字段：`[原文已证] / [报告解释] / [跨文献推断] / [未验证假设]`，
   页面上不把低等级证据写成确定性结论。跨报告矛盾要显式呈现，不擅自抹平。
5. 介绍论文时必须核对原始任务、输入观测与输出目标；预测、插补与平滑不得因结构相似而混同。
6. 引用定量物理判据时必须同时写明工况、所用方法与适用范围；条件性结论不得改写为普适规律。
7. 实验结果只支持其对应设置下的推论；相关性、敏感性或性能差异不得直接解释为唯一因果机制。
8. 导师调研汇报的内容边界：展示"调研完成了什么 / 领域已有方法到什么程度 / 可靠认识 /
   未解决问题 / 候选方向 / 待补证据"。重点线索（如双向时间信息、显式时空图）作为候选方向呈现，
   **未经论证不得确立为唯一课题**。制作过程、核查历史、验收清单不进正文。

**产物**：`content/slides.yaml`（唯一内容源）。每页含 slide_id / 本页回答的问题（写进 notes 开头或注释）/
一个核心观点 / 要点 / 视觉需求 / 证据来源 / Presenter Notes / 推荐布局。

**完成门槛**：叙事连贯、主次清楚、核心判断可查、候选方向与已有成果区分明确。
**失败处理**：资料缺口导致叙事无法成立 → 列出缺口向用户澄清，其余部分照常推进。
**冻结**：进入阶段 2 后不再改叙事结构；后续只允许定向内容修复。

## 阶段 2：视觉资源管理

**输入**：slides.yaml 各页视觉需求、`PDFs/`、既有图表。**操作范围**：写 `assets/` 与 `assets-manifest.md`。

- 优先级：论文 Figure > 实验结果图 > 项目已有示意图 > 独立绘图工具生成的必要示意图 > 简单 HTML/CSS。
- 需要"重新绘制的科研图"必须落成独立文件（`assets/diagrams/*.svg` 或 PNG），含义经内容阶段确认；
  建议用绘图工具生成后保存，而不是在 HTML 里手写几十个元素。
- **禁止**：内联 SVG 手绘复杂架构 / 几十个 div 模拟图结构 / 装饰性粒子与科技背景 /
  Base64 内嵌 / 为凑版式每页配图 / 有原图时重画。
- PDF 取图可用 `python -c "import fitz"`（PyMuPDF）或 pdftoppm 导出指定页。
- 资源清单每行记录：文件路径 / 来源论文或资料 / 对应页面 / 科学含义 / 原图或重绘 / 是否已验证。
- 为每张承担解释任务的图片记录其**科学角色**与**纵横比**，再选择图文模式；不要先套等宽双栏。

| 图片条件与角色 | `image_mode` | 版式规范 |
|---|---|---|
| 近方形/纵向图，文字与图同等重要 | `side` | 均衡双栏 |
| 中等横图，图片需读清标签或对比细节 | `side-dominant` | 图片宽栏、文字保留舒适阅读宽度 |
| 极宽图，图片承担核心机制或结果解释 | `wide-hero` | 全宽主图，下方横向结论带 |

模式必须由内容作者显式写入 `slides.yaml`，构建器不根据像素比例猜测叙事。

**完成门槛**：关键页面资源全部落实，无未解决引用、无装饰图。
**失败处理**：找不到原图且无法重绘 → 该页降级为文字+notes，登记待补资源，不阻塞整条流水线。

## 阶段 3：技术骨架验证（强制，先于批量生成）

模板 `templates/academic-reveal/` + `vendor/` 已通过验证（2026-10-21，见 design-lessons.md），
**含固定版本：Reveal.js 4.6.1 / MathJax 3.2.2 / Mermaid 11.17.2，完全离线**。

- 新环境首次使用或模板被改动过 → 用唯一示例 `decks/starter/` 跑
  `build.py` + `validate.py --visual`，并人工查看 `output/screenshots/` 三张代表页
  （文字/图片布局页、公式+Mermaid 页、SVG+表格+Notes 页）。
- 通过后冻结骨架；任何 deck 不得重写 vendor 加载、初始化脚本、公共 CSS。
- CDN 不作为依赖路径；若必须在线引用（如外链图片），在 validate 中会登记为 P1，
  需用户确认后降级处理。

**完成门槛**：validate --visual 退出码 0 且人工截图复核通过。
**失败处理**：骨架问题修模板 + 记录 design-lessons.md；禁止在单个页面内打补丁绕过。

## 阶段 4：批量生成

画布比例由 `deck.aspect_ratio: "16:9" | "4:3"` 选择，缺省为 16:9；对应逻辑画布为
1280×720 与 960×720。同一套布局和模板适配两种比例，不复制模板。4:3 只收紧横向组织、减少栏间距，
不降低字号。视觉检查器按构建清单中的原生画布尺寸截图和测量。

章节导航仅由 `deck.chapter_nav: true` 启用（缺省 false；必须为布尔值）。构建器自动提取
第一个 `layout: ending` 之前的 `section` 标题与 slide_id，页面归属于此前最近章节；首章前不高亮。
不维护独立目录或逐页章节字段。导航覆盖画布顶部的预留带，不再从 Reveal 视口扣除高度；因此开启
导航不会把 16:9 或 4:3 页面缩成第三种有效比例。无章节时不生成导航。长章名横向滚动并自动显示当前章。
修改相关模板后，除全 deck 视觉回归外运行 `node tests/chapter-nav.mjs` 验证交互。

`layout: chapter-overview` 不接受手写目录内容，自动使用同一份正文章节数据生成编号、标题和跳转；
目录固定为一章一行的纵向排列，按章数在 52–96px 范围内自动分配行高，不缩小章名字号。
当前最多 8 章。`layout: ending` 既是结束页模板，也是正文/附录边界：之后的 section 保留章节页
视觉样式，但不进入总览与导航，且不高亮正文章节。整份 deck 最多一个 ending；省略时所有 section
均属于正文。页码分母自动取 ending 的实际页码；附录的当前页码继续递增，但不增加分母。无 ending
时分母为全部幻灯片数量。chapter-overview 必须位于 ending 前，且正文至少有一个 section。

**输入**：冻结的 slides.yaml + assets。**操作范围**：只运行 `build.py`；不手改 output/。

- 布局只用标准布局；在既有布局上优先使用已验证的可选表现字段，页面级特殊样式才进 `content/deck.css`，
  禁止改动公共 custom.css 来服务单页。
- 信息卡避免同权重短句堆叠：需要填充并组织版面时，用 `card_mode: hierarchy` 与
  `thesis`（主判断）/ `detail`（解释）/ `cue`（讨论提示）。章节页可用
  `point_mode: hierarchy`，结论页可用 `conclusion_mode: cards`。分层卡片必须保持
  `title > thesis > detail > cue` 的字号顺序；`fit_text` 只能在该层级内放大 detail，不能反超 thesis。
- 表格模式选择判据：**行数 ≤6 且单元格文本短的表格必须用 `table_mode: spacious`**（20px 字号、
  58px 行高撑满版面，避免"短表贴顶、下半部大块空白"）；行数 ≥7 或单元格较长时用 `standard`；
  只有确有高密度、且仍可读时才用 `compact`（旧 `dense: true` 兼容映射到该模式）。
  视觉检查会以 `sparse-page`（P2）自动标记内容结束位置距引用安全区超过约 110px 留白的内容页。
- 字号与行距不可分开处理：主要可见文字最低 **18px**，眉题最低 20px；表格和卡片正文优先 20px。
  表格先调行高、单元格上下留白和列宽，再考虑压缩内容，禁止把行距压紧来换空间。
- `card_mode: hierarchy` 可附 `fit_text: {min, max, min_line_height, max_line_height}`。浏览器会在
  `18 <= min <= max` 的边界内选择不溢出的最大字号，并同步提高行高；它只应用到卡片的解释区，
  不作用于标题、整页正文、引用或图注。
- 每页一个中心观点；复杂解释放 notes；技术细节可入附录。
- Notes 默认写“帮助理解”而非“演讲稿”（2026-10-25 用户偏好）：解释页面上每个术语/概念的含义、
  展开机制与数字的来龙去脉和适用条件、说明该页与其他页/报告的联系；用平实语言，可少量准确类比；
  禁止只做本页内容的简单重复或“下一页我们将看到”式串场。段落用 `<br>` 分隔（演讲者视图有效）。
  用户明确要求讲稿时才改写为演讲稿风格。
- 生成后立即保存首份检查点：`build.py checkpoint <deck> init`。
- build.py 会把 `assets/` 整体复制进 `output/`（清理重建，与 vendor 同策略）——构建后无需手动复制图件；
  yaml 中图片路径写 `assets/...` 即可。
- 人工快速迭代：`一键构建.bat` 是标准交付物——模板位于仓库根目录 `templates/academic-reveal/一键构建.bat`，
  **build.py 构建每个 deck 时自动放置到 deck 根目录**（仅缺失时放置，不覆盖已有定制）。双击 = 编译 +
  用默认浏览器打开放映，成功后 cmd 窗口自动关闭；出错（无 python、yaml/字段错误）停窗显示原因。
  bat 内容必须保持纯 ASCII（cmd 按 ANSI 代码页解析，UTF-8 中文会断行）。
  完整验收（含视觉检查）仍走命令行 validate。
- `一键导出PDF.bat` 同样由 build.py 在缺失时放到 deck 根目录且不覆盖定制文件。它只读取
  已有 `output/index.html`，输出 deck 根目录 `presentation.pdf`，不会隐式构建或修改 output；
  内容变化后须先构建。PDF 固定一张幻灯片一页，fragment 显示最终状态，不含导航和 Presenter Notes。

**完成门槛**：build 退出码 0。
**失败处理**：yaml 语法/字段错误 → 修 yaml 重跑；build.py 报未知 layout → 查附录 A 字段表。

## 阶段 5：自动验收与视觉检查

**策略：先批量检查，再集中修复。禁止边看边修、反复截图。**

1. `validate.py <deck> --visual`：结构合法 / 资源存在 / 页数一致 / Notes 齐全 /
   公式配平 / Mermaid 渲染 / 越界与溢出 / 下半部留白（sparse-page）/ 控制台错误 / 逐页截图。
2. 集中查看 `output/screenshots/` 一轮，重点放大：复杂机制图、多列表格、公式密集页、
   中文标签 SVG、高信息量总结页；同时确认主图足够大且不裁切、文字栏不窄、卡片有层级而非下半页空白、
   所有主要文字不低于 18px、表格未因紧凑行距而出现小字密集。禁止为轻微美观差异反复检查同一页。
3. 缺陷分级：**P0**（科学事实错误/页面损坏/核心功能失效）、**P1**（主要文字不可读/
   核心图裁切/严重溢出/关键信息缺失）、**P2**（轻微间距/配色/润色）。本轮必须解决 P0/P1；
   P2 只登记不处理。

**完成门槛**：报告无 P0/P1。
**失败处理**：visual_check 报"无法启动浏览器" → 降级静态检查并在交付时注明视觉检查未执行。

## 阶段 6：定向修复与交付

- 缺陷集中登记（validation-report.md + 人工截图结论）后统一处理：
  页面错误只改该页 yaml；资源错误只改资源；**公共 CSS/JS 改动必须先 checkpoint 并全局回归**
  （所有已交付 deck 重跑 validate --visual）。
- 模板级改动（skill 的 custom.css / reveal-base.html / build.py / 检查脚本）无 deck checkpoint
  可用，流程为：先备份到 `backups/<标签>-<日期>/` → 改动 → 全部 deck 重建 + `validate --visual`
  回归（要求全部退出码 0）→ 抽查代表页截图（表格/卡片/公式/图文各至少一页）→
  在 `decks/TEST-REPORT.md` 记录回归结果并更新 SKILL.md 版本号。无法收敛时从备份回滚模板。
- 批量替换先小范围试跑并 diff；一旦大范围损坏 → `build.py restore` 整体回退重来，
  禁止逐处猜修。已验证且未受影响的页面不重复检查。
- 禁止缩字体/藏溢出/裁内容伪造通过。默认最多两轮集中修复。

**停止条件（全部满足立即交付，不再润色）**：无已知 P0/P1；可正常导航；
主要文字、公式、科研图可读；Notes 正常；外部资源有效；关键论断可溯源；已给运行说明。

**交付物**：deck 目录 + 运行说明（打开 `output/index.html`，方向键翻页，S 键看 Notes，
F 键全屏；需要 PDF 时在构建后运行 `一键导出PDF.bat`）+ 缺陷记录（含未解决的 P2 与待补资源）。

---

## 附录 A：layout 字段速查

所有 layout 的 content 均额外支持 `note / callout / box`。三者接受字符串或
`{label?, text}` 对象，按 note → callout → box 在主体下方统一渲染一次。强度分别为：
浅灰底细框、浅底左强调线、完整实线框与明显底色；正文统一20px、行高1.45。
提醒区保留自然高度、不压缩，主体使用剩余高度；放不下时拆分内容，不缩字或截断。
原生 HTML 页也由外层追加提醒，不在 content.html 内再手写同一提醒。
`notes` 是独立的 Presenter Notes。兼容 callout.style: main 的强调色；
box.style: note/tbd 接受但统一为强提醒，不改变结论页原有栏目的样式。

| layout | content 字段 |
|---|---|
| cover | subtitle / concern / meta(列表或字符串) |
| section | no / points（字符串，或 `{term,detail,cue}`）/ `point_mode: standard\|hierarchy` |
| bullets | lead / bullets / callout{label,text,style:main} / box{style:note\|tbd,text} / mermaid |
| image | src / caption / alt / bullets / mermaid（max_height 已废弃：v1.4 起图片自动适配剩余高度） |
| image-text | image{src,caption} / side:left\|right / `image_mode: side\|side-dominant\|wide-hero` / bullets / callout / mermaid（max_height 已废弃） |
| multi-image | images[{src,title?,content?,alt?,white_background?}] / mode:auto\|manual / gap（默认16）/ callout；manual 另需 columns、rows 正数权重列表，每图 row/column（从1开始）、rowspan/colspan（默认1） |
| compare | cols[{title,items 或 thesis/detail/cue，html 兼容，highlight}] / `card_mode: standard\|hierarchy` / callout / mermaid |
| table | headers / rows / highlight_row（单行）/ highlight_rows（多行整数列表）/ `table_mode: standard\|spacious\|compact` / dense（兼容）/ note / mermaid |
| roadmap | steps[{phase, items 或 thesis/detail/cue}] / `card_mode: standard\|hierarchy` / 可选 `fit_text` / mermaid / note |
| conclusion | takeaways / open / next / 可选 `labels: {takeaways, open, next}`（页面级栏目名）/ `conclusion_mode: standard\|cards` / callout |
| chapter-overview | 仅通用提醒字段；目录自动列出 ending 之前的 section（最多 8 章） |
| ending | subtitle / prompt / meta（字符串或列表）；同时标记正文结束 |
| html | html（整页原生 HTML；含 `<section` 时完全接管） |

布局类与纵向撑满（v1.3/v1.4）：build.py 为每页输出 `layout-<布局>` 类；表格（table）、要点
（bullets）、卡片栏（compare/roadmap）、结论（conclusion）与图文页（image/image-text）的骨架为
flex 纵向列，内容区自动撑满剩余高度——表格行随版面分布、卡片填满所在列、**图片自动占据剩余高度
（object-fit:contain，agent 只写 src/caption/side，不再写 max_height）**，新 deck 不再需要
deck.css 补丁。html 逃生舱不参与。display 声明带 `!important`：Reveal 对可见 slide 内联写
`display:block`；side-dominant/wide-hero 为 grid 容器，行高已固定为 minmax(0,1fr) 以保证
图片受约束。构建期硬校验：content 中出现该布局不支持的字段会直接报错（各布局可用字段见
build.py 的 LAYOUT_FIELDS）；未引号标量中的 `\` / `\"` 由 validate 的 yaml-escape 检查（P1）。

通用规则：**公式一律用 LaTeX**（行内 `$...$` 或 `\(...\)`），禁止用 Unicode 近似拼公式（如 10·log₁₀(MAX²/MSE)、‖H(q)−y‖² 这类写法）——孤立符号的行文提及（τσ、2Λ、Re）不受此限；yaml 转义规则：双引号串内写双反斜杠、未引号标量写单反斜杠，两法等价，混用会被 yaml-escape 检查拦下。要点可含内联 `<b>/<i>/<sub>/<sup>`、行内公式 `$...$`、`\(...\)`；
Mermaid 源码用 `content.mermaid` 字段（构建时放入原生 `.mermaid` div，并用 `tex2jax_ignore` 让公式引擎跳过）；
图片路径写 `assets/...`（相对 output/；build.py 已自动复制 assets 目录）。

### 多图页面规范

逐图 `content_position` 还支持 `left`：与right镜像，标题和说明整体在图片左侧、垂直居中、
组合高度不超过实际图片高度；支持同样的25%/33%/40%/50%/70%栏宽及160px最小宽度。
显式left在auto/manual均生效；未指定时仍使用既有auto选择与manual缺省行为。

每图支持 `content_position: bottom|right`；auto 缺省时比较两者、同分优先下方，manual 缺省下方。
显式值必须遵守。bottom 下标题位于图片上方、说明在下方，两者水平居中。
right 下标题与说明一起在右栏上下排列、文字居中，整个文字组合的高度（含8px间距）不得超过图片高度，
并与实际图片垂直中心对齐。只有标题或说明同样适用，两者都没有不分配右栏。
图片、文字几何数据由同一测量函数计算并用于评分与最终显示；右栏比较25%/33%/40%/50%/70%，
最小160逻辑像素。按右栏宽度测量换行后的标题/说明，候选违反高度约束则淘汰；强制right无解须报错。
验证须检查整组文字的中心与上下边界、无重叠、70%档位及显式位置生效。

两张及以上科研图优先使用 `multi-image`，不要用 compare 的 html 卡片堆图。
每图标题、说明按实际文本高度占位，剩余空间给图片；两者可省略，省略后不保留空栏。
标题22px、说明20px，行高1.35/1.45；不得用缩字、截断文本或裁切图片应付过密内容。
`auto` 默认开启换序，科学上必须固定左右/步骤关系时用 `manual`。
自动算法读取原始图片纵横比，并在字体、公式、图片就绪后测量实际文本；采用有界分组搜索，
优先放大最小图片，其次增大总图片面积，并保留等分网格面积基线。它不推断叙事主次、不裁原图白边。
手动模式通过行列权重和跨度分配空间，构建期拒绝重叠、越界和无效权重。所有配置仍在 slides.yaml 中。
字号按图片数自动分档：2–3图为22/20px、4图为20/18px、5图以上为18/18px；同页统一，文字仍
无法容纳时按比例继续缩小并选择最大可行字号。多图页允许低于普通页面18px下限，不能因此单独判为
P0/P1。图片缺失、网格无有效尺寸时仍显式报错；视觉验收等待布局完成。模板修改后运行 `node tests/multi-image.mjs`，
覆盖四种画布/导航状态及自动、手动、缺图和非法配置。示例与完整 YAML 写法见根 README。

## 附录 B：对抗测试（重大改动后必须重跑）

- **测试 A 无图调研**：纯文本输入 → 不强制配图、无装饰 SVG、必要图走独立文件、叙事清晰。
- **测试 B 公式与机制图**：LaTeX + Mermaid + 多层架构 → 公式渲染、Mermaid 显示、
  无文字裁切、溢出可检出、Notes 正常。
- **测试 C 批量损坏**：在可恢复副本模拟批量损坏 → 检查器识别、restore 回退、
  不逐处修、回退后重验。
记录实际结果（含失败与修复过程）到 `decks/TEST-REPORT.md`，禁止只写"预期通过"。
