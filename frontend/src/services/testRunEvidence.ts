import type { TestRunRecord } from '../types/product';
import { normalizeEvidenceReferences, normalizeFindings } from './evidenceModel';

export const TEST_RUN_LOG_LIMIT = 1000;
export const TEST_RUN_TEXT_LIMIT = 2000;
export const TEST_RUN_OBSERVED_LIMIT = 4096;

const bounded = (value: unknown, limit = TEST_RUN_TEXT_LIMIT) =>
  String(value ?? '').slice(0, limit);

const stableId = (value: unknown) => {
  const text = bounded(value, 160);
  return /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(text) ? text : '';
};

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
  const legacy = value as TestRunRecord & { projectId?: unknown; deviceId?: unknown; device?: unknown };
  const { projectId: _projectId, deviceId: _deviceId, device: _device, ...current } = legacy;
  return {
    ...current,
    schemaVersion: 3,
    environment: value.environment && typeof value.environment === 'object' ? value.environment : {},
    steps: Array.isArray(value.steps) ? value.steps : [],
    logs: Array.isArray(value.logs) ? value.logs.slice(-TEST_RUN_LOG_LIMIT) : [],
    ...(stableId(value.projectRevisionId) ? { projectRevisionId: stableId(value.projectRevisionId) } : { projectRevisionId: undefined }),
    ...(stableId(value.firmwareId) ? { firmwareId: stableId(value.firmwareId) } : { firmwareId: undefined }),
    ...(stableId(value.baselineRunId) ? { baselineRunId: stableId(value.baselineRunId) } : { baselineRunId: undefined }),
    ...(/^[0-9a-f]{64}$/i.test(value.testDefinitionSha256 ?? '') ? { testDefinitionSha256: value.testDefinitionSha256!.toLowerCase() } : { testDefinitionSha256: undefined }),
    inputEnvironment: value.inputEnvironment && typeof value.inputEnvironment === 'object' ? value.inputEnvironment : {},
    secretInputCount: Number.isSafeInteger(value.secretInputCount) && Number(value.secretInputCount) >= 0 ? Number(value.secretInputCount) : 0,
    ...(Array.isArray(value.communicationSessionIds)
      ? { communicationSessionIds: [...new Set(value.communicationSessionIds.map(stableId).filter(Boolean))].slice(0, 100) }
      : {}),
    ...(Array.isArray(value.communications)
      ? { communications: value.communications }
      : {}),
    ...(Array.isArray(value.evidenceReferences)
      ? { evidenceReferences: normalizeEvidenceReferences(value.evidenceReferences) }
      : {}),
    ...(Array.isArray(value.findings)
      ? { findings: normalizeFindings(value.findings) }
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
    schemaVersion: 3,
    environment: Object.fromEntries(
      Object.entries(value.environment).map(([name, item]) => [
        bounded(name, 100),
        redact(item, secrets),
      ]),
    ),
    inputEnvironment: Object.fromEntries(
      Object.entries(value.inputEnvironment ?? {}).map(([name, item]) => [bounded(name, 100), redact(item, secrets)]),
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
    ...(Array.isArray(value.evidenceReferences)
      ? {
          evidenceReferences: normalizeEvidenceReferences(value.evidenceReferences).map(
            (reference) => ({ ...reference, label: redact(reference.label, secrets) }),
          ),
        }
      : {}),
    ...(Array.isArray(value.findings)
      ? {
          findings: normalizeFindings(value.findings).map((finding) => ({
            ...finding,
            summary: redact(finding.summary, secrets),
            unknowns: finding.unknowns.map((item) => redact(item, secrets)),
            verificationSteps: finding.verificationSteps.map((item) => redact(item, secrets)),
          })),
        }
      : {}),
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
    schema: 'embedkit.communication-test-report',
    version: 3,
    generatedAt: new Date().toISOString(),
    evidenceLegend: {
      deviceResponse: '由真实通信会话接收的数据形成。',
      manualConfirmation: '由操作人员确认，不等价于设备自动响应。',
      configuration: '固件和端点快照用于追溯，不单独证明测试通过。',
    },
    run,
  };
}
