# 专业约束目录

AI 只先读取包根 `AGENTS.md`，再由路由器按任务加载下表。每域的 `CONSTRAINTS.md` 定义作业方法，`RULES.md` 给出带稳定 ID、触发、判定和失败动作的原子约束。禁止预读全部专业文件；只有 `ai_read_files` 进入 AI 上下文，`machine_rule_files` 仅供程序门禁。

| 专业域 | 作业约束与原子规则 | 典型触发 |
|---|---|---|
| 核心控制 | `core/CONSTRAINTS.md` + `core/RULES.md` | 所有任务 |
| 嵌入式软件 | `software/CONSTRAINTS.md` + `software/RULES.md` | C/C++、驱动、RTOS、协议、固件 |
| 原理图硬件 | `hardware/CONSTRAINTS.md` + `hardware/RULES.md` | 器件、电源、模拟、接口、ERC |
| PCB | `pcb/CONSTRAINTS.md` + `pcb/RULES.md` | 叠层、布局、布线、DRC、制造输出 |
| 软硬件协同 | `integration/CONSTRAINTS.md` + `integration/RULES.md` | Pinmux、接口、时序、功耗、版本 |
| 测试验证 | `verification/CONSTRAINTS.md` + `verification/RULES.md` | 单元、集成、HIL、故障注入、回归 |
| 制造交付 | `manufacturing/CONSTRAINTS.md` + `manufacturing/RULES.md` | BOM、DFM/DFT、产测、标定、追溯 |
| 安全发布 | `security_release/CONSTRAINTS.md` + `security_release/RULES.md` | 安全功能、升级、发布、现场维护 |
| 项目目录 | `directory/CONSTRAINTS.md` + `directory/RULES.md` | NEW、ORGANIZE、EXTEND、AUDIT |

项目专属事实不能写回这些通用文件；应存放在项目自己的约束或 Profile 中，并由来源、版本和 SHA-256 约束其作用域。
