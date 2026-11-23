import { describe, expect, it } from 'vitest';
import type { FileNode } from '../../types';
import { detectProjectBuild } from './projectBuildDetection';

function file(name: string, content = '', path = `/${name}`): FileNode {
  return { name, path, content, language: 'text' };
}

describe('project build detection', () => {
  it.each([
    [[file('app.uvprojx'), file('layout.sct')], 'keil', 'high'],
    [[file('app.ewp'), file('layout.icf')], 'iar', 'high'],
    [[file('CMakeLists.txt', 'idf_component_register(SRCS "main.c")'), file('sdkconfig')], 'esp-idf', 'high'],
    [[file('CMakeLists.txt'), file('prj.conf'), file('Kconfig'), file('board.overlay')], 'zephyr', 'high'],
    [[file('platformio.ini')], 'platformio', 'high'],
    [[file('CMakeLists.txt'), file('CMakePresets.json')], 'cmake', 'medium'],
    [[file('Makefile')], 'make', 'medium'],
    [[file('build.ninja')], 'ninja', 'low'],
  ] as const)('detects %s as %s with %s confidence', (files, kind, confidence) => {
    expect(detectProjectBuild([...files])).toMatchObject({ kind, confidence });
  });

  it('prefers vendor project evidence over generic generated build files', () => {
    const result = detectProjectBuild([file('firmware.uvprojx'), file('CMakeLists.txt'), file('build.ninja')]);
    expect(result.kind).toBe('keil');
    expect(result.evidence[0]).toContain('/firmware.uvprojx');
  });

  it('degrades unknown source collections without guessing a platform', () => {
    expect(detectProjectBuild([file('main.c', 'int main(void) {}')])).toEqual({
      kind: 'unknown',
      label: '未识别',
      confidence: 'low',
      evidence: ['未发现受支持的工程配置文件'],
    });
  });
});
