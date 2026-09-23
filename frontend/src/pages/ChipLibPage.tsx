import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Search, Cpu, Filter, ExternalLink, BookOpen, Globe, Loader2 } from 'lucide-react';
import { chips, manufacturers } from '../data/chips';
import type { Chip } from '../types';

interface OnlineChip {
  name: string;
  manufacturer: string;
  description: string;
  link: string;
  type: 'datasheet' | 'wiki' | 'manual';
}

// Known manufacturer datasheet URL patterns
const mfgPatterns: Record<string, (name: string) => string[]> = {
  'TI': (n: string) => [
    `https://www.ti.com/lit/gpn/${n}`,
    `https://www.ti.com/product/${n}`,
  ],
  'Texas Instruments': (n: string) => [
    `https://www.ti.com/lit/gpn/${n}`,
    `https://www.ti.com/product/${n}`,
  ],
  'STMicroelectronics': (n: string) => [
    `https://www.st.com/resource/en/datasheet/${n.toLowerCase()}.pdf`,
    `https://www.st.com/en/microcontrollers-microprocessors/${n.toLowerCase()}.html`,
  ],
  'Microchip': (n: string) => [
    `https://www.microchip.com/wwwproducts/en/${n}`,
  ],
  'NXP': (n: string) => [
    `https://www.nxp.com/docs/en/data-sheet/${n.toUpperCase()}.pdf`,
  ],
  'Espressif': (n: string) => [
    `https://www.espressif.com/en/products/socs/details/${n.toLowerCase()}`,
  ],
};

export default function ChipLibPage() {
  const [search, setSearch] = useState('');
  const [selectedMfg, setSelectedMfg] = useState('');
  const [onlineResults, setOnlineResults] = useState<OnlineChip[]>([]);
  const [searchingOnline, setSearchingOnline] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

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

  // Detect manufacturer from chip name
  const detectManufacturer = (name: string): string => {
    const n = name.toUpperCase();
    if (n.startsWith('STM32') || n.startsWith('STM8') || n.startsWith('STM32G0') || n.startsWith('STM32L') || n.startsWith('STM32H') || n.startsWith('STM32U') || n.startsWith('STM32WB')) return 'STMicroelectronics';
    if (n.startsWith('MSP430') || n.startsWith('LM4F') || n.startsWith('TMS570')) return 'Texas Instruments';
    if (n.startsWith('PIC') || n.startsWith('ATSAME') || n.startsWith('AT32UC')) return 'Microchip';
    if (n.startsWith('LM3S') || n.startsWith('EK-TM4C')) return 'Texas Instruments';
    if (n.startsWith('K20') || n.startsWith('K64') || n.startsWith('LPC') || n.startsWith('i.MX')) return 'NXP';
    if (n.startsWith('ESP') || n.startsWith('ESP32')) return 'Espressif';
    if (n.startsWith('GD32')) return 'GigaDevice';
    if (n.startsWith('ATmega') || n.startsWith('ATtiny') || n.startsWith('ATSAMD')) return 'Microchip';
    if (n.startsWith('RP2')) return 'Raspberry Pi';
    if (n.startsWith('nRF52') || n.startsWith('nRF53')) return 'Nordic';
    return '';
  };

  const searchOnline = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setOnlineResults([]);
      return;
    }
    setSearchingOnline(true);
    const results: OnlineChip[] = [];
    const q = query.trim();

    try {
      // 1. Wikipedia search (CORS-friendly, gives chip info)
      const wikiRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=3&format=json&origin=*`
      );
      if (wikiRes.ok) {
        const [titles, descriptions]: [string[], string[]] = await wikiRes.json();
        for (let i = 0; i < titles.length; i++) {
          const title = titles[i];
          results.push({
            name: title,
            manufacturer: 'Wikipedia',
            description: descriptions[i] || `关于 ${title} 的介绍`,
            link: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
            type: 'wiki',
          });
        }
      }
    } catch { /* ignore */ }

    try {
      // 2. Manufacturer-specific product pages
      const mfg = detectManufacturer(q);
      if (mfg && mfgPatterns[mfg]) {
        const urls = mfgPatterns[mfg](q);
        results.push({
          name: `${q} - ${mfg} 产品页`,
          manufacturer: mfg,
          description: '厂商官方产品页面，包含技术文档下载',
          link: urls[0],
          type: 'datasheet',
        });
      }
    } catch { /* ignore */ }

    // 3. Always add direct datasheet search from key distributors
    results.push({
      name: `Octopart - ${q}`,
      manufacturer: '元器件搜索引擎',
      description: '搜索多个分销商的 datasheet PDF',
      link: `https://octopart.com/search?q=${encodeURIComponent(q)}`,
      type: 'datasheet',
    });
    results.push({
      name: `立创商城 - ${q}`,
      manufacturer: 'LCSC',
      description: '国产元器件分销，支持 datasheet 预览',
      link: `https://www.szlcsc.com/product/search.html?k=${encodeURIComponent(q)}`,
      type: 'datasheet',
    });
    results.push({
      name: `DigiKey - ${q}`,
      manufacturer: 'DigiKey',
      description: '全球最大元器件分销商，PDF 规格书下载',
      link: `https://www.digikey.com/en/products/results?K=${encodeURIComponent(q)}`,
      type: 'datasheet',
    });

    setOnlineResults(results.slice(0, 8));
    setSearchingOnline(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!search || search.length < 2) {
      setOnlineResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      searchOnline(search);
    }, 600);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, searchOnline]);

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
                在线搜索结果
                {searchingOnline && <Loader2 size={16} className="animate-spin text-blue-400 ml-2" />}
              </h2>
              <span className="text-xs text-gray-500">{onlineResults.length} 条结果</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {onlineResults.map((result, i) => {
                const iconBg = result.type === 'datasheet'
                  ? 'from-blue-500/20 to-cyan-500/20'
                  : result.type === 'wiki'
                    ? 'from-yellow-500/20 to-orange-500/20'
                    : 'from-green-500/20 to-teal-500/20';
                const iconColor = result.type === 'datasheet'
                  ? 'text-blue-400'
                  : result.type === 'wiki'
                    ? 'text-yellow-400'
                    : 'text-green-400';
                const Icon = result.type === 'datasheet' ? BookOpen : result.type === 'wiki' ? Globe : ExternalLink;
                return (
                  <a
                    key={i}
                    href={result.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 hover:border-[#484f58] transition-colors block"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-white truncate">{result.name}</h3>
                        <p className="text-xs text-gray-400">{result.manufacturer}</p>
                      </div>
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${iconBg} flex items-center justify-center flex-shrink-0 ml-3`}>
                        <Icon size={16} className={iconColor} />
                      </div>
                    </div>
                    <p className="text-xs text-gray-300 line-clamp-2">{result.description}</p>
                  </a>
                );
              })}
            </div>
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
