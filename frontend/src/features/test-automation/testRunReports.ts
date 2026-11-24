import { createTestRunJsonReport } from '../../services/testRunEvidence';
import type { TestRunRecord } from '../../types/product';
import type { Channel, StepType } from './domain';

const channelLabels: Partial<Record<Channel, string>> = {
  'serial-a': '串口 A', 'serial-b': '串口 B', websocket: 'WebSocket', tcp: 'TCP', udp: 'UDP',
};
const typeLabels: Partial<Record<StepType, string>> = {
  command: '发送并断言', send: '发送数据', wait: '等待响应', match: '匹配响应', delay: '延时',
  'wait-online': '等待通道在线', 'clear-buffer': '清空接收缓冲', 'set-variable': '设置变量', manual: '人工确认',
};

export function escapeReportMarkup(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
}

export function createTestRunHtmlReport(run: TestRunRecord) {
  const rows = run.steps.map(step => `<tr><td>${escapeReportMarkup(step.name)}</td><td>${escapeReportMarkup(typeLabels[step.type as StepType] ?? step.type)}</td><td>${escapeReportMarkup(channelLabels[step.channel as Channel] ?? step.channel)}</td><td>${escapeReportMarkup(step.status)}</td><td>${step.durationMs} ms</td><td>${escapeReportMarkup(step.evidence?.source ?? '无')}</td><td>${escapeReportMarkup(step.evidence?.observed ?? step.error)}</td></tr>`).join('');
  const environment = Object.entries(run.environment).map(([name, value]) => `<li><b>${escapeReportMarkup(name)}</b>：${escapeReportMarkup(value)}</li>`).join('');
  const logs = run.logs.map(log => `${escapeReportMarkup(log.time)} [${escapeReportMarkup(log.level)}] ${escapeReportMarkup(log.text)}`).join('\n');
  const firmware = run.firmware ? `${escapeReportMarkup(run.firmware.artifactName)} · SHA-256 ${escapeReportMarkup(run.firmware.sha256)}` : '未关联已计算的固件指纹';
  const communications = (run.communications ?? []).map((item, index) => `<li>${escapeReportMarkup(item.channel)} · ${escapeReportMarkup(item.transport)} · ${escapeReportMarkup(item.endpoint)} · RX ${item.rxBytes} / TX ${item.txBytes} 字节 · 归档 ${escapeReportMarkup(run.communicationSessionIds?.[index] ?? '未归档')} · 源会话 ${escapeReportMarkup(item.sessionId)}</li>`).join('');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>EmbedKit 测试报告</title><style>body{font:14px sans-serif;margin:32px;color:#222}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}.passed{color:#16803c}.failed,.error{color:#c62828}pre{white-space:pre-wrap;background:#f5f5f5;padding:12px}</style></head><body><h1>EmbedKit 通信测试报告</h1><p>套件：${escapeReportMarkup(run.suiteName)} · 流程：${escapeReportMarkup(run.caseName)}</p><p>固件：${firmware}</p><p>Agent：${escapeReportMarkup(run.agentVersion)} · 开始：${escapeReportMarkup(new Date(run.startedAt).toLocaleString())} · 耗时：${run.durationMs} ms</p><p class="${escapeReportMarkup(run.status)}">结果：${escapeReportMarkup(run.status)} · 通过 ${run.passed} · 失败 ${run.failed}</p><h2>证据说明</h2><p>通信响应来自实际会话；人工确认仅代表操作人员确认；固件与端点快照只用于追溯，不单独证明测试通过。</p><h2>通信会话</h2><ul>${communications || '<li>本次流程未建立通信会话</li>'}</ul><h2>运行环境</h2><ul>${environment || '<li>无公开变量</li>'}</ul><h2>步骤</h2><table><tr><th>步骤</th><th>类型</th><th>通道</th><th>结果</th><th>耗时</th><th>证据类型</th><th>观测/失败</th></tr>${rows}</table><h2>执行日志</h2><pre>${logs}</pre></body></html>`;
}

export function createTestRunJunitReport(run: TestRunRecord) {
  const cases = run.steps.map(step => `<testcase name="${escapeReportMarkup(step.name)}" classname="${escapeReportMarkup(run.suiteName)}" time="${(step.durationMs / 1000).toFixed(3)}">${step.status === 'failed' ? `<failure message="${escapeReportMarkup(step.error || 'failed')}"/>` : step.status === 'skipped' ? '<skipped/>' : ''}</testcase>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><testsuite name="${escapeReportMarkup(run.caseName)}" tests="${run.steps.length}" failures="${run.failed}" skipped="${run.steps.filter(step => step.status === 'skipped').length}" time="${(run.durationMs / 1000).toFixed(3)}">${cases}</testsuite>`;
}

export function createTestRunCsvReport(run: TestRunRecord) {
  const quote = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const rows = [['步骤', '类型', '通道', '状态', '耗时(ms)', '重试', '失败原因'], ...run.steps.map(step => [step.name, step.type, step.channel, step.status, step.durationMs, step.retries, step.error ?? ''])];
  return `\uFEFF${rows.map(row => row.map(quote).join(',')).join('\r\n')}`;
}

export function createPortableTestRunJsonReport(run: TestRunRecord) {
  return JSON.stringify(createTestRunJsonReport(run), null, 2);
}
