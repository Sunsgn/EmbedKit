# AI 嵌入式全栈工程研发规范

这是一套可直接放入新项目或已有项目的纯 Markdown 工程规范。目标是让 Codex、Claude Code、Gemini CLI、GitHub Copilot及其他AI工具遵循同一套要求，像工程团队一样完成嵌入式软件、原理图、PCB、软硬件协同、真实测试、整改和交付。

## 使用特点

- **一个规则真源**：`rules/`和`disciplines/`是强制规则；入口、工作流和模板不复制技术正文。
- **专业独立启用**：软件、原理图、PCB、测试和协同分析可以单独使用，不强制走完整生命周期。
- **项目事实分离**：通用规则不写死芯片、RTOS、EDA或工具链；具体值记录在`project/`。
- **真实证据判定**：无法访问EDA、硬件、仪器或生产环境时明确降级，禁止模拟为PASS。
- **新旧项目兼容**：新项目可以采用V1.20目录；已有项目使用目录映射，不强制重构。

## 最快开始

1. 按`installation/新项目安装.md`或`installation/已有项目增量接入.md`接入。
2. 在`project/ENABLED_DISCIPLINES.md`勾选当前需要的专业。
3. 只填写当前任务必需的项目事实，不要求一次填完所有Profile。
4. 向AI提出具体任务；AI从`AGENTS.md`进入并按`RULES_INDEX.md`加载。

## 文件效力

- 正式强制约束：`rules/*.md`、`disciplines/**/*.md`。
- 项目事实：`project/*.md`中具有来源和状态的已确认内容。
- 权威目录基线：`project-framework/项目目录框架_V1.20.md`。
- 执行辅助：`workflows/`、`templates/`、`work/`。
- 工具入口：`AGENTS.md`、`CLAUDE.md`、`GEMINI.md`、`AI-INSTRUCTIONS.md`、`.github/copilot-instructions.md`。

入口和辅助文件不得产生与权威规则冲突的新要求。详细冲突优先级见`rules/00_规范效力与加载规则.md`。
