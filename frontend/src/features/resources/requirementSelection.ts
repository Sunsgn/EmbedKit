import type { FunctionSolution, FunctionTemplate, PartRole, SelectionConstraint } from '../../types';
import { createFunctionSolution } from './functionSolutions';
import { discoverLocalParts, getRoleCatalog } from './selectionRegistry';

const constraint = (input: Omit<SelectionConstraint, 'id' | 'priority' | 'source'>): SelectionConstraint => ({ id: crypto.randomUUID(), priority: 'required', source: 'import', ...input });

function temperatureRange(text: string) {
  const match = text.match(/(-?\d+(?:\.\d+)?)\s*(?:～|~|至)\s*(-?\d+(?:\.\d+)?)\s*°?\s*C/i);
  if (!match) return null;
  const min = Number(match[1]), max = Number(match[2]);
  return Number.isFinite(min) && Number.isFinite(max) && min <= max ? { min, max } : null;
}

function constraintsForRole(role: PartRole, text: string): SelectionConstraint[] {
  const constraints: SelectionConstraint[] = [];
  const temperature = temperatureRange(text);
  if (temperature && (role.categoryId === 'mcu' || role.categoryId === 'communication-transceiver')) constraints.push(constraint({ parameterKey: 'temperature-c', customName: '工作温度', valueType: 'range', operator: 'contains-range', ...temperature, unit: '°C' }));

  if (role.categoryId === 'mcu') {
    const peripherals = ['CAN', 'USB', 'ETH', 'UART', 'I2C', 'SPI', 'BLE', 'WIFI'].filter(name => new RegExp(name === 'I2C' ? 'I(?:2|²)C' : name === 'WIFI' ? 'WI-?FI' : `\\b${name}\\b`, 'i').test(text));
    if (peripherals.length) constraints.push(constraint({ parameterKey: 'peripheral', customName: '必需外设', valueType: 'enum', operator: 'contains-all', value: peripherals }));
    for (const [label, key, pattern, unit] of [
      ['最低主频', 'clock-mhz', /(?:主频|时钟)[^\d]{0,8}(\d+(?:\.\d+)?)\s*MHz/i, 'MHz'],
      ['最低 Flash', 'flash-kb', /Flash[^\d]{0,8}(\d+(?:\.\d+)?)\s*(KB|MB)/i, 'KB'],
      ['最低 RAM', 'ram-kb', /RAM[^\d]{0,8}(\d+(?:\.\d+)?)\s*(KB|MB)/i, 'KB'],
    ] as const) {
      const match = text.match(pattern);
      if (match) constraints.push(constraint({ parameterKey: key, customName: label, valueType: 'number', operator: 'at-least', value: Number(match[1]) * (match[2]?.toUpperCase() === 'MB' ? 1024 : 1), unit }));
    }
  }

  if (role.categoryId === 'communication-transceiver') {
    const standard = /CAN\s*FD/i.test(text) ? 'CAN FD' : /\bCAN\b/i.test(text) ? 'CAN' : /RS-?485/i.test(text) ? 'RS-485' : /RS-?422/i.test(text) ? 'RS-422' : null;
    if (standard) constraints.push(constraint({ parameterKey: 'bus-standard', customName: '总线标准', valueType: 'enum', operator: 'equals', value: standard }));
    const rate = text.match(/(\d+(?:\.\d+)?)\s*(Mbps|kbps)/i);
    if (rate) constraints.push(constraint({ parameterKey: 'data-rate-mbps', customName: '最低数据速率', valueType: 'number', operator: 'at-least', value: Number(rate[1]), unit: rate[2] }));
  }
  return constraints;
}

export function createRequirementSelection(template: FunctionTemplate, text: string): { solution: FunctionSolution; targetRoleId?: string; candidateCount: number; coveredRoleCount: number } {
  const solution = createFunctionSolution(template);
  solution.description = text.trim().slice(0, 4_000);
  if (solution.roles.length === 0) {
    const candidates = discoverLocalParts(text);
    if (candidates.length) solution.roles = [{ id: crypto.randomUUID(), categoryId: 'custom', name: '按需求发现的候选', purpose: '由本地器件目录按用途和标签发现；请确认器件角色并核验参数', constraints: [], candidatePartIds: candidates.map(part => part.id) }];
    solution.parts = candidates;
  }
  const parts = new Map<string, FunctionSolution['parts'][number]>();
  let targetRoleId: string | undefined = solution.parts.length ? solution.roles[0]?.id : undefined;
  let candidateCount = solution.parts.length, coveredRoleCount = solution.parts.length ? 1 : 0;
  solution.roles = solution.roles.map(role => {
    const catalog = getRoleCatalog(role.categoryId).slice(0, 100);
    if (catalog.length) {
      coveredRoleCount += 1;
      candidateCount += catalog.length;
      targetRoleId ??= role.id;
      catalog.forEach(part => parts.set(part.id, part));
    }
    return { ...role, constraints: constraintsForRole(role, text), candidatePartIds: catalog.map(part => part.id) };
  });
  solution.parts.forEach(part => parts.set(part.id, part));
  solution.parts = [...parts.values()];
  return { solution, targetRoleId: targetRoleId ?? solution.roles[0]?.id, candidateCount, coveredRoleCount };
}
