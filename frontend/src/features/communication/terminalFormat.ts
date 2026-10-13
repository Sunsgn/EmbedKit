export type TerminalDirection = "rx" | "tx" | "system";

export const MAX_TERMINAL_LOGS = 2000;

const pad = (value: number, length = 2) => String(value).padStart(length, "0");

export function formatTerminalTime(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--:--.---";
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

export function terminalDirectionLabel(
  direction: TerminalDirection,
): "RX" | "TX" | "SYS" {
  return direction === "system"
    ? "SYS"
    : (direction.toUpperCase() as "RX" | "TX");
}

export interface ExportableTerminalLog {
  timestamp: Date | string | number;
  direction: TerminalDirection;
  text: string;
}

export function formatTerminalLog(logs: ExportableTerminalLog[]): string {
  return logs
    .map(
      (item) =>
        `[${formatTerminalTime(item.timestamp)}] [${terminalDirectionLabel(item.direction)}] ${item.text}`,
    )
    .join("\n");
}

export function safeTerminalFileName(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[<>:"/\\|?*\p{Cc}]+/gu, "-")
    .replace(/[. ]+$/g, "")
    .slice(0, 80);
  return cleaned || "communication";
}

export function downloadTerminalLog(
  logs: ExportableTerminalLog[],
  name: string,
): void {
  if (!logs.length) return;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(
    new Blob([formatTerminalLog(logs)], { type: "text/plain;charset=utf-8" }),
  );
  link.download = `${safeTerminalFileName(name)}-${Date.now()}.log`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}
