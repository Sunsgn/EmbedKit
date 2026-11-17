import type { ElfAddressLookup, ElfDisassemblyWindow } from "./elfAgent";
import type {
  EvidenceReference,
  Finding,
  FindingConfidence,
} from "../types/evidence";
import type {
  AddressResolution,
  InvestigationConflict,
  InvestigationAddressRole,
} from "../types/faultInvestigation";
import type { MapAddressLookup } from "../utils/mapAnalyzer";
import type { SvdAddressLookup } from "../tools/svd/svd";

export interface AddressResolutionInput {
  role: InvestigationAddressRole;
  address: number;
  architecture: string;
  elf?: ElfAddressLookup | null;
  map?: MapAddressLookup | null;
  svd?: SvdAddressLookup | null;
  disassembly?: ElfDisassemblyWindow | null;
}

export interface CorrelationResult {
  resolutions: AddressResolution[];
  evidence: EvidenceReference[];
  findings: Finding[];
  conflicts: InvestigationConflict[];
  unknowns: string[];
}

export interface AddressNormalizerAdapter {
  id: string;
  architectures: string[];
  normalize: (
    address: number,
    role: InvestigationAddressRole,
  ) => { address: number; normalizedAddress: number; normalization: string[] };
}

const hex = (value: number) =>
  `0x${(value >>> 0).toString(16).padStart(8, "0").toUpperCase()}`;
const evidenceId = (role: string, source: string, address: string) =>
  `fault-${role}-${source}-${address.toLowerCase().replace(/^0x/, "")}`;
const confidenceRank: Record<FindingConfidence, number> = {
  unknown: 0,
  low: 1,
  medium: 2,
  high: 3,
};

export function normalizeCortexMAddress(
  address: number,
  role: InvestigationAddressRole,
) {
  if (!Number.isInteger(address) || address < 0 || address > 0xffffffff)
    throw new Error("地址必须是 32 位无符号整数");
  const clearsThumbBit =
    (role === "pc" || role === "lr" || role === "stack-frame") &&
    (address & 1) === 1;
  return {
    address,
    normalizedAddress: clearsThumbBit ? address - 1 : address,
    normalization: clearsThumbBit
      ? ["清除 Cortex-M Thumb 状态位；原始地址已保留"]
      : [],
  };
}

const addressNormalizerRegistry = new Map<string, AddressNormalizerAdapter>();

export function registerAddressNormalizer(adapter: AddressNormalizerAdapter) {
  if (!adapter.id.trim() || !adapter.architectures.length)
    throw new Error("地址适配器必须声明标识和适用架构");
  for (const architecture of adapter.architectures)
    addressNormalizerRegistry.set(architecture.toLowerCase(), adapter);
}

registerAddressNormalizer({
  id: "cortex-m-v1",
  architectures: ["cortex-m"],
  normalize: normalizeCortexMAddress,
});

export function normalizeArchitectureAddress(
  architecture: string,
  address: number,
  role: InvestigationAddressRole,
) {
  const adapter = addressNormalizerRegistry.get(architecture.toLowerCase());
  if (adapter)
    return { ...adapter.normalize(address, role), adapterId: adapter.id };
  if (!Number.isInteger(address) || address < 0 || address > 0xffffffff)
    throw new Error("地址必须是 32 位无符号整数");
  return {
    address,
    normalizedAddress: address,
    normalization: [],
    adapterId: null,
  };
}

function evidence(
  role: InvestigationAddressRole,
  source: string,
  address: string,
  label: string,
  kind: EvidenceReference["kind"],
): EvidenceReference {
  return {
    schemaVersion: 1,
    id: evidenceId(role, source, address),
    kind,
    origin: "deterministic",
    sourceId: source,
    label,
    location: { address },
  };
}

function bestConfidence(values: FindingConfidence[]) {
  return (
    values.sort(
      (left, right) => confidenceRank[right] - confidenceRank[left],
    )[0] ?? "unknown"
  );
}

