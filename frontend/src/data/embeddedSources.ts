export type EmbeddedSourceCategory = '架构与规范' | '操作系统' | '构建与编译' | '调试与下载' | '厂商平台' | '学习路径';

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
}

export const embeddedSources: EmbeddedSource[] = [
  { id: 'arm-cmsis', title: 'Arm CMSIS 6', organization: 'Arm', category: '架构与规范', url: 'https://arm-software.github.io/CMSIS_6/latest/General/index.html', description: 'Cortex-M 软件接口、Core、Driver、RTOS2、DSP 与 NN 的官方文档入口。', scope: 'Arm Cortex-M 通用软件接口', language: '英文', official: true, verifiedAt: '2026-10-09', tags: ['Cortex-M', 'CMSIS', 'DSP', 'RTOS2'] },
  { id: 'freertos-docs', title: 'FreeRTOS Kernel 文档与手册', organization: 'FreeRTOS / AWS', category: '操作系统', url: 'https://www.freertos.org/Documentation/02-Kernel/07-Books-and-manual/01-RTOS_book', description: '内核概念、任务、队列、同步、内存和移植的官方资料。', scope: 'FreeRTOS Kernel，不代表其他 RTOS', language: '英文', official: true, verifiedAt: '2026-10-09', tags: ['RTOS', '任务', '队列', '同步'] },
  { id: 'zephyr-docs', title: 'Zephyr Project Documentation', organization: 'Linux Foundation', category: '操作系统', url: 'https://docs.zephyrproject.org/latest/', description: 'Zephyr 内核、设备树、驱动、构建、测试和支持板卡的官方文档。', scope: 'Zephyr RTOS 与 west/CMake 工程', language: '英文', official: true, verifiedAt: '2026-10-09', tags: ['Zephyr', '设备树', 'west', 'Twister'] },
  { id: 'cmake-docs', title: 'CMake Documentation', organization: 'Kitware', category: '构建与编译', url: 'https://cmake.org/cmake/help/latest/', description: 'CMake 命令、生成器、工具链文件、预设和跨平台构建的官方参考。', scope: '使用 CMake 的工程，不替代 Keil/IAR 工程配置', language: '英文', official: true, verifiedAt: '2026-10-09', tags: ['CMake', '交叉编译', 'Toolchain'] },
  { id: 'gcc-docs', title: 'GCC Online Documentation', organization: 'GNU Project', category: '构建与编译', url: 'https://gcc.gnu.org/onlinedocs/', description: '编译选项、优化、警告、扩展、链接与目标平台相关选项。', scope: 'GCC 系列工具链', language: '英文', official: true, verifiedAt: '2026-10-09', tags: ['GCC', '优化', '警告', '链接'] },
  { id: 'gdb-docs', title: 'Debugging with GDB', organization: 'GNU Project', category: '调试与下载', url: 'https://sourceware.org/gdb/current/onlinedocs/gdb.html/', description: '断点、观察点、远程调试、线程、脚本和命令行调试参考。', scope: 'GDB 及兼容远程调试目标', language: '英文', official: true, verifiedAt: '2026-10-09', tags: ['GDB', '断点', '远程调试'] },
  { id: 'openocd-docs', title: 'OpenOCD User’s Guide', organization: 'OpenOCD Project', category: '调试与下载', url: 'https://openocd.org/doc/html/index.html', description: '调试适配器、目标配置、Flash 下载、GDB 服务和脚本的官方指南。', scope: 'OpenOCD 支持的调试器与目标', language: '英文', official: true, verifiedAt: '2026-10-09', tags: ['OpenOCD', 'JTAG', 'SWD', 'Flash'] },
  { id: 'esp-idf-docs', title: 'ESP-IDF Programming Guide', organization: 'Espressif Systems', category: '厂商平台', url: 'https://docs.espressif.com/projects/esp-idf/en/latest/', description: 'ESP-IDF 框架、组件、构建、网络、安全和芯片差异的官方指南。', scope: 'Espressif ESP-IDF 平台示例，不作为通用 RTOS 结论', language: '多语言', official: true, verifiedAt: '2026-10-09', tags: ['ESP-IDF', '组件', 'Wi-Fi', '安全'] },
];

export const embeddedSourceCategories = [...new Set(embeddedSources.map(source => source.category))];
