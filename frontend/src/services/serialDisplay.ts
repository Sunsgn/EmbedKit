export const SERIAL_RECEIVE_GROUP_GAP_MS = 200;

export function mayMergeSerialReceive(previousReceivedAt: number, receivedAt: number) {
  const elapsed = receivedAt - previousReceivedAt;
  return elapsed >= 0 && elapsed <= SERIAL_RECEIVE_GROUP_GAP_MS;
}
