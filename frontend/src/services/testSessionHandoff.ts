import type { SerialAgentSession } from './serialAgent';

const STORAGE_KEY = 'embedkit.test-session-handoff.pending';
const MAX_AGE_MS = 10 * 60 * 1000;

export interface SerialTestSessionHandoff {
  schema: 'embedkit.test-session-handoff';
  version: 1;
  id: string;
  transport: 'serial';
  sessionId: string;
  path: string;
  baudRate: number;
  createdAt: string;
  expiresAt: string;
}

const isValid = (value: unknown): value is SerialTestSessionHandoff => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<SerialTestSessionHandoff>;
  return item.schema === 'embedkit.test-session-handoff' && item.version === 1 && item.transport === 'serial'
    && typeof item.id === 'string' && /^[a-zA-Z0-9-]{1,128}$/.test(item.id)
    && typeof item.sessionId === 'string' && /^[a-zA-Z0-9-]{1,128}$/.test(item.sessionId)
    && typeof item.path === 'string' && item.path.length > 0 && item.path.length <= 260
    && Number.isInteger(item.baudRate) && Number(item.baudRate) >= 50 && Number(item.baudRate) <= 4_000_000
    && typeof item.createdAt === 'string' && Number.isFinite(Date.parse(item.createdAt))
    && typeof item.expiresAt === 'string' && Number.isFinite(Date.parse(item.expiresAt));
};

export function writeSerialTestSessionHandoff(session: Pick<SerialAgentSession, 'id' | 'path' | 'baudRate'>, now = Date.now()): SerialTestSessionHandoff {
  const handoff: SerialTestSessionHandoff = {
    schema: 'embedkit.test-session-handoff',
    version: 1,
    id: crypto.randomUUID(),
    transport: 'serial',
    sessionId: session.id,
    path: session.path.slice(0, 260),
    baudRate: session.baudRate,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + MAX_AGE_MS).toISOString(),
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(handoff));
  return handoff;
}

export function readSerialTestSessionHandoff(now = Date.now()): SerialTestSessionHandoff | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null');
    if (!isValid(value) || Date.parse(value.expiresAt) <= now || Date.parse(value.createdAt) > now + 60_000) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return value;
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function clearSerialTestSessionHandoff(id?: string): void {
  const current = readSerialTestSessionHandoff();
  if (!id || current?.id === id) sessionStorage.removeItem(STORAGE_KEY);
}
