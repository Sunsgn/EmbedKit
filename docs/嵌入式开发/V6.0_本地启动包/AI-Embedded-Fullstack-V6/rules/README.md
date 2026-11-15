# 专业约束目录

AI 只先读取包根 `AGENTS.md`，再由路由器按任务加载下表。禁止预读全部专业文件。路由结果中的 `ai_read_files` 才进入 AI 上下文；`machine_rule_files` 仅供程序门禁使用。

| 专业域 | 具体约束 | 典型触发 |
|---|---|---|
| 核心控制 | `core/CONSTRAINTS.md` | 所有任务 |
| 嵌入式软件 | `software/CONSTRAINTS.md` | C/C++、驱动、RTOS、协议、固件 |
| 原理图硬件 | `hardware/CONSTRAINTS.md` | 器件、电源、模拟、接口、ERC |
| PCB | `pcb/CONSTRAINTS.md` | 叠层、布局、布线、DRC、制造输出 |
| 软硬件协同 | `integration/CONSTRAINTS.md` | Pinmux、接口、时序、功耗、版本 |
| 测试验证 | `verification/CONSTRAINTS.md` | 单元、集成、HIL、故障注入、回归 |
| 制造交付 | `manufacturing/CONSTRAINTS.md` | BOM、DFM/DFT、产测、标定、追溯 |
| 安全发布 | `security_release/CONSTRAINTS.md` | 安全功能、升级、发布、现场维护 |
| 项目目录 | `directory/CONSTRAINTS.md` | NEW、ORGANIZE、EXTEND、AUDIT |

项目专属事实不能写回这些通用文件；应存放在项目自己的约束或 Profile 中，并由来源、版本和 SHA-256 约束其作用域。
