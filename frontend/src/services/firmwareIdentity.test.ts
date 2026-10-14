import { describe, expect, it } from 'vitest';
import { createFirmwareCatalog, createFirmwareIdentityRecords, sha256Hex } from './firmwareIdentity';

describe('firmware identity', () => {
  it('calculates a deterministic SHA-256 without retaining firmware bytes', async () => {
    const bytes = new TextEncoder().encode('abc');
    expect(await sha256Hex(bytes)).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    const result = await createFirmwareIdentityRecords({ fileName: 'app.bin', bytes, capturedAt: '2026-10-14T00:00:00.000Z' });
    expect(result.artifact).toMatchObject({ kind: 'bin', byteLength: 3, fileName: 'app.bin' });
    expect(result.firmware).toMatchObject({ format: 'bin', buildArtifactId: result.artifact.id, sha256: result.artifact.sha256 });
    expect(result.artifact).not.toHaveProperty('bytes');
  });

  it('uses build provenance in stable IDs and verifies a supplied digest', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const digest = await sha256Hex(bytes);
    const result = await createFirmwareIdentityRecords({ fileName: 'release.hex', bytes, decodedFormat: 'intel-hex', buildId: 'build-1', artifactIndex: 2, expectedSha256: digest, capturedAt: '2026-10-14T00:00:00.000Z' });
    expect(result.artifact.id).toMatch(/^artifact:build-1:2:/);
    expect(result.artifact.kind).toBe('hex');
    expect(result.firmware.format).toBe('hex');
    await expect(createFirmwareIdentityRecords({ fileName: 'release.bin', bytes, expectedSha256: 'a'.repeat(64) })).rejects.toThrow(/SHA-256.*不一致/);
  });

  it('keeps unsupported firmware formats explicit instead of guessing', async () => {
    const result = await createFirmwareIdentityRecords({ fileName: 'image.srec', bytes: new Uint8Array([1]), decodedFormat: 'motorola-srec', capturedAt: '2026-10-14T00:00:00.000Z' });
    expect(result.artifact.kind).toBe('other');
    expect(result.firmware.format).toBe('other');
  });

  it('catalogs only firmware whose artifact fingerprint and size still match', async () => {
    const valid = await createFirmwareIdentityRecords({ fileName: 'app.bin', bytes: new Uint8Array([1, 2]), capturedAt: '2026-10-14T00:00:00.000Z' });
    const mismatch = { ...valid.firmware, id: 'firmware:mismatch', sha256: 'f'.repeat(64) };
    const orphan = { ...valid.firmware, id: 'firmware:orphan', buildArtifactId: 'artifact:missing' };

    expect(createFirmwareCatalog([valid.artifact], [mismatch, orphan, valid.firmware])).toEqual([
      expect.objectContaining({ firmwareId: valid.firmware.id, fileName: 'app.bin', sha256: valid.firmware.sha256 }),
    ]);
  });
});
