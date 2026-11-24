import { createTestStep, isLineEnding, type Channel, type FlowVariable, type StepType, type TestCase, type TestStep, type TestSuite } from './domain';

export const TEST_SUITE_TRANSFER_SCHEMA = 'embedkit.test-suite';
export const TEST_SUITE_TRANSFER_VERSION = 1;
export const TEST_SUITE_IMPORT_MAX_BYTES = 2 * 1024 * 1024;
export const TEST_SUITE_CASE_LIMIT = 100;
export const TEST_SUITE_STEP_LIMIT = 1_000;
export const TEST_SUITE_VARIABLE_LIMIT = 200;

const stepTypes = new Set<StepType>(['command', 'send', 'wait', 'match', 'delay', 'wait-online', 'clear-buffer', 'set-variable', 'manual']);
const channels = new Set<Channel>(['serial-a', 'serial-b', 'websocket', 'tcp', 'udp']);
const text = (value: unknown, label: string, limit = 4_096) => {
  if (typeof value !== 'string' || !value.trim() || value.length > limit) throw new Error(`${label}无效或超过 ${limit} 字符上限`);
  return value;
};

function importedStep(value: unknown, caseChannel: Channel, shared: boolean, id: () => string): TestStep {
  if (!value || typeof value !== 'object') throw new Error('测试步骤格式无效');
  const input = value as Partial<TestStep>, type = input.type;
  if (!type || !stepTypes.has(type)) throw new Error('测试步骤类型不受支持');
  const channel = shared ? caseChannel : input.channel;
  if (!channel || !channels.has(channel)) throw new Error('测试步骤通道无效');
  return {
    ...createTestStep(type),
    ...input,
    id: id(),
    name: text(input.name, '测试步骤名称', 200),
    type,
    channel,
    data: typeof input.data === 'string' ? input.data.slice(0, 65_536) : '',
    lineEnding: isLineEnding(input.lineEnding) ? input.lineEnding : undefined,
    stage: input.stage === 'setup' || input.stage === 'teardown' ? input.stage : 'test',
  };
}

function importedCase(value: unknown, id: () => string): TestCase {
  if (!value || typeof value !== 'object') throw new Error('测试用例格式无效');
  const input = value as Partial<TestCase>;
  if (!Array.isArray(input.steps) || input.steps.length > TEST_SUITE_STEP_LIMIT) throw new Error(`每个测试用例最多包含 ${TEST_SUITE_STEP_LIMIT} 个步骤`);
  const shared = input.sharedChannel ?? true, caseChannel = channels.has(input.channel as Channel) ? input.channel as Channel : 'serial-a';
  return {
    ...input,
    id: id(),
    name: text(input.name, '测试用例名称', 200),
    sharedChannel: shared,
    channel: caseChannel,
    lineEnding: isLineEnding(input.lineEnding) ? input.lineEnding : 'none',
    steps: input.steps.map(step => importedStep(step, caseChannel, shared, id)),
  };
}

function importedVariables(value: unknown, id: () => string): FlowVariable[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > TEST_SUITE_VARIABLE_LIMIT) throw new Error(`测试套件最多包含 ${TEST_SUITE_VARIABLE_LIMIT} 个变量`);
  return value.map(variable => {
    if (!variable || typeof variable !== 'object') throw new Error('测试变量格式无效');
    const input = variable as Partial<FlowVariable>;
    return { id: id(), name: text(input.name, '变量名称', 200), value: typeof input.value === 'string' ? input.value.slice(0, 65_536) : '', secret: input.secret === true };
  });
}

export function createPortableTestSuiteJson(suite: TestSuite, exportedAt = new Date().toISOString()) {
  const safeSuite = { ...suite, variables: suite.variables?.map(variable => variable.secret ? { ...variable, value: '' } : variable) };
  return JSON.stringify({ schema: TEST_SUITE_TRANSFER_SCHEMA, version: TEST_SUITE_TRANSFER_VERSION, exportedAt, suite: safeSuite }, null, 2);
}

export function parseImportedTestSuite(source: string, id: () => string = () => crypto.randomUUID()): TestSuite {
  if (new Blob([source]).size > TEST_SUITE_IMPORT_MAX_BYTES) throw new Error('测试套件文件超过 2 MiB 上限');
  let value: unknown;
  try { value = JSON.parse(source); } catch { throw new Error('文件不是有效的 JSON'); }
  if (!value || typeof value !== 'object') throw new Error('文件不是有效的测试套件');
  const envelope = value as { schema?: unknown; version?: unknown; suite?: unknown };
  if (envelope.schema !== undefined && (envelope.schema !== TEST_SUITE_TRANSFER_SCHEMA || envelope.version !== TEST_SUITE_TRANSFER_VERSION)) throw new Error('不支持的测试套件版本');
  const parsed = (envelope.schema ? envelope.suite : value) as Partial<TestSuite> | undefined;
  if (!parsed || !Array.isArray(parsed.cases) || parsed.cases.length > TEST_SUITE_CASE_LIMIT) throw new Error(`测试套件无效或超过 ${TEST_SUITE_CASE_LIMIT} 个用例上限`);
  return {
    id: id(),
    name: `${text(parsed.name, '测试套件名称', 200)}（导入）`,
    variables: importedVariables(parsed.variables, id),
    cases: parsed.cases.map(testCase => importedCase(testCase, id)),
  };
}
