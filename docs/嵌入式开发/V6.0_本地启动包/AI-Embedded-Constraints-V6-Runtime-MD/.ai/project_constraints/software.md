# 当前项目软件工程具体约束

> 这是当前项目的可执行软件约束表，粒度参考真实项目约束文件，而不是通用软件规范。AI 首次调查及每次相关配置变化后必须增量填写。所有 `UNKNOWN` 都是待调查事实，不是允许自由选择的默认值。

## 1. 软件适用范围和排除范围

| 项目 | 当前项目具体值 | 状态 | 来源/位置 | 适用版本 |
|---|---|---|---|---|
| 正式软件根目录 | UNKNOWN | UNKNOWN | 未调查 | UNKNOWN |
| 应用层目录 | UNKNOWN | UNKNOWN | 未调查 | UNKNOWN |
| BSP/HAL/驱动目录 | UNKNOWN | UNKNOWN | 未调查 | UNKNOWN |
| 中间件/协议目录 | UNKNOWN | UNKNOWN | 未调查 | UNKNOWN |
| 启动/链接/板级配置目录 | UNKNOWN | UNKNOWN | 未调查 | UNKNOWN |
| 测试目录 | UNKNOWN | UNKNOWN | 未调查 | UNKNOWN |
| 只作参考、不进入构建的目录 | UNKNOWN | UNKNOWN | 未调查 | UNKNOWN |
| 默认禁止修改的生成/供应商目录 | UNKNOWN | UNKNOWN | 未调查 | UNKNOWN |

- 修改前必须把目标文件归入上述一个范围。无法确定文件是否进入正式目标时，只允许调查，不得将 sample、旧工程或测试桩当正式实现。
- 搜索顺序固定为：任务相关目录和符号 → 调用者/配置/测试 → 当前 SDK 文档 → 必要时参考工程。扩大范围时记录原因。

## 2. 权威资料和冲突优先级

| 主题 | 当前权威资料/路径 | 版本 | 状态 | 冲突时的处理 |
|---|---|---|---|---|
| 产品需求/功能规格 | UNKNOWN | UNKNOWN | UNKNOWN | 阻止功能语义判定 |
| MCU/SoC 数据手册与勘误 | UNKNOWN | UNKNOWN | UNKNOWN | 阻止寄存器/电气相关实现 |
| SDK/BSP/API 文档 | UNKNOWN | UNKNOWN | UNKNOWN | 以当前 SDK 源码交叉核对 |
| RTOS/执行框架资料 | UNKNOWN | UNKNOWN | UNKNOWN | 阻止 API 和上下文假设 |
| 通信协议 | UNKNOWN | UNKNOWN | UNKNOWN | 未确认字段不得实现 |
| 存储/升级格式 | UNKNOWN | UNKNOWN | UNKNOWN | 阻止格式写入或迁移 |
| 历史参考程序 | UNKNOWN | UNKNOWN | UNKNOWN | 只可参考，不直接进入构建 |

- 当前需求、当前工程配置与参考程序冲突时，必须保留冲突并请求确认；不得因为参考程序代码完整就覆盖当前需求。
- 查阅资料仍无法确认时，在任务记录中写明已查路径、检索词、结论和剩余问题。

## 3. 平台、工具链和执行模型

| 事实 | 当前项目具体值 | 状态 | 证据位置 | 约束 |
|---|---|---|---|---|
| MCU/SoC/核 | UNKNOWN | UNKNOWN | 未调查 | 不得按其他芯片写寄存器 |
| SDK/BSP 及版本 | UNKNOWN | UNKNOWN | 未调查 | API 以该版本为准 |
| 裸机/事件/RTOS/Linux | UNKNOWN | UNKNOWN | 未调查 | 未识别时禁止套用任务模型 |
| RTOS/内核版本 | UNKNOWN | UNKNOWN | 未调查 | UNKNOWN |
| 编译器/链接器及版本 | UNKNOWN | UNKNOWN | 未调查 | UNKNOWN |
| 语言标准与警告策略 | UNKNOWN | UNKNOWN | 未调查 | UNKNOWN |
| 启动入口 | UNKNOWN | UNKNOWN | 未调查 | UNKNOWN |
| 链接脚本/内存布局文件 | UNKNOWN | UNKNOWN | 未调查 | UNKNOWN |

