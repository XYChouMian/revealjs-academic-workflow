# Portable workflow validation

## 2026-11-18 · v1.10.0 预览：一键 PDF 导出

- starter checkpoint：`pre-pdf-export`；源码备份位于 `backups/pre-pdf-export-20261118/`。
- 新增独立 `export_pdf.mjs` 与 `一键导出PDF.bat`，只读取已有 output，输出 deck 根目录
  `presentation.pdf`；不改变普通 HTML 放映样式，不自动构建。
- 导出固定每张幻灯片一页、fragment 最终态、无导航和 Presenter Notes；主动等待图片、MathJax、
  Mermaid 与多图布局，并在写入最终文件前核对 DOM 与 PDF 页数。
- starter 四种“16:9/4:3 × 导航开关”均导出 22 页：16:9 为 960×540 pt，4:3 为
  720×540 pt；无空白页，文字可搜索，导航与 Presenter Notes 未泄漏。公式/Mermaid 页和两张
  多图页经 PDF 像素渲染人工复核，边距、提醒区、引用和页码正常。
- `tests/pdf-export.mjs` 覆盖四种组合、页数与 MediaBox、缺少 HTML/manifest，以及失败时保留旧
  PDF；`chapter-nav.mjs`、`multi-image.mjs`、`alerts.py` 均通过。starter 完整 `--visual`：
  P0=0、P1=0、P2=1（仅既有短附录页自然留白）。未提交或推送。

## 2026-11-18 · 标题保留原文大小写

- Reveal white 主题默认将全部 h1–h6 转为 uppercase，导致多图标题中的作者名被大写。
- 公共样式将 `--r-heading-text-transform` 设为 none，所有标题按 slides.yaml 原文显示。
- 恢复点 `pre-multi-image-letter-case`，公共样式备份位于同名 backups 目录；未修改外部 proposal-v1。

## 2026-11-18 · v1.9.5 预览：left文字栏

- 修改前保存 starter checkpoint `pre-multi-left`，源码备份于 `backups/pre-multi-left-20261118/`（含恢复脚本），保留所有既有未提交改动及用户当前内容。
- 每图新增显式 `content_position: left`，在auto/manual均生效。复用right的侧栏测量、25%/33%/40%/50%/70%候选和160px最小栏宽，仅镜像水平定位；标题与说明整体置左、垂直居中、整组高度不超过实际图片高度。未指定时保留既有默认选择行为。
- 浏览器回归覆盖四种画布/导航状态下显式left、bottom、right；验证左侧文字整组中心与高度、图文不重叠、仅标题/仅说明及left的70%档位。非法位置用top测试，确保left可构建。
- starter及四份22页预览完整视觉验收P0=0/P1=0/P2=1（仅原有附录页自然留白），导航回归通过。新增独立左右对照预览 `backups/multi-image-preview-20261117/left-cases/output/index.html`，不改写starter用户配置。
- 使用说明和流程文档已更新。暂未提交或推送。

## 2026-11-18 · v1.9.4 预览：right标题说明组合与70%档位

- 修改前保存 starter checkpoint `pre-right-group-70`，全部当前源码备份到 `backups/pre-right-group-70-20261118/`，配套 RESTORE.ps1；保留用户当前 columns/rows/图片配置以及此前未提交改动。
- right语义改为标题与说明一起在右栏排列，整组文字（含8px间距）与实际图片垂直居中，组合高度不超过图片高度；仅标题或仅说明同样适用，无文字不分配右栏。bottom保持原有行为。
- 右栏候选为25%/33%/40%/50%/70%，至少160逻辑像素；标题和说明统一按右栏宽度测量，违反组合高度约束的候选淘汰。显式right无可行布局时明确报错，不缩字、不截断或改为bottom。
- `node tests/multi-image.mjs` 通过：新增整组文字中心/边界/右侧位置/内部顺序检查，仅标题、仅说明、br与公式，以及只有70%档位可容纳的nowrap测试，并断言实际选择0.7。保留2/3/4/6图片、四种画布组合、显式位置覆盖、面积基线、文件/HTTP访问和缺图/过密报错检查。
- 四份临时预览（`backups/multi-image-preview-20261117/`）22页完整视觉验收全部P0=0/P1=0/P2=1（仅原有短附录页留白）。人工复核16:9及4:3右栏标题说明组合居中且未超出图片高度。使用文档及starter notes已同步；未覆盖用户网格。

