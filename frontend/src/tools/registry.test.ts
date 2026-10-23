import { describe, expect, it } from 'vitest';
import { toolRegistry, validateToolRegistry } from './registry';

describe('tool registry', () => {
  it('uses stable unique ids and the supported contract version', () => {
    expect(toolRegistry).toHaveLength(19);
    expect(validateToolRegistry()).toEqual([]);
  });

  it('reports duplicate ids without affecting the production registry', () => {
    expect(validateToolRegistry([toolRegistry[0], toolRegistry[0]])).toContain('number: duplicate tool id');
  });
});
