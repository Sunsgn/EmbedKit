import { describe, expect, it } from "vitest";
import { createFaultInvestigation } from "./faultInvestigationStore";
import {
  createFaultInvestigationExport,
  parseFaultInvestigationExport,
} from "./faultInvestigationReport";

describe("fault investigation portable report", () => {
  it("round-trips a versioned record and removes absolute source path prefixes", () => {
    const value = createFaultInvestigation();
    value.addressResolutions.push({
      address: "0x08000108",
      normalizedAddress: "0x08000108",
      role: "pc",
      architecture: "cortex-m",
      normalization: [],
      source: { file: "C:\\private\\firmware\\src\\main.c", line: 12 },
      confidence: "high",
      evidenceIds: [],
      unknowns: [],
    });
    const exported = createFaultInvestigationExport(value);
    expect(exported.investigation.addressResolutions[0].source?.file).toBe(
      "firmware/src/main.c",
    );
    expect(
      parseFaultInvestigationExport(JSON.stringify(exported)),
    ).toMatchObject({ id: value.id, schemaVersion: 1 });
  });

  it("rejects unknown versions", () => {
    expect(() =>
      parseFaultInvestigationExport(
        '{"schema":"embedkit.fault-investigation","version":2}',
      ),
    ).toThrow(/版本/);
  });
});
