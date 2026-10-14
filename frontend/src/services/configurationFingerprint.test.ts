import { describe, expect, it } from 'vitest';
import { CONFIGURATION_FINGERPRINT_MAX_BYTES, createConfigurationFingerprint } from './configurationFingerprint';

describe('configuration fingerprint', () => {
  it('is stable across object key order while preserving array order', async () => {
    expect(await createConfigurationFingerprint({ b: 2, a: [1, 2] })).toBe(await createConfigurationFingerprint({ a: [1, 2], b: 2 }));
    expect(await createConfigurationFingerprint({ a: [1, 2] })).not.toBe(await createConfigurationFingerprint({ a: [2, 1] }));
  });

  it('rejects oversized definitions', async () => {
    await expect(createConfigurationFingerprint('x'.repeat(CONFIGURATION_FINGERPRINT_MAX_BYTES + 1))).rejects.toThrow(/1 MiB/);
  });
});
