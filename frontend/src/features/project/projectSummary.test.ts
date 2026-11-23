import { describe, expect, it } from 'vitest';
import type { FileNode } from '../../types';
import { summarizeProject } from './projectSummary';

function file(name: string, content = '', path = `/${name}`): FileNode {
  return { name, path, content, language: 'text' };
}

describe('project summary', () => {
  it('aggregates traceable source, SDK, peripheral, and build evidence', () => {
    const summary = summarizeProject([
      file('main.c', '#include "STM32F103C8T6.h"\n// FreeRTOS UART SPI\nint main(void) { return 0; }', '/src/main.c'),
      file('board.h', '#define CHIP STM32F103C8T6', '/include/board.h'),
      file('firmware.uvprojx', '', '/project/firmware.uvprojx'),
      file('layout.sct'),
    ]);
    expect(summary).toMatchObject({
      chip: 'STM32F103C8T6', toolchain: 'Keil MDK', sdk: 'FreeRTOS', projectType: '厂商 IDE 工程',
      files: 4, sourceFiles: 1, headerFiles: 1, entryPoints: ['/src/main.c'], buildKind: 'keil', buildConfidence: 'high',
    });
    expect(summary.peripherals).toEqual(['UART', 'SPI']);
    expect(summary.buildFiles).toEqual(['/project/firmware.uvprojx', '/layout.sct']);
    expect(summary.buildEvidence[0]).toContain('/project/firmware.uvprojx');
  });

  it('selects the most frequent chip candidate deterministically', () => {
    expect(summarizeProject([file('a.c', 'ESP32 ESP32 STM32F407'), file('Makefile')]).chip).toBe('ESP32');
  });

  it('keeps comments and strings from becoming entry-point evidence', () => {
    const summary = summarizeProject([file('worker.c', '/* main() */\nconst char *name = "main()";'), file('Makefile')]);
    expect(summary.entryPoints).toEqual([]);
    expect(summary.findings).toEqual([expect.objectContaining({ id: 'project:no-main' })]);
  });

  it('degrades unknown source collections without guessing chip, SDK, or build system', () => {
    const summary = summarizeProject([file('worker.c', 'void worker(void) {}')]);
    expect(summary).toMatchObject({ chip: '未识别（可手动确认）', sdk: '未识别', toolchain: '未识别', buildKind: 'unknown', buildConfidence: 'low' });
    expect(summary.buildEvidence).toEqual(['未发现受支持的工程配置文件']);
  });
});
