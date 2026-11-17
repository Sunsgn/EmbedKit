# AI 工程约束包通用接入与初始化执行指令

> 正式版本：`7.0.0`  
> 配套 ZIP：`通用ai约束文档_7.0.0.zip`  
> ZIP SHA-256：`830AC9CE700E6ABC7BD060186054113D4584793F9D54309279C860FE4932FB7E`

## 1. 给执行 AI 的最高优先级指令

你的目标不是“把文件解压出来”，而是为用户指定的唯一项目安全安装或升级 AI 工程约束系统，并在后续开发中持续维护项目事实、任务、下一步、证据、失败方案、未知项、并发会话和节点总结。

本 Markdown 与上述 ZIP 必须配套使用。版本、文件名或 SHA-256 任一不一致时立即停止。必须使用 Python 3.10 或更高版本。

禁止事项：

- 禁止直接把 ZIP 全量解压或覆盖到项目；
- 禁止手工创建或编辑 `.ai/state/`、`.ai/run/`、`.ai/views/`、`.ai/INSTALL_STATE.json`；
- 禁止用聊天记忆覆盖结构化状态；
- 禁止自动 `git add`、`git commit`、`git push` 或清理用户已有改动；
- 禁止绕过冲突、完成门禁、锁、证据或 Doctor 只读状态；
- 禁止把未运行的测试、未核验的证据或未执行的步骤描述为完成。

## 2. 确定路径并检查输入

记录绝对路径：

- `ZIP_PATH`：配套 ZIP；
- `PROJECT_ROOT`：用户确认的唯一项目根；
- `WORK_DIR`：项目外安装工作目录；
- `BOOTSTRAP`：从 ZIP 根目录安全提取到 `WORK_DIR` 的唯一普通文件 `bootstrap.py`；
- `PLAN_PATH`：项目外安装计划 JSON。

