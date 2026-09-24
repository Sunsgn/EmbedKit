import { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { roadmapPhases } from '../data/roadmap';
import type { RoadmapModule, ExternalResource } from '../types';
import Editor from '@monaco-editor/react';

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
};

const IconComponent = ({ name, className }: { name: string; className?: string }) => {
  const Comp = iconMap[name] || Code;
  return <Comp className={className} />;
};

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
function ModuleDetail({ module, onClose }: { module: RoadmapModule; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (module.codeExample) {
      navigator.clipboard.writeText(module.codeExample);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
          {/* Topics */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 11 12 14 22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
              知识点
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {module.topics.map((topic, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-300 px-3 py-2 rounded-lg bg-[#0d1117]">
                  <ChevronRight size={14} className="text-gray-500 flex-shrink-0" />
                  {topic}
                </div>
              ))}
            </div>
          </div>

          {/* Resources */}
          {module.resources.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <Globe size={16} />
                学习资源
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
                <Editor
                  height={Math.min(400, module.codeExample.split('\n').length * 19 + 40)}
                  language={module.codeLang || 'c'}
                  value={module.codeExample}
                  theme="vs-dark"
                  options={{
                    readOnly: true,
                    fontSize: 13,
                    minimap: { enabled: false },
                    automaticLayout: true,
                    scrollBeyondLastLine: false,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── roadmap view component ── */
function RoadmapView({ phases, onSelectModule }: { phases: typeof roadmapPhases; onSelectModule: (m: RoadmapModule) => void }) {
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);

  const phaseColors: Record<string, string> = {
    'c-fundamentals': '#60a5fa',
    'c-syntax': '#f472b4',
    'tools': '#a78bfa',
    'mcu-arch': '#fbbf24',
    'rtos': '#34d399',
    'protocols': '#f87171',
    'advanced': '#60a5fa',
    'projects': '#fbbf24',
  };

  return (
    <div className="overflow-x-auto overflow-y-visible scrollbar-thin py-6">
      <svg
        className="w-full"
        style={{ minWidth: '900px', height: '520px' }}
        viewBox="0 0 1200 520"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#484f58" />
          </marker>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#30363d" />
            <stop offset="100%" stopColor="#484f58" />
          </linearGradient>
        </defs>

        {/* Title */}
        <text x="600" y="36" textAnchor="middle" fill="#ffffff" fontSize="18" fontWeight="bold">
          嵌入式开发学习路线图
        </text>
        <text x="600" y="58" textAnchor="middle" fill="#8b949e" fontSize="12">
          点击节点查看详情
        </text>

        {/* Horizontal timeline line */}
        <line x1="100" y1="100" x2="1100" y2="100" stroke="url(#lineGrad)" strokeWidth="3" />

        {phases.map((phase, idx) => {
          const x = 120 + idx * 130;
          const color = phaseColors[phase.id] || phase.color;
          const isSelected = selectedPhase === phase.id;

          return (
            <g key={phase.id}>
              {/* Connector lines between nodes */}
              {idx > 0 && (
                <line
                  x1={x - 130 + 20} y1="100"
                  x2={x - 20} y2="100"
                  stroke={color} strokeWidth="2"
                  opacity="0.4"
                  markerEnd="url(#arrowhead)"
                />
              )}

              {/* Vertical connector to details */}
              {isSelected && (
                <line x1={x} y1="130" x2={x} y2="200" stroke={color} strokeWidth="2" strokeDasharray="4 2" opacity="0.6" />
              )}

              {/* Node circle */}
              <circle
                cx={x} cy="100" r={isSelected ? 28 : 22}
                fill={isSelected ? `${color}30` : '#161b22'}
                stroke={color}
                strokeWidth={isSelected ? 3 : 2}
                className="cursor-pointer transition-all duration-200"
                filter={isSelected ? 'url(#glow)' : undefined}
                onClick={() => setSelectedPhase(isSelected ? null : phase.id)}
              />

              {/* Phase number in circle */}
              <text x={x} y="105" textAnchor="middle" fill={color} fontSize="14" fontWeight="bold">
                {idx + 1}
              </text>

              {/* Phase title below node */}
              <text
                x={x} y="148" textAnchor="middle"
                fill={isSelected ? '#ffffff' : '#c9d1d9'}
                fontSize="12" fontWeight={isSelected ? 'bold' : 'normal'}
                className="cursor-pointer"
                onClick={() => setSelectedPhase(isSelected ? null : phase.id)}
              >
                {phase.title}
              </text>

              {/* Duration */}
              <text x={x} y="164" textAnchor="middle" fill="#8b949e" fontSize="10">
                {phase.duration}
              </text>

              {/* Expanded modules below */}
              {isSelected && (
                <g>
                  {/* Module cards background */}
                  <rect
                    x={x - 100} y="200" width="200" height={Math.min(phase.modules.length, 4) * 24 + 16}
                    rx="6" fill="#0d1117" stroke={color} strokeWidth="1" opacity="0.95"
                  />
                  {phase.modules.slice(0, 4).map((mod, mIdx) => (
                    <g
                      key={mod.id}
                      className="cursor-pointer"
                      onClick={() => onSelectModule(mod)}
                    >
                      <rect
                        x={x - 94} y={208 + mIdx * 24} width="188" height="22"
                        rx="3" fill="transparent"
                        className="hover:fill-white/5"
                      />
                      <text
                        x={x - 86} y={223 + mIdx * 24}
                        fill="#c9d1d9" fontSize="10"
                        className="hover:fill-white"
                      >
                        {mod.title.length > 22 ? mod.title.substring(0, 22) + '...' : mod.title}
                      </text>
                    </g>
                  ))}
                  {phase.modules.length > 4 && (
                    <text x={x - 86} y={223 + 4 * 24} fill="#8b949e" fontSize="10">
                      +{phase.modules.length - 4} more...
                    </text>
                  )}
                </g>
              )}
            </g>
          );
        })}

        {/* Bottom legend */}
        <text x="600" y="490" textAnchor="middle" fill="#484f58" fontSize="10">
          总资源: {phases.reduce((sum, p) => sum + p.modules.reduce((s, m) => s + m.resources.length, 0), 0)} 个 · 覆盖 {phases.length} 个学习阶段
        </text>
      </svg>
    </div>
  );
}

/* ── main page ── */
export default function TutorialPage() {
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<RoadmapModule | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'roadmap'>('cards');

  const filteredPhases = useMemo(() => {
    if (!searchQuery.trim()) return roadmapPhases;
    const q = searchQuery.toLowerCase();
    return roadmapPhases
      .map((phase) => ({
        ...phase,
        modules: phase.modules.filter(
          (m) =>
            m.title.toLowerCase().includes(q) ||
            m.description.toLowerCase().includes(q) ||
            m.topics.some((t) => t.toLowerCase().includes(q)) ||
            m.resources.some((r) => r.title.toLowerCase().includes(q))
        ),
      }))
      .filter((p) => p.modules.length > 0 || p.title.toLowerCase().includes(q));
  }, [searchQuery]);

  const totalModules = roadmapPhases.reduce((sum, p) => sum + p.modules.length, 0);
  const totalResources = roadmapPhases.reduce(
    (sum, p) => sum + p.modules.reduce((s, m) => s + m.resources.length, 0),
    0
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-[#30363d] bg-[#161b22]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <GraduationCap size={20} className="text-blue-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">嵌入式开发学习路线</h1>
              <p className="text-xs text-gray-400">
                {roadmapPhases.length} 个阶段 · {totalModules} 个模块 · {totalResources} 个学习资源
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
                卡片
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
                className="w-64 pl-9 pr-3 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Roadmap Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
        {viewMode === 'roadmap' ? (
          <RoadmapView phases={filteredPhases} onSelectModule={setSelectedModule} />
        ) : (
          <div className="max-w-5xl mx-auto space-y-4">
            {filteredPhases.map((phase, phaseIdx) => {
            const isExpanded = expandedPhase === phase.id;

            return (
              <div
                key={phase.id}
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
                        Phase {phaseIdx + 1}
                      </span>
                      <h2 className="text-base font-bold text-white">{phase.title}</h2>
                      <span className="text-xs text-gray-500">预计 {phase.duration}</span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1 truncate">{phase.description}</p>
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
                                {topic}
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
        <ModuleDetail module={selectedModule} onClose={() => setSelectedModule(null)} />
      )}
    </div>
  );
}
