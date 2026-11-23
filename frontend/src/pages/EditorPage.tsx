import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import CodeEditor, { type CodeEditorHandle } from "../components/CodeEditor";
import {
  FolderOpen,
  Play,
  FileCode,
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  Settings,
  Cpu,
  Download as DownloadIcon,
  ExternalLink,
  BookOpen,
  Upload,
  Sparkles,
  Network,
} from "lucide-react";
import type { FileNode, Chip, CompileResult } from "../types";
import { chips } from "../data/chips";
import ProjectBuildPanel from "../features/project/ProjectBuildPanel";
import MapAnalysisPanel from "../features/project/MapAnalysisPanel";
import { analyzeMap } from "../utils/mapAnalyzer";
import ProjectArchitecturePanel from "../features/project/ProjectArchitecturePanel";
import { analyzeProjectArchitecture } from "../utils/projectArchitecture";
import { analyzeProgramBehavior } from "../utils/programBehavior";
import type { RuntimeTraceAnalysis } from "../utils/runtimeTrace";
import { clearRuntimeTrace, loadRuntimeTrace, saveRuntimeTrace } from "../services/runtimeTraceStorage";
import type { EngineeringProject } from "../types/product";
import type { ProjectAnalysisRun } from "../types/projectAnalysis";
import { exportProjectAnalysisRun } from "../services/projectAnalysisSnapshot";
import { analysisRunSavedMessage, mergeAnalysisRunHistory, saveCompletedAnalysisRun } from "../features/project/analysisRunController";
import { loadEditorWorkspace } from "../features/project/workspaceController";
import { saveEditorWorkspace } from "../features/project/workspaceSaveController";
import { importProjectFiles, ProjectImportError } from "../features/project/projectImportController";
import { associateLegacyProjectWorkspace, recordProjectSourceRevision } from "../features/project/projectRevisionController";
import { resolveBuildDiagnosticFile, resolveMapModuleFile } from "../features/project/sourceNavigationController";
import type { ProjectFinding } from "../features/project/projectRiskAnalysis";
import { summarizeProject, type ProjectSummary } from "../features/project/projectSummary";
import { inspectProjectStructure } from "../features/project/projectStructureInspection";
import { runProjectAiAnalysis } from "../features/project/projectAiAnalysisController";
import { buildProjectAnalysisReport } from "../features/project/projectAnalysisReport";
import { downloadBrowserText } from "../services/browserDownload";
import { addProjectFile, deleteProjectFile, updateProjectFileContent } from "../features/project/projectFileController";
import { createProjectTemplate } from "../features/project/projectTemplateRegistry";

