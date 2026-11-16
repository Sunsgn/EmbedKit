# 专业约束按需路由索引

## 路由原则

1. `core.md` 对所有任务强制生效。
2. 根据用户真实意图选择主领域，不只匹配单个关键词。
3. 根据将读取或修改的文件类型补充领域。
4. 根据软硬件、安全、制造和现场影响补充关联领域。
5. 只读取实际命中的文件；不得为了“保险”加载全部约束。
6. 无法确定任务领域或项目事实时，只执行调查和报告，不授权写入。

## 一级路由：任务对象

| 任务对象或意图 | 必读约束 | 推荐工作流 |
|---|---|---|
| 新项目、陌生工程、工程识别 | `core.md`、`system.md`、`directory.md` | `NEW_PROJECT_DISCOVERY.md` |
| C/C++、驱动、RTOS、ISR、DMA、存储、Bootloader | `core.md`、`software.md` | `SOFTWARE_CHANGE.md` 或 `DRIVER_DEVELOPMENT.md` |
| UART、I²C、SPI、CAN、TCP、UDP、WebSocket、协议 | `core.md`、`communication.md`、`software.md` | `PROTOCOL_CHANGE.md` 或 `DRIVER_DEVELOPMENT.md` |
| 编译、链接、Keil、IAR、ELF、MAP、BIN、HEX | `core.md`、`build_artifacts.md`、`software.md` | `SOFTWARE_CHANGE.md` |
| 首次上电、时钟、复位、调试口、HardFault | `core.md`、`bringup_debug.md`、`integration.md` | `BOARD_BRINGUP.md` |
| 原理图、器件、电源、模拟、数字接口、ERC | `core.md`、`hardware.md` | `SCHEMATIC_REVIEW.md` |
| PCB、布局、布线、DRC、Gerber、钻孔、PnP | `core.md`、`pcb.md` | `PCB_CHANGE.md` |
| Pinmux、电压域、传感换算、版本兼容 | `core.md`、`integration.md` | 匹配的软件、硬件或设备工作流 |
| 测试、回归、HIL、设备验证、故障注入 | `core.md`、`verification.md` | `DEVICE_TEST.md` |
| BOM、DFM、工装、烧录、校准、产测、追溯 | `core.md`、`manufacturing.md` | `DEVICE_TEST.md` 或 `PROJECT_DELIVERY.md` |
| 身份、密钥、危险控制、安全启动、正式发布 | `core.md`、`security_release.md` | 匹配任务工作流 |
| Embedded Linux、内核、DTS、驱动、rootfs | `core.md`、`embedded_linux.md` | `SOFTWARE_CHANGE.md` |
| 电池、电源域、睡眠、唤醒、续航和能耗 | `core.md`、`power_energy.md`、`software.md` | `DRIVER_DEVELOPMENT.md` 或 `DEVICE_TEST.md` |
| Bootloader、安全启动、A/B、OTA 和恢复 | `core.md`、`bootloader_ota.md`、`security_release.md` | `SOFTWARE_CHANGE.md`、`DEVICE_TEST.md` |
| BLE、Wi-Fi、蜂窝、Sub-GHz、GNSS、天线、RF | `core.md`、`rf_wireless.md`、`communication.md` | `DRIVER_DEVELOPMENT.md` 或 `DEVICE_TEST.md` |
| 电机、逆变器、功率级、PWM、执行器和控制环 | `core.md`、`motor_control_power.md`、`integration.md` | `DRIVER_DEVELOPMENT.md`、`DEVICE_TEST.md` |
| 传感器、测量链、误差预算、计量和校准 | `core.md`、`sensing_calibration.md`、`integration.md` | `DRIVER_DEVELOPMENT.md` 或 `DEVICE_TEST.md` |
| 安规、法规、区域准入、认证和符合性 | `core.md`、`compliance_certification.md` | `PROJECT_DELIVERY.md` |
| 现场安装、维护、诊断、远程服务和 RMA | `core.md`、`field_maintenance.md` | `DEFECT_FIX.md` 或 `PROJECT_DELIVERY.md` |
| 器件选型、替代料、PCN、EOL 和供应链 | `core.md`、`supply_chain_lifecycle.md` | `SCHEMATIC_REVIEW.md` 或 `PROJECT_DELIVERY.md` |
| EMC、ESD、温湿度、振动、寿命、长稳 | `core.md`、`reliability.md`、`verification.md` | `DEVICE_TEST.md` |
| 结构、外壳、公差、散热、装配、线束 | `core.md`、`mechanical_thermal.md` | 匹配评审或测试工作流 |
| 适配器、插件、解析器、扩展接口 | `core.md`、`extension.md`、`verification.md` | `SOFTWARE_CHANGE.md` |
| 目录整理、资料归档、迁移和交付 | `core.md`、`directory.md` | `PROJECT_DELIVERY.md` |
| 需求、架构、预算、风险、ECO/ECN | `core.md`、`system.md` | `NEW_PROJECT_DISCOVERY.md` 或 `PROJECT_DELIVERY.md` |
| 缺陷、异常、构建或设备失败 | `core.md` 加故障所属领域 | `DEFECT_FIX.md` |

