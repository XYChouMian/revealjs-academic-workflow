# Reveal.js Academic Presentation Workflow

一个可移植的 Reveal.js 学术演示工作流。仓库克隆后，Agent 可通过项目内的
`.agents/skills/academic-presentation/` 自动发现生产规范，并以 `slides.yaml` 为唯一内容源生成、检查和交付演示稿。

## 包含内容

- `AGENTS.md`：项目级行为约束与入口说明。
- `.agents/skills/academic-presentation/`：Agent 自动发现入口与工作规范。
- `src/academic-presentation/`：构建、校验和浏览器视觉检查程序。
- `templates/academic-reveal/`：Reveal.js HTML、公共样式和一键构建模板。
- `vendor/`：固定版本的 Reveal.js、MathJax 与 Mermaid 离线依赖。
- `decks/starter/`：唯一功能展示示例，15 张短页覆盖所有布局及主要模式。
- `docs/TEST-REPORT.md`：原工作流的历史回归证据，仅作来源记录。

未纳入历史备份、Python 缓存、`node_modules`、论文库和任何具体调研内容。

## 首次安装

要求：Python 3.11+、Node.js 20+、系统 Chrome 或 Edge。

```bash
python -m pip install -r requirements.txt
cd src/academic-presentation
npm ci
cd ../..
```

`npm ci` 只安装视觉检查所需的 `playwright-core`，不会下载浏览器；视觉检查使用系统 Chrome/Edge。

## 立即验证

```bash
python src/academic-presentation/build.py decks/starter
python src/academic-presentation/validate.py decks/starter --visual
```

通过后打开 `decks/starter/output/index.html`。方向键翻页，`S` 打开 Presenter Notes，`F` 全屏。

## 新建演示稿

Agent 以 `decks/starter/` 为参考创建新目录，使用者只需审查或修改 `content/slides.yaml`。
以下配套文件由工作流自动维护：

- `content/deck.css`：仅特殊情况需要；
- `assets/`：论文图、实验图和独立示意图；
- `assets-manifest.md`：图片来源与含义记录。

然后运行：

```bash
python src/academic-presentation/build.py decks/<名称>
python src/academic-presentation/validate.py decks/<名称> --visual
```

也可以直接对 Agent 说：

```text
用 academic-presentation 把〈资料路径〉做成〈时长〉、面向〈听众〉的汇报。
```

## 自动章节导航

只需在 `content/slides.yaml` 设置：

```yaml
deck:
  title: 我的汇报
  chapter_nav: true
```

导航自动提取 `layout: section` 页的 `title`，各内容页归属于前面最近的章节。
点击章名可跳转，翻页与地址直达自动同步高亮。封面和首章之前的页面不高亮章节。
长目录横向滚动，当前章节自动移入可视区，也可使用两侧按钮、触摸或导航内的左右方向键滚动。
导航占据独立的 52px 顶部空间，幻灯片在剩余视口等比显示，内部标题、表格和图片布局保持原样。
设为 `false` 或省略时关闭；没有章节页时不生成导航、不预留空间。值必须为布尔值，不要加引号。

章节导航已集成在唯一示例 `decks/starter/` 中。
开发回归运行 `node tests/chapter-nav.mjs`（先按首次安装步骤安装依赖）。

## Git 使用

白底融合试用：在图文页的 `content.image` 下添加 `white_background: blend`；独立图片页放在
`content` 下。省略或设为 `original` 保留原样。原图不变，图片容器白底自动取消。
这是混合显示而非真实透明，白色内部区域也会融合，彩色区域会受底色影响；定量色图应保留原样。
唯一示例的第 12 页演示配置，第 14 页展示同图前后对照。

本次试用前的内容 checkpoint 为 `pre-white-background-blend`；模板和构建器备份位于
忽略目录 `backups/pre-white-background-blend-20261114/`。也可通过本次独立 Git 提交整体撤销。

本目录已经初始化为独立 Git 仓库；父项目根目录没有初始化。首次提交前可先用 `git status` 检查纳入范围，再关联远程仓库。

