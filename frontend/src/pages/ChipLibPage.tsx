import { useState, useCallback } from 'react';
import { Search, Cpu, Filter, ExternalLink, Loader2 } from 'lucide-react';
import { chips, manufacturers } from '../data/chips';
import type { Chip } from '../types';

interface OnlineChip {
  name: string;
  manufacturer: string;
  description: string;
  link: string;
}

export default function ChipLibPage() {
  const [search, setSearch] = useState('');
  const [selectedMfg, setSelectedMfg] = useState('');
  const [onlineResults, setOnlineResults] = useState<OnlineChip[]>([]);
  const [searchingOnline, setSearchingOnline] = useState(false);

  const localFiltered = chips.filter((c: Chip) => {
    const matchSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.cores.toLowerCase().includes(search.toLowerCase());
    const matchMfg = !selectedMfg || c.manufacturer === selectedMfg;
    return matchSearch && matchMfg;
  });

  const searchOnline = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setOnlineResults([]);
      return;
    }
    // Only search online if local search yields no results
    if (localFiltered.length > 0) {
      setOnlineResults([]);
      return;
    }
    setSearchingOnline(true);
    try {
      // Use DuckDuckGo Instant Answer API (public, CORS-friendly)
      const res = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query + ' microchip datasheet')}&format=json&no_redirect=1&no_html=1`
      );
      if (res.ok) {
        const data = await res.json();
        const results: OnlineChip[] = [];
        // Abstract provides a brief description
        if (data.AbstractText && data.AbstractURL) {
          results.push({
            name: data.Heading || query,
            manufacturer: '',
            description: data.AbstractText,
            link: data.AbstractURL,
          });
        }
        // Related topics
        if (data.RelatedTopics) {
          for (const topic of data.RelatedTopics) {
            if (topic.Text && topic.FirstURL) {
              results.push({
                name: topic.Text.split('|')[0]?.trim() || topic.Text,
                manufacturer: '',
                description: topic.Text.split('|')[1]?.trim() || '',
                link: topic.FirstURL,
              });
            }
          }
        }
        setOnlineResults(results.slice(0, 6));
      } else {
        setOnlineResults([]);
      }
    } catch {
      setOnlineResults([]);
    } finally {
      setSearchingOnline(false);
    }
  }, [localFiltered.length]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    searchOnline(val);
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

        {searchingOnline && (
          <div className="text-center py-8 text-gray-400">
            <Loader2 size={32} className="mx-auto mb-3 animate-spin" />
            <p className="text-sm">正在搜索在线芯片数据库...</p>
          </div>
        )}

        {!searchingOnline && onlineResults.length > 0 && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold text-white mb-4">在线搜索结果</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {onlineResults.map((chip: OnlineChip, i: number) => (
                <div key={i} className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 hover:border-[#484f58] transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{chip.name}</h3>
                      <p className="text-sm text-gray-400">{chip.manufacturer}</p>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500/20 to-blue-500/20 flex items-center justify-center">
                      <Cpu size={20} className="text-green-400" />
                    </div>
                  </div>
                  <p className="text-sm text-gray-300 mb-3">{chip.description}</p>
                  <a
                    href={chip.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
                  >
                    <ExternalLink size={14} />
                    查看详情
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {localFiltered.length === 0 && !searchingOnline && onlineResults.length === 0 && search.length >= 2 && (
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
      )}
    </div>
  );
}
