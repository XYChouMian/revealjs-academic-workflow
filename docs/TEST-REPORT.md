# academic-presentation 工作流 · 验证与对抗测试报告

日期：2026-10-21 · 环境：Windows 10 + Git Bash + Python 3.11 + Node 24 + 系统 Chrome（playwright-core 驱动）
所有结论均来自实际运行输出，无"预期通过"项。

## 0. 技术骨架验证（阶段 3 门槛）

`decks/skeleton-test/`（4 页：文字/图片布局、公式+Mermaid、表格+Notes、封面）。

- 首轮 build+validate：发现并修复 4 个模板级问题：
  1. vendored white.css `@import` 缺失字体 CSS → 离线断点，已从 vendor 副本移除；
  2. `Reveal.isReady()` 误打在全局构造函数 → 模板暴露 `window.__deck` 实例；
  3. Mermaid 卡片底边压住 cite 引用脚注（实测截图）→ section 底部 padding 30→58px；
  4. 封面/章节页垂直居中被 Reveal 内联 `display:block` 覆盖 → `.cover/.section-slide` 用 `display:flex!important`。
- 末轮：`validate.py --visual` 退出码 0，4 页截图人工复核通过（公式、Mermaid 中文标签、图片约束、表格高亮均正常）。

## 1. 测试 A：无图片的学术调研

- 输入：`decks/test-a-textonly/input-source.md`（真实报告 §2 节选，54 行纯文本）。
- 结果：8 页 deck，7 页纯文字/表格，唯一必要示意图为独立文件 `assets/diagrams/gain-window.svg`；
  无装饰性图形；每页 notes/sources 齐全。`validate --visual` 通过。
- **过程中发现 P0 并修复**：a06 标题出现 MathJax 错误文本 "MISSING OPEN BRACE FOR SUBSCRIPT"
  （未加引号的 YAML 标量中 `\\tau` 不转义，公式引擎收到行分隔符）。已修内容；
  并为 visual_check.mjs 增加 `mjx-merror` 检测（此后此类错误直接报 P0）。

## 2. 测试 B：公式与复杂机制图

- 输入：`decks/test-b-formula/`（aligned/cases 公式、三层 subgraph Mermaid、五行密集表、故意超载页）。
- 首轮 validate：**38 条 P1**——故意超载页（b05）与架构图（b02）溢出均被正确检出（其中大量为同一根因的
  祖先元素重复计数，已给检查器加"只报最外层越界元素"去重，38 → 5 条）。
- 集中修复（1 轮）：b05 拆成两页；b02 架构图改 LR 三列紧凑布局。复检通过。
- 补充实测：MathJax aligned/cases 渲染正确（截图）；Mermaid 中文标签无裁剪；
  按 S 键弹出 Speaker View 且显示当前页 notes（Playwright 弹窗实测）。

## 3. 测试 C：批量修改损坏与回退

- 操作：复制 skeleton-test 为 `decks/test-c-corruption/`，保存检查点 `before-batch`；
  模拟破坏性批量操作（4 个 `</section>` 全部替换为 `</sect ion>` + yaml 中 notes 行全删）。
- 检查器识别：退出码 5（P0×1：yaml 解析失败；视觉检查还抓到标签损坏导致的连带越界）。
- 回退：`build.py restore decks/test-c-corruption before-batch` 一次性整体回退（未逐处手修）；
  复检通过（退出码 0）。

## 4. 试点：四份报告的小范围内容与流程验证

- `decks/pilot-four-reports/`（10 页，导师调研进展汇报定位）。
- 内容来源：报告二结论速览（§1）、报告四 §1–2、报告三 §1–2、`核查进度.md` 汇总结论（定向读取，未通读）。
- 叙事：调研完成情况 → 报告分工 → 领域现状 → 机制辨析（联合≠双向）→ 可靠认识 →
  空白定位图 → 候选方向（显式标注"未验证假设"）→ 验证设计（三组对照+三反向实验）→ 三项请示。
- 首次 build+validate 即通过；视觉检查发现 2 个缺陷并修复（1 轮）：
  1. p05 标题字面渲染 `\"`（未引号标量转义，同测试 A 根因）→ 改用中文引号；
  2. gap-map.svg 左列文本越线/被框体遮挡 → 重排版式（收窄文本、双列布局）。
