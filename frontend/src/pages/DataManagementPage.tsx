import { useState } from 'react';
import { AlertTriangle, CheckCircle2, DatabaseBackup, Download, FileUp, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { applyWorkspaceBackup, createWorkspaceBackup, exportProductData, parseWorkspaceBackup, previewWorkspaceBackup, WORKSPACE_BACKUP_MAX_BYTES, type WorkspaceBackup, type WorkspaceBackupPreview } from '../services/workspaceBackup';
import { clearStillBrokenSettings, inspectStorageHealth, type StorageHealthReason } from '../services/storageHealth';

const downloadJson = (name: string, value: unknown) => {
  const content = JSON.stringify(value, null, 2);
  if (new TextEncoder().encode(content).byteLength > WORKSPACE_BACKUP_MAX_BYTES) throw new Error('工作区备份超过 16 MiB，请先删除不需要的历史测试记录');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
};

export default function DataManagementPage() {
  const [backup, setBackup] = useState<WorkspaceBackup | null>(null), [preview, setPreview] = useState<WorkspaceBackupPreview | null>(null), [message, setMessage] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [storageHealth, setStorageHealth] = useState(() => inspectStorageHealth());
  const exportData = async () => {
    setBusy(true); setError(''); setMessage('');
    try { const data = await createWorkspaceBackup(); downloadJson(`embedkit-workspace-${new Date().toISOString().slice(0, 10)}.json`, data); setMessage('备份已生成；请妥善保存 JSON 文件。'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };
  const chooseFile = async (file?: File) => {
    setBackup(null); setPreview(null); setError(''); setMessage('');
    if (!file) return;
    if (file.size > WORKSPACE_BACKUP_MAX_BYTES) { setError('备份文件超过 16 MiB 上限'); return; }
    setBusy(true);
    try { const parsed = parseWorkspaceBackup(await file.text()), current = await exportProductData(); setBackup(parsed); setPreview(previewWorkspaceBackup(parsed, current)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };
  const importData = async () => {
    if (!backup) return;
    setBusy(true); setError(''); setMessage('');
    try { await applyWorkspaceBackup(backup); setStorageHealth(inspectStorageHealth()); setMessage('导入完成。已打开的页面保持原状态，重新进入对应模块即可读取恢复数据。'); setBackup(null); setPreview(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };
  return <div className="h-full overflow-y-auto p-5 scrollbar-thin lg:p-8"><div className="mx-auto max-w-5xl space-y-5">
    <header><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400"><DatabaseBackup size={20} /></span><div><h1 className="text-lg font-semibold text-gray-100">工作区备份与恢复</h1><p className="text-xs text-gray-500">迁移设备、测试、学习进度和安全配置，不携带源码、固件与密钥</p></div></div></header>
    <section className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-5"><Download className="mb-3 text-blue-400" size={20} /><h2 className="font-semibold">导出工作区</h2><p className="mt-2 text-xs leading-5 text-gray-500">生成版本化 JSON。包含工程档案、最多 5000 条测试摘要、测试套件、工具偏好、通信快捷项、学习进度和分析摘要。</p><button onClick={() => void exportData()} disabled={busy} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-xs text-white disabled:opacity-40">{busy ? '处理中…' : '下载备份'}</button></div>
      <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-5"><FileUp className="mb-3 text-purple-400" size={20} /><h2 className="font-semibold">预览并合并</h2><p className="mt-2 text-xs leading-5 text-gray-500">先校验格式、版本、数量和 16 MiB 上限。同 ID 数据仅在确认后合并，不会清空其他本地数据；失败时回滚本次配置写入。</p><label className="mt-4 inline-flex cursor-pointer rounded-lg border border-purple-500/30 px-4 py-2 text-xs text-purple-300">选择备份文件<input aria-label="选择备份文件" type="file" accept="application/json,.json" className="hidden" onChange={event => { void chooseFile(event.target.files?.[0]); event.target.value = ''; }} /></label></div>
    </section>
    {preview && <section className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-5"><div className="flex items-center gap-2 text-yellow-300"><AlertTriangle size={16} /><b>导入预览</b></div><div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4"><div className="rounded bg-[#0d1117] p-3">工程档案 <b>{preview.projects}</b><small className="block text-gray-600">同 ID {preview.projectConflicts}</small></div><div className="rounded bg-[#0d1117] p-3">测试记录 <b>{preview.runs}</b><small className="block text-gray-600">同 ID {preview.runConflicts}</small></div><div className="rounded bg-[#0d1117] p-3">修订/产物/固件/会话 <b>{preview.lifecycleRecords}</b><small className="block text-gray-600">同 ID {preview.lifecycleConflicts}</small></div><div className="rounded bg-[#0d1117] p-3">本地配置 <b>{preview.localSettings}</b><small className="block text-gray-600">已有键 {preview.localConflicts}</small></div></div><p className="mt-3 text-[10px] text-gray-500">同 ID 项将采用备份内容，其他现有数据保留。该操作不会导入源码、固件内容或活动会话。</p><button onClick={() => void importData()} disabled={busy} className="mt-3 rounded bg-yellow-600 px-4 py-2 text-xs text-white disabled:opacity-40">确认合并</button></section>}
    <StorageHealthPanel report={storageHealth} onRefresh={() => setStorageHealth(inspectStorageHealth())} onDownload={() => downloadJson(`embedkit-storage-diagnostic-${new Date().toISOString().slice(0, 10)}.json`, storageHealth)} onClear={() => { const result = clearStillBrokenSettings(storageHealth); setStorageHealth(result.report); setMessage(result.removed ? `已清理 ${result.removed} 项仍然损坏的本地偏好；对应功能已恢复默认设置。` : '未清理任何配置；此前异常项已经恢复或当前不可访问。'); }} />
    <section className="rounded-xl border border-green-500/20 bg-green-500/5 p-5"><div className="flex items-center gap-2 text-green-300"><ShieldCheck size={16} /><b>默认排除</b></div><div className="mt-3 grid gap-2 text-xs text-gray-500 sm:grid-cols-2"><span>工程源码与编辑器工作区</span><span>固件、MAP、ELF 和运行轨迹原文</span><span>绝对构建路径与临时任务</span><span>AI 密钥、密码和授权令牌</span><span>当前串口与网络会话</span><span>测试原始日志与响应内容</span></div></section>
    {error && <p role="alert" className="rounded border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-300">{error}</p>}
    {message && <p className="flex items-center gap-2 rounded border border-green-500/30 bg-green-500/5 p-3 text-xs text-green-300"><CheckCircle2 size={14} />{message}</p>}
  </div></div>;
}

const reasonLabel: Record<StorageHealthReason, string> = { 'invalid-json': '内容损坏', 'unexpected-shape': '结构不兼容', 'too-large': '超过 4 MiB 上限', unreadable: '浏览器拒绝读取' };

function StorageHealthPanel({ report, onRefresh, onDownload, onClear }: { report: ReturnType<typeof inspectStorageHealth>; onRefresh: () => void; onDownload: () => void; onClear: () => void }) {
  const healthy = report.issues.length === 0;
  return <section className={`rounded-xl border p-5 ${healthy ? 'border-green-500/20 bg-green-500/5' : 'border-yellow-500/20 bg-yellow-500/5'}`}>
    <div className={`flex items-center gap-2 ${healthy ? 'text-green-300' : 'text-yellow-300'}`}>{healthy ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}<b>本地配置健康检查</b><span className="text-[10px] text-gray-600">已检查 {report.checked} 类</span></div>
    {healthy ? <p className="mt-2 text-xs text-gray-500">未发现损坏或超限的可迁移偏好。工程档案和测试记录由独立数据库事务保护。</p> : <><p className="mt-2 text-xs text-gray-500">发现 {report.issues.length} 项异常偏好。运行模块会忽略这些条目并使用默认值；清理只删除下列仍然损坏的偏好，不触碰项目、测试记录、源码或固件。</p><div className="mt-3 space-y-2">{report.issues.map(issue => <div key={issue.key} className="flex items-center justify-between rounded bg-[#0d1117] px-3 py-2 text-xs"><span>{issue.label}</span><span className="text-yellow-400">{reasonLabel[issue.reason]}{issue.bytes === null ? '' : ` · ${issue.bytes} B`}</span></div>)}</div></>}
    <div className="mt-4 flex flex-wrap gap-2"><button onClick={onRefresh} className="flex items-center gap-1 rounded border border-[#30363d] px-3 py-2 text-xs text-gray-300"><RefreshCw size={12} />重新检查</button><button onClick={onDownload} className="flex items-center gap-1 rounded border border-[#30363d] px-3 py-2 text-xs text-gray-300"><Download size={12} />下载脱敏诊断</button>{!healthy && <button onClick={onClear} className="flex items-center gap-1 rounded border border-red-500/30 px-3 py-2 text-xs text-red-300"><Trash2 size={12} />清理 {report.issues.length} 项异常偏好</button>}</div>
  </section>;
}
