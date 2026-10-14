import { describe, expect, it } from 'vitest';
import { createEnvironmentRequirement, createProjectFeature, normalizeDeviceProject, PROJECT_ENVIRONMENT_REQUIREMENT_LIMIT, PROJECT_FEATURE_LIMIT } from './projectModel';

const legacyProject = () => ({ id: 'project-1', name: '控制器', productModel: '', chipModel: '', description: '旧说明', tags: [], devices: [], createdAt: '', updatedAt: '2026-10-14T00:00:00.000Z' });

describe('project model', () => {
  it('migrates a legacy device project without losing its stable identity', () => {
    expect(normalizeDeviceProject(legacyProject())).toMatchObject({ schemaVersion: 2, id: 'project-1', description: '旧说明', features: [], environmentRequirements: [], resourceLinks: [] });
  });

  it('preserves structured features and their explicit confirmation state', () => {
    const feature = { ...createProjectFeature('温度采集'), source: 'external-ai' as const, status: 'confirmed' as const, inputs: ['ADC'], outputs: ['温度'] };
    const result = normalizeDeviceProject({ ...legacyProject(), features: [feature] });
    expect(result?.features?.[0]).toMatchObject({ name: '温度采集', source: 'external-ai', status: 'confirmed', inputs: ['ADC'], outputs: ['温度'] });
  });

  it('preserves environment requirements and rejects invalid or unbounded collections', () => {
    const requirement = { ...createEnvironmentRequirement('Arm Compiler 6'), capabilityId: 'compiler.arm.ac6', versionRange: '>=6.18' };
    expect(normalizeDeviceProject({ ...legacyProject(), environmentRequirements: [requirement] })?.environmentRequirements?.[0]).toMatchObject({ capabilityId: 'compiler.arm.ac6', versionRange: '>=6.18' });
    expect(normalizeDeviceProject({ ...legacyProject(), features: Array(PROJECT_FEATURE_LIMIT + 1).fill({}) })).toBeNull();
    expect(normalizeDeviceProject({ ...legacyProject(), environmentRequirements: Array(PROJECT_ENVIRONMENT_REQUIREMENT_LIMIT + 1).fill({}) })).toBeNull();
  });

  it('rejects malformed project records instead of silently accepting them', () => {
    expect(normalizeDeviceProject({ ...legacyProject(), devices: 'invalid' })).toBeNull();
    expect(normalizeDeviceProject({ ...legacyProject(), features: [{ id: 'missing-name' }] })).toBeNull();
  });
});
