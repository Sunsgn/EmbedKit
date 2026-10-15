import type { ProjectArtifactSummary, ProjectInventory, ProjectRecognition } from '../types/product';
import { agentRequest } from './agentClient';

export interface ProjectScanResult {
  schemaVersion: 1;
  rootName: string;
  durationMs: number;
  recognition: ProjectRecognition;
  inventory: ProjectInventory;
  artifacts: ProjectArtifactSummary[];
}

export function scanSelectedProject(selectionId: string) {
  return agentRequest<ProjectScanResult>('/api/projects/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ selectionId, maxFiles: 5000, maxDepth: 12 }),
  }, 20_000);
}
