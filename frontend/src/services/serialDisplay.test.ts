import { describe, expect, it } from 'vitest';
import { isCrLfContinuation, mayMergeSerialDisplay, splitSerialDisplayBytes } from './serialDisplay';

describe('serial display segmentation', () => {
  it('uses received CR/LF bytes as immediate display boundaries without removing them', () => {
    expect(splitSerialDisplayBytes(new TextEncoder().encode('one\r\ntwo\npartial'))).toEqual([
      { bytes: Array.from(new TextEncoder().encode('one\r\n')), closed: true },
      { bytes: Array.from(new TextEncoder().encode('two\n')), closed: true },
      { bytes: Array.from(new TextEncoder().encode('partial')), closed: false },
    ]);
  });

  it('recognizes CRLF split across driver reads and only uses time for delimiter-free fallback grouping', () => {
    expect(isCrLfContinuation([0x41, 0x0d], [0x0a])).toBe(true);
    expect(mayMergeSerialDisplay(false, 1000, 1100)).toBe(true);
    expect(mayMergeSerialDisplay(false, 1000, 2000)).toBe(false);
    expect(mayMergeSerialDisplay(true, 1000, 1010)).toBe(false);
  });
});
