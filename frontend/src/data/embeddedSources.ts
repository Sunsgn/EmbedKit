export type EmbeddedSourceCategory = '架构与规范' | '操作系统' | '构建与编译' | '调试与下载' | '厂商平台' | '学习路径';
export type EmbeddedLearningStage = '基础' | '平台通用' | '工程实践' | '调试测试' | '专精方向';

export interface EmbeddedSource {
  id: string;
  title: string;
  organization: string;
  category: EmbeddedSourceCategory;
  url: string;
  description: string;
  scope: string;
  language: '中文' | '英文' | '多语言';
  official: boolean;
  verifiedAt: string;
  tags: string[];
  learningStages: EmbeddedLearningStage[];
}

export const embeddedSources: EmbeddedSource[] = [
  { id: 'arm-cmsis', title: 'Arm CMSIS 6', organization: 'Arm', category: '架构与规范', url: 'https://arm-software.github.io/CMSIS_6/latest/General/index.html', description: 'Cortex-M 软件接口、Core、Driver、RTOS2、DSP 与 NN 的官方文档入口。', scope: 'Arm Cortex-M 通用软件接口', language: '英文', official: true, verifiedAt: '2026-10-09', tags: ['Cortex-M', 'CMSIS', 'DSP', 'RTOS2'], learningStages: ['平台通用', '工程实践'] },
  { id: 'freertos-docs', title: 'FreeRTOS Kernel 文档与手册', organization: 'FreeRTOS / AWS', category: '操作系统', url: 'https://www.freertos.org/Documentation/02-Kernel/07-Books-and-manual/01-RTOS_book', description: '内核概念、任务、队列、同步、内存和移植的官方资料。', scope: 'FreeRTOS Kernel，不代表其他 RTOS', language: '英文', official: true, verifiedAt: '2026-10-09', tags: ['RTOS', '任务', '队列', '同步'], learningStages: ['平台通用', '工程实践'] },
  { id: 'zephyr-docs', title: 'Zephyr Project Documentation', organization: 'Linux Foundation', category: '操作系统', url: 'https://docs.zephyrproject.org/latest/', description: 'Zephyr 内核、设备树、驱动、构建、测试和支持板卡的官方文档。', scope: 'Zephyr RTOS 与 west/CMake 工程', language: '英文', official: true, verifiedAt: '2026-10-09', tags: ['Zephyr', '设备树', 'west', 'Twister'], learningStages: ['平台通用', '工程实践', '调试测试'] },
  { id: 'cmake-docs', title: 'CMake Documentation', organization: 'Kitware', category: '构建与编译', url: 'https://cmake.org/cmake/help/latest/', description: 'CMake 命令、生成器、工具链文件、预设和跨平台构建的官方参考。', scope: '使用 CMake 的工程，不替代 Keil/IAR 工程配置', language: '英文', official: true, verifiedAt: '2026-10-09', tags: ['CMake', '交叉编译', 'Toolchain'], learningStages: ['工程实践'] },
  { id: 'gcc-docs', title: 'GCC Online Documentation', organization: 'GNU Project', category: '构建与编译', url: 'https://gcc.gnu.org/onlinedocs/', description: '编译选项、优化、警告、扩展、链接与目标平台相关选项。', scope: 'GCC 系列工具链', language: '英文', official: true, verifiedAt: '2026-10-09', tags: ['GCC', '优化', '警告', '链接'], learningStages: ['工程实践', '调试测试'] },
  { id: 'gdb-docs', title: 'Debugging with GDB', organization: 'GNU Project', category: '调试与下载', url: 'https://sourceware.org/gdb/current/onlinedocs/gdb.html/', description: '断点、观察点、远程调试、线程、脚本和命令行调试参考。', scope: 'GDB 及兼容远程调试目标', language: '英文', official: true, verifiedAt: '2026-10-09', tags: ['GDB', '断点', '远程调试'], learningStages: ['调试测试'] },
  { id: 'openocd-docs', title: 'OpenOCD User’s Guide', organization: 'OpenOCD Project', category: '调试与下载', url: 'https://openocd.org/doc/html/index.html', description: '调试适配器、目标配置、Flash 下载、GDB 服务和脚本的官方指南。', scope: 'OpenOCD 支持的调试器与目标', language: '英文', official: true, verifiedAt: '2026-10-09', tags: ['OpenOCD', 'JTAG', 'SWD', 'Flash'], learningStages: ['调试测试'] },
  { id: 'esp-idf-docs', title: 'ESP-IDF Programming Guide', organization: 'Espressif Systems', category: '厂商平台', url: 'https://docs.espressif.com/projects/esp-idf/en/latest/', description: 'ESP-IDF 框架、组件、构建、网络、安全和芯片差异的官方指南。', scope: 'Espressif ESP-IDF 平台示例，不作为通用 RTOS 结论', language: '多语言', official: true, verifiedAt: '2026-10-09', tags: ['ESP-IDF', '组件', 'Wi-Fi', '安全'], learningStages: ['专精方向'] },
  { id: 'arduino-learn', title: 'Arduino Learn', organization: 'Arduino', category: '学习路径', url: 'https://docs.arduino.cc/learn/', description: '电子基础、微控制器、通信、传感器和协作式 setup/loop 编程的官方学习入口。', scope: 'Arduino 生态入门，通用原理需与 MCU 手册交叉验证', language: '英文', official: true, verifiedAt: '2026-10-10', tags: ['Arduino', '电子基础', '传感器'], learningStages: ['基础'] },
  { id: 'linux-kernel-docs', title: 'Linux Kernel Documentation', organization: 'Linux Kernel Community', category: '操作系统', url: 'https://docs.kernel.org/', description: '内核核心 API、驱动模型、设备树、调试、安全和开发流程的项目文档。', scope: '嵌入式 Linux/MPU，不适用于裸机 MCU', language: '英文', official: true, verifiedAt: '2026-10-10', tags: ['Linux', '驱动', '设备树', '内核'], learningStages: ['专精方向'] },
  { id: 'rt-thread-docs', title: 'RT-Thread 文档中心', organization: 'RT-Thread', category: '操作系统', url: 'https://www.rt-thread.io/document/site/', description: 'RT-Thread 内核、设备框架、组件、BSP 和工具的官方文档。', scope: 'RT-Thread 及其设备模型，不代表所有 RTOS', language: '中文', official: true, verifiedAt: '2026-10-10', tags: ['RT-Thread', 'RTOS', '设备框架'], learningStages: ['平台通用', '工程实践'] },
  { id: 'threadx-repository', title: 'Eclipse ThreadX', organization: 'Eclipse Foundation', category: '操作系统', url: 'https://github.com/eclipse-threadx/threadx', description: 'ThreadX 内核源码、移植、文档与示例的项目仓库。', scope: 'Eclipse ThreadX 实时操作系统', language: '英文', official: true, verifiedAt: '2026-10-10', tags: ['ThreadX', 'RTOS', '移植'], learningStages: ['平台通用', '工程实践'] },
  { id: 'rust-embedded-book', title: 'The Embedded Rust Book', organization: 'Rust Embedded Working Group', category: '学习路径', url: 'https://docs.rust-embedded.org/book/', description: '从开发环境、裸机程序到外设与调试的 Embedded Rust 项目学习资料。', scope: 'Rust 嵌入式方向，不替代 C/C++ 工具链资料', language: '英文', official: true, verifiedAt: '2026-10-10', tags: ['Rust', '裸机', 'Cortex-M'], learningStages: ['基础', '专精方向'] },
  { id: 'iar-docs', title: 'IAR Documentation', organization: 'IAR Systems', category: '构建与编译', url: 'https://docs.iar.com/', description: 'IAR 编译器、链接器、调试器和 IDE 的官方文档入口。', scope: 'IAR Embedded Workbench 工具链', language: '英文', official: true, verifiedAt: '2026-10-10', tags: ['IAR', 'ILINK', 'C-SPY', 'MAP'], learningStages: ['工程实践', '调试测试'] },
];

export const embeddedSourceCategories = [...new Set(embeddedSources.map(source => source.category))];
export const embeddedLearningStages = [...new Set(embeddedSources.flatMap(source => source.learningStages))];
