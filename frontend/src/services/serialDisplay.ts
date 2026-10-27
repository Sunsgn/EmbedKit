export const SERIAL_DISPLAY_FALLBACK_GAP_MS = 200;

export interface SerialDisplaySegment {
  bytes: number[];
  closed: boolean;
}

export function splitSerialDisplayBytes(source: ArrayLike<number>): SerialDisplaySegment[] {
  const bytes = Array.from(source), segments: SerialDisplaySegment[] = [];
  let start = 0;
  for (let index = 0; index < bytes.length; index += 1) {
    if (bytes[index] !== 10 && bytes[index] !== 13) continue;
    if (bytes[index] === 13 && bytes[index + 1] === 10) index += 1;
    segments.push({ bytes: bytes.slice(start, index + 1), closed: true });
    start = index + 1;
  }
  if (start < bytes.length) segments.push({ bytes: bytes.slice(start), closed: false });
  return segments;
}

export function isCrLfContinuation(previous: ArrayLike<number>, incoming: ArrayLike<number>) {
  return previous.length > 0 && incoming.length > 0 && previous[previous.length - 1] === 13 && incoming[0] === 10;
}

export function mayMergeSerialDisplay(previousClosed: boolean, previousReceivedAt: number, receivedAt: number) {
  const elapsed = receivedAt - previousReceivedAt;
  return !previousClosed && elapsed >= 0 && elapsed <= SERIAL_DISPLAY_FALLBACK_GAP_MS;
}
