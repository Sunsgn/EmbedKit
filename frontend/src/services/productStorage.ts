import type { EngineeringProject, TestRunRecord } from '../types/product';
import type { BuildArtifact, CommunicationSession, FirmwareIdentity, ProjectRevision } from '../types/lifecycle';
import { normalizeLifecycleRecords, parseBuildArtifact, parseCommunicationSession, parseFirmwareIdentity, parseProjectRevision } from './lifecycleModel';
import { normalizeTestRunRecord } from './testRunEvidence';
import { normalizeEngineeringProject } from './projectModel';

const DATABASE = 'embedkit-product';
const VERSION = 3;
const PROJECTS = 'projects';
const RUNS = 'test-runs';
const LEGACY_SETTINGS = 'settings';
const PROJECT_REVISIONS = 'project-revisions';
const BUILD_ARTIFACTS = 'build-artifacts';
const FIRMWARE_IDENTITIES = 'firmware-identities';
const COMMUNICATION_SESSIONS = 'communication-sessions';

export interface ProductDataSnapshot {
  projects: EngineeringProject[];
  runs: TestRunRecord[];
  projectRevisions?: ProjectRevision[];
  buildArtifacts?: BuildArtifact[];
  firmwareIdentities?: FirmwareIdentity[];
  communicationSessions?: CommunicationSession[];
}

export function createPortableProductData(snapshot: ProductDataSnapshot): ProductDataSnapshot {
  return {
    projects: snapshot.projects.map(normalizeEngineeringProject).filter((item): item is EngineeringProject => item !== null).slice(0, 500),
    runs: snapshot.runs.map(normalizeTestRunRecord).map(run => ({
      ...run,
      environment: Object.fromEntries(Object.entries(run.environment).filter(([key]) => !/(?:password|api.?key|token|credential)/i.test(key))),
      steps: run.steps.map(({ error: _error, evidence, ...step }) => ({
        ...step,
        ...(evidence ? { evidence: { source: evidence.source, ...(evidence.timeoutMs === undefined ? {} : { timeoutMs: evidence.timeoutMs }) } } : {}),
      })),
      logs: [],
    })).sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 5000),
    projectRevisions: normalizeLifecycleRecords(snapshot.projectRevisions, parseProjectRevision),
    buildArtifacts: normalizeLifecycleRecords(snapshot.buildArtifacts, parseBuildArtifact),
    firmwareIdentities: normalizeLifecycleRecords(snapshot.firmwareIdentities, parseFirmwareIdentity),
    communicationSessions: normalizeLifecycleRecords(snapshot.communicationSessions, parseCommunicationSession).filter(session => session.status !== 'active'),
  };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = (event) => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PROJECTS)) database.createObjectStore(PROJECTS, { keyPath: 'id' });
      if (!database.objectStoreNames.contains(RUNS)) { const store = database.createObjectStore(RUNS, { keyPath: 'id' }); store.createIndex('startedAt', 'startedAt'); }
      if (!database.objectStoreNames.contains(PROJECT_REVISIONS)) { const store = database.createObjectStore(PROJECT_REVISIONS, { keyPath: 'id' }); store.createIndex('projectId', 'projectId'); store.createIndex('capturedAt', 'capturedAt'); }
      if (!database.objectStoreNames.contains(BUILD_ARTIFACTS)) { const store = database.createObjectStore(BUILD_ARTIFACTS, { keyPath: 'id' }); store.createIndex('buildId', 'buildId'); store.createIndex('projectRevisionId', 'projectRevisionId'); }
      if (!database.objectStoreNames.contains(FIRMWARE_IDENTITIES)) { const store = database.createObjectStore(FIRMWARE_IDENTITIES, { keyPath: 'id' }); store.createIndex('buildArtifactId', 'buildArtifactId'); store.createIndex('sha256', 'sha256'); }
      if (!database.objectStoreNames.contains(COMMUNICATION_SESSIONS)) { const store = database.createObjectStore(COMMUNICATION_SESSIONS, { keyPath: 'id' }); store.createIndex('startedAt', 'startedAt'); store.createIndex('firmwareId', 'firmwareId'); }
      if (database.objectStoreNames.contains(LEGACY_SETTINGS)) database.deleteObjectStore(LEGACY_SETTINGS);
      if (database.objectStoreNames.contains(RUNS)) { const store = request.transaction!.objectStore(RUNS); if (store.indexNames.contains('projectId')) store.deleteIndex('projectId'); }
      if (database.objectStoreNames.contains(COMMUNICATION_SESSIONS)) { const store = request.transaction!.objectStore(COMMUNICATION_SESSIONS); if (store.indexNames.contains('deviceId')) store.deleteIndex('deviceId'); }
      if ((event as IDBVersionChangeEvent).oldVersion < 3) {
        const stripFields = (storeName: string, fields: string[], patch: Record<string, unknown> = {}) => {
          if (!database.objectStoreNames.contains(storeName)) return;
          const cursorRequest = request.transaction!.objectStore(storeName).openCursor();
          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result;
            if (!cursor) return;
            const source = cursor.value as Record<string, unknown>, next = { ...source, ...patch };
            fields.forEach(field => delete next[field]); cursor.update(next); cursor.continue();
          };
        };
        stripFields(PROJECTS, ['devices'], { schemaVersion: 3 });
        stripFields(RUNS, ['projectId', 'deviceId', 'device'], { schemaVersion: 3 });
        stripFields(COMMUNICATION_SESSIONS, ['projectId', 'deviceId']);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readAll<T>(storeName: string): Promise<T[]> {
  const database = await openDatabase();
  return await new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly');
    const request = transaction.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

async function put<T>(storeName: string, value: T): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).put(value);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => reject(transaction.error);
  });
}

