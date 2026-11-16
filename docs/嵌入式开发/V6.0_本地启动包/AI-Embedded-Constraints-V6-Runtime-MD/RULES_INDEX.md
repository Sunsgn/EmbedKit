# 规则索引与任务路由

本文件只负责定位权威规则，不定义新的技术要求。

| 任务 | 必须加载的专业规范 | 可选项目事实 | 工作流 |
|---|---|---|---|
| 固件、驱动、RTOS、协议、构建 | `disciplines/software/嵌入式软件工程规范.md` | `project/SOFTWARE_PROFILE.md` | `workflows/软件任务工作流.md` |
| 电路设计、器件、电源、原理图 | `disciplines/hardware/电子硬件工程总规范.md`、`原理图审核规范.md` | `project/HARDWARE_PROFILE.md` | `workflows/原理图审核工作流.md` |
| PCB布局、布线、DFM输出 | `disciplines/hardware/电子硬件工程总规范.md`、`PCB设计与审核规范.md` | `project/HARDWARE_PROFILE.md` | `workflows/PCB设计工作流.md` |
| 软件与硬件接口、板级联调 | `disciplines/integration/软硬件协同分析规范.md`，以及实际受影响专业 | 软件和硬件Profile | `workflows/软硬件协同分析工作流.md` |
| 测试、复现、整改、回归 | `disciplines/testing/真实测试与交付规范.md` | `project/TEST_PROFILE.md` | `workflows/测试与问题整改工作流.md` |
| 发布、生产资料、交接 | 测试规范及实际受影响专业 | 全局Profile | `workflows/发布交付工作流.md` |
| 新建、整理、迁移项目目录 | `project-framework/项目目录框架_V1.20.md`及裁剪规则 | `PROJECT_PROFILE.md` | 无 |

跨专业任务只追加确实受影响的专业。仅修改软件文档不自动加载硬件和测试规范；只有结论依赖真实测试时才加载测试规范。
