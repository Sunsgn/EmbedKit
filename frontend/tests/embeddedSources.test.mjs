import assert from 'node:assert/strict';
import test from 'node:test';
import { embeddedSources } from '../src/data/embeddedSources.ts';

test('curated embedded sources are traceable, classified, unique and HTTPS', () => {
  assert.equal(embeddedSources.length >= 30, true);
  assert.equal(new Set(embeddedSources.map(source => source.id)).size, embeddedSources.length);
  assert.equal(new Set(embeddedSources.map(source => source.url)).size, embeddedSources.length);
  for (const source of embeddedSources) {
    assert.match(source.url, /^https:\/\//);
    assert.match(source.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(typeof source.official, 'boolean');
    assert.equal(source.platform.length > 0, true);
    assert.equal(source.kind.length > 0, true);
    assert.equal(source.scope.length > 0, true);
    assert.equal(source.learningStages.length > 0, true);
  }
  assert.equal(embeddedSources.some(source => source.id === 'linux-kernel-docs'), true);
  assert.equal(embeddedSources.some(source => source.id === 'rt-thread-docs'), true);
  assert.equal(embeddedSources.some(source => source.id === 'iar-docs'), true);
  assert.equal(embeddedSources.some(source => source.platform === 'ESP32' && source.official), true);
  assert.equal(embeddedSources.some(source => source.platform === 'RV1106' && !source.official), true);
  assert.equal(embeddedSources.some(source => source.platform === '星闪 NearLink'), true);
  assert.equal(embeddedSources.some(source => source.linkStatus === 'temporarily-unavailable'), true);
});
