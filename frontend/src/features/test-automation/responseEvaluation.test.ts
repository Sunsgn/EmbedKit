import { describe, expect, it } from 'vitest';
import { createTestStep } from './domain';
import { assignRuntimeVariable, captureResponseVariable, evaluateIncomingResponse } from './responseEvaluation';

describe('deterministic test response evaluation', () => {
  it('distinguishes pending, matching and explicit device failure responses', () => {
    const step = { ...createTestStep(), expected: 'OK', matchMode: 'contains' as const };
    const input = (text: string) => [{ item: { channel: 'serial-a' as const, text, hex: '' }, index: 4 }];
    expect(evaluateIncomingResponse(step, input('READY'), [], true, 'OK', 'ERROR')).toEqual({ state: 'pending' });
    expect(evaluateIncomingResponse(step, input('READY OK'), [], true, 'OK', 'ERROR')).toMatchObject({ state: 'matched', consumedThrough: 5 });
    expect(evaluateIncomingResponse(step, input('ERROR 12'), [], true, 'OK', 'ERROR')).toMatchObject({ state: 'failure', consumedThrough: 5 });
  });

  it('captures and updates variables using deterministic evidence', () => {
    const step = { ...createTestStep(), captureName: 'device ip', captureRegex: 'IP=([0-9.]+)' };
    const captured = captureResponseVariable(step, 'IP=192.168.1.2', [], () => 'variable-1');
    expect(captured).toMatchObject({ name: 'DEVICE_IP', value: '192.168.1.2', variables: [{ id: 'variable-1' }] });
    expect(assignRuntimeVariable('device ip', '10.0.0.2', captured!.variables)).toMatchObject([{ name: 'DEVICE_IP', value: '10.0.0.2' }]);
  });
});
