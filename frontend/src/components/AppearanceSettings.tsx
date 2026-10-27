import { useEffect } from 'react';
import { Check, Monitor, Moon, RotateCcw, Sun, X } from 'lucide-react';
import type { AccentColor, AppearanceSettings, ColorMode, DarkSurface } from '../services/appearance';
import { DEFAULT_APPEARANCE } from '../services/appearance';

const modes: { value: ColorMode; label: string }[] = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
];
const surfaces: { value: DarkSurface; label: string; color: string }[] = [
  { value: 'midnight', label: '深夜黑', color: '#0d1117' },
  { value: 'graphite', label: '石墨灰', color: '#17191d' },
  { value: 'navy', label: '海军蓝', color: '#0b1424' },
];
const accents: { value: AccentColor; label: string; color: string }[] = [
  { value: 'blue', label: '工程蓝', color: '#3b82f6' },
  { value: 'cyan', label: '青色', color: '#06b6d4' },
  { value: 'emerald', label: '翡翠绿', color: '#10b981' },
  { value: 'violet', label: '紫色', color: '#8b5cf6' },
  { value: 'orange', label: '橙色', color: '#f97316' },
];

interface Props {
  open: boolean;
  value: AppearanceSettings;
  saveFailed: boolean;
  onChange: (value: AppearanceSettings) => void;
  onClose: () => void;
}

export default function AppearanceSettings({ open, value, saveFailed, onChange, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open, onClose]);
  if (!open) return null;
  const update = (patch: Partial<AppearanceSettings>) => onChange({ ...value, ...patch });
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="appearance-title" className="theme-dialog w-full max-w-lg overflow-hidden rounded-2xl border border-[#30363d] bg-[#161b22] shadow-2xl shadow-black/50">
      <header className="flex items-center justify-between border-b border-[#30363d] px-5 py-4">
        <div><h2 id="appearance-title" className="font-semibold text-gray-100">外观与主题</h2><p className="mt-0.5 text-xs text-gray-500">即时预览并保存在当前浏览器中</p></div>
        <button type="button" onClick={onClose} aria-label="关闭外观设置" className="rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white"><X size={18} /></button>
      </header>
      <div className="space-y-6 p-5">
        <fieldset><legend className="mb-2 text-xs font-medium text-gray-300">显示模式</legend><div className="grid grid-cols-3 gap-2">{modes.map(({ value: option, label }) => <button type="button" key={option} onClick={() => update({ colorMode: option })} aria-pressed={value.colorMode === option} className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs ${value.colorMode === option ? 'border-blue-500 bg-blue-500/10 text-blue-300' : 'border-[#30363d] text-gray-400 hover:bg-white/5'}`}>{option === 'system' ? <Monitor size={14} /> : option === 'light' ? <Sun size={14} /> : <Moon size={14} />}{label}</button>)}</div></fieldset>
        <fieldset><legend className="mb-2 text-xs font-medium text-gray-300">深色背景</legend><div className="grid grid-cols-3 gap-2">{surfaces.map(({ value: option, label, color }) => <button type="button" key={option} onClick={() => update({ darkSurface: option })} aria-pressed={value.darkSurface === option} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${value.darkSurface === option ? 'border-blue-500 text-blue-300' : 'border-[#30363d] text-gray-400'}`}><i className="h-5 w-5 rounded border border-white/15" style={{ backgroundColor: color }} />{label}{value.darkSurface === option && <Check className="ml-auto" size={13} />}</button>)}</div></fieldset>
        <fieldset><legend className="mb-2 text-xs font-medium text-gray-300">强调色</legend><div className="flex flex-wrap gap-2">{accents.map(({ value: option, label, color }) => <button type="button" key={option} onClick={() => update({ accent: option })} aria-pressed={value.accent === option} className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${value.accent === option ? 'border-blue-500 text-gray-100' : 'border-[#30363d] text-gray-400'}`}><i className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />{label}</button>)}</div></fieldset>
        <label className="flex items-center justify-between rounded-xl border border-[#30363d] bg-[#0d1117]/60 px-4 py-3"><span><b className="block text-xs font-medium text-gray-300">减少动画</b><small className="text-[10px] text-gray-500">关闭非必要过渡，适合远程桌面或低性能设备</small></span><input type="checkbox" checked={value.reduceMotion} onChange={(event) => update({ reduceMotion: event.target.checked })} className="h-4 w-4 accent-blue-500" /></label>
        {saveFailed && <p role="alert" className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">当前主题已生效，但浏览器拒绝保存设置；请检查隐私模式或存储权限。</p>}
      </div>
      <footer className="flex items-center justify-between border-t border-[#30363d] px-5 py-3"><button type="button" onClick={() => onChange({ ...DEFAULT_APPEARANCE })} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-200"><RotateCcw size={13} />恢复默认</button><button type="button" onClick={onClose} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-500">完成</button></footer>
    </section>
  </div>;
}
