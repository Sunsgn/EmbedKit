import repositoryMarkdown from 'virtual:embedkit-repository-markdown';

const { aiConstraints, generalGuide, mcuProblemReview, linuxProblemReview, knowledgeOverview, engineeringMethod, mcuRtos, embeddedLinux, communicationStorage, testingEvidence, caseBoundaries, engineeringTemplates } = repositoryMarkdown;

export type EmbeddedKnowledgeCategory = '知识导航' | '通用方法' | '平台开发' | '专题方法' | '工程模板' | 'AI 约束' | '问题复盘';

export interface EmbeddedKnowledgeDocument {
  id: string;
  title: string;
  category: EmbeddedKnowledgeCategory;
  summary: string;
  tags: string[];
  sourcePath: string;
  content: string;
  evidence: '通用归纳' | '执行约束' | '匿名工程复盘';
}

export const embeddedKnowledgeDocuments: EmbeddedKnowledgeDocument[] = [
  { id: 'overview', title: '嵌入式产品开发知识库', category: '知识导航', summary: '知识体系定位、内容导航、推荐使用路径、判断框架与来源边界。', tags: ['导航', '知识体系', '使用方法'], sourcePath: 'docs/嵌入式开发知识库/README.md', content: knowledgeOverview, evidence: '通用归纳' },
  { id: 'engineering-method', title: '通用工程方法', category: '通用方法', summary: '需求、事实盘点、受保护基线、分层、资源预算、增量实现与可恢复工程。', tags: ['需求', '架构', '资源预算', '工程恢复'], sourcePath: 'docs/嵌入式开发知识库/01-通用工程方法.md', content: engineeringMethod, evidence: '通用归纳' },
  { id: 'mcu-rtos', title: 'MCU 与 RTOS 开发', category: '平台开发', summary: '板级 Bring-up、驱动、ISR、任务并发、资源健康、安全控制与低功耗。', tags: ['MCU', 'RTOS', 'ISR', '驱动', '低功耗'], sourcePath: 'docs/嵌入式开发知识库/02-MCU与RTOS开发.md', content: mcuRtos, evidence: '通用归纳' },
  { id: 'embedded-linux', title: '嵌入式 Linux 开发', category: '平台开发', summary: 'Boot、Kernel、DTS、驱动、rootfs、应用、IPC、ABI、部署和运行资源。', tags: ['Linux', 'DTS', '驱动', 'IPC', '部署'], sourcePath: 'docs/嵌入式开发知识库/03-嵌入式Linux开发.md', content: embeddedLinux, evidence: '通用归纳' },
  { id: 'communication-storage', title: '通信、存储、升级与安全', category: '专题方法', summary: '协议接收路径、链路状态机、持久化、OTA、日志和安全边界。', tags: ['通信', '协议', '存储', 'OTA', '安全'], sourcePath: 'docs/嵌入式开发知识库/04-通信存储升级与安全.md', content: communicationStorage, evidence: '通用归纳' },
  { id: 'testing-evidence', title: '测试、证据、故障与发布', category: '专题方法', summary: 'E0-E5 证据等级、测试矩阵、故障收敛、资源验证和发布门禁。', tags: ['测试', '证据', '故障诊断', '发布'], sourcePath: 'docs/嵌入式开发知识库/05-测试证据故障与发布.md', content: testingEvidence, evidence: '通用归纳' },
  { id: 'case-boundaries', title: '案例经验与复用边界', category: '通用方法', summary: '区分跨平台规律、子系统规律和项目配置，防止错误照搬案例参数。', tags: ['案例', '复用', '适用边界'], sourcePath: 'docs/嵌入式开发知识库/06-案例经验与复用边界.md', content: caseBoundaries, evidence: '通用归纳' },
  { id: 'templates', title: '工程模板', category: '工程模板', summary: '任务卡、事实表、资源预算、协议、测试、故障、发布和 AI 交付模板。', tags: ['模板', '任务卡', '测试记录', 'manifest'], sourcePath: 'docs/嵌入式开发知识库/07-工程模板.md', content: engineeringTemplates, evidence: '通用归纳' },
  { id: 'ai-constraints', title: 'AI 嵌入式产品开发约束', category: 'AI 约束', summary: '供编码代理和对话助手执行的强制工程、安全、验证与交付规则。', tags: ['AI', '约束', '安全', '验证', 'Git'], sourcePath: 'docs/AI嵌入式开发约束.md', content: aiConstraints, evidence: '执行约束' },
  { id: 'general-ai-guide', title: 'AI 辅助嵌入式产品开发通用指南', category: '通用方法', summary: '从真实工程经验形成的 AI 协作方法、端到端流程、重点领域和反模式。', tags: ['AI 协作', '工作流', '通信', '资源'], sourcePath: 'docs/AI辅助嵌入式产品开发通用指南.md', content: generalGuide, evidence: '通用归纳' },
  { id: 'mcu-problem-review', title: 'MCU 与 RTOS 问题解决及开发规避', category: '问题复盘', summary: '多链路通信、RTOS 资源、中断实时性、掉电缓存、低功耗和安全控制的解决与规避方法。', tags: ['MCU', 'RTOS', '通信所有权', '资源诊断', '低功耗', '安全控制'], sourcePath: 'docs/MCU与RTOS问题解决及开发规避.md', content: mcuProblemReview, evidence: '匿名工程复盘' },
  { id: 'linux-problem-review', title: '嵌入式 Linux 问题解决及开发规避', category: '问题复盘', summary: '分层定位、物理位映射、稳定设备接口、ABI、流处理、进程治理和存储上限的解决与规避方法。', tags: ['Linux', '驱动', 'DMA', '物理位映射', 'ABI', 'IPC', '部署'], sourcePath: 'docs/嵌入式Linux问题解决及开发规避.md', content: linuxProblemReview, evidence: '匿名工程复盘' },
];

export const embeddedKnowledgeCategories = [...new Set(embeddedKnowledgeDocuments.map(document => document.category))];

export function searchEmbeddedKnowledge(query: string, category = '') {
  const tokens = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return embeddedKnowledgeDocuments.filter(document => (!category || document.category === category) && tokens.every(token => `${document.title} ${document.summary} ${document.tags.join(' ')} ${document.content}`.toLocaleLowerCase().includes(token)));
}

export function knowledgeMatchSnippet(document: EmbeddedKnowledgeDocument, query: string) {
  const token = query.trim().toLocaleLowerCase().split(/\s+/).find(Boolean);
  if (!token) return document.summary;
  const plain = document.content.replace(/```[\s\S]*?```/g, ' ').replace(/[#*`|>()_-]+/g, ' ').replaceAll('[', ' ').replaceAll(']', ' ').replace(/\s+/g, ' ').trim();
  const index = plain.toLocaleLowerCase().indexOf(token);
  if (index < 0) return document.summary;
  const start = Math.max(0, index - 46), end = Math.min(plain.length, index + token.length + 90);
  return `${start ? '…' : ''}${plain.slice(start, end)}${end < plain.length ? '…' : ''}`;
}

export function resolveEmbeddedKnowledgeLink(current: EmbeddedKnowledgeDocument, href: string) {
  if (/^[a-z]+:/i.test(href) || href.startsWith('#')) return undefined;
  const base = current.sourcePath.split('/').slice(0, -1);
  for (const part of href.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') base.pop();
    else base.push(decodeURIComponent(part));
  }
  const resolved = base.join('/');
  return embeddedKnowledgeDocuments.find(document => document.sourcePath === resolved);
}
