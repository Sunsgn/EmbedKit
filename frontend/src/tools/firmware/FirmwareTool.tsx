import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, FileUp, Plus, Trash2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import ToolResultRow from "../../features/toolbox/ToolResultRow";
import { readLocalFileBytes, revokeLocalPath } from "../../services/localFiles";
import { parseBuildArtifactRouteState, routeStateContext, saveBuildAnalysisRecord, type BuildAnalysisContext } from "../../services/buildAnalysisRecords";
import BuildAnalysisAssociation from "../../features/project/BuildAnalysisAssociation";
import { crc32 } from "../../utils/embeddedTools";
import { compareFirmware, mergeFirmware, type OverlapPolicy } from "./firmware";

interface SegmentRow {
  id: number;
  name: string;
  address: string;
  bytes: Uint8Array | null;
}
const parseAddress = (value: string) =>
  Number.parseInt(value.trim().replace(/^0x/i, ""), 16);
const crc = (value: number) =>
  `0x${value.toString(16).padStart(8, "0").toUpperCase()}`;
const MAX_BIN_BYTES = 32 * 1024 * 1024;
function download(bytes: Uint8Array) {
  const url = URL.createObjectURL(
      new Blob([Uint8Array.from(bytes)], { type: "application/octet-stream" }),
    ),
    link = document.createElement("a");
  link.href = url;
  link.download = "merged.bin";
  link.click();
  URL.revokeObjectURL(url);
}

