import { describe, expect, it } from 'vitest';
import { createPortableTestSuiteJson, parseImportedTestSuite, TEST_SUITE_CASE_LIMIT } from './suiteTransfer';
import type { TestSuite } from './domain';

const ids = () => { let value = 0; return () => `id-${++value}`; };
const suite: TestSuite = { id: 'suite', name: '回归测试', variables: [{ id: 'secret', name: 'TOKEN', value: 'sensitive', secret: true }], cases: [{ id: 'case', name: '启动', sharedChannel: true, channel: 'serial-a', steps: [{ id: 'step', name: '查询', type: 'command', stage: 'test', channel: 'serial-b', data: 'AT', hex: false, durationMs: 0, timeoutMs: 1000, retryCount: 0, matchMode: 'contains' }] }] };

describe('test suite transfer', () => {
  it('exports a versioned portable payload without secret values', () => {
    const value = JSON.parse(createPortableTestSuiteJson(suite, '2026-01-01T00:00:00.000Z'));
    expect(value).toMatchObject({ schema: 'embedkit.test-suite', version: 1, exportedAt: '2026-01-01T00:00:00.000Z' });
    expect(value.suite.variables[0].value).toBe('');
  });

  it('imports versioned and legacy suites with fresh ids and shared channel normalization', () => {
    const imported = parseImportedTestSuite(createPortableTestSuiteJson(suite), ids());
    expect(imported).toMatchObject({ id: 'id-1', name: '回归测试（导入）', cases: [{ id: 'id-3', channel: 'serial-a', steps: [{ id: 'id-4', channel: 'serial-a' }] }] });
    expect(parseImportedTestSuite(JSON.stringify(suite), ids()).cases).toHaveLength(1);
  });

  it('rejects unsupported versions, malformed steps, and resource overflow', () => {
    expect(() => parseImportedTestSuite('{bad')).toThrow(/有效的 JSON/);
    expect(() => parseImportedTestSuite(JSON.stringify({ schema: 'embedkit.test-suite', version: 9, suite }))).toThrow(/版本/);
    expect(() => parseImportedTestSuite(JSON.stringify({ ...suite, cases: [{ name: 'bad', steps: [{ type: 'unknown' }] }] }))).toThrow(/类型/);
    expect(() => parseImportedTestSuite(JSON.stringify({ ...suite, cases: Array.from({ length: TEST_SUITE_CASE_LIMIT + 1 }) }))).toThrow(/上限/);
  });
});
