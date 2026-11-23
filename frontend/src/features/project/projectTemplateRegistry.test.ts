import { describe, expect, it } from 'vitest';
import type { Chip, FileNode } from '../../types';
import {
  createProjectTemplate,
  PROJECT_TEMPLATE_API_VERSION,
  PROJECT_TEMPLATE_NAME_MAX_LENGTH,
  type ProjectTemplateAdapter,
} from './projectTemplateRegistry';

const chip = (values: Partial<Chip> = {}): Chip => ({
  id: 'custom', name: 'Custom MCU', manufacturer: 'Independent Vendor', series: 'Unknown family',
  cores: 'Unknown core', frequency: 'Unknown', flash: 'Unknown', ram: 'Unknown', peripherals: [],
  package: 'Unknown', ...values,
});

const adapter = (overrides: Partial<ProjectTemplateAdapter> = {}): ProjectTemplateAdapter => ({
  id: 'test.adapter', version: '1.2.3', apiVersion: PROJECT_TEMPLATE_API_VERSION, scope: 'Test target only',
  supports: () => true,
  generate: (): FileNode[] => [{ name: 'target.c', path: '/target.c', content: 'target', language: 'c' }],
  ...overrides,
});

describe('project template registry', () => {
  it.each([
    chip({ manufacturer: 'STMicroelectronics', series: 'STM32H7', cores: 'Cortex-M7' }),
    chip({ manufacturer: 'Microchip', series: 'AVR', cores: 'AVR 8-bit' }),
    chip({ manufacturer: 'Espressif', series: 'ESP32', cores: 'Xtensa LX6' }),
    chip(),
  ])('uses a platform-independent scaffold without guessing a toolchain for $manufacturer $series', target => {
    const result = createProjectTemplate({ projectName: 'portable_app', chip: target });
    const output = result.files.map(file => file.content).join('\n');
    expect(result.adapterId).toBe('embedkit.generic-source');
    expect(result.files.map(file => file.path)).toEqual(['/Src/main.c', '/Inc/project_config.h', '/README.md']);
    expect(output).not.toMatch(/arm-none-eabi|HAL_|stm32f\dxx_hal|cortex-m3/i);
    expect(output).toContain(target.name);
    expect(output).toContain('platform-independent');
  });

  it('selects an explicitly compatible versioned adapter', () => {
    const result = createProjectTemplate({ projectName: 'adapter_app', chip: chip() }, [adapter()]);
    expect(result).toMatchObject({ adapterId: 'test.adapter', adapterVersion: '1.2.3' });
    expect(result.files[0].path).toBe('/target.c');
  });

  it('ignores incompatible API versions and records the fallback', () => {
    const incompatible = { ...adapter(), apiVersion: 2 as typeof PROJECT_TEMPLATE_API_VERSION };
    expect(createProjectTemplate({ projectName: 'app' }, [incompatible])).toMatchObject({
      adapterId: 'embedkit.generic-source', fallbackReason: 'no_adapter',
    });
  });

  it.each([
    adapter({ supports: () => { throw new Error('probe failed'); } }),
    adapter({ generate: () => { throw new Error('generation failed'); } }),
  ])('safely falls back when an adapter fails', failingAdapter => {
    expect(createProjectTemplate({ projectName: 'app' }, [failingAdapter])).toMatchObject({
      adapterId: 'embedkit.generic-source', fallbackReason: 'adapter_failed',
    });
  });

  it('rejects invalid adapter output without exposing partial files', () => {
    const result = createProjectTemplate({ projectName: 'app' }, [
      adapter({ generate: () => [{ name: 'bad.c', path: '../bad.c', content: '', language: 'c' }] }),
    ]);
    expect(result).toMatchObject({ adapterId: 'embedkit.generic-source', fallbackReason: 'invalid_output' });
    expect(result.files.some(file => file.path.includes('..'))).toBe(false);
  });

  it('normalizes unsafe or oversized project names for source and documentation', () => {
    const result = createProjectTemplate({ projectName: `  demo\n"name\\${'x'.repeat(100)}  ` });
    const header = result.files.find(file => file.path.endsWith('.h'))!.content;
    const readme = result.files.find(file => file.path.endsWith('.md'))!.content;
    expect(readme.split('\n')[0].slice(2)).toHaveLength(PROJECT_TEMPLATE_NAME_MAX_LENGTH);
    expect(header).toContain('\\"name\\\\');
  });
});
