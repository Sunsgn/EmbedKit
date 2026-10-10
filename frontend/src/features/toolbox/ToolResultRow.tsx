import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export default function ToolResultRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return <div className="flex items-center gap-3 rounded-lg bg-[#0d1117] px-3 py-2"><span className="w-24 shrink-0 text-[11px] text-gray-600">{label}</span><code className="min-w-0 flex-1 break-all text-xs text-gray-200">{value || '—'}</code><button onClick={() => { void navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1200); }} disabled={!value} className="text-gray-600 hover:text-blue-400 disabled:opacity-30" title="复制">{copied ? <Check size={13} /> : <Copy size={13} />}</button></div>;
}
