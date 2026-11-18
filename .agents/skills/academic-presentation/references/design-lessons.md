# 设计教训与已验证修复（故障回归清单）

来源：2026-10-21 之前 25 页 / 1364 行 Reveal.js HTML（`整合汇报/`）的生产过程复盘，
以及骨架模板（仓库根目录 `templates/academic-reveal/`）的验证过程。遇到同类症状先查此文件，不要重新发明修复。

## 一、过程故障模式 → 现行规则

| 故障模式（实际发生过） | 后果 | 现行对策 |
|---|---|---|
| 大量内联 SVG 手绘 + div 模拟图结构 | 单页数百行、不可维护 | 阶段 2 资源优先级；复杂图必须是独立文件 |
| 全部页面完成后才发现 MathJax/Mermaid 兼容问题 | 全局返工 | 阶段 3 强制先行；三张代表页全过才批量生成 |
| 改公共样式/批量替换引发大范围损坏 | 逐处手修、无限返工 | checkpoint/restore 机制；大范围损坏整体回退 |
| 过度检查与润色，无验收终点 | Token 浪费、内容漂移 | P0/P1/P2 分级；两轮修复上限；停止条件 |
| 学术内容漂移成"展示严谨性" | 偏离汇报目标 | 阶段 1 内容边界；制作过程不进正文 |
| 每页发明布局系统 | 风格不一致、代码膨胀 | 使用标准布局；页面级样式走 deck.css |
| 手工维护目录、导航与附录排除 | 章节改名后多处不一致，附录误入正文目录 | `chapter-overview` 与顶部导航共用 ending 前的 section 数据；唯一 ending 自动定义正文/附录边界 |
| 不复用已完成的文献核查 | 重复阅读、Token 浪费 | 阶段 1 强制复用核查进度.md 等既有结论 |
| 图文页固定等宽双栏 | 横向科研图被缩小、文字栏与图片同时空旷 | 由内容显式选择 `side` / `side-dominant` / `wide-hero` |
| 卡片只堆同字号要点 | 下半页空白、主结论不突出 | 使用 `thesis/detail/cue` 三层卡片；重要信息大而少 |
| YAML 裸键 no/yes/on/off 被解析为布尔 | 字段静默失效（如章节大数字从未渲染）；v1.4 字段校验又因布尔键无法 join 而 TypeError | 裸键一律加引号（"no": "01"）；build.py 对非字符串键给出指名修法的报错（2026-10-25 four-reports-full 章节号案例） |
| 表格以 dense/standard 解决版面问题 | 字体与行距过紧、短表贴顶，下半部仍留空白 | 行数 ≤6 的短表必须 `table_mode: spacious`（增行高与字号撑满版面）；compact 仅用于确有高密度的页面；visual_check 的 `sparse-page`（P2）自动标记下半部大块留白（2026-10-25 four-reports-full g15 案例固化）；v1.3 起模板已根治——布局类 + flex 骨架使表格/卡片内容区纵向撑满，新 deck 无需 deck.css 补丁 |
| 图文页手调 max_height | 溢出与留白反复试参，一轮修复调 3 次 | v1.4 起图片自适应：figure/img flex:1 + object-fit:contain 自动占满剩余高度，max_height 已废弃；grid 模式（side-dominant/wide-hero）行高须 minmax(0,1fr)——grid 行高 auto 不受已收缩容器约束 |
| 在 yaml 里写渲染器不支持的字段 | 静默丢失，验收才发现内容缺失 | build.py LAYOUT_FIELDS 硬校验：未知字段构建期报错并列出可用字段 |
| Reveal 配置字符串不匹配 vendor 支持的字面量（slideNumber 写 'c / t' 带空格） | 静默走 default 分支退化为角落裸数字，无总数、与翻页箭头挤同角，用户以为"没有页码"；v1.0 起潜伏，2026-11-13 才暴露 | slideNumber 只接受 'c' / 'c/t' 精确字面量（v1.4.2 修正）；页码经 custom.css 页脚化（与 cite 同基线、右对齐 52px 边距）+ controlsBackArrows:'hidden' 独享角落；模板配置类改动必须截图确认视觉存在，JS 无报错≠生效 |

