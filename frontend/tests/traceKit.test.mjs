import assert from 'node:assert/strict';
import test from 'node:test';
import { TRACE_KIT_HEADER, TRACE_KIT_SOURCE } from '../src/utils/traceKit.ts';

test('portable trace kit exposes disable switch and non-blocking port hooks', () => {
  assert.match(TRACE_KIT_HEADER, /EK_TRACE_ENABLED/);
  assert.match(TRACE_KIT_HEADER, /EK_TRACE_STATE/);
  assert.match(TRACE_KIT_SOURCE, /ek_trace_port_write/);
  assert.match(TRACE_KIT_SOURCE, /EK\|%lu\|%s/);
});
