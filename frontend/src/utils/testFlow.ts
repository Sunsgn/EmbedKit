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
