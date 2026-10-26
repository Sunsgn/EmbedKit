import { useEffect, useState, useMemo } from 'react';
import {
  BookOpen,
  ExternalLink,
  Code,
  ChevronRight,
  ChevronDown,
  Globe,
  Play,
  FileText,
  GraduationCap,
  Copy,
  Check,
  Search,
  LayoutGrid,
  GitBranch,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Compass,
  Flag,
  Bug,
  Wrench,
  Server,
  BatteryLow,
  ShieldCheck,
  BrainCircuit,
} from 'lucide-react';
import { roadmapPhases } from '../data/roadmap';
import { embeddedSources } from '../data/embeddedSources';
import { lessonGuides } from '../data/lessonGuides';
import { topicLessons } from '../data/topicLessons';
import type { RoadmapModule, ExternalResource } from '../types';
import {
  moduleCompletion,
  parseLearningProgress,
  updateModuleProgress,
  type ModuleLearningProgress,
} from '../utils/learningProgress';
import CodeEditor from '../components/CodeEditor';

/* ── icon mapper ── */
const iconMap: Record<string, React.ElementType> = {
  code: Code,
  zap: ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  cpu: ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" />
      <line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" />
    </svg>
  ),
  wifi: ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M1.42 9a16 16 0 0 1 21.16 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
  ),
  network: ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="5" r="3" /><circle cx="5" cy="19" r="3" /><circle cx="19" cy="19" r="3" />
      <line x1="12" y1="8" x2="5" y2="16" /><line x1="12" y1="8" x2="19" y2="16" />
    </svg>
  ),
  layers: ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  ),
  cloud: ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    </svg>
  ),
  bug: Bug,
  tools: Wrench,
  server: Server,
  battery: BatteryLow,
  shield: ShieldCheck,
  brain: BrainCircuit,
};

const IconComponent = ({ name, className }: { name: string; className?: string }) => {
  const Comp = iconMap[name] || Code;
  return <Comp className={className} />;
};

type PhaseGuide = {
  order: number;
  level: '共同基础' | '核心主线' | '专精方向';
  outcome: string;
  practice: string;
};

const phaseGuides: Record<string, PhaseGuide> = {
  'c-fundamentals': { order: 1, level: '共同基础', outcome: '能读写面向寄存器和驱动的 C 代码', practice: '实现环形缓冲区与状态机' },
  'electronics-basics': { order: 2, level: '共同基础', outcome: '能看懂最小系统原理图并完成基础测量', practice: '面包板搭建按键与 LED 电路' },
  'build-tools': { order: 3, level: '共同基础', outcome: '能用 Git 与构建工具复现一次固件构建', practice: '建立可复现的命令行工程' },
  'stm32-development': { order: 4, level: '核心主线', outcome: '能独立完成 MCU 工程、GPIO、定时器和 ADC', practice: '完成温度采集与串口输出' },
  debugging: { order: 5, level: '核心主线', outcome: '能用断点、寄存器和波形定位软硬件故障', practice: '定位 HardFault 与时序异常' },
  'stm32-advanced-peripherals': { order: 6, level: '核心主线', outcome: '能正确使用中断、DMA 与看门狗', practice: '实现 DMA 双缓冲采集' },
  protocols: { order: 7, level: '核心主线', outcome: '能按时序和协议规范实现可靠通信', practice: '实现带校验与超时的设备驱动' },
  rtos: { order: 8, level: '核心主线', outcome: '能设计任务、同步、通信与资源边界', practice: '将裸机项目重构为多任务系统' },
  'pcb-design': { order: 9, level: '专精方向', outcome: '能完成 MCU 最小系统板并输出生产文件', practice: '设计并打样一块传感器节点' },
  'esp32-development': { order: 10, level: '专精方向', outcome: '能开发具备 Wi-Fi/BLE 能力的联网设备', practice: '实现本地配网与数据上报' },
  'iot-cloud': { order: 11, level: '专精方向', outcome: '能贯通设备、消息服务与 OTA 链路', practice: '搭建设备遥测与远程升级闭环' },
  'embedded-linux': { order: 12, level: '专精方向', outcome: '能完成交叉构建、系统裁剪和基础驱动开发', practice: '构建镜像并接入一个字符设备' },
  'low-power': { order: 13, level: '专精方向', outcome: '能从测量结果出发优化设备平均功耗', practice: '完成电池寿命预算与低功耗唤醒' },
  security: { order: 14, level: '专精方向', outcome: '能建立可信启动、密钥与升级安全基线', practice: '实现签名校验与防回滚流程' },
  'edge-ai': { order: 15, level: '专精方向', outcome: '能部署量化模型并评估内存、延迟与精度', practice: '部署一个传感器分类模型' },
};

const coreStages = [
  { id: 'foundation', label: '01 · 打牢基础', hint: 'C 与电路并行学习，工具链贯穿全程', phaseIds: ['c-fundamentals', 'electronics-basics', 'build-tools'] },
  { id: 'bare-metal', label: '02 · 跑通裸机', hint: '先让外设工作，再学会观察和定位问题', phaseIds: ['stm32-development', 'debugging', 'stm32-advanced-peripherals'] },
  { id: 'system', label: '03 · 构建系统', hint: '从可靠通信进入并发、实时与系统设计', phaseIds: ['protocols', 'rtos'] },
] as const;

