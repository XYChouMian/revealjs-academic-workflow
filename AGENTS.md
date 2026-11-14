# AGENTS.md · Reveal.js 学术演示工作流

凡涉及调研汇报、导师/组会汇报、开题、论文讲解或 Reveal.js deck，必须先读取
`.agents/skills/academic-presentation/SKILL.md`，并按其六阶段流程执行。

核心约束：

1. `decks/<名称>/content/slides.yaml` 是唯一内容源，不直接编辑生成的 `output/index.html`。
2. 每页必须有 `notes` 与 `sources`；事实、解释、跨文献推断和未验证假设不得混写。
3. 科研图片必须来自可追溯原件；复杂图形作为独立文件放入 `assets/`，不得伪造数据或论文图。
4. 模板与 vendor 依赖保持冻结；无明确需求不扩展布局系统或公共样式。
5. 批量修改或公共样式改动前创建 checkpoint；大范围损坏使用 restore 整体回退。
6. 验收以 `validate.py --visual` 无 P0/P1 为停止条件；P2 只记录，不无限润色。
7. 主要可见文字不低于 18px；禁止缩字、隐藏溢出或裁切内容来伪造通过。

详细阶段规范见：

- `.agents/skills/academic-presentation/references/presentation-workflow.md`
- `.agents/skills/academic-presentation/references/design-lessons.md`

