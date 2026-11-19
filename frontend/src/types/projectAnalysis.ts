export const PROJECT_ANALYSIS_RUN_SCHEMA_VERSION = 1 as const;

export type ProjectAnalysisStatus = 'completed' | 'failed';
export type ProjectAnalysisConfidence = 'low' | 'medium' | 'high';
export type ProjectAnalysisSeverity = 'low' | 'medium' | 'high';

export interface ProjectAnalysisEvidence {
  id: string;
  kind: 'source' | 'project-config' | 'runtime' | 'calculation';
  message: string;
  confidence: ProjectAnalysisConfidence;
  file?: string;
  line?: number;
}

export interface ProjectAnalysisFinding {
  id: string;
  severity: ProjectAnalysisSeverity;
  category: 'reliability' | 'performance' | 'memory' | 'security' | 'maintainability' | 'structure';
  title: string;
  recommendation: string;
  evidenceIds: string[];
}

export interface ProjectAnalysisRun {
  schemaVersion: typeof PROJECT_ANALYSIS_RUN_SCHEMA_VERSION;
  id: string;
  projectId: string;
  projectRevisionId: string;
  sourceFingerprint: string;
  inputFingerprint: string;
  dirty: boolean;
  status: ProjectAnalysisStatus;
  startedAt: string;
  finishedAt: string;
  analyzer: { name: 'embedkit-deterministic-project-analysis'; version: string };
  framework: { name: string; confidence: ProjectAnalysisConfidence; evidenceIds: string[] };
  coverage: {
    sourceFiles: number;
    parsedFunctions: number;
    callSites: number;
    resolvedCallSites: number;
    resolvedRate: number;
    runtimeEvents: number;
    runtimeRate?: number;
  };
  findings: ProjectAnalysisFinding[];
  unknowns: string[];
  evidence: ProjectAnalysisEvidence[];
  error?: { code: string; message: string };
}
