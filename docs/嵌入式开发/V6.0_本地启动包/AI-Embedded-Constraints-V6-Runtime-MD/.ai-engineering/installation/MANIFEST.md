# 规范包文件所有权清单

以下路径均相对`.ai-engineering/`。根工具入口位于项目根目录。

## 规范包管理，可在升级时替换

- `rules/*.md`
- `disciplines/**/*.md`
- `workflows/*.md`
- `templates/*.md`
- `project-framework/项目目录框架_V1.20.md`
- `project-framework/目录框架适用与裁剪规则.md`
- `installation/*.md`（`PACKAGE_MANIFEST.md`自身不参与自哈希）
- `RULES_INDEX.md`、`VERSION.md`

替换前仍需检查用户是否做过本地修改；有修改时必须合并。

## 合并管理，不得直接覆盖

- `AGENTS.md`
- `CLAUDE.md`
- `GEMINI.md`
- `AI-INSTRUCTIONS.md`
- `README.md`
- `.github/copilot-instructions.md`

## 项目拥有，升级和卸载时保留

- `project/*.md`中的项目值
- `project-framework/现有项目目录映射规则.md`中的项目映射
- `work/<task-id>/`全部任务记录与证据索引

## 当前结构要求

- 除项目根工具入口和`.github/copilot-instructions.md`外，全部规范内容必须位于`.ai-engineering/`。
- 所有交付文件必须为`.md`。
- 包内不得包含脚本、运行时、缓存、日志、二进制证据或示例项目专有值。
- 同一强制规则不得同时存在于入口、工作流和专业正文。
