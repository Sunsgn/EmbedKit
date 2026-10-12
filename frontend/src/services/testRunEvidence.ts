import type { TestRunRecord } from '../types/product';

export const TEST_RUN_LOG_LIMIT = 1000;
export const TEST_RUN_TEXT_LIMIT = 2000;
export const TEST_RUN_OBSERVED_LIMIT = 4096;

const bounded = (value: unknown, limit = TEST_RUN_TEXT_LIMIT) =>
  String(value ?? '').slice(0, limit);

const redact = (
  value: unknown,
  secrets: string[],
  limit = TEST_RUN_TEXT_LIMIT,
) =>
  secrets.reduce(
    (text, secret) => (secret ? text.split(secret).join('[REDACTED]') : text),
    bounded(value, limit),
  );

export function normalizeTestRunRecord(value: TestRunRecord): TestRunRecord {
  return {
    ...value,
    environment: value.environment && typeof value.environment === 'object' ? value.environment : {},
    steps: Array.isArray(value.steps) ? value.steps : [],
    logs: Array.isArray(value.logs) ? value.logs.slice(-TEST_RUN_LOG_LIMIT) : [],
    ...(Array.isArray(value.communications)
      ? { communications: value.communications }
      : {}),
  };
}

export function createTestRunEvidence(
  value: TestRunRecord,
  secretValues: string[] = [],
): TestRunRecord {
  const secrets = secretValues.filter(Boolean);
  return normalizeTestRunRecord({
    ...value,
    schemaVersion: 2,
    environment: Object.fromEntries(
      Object.entries(value.environment).map(([name, item]) => [
        bounded(name, 100),
        redact(item, secrets),
      ]),
    ),
    steps: value.steps.map((step) => ({
      ...step,
      name: redact(step.name, secrets),
      channel: bounded(step.channel, 100),
      ...(step.error ? { error: redact(step.error, secrets) } : {}),
      ...(step.evidence
        ? {
            evidence: {
              ...step.evidence,
              ...(step.evidence.expected
                ? { expected: redact(step.evidence.expected, secrets) }
                : {}),
              ...(step.evidence.observed
                ? {
                    observed: redact(
                      step.evidence.observed,
                      secrets,
                      TEST_RUN_OBSERVED_LIMIT,
                    ),
                  }
                : {}),
            },
          }
        : {}),
    })),
    logs: value.logs.slice(-TEST_RUN_LOG_LIMIT).map((log) => ({
      time: bounded(log.time, 32),
      level: bounded(log.level, 16),
      text: redact(log.text, secrets),
    })),
  });
}

export function createTestRunJsonReport(value: TestRunRecord) {
  const run = normalizeTestRunRecord(value);
  return {
    schema: 'embedkit.real-device-test-report',
    version: 2,
    generatedAt: new Date().toISOString(),
    evidenceLegend: {
      deviceResponse: '由真实通信会话接收的数据形成。',
      manualConfirmation: '由操作人员确认，不等价于设备自动响应。',
      configuration: '设备、固件和端点快照用于追溯，不单独证明测试通过。',
    },
    run,
  };
}
