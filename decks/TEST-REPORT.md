# Portable workflow validation

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

原项目从 v1.0 到 v1.4.2 的完整历史回归记录保存在 `docs/TEST-REPORT.md`，仅作来源与故障回归参考。
