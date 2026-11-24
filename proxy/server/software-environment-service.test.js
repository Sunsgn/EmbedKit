import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSoftwareEnvironmentService, validateInstallManifest } from './software-environment-service.js';

const manifest = {
  id: 'tool-1.0.0-test-x64',
  softwareId: 'build.tool',
  capabilityId: 'build.tool',
  name: 'Test Tool',
  version: '1.0.0',
  platform: 'test',
  architecture: 'x64',
  sourceUrl: 'https://github.com/example/tool/releases/download/v1/tool.zip',
  officialPage: 'https://github.com/example/tool/releases/tag/v1',
  sha256: 'a'.repeat(64),
  byteLength: 1024,
  archive: 'zip',
  installSubdirectory: 'tool/1.0.0',
  expectedExecutable: 'tool.exe',
  verificationArgs: ['--version'],
};

test('software environment safely ignores damaged managed-installation state', async () => {
  const root = await mkdtemp(join(tmpdir(), 'embedkit-software-state-'));
  try {
    const stateFile = join(root, 'installations.json');
    await writeFile(stateFile, '{damaged', 'utf8');
    const service = createSoftwareEnvironmentService({ stateFile, definitions: [], manifests: [] });

    const result = await service.detect();

    assert.equal(result.schemaVersion, 1);
    assert.deepEqual(result.installations, []);
    assert.deepEqual(result.unavailable, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('software manifest registry exposes only compatible public metadata', () => {
  const service = createSoftwareEnvironmentService({
    platform: 'test',
    architecture: 'x64',
    definitions: [],
    manifests: [manifest, { ...manifest, id: 'tool-other-platform', platform: 'other' }],
  });

  const result = service.listManifests();

  assert.equal(result.manifests.length, 1);
  assert.equal(result.manifests[0].id, manifest.id);
  assert.equal('sha256' in result.manifests[0], false);
  assert.equal('expectedExecutable' in result.manifests[0], false);
});

test('software manifest validation enforces the configured download limit', () => {
  assert.throws(() => validateInstallManifest(manifest, 512), /digest or size is invalid/);
});
