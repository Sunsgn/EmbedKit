import { useMemo, useState } from 'react';
import { Download, FileUp, TableProperties } from 'lucide-react';
import ToolResultRow from '../../features/toolbox/ToolResultRow';
import { buildModbusRequest, parseModbusResponse, type ModbusOperation, type ModbusTransport } from './modbus';
import { decodeRegisterMap, parseRegisterMap, REGISTER_MAP_TEMPLATE } from './registerMap';

const operations: Array<[ModbusOperation, string]> = [['read-coils', '01 读线圈'], ['read-discrete', '02 读离散输入'], ['read-holding', '03 读保持寄存器'], ['read-input', '04 读输入寄存器'], ['write-coil', '05 写单线圈'], ['write-register', '06 写单寄存器']];
const areaNames = { coil: '线圈', discrete: '离散输入', holding: '保持寄存器', input: '输入寄存器' };
const csvCell = (value: unknown) => `"${String(value).replace(/"/g, '""')}"`;
function downloadDecoded(rows: ReturnType<typeof decodeRegisterMap>['values']) {
  const content = ['名称,区域,协议地址,类型,原始值,工程值,单位', ...rows.map(row => [row.name, areaNames[row.area], row.address, row.type, row.raw, row.value, row.unit].map(csvCell).join(','))].join('\n');
  const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' })); link.download = `modbus-decoded-${Date.now()}.csv`; link.click(); URL.revokeObjectURL(link.href);
}

