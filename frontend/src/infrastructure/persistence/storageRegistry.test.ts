import { describe, expect, it } from 'vitest';
import { PORTABLE_LOCAL_STORAGE_KEYS, STORAGE_HEALTH_RULES, STORAGE_REGISTRY, validateStorageRegistry } from './storageRegistry';

describe('storage registry', () => {
  it('requires unique versioned ownership and explicit backup policy', () => {
    expect(validateStorageRegistry()).toEqual({ stores: STORAGE_REGISTRY.length, portable: PORTABLE_LOCAL_STORAGE_KEYS.length });
    expect(STORAGE_REGISTRY.every(item => item.owner.length > 0)).toBe(true);
  });

  it('derives backup and health policy from the same registry', () => {
    expect(PORTABLE_LOCAL_STORAGE_KEYS).toContain('embedkit.automation.suites');
    expect(PORTABLE_LOCAL_STORAGE_KEYS).not.toContain('embedkit-ai-config');
    expect(PORTABLE_LOCAL_STORAGE_KEYS).toContain('embedkit.extension-registry.v1');
    expect(STORAGE_HEALTH_RULES).toHaveLength(11);
  });
});
