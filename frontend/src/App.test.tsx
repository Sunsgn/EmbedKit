import { describe, expect, it } from 'vitest';
import { navSections } from './appNavigation';

describe('application navigation', () => {
  it('puts daily local tools first while retaining advanced capabilities', () => {
    expect(navSections.map(section => section.title)).toEqual(['本地工作台', '按需能力', '系统']);
    expect(navSections[0].items.map(item => item.label)).toEqual(['工作台', '工程中心', '开发环境', '资料中心', '通信调试', '嵌入式工具箱']);
    expect(navSections[1].items.map(item => item.label)).toEqual(['工程分析', '集成测试', '学习中心', '可选 AI 助手']);
    const paths = navSections.flatMap(section => section.items.map(item => item.path));
    expect(new Set(paths).size).toBe(paths.length);
  });
});
