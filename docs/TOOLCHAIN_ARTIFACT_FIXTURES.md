# 真实工具链产物回归策略

EmbedKit 的产物解析不能只依赖手工拼装的二进制夹具，也不能提交用户固件。仓库采用“公开最小源码 + 测试时临时生成”的策略验证真实工具链输出。

## GNU 回归链

`proxy/toolchain-artifact.test.js` 使用无第三方依赖的最小 C 源码，并在系统临时目录执行：

1. GCC 编译并由 GNU ld 生成 MAP；
2. objcopy 生成 BIN 与 Intel HEX；
3. 生成或转换为 ELF 后交给 EmbedKit 的有界 ELF 解析器；
4. MAP 交给通用 MAP 分析器；
5. 验证真实 `main` 符号、GNU MAP 识别、分析覆盖证据、非空 BIN 和 Intel HEX EOF；
6. 无论成功或失败都删除临时目录。

Linux CI 直接分析 GCC 生成的 ELF。Windows MinGW 默认生成 PE，因此测试使用同一套 GNU objcopy 转换为 `elf64-x86-64` 后验证 ELF 结构；这只能证明 GNU/BFD 产物兼容性，不能替代 Arm、RISC-V 或具体 MCU 工具链验收。仓库已有独立的 Arm、AArch64、RISC-V、大小端和 DWARF 有界合成回归，两类证据不能互相冒充。

可通过环境变量选择工具：

```text
CC=<gcc-compatible-compiler>
OBJCOPY=<gnu-compatible-objcopy>
```

缺少工具时用例会明确跳过，不下载编译器、不访问网络。GitHub Pages 工作流的 Ubuntu 环境提供 GCC/binutils，因此正式 CI 会执行真实产物链。

## Keil 与 IAR 边界

Keil/Arm Compiler 和 IAR 工具链、运行库及示例产物可能受许可证和再分发条款约束，仓库不自动下载、不提交来源不明的 AXF/OUT/MAP，也不把 GNU 转换产物标记为 Keil 或 IAR 产物。

当前自动回归覆盖两者的工程识别、诊断格式和公开文本 MAP 结构规则。真实产物验收采用用户本机显式选择的方式：文件只在 Local Agent 内处理，报告记录工具链版本、文件元数据、SHA-256、解析覆盖率与降级警告，不上传文件。将来只有在样本许可证明确允许、体积受控且来源可审计时，才把对应样本加入公开仓库。
