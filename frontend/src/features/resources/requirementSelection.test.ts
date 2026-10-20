import { describe, expect, it } from 'vitest';
import { functionTemplates } from './selectionRegistry';
import { createRequirementSelection } from './requirementSelection';

describe('requirement selection preparation', () => {
  it('turns a communication requirement into constraints and immediate candidates', () => {
    const result = createRequirementSelection(functionTemplates[0], 'CAN FD，最低 5Mbps，主频 100MHz，工作温度 -40～85°C');
    const controller = result.solution.roles.find(role => role.categoryId === 'mcu')!;
    const transceiver = result.solution.roles.find(role => role.categoryId === 'communication-transceiver')!;
    expect(result.candidateCount).toBeGreaterThan(0);
    expect(result.coveredRoleCount).toBeGreaterThan(2);
    expect(controller.constraints).toEqual(expect.arrayContaining([expect.objectContaining({ parameterKey: 'peripheral', value: ['CAN'] }), expect.objectContaining({ parameterKey: 'clock-mhz', value: 100 }), expect.objectContaining({ parameterKey: 'temperature-c', min: -40, max: 85 })]));
    expect(transceiver.constraints).toEqual(expect.arrayContaining([expect.objectContaining({ parameterKey: 'bus-standard', value: 'CAN FD' }), expect.objectContaining({ parameterKey: 'data-rate-mbps', value: 5 })]));
    expect(result.targetRoleId).toBe(controller.id);
  });

  it('loads built-in candidates for sensor roles without inventing unsupported parameters', () => {
    const result = createRequirementSelection(functionTemplates[1], '采集温度、湿度和压力');
    const sensor = result.solution.roles.find(role => role.categoryId === 'sensor')!;
    expect(sensor.candidatePartIds.length).toBeGreaterThan(1);
    expect(result.solution.parts.some(part => part.mpn === 'BME280')).toBe(true);
    expect(sensor.constraints).toEqual([]);
  });

  it('falls back to deterministic local discovery for requirements outside templates', () => {
    const result = createRequirementSelection(functionTemplates[2], '需要一个支持 WiFi 的控制器');
    expect(result.solution.roles).toHaveLength(1);
    expect(result.solution.roles[0]).toMatchObject({ categoryId: 'custom', name: '按需求发现的候选' });
    expect(result.solution.parts.some(part => part.tags.some(tag => /wifi/i.test(tag)))).toBe(true);
    expect(result.candidateCount).toBeGreaterThan(0);
  });
});
