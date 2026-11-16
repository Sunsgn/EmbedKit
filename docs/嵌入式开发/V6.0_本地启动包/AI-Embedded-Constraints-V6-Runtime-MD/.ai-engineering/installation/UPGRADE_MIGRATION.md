# V6.0结构升级迁移

## 适用范围

用于从结构版本1升级到结构版本2。升级前必须检查用户修改并建立Git检查点或可恢复备份。

| 旧路径 | 新路径 | 处理 |
|---|---|---|
| `rules/` | `.ai-engineering/rules/` | 整目录迁移，用户修改需三方合并 |
| `disciplines/` | `.ai-engineering/disciplines/` | 整目录迁移 |
| `project/` | `.ai-engineering/project/` | 项目事实必须保留，不得用模板覆盖 |
| `project-framework/` | `.ai-engineering/project-framework/` | 使用路径适配后的完整V1.20 |
| `workflows/` | `.ai-engineering/workflows/` | 整目录迁移 |
| `templates/` | `.ai-engineering/templates/` | 整目录迁移并新增AI加载回执 |
| `work/` | `.ai-engineering/work/` | 保留所有历史任务和证据索引 |
| `installation/` | `.ai-engineering/installation/` | 替换为结构版本2说明 |
| `RULES_INDEX.md`、`VERSION.md` | `.ai-engineering/` | 更新入口引用 |

根目录`AGENTS.md`、`CLAUDE.md`、`GEMINI.md`、`AI-INSTRUCTIONS.md`、`README.md`和`.github/copilot-instructions.md`采用三方合并，不直接覆盖。

## 语义变化

- 专业选择初始状态由“默认软件”改为`UNINITIALIZED`。
- 专业Profile由可选改为任务命中后必读；真实工具任务必读`TOOL_CAPABILITIES.md`。
- 正式审核、测试、放行和跨AI交接即使无文件修改也必须建立任务记录。
- 一个主工作流允许追加必要交接工作流。
- 最终状态统一增加`BLOCKED_BY_AUTH`；PCB阶段统一为六级。
- 新增系统、机械热可靠性、生产校准、安全合规、供应链与现场维护专业。

## 升级验收

1. 根目录不存在旧版散落的`rules/`、`project/`等规范目录；真实业务同名目录不得移动。
2. 所有入口只指向`.ai-engineering/`。
3. V1.20中不存在旧规范路径`.ai/PROJECT_PROFILE.md`或`.ai/项目目录框架.md`。
4. 项目Profile和历史`work/<task-id>/`数量、大小及哈希一致。
5. 使用至少一个软件任务和一个非软件任务生成AI加载回执，验证专业路由。