## 二、已验证的技术修复（固化在模板中，勿动）

1. **MathJax 加载路径**：Reveal 官方 math 插件默认走 MathJax2 分支
   （调用 MathJax 3 中不存在的 `MathJax.Hub`），旧版靠 MathJax 3 自启动排版"侥幸"渲染。
   模板改为：head 内预置 `window.MathJax` 配置 → 直接加载本地 `tex-mml-svg.js`，
   不使用 RevealMath 插件。单 `$` 行内公式已启用。
2. **Mermaid 隐藏页零尺寸**：`startOnLoad:false` 手动渲染，Reveal `slidechanged` 时
   才渲染当前页；渲染后去掉 svg 的 height 属性。失败的图显示红色错误框而非静默失败
   （visual 检查会抓 `Mermaid render failed`）。
3. **Mermaid 标签被裁剪**：Mermaid 11 的 HTML 标签新增 `<p>`；若继承 `.reveal p` 的
   23px/1.5，实际显示会大于 Mermaid 按默认主题测得的节点框。不得另设 Mermaid 字体或字号；仅让
   `foreignObject p` 继承 Mermaid 自己生成的样式并清除段落 margin。视觉检查同时比较 `<p>` 与其
   `foreignObject` 边界，内部裁切按 P1 报告。
4. **公式与 Mermaid 源码冲突**：Mermaid 源码放入原生 `.mermaid` div，并添加
   `tex2jax_ignore`；MathJax 通过 `ignoreHtmlClass` 跳过，既互不干扰，也避免 Reveal 给 `<pre>`
   自动添加代码块白底、宽度与阴影。
5. **离线字体**：white.css 的 `@import source-sans-pro` 已从 vendored 副本移除
   （中文衬线由 custom.css 统一指定）。同样注意：任何 vendored CSS 的外链 @import 都是
   离线断点。
6. **封面/章节页垂直居中**：Reveal 运行时给当前 section 写内联 `display:block`，
   类选择器压不过内联样式 → 必须用
   `.reveal .slides section.cover{display:flex!important}`。
7. **底部引用脚注安全区**：section 底部 padding 必须 ≥ cite 脚注区高度
   （现 58px）；否则满页内容的底边会压住引用行（2026-10-21 实测发生并修复）。
8. **自动验收基准**：16:9 使用 1280×720、4:3 使用 960×720；playwright-core 驱动系统 Chrome/Edge
   （不下载浏览器二进制）。视觉检查从构建清单读取原生画布尺寸，元素越界按缩放比例给容差，只报最外层越界元素。
9. **YAML 反斜杠转义**（2026-10-21 两次踩坑；2026-10-25 第三次，补全规则）：三种写法只有一种是陷阱——
   **首选不加引号**（`标注 $\tau_\sigma$`，单反斜杠原样保留）；**单引号 `'...'` 同样安全**；
   **双引号 `"..."` 内 `\` 是转义符**：`\s` 等非法转义直接解析报错（好情况），而 `\t`、`\n`、`\L`、
   `\P` 是**合法**转义——`\tau` 会静默变成"制表符+au"、`\Lambda` 变成"U+2028+ambda"，解析成功但文字已坏
   （最难查）。双引号串内必须写 `\\tau`。中文标题里的引号用全角“”，不要用 `\"`。
   拦截：未引号 `\\` 与双引号内单反斜杠+字母均由 validate 的 yaml-escape（P1）抓出；
   build 对 unknown escape character 报错附针对性提示；visual_check 抓 mjx-merror 记 P0。