## 原子详细规则簇路由

以下文件是对应专业领域的强制细化规则，只在任务命中时加载；不得只读取领域概述而跳过命中的详细规则。

| 具体任务对象 | 在领域约束之外追加读取 |
|---|---|
| 启动、时钟、GPIO、Pinmux、中断、DMA/Cache、UART/I²C/SPI/CAN、ADC/PWM、看门狗、低功耗 | `details/software_execution_io.md` |
| 模块分层、接口、RTOS/事件/裸机、并发、状态机、超时、内存、数值、NVM、日志、构建资源 | `details/software_architecture_resource.md` |
| 电源树、去耦、上掉电、反灌、晶体、复位、Boot、数字电平、板级总线、器件降额 | `details/hardware_power_digital.md` |
| 模拟链、ADC 前端、误差预算、运放/比较器、保护、隔离、接地、热、安全输出 | `details/hardware_analog_safety.md` |
| PCB 叠层、参考层、布局、线宽/间距/过孔、时钟、高速/差分、模拟布线 | `details/pcb_layout_signal.md` |
| PCB 大电流/去耦/开关电源、EMC、热、安规、DFM、制造输出和回读 | `details/pcb_power_emc_manufacturing.md` |

## 二级路由：目标文件

| 文件或对象 | 补充约束 |
|---|---|
| `*.c`、`*.h`、`*.cpp`、`*.hpp`、`*.s`、`*.asm` | `software.md` |
| `*.ld`、`*.icf`、`*.sct`、`*.map`、`*.elf`、`*.axf` | `build_artifacts.md` |
| `*.uvprojx`、`*.ewp`、`CMakeLists.txt`、`Makefile` | `build_artifacts.md`、`software.md` |
| `*.dts`、`*.dtsi`、`Kconfig`、内核驱动 | `embedded_linux.md` |
| `*.kicad_sch`、`*.SchDoc`、原理图 PDF | `hardware.md` |
| `*.kicad_pcb`、`*.PcbDoc`、Gerber、钻孔 | `pcb.md`；制造输出再加 `manufacturing.md` |
| BOM、PnP、工艺、校准或产测文件 | `manufacturing.md` |
| 协议、抓包、串口或网络日志 | `communication.md` |
| 固件、Bootloader、签名或升级包 | `build_artifacts.md`、`security_release.md` |
| 电池、功耗波形、睡眠/唤醒配置 | `power_energy.md` |
| 分区表、镜像头、升级包和回退记录 | `bootloader_ota.md` |
| 无线配置、天线、射频匹配或认证报告 | `rf_wireless.md` |
| 电机参数、PWM/ADC、控制器或台架数据 | `motor_control_power.md` |
| 传感器、误差预算、校准数据和证书 | `sensing_calibration.md` |
| 标准清单、认证报告、标签和符合性声明 | `compliance_certification.md` |
| 现场日志、工单、远程配置和 RMA | `field_maintenance.md` |
| BOM、替代料、PCN/EOL 和供应商文件 | `supply_chain_lifecycle.md` |
| STEP、机械图、热仿真或装配文件 | `mechanical_thermal.md` |
| 启动/BSP/Pinmux/IRQ/DMA/外设驱动源码 | `details/software_execution_io.md` |
| 任务/队列/状态机/内存/NVM/日志/构建源码 | `details/software_architecture_resource.md` |
| 电源/时钟/复位/数字接口原理图 | `details/hardware_power_digital.md` |
| 模拟/ADC/保护/隔离/危险输出原理图 | `details/hardware_analog_safety.md` |
| PCB 原生文件中的布局和信号规则 | `details/pcb_layout_signal.md` |
| PCB 电源/EMC/热/安规规则及制造输出 | `details/pcb_power_emc_manufacturing.md` |