## 4. 任务、事件、中断和实时预算

逐项登记正式目标中实际存在的任务、线程、主循环、事件消费者和 ISR；不能只记录“使用 RTOS”。

| 名称/入口 | 类型 | 职责 | 优先级/上下文 | 周期/截止期 | 栈/队列 | 阻塞点 | 失败/恢复 | 来源 |
|---|---|---|---|---|---|---|---|---|
| UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 未调查 |

- 新增任务前必须填写职责、优先级依据、栈来源、启动顺序、停止路径及对现有实时任务的影响。
- ISR 只允许最小状态处理和 ISR-safe 通知；项目已批准的例外必须逐项列出 API、最坏执行时间和批准依据。
- 周期和截止期没有来源时不得用常见的 1 ms、10 ms、100 ms 等经验值补齐。

## 5. 外设、总线和共享资源所有权

| 资源实例 | 物理用途 | 唯一所有者 | 调用接口 | 同步方式 | 超时 | 缓冲/队列上限 | 满/错策略 | 来源 |
|---|---|---|---|---|---|---|---|---|
| GPIO/Pinmux | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | N/A | N/A | UNKNOWN | 未调查 |
| UART | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 未调查 |
| I²C | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 未调查 |
| SPI | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 未调查 |
| CAN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 未调查 |
| ADC/DAC/PWM | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 未调查 |
| DMA/Cache | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 未调查 |
| Flash/NVM | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 未调查 |

- 必须像真实项目中“哪个 UART 给日志、哪个 UART 给业务模组”一样写到实例级；只写“UART 需互斥”不算完成。
- 多模块访问同一实例必须经过表中所有者，不得在应用层绕过统一驱动重新初始化。
- 超时、容量和策略未确认时，依赖它们的新收发或存储实现保持 `BLOCKED`。

## 6. 硬件接口和 Pinmux 软件映射

| 信号/功能 | MCU 管脚/复用 | 方向 | 有效电平/电压域 | 上电安全状态 | 驱动 API/配置文件 | 硬件依据 | 状态 |
|---|---|---|---|---|---|---|---|
| UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |

- GPIO、PWM、复位、使能和危险输出必须逐信号登记；没有原理图或接口表证据不得靠旧项目引脚继续实现。
- 初始化顺序必须保证上电安全状态；任何可能造成电机、阀、加热、高压或大电流动作的未知映射都阻止真实设备操作。

## 7. 协议和通信具体合同

| 协议/链路 | 权威版本 | 端点/实例 | 帧上限 | 端序/编码 | 超时 | 重试/退避 | 队列策略 | 兼容规则 | 来源 |
|---|---|---|---|---|---|---|---|---|---|
| UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 未调查 |

| 命令/字段 | 方向 | 长度/范围 | 单位/缩放 | 状态条件 | 错误响应 | 当前实现位置 | 测试依据 |
|---|---|---|---|---|---|---|---|
| UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |

- 实现前必须把本次涉及命令和字段填写到表中；禁止只凭抓包猜字段含义。
- 流式链路必须明确半包、粘包、噪声、超长、重复、乱序、迟到响应和重同步策略。
- 回调中是否允许等待、投递到哪个任务、响应关联键是什么，都必须写成当前项目事实。

## 8. 配置、NVM、校准和生产数据

| 数据区/记录 | 地址/分区 | schema 版本 | 长度/校验 | 写入者 | 更新频率上限 | 掉电一致性 | 默认/迁移/回滚 | 来源 |
|---|---|---|---|---|---|---|---|---|
| UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 未调查 |

- 地址、擦除粒度和保留区未从链接/分区/器件资料确认前，禁止写入。
- 开发默认值不得覆盖校准、身份、密钥和生产参数；未知旧版本不得按当前结构强制解释。

