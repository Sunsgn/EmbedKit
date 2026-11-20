export type ConnectionTransport = 'serial' | 'tcp' | 'udp' | 'websocket' | 'web-serial';
export type ConnectionState = 'connecting' | 'connected' | 'error' | 'closed';
export type ConnectionProvider = 'local-agent' | 'browser';

export interface ConnectionSessionSnapshot {
  id: string;
  transport: ConnectionTransport;
  provider: ConnectionProvider;
  state: ConnectionState;
  endpoint: string;
  rxBytes: number;
  txBytes: number;
  updatedAt: string;
}

type Listener = (sessions: readonly ConnectionSessionSnapshot[]) => void;
const MAX_TRACKED_SESSIONS = 128;
const keyOf = (transport: ConnectionTransport, id: string) => `${transport}:${id}`;

export class ConnectionSessionManager {
  private readonly sessions = new Map<string, ConnectionSessionSnapshot>();
  private readonly listeners = new Set<Listener>();

  list() {
    return [...this.sessions.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  get(transport: ConnectionTransport, id: string) {
    return this.sessions.get(keyOf(transport, id)) ?? null;
  }

  upsert(value: Omit<ConnectionSessionSnapshot, 'updatedAt'> & { updatedAt?: string }) {
    if (!value.id || !value.endpoint || !Number.isFinite(value.rxBytes) || !Number.isFinite(value.txBytes)) throw new Error('连接会话快照无效');
    const snapshot: ConnectionSessionSnapshot = { ...value, rxBytes: Math.max(0, value.rxBytes), txBytes: Math.max(0, value.txBytes), updatedAt: value.updatedAt ?? new Date().toISOString() };
    this.sessions.set(keyOf(snapshot.transport, snapshot.id), snapshot);
    while (this.sessions.size > MAX_TRACKED_SESSIONS) {
      const oldest = this.list().at(-1);
      if (!oldest) break;
      this.sessions.delete(keyOf(oldest.transport, oldest.id));
    }
    this.emit();
    return snapshot;
  }

  remove(transport: ConnectionTransport, id: string) {
    const removed = this.sessions.delete(keyOf(transport, id));
    if (removed) this.emit();
    return removed;
  }

  reconcile(transports: readonly ConnectionTransport[], values: readonly (Omit<ConnectionSessionSnapshot, 'updatedAt'> & { updatedAt?: string })[]) {
    const scope = new Set(transports), incoming = new Set(values.map(value => keyOf(value.transport, value.id)));
    for (const [key, session] of this.sessions) if (session.provider === 'local-agent' && scope.has(session.transport) && !incoming.has(key)) this.sessions.delete(key);
    for (const value of values) this.upsert(value);
    if (!values.length) this.emit();
    return this.list();
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.list());
    return () => this.listeners.delete(listener);
  }

  clearForTests() {
    this.sessions.clear();
    this.emit();
  }

  private emit() {
    const snapshot = this.list();
    for (const listener of this.listeners) listener(snapshot);
  }
}

export const connectionSessionManager = new ConnectionSessionManager();
