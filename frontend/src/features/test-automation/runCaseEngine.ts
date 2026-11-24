import { TEST_RUN_OBSERVED_LIMIT } from '../../services/testRunEvidence';
import type { TestStepRun } from '../../types/product';
import { orderedFlowSteps, resolvedFlowStep } from '../../utils/testFlow';
import { executeStepWithRetry } from './executionController';
import { resolveFlowVariables, type Channel, type FlowVariable, type StepStage, type StepStatus, type TestCase, type TestStep } from './domain';

const stageLabels: Record<StepStage, string> = { setup: '前置', test: '测试', teardown: '清理' };
const typeLabels: Record<TestStep['type'], string> = {
  command: '发送并断言', send: '发送数据', wait: '等待响应', match: '匹配响应', delay: '延时',
  'wait-online': '等待通道在线', 'clear-buffer': '清空接收缓冲', 'set-variable': '设置变量', manual: '人工确认',
};

export interface RunCaseEngineDependencies {
  shouldStop: () => boolean;
  sendData: (step: TestStep) => Promise<void>;
  waitForInput: (step: TestStep, matching: boolean, successPattern?: string, failurePattern?: string) => Promise<string>;
  ensureChannel: (channel: Channel) => Promise<void>;
  clearInput: (channel: Channel) => void;
  markInputCursor: (channel: Channel) => void;
  captureResponse: (step: TestStep, response: string) => void;
  setVariable: (name: string, value: string) => void;
  getVariables: () => FlowVariable[];
  manualConfirm: (message: string) => Promise<boolean>;
  observedInput: (step: TestStep) => string;
  hasInput: (channel: Channel) => boolean;
  sleep: (milliseconds: number) => Promise<void>;
  setStatus: (stepId: string, status: StepStatus) => void;
  setTeardownActive: (active: boolean) => void;
  log: (level: 'info' | 'pass' | 'fail', text: string) => void;
  now?: () => number;
}

export interface RunCaseEngineResult {
  passed: number;
  failed: number;
  aborted: boolean;
  stepRuns: TestStepRun[];
}

export async function runTestCaseEngine(testCase: TestCase, dependencies: RunCaseEngineDependencies): Promise<RunCaseEngineResult> {
  const now = dependencies.now ?? Date.now;
  const stepRuns: TestStepRun[] = [];
  let passed = 0, failed = 0, haltMain = false, aborted = false;

  for (const step of orderedFlowSteps(testCase.steps)) {
    const stage = step.stage ?? 'test';
    if ((haltMain || dependencies.shouldStop()) && stage !== 'teardown') {
      aborted ||= dependencies.shouldStop();
      dependencies.setStatus(step.id, 'skipped');
      const timestamp = new Date(now()).toISOString();
      stepRuns.push({ id: step.id, name: step.name, type: step.type, channel: step.channel, status: 'skipped', startedAt: timestamp, finishedAt: timestamp, durationMs: 0, retries: 0 });
      continue;
    }
    dependencies.setTeardownActive(stage === 'teardown');
    const executionStep = resolvedFlowStep(testCase, step), stepStarted = now(), stepStartedAt = new Date(stepStarted).toISOString();
    let attempts = 0, observedEvidence = '';
    dependencies.setStatus(step.id, 'running');
    dependencies.log('info', `${stageLabels[stage]} · ${typeLabels[step.type]}：${step.name}`);
    try {
      const execution = await executeStepWithRetry(step, async () => {
        let attemptEvidence = '';
        if (dependencies.shouldStop() && stage !== 'teardown') throw new Error('执行已停止');
        if (executionStep.type === 'command') {
          dependencies.markInputCursor(executionStep.channel);
          await dependencies.sendData(executionStep);
          const response = await dependencies.waitForInput(executionStep, true, executionStep.expected || 'OK', executionStep.failurePattern || 'ERROR|FAIL');
          attemptEvidence = response; dependencies.captureResponse(executionStep, response);
        } else if (executionStep.type === 'send') await dependencies.sendData(executionStep);
        else if (executionStep.type === 'delay') await dependencies.sleep(Math.max(0, executionStep.durationMs));
        else if (executionStep.type === 'wait-online') await dependencies.ensureChannel(executionStep.channel);
        else if (executionStep.type === 'clear-buffer') dependencies.clearInput(executionStep.channel);
        else if (executionStep.type === 'set-variable') dependencies.setVariable(executionStep.captureName || 'VARIABLE', resolveFlowVariables(executionStep.data, dependencies.getVariables()));
        else if (executionStep.type === 'manual') { if (!(await dependencies.manualConfirm(executionStep.data || executionStep.name))) throw new Error('人工确认未通过'); }
        else attemptEvidence = await dependencies.waitForInput(executionStep, executionStep.type === 'match');
        return attemptEvidence;
      }, {
        shouldStop: () => dependencies.shouldStop() && stage !== 'teardown', sleep: dependencies.sleep,
        onAttempt: attempt => { attempts = attempt; },
        onRetry: ({ failedAttempt, delayMs }) => dependencies.log('info', `${step.name} · 第 ${failedAttempt + 1} 次失败，${delayMs ? `${delayMs} ms 后` : '立即'}重新执行完整步骤`),
        onTimeLimit: limitMs => dependencies.log('info', `${step.name} · 已达到总持续时间 ${Math.round(limitMs / 1000)} 秒，停止重试`),
      });
      attempts = execution.attempts; observedEvidence = execution.value;
      const finished = now();
      stepRuns.push({ id: step.id, name: step.name, type: step.type, channel: executionStep.channel, status: 'passed', startedAt: stepStartedAt, finishedAt: new Date(finished).toISOString(), durationMs: finished - stepStarted, retries: attempts, evidence: executionStep.type === 'manual' ? { source: 'manual-confirmation', observed: '操作人员确认通过' } : { source: observedEvidence ? 'device-response' : 'runtime', ...(executionStep.expected ? { expected: executionStep.expected } : {}), ...(observedEvidence ? { observed: observedEvidence } : {}) } });
      dependencies.setStatus(step.id, 'passed'); dependencies.log('pass', `${step.name} · 通过`); passed += 1;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason), finished = now();
      stepRuns.push({ id: step.id, name: step.name, type: step.type, channel: executionStep.channel, status: 'failed', startedAt: stepStartedAt, finishedAt: new Date(finished).toISOString(), durationMs: finished - stepStarted, retries: attempts, error: message, evidence: { source: executionStep.type === 'manual' ? 'manual-confirmation' : observedEvidence || dependencies.hasInput(executionStep.channel) ? 'device-response' : 'runtime', ...(executionStep.expected || executionStep.type === 'match' ? { expected: executionStep.expected || executionStep.data || '' } : {}), observed: executionStep.type === 'manual' ? '操作人员确认未通过' : dependencies.observedInput(executionStep).slice(-TEST_RUN_OBSERVED_LIMIT), timeoutMs: executionStep.timeoutMs } });
      dependencies.setStatus(step.id, 'failed'); dependencies.log('fail', `${step.name} · ${message}`); failed += 1;
      if (dependencies.shouldStop()) { aborted = true; haltMain = true; }
      else if (step.onFailure !== 'continue') haltMain = true;
      else dependencies.log('info', `${step.name} · 按配置继续后续步骤`);
    }
    dependencies.setTeardownActive(false);
  }
  return { passed, failed, aborted, stepRuns };
}
