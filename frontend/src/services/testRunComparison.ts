import type { TestRunRecord } from '../types/product';

export type RunComparisonOutcome = 'fixed' | 'regressed' | 'unchanged-pass' | 'unchanged-fail' | 'changed' | 'incomparable';

export interface TestRunComparison {
  schema: 'embedkit.test-run-comparison';
  version: 1;
  baselineRunId: string;
  currentRunId: string;
  comparable: boolean;
  outcome: RunComparisonOutcome;
  reasons: string[];
  durationDeltaMs: number;
  passedDelta: number;
  failedDelta: number;
  steps: Array<{ id: string; name: string; baseline: string; current: string; durationDeltaMs?: number }>;
  context: { suiteId: string; caseId: string; deviceId: string; firmwareIdentity: string };
}

const firmwareIdentity = (run: TestRunRecord) => run.firmware?.sha256?.toLowerCase() || run.firmwareId || '';
const sortedEnvironment = (value: Record<string, string> | undefined) => JSON.stringify(Object.entries(value ?? {}).sort(([left], [right]) => left.localeCompare(right)));
const communicationContext = (run: TestRunRecord) => JSON.stringify((run.communications ?? []).map(item => ({ channel: item.channel, transport: item.transport, endpoint: item.endpoint })).sort((left, right) => left.channel.localeCompare(right.channel)));

export function compareTestRuns(baseline: TestRunRecord, current: TestRunRecord): TestRunComparison {
  const reasons: string[] = [];
  if (baseline.suiteId !== current.suiteId || baseline.caseId !== current.caseId) reasons.push('测试套件或用例不同');
  if (!baseline.testDefinitionSha256 || !current.testDefinitionSha256) reasons.push('缺少测试定义指纹');
  else if (baseline.testDefinitionSha256 !== current.testDefinitionSha256) reasons.push('测试步骤或参数定义不同');
  if (sortedEnvironment(baseline.inputEnvironment) !== sortedEnvironment(current.inputEnvironment)) reasons.push('非秘密输入变量不同');
  if ((baseline.secretInputCount ?? 0) > 0 || (current.secretInputCount ?? 0) > 0) reasons.push('存在未记录的秘密输入，无法证明输入相同');
  if (communicationContext(baseline) !== communicationContext(current)) reasons.push('通信通道或端点配置不同');
  if (baseline.agentVersion !== current.agentVersion) reasons.push('Local Agent 版本不同');
  if (!baseline.deviceId || !current.deviceId) reasons.push('缺少设备身份，无法证明使用同一设备');
  else if (baseline.deviceId !== current.deviceId) reasons.push('设备身份不同');
  const baselineFirmware = firmwareIdentity(baseline), currentFirmware = firmwareIdentity(current);
  if (!baselineFirmware || !currentFirmware) reasons.push('缺少固件身份或 SHA-256');
  else if (baselineFirmware !== currentFirmware) reasons.push('固件身份或 SHA-256 不同');
  const comparable = reasons.length === 0;
  let outcome: RunComparisonOutcome = 'incomparable';
  if (comparable) {
    if (baseline.status !== 'passed' && current.status === 'passed') outcome = 'fixed';
    else if (baseline.status === 'passed' && current.status !== 'passed') outcome = 'regressed';
    else if (baseline.status === 'passed' && current.status === 'passed') outcome = 'unchanged-pass';
    else if (baseline.status === current.status) outcome = 'unchanged-fail';
    else outcome = 'changed';
  }
  const baselineSteps = new Map(baseline.steps.map(step => [step.id, step]));
  const currentSteps = new Map(current.steps.map(step => [step.id, step]));
  const stepIds = [...new Set([...baselineSteps.keys(), ...currentSteps.keys()])];
  const steps = stepIds.map(id => {
    const before = baselineSteps.get(id), after = currentSteps.get(id);
    return {
      id,
      name: after?.name ?? before?.name ?? id,
      baseline: before?.status ?? 'missing',
      current: after?.status ?? 'missing',
      ...(before && after ? { durationDeltaMs: after.durationMs - before.durationMs } : {}),
    };
  }).filter(step => step.baseline !== step.current || step.durationDeltaMs !== 0);
  return {
    schema: 'embedkit.test-run-comparison',
    version: 1,
    baselineRunId: baseline.id,
    currentRunId: current.id,
    comparable,
    outcome,
    reasons,
    durationDeltaMs: current.durationMs - baseline.durationMs,
    passedDelta: current.passed - baseline.passed,
    failedDelta: current.failed - baseline.failed,
    steps,
    context: { suiteId: current.suiteId, caseId: current.caseId, deviceId: current.deviceId || '', firmwareIdentity: currentFirmware },
  };
}