10. **Mermaid 图尺寸**：TB 方向多 subgraph 图极易超高（b02 实测溢出 289px）；
    多级流水线优先用 `flowchart LR` + `direction TB` 的列式布局，一页一图不与长要点混排。
11. **图片比例不是固定栏宽**（2026-10-22 正式导师汇报实测）：`max-height` 是尺寸上限而非放大目标，
    极宽图放入等宽半栏会同时造成图小、文字栏空。图的科学角色由作者显式声明：中等横图用
    `side-dominant`，极宽主图用 `wide-hero` 的“全宽图 + 下方结论带”；保持 `object-fit:contain`，
    不裁切和拉伸。
12. **用层级填充，不用填词填充**（2026-10-22）：卡片/章节/结论的有效占用来自主判断、解释与讨论提示
    的字号和位置层级。表格空间充足时用 `spacious`，禁止缩小字体或增加无关文字来伪造信息密度。
13. **字号与行距是同一个可读性问题**（2026-10-22）：主要文字最低 18px、眉题最低 20px；表格与卡片
    不得用紧行距伪造信息密度。`fit_text` 只在拥有明确剩余高度的分层卡片解释区中工作：在
    `min/max` 字号和对应行高上下限内二分搜索最大不溢出组合，绝不低于下限，也不应用于全页。
14. **导航不能改变有效画布比例**（2026-11-16）：把 52px 导航放在 Reveal 外部并从视口高度扣除，
    会让 1280×720 页面在 1280×668 区域内按高度缩小，造成左右留白。导航应覆盖画布顶部预留带；
    普通页眉题移到导航下方，画布仍保持 16:9 或 4:3。四种组合是回归状态，不是四套模板。
15. **自适应文字不能反转信息层级**（2026-11-17）：`.card p` 的选择器曾把 thesis 从 27px
    覆盖成 20px，而 `fit_text` 将 detail 放大到 26px，实际形成 `detail > title > thesis`。分层卡片现以
    更明确的选择器固定 `title 30px > thesis 28px > detail ≤26px > cue 18px`；视觉检查按计算字号验证
    严格递减，层级反转记为 P1。

## 三、known non-goals

- 多图不要嵌进 compare 文本卡片：原生图片尺寸与无约束高度会造成图片小、留白大。使用 multi-image 独立受约束区域，每图可选标题/说明，图像填满实际剩余空间；自动优化按图片比例排布，固定对照关系用手动网格。验收必须等待字体、公式、图片与布局完成。

- 不追求动画/交互花活；`fragment` 过渡已显式关闭。
- 不为"以后可能要"的布局预写代码；新布局在第二个真实用例出现时才加入 build.py。
- 不做主题切换；配色即 custom.css 一套（学术纸感）。

## 2026-10-29 · build.py 用法陷阱（静默失败）

`build.py` 的构建调用是 `python build.py <deck_dir>`（无 build 子命令）。误写
`build.py build <deck_dir>` 时脚本把 "build" 当 deck 目录、静默打印用法说明且退出码不清晰——
管道里再接 validate 会在**旧 HTML**上"通过"。教训：构建命令必须确认输出含
`[build] 完成: ...（N 页）` 行，否则视为未构建；凡"改了 yaml 但页面没变"，先查构建命令与
`[build] 完成` 标记。
## 2026-11-18 · PDF 打印只得到当前页

- **症状**：URL 加 `?print-pdf` 后浏览器打印仍只有一页，或出现 fragment 重复页、长页拆分和末尾空白页。
- **根因**：导航模式的 `.has-chapter-nav .reveal` 固定为绝对定位和一屏高度；Reveal 默认还会为
  fragment 分页，并按内容高度扩展页面。直接 Ctrl+P 没有等待延迟渲染的 Mermaid 与多图布局。
- **固定处理**：不要把手动 Ctrl+P 当作交付流程。使用 `export_pdf.mjs`，由它限定一页一张、合并
  fragment、修正打印容器、渲染全部延迟内容并核对实际 PDF 页数。
