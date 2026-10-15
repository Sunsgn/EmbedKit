import { describe, expect, it } from 'vitest';
import { createEnvironmentRequirement, createProjectFeature, normalizeEngineeringProject, PROJECT_ENVIRONMENT_REQUIREMENT_LIMIT, PROJECT_FEATURE_LIMIT } from './projectModel';

const legacyProject = () => ({ id: 'project-1', name: '控制器', productModel: '', chipModel: '', description: '旧说明', tags: [], devices: [], createdAt: '', updatedAt: '2026-10-14T00:00:00.000Z' });

describe('project model', () => {
  it('migrates a legacy device project without losing its stable identity', () => {
    expect(normalizeEngineeringProject(legacyProject())).toMatchObject({ schemaVersion: 4, id: 'project-1', description: '旧说明', features: [], environmentRequirements: [], resourceLinks: [], source: { kind: 'manual' }, pathStatus: 'unverified' });
  });

  it('preserves structured features and their explicit confirmation state', () => {
    const feature = { ...createProjectFeature('温度采集'), source: 'external-ai' as const, status: 'confirmed' as const, inputs: ['ADC'], outputs: ['温度'] };
    const result = normalizeEngineeringProject({ ...legacyProject(), features: [feature] });
    expect(result?.features?.[0]).toMatchObject({ name: '温度采集', source: 'external-ai', status: 'confirmed', inputs: ['ADC'], outputs: ['温度'] });
  });

  it('preserves environment requirements and rejects invalid or unbounded collections', () => {
    const requirement = { ...createEnvironmentRequirement('Arm Compiler 6'), capabilityId: 'compiler.arm.ac6', versionRange: '>=6.18' };
    expect(normalizeEngineeringProject({ ...legacyProject(), environmentRequirements: [requirement] })?.environmentRequirements?.[0]).toMatchObject({ capabilityId: 'compiler.arm.ac6', versionRange: '>=6.18' });
    expect(normalizeEngineeringProject({ ...legacyProject(), features: Array(PROJECT_FEATURE_LIMIT + 1).fill({}) })).toBeNull();
    expect(normalizeEngineeringProject({ ...legacyProject(), environmentRequirements: Array(PROJECT_ENVIRONMENT_REQUIREMENT_LIMIT + 1).fill({}) })).toBeNull();
  });

  it('rejects malformed project records instead of silently accepting them', () => {
    expect(normalizeEngineeringProject({ ...legacyProject(), devices: 'legacy data is ignored' })).not.toHaveProperty('devices');
    expect(normalizeEngineeringProject({ ...legacyProject(), features: [{ id: 'missing-name' }] })).toBeNull();
  });

  it('preserves bounded scan evidence while removing an absolute source path', () => {
    const result = normalizeEngineeringProject({ ...legacyProject(), source: { kind: 'local-directory', displayName: 'D:\\secret\\firmware' }, recognition: { projectTypes: [], frameworks: ['FreeRTOS'], ides: [], toolchains: [], buildSystems: [], chipCandidates: [], confidence: 0.8, evidence: [{ category: 'frameworks', value: 'FreeRTOS', path: 'FreeRTOSConfig.h', confidence: 'high', detail: 'marker' }], unknowns: [] }, inventory: { scannedAt: '2026-10-15T00:00:00.000Z', fileCount: 1, directoryCount: 0, sourceFileCount: 1, configFileCount: 0, artifactCount: 0, maxFiles: 5000, maxDepth: 12, truncated: false, entries: [{ path: 'main.c', kind: 'file', category: 'source', byteLength: 10 }], warnings: [] }, artifacts: [] });
    expect(result?.source?.displayName).toBe('firmware');
    expect(result?.recognition?.evidence[0].path).toBe('FreeRTOSConfig.h');
  });
});