- 复检通过；截图人工复核（封面/对比/矩阵/结论页）正常。

## 5. 沉淀回工作流（本次新增的检查能力）

- MathJax 错误文本检测（mjx-merror → P0）
- 越界元素只报最外层（缺陷去噪）
- design-lessons.md 新增三条：YAML 未引号标量不处理反斜杠转义（公式必须写在双引号串内或用单反斜杠）、
  Reveal 内联 display 覆盖、底部 cite 安全区。

## 已知限制（如实记录）

- 视觉检查依赖系统 Chrome/Edge；两者都缺失时 validate --visual 降级为静态检查（显式报告）。
- 页面内元素重叠（非溢出型）暂无自动检测，依赖人工视觉轮。
- vendor 版本固定为 reveal 4.6.1 / MathJax 3.2.2 / mermaid 10.9.1；升级需重跑骨架验证。
- 溢出检测容差为缩放感知的 4px；极端字体环境可能有 ±1px 级出入。

## 最终验收补充记录（2026-10-21）

1. **学术内容验收**：`decks/pilot-four-reports/CONTENT-REVIEW.md`——修复 2 个 P1
   （p02 PDF 数量过期 22/58→193 条库 57 条挂接；gap-map 列分类学错误）+ 2 处一词级收窄，复检通过。
2. **真实论文 Figure 验收**：`decks/figure-test/`——从 `PDFs/zaki2021limited.pdf`
   （Zaki & Wang, PRF 6, 100501 (2021)，即报告引用 [59]）第 5 页提取 FIG. 1（伴随变分同化机制），
   原图 4× 裁剪未改动；引用记录见 `decks/figure-test/assets-manifest.md`；单页测试 slide
   `validate --visual` 通过，截图复核清晰度、相对路径、离线加载、图文对应全部合格。
3. **独立调用验收**：全新无上下文子代理 + 一条简短指令，自主发现 `.agents/skills/academic-presentation/SKILL.md`
   → 按其指引读取 presentation-workflow.md → 正确执行静态+视觉验收并准确报告退出码与计数，未改动源文件。

## 后续改进清单（v1.0 冻结时未实现，均为非阻断）

- [ ] assets/ 资源清单的脚本化强制检查（现为约定+人工）
- [ ] 页面内元素重叠（非溢出型）自动检测
- [x] roadmap 布局已由 `decks/four-reports-full/` g02 实战使用（hierarchy 卡 + fit_text），v1.3 回归中视觉复核通过
- [ ] 跨项目复用时的用户级安装路径（`~/.agents/skills/`）未演练
- [ ] PDF 取图目前为一次性脚本（pymupdf 内联），未沉淀为带裁剪预览的小工具

## v1.3 回归记录（2026-10-25）· 模板级修复"内容堆上半部/下半部留白"

**动因**：four-reports-full g15（物理约束适用条件表）被用户指出"行距过小、上挤下空"。
根因：模板中表格/卡片栏的内容区不随 720px 版面纵向伸展，内容少时必然堆顶。
deck 级补丁（deck.css 调行距）只能逐 deck 治标，故做模板级根因修复。

**改动**（备份于 `skill/backups/pre-v1.3-20261025/`）：
1. `build.py`：每页输出布局类 `layout-<布局>`（cover/section 追加既有行为类）。
2. `custom.css` 新增"内容区纵向撑满"一节：table/bullets/compare/roadmap/conclusion 五布局
   骨架改 flex 纵向列（display 带 `!important`——Reveal 对可见 slide 内联写 `display:block`，
   这是首轮验证抓到的坑）；表格行随版面分布、卡片填满所在列；要点页行距 5→8px、结论框留白加大。
   图文页与 html 逃生舱不参与。
3. `visual_check.mjs` + `validate.py`：新增 sparse-page 检查（内容结束位置距引用安全区
   >110px 的内容页记 P2 提示；封面/章节页豁免；不影响退出码）。
4. `presentation-workflow.md`：表格模式判据硬化（行数 ≤6 且单元格短 → 必须 spacious）；
   附录 A 布局类与撑满说明；阶段 6 模板级改动流程（备份→改动→全 deck 回归→记录）。
