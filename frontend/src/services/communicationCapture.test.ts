import { beforeEach, describe, expect, it } from 'vitest';
import { COMMUNICATION_CAPTURE_KEY, communicationCaptureHex, createCommunicationCapture, takePendingCommunicationCapture, writePendingCommunicationCapture } from './communicationCapture';

describe('communication capture handoff', () => {
  beforeEach(() => sessionStorage.clear());

  it('keeps ordered RX evidence and ignores non-RX records', () => {
    const capture = createCommunicationCapture({ transport: 'serial', sessionId: 'serial-1', endpoint: 'COM3 · 115200 8N1', events: [
      { timestamp: '2026-10-15T01:00:00Z', direction: 'tx', hex: '01 02' },
      { timestamp: '2026-10-15T01:00:01Z', direction: 'rx', hex: 'aa:55' },
      { timestamp: '2026-10-15T01:00:02Z', direction: 'rx', hex: '0x03 0x10' },
    ] });
    expect(capture.byteLength).toBe(4);
    expect(communicationCaptureHex(capture)).toBe('AA 55 03 10');
    writePendingCommunicationCapture(capture);
    expect(takePendingCommunicationCapture()).toEqual(capture);
    expect(sessionStorage.getItem(COMMUNICATION_CAPTURE_KEY)).toBeNull();
  });

  it('reports invalid records and enforces the selected byte boundary', () => {
    const capture = createCommunicationCapture({ transport: 'tcp', sessionId: 'tcp-1', endpoint: '127.0.0.1:9000', maxBytes: 3, events: [
      { timestamp: 'bad', direction: 'rx', hex: 'not hex' },
      { timestamp: 'good', direction: 'rx', hex: '01 02 03 04' },
    ] });
    expect(capture).toMatchObject({ byteLength: 3, skippedRecords: 1, truncated: true });
    expect(communicationCaptureHex(capture)).toBe('01 02 03');
  });

  it('rejects damaged persisted data', () => {
    sessionStorage.setItem(COMMUNICATION_CAPTURE_KEY, '{"schema":"wrong"}');
    expect(takePendingCommunicationCapture()).toBeNull();
  });
});
