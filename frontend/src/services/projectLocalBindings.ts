const STORAGE_KEY = 'embedkit.project-local-bindings';
const MAX_BINDINGS = 500;

export interface ProjectLocalBinding { projectId: string; path: string; verifiedAt: string }

function readBindings(storage: Storage = localStorage): ProjectLocalBinding[] {
  try {
    const value = JSON.parse(storage.getItem(STORAGE_KEY) || '[]') as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is ProjectLocalBinding => Boolean(item) && typeof item === 'object' && typeof (item as ProjectLocalBinding).projectId === 'string' && typeof (item as ProjectLocalBinding).path === 'string' && typeof (item as ProjectLocalBinding).verifiedAt === 'string').slice(0, MAX_BINDINGS);
  } catch { return []; }
}

export function listProjectLocalBindings(storage: Storage = localStorage) { return readBindings(storage); }
export function getProjectLocalBinding(projectId: string, storage: Storage = localStorage) { return readBindings(storage).find(item => item.projectId === projectId) ?? null; }
export function saveProjectLocalBinding(binding: ProjectLocalBinding, storage: Storage = localStorage) { const rest = readBindings(storage).filter(item => item.projectId !== binding.projectId); storage.setItem(STORAGE_KEY, JSON.stringify([binding, ...rest].slice(0, MAX_BINDINGS))); }
export function deleteProjectLocalBinding(projectId: string, storage: Storage = localStorage) { storage.setItem(STORAGE_KEY, JSON.stringify(readBindings(storage).filter(item => item.projectId !== projectId))); }
