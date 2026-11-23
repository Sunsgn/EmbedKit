import type { FileNode } from '../../types';
import { PROJECT_WORKSPACE_MAX_FILES } from '../../services/workspaceStorage';

export type ProjectFileErrorCode = 'invalid_path' | 'duplicate_path' | 'limit_reached';

export class ProjectFileError extends Error {
  readonly code: ProjectFileErrorCode;

  constructor(code: ProjectFileErrorCode, message: string) {
    super(message);
    this.name = 'ProjectFileError';
    this.code = code;
  }
}

function languageFor(name: string): FileNode['language'] {
  const ext = name.split('.').pop()?.toLowerCase() || 'c';
  if (ext === 'h') return 'h';
  if (ext === 'cpp') return 'cpp';
  if (ext === 'toml') return 'toml';
  return 'c';
}

function normalizedRelativePath(value: string) {
  const input = value.trim().replace(/\\/g, '/');
  const hasControl = [...input].some(character => { const code = character.charCodeAt(0); return code < 32 || code === 127; });
  if (!input || input.startsWith('/') || /^[A-Za-z]:/.test(input) || hasControl || /[<>:"|?*]/.test(input)) {
    throw new ProjectFileError('invalid_path', '文件名必须是有效的相对路径');
  }
  const segments = input.split('/');
  if (segments.some(segment => !segment || segment === '.' || segment === '..' || segment.endsWith(' ') || segment.endsWith('.'))) {
    throw new ProjectFileError('invalid_path', '文件路径不能包含空目录、点目录或路径穿越');
  }
  return `/${segments.join('/')}`;
}

export function addProjectFile(files: readonly FileNode[], value: string) {
  if (files.length >= PROJECT_WORKSPACE_MAX_FILES) throw new ProjectFileError('limit_reached', `工程工作区最多保存 ${PROJECT_WORKSPACE_MAX_FILES} 个文件`);
  const path = normalizedRelativePath(value);
  if (files.some(file => file.path.toLowerCase() === path.toLowerCase())) throw new ProjectFileError('duplicate_path', `文件已存在：${path}`);
  const name = path.split('/').pop()!;
  const file: FileNode = { name, path, content: '', language: languageFor(name) };
  return { files: [...files, file], activeFile: path, file };
}

export function updateProjectFileContent(files: readonly FileNode[], path: string, content: string) {
  return files.map(file => file.path === path ? { ...file, content } : file);
}

export function deleteProjectFile(files: readonly FileNode[], activeFile: string, path: string) {
  const index = files.findIndex(file => file.path === path);
  if (index < 0) return { files: [...files], activeFile, removed: false };
  const remaining = files.filter(file => file.path !== path);
  const nextActiveFile = activeFile === path ? remaining[Math.min(index, remaining.length - 1)]?.path ?? '' : activeFile;
  return { files: remaining, activeFile: nextActiveFile, removed: true };
}
