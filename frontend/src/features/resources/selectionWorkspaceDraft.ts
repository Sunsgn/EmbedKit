import type { FunctionSolution } from "../../types";
import { parseFunctionSolution } from "./functionSolutions";

export const SELECTION_WORKSPACE_DRAFT_KEY =
  "embedkit.selection-workspace-draft";
export const SELECTION_INTAKE_TEXT_LIMIT = 64 * 1024;
const MAX_DRAFT_BYTES = 512 * 1024;

export type SelectionIntakeKind =
  "requirement" | "recommendation" | "models" | "template";

export interface SelectionWorkspaceDraft {
  schemaVersion: 1;
  solution: FunctionSolution;
  intakeKind: SelectionIntakeKind;
  intakeText: string;
  targetRoleId?: string;
  updatedAt: string;
}

const byteLength = (value: string) =>
  new TextEncoder().encode(value).byteLength;

export function parseSelectionWorkspaceDraft(
  value: unknown,
): SelectionWorkspaceDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const draft = value as Record<string, unknown>;
  const solution = parseFunctionSolution(draft.solution);
  if (
    draft.schemaVersion !== 1 ||
    !solution ||
    !["requirement", "recommendation", "models", "template"].includes(
      String(draft.intakeKind),
    ) ||
    typeof draft.intakeText !== "string" ||
    draft.intakeText.length > SELECTION_INTAKE_TEXT_LIMIT ||
    typeof draft.updatedAt !== "string"
  )
    return null;
  const targetRoleId =
    typeof draft.targetRoleId === "string" &&
    solution.roles.some((role) => role.id === draft.targetRoleId)
      ? draft.targetRoleId
      : undefined;
  return {
    schemaVersion: 1,
    solution,
    intakeKind: draft.intakeKind as SelectionIntakeKind,
    intakeText: draft.intakeText,
    ...(targetRoleId ? { targetRoleId } : {}),
    updatedAt: draft.updatedAt,
  };
}

export function loadSelectionWorkspaceDraft(storage: Storage = localStorage) {
  try {
    const raw = storage.getItem(SELECTION_WORKSPACE_DRAFT_KEY);
    if (!raw || byteLength(raw) > MAX_DRAFT_BYTES) return null;
    return parseSelectionWorkspaceDraft(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveSelectionWorkspaceDraft(
  input: Omit<SelectionWorkspaceDraft, "schemaVersion" | "updatedAt">,
  storage: Storage = localStorage,
) {
  const draft: SelectionWorkspaceDraft = {
    schemaVersion: 1,
    ...input,
    intakeText: input.intakeText.slice(0, SELECTION_INTAKE_TEXT_LIMIT),
    updatedAt: new Date().toISOString(),
  };
  const serialized = JSON.stringify(draft);
  if (byteLength(serialized) > MAX_DRAFT_BYTES)
    throw new Error("选型工作区草稿超过 512 KiB，请保存正式方案或减少导入内容");
  storage.setItem(SELECTION_WORKSPACE_DRAFT_KEY, serialized);
  return draft;
}

export function clearSelectionWorkspaceDraft(storage: Storage = localStorage) {
  storage.removeItem(SELECTION_WORKSPACE_DRAFT_KEY);
}
