import { useState, useMemo } from 'react';
import { Search, Cpu, Filter, ExternalLink, BookOpen, Globe } from 'lucide-react';
import { chips, manufacturers } from '../data/chips';
import type { Chip } from '../types';

interface OnlineSearchLink {
  name: string;
  manufacturer: string;
  description: string;
  link: string;
}

export default function ChipLibPage() {
  const [search, setSearch] = useState('');
  const [selectedMfg, setSelectedMfg] = useState('');
  const [showOnlineLinks, setShowOnlineLinks] = useState(false);

  const localFiltered = useMemo(() => {
    if (!search && !selectedMfg) return chips;
    const q = search.toLowerCase();
    return chips.filter((c: Chip) => {
      const matchSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.cores.toLowerCase().includes(q) ||
        c.series.toLowerCase().includes(q) ||
        c.manufacturer.toLowerCase().includes(q) ||
        c.package.toLowerCase().includes(q) ||
        c.peripherals.some((p) => p.toLowerCase().includes(q));
      const matchMfg = !selectedMfg || c.manufacturer === selectedMfg;
      return matchSearch && matchMfg;
    });
  }, [search, selectedMfg]);

  // Generate direct search links to chip databases
  const onlineSearchLinks = useMemo(() => {
    if (!search || search.length < 2) return [];
    return [
      { name: 'DigiKey', manufacturer: '全球元器件分销商', description: '搜索库存、价格及规格参数', link: `https://www.digikey.com/en/products/results?K=${search}` },
      { name: 'LCSC (立创商城)', manufacturer: '元器件分销商', description: '搜索库存、价格及规格书', link: `https://www.szlcsc.com/product/search.html?k=${search}` },
      { name: 'Octopart', manufacturer: '元器件搜索引擎', description: '多平台比价和规格查询', link: `https://octopart.com/search?q=${search}` },
      { name: '制造商官网', manufacturer: '原厂数据', description: 'Google 搜索芯片数据手册', link: `https://www.google.com/search?q=${search}+datasheet` },
    ] as OnlineSearchLink[];
  }, [search]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
  };

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
              onChange={handleSearch}
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
          {localFiltered.map((chip: Chip) => (
            <ChipCard key={chip.id} chip={chip} />
          ))}
        </div>

        {search && search.length >= 2 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Globe size={18} className="text-green-400" />
                在线搜索
              </h2>
              <button
                onClick={() => setShowOnlineLinks(!showOnlineLinks)}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                {showOnlineLinks ? '收起' : '展开'}
              </button>
            </div>
            {showOnlineLinks && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {onlineSearchLinks.map((link, i) => (
                  <a
                    key={i}
                    href={link.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 hover:border-[#484f58] transition-colors block"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-semibold text-white">{link.name}</h3>
                        <p className="text-sm text-gray-400">{link.manufacturer}</p>
                      </div>
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500/20 to-blue-500/20 flex items-center justify-center">
                        <ExternalLink size={18} className="text-green-400" />
                      </div>
                    </div>
                    <p className="text-sm text-gray-300">{link.description}</p>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {localFiltered.length === 0 && search.length >= 2 && (
          <div className="text-center py-16 text-gray-500">
            <Cpu size={48} className="mx-auto mb-4 opacity-30" />
            <p>未找到匹配的芯片</p>
          </div>
        )}

        {localFiltered.length === 0 && !search && !selectedMfg && (
          <div className="text-center py-16 text-gray-500">
            <Cpu size={48} className="mx-auto mb-4 opacity-30" />
            <p>暂无芯片数据</p>
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
            <div className="flex items-center gap-3">
              {chip.reference ? (
                <a
                  href={chip.reference}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-green-400 hover:text-green-300"
                >
                  <BookOpen size={14} />
                  用户手册
                </a>
              ) : null}
              {chip.datasheetUrl ? (
                <a
                  href={chip.datasheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
                >
                  <ExternalLink size={14} />
                  数据手册
                </a>
              ) : (
                <span className="flex items-center gap-1 text-sm text-gray-600">
                  <ExternalLink size={14} />
                  暂无数据手册
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
