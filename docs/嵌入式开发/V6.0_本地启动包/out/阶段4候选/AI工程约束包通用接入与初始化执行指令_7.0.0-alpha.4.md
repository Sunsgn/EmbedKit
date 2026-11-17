# AI 工程约束包通用接入与初始化执行指令

> 版本：`7.0.0-alpha.4`  
> ZIP：`通用ai约束文档_7.0.0-alpha.4.zip`  
> SHA-256：`DF310FC7305CFD52A1B4466F99AF6EE44DF7D0E1E5F8FBB5F83B89DE021AE26E`

## 安装安全规则

本文件和 ZIP 必须配套。版本、名称或 SHA-256 不一致时停止。确认唯一项目根，使用 Python 3.10+。不得直接全量解压 ZIP，不得手工编辑 `.ai/state/`、`.ai/run/`、`.ai/views/` 或安装状态，不得自动 Git 提交、推送或清理用户改动。

计划、事务和备份必须位于项目外。只从 ZIP 根安全提取唯一普通文件 `bootstrap.py` 到项目外工作目录。

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath '<ZIP_PATH>'
python '<BOOTSTRAP>' inspect --zip '<ZIP_PATH>' --target '<PROJECT_ROOT>' --expected-sha256 'DF310FC7305CFD52A1B4466F99AF6EE44DF7D0E1E5F8FBB5F83B89DE021AE26E' --json
python '<BOOTSTRAP>' plan --zip '<ZIP_PATH>' --target '<PROJECT_ROOT>' --output '<OUTSIDE_PLAN_PATH>' --expected-sha256 'DF310FC7305CFD52A1B4466F99AF6EE44DF7D0E1E5F8FBB5F83B89DE021AE26E' --json
```

只有 `INSPECT_OK`、`can_apply=true` 且无冲突才执行：

```powershell
python '<BOOTSTRAP>' apply --plan '<OUTSIDE_PLAN_PATH>' --json
python '<PROJECT_ROOT>\.ai\system\aic.py' status --verify --json
```

保存事务 JSON。安装后必须为 `7.0.0-alpha.4`、`STATUS_OK`、`PACKAGE_VERIFY_OK`。

## 状态初始化和会话

`state show` 返回未初始化时，只运行一次：

```powershell
python '<PROJECT_ROOT>\.ai\system\aic.py' state init --project-name '<PROJECT_NAME>' --json
```

每个会话启动：

```powershell
python '<PROJECT_ROOT>\.ai\system\aic.py' session start --client '<CLIENT>' --json
python '<PROJECT_ROOT>\.ai\system\aic.py' state show --json
python '<PROJECT_ROOT>\.ai\system\aic.py' doctor diagnose --json
```

若 Doctor 返回 `DOCTOR_READ_ONLY_REQUIRED`，禁止继续写入。所有状态写入携带当前状态和实体修订；冲突后重新读取，不得覆盖重试。

## 范围锁和租约

修改任务或文件前获取最小范围锁：

```powershell
python '<PROJECT_ROOT>\.ai\system\aic.py' lock acquire --session-id '<SESSION_ID>' --scope 'task:<TASK_ID>' --scope 'path:src/module' --lease-seconds 300 --json
```

范围格式：

- `task:TASK-...`：任务范围；
- `file:relative/path.c`：单文件；
- `path:relative/directory`：目录树。

锁只协调同一工作副本。不同计算机或仓库副本之间仍依靠 Git 和状态修订发现冲突。长任务必须定期：

```powershell
python '<PROJECT_ROOT>\.ai\system\aic.py' session heartbeat --session-id '<SESSION_ID>' --ttl-seconds 300 --json
python '<PROJECT_ROOT>\.ai\system\aic.py' lock renew --id '<LOCK_ID>' --session-id '<SESSION_ID>' --lease-seconds 300 --json
```

非重叠范围可受控并行；重叠范围或重叠 CLI 写入必须返回 `LOCK_SCOPE_CONFLICT`。租约过期不代表可自动接管。核对所有者会话、事务、Git 和文件变化后，获得明确确认才可：

```powershell
python '<PROJECT_ROOT>\.ai\system\aic.py' lock recover-expired --id '<LOCK_ID>' --session-id '<REVIEWER_SESSION_ID>' --acknowledge-reviewed --json
```

恢复只把旧锁标记为已恢复，随后必须重新 `acquire` 新锁。

## 开发闭环

使用 `task create`、`next create/transition`、`task transition` 管理工作。暂停必须有恢复条件，阻断必须有解除条件，失败必须保存失败方案和未知项。

真实测试、构建、日志或设备结果通过 `evidence add` 登记项目内文件。证据文件变化后运行 `evidence verify` 或 `evidence invalidate`；过期必须传播到任务和总结。

重要节点使用：

```powershell
python '<PROJECT_ROOT>\.ai\system\aic.py' summary generate --task-id '<TASK_ID>' --type STAGE --trigger '<TRIGGER>' --session-id '<SESSION_ID>' --expected-state-revision <REV> --json
python '<PROJECT_ROOT>\.ai\system\aic.py' summary verify --id '<SUMMARY_ID>' --session-id '<SESSION_ID>' --expected-state-revision <REV> --expected-entity-revision <ENTITY_REV> --json
```

任务完成必须具有验收条件、有效证据、已验证总结、无剩余/阻断且下一步已关闭；否则 `TASK_COMPLETION_GATE_FAILED`。

## 健康诊断与修复

Doctor 检查事件链、事务封套、实体快照、会话、锁、未完成事务、证据和视图：

```powershell
python '<PROJECT_ROOT>\.ai\system\aic.py' doctor diagnose --json
python '<PROJECT_ROOT>\.ai\system\aic.py' doctor repair-plan --json
```

修复计划生成后必须核对动作、项目根和预期修订，再明确执行：

```powershell
python '<PROJECT_ROOT>\.ai\system\aic.py' doctor apply --plan '<PROJECT_AUDIT_PLAN>' --session-id '<SESSION_ID>' --acknowledge --json
```

允许自动修复的范围仅包括：从有效权威历史重放派生实体/快照、核对并标记运行事务、标记过期会话。修复前备份并生成报告。事件链、HEAD 或已提交事务封套损坏时必须保持只读，计划中出现人工动作时禁止自动执行。

## 会话结束

```powershell
python '<PROJECT_ROOT>\.ai\system\aic.py' lock release --id '<LOCK_ID>' --session-id '<SESSION_ID>' --json
python '<PROJECT_ROOT>\.ai\system\aic.py' session end --session-id '<SESSION_ID>' --json
python '<PROJECT_ROOT>\.ai\system\aic.py' state verify --json
python '<PROJECT_ROOT>\.ai\system\aic.py' doctor diagnose --json
python '<PROJECT_ROOT>\.ai\system\aic.py' view render --json
```

会话仍持锁时禁止结束。回执记录修订、任务、证据、总结、失败方案、未知项、锁释放、Doctor 结果和下一步。

## 安装恢复和版本边界

安装中断使用 `bootstrap.py resume --transaction '<TRANSACTION_JSON>'`；撤销安装/升级使用 `rollback`。外部修改冲突时不得强制覆盖。事务与备份验收前不得删除。

alpha.4 已完成阶段 4 本机并发和保守恢复能力。它不是跨计算机分布式锁；自动项目识别、规模预算、跨平台矩阵、环境漂移扫描和最终发布验收仍在后续阶段。
