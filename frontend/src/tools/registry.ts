import { lazy } from 'react';
import { Activity, Binary, CircuitBoard, FileCode2, Gauge, Hash, Map as MapIcon, Replace, Timer } from 'lucide-react';
import type { ToolDefinition } from './types';

const loadBasic = <K extends 'FloatConverter' | 'UartCalculator'>(name: K) => lazy(() => import('../features/toolbox/BasicTools').then(module => ({ default: module[name] })));
const loadAdvanced = <K extends 'IntelHexTool' | 'BinaryTool' | 'MapQuickTool'>(name: K) => lazy(() => import('../features/toolbox/AdvancedTools').then(module => ({ default: module[name] })));

export const toolRegistry: ToolDefinition[] = [
  { apiVersion: 1, id: 'number', version: '1.0.0', title: '进制转换', description: '地址、寄存器和位掩码', detail: '支持任意长度整数及二、八、十、十六进制互转。', category: 'conversion', keywords: ['进制', '地址', '掩码'], requiresAgent: false, icon: Binary, component: lazy(() => import('./number/NumberTool')) },
  { apiVersion: 1, id: 'crc', version: '1.0.0', title: 'CRC 与字节序', description: '校验、HEX 与大小端', detail: 'CRC16-Modbus、CRC32、HEX 解析与大小端反转。', category: 'protocol', keywords: ['CRC', '校验', '字节序'], requiresAgent: false, icon: Hash, component: lazy(() => import('./crc/CrcTool')) },
  { apiVersion: 1, id: 'float', version: '1.0.0', title: 'IEEE 754 Float32', description: '浮点位模式与字节序', detail: '查看浮点数的位模式及大端、小端字节序。', category: 'conversion', keywords: ['浮点', 'IEEE754'], requiresAgent: false, icon: Replace, component: loadBasic('FloatConverter') },
  { apiVersion: 1, id: 'uart', version: '1.0.0', title: 'UART 传输时间', description: '帧格式、吞吐量和耗时', detail: '根据波特率与帧格式计算有效吞吐量和理论传输时间。', category: 'calculation', keywords: ['UART', '波特率', '耗时'], requiresAgent: false, icon: Gauge, component: loadBasic('UartCalculator') },
  { apiVersion: 1, id: 'can', version: '1.0.0', title: 'CAN 帧分析', description: 'ID、DLC、位数和总线时间', detail: '分析经典 CAN 标准帧和扩展帧，估算位填充后的最坏总线占用。', category: 'protocol', keywords: ['CAN', 'DLC', '总线'], requiresAgent: false, icon: CircuitBoard, component: lazy(() => import('./can/CanTool')) },
  { apiVersion: 1, id: 'timer', version: '1.0.0', title: '定时器 / PWM', description: 'PSC、ARR、CCR 与频率', detail: '根据定时器时钟和寄存器参数计算频率、周期、占空比与分辨率。', category: 'calculation', keywords: ['定时器', 'PWM', 'PSC', 'ARR'], requiresAgent: false, icon: Timer, component: lazy(() => import('./timer/TimerTool')) },
  { apiVersion: 1, id: 'adc', version: '1.0.0', title: 'ADC 与分压', description: '量化、电压和电阻分压', detail: '把 ADC 原始值换算为引脚电压、量程比例和分压前电压。', category: 'calculation', keywords: ['ADC', '分压', '电压'], requiresAgent: false, icon: Activity, component: lazy(() => import('./adc/AdcTool')) },
  { apiVersion: 1, id: 'ihex', version: '1.0.0', title: 'Intel HEX', description: '记录校验、地址与 BIN 导出', detail: '校验 Intel HEX 记录、解析扩展地址并生成空洞填充为 FF 的 BIN。', category: 'firmware', keywords: ['HEX', '固件', 'BIN'], requiresAgent: false, icon: FileCode2, component: loadAdvanced('IntelHexTool') },
  { apiVersion: 1, id: 'bin', version: '1.0.0', title: 'BIN 文件', description: '大小、CRC 和内容概览', detail: '在浏览器本地分析二进制文件的大小、CRC32、空白比例和头尾字节。', category: 'firmware', keywords: ['BIN', '固件', 'CRC'], requiresAgent: false, icon: Binary, component: loadAdvanced('BinaryTool') },
  { apiVersion: 1, id: 'map', version: '1.0.0', title: 'MAP 快速分析', description: '内存、模块、风险和优化', detail: '复用通用 MAP 解析器，快速查看格式、覆盖率、Flash/RAM 和优化建议。', category: 'analysis', keywords: ['MAP', '内存', '优化'], requiresAgent: false, icon: MapIcon, component: loadAdvanced('MapQuickTool') },
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