## 2026-11-17 · v1.9.3 通用三级提醒

- 恢复点：starter checkpoint `pre-unified-alerts`，模板和构建器备份 `backups/pre-unified-alerts-20261117/`。
- 全布局共用 note/callout/box 渲染，字符串与对象写法兼容，顺序固定、每级仅输出一次；旧 main 强调色兼容，box 旧 style 统一为强提醒。
- 提醒正文20px/1.45，自然高度不压缩；独立样式不影响结论页已有栏目。starter 现有舒适表格页同时展示三层，无新增页。
- `python tests/alerts.py`：全部13种布局的两种写法、顺序、无重复、旧字段及非法值检查通过。
- starter 和四种画布/导航预览各22页：P0=0/P1=0/P2=1；P2为既有短附录页自然留白。人工抽查4:3三级表格、图片主导页和结论页，布局正常。

## 2026-11-17 · v1.9.2 预览：多图居中与说明位置

- 修改前保存 starter checkpoint `pre-multi-position`，当前全部源码（包含已认可多图和既有未提交改动）备份于 `backups/pre-multi-position-20261117/`，配套 RESTORE.ps1 可恢复该状态；恢复脚本仅作语法检查，未执行。
- 每图新增 `content_position: bottom|right`：auto 缺省比较两种位置，manual 缺省 bottom；显式值严格遵守，无说明不占位。右侧说明栏在25%/33%/40%/50%中比较，最小160逻辑像素。
- 标题与下方说明按实际图片矩形水平居中，右侧说明文字居中且垂直中心对齐图片；标题宽度不包含右侧说明。文字测量、图片面积评分与最终定位共用同一几何结果，保留22px标题、20px说明、公式安全间距与contain显示。
- starter 两张多图示例更新：自动选择与强制 bottom、手动 right 与缺省 bottom。四个临时预览仍在 `backups/multi-image-preview-20261117/`，均22页，完整 --visual 全部 P0=0/P1=0/P2=1（仅原有短附录页自然留白）；starter 本体同样通过。人工截图复核16:9与4:3无裁切、重叠或引用区侵占。
- `node tests/multi-image.mjs` 通过，新增真实DOM中心对齐、图文无重叠、auto下显式right/bottom覆盖及非法位置值验证；保留2/3/4/6图、原始比例混合、公式、PNG/JPG/SVG、缺图/过密报错、刷新/缩放、file/HTTP和面积基线检查。
- `node tests/chapter-nav.mjs`、语法检查与git diff --check通过。未提交或推送。

## 2026-11-17 · v1.9.0 预览：多图自动排布与手动网格

