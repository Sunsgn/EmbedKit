import assert from 'node:assert/strict';
import test from 'node:test';
import { AGENT_CAPABILITIES, AGENT_PROTOCOL_VERSION, AGENT_ROUTES, listAgentCapabilities, validateAgentContract } from './agent-api.js';

test('agent contract has unique versioned routes and declared capabilities', () => {
  const summary = validateAgentContract();
  assert.equal(AGENT_PROTOCOL_VERSION, 1);
  assert.equal(summary.routes, Object.keys(AGENT_ROUTES).length);
  assert.equal(summary.capabilities, Object.keys(AGENT_CAPABILITIES).length);
});

test('platform-specific capability is only advertised where implemented', () => {
  assert.equal(listAgentCapabilities('linux').includes(AGENT_CAPABILITIES.SERIAL_DRIVER_INSTALLATION), false);
  assert.equal(listAgentCapabilities('win32').includes(AGENT_CAPABILITIES.SERIAL_DRIVER_INSTALLATION), true);
});

test('shared routes stay inside the versioned API or restricted proxy namespaces', () => {
  assert.ok(Object.values(AGENT_ROUTES).every(route => route.path.startsWith('/api/') || route.path.startsWith('/proxy/')));
});
