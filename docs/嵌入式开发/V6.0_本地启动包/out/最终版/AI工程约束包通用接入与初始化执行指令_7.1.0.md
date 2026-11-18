# AI 工程约束包通用接入与初始化执行指令

> 正式版本：`7.1.0`  
> 配套 ZIP：`通用ai约束文档_7.1.0.zip`  
> ZIP SHA-256：`1C1103BF47C75356DAE1DFB46AE99B53063C08B2BB210A992E3FD7C2BFFB6BBC`  
> 最低 Python：`3.10`

## 1. 给执行 AI 的最高优先级指令

目标不是简单解压，而是把本约束系统安全安装或升级到用户确认的唯一项目根，并在以后每次开发中用结构化状态回答：做到哪里、完成了什么、失败过什么、依据是什么、下一步是什么。

Markdown、ZIP 文件名、版本和 SHA-256 必须全部一致，否则停止。禁止直接全量解压或覆盖项目，禁止直接编辑 `.ai/state/`、`.ai/run/`、`.ai/views/` 和 `.ai/INSTALL_STATE.json`，禁止绕过会话、锁、修订、证据、完成门禁或 Doctor 只读状态，禁止把未执行结果描述为完成。安装过程不得自动执行 `git add/commit/push`，不得清理用户已有改动。

## 2. 确定边界并检查输入

先记录绝对路径：

- `ZIP_PATH`：本文配套 ZIP；
- `PROJECT_ROOT`：用户确认的单一项目根，不能是磁盘根、用户主目录或包含多个项目的父工作区；
- `WORK_DIR`：项目外的新建安装工作目录；
- `BOOTSTRAP`：安全提取到 `WORK_DIR` 的 `bootstrap.py`；
- `PLAN_PATH`：项目外、此前不存在的计划 JSON。

