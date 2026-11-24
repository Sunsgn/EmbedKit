import { describe, expect, it } from 'vitest';
import { inferProjectEnvironmentRequirements } from './projectEnvironmentInference';
import type { ProjectScanResult } from '../../services/projectScan';

describe('project environment inference registry', () => {
  it('maps recognized tools to deduplicated optional requirements with evidence', () => {
    const scan = { recognition: { buildSystems: ['CMake', 'CMake', 'Unknown'], ides: ['IAR Embedded Workbench'], evidence: [{ value: 'CMake', path: 'CMakeLists.txt', detail: 'project()' }, { value: 'IAR Embedded Workbench', path: 'app.ewp', detail: '工程文件' }] } } as ProjectScanResult;
    expect(inferProjectEnvironmentRequirements(scan)).toEqual(expect.arrayContaining([
      expect.objectContaining({ capabilityId: 'build.cmake', evidence: 'CMakeLists.txt：project()' }),
      expect.objectContaining({ capabilityId: 'ide.iar.ew', evidence: 'app.ewp：工程文件' }),
    ]));
    expect(inferProjectEnvironmentRequirements(scan)).toHaveLength(2);
  });
});
