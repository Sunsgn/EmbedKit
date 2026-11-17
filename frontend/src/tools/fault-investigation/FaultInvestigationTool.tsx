import { useEffect, useMemo, useState } from "react";
import { Download, FileSearch, Play, Save, Trash2 } from "lucide-react";
import { useLocation } from "react-router-dom";
import {
  analyzeHardFault,
  extractHardFaultLog,
  type HardFaultInput,
} from "../hardfault/hardfault";
import {
  analyzeMap,
  lookupMapAddress,
  type MapAnalysis,
} from "../../utils/mapAnalyzer";
import { lookupSvdAddress, parseSvd, type SvdDevice } from "../svd/svd";
import {
  analyzeSelectedElf,
  disassembleElfAddress,
  lookupElfAddress,
  type ElfAnalysis,
} from "../../services/elfAgent";
import { revokeLocalPath, selectLocalFile } from "../../services/localFiles";
import {
  correlateAddressEvidence,
  type AddressResolutionInput,
} from "../../services/addressResolution";
import {
  createFaultInvestigation,
  deleteFaultInvestigation,
  listFaultInvestigations,
  saveFaultInvestigation,
} from "../../services/faultInvestigationStore";
import {
  createFaultInvestigationExport,
  createFaultInvestigationMarkdown,
  parseFaultInvestigationExport,
} from "../../services/faultInvestigationReport";
import {
  compareTestRuns,
  type TestRunComparison,
} from "../../services/testRunComparison";
import { listTestRuns } from "../../services/productStorage";
import type { EvidenceReference, Finding } from "../../types/evidence";
import type {
  FaultInvestigation,
  InvestigationArtifact,
} from "../../types/faultInvestigation";
import type { TestRunRecord } from "../../types/product";

const REGISTER_NAMES: Array<keyof HardFaultInput> = [
  "r0",
  "r1",
  "r2",
  "r3",
  "r12",
  "lr",
  "pc",
  "xpsr",
  "cfsr",
  "hfsr",
  "mmfar",
  "bfar",
];
const required: Array<keyof HardFaultInput> = [
  "r0",
  "r1",
  "r2",
  "r3",
  "r12",
  "lr",
  "pc",
  "xpsr",
  "cfsr",
  "hfsr",
];
const emptyRegisters = Object.fromEntries(
  REGISTER_NAMES.map((name) => [name, ""]),
) as Record<keyof HardFaultInput, string>;
const MAX_MAP_BYTES = 16 * 1024 * 1024;

type RouteState = {
  rawLog?: string;
  registers?: Partial<Record<keyof HardFaultInput, number>>;
};

const hex = (value: number) =>
  `0x${(value >>> 0).toString(16).padStart(8, "0").toUpperCase()}`;
const parseHex = (value: string, name: string) => {
  const text = value.trim();
  if (!/^(?:0x)?[\da-f]{1,8}$/i.test(text))
    throw new Error(`${name.toUpperCase()} 必须是 1–8 位十六进制数`);
  return Number.parseInt(text.replace(/^0x/i, ""), 16) >>> 0;
};
const download = (name: string, content: string, type: string) => {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
};
const digest = async (content: string) =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content)),
    ),
  ]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");

function artifact(
  kind: InvestigationArtifact["kind"],
  fileName: string,
  byteLength: number,
  sha256?: string,
): InvestigationArtifact {
  return {
    id: `${kind}-${crypto.randomUUID()}`,
    kind,
    fileName: fileName.slice(0, 240),
    byteLength,
    ...(sha256 ? { sha256 } : {}),
    capturedAt: new Date().toISOString(),
  };
}

