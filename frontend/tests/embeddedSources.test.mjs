import assert from 'node:assert/strict';
import test from 'node:test';
import { embeddedSources } from '../src/data/embeddedSources.ts';

test('curated embedded sources are traceable, unique and HTTPS', () => {
  assert.equal(embeddedSources.length >= 8, true);
  assert.equal(new Set(embeddedSources.map(source => source.id)).size, embeddedSources.length);
  assert.equal(new Set(embeddedSources.map(source => source.url)).size, embeddedSources.length);
  for (const source of embeddedSources) {
    assert.match(source.url, /^https:\/\//);
    assert.match(source.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(source.official, true);
    assert.equal(source.scope.length > 0, true);
  }
});