- 修改前保存 starter checkpoint `pre-multi-image`；当前全部受版本控制及未忽略的新文件备份于 `backups/pre-multi-image-20261117/`，保留此前未提交的比例、导航与 Mermaid 改动。该目录的 `RESTORE.ps1` 可恢复此次操作前源码与 starter；脚本语法检查通过，未执行恢复。
- 新增 `layout: multi-image`，支持每图可选 title/content（字符串或要点列表）、PNG/JPG/SVG 与白底融合。自动排布允许换序，以图片原始比例、实际文字高度和剩余空间进行有界候选搜索（每轮保留12个候选）；手动模式支持加权列/行及跨行跨列，拒绝越界、重叠、非法权重与位置。
- 图片使用 contain 完整显示；标题22px、说明20px，省略时不保留占位。公式说明额外预留上下空间，避免 MathJax 下沿越出文本区；不缩字、不截断。图片加载失败或文本无法容纳时提供可见错误并报告控制台错误。
- starter 增加 `s13a-multi-auto` 与 `s13b-multi-manual` 两页，共22页；资源清单与使用规范同步更新。布局实现独立复制到 output/multi-image.js，视觉检查等待异步布局完成。
- starter 与四个临时预览（`backups/multi-image-preview-20261117/`）的完整 --visual 全部 P0=0/P1=0/P2=1；唯一P2为原有短附录页自然留白。人工复核16:9/4:3下自动混合排布与手动一大两小，文字完整、图像无裁切或拉伸、引用安全区正常。
- `node tests/multi-image.mjs` 通过：四种比例/导航组合、刷新稳定性、窗口缩放、手动位置与跨度、2/3/4/6图、近方/极宽/纵向混合图、可选标题说明、公式、白底融合、8种非法schema、缺失图片、过密文本报错、file与localhost访问。面积检查同时使用候选评分和真实DOM浮点尺寸，避免clientWidth整数舍入造成误报。
- 相对等分网格基线，测试输入的图片总显示面积比：16:9为1.043/1.564/1.461/1.524，4:3为1.000/1.796/1.009/1.400（分别对应2/3/4/6图）。这些是功能测试结果，不代表所有图片组合；算法为有界近似优化。
- `node tests/chapter-nav.mjs` 回归通过；Python/JS语法检查及git diff --check通过。暂未提交或推送，供用户审阅效果。

## 2026-11-16 · v1.8.0 预览：16:9/4:3 × 导航开关

- 修改前保存 starter checkpoint `pre-aspect-nav-four-mode`，构建器、检查器、模板、测试和示例内容备份于 `backups/pre-aspect-nav-four-mode-20261116/`。
- 新增 `deck.aspect_ratio: "16:9" | "4:3"`，缺省 16:9；构建清单记录逻辑尺寸，视觉检查按 1280×720 或 960×720 原生视口运行。
- 顶部导航从“扣除 52px 后缩放整页”改为“覆盖画布顶部预留带”，有无导航不再产生不同有效比例；眉题自动移到导航下方。
- `tests/chapter-nav.mjs` 覆盖四种组合、非法比例、导航交互、目录、ending 边界和标题对齐：通过。
- starter 与四个临时预览各 20 页全部 `--visual`：P0=0/P1=0/P2=1；唯一 P2 为短附录页自然留白。人工抽查舒适表格、分层卡片、图片主导双栏及宽图结论带，无裁切、拉伸或小字压缩。
- Mermaid 11 回归发现节点标签改用 `<p>` 后继承 Reveal 正文字号，出现“外框未溢出、内部文字被裁切”。现使用 Mermaid 官方 `neutral` 主题，不另设字体、字号、颜色、节点边框、曲线或间距；CSS 仅阻止 Reveal 覆盖 Mermaid 自有标签样式，并新增节点内部裁切检查。源码容器从 `<pre>` 改为原生 `.mermaid` div，去除 Reveal 代码块白底与阴影。修复后“内容源到演示稿”四个节点标签完整。
- 分层卡片曾因 `.card p` 的选择器优先级与 `fit_text` 叠加，形成 detail 26px > title 24px > thesis 20px。现修正为 title 30px > thesis 28px > detail ≤26px，并新增计算字号顺序检查；16:9/4:3 × 导航开关四种组合均无 P0/P1。

## 2026-11-16 · v1.7.0 Mermaid 11 升级

