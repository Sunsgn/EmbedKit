import type { FileNode } from '../../types';

export interface ProjectFinding {
  id: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  file: string;
  line: number;
  evidence: string;
  recommendation: string;
}

function stripCCommentsAndStrings(value: string) {
  return value.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\r\n]*/g, '').replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '');
}

export function analyzeProjectRisks(files: readonly FileNode[]): ProjectFinding[] {
  const findings: ProjectFinding[] = [];
  const add = (severity: ProjectFinding['severity'], title: string, file: FileNode, line: number, evidence: string, recommendation: string) => {
    findings.push({ id: `${file.path}:${line}:${title}`, severity, title, file: file.path, line, evidence: evidence.trim().slice(0, 180), recommendation });
  };
  for (const file of files.filter(item => /\.(c|cc|cpp|h|hpp)$/i.test(item.name))) {
    const lines = file.content.split(/\r?\n/);
    lines.forEach((source, index) => {
      const line = index + 1;
      if (/\b(gets|strcpy|strcat|sprintf)\s*\(/.test(source)) add('high', '使用无边界字符串函数', file, line, source, '改用带容量限制的接口，并检查截断和结尾字符。');
      if (/\b(password|passwd|secret|token|api[_-]?key)\b\s*=\s*["'][^"']+["']/i.test(source)) add('high', '疑似硬编码凭据', file, line, source, '将凭据移出源码，使用安全存储或生产注入机制。');
      if (/\b(malloc|calloc|realloc|free)\s*\(/.test(source)) add('medium', '运行期动态内存', file, line, source, '确认碎片、失败路径和并发安全；实时任务优先考虑静态内存池。');
      const callbackContext = /(?:IRQHandler|Callback|_ISR|\bisr\b)/i.test(lines.slice(Math.max(0, index - 20), index + 1).join('\n'));
      if (/\b(HAL_Delay|sleep|usleep|vTaskDelay)\s*\(/.test(source) && callbackContext) add('high', '中断或回调上下文中存在阻塞调用', file, line, source, '中断中只记录事件，把延时和业务处理移到任务或主循环。');
      if (/\b(TODO|FIXME|HACK)\b/i.test(source)) add('low', '存在未完成标记', file, line, source, '发布前确认该标记是否影响功能、安全或量产配置。');
      if (/\bprintf\s*\(/.test(source) && callbackContext) add('medium', '中断或回调中输出日志', file, line, source, '改用无阻塞环形缓冲，在低优先级任务中输出。');
    });
  }
  const sources = files.filter(item => /\.(c|cc|cpp)$/i.test(item.name));
  if (sources.length && !sources.some(file => /\bmain\s*\(/.test(stripCCommentsAndStrings(file.content)))) {
    findings.push({ id: 'project:no-main', severity: 'high', title: '未识别到程序入口', file: '/', line: 0, evidence: '所有已导入源文件中均未发现 main()', recommendation: '确认是否漏选入口文件，或检查工程是否使用非标准启动框架。' });
  }
  if (!files.some(file => file.name === 'Makefile' || file.name === 'CMakeLists.txt' || ['platformio.ini', 'Kconfig', 'prj.conf', 'sdkconfig', 'SConstruct'].includes(file.name) || /\.(uvprojx|ewp)$/i.test(file.name))) {
    findings.push({ id: 'project:no-build', severity: 'medium', title: '未导入构建配置', file: '/', line: 0, evidence: '未发现 Makefile、CMakeLists.txt、Keil 或 IAR 工程文件', recommendation: '导入完整工程目录，以便确认宏定义、包含路径、链接脚本和目标芯片。' });
  }
  const rank = { high: 0, medium: 1, low: 2 } as const;
  return findings.sort((left, right) => rank[left.severity] - rank[right.severity]);
}
