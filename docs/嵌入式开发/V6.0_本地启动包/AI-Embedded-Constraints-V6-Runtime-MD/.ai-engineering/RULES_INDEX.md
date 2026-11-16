# 规则索引与任务路由

本文件只负责定位权威规则，不定义新的技术要求。

| 任务 | 必须加载的专业规范 | 必须项目事实 | 主工作流 |
|---|---|---|---|
| 固件、驱动、RTOS、协议、构建 | `disciplines/software/嵌入式软件工程规范.md` | `project/SOFTWARE_PROFILE.md` | `workflows/软件任务工作流.md` |
| 电路设计、器件、电源、原理图 | `disciplines/hardware/电子硬件工程总规范.md`、`disciplines/hardware/原理图审核规范.md` | `project/HARDWARE_PROFILE.md` | `workflows/原理图审核工作流.md` |
| PCB布局、布线、DFM输出 | `disciplines/hardware/电子硬件工程总规范.md`、`disciplines/hardware/PCB设计与审核规范.md` | `project/HARDWARE_PROFILE.md` | `workflows/PCB设计工作流.md` |
| 软件与硬件接口、板级联调 | `disciplines/integration/软硬件协同分析规范.md`，以及实际受影响专业 | 软件和硬件Profile | `workflows/软硬件协同分析工作流.md` |
| 测试、复现、整改、回归 | `disciplines/testing/真实测试与交付规范.md` | `project/TEST_PROFILE.md` | `workflows/测试与问题整改工作流.md` |
| 发布、生产资料、交接 | 测试规范及实际受影响专业 | 全局Profile | `workflows/发布交付工作流.md` |
| 系统需求、架构、预算、追溯 | `disciplines/system/系统工程与需求规范.md` | `project/SYSTEM_PROFILE.md` | `workflows/系统工程工作流.md` |
| 机械、热、环境与可靠性 | `disciplines/mechanical/机械热与可靠性规范.md` | `project/HARDWARE_PROFILE.md`、`TEST_PROFILE.md` | 选择实际验证工作流 |
| 生产、工装、校准与量产 | `disciplines/manufacturing/生产制造与校准规范.md` | `project/MANUFACTURING_PROFILE.md` | `workflows/生产交付工作流.md` |
| 安全、合规、发布批准 | `disciplines/security/安全合规与发布规范.md` | `project/SECURITY_PROFILE.md` | `workflows/安全合规工作流.md` |
| 供应链、EOL、现场维护、RMA | `disciplines/lifecycle/供应链与现场维护规范.md` | `project/SYSTEM_PROFILE.md`及受影响Profile | `workflows/发布交付工作流.md` |
| 新建、整理、迁移项目目录 | `project-framework/项目目录框架_V1.20.md`及裁剪规则 | `project/PROJECT_PROFILE.md` | 无 |

所有任务先读取`PROJECT_PROFILE.md`与`ENABLED_DISCIPLINES.md`；上表对应Profile不是可选项。涉及构建、EDA、设备、仪器、网络或外部服务时再强制读取`TOOL_CAPABILITIES.md`。跨专业任务只追加确实受影响的专业；一个主工作流可以追加必要的协同、测试、合规或交付工作流，并记录触发原因。
