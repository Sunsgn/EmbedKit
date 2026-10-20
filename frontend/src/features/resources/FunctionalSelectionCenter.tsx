import { useState } from 'react';
import { Cpu, Radio } from 'lucide-react';
import McuSelectionPanel from './McuSelectionPanel';
import PartSelectionPanel from './PartSelectionPanel';

export default function FunctionalSelectionCenter() {
  const [category, setCategory] = useState<'communication' | 'mcu'>('communication');
  return <div className="mb-5"><nav aria-label="选型类别" className="mb-3 grid gap-2 sm:grid-cols-2">{[
    { id: 'communication' as const, name: '通信收发器', detail: 'CAN、CAN FD、RS-485、RS-422', icon: Radio },
    { id: 'mcu' as const, name: 'MCU / 微控制器', detail: 'Flash、RAM、主频与外设能力', icon: Cpu },
  ].map(item => <button key={item.id} onClick={() => setCategory(item.id)} className={`flex items-center gap-3 rounded-xl border p-3 text-left ${category === item.id ? 'border-blue-500/50 bg-blue-500/10' : 'border-[#30363d] bg-[#161b22] hover:border-[#484f58]'}`}><item.icon size={18} className={category === item.id ? 'text-blue-400' : 'text-gray-500'} /><span><b className="block text-sm text-gray-200">{item.name}</b><small className="text-[10px] text-gray-600">{item.detail}</small></span></button>)}</nav>{category === 'communication' ? <PartSelectionPanel /> : <McuSelectionPanel />}</div>;
}
