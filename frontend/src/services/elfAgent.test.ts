import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzeSelectedElf, disassembleElfAddress, lookupElfAddress } from './elfAgent';

afterEach(() => vi.unstubAllGlobals());

describe('ELF Local Agent service', () => {
  it('analyzes only a previously authorized selection token', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ format: 'ELF', bits: 32, machine: 'Arm', sections: [], segments: [], warnings: [] }), { headers: { 'Content-Type': 'application/json', 'X-EmbedKit-Protocol': '1' } }));
    vi.stubGlobal('fetch', fetch);
    await expect(analyzeSelectedElf('12345678-1234-1234-1234-123456789abc')).resolves.toMatchObject({ format: 'ELF', machine: 'Arm' });
    expect(new URL(String(fetch.mock.calls[0][0])).pathname).toBe('/api/elf/analyze/12345678-1234-1234-1234-123456789abc');
  });

  it('queries an address only through an active analysis id', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ match: 'inside-symbol', confidence: 'high', symbol: { name: 'main', offset: '0x8' } }), { headers: { 'Content-Type': 'application/json', 'X-EmbedKit-Protocol': '1' } }));
    vi.stubGlobal('fetch', fetch);
    await expect(lookupElfAddress('analysis-1', '0x08000108')).resolves.toMatchObject({ match: 'inside-symbol', symbol: { name: 'main' } });
    const url = new URL(String(fetch.mock.calls[0][0]));
    expect(url.pathname).toBe('/api/elf/analyses/analysis-1/lookup');
    expect(url.searchParams.get('address')).toBe('0x08000108');
  });

  it('requests a bounded disassembly window through the analysis id', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ available: false, instructions: [], warnings: ['missing tool'] }), { headers: { 'Content-Type': 'application/json', 'X-EmbedKit-Protocol': '1' } }));
    vi.stubGlobal('fetch', fetch);
    await expect(disassembleElfAddress('analysis-1', '0x08000108')).resolves.toMatchObject({ available: false });
    const url = new URL(String(fetch.mock.calls[0][0]));
    expect(url.pathname).toBe('/api/elf/analyses/analysis-1/disassemble');
    expect(url.searchParams.get('before')).toBe('16');
    expect(url.searchParams.get('after')).toBe('32');
  });
});