export default function FaultInvestigationTool() {
  const location = useLocation();
  const incoming = (
    location.state && typeof location.state === "object" ? location.state : {}
  ) as RouteState;
  const [record, setRecord] = useState(() =>
    createFaultInvestigation({
      rawLog: incoming.rawLog,
      registers: incoming.registers as Record<string, number> | undefined,
    }),
  );
  const [registers, setRegisters] = useState(() => ({
    ...emptyRegisters,
    ...Object.fromEntries(
      Object.entries(incoming.registers ?? {}).map(([name, value]) => [
        name,
        hex(Number(value)),
      ]),
    ),
  }));
  const [rawLog, setRawLog] = useState(incoming.rawLog ?? "");
  const [elf, setElf] = useState<ElfAnalysis | null>(null),
    [elfName, setElfName] = useState("");
  const [map, setMap] = useState<MapAnalysis | null>(null),
    [svd, setSvd] = useState<SvdDevice | null>(null);
  const [history, setHistory] = useState<FaultInvestigation[]>([]),
    [runs, setRuns] = useState<TestRunRecord[]>([]);
  const [comparison, setComparison] = useState<TestRunComparison | null>(null);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const canAnalyze = required.every((name) => registers[name].trim());

  useEffect(() => {
    void Promise.all([
      listFaultInvestigations().catch(() => []),
      listTestRuns().catch(() => []),
    ]).then(([saved, testRuns]) => {
      setHistory(saved);
      setRuns(testRuns);
    });
  }, []);
  const parsedInput = useMemo(() => {
    try {
      if (!canAnalyze) return null;
      return Object.fromEntries(
        REGISTER_NAMES.filter((name) => registers[name].trim()).map((name) => [
          name,
          parseHex(registers[name], name),
        ]),
      ) as unknown as HardFaultInput;
    } catch {
      return null;
    }
  }, [canAnalyze, registers]);

  const applyLog = () => {
    setError("");
    try {
      const extracted = extractHardFaultLog(rawLog);
      setRegisters((current) => ({
        ...current,
        ...Object.fromEntries(
          Object.entries(extracted.registers).map(([name, value]) => [
            name,
            hex(Number(value)),
          ]),
        ),
      }));
      setMessage(
        `从日志提取 ${extracted.evidence.length} 项；未提供的寄存器不会被猜测。`,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const chooseElf = async () => {
    setBusy(true);
    setError("");
    try {
      const selected = await selectLocalFile();
      if (selected.cancelled || !selected.selectionId) return;
      try {
        const result = await analyzeSelectedElf(selected.selectionId);
        setElf(result);
        setElfName(selected.name || "firmware.elf");
        setRecord((current) => ({
          ...current,
          artifacts: [
            ...current.artifacts.filter((item) => item.kind !== "elf"),
            artifact(
              "elf",
              selected.name || "firmware.elf",
              selected.size ?? result.fileSize,
              result.sha256,
            ),
          ],
          updatedAt: new Date().toISOString(),
        }));
        setMessage(
          `已分析 ${selected.name || "ELF"}；地址查询会在 Local Agent 会话过期前可用。`,
        );
      } finally {
        await revokeLocalPath(selected.selectionId).catch(() => undefined);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const importTextArtifact = async (file: File, kind: "map" | "svd") => {
    setError("");
    try {
      const limit = kind === "map" ? MAX_MAP_BYTES : 10 * 1024 * 1024;
      if (file.size > limit)
        throw new Error(
          `${kind.toUpperCase()} 文件超过 ${limit / 1024 / 1024} MiB 上限`,
        );
      const content = await file.text(),
        sha256 = await digest(content);
      if (kind === "map") setMap(analyzeMap(content));
      else setSvd(parseSvd(content));
      setRecord((current) => ({
        ...current,
        artifacts: [
          ...current.artifacts.filter((item) => item.kind !== kind),
          artifact(kind, file.name, file.size, sha256),
        ],
        updatedAt: new Date().toISOString(),
      }));
      setMessage(`已在浏览器本地解析 ${file.name}。`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const resolve = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (!parsedInput)
        throw new Error("请先填写全部必需寄存器，并检查十六进制格式");
      const fault = analyzeHardFault(parsedInput),
        inputs: AddressResolutionInput[] = [];
      for (const address of fault.addresses) {
        const role =
          address.kind === "PC"
            ? "pc"
            : address.kind === "LR"
              ? "lr"
              : "fault-address";
        const elfLookup =
          elf && address.sourceReady
            ? await lookupElfAddress(elf.analysisId, hex(address.value)).catch(
                () => null,
              )
            : null;
        const disassembly =
          elf && address.sourceReady
            ? await disassembleElfAddress(
                elf.analysisId,
                hex(address.value),
              ).catch(() => null)
            : null;
        const mapLookup =
          map && address.sourceReady
            ? lookupMapAddress(map, address.value)
            : null;
        const svdLookup =
          svd && !address.sourceReady
            ? lookupSvdAddress(svd, address.value)
            : null;
        inputs.push({
          role,
          address: address.value,
          architecture: "cortex-m",
          elf: elfLookup,
          map: mapLookup,
          svd: svdLookup,
          disassembly,
        });
      }
      const correlation = correlateAddressEvidence(inputs);
      const elfArtifact = record.artifacts.find((item) => item.kind === "elf");
      if (
        /^[\da-f]{64}$/i.test(record.firmwareId ?? "") &&
        elfArtifact?.sha256 &&
        elfArtifact.sha256.toLowerCase() !== record.firmwareId?.toLowerCase()
      ) {
        correlation.conflicts.push({
          id: "conflict-firmware-elf-sha256",
          category: "firmware-identity",
          summary:
            "设备固件 SHA-256 与 ELF 构建产物 SHA-256 不一致，源码定位只能作为疑似结果",
          evidenceIds: [],
        });
        correlation.unknowns.push(
          "无法证明当前 ELF 与设备实际运行固件来自同一次构建",
        );
        correlation.resolutions.forEach((item) => {
          if (item.confidence === "high") item.confidence = "low";
        });
      }
      const registerEvidence: EvidenceReference[] = fault.findings.map(
        (item) => ({
          schemaVersion: 1,
          id: `fault-register-${item.register.toLowerCase()}-${item.bit}`,
          kind: "fault",
          origin: "deterministic",
          sourceId: "hardfault-registers",
          label: `${item.code} · ${item.register}[${item.bit}]`,
        }),
      );
      const faultFindings: Finding[] = fault.findings.map((item, index) => ({
        schemaVersion: 1,
        id: `hardfault-${item.code.toLowerCase()}-${index}`,
        category: "hardfault-status",
        severity: "warning",
        conclusionType: "deterministic",
        confidence: "high",
        summary: `${item.code}：${item.detail}`,
        evidenceIds: [
          `fault-register-${item.register.toLowerCase()}-${item.bit}`,
        ],
        unknowns: [],
        verificationSteps: [item.action],
      }));
      const now = new Date().toISOString();
      const next: FaultInvestigation = {
        ...record,
        input: {
          ...(rawLog ? { rawLog } : {}),
          registers: parsedInput as unknown as Record<string, number>,
        },
        status: "investigating",
        addressResolutions: correlation.resolutions,
        evidenceReferences: [...registerEvidence, ...correlation.evidence],
        findings: [...faultFindings, ...correlation.findings],
        conflicts: correlation.conflicts,
        unknowns: [
          ...fault.warnings,
          ...correlation.unknowns,
          ...(!elf ? ["未绑定 ELF，不能定位 DWARF 源码行"] : []),
          ...(!map ? ["未绑定 MAP，缺少独立链接布局交叉验证"] : []),
          ...(!svd ? ["未绑定 SVD，故障访问地址不能关联外设寄存器"] : []),
        ],
        updatedAt: now,
      };
      setRecord(next);
      await saveFaultInvestigation(next);
      setHistory(await listFaultInvestigations());
      setMessage("调查结果已生成并保存；关联结果不等于已经确认根因。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    try {
      const next = await saveFaultInvestigation({
        ...record,
        title: record.title.trim() || "未命名故障调查",
        firmwareId: record.firmwareId?.trim() || undefined,
        input: {
          ...(rawLog ? { rawLog } : {}),
          registers:
            (parsedInput as unknown as Record<string, number>) ??
            record.input.registers,
        },
        updatedAt: new Date().toISOString(),
      });
      setRecord(next);
      setHistory(await listFaultInvestigations());
      setMessage("调查记录已保存。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };
  const selectHistory = (id: string) => {
    const selected = history.find((item) => item.id === id);
    if (!selected) return;
    setRecord(selected);
    setRawLog(selected.input.rawLog ?? "");
    setRegisters({
      ...emptyRegisters,
      ...Object.fromEntries(
        Object.entries(selected.input.registers).map(([name, value]) => [
          name,
          hex(value),
        ]),
      ),
    });
    setElf(null);
    setMap(null);
    setSvd(null);
    setComparison(null);
    setMessage("已载入调查快照；重新解析前需要重新绑定原始产物。");
  };
  const remove = async () => {
    await deleteFaultInvestigation(record.id);
    const next = createFaultInvestigation();
    setRecord(next);
    setRawLog("");
    setRegisters({ ...emptyRegisters });
    setHistory(await listFaultInvestigations());
    setMessage("已删除当前调查记录；此操作无法恢复。");
  };
  const importInvestigation = async (file: File) => {
    setError("");
    try {
      const imported = parseFaultInvestigationExport(await file.text());
      await saveFaultInvestigation(imported);
      setRecord(imported);
      setRawLog(imported.input.rawLog ?? "");
      setRegisters({
        ...emptyRegisters,
        ...Object.fromEntries(
          Object.entries(imported.input.registers).map(([name, value]) => [
            name,
            hex(value),
          ]),
        ),
      });
      setHistory(await listFaultInvestigations());
      setElf(null);
      setMap(null);
      setSvd(null);
      setMessage(
        "调查档案已导入；原始构建产物未包含在档案中，重新解析前请重新绑定。",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };
  const updateRuns = (
    field: "baselineTestRunId" | "retestRunId",
    value: string,
  ) => {
    const next = {
      ...record,
      [field]: value || undefined,
      updatedAt: new Date().toISOString(),
    };
    const baseline = runs.find((item) => item.id === next.baselineTestRunId),
      retest = runs.find((item) => item.id === next.retestRunId);
    const result =
      baseline && retest ? compareTestRuns(baseline, retest) : null;
    setComparison(result);
    setRecord({
      ...next,
      status:
        result?.comparable && result.outcome === "fixed"
          ? "fixed"
          : next.status,
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        把 HardFault、ELF/DWARF、MAP、CMSIS-SVD
        和测试记录串成可保存的证据链。所有确定性解析在本地执行，地址匹配不会被直接表述为根因。
      </p>
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="历史故障调查"
          value={history.some((item) => item.id === record.id) ? record.id : ""}
          onChange={(event) => selectHistory(event.target.value)}
          className="field min-w-56 text-xs"
        >
          <option value="">新建调查</option>
          {history.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title} · {new Date(item.updatedAt).toLocaleString()}
            </option>
          ))}
        </select>
        <input
          aria-label="调查标题"
          value={record.title}
          onChange={(event) =>
            setRecord((current) => ({ ...current, title: event.target.value }))
          }
          className="field min-w-56 flex-1 text-xs"
        />
        <button
          onClick={() => void save()}
          className="rounded border border-[#30363d] px-3 py-2 text-xs text-gray-300"
        >
          <Save size={13} className="mr-1 inline" />
          保存
        </button>
        <button
          onClick={() => void remove()}
          className="rounded border border-red-500/20 px-3 py-2 text-xs text-red-300"
        >
          <Trash2 size={13} className="mr-1 inline" />
          删除
        </button>
      </div>
      {message && (
        <div
          role="status"
          className="rounded border border-green-500/20 bg-green-500/5 p-2 text-xs text-green-300"
        >
          {message}
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="rounded border border-red-500/20 bg-red-500/5 p-2 text-xs text-red-300"
        >
          {error}
        </div>
      )}

      <section className="rounded border border-[#30363d] bg-[#0d1117] p-3">
        <h2 className="mb-2 text-xs font-semibold text-gray-200">
          1. 故障输入
        </h2>
        <textarea
          aria-label="故障调查原始日志"
          value={rawLog}
          onChange={(event) => setRawLog(event.target.value)}
          rows={4}
          maxLength={1024 * 1024}
          className="field resize-y font-mono text-[11px]"
          placeholder="粘贴 HardFault 日志；最大 1 MiB"
        />
        <button
          onClick={applyLog}
          disabled={!rawLog.trim()}
          className="mt-2 rounded border border-purple-500/30 px-3 py-1.5 text-xs text-purple-300 disabled:opacity-40"
        >
          提取寄存器
        </button>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {REGISTER_NAMES.map((name) => (
            <label key={name} className="text-[10px] uppercase text-gray-500">
              {name}
              <input
                aria-label={`调查寄存器 ${name.toUpperCase()}`}
                value={registers[name]}
                onChange={(event) =>
                  setRegisters((current) => ({
                    ...current,
                    [name]: event.target.value,
                  }))
                }
                className="field mt-1 font-mono text-xs"
                placeholder={required.includes(name) ? "必填 HEX" : "可选 HEX"}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="rounded border border-[#30363d] bg-[#0d1117] p-3">
        <h2 className="mb-2 text-xs font-semibold text-gray-200">
          2. 绑定构建产物
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => void chooseElf()}
            disabled={busy}
            className="rounded bg-blue-600 px-3 py-2 text-xs text-white disabled:opacity-40"
          >
            <FileSearch size={13} className="mr-1 inline" />
            选择 ELF / AXF
          </button>
          <label className="cursor-pointer rounded border border-[#30363d] px-3 py-2 text-xs text-gray-300">
            导入 MAP
            <input
              type="file"
              accept=".map,.txt"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importTextArtifact(file, "map");
                event.target.value = "";
              }}
            />
          </label>
          <label className="cursor-pointer rounded border border-[#30363d] px-3 py-2 text-xs text-gray-300">
            导入 SVD
            <input
              type="file"
              accept=".svd,.xml"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importTextArtifact(file, "svd");
                event.target.value = "";
              }}
            />
          </label>
          <span className="text-[10px] text-gray-500">
            ELF：{elfName || "未绑定"} · MAP：{map?.formatLabel || "未绑定"} ·
            SVD：{svd?.name || "未绑定"}
          </span>
        </div>
        <label className="mt-3 block text-[10px] text-gray-500">
          设备实际固件标识或 SHA-256
          <input
            value={record.firmwareId ?? ""}
            onChange={(event) =>
              setRecord((current) => ({
                ...current,
                firmwareId: event.target.value,
              }))
            }
            className="field mt-1 font-mono text-xs"
            placeholder="用于核对构建产物与烧录固件是否一致"
          />
        </label>
      </section>

      <section className="rounded border border-[#30363d] bg-[#0d1117] p-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold text-gray-200">
            3. 地址定位与证据关联
          </h2>
          <button
            onClick={() => void resolve()}
            disabled={busy || !canAnalyze}
            className="ml-auto rounded bg-green-600 px-3 py-2 text-xs text-white disabled:opacity-40"
          >
            <Play size={13} className="mr-1 inline" />
            {busy ? "处理中…" : "执行调查"}
          </button>
        </div>
        {record.addressResolutions.length > 0 && (
          <div className="mt-3 overflow-auto">
            <table className="w-full min-w-[720px] text-left text-[10px]">
              <thead className="text-gray-600">
                <tr>
                  <th className="p-2">角色 / 地址</th>
                  <th>函数或节区</th>
                  <th>源码</th>
                  <th>指令 / 外设寄存器</th>
                  <th>可信度</th>
                </tr>
              </thead>
              <tbody>
                {record.addressResolutions.map((item) => (
                  <tr
                    key={`${item.role}-${item.address}`}
                    className="border-t border-[#30363d]"
                  >
                    <td className="p-2 font-mono">
                      {item.role.toUpperCase()} {item.address}
                      {item.address !== item.normalizedAddress
                        ? ` → ${item.normalizedAddress}`
                        : ""}
                    </td>
                    <td>
                      {item.symbol
                        ? `${item.symbol.name} + ${item.symbol.offset}`
                        : item.section?.name || "未解析"}
                    </td>
                    <td>
                      {item.source
                        ? `${item.source.file}:${item.source.line}`
                        : "无 DWARF 行"}
                    </td>
                    <td>
                      {item.instruction
                        ? `${item.instruction.mnemonic} ${item.instruction.operands}`
                        : item.peripheral
                          ? `${item.peripheral.name}${item.peripheral.register ? `.${item.peripheral.register}` : ""}`
                          : "未匹配"}
                    </td>
                    <td>{item.confidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {record.conflicts.map((item) => (
          <p key={item.id} className="mt-2 text-xs text-red-300">
            证据冲突：{item.summary}
          </p>
        ))}
        {record.unknowns.length > 0 && (
          <div className="mt-2 text-[10px] text-yellow-300">
            未知项：{record.unknowns.join("；")}
          </div>
        )}
      </section>

      <section className="rounded border border-[#30363d] bg-[#0d1117] p-3">
        <h2 className="mb-2 text-xs font-semibold text-gray-200">
          4. 调查结论
        </h2>
        {record.findings.length ? (
          record.findings.map((item) => (
            <div
              key={item.id}
              className="mb-2 rounded border border-[#30363d] p-2"
            >
              <div className="flex gap-2 text-xs">
                <b>{item.summary}</b>
                <span className="ml-auto text-gray-500">
                  {item.conclusionType} · {item.confidence}
                </span>
              </div>
              <p className="mt-1 text-[10px] text-blue-300">
                {item.verificationSteps.join("；")}
              </p>
            </div>
          ))
        ) : (
          <p className="text-xs text-gray-600">
            执行调查后生成确定性和派生结论；AI 建议不会覆盖这些结果。
          </p>
        )}
      </section>

      <section className="rounded border border-[#30363d] bg-[#0d1117] p-3">
        <h2 className="mb-2 text-xs font-semibold text-gray-200">
          5. 修复复测与导出
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-[10px] text-gray-500">
            修复前基线测试
            <select
              aria-label="修复前基线测试"
              value={record.baselineTestRunId ?? ""}
              onChange={(event) =>
                updateRuns("baselineTestRunId", event.target.value)
              }
              className="field mt-1 text-xs"
            >
              <option value="">未关联</option>
              {runs.map((run) => (
                <option key={run.id} value={run.id}>
                  {run.caseName} · {run.status} · {run.startedAt}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[10px] text-gray-500">
            修复后测试
            <select
              aria-label="修复后测试"
              value={record.retestRunId ?? ""}
              onChange={(event) =>
                updateRuns("retestRunId", event.target.value)
              }
              className="field mt-1 text-xs"
            >
              <option value="">未关联</option>
              {runs.map((run) => (
                <option key={run.id} value={run.id}>
                  {run.caseName} · {run.status} · {run.startedAt}
                </option>
              ))}
            </select>
          </label>
        </div>
        {comparison && (
          <div
            className={`mt-2 rounded border p-2 text-xs ${comparison.comparable ? "border-blue-500/20 text-blue-200" : "border-yellow-500/20 text-yellow-200"}`}
          >
            比较结果：{comparison.outcome}；
            {comparison.comparable
              ? `耗时变化 ${comparison.durationDeltaMs} ms，失败项变化 ${comparison.failedDelta}`
              : comparison.reasons.join("；")}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <label className="cursor-pointer rounded border border-[#30363d] px-3 py-2 text-xs text-gray-300">
            导入调查 JSON
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importInvestigation(file);
                event.target.value = "";
              }}
            />
          </label>
          <button
            onClick={() =>
              download(
                `fault-investigation-${record.id}.json`,
                JSON.stringify(createFaultInvestigationExport(record), null, 2),
                "application/json;charset=utf-8",
              )
            }
            className="rounded border border-[#30363d] px-3 py-2 text-xs text-gray-300"
          >
            <Download size={13} className="mr-1 inline" />
            导出 JSON
          </button>
          <button
            onClick={() =>
              download(
                `fault-investigation-${record.id}.md`,
                createFaultInvestigationMarkdown(record),
                "text/markdown;charset=utf-8",
              )
            }
            className="rounded border border-[#30363d] px-3 py-2 text-xs text-gray-300"
          >
            <Download size={13} className="mr-1 inline" />
            导出 Markdown
          </button>
        </div>
      </section>
    </div>
  );
}