5. four-reports-full 的 deck.css 行距补丁删除（模板接管其职责）。

**全量回归**（8 deck 全部重建 + validate --visual）：

| deck | 结果 |
|---|---|
| skeleton-test | P0=0 P1=0 P2=0 ✅ |
| test-a-textonly | P0=0 P1=0 P2=5 ✅ |
| test-b-formula | P0=0 P1=0 P2=3 ✅（公式页 MathJax 在 flex 骨架下渲染正常） |
| test-c-corruption | P0=0 P1=0 P2=1 ✅ |
| pilot-four-reports | P0=0 P1=0 P2=4 ✅（conclusion 卡页视觉复核正常） |
| figure-test | P0=0 P1=0 P2=0 ✅ |
| formal-advisor-v1 | P0=0 P1=0 P2=13 ✅（表格/卡片页反而改善：行分布满版、cue 沉底） |
| four-reports-full | P0=0 P1=0 P2=10 ✅（sparse-page 从 12 页收敛到 2 页，余 114/121px 属自然页脚呼吸空间） |

**截图抽查**：formal f04（表格行分布）、f15（side-dominant 图文页无回归）、f18（卡片 cue 沉底）、
test-b b03（公式密集页）、four-reports-full g02（roadmap 卡满高）、g15（58px 行高满版）、
pilot p10（conclusion 卡）——全部正常。

## 清理记录（2026-10-25）

应用户要求删除测试与被取代的 deck（skeleton-test、test-a/b/c、pilot-four-reports、
figure-test、formal-advisor-v1），仅保留最新交付版 `decks/four-reports-full/`。
上文各回归记录中的 deck 名为历史快照；其结论已沉淀进模板（v1.3）与本文档，不依赖原目录存在。
同轮修复两处检查器噪声：orphan-asset 前缀归一化（兼容 assets/ 与 ../assets/ 两种引用写法，
消除 8 条误报）、sparse-page 提示文案按布局对症（表格/要点/卡片）。清理后以 v1.3 工作流完整
刷一遍 four-reports-full（checkpoint v1.3-baseline → build → validate --visual）：
P0=0 P1=0 P2=2（仅 g34/g54 两页 114/121px 自然留白提示），验收通过。

## v1.4 回归记录（2026-10-25）· "排版免操心"六项

**动因**：用户要求评估 workflow 能否让 agent 专心内容、不操心排版。评估结论：约 80% 已达成，
残留五类真实事故（3 次图片高度试参、4 次字段静默丢失、1 次 `\` 转义、1 次卡片公式拆列、
5 次 cite 碰撞全靠人眼）。v1.4 针对每类事故给出机制性修复。

**改动**（备份于 `skill/backups/pre-v1.4-20261025/`）：
1. **图片自适应**：image/image-text 纳入撑满骨架（flex + `!important`），`.figure`/`img` 以
   flex:1 + min-height:0 + object-fit:contain 自动占据剩余高度；side-dominant/wide-hero 为
   grid 容器，行高固定 `minmax(0,1fr)`（实测抓到的坑：grid 行高 auto 由内容决定、不受已收缩
   容器约束，导致 g35 图列溢出 40px）。build.py 停发 inline max-height（字段保留、构建时打印
   废弃提示）；yaml 中 3 处 max_height 删除。
2. **字段 schema 硬校验**：build.py 新增 LAYOUT_FIELDS（与渲染器同文件维护）；未知字段构建期
   报错并列出可用字段——杜绝"写了 callout 但 table 布局静默丢弃"。
3. **YAML 转义检查**：validate.py check_yaml_escapes——剥离引号串后检查未引号标量中的 `\`
   与 `\"`（P1，带行号与修法）。上线即抓到 1 个真实 bug（g49 恢复公式时误用未引号 `\`）。
4. **卡片公式兼容**：hierarchy_card 的 detail 包 `.cd-text` 块级 span（data-fit-text 移至
   span，overflow:hidden）——行内公式不再被 .card-detail 的 flex 拆散；g49 恢复 `$|\tau-t|$`
   作为验证用例，MathJax 渲染正常。
