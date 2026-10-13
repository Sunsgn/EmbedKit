import { describe, expect, it } from "vitest";
import {
  formatTerminalLog,
  formatTerminalTime,
  safeTerminalFileName,
  terminalDirectionLabel,
  utf8ByteLength,
} from "./terminalFormat";

describe("communication terminal formatting", () => {
  it("uses a stable millisecond timestamp independent of browser locale formatting", () => {
    const date = new Date(2026, 9, 13, 16, 48, 7, 314);
    expect(formatTerminalTime(date)).toBe("16:48:07.314");
    expect(formatTerminalTime("invalid")).toBe("--:--:--.---");
  });

  it("exports consistent direction labels and local display timestamps", () => {
    const date = new Date(2026, 9, 13, 16, 48, 7, 314);
    expect(terminalDirectionLabel("system")).toBe("SYS");
    expect(
      formatTerminalLog([{ timestamp: date, direction: "rx", text: "PONG" }]),
    ).toBe("[16:48:07.314] [RX] PONG");
  });

  it("counts UTF-8 bytes and sanitizes exported file names", () => {
    expect(utf8ByteLength("A中")).toBe(4);
    expect(safeTerminalFileName("tcp:127.0.0.1/9000")).toBe(
      "tcp-127.0.0.1-9000",
    );
  });
});
