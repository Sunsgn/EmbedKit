import { describe, expect, it } from 'vitest';
import { agentPaths } from './routes';

describe('agent route builders', () => {
  it('keeps static routes on the shared contract', () => {
    expect(agentPaths.status).toBe('/api/agent/status');
    expect(agentPaths.serialSessions).toBe('/api/serial/sessions');
  });

  it('encodes dynamic identifiers and query values', () => {
    expect(agentPaths.serialSession('unsafe/id', 4)).toBe('/api/serial/sessions/unsafe%2Fid?after=4');
    expect(agentPaths.elfLookup('analysis 1', '0x0800+4')).toContain('analysis%201/lookup?address=0x0800%2B4');
  });
});
