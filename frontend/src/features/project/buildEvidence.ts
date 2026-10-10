import type { BuildAction, BuildArtifact, BuildDiagnostic, BuildJob, BuildSystem } from '../../services/buildAgent';

export interface BuildEvidenceContext { projectPath: string; system: BuildSystem; action: BuildAction; configuration: 'Debug' | 'Release'; toolPath: string }
const basename = (value: string) => value.split(/[\\/]/).filter(Boolean).pop() || '';
const finiteDuration = (start: string, finish: string) => { const value = Date.parse(finish) - Date.parse(start); return Number.isFinite(value) && value >= 0 ? value : null; };
const sanitizeDiagnostic = (item: BuildDiagnostic) => ({ file: basename(item.file), line: item.line, column: item.column, severity: item.severity, message: item.message });
const sanitizeArtifact = (item: BuildArtifact, sha256?: string) => ({ name: basename(item.name), type: item.type, size: item.size, modifiedAt: item.modifiedAt, ...(sha256 ? { sha256 } : {}) });

export function createBuildEvidence(job: BuildJob, context: BuildEvidenceContext, generatedAt = new Date().toISOString(), artifactHashes: Record<number, string> = {}) {
  const diagnostics = job.events.flatMap(event => event.diagnostic ? [sanitizeDiagnostic(event.diagnostic)] : []);
  return {
    schema: 'embedkit.build-evidence', version: 1, generatedAt,
    build: {
      id: job.id, state: job.state, exitCode: job.exitCode, startedAt: job.startedAt, finishedAt: job.finishedAt || null,
      durationMs: job.finishedAt ? finiteDuration(job.startedAt, job.finishedAt) : null,
      projectName: basename(context.projectPath), system: job.system || context.system, action: job.action || context.action,
      configuration: job.configuration || context.configuration, tool: basename(job.executable || context.toolPath) || context.system,
    },
    summary: {
      artifacts: job.artifacts?.length || 0,
      errors: diagnostics.filter(item => item.severity === 'error').length,
      warnings: diagnostics.filter(item => item.severity === 'warning').length,
      notes: diagnostics.filter(item => item.severity === 'note').length,
    },
    artifacts: (job.artifacts || []).map((item, index) => sanitizeArtifact(item, artifactHashes[index])), diagnostics,
    privacy: 'Absolute project, build, artifact, and source paths are omitted.',
  };
}
