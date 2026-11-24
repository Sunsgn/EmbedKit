import { describe, expect, it } from 'vitest';
import { createEngineeringProjectArchive, parseEngineeringProjectArchive } from './engineeringProjectArchive';
import { createEngineeringProject } from '../../types/product';
import { createProjectFeature } from '../../services/projectModel';

describe('engineering project archive', () => {
  it('exports a versioned portable project without a verified local path', () => {
    const source = createEngineeringProjectArchive({ ...createEngineeringProject('Demo'), pathStatus: 'available' }, '2026-01-01T00:00:00.000Z');
    expect(JSON.parse(source)).toMatchObject({ schema: 'embedkit.engineering-project', version: 4, exportedAt: '2026-01-01T00:00:00.000Z', project: { pathStatus: 'unverified' } });
    expect(source).not.toContain('selectionId');
  });

  it('imports current and legacy archives with fresh stable child ids', () => {
    let sequence = 0; const original = { ...createEngineeringProject('Demo'), features: [{ ...createProjectFeature('UART'), id: 'feature' }] };
    const result = parseEngineeringProjectArchive(createEngineeringProjectArchive(original), { id: () => `id-${++sequence}`, now: () => '2026-01-02T00:00:00.000Z' });
    expect(result).toMatchObject({ legacy: false, project: { id: 'id-1', name: 'Demo（导入）', pathStatus: 'unverified', features: [{ id: 'id-2' }] } });
    const legacy = parseEngineeringProjectArchive(JSON.stringify({ schema: 'embedkit.device-project', version: 2, project: original }));
    expect(legacy.legacy).toBe(true);
  });

  it('rejects malformed, unsupported, and oversized archives', () => {
    expect(() => parseEngineeringProjectArchive('{bad')).toThrow(/有效的 JSON/);
    expect(() => parseEngineeringProjectArchive(JSON.stringify({ schema: 'unknown', version: 1 }))).toThrow(/支持/);
    expect(() => parseEngineeringProjectArchive(' '.repeat(4 * 1024 * 1024 + 1))).toThrow(/4 MiB/);
  });
});
