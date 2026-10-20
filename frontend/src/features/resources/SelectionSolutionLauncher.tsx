import { useMemo, useState } from "react";
import {
  Bot,
  ClipboardList,
  FileInput,
  FolderOpen,
  LayoutTemplate,
  ListChecks,
  Play,
  RotateCcw,
} from "lucide-react";
import type { FunctionSolution } from "../../types";
import {
  createFunctionSolution,
  listFunctionSolutions,
} from "./functionSolutions";
import { parseRecommendationText } from "./recommendationImport";
import { functionTemplates } from "./selectionRegistry";
import type {
  SelectionIntakeKind,
  SelectionWorkspaceDraft,
} from "./selectionWorkspaceDraft";

export interface SelectionLaunchResult {
  solution: FunctionSolution;
  intakeKind: SelectionIntakeKind;
  intakeText: string;
  targetRoleId?: string;
}

const entries: Array<{
  id: SelectionIntakeKind | "history";
  title: string;
  detail: string;
  icon: typeof ClipboardList;
}> = [
  {
    id: "requirement",
    title: "粘贴产品需求",
    detail: "保留需求原文，再确认系统角色和硬条件",
    icon: ClipboardList,
  },
  {
    id: "recommendation",
    title: "粘贴 AI / 外部推荐",
    detail: "只提取候选型号，参数必须重新查询核验",
    icon: Bot,
  },
  {
    id: "models",
    title: "导入型号列表",
    detail: "从文本或表格提取型号并逐项核对",
    icon: FileInput,
  },
  {
    id: "template",
    title: "从模板开始",
    detail: "使用通用角色结构或空白方案",
    icon: LayoutTemplate,
  },
  {
    id: "history",
    title: "打开历史方案",
    detail: "继续已有证据、条件和候选记录",
    icon: FolderOpen,
  },
];