- 离线 Mermaid 从 10.9.1 升级到 11 系列最新稳定版 11.17.2；版本依据 npm 官方版本记录，固定精确版本而非浮动范围。
- 修改前保存 starter checkpoint `pre-mermaid-11`，旧 bundle 与模板备份于 `backups/pre-mermaid-11-20261116/`。
- vendor 新增 Mermaid MIT LICENSE 与 VERSION 来源记录；npm integrity 为 `sha512-V6K3C8EBdEsPFZXSKMJe6ppQOENxuHARr9GvHX4hh47lAbhMRD9qf4oEK7LoaRQxULMa80/qt5gHO73aCleBBg==`。
- `vendor/` 与构建后 `output/vendor/` 的 bundle SHA-256 均为 `581ED7D74BD9048D0E3A91363927D72EF22942D7722546B27F7CC29E35390EB8`。
- starter 20 页重建并执行 --visual：P0=0/P1=0/P2=1；Mermaid 11 流程图、中文标签、MathJax 共页、导航与页脚均正常。唯一 P2 仍为短附录页自然留白。


## 2026-11-16 · v1.6.1 章节总览纵向排列

- `chapter-overview` 从双列横排改为一章一行的纵向列表；2–8 章按可用高度在 52–96px 内分配行高，章名字号保持 26px。
- 修改前保存包含用户当前 starter 内容的 checkpoint `pre-overview-vertical`，公共样式备份于 `backups/pre-overview-vertical-20261116/`。
- 使用用户当前三章 starter 重建 20 页并执行 --visual：P0=0/P1=0/P2=1；总览截图人工确认三章逐行排列。唯一 P2 仍为短附录页自然留白。
- 8 章真实浏览器回归通过，纵向列表无内部溢出；导航、ending 边界、附录排除和标题对齐均无回归。

## 2026-11-15 · v1.6.0 自动章节总览与结束页边界

- 新增 `chapter-overview`：不维护目录列表，自动读取第一个 ending 前的 section，生成编号、章名与点击跳转；当前最多 8 章。
- 新增 `ending`：支持 subtitle/prompt/meta，并作为唯一正文结束边界；其后 section 保留章节页样式但不进入总览或顶部导航，附录阶段清除正文高亮。
- 修改前保存 starter checkpoint `pre-overview-ending` 与模板/构建器/校验器/测试备份 `backups/pre-overview-ending-20261115/`。
- starter 增加自动总览、结束页和 ending 后的附录 section/内容页，共 19 页；总览截图仅显示两章，导航无附录条目，结束页和附录页均无当前章高亮。
- 真实浏览器测试覆盖：开关、无 ending、唯一/多个 ending、空总览、总览位于 ending 后、8 章长标题、总览点击、附录直达、附录返回正文、标题对齐与视口缩放，全部通过。
- 完整 --visual：P0=0/P1=0/P2=1；唯一 P2 为短附录说明页自然留白，记录后停止润色。vendor 未改动。

## 2026-11-14 · 使用用户 PNG/JPG 截图复核融合

- 第 12 页使用用户 PNG 原件启用 blend；第 14 页上排 PNG、下排 JPG，左右分别原样/融合。同一行使用同一文件，不改写截图。
- 原 SVG 已由用户移除，引用和资源清单同步更新。保留此前内容检查点与本轮 pre-raster-blend-comparison 检查点。
- 完整 15 页 --visual：P0=0/P1=0/P2=0；人工复核 PNG/JPG 对照截图，文件正常加载、无溢出或裁切。

## 2026-11-14 · 白底融合可恢复试用

- 新增可选 `white_background: original | blend`，缺省 original。仅 blend 图片使用 multiply 显示，并取消其 figure 白底；不改动源图，不生成真实透明像素。
- 第 12 页通过 YAML 选项启用，第 14 页同图原样/融合对照；页面总数仍为 15。
- 修改前保存 starter checkpoint `pre-white-background-blend` 与模板/构建器备份。独立 Git 提交用于整体恢复，未推送，待用户审看。
- 全 deck 重建与 --visual：P0=0/P1=0/P2=0；导航交互回归通过；对照截图人工确认白底融合与内部白色同步变化，未裁切。

