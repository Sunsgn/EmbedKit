import type { CompileResult, FileNode } from '../../types';
import { analyzeProjectRisks } from './projectRiskAnalysis';

function stripCCommentsAndStrings(value: string) {
  return value.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\r\n]*/g, '').replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '');
}

export function inspectProjectStructure(files: readonly FileNode[], chipName: string): CompileResult {
  const sourceFiles = files.filter(file => /\.(c|cpp)$/i.test(file.name));
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!sourceFiles.length) errors.push('未找到 .c 或 .cpp 源文件');
  if (!files.some(file => file.name === 'Makefile' || file.name === 'CMakeLists.txt')) warnings.push('未找到 Makefile 或 CMakeLists.txt');
  for (const file of sourceFiles) {
    const code = stripCCommentsAndStrings(file.content);
    const open = (code.match(/{/g) || []).length;
    const close = (code.match(/}/g) || []).length;
    if (open !== close) errors.push(`${file.path}：大括号数量不匹配`);
  }
  if (sourceFiles.length && !sourceFiles.some(file => /\bmain\s*\(/.test(stripCCommentsAndStrings(file.content)))) warnings.push('未检测到 main() 入口函数');
  const findings = analyzeProjectRisks(files);
  warnings.push(`目标芯片：${chipName}；当前仅进行本地结构检查，未调用 ARM GCC、Keil 或 IAR`);
  warnings.push('请使用厂商工具或实际工具链完成最终编译、链接、下载和硬件验证');
  const output = [
    'EmbedKit 工程检查（参考模式）',
    `检查文件：${files.length} 个，源文件：${sourceFiles.length} 个`,
    errors.length ? `错误：\n${errors.map(item => `  ✗ ${item}`).join('\n')}` : '错误：无',
    warnings.length ? `提示：\n${warnings.map(item => `  ! ${item}`).join('\n')}` : '',
    findings.length ? `静态风险：\n${findings.map(item => `  ${item.severity === 'high' ? '✗' : item.severity === 'medium' ? '!' : '·'} [${item.severity.toUpperCase()}] ${item.title} · ${item.file}${item.line ? `:${item.line}` : ''}\n    ${item.recommendation}`).join('\n')}` : '静态风险：未命中当前规则',
    errors.length ? '检查未通过，请先修正错误。' : '基础结构检查通过；这不代表已完成真实编译。',
  ].filter(Boolean).join('\n');
  return { success: errors.length === 0, output, size: files.reduce((total, file) => total + file.content.length, 0) };
}