export default function FirmwareTool() {
  const location = useLocation(), navigate = useNavigate(), consumedIncoming = useRef(false);
  const [segments, setSegments] = useState<SegmentRow[]>([
    { id: 1, name: "boot.bin", address: "08000000", bytes: null },
    { id: 2, name: "app.bin", address: "08010000", bytes: null },
  ]);
  const [nextId, setNextId] = useState(3),
    [policy, setPolicy] = useState<OverlapPolicy>("reject"),
    [fill, setFill] = useState("FF"),
    [leftId, setLeftId] = useState(1),
    [rightId, setRightId] = useState(2);
  const [loadError, setLoadError] = useState(''), [progress, setProgress] = useState<number | null>(null), [importedBuild, setImportedBuild] = useState(false);
  const [associationContext, setAssociationContext] = useState<BuildAnalysisContext | null>(null), [associationRevision, setAssociationRevision] = useState(0);
  const loaded = useMemo(
    () =>
      segments.filter(
        (item): item is SegmentRow & { bytes: Uint8Array } =>
          item.bytes !== null,
      ),
    [segments],
  );
  const merge = useMemo(() => {
    if (!loaded.length) return { value: null, error: "" };
    try {
      return {
        value: mergeFirmware(
          loaded.map((item) => ({
            name: item.name,
            address: parseAddress(item.address),
            bytes: item.bytes,
          })),
          policy,
          Number.parseInt(fill, 16),
        ),
        error: "",
      };
    } catch (error) {
      return {
        value: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }, [fill, loaded, policy]);
  const comparison = useMemo(() => {
    const left = loaded.find((item) => item.id === leftId),
      right = loaded.find((item) => item.id === rightId);
    if (!left || !right || left.id === right.id)
      return { value: null, error: '' };
    try {
      return {
        value: compareFirmware(
          left.bytes,
          parseAddress(left.address),
          right.bytes,
          parseAddress(right.address),
        ),
        error: '',
      };
    } catch (error) {
      return {
        value: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }, [leftId, loaded, rightId]);
  const update = (id: number, change: Partial<SegmentRow>) =>
    setSegments((current) =>
      current.map((item) => (item.id === id ? { ...item, ...change } : item)),
    );
  const consumeSelection = useCallback(async (selectionId: string, name: string, context: BuildAnalysisContext | null = null) => {
    setAssociationContext(context);
    setLoadError(''); setProgress(0);
    try { const result = await readLocalFileBytes(selectionId, MAX_BIN_BYTES, setProgress); setSegments(current => current.map((item, index) => index === 0 ? { ...item, name: name || result.metadata.name, bytes: result.bytes } : item)); setImportedBuild(true); setProgress(100); if (context) { saveBuildAnalysisRecord(context, 'bin', { summary: { bytes: result.bytes.length, crc32: crc(crc32(result.bytes)), baseAddressKnown: false } }); setAssociationRevision(value => value + 1); } }
    catch (reason) { const message = reason instanceof Error ? reason.message : String(reason); setLoadError(message); setProgress(null); if (context) { saveBuildAnalysisRecord(context, 'bin', { error: message }); setAssociationRevision(value => value + 1); } }
    finally { await revokeLocalPath(selectionId).catch(() => undefined); }
  }, []);
  useEffect(() => {
    const incoming = parseBuildArtifactRouteState(location.state);
    if (consumedIncoming.current || !incoming) return;
    consumedIncoming.current = true; void consumeSelection(incoming.selectionId, incoming.fileName || 'firmware.bin', routeStateContext(incoming));
    void navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [consumeSelection, location.pathname, location.search, location.state, navigate]);
  const choose = async (id: number, file?: File) => {
    if (!file) return; setLoadError('');
    if (file.size > MAX_BIN_BYTES) { setLoadError('BIN 文件超过 32 MiB 上限'); return; }
    try { update(id, { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }); }
    catch (reason) { setLoadError(reason instanceof Error ? reason.message : String(reason)); }
  };
  const add = () => {
    setSegments((current) => [
      ...current,
      {
        id: nextId,
        name: `segment-${nextId}.bin`,
        address: "08000000",
        bytes: null,
      },
    ]);
    setNextId((value) => value + 1);
  };
  const remove = (id: number) =>
    setSegments((current) => current.filter((item) => item.id !== id));
  return (
    <>
      <BuildAnalysisAssociation context={associationContext} revision={associationRevision} />
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-gray-500">
          可添加任意数量 BIN 分段；所有数据仅在浏览器内处理。
        </p>
        <button
          onClick={add}
          className="flex items-center gap-1 rounded border border-[#30363d] px-2 py-1 text-xs text-gray-300"
        >
          <Plus size={13} />
          添加分段
        </button>
      </div>
      {importedBuild && <p className="mb-3 rounded border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs text-blue-300">已导入构建 BIN；BIN 不包含加载地址，请确认首个分段的基地址。</p>}
      {progress !== null && progress < 100 && <p className="mb-3 text-xs text-blue-300">正在读取构建 BIN · {progress}%</p>}
      {loadError && <p className="mb-3 rounded border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-300">{loadError}</p>}
      <div className="mb-3 space-y-2">
        {segments.map((item) => (
          <div
            key={item.id}
            className="grid items-end gap-2 rounded border border-[#30363d] p-3 sm:grid-cols-[1fr_150px_auto]"
          >
            <label className="text-[11px] text-gray-500">
              固件文件
              <label className="field mt-1 flex cursor-pointer items-center gap-2 text-xs">
                <FileUp size={13} />
                {item.bytes
                  ? `${item.name}（${item.bytes.length} B）`
                  : "选择 BIN"}
                <input
                  type="file"
                  accept=".bin,application/octet-stream"
                  className="hidden"
                  onChange={(event) => void choose(item.id, event.target.files?.[0])}
                />
              </label>
            </label>
            <label className="text-[11px] text-gray-500">
              基地址 HEX
              <input
                value={item.address}
                onChange={(event) =>
                  update(item.id, { address: event.target.value })
                }
                className="field mt-1 font-mono"
              />
            </label>
            <button
              onClick={() => remove(item.id)}
              title="删除分段"
              className="mb-2 text-gray-600 hover:text-red-400"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <label className="text-[11px] text-gray-500">
          重叠策略
          <select
            value={policy}
            onChange={(event) => setPolicy(event.target.value as OverlapPolicy)}
            className="field mt-1"
          >
            <option value="reject">不同数据冲突时拒绝</option>
            <option value="keep-first">保留先加入分段</option>
            <option value="keep-last">使用后加入分段</option>
          </select>
        </label>
        <label className="text-[11px] text-gray-500">
          空洞填充值 HEX
          <input
            value={fill}
            onChange={(event) => setFill(event.target.value)}
            className="field mt-1 font-mono"
          />
        </label>
      </div>
      {merge.error && (
        <p className="mb-3 text-xs text-red-400">{merge.error}</p>
      )}
      {merge.value && (
        <div className="mb-4 space-y-2">
          <ToolResultRow
            label="合并范围"
            value={`0x${merge.value.baseAddress.toString(16).toUpperCase()}–0x${merge.value.endAddress.toString(16).toUpperCase()}`}
          />
          <ToolResultRow
            label="大小 / CRC32"
            value={`${merge.value.bytes.length} B / ${crc(merge.value.crc32)}`}
          />
          <ToolResultRow
            label="重叠字节"
            value={String(merge.value.overlaps.length)}
          />
          <button
            onClick={() => download(merge.value!.bytes)}
            className="flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-xs text-white"
          >
            <Download size={13} />
            导出合并 BIN
          </button>
        </div>
      )}
      <div className="border-t border-[#30363d] pt-3">
        <p className="mb-2 text-xs text-gray-400">
          选择任意两个已导入分段进行地址感知比较
        </p>
        <div className="mb-3 grid grid-cols-2 gap-2">
          <select
            value={leftId}
            onChange={(event) => setLeftId(Number(event.target.value))}
            className="field"
          >
            {loaded.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            value={rightId}
            onChange={(event) => setRightId(Number(event.target.value))}
            className="field"
          >
            {loaded.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        {comparison.error && (
          <p className="mb-3 text-xs text-red-400">{comparison.error}</p>
        )}
        {comparison.value && (
          <div className="space-y-2">
            <ToolResultRow
              label="差异字节"
              value={String(comparison.value.changedBytes)}
            />
            <ToolResultRow
              label="两侧 CRC32"
              value={`${crc(comparison.value.leftCrc32)} / ${crc(comparison.value.rightCrc32)}`}
            />
            {comparison.value.differences.slice(0, 50).map((item) => (
              <ToolResultRow
                key={item.startAddress}
                label="差异区间"
                value={`0x${item.startAddress.toString(16).toUpperCase()}–0x${item.endAddress.toString(16).toUpperCase()}（${item.changedBytes} B）`}
              />
            ))}
            {comparison.value.differences.length > 50 && (
              <p className="text-xs text-yellow-300">
                仅显示前 50 个差异区间，共{' '}
                {comparison.value.differences.length} 个。
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
