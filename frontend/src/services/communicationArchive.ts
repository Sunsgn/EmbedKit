import type { CommunicationSession } from '../types/lifecycle';
import type { TestCommunicationEvidence, TestRunStatus } from '../types/product';
import { parseCommunicationSession } from './lifecycleModel';

export interface ArchivedCommunicationEvidence extends TestCommunicationEvidence {
  startedAt: string;
}

export interface CommunicationArchiveContext {
  runId: string;
  finishedAt: string;
  status: TestRunStatus;
  firmwareId?: string;
}

export function createCommunicationSessionRecords(evidence: ArchivedCommunicationEvidence[], context: CommunicationArchiveContext): CommunicationSession[] {
  return evidence.map(item => {
    const record = parseCommunicationSession({
      schemaVersion: 1,
      id: `${context.runId}:${item.channel}`,
      sourceSessionId: item.sessionId,
      transport: item.transport,
      status: context.status === 'passed' ? 'completed' : context.status === 'aborted' ? 'aborted' : 'failed',
      startedAt: item.startedAt,
      endedAt: context.finishedAt,
      endpoint: item.endpoint,
      rxBytes: item.rxBytes,
      txBytes: item.txBytes,
      firmwareId: context.firmwareId,
      evidenceIds: [],
    });
    if (!record) throw new Error(`通信会话 ${item.channel} 无法归档，请检查端点、时间或计数`);
    return record;
  });
}
