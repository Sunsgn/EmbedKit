# AI 工程约束包通用接入与初始化执行指令

> 配套版本：`7.0.0-alpha.2`  
> 配套文件：`通用ai约束文档_7.0.0-alpha.2.zip`  
> ZIP SHA-256：`FE963DB6ADB679857E697B476FE2A7B05A0ED425993F8DC775006DA4CEA6BAC8`

## 1. 执行目标与禁止事项

你正在为用户指定的唯一项目根目录安装或升级 AI 工程约束系统，并初始化统一结构化状态中心。本 Markdown 与上述 ZIP 必须配套使用；版本、文件名或 SHA-256 任一不一致时立即停止。

禁止直接把 ZIP 全量解压或覆盖进项目。禁止手工创建或修改 `.ai/state/`、`.ai/run/`、`.ai/views/`、`.ai/INSTALL_STATE.json`。禁止自动执行 `git add`、`git commit`、`git push`，禁止清理用户已有改动。只有包内 `bootstrap.py` 可以安装包文件，只有安装后的 `.ai/system/aic.py` 可以修改结构化工程状态。

必须使用 Python 3.10 或更高版本。计划、事务和备份必须位于目标项目之外；用户验收前不得删除。

## 2. 确认绝对路径与输入

先记录：

- `ZIP_PATH`：配套 ZIP 的绝对路径；可以位于项目中，但不能把它当成项目根；
- `PROJECT_ROOT`：用户明确指定的唯一项目根绝对路径；
- `WORK_DIR`：项目外的本次安装工作目录；
- `BOOTSTRAP`：从 ZIP 根目录单独安全提取到 `WORK_DIR` 的 `bootstrap.py`；
- `PLAN_PATH`：位于 `WORK_DIR` 的安装计划 JSON。

项目根无法唯一确定时先询问用户。不得使用磁盘根、用户主目录、父级多项目工作区或临时目录代替项目根。

执行前：

