import { useState } from 'react';
import { Search, Cpu, Filter, ExternalLink } from 'lucide-react';
import { chips, manufacturers } from '../data/chips';
import type { Chip } from '../types';

export default function ChipLibPage() {
  const [search, setSearch] = useState('');
  const [selectedMfg, setSelectedMfg] = useState('');

  const filtered = chips.filter((c: Chip) => {
    const matchSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.cores.toLowerCase().includes(search.toLowerCase());
    const matchMfg = !selectedMfg || c.manufacturer === selectedMfg;
    return matchSearch && matchMfg;
  });

  return (
    <div className="h-full overflow-y-auto scrollbar-thin p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">芯片库</h1>
          <p className="text-gray-400">浏览和搜索嵌入式芯片技术参数</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="搜索芯片型号、内核..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#161b22] border border-[#30363d] rounded-lg pl-10 pr-4 py-2.5
                text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="relative">
            <Filter size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <select
              value={selectedMfg}
              onChange={(e) => setSelectedMfg(e.target.value)}
              className="appearance-none bg-[#161b22] border border-[#30363d] rounded-lg pl-10 pr-8 py-2.5
                text-sm text-white focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="">全部厂商</option>
              {manufacturers.map((m: string) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((chip: Chip) => (
            <ChipCard key={chip.id} chip={chip} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <Cpu size={48} className="mx-auto mb-4 opacity-30" />
            <p>未找到匹配的芯片</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ChipCard({ chip }: { chip: Chip }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden hover:border-[#484f58] transition-colors">
      <div
        className="p-5 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold text-white">{chip.name}</h3>
            <p className="text-sm text-gray-400">{chip.manufacturer} · {chip.series}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
            <Cpu size={20} className="text-blue-400" />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div>
            <div className="text-xs text-gray-500 mb-1">内核</div>
            <div className="text-sm text-white">{chip.cores}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">主频</div>
            <div className="text-sm text-white">{chip.frequency}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Flash</div>
            <div className="text-sm text-white">{chip.flash}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">RAM</div>
            <div className="text-sm text-white">{chip.ram}</div>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-5 border-t border-[#30363d] pt-4">
          <div className="mb-3">
            <div className="text-xs text-gray-500 mb-2">外设</div>
            <div className="flex flex-wrap gap-1.5">
              {chip.peripherals.map((p: string) => (
                <span
                  key={p}
                  className="px-2 py-0.5 text-xs bg-[#0d1117] text-gray-300 rounded-md border border-[#30363d]"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">封装: {chip.package}</div>
            <button className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300">
              <ExternalLink size={14} />
              数据手册
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
