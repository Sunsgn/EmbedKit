import type { FaultInvestigation } from "../types/faultInvestigation";
import { normalizeFaultInvestigation } from "./faultInvestigationStore";

export const FAULT_INVESTIGATION_EXPORT_MAX_BYTES = 4 * 1024 * 1024;

export function createFaultInvestigationExport(value: FaultInvestigation) {
  const portable = structuredClone(value);
  portable.addressResolutions = portable.addressResolutions.map((item) =>
    item.source
      ? {
          ...item,
          source: {
            ...item.source,
            file: item.source.file
              .replace(/\\/g, "/")
              .split("/")
              .filter(Boolean)
              .slice(-3)
              .join("/"),
          },
        }
      : item,
  );
  return {
    schema: "embedkit.fault-investigation",
    version: 1,
    exportedAt: new Date().toISOString(),
    investigation: portable,
    privacy: {
      excluded: [
        "Local Agent 文件授权令牌",
        "完整 ELF/MAP/SVD 文件内容",
        "未脱敏的本机绝对路径",
      ],
    },
  } as const;
}

export function createFaultInvestigationMarkdown(value: FaultInvestigation) {
  const lines = [
    `# ${value.title}`,
    "",
    `- 状态：${value.status}`,
    `- 架构：${value.architecture}`,
    `- 故障类型：${value.faultKind}`,
    `- 创建时间：${value.createdAt}`,
    `- 更新时间：${value.updatedAt}`,
    `- 固件标识：${value.firmwareId || "未关联"}`,
    "",
    "## 地址定位",
    "",
    ...value.addressResolutions.flatMap((item) => [
      `- ${item.role.toUpperCase()} ${item.address} → ${item.symbol?.name || item.section?.name || item.peripheral?.name || "未解析"}（可信度：${item.confidence}）`,
      ...(item.source
        ? [
            `  - 源码：${item.source.file}:${item.source.line}${item.source.column ? `:${item.source.column}` : ""}`,
          ]
        : []),
      ...item.unknowns.map((unknown) => `  - 未知项：${unknown}`),
    ]),
    "",
    "## 调查结论",
    "",
    ...(value.findings.length
      ? value.findings.flatMap((item) => [
          `### ${item.summary}`,
          `- 类型：${item.conclusionType}；可信度：${item.confidence}`,
          `- 证据：${item.evidenceIds.join(", ") || "无"}`,
          ...item.unknowns.map((unknown) => `- 未知项：${unknown}`),
          ...item.verificationSteps.map((step) => `- 验证：${step}`),
          "",
        ])
      : ["尚无调查结论。", ""]),
    "## 冲突与边界",
    "",
    ...(value.conflicts.length
      ? value.conflicts.map((item) => `- ${item.summary}`)
      : ["- 未发现已知证据冲突。"]),
    ...value.unknowns.map((item) => `- ${item}`),
    "",
    "## 复测关联",
    "",
    `- 基线测试：${value.baselineTestRunId || "未关联"}`,
    `- 修复后测试：${value.retestRunId || "未关联"}`,
    "",
    "> 本报告区分确定性、派生、启发式、人工和外部 AI 结论；地址关联不能单独证明根因。",
  ];
  return lines.join("\n");
}

export function parseFaultInvestigationExport(
  text: string,
): FaultInvestigation {
  if (
    new TextEncoder().encode(text).byteLength >
    FAULT_INVESTIGATION_EXPORT_MAX_BYTES
  )
    throw new Error("故障调查导入文件超过 4 MiB 上限");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("故障调查导入文件不是有效 JSON");
  }
  if (
    !value ||
    typeof value !== "object" ||
    (value as Record<string, unknown>).schema !==
      "embedkit.fault-investigation" ||
    (value as Record<string, unknown>).version !== 1
  )
    throw new Error("故障调查导入格式或版本不受支持");
  const investigation = normalizeFaultInvestigation(
    (value as Record<string, unknown>).investigation,
  );
  if (!investigation) throw new Error("故障调查内容无效或超出资源上限");
  return { ...investigation, updatedAt: new Date().toISOString() };
}
