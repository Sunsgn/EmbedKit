import { useState, useMemo, useCallback, useEffect } from 'react';
import { Search, Cpu, Filter, ExternalLink, BookOpen, Globe, FileText, ReplaceAll, ShoppingCart, Layers, Loader2, CheckCircle, XCircle, Info } from 'lucide-react';
import { chips, manufacturers } from '../data/chips';
import type { Chip } from '../types';

const PROXY_URL = 'http://localhost:9999';

interface ChipDetails {
  productName: string;
  productFamily: string;
  description: string;
  specs: Record<string, string>;
  features: string[];
  hierarchy: Array<{ name: string; url?: string }>;
  stUrl?: string;
  error?: string;
}

type LinkType = 'datasheet' | 'datasheet-aggregate' | 'reference-design' | 'alternative' | 'distributor';

interface ChipLink {
  name: string;
  source: string;
  description: string;
  link: string;
  type: LinkType;
}

const MANUFACTURER_RULES: Array<{ name: string; prefixes: string[]; productUrl: (q: string) => string; datasheetUrl?: (q: string) => string }> = [
  { name: 'Texas Instruments', prefixes: ['MSP430', 'LM4F', 'TMS570', 'LM3S', 'TM4C', 'TMS320', 'LM', 'TLV', 'TPS', 'SN74', 'SN65', 'UC', 'BQ', 'INA', 'OPA', 'DAC', 'ADC', 'LPM'], productUrl: q => `https://www.ti.com/product/${q}`, datasheetUrl: q => `https://www.ti.com/lit/gpn/${q}` },
  { name: 'STMicroelectronics', prefixes: ['STM32', 'STM8', 'L476', 'L552', 'SPC5', 'STSPIN', 'STEVAL'], productUrl: q => `https://www.st.com/en/microcontrollers-microprocessors/${q.toLowerCase()}.html`, datasheetUrl: q => `https://www.st.com/resource/en/datasheet/${q.toLowerCase()}.pdf` },
  { name: 'Microchip', prefixes: ['PIC', 'PIC1', 'PIC2', 'PIC3', 'PIC16', 'PIC18', 'PIC24', 'PIC32', 'ATSAME', 'AT32UC', 'ATMEGA', 'ATTINY', 'ATSAMD', 'AVR', 'DSPIC'], productUrl: q => `https://www.microchip.com/wwwproducts/en/${q}` },
  { name: 'NXP', prefixes: ['K20', 'K64', 'K1', 'K2', 'K3', 'K4', 'K6', 'K80', 'LPC', 'IMX', 'i.MX', 'MCF', 'S32K', 'TWR', 'MCX', 'RT1', 'RT6'], productUrl: q => `https://www.nxp.com/docs/en/data-sheet/${q.toUpperCase()}.pdf` },
  { name: 'Espressif', prefixes: ['ESP'], productUrl: q => `https://www.espressif.com/en/products/socs/details/${q.toLowerCase()}` },
  { name: 'GigaDevice', prefixes: ['GD32'], productUrl: q => `https://www.gd-mcu.com/product.html?id=${q.toUpperCase()}` },
  { name: 'Raspberry Pi', prefixes: ['RP2'], productUrl: q => `https://www.raspberrypi.com/documentation/microcontrollers/${q.toLowerCase()}.html` },
  { name: 'Nordic', prefixes: ['NRF52', 'NRF53', 'NRF51', 'NRF54', 'NRF24', 'NRF5'], productUrl: q => `https://www.nordicsemi.com/products/${q.toLowerCase()}` },
  { name: 'Analog Devices', prefixes: ['AD', 'ADA', 'ADF', 'ADM', 'ADSP', 'MAX', 'MAXIM'], productUrl: q => `https://www.analog.com/en/products/${q.toUpperCase()}.html` },
  { name: 'Infineon', prefixes: ['XMC', 'CY8C', 'CY8P', 'SAC', 'TC3', 'TC2', 'TLX', 'XEE', 'XMC1', 'XMC2', 'XMC4', 'XMC14', 'XMC47', 'XMC48'], productUrl: q => `https://www.infineon.com/cms/en/product/microcontroller/${q.toLowerCase()}` },
  { name: 'Renesas', prefixes: ['RL78', 'RX', 'RH850', 'R7F', 'RA', 'RL', 'RZ'], productUrl: q => `https://www.renesas.com/us/en/products/${q.toUpperCase()}` },
  { name: 'ON Semiconductor', prefixes: ['MC68', 'MC9S', 'Freescale', 'MK', 'KL', 'KW', 'KV', 'KE', 'FR'], productUrl: q => `https://www.onsemi.com/detail/html/${q.toUpperCase()}.html` },
  { name: 'Dialog Semiconductor', prefixes: ['DA14', 'DA16', 'DA17'], productUrl: q => `https://www.dialog-semiconductor.com/products/${q.toLowerCase()}` },
  { name: 'Actions', prefixes: ['AT32', 'AT62', 'AT32F', 'AT32V'], productUrl: q => `https://www.action-semi.com/en/products/details.html?mcuId=${q.toUpperCase()}` },
  { name: 'WCH', prefixes: ['CH32', 'CH57', 'CH58', 'WCH'], productUrl: q => `https://www.wch-ic.com/search/${q.toUpperCase()}` },
  { name: 'Beken', prefixes: ['BK'], productUrl: q => `https://www.beken.com/search/${q.toUpperCase()}` },
  { name: 'MindMotion', prefixes: ['MM32'], productUrl: q => `https://www.mindmotion.com/web/search/${q.toUpperCase()}` },
  { name: 'Holtek', prefixes: ['HT'], productUrl: q => `https://www.htek.com.tw/product.html?m=search&s=${q.toUpperCase()}` },
  { name: 'YangTze Memory', prefixes: ['TM'], productUrl: q => `https://www.tm-micro.com/product.html?m=search&s=${q.toUpperCase()}` },
];