项目根无法唯一确定时先询问。不得把磁盘根、用户主目录、父级多项目工作区或临时目录当作项目根。安装前记录 Git 状态；非 Git 项目明确记录。

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath '<ZIP_PATH>'
python --version
```

哈希必须严格等于本文顶部值。无法只提取指定普通文件时停止，不得退化为直接全量解压。

## 3. 安装或升级

```powershell
python '<BOOTSTRAP>' inspect --zip '<ZIP_PATH>' --target '<PROJECT_ROOT>' --expected-sha256 '830AC9CE700E6ABC7BD060186054113D4584793F9D54309279C860FE4932FB7E' --json
python '<BOOTSTRAP>' plan --zip '<ZIP_PATH>' --target '<PROJECT_ROOT>' --output '<PLAN_PATH>' --expected-sha256 '830AC9CE700E6ABC7BD060186054113D4584793F9D54309279C860FE4932FB7E' --json
```

只有 `INSPECT_OK`、`can_apply=true`、`conflicts=[]`，且计划目标、创建/更新/保留/备份内容符合预期时才执行：

```powershell
python '<BOOTSTRAP>' apply --plan '<PLAN_PATH>' --json
python '<PROJECT_ROOT>\.ai\system\aic.py' status --verify --json
```

保存 `apply` 返回的事务 JSON。安装后必须为 `7.0.0`、`STATUS_OK` 和 `PACKAGE_VERIFY_OK`。计划后 ZIP、计划或目标变化时重新从 `inspect` 开始。旧包归属无法由原安装状态和哈希证明时停止，不得覆盖。

## 4. 初始化状态中心与项目识别

先运行：

```powershell
python '<PROJECT_ROOT>\.ai\system\aic.py' state show --json
```

仅在返回 `STATE_NOT_INITIALIZED` 时初始化一次：

```powershell
python '<PROJECT_ROOT>\.ai\system\aic.py' state init --project-name '<PROJECT_NAME>' --json
```

项目识别必须受预算且保留未知项：

```powershell
python '<PROJECT_ROOT>\.ai\system\aic.py' adapters list --json
python '<PROJECT_ROOT>\.ai\system\aic.py' project inspect --profile STANDARD --json
```

识别报告必须包含适配器、证据、可信度、未知项、子项目、权限错误、链接跳过、预算和停止原因。未知工程降级为通用源码、产物和运行轨迹分析，禁止猜测芯片、RTOS、IDE、工具链或框架。

流程等级：

- `LIGHT`：小型低风险工作，较小扫描预算；不关闭安全、修订和证据门禁；
- `STANDARD`：一般开发任务，要求节点总结；
- `FULL`：设备、发布、迁移、跨模块或高风险工作，使用更高预算和多类证据。

## 5. 每个 AI 会话的强制启动

读取项目根客户端入口和 `.ai/system/ENTRYPOINT.md`，然后：

```powershell
python '<PROJECT_ROOT>\.ai\system\aic.py' session start --client '<CLIENT_NAME>' --json
python '<PROJECT_ROOT>\.ai\system\aic.py' state show --json
python '<PROJECT_ROOT>\.ai\system\aic.py' doctor diagnose --json
```

启动回执记录会话 ID、状态修订、活动任务、推荐下一步、证据/总结状态、阻断、未知项和 Git 状态。Doctor 返回 `DOCTOR_READ_ONLY_REQUIRED` 时禁止写入。

所有写命令携带刚读取的状态修订和实体修订。发生 `STATE_REVISION_CONFLICT` 或 `ENTITY_REVISION_CONFLICT` 时重新读取并核对其他会话变化，禁止覆盖重试。

## 6. 范围锁、心跳和并发

修改任务或文件前获取最小范围锁：

```powershell
python '<PROJECT_ROOT>\.ai\system\aic.py' lock acquire --session-id '<SESSION_ID>' --scope 'task:<TASK_ID>' --scope 'path:relative/directory' --lease-seconds 300 --json
```

范围支持 `task:TASK-...`、`file:relative/file`、`path:relative/directory`。非重叠范围可受控并行；重叠锁或重叠 CLI 写入必须阻断。

长任务定期执行：

```powershell
python '<PROJECT_ROOT>\.ai\system\aic.py' session heartbeat --session-id '<SESSION_ID>' --ttl-seconds 300 --json
python '<PROJECT_ROOT>\.ai\system\aic.py' lock renew --id '<LOCK_ID>' --session-id '<SESSION_ID>' --lease-seconds 300 --json
```

租约过期不自动转移所有权。必须核对原会话、未完成事务、Git 和文件变化，并取得明确确认后使用 `lock recover-expired --acknowledge-reviewed`；之后重新获取新锁。

本机锁只协调同一工作副本。不同计算机或仓库副本通过 Git、状态修订或外部协作机制处理冲突，禁止宣称拥有分布式强锁。

## 7. 任务、下一步、证据和总结

创建任务时记录原始目标、验收条件、流程等级和理由；使用 `next create` 创建可直接执行和验收的下一步。任务和下一步只能通过注册表允许的 `transition` 更新。

必须保留：完成项、剩余项、阻断项、失败方案、未知项、恢复/解除条件、实际修改和关联证据。暂停必须有恢复条件；阻断必须有解除条件；失败必须记录失败方案。

真实测试、构建、日志、设备或分析结果先保存在项目内，再登记：

```powershell
python '<PROJECT_ROOT>\.ai\system\aic.py' evidence add --task-id '<TASK_ID>' --type '<TYPE>' --result PASS --artifact '<PROJECT_RELATIVE_PATH>' --session-id '<SESSION_ID>' --expected-state-revision <REV> --json
```

证据记录哈希、大小、Git 基线、结果和局限。文件、环境或输入变化时执行 `evidence verify`/`invalidate`；旧证据必须保留并传播 `STALE`，不能继续支撑当前完成结论。

重要节点生成总结：

```powershell
python '<PROJECT_ROOT>\.ai\system\aic.py' summary generate --task-id '<TASK_ID>' --type STAGE --trigger '<TRIGGER>' --session-id '<SESSION_ID>' --expected-state-revision <REV> --json
```

总结中的状态、完成/剩余、证据、Git、失败方案、未知项和下一步来自结构化事实；推断与事实分离。同一任务、类型和来源修订去重。核对后使用 `summary verify`。

任务进入 `COMPLETED` 必须同时具有验收条件、当前有效证据、已验证总结、无剩余/阻断且下一步已关闭；否则必须阻断。

## 8. 健康诊断、漂移和恢复

```powershell
python '<PROJECT_ROOT>\.ai\system\aic.py' state verify --json
python '<PROJECT_ROOT>\.ai\system\aic.py' doctor diagnose --json
```

Doctor 检查事件链、事务封套、实体快照、会话、锁、未完成事务、证据、视图和 Git 基线漂移。Git 漂移时重新核验证据和总结，不得沿用旧结论。

需要修复时先生成计划：

```powershell
python '<PROJECT_ROOT>\.ai\system\aic.py' doctor repair-plan --json
python '<PROJECT_ROOT>\.ai\system\aic.py' doctor apply --plan '<PLAN>' --session-id '<SESSION_ID>' --acknowledge --json
```

只允许自动重放派生状态、核对运行事务和标记崩溃会话；修复前备份并生成报告。事件链、HEAD 或已提交事务封套损坏时强制只读，禁止自动重写权威历史。

## 9. 会话结束

完成真实验证和总结后：

```powershell
python '<PROJECT_ROOT>\.ai\system\aic.py' lock release --id '<LOCK_ID>' --session-id '<SESSION_ID>' --json
python '<PROJECT_ROOT>\.ai\system\aic.py' session end --session-id '<SESSION_ID>' --json
python '<PROJECT_ROOT>\.ai\system\aic.py' state verify --json
python '<PROJECT_ROOT>\.ai\system\aic.py' doctor diagnose --json
python '<PROJECT_ROOT>\.ai\system\aic.py' view render --json
python '<PROJECT_ROOT>\.ai\system\aic.py' view check --json
```

会话仍持锁时禁止结束。最终回执必须给出当前修订、已完成、未完成、证据、总结、失败方案、未知项、Git 基线、Doctor 结果和按优先级排列的下一步。

## 10. 安装事务恢复与回滚

安装中断后使用原事务 JSON：

```powershell
python '<BOOTSTRAP>' resume --transaction '<TRANSACTION_JSON>' --json
```

撤销本次安装或升级：

```powershell
python '<BOOTSTRAP>' rollback --transaction '<TRANSACTION_JSON>' --json
```

回滚不得覆盖安装后外部修改。出现冲突时保留现场。用户验收前不得删除项目外计划、事务和备份。

## 11. 最终 ZIP 自维护

通用核心出现缺陷时，不在业务项目内拼凑源码。使用已安装系统从受信任 ZIP 建立项目外维护工作区：

```powershell
python '<PROJECT_ROOT>\.ai\system\aic.py' maintenance prepare --zip '<SOURCE_ZIP>' --workspace '<OUTSIDE_EMPTY_WORKSPACE>' --expected-sha256 '<SOURCE_SHA256>' --json
```

在维护工作区增量修改包文件并增加能复现问题的回归测试。然后：

```powershell
python '<PROJECT_ROOT>\.ai\system\aic.py' maintenance test --workspace '<WORKSPACE>' --json
python '<PROJECT_ROOT>\.ai\system\aic.py' maintenance repack --workspace '<WORKSPACE>' --output '<NEW_OUTSIDE_ZIP>' --test-report '<PASSED_REPORT>' --json
```

只有测试通过报告匹配该工作区才允许重打包。输出 ZIP 必须不存在，禁止覆盖旧包。新包还必须完成确定性双打包、干净安装、已有项目升级、状态保留和回滚验证；旧 ZIP 保留到用户验收。

## 12. 明确能力边界

- 本机范围锁不冒充跨计算机强锁；
- 持续后台监视由外部调度，系统在会话启动和节点结束显式校准；
- 权威事件历史损坏不自动重写；
- Markdown/CSV 视图和旧模板不是第二套权威状态；
- 无法运行本地工具的 AI 客户端只能只读展示并说明 `LOCAL_RUNTIME_UNAVAILABLE`，不得模拟写入成功。