5. **cite 碰撞检测**：visual_check 量取 .cite top，任何内容元素 bottom 超入安全区 → overlap-cite
   （P1）。上线首轮即抓到 3 处真实碰撞（g04 5px / g17 5px / g35 29px）并全部修复——此前这类
   问题 5 次全部靠人眼。
6. **表格模式提示**：行数 ≤6 且单元格均值 <40 字符而未用 spacious → P2 建议。

**回归结果**（four-reports-full 42 页，含新增 g04-terms 术语卡）：
build 无错（schema 零违例）→ `validate --visual` P0=0 P1=0 P2=5（4 条 table-mode-hint +
1 条 sparse-page），通过。截图复核：g35/g36 图片自动放大填满左列（较手调时更大更清晰）、
g04 两张长文本术语卡 fit 后无碰撞、g49 公式正常、g18 结论卡撑满、g16 wide-hero 无碰撞——
**全部 8 个图文页零手工调高度，通过标准达成**。

**评估结论更新**：v1.4 后 agent 的排版操心仅剩——按叙事选布局与模式（内容决策）、
看一轮截图确认（验收流程自带）。五类机械排版事故全部由模板/检查器接管。

## v1.4 工具缺陷修正与术语页增补（2026-10-25）

- **新增 g04 术语卡页**（four-reports-full）：Hessian 特征值谱与 PSNR/SSIM 用法（用户点名要求）。
- **修复潜伏 bug：章节大数字从未渲染**——section 页 `no:` 裸键被 YAML 解析为布尔 False，
  `c.get("no")` 永远取空；四页已改 `"no": "01"` 写法，01–04 首次正确显示。
  build.py 新增非字符串键的指名报错；design-lessons 增补该教训。
- **修复 yaml-escape 检查器误报**（v1.4 新增检查的实现 bug）：行内列表 ["$\tau$", …] 中
  引号串内的合法双反斜杠被整行扫描误报 12 条 P1；改为词法级 _unquoted_part（只查引号串之外）。
- 顺带按 v1.4 的 table-mode-hint 自动判据把 g13/g23 改 spacious；g39 三列长文本表实测溢出 48px，
  回退 standard——自动提示对长文本多列表须人工复核。
- 终态：42 页，validate --visual P0=0 P1=0。

## v1.4 全流程重刷记录（2026-10-25，four-reports-full）

按六阶段流程完整重跑：checkpoint（v1.4-full-run）→ 删 output 全新构建 → validate --visual
→ 集中视觉轮。结果：**42 页，P0=0 P1=0 P2=3**；控制台错误 0、资源失败 0、溢出 0、
公式渲染异常 0（含公式页 10 页，卡片内行内公式经 v1.4 cd-text 修复后全部正常）、
Mermaid 全渲染。P2 余 3 条：g34/g54 自然留白（114/121px）+ g39 table-mode-hint
（实测 spacious 溢出而回退，属提示器边界情况，登记不处理）。

本轮 v1.4 新能力的实测结论：图片自适应高度彻底取代 max_height 手工调参（8 个图文页
含 2 个 SVG 图示全部一次通过）；字段校验拦下 YAML 布尔裸键（连带修复章节号从未渲染的
潜伏 bug）；overlap-cite 与 table-mode-hint 均按预期工作；yaml-escape 误报已由引号感知
词法修复。公式全面 LaTeX 化（workflow 已立硬规则）。

## v1.4.1（2026-10-25）· 一键构建 bat 与 assets 自动复制

- **build.py**：构建时把 deck 的 `assets/` 清理重建式复制进 `output/`（与 vendor 同策略），
  结束"每次 build 后手动 cp assets"的历史。
- **`decks/<deck>/一键构建.bat`**（通用模板，原样复制到任意 deck 目录可用）：双击 = 编译 +
  默认浏览器打开放映；成功后 cmd 窗口自动关闭，任何一步出错（无 python / yaml 语法 / 布局字段
  校验失败）停窗显示原因并返回退出码 1。要点：`pushd "%~dp0..\.."` 定位仓库根（兼容 Z: 与 UNC，
  仓库根在 deck 目录两级之上）；deck 名从 bat 自身路径推导（零硬编码）；内容必须纯 ASCII
  （cmd 按 ANSI 代码页解析 bat，UTF-8 中文注释会吞字节断行——实测教训）。
