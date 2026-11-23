import { describe, expect, it } from 'vitest';
import type { FileNode } from '../../types';
import { analyzeProjectRisks } from './projectRiskAnalysis';

function file(name: string, content: string, path = `/${name}`): FileNode {
  return { name, path, content, language: name.endsWith('.h') ? 'h' : 'c' };
}

describe('project risk analysis', () => {
  it('reports source-position evidence for unsafe-code rules', () => {
    const findings = analyzeProjectRisks([file('main.c', 'int main(void) {\n strcpy(dst, src);\n char *token = "secret";\n malloc(8); // TODO\n}', '/src/main.c'), file('Makefile', '')]);
    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: 'high', title: '使用无边界字符串函数', file: '/src/main.c', line: 2 }),
      expect.objectContaining({ severity: 'high', title: '疑似硬编码凭据', line: 3 }),
      expect.objectContaining({ severity: 'medium', title: '运行期动态内存', line: 4 }),
      expect.objectContaining({ severity: 'low', title: '存在未完成标记', line: 4 }),
    ]));
  });

  it('distinguishes blocking and logging inside callback context', () => {
    const findings = analyzeProjectRisks([file('irq.c', 'void UART_Callback(void) {\n HAL_Delay(1);\n printf("irq");\n}\nint main(void) {}'), file('CMakeLists.txt', '')]);
    expect(findings.map(item => item.title)).toEqual(['中断或回调上下文中存在阻塞调用', '中断或回调中输出日志']);
  });

  it('adds project-level unknown evidence in severity order', () => {
    const findings = analyzeProjectRisks([file('worker.c', 'void worker(void) {}')]);
    expect(findings.slice(0, 2)).toEqual([
      expect.objectContaining({ id: 'project:no-main', severity: 'high', file: '/', line: 0 }),
      expect.objectContaining({ id: 'project:no-build', severity: 'medium', file: '/', line: 0 }),
    ]);
  });

  it('does not treat main text inside comments or strings as an entry point', () => {
    const findings = analyzeProjectRisks([file('worker.c', '/* main() */\nconst char *label = "main()";'), file('Makefile', '')]);
    expect(findings).toEqual([expect.objectContaining({ id: 'project:no-main' })]);
  });

  it('returns no findings for a clean minimal project', () => {
    expect(analyzeProjectRisks([file('main.c', 'int main(void) { return 0; }'), file('Makefile', '')])).toEqual([]);
  });
});
