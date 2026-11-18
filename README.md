# Reveal.js Academic Presentation Workflow

一个可移植的 Reveal.js 学术演示工作流。仓库克隆后，Agent 可通过项目内的
`.agents/skills/academic-presentation/` 自动发现生产规范，并以 `slides.yaml` 为唯一内容源生成、检查和交付演示稿。

## 包含内容

- `AGENTS.md`：项目级行为约束与入口说明。
- `.agents/skills/academic-presentation/`：Agent 自动发现入口与工作规范。
- `src/academic-presentation/`：构建、校验和浏览器视觉检查程序。
- `templates/academic-reveal/`：Reveal.js HTML、公共样式和一键构建模板。
- `vendor/`：固定版本的 Reveal.js 4.6.1、MathJax 3.2.2 与 Mermaid 11.17.2 离线依赖。
- `decks/starter/`：唯一功能展示示例，22 张短页覆盖所有布局及主要模式。
- `decks/TEST-REPORT.md`：当前独立工作流的版本变更与回归记录。

未纳入历史迁移记录、备份、构建输出、Python 缓存、`node_modules`、论文库和任何具体调研内容。

## 首次安装

要求：Python 3.11+、Node.js 20+、系统 Chrome 或 Edge。

```bash
python -m pip install -r requirements.txt
cd src/academic-presentation
npm ci
cd ../..
```

`npm ci` 只安装视觉检查和 PDF 导出所需的 `playwright-core`，不会下载浏览器；两者均使用系统 Chrome/Edge。

## 立即验证

```bash
python src/academic-presentation/build.py decks/starter
python src/academic-presentation/validate.py decks/starter --visual
```

通过后打开 `decks/starter/output/index.html`。方向键翻页，`S` 打开 Presenter Notes，`F` 全屏。

## 导出 PDF

构建完成后，双击 deck 根目录的 `一键导出PDF.bat`，或从仓库根目录运行：

```bash
node src/academic-presentation/export_pdf.mjs decks/<名称>
```

导出器只读取现有 `output/index.html`，不会重新构建；内容改变后应先运行一键构建。输出固定为
deck 根目录的 `presentation.pdf`。每张幻灯片对应一页，fragment 合并为最终状态，导航栏和
Presenter Notes 不进入 PDF。导出前会等待图片、公式、Mermaid 和多图布局完成，并核对最终页数。

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

## 通用三级提醒

全部布局均支持可见的 `content.note`、`content.callout`、`content.box`，提醒强度逐级增加。
三者都支持字符串或 `{label, text}` 对象；label 可省略。它们统一放在主体下方、引用区上方，
同时声明时按 note → callout → box 排列。提醒正文为20px、行高1.45；表格和图片使用剩余高度。

```yaml
content:
  note: 补充条件与说明。
  callout: {label: 关键认识, text: 本页的重要发现。}
  box: {label: 讨论重点, text: 必须关注的限制或结论。}
```

`notes` 仍是演讲者备注。旧 callout.style: main 保留强调色；旧 box.style: note/tbd
继续接受，但统一显示为最高一级提醒。结论页原有认识、问题和下一步栏目独立于通用提醒。
starter 的“短表优先保证阅读舒适”一页同时展示三级效果。

## 自动章节导航配置

画布比例和章节导航都只需在 `content/slides.yaml` 设置：

```yaml
deck:
  title: 我的汇报
  aspect_ratio: "16:9"  # 也可使用 "4:3"；省略时默认 16:9
  chapter_nav: true
```

导航自动提取第一个 `layout: ending` 之前的 `section.title`，各正文内容页归属于前面最近的章节。
点击章名可跳转，翻页与地址直达自动同步高亮。封面和首章之前的页面不高亮章节。
长目录横向滚动，当前章节自动移入可视区，也可使用两侧按钮、触摸或导航内的左右方向键滚动。
导航覆盖画布顶部的预留带，不会从 Reveal 视口扣除高度；因此有无导航时画布比例保持不变。
设为 `false` 或省略时关闭；没有章节页时不生成导航、不预留空间。值必须为布尔值，不要加引号。

同一模板支持四种组合：16:9/4:3 × 有/无导航。4:3 会自动收紧栏间距、调整图片主导双栏及宽图
结论带，但不会降低全局字号。内容特别密集时仍应人工复核，因为两种比例的横向容量不同。

章节导航已集成在唯一示例 `decks/starter/` 中。
开发回归运行 `node tests/chapter-nav.mjs`（先按首次安装步骤安装依赖）。

## 自动章节总览与结束页

总览页不手写目录，只放一个占位页面：

```yaml
- slide_id: overview
  layout: chapter-overview
  title: 汇报结构
  sources: [本演示文稿章节结构]
  notes: 自动列出正文所有章节。
```

