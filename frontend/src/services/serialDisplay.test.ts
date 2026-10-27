import { describe, expect, it } from 'vitest';
import { mayMergeSerialReceive } from './serialDisplay';

describe('serial receive grouping', () => {
  it('groups immediately displayed driver chunks from the same receive burst', () => {
    expect(mayMergeSerialReceive(1000, 1100)).toBe(true);
    expect(mayMergeSerialReceive(1000, 1200)).toBe(true);
    expect(mayMergeSerialReceive(1000, 1201)).toBe(false);
    expect(mayMergeSerialReceive(1000, 2000)).toBe(false);
  });
});
