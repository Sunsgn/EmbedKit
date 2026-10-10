import assert from "node:assert/strict";
import test from "node:test";
import {
  moduleCompletion,
  parseLearningProgress,
  updateModuleProgress,
} from "../src/utils/learningProgress.ts";

test("learning progress safely migrates missing and damaged local data", () => {
  assert.deepEqual(parseLearningProgress(null), { version: 1, modules: {} });
  assert.deepEqual(parseLearningProgress("damaged"), { version: 1, modules: {} });
  assert.deepEqual(
    parseLearningProgress(JSON.stringify({ modules: { uart: { checklist: ["loopback", 3], evidence: "log" } } })),
    {
      version: 1,
      modules: {
        uart: { checklist: ["loopback"], evidence: "log", updatedAt: "" },
      },
    },
  );
});

test("a module completes only with every acceptance item and practice evidence", () => {
  let progress = parseLearningProgress(null);
  progress = updateModuleProgress(
    progress,
    "uart",
    { checklist: ["rx", "tx"], evidence: "records/uart-loopback.json" },
    "2026-10-10T00:00:00.000Z",
  );
  assert.deepEqual(moduleCompletion(progress.modules.uart, ["rx", "tx"]), {
    checked: 2,
    total: 2,
    evidenceReady: true,
    complete: true,
  });
  assert.equal(moduleCompletion(progress.modules.uart, ["rx", "tx", "timeout"]).complete, false);
  assert.equal(moduleCompletion({ ...progress.modules.uart, evidence: " " }, ["rx", "tx"]).complete, false);
});
