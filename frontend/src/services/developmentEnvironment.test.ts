import { describe, expect, it } from 'vitest';
import { resolveEnvironmentRequirements, satisfiesVersionRange } from './developmentEnvironment';
import type { ProjectEnvironmentRequirement } from '../types/product';
import type { DetectedSoftwareInstallation } from '../types/developmentEnvironment';

const requirement = (patch: Partial<ProjectEnvironmentRequirement> = {}): ProjectEnvironmentRequirement => ({ id: 'r1', capabilityId: 'build.cmake', displayName: 'CMake', versionRange: '>=3.28 <4', optional: false, source: 'user', evidence: '', ...patch });
const installation = (version: string): DetectedSoftwareInstallation => ({ id: `cmake-${version}`, capabilityId: 'build.cmake', name: 'CMake', available: true, executable: 'cmake', version, rawVersion: `cmake version ${version}`, detection: 'path-command', durationMs: 1 });

describe('development environment resolution', () => {
  it('compares common numeric version ranges conservatively', () => {
    expect(satisfiesVersionRange('3.30.5', '>=3.28 <4')).toBe(true);
    expect(satisfiesVersionRange('3.20', '>=3.28')).toBe(false);
    expect(satisfiesVersionRange('6.21.0', '6.21')).toBe(true);
    expect(satisfiesVersionRange('unknown', '>=1')).toBeNull();
    expect(satisfiesVersionRange('3.30', '^3.20')).toBeNull();
  });

  it('selects the newest satisfying instance and explains missing or incompatible tools', () => {
    const matched = resolveEnvironmentRequirements([requirement()], [installation('3.29'), installation('3.30')])[0];
    expect(matched).toMatchObject({ status: 'satisfied', blocking: false, installation: { version: '3.30' } });
    expect(resolveEnvironmentRequirements([requirement()], [installation('3.20')])[0]).toMatchObject({ status: 'incompatible', blocking: true });
    expect(resolveEnvironmentRequirements([requirement({ optional: true })], [])[0]).toMatchObject({ status: 'missing', blocking: false });
  });
});
