# AI 工程约束包通用接入与初始化执行指令

> 版本：`7.0.0-alpha.3`  
> ZIP：`通用ai约束文档_7.0.0-alpha.3.zip`  
> SHA-256：`EEEDEEDE4EF227CC7CFB998D0A66A6E2E50A3110FAE5FDA0AA9F04AB9733994E`

## 1. 强制安全边界

本文件与上述 ZIP 必须配套。版本、文件名或 SHA-256 不一致时停止。目标必须是用户确认的唯一项目根；无法唯一确定时先询问。使用 Python 3.10+。

禁止把 ZIP 直接全量解压或覆盖进项目；禁止手工修改 `.ai/state/`、`.ai/run/`、`.ai/views/` 和 `.ai/INSTALL_STATE.json`；禁止自动 Git 提交、推送或清理用户改动。安装计划、事务和备份必须位于项目外，验收前不得删除。

只从 ZIP 根目录安全提取名称完全等于 `bootstrap.py` 的一个普通文件到项目外 `WORK_DIR`。先记录 `ZIP_PATH`、`PROJECT_ROOT`、`WORK_DIR`、`BOOTSTRAP` 和项目外 `PLAN_PATH` 的绝对路径。

## 2. 安装或升级

先核对哈希和 Python：

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath '<ZIP_PATH>'
python --version
```

依次执行：

```powershell
python '<BOOTSTRAP>' inspect --zip '<ZIP_PATH>' --target '<PROJECT_ROOT>' --expected-sha256 'EEEDEEDE4EF227CC7CFB998D0A66A6E2E50A3110FAE5FDA0AA9F04AB9733994E' --json
python '<BOOTSTRAP>' plan --zip '<ZIP_PATH>' --target '<PROJECT_ROOT>' --output '<PLAN_PATH>' --expected-sha256 'EEEDEEDE4EF227CC7CFB998D0A66A6E2E50A3110FAE5FDA0AA9F04AB9733994E' --json
```

只有 `INSPECT_OK`、`can_apply=true` 且 `conflicts` 为空才可执行：

```powershell
python '<BOOTSTRAP>' apply --plan '<PLAN_PATH>' --json
python '<PROJECT_ROOT>\.ai\system\aic.py' status --verify --json
```

保存 `apply` 输出的事务 JSON。安装后必须为 `7.0.0-alpha.3`、`STATUS_OK` 和 `PACKAGE_VERIFY_OK`。计划后发生任何文件或 ZIP 漂移时重新从 `inspect` 开始，不得强行覆盖。

## 3. 状态中心与会话启动

先运行 `state show`。若返回 `STATE_NOT_INITIALIZED`，只初始化一次：

```powershell
python '<PROJECT_ROOT>\.ai\system\aic.py' state init --project-name '<PROJECT_NAME>' --json
```

每个新会话必须执行：

```powershell
python '<PROJECT_ROOT>\.ai\system\aic.py' session start --client '<CLIENT_NAME>' --json
python '<PROJECT_ROOT>\.ai\system\aic.py' state show --json
```

保存会话 ID、状态修订、活动任务和推荐下一步。所有写入必须携带刚读取的状态修订与实体修订；发生 `STATE_REVISION_CONFLICT` 或 `ENTITY_REVISION_CONFLICT` 时重新读取并核对变化，禁止覆盖重试。

## 4. 任务、下一步和证据闭环

创建任务和下一步：

```powershell
python '<PROJECT_ROOT>\.ai\system\aic.py' task create --title '<TITLE>' --goal '<GOAL>' --session-id '<SESSION_ID>' --expected-state-revision <REV> --acceptance '<ACCEPTANCE>' --json
python '<PROJECT_ROOT>\.ai\system\aic.py' next create --task-id '<TASK_ID>' --action '<ACTION>' --priority 1 --session-id '<SESSION_ID>' --expected-state-revision <REV> --acceptance '<ACCEPTANCE>' --json
```

任务状态只能使用 `task transition` 按注册表转换。暂停必须提供 `--resume-condition`，阻断必须提供 `--resolution-condition`，失败必须通过 `--failed-attempt` 保留失败方案；未知项使用 `--unknown`，不得删除历史来伪装成功。

真实测试、构建、日志或其他结果必须先保存在项目内，再登记证据：

```powershell
python '<PROJECT_ROOT>\.ai\system\aic.py' evidence add --task-id '<TASK_ID>' --type '<TYPE>' --result PASS --artifact '<PROJECT_RELATIVE_PATH>' --session-id '<SESSION_ID>' --expected-state-revision <REV> --json
```

证据记录路径、大小、SHA-256、Git 基线、结果和局限。证据文件变化后使用 `evidence verify` 或 `evidence invalidate`；系统必须保留旧证据并传播 `STALE`，不得继续把旧通过结果当成当前完成依据。

下一步完成后运行：

```powershell
python '<PROJECT_ROOT>\.ai\system\aic.py' next transition --id '<NEXT_ID>' --to DONE --session-id '<SESSION_ID>' --expected-state-revision <REV> --expected-entity-revision <ENTITY_REV> --json
```

## 5. 研发节点总结和完成门禁

在阶段完成、重要验证、失败、决策、暂停、恢复和交接节点生成总结：

```powershell
python '<PROJECT_ROOT>\.ai\system\aic.py' summary generate --task-id '<TASK_ID>' --type STAGE --trigger '<TRIGGER>' --session-id '<SESSION_ID>' --expected-state-revision <REV> --json
```

总结的任务状态、完成项、剩余项、证据、Git 基线、失败方案、未知项和下一步由结构化状态确定性生成；AI 推断不得写成事实。同一任务、类型和来源修订重复触发时必须去重。核对后使用 `summary verify`。

任务进入 `COMPLETED` 前必须同时满足：

- 有明确验收条件；
- 没有剩余工作和阻断项；
- 至少一项当前有效证据；
- 至少一份已验证总结；
- 关联下一步均已完成、取消或过期。

不满足时必须返回 `TASK_COMPLETION_GATE_FAILED`，禁止直接编辑状态绕过。

## 6. 节点结束与新会话续做

```powershell
python '<PROJECT_ROOT>\.ai\system\aic.py' state verify --json
python '<PROJECT_ROOT>\.ai\system\aic.py' view render --json
python '<PROJECT_ROOT>\.ai\system\aic.py' view check --json
```

人工修改生成视图后不得静默覆盖。最终回执记录状态修订、任务状态、证据与总结 ID、失败方案、未知项、Git 基线和下一步。新会话必须从 `state show` 继续，不能依赖旧聊天上下文。

## 7. 安装事务恢复

安装中断：

```powershell
python '<BOOTSTRAP>' resume --transaction '<TRANSACTION_JSON>' --json
```

撤销本次安装或升级：

```powershell
python '<BOOTSTRAP>' rollback --transaction '<TRANSACTION_JSON>' --json
```

出现外部修改或备份冲突时保留现场并报告，禁止强制覆盖。项目状态记录不属于包文件，升级回滚不得删除项目研发状态。

## 8. 当前边界

alpha.3 已完成阶段 3 的任务生命周期、证据有效性基础、完成门禁和确定性总结。自动环境漂移扫描、总结自动触发、范围锁、租约续期、异常会话接管、未完成事务恢复和损坏事件链候选修复仍未完成，不得宣称最终目标已全部实现。