## 9. 启动、复位、看门狗和低功耗

| 阶段/机制 | 当前顺序或参数 | 依赖 | 失败动作 | 验证方法 | 来源/状态 |
|---|---|---|---|---|---|
| 电源/时钟/内存 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| 板级/外设初始化 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| 中间件/任务/业务 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| 看门狗周期和喂狗条件 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| 睡眠/唤醒 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| 重复复位降级 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |

- 固定延时只能来自器件或协议时序，不能用于掩盖初始化竞态。
- 看门狗喂狗点必须绑定关键周期完成条件，禁止无条件循环喂狗。

## 10. 构建、下载、运行和日志命令

| 动作 | 工作目录 | 精确命令/入口 | 目标/配置 | 成功产物或现象 | 失败判据 | 授权 | 状态/来源 |
|---|---|---|---|---|---|---|---|
| 正式构建 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 项目内构建 | UNKNOWN |
| 定向单测/静态检查 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 非破坏性 | UNKNOWN |
| 下载/烧录 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 需明确授权 | UNKNOWN |
| 启动监控 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 依设备边界 | UNKNOWN |
| 日志采集 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 非破坏性 | UNKNOWN |

| 产物 | 预期路径 | 格式 | 当前身份校验 | 资源预算 | 状态 |
|---|---|---|---|---|---|
| ELF/MAP/BIN/HEX | UNKNOWN | UNKNOWN | 时间、目标、哈希均待确认 | UNKNOWN | UNKNOWN |

- 必须达到 BS20 示例中“命令、工作目录、产物、设备现象、报告目录都明确”的粒度；不得只写工具名称。
- 构建退出零但产物缺失、目标错误、时间或哈希无法绑定当前源码，仍判 FAIL。
- 烧录命令即使已知也不等于已授权执行。

## 11. 资源预算和配置差异

| 配置 | Flash/ROM 上限 | RAM 上限 | 堆 | 任务栈规则 | 日志级别 | 调试/发布差异 | 来源 |
|---|---|---|---|---|---|---|---|
| Debug | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 未调查 |
| Release | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 未调查 |

- 新增缓冲、任务或模块必须给出增量；没有当前 MAP/ELF 时只能报告 `NOT_RUN`，不能称资源满足。

## 12. 错误处理、降级和不可接受的修复

| 故障 | 检测方式 | 错误码/状态 | 局部恢复 | 重试上限 | 最终降级 | 必须保留的功能 | 来源 |
|---|---|---|---|---|---|---|---|
| UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 未调查 |

禁止用以下方式把问题伪装成修复：无限延长超时、无限重试、关闭原有功能、跳过校验、忽略返回值、无条件整机复位、扩大缓冲隐藏越界、换一套未授权工具链或删除失败测试。

## 13. 软件验收和记录位置

| 内容 | 当前项目具体位置/要求 | 状态 | 来源 |
|---|---|---|---|
| 开发记录目录 | UNKNOWN | UNKNOWN | 未调查 |
| 构建日志目录 | UNKNOWN | UNKNOWN | 未调查 |
| 设备原始日志目录 | UNKNOWN | UNKNOWN | 未调查 |
| 异常分析目录 | UNKNOWN | UNKNOWN | 未调查 |
| 测试报告目录 | UNKNOWN | UNKNOWN | 未调查 |
| Git 提交规则 | UNKNOWN | UNKNOWN | 未调查 |

软件修改只有在当前 diff、正式目标构建、受影响测试、失败路径、当前产物身份和适用设备证据均可追溯时才可 PASS。无硬件或授权时只能把对应层标记 `NOT_RUN/BLOCKED`。

## 14. 未决项和批准例外

| ID | UNKNOWN/CONFLICT/例外 | 影响动作 | 所需确认或证据 | 责任人 | 截止/状态 |
|---|---|---|---|---|---|
| SW-PROJ-001 | 项目软件约束尚未初始化 | 依赖具体参数的修改和设备验证 | 完成首次工程识别 | UNKNOWN | OPEN |
