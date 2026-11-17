import { describe, expect, it } from "vitest";
import {
  correlateAddressEvidence,
  normalizeArchitectureAddress,
  normalizeCortexMAddress,
} from "./addressResolution";

describe("fault address correlation", () => {
  it("retains the original Thumb address while normalizing code lookup", () => {
    expect(normalizeCortexMAddress(0x08000109, "pc")).toEqual({
      address: 0x08000109,
      normalizedAddress: 0x08000108,
      normalization: ["清除 Cortex-M Thumb 状态位；原始地址已保留"],
    });
    expect(
      normalizeCortexMAddress(0x40005411, "fault-address").normalizedAddress,
    ).toBe(0x40005411);
  });

  it("uses a registry and safely preserves unknown architecture addresses", () => {
    expect(
      normalizeArchitectureAddress("cortex-m", 0x08000109, "pc"),
    ).toMatchObject({
      normalizedAddress: 0x08000108,
      adapterId: "cortex-m-v1",
    });
    expect(normalizeArchitectureAddress("unknown-core", 0x1235, "pc")).toEqual({
      address: 0x1235,
      normalizedAddress: 0x1235,
      normalization: [],
      adapterId: null,
    });
  });

  it("records ELF and MAP disagreement instead of selecting a silent winner", () => {
    const result = correlateAddressEvidence([
      {
        role: "pc",
        address: 0x08000108,
        architecture: "cortex-m",
        elf: {
          requestedAddress: "0x08000108",
          normalizedAddress: "0x08000108",
          thumbBitCleared: false,
          match: "inside-symbol",
          confidence: "high",
          symbol: {
            table: ".symtab",
            index: 1,
            name: "sensor_read",
            address: "0x08000100",
            normalizedAddress: "0x08000100",
            size: 32,
            binding: "GLOBAL",
            type: "FUNC",
            visibility: "DEFAULT",
            sectionIndex: 1,
            sectionName: ".text",
            offset: "0x8",
          },
          section: null,
          source: {
            file: "sensor.c",
            line: 12,
            column: 1,
            address: "0x08000108",
          },
          note: "",
        },
        map: {
          requestedAddress: 0x08000108,
          normalizedAddress: 0x08000108,
          lowBitCleared: false,
          match: "inside-symbol",
          confidence: "high",
          symbol: {
            name: "other",
            address: 0x08000100,
            size: 32,
            section: ".text",
            offset: 8,
          },
          section: null,
          note: "",
        },
      },
    ]);
    expect(result.conflicts[0]?.summary).toContain("不一致");
    expect(result.resolutions[0].source).toMatchObject({
      file: "sensor.c",
      line: 12,
    });
  });
});