async function remove(storeName: string, key: IDBValidKey): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).delete(key);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function listEngineeringProjects() { return (await readAll<EngineeringProject>(PROJECTS)).map(normalizeEngineeringProject).filter((item): item is EngineeringProject => item !== null).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); }
export async function saveEngineeringProject(project: EngineeringProject) { const normalized = normalizeEngineeringProject({ ...project, updatedAt: new Date().toISOString() }); if (!normalized) throw new Error('工程项目数据无效或超过资源上限'); await put(PROJECTS, normalized); }
export async function deleteEngineeringProject(id: string) { await remove(PROJECTS, id); }
export async function listTestRuns() { return (await readAll<TestRunRecord>(RUNS)).map(normalizeTestRunRecord).sort((a, b) => b.startedAt.localeCompare(a.startedAt)); }
export async function saveTestRun(run: TestRunRecord) { await put(RUNS, run); }
export async function deleteTestRun(id: string) { await remove(RUNS, id); }
export async function listProjectRevisions() { return normalizeLifecycleRecords(await readAll<ProjectRevision>(PROJECT_REVISIONS), parseProjectRevision).sort((a, b) => b.capturedAt.localeCompare(a.capturedAt)); }
export async function saveProjectRevision(value: ProjectRevision) { const record = parseProjectRevision(value); if (!record) throw new Error('Invalid project revision'); await put(PROJECT_REVISIONS, record); }
export async function listBuildArtifacts() { return normalizeLifecycleRecords(await readAll<BuildArtifact>(BUILD_ARTIFACTS), parseBuildArtifact).sort((a, b) => b.capturedAt.localeCompare(a.capturedAt)); }
export async function saveBuildArtifact(value: BuildArtifact) { const record = parseBuildArtifact(value); if (!record) throw new Error('Invalid build artifact'); await put(BUILD_ARTIFACTS, record); }
export async function listFirmwareIdentities() { return normalizeLifecycleRecords(await readAll<FirmwareIdentity>(FIRMWARE_IDENTITIES), parseFirmwareIdentity).sort((a, b) => b.capturedAt.localeCompare(a.capturedAt)); }
export async function saveFirmwareIdentity(value: FirmwareIdentity) { const record = parseFirmwareIdentity(value); if (!record) throw new Error('Invalid firmware identity'); await put(FIRMWARE_IDENTITIES, record); }
export async function saveFirmwareArtifactIdentity(artifactValue: BuildArtifact, firmwareValue: FirmwareIdentity): Promise<void> {
  const artifact = parseBuildArtifact(artifactValue), firmware = parseFirmwareIdentity(firmwareValue);
  if (!artifact || !firmware || firmware.buildArtifactId !== artifact.id) throw new Error('固件身份与构建产物关系无效');
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction([BUILD_ARTIFACTS, FIRMWARE_IDENTITIES], 'readwrite');
    transaction.objectStore(BUILD_ARTIFACTS).put(artifact);
    transaction.objectStore(FIRMWARE_IDENTITIES).put(firmware);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
    transaction.onabort = () => { database.close(); reject(transaction.error ?? new Error('固件身份保存已中止')); };
  });
}
export async function listCommunicationSessions() { return normalizeLifecycleRecords(await readAll<CommunicationSession>(COMMUNICATION_SESSIONS), parseCommunicationSession).sort((a, b) => b.startedAt.localeCompare(a.startedAt)); }
export async function saveCommunicationSession(value: CommunicationSession) { const record = parseCommunicationSession(value); if (!record) throw new Error('Invalid communication session'); await put(COMMUNICATION_SESSIONS, record); }
export async function saveTestRunWithCommunicationSessions(runValue: TestRunRecord, sessionValues: CommunicationSession[]): Promise<TestRunRecord> {
  const sessions = normalizeLifecycleRecords(sessionValues, parseCommunicationSession);
  if (sessions.length !== sessionValues.length) throw new Error('测试通信会话数据无效');
  const run = normalizeTestRunRecord({ ...runValue, communicationSessionIds: sessions.map(session => session.id) });
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction([RUNS, COMMUNICATION_SESSIONS], 'readwrite');
    sessions.forEach(session => transaction.objectStore(COMMUNICATION_SESSIONS).put(session));
    transaction.objectStore(RUNS).put(run);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
    transaction.onabort = () => { database.close(); reject(transaction.error ?? new Error('测试运行与通信会话保存已中止')); };
  });
  return run;
}
export async function exportProductData(): Promise<ProductDataSnapshot> {
  const [projects, runs, projectRevisions, buildArtifacts, firmwareIdentities, communicationSessions] = await Promise.all([
    readAll<EngineeringProject>(PROJECTS),
    readAll<TestRunRecord>(RUNS),
    readAll<ProjectRevision>(PROJECT_REVISIONS),
    readAll<BuildArtifact>(BUILD_ARTIFACTS),
    readAll<FirmwareIdentity>(FIRMWARE_IDENTITIES),
    readAll<CommunicationSession>(COMMUNICATION_SESSIONS),
  ]);
  return createPortableProductData({ projects, runs, projectRevisions, buildArtifacts, firmwareIdentities, communicationSessions });
}

