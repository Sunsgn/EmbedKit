import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileUp, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react';
import { selectLocalFile } from '../../services/localFiles';
import { installSerialDriver, scanSerialDrivers, type SerialDriverInstallResult, type SerialDriverScan } from '../../services/serialAgent';

function exportReport(scan: SerialDriverScan, installation: SerialDriverInstallResult | null) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([JSON.stringify({ schema: 'embedkit.serial-driver-report', version: 1, exportedAt: new Date().toISOString(), scan, installation }, null, 2)], { type: 'application/json;charset=utf-8' }));
  link.download = `embedkit-serial-driver-${Date.now()}.json`; link.click(); URL.revokeObjectURL(link.href);
}

export default function SerialDriverAssistant({ onPortsChanged }: { onPortsChanged: () => Promise<void> }) {
  const [scan, setScan] = useState<SerialDriverScan | null>(null), [installation, setInstallation] = useState<SerialDriverInstallResult | null>(null);
  const [loading, setLoading] = useState(false), [installing, setInstalling] = useState(false), [expanded, setExpanded] = useState(false), [error, setError] = useState('');
  const diagnose = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true); setError('');
    try { const result = await scanSerialDrivers(); setScan(result); if (result.devices.some(item => item.driverState !== 'ready')) setExpanded(true); }
    catch (reason) { if (!quiet) setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { if (!quiet) setLoading(false); }
  }, []);
  useEffect(() => {
    const initial = window.setTimeout(() => void diagnose(true), 0), interval = window.setInterval(() => void diagnose(true), 10_000);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); };
  }, [diagnose]);
  const problemDevices = useMemo(() => scan?.devices.filter(item => item.driverState !== 'ready') ?? [], [scan]);
  const installInf = async () => {
    setError('');
    try {
      const selected = await selectLocalFile('serial-driver-inf'); if (selected.cancelled || !selected.selectionId) return;
      if (!/\.inf$/i.test(selected.name || '')) throw new Error('请选择驱动包中解压出的 .inf 文件');
      if (!window.confirm(`确认使用 Windows pnputil 安装 ${selected.name}？安装驱动可能触发管理员权限要求。`)) return;
      setInstalling(true); const result = await installSerialDriver(selected.selectionId); setInstallation(result); setScan(result.after); await onPortsChanged();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setInstalling(false); }
  };
  const stateText = scan == null ? '等待检测' : !scan.supported ? '当前平台仅提供说明' : problemDevices.length ? `${problemDevices.length} 个设备需要处理` : `${scan.devices.length} 个设备驱动正常`;
  return <div className="mb-2 rounded border border-[#30363d] bg-[#0b1016] text-xs">
    <div className="flex flex-wrap items-center gap-2 px-3 py-2"><ShieldCheck size={14} className={problemDevices.length ? 'text-yellow-400' : 'text-green-400'} /><button onClick={() => setExpanded(value => !value)} className="font-medium text-gray-200">串口驱动助手</button><span className="text-[10px] text-gray-500">{stateText}</span><span className="flex-1" /><button onClick={() => void diagnose()} disabled={loading || installing} className="flex items-center gap-1 rounded border border-[#30363d] px-2 py-1 text-[10px] disabled:opacity-40"><RefreshCw size={10} className={loading ? 'animate-spin' : ''} />重新扫描</button>{scan && <button onClick={() => exportReport(scan, installation)} className="flex items-center gap-1 rounded border border-[#30363d] px-2 py-1 text-[10px]"><Download size={10} />导出证据</button>}</div>
    {expanded && <div className="max-h-56 overflow-y-auto border-t border-[#30363d] p-3 scrollbar-thin"><p className="text-[11px] leading-5 text-gray-500">自动读取 Windows PnP 硬件 ID 并匹配厂商官方来源。不会猜测未知设备，也不会静默安装；请从官方页面下载并解压后选择 INF。</p>
      {!scan?.supported && scan && <p className="mt-2 text-yellow-400">{scan.message}</p>}
      <div className="mt-2 space-y-2">{problemDevices.map(device => <div key={device.instanceId} className="rounded border border-yellow-500/20 bg-yellow-500/5 p-2"><div className="flex flex-wrap items-center gap-2"><TriangleAlert size={12} className="text-yellow-400" /><b>{device.friendlyName}</b><code className="text-[10px] text-gray-500">VID_{device.vendorId || '未知'} PID_{device.productId || '未知'}</code><span className="text-[10px] text-yellow-400">{device.driverState === 'missing' ? '驱动缺失' : `设备错误 ${device.problemCode}`}</span></div><p className="mt-1 break-all text-[10px] text-gray-600">证据：{device.evidence || device.instanceId}</p>{device.recommendation ? <div className="mt-2 flex flex-wrap items-center gap-2"><span className="text-[10px] text-gray-400">建议：{device.recommendation.name}</span><a href={device.recommendation.officialPage} target="_blank" rel="noreferrer" className="text-[10px] text-blue-400 underline">打开厂商官方下载页</a><span className="text-[9px] text-gray-600">来源核验 {device.recommendation.verifiedAt}</span></div> : <p className="mt-1 text-[10px] text-gray-500">未匹配受信任厂商，保留硬件 ID 供人工核对，不提供安装建议。</p>}</div>)}</div>
      {scan?.supported && <div className="mt-3 flex flex-wrap items-center gap-2"><button onClick={() => void installInf()} disabled={installing} className="flex items-center gap-1 rounded bg-blue-600 px-3 py-2 text-[11px] text-white disabled:opacity-40"><FileUp size={12} />{installing ? '正在安装并复扫…' : '选择已解压的 INF 并安装'}</button><span className="text-[10px] text-gray-600">需要管理员权限；失败时不会删除用户下载的驱动包。</span></div>}
      {installation && <p className="mt-2 text-green-400">已通过 {installation.evidence.installer} 安装 {installation.selectedFile}，并完成设备复扫。</p>}{error && <p className="mt-2 text-red-300">{error}</p>}
    </div>}
  </div>;
}
