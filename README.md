# Reveal.js Academic Presentation Workflow

一个可移植的 Reveal.js 学术演示工作流。仓库克隆后，Agent 可通过项目内的
`.agents/skills/academic-presentation/` 自动发现生产规范，并以 `slides.yaml` 为唯一内容源生成、检查和交付演示稿。

## 包含内容

- `AGENTS.md`：项目级行为约束与入口说明。
- `.agents/skills/academic-presentation/`：Agent 自动发现入口与工作规范。
- `src/academic-presentation/`：构建、校验和浏览器视觉检查程序。
- `templates/academic-reveal/`：Reveal.js HTML、公共样式和一键构建模板。
- `vendor/`：固定版本的 Reveal.js、MathJax 与 Mermaid 离线依赖。
- `decks/starter/`：可直接构建的最小示例。
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

复制 `decks/starter/` 为一个新目录，仅编辑：

- `content/slides.yaml`：唯一内容源；
- `content/deck.css`：只有公共样式不足时才添加；
- `assets/`：论文图、实验图和独立示意图；
- `assets-manifest.md`：记录图片来源与科学含义。

然后运行：

```bash
python src/academic-presentation/build.py decks/<名称>
python src/academic-presentation/validate.py decks/<名称> --visual
```

也可以直接对 Agent 说：

```text
用 academic-presentation 把〈资料路径〉做成〈时长〉、面向〈听众〉的汇报。
```

## Git 使用

本目录已经初始化为独立 Git 仓库；父项目根目录没有初始化。首次提交前可先用 `git status` 检查纳入范围，再关联远程仓库。

