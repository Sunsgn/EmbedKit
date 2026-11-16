# 当前项目事实与授权 Profile

> AI 第一次进入工程时按照 `.ai/workflows/NEW_PROJECT_DISCOVERY.md` 更新本文件。只记录由当前工程、用户或实测支持的事实；未知保持 `UNKNOWN`。每项必须注明状态、来源、版本或适用范围。

## 状态语义

- `VERIFIED`：当前工程或实测直接证明。
- `USER_PROVIDED`：用户明确给出，但仍需按风险决定是否交叉验证。
- `INFERRED`：由间接证据推断，不能用于高风险动作。
- `UNKNOWN`：尚未取得事实。
- `CONFLICT`：权威来源冲突，依赖动作必须阻塞。
- `UNAVAILABLE`：资料、工具或条件不可访问。

## 项目身份

| 事实 | 值 | 状态 | 来源/版本 | 适用范围 |
|---|---|---|---|---|
| 产品或项目 | UNKNOWN | UNKNOWN | 未调查 | 全项目 |
| 项目根 | UNKNOWN | UNKNOWN | 未调查 | 全项目 |
| 源码基线或提交 | UNKNOWN | UNKNOWN | 未调查 | 软件 |
| 板卡与硬件版本 | UNKNOWN | UNKNOWN | 未调查 | 目标设备 |
| 安全或法规等级 | UNKNOWN | UNKNOWN | 未调查 | 产品 |

## 软件平台与构建

| 事实 | 值 | 状态 | 来源/版本 | 适用范围 |
|---|---|---|---|---|
| MCU/SoC/处理器 | UNKNOWN | UNKNOWN | 未调查 | 目标 |
| SDK/BSP | UNKNOWN | UNKNOWN | 未调查 | 目标 |
| 裸机/事件/RTOS/Linux | UNKNOWN | UNKNOWN | 未调查 | 软件 |
| RTOS/内核及版本 | UNKNOWN | UNKNOWN | 未调查 | 软件 |
| 启动入口和链接脚本 | UNKNOWN | UNKNOWN | 未调查 | 软件 |
| IDE/编译器/链接器 | UNKNOWN | UNKNOWN | 未调查 | 构建 |
| 正式构建目标和命令 | UNKNOWN | UNKNOWN | 未调查 | 构建 |
| 预期 ELF/MAP/BIN/HEX | UNKNOWN | UNKNOWN | 未调查 | 产物 |
| 测试和静态检查入口 | UNKNOWN | UNKNOWN | 未调查 | 验证 |

## 板级与实时资源

| 事实 | 值 | 状态 | 来源/版本 | 适用范围 |
|---|---|---|---|---|
| 原理图/PCB/接口表 | UNKNOWN | UNKNOWN | 未调查 | 硬件 |
| 时钟、电源、复位、看门狗 | UNKNOWN | UNKNOWN | 未调查 | 板级 |
| GPIO/Pinmux/安全默认电平 | UNKNOWN | UNKNOWN | 未调查 | 板级 |
| UART/I²C/SPI/CAN 等所有者 | UNKNOWN | UNKNOWN | 未调查 | 接口 |
| DMA/中断/Cache/对齐 | UNKNOWN | UNKNOWN | 未调查 | 底层 |
| 任务、周期、截止期和栈 | UNKNOWN | UNKNOWN | 未调查 | 实时性 |
| 队列/缓冲容量和满策略 | UNKNOWN | UNKNOWN | 未调查 | 资源 |
| Flash/RAM/堆/栈预算 | UNKNOWN | UNKNOWN | 未调查 | 资源 |
| 电源模式、睡眠、唤醒和续航目标 | UNKNOWN | UNKNOWN | 未调查 | 功耗 |
| 电池/充电/低电量和棕断策略 | UNKNOWN | UNKNOWN | 未调查 | 能源 |

## 协议、存储与升级

| 事实 | 值 | 状态 | 来源/版本 | 适用范围 |
|---|---|---|---|---|
| 协议及权威版本 | UNKNOWN | UNKNOWN | 未调查 | 通信 |
| 帧上限、端序、单位、校验 | UNKNOWN | UNKNOWN | 未调查 | 通信 |
| NVM 分区、schema、掉电策略 | UNKNOWN | UNKNOWN | 未调查 | 存储 |
| Bootloader/OTA/镜像认证 | UNKNOWN | UNKNOWN | 未调查 | 升级 |
| 硬件/固件/配置兼容矩阵 | UNKNOWN | UNKNOWN | 未调查 | 集成 |
| RF/无线频段、区域、天线和功率 | UNKNOWN | UNKNOWN | 未调查 | 无线 |
| 电机/功率执行器及安全状态 | UNKNOWN | UNKNOWN | 未调查 | 控制 |
| 测量链、误差预算和校准追溯 | UNKNOWN | UNKNOWN | 未调查 | 计量 |
| 法规市场、标准和认证基线 | UNKNOWN | UNKNOWN | 未调查 | 合规 |
| 关键器件、替代料和生命周期 | UNKNOWN | UNKNOWN | 未调查 | 供应链 |
| 现场维护、日志和远程服务边界 | UNKNOWN | UNKNOWN | 未调查 | 服务 |

## 验证与授权

| 事实 | 值 | 状态 | 来源/版本 | 适用范围 |
|---|---|---|---|---|
| 测试设备和连接方式 | UNKNOWN | UNKNOWN | 未调查 | 设备测试 |
| 下载/烧录命令 | UNKNOWN | UNKNOWN | 未调查 | 设备 |
| 日志和证据目录 | `.ai/work/evidence/` | USER_PROVIDED | 本约束包 | AI 工作记录 |
| 已授权操作 | 项目内只读调查、局部编辑、非破坏性测试 | USER_PROVIDED | 根 AGENTS.md | 当前工程 |
| 需额外授权 | 删除、烧录、安全位、执行器、生产、推送、发布 | USER_PROVIDED | 根 AGENTS.md | 高风险动作 |

## 冲突、未知项与项目专有禁止项

- 当前冲突：NONE_RECORDED
- 阻塞性未知项：首次调查后填写
- 项目专有禁止项：UNKNOWN
- 批准例外或 waiver：NONE