export function correlateAddressEvidence(
  inputs: AddressResolutionInput[],
): CorrelationResult {
  const resolutions: AddressResolution[] = [],
    references: EvidenceReference[] = [],
    findings: Finding[] = [],
    conflicts: InvestigationConflict[] = [],
    unknowns = new Set<string>();
  for (const input of inputs) {
    const normalized = normalizeArchitectureAddress(
      input.architecture,
      input.address,
      input.role,
    );
    const address = hex(normalized.address),
      normalizedAddress = hex(normalized.normalizedAddress),
      ids: string[] = [];
    if (input.elf) {
      const item = evidence(
        input.role,
        "elf",
        normalizedAddress,
        `${input.role.toUpperCase()} 的 ELF/DWARF 定位`,
        "artifact",
      );
      references.push(item);
      ids.push(item.id);
    }
    if (input.map) {
      const item = evidence(
        input.role,
        "map",
        normalizedAddress,
        `${input.role.toUpperCase()} 的 MAP 定位`,
        "artifact",
      );
      references.push(item);
      ids.push(item.id);
    }
    if (input.svd?.match !== "unresolved") {
      const item = evidence(
        input.role,
        "svd",
        normalizedAddress,
        `${input.role.toUpperCase()} 的 CMSIS-SVD 匹配`,
        "register",
      );
      references.push(item);
      ids.push(item.id);
    }
    if (input.disassembly?.available) {
      const item = evidence(
        input.role,
        "disassembly",
        normalizedAddress,
        `${input.role.toUpperCase()} 的反汇编指令`,
        "artifact",
      );
      references.push(item);
      ids.push(item.id);
    }

    const elfName = input.elf?.symbol?.name,
      mapName = input.map?.symbol?.name;
    if (elfName && mapName && elfName !== mapName) {
      const id = `conflict-${input.role}-symbol-${normalizedAddress.toLowerCase().replace(/^0x/, "")}`;
      conflicts.push({
        id,
        category: "address-resolution",
        summary: `${input.role.toUpperCase()} 的 ELF 符号 ${elfName} 与 MAP 符号 ${mapName} 不一致`,
        evidenceIds: ids,
      });
    }
    const elfConfidence =
      input.elf?.confidence === "none" ? "unknown" : input.elf?.confidence;
    const mapConfidence =
      input.map?.confidence === "none" ? "unknown" : input.map?.confidence;
    const confidence = bestConfidence(
      [elfConfidence, mapConfidence, input.svd?.confidence].filter(
        Boolean,
      ) as FindingConfidence[],
    );
    const symbol = input.elf?.symbol
      ? {
          name: input.elf.symbol.name,
          startAddress: input.elf.symbol.normalizedAddress,
          offset: input.elf.symbol.offset,
          source: "elf" as const,
        }
      : input.map?.symbol
        ? {
            name: input.map.symbol.name,
            startAddress: hex(input.map.symbol.address),
            offset: hex(input.map.symbol.offset),
            source: "map" as const,
          }
        : undefined;
    const section = input.elf?.section
      ? {
          name: input.elf.section.name,
          offset: input.elf.section.offset,
          source: "elf" as const,
        }
      : input.map?.section
        ? {
            name: input.map.section.name,
            offset: hex(input.map.section.offset),
            source: "map" as const,
          }
        : undefined;
    const itemUnknowns: string[] = [];
    if (!normalized.adapterId)
      itemUnknowns.push(`未注册 ${input.architecture} 地址规范化适配器`);
    if (!symbol) itemUnknowns.push("未定位到函数或对象符号");
    if (!input.elf?.source) itemUnknowns.push("缺少匹配的 DWARF 源码行");
    if (!input.elf && !input.map)
      itemUnknowns.push("未提供 ELF 或 MAP 地址证据");
    const targetInstruction = input.disassembly?.instructions.find(
      (item) => item.isTarget,
    );
    if (input.disassembly && !targetInstruction)
      itemUnknowns.push(
        input.disassembly.warnings[0] || "未获得目标地址反汇编指令",
      );
    itemUnknowns.forEach((item) =>
      unknowns.add(`${input.role.toUpperCase()}：${item}`),
    );
    resolutions.push({
      address,
      normalizedAddress,
      role: input.role,
      architecture: input.architecture,
      normalization: normalized.normalization,
      ...(symbol ? { symbol } : {}),
      ...(section ? { section } : {}),
      ...(input.elf?.source
        ? {
            source: {
              file: input.elf.source.file,
              line: input.elf.source.line,
              ...(input.elf.source.column
                ? { column: input.elf.source.column }
                : {}),
            },
          }
        : {}),
      ...(input.svd?.peripheral
        ? {
            peripheral: {
              name: input.svd.peripheral.name,
              ...(input.svd.register
                ? {
                    register: input.svd.register.name,
                    offset: input.svd.register.offset,
                    access: input.svd.register.access,
                  }
                : {}),
            },
          }
        : {}),
      ...(targetInstruction
        ? {
            instruction: {
              address: targetInstruction.address,
              bytes: targetInstruction.bytes,
              mnemonic: targetInstruction.mnemonic,
              operands: targetInstruction.operands,
            },
          }
        : {}),
      confidence,
      evidenceIds: ids,
      unknowns: itemUnknowns,
    });
    if (symbol || input.svd?.peripheral)
      findings.push({
        schemaVersion: 1,
        id: `finding-${input.role}-location-${normalizedAddress.toLowerCase().replace(/^0x/, "")}`,
        category: "fault-location",
        severity: "info",
        conclusionType: "derived",
        confidence,
        summary: `${input.role.toUpperCase()} ${address}${symbol ? ` 位于 ${symbol.name}` : ""}${input.svd?.peripheral ? `，地址匹配 ${input.svd.peripheral.name}${input.svd.register ? `.${input.svd.register.name}` : ""}` : ""}`,
        evidenceIds: ids,
        unknowns: itemUnknowns,
        verificationSteps: [
          "核对 ELF、MAP 与设备实际烧录固件是否来自同一次构建",
          "结合现场寄存器和复测确认根因",
        ],
      });
  }
  return {
    resolutions,
    evidence: references,
    findings,
    conflicts,
    unknowns: [...unknowns],
  };
}
