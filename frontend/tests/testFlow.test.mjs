import assert from "node:assert/strict";
import test from "node:test";
import {
  applySharedFlowChannel,
  requiredFlowChannels,
  resolvedFlowStep,
  sharedFlowChannel,
} from "../src/utils/testFlow.ts";

const steps = [
  { id: "1", type: "command", channel: "serial-b" },
  { id: "2", type: "delay", channel: "tcp" },
  { id: "3", type: "match", channel: "tcp" },
];

test("a shared test flow inherits the first selected communication channel", () => {
  const flow = { sharedChannel: true, steps };
  assert.equal(sharedFlowChannel(flow), "serial-b");
  assert.equal(resolvedFlowStep(flow, steps[2]).channel, "serial-b");
  assert.deepEqual(requiredFlowChannels(flow), ["serial-b"]);
});

test("channel-free steps stay independent while shared channels are applied", () => {
  const result = applySharedFlowChannel(
    { sharedChannel: false, channel: "serial-a", steps },
    true,
  );
  assert.equal(result.steps[0].channel, "serial-a");
  assert.equal(result.steps[1].channel, "tcp");
  assert.equal(result.steps[2].channel, "serial-a");
});

test("advanced flows can opt out and retain per-step channels", () => {
  const flow = { sharedChannel: false, channel: "serial-a", steps };
  assert.equal(resolvedFlowStep(flow, steps[2]).channel, "tcp");
  assert.deepEqual(requiredFlowChannels(flow), ["serial-b", "tcp"]);
});
