import { agentRequest } from './agentClient';

export type BuildSystem = 'cmake' | 'make' | 'ninja';
export type BuildAction = 'configure' | 'build' | 'clean' | 'rebuild';
export interface BuildDiagnostic { file: string; line: number; column: number; severity: 'error' | 'warning' | 'note'; message: string }
export interface BuildEvent { id: number; timestamp: string; stream: 'stdout' | 'stderr' | 'system'; text: string; diagnostic?: BuildDiagnostic }
export interface BuildArtifact { name: string; path: string; type: string; size: number; modifiedAt: string }
export interface BuildJob { id: string; state: 'running' | 'stopping' | 'passed' | 'failed' | 'cancelled'; exitCode: number | null; startedAt: string; finishedAt: string; artifacts?: BuildArtifact[]; events: BuildEvent[] }
export interface BuildDetection { rootPath: string; system: BuildSystem | ''; buildDir: string; projectFiles: string[]; tools: Array<{ executable: string; available: boolean; version: string }> }
export interface BuildJobOptions { rootPath: string; system: BuildSystem; buildDir: string; configuration: 'Debug' | 'Release'; toolPath: string; action: BuildAction }

export function detectBuildEnvironment(rootPath: string) {
  return agentRequest<BuildDetection>('/api/build/detect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rootPath }) });
}
export function createBuildJob(options: BuildJobOptions) {
  return agentRequest<BuildJob>('/api/build/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(options) });
}
export function readBuildJob(id: string, after = 0) { return agentRequest<BuildJob>(`/api/build/jobs/${id}?after=${after}`); }
export function stopBuildJob(id: string) { return agentRequest<BuildJob>(`/api/build/jobs/${id}`, { method: 'DELETE' }); }