const detectManufacturer = (name: string): typeof MANUFACTURER_RULES[number] | null => {
  const n = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
  for (const rule of MANUFACTURER_RULES) {
    for (const prefix of rule.prefixes) {
      if (n.startsWith(prefix.toUpperCase())) {
        return rule;
      }
    }
  }
  return null;
};

const buildChipLinks = (q: string): ChipLink[] => {
  const results: ChipLink[] = [];
  const rule = detectManufacturer(q);

  // 1. Manufacturer official links
  if (rule) {
    results.push({
      name: `${q} - ${rule.name} 产品页`,
      source: rule.name,
      description: `${rule.name} 官方产品页面`,
      link: rule.productUrl(q),
      type: 'datasheet',
    });
    if (rule.datasheetUrl) {
      results.push({
        name: `${q} - 直接下载 PDF`,
        source: rule.name,
        description: '官方 Datasheet PDF 直链',
        link: rule.datasheetUrl(q),
        type: 'datasheet',
      });
    }
  }

  // 2. Datasheet aggregation sites
  results.push({
    name: ` datasheet - ${q}`,
    source: 'DATASHEET搜索',
    description: '全球 datasheet PDF 数据库',
    link: `https://www.datasheet.com/search?q=${encodeURIComponent(q)}`,
    type: 'datasheet-aggregate',
  });
  results.push({
    name: `alldatasheet - ${q}`,
    source: 'alldatasheet',
    description: 'PDF datasheet 查看器和下载',
    link: `https://www.alldatasheet.com/view.jsp?Searchword=${encodeURIComponent(q)}`,
    type: 'datasheet-aggregate',
  });
  results.push({
    name: `icpdf - ${q}`,
    source: 'icpdf',
    description: 'IC datasheet PDF 在线查看',
    link: `https://www.icpdf.com/s?q=${encodeURIComponent(q)}`,
    type: 'datasheet-aggregate',
  });

  // 3. Reference design & development board
  results.push({
    name: `参考设计 - ${q}`,
    source: '参考设计',
    description: '参考电路、评估板和开发套件',
    link: `https://www.digikey.com/en/products/detail?q=${encodeURIComponent(q)}&k=development+board&k=evaluation+kit`,
    type: 'reference-design',
  });

  // 4. Alternative / cross-reference
  results.push({
    name: `替代型号 - ${q}`,
    source: '替代查询',
    description: '查找引脚兼容替代型号、国产替代',
    link: `https://www.semiee.com/search?searchModel=${encodeURIComponent(q)}`,
    type: 'alternative',
  });
  results.push({
    name: `交叉参考 - ${q}`,
    source: 'Cross Reference',
    description: '查找等效和兼容型号',
    link: `https://www.findchips.com/search/${encodeURIComponent(q)}`,
    type: 'alternative',
  });

  // 5. Distributors
  results.push({
    name: `购买 - ${q}`,
    source: 'Octopart',
    description: '搜索多个分销商的库存和价格',
    link: `https://octopart.com/search?q=${encodeURIComponent(q)}`,
    type: 'distributor',
  });
  results.push({
    name: `购买 - ${q}`,
    source: '立创商城',
    description: '国产元器件分销，支持 datasheet 预览',
    link: `https://www.szlcsc.com/product/search.html?k=${encodeURIComponent(q)}`,
    type: 'distributor',
  });
  results.push({
    name: `购买 - ${q}`,
    source: 'DigiKey',
    description: '全球最大元器件分销商',
    link: `https://www.digikey.com/en/products/results?K=${encodeURIComponent(q)}`,
    type: 'distributor',
  });
  results.push({
    name: `购买 - ${q}`,
    source: 'Mouser',
    description: '新品授权分销商',
    link: `https://www.mouser.com.cn/Search/Results.aspx?Keyword=${encodeURIComponent(q)}`,
    type: 'distributor',
  });

  return results;
};