const specializationTracks = [
  { id: 'hardware', title: '硬件产品', description: '从原理图走到可生产硬件', phaseIds: ['pcb-design'], color: '#84cc16' },
  { id: 'iot', title: '联网与 IoT', description: '设备联网、消息链路与远程升级', phaseIds: ['esp32-development', 'iot-cloud'], color: '#22c55e' },
  { id: 'linux', title: '嵌入式 Linux', description: '面向 MPU、网关与复杂系统', phaseIds: ['embedded-linux'], color: '#a855f7' },
  { id: 'quality', title: '可靠与低功耗', description: '量产设备的续航与安全基线', phaseIds: ['low-power', 'security'], color: '#f97316' },
  { id: 'ai', title: '边缘智能', description: '在资源受限设备上部署模型', phaseIds: ['edge-ai'], color: '#8b5cf6' },
] as const;

const officialReferences = [
  'arm-cmsis',
  'freertos-docs',
  'zephyr-docs',
  'rt-thread-docs',
  'linux-kernel-docs',
  'iar-docs',
].map(id => embeddedSources.find(source => source.id === id)).filter((source): source is (typeof embeddedSources)[number] => Boolean(source));

/* ── resource type badge ── */
const typeLabel: Record<string, string> = {
  video: '视频',
  doc: '文档',
  course: '课程',
  book: '书籍',
  project: '项目',
};

const typeIcon: Record<string, React.ElementType> = {
  video: Play,
  doc: FileText,
  course: GraduationCap,
  book: BookOpen,
  project: Code,
};

const typeColor: Record<string, string> = {
  video: 'bg-red-500/10 text-red-400',
  doc: 'bg-blue-500/10 text-blue-400',
  course: 'bg-purple-500/10 text-purple-400',
  book: 'bg-yellow-500/10 text-yellow-400',
  project: 'bg-green-500/10 text-green-400',
};