## 三级路由：影响传播

- 修改 Pinmux、GPIO、复位、时钟或电源控制：增加 `integration.md` 和 `verification.md`；涉及原理图时增加 `hardware.md`。
- 修改 ADC、传感、校准或阈值：增加 `sensing_calibration.md`、`hardware.md`、`integration.md`、`verification.md`；涉及生产校准时增加 `manufacturing.md`。
- 修改协议字段、端序、状态或版本：增加 `communication.md`、`integration.md`、`verification.md`。
- 修改 NVM schema、配置或校准持久化：增加 `integration.md`、`verification.md`；影响生产数据时增加 `manufacturing.md`。
- 修改 Bootloader、OTA、镜像地址或认证：增加 `bootloader_ota.md`、`build_artifacts.md`、`security_release.md`、`verification.md`。
- 修改睡眠、时钟门控、电池或续航：增加 `power_energy.md`、`integration.md`、`verification.md`。
- 修改无线功率、频段、天线、匹配或射频结构：增加 `rf_wireless.md`、`hardware.md`、`pcb.md`、`mechanical_thermal.md`、`verification.md`。
- 修改电机、功率级、PWM、保护或高能执行器：增加 `motor_control_power.md`、`security_release.md`、`integration.md`、`verification.md`。
- 修改器件、替代料、BOM 或供应商：增加 `supply_chain_lifecycle.md`，并检查硬件、制造、可靠性和认证影响。
- 修改认证配置、关键件、标签或目标市场：增加 `compliance_certification.md` 和相关验证领域。
- 修改远程日志、服务命令、现场升级或维修流程：增加 `field_maintenance.md`、`security_release.md`、`verification.md`。
- 生成 Gerber、钻孔、BOM 或 PnP：增加 `manufacturing.md`。
- 修改危险执行器、保护、燃气、高压、加热或运动控制：增加 `security_release.md`、`integration.md`、`verification.md`，风险不足时禁止真实操作。
- 修改板框、孔、连接器、器件高度或散热：增加 `mechanical_thermal.md`，并检查 PCB/硬件双向影响。
- 修改生产、现场或发布配置：增加 `manufacturing.md`、`security_release.md` 和 `verification.md`。

## 深度和证据等级

- 只读解释、定位或审查：可使用轻量调查，但结论仍需源码/文件位置。
- 项目内代码或配置修改：必须有计划、diff、构建/检查和受影响测试。
- 硬件、PCB、设备或生产修改：必须有对应专业证据，模拟不能替代真实工具。
- 烧录、安全位、危险设备、生产和发布：除专业证据外还需要明确授权。

## Token 控制

- 首先用文件名、符号、章节标题或精确搜索定位，再读取必要范围。
- 软件约束较长时只读取与当前任务相关章节以及验收/失败门禁；不要重复读取已加载且未变化的部分。
- 路由命中超过四个专业领域时，先进行影响分析并按任务阶段分批加载，不得一次全文读取。
- 完整日志和证据保存到 `.ai/work/evidence/`，对话仅汇报摘要和路径。
- `details/` 规则簇按上述具体任务加载；单一任务通常只加载一个或两个，不得一次全文读取全部详细规则。
