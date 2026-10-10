import assert from "node:assert/strict";
import test from "node:test";
import {
  applySharedFlowChannel,
  cleanupFlowResources,
  moveFlowStep,
  orderedFlowSteps,
  removeFlowStep,
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

test("deleting a step selects its nearest surviving neighbor", () => {
  const result = removeFlowStep(steps, "2", "2");
  assert.deepEqual(result.steps.map((step) => step.id), ["1", "3"]);
  assert.equal(result.selectedId, "3");
  assert.equal(removeFlowStep(result.steps, "3", "3").selectedId, "1");
});

test("reordering is immutable and ignores flow boundaries", () => {
  const moved = moveFlowStep(steps, "2", 1);
  assert.deepEqual(moved.map((step) => step.id), ["1", "3", "2"]);
  assert.deepEqual(steps.map((step) => step.id), ["1", "2", "3"]);
  assert.equal(moveFlowStep(steps, "1", -1), steps);
});

test("execution keeps stage order so teardown runs after main work", () => {
  const unordered = [
    { ...steps[0], stage: "teardown" },
    { ...steps[1], stage: "setup" },
    { ...steps[2], stage: "test" },
  ];
  assert.deepEqual(
    orderedFlowSteps(unordered).map((step) => step.stage),
    ["setup", "test", "teardown"],
  );
});

test("resource cleanup attempts every resource and reports isolated failures", async () => {
  const calls = [];
  const failures = await cleanupFlowResources([
    { name: "websocket", run: () => calls.push("websocket") },
    {
      name: "tcp",
      run: async () => {
        calls.push("tcp");
        throw new Error("close failed");
      },
    },
    { name: "serial-reader", run: () => calls.push("serial-reader") },
  ]);
  assert.deepEqual(calls.sort(), ["serial-reader", "tcp", "websocket"]);
  assert.deepEqual(failures, [{ name: "tcp", error: "close failed" }]);
});