function FileTree({
  files,
  activeFile,
  onFileSelect,
  onAddFile,
  onDeleteFile,
}: {
  files: FileNode[];
  activeFile: string;
  onFileSelect: (path: string) => void;
  onAddFile: () => void;
  onDeleteFile: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "/Inc": true,
    "/Src": true,
  });

  const grouped: Record<string, FileNode[]> = {};
  files.forEach((f) => {
    const dir = f.path.substring(0, f.path.lastIndexOf("/")) || "/";
    if (!grouped[dir]) grouped[dir] = [];
    grouped[dir].push(f);
  });

  const toggleDir = (dir: string) => {
    setExpanded((prev) => ({ ...prev, [dir]: !prev[dir] }));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#30363d]">
        <span className="text-xs font-semibold text-gray-400 uppercase">
          Explorer
        </span>
        <button
          onClick={onAddFile}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin py-2">
        {Object.entries(grouped).map(([dir, dirFiles]) => (
          <div key={dir}>
            {dir !== "/" && (
              <button
                onClick={() => toggleDir(dir)}
                className="w-full flex items-center gap-1 px-3 py-1 text-sm text-gray-300 hover:bg-[#1c2128] rounded"
              >
                {expanded[dir] ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )}
                <FolderOpen size={14} className="text-blue-400" />
                <span className="truncate">
                  {dir === "/Inc" ? "Inc" : dir === "/Src" ? "Src" : dir}
                </span>
              </button>
            )}
            {expanded[dir] &&
              dirFiles.map((f) => (
                <div
                  key={f.path}
                  className={`group flex items-center gap-2 px-3 py-1 text-sm cursor-pointer rounded mr-2
                    ${f.path === activeFile ? "bg-blue-500/20 text-blue-300" : "text-gray-400 hover:text-white hover:bg-[#1c2128]"}`}
                  onClick={() => onFileSelect(f.path)}
                >
                  <FileCode
                    size={14}
                    className={
                      f.name.endsWith(".c")
                        ? "text-blue-400"
                        : f.name.endsWith(".h")
                          ? "text-purple-400"
                          : "text-gray-500"
                    }
                  />
                  <span className="truncate flex-1">{f.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteFile(f.path);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function OutputPanel({ result }: { result: CompileResult | null }) {
  if (!result) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 text-sm">
        点击“结构检查”进行本地工程结构检查
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div
        className={`px-3 py-2 border-b border-[#30363d] text-sm font-medium ${result.success ? "text-green-400" : "text-red-400"}`}
      >
        {result.success ? "结构检查通过（非真实编译）" : "结构检查发现问题"}
        {result.size && ` · ${result.size} bytes`}
      </div>
      <pre className="flex-1 p-3 text-xs font-mono text-gray-300 overflow-auto scrollbar-thin whitespace-pre-wrap">
        {result.output}
      </pre>
    </div>
  );
}

function ChipGuide({ chip }: { chip: Chip }) {
  const useCases = chip.peripherals
    .filter((item) =>
      [
        "USART",
        "UART",
        "SPI",
        "I2C",
        "CAN",
        "USB",
        "ETH",
        "ADC",
        "DAC",
        "TIM",
      ].includes(item),
    )
    .slice(0, 6);
  const familyQuery = encodeURIComponent(
    `${chip.name} ${chip.series} reference manual`,
  );
  return (
    <div className="flex-1 overflow-y-auto border-b border-[#30363d] p-4 scrollbar-thin">
      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-wider text-blue-400">
          嵌入式工程助手
        </p>
        <h2 className="mt-1 text-lg font-semibold text-white">目标环境资料</h2>
        <p className="mt-1 text-xs text-gray-500">
          {chip.manufacturer} · {chip.series}
        </p>
      </div>
      <div className="mb-4 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
        <h3 className="text-xs font-semibold text-blue-300">目标环境概览</h3>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <span className="text-gray-500">
            内核 <b className="ml-1 text-gray-200">{chip.cores}</b>
          </span>
          <span className="text-gray-500">
            主频 <b className="ml-1 text-gray-200">{chip.frequency}</b>
          </span>
          <span className="text-gray-500">
            Flash <b className="ml-1 text-gray-200">{chip.flash}</b>
          </span>
          <span className="text-gray-500">
            RAM <b className="ml-1 text-gray-200">{chip.ram}</b>
          </span>
        </div>
      </div>
      <div className="mb-4">
        <h3 className="mb-2 flex items-center gap-1 text-xs font-semibold text-gray-300">
          <BookOpen size={13} className="text-green-400" />
          官方资料
        </h3>
        <div className="space-y-2">
          {chip.datasheetUrl && (
            <a
              href={chip.datasheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-md bg-[#161b22] px-3 py-2 text-xs text-gray-300 hover:text-blue-300"
            >
              数据手册
              <ExternalLink size={12} />
            </a>
          )}
          <a
            href={`https://cn.bing.com/search?q=${familyQuery}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-md bg-[#161b22] px-3 py-2 text-xs text-gray-300 hover:text-blue-300"
          >
            参考手册与应用笔记
            <ExternalLink size={12} />
          </a>
        </div>
      </div>
      <div className="mb-4">
        <h3 className="mb-2 text-xs font-semibold text-gray-300">
          可关注的外设
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {useCases.map((item) => (
            <span
              key={item}
              className="rounded bg-[#161b22] px-2 py-1 text-[10px] text-gray-400"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 text-[11px] leading-5 text-gray-500">
        <b className="text-yellow-300">集成流程</b>
        <br />
        1. 用官方工具确认芯片、封装、时钟和引脚。
        <br />
        2. 在此编辑或复制参考代码。
        <br />
        3. 放入 Keil、IAR、CubeMX 或厂商 SDK 工程。
        <br />
        4. 使用真实工具链编译并在硬件上验证。
        <br />
        <span className="text-yellow-200/70">
          本页面不会替代厂商工程生成器。
        </span>
      </div>
    </div>
  );
}

void ChipGuide;

function ProjectSummaryPanel({ summary, onFindingSelect }: { summary: ProjectSummary; onFindingSelect: (finding: ProjectFinding) => void }) {
  return (
    <div className="max-h-[420px] overflow-y-auto border-b border-[#30363d] bg-purple-500/[0.03] p-4 scrollbar-thin">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-purple-300">导入工程摘要</h3>
        <span className="text-[10px] text-gray-600">
          {summary.files} 个文件
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <span className="text-gray-500">
          芯片 <b className="ml-1 text-gray-200">{summary.chip}</b>
        </span>
        <span className="text-gray-500">
          工具链 <b className="ml-1 text-gray-200">{summary.toolchain}</b>
        </span>
        <span className="text-gray-500">
          SDK <b className="ml-1 text-gray-200">{summary.sdk}</b>
        </span>
        <span className="text-gray-500">
          类型 <b className="ml-1 text-gray-200">{summary.projectType}</b>
        </span>
      </div>
      <div className="mt-3 rounded border border-blue-500/20 bg-blue-500/5 p-2"><div className="flex items-center justify-between"><b className="text-[10px] text-blue-300">自动识别：{summary.toolchain}</b><span className={`text-[8px] uppercase ${summary.buildConfidence === "high" ? "text-green-400" : summary.buildConfidence === "medium" ? "text-yellow-400" : "text-gray-500"}`}>{summary.buildConfidence} confidence</span></div><ul className="mt-1 space-y-0.5 text-[9px] text-gray-500">{summary.buildEvidence.map(item => <li key={item}>• {item}</li>)}</ul></div>
      <div className="mt-3 grid grid-cols-3 gap-1.5 text-center text-[10px]">
        <span className="rounded bg-[#161b22] p-1.5 text-gray-500"><b className="block text-gray-200">{summary.sourceFiles}</b>源文件</span>
        <span className="rounded bg-[#161b22] p-1.5 text-gray-500"><b className="block text-gray-200">{summary.headerFiles}</b>头文件</span>
        <span className="rounded bg-[#161b22] p-1.5 text-gray-500"><b className="block text-gray-200">{summary.totalLines}</b>代码行</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {(summary.peripherals.length
          ? summary.peripherals
          : ["未识别外设"]
        ).map((item) => (
          <span
            key={item}
            className="rounded bg-[#161b22] px-2 py-1 text-[10px] text-gray-400"
          >
            {item}
          </span>
        ))}
      </div>
      <div className="mt-3 border-t border-[#30363d] pt-3">
        <div className="mb-2 flex items-center justify-between"><b className="text-[11px] text-gray-300">本地静态风险</b><span className={`text-[10px] ${summary.findings.some(item => item.severity === "high") ? "text-red-400" : summary.findings.length ? "text-yellow-400" : "text-green-400"}`}>{summary.findings.length ? `${summary.findings.length} 项` : "未命中规则"}</span></div>
        <div className="space-y-1.5">{summary.findings.slice(0, 8).map(item => <button type="button" key={item.id} onClick={() => onFindingSelect(item)} disabled={!item.line || item.file === "/"} title={item.line && item.file !== "/" ? `打开 ${item.file}:${item.line}` : "这是工程级问题，没有可跳转的源码位置"} className={`block w-full rounded border p-2 text-left transition-colors disabled:cursor-default ${item.severity === "high" ? "border-red-500/20 bg-red-500/5 enabled:hover:border-red-400/60" : item.severity === "medium" ? "border-yellow-500/20 bg-yellow-500/5 enabled:hover:border-yellow-400/60" : "border-[#30363d] bg-[#161b22] enabled:hover:border-blue-400/50"}`}><div className="flex items-center justify-between gap-2"><b className={`text-[10px] ${item.severity === "high" ? "text-red-300" : item.severity === "medium" ? "text-yellow-300" : "text-gray-300"}`}>{item.title}</b><span className="shrink-0 text-[8px] uppercase text-gray-600">{item.severity}</span></div><p className="mt-1 truncate font-mono text-[8px] text-gray-600" title={item.evidence}>{item.file}{item.line ? `:${item.line}` : ""} · {item.evidence}</p><p className="mt-1 text-[9px] leading-4 text-gray-500">{item.recommendation}</p>{item.line > 0 && item.file !== "/" && <span className="mt-1 block text-[9px] text-blue-400">点击定位到源码 →</span>}</button>)}</div>
        {summary.findings.length > 8 && <p className="mt-2 text-[9px] text-gray-600">其余 {summary.findings.length - 8} 项请在“结构检查”结果或导出报告中查看。</p>}
      </div>
    </div>
  );
}

function AiReportPanel({
  report,
  analyzing,
}: {
  report: string;
  analyzing: boolean;
}) {
  if (!report && !analyzing) return null;
  return (
    <div className="max-h-72 shrink-0 overflow-y-auto border-b border-[#30363d] bg-purple-500/[0.04] p-4 scrollbar-thin">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-purple-300">
        <Sparkles size={13} />
        AI 工程分析
        {analyzing && (
          <span className="text-[10px] text-gray-500">分析中…</span>
        )}
      </div>
      <pre className="whitespace-pre-wrap text-[11px] leading-5 text-gray-300">
        {report || "正在整理工程摘要和关键代码片段…"}
      </pre>
    </div>
  );
}

function ProjectLanding({
  onImport,
  error,
}: {
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
  error: string;
}) {
  return (
    <div className="flex h-full items-center justify-center bg-[#0d1117] p-6">
      <div className="w-full max-w-2xl rounded-2xl border border-[#30363d] bg-[#161b22] p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-400">
          <Upload size={26} />
        </div>
        <h1 className="text-2xl font-semibold text-white">
          导入真实工程开始分析
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-gray-400">
          这里不生成与芯片无关的通用工程。请导入已有的嵌入式工程，系统会识别芯片、工具链、SDK、文件结构和常见外设。
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500">
            <Upload size={16} />
            选择工程文件
            <input
              type="file"
              multiple
              className="hidden"
              onChange={onImport}
            />
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#30363d] bg-[#0d1117] px-5 py-2.5 text-sm font-medium text-gray-300 hover:border-blue-500/50 hover:text-white">
            <FolderOpen size={16} />
            选择工程目录
            <input
              type="file"
              multiple
              className="hidden"
              onClick={(event) => {
                (
                  event.currentTarget as HTMLInputElement & {
                    webkitdirectory?: boolean;
                  }
                ).webkitdirectory = true;
              }}
              onChange={onImport}
            />
          </label>
        </div>
        {error && (
          <p className="mx-auto mt-3 max-w-md rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        )}
        <div className="mt-6 grid gap-3 text-left sm:grid-cols-3">
          <div className="rounded-lg bg-[#0d1117] p-3">
            <b className="text-xs text-gray-200">支持导入</b>
            <p className="mt-1 text-[11px] leading-5 text-gray-500">
              C/C++、头文件、Makefile、CMake、Keil、IAR
            </p>
          </div>
          <div className="rounded-lg bg-[#0d1117] p-3">
            <b className="text-xs text-gray-200">自动识别</b>
            <p className="mt-1 text-[11px] leading-5 text-gray-500">
              芯片、SDK、工具链、工程类型和外设
            </p>
          </div>
          <div className="rounded-lg bg-[#0d1117] p-3">
            <b className="text-xs text-gray-200">分析结果</b>
            <p className="mt-1 text-[11px] leading-5 text-gray-500">
              工程摘要、代码结构和官方资料入口
            </p>
          </div>
        </div>
        <p className="mt-5 text-[11px] text-gray-600">
          当前阶段不会执行真实编译，也不会替代厂商 IDE。
        </p>
      </div>
    </div>
  );
}

export default function EditorPage() {
  const navigate = useNavigate(), location = useLocation();
  const requestedProjectId = useMemo(() => new URLSearchParams(location.search).get('projectId')?.trim() ?? '', [location.search]);
  const [files, setFiles] = useState<FileNode[]>(() =>
    createProjectTemplate({ projectName: "embedkit_project" }).files,
  );
  const [activeFile, setActiveFile] = useState("/Src/main.c");
  const [selectedChip, setSelectedChip] = useState<Chip>(chips[0]);
  const [projectName, setProjectName] = useState("embedkit_project");
  const [inspectionResult, setInspectionResult] = useState<CompileResult | null>(
    null,
  );
  const [isInspecting, setIsInspecting] = useState(false);
  const [showOutput, setShowOutput] = useState(true);
  const [activeToolPanel, setActiveToolPanel] = useState<'architecture' | 'map' | 'build' | null>(null);
  const [runtimeTrace, setRuntimeTrace] = useState<RuntimeTraceAnalysis | null>(null);
  const [selectedMapPath, setSelectedMapPath] = useState("");
  const [projectLoaded, setProjectLoaded] = useState(false);
  const [importError, setImportError] = useState("");
  const [fileError, setFileError] = useState("");
  const [exportError, setExportError] = useState("");
  const [aiReport, setAiReport] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [engineeringProject, setEngineeringProject] = useState<EngineeringProject | null>(null);
  const [revisionId, setRevisionId] = useState('');
  const [sourceFingerprint, setSourceFingerprint] = useState('');
  const [importedAt, setImportedAt] = useState('');
  const [legacyWorkspaceAvailable, setLegacyWorkspaceAvailable] = useState(false);
  const [workspaceMessage, setWorkspaceMessage] = useState('');
  const [analysisRuns, setAnalysisRuns] = useState<ProjectAnalysisRun[]>([]);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState('');
  const [savingAnalysis, setSavingAnalysis] = useState(false);
  const editorRef = useRef<CodeEditorHandle | null>(null);
  const projectSummary = useMemo(
    () => (projectLoaded ? summarizeProject(files) : null),
    [files, projectLoaded],
  );
  const mapFiles = useMemo(() => files.filter(file => /\.map$/i.test(file.name)).sort((a, b) => (b.lastModified ?? 0) - (a.lastModified ?? 0)), [files]);
  const mapOptions = useMemo(() => mapFiles.map(file => ({ file, analysis: analyzeMap(file.content) })), [mapFiles]);
  const projectArchitecture = useMemo(() => projectLoaded ? analyzeProjectArchitecture(files) : null, [files, projectLoaded]);
  const programBehavior = useMemo(() => projectLoaded ? analyzeProgramBehavior(files) : null, [files, projectLoaded]);
  const selectedMap = mapOptions.find(item => item.file.path === selectedMapPath) ?? mapOptions[0];
  const mapFile = selectedMap?.file, mapAnalysis = selectedMap?.analysis;

  useEffect(() => {
    if (!activeToolPanel) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setActiveToolPanel(null); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [activeToolPanel]);

  const traceStorageId = requestedProjectId ? `${requestedProjectId}:${revisionId || 'unversioned'}` : projectName;
  useEffect(() => {
    if (!projectLoaded) return;
    let cancelled = false;
    void loadRuntimeTrace(traceStorageId).then(trace => { if (!cancelled) setRuntimeTrace(trace); }).catch(() => { /* IndexedDB may be unavailable. */ });
    return () => { cancelled = true; };
  }, [projectLoaded, traceStorageId]);

  const handleRuntimeTraceChange = useCallback((trace: RuntimeTraceAnalysis | null) => {
    setRuntimeTrace(trace);
    if (trace) void saveRuntimeTrace(traceStorageId, trace).catch(() => { /* Keep the in-memory trace when persistence is unavailable. */ });
    else void clearRuntimeTrace(traceStorageId).catch(() => { /* The visible state is already cleared. */ });
  }, [traceStorageId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setWorkspaceReady(false); setProjectLoaded(false); setRuntimeTrace(null); setEngineeringProject(null); setRevisionId(''); setSourceFingerprint(''); setImportedAt(''); setLegacyWorkspaceAvailable(false); setWorkspaceMessage(''); setAnalysisRuns([]); setSelectedAnalysisId(''); setFileError(''); setExportError('');
      const loaded = await loadEditorWorkspace(requestedProjectId);
      if (cancelled) return;
      if (loaded.mode === 'project') {
        setEngineeringProject(loaded.project); setProjectName(loaded.project.name); setLegacyWorkspaceAvailable(loaded.legacyAvailable); setAnalysisRuns(loaded.analysisRuns); setSelectedAnalysisId(loaded.analysisRuns[0]?.id ?? ''); setWorkspaceMessage(loaded.message);
        if (!loaded.workspace) { setFiles([]); setActiveFile(''); return; }
        setFiles(loaded.workspace.files); setActiveFile(loaded.activeFile); setRevisionId(loaded.workspace.revisionId); setSourceFingerprint(loaded.workspace.sourceFingerprint); setImportedAt(loaded.workspace.importedAt); setProjectLoaded(true);
        return;
      }
      if (!loaded.workspace) return;
      setFiles(loaded.workspace.files); setActiveFile(loaded.activeFile); setProjectName(loaded.workspace.name); setProjectLoaded(true);
    })()
      .catch((reason) => {
        if (!cancelled) setWorkspaceMessage(reason instanceof Error ? reason.message : '工作区加载失败。工程档案未受影响，可返回工程中心或重新导入源码。');
      })
      .finally(() => {
        if (!cancelled) setWorkspaceReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [requestedProjectId]);

  useEffect(() => {
    if (!workspaceReady || !projectSummary) return;
    const timer = window.setTimeout(() => {
      const save = saveEditorWorkspace({ requestedProjectId, engineeringProject, revisionId, sourceFingerprint, importedAt, projectName, files, activeFile });
      void save.catch(reason => setWorkspaceMessage(`工作区保存失败：${reason instanceof Error ? reason.message : String(reason)}`));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [activeFile, engineeringProject, files, importedAt, projectName, projectSummary, requestedProjectId, revisionId, sourceFingerprint, workspaceReady]);

  const activeContent = files.find((f) => f.path === activeFile)?.content || "";
  const handleFindingSelect = useCallback((finding: ProjectFinding) => {
    if (!finding.line || finding.file === "/") return;
    setActiveFile(finding.file);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      editorRef.current?.goToLine(finding.line);
    }));
  }, []);
  const handleBuildDiagnostic = useCallback(
    (diagnostic: { file: string; line: number }) => {
      const target = resolveBuildDiagnosticFile(files, diagnostic.file);
      if (target) handleFindingSelect({ id: `build:${target.path}:${diagnostic.line}`, severity: "high", title: "编译诊断", file: target.path, line: diagnostic.line, evidence: "", recommendation: "" });
    },
    [files, handleFindingSelect],
  );
  const handleMapModuleSelect = useCallback((module: string) => {
    const target = resolveMapModuleFile(files, module);
    if (target) handleFindingSelect({ id: `map:${target.path}`, severity: 'low', title: 'MAP 模块', file: target.path, line: 1, evidence: module, recommendation: '' });
  }, [files, handleFindingSelect]);

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined) setFiles(prev => updateProjectFileContent(prev, activeFile, value));
    },
    [activeFile],
  );

  const handleAddFile = () => {
    const name = prompt("File name:");
    if (name === null) return;
    try {
      const result = addProjectFile(files, name);
      setFiles(result.files);
      setActiveFile(result.activeFile);
      setFileError("");
    } catch (reason) {
      setFileError(`新建文件失败：${reason instanceof Error ? reason.message : String(reason)}`);
    }
  };

  const recordProjectRevision = async (project: EngineeringProject, nextRevisionId: string, fingerprint: string, capturedAt: string) => {
    await recordProjectSourceRevision({ project, revisionId: nextRevisionId, sourceFingerprint: fingerprint, capturedAt });
  };

  const associateLegacyWorkspace = async () => {
    if (!requestedProjectId || !engineeringProject) return;
    setWorkspaceMessage('正在复制旧工作区，不会删除原数据…');
    try {
      const workspace = await associateLegacyProjectWorkspace(requestedProjectId, engineeringProject);
      if (!workspace) { setLegacyWorkspaceAvailable(false); setWorkspaceMessage('没有可关联的旧工作区'); return; }
      setFiles(workspace.files); setActiveFile(workspace.activeFile); setProjectName(engineeringProject.name); setRevisionId(workspace.revisionId); setSourceFingerprint(workspace.sourceFingerprint); setImportedAt(workspace.importedAt); setProjectLoaded(true); setLegacyWorkspaceAvailable(false); setWorkspaceMessage('旧工作区已复制并关联；原工作区仍保留，可安全回退。');
    } catch (reason) { setWorkspaceMessage(`关联失败：${reason instanceof Error ? reason.message : String(reason)}`); }
  };

  const selectedAnalysis = analysisRuns.find(run => run.id === selectedAnalysisId) ?? analysisRuns[0] ?? null;
  const saveAnalysisSnapshot = async () => {
    if (!requestedProjectId || !revisionId || !sourceFingerprint || !projectArchitecture || !programBehavior || !projectSummary || savingAnalysis) return;
    setSavingAnalysis(true); setWorkspaceMessage('正在生成确定性分析证据…');
    try {
      const run = await saveCompletedAnalysisRun({ projectId: requestedProjectId, projectRevisionId: revisionId, sourceFingerprint, files, architecture: projectArchitecture, behavior: programBehavior, findings: projectSummary.findings, runtimeTrace });
      setAnalysisRuns(current => mergeAnalysisRunHistory(current, run)); setSelectedAnalysisId(run.id);
      setWorkspaceMessage(analysisRunSavedMessage(run));
    } catch (reason) {
      setWorkspaceMessage(`分析证据保存失败：${reason instanceof Error ? reason.message : String(reason)}`);
    } finally { setSavingAnalysis(false); }
  };

  const handleImportFiles = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    try {
      const imported = await importProjectFiles({ files: Array.from(event.target.files ?? []), requestedProjectId, engineeringProject, recordRevision: recordProjectRevision });
      if (imported.association) {
        setRevisionId(imported.association.revisionId); setSourceFingerprint(imported.association.sourceFingerprint); setImportedAt(imported.association.importedAt); setWorkspaceMessage('源码已关联到当前工程，并创建可追溯修订。'); setLegacyWorkspaceAvailable(false);
      }
      setFiles(imported.files);
      setActiveFile(imported.activeFile);
      setProjectName(imported.projectName);
      const summary = summarizeProject(imported.files);
      setProjectLoaded(true);
      const detectedChip = chips.find((chip) => chip.name.toUpperCase() === summary.chip || summary.chip.includes(chip.name.toUpperCase()));
      if (detectedChip) setSelectedChip(detectedChip);
      setImportError("");
      setFileError("");
      setAiReport("");
      setInspectionResult(null);
    } catch (reason) {
      setImportError(reason instanceof ProjectImportError ? reason.message : `工程工作区保存失败：${reason instanceof Error ? reason.message : String(reason)}`);
    }
    event.target.value = "";
  };

  const handleDeleteFile = (path: string) => {
    const result = deleteProjectFile(files, activeFile, path);
    setFiles(result.files);
    setActiveFile(result.activeFile);
    if (result.removed) setFileError("");
  };

  const handleInspect = async () => {
    setIsInspecting(true);
    setTimeout(() => {
      setInspectionResult(
        inspectProjectStructure(files, projectSummary?.chip || selectedChip.name),
      );
      setIsInspecting(false);
    }, 1500);
  };

  const handleAiAnalyze = async () => {
    if (!projectSummary || analyzing) return;
    const result = await runProjectAiAnalysis(files, projectSummary, {
      confirmExternal: message => window.confirm(message),
      onStart: () => { setAnalyzing(true); setAiReport(""); },
      onChunk: chunk => setAiReport(current => current + chunk),
      onDone: () => setAnalyzing(false),
      onError: error => { setAiReport(`AI 分析失败：${error}`); setAnalyzing(false); },
    });
    if (result.status === 'unavailable') setAiReport(result.message);
  };

  const handleDownload = () => {
    const file = files.find((f) => f.path === activeFile);
    if (!file) { setExportError("当前文件不存在，无法下载。"); return; }
    try {
      downloadBrowserText(file.content, file.name);
      setExportError("");
    } catch (reason) {
      setExportError(`当前文件下载失败：${reason instanceof Error ? reason.message : String(reason)}`);
    }
  };

  const handleExportAnalysis = () => {
    if (!projectSummary) return;
    const report = buildProjectAnalysisReport({ projectName, generatedAt: new Date().toLocaleString(), summary: projectSummary, architecture: projectArchitecture, behavior: programBehavior, runtimeTrace, mapAnalysis });
    try {
      downloadBrowserText(report, `${projectName || "project"}-analysis.md`, "text/markdown;charset=utf-8");
      setExportError("");
    } catch (reason) {
      setExportError(`分析报告导出失败：${reason instanceof Error ? reason.message : String(reason)}`);
    }
  };

  const chipLang = activeFile.split(".").pop();

  return (
    <div className="relative flex h-full overflow-hidden">
      {/* File Explorer */}
      {projectSummary && (
        <div className="w-56 bg-[#0d1117] border-r border-[#30363d] flex flex-col">
          <FileTree
            files={files}
            activeFile={activeFile}
            onFileSelect={setActiveFile}
            onAddFile={handleAddFile}
            onDeleteFile={handleDeleteFile}
          />
        </div>
      )}

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-[#30363d] bg-[#161b22] px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden lg:block">
              <b className="text-sm text-gray-200">工程分析</b>
              <span className="ml-2 text-[10px] text-gray-600">
                导入工程、查看摘要与参考代码
              </span>
            </div>
            {projectSummary && (
              <div className="flex items-center gap-2 bg-[#0d1117] rounded-lg px-3 py-1.5">
                <Cpu size={14} className="text-blue-400" />
                <select
                  value={selectedChip.id}
                  onChange={(e) => {
                    const chip = chips.find((c) => c.id === e.target.value);
                    if (chip) setSelectedChip(chip);
                  }}
                  className="bg-transparent text-sm text-gray-300 outline-none cursor-pointer"
                >
                  {chips.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {projectSummary && (
              <span className="text-xs text-gray-500">
                {selectedChip.cores} · {selectedChip.frequency} ·{" "}
                {selectedChip.flash} Flash
              </span>
            )}
          </div>

          <div className="flex min-w-0 shrink items-center gap-1.5 overflow-x-auto py-1 scrollbar-thin">
            <label
              className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-[#0d1117] px-2.5 py-1.5 text-xs text-gray-300 hover:text-white"
              title="导入已有 C/C++ 工程文件或目录中的文件"
            >
              <Upload size={14} /> 导入工程
              <input
                type="file"
                multiple
                className="hidden"
                onClick={(event) => { (event.currentTarget as HTMLInputElement & { webkitdirectory?: boolean }).webkitdirectory = true; }}
                onChange={handleImportFiles}
              />
            </label>
            <button
              onClick={handleDownload}
              className="flex shrink-0 items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-300 hover:text-white
                bg-[#0d1117] hover:bg-[#1c2128] rounded-lg transition-colors"
            >
              <DownloadIcon size={14} />
              当前文件
            </button>
            <button onClick={handleExportAnalysis} disabled={!projectSummary} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#0d1117] px-2.5 py-1.5 text-xs text-gray-300 hover:bg-[#1c2128] hover:text-white disabled:opacity-40"><DownloadIcon size={14} />分析报告</button>
            {projectArchitecture && <button onClick={() => setActiveToolPanel(value => value === 'architecture' ? null : 'architecture')} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs ${activeToolPanel === 'architecture' ? "bg-cyan-500/20 text-cyan-300" : "bg-[#0d1117] text-gray-300 hover:text-white"}`}><Network size={13} />程序框架</button>}
            {mapFile && mapAnalysis && <button onClick={() => setActiveToolPanel(value => value === 'map' ? null : 'map')} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs ${activeToolPanel === 'map' ? "bg-purple-500/20 text-purple-300" : "bg-[#0d1117] text-gray-300 hover:text-white"}`}><BookOpen size={13} />MAP 分析</button>}
            <button
              onClick={handleInspect}
              disabled={isInspecting || !projectSummary}
              className="flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white
                bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50"
            >
              <Play size={14} fill="currentColor" />
              {isInspecting ? "检查中..." : "结构检查"}
            </button>
            {(projectSummary?.agentBuildSystem || projectSummary?.buildKind === "unknown") ? <button onClick={() => setActiveToolPanel(value => value === 'build' ? null : 'build')} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs ${activeToolPanel === 'build' ? "bg-green-500/20 text-green-300" : "bg-[#0d1117] text-gray-300 hover:text-white"}`}><Play size={13} />{projectSummary.agentBuildSystem ? `${projectSummary.toolchain} 构建` : "高级构建设置"}</button> : projectSummary && <span className="shrink-0 rounded-lg border border-[#30363d] px-2.5 py-1.5 text-[10px] text-gray-500">{projectSummary.toolchain} 管理构建</span>}
            <button
              onClick={() => void handleAiAnalyze()}
              disabled={!projectSummary || analyzing}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-purple-600 px-2.5 py-1.5 text-xs text-white hover:bg-purple-500 disabled:opacity-40"
              title="使用已配置的 AI 分析导入工程"
            >
              <Sparkles size={14} />
              {analyzing ? "分析中..." : "AI 分析"}
            </button>
            <button
              onClick={() => { setShowOutput(!showOutput); setActiveToolPanel(null); }}
              className={`p-1.5 rounded-lg transition-colors ${showOutput ? "bg-blue-500/20 text-blue-400" : "text-gray-400 hover:text-white"}`}
            >
              <Settings size={16} />
            </button>
          </div>
        </div>

        {(fileError || exportError) && <div role="alert" className="shrink-0 border-b border-red-500/30 bg-red-500/5 px-4 py-2 text-[10px] text-red-300">{fileError || exportError}</div>}

        {requestedProjectId && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#30363d] bg-cyan-500/5 px-4 py-2 text-[10px]">
            <span className="text-cyan-300">当前工程：{engineeringProject?.name ?? requestedProjectId}</span>
            {revisionId && <span className="text-gray-600">修订 {revisionId.replace('revision:', '').slice(0, 12)}</span>}
            {workspaceMessage && <span role="status" className="text-yellow-300">{workspaceMessage}</span>}
            <div className="ml-auto flex gap-2">
              {analysisRuns.length > 0 && <select aria-label="分析历史" value={selectedAnalysis?.id ?? ''} onChange={event => setSelectedAnalysisId(event.target.value)} className="max-w-44 rounded border border-[#30363d] bg-[#0d1117] px-2 py-1 text-gray-400">{analysisRuns.map(run => <option key={run.id} value={run.id}>{new Date(run.finishedAt).toLocaleString()} · {run.framework.confidence} · {(run.coverage.resolvedRate * 100).toFixed(0)}%</option>)}</select>}
              <button disabled={!projectLoaded || savingAnalysis} onClick={() => void saveAnalysisSnapshot()} className="rounded border border-purple-500/30 px-2 py-1 text-purple-300 disabled:opacity-40">{savingAnalysis ? '保存中…' : '保存分析证据'}</button>
              {selectedAnalysis && <button onClick={() => exportProjectAnalysisRun(selectedAnalysis)} className="rounded border border-green-500/30 px-2 py-1 text-green-300">导出分析报告</button>}
              {legacyWorkspaceAvailable && !projectLoaded && <button onClick={() => void associateLegacyWorkspace()} className="rounded border border-cyan-500/30 px-2 py-1 text-cyan-300">复制并关联旧工作区</button>}
              <button onClick={() => navigate('/engineering')} className="rounded border border-[#30363d] px-2 py-1 text-gray-400">返回工程中心</button>
            </div>
          </div>
        )}

        {/* Editor + Output */}
        <div className="flex-1 flex min-h-0">
          <div
            className={`flex-1 min-w-0 ${showOutput && projectSummary ? "border-r border-[#30363d]" : ""}`}
          >
            {projectSummary ? (
              <CodeEditor
                ref={editorRef}
                height="100%"
                language={chipLang || "c"}
                value={activeContent}
                onChange={handleEditorChange}
                fontSize={14}
                ariaLabel="工程源码编辑器"
              />
            ) : (
              <ProjectLanding
                onImport={handleImportFiles}
                error={importError}
              />
            )}
          </div>

          {showOutput && projectSummary && (
            <div className="flex w-80 flex-col bg-[#0d1117] xl:w-96">
              <ProjectSummaryPanel summary={projectSummary} onFindingSelect={handleFindingSelect} />
              <AiReportPanel report={aiReport} analyzing={analyzing} />
              <div className="h-52 shrink-0 border-t border-[#30363d]">
                <OutputPanel result={inspectionResult} />
              </div>
            </div>
          )}
        </div>

        {/* Status Bar */}
        <div className="h-6 bg-[#161b22] border-t border-[#30363d] flex items-center justify-between px-3 text-xs text-gray-500">
          <span>
            {projectSummary
              ? `${activeFile} · ${chipLang?.toUpperCase()}`
              : "尚未导入工程"}
          </span>
          <span>
            {projectSummary
              ? `${projectName} · ${files.length} 个文件 · ${projectSummary.chip}`
              : "导入工程后显示分析摘要"}
          </span>
        </div>
      </div>
      {activeToolPanel && <button type="button" aria-label="关闭分析工具" onClick={() => setActiveToolPanel(null)} className="absolute inset-x-0 top-12 bottom-0 z-20 bg-black/25" />}
      {activeToolPanel && <div className="absolute top-12 right-0 bottom-0 z-30 flex max-w-full shadow-[-18px_0_40px_rgba(0,0,0,0.38)]">
        {activeToolPanel === 'build' && <ProjectBuildPanel suggestedSystem={projectSummary?.agentBuildSystem} onClose={() => setActiveToolPanel(null)} onDiagnostic={(diagnostic) => { handleBuildDiagnostic(diagnostic); setActiveToolPanel(null); }} onArtifactAnalyze={(artifact, selectionId, context) => { const type = artifact.type.toLowerCase(), route = type === 'map' ? '/toolbox/map' : type === 'bin' ? '/toolbox/firmware' : type === 'hex' ? '/toolbox/ihex' : '/toolbox/elf'; navigate(route, { state: { selectionId, fileName: artifact.name, source: 'build-artifact', buildId: context.buildId, artifactIndex: context.artifactIndex, artifactType: type, size: artifact.size, modifiedAt: artifact.modifiedAt, sha256: context.sha256 } }); }} />}
        {activeToolPanel === 'map' && mapFile && mapAnalysis && <MapAnalysisPanel options={mapOptions.map(item => ({ path: item.file.path, name: item.file.name, lastModified: item.file.lastModified, analysis: item.analysis }))} selectedPath={mapFile.path} onSelect={setSelectedMapPath} onClose={() => setActiveToolPanel(null)} onModuleSelect={(module) => { handleMapModuleSelect(module); setActiveToolPanel(null); }} />}
        {activeToolPanel === 'architecture' && projectArchitecture && programBehavior && <ProjectArchitecturePanel architecture={projectArchitecture} behavior={programBehavior} trace={runtimeTrace} onTraceChange={handleRuntimeTraceChange} onClose={() => setActiveToolPanel(null)} onSelect={(file, line) => { handleFindingSelect({ id: `architecture:${file}:${line}`, severity: 'low', title: '程序框架', file, line, evidence: '', recommendation: '' }); setActiveToolPanel(null); }} />}
      </div>}
    </div>
  );
}
