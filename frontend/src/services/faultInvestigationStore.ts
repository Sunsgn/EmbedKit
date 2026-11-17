import {
  FAULT_INVESTIGATION_SCHEMA_VERSION,
  type FaultInvestigation,
} from "../types/faultInvestigation";
import {
  normalizeEvidenceReferences,
  normalizeFindings,
} from "./evidenceModel";

const DATABASE = "embedkit-fault-investigations";
const STORE = "investigations";
const MAX_RECORDS = 100;
const MAX_LOG_BYTES = 1024 * 1024;
const MAX_RESOLUTIONS = 500;

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const safeId = (value: unknown) =>
  typeof value === "string" && /^[\w.-]{1,128}$/.test(value);
const logBytes = (value: string) => new TextEncoder().encode(value).byteLength;

export function normalizeFaultInvestigation(
  value: unknown,
): FaultInvestigation | null {
  if (
    !isObject(value) ||
    value.schemaVersion !== FAULT_INVESTIGATION_SCHEMA_VERSION ||
    !safeId(value.id) ||
    typeof value.title !== "string" ||
    value.title.length > 240
  )
    return null;
  if (
    !isObject(value.input) ||
    !isObject(value.input.registers) ||
    (typeof value.input.rawLog === "string" &&
      logBytes(value.input.rawLog) > MAX_LOG_BYTES)
  )
    return null;
  if (
    !Array.isArray(value.artifacts) ||
    !Array.isArray(value.addressResolutions) ||
    value.addressResolutions.length > MAX_RESOLUTIONS ||
    !Array.isArray(value.conflicts) ||
    !Array.isArray(value.unknowns)
  )
    return null;
  if (
    !["draft", "resolving", "investigating", "fixed", "unresolved"].includes(
      String(value.status),
    ) ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string"
  )
    return null;
  const registers: Record<string, number> = {};
  for (const [name, item] of Object.entries(value.input.registers)) {
    if (
      /^[a-z][\w-]{0,31}$/i.test(name) &&
      typeof item === "number" &&
      Number.isInteger(item) &&
      item >= 0 &&
      item <= 0xffffffff
    )
      registers[name] = item;
  }
  return {
    ...(value as unknown as FaultInvestigation),
    schemaVersion: 1,
    title: value.title.trim() || "未命名故障调查",
    input: {
      ...(typeof value.input.rawLog === "string"
        ? { rawLog: value.input.rawLog }
        : {}),
      registers,
    },
    evidenceReferences: normalizeEvidenceReferences(value.evidenceReferences),
    findings: normalizeFindings(value.findings),
    unknowns: value.unknowns
      .filter((item): item is string => typeof item === "string")
      .slice(0, 500),
  };
}

function openDatabase(): Promise<IDBDatabase> {
  if (!globalThis.indexedDB)
    return Promise.reject(
      new Error("当前浏览器不支持 IndexedDB，无法保存故障调查"),
    );
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE))
        request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function complete(transaction: IDBTransaction, database: IDBDatabase) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("故障调查存储事务已取消"));
    };
  });
}

export async function listFaultInvestigations(): Promise<FaultInvestigation[]> {
  const database = await openDatabase(),
    transaction = database.transaction(STORE, "readonly"),
    request = transaction.objectStore(STORE).getAll();
  const done = complete(transaction, database);
  const values = await new Promise<unknown[]>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await done;
  return values
    .map(normalizeFaultInvestigation)
    .filter((item): item is FaultInvestigation => Boolean(item))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, MAX_RECORDS);
}

export async function saveFaultInvestigation(
  value: FaultInvestigation,
): Promise<FaultInvestigation> {
  const normalized = normalizeFaultInvestigation(value);
  if (!normalized) throw new Error("故障调查数据无效或超出资源上限");
  const existing = await listFaultInvestigations();
  if (
    !existing.some((item) => item.id === normalized.id) &&
    existing.length >= MAX_RECORDS
  )
    throw new Error(`最多保存 ${MAX_RECORDS} 份故障调查，请先导出或删除旧记录`);
  const database = await openDatabase(),
    transaction = database.transaction(STORE, "readwrite");
  transaction.objectStore(STORE).put(normalized);
  await complete(transaction, database);
  return normalized;
}

export async function deleteFaultInvestigation(id: string) {
  if (!safeId(id)) throw new Error("故障调查标识无效");
  const database = await openDatabase(),
    transaction = database.transaction(STORE, "readwrite");
  transaction.objectStore(STORE).delete(id);
  await complete(transaction, database);
}

export async function deleteFaultInvestigationDatabaseForTests() {
  if (!globalThis.indexedDB) return;
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("故障调查数据库仍被占用"));
  });
}

export function createFaultInvestigation(
  input: Partial<
    Pick<FaultInvestigation, "title" | "architecture" | "faultKind">
  > & { rawLog?: string; registers?: Record<string, number> } = {},
): FaultInvestigation {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    title: input.title || "Cortex-M 故障调查",
    architecture: input.architecture || "cortex-m",
    faultKind: input.faultKind || "hardfault",
    status: "draft",
    input: {
      ...(input.rawLog ? { rawLog: input.rawLog } : {}),
      registers: input.registers ?? {},
    },
    artifacts: [],
    addressResolutions: [],
    evidenceReferences: [],
    findings: [],
    conflicts: [],
    unknowns: [],
    createdAt: now,
    updatedAt: now,
  };
}