- **三路径实测**：成功（退出码 0、assets 自动就位、无 pause）；PATH 无 python（[ERROR]+pause+1）；
  临时 deck 放非法字段 note 于 bullets 布局（schema 报错+[FAIL]+pause+1，且验证了 bat 跨 deck 通用性）。
- **纳入 skill（同日补充）**：bat 模板固化到 `skill/assets/templates/一键构建.bat`，build.py 构建每个
  deck 时自动放置到 deck 根目录（仅缺失时放置、不覆盖定制）——"双击构建"成为 deck 目录契约的一部分
  （build.py 文档字符串已更新）。实测：已有 bat 的 deck 不覆盖不打印；新建临时 deck 自动获得。
- **yaml-escape 检查补全盲区（同日，用户实测触发）**：双引号串内"单反斜杠+字母"——`\s` 等非法转义
  解析即报错，`	`/`
`/`\L`/`\P` 是合法转义会**静默**把 `	au` 变"制表符+au"、`\Lambda` 变
  "U+2028+ambda"。新检查（含负向前瞻排除正确双写的 `\tau`）7 用例单测全过；build 对
  unknown escape 报错附针对性修法提示；design-lessons 第 9 条重写为三规则（首选无引号 / 单引号亦可 /
  双引号内必须 `\`）。教训再次验证：含反斜杠的测试内容必须走 Write 文件，Git Bash heredoc 会吃反斜杠。
- 跨 deck 链接（deck 间超链接/深链）方案已讨论通过、暂缓实施（用户决定，2026-10-25）。

## 2026-11-03 · 新 deck 登记：bc-generalization

- 源：《GNN 跨边界条件与流动构型泛化能力调研》（第五份专题，独立于超分四报告）。
- 25 页（开场 4 + 定义 5 + 表示架构 4 + 训练基准 4 + 难度实验 5 + 空白方案 3），零图片页。
- v1.4.1 特性全量复用：layout schema 硬校验、yaml-escape（捕获 notes 折叠块 6 处双反斜杠）、
  spacious/standard 表格模式、overlap-cite（3 处修复）、sparse-page、fit_text 卡片、图片自适应（无图）。
- 终态 validate --visual P0=0 P1=0 P2=2（h44 121px / h52 114px 稀疏，登记接受）。
- checkpoint：v1.0-first。制作与证据记录：decks/bc-generalization/content/evidence.md。
- 已验证 deck 清单更新：four-reports-full（43 页）、bc-generalization（25 页）。

## v1.4.2（2026-11-13）· 自动页码页脚

- **起因**：用户提出"能否加自动页码"。排查发现模板 v1.0 起就配置了 `slideNumber: 'c / t'`，
  但 reveal.js 的格式 switch 只接受精确字面量 `'c'` 与 `'c/t'`——带空格静默走 default 分支，
  页码退化为右下角裸数字（无总数、与翻页箭头挤同角），等于肉眼不可见。
- **修复**：① `slideNumber: 'c/t'`（渲染为 "12 / 44"，每页统一）；② custom.css 页脚化——
  右对齐 52px 内容边距、bottom 16px 与 cite 脚注同一基线，去 vendor 深色 chip 与 Helvetica，
  16px faint；③ `controlsBackArrows: 'hidden'` 隐藏常驻回退箭头（键盘/触摸向后翻页不受影响），
  页码独享角落。截图确认与 cite 行、前进箭头无视觉碰撞（箭头盒与页码右缘理论重叠 1px，
  glyph 内缩无接触）。
- **回归**：模板备份 `backups/pre-v1.4.2-20261113/`；重建两 deck 终态——four-reports-full
  44 页 P0=0 P1=0 P2=5，bc-generalization 25 页 P0=0 P1=0 P2=2。诊断手段备忘：从压缩
  vendor 源码抠 slideNumber 的 switch 分支 + playwright 探针实测 DOM 文本与几何，两步定位；
  reveal.css 的 `html:not(.print-pdf)` 隐藏规则仅作用于打印模式，不影响屏显。
