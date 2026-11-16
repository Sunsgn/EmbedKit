# 当前项目具体约束索引

> 本文件不是通用建议清单，而是当前工程的项目级约束入口。首次进入工程时必须依据需求、当前源码、工程配置、原理图、协议、测试资料和用户指令更新；禁止复制示例项目的具体值。

## 完整性状态

| 项目 | 当前值 | 状态 | 最后核对 | 证据 |
|---|---|---|---|---|
| 约束版本 | 1 | VERIFIED | 约束包生成时 | 本文件 |
| 项目约束初始化 | 未完成 | UNKNOWN | 未调查 | `NEW_PROJECT_DISCOVERY.md` |
| 软件约束 | 未建立 | UNKNOWN | 未调查 | `project_constraints/software.md` |
| 硬件与 PCB 约束 | 未建立 | UNKNOWN | 未调查 | `project_constraints/hardware_pcb.md` |
| 验证与制造约束 | 未建立 | UNKNOWN | 未调查 | `project_constraints/verification_manufacturing.md` |
| 安全、发布与现场约束 | 未建立 | UNKNOWN | 未调查 | `project_constraints/security_release_field.md` |
| 系统、需求与生命周期约束 | 未建立 | UNKNOWN | 未调查 | `project_constraints/system_lifecycle.md` |

状态只能使用 `VERIFIED/USER_PROVIDED/INFERRED/UNKNOWN/CONFLICT/UNAVAILABLE`。`INFERRED` 不得用于引脚、地址、安全限值、危险输出、烧录、生产和正式发布。影响当前任务的 `UNKNOWN/CONFLICT` 必须写入任务状态并阻止依赖动作。

## 每个任务的加载规则

1. 始终先读取本文件，只按下表加载一个或多个项目约束文件，不得全文预读全部项目约束。
2. 再按 `.ai/constraints/INDEX.md` 加载匹配的通用专业规则。项目约束给出“本项目具体是什么”，通用规则给出“该专业必须怎么做”；两者同时生效。
3. 项目文件与当前工程证据冲突时不得静默覆盖。记录双方来源、版本、影响和待确认人，将状态改为 `CONFLICT`。
4. 项目约束不得降低根入口中的安全、证据和授权底线；批准例外必须写明批准人、范围、期限和补偿措施。

| 当前任务 | 必读项目约束 |
|---|---|
| 需求、范围、架构、模块边界、版本兼容 | `project_constraints/system_lifecycle.md` |
| C/C++、驱动、RTOS、ISR、协议、存储、构建 | `project_constraints/software.md` |
| 原理图、器件、接口、Pinmux、PCB、机械电气边界 | `project_constraints/hardware_pcb.md` |
| 单测、集成、设备测试、产测、校准、质量追溯 | `project_constraints/verification_manufacturing.md` |
| 身份、密钥、危险控制、升级、发布、现场维护 | `project_constraints/security_release_field.md` |
| BOM、替代料、认证、PCN/EOL、维修期限 | `project_constraints/system_lifecycle.md`，必要时增加安全/制造文件 |

## 项目约束写入门禁

- 项目约束必须达到实例/路径/命令/接口/单位/上限/失败动作的具体粒度；只复述通用领域要求视为未初始化。
- 每个具体值必须同时记录：值、状态、来源文件/位置或用户指令、适用硬件/软件版本、最后核对日期。
- 路径必须是当前项目可解析路径；外部绝对路径要说明主机和不可用时的降级方式。
- 命令必须记录工作目录、目标、配置、成功产物和失败判据；只写“运行构建”不合格。
- 接口必须记录所有者、方向、单位、电平/端序、上限、超时、并发和异常恢复；只写“使用 UART/I²C”不合格。
- 周期、超时、重试、栈、队列、缓冲、地址、阈值和安全限值必须有来源；没有来源保持 `UNKNOWN`。
- 从历史参考工程迁移的条款状态只能是 `INFERRED`，直至当前工程或用户确认；不得因为示例曾通过就标记本项目通过。

## 初始化完成条件

只有同时满足以下条件才可把“项目约束初始化”改为 `VERIFIED`：

- 当前任务涉及的具体约束表已经填写，且没有使用示例默认值。
- 正式构建目标、入口、产物和验证命令已从当前工程确认。
- 软件任务已确认执行模型、模块路径、资源所有权和失败恢复；硬件任务已确认版本和接口依据。
- 所有阻塞性未知项、冲突和需要用户确认的值均已显式列出。
- 更新内容经过一次与当前工程文件的交叉核对，并记录日期和证据位置。