function ResourceCard({ resource }: { resource: ExternalResource }) {
  const Icon = typeIcon[resource.type] || FileText;
  const langLabel = resource.lang === 'zh' ? '中' : 'EN';

  return (
    <a
      href={resource.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-3 p-3 rounded-lg bg-[#0d1117] border border-[#30363d] hover:border-blue-500/40 transition-all group"
    >
      <div className={`p-2 rounded-md ${typeColor[resource.type]}`}>
        <Icon size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-white font-medium group-hover:text-blue-300 transition-colors truncate">
            {resource.title}
          </span>
          <ExternalLink size={10} className="text-gray-500 flex-shrink-0 group-hover:text-blue-400" />
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-xs px-1.5 py-0.5 rounded ${typeColor[resource.type]}`}>
            {typeLabel[resource.type]}
          </span>
          <span className="text-xs text-gray-500">{langLabel}</span>
        </div>
      </div>
    </a>
  );
}

/* ── module detail panel ── */
function ModuleDetail({ module, progress, onProgressChange, onClose }: { module: RoadmapModule; progress?: ModuleLearningProgress; onProgressChange: (patch: Partial<Pick<ModuleLearningProgress, 'checklist' | 'evidence'>>) => void; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [expandedTopic, setExpandedTopic] = useState<number | null>(null);
  const lessonGuide = lessonGuides[module.id];
  const completion = moduleCompletion(progress, lessonGuide?.checklist ?? []);

  const handleCopy = () => {
    if (module.codeExample) {
      navigator.clipboard.writeText(module.codeExample);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getTopicName = (t: string | { name: string; content?: string }) =>
    typeof t === 'string' ? t : t.name;

  const getTopicContent = (t: string | { name: string; content?: string }) =>
    typeof t === 'string' ? topicLessons[t] : t.content;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#161b22] border border-[#30363d] rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#30363d]">
          <div>
            <h2 className="text-lg font-bold text-white">{module.title}</h2>
            <p className="text-sm text-gray-400 mt-1">{module.description}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[#1c2128] text-gray-400 hover:text-white transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
          {lessonGuide && (
            <div className="mb-6 space-y-4">
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-blue-400">
                  <Compass size={15} />本节学习目标
                </div>
                <p className="text-sm leading-6 text-gray-300">{lessonGuide.goal}</p>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold text-gray-300">建议学习顺序</h3>
                <div className="space-y-2">
                  {lessonGuide.studyPath.map((step, index) => (
                    <div key={step} className="flex gap-3 rounded-lg border border-[#30363d] bg-[#0d1117] p-3">
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-xs font-semibold text-blue-400">{index + 1}</span>
                      <p className="text-xs leading-5 text-gray-400">{step}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-green-400"><Flag size={14} />动手实验：{lessonGuide.practice.title}</h3>
                  <ol className="space-y-1.5">
                    {lessonGuide.practice.steps.map((step, index) => <li key={step} className="text-xs leading-5 text-gray-400">{index + 1}. {step}</li>)}
                  </ol>
                </div>
                <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-purple-400"><CheckCircle2 size={14} />完成标准</h3>
                  <ul className="space-y-1.5">
                    {lessonGuide.checklist.map((item) => <li key={item}><label className="flex cursor-pointer gap-2 text-xs leading-5 text-gray-400"><input type="checkbox" checked={progress?.checklist.includes(item) ?? false} onChange={event => onProgressChange({ checklist: event.target.checked ? [...new Set([...(progress?.checklist ?? []), item])] : (progress?.checklist ?? []).filter(value => value !== item) })} className="mt-1 accent-purple-500" /><span>{item}</span></label></li>)}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <section className={`mb-6 rounded-xl border p-4 ${completion.complete ? 'border-green-500/30 bg-green-500/5' : 'border-[#30363d] bg-[#0d1117]'}`}>
            <div className="flex items-center gap-2"><CheckCircle2 size={14} className={completion.complete ? 'text-green-400' : 'text-gray-600'} /><b className="text-sm text-gray-300">{completion.complete ? '本模块已通过实践验收' : '实践证据与进度'}</b><span className="ml-auto text-[10px] text-gray-500">{completion.checked}/{completion.total} 项完成标准</span></div>
            <p className="mt-2 text-[11px] leading-5 text-gray-500">记录仓库路径、测试报告、串口日志或实物照片位置。只有完成全部标准且留下证据才计为学会。</p>
            <textarea value={progress?.evidence ?? ''} onChange={event => onProgressChange({ evidence: event.target.value })} placeholder="例：records/uart-loopback.json；实物验证日期与现象…" className="mt-2 min-h-20 w-full resize-y rounded border border-[#30363d] bg-[#111820] p-2 text-xs text-gray-300 outline-none focus:border-blue-500/50" />
          </section>

          {/* Topics */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 11 12 14 22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
              知识讲解与提纲
            </h3>
            <div className="space-y-2">
              {module.topics.map((topic, i) => {
                const name = getTopicName(topic);
                const content = getTopicContent(topic);
                const hasContent = !!content;
                const isExpanded = expandedTopic === i;
                return (
                  <div key={i} className={`rounded-lg bg-[#0d1117] border overflow-hidden transition-colors ${isExpanded ? 'border-blue-500/30' : 'border-[#30363d]'}`}>
                    <button
                      onClick={() => hasContent && setExpandedTopic(isExpanded ? null : i)}
                      disabled={!hasContent}
                      className={`w-full flex items-center gap-2 text-sm px-3 py-2.5 text-left transition-colors ${hasContent ? 'hover:bg-[#1c2128] cursor-pointer' : 'cursor-default'}`}
                    >
                      {!hasContent ? (
                        <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-gray-600" />
                      ) : isExpanded ? (
                        <ChevronDown size={14} className="text-blue-400 flex-shrink-0" />
                      ) : (
                        <ChevronRight size={14} className="text-gray-500 flex-shrink-0" />
                      )}
                      <span className="text-gray-300 flex-1">{name}</span>
                      {hasContent && (
                        <span className="text-xs text-blue-400/60 flex-shrink-0">{isExpanded ? '收起' : '展开'}</span>
                      )}
                    </button>
                    {isExpanded && hasContent && (
                      <div className="px-3 pb-3 pt-1 border-t border-[#30363d]/50 space-y-2">
                        {content && (
                          <div
                            className="text-xs text-gray-400 leading-relaxed whitespace-pre-wrap"
                            dangerouslySetInnerHTML={{ __html: content }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Resources */}
          {module.resources.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <Globe size={16} />
                扩展资料（非必读）
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {module.resources.map((res, i) => (
                  <ResourceCard key={i} resource={res} />
                ))}
              </div>
            </div>
          )}

          {/* Code Example */}
          {module.codeExample && (
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <Code size={16} />
                代码示例
              </h3>
              <div className="bg-[#0d1117] border border-[#30363d] rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-[#30363d]">
                  <span className="text-xs text-gray-400 uppercase">{module.codeLang || 'c'}</span>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? '已复制' : '复制代码'}
                  </button>
                </div>
                <CodeEditor
                  height={Math.min(400, module.codeExample.split('\n').length * 19 + 40)}
                  language={module.codeLang || 'c'}
                  value={module.codeExample}
                  readOnly
                  fontSize={13}
                  ariaLabel="课程代码示例"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── DAG roadmap view ── */
export function LegacyRoadmapView({ phases, onSelectModule }: { phases: typeof roadmapPhases; onSelectModule: (m: RoadmapModule) => void }) {
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);
  const [hoveredPhase, setHoveredPhase] = useState<string | null>(null);

  const phaseMap = useMemo(() => {
    const map: Record<string, (typeof phases)[0]> = {};
    phases.forEach(p => { map[p.id] = p; });
    return map;
  }, [phases]);

  // Build adjacency: parentId -> childId[] and reverse: childId -> parentId[]
  const childrenMap = useMemo(() => {
    const map = new Map<string, string[]>();
    phases.forEach(p => map.set(p.id, []));
    phases.forEach(p => {
      (p.prerequisites || []).forEach(depId => {
        if (map.has(depId)) {
          map.get(depId)!.push(p.id);
        }
      });
    });
    return map;
  }, [phases]);

  const parentsMap = useMemo(() => {
    const map = new Map<string, string[]>();
    phases.forEach(p => map.set(p.id, []));
    phases.forEach(p => {
      (p.prerequisites || []).forEach(depId => {
        if (map.has(depId)) {
          map.get(p.id)!.push(depId);
        }
      });
    });
    return map;
  }, [phases]);

  // All DAG edges (parent -> child via prerequisites)
  const edges = useMemo(() => {
    const result: Array<{ from: string; to: string }> = [];
    phases.forEach(p => {
      (p.prerequisites || []).forEach(depId => {
        result.push({ from: depId, to: p.id });
      });
    });
    return result;
  }, [phases]);

  // Layered DAG layout (longest-path layering + barycentric ordering)
  const nodePositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    const phaseIds = phases.map(p => p.id);

    // Step 1: Assign layers via longest-path layering (topological)
    const layers = new Map<string, number>();
    const inDegree = new Map<string, number>();
    phaseIds.forEach(id => {
      inDegree.set(id, (parentsMap.get(id) || []).filter(p => phaseIds.includes(p)).length);
    });

    // Initialize roots at layer 0
    const queue: string[] = [];
    phaseIds.forEach(id => {
      if (inDegree.get(id) === 0) {
        layers.set(id, 0);
        queue.push(id);
      }
    });

    // BFS topological layering (longest path)
    const q: string[] = [...queue];
    while (q.length > 0) {
      const nodeId = q.shift()!;
      const nodeLayer = layers.get(nodeId)!;
      const children = childrenMap.get(nodeId) || [];
      children.forEach(childId => {
        const childLayer = layers.get(childId) ?? 0;
        layers.set(childId, Math.max(childLayer, nodeLayer + 1));
        inDegree.set(childId, (inDegree.get(childId) || 0) - 1);
        if (inDegree.get(childId) === 0) {
          q.push(childId);
        }
      });
    }

    // Handle any nodes not reached (cycles or disconnected)
    phaseIds.forEach(id => {
      if (!layers.has(id)) layers.set(id, 0);
    });

    // Step 2: Group nodes by layer
    const layerGroups: Record<number, string[]> = {};
    phaseIds.forEach(id => {
      const l = layers.get(id)!;
      if (!layerGroups[l]) layerGroups[l] = [];
      layerGroups[l].push(id);
    });

    // Step 3: Barycentric ordering to minimize edge crossings
    const maxLayer = Math.max(...Object.keys(layerGroups).map(Number), 0);
    for (let iteration = 0; iteration < 5; iteration++) {
      // Top-down pass
      for (let l = 1; l <= maxLayer; l++) {
        const group = layerGroups[l];
        if (!group) continue;
        group.sort((a, b) => {
          const aParents = parentsMap.get(a) || [];
          const bParents = parentsMap.get(b) || [];
          const aAvg = aParents.length > 0
            ? aParents.reduce((s, p) => s + (group.indexOf(p) >= 0 ? group.indexOf(p) : phaseIds.indexOf(p)), 0) / aParents.length
            : phaseIds.indexOf(a);
          const bAvg = bParents.length > 0
            ? bParents.reduce((s, p) => s + (group.indexOf(p) >= 0 ? group.indexOf(p) : phaseIds.indexOf(p)), 0) / bParents.length
            : phaseIds.indexOf(b);
          return aAvg - bAvg;
        });
      }
      // Bottom-up pass
      for (let l = maxLayer - 1; l >= 0; l--) {
        const group = layerGroups[l];
        if (!group) continue;
        group.sort((a, b) => {
          const aChildren = childrenMap.get(a) || [];
          const bChildren = childrenMap.get(b) || [];
          const nextLayer = layerGroups[l + 1] || [];
          const aAvg = aChildren.length > 0
            ? aChildren.reduce((s, c) => s + nextLayer.indexOf(c), 0) / aChildren.length
            : phaseIds.indexOf(a);
          const bAvg = bChildren.length > 0
            ? bChildren.reduce((s, c) => s + nextLayer.indexOf(c), 0) / bChildren.length
            : phaseIds.indexOf(b);
          return aAvg - bAvg;
        });
      }
    }

    // Step 4: Assign coordinates (left-to-right layout, X = layer, Y = position within layer)
    const LAYER_SPACING = 220;
    const NODE_V_SPACING = 80;
    const startX = 120;
    const offsetY = 100;

    for (let l = 0; l <= maxLayer; l++) {
      const group = layerGroups[l] || [];
      const x = startX + l * LAYER_SPACING;
      const totalHeight = (group.length - 1) * NODE_V_SPACING;
      group.forEach((nodeId, i) => {
        const y = offsetY + totalHeight / 2 + i * NODE_V_SPACING;
        positions[nodeId] = { x, y };
      });
    }

    return positions;
  }, [phases, childrenMap, parentsMap]);

  const phaseColor = (id: string) => {
    const phase = phases.find(p => p.id === id);
    return phase?.color || '#60a5fa';
  };

  const totalResources = phases.reduce(
    (sum, p) => sum + p.modules.reduce((s, m) => s + m.resources.length, 0), 0
  );

  return (
    <div className="overflow-x-auto overflow-y-visible scrollbar-thin py-6">
      <svg
        className="w-full"
        style={{ minWidth: '1700px', height: '600px' }}
        viewBox="0 0 1700 600"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#484f58" />
        </marker>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Title */}
        <text x="850" y="28" textAnchor="middle" fill="#ffffff" fontSize="18" fontWeight="bold">
          嵌入式开发学习路线图
        </text>
        <text x="850" y="48" textAnchor="middle" fill="#8b949e" fontSize="12">
          点击节点查看详情 · 箭头表示先修依赖
        </text>


        {/* Edges - smooth left-to-right curves */}
        {edges.map((edge, idx) => {
          const from = nodePositions[edge.from];
          const to = nodePositions[edge.to];
          if (!from || !to) return null;
          const isHighlighted = hoveredPhase === edge.from || hoveredPhase === edge.to || selectedPhase === edge.from || selectedPhase === edge.to;
          const toColor = phaseColor(edge.to);
          const x1 = from.x + 60;
          const y1 = from.y;
          const x2 = to.x - 60;
          const y2 = to.y;
          const cpx = (x1 + x2) / 2;
          return (
            <g key={`${edge.from}-${edge.to}-${idx}`}>
              <path
                d={`M ${x1} ${y1} C ${cpx} ${y1}, ${cpx} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke={isHighlighted ? toColor : '#30363d'}
                strokeWidth={isHighlighted ? 2.5 : 1.5}
                opacity={isHighlighted ? 0.9 : 0.5}
                markerEnd="url(#arrowhead)"
                style={{ transition: 'all 0.3s ease' }}
              />
            </g>
          );
        })}

        {/* Nodes */}
        {phases.map((phase) => {
          const pos = nodePositions[phase.id];
          if (!pos) return null;
          const color = phaseColor(phase.id);
          const isSelected = selectedPhase === phase.id;
          const isHovered = hoveredPhase === phase.id;
          const isHighlighted = isHovered || isSelected;

          // Check if this phase is connected to hovered/selected
          const isConnected = hoveredPhase && (
            (phase.prerequisites || []).includes(hoveredPhase) ||
            phases.some(p => (p.prerequisites || []).includes(hoveredPhase) && p.id === phase.id) ||
            (phase.prerequisites || []).includes(selectedPhase!) ||
            phases.some(p => (p.prerequisites || []).includes(selectedPhase!) && p.id === phase.id)
          );
          const dimmed = (hoveredPhase || selectedPhase) && !isHovered && !isSelected && !isConnected;

          return (
            <g
              key={phase.id}
              opacity={dimmed ? 0.25 : 1}
              style={{ transition: 'opacity 0.3s ease' }}
            >
              {/* Node background */}
              <rect
                x={pos.x - 60} y={pos.y - 28} width="120" height="56" rx="10"
                fill={isHighlighted ? `${color}25` : '#0d1117'}
                stroke={color}
                strokeWidth={isHighlighted ? 2.5 : 1.5}
                className="cursor-pointer"
                filter={isHighlighted ? 'url(#glow)' : undefined}
                onClick={() => setSelectedPhase(isSelected ? null : phase.id)}
                onMouseEnter={() => setHoveredPhase(phase.id)}
                onMouseLeave={() => setHoveredPhase(null)}
                style={{ transition: 'all 0.3s ease' }}
              />

              {/* Phase icon */}
              <text x={pos.x} y={pos.y - 6} textAnchor="middle" fill={color} fontSize="14">
                {phase.icon === 'code' ? '⟨⟩' : phase.icon === 'zap' ? '⚡' : phase.icon === 'cpu' ? '▣' : phase.icon === 'network' ? '◈' : phase.icon === 'layers' ? '△' : phase.icon === 'cloud' ? '☁' : phase.icon === 'bug' ? '🐛' : phase.icon === 'tools' ? '🔧' : '•'}
              </text>

              {/* Phase title */}
              <text
                x={pos.x} y={pos.y + 10} textAnchor="middle"
                fill={isHighlighted ? '#ffffff' : '#c9d1d9'}
                fontSize="11" fontWeight={isHighlighted ? 'bold' : 'normal'}
                className="cursor-pointer"
                onClick={() => setSelectedPhase(isSelected ? null : phase.id)}
                onMouseEnter={() => setHoveredPhase(phase.id)}
                onMouseLeave={() => setHoveredPhase(null)}
              >
                {phase.title.length > 12 ? phase.title.substring(0, 12) + '…' : phase.title}
              </text>

              {/* Duration badge */}
              <text x={pos.x} y={pos.y + 22} textAnchor="middle" fill="#8b949e" fontSize="9">
                {phase.duration}
              </text>

       {/* Expanded detail panel (to the right of node) */}
                {isSelected && (
                  <g>
                    <rect
                      x={pos.x + 70} y={pos.y - 65} width="260" height="140" rx="8"
                      fill="#161b22" stroke={color} strokeWidth="1.5" opacity="0.97"
                    />
                    <text x={pos.x + 86} y={pos.y - 45} fill={color} fontSize="12" fontWeight="bold">
                      {phase.title}
                    </text>
                    <text x={pos.x + 86} y={pos.y - 29} fill="#8b949e" fontSize="10">
                      {phase.description.length > 40 ? phase.description.substring(0, 40) + '...' : phase.description}
                    </text>
                    {phase.prerequisites && phase.prerequisites.length > 0 && (
                      <text x={pos.x + 86} y={pos.y - 13} fill="#60a5fa" fontSize="9">
                        前置: {(phase.prerequisites.map(id => phaseMap[id]?.title || id)).join(', ')}
                      </text>
                    )}
                    {phase.modules.slice(0, 5).map((mod, mIdx) => (
                      <g
                        key={mod.id}
                        className="cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); onSelectModule(mod); }}
                        onMouseEnter={(e) => {
                          (e.target as SVGElement).setAttribute('fill', 'rgba(255,255,255,0.05)');
                        }}
                        onMouseLeave={(e) => {
                          (e.target as SVGElement).setAttribute('fill', 'transparent');
                        }}
                      >
                        <rect
                          x={pos.x + 82} y={pos.y + 2 + mIdx * 20} width="250" height="18"
                          rx="4" fill="transparent" stroke="none"
                        />
                        <text
                          x={pos.x + 92} y={pos.y + 14 + mIdx * 20}
                          fill="#c9d1d9" fontSize="10"
                        >
                          {mod.title.length > 28 ? mod.title.substring(0, 28) + '…' : mod.title}
                        </text>
                      </g>
                    ))}
                    {phase.modules.length > 5 && (
                      <text x={pos.x + 92} y={pos.y + 14 + 5 * 20} fill="#8b949e" fontSize="9">
                        +{phase.modules.length - 5} 更多模块...
                      </text>
                    )}
                  </g>
                )}
            </g>
          );
        })}

        {/* Bottom stats */}
        <text x="850" y="570" textAnchor="middle" fill="#484f58" fontSize="10">
          总资源: {totalResources} 个 · 覆盖 {phases.length} 个学习阶段 · 有向无环图 (DAG)
        </text>
      </svg>
    </div>
  );
}

function PhaseRoadmapCard({
  phase,
  onOpenPhase,
}: {
  phase: (typeof roadmapPhases)[number];
  onOpenPhase: (phaseId: string) => void;
}) {
  const guide = phaseGuides[phase.id];

  return (
    <button
      onClick={() => onOpenPhase(phase.id)}
      className="group w-full rounded-xl border bg-[#111820] p-4 text-left transition-all hover:-translate-y-0.5 hover:border-opacity-70"
      style={{ borderColor: `${phase.color}55` }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${phase.color}1f`, color: phase.color }}>
            <IconComponent name={phase.icon} className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-[10px] font-semibold tracking-wider text-gray-500">STEP {String(guide?.order || 0).padStart(2, '0')}</span>
              <span className="flex items-center gap-1 text-[10px] text-gray-500"><Clock3 size={10} />{phase.duration}</span>
            </div>
            <h3 className="text-sm font-semibold text-white">{phase.title}</h3>
          </div>
        </div>
        <ArrowRight size={15} className="mt-1 text-gray-600 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-400" />
      </div>

      <p className="min-h-10 text-xs leading-5 text-gray-400">{guide?.outcome || phase.description}</p>
      <div className="mt-3 flex items-center justify-between border-t border-[#30363d]/60 pt-3 text-[11px]">
        <span className="text-gray-500">{phase.modules.length} 个课程模块</span>
        <span className="text-blue-400/80">转到课程清单</span>
      </div>
    </button>
  );
}

function RoadmapView({ phases, onOpenPhase }: { phases: typeof roadmapPhases; onOpenPhase: (phaseId: string) => void }) {
  const phaseMap = useMemo(() => new Map(phases.map((phase) => [phase.id, phase])), [phases]);

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-10">
      <section className="overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 via-[#111820] to-cyan-500/5 p-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-blue-400"><Compass size={15} />推荐主线</div>
            <h2 className="text-xl font-bold text-white">先建立完整开发闭环，再选择专精方向</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-400">每个阶段都以可交付的小项目收尾。C、电路与工具链属于共同基础；完成 MCU、调试、协议和 RTOS 后，再按目标岗位选择分支。</p>
          </div>
          <div className="grid flex-shrink-0 grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-black/20 px-3 py-2"><strong className="block text-base text-white">3</strong><span className="text-[10px] text-gray-500">基础模块</span></div>
            <div className="rounded-lg bg-black/20 px-3 py-2"><strong className="block text-base text-white">5</strong><span className="text-[10px] text-gray-500">核心阶段</span></div>
            <div className="rounded-lg bg-black/20 px-3 py-2"><strong className="block text-base text-white">5</strong><span className="text-[10px] text-gray-500">专精方向</span></div>
          </div>
        </div>
      </section>

      <div className="space-y-5">
        {coreStages.map((stage, stageIndex) => {
          const stagePhases = stage.phaseIds.map((id) => phaseMap.get(id)).filter((phase): phase is (typeof roadmapPhases)[number] => Boolean(phase));
          if (stagePhases.length === 0) return null;
          return (
            <section key={stage.id} className="relative rounded-2xl border border-[#30363d] bg-[#0f151c] p-4 md:p-5">
              {stageIndex < coreStages.length - 1 && <div className="absolute -bottom-6 left-1/2 z-10 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full border border-[#30363d] bg-[#161b22] text-gray-500"><ArrowRight size={14} className="rotate-90" /></div>}
              <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                <div><h2 className="text-sm font-bold text-white">{stage.label}</h2><p className="mt-1 text-xs text-gray-500">{stage.hint}</p></div>
                <span className="rounded-full bg-[#21262d] px-2.5 py-1 text-[10px] text-gray-400">完成后再进入下一阶段</span>
              </div>
              <div className={`grid gap-3 ${stagePhases.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
                {stagePhases.map((phase) => <PhaseRoadmapCard key={phase.id} phase={phase} onOpenPhase={onOpenPhase} />)}
              </div>
            </section>
          );
        })}
      </div>

      <section>
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400"><GitBranch size={17} /></span>
          <div><h2 className="text-base font-bold text-white">04 · 按目标选择专精方向</h2><p className="text-xs text-gray-500">方向可以组合，不要求全部学习</p></div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {specializationTracks.map((track) => {
            const trackPhases = track.phaseIds.map((id) => phaseMap.get(id)).filter((phase): phase is (typeof roadmapPhases)[number] => Boolean(phase));
            if (trackPhases.length === 0) return null;
            return (
              <div key={track.id} className="rounded-2xl border border-[#30363d] bg-[#0f151c] p-3">
                <div className="mb-3 px-1 pt-1"><h3 className="text-sm font-semibold" style={{ color: track.color }}>{track.title}</h3><p className="mt-1 text-[11px] text-gray-500">{track.description}</p></div>
                <div className="space-y-3">{trackPhases.map((phase) => <PhaseRoadmapCard key={phase.id} phase={phase} onOpenPhase={onOpenPhase} />)}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-[#30363d] bg-[#111820] p-4">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div><h3 className="flex items-center gap-2 text-xs font-semibold text-gray-300"><CheckCircle2 size={14} className="text-green-400" />路线设计参考</h3><p className="mt-1 text-[11px] text-gray-500">优先引用官方接口、RTOS 与内核文档，避免把单一芯片教程当成完整能力模型。</p></div>
          <div className="flex flex-wrap gap-2">{officialReferences.map((reference) => <a key={reference.title} href={reference.url} target="_blank" rel="noreferrer" className="rounded-md border border-[#30363d] px-2.5 py-1.5 text-[11px] text-gray-400 hover:border-blue-500/40 hover:text-blue-300">{reference.title} ↗</a>)}</div>
        </div>
      </section>
    </div>
  );
}

/* ── main page ── */
export default function TutorialPage() {
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<RoadmapModule | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'roadmap'>('roadmap');
  const [learningProgress, setLearningProgress] = useState(() =>
    parseLearningProgress(localStorage.getItem('embedkit-learning-progress')),
  );
  useEffect(() => {
    localStorage.setItem('embedkit-learning-progress', JSON.stringify(learningProgress));
  }, [learningProgress]);

  const filteredPhases = useMemo(() => {
    if (!searchQuery.trim()) return roadmapPhases;
    const q = searchQuery.toLowerCase();
    return roadmapPhases
      .map((phase) => ({
        ...phase,
        modules: phase.modules.filter(
          (m) => {
            const topicMatch = m.topics.some((t) => {
              const name = typeof t === 'string' ? t : t.name;
              const content = typeof t === 'string' ? '' : (t.content || '');
              return name.toLowerCase().includes(q) || content.toLowerCase().includes(q);
            });
            return (
              m.title.toLowerCase().includes(q) ||
              m.description.toLowerCase().includes(q) ||
              topicMatch ||
              m.resources.some((r) => r.title.toLowerCase().includes(q))
            );
          }
        ),
      }))
      .filter((p) => p.modules.length > 0 || p.title.toLowerCase().includes(q));
  }, [searchQuery]);

  const orderedFilteredPhases = useMemo(
    () => [...filteredPhases].sort((a, b) => (phaseGuides[a.id]?.order || 99) - (phaseGuides[b.id]?.order || 99)),
    [filteredPhases]
  );

  const openPhaseCourses = (phaseId: string) => {
    setExpandedPhase(phaseId);
    setViewMode('cards');
    requestAnimationFrame(() => {
      document.getElementById(`course-phase-${phaseId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const totalModules = roadmapPhases.reduce((sum, p) => sum + p.modules.length, 0);
  const totalResources = roadmapPhases.reduce(
    (sum, p) => sum + p.modules.reduce((s, m) => s + m.resources.length, 0),
    0
  );
  const completedModules = roadmapPhases
    .flatMap((phase) => phase.modules)
    .filter((module) =>
      moduleCompletion(
        learningProgress.modules[module.id],
        lessonGuides[module.id]?.checklist ?? [],
      ).complete,
    ).length;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-[#30363d] bg-[#161b22]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <GraduationCap size={20} className="text-blue-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">嵌入式开发学习路线</h1>
              <p className="text-xs text-gray-400">
                {roadmapPhases.length} 个阶段 · {totalModules} 个模块 · {completedModules} 个已实践验收 · {totalResources} 个学习资源
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div className="flex items-center bg-[#0d1117] border border-[#30363d] rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('roadmap')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === 'roadmap'
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                <GitBranch size={14} />
                路线图
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === 'cards'
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                <LayoutGrid size={14} />
                课程清单
              </button>
            </div>
            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="搜索知识点、资源..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-64 pl-9 pr-3 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Roadmap Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
        {viewMode === 'roadmap' ? (
          <RoadmapView phases={orderedFilteredPhases} onOpenPhase={openPhaseCourses} />
        ) : (
          <div className="max-w-5xl mx-auto space-y-4">
            <div className="mb-5 rounded-xl border border-[#30363d] bg-[#111820] p-4">
              <h2 className="text-sm font-semibold text-white">按推荐顺序浏览全部课程</h2>
              <p className="mt-1 text-xs leading-5 text-gray-500">编号表示建议学习顺序，不代表所有专精方向都必须完成。展开阶段后，再按模块顺序学习与实践。</p>
            </div>
            {orderedFilteredPhases.map((phase) => {
            const isExpanded = expandedPhase === phase.id;
            const guide = phaseGuides[phase.id];
            const prerequisites = (phase.prerequisites || [])
              .map((id) => roadmapPhases.find((item) => item.id === id)?.title)
              .filter(Boolean);

            return (
              <div
                key={phase.id}
                id={`course-phase-${phase.id}`}
                className="rounded-xl border border-[#30363d] overflow-hidden bg-[#161b22]"
              >
                {/* Phase Header */}
                <button
                  onClick={() => setExpandedPhase(isExpanded ? null : phase.id)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-[#1c2128] transition-colors text-left"
                >
                  {/* Phase number & icon */}
                  <div
                    className="flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0"
                    style={{ backgroundColor: `${phase.color}20` }}
                  >
                    <span style={{ color: phase.color }}>
                      <IconComponent name={phase.icon} className="w-5 h-5" />
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-400">
                        Step {String(guide?.order || 0).padStart(2, '0')}
                      </span>
                      <h2 className="text-base font-bold text-white">{phase.title}</h2>
                      <span className="text-xs text-gray-500">预计 {phase.duration}</span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">{guide?.outcome || phase.description}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="rounded bg-[#21262d] px-2 py-0.5 text-gray-400">{guide?.level}</span>
                      {prerequisites.length > 0 && <span className="text-gray-500">前置：{prerequisites.join('、')}</span>}
                      {guide?.practice && <span className="flex items-center gap-1 text-green-400/80"><Flag size={10} />实践：{guide.practice}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-gray-500">{phase.modules.length} 个模块</span>
                    {isExpanded ? (
                      <ChevronDown size={18} className="text-gray-400" />
                    ) : (
                      <ChevronRight size={18} className="text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Modules Grid */}
                {isExpanded && (
                  <div className="border-t border-[#30363d] p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {phase.modules.map((module) => (
                        <button
                          key={module.id}
                          onClick={() => setSelectedModule(module)}
                          className="text-left p-4 rounded-lg bg-[#0d1117] border border-[#30363d] hover:border-blue-500/40 transition-all group"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="text-sm font-semibold text-white group-hover:text-blue-300 transition-colors">
                              {module.title}
                            </h3>
                            <ChevronRight size={14} className="text-gray-500 group-hover:text-blue-400 mt-0.5" />
                          </div>
                          <p className="text-xs text-gray-400 line-clamp-2 mb-3">{module.description}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            {module.resources.slice(0, 3).map((res, i) => {
                              const Icon = typeIcon[res.type] || FileText;
                              return (
                                <span
                                  key={i}
                                  className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${typeColor[res.type]}`}
                                >
                                  <Icon size={10} />
                                  {typeLabel[res.type]}
                                </span>
                              );
                            })}
                            {module.resources.length > 3 && (
                              <span className="text-xs text-gray-500">+{module.resources.length - 3} more</span>
                            )}
                            {module.codeExample && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 flex items-center gap-1">
                                <Code size={10} />
                                代码
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {module.topics.slice(0, 3).map((topic, i) => (
                              <span key={i} className="text-xs text-gray-500 bg-[#161b22] px-2 py-0.5 rounded">
                                {typeof topic === 'string' ? topic : topic.name}
                              </span>
                            ))}
                            {module.topics.length > 3 && (
                              <span className="text-xs text-gray-500">+{module.topics.length - 3}</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Empty state */}
          {filteredPhases.length === 0 && (
            <div className="text-center py-16">
              <Search size={40} className="mx-auto text-gray-600 mb-4" />
              <p className="text-gray-400">没有找到匹配的内容</p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-3 text-sm text-blue-400 hover:text-blue-300"
              >
                清除搜索
              </button>
            </div>
          )}
        </div>
        )}
      </div>

      {/* Module Detail Modal */}
      {selectedModule && (
        <ModuleDetail
          module={selectedModule}
          progress={learningProgress.modules[selectedModule.id]}
          onProgressChange={(patch) =>
            setLearningProgress((current) =>
              updateModuleProgress(current, selectedModule.id, patch),
            )
          }
          onClose={() => setSelectedModule(null)}
        />
      )}
    </div>
  );
}