安装前记录 Git 状态；非 Git 项目明确记录。先核对：

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath '<ZIP_PATH>'
python --version
```

## 3. 只提取 `bootstrap.py`

不得调用“全部解压”。Windows PowerShell 可直接读取 ZIP 中唯一成员并创建新文件：

```powershell
$ZipPath = '<ZIP_PATH>'
$Bootstrap = '<WORK_DIR>\bootstrap.py'
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Bootstrap) | Out-Null
if (Test-Path -LiteralPath $Bootstrap) { throw 'BOOTSTRAP_TARGET_EXISTS' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
try {
  $matches = @($archive.Entries | Where-Object { $_.FullName -ceq 'bootstrap.py' -and $_.Name -ceq 'bootstrap.py' })
  if ($matches.Count -ne 1 -or $matches[0].Length -gt 1048576) { throw 'BOOTSTRAP_MEMBER_INVALID' }
  $input = $matches[0].Open()
  $output = [System.IO.File]::Open($Bootstrap, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
  try { $input.CopyTo($output) } finally { $output.Dispose(); $input.Dispose() }
} finally { $archive.Dispose() }
```

Windows、Linux 和 macOS 均可使用平台无关 Python 方式；目标必须不存在：

```text
python -c "import pathlib,stat,zipfile; z=zipfile.ZipFile(r'<ZIP_PATH>'); i=z.getinfo('bootstrap.py'); m=(i.external_attr>>16)&0o170000; assert i.filename=='bootstrap.py' and not i.is_dir() and m in (0,stat.S_IFREG) and i.file_size<=1048576; p=pathlib.Path(r'<WORK_DIR>')/'bootstrap.py'; p.parent.mkdir(parents=True,exist_ok=True); f=p.open('xb'); f.write(z.read(i)); f.close(); z.close()"
```

若不能只提取该普通文件，停止，不得退化为全量解压。

## 4. 安装或升级事务

```text
python '<BOOTSTRAP>' inspect --zip '<ZIP_PATH>' --target '<PROJECT_ROOT>' --expected-sha256 '1C1103BF47C75356DAE1DFB46AE99B53063C08B2BB210A992E3FD7C2BFFB6BBC' --json
python '<BOOTSTRAP>' plan --zip '<ZIP_PATH>' --target '<PROJECT_ROOT>' --output '<PLAN_PATH>' --expected-sha256 '1C1103BF47C75356DAE1DFB46AE99B53063C08B2BB210A992E3FD7C2BFFB6BBC' --json
```

只有 `INSPECT_OK`、`can_apply=true`、`conflicts=[]`，且目标和操作清单正确时才执行：

```text
python '<BOOTSTRAP>' apply --plan '<PLAN_PATH>' --json
python '<PROJECT_ROOT>/.ai/system/aic.py' status --verify --json
```

结果必须为 `INSTALL_COMMITTED`、`STATUS_OK`、`PACKAGE_VERIFY_OK`，包版本为 `7.1.0`、结构版本为 `16`。保存返回的事务 JSON。旧受控入口只有在当前块哈希等于旧安装状态时才会升级；人工修改过的受控块必须冲突停止，入口之外的用户正文必须保留。

中断后使用 `resume --transaction '<TRANSACTION_JSON>'`；撤销本次安装或升级使用 `rollback --transaction '<TRANSACTION_JSON>'`。回滚遇到安装后外部变化时必须保留现场并报告冲突。

## 5. 初始化或迁移状态

```text
python '<PROJECT_ROOT>/.ai/system/aic.py' state show --json
```

仅当返回 `STATE_NOT_INITIALIZED` 时执行一次：

```text
python '<PROJECT_ROOT>/.ai/system/aic.py' state init --project-name '<PROJECT_NAME>' --json
```

已有 7.0 状态先只读检查：

```text
python '<PROJECT_ROOT>/.ai/system/aic.py' state migration-status --json
```

若 `migration_required=true`，先启动/恢复会话，取得 `project:state` 锁，再携带最新状态修订执行：

```text
python '<PROJECT_ROOT>/.ai/system/aic.py' workflow resume --client '<CLIENT_NAME>' --json
python '<PROJECT_ROOT>/.ai/system/aic.py' lock acquire --session-id '<SESSION_ID>' --scope 'project:state' --lease-seconds 300 --json
python '<PROJECT_ROOT>/.ai/system/aic.py' state migrate --session-id '<SESSION_ID>' --expected-state-revision <REV> --json
```

迁移把旧字符串验收条件确定性转换为稳定 `ACPT-*`，默认 `UNVERIFIED`，不会伪造证据；命令可重复执行。迁移前保留安装事务和项目备份，确认 7.1 可用前不得删除。

## 6. 每个 AI 会话的标准入口

读取项目根客户端入口和 `.ai/system/ENTRYPOINT.md`，优先执行：

```text
python '<PROJECT_ROOT>/.ai/system/aic.py' workflow resume --client '<CLIENT_NAME>' --json
python '<PROJECT_ROOT>/.ai/system/aic.py' doctor diagnose --json
python '<PROJECT_ROOT>/.ai/system/aic.py' state capacity --json
```

恢复结果必须包含项目身份、状态修订、活动任务、最近完成节点、失败方案、未知项、有效/失效证据、总结、阻断和唯一推荐动作及依据。不得用聊天记忆覆盖它。Doctor 要求只读、权威历史损坏、安装文件损坏或容量告警时，先处理报告，不得继续写入。

新任务优先用组合命令，它会建立会话、任务和任务锁：

```text
python '<PROJECT_ROOT>/.ai/system/aic.py' workflow begin --client '<CLIENT_NAME>' --title '<TITLE>' --goal '<GOAL>' --acceptance '<ACCEPTANCE_1>' --acceptance '<ACCEPTANCE_2>' --level STANDARD --json
```

`LIGHT/STANDARD/FULL` 只调整工作量和预算，不关闭安全、证据和完成门禁。

## 7. 写入、锁和并发规则

所有状态写入都必须同时满足：安装运行时完整、权威历史健康、活动且未过期的真实会话、最新状态/实体修订，以及当前会话持有覆盖目标的有效锁。伪造、结束或过期会话，无锁写入，相邻但不覆盖的锁，以及并发修订变化都必须零状态变化地拒绝。

底层锁范围为 `project:state`、`task:TASK-*`、`file:relative/file`、`path:relative/directory`。长任务显式执行 `session heartbeat` 和 `lock renew`；租约不会隐式续期或自动转移。孤儿内部互斥锁和过期范围锁只能通过 Doctor/受控恢复，在备份、原因和审计记录生成后处理。

这些锁只协调同一工作副本，不是跨计算机分布式强锁；多计算机协作仍需 Git 或外部协调。

## 8. 证据、研发节点总结和完成

证据必须逐项绑定任务的 `ACPT-*`，使用结构化参数数组，不能保存拼接 Shell 字符串。命令证据示例：

```text
python '<PROJECT_ROOT>/.ai/system/aic.py' evidence add --task-id '<TASK_ID>' --type TEST --result PASS --artifact '<PROJECT_RELATIVE_ARTIFACT>' --acceptance-id '<ACPT_ID>' --producer-kind COMMAND --command-arg '<PROGRAM>' --command-arg '<ARG>' --exit-code 0 --tool-name '<TOOL>' --tool-version '<VERSION>' --input '<PROJECT_RELATIVE_INPUT>' --working-directory '.' --result-basis '<BASIS>' --session-id '<SESSION_ID>' --expected-state-revision <REV> --json
```

每项证据记录输入、产物、哈希、工具、环境、退出码、结果依据和局限。任意输入/产物/环境漂移后，Doctor 必须把相关验收、任务和总结传播为失效或待复核。人工或导入证据必须使用对应 `producer-kind` 并明确依据，不能伪装自动测试。

重要节点执行：

```text
python '<PROJECT_ROOT>/.ai/system/aic.py' workflow checkpoint --session-id '<SESSION_ID>' --label '<NODE>' --json
```

任务进入 `VERIFYING` 且每条验收已有当前有效证据、无剩余项/阻断/活动下一步后，执行：

```text
python '<PROJECT_ROOT>/.ai/system/aic.py' workflow finish --task-id '<TASK_ID>' --session-id '<SESSION_ID>' --trigger '<TRIGGER>' --json
```

该命令生成并实时核验研发节点总结，再执行完成门禁。总结必须能说明已完成、未完成、失败方案、未知项、风险、恢复条件、证据依据和下一步理由。任意文本加 `PASS` 不能作为充分证据。

完成任务仍可用 `task list/show/search`、`evidence list/show`、`summary list/show`、`history timeline` 查询，不得要求 AI 直接遍历内部状态文件。

## 9. 项目识别与能力边界

```text
python '<PROJECT_ROOT>/.ai/system/aic.py' adapters list --json
python '<PROJECT_ROOT>/.ai/system/aic.py' project inspect --profile STANDARD --json
```

识别必须报告规则 ID、命中/反证、源码位置、覆盖率、可信度、未知项、子项目、权限/链接跳过、预算和停止原因。源码扫描与 MAP、ELF、HEX、BIN、日志等构建产物使用独立预算；未知工程降级为通用源码、产物和运行轨迹分析，禁止猜测芯片、RTOS、IDE、工具链或框架。

状态容量诊断当前覆盖实体、事件、已提交事务、会话、锁和总字节。告警只读，不会自动删除权威历史；归档前必须另行验证和保留可导入路径。

## 10. 健康诊断、恢复与会话结束

```text
python '<PROJECT_ROOT>/.ai/system/aic.py' state verify --json
python '<PROJECT_ROOT>/.ai/system/aic.py' doctor diagnose --json
```

派生快照可通过 Doctor 计划备份后重放；事件链、HEAD 或已提交事务损坏时强制只读，禁止自动重写权威历史。修复必须先 `doctor repair-plan`，审阅后才 `doctor apply --acknowledge`。

结束时执行：

```text
python '<PROJECT_ROOT>/.ai/system/aic.py' workflow close-session --session-id '<SESSION_ID>' --json
```

它释放当前会话锁、结束会话、校验状态并更新派生视图。最终回执必须给出当前修订、完成/剩余、证据、总结、失败方案、未知项、Git/环境漂移和下一步。

## 11. AI 自维护最终 ZIP

通用核心有缺陷时，由 AI 从受信任最终 ZIP 建立项目外空工作区：

```text
python '<PROJECT_ROOT>/.ai/system/aic.py' maintenance prepare --zip '<SOURCE_ZIP>' --workspace '<OUTSIDE_EMPTY_WORKSPACE>' --expected-sha256 '<SOURCE_SHA256>' --json
python '<PROJECT_ROOT>/.ai/system/aic.py' maintenance test --workspace '<WORKSPACE>' --json
python '<PROJECT_ROOT>/.ai/system/aic.py' maintenance repack --workspace '<WORKSPACE>' --output '<NEW_OUTSIDE_ZIP>' --test-report '<PASSED_REPORT>' --json
```

测试报告绑定工作区实例、源 ZIP 和全部打包源内容；测试后任何源码、测试或打包工具变化都会拒绝重打包。新包仍需确定性双打包、干净安装、旧版升级/迁移/回滚和真实工作流验收。不得在业务项目中留维护源码。

## 12. 明确边界

- 纯浏览器或不能运行本地 Python 的 AI 只能只读说明 `LOCAL_RUNTIME_UNAVAILABLE`，不得模拟状态写入成功；
- 本机锁不冒充跨计算机强锁；
- 持续后台监视由外部调度，本系统在会话与节点边界显式校准；
- 权威历史损坏不自动重写；
- Markdown/CSV 和派生视图不是第二权威状态中心；
- 7.1.0 已在 Windows 中文路径完成实测；平台无关 Python 接入用于 Linux/macOS，发布环境仍应在对应主机或 CI 再执行相同 ZIP 验收，不能把语法兼容宣称为未实际运行的平台实测。
