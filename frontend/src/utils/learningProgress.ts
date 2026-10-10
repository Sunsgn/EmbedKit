export interface ModuleLearningProgress {
  checklist: string[];
  evidence: string;
  updatedAt: string;
}

export interface LearningProgress {
  version: 1;
  modules: Record<string, ModuleLearningProgress>;
}

export const emptyLearningProgress = (): LearningProgress => ({
  version: 1,
  modules: {},
});

export function parseLearningProgress(value: string | null): LearningProgress {
  if (!value) return emptyLearningProgress();
  try {
    const parsed = JSON.parse(value) as Partial<LearningProgress>;
    if (!parsed.modules || typeof parsed.modules !== "object")
      return emptyLearningProgress();
    const modules = Object.fromEntries(
      Object.entries(parsed.modules).flatMap(([id, item]) => {
        if (!item || typeof item !== "object") return [];
        const candidate = item as Partial<ModuleLearningProgress>;
        return [[id, {
          checklist: Array.isArray(candidate.checklist)
            ? candidate.checklist.filter(value => typeof value === "string")
            : [],
          evidence: typeof candidate.evidence === "string" ? candidate.evidence : "",
          updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : "",
        }]];
      }),
    );
    return { version: 1, modules };
  } catch {
    return emptyLearningProgress();
  }
}

export function updateModuleProgress(
  progress: LearningProgress,
  moduleId: string,
  patch: Partial<Pick<ModuleLearningProgress, "checklist" | "evidence">>,
  updatedAt = new Date().toISOString(),
): LearningProgress {
  const current = progress.modules[moduleId] ?? {
    checklist: [],
    evidence: "",
    updatedAt: "",
  };
  return {
    version: 1,
    modules: {
      ...progress.modules,
      [moduleId]: { ...current, ...patch, updatedAt },
    },
  };
}

export function moduleCompletion(
  progress: ModuleLearningProgress | undefined,
  requiredChecklist: string[],
) {
  const checked = requiredChecklist.filter(item =>
      progress?.checklist.includes(item),
    ).length,
    evidenceReady = Boolean(progress?.evidence.trim()),
    complete = requiredChecklist.length
      ? checked === requiredChecklist.length && evidenceReady
      : evidenceReady;
  return { checked, total: requiredChecklist.length, evidenceReady, complete };
}
