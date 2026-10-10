import { lazy } from 'react';
import { Activity, Binary, Braces, Bug, Bus, CircuitBoard, FileCode2, FileDigit, FileSearch, Files, Gauge, Hash, Map as MapIcon, Microchip, Network, Replace, Timer } from 'lucide-react';
import type { ToolDefinition } from './types';

const loadBasic = <K extends 'FloatConverter' | 'UartCalculator'>(name: K) => lazy(() => import('../features/toolbox/BasicTools').then(module => ({ default: module[name] })));
export const toolRegistry: ToolDefinition[] = [
  { apiVersion: 1, id: 'number', version: '1.0.0', title: '进制转换', description: '地址、寄存器和位掩码', detail: '支持任意长度整数及二、八、十、十六进制互转。', category: 'conversion', keywords: ['进制', '地址', '掩码'], requiresAgent: false, icon: Binary, component: lazy(() => import('./number/NumberTool')) },
  { apiVersion: 1, id: 'crc', version: '1.0.0', title: 'CRC 与字节序', description: '校验、HEX 与大小端', detail: 'CRC16-Modbus、CRC32、HEX 解析与大小端反转。', category: 'protocol', keywords: ['CRC', '校验', '字节序'], requiresAgent: false, icon: Hash, component: lazy(() => import('./crc/CrcTool')) },
  { apiVersion: 1, id: 'float', version: '1.0.0', title: 'IEEE 754 Float32', description: '浮点位模式与字节序', detail: '查看浮点数的位模式及大端、小端字节序。', category: 'conversion', keywords: ['浮点', 'IEEE754'], requiresAgent: false, icon: Replace, component: loadBasic('FloatConverter') },
  { apiVersion: 1, id: 'uart', version: '1.0.0', title: 'UART 传输时间', description: '帧格式、吞吐量和耗时', detail: '根据波特率与帧格式计算有效吞吐量和理论传输时间。', category: 'calculation', keywords: ['UART', '波特率', '耗时'], requiresAgent: false, icon: Gauge, component: loadBasic('UartCalculator') },
  { apiVersion: 1, id: 'can', version: '1.0.0', title: 'CAN 帧分析', description: 'ID、DLC、位数和总线时间', detail: '分析经典 CAN 标准帧和扩展帧，估算位填充后的最坏总线占用。', category: 'protocol', keywords: ['CAN', 'DLC', '总线'], requiresAgent: false, icon: CircuitBoard, component: lazy(() => import('./can/CanTool')) },
  { apiVersion: 1, id: 'timer', version: '1.0.0', title: '定时器 / PWM', description: 'PSC、ARR、CCR 与频率', detail: '根据定时器时钟和寄存器参数计算频率、周期、占空比与分辨率。', category: 'calculation', keywords: ['定时器', 'PWM', 'PSC', 'ARR'], requiresAgent: false, icon: Timer, component: lazy(() => import('./timer/TimerTool')) },
  { apiVersion: 1, id: 'adc', version: '1.0.0', title: 'ADC 与分压', description: '量化、电压和电阻分压', detail: '把 ADC 原始值换算为引脚电压、量程比例和分压前电压。', category: 'calculation', keywords: ['ADC', '分压', '电压'], requiresAgent: false, icon: Activity, component: lazy(() => import('./adc/AdcTool')) },
  { apiVersion: 1, id: 'ihex', version: '1.0.0', title: 'Intel HEX', description: '记录校验、地址与 BIN 导出', detail: '校验 Intel HEX 记录、解析扩展地址并生成空洞填充为 FF 的 BIN。', category: 'firmware', keywords: ['HEX', '固件', 'BIN'], requiresAgent: false, icon: FileCode2, component: lazy(() => import('./ihex/IntelHexTool')) },
  { apiVersion: 1, id: 'bin', version: '1.0.0', title: 'BIN 文件', description: '大小、CRC 和内容概览', detail: '在浏览器本地分析二进制文件的大小、CRC32、空白比例和头尾字节。', category: 'firmware', keywords: ['BIN', '固件', 'CRC'], requiresAgent: false, icon: Binary, component: lazy(() => import('./bin/BinaryTool')) },
  { apiVersion: 1, id: 'map', version: '1.0.0', title: 'MAP 快速分析', description: '内存、模块、风险和优化', detail: '复用通用 MAP 解析器，快速查看格式、覆盖率、Flash/RAM 和优化建议。', category: 'analysis', keywords: ['MAP', '内存', '优化'], requiresAgent: false, icon: MapIcon, component: lazy(() => import('./map/MapTool')) },
  { apiVersion: 1, id: 'modbus', version: '1.0.0', title: 'Modbus RTU / TCP', description: '请求生成、响应解析与校验', detail: '生成常用功能码请求，校验 RTU CRC 与 TCP MBAP，并解析正常和异常响应。', category: 'protocol', keywords: ['Modbus', 'RTU', 'TCP', '寄存器'], requiresAgent: false, icon: Network, component: lazy(() => import('./modbus/ModbusTool')) },
  { apiVersion: 1, id: 'frame', version: '1.0.0', title: '自定义协议帧', description: '字段模板、生成、解析与错误定位', detail: '配置帧头、命令、长度和校验规则，生成或解析自定义二进制协议帧。', category: 'protocol', keywords: ['协议帧', 'SUM8', 'XOR8', 'CRC'], requiresAgent: false, icon: Braces, component: lazy(() => import('./frame/FrameTool')) },
  { apiVersion: 1, id: 'hardfault', version: '1.0.0', title: 'Cortex-M HardFault', description: '堆栈、SCB 状态与故障证据', detail: '解析异常堆栈和 CFSR/HFSR，提取故障地址、原因证据与 ELF 定位输入。', category: 'analysis', keywords: ['HardFault', 'CFSR', 'HFSR', '堆栈'], requiresAgent: false, icon: Bug, component: lazy(() => import('./hardfault/HardFaultTool')) },
  { apiVersion: 1, id: 'srec', version: '1.0.0', title: 'Motorola SREC', description: '记录校验、地址与 BIN 导出', detail: '解析 S1/S2/S3 数据及计数、终止记录，校验并导出空洞填充为 FF 的 BIN。', category: 'firmware', keywords: ['SREC', 'S19', 'Motorola', '固件'], requiresAgent: false, icon: FileDigit, component: lazy(() => import('./srec/SrecTool')) },
  { apiVersion: 1, id: 'firmware', version: '1.0.0', title: '固件合并与比较', description: '基地址、重叠策略与差异区间', detail: '按基地址合并 BIN 分段，检查冲突并比较连续差异区间、大小与 CRC32。', category: 'firmware', keywords: ['固件', '合并', '比较', 'BIN'], requiresAgent: false, icon: Files, component: lazy(() => import('./firmware/FirmwareTool')) },
  { apiVersion: 1, id: 'svd', version: '1.0.0', title: 'CMSIS-SVD 寄存器', description: '外设、寄存器、字段与地址', detail: '本地解析 SVD，检索寄存器与字段，计算绝对地址和位掩码并导出结果。', category: 'analysis', keywords: ['SVD', 'CMSIS', '寄存器', '位域'], requiresAgent: false, icon: Microchip, component: lazy(() => import('./svd/SvdTool')) },
  { apiVersion: 1, id: 'dbc', version: '1.0.0', title: 'CAN DBC 解码', description: '消息、信号、位序与物理值', detail: '本地导入 DBC，检索消息和信号，按 Intel/Motorola 位序解码帧并导出结果。', category: 'protocol', keywords: ['CAN', 'DBC', '信号', 'Motorola'], requiresAgent: false, icon: Bus, component: lazy(() => import('./dbc/DbcTool')) },
  { apiVersion: 1, id: 'elf', version: '1.0.0', title: 'ELF / AXF 分析', description: '架构、段、节区、符号与 DWARF 能力', detail: '分析已有 ELF、AXF 或 OUT 构建产物，不重新编译；输出入口、内存布局、符号与源码定位能力证据。', category: 'analysis', keywords: ['ELF', 'AXF', 'DWARF', '符号', '地址'], requiresAgent: true, icon: FileSearch, component: lazy(() => import('./elf/ElfTool')) },
];

export function findTool(id: string | undefined) { return id ? toolRegistry.find(tool => tool.id === id) ?? null : null; }

export function validateToolRegistry(registry = toolRegistry) {
  const ids = new Set<string>(), errors: string[] = [];
  for (const tool of registry) {
    if (tool.apiVersion !== 1) errors.push(`${tool.id}: unsupported apiVersion ${tool.apiVersion}`);
    if (!tool.id.trim()) errors.push('Tool id must not be empty');
    else if (ids.has(tool.id)) errors.push(`${tool.id}: duplicate tool id`);
    ids.add(tool.id);
  }
  return errors;
}
