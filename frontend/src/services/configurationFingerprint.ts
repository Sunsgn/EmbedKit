export const CONFIGURATION_FINGERPRINT_MAX_BYTES = 1024 * 1024;

function canonical(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value !== 'object') return null;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, canonical(item)]));
}

export async function createConfigurationFingerprint(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(value)));
  if (bytes.byteLength > CONFIGURATION_FINGERPRINT_MAX_BYTES) throw new Error('测试定义超过 1 MiB 指纹计算上限');
  const digest = await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes).buffer);
  return [...new Uint8Array(digest)].map(item => item.toString(16).padStart(2, '0')).join('');
}
