# AI 工程约束包通用接入与初始化执行指令

> 版本：`7.0.0-alpha.5`  
> ZIP：`通用ai约束文档_7.0.0-alpha.5.zip`  
> SHA-256：`308CE9763D1211598317B188CC40676241F98B32728A2E4B114E6278BB040F81`

## 安装

本文件与 ZIP 必须配套。确认唯一项目根和 Python 3.10+。禁止直接全量解压 ZIP、手工编辑 `.ai` 状态、自动 Git 提交或清理用户改动。计划、事务和备份放在项目外。

只安全提取 ZIP 根唯一普通文件 `bootstrap.py`，依次执行：

```powershell
python '<BOOTSTRAP>' inspect --zip '<ZIP_PATH>' --target '<PROJECT_ROOT>' --expected-sha256 '308CE9763D1211598317B188CC40676241F98B32728A2E4B114E6278BB040F81' --json
python '<BOOTSTRAP>' plan --zip '<ZIP_PATH>' --target '<PROJECT_ROOT>' --output '<OUTSIDE_PLAN>' --expected-sha256 '308CE9763D1211598317B188CC40676241F98B32728A2E4B114E6278BB040F81' --json
python '<BOOTSTRAP>' apply --plan '<OUTSIDE_PLAN>' --json
python '<PROJECT_ROOT>\.ai\system\aic.py' status --verify --json
```

只有预检成功、`can_apply=true`、零冲突才可应用。保存事务 JSON；验收前不得删除。安装后必须为 alpha.5、`STATUS_OK`、`PACKAGE_VERIFY_OK`。

## 初始化、识别和流程等级

状态未初始化时只执行一次 `state init`。随后启动会话并诊断：

```powershell
python '<PROJECT_ROOT>\.ai\system\aic.py' session start --client '<CLIENT>' --json
python '<PROJECT_ROOT>\.ai\system\aic.py' state show --json
python '<PROJECT_ROOT>\.ai\system\aic.py' doctor diagnose --json
```

项目识别必须使用受预算扫描：

```powershell
python '<PROJECT_ROOT>\.ai\system\aic.py' adapters list --json
python '<PROJECT_ROOT>\.ai\system\aic.py' project inspect --profile STANDARD --json
```

识别结论必须包含适配器、证据、可信度、未知项、截断、权限错误和链接跳过情况。未知项目降级为通用分析，禁止猜测芯片、RTOS、IDE 或框架。

流程等级：

- `LIGHT`：低风险小任务，较小扫描预算；仍保留路径、修订、证据和包完整性门禁。
- `STANDARD`：一般开发任务，要求节点总结。
- `FULL`：高风险、跨模块、设备、发布或迁移任务，更高预算和至少两类证据。

创建任务时通过 `--level` 和 `--level-reason` 记录选择，不能为了省步骤关闭安全门禁。

大型目录通过 `--max-files`、`--max-bytes`、`--timeout-seconds` 收紧预算；用项目内 `--cancel-file` 请求取消。出现 `PROJECT_SCAN_PARTIAL` 时保留已发现证据和停止原因，不把部分扫描说成完整覆盖。

## 开发和并发闭环

每次修改前获取最小 `task:`、`file:` 或 `path:` 范围锁；定期执行会话心跳和锁续租。非重叠范围可并行，重叠写入必须阻断。过期锁只能在核对会话、事务、Git 和文件变化并明确确认后恢复。

使用任务/下一步状态机、项目内真实证据、确定性总结和完成门禁。失败方案、未知项和过期证据必须保留。结束时释放锁、结束会话，运行：

```powershell
python '<PROJECT_ROOT>\.ai\system\aic.py' state verify --json
python '<PROJECT_ROOT>\.ai\system\aic.py' doctor diagnose --json
python '<PROJECT_ROOT>\.ai\system\aic.py' view render --json
```

Doctor 只自动重建派生状态、核对运行事务和标记崩溃会话；权威事件或事务损坏时保持只读。安装中断使用 `resume`，撤销升级使用 `rollback`，不得覆盖外部修改。

## 当前边界

alpha.5 已完成通用适配、预算和平台边界阶段。最终 ZIP 自维护流程、正式版本迁移、全部目标基线端到端矩阵和最终发布仍在阶段 6；不得把本候选称为最终正式版。
