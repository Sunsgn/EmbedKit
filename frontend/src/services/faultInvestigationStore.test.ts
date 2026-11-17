import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import {
  createFaultInvestigation,
  deleteFaultInvestigationDatabaseForTests,
  listFaultInvestigations,
  normalizeFaultInvestigation,
  saveFaultInvestigation,
} from "./faultInvestigationStore";

afterEach(() => deleteFaultInvestigationDatabaseForTests());

describe("fault investigation persistence", () => {
  it("persists a versioned investigation without transient file permissions", async () => {
    const value = createFaultInvestigation({
      rawLog: "PC=08000108",
      registers: { pc: 0x08000108 },
    });
    value.artifacts.push({
      id: "elf-1",
      kind: "elf",
      fileName: "app.elf",
      byteLength: 42,
      sha256: "a".repeat(64),
      capturedAt: "2026-11-17T00:00:00.000Z",
    });
    await saveFaultInvestigation(value);
    expect(await listFaultInvestigations()).toMatchObject([
      { id: value.id, schemaVersion: 1, artifacts: [{ fileName: "app.elf" }] },
    ]);
    expect(JSON.stringify((await listFaultInvestigations())[0])).not.toContain(
      "selectionId",
    );
  });

  it("rejects oversized logs and unsupported schema versions", () => {
    const value = createFaultInvestigation();
    expect(
      normalizeFaultInvestigation({ ...value, schemaVersion: 2 }),
    ).toBeNull();
    expect(
      normalizeFaultInvestigation({
        ...value,
        input: { registers: {}, rawLog: "x".repeat(1024 * 1024 + 1) },
      }),
    ).toBeNull();
  });
});