1. 确认两个交付文件版本均为 `7.0.0-alpha.2`；
2. 计算 ZIP SHA-256，与本文顶部完整值逐字节比较；
3. 检查 Python 版本满足 `3.10+`；
4. 记录安装前 Git 状态；非 Git 工程则明确记录；
5. 确认 `WORK_DIR` 不在 `PROJECT_ROOT` 内；
6. 使用 ZIP API 只读取根目录下名称完全等于 `bootstrap.py` 的一个普通文件，不解析或展开其他成员路径。

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath '<ZIP_PATH>'
python --version
```

无法安全单独取得 `bootstrap.py` 时停止，不得退化为向项目直接解压整个 ZIP。

## 3. 安装或升级

### 3.1 只读预检

```powershell
python '<BOOTSTRAP>' inspect --zip '<ZIP_PATH>' --target '<PROJECT_ROOT>' --expected-sha256 'FE963DB6ADB679857E697B476FE2A7B05A0ED425993F8DC775006DA4CEA6BAC8' --json
```

只有 `INSPECT_OK` 且没有路径穿越、重复路径、特殊文件、大小/压缩比异常、清单错误或目标边界错误才可继续。

### 3.2 在项目外生成计划

```powershell
python '<BOOTSTRAP>' plan --zip '<ZIP_PATH>' --target '<PROJECT_ROOT>' --output '<PLAN_PATH>' --expected-sha256 'FE963DB6ADB679857E697B476FE2A7B05A0ED425993F8DC775006DA4CEA6BAC8' --json
```

读取结构化结果和计划，确认：

- `can_apply=true`；
- `conflicts` 为空；
- 目标根与用户确认的项目根完全一致；
- 计划文件位于项目外；
- 现有入口内容、项目文件和项目拥有的 `.ai` 状态不会被无依据覆盖；
- 从旧版本升级时，旧包所有权能够通过原安装清单和哈希证明。

任一条件不满足时停止并保留证据。不得删除冲突文件、强制覆盖、改名规避或手工拼接安装内容。

### 3.3 应用计划

生成计划后不得修改 ZIP、计划或将被更新的目标文件：

```powershell
python '<BOOTSTRAP>' apply --plan '<PLAN_PATH>' --json
```

保存输出中的事务文件绝对路径。检测到计划漂移、清单变化或目标变化时，重新从 `inspect` 开始。

### 3.4 安装后包校验

```powershell
python '<PROJECT_ROOT>\.ai\system\aic.py' status --verify --json
```

必须返回 `STATUS_OK`，包版本为 `7.0.0-alpha.2`，且 `PACKAGE_VERIFY_OK`。确认根 `AGENTS.md` 或其他客户端标准入口中的受控块正确，用户原内容仍被保留。

## 4. 初始化统一状态中心

安装成功不等于状态中心已经初始化。先读取状态：

```powershell
python '<PROJECT_ROOT>\.ai\system\aic.py' state show --json
```

若返回 `STATE_NOT_INITIALIZED`，使用真实项目名称初始化一次：

```powershell
python '<PROJECT_ROOT>\.ai\system\aic.py' state init --project-name '<PROJECT_NAME>' --json
```

若已经存在状态中心，禁止重新初始化或用新项目 ID 覆盖。执行：

```powershell
python '<PROJECT_ROOT>\.ai\system\aic.py' state verify --json
```

必须确认事件链、`HEAD`、事务和派生状态健康。状态校验失败时停止状态写入；不要通过手工修改 JSON 让检查通过。

## 5. 每个 AI 会话的强制启动流程

每个新会话先读取根客户端入口和 `.ai/system/ENTRYPOINT.md`，然后执行：

```powershell
python '<PROJECT_ROOT>\.ai\system\aic.py' session start --client '<CLIENT_NAME>' --json
python '<PROJECT_ROOT>\.ai\system\aic.py' state show --json
```

启动回执必须记录会话 ID、`state_revision`、活动任务、推荐下一步和未知/阻断项。后续状态写入必须携带刚读取的状态修订号；返回 `STATE_REVISION_CONFLICT` 或 `ENTITY_REVISION_CONFLICT` 时重新读取状态并核对其他会话的变化，禁止重试覆盖。

创建任务示例：

```powershell
python '<PROJECT_ROOT>\.ai\system\aic.py' task create --title '<TITLE>' --goal '<GOAL>' --session-id '<SESSION_ID>' --expected-state-revision <REVISION> --acceptance '<ACCEPTANCE>' --json
```

创建明确下一步示例：

```powershell
python '<PROJECT_ROOT>\.ai\system\aic.py' next create --task-id '<TASK_ID>' --action '<ACTION>' --priority 1 --session-id '<SESSION_ID>' --expected-state-revision <REVISION> --acceptance '<ACCEPTANCE>' --json
```

更新任务只能使用 `task update`，并同时提供当前状态修订和任务实体修订。不得直接编辑实体快照。

## 6. 旧模板迁移与派生视图

旧 Markdown/CSV 先只读扫描：

```powershell
python '<PROJECT_ROOT>\.ai\system\aic.py' legacy scan --json
```

确认范围后才运行 `legacy import`。alpha.2 只把旧资料作为带路径、大小和哈希的迁移引用导入，并生成审计报告；不会把旧模板静默升级为权威状态，也不代表所有字段已完成结构化提升。

节点结束时生成可读视图：

```powershell
python '<PROJECT_ROOT>\.ai\system\aic.py' view render --json
python '<PROJECT_ROOT>\.ai\system\aic.py' view check --json
```

生成视图被人工修改后必须返回 `VIEW_MANUAL_EDIT_CONFLICT`，不得静默覆盖。Markdown 视图只用于阅读，权威状态仍是事件和已提交事务。

## 7. 安装中断、续跑与回滚

安装应用中断后使用原事务文件所在目录，不要创建新的 `apply`：

```powershell
python '<BOOTSTRAP>' resume --transaction '<TRANSACTION_JSON>' --json
```

用户决定撤销本次安装或升级时：

```powershell
python '<BOOTSTRAP>' rollback --transaction '<TRANSACTION_JSON>' --json
```

回滚不得覆盖安装后由用户或 AI 新修改的文件。出现外部修改冲突时保留现场并报告。状态中心中的项目记录不属于包文件；升级回滚不会把项目开发状态当作包文件删除。

## 8. 验收报告与保留

报告至少记录：项目根、版本、ZIP SHA-256、事务路径、安装/升级结果、包校验、状态修订、事件校验、活动任务、推荐下一步、冲突、Git 前后差异和未完成边界。

用户验收前不得删除项目外事务、备份和计划。验收后清理前再次确认绝对路径位于本次 `WORK_DIR` 或事务目录内。不得自动提交 Git。

## 9. `7.0.0-alpha.2` 能力边界

本版本完成阶段 2 统一状态内核基础：稳定 ID、状态/实体修订、只追加事件哈希链、已提交事务封套、当前快照、独立会话续做、明确下一步、视图防覆盖和旧资料引用迁移。

以下仍未完成，不得宣称最终目标已实现：

- 完整任务状态转换和完成证据门禁；
- 证据有效性与源码/Git/环境漂移自动传播；
- 自动研发节点总结、去重、过期和索引；
- 多范围锁、租约续期、异常退出核对和受控接管；
- 损坏事件链的候选修复、检查点恢复和完整关系图；
- 旧 Markdown/CSV 所有有效字段的结构化提升。

下一阶段应在当前权威状态模型上实现证据、任务生命周期和研发节点总结，不得另建第二套状态文件。
