import { describe, expect, it } from "vitest";
import {
  appendTerminalLineEnding,
  formatTerminalLog,
  formatTerminalTime,
  safeTerminalFileName,
  terminalDirectionLabel,
  terminalRxBytes,
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

  it("appends one explicit network line ending without duplicating an existing ending", () => {
    expect(appendTerminalLineEnding("AT", "crlf")).toBe("AT\r\n");
    expect(appendTerminalLineEnding("AT\n", "crlf")).toBe("AT\r\n");
    expect(appendTerminalLineEnding("AT", "none")).toBe("AT");
  });

  it("reconstructs RAW RX bytes without display text or TX data", () => {
    expect([...terminalRxBytes([{ direction: "rx", hex: "AA 0D 0A" }, { direction: "tx", hex: "FF" }, { direction: "rx", hex: "55" }])]).toEqual([0xaa, 0x0d, 0x0a, 0x55]);
  });
});
