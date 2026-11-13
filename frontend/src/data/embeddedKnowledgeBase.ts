import repositoryMarkdown from 'virtual:embedkit-repository-markdown';

const { aiStandardsOverview, aiStartupProtocol, aiTaskRouting, aiGateEvidence, aiStopAuthorization, aiHandoffStatus, aiExecutionRules, aiProjectInputs, aiProjectWorkflow, aiSoftwareStandard, aiHardwareStandard, aiVerificationStandard, aiProjectVariables, aiDeliverableTemplates, aiGateDirectoryMap, projectDirectoryFramework, generalGuide, mcuProblemReview, linuxProblemReview, knowledgeOverview, engineeringMethod, mcuRtos, embeddedLinux, communicationStorage, testingEvidence, caseBoundaries, engineeringTemplates } = repositoryMarkdown;

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
  { id: 'ai-constraints', title: 'AI 嵌入式产品开发约束包', category: 'AI 约束', summary: '约束包导航、首次初始化闭环和整体层到技术层的按需读取入口。', tags: ['AI', '规范入口', '初始化', '规则路由'], sourcePath: 'docs/AI嵌入式开发规范/README.md', content: aiStandardsOverview, evidence: '执行约束' },
  { id: 'ai-startup-protocol', title: 'AI 项目启动与推进协议', category: 'AI 约束', summary: '固定约束包接收、输入锁定、阶段推进、门禁输出、停止恢复和交接动作。', tags: ['AI', '启动协议', '阶段推进', '停止规则', '交接'], sourcePath: 'docs/AI嵌入式开发规范/00-AI项目启动与推进协议.md', content: aiStartupProtocol, evidence: '执行约束' },
  { id: 'ai-task-routing', title: '任务定级与路由', category: 'AI 约束', summary: '按T0-T4、影响域和项目类型裁剪矩阵只加载当前需要的分册。', tags: ['任务定级', '影响域', '路由', '阶段裁剪'], sourcePath: 'docs/AI嵌入式开发规范/00A-任务定级与路由.md', content: aiTaskRouting, evidence: '执行约束' },
  { id: 'ai-gate-evidence', title: '门禁与证据总表', category: 'AI 约束', summary: '统一F/G/B/E、目录归属、必要交付物和阶段关闭条件。', tags: ['门禁', '证据等级', '阻塞', '目录映射'], sourcePath: 'docs/AI嵌入式开发规范/00B-门禁与证据总表.md', content: aiGateEvidence, evidence: '执行约束' },
  { id: 'ai-stop-authorization', title: '停止规则与授权边界', category: 'AI 约束', summary: '集中停止条件、恢复动作、工程师决定权和高影响操作权限。', tags: ['停止规则', '恢复', '授权', '工程师决定'], sourcePath: 'docs/AI嵌入式开发规范/00C-停止规则与授权边界.md', content: aiStopAuthorization, evidence: '执行约束' },
  { id: 'ai-handoff-status', title: '交接包与状态模板', category: 'AI 约束', summary: '规定最小交接包、跨会话读取顺序以及约束包版本升级。', tags: ['交接包', '跨会话', '版本', '状态'], sourcePath: 'docs/AI嵌入式开发规范/00D-交接包与状态模板.md', content: aiHandoffStatus, evidence: '执行约束' },
  { id: 'ai-execution-rules', title: 'AI 执行总则', category: 'AI 约束', summary: '用可审计规则 ID 约束 AI 的开工、事实、授权、停止和变更行为。', tags: ['AI', '权限', '安全', '证据', '停止规则'], sourcePath: 'docs/AI嵌入式开发规范/01-AI执行总则.md', content: aiExecutionRules, evidence: '执行约束' },
  { id: 'ai-project-inputs', title: '项目输入与立项', category: 'AI 约束', summary: '定义完整项目的输入域、输入状态、冲突处理、阻塞等级和 G0-G5 阶段门禁。', tags: ['项目输入', '立项', '需求', '输入基线', '阶段门禁'], sourcePath: 'docs/AI嵌入式开发规范/01A-项目输入与立项.md', content: aiProjectInputs, evidence: '执行约束' },
  { id: 'ai-project-workflow', title: '完整嵌入式项目开发流程', category: 'AI 约束', summary: '约束 AI 执行需求、架构、设计、样机、Bring-up、验证、试产和维护门禁。', tags: ['项目流程', '需求', '架构', 'Bring-up', '试产'], sourcePath: 'docs/AI嵌入式开发规范/02-完整项目开发流程.md', content: aiProjectWorkflow, evidence: '执行约束' },
  { id: 'ai-software-standard', title: '软件编程技术规范', category: 'AI 约束', summary: '原子约束接口、内存、错误、并发、MCU/RTOS、Linux、协议、存储和升级。', tags: ['软件规范', 'MCU', 'RTOS', 'Linux', '通信', 'OTA'], sourcePath: 'docs/AI嵌入式开发规范/03-软件编程技术规范.md', content: aiSoftwareStandard, evidence: '执行约束' },
  { id: 'ai-hardware-standard', title: '原理图与 PCB 设计规范', category: 'AI 约束', summary: '原子约束器件、封装、电源、接口、原理图、布局布线、制造和样机验证。', tags: ['原理图', 'PCB', '器件', '封装', 'DFM'], sourcePath: 'docs/AI嵌入式开发规范/04-原理图与PCB设计规范.md', content: aiHardwareStandard, evidence: '执行约束' },
  { id: 'ai-verification-standard', title: '验证与交付规范', category: 'AI 约束', summary: '按变更类型选择测试，约束 E0-E5 证据、诊断、完成判定和检查点。', tags: ['验证', '证据', '诊断', 'Git', '交付'], sourcePath: 'docs/AI嵌入式开发规范/05-验证与交付规范.md', content: aiVerificationStandard, evidence: '执行约束' },
  { id: 'ai-project-variables', title: '项目变量模板', category: 'AI 约束', summary: '规定 AI 开工前必须由具体项目补齐的软件、硬件、生产和恢复事实。', tags: ['项目事实', '变量模板', '硬件版本', '工具链', '恢复'], sourcePath: 'docs/AI嵌入式开发规范/06-项目变量模板.md', content: aiProjectVariables, evidence: '执行约束' },
  { id: 'ai-deliverable-templates', title: '交付物模板库', category: 'AI 约束', summary: '提供输入、需求追溯、接口预算、评审、验证、发布、风险和交接的统一骨架。', tags: ['交付物', '模板', '追溯矩阵', 'manifest', '证据等级'], sourcePath: 'docs/AI嵌入式开发规范/07-交付物模板库.md', content: aiDeliverableTemplates, evidence: '执行约束' },
  { id: 'ai-gate-directory-map', title: '阶段门禁与目录映射表（兼容入口）', category: 'AI 约束', summary: '旧入口已并入00B，第四步删除前仅用于兼容已有引用。', tags: ['兼容入口', '00B', '阶段门禁'], sourcePath: 'docs/AI嵌入式开发规范/08-阶段门禁与目录映射表.md', content: aiGateDirectoryMap, evidence: '执行约束' },
  { id: 'ai-project-directory-framework', title: '项目目录框架', category: 'AI 约束', summary: '规定项目目录的最小启动集、按需分类、迁移闭环和目录操作边界。', tags: ['目录框架', 'NEW', 'ORGANIZE', '迁移'], sourcePath: 'docs/项目目录框架.md', content: projectDirectoryFramework, evidence: '执行约束' },
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
  if (resolved === 'docs/AI嵌入式开发约束.md') return embeddedKnowledgeDocuments.find(document => document.id === 'ai-constraints');
  return embeddedKnowledgeDocuments.find(document => document.sourcePath === resolved);
}
