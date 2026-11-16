# 项目 AI 开发入口

本项目使用 `.ai/AIES-V6` 约束 AI 开发。

每个任务必须遵循：

1. 先读取 `.ai/AIES-V6/AGENTS.md`，不得预读全部专业规则。
2. 用用户原始需求运行 `.ai/AIES-V6` 的 `python -m aies route`。
3. 只读取路由结果中的 `ai_read_files`；不要把 `machine_rule_files` 加入模型上下文。
4. 再读取目标路径作用域内的项目约束与 `.ai/PROJECT_PROFILE.md`；Profile 中为 `UNKNOWN` 的参数不得用经验值补齐。
5. 按路由约束完成实际实现、测试、证据和交接；缺工具或真实验证条件时如实降级。

本文件不授予删除、覆盖、烧录、设备控制、Git 提交/推送、生产或正式发布权限。