export default function ModbusTool() {
  const [transport, setTransport] = useState<ModbusTransport>('rtu'), [operation, setOperation] = useState<ModbusOperation>('read-holding');
  const [unitId, setUnitId] = useState('1'), [address, setAddress] = useState('0'), [value, setValue] = useState('2'), [transactionId, setTransactionId] = useState('1');
  const [response, setResponse] = useState(''), [registerSource, setRegisterSource] = useState(''), [fileError, setFileError] = useState('');
  const request = useMemo(() => { try { return { value: buildModbusRequest({ transport, operation, unitId: Number(unitId), address: Number(address), value: Number(value), transactionId: Number(transactionId) }), error: '' }; } catch (error) { return { value: null, error: error instanceof Error ? error.message : String(error) }; } }, [address, operation, transactionId, transport, unitId, value]);
  const parsed = useMemo(() => { if (!response.trim()) return { value: null, error: '' }; try { return { value: parseModbusResponse(response, transport), error: '' }; } catch (error) { return { value: null, error: error instanceof Error ? error.message : String(error) }; } }, [response, transport]);
  const registerMap = useMemo(() => { if (!registerSource.trim()) return { value: null, error: '' }; try { return { value: parseRegisterMap(registerSource), error: '' }; } catch (error) { return { value: null, error: error instanceof Error ? error.message : String(error) }; } }, [registerSource]);
  const decoded = useMemo(() => parsed.value && registerMap.value ? decodeRegisterMap(parsed.value, Number(address), registerMap.value.definitions) : null, [address, parsed.value, registerMap.value]);
  const isRead = operation.startsWith('read-');
  const chooseProtocol = async (file?: File) => {
    setFileError(''); if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setFileError('协议表超过 2 MiB 上限'); return; }
    try { setRegisterSource(await file.text()); } catch { setFileError('无法读取协议表文件'); }
  };

  return <div className="space-y-5">
    <section>
      <div className="mb-3 flex gap-2">{(['rtu', 'tcp'] as const).map(item => <button key={item} onClick={() => setTransport(item)} className={`rounded px-3 py-1.5 text-xs ${transport === item ? 'bg-blue-500/20 text-blue-300' : 'bg-[#0d1117] text-gray-500'}`}>Modbus {item.toUpperCase()}</button>)}</div>
      <div className="mb-3 grid gap-2 sm:grid-cols-2"><label className="text-[11px] text-gray-500">功能<select value={operation} onChange={event => setOperation(event.target.value as ModbusOperation)} className="field mt-1">{operations.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><label className="text-[11px] text-gray-500">{transport === 'rtu' ? '从站地址' : '单元标识'}<input type="number" value={unitId} onChange={event => setUnitId(event.target.value)} className="field mt-1" /></label><label className="text-[11px] text-gray-500">协议起始地址<input type="number" value={address} onChange={event => setAddress(event.target.value)} className="field mt-1" /><small className="mt-1 block text-[9px] text-gray-700">帧内地址从 0 开始；协议表可直接使用 40001 等文档地址</small></label><label className="text-[11px] text-gray-500">{isRead ? '读取数量' : operation === 'write-coil' ? '线圈值（0/1）' : '寄存器值'}<input type="number" value={value} onChange={event => setValue(event.target.value)} className="field mt-1" /></label>{transport === 'tcp' && <label className="text-[11px] text-gray-500">事务标识<input type="number" value={transactionId} onChange={event => setTransactionId(event.target.value)} className="field mt-1" /></label>}</div>
      {request.error && <p className="mb-3 text-xs text-red-400">{request.error}</p>}<ToolResultRow label="请求帧" value={request.value?.hex ?? ''} />
      <label className="my-3 block text-[11px] text-gray-500">设备响应帧（HEX）<textarea value={response} onChange={event => setResponse(event.target.value)} rows={3} placeholder="粘贴串口、TCP 日志或设备返回帧进行校验和解析" className="field mt-1 resize-y font-mono" /></label>
      {parsed.error && <p className="mb-3 text-xs text-red-400">{parsed.error}</p>}{parsed.value && <div className="space-y-2"><ToolResultRow label="单元 / 功能" value={`${parsed.value.unitId} / 0x${parsed.value.functionCode.toString(16).padStart(2, '0').toUpperCase()}`} /><ToolResultRow label="基础结果" value={parsed.value.exception ?? (parsed.value.address === undefined ? `${parsed.value.data.length} 字节数据` : `地址 ${parsed.value.address}，值 ${parsed.value.value}`)} /></div>}
    </section>
    <section className="rounded-xl border border-[#30363d] bg-[#111820] p-4">
      <div className="flex flex-wrap items-center gap-2"><TableProperties size={16} className="text-purple-400" /><div className="min-w-0 flex-1"><h2 className="text-sm font-semibold text-gray-200">按厂家协议表解析</h2><p className="text-[10px] text-gray-600">从 Excel 复制表格，或导入 CSV / TSV；协议内容只在当前页面处理，不自动保存。</p></div><button onClick={() => setRegisterSource(REGISTER_MAP_TEMPLATE)} className="rounded border border-[#30363d] px-3 py-1.5 text-[10px] text-gray-400">填入模板</button><label className="flex cursor-pointer items-center gap-1 rounded border border-purple-500/30 px-3 py-1.5 text-[10px] text-purple-300"><FileUp size={11} />导入协议表<input aria-label="导入 Modbus 协议表" type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" className="hidden" onChange={event => { void chooseProtocol(event.target.files?.[0]); event.target.value = ''; }} /></label></div>
      <textarea value={registerSource} onChange={event => { setRegisterSource(event.target.value); setFileError(''); }} rows={6} className="field mt-3 resize-y font-mono text-[11px]" placeholder={'至少包含：名称,地址\n可选列：区域,类型,长度,倍率,偏移,单位,字节序,字序'} />
      {(fileError || registerMap.error) && <p role="alert" className="mt-2 text-xs text-red-400">{fileError || registerMap.error}</p>}
      {registerMap.value && <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-gray-500"><span>已载入 <b className="text-gray-300">{registerMap.value.definitions.length}</b> 项</span><span>支持 bool / u16 / i16 / u32 / i32 / f32 / ascii</span><span>支持 0x 地址、40001/30001 编号及高低字交换</span></div>}
      {registerMap.value?.warnings.map(message => <p key={message} className="mt-1 text-[10px] text-yellow-400">{message}</p>)}
      {decoded && <div className="mt-4"><div className="mb-2 flex items-center justify-between"><span className="text-xs text-gray-400">本帧解析 <b className="text-white">{decoded.values.length}</b> 项{decoded.skipped > 0 && <small className="ml-2 text-gray-600">范围外或区域不匹配 {decoded.skipped} 项</small>}</span><button onClick={() => downloadDecoded(decoded.values)} disabled={!decoded.values.length} className="flex items-center gap-1 rounded border border-[#30363d] px-2 py-1 text-[10px] text-gray-400 disabled:opacity-30"><Download size={11} />导出 CSV</button></div><div className="max-h-72 overflow-auto rounded border border-[#30363d] scrollbar-thin"><table className="w-full min-w-[640px] text-left text-[11px]"><thead className="sticky top-0 bg-[#0d1117] text-gray-600"><tr><th className="px-3 py-2">名称</th><th>区域 / 地址</th><th>类型</th><th>原始值</th><th>工程值</th><th>单位</th></tr></thead><tbody>{decoded.values.map(row => <tr key={`${row.sourceLine}-${row.address}`} className="border-t border-[#30363d]/60"><td className="px-3 py-2 text-gray-300">{row.name}</td><td>{areaNames[row.area]} · {row.address}</td><td>{row.type}</td><td className="font-mono text-gray-500">{row.raw}</td><td className="font-mono text-blue-300">{row.value}</td><td>{row.unit || '—'}</td></tr>)}</tbody></table>{!decoded.values.length && <p className="p-4 text-center text-xs text-gray-600">响应功能码或地址范围与协议表不匹配，请检查区域和协议起始地址。</p>}</div></div>}
    </section>
  </div>;
}
