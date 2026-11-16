# 项目 Profile 初始化模板

## 强制记录合同

- 触发条件：首次进入工程或项目、板卡、工具链、执行模型、协议、构建目标发生变化。
- 必须执行：按当前工程证据填写值、状态、来源、版本和适用范围，并保存冲突与未知项。
- 禁止：复制示例项目参数、按文件名猜平台、用 AI 经验补齐引脚/地址/阈值/命令，或把 INFERRED 写成 VERIFIED。
- 有效条件：每个非 UNKNOWN 值均有可复核来源，阻塞性未知项和冲突没有隐藏。
- 失败处理：资料不足时保持 UNKNOWN/CONFLICT/UNAVAILABLE，只允许无依赖调查。

复制或合并到 `.ai/PROJECT_PROFILE.md` 后，按照 `NEW_PROJECT_DISCOVERY.md` 填写。每项使用 `VERIFIED/USER_PROVIDED/INFERRED/UNKNOWN/CONFLICT/UNAVAILABLE` 状态，并记录来源、版本和适用范围。不得将模板中的示例、其他工程参数或 AI 经验写成项目事实。

必须覆盖：

- 项目、产品、板卡、BOM 和安全等级。
- MCU/SoC、SDK/BSP、执行模型、RTOS/内核。
- 启动入口、链接脚本、工具链、目标、构建和测试命令。
- 原理图、PCB、Pinmux、时钟、电源、复位和外设所有者。
- 任务、周期、截止期、栈、缓冲、超时和资源预算。
- 协议、NVM、Bootloader、OTA 和兼容矩阵。
- 测试设备、下载方式、日志、工具能力和授权边界。
- 冲突、阻塞性未知项、项目禁止项和批准例外。
