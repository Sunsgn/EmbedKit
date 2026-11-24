import { describe, expect, it } from 'vitest';
import { createCollaborationHandoff } from './collaborationHandoff';
import { createEngineeringProject } from '../types/product';

describe('collaboration handoff', () => {
  it('exports real project metadata without local paths or source content', () => {
    const project = { ...createEngineeringProject('Motor controller'), pathStatus: 'available' as const, inventory: { scannedAt: '2026-01-01T00:00:00.000Z', fileCount: 1, directoryCount: 1, sourceFileCount: 1, configFileCount: 0, artifactCount: 0, totalBytes: 20, maxFiles: 800, maxDepth: 12, truncated: false, warnings: [], entries: [{ path: 'src/main.c', kind: 'file' as const, category: 'source' as const, byteLength: 20 }] } };
    const value = JSON.parse(createCollaborationHandoff([project], '2026-01-02T00:00:00.000Z'));
    expect(value).toMatchObject({ schema: 'embedkit.collaboration-handoff', version: 1, projects: [{ name: 'Motor controller', pathStatus: 'unverified', inventory: { entries: [] } }] });
    expect(JSON.stringify(value)).not.toMatch(/[A-Z]:\\|selectionId|int main/);
  });
});
