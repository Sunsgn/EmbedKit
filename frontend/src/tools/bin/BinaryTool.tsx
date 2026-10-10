import { useState } from 'react';
import { FileUp } from 'lucide-react';
import { formatHex } from '../../utils/embeddedTools';
import { analyzeBinary } from './bin';

const formatSize = (value: number) => value >= 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(2)} MiB` : value >= 1024 ? `${(value / 1024).toFixed(2)} KiB` : `${value} B`;
function Value({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-[#0d1117] px-3 py-2"><span className="block text-[10px] text-gray-600">{label}</span><code className="mt-1 block break-all text-xs text-gray-200">{value}</code></div>; }

export default function BinaryTool() {
  const [bytes, setBytes] = useState<Uint8Array | null>(null), [name, setName] = useState('');
  const result = bytes ? analyzeBinary(bytes) : null;
  return <><label className="mb-4 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#30363d] bg-[#0d1117] text-sm text-gray-500 hover:border-blue-500/40"><FileUp size={22} className="mb-2" />{name || '选择 BIN 文件，本地读取且不上传'}<input type="file" accept=".bin,application/octet-stream" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void file.arrayBuffer().then(buffer => { setName(file.name); setBytes(new Uint8Array(buffer)); }); }} /></label>{result ? <div className="grid gap-2 sm:grid-cols-2"><Value label="文件大小" value={formatSize(result.size)} /><Value label="CRC32" value={`0x${result.crc32.toString(16).padStart(8, '0').toUpperCase()}`} /><Value label="00 字节" value={`${result.zeroBytes} (${(result.zeroBytes / Math.max(1, result.size) * 100).toFixed(2)}%)`} /><Value label="FF 字节" value={`${result.erasedBytes} (${(result.erasedBytes / Math.max(1, result.size) * 100).toFixed(2)}%)`} /><Value label="头部 32 字节" value={formatHex(result.head) || '空'} /><Value label="尾部 16 字节" value={formatHex(result.tail) || '空'} /></div> : <p className="text-xs text-gray-600">导入后显示大小、CRC32、空白比例和头尾 HEX 预览。</p>}</>;
}
