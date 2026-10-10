import { agentRequest } from './agentClient';
import type { LocalPathSelection } from './localFiles';

export type BuildSystem = 'cmake' | 'make' | 'ninja';
export type BuildAction = 'configure' | 'build' | 'clean' | 'rebuild';
export interface BuildDiagnostic { file: string; line: number; column: number; severity: 'error' | 'warning' | 'note'; message: string }
export interface BuildEvent { id: number; timestamp: string; stream: 'stdout' | 'stderr' | 'system'; text: string; diagnostic?: BuildDiagnostic }
export interface BuildArtifact { name: string; path: string; type: string; size: number; modifiedAt: string }
export interface BuildJob { id: string; state: 'running' | 'stopping' | 'passed' | 'failed' | 'cancelled'; exitCode: number | null; startedAt: string; finishedAt: string; artifacts?: BuildArtifact[]; events: BuildEvent[]; system?: BuildSystem; action?: BuildAction; configuration?: 'Debug' | 'Release'; executable?: string; rootPath?: string; buildPath?: string }
export interface BuildDetection { rootPath: string; system: BuildSystem | ''; buildDir: string; projectFiles: string[]; tools: Array<{ executable: string; available: boolean; version: string }> }
export interface BuildJobOptions { rootPath: string; system: BuildSystem; buildDir: string; configuration: 'Debug' | 'Release'; toolPath: string; action: BuildAction }
export interface BuildArtifactHash { algorithm: 'sha256'; digest: string; size: number; modifiedAt: string }

export function detectBuildEnvironment(rootPath: string) {
  return agentRequest<BuildDetection>('/api/build/detect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rootPath }) });
}
export function createBuildJob(options: BuildJobOptions) {
  return agentRequest<BuildJob>('/api/build/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(options) });
}
export function readBuildJob(id: string, after = 0) { return agentRequest<BuildJob>(`/api/build/jobs/${id}?after=${after}`); }
export function stopBuildJob(id: string) { return agentRequest<BuildJob>(`/api/build/jobs/${id}`, { method: 'DELETE' }); }
export function authorizeBuildArtifact(jobId: string, artifactIndex: number) { return agentRequest<LocalPathSelection>(`/api/build/jobs/${jobId}/artifacts/${artifactIndex}/select`, { method: 'POST' }); }
export function hashBuildArtifact(jobId: string, artifactIndex: number) { return agentRequest<BuildArtifactHash>(`/api/build/jobs/${jobId}/artifacts/${artifactIndex}/hash`, { method: 'POST' }, 120000); }
