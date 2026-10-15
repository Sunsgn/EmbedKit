import { agentRequest } from './agentClient';
import type { EnvironmentResolution, SoftwareEnvironmentScan, DetectedSoftwareInstallation, SoftwareInstallJob, SoftwareInstallManifest } from '../types/developmentEnvironment';
import type { ProjectEnvironmentRequirement } from '../types/product';

const versionParts = (value: string) => (value.match(/\d+/g) ?? []).slice(0, 4).map(Number);

function compareVersions(left: string, right: string) {
  const a = versionParts(left), b = versionParts(right);
  if (!a.length || !b.length) return null;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference) return difference > 0 ? 1 : -1;
  }
  return 0;
}

export function satisfiesVersionRange(version: string, range: string): boolean | null {
  const expression = range.trim();
  if (!expression) return true;
  if (!version.trim()) return null;
  const clauses = expression.split(/\s+/).filter(Boolean);
  for (const clause of clauses) {
    const match = clause.match(/^(>=|<=|>|<|=)?\s*(\d+(?:[._-][0-9A-Za-z]+)*)$/);
    if (!match) return null;
    const comparison = compareVersions(version, match[2]);
    if (comparison === null) return null;
    const operator = match[1] ?? '=';
    if ((operator === '>=' && comparison < 0) || (operator === '<=' && comparison > 0) || (operator === '>' && comparison <= 0) || (operator === '<' && comparison >= 0) || (operator === '=' && comparison !== 0)) return false;
  }
  return true;
}

const compareInstallationVersions = (left: DetectedSoftwareInstallation, right: DetectedSoftwareInstallation) => compareVersions(right.version, left.version) ?? 0;

export function resolveEnvironmentRequirements(requirements: ProjectEnvironmentRequirement[], installations: DetectedSoftwareInstallation[]): EnvironmentResolution[] {
  return requirements.map(requirement => {
    const candidates = installations.filter(item => item.capabilityId === requirement.capabilityId).sort(compareInstallationVersions);
    const matched = candidates.find(item => satisfiesVersionRange(item.version, requirement.versionRange) === true);
    if (matched) return { requirement, status: 'satisfied', installation: matched, candidates, blocking: false, reason: `${matched.name} ${matched.version || '版本未知'} 满足要求` };
    if (!candidates.length) return { requirement, status: 'missing', candidates, blocking: !requirement.optional, reason: `未检测到提供 ${requirement.capabilityId || requirement.displayName} 的软件` };
    if (candidates.some(item => satisfiesVersionRange(item.version, requirement.versionRange) === null)) return { requirement, status: 'unknown-version', candidates, blocking: !requirement.optional, reason: '已检测到软件，但版本信息或版本范围无法可靠比较' };
    return { requirement, status: 'incompatible', candidates, blocking: !requirement.optional, reason: `已安装版本不满足 ${requirement.versionRange || '工程要求'}` };
  });
}

export async function scanDevelopmentSoftware(timeoutMs = 20_000) {
  const result = await agentRequest<SoftwareEnvironmentScan>('/api/environment/installations', {}, timeoutMs);
  if (result.schemaVersion !== 1 || !Array.isArray(result.installations) || !Array.isArray(result.unavailable)) throw new Error('本地助手返回的开发环境数据无效');
  return result;
}

export async function listSoftwareInstallManifests() {
  const result = await agentRequest<{ schemaVersion: number; manifests: SoftwareInstallManifest[] }>('/api/environment/install-manifests');
  if (result.schemaVersion !== 1 || !Array.isArray(result.manifests)) throw new Error('本地助手返回的软件安装清单无效');
  return result.manifests;
}

export function createSoftwareInstallJob(manifestId: string, directorySelectionId: string, acceptedLicense = false) {
  return agentRequest<SoftwareInstallJob>('/api/environment/install-jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ manifestId, directorySelectionId, acceptedLicense }) }, 20_000);
}

export function getSoftwareInstallJob(jobId: string) { return agentRequest<SoftwareInstallJob>(`/api/environment/install-jobs/${jobId}`); }
export function cancelSoftwareInstallJob(jobId: string) { return agentRequest<SoftwareInstallJob>(`/api/environment/install-jobs/${jobId}`, { method: 'DELETE' }); }