export default function ChipLibPage() {
  const [search, setSearch] = useState('');
  const [selectedMfg, setSelectedMfg] = useState('');

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

  // Generate datasheet links based on search query
  const onlineResults = useMemo(() => {
    if (!search || search.length < 2) return [];
    return buildChipLinks(search.trim());
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
          <div className="mt-6 space-y-6">
            {/* Chip Details Panel */}
            <ChipDetailsPanel chipName={search.trim()} />

            {/* Datasheet section */}
            {(() => {
              const ds = onlineResults.filter(r => r.type === 'datasheet' || r.type === 'datasheet-aggregate');
              if (ds.length === 0) return null;
              return (
                <LinkSection title="数据手册 & 厂商官网" icon={FileText} color="blue" items={ds} />
              );
            })()}

            {/* Reference design section */}
            {(() => {
              const rd = onlineResults.filter(r => r.type === 'reference-design');
              if (rd.length === 0) return null;
              return (
                <LinkSection title="参考设计 & 评估板" icon={Layers} color="purple" items={rd} />
              );
            })()}

            {/* Alternative section */}
            {(() => {
              const alt = onlineResults.filter(r => r.type === 'alternative');
              if (alt.length === 0) return null;
              return (
                <LinkSection title="替代型号 & 交叉参考" icon={ReplaceAll} color="yellow" items={alt} />
              );
            })()}

            {/* Distributor section */}
            {(() => {
              const dist = onlineResults.filter(r => r.type === 'distributor');
              if (dist.length === 0) return null;
              return (
                <LinkSection title="采购渠道" icon={ShoppingCart} color="green" items={dist} />
              );
            })()}
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

function ChipDetailsPanel({ chipName }: { chipName: string }) {
  const [details, setDetails] = useState<ChipDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchDetails = async () => {
      setLoading(true);
      setError(null);
      setDetails(null);
      try {
        const res = await fetch(`${PROXY_URL}/api/chip-details?chip=${encodeURIComponent(chipName)}`);
        const data = await res.json();
        if (!mounted) return;
        if (data.error) {
          setError(data.error);
        } else {
          setDetails(data);
        }
      } catch (e: any) {
        if (mounted) setError(e.message || 'Failed to fetch chip details');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    const timer = setTimeout(fetchDetails, 400);
    return () => { mounted = false; clearTimeout(timer); };
  }, [chipName]);

  if (loading) {
    return (
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 text-center">
        <Loader2 size={24} className="animate-spin mx-auto mb-3 text-blue-400" />
        <p className="text-sm text-gray-400">正在获取芯片详细信息...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6">
        <div className="flex items-center gap-3">
          <XCircle size={20} className="text-red-400 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-white">无法获取芯片详情</h3>
            <p className="text-xs text-gray-400 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!details) return null;

  const hasDetails = details.description || Object.keys(details.specs).length > 0 || details.features.length > 0;
  if (!hasDetails) {
    return (
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6">
        <div className="flex items-center gap-3">
          <Info size={20} className="text-yellow-400 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-white">暂无结构化详情</h3>
            <p className="text-xs text-gray-400 mt-1">该厂商的产品页面尚未支持详情解析</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
      <div className="p-5 border-b border-[#30363d]">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center flex-shrink-0">
            <Cpu size={24} className="text-blue-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white">{details.productName || chipName}</h2>
            {details.productFamily && <p className="text-sm text-gray-400 mt-0.5">{details.productFamily}</p>}
            {details.description && <p className="text-sm text-gray-300 mt-2 leading-relaxed">{details.description}</p>}
          </div>
        </div>
      </div>

      {/* Key Specs */}
      {Object.keys(details.specs).length > 0 && (
        <div className="px-5 py-4 border-b border-[#30363d]">
          <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">关键参数</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(details.specs).map(([key, value]) => (
              <div key={key} className="bg-[#0d1117] rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">{formatSpecKey(key)}</div>
                <div className="text-sm font-medium text-white">{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Features */}
      {details.features.length > 0 && (
        <div className="px-5 py-4">
          <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">产品特性</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {details.features.map((feature, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle size={14} className="text-green-400 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-300">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const SPEC_KEY_MAP: Record<string, string> = {
  maxClock: '主频',
  flashMemory: 'Flash',
  sram: 'SRAM',
  voltageRange: '工作电压',
  adc: 'ADC',
  productName: '产品名称',
  productFamily: '产品系列',
  tree: '产品树',
  core: '内核',
  operatingVoltage: '工作电压',
};

function formatSpecKey(key: string): string {
  return SPEC_KEY_MAP[key] || key.replace(/([A-Z])/g, ' $1').trim();
}

const LINK_STYLES: Record<string, { bg: string; color: string }> = {
  blue: { bg: 'from-blue-500/20 to-cyan-500/20', color: 'text-blue-400' },
  purple: { bg: 'from-purple-500/20 to-pink-500/20', color: 'text-purple-400' },
  yellow: { bg: 'from-yellow-500/20 to-orange-500/20', color: 'text-yellow-400' },
  green: { bg: 'from-green-500/20 to-teal-500/20', color: 'text-green-400' },
};

function LinkSection({ title, icon: Icon, color, items }: { title: string; icon: any; color: string; items: ChipLink[] }) {
  const style = LINK_STYLES[color] || LINK_STYLES.blue;
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <Icon size={16} className={style.color} />
          {title}
        </h2>
        <span className="text-xs text-gray-500">{items.length} 条</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((item, i) => (
          <a
            key={i}
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 hover:border-[#484f58] transition-colors block group"
          >
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-md bg-gradient-to-br ${style.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                <ExternalLink size={14} className={style.color} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white truncate group-hover:text-blue-300 transition-colors">{item.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{item.source}</p>
                <p className="text-xs text-gray-500 mt-1 line-clamp-1">{item.description}</p>
              </div>
            </div>
          </a>
        ))}
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
