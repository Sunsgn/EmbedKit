import { createCommunicationSessionRecords, type ArchivedCommunicationEvidence } from '../../services/communicationArchive';
import { createTestRunEvidence } from '../../services/testRunEvidence';
import type { TestRunRecord } from '../../types/product';
import type { FlowVariable, RunLog, TestCase, TestSuite } from './domain';

export interface TestRunFirmwareChoice {
  firmwareId?: string;
  buildId: string;
  fileName: string;
  artifactType: string;
  size: number;
  modifiedAt: string;
  sha256: string;
  analyzedAt: string;
}

export interface TestRunRecordInput {
  runId: string;
  suite: TestSuite;
  testCase: TestCase;
  status: TestRunRecord['status'];
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  passed: number;
  failed: number;
  agentVersion: string;
  firmware?: TestRunFirmwareChoice;
  communicationEvidence: ArchivedCommunicationEvidence[];
  baselineRunId?: string;
  testDefinitionSha256: string;
  inputEnvironment: Record<string, string>;
  secretInputCount: number;
  runtimeVariables: FlowVariable[];
  steps: TestRunRecord['steps'];
  logs: RunLog[];
}

export function buildTestRunRecord(input: TestRunRecordInput) {
  const communicationSessions = createCommunicationSessionRecords(input.communicationEvidence, {
    runId: input.runId,
    finishedAt: input.finishedAt,
    status: input.status,
    firmwareId: input.firmware?.firmwareId,
  });
  const communications = input.communicationEvidence.map(({ startedAt: _startedAt, ...evidence }) => evidence);
  const secretValues = input.runtimeVariables.filter(variable => variable.secret).map(variable => variable.value);
  const firmware = input.firmware;
  const record = createTestRunEvidence({
    schemaVersion: 3,
    id: input.runId,
    suiteId: input.suite.id,
    suiteName: input.suite.name,
    caseId: input.testCase.id,
    caseName: input.testCase.name,
    status: input.status,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    durationMs: input.durationMs,
    passed: input.passed,
    failed: input.failed,
    agentVersion: input.agentVersion,
    ...(firmware ? {
      ...(firmware.firmwareId ? { firmwareId: firmware.firmwareId } : {}),
      firmware: { buildId: firmware.buildId, artifactName: firmware.fileName, artifactType: firmware.artifactType, size: firmware.size, modifiedAt: firmware.modifiedAt, sha256: firmware.sha256, analyzedAt: firmware.analyzedAt },
    } : {}),
    communications,
    communicationSessionIds: communicationSessions.map(session => session.id),
    ...(input.baselineRunId ? { baselineRunId: input.baselineRunId } : {}),
    testDefinitionSha256: input.testDefinitionSha256,
    inputEnvironment: input.inputEnvironment,
    secretInputCount: input.secretInputCount,
    environment: Object.fromEntries(input.runtimeVariables.filter(variable => !variable.secret).map(variable => [variable.name, variable.value])),
    steps: input.steps,
    logs: input.logs.map(({ time, level, text }) => ({ time, level, text })),
  }, secretValues);
  return { record, communicationSessions };
}
