import type { ConstraintOperator, FunctionTemplate, ParameterDefinition, PartRecord, UnitDefinition } from '../../types';
import { communicationSelectionCatalog } from './communicationSelectionCatalog';
import { mcuSelectionCatalog } from './mcuSelectionCatalog';

const numericOperators: ConstraintOperator[] = ['equals', 'not-equals', 'at-least', 'at-most', 'greater-than', 'less-than'];

export const unitDefinitions: UnitDefinition[] = [
  { symbol: 'Hz', dimension: 'frequency', toCanonical: value => value, fromCanonical: value => value },
  { symbol: 'kHz', dimension: 'frequency', toCanonical: value => value * 1_000, fromCanonical: value => value / 1_000 },
  { symbol: 'MHz', dimension: 'frequency', toCanonical: value => value * 1_000_000, fromCanonical: value => value / 1_000_000 },
  { symbol: 'bps', dimension: 'data-rate', toCanonical: value => value, fromCanonical: value => value },
  { symbol: 'kbps', dimension: 'data-rate', toCanonical: value => value * 1_000, fromCanonical: value => value / 1_000 },
  { symbol: 'Mbps', dimension: 'data-rate', toCanonical: value => value * 1_000_000, fromCanonical: value => value / 1_000_000 },
  { symbol: 'B', dimension: 'storage', toCanonical: value => value, fromCanonical: value => value },
  { symbol: 'KB', dimension: 'storage', toCanonical: value => value * 1_024, fromCanonical: value => value / 1_024 },
  { symbol: 'MB', dimension: 'storage', toCanonical: value => value * 1_048_576, fromCanonical: value => value / 1_048_576 },
  { symbol: '°C', dimension: 'temperature', toCanonical: value => value, fromCanonical: value => value },
  { symbol: 'K', dimension: 'temperature', toCanonical: value => value - 273.15, fromCanonical: value => value + 273.15 },
  { symbol: 'V', dimension: 'voltage', toCanonical: value => value, fromCanonical: value => value },
  { symbol: 'mV', dimension: 'voltage', toCanonical: value => value / 1_000, fromCanonical: value => value * 1_000 },
];

const definition = (input: Omit<ParameterDefinition, 'schemaVersion'>): ParameterDefinition => ({ schemaVersion: 1, ...input });

export const parameterDefinitions: ParameterDefinition[] = [
  definition({ id: 'mcu.clock', categoryId: 'mcu', parameterKey: 'clock-mhz', label: '最高主频', valueType: 'number', canonicalUnit: 'MHz', allowedUnits: ['MHz', 'kHz'], supportedOperators: numericOperators, description: '器件标称可支持的最高工作主频。' }),
  definition({ id: 'mcu.flash', categoryId: 'mcu', parameterKey: 'flash-kb', label: 'Flash 容量', valueType: 'number', canonicalUnit: 'KB', allowedUnits: ['KB', 'MB'], supportedOperators: numericOperators, description: '片上非易失程序存储容量。' }),
  definition({ id: 'mcu.ram', categoryId: 'mcu', parameterKey: 'ram-kb', label: 'RAM 容量', valueType: 'number', canonicalUnit: 'KB', allowedUnits: ['KB', 'MB'], supportedOperators: numericOperators, description: '片上易失数据存储容量。' }),
  definition({ id: 'mcu.peripheral', categoryId: 'mcu', parameterKey: 'peripheral', label: '外设能力', valueType: 'enum', enumValues: ['CAN', 'USB', 'ETH', 'UART', 'I2C', 'SPI', 'BLE', 'WIFI'], supportedOperators: ['equals', 'not-equals', 'contains-any', 'contains-all'], description: '芯片集成的通信或控制外设。' }),
  definition({ id: 'mcu.temperature', categoryId: 'mcu', parameterKey: 'temperature-c', label: '工作温度', aliases: ['温度', '工作温度范围', '运行温度', 'operating temperature', 'temperature range'], valueType: 'range', canonicalUnit: '°C', allowedUnits: ['°C', 'K'], supportedOperators: ['contains-range', 'within-range', 'manual-verification'], description: '具体订货型号允许的环境或结温工作范围，以数据手册订货信息为准。' }),
  definition({ id: 'transceiver.standard', categoryId: 'communication-transceiver', parameterKey: 'bus-standard', label: '总线标准', valueType: 'enum', enumValues: ['CAN', 'CAN FD', 'RS-485', 'RS-422'], supportedOperators: ['equals', 'not-equals', 'contains-any', 'contains-all'], description: '物理层收发器支持的总线标准。' }),
  definition({ id: 'transceiver.rate', categoryId: 'communication-transceiver', parameterKey: 'data-rate-mbps', label: '最高数据速率', valueType: 'number', canonicalUnit: 'Mbps', allowedUnits: ['Mbps', 'kbps'], supportedOperators: numericOperators, description: '器件可支持的最高标称数据速率。' }),
  definition({ id: 'transceiver.supply', categoryId: 'communication-transceiver', parameterKey: 'supply-voltage-v', label: '供电电压', valueType: 'range', canonicalUnit: 'V', allowedUnits: ['V', 'mV'], supportedOperators: ['contains-range', 'within-range', 'manual-verification'], description: '器件允许的供电电压范围。' }),
  definition({ id: 'transceiver.temperature', categoryId: 'communication-transceiver', parameterKey: 'temperature-c', label: '工作温度', aliases: ['温度', '工作温度范围', '运行温度', 'operating temperature', 'temperature range'], valueType: 'range', canonicalUnit: '°C', allowedUnits: ['°C', 'K'], supportedOperators: ['contains-range', 'within-range', 'manual-verification'], description: '具体订货型号允许的工作温度范围。' }),
];

