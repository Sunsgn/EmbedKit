import type { FileNode } from '../../types';
import type { EngineeringProject } from '../../types/product';
import {
  createProjectRevisionId,
  createWorkspaceFingerprint,
  saveProjectWorkspace,
} from '../../services/workspaceStorage';

const MIB = 1024 * 1024;
const PROJECT_FILE_PATTERN = /\.(c|cc|cpp|h|hpp|s|S|ld|sct|icf|ioc|uvprojx|uvoptx|ewp|eww|mk|txt|md|map|hex|cmake|json|yml|yaml|toml|ini|conf|config|dts|dtsi|overlay|py)$/i;
const EXACT_PROJECT_FILES = new Set(['Makefile', 'CMakeLists.txt', 'Kconfig', 'sdkconfig', 'SConstruct']);

export type ProjectImportErrorCode = 'zip_unsupported' | 'no_supported_files' | 'file_too_large' | 'total_too_large' | 'read_failed';

export class ProjectImportError extends Error {
  readonly code: ProjectImportErrorCode;

  constructor(code: ProjectImportErrorCode, message: string) {
    super(message);
    this.name = 'ProjectImportError';
    this.code = code;
  }
}

export interface ProjectImportInput {
  files: readonly File[];
  requestedProjectId: string;
  engineeringProject: EngineeringProject | null;
  recordRevision: (project: EngineeringProject, revisionId: string, fingerprint: string, importedAt: string) => Promise<void>;
}

interface ProjectImportDependencies {
  fingerprint: typeof createWorkspaceFingerprint;
  revisionId: typeof createProjectRevisionId;
  saveProject: typeof saveProjectWorkspace;
  now: () => string;
}

const defaultDependencies: ProjectImportDependencies = {
  fingerprint: createWorkspaceFingerprint,
  revisionId: createProjectRevisionId,
  saveProject: saveProjectWorkspace,
  now: () => new Date().toISOString(),
};

function fileLanguage(file: File): FileNode['language'] {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'text';
  if (ext === 'h' || ext === 'hpp') return 'h';
  if (ext === 'cpp' || ext === 'cc') return 'cpp';
  if (ext === 'c') return 'c';
  if (ext === 'cmake' || file.name === 'Makefile') return 'makefile';
  return 'text';
}

export async function importProjectFiles(input: ProjectImportInput, overrides: Partial<ProjectImportDependencies> = {}) {
  const dependencies = { ...defaultDependencies, ...overrides };
  if (input.files.some(file => /\.zip$/i.test(file.name))) {
    throw new ProjectImportError('zip_unsupported', '暂不支持直接解析 ZIP。请解压后选择工程目录，或多选工程文件。');
  }
  const selected = input.files.filter(file => PROJECT_FILE_PATTERN.test(file.name) || EXACT_PROJECT_FILES.has(file.name));
  if (!selected.length) {
    throw new ProjectImportError('no_supported_files', '没有找到可分析的工程文件，请选择 C/C++、Makefile、CMake、Keil 或 IAR 文件。');
  }
  if (selected.some(file => file.size > (/\.map$/i.test(file.name) ? 20 : 2) * MIB)) {
    throw new ProjectImportError('file_too_large', '源码和配置文件单个不能超过 2 MB，MAP 文件不能超过 20 MB。');
  }
  if (selected.reduce((total, file) => total + file.size, 0) > 50 * MIB) {
    throw new ProjectImportError('total_too_large', '可分析文件总大小不能超过 50 MB。');
  }

  let files: FileNode[];
  try {
    files = await Promise.all(selected.map(async file => ({
      name: file.name,
      path: `/${file.webkitRelativePath || file.name}`,
      content: await file.text(),
      language: fileLanguage(file),
      size: file.size,
      lastModified: file.lastModified,
    })));
  } catch (reason) {
    throw new ProjectImportError('read_failed', `工程文件读取失败：${reason instanceof Error ? reason.message : String(reason)}`);
  }
  const activeFile = files.find(file => /\.(c|cpp)$/i.test(file.name))?.path || files[0].path;
  const projectName = input.engineeringProject?.name ?? selected[0].webkitRelativePath?.split('/')[0] ?? 'imported_project';

  let association: { revisionId: string; sourceFingerprint: string; importedAt: string } | null = null;
  if (input.requestedProjectId && input.engineeringProject) {
    const sourceFingerprint = await dependencies.fingerprint(files);
    const importedAt = dependencies.now();
    const revisionId = await dependencies.revisionId(input.requestedProjectId, sourceFingerprint);
    await dependencies.saveProject({ schemaVersion: 1, projectId: input.requestedProjectId, revisionId, name: input.engineeringProject.name, files, activeFile, importedAt, sourceFingerprint });
    await input.recordRevision(input.engineeringProject, revisionId, sourceFingerprint, importedAt);
    association = { revisionId, sourceFingerprint, importedAt };
  }

  return { files, activeFile, projectName, association };
}