export async function mergeProductData(snapshot: ProductDataSnapshot): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction([PROJECTS, RUNS, PROJECT_REVISIONS, BUILD_ARTIFACTS, FIRMWARE_IDENTITIES, COMMUNICATION_SESSIONS], 'readwrite');
    const projects = transaction.objectStore(PROJECTS), runs = transaction.objectStore(RUNS);
    snapshot.projects.map(normalizeEngineeringProject).filter((item): item is EngineeringProject => item !== null).forEach(project => projects.put(project));
    snapshot.runs.forEach(run => runs.put(normalizeTestRunRecord(run)));
    normalizeLifecycleRecords(snapshot.projectRevisions, parseProjectRevision).forEach(item => transaction.objectStore(PROJECT_REVISIONS).put(item));
    normalizeLifecycleRecords(snapshot.buildArtifacts, parseBuildArtifact).forEach(item => transaction.objectStore(BUILD_ARTIFACTS).put(item));
    normalizeLifecycleRecords(snapshot.firmwareIdentities, parseFirmwareIdentity).forEach(item => transaction.objectStore(FIRMWARE_IDENTITIES).put(item));
    normalizeLifecycleRecords(snapshot.communicationSessions, parseCommunicationSession).forEach(item => transaction.objectStore(COMMUNICATION_SESSIONS).put(item));
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
    transaction.onabort = () => { database.close(); reject(transaction.error ?? new Error('工作区数据导入已中止')); };
  });
}