export default function SelectionSolutionLauncher({
  draft,
  onStart,
  onDiscardDraft,
}: {
  draft: SelectionWorkspaceDraft | null;
  onStart: (result: SelectionLaunchResult) => void;
  onDiscardDraft: () => void;
}) {
  const [entry, setEntry] = useState<SelectionIntakeKind | "history">(
    "requirement",
  );
  const [text, setText] = useState("");
  const [templateId, setTemplateId] = useState(functionTemplates[0].id);
  const [targetIndex, setTargetIndex] = useState(0);
  const records = useMemo(() => listFunctionSolutions().slice(0, 8), []);
  const template =
    functionTemplates.find((item) => item.id === templateId) ??
    functionTemplates[0];
  const parsed = useMemo(
    () =>
      entry === "recommendation" || entry === "models"
        ? parseRecommendationText(text)
        : null,
    [entry, text],
  );
  const start = () => {
    const solution = createFunctionSolution(template);
    if (entry === "requirement" && text.trim())
      solution.description = text.trim().slice(0, 4_000);
    const targetRoleId =
      solution.roles[targetIndex]?.id ?? solution.roles[0]?.id;
    onStart({
      solution,
      intakeKind: entry === "history" ? "template" : entry,
      intakeText: text,
      ...(targetRoleId ? { targetRoleId } : {}),
    });
  };

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-5">
        <h2 className="text-base font-semibold text-gray-100">
          开始方案选型与验证
        </h2>
        <p className="mt-1 text-xs leading-5 text-gray-500">
          AI
          或搜索结果可以提供候选；这里负责按硬条件筛选、核对精确型号、保留来源和未知项。无需
          AI 也可从模板或空白方案开始。
        </p>
      </div>
      {draft && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
          <RotateCcw size={18} className="text-blue-400" />
          <div className="min-w-0 flex-1">
            <b className="block truncate text-sm text-gray-200">
              恢复未保存工作区：{draft.solution.name}
            </b>
            <small className="text-[10px] text-gray-500">
              {new Date(draft.updatedAt).toLocaleString()} ·{" "}
              {draft.solution.roles.length} 个角色 ·{" "}
              {draft.solution.parts.length} 个候选
            </small>
          </div>
          <button
            onClick={() => onStart(draft)}
            className="rounded bg-blue-600 px-3 py-2 text-xs text-white"
          >
            恢复
          </button>
          <button
            onClick={onDiscardDraft}
            className="rounded border border-[#30363d] px-3 py-2 text-xs text-gray-400"
          >
            放弃草稿
          </button>
        </div>
      )}
      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <nav aria-label="方案启动方式" className="space-y-2">
          {entries.map((item) => (
            <button
              key={item.id}
              onClick={() => setEntry(item.id)}
              className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left ${entry === item.id ? "border-blue-500/50 bg-blue-500/10" : "border-[#30363d] bg-[#161b22] hover:border-[#484f58]"}`}
            >
              <item.icon
                size={17}
                className={
                  entry === item.id
                    ? "mt-0.5 text-blue-400"
                    : "mt-0.5 text-gray-600"
                }
              />
              <span>
                <b className="block text-xs text-gray-200">{item.title}</b>
                <small className="mt-0.5 block text-[10px] leading-4 text-gray-600">
                  {item.detail}
                </small>
              </span>
            </button>
          ))}
        </nav>
        <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-4">
          {entry === "history" ? (
            <div>
              <h3 className="text-sm font-semibold text-gray-200">最近方案</h3>
              {records.length === 0 ? (
                <p className="mt-8 text-center text-xs text-gray-600">
                  尚无保存记录
                </p>
              ) : (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {records.map((record) => (
                    <button
                      key={record.id}
                      onClick={() =>
                        onStart({
                          solution: record,
                          intakeKind: "template",
                          intakeText: "",
                          targetRoleId: record.roles[0]?.id,
                        })
                      }
                      className="rounded-lg border border-[#30363d] bg-[#0d1117] p-3 text-left hover:border-blue-500/40"
                    >
                      <b className="block truncate text-xs text-gray-200">
                        {record.name}
                      </b>
                      <small className="mt-1 block text-[10px] text-gray-600">
                        {record.roles.length} 个角色 · {record.parts.length}{" "}
                        个候选
                      </small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {entry !== "template" && (
                <label className="block">
                  <span className="mb-2 block text-xs font-medium text-gray-300">
                    {entry === "requirement"
                      ? "产品需求原文"
                      : entry === "recommendation"
                        ? "推荐回复原文"
                        : "型号列表或表格"}
                  </span>
                  <textarea
                    aria-label="方案输入内容"
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    maxLength={64 * 1024}
                    rows={8}
                    placeholder={
                      entry === "requirement"
                        ? "例如：24V 工业控制节点，需要 CAN FD，工作温度 -40～85°C……"
                        : "粘贴文本、Markdown 表格或每行一个型号"
                    }
                    className="w-full resize-y rounded-lg border border-[#30363d] bg-[#0d1117] p-3 text-xs leading-5 outline-none focus:border-blue-500"
                  />
                  <small className="mt-1 block text-[10px] text-gray-600">
                    仅在本机保留和解析，最多 64 KiB
                  </small>
                </label>
              )}
              {(entry === "recommendation" || entry === "models") && parsed && (
                <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3">
                  <div className="flex items-center gap-2 text-xs text-purple-300">
                    <ListChecks size={14} />
                    已提取 {parsed.candidates.length} 个可能型号
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {parsed.candidates.slice(0, 12).map((item) => (
                      <span
                        key={item.id}
                        className="rounded bg-[#0d1117] px-2 py-1 text-[10px] text-gray-300"
                      >
                        {item.model}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] text-gray-500">
                    这里只识别候选，不把推荐文字中的参数当作事实。进入工作区后选择并查询精确型号。
                  </p>
                </div>
              )}
              <label className="block">
                <span className="mb-2 block text-xs font-medium text-gray-300">
                  方案结构
                </span>
                <select
                  aria-label="方案模板"
                  value={templateId}
                  onChange={(event) => {
                    setTemplateId(event.target.value);
                    setTargetIndex(0);
                  }}
                  className="field"
                >
                  {functionTemplates.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} — {item.description}
                    </option>
                  ))}
                </select>
              </label>
              {(entry === "recommendation" || entry === "models") &&
                template.roles.length > 0 && (
                  <label className="block">
                    <span className="mb-2 block text-xs font-medium text-gray-300">
                      候选先归入
                    </span>
                    <select
                      aria-label="目标器件角色"
                      value={targetIndex}
                      onChange={(event) =>
                        setTargetIndex(Number(event.target.value))
                      }
                      className="field"
                    >
                      {template.roles.map((role, index) => (
                        <option
                          key={`${role.categoryId}-${index}`}
                          value={index}
                        >
                          {role.name}
                        </option>
                      ))}
                    </select>
                    <small className="mt-1 block text-[10px] text-gray-600">
                      导入后仍可按不同角色分别核验；系统不会根据型号名称猜测角色。
                    </small>
                  </label>
                )}
              <div className="flex justify-end">
                <button
                  onClick={start}
                  disabled={entry !== "template" && !text.trim()}
                  className="flex items-center gap-1.5 rounded bg-blue-600 px-4 py-2 text-xs text-white disabled:opacity-40"
                >
                  <Play size={13} />
                  进入核验工作区
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