export const functionTemplates: FunctionTemplate[] = [
  {
    id: 'industrial-communication-node',
    name: '工业通信节点',
    description: '从控制、总线物理层、隔离、电源和保护角色开始设计。',
    roles: [
      { categoryId: 'mcu', name: '控制器', purpose: '运行控制逻辑和通信协议' },
      { categoryId: 'communication-transceiver', name: '通信收发器', purpose: '连接现场总线物理层' },
      { categoryId: 'isolation', name: '数字隔离', purpose: '隔离控制侧与现场侧' },
      { categoryId: 'power', name: '电源', purpose: '完成输入电源转换与供电' },
      { categoryId: 'protection', name: '接口保护', purpose: '提供浪涌、ESD 和过压保护' },
    ],
  },
  {
    id: 'sensor-acquisition-node',
    name: '传感器采集节点',
    description: '从输入、调理、转换、控制和供电角色开始设计。',
    roles: [
      { categoryId: 'sensor', name: '传感器 / 输入接口', purpose: '连接被测物理量或外部传感器' },
      { categoryId: 'signal-conditioning', name: '信号调理', purpose: '完成放大、滤波或保护' },
      { categoryId: 'adc', name: 'ADC', purpose: '将模拟输入转换为数字量' },
      { categoryId: 'mcu', name: '控制器', purpose: '采集、处理并上传数据' },
      { categoryId: 'power', name: '电源', purpose: '为模拟和数字域供电' },
    ],
  },
  { id: 'blank', name: '自定义空白方案', description: '不预设角色，由用户按实际系统添加。', roles: [] },
];

export function getParameterDefinitions(categoryId: string) {
  return parameterDefinitions.filter(item => item.categoryId === categoryId);
}

const normalizedLabel = (value: string) => value.toLocaleLowerCase().replace(/[\s_\-/（）()]+/g, '');

export function findParameterDefinition(categoryId: string, name: string) {
  const target = normalizedLabel(name);
  return getParameterDefinitions(categoryId).find(item => [item.label, item.parameterKey, ...(item.aliases ?? [])].some(alias => normalizedLabel(alias) === target));
}

export function getRoleCatalog(categoryId: string): PartRecord[] {
  if (categoryId === 'mcu') return mcuSelectionCatalog;
  if (categoryId === 'communication-transceiver') return communicationSelectionCatalog;
  return [];
}

export function convertUnit(value: number, from?: string, to?: string) {
  if (!Number.isFinite(value)) throw new Error('数值必须是有限数字');
  if (!from || !to || from === to) return value;
  const source = unitDefinitions.find(item => item.symbol === from);
  const target = unitDefinitions.find(item => item.symbol === to);
  if (!source || !target) throw new Error(`未知单位：${!source ? from : to}`);
  if (source.dimension !== target.dimension) throw new Error(`单位量纲不一致：${from} 与 ${to}`);
  return target.fromCanonical(source.toCanonical(value));
}
