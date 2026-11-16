# AI 嵌入式开发统一约束包 V6.0

本目录是一套可直接复制到嵌入式工程根目录的 Markdown-only AI 开发约束。它不提供独立运行程序；Codex、Claude Code 或其他本地 AI 工具负责读取工程、修改文件、调用本地工具、执行测试并保存证据。

## 安装

新工程可将本目录中的全部文件复制到工程根目录并保留 `.ai` 结构。既有工程若已经存在 `AGENTS.md`、`CLAUDE.md` 或 `.ai/PROJECT_PROFILE.md`，必须先阅读并增量合并入口和事实，禁止直接覆盖用户原约束与项目事实。Codex 使用 `AGENTS.md`，Claude Code 使用 `CLAUDE.md`，其他工具可从 `AI-INSTRUCTIONS.md` 进入。三个入口只指向同一套权威约束，不重复专业规则。

第一次使用时，要求 AI 执行：

> 按 AGENTS.md 对当前工程进行首次识别，更新 `.ai/PROJECT_PROFILE.md` 和 `.ai/project_constraints/` 中的项目具体约束，保存未知项和冲突，不修改产品代码。项目约束必须写到目录、资源实例、接口、参数来源、精确命令、产物、失败动作和证据位置，不得只填写宽泛要求。

随后可以直接提出开发任务。AI 应按需加载相关约束和工作流，不得每次读取全部文件。

## 目录说明

- `AGENTS.md`：Codex 的紧凑强制入口。
- `CLAUDE.md`：Claude Code 的入口适配。
- `AI-INSTRUCTIONS.md`：其他 AI 工具的通用入口。
- `.ai/PROJECT_PROFILE.md`：当前工程事实、来源和授权边界。
- `.ai/PROJECT_CONSTRAINTS.md`：当前项目具体约束的状态和按需路由入口。
- `.ai/project_constraints/*.md`：当前项目的软件、硬件/PCB、验证/制造、安全/现场和系统/生命周期具体约束；首次识别后由 AI 按工程证据填写。
- `.ai/constraints/INDEX.md`：任务、文件和影响三级路由。
- `.ai/constraints/*.md`：25 个专业领域约束。
- `.ai/workflows/*.md`：常见工程任务的执行闭环。
- `.ai/templates/*.md`：AI 动态建立计划、状态、交接和证据时使用。

## 重要边界

约束文件不扩大 AI 工具原有权限。删除、覆盖、烧录、安全位、真实危险执行器、生产、推送和正式发布仍需工具及用户授权。缺少工具、资料、硬件或授权时必须记录 `UNAVAILABLE`、`NOT_RUN`、`BLOCKED` 或 `BLOCKED_BY_AUTH`，不得模拟为真实 PASS。

通用专业规则不能预先包含新项目的具体芯片、引脚、串口、阈值和命令。真正达到类似 BS20 项目约束粒度的内容由首次识别写入 `project_constraints/*.md`；BS20 或其他示例中的专有值绝不能成为新工程默认值。
