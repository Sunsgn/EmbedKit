import { describe, expect, it } from 'vitest';
import { analyzeMap } from './map';

describe('MAP quick analysis tool domain', () => {
  it('exposes GNU ld memory totals through the tool module', () => {
    const result = analyzeMap('Memory Configuration\nName Origin Length Attributes\nFLASH 0x0000000008000000 0x0000000000010000 xr\nRAM 0x0000000020000000 0x0000000000004000 xrw\nLinker script and memory map\n.text 0x0000000008000000 0x100\n.data 0x0000000020000000 0x20');
    expect(result.format).toBe('gnu');
    expect(result.totals.flash).toBeGreaterThan(0);
    expect(result.coverage.score).toBeGreaterThan(0);
  });

  it('degrades unknown content without inventing a toolchain', () => {
    const result = analyzeMap('custom linker report without recognized sections');
    expect(result.format).toBe('unknown');
    expect(result.coverage.confidence).toBe('low');
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
