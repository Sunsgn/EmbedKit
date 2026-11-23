import { describe, expect, it } from 'vitest';
import type { FileNode } from '../../types';
import { inspectProjectStructure } from './projectStructureInspection';

function file(name: string, content = '', path = `/${name}`): FileNode {
  return { name, path, content, language: 'text' };
}

describe('project structure inspection', () => {
  it('passes a minimal project while explicitly denying real compilation', () => {
    const result = inspectProjectStructure([file('main.c', 'int main(void) { return 0; }'), file('Makefile')], 'GENERIC-MCU');
    expect(result.success).toBe(true);
    expect(result.output).toContain('基础结构检查通过；这不代表已完成真实编译。');
    expect(result.output).toContain('未调用 ARM GCC、Keil 或 IAR');
  });

  it('fails when no C or C++ source file is available', () => {
    const result = inspectProjectStructure([file('README.md', 'docs')], 'UNKNOWN');
    expect(result.success).toBe(false);
    expect(result.output).toContain('未找到 .c 或 .cpp 源文件');
  });

  it('reports brace mismatches with the original source path', () => {
    const result = inspectProjectStructure([file('main.c', 'int main(void) {', '/src/main.c'), file('CMakeLists.txt')], 'MCU');
    expect(result.success).toBe(false);
    expect(result.output).toContain('/src/main.c：大括号数量不匹配');
  });

  it('ignores braces and main text inside comments and strings', () => {
    const result = inspectProjectStructure([file('worker.c', '/* main() { */\nconst char *value = "}";\nvoid worker(void) {}'), file('Makefile')], 'MCU');
    expect(result.success).toBe(true);
    expect(result.output).toContain('未检测到 main() 入口函数');
    expect(result.output).not.toContain('大括号数量不匹配');
  });

  it('includes deterministic risk findings and byte-size evidence', () => {
    const source = 'int main(void) { strcpy(dst, src); }';
    const result = inspectProjectStructure([file('main.c', source), file('Makefile')], 'MCU');
    expect(result.output).toContain('[HIGH] 使用无边界字符串函数 · /main.c:1');
    expect(result.size).toBe(source.length);
  });
});
