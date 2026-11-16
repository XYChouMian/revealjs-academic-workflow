# Portable workflow validation

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