构建器自动列出正文 `section` 标题、编号并生成点击跳转。当前支持最多 8 个正文章节。

结束页同时定义正文与附录边界：

```yaml
- slide_id: ending
  layout: ending
  title: 感谢聆听
  content:
    subtitle: 核心结束语
    prompt: 讨论与提问
    meta: [作者, 联系方式]
  sources: [汇报结构]
  notes: ending 之后为附录。
```

`ending` 之后的 `section` 可继续作为附录章节页，但不会进入章节总览或顶部导航；附录阶段
不会高亮正文章节。整份 deck 最多一个 `ending`；省略时所有 `section` 均视为正文。

## 图片白底融合

白底融合试用：在图文页的 `content.image` 下添加 `white_background: blend`；独立图片页放在
`content` 下。省略或设为 `original` 保留原样。原图不变，图片容器白底自动取消。
这是混合显示而非真实透明，白色内部区域也会融合，彩色区域会受底色影响；定量色图应保留原样。
唯一示例的 `s12-dominant` 演示配置，`s14-html` 展示同图前后对照。

本次试用前的内容 checkpoint 为 `pre-white-background-blend`；模板和构建器备份位于
忽略目录 `backups/pre-white-background-blend-20261114/`。也可通过本次独立 Git 提交整体撤销。

## 多图页面

`layout: multi-image` 展示两张或更多图片；每图的 `title`、`content` 都可省略。
标题按 22px、说明按 20px 显示，图片占据剩余空间，始终保持原比例。说明可以是字符串或字符串列表。
bottom 模式标题在图片正上方居中，下方说明与图片水平居中。
right 模式把标题和说明一起放在图片右侧，上下排列、文字居中；标题与说明的组合垂直中心与实际图片中心一致，
整个文字组合（含间距）不超过图片高度。仅标题或仅说明同样适用；两者都没有时不分配右栏。

每图可选 `content_position: bottom | right | left`。left 与 right 完全对称：标题和说明整组置于图片左侧，
垂直居中，整组高度不超过图片高度，同样支持70%候选栏宽。自动模式省略时仍比较下方和右侧；
显式 `content_position: left` 在自动和手动模式下均强制生效。
手动模式省略时使用下方。显式指定时严格使用指定位置；无说明时不保留说明空间。
右侧文字栏按图块宽度的25%、33%、40%、50%、70%比较，至少160逻辑像素；70%是额外候选而非强制值。
标题和说明都按右栏宽度换行，支持 `<br>`、列表及公式；空间不足时自动模式可选下方，强制位置则报错。

```yaml
layout: multi-image
title: 不同观测手段提供互补信息
content:
  mode: auto  # 默认值，可省略
  images:
    - src: assets/papers/piv.png
      title: PIV：平面空间信息
      content: 空间覆盖广，细节分辨有限
      content_position: right  # 可省略，auto 模式自动选择
    - src: assets/papers/hotwire.png
      title: 热线：高时间分辨率
      content: [时间采样密，空间覆盖有限]
```

自动模式允许换序，按图片原始纵横比、标题和说明实际高度比较横向、纵向及混合分组。
搜索有固定候选上限；以最小图片面积优先、总图片面积次优，同时保留等分网格面积基线。
这是有界近似优化，不保证任意数量、任意比例都能达到全局最优。原图内自带白边不会自动裁掉。

需要固定顺序和精细控制时，使用 `manual`。下面是左大右小的一大两小排布：

```yaml
content:
  mode: manual
  columns: [3, 2]  # 相对列宽，支持小数
  rows: [1, 1]    # 相对行高
  gap: 16         # 两种模式均可使用；单位为逻辑像素
  images:
    - {src: assets/papers/main.png, title: 主图, row: 1, column: 1, rowspan: 2}
    - {src: assets/papers/detail-a.png, row: 1, column: 2}
    - {src: assets/papers/detail-b.png, content: 辅助结果, row: 2, column: 2}
```

行列从 1 开始，`rowspan`/`colspan` 缺省 1；重叠、越界、非正权重均会阻止构建。
支持逐图 `white_background: blend`，页面级 `callout: {text: 总结}`，以及通常的 `cite/sources/notes`。
高密度页面放不下时应减少说明、调整手动网格或拆页；模板不缩字、不截断说明。
完整示例见 starter 的 `s13a-multi-auto` 与 `s13b-multi-manual`；回归运行 `node tests/multi-image.mjs`。

## Git 使用

本目录已经初始化为独立 Git 仓库；父项目根目录没有初始化。首次提交前可先用 `git status` 检查纳入范围，再关联远程仓库。

