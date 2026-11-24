import { createEnvironmentRequirement } from '../../services/projectModel';
import type { ProjectScanResult } from '../../services/projectScan';
import type { ProjectEnvironmentRequirement } from '../../types/product';

interface EnvironmentRule { capabilityId: string; displayName: string }

export const projectEnvironmentRuleRegistry: Readonly<Record<string, EnvironmentRule>> = {
  CMake: { capabilityId: 'build.cmake', displayName: 'CMake' },
  Make: { capabilityId: 'build.make', displayName: 'Make' },
  Meson: { capabilityId: 'build.meson', displayName: 'Meson' },
  PlatformIO: { capabilityId: 'build.platformio', displayName: 'PlatformIO' },
  'Keil µVision': { capabilityId: 'ide.keil.uvision', displayName: 'Keil µVision' },
  'IAR Embedded Workbench': { capabilityId: 'ide.iar.ew', displayName: 'IAR Embedded Workbench' },
};

export function inferProjectEnvironmentRequirements(scan: ProjectScanResult): ProjectEnvironmentRequirement[] {
  return [...scan.recognition.buildSystems, ...scan.recognition.ides].flatMap(value => {
    const rule = projectEnvironmentRuleRegistry[value];
    if (!rule) return [];
    const evidence = scan.recognition.evidence.find(item => item.value === value);
    return [{ ...createEnvironmentRequirement(rule.displayName), capabilityId: rule.capabilityId, source: 'deterministic-analysis' as const, evidence: evidence?.path ? `${evidence.path}：${evidence.detail}` : '工程目录扫描结果' }];
  }).filter((item, index, all) => all.findIndex(other => other.capabilityId === item.capabilityId) === index);
}
