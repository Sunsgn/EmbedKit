# 当前项目硬件与 PCB 具体约束

> 本文件必须记录当前板卡的确定值、来源和版本。通用“遵守 ERC/DRC”“注意电源完整性”不是项目约束；必须落到网络、器件、限值、规则类、测试点和交付输出。

## 1. 设计对象与权威基线

| 项目 | 当前具体值 | 状态 | 来源/版本 | 适用范围 |
|---|---|---|---|---|
| 产品/板卡名称 | UNKNOWN | UNKNOWN | 未调查 | UNKNOWN |
| 硬件版本/变体 | UNKNOWN | UNKNOWN | 未调查 | UNKNOWN |
| 原理图原生工程 | UNKNOWN | UNKNOWN | 未调查 | UNKNOWN |
| PCB 原生工程 | UNKNOWN | UNKNOWN | 未调查 | UNKNOWN |
| EDA/库版本 | UNKNOWN | UNKNOWN | 未调查 | UNKNOWN |
| BOM/器件参数权威源 | UNKNOWN | UNKNOWN | 未调查 | UNKNOWN |
| 板框/结构/连接器权威源 | UNKNOWN | UNKNOWN | 未调查 | UNKNOWN |
| 参考设计及适用边界 | UNKNOWN | UNKNOWN | 未调查 | UNKNOWN |
| 不进入本次结论的历史文件 | UNKNOWN | UNKNOWN | 未调查 | UNKNOWN |

- PDF、Gerber 或截图不能在存在原生工程时替代原生设计事实；历史导出只能证明历史版本。
- 库、封装、板框、BOM 或原理图版本不一致时标记 `CONFLICT`，禁止继续生成制造输出。

## 2. 电源树、时钟、复位与启动条件

| 网络/器件 | 标称/允许范围 | 峰值/预算 | 时序/稳定条件 | 保护/故障状态 | 测试点 | 依据 |
|---|---|---|---|---|---|---|
| 输入电源 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 未调查 |
| 主电源轨 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 未调查 |
| 模拟/射频/执行器电源 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 未调查 |
| 时钟源 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 未调查 |
| 复位/启动脚 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 未调查 |

- 每条电源轨必须核对源、负载、容差、纹波、浪涌、反灌、去耦、上电/掉电顺序和故障行为。
- 电压、电流、温度、延时或容差没有器件资料/需求依据时不得填经验值。

## 3. 软硬件接口矩阵

| 信号 | 器件引脚 ↔ MCU 引脚 | 复用/方向 | 电平域/阈值 | 上下拉/终端 | 上电安全态 | 速率/时序 | 软件配置位置 | 来源/状态 |
|---|---|---|---|---|---|---|---|---|
| UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 未调查 |

- 所有 UART/I²C/SPI/CAN/USB/Ethernet/ADC/PWM/中断/复位/使能必须逐信号登记。
- 软件 Pinmux、原理图网络名、封装焊盘和 PCB 网络必须四方一致；任一冲突时停止相关驱动和制板放行。
- 开漏、差分、模拟、高速和跨电压域接口必须记录外部器件与方向控制，不得只核对引脚号。

## 4. 关键器件和替代料约束

| 位号/功能 | 正式 MPN | 封装/等级 | 关键参数 | 可替代料 | 不可替代条件 | 数据手册/PCN | 状态 |
|---|---|---|---|---|---|---|---|
| UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |

- “兼容”必须逐项核对引脚、绝对最大值、工作范围、时序、精度、认证、寿命和封装，不能只看功能名称。
- 关键料变更必须传播到软件 ID/时序、校准、制造、可靠性和认证影响分析。

## 5. 原理图检查和项目级豁免

| 检查项/ERC ID | 期望规则 | 当前结果 | 豁免理由 | 补偿验证 | 批准人/期限 | 证据 |
|---|---|---|---|---|---|---|
| UNKNOWN | UNKNOWN | NOT_RUN | NONE | UNKNOWN | UNKNOWN | 未执行 |

必须检查未连接/悬空输入、电源脚、退耦、复位/启动、调试口、晶振、总线终端、电平转换、保护、模拟参考和测试点。ERC 退出零但原理图/库版本不匹配不得 PASS。

## 6. PCB 叠层、规则类和布局边界

| 规则对象 | 当前项目具体值 | 容差/单位 | 适用网络/区域 | 来源 | EDA 设置位置 | 状态 |
|---|---|---|---|---|---|---|
| 板框/厚度/层数 | UNKNOWN | UNKNOWN | 全板 | UNKNOWN | UNKNOWN | UNKNOWN |
| 铜厚/介质/材料 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| 最小线宽/间距/孔 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| 阻抗类 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| 高压/安规间距 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| 差分/长度匹配 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| 大电流/热设计 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| 禁布/器件高度/安装孔 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |

- 制造商通用能力不能自动成为本板规则；必须绑定目标工厂、铜厚、层叠和产品标准。
- 高速、RF、开关电源、晶振、模拟测量和高电流区域逐类给出布局/回流/隔离边界及检查证据。

## 7. PCB 网络和关键走线合同

| 网络类/总线 | 拓扑 | 参考层/回流 | 宽度/间距 | 过孔限制 | 长度/匹配 | 端接/测试点 | 来源 |
|---|---|---|---|---|---|---|---|
| UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 未调查 |

- 不得用自动布线完成或“看起来合理”代替关键网络复核。
- 修改连接器、安装孔、板框、器件高度或散热器时，必须交叉检查结构文件和装配可达性。

## 8. EDA 检查、制造输出和回读

| 动作 | EDA/工具版本 | 精确入口/命令 | 输入基线 | 预期报告/输出 | PASS 条件 | 当前状态 |
|---|---|---|---|---|---|---|
| ERC | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 无未处置错误 | NOT_RUN |
| DRC | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 无未处置错误/未布线 | NOT_RUN |
| Gerber/ODB++ | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 与原生设计一致 | NOT_RUN |
| NC Drill | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 单位/零点/镀孔正确 | NOT_RUN |
| BOM/PnP | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 位号/坐标/面/旋转正确 | NOT_RUN |
| 独立回读 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 层、板框、孔和关键网络一致 | NOT_RUN |

没有真实 EDA 时可做文本/适配层检查，但必须标记 `REAL_EDA_NOT_RUN`；禁止把解析器或模拟 DRC 当真实 EDA PASS。

## 9. 板级验证和安全边界

| 验证对象 | 测点/连接 | 仪器/量程 | 激励/负载 | 期望范围 | 断电/停止条件 | 证据位置 | 状态 |
|---|---|---|---|---|---|---|---|
| UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | NOT_RUN |

- 首次上电必须从限流、分轨和静态检查开始；未知高压、燃气、热源、电机或大电流设备不得由 AI 自动操作。
- PASS 必须绑定板卡版本、BOM 变体、固件哈希、仪器和原始波形/读数。

## 10. 未决项和批准例外

| ID | 未知/冲突/豁免 | 影响 | 所需证据 | 责任人 | 状态 |
|---|---|---|---|---|---|
| HW-PROJ-001 | 项目硬件与 PCB 约束尚未初始化 | 硬件修改、Pinmux 和制造输出 | 完成原生工程调查 | UNKNOWN | OPEN |