## 2026-11-14 · v1.5.1 唯一功能示例

- 仅保留 `decks/starter/`，15 张短页覆盖全部 10 种 layout、三种图片模式、三种表格模式、富层级卡片、fit_text 字号与行高、公式、Mermaid、SVG、fragment、导航、Notes、来源与页码。默认/兼容写法在对应 Notes 说明，避免重复页面。
- 重复 chapter-nav deck 移至忽略目录 backups，可恢复；回归测试动态创建的临时数据不作为展示 deck。
- 全布局构建暴露既有 schema 遗漏：image 渲染器的 src/caption/alt 与 html 渲染器的 html 字段被错误拒绝，已补齐允许字段。
- starter 完整重建及 --visual：P0=0/P1=0/P2=1；唯一 P2 为特殊 HTML/fragment 演示页的自然留白，不追加装饰内容。
- 导航真实浏览器回归通过。人工查看卡片、图片、表格及公式相关截图，资源无裁切，标题与页脚正常。
- 人工维护入口统一为 content/slides.yaml；README 与流程骨架验证入口均已同步。

## 2026-11-14 · v1.5.0 自动章节导航

- 仅 `deck.chapter_nav: true` 启用；章节名、顺序、归属与高亮全部自动生成。缺省/false/无章节时不占空间。
- 修改前已保存 starter checkpoint 与模板/构建器备份。vendor 版本不变。
- `node tests/chapter-nav.mjs`：真实浏览器验证开关、缺省、无章节、非法配置、8 章长目录滚动、点击跳章、地址直达、章节归属、视口缩放、带/不带眉题的标题对齐，全部通过。
- 全量 deck 重建与 --visual：starter 5 页 P0=0/P1=0/P2=0；chapter-nav 5 页 P0=0/P1=0/P2=1。
- P2：chapter-nav 的简短功能说明页自然留白（sparse-page），记录后停止润色。
- 人工截图复核：章节导航高亮清楚，表格标题对齐且行高舒适；导航与完整幻灯片分区显示，无裁切。

## 2026-11-14 · v1.4.3 标题对齐与表格修复

- 修改前保存 starter checkpoint 与模板备份。
- 七种普通内容布局统一预留眉题区，标题顶部不受眉题是否存在影响；封面、章节页保留原有设计。
- 表格伸展限定到 table-mode 容器，避免 kicker 伸展推低标题；表格自动占用剩余高度。
- 本独立仓库全部 deck（starter，5 页）重建与 --visual 验收通过：P0=0、P1=0、P2=0；表格截图人工确认标题归位、行间留白正常。

## 2026-11-14 · 独立迁移包

- Skill 结构校验：通过（`quick_validate.py`）。
- 独立构建：`decks/starter` 共 5 页，使用迁移包内的模板与离线 vendor，构建成功。
- 静态验收：P0=0、P1=0、P2=0。
- 浏览器验收：P0=0、P1=0、P2=0；系统 Chrome/Edge + 本地 `playwright-core`。
- 代表能力：封面、分层卡片、舒适表格、MathJax、Mermaid、独立 SVG、Presenter Notes、sources/cite、自动页码页脚。
- 独立性：构建与验收命令均从 `revealjs-academic-workflow/` 根目录运行，不依赖父项目的 Skill 路径。
- 目录重组：Skill 仅保留规范与参考文档；程序、模板、离线依赖分别迁移至 `src/`、`templates/`、`vendor/`，无重复真源。
- 重组后回归：新入口完成独立构建、静态验收与浏览器验收，均为 P0=0、P1=0、P2=0。
- Git 状态：仅在 `revealjs-academic-workflow/` 初始化独立仓库；父项目根目录未执行 Git 初始化。

原项目从 v1.0 到 v1.4.2 的迁移前回归记录不再随发行仓库携带；需要追溯时可从 Git 历史恢复。当前独立工作流以本文件为唯一回归记录。
