# 多AI工具接入

## 原则

所有AI使用同一权威规则正文。工具专属文件只能说明如何加载根`AGENTS.md`，不得复制专业规则或建立独立完成标准。

| 工具 | 默认入口 | 接入方式 |
|---|---|---|
| Codex | `AGENTS.md` | 直接读取根入口及作用域内局部入口 |
| Claude Code | `CLAUDE.md` | 指向根`AGENTS.md` |
| Gemini CLI | `GEMINI.md` | 指向根`AGENTS.md` |
| GitHub Copilot | `.github/copilot-instructions.md` | 指向根规范和索引 |
| 其他AI | `AI-INSTRUCTIONS.md` | 使用通用加载顺序 |

如果某工具不支持自动递归读取，首次提示中明确要求读取入口、`00`至`03`四份通用底线、项目启用状态和当前专业规范。工具上下文不足时优先保留安全、事实、证据和当前专业规则，不得通过缩写改变要求。

切换AI工具时从同一个`work/<task-id>/STATUS.md`、`HANDOFF.md`和输入哈希继续；新工具必须先核对工作区和最近证据，不得猜测上一工具已完成的动作。
