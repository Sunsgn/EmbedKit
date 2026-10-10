import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileUp } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { readLocalFileBytes, revokeLocalPath } from '../../services/localFiles';
import { parseIntelHex } from './ihex';

const MAX_HEX_BYTES = 16 * 1024 * 1024;
const formatSize = (value: number) => value >= 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(2)} MiB` : value >= 1024 ? `${(value / 1024).toFixed(2)} KiB` : `${value} B`;
function Value({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-[#0d1117] px-3 py-2"><span className="block text-[10px] text-gray-600">{label}</span><code className="mt-1 block break-all text-xs text-gray-200">{value}</code></div>; }
function downloadBytes(bytes: Uint8Array, name: string) { const url = URL.createObjectURL(new Blob([Uint8Array.from(bytes)], { type: 'application/octet-stream' })), link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url); }

export default function IntelHexTool() {
  const location = useLocation(), navigate = useNavigate(), consumedIncoming = useRef(false);
  const [source, setSource] = useState(':020000040800F2\n:0400100001020304E2\n:00000001FF');
  const [fileName, setFileName] = useState(''), [loadError, setLoadError] = useState(''), [progress, setProgress] = useState<number | null>(null);
  const result = useMemo(() => { try { return { value: parseIntelHex(source), error: '' }; } catch (reason) { return { value: null, error: reason instanceof Error ? reason.message : String(reason) }; } }, [source]);
  const consumeSelection = useCallback(async (selectionId: string, name: string) => {
    setLoadError(''); setProgress(0);
    try { const loaded = await readLocalFileBytes(selectionId, MAX_HEX_BYTES, setProgress); setSource(new TextDecoder('utf-8').decode(loaded.bytes)); setFileName(name || loaded.metadata.name); setProgress(100); }
    catch (reason) { setLoadError(reason instanceof Error ? reason.message : String(reason)); setProgress(null); }
    finally { await revokeLocalPath(selectionId).catch(() => undefined); }
  }, []);
  useEffect(() => {
    const incoming = location.state as { selectionId?: string; fileName?: string; source?: string } | null;
    if (consumedIncoming.current || !incoming?.selectionId || incoming.source !== 'build-artifact') return;
    consumedIncoming.current = true; void consumeSelection(incoming.selectionId, incoming.fileName || 'firmware.hex');
    void navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [consumeSelection, location.pathname, location.search, location.state, navigate]);
  const importFile = async (file?: File) => { if (!file) return; setLoadError(''); if (file.size > MAX_HEX_BYTES) { setLoadError('HEX 文件超过 16 MiB 上限'); return; } try { setSource(await file.text()); setFileName(file.name); } catch (reason) { setLoadError(reason instanceof Error ? reason.message : String(reason)); } };
  return <>{fileName && <p className="mb-3 rounded border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs text-blue-300">{fileName}</p>}{progress !== null && progress < 100 && <p className="mb-3 text-xs text-blue-300">正在读取构建 HEX · {progress}%</p>}{loadError && <p className="mb-3 rounded border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-300">{loadError}</p>}<label className="mb-3 block text-[11px] text-gray-500">Intel HEX 内容<textarea value={source} onChange={event => setSource(event.target.value)} rows={8} className="field mt-1 resize-y font-mono" /></label><label className="mb-3 inline-flex cursor-pointer items-center gap-2 rounded border border-[#30363d] px-3 py-2 text-xs text-gray-400"><FileUp size={13} />导入 HEX 文件<input type="file" accept=".hex,.ihx,text/plain" className="hidden" onChange={event => void importFile(event.target.files?.[0])} /></label>{result.error && <p className="mb-3 rounded border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-300">{result.error}</p>}{result.value && <><div className="grid gap-2 sm:grid-cols-2"><Value label="记录 / 数据记录" value={`${result.value.records} / ${result.value.dataRecords}`} /><Value label="有效数据" value={formatSize(result.value.dataBytes)} /><Value label="地址范围" value={result.value.dataBytes ? `0x${result.value.minAddress.toString(16).toUpperCase()}–0x${result.value.maxAddress.toString(16).toUpperCase()}` : '无数据'} /><Value label="EOF" value={result.value.eof ? '已发现' : '缺失'} /><Value label="BIN 大小" value={formatSize(result.value.binary.length)} /><Value label="启动地址" value={result.value.startAddress === undefined ? '未声明' : `0x${result.value.startAddress.toString(16).toUpperCase()}`} /></div><button onClick={() => downloadBytes(result.value!.binary, 'firmware.bin')} disabled={!result.value.binary.length} className="mt-3 flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-xs text-white disabled:opacity-40"><Download size={13} />导出 BIN（空洞填充 FF）</button></>}</>;
}
