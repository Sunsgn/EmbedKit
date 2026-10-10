export interface FlowStepLike<C extends string = string> {
  id: string;
  type: string;
  channel: C;
}
export interface FlowCaseLike<T extends FlowStepLike = FlowStepLike> {
  sharedChannel?: boolean;
  channel?: T["channel"];
  steps: T[];
}

export interface StagedFlowStepLike extends FlowStepLike {
  stage?: "setup" | "test" | "teardown";
}

export interface FlowCleanup {
  name: string;
  run: () => void | Promise<void>;
}

const channelFreeTypes = new Set(["delay", "set-variable", "manual"]);
export const stepUsesChannel = (type: string) => !channelFreeTypes.has(type);

export function sharedFlowChannel<T extends FlowStepLike>(
  flow: FlowCaseLike<T>,
  fallback = "serial-a" as T["channel"],
): T["channel"] {
  return (
    flow.channel ??
    flow.steps.find((step) => stepUsesChannel(step.type))?.channel ??
    fallback
  );
}

export function resolvedFlowStep<T extends FlowStepLike>(
  flow: FlowCaseLike<T>,
  step: T,
): T {
  if (flow.sharedChannel === false || !stepUsesChannel(step.type)) return step;
  return { ...step, channel: sharedFlowChannel(flow) };
}

export function requiredFlowChannels<T extends FlowStepLike>(
  flow: FlowCaseLike<T>,
): T["channel"][] {
  return [
    ...new Set(
      flow.steps
        .filter((step) => stepUsesChannel(step.type))
        .map((step) => resolvedFlowStep(flow, step).channel),
    ),
  ];
}

export function applySharedFlowChannel<
  T extends FlowStepLike,
  F extends FlowCaseLike<T>,
>(flow: F, sharedChannel: boolean): F {
  const channel = sharedFlowChannel(flow);
  return {
    ...flow,
    sharedChannel,
    channel,
    steps: sharedChannel
      ? flow.steps.map((step) =>
          stepUsesChannel(step.type) ? { ...step, channel } : step,
        )
      : flow.steps,
  } as F;
}

export function orderedFlowSteps<T extends StagedFlowStepLike>(steps: T[]): T[] {
  const stageOrder = { setup: 0, test: 1, teardown: 2 } as const;
  return steps
    .map((step, index) => ({ step, index }))
    .sort(
      (left, right) =>
        stageOrder[left.step.stage ?? "test"] -
          stageOrder[right.step.stage ?? "test"] || left.index - right.index,
    )
    .map(({ step }) => step);
}

export function removeFlowStep<T extends FlowStepLike>(
  steps: T[],
  id: string,
  selectedId: string,
): { steps: T[]; selectedId: string } {
  const index = steps.findIndex((step) => step.id === id);
  if (index < 0) return { steps, selectedId };
  const remaining = steps.filter((step) => step.id !== id);
  if (selectedId !== id) return { steps: remaining, selectedId };
  return {
    steps: remaining,
    selectedId: remaining[Math.min(index, remaining.length - 1)]?.id ?? "",
  };
}

export function moveFlowStep<T extends FlowStepLike>(
  steps: T[],
  id: string,
  offset: number,
): T[] {
  const index = steps.findIndex((step) => step.id === id),
    next = index + offset;
  if (index < 0 || next < 0 || next >= steps.length || offset === 0)
    return steps;
  const reordered = [...steps];
  [reordered[index], reordered[next]] = [reordered[next], reordered[index]];
  return reordered;
}

export async function cleanupFlowResources(
  cleanups: FlowCleanup[],
): Promise<Array<{ name: string; error: string }>> {
  const results = await Promise.allSettled(
    cleanups.map(async (cleanup) => {
      await cleanup.run();
      return cleanup.name;
    }),
  );
  return results.flatMap((result, index) =>
    result.status === "rejected"
      ? [{
          name: cleanups[index].name,
          error: result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
        }]
      : [],
  );
}
