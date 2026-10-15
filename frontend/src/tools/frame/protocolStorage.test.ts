import { describe, expect, it } from 'vitest';
import { confirmProtocolDefinition, extractProtocolDefinition } from './protocolDocument';
import { deleteProtocolDefinition, listProtocolDefinitions, saveProtocolDefinition } from './protocolStorage';

describe('protocol definition storage', () => {
  it('persists only confirmed models and safely handles damaged local data', () => {
    const candidate = extractProtocolDefinition('帧头：AA 55', 'a.txt');
    expect(() => saveProtocolDefinition(candidate)).toThrow(/人工确认/);
    const confirmed = confirmProtocolDefinition(candidate, 'A', { ...candidate.frame, checksum: 'sum8' });
    saveProtocolDefinition(confirmed);
    expect(listProtocolDefinitions()).toEqual([confirmed]);
    deleteProtocolDefinition(confirmed.id);
    expect(listProtocolDefinitions()).toEqual([]);
    localStorage.setItem('embedkit.protocol-definitions', '{bad');
    expect(listProtocolDefinitions()).toEqual([]);
  });
});
