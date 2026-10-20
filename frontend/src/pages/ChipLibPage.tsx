import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Boxes, CheckCircle, Cpu, ExternalLink, FileText, Filter, History, Info, Layers, Lightbulb, Loader2, PackageSearch, ReplaceAll, Search, ShoppingCart, Tag } from 'lucide-react';
import { chips } from '../data/chips';
import { components } from '../data/components';
import { LOCAL_PROXY_BASE } from '../services/aiService';
import KnowledgeSourcePanel from '../features/resources/KnowledgeSourcePanel';
import FunctionalSelectionCenter from '../features/resources/FunctionalSelectionCenter';
import FunctionSolutionRecords from '../features/resources/FunctionSolutionRecords';
import { buildOfficialDocumentLinks, documentAccessLabel, mergeDiscoveredDocuments, type PartDocumentDiscoveryInput } from '../features/resources/partDocumentDiscovery';
import { discoverPartDocuments, type DiscoveredPartDocument } from '../services/partSources';
import type { FunctionSolution } from '../types';

interface CatalogItem {
  id: string;
  name: string;
  manufacturer: string;
  category: string;
  subcategory: string;
  description: string;
  package: string;
  parameters: Record<string, string>;
  tags: string[];
  datasheetUrl?: string;
  reference?: string;
  isChip?: boolean;
}

type LinkType = 'datasheet' | 'cad' | 'alternative' | 'distributor';
interface PartLink {
  name: string;
  source: string;
  description: string;
  link: string;
  type: LinkType;
}
interface OnlineDetails {
  productName?: string;
  productFamily?: string;
  manufacturer?: string;
  description?: string;
  specs?: Record<string, string>;
  features?: string[];
  stUrl?: string;
  productUrl?: string;
  datasheetUrl?: string;
  source?: string;
  error?: string;
}

const chipItems: CatalogItem[] = chips.map((chip) => ({
  id: `chip-${chip.id}`,
  name: chip.name,
  manufacturer: chip.manufacturer,
  category: '微控制器与处理器',
  subcategory: chip.series,
  description: `${chip.cores} 内核嵌入式处理器，集成 ${chip.peripherals.slice(0, 6).join('、')} 等外设。`,
  package: chip.package,
  parameters: {
    内核: chip.cores,
    主频: chip.frequency,
    Flash: chip.flash,
    RAM: chip.ram,
  },
  tags: [chip.series, chip.cores, ...chip.peripherals],
  datasheetUrl: chip.datasheetUrl,
  reference: chip.reference,
  isChip: true,
}));

const catalog: CatalogItem[] = [...chipItems, ...components];
const categories = [...new Set(catalog.map((item) => item.category))];
const manufacturers = [...new Set(catalog.map((item) => item.manufacturer))].sort((a, b) => a.localeCompare(b));

function buildLinks(query: string): PartLink[] {
  const q = encodeURIComponent(query.trim());
  return [
    {
      name: `${query} 数据手册`,
      source: 'AllDatasheet',
      description: '按完整型号查询 PDF 数据手册',
      link: `https://www.alldatasheet.com/view.jsp?Searchword=${q}`,
      type: 'datasheet',
    },
    {
      name: `${query} 技术资料`,
      source: 'Datasheet Archive',
      description: '元器件数据手册与历史型号检索',
      link: `https://www.datasheetarchive.com/?q=${q}`,
      type: 'datasheet',
    },
    {
      name: `${query} 符号与封装`,
      source: 'SnapMagic',
      description: '查询原理图符号、PCB 封装与 3D 模型',
      link: `https://www.snapeda.com/search/?q=${q}`,
      type: 'cad',
    },
    {
      name: `${query} CAD 模型`,
      source: 'Ultra Librarian',
      description: '查询封装、符号及 3D 模型',
      link: `https://www.ultralibrarian.com/search?query=${q}`,
      type: 'cad',
    },
    {
      name: `${query} 替代型号`,
      source: '半导小芯',
      description: '查询参数相近器件与国产替代型号',
      link: `https://www.semiee.com/search?searchModel=${q}`,
      type: 'alternative',
    },
    {
      name: `${query} 交叉参考`,
      source: 'Findchips',
      description: '比较型号、库存及交叉参考信息',
      link: `https://www.findchips.com/search/${q}`,
      type: 'alternative',
    },
    {
      name: `${query} 库存与价格`,
      source: 'Octopart',
      description: '聚合多个授权分销商的库存和价格',
      link: `https://octopart.com/search?q=${q}`,
      type: 'distributor',
    },
    {
      name: `${query} 国内采购`,
      source: '立创商城',
      description: '查询参数、数据手册、库存和价格',
      link: `https://so.szlcsc.com/global.html?k=${q}`,
      type: 'distributor',
    },
    {
      name: `${query} 授权采购`,
      source: 'DigiKey',
      description: '查询可订购型号、参数和库存',
      link: `https://www.digikey.cn/zh/products/result?keywords=${q}`,
      type: 'distributor',
    },
    {
      name: `${query} 授权采购`,
      source: 'Mouser',
      description: '查询元器件参数、生命周期和库存',
      link: `https://www.mouser.cn/c/?q=${q}`,
      type: 'distributor',
    },
  ];
}

function searchText(item: CatalogItem) {
  return [item.name, item.manufacturer, item.category, item.subcategory, item.description, item.package, ...item.tags, ...Object.keys(item.parameters), ...Object.values(item.parameters)].join(' ').toLowerCase();
}

function normalizedModel(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function typicalUse(item: CatalogItem) {
  if (!item.isChip) return item.description;
  const text = `${item.name} ${item.subcategory} ${item.tags.join(' ')}`.toUpperCase();
  if (/ESP|WIFI|BLUETOOTH|BLE/.test(text)) return '适合物联网终端、无线传感器、智能家居、设备联网和边缘控制。';
  if (/NRF/.test(text)) return '适合低功耗蓝牙设备、可穿戴设备、无线传感器和遥控器。';
  if (/IMX|CORTEX-A/.test(text)) return '适合嵌入式 Linux、图形界面、边缘网关和高性能人机交互。';
  if (/RP2|AVR|ATMEGA|ATTINY/.test(text)) return '适合入门开发、教育实验、简单控制器和低成本原型。';
  if (/CAN|ETH|STM32|GD32|CH32|CORTEX-M/.test(text)) return '适合工业控制、仪器仪表、电机控制、数据采集和通信网关。';
  return '适合通用嵌入式控制、外设驱动、数据采集和实时任务处理。';
}

function hasChipDocumentation(item: CatalogItem) {
  return item.isChip || !['无源器件', '连接器'].includes(item.category);
}

export default function ChipLibPage() {
  const [mode, setMode] = useState<'catalog' | 'solution' | 'records'>(() => {
    const stored = localStorage.getItem('embedkit.resources-mode');
    return stored === 'solution' || stored === 'records' ? stored : 'catalog';
  });
  const [openedSolution, setOpenedSolution] = useState<FunctionSolution>();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  useEffect(() => localStorage.setItem('embedkit.resources-mode', mode), [mode]);
  const query = search.trim();
  const filtered = useMemo(() => {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    return catalog.filter((item) => (!tokens.length || tokens.every((token) => searchText(item).includes(token))) && (!category || item.category === category) && (!manufacturer || item.manufacturer === manufacturer));
  }, [category, manufacturer, query]);
  const links = useMemo(() => (query.length >= 2 ? buildLinks(query) : []), [query]);
  const exactMatch = useMemo(() => {
    if (query.length < 2) return null;
    const model = normalizedModel(query);
    return catalog.find((item) => normalizedModel(item.name) === model) ?? (filtered.length === 1 ? filtered[0] : null);
  }, [filtered, query]);

  return (
    <div className="h-full overflow-y-auto p-4 scrollbar-thin lg:p-6">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Boxes className="text-blue-400" />
              资料中心
            </h1>
            <p className="mt-1 text-sm text-gray-400">按型号查询数据手册、用户指南、参考手册、应用笔记、设计资料和官方来源</p>
          </div>
          <div className="flex gap-2 text-xs text-gray-500">
            <span className="rounded-full border border-[#30363d] bg-[#161b22] px-3 py-1">{catalog.length} 个本地型号</span>
            <span className="rounded-full border border-[#30363d] bg-[#161b22] px-3 py-1">{categories.length} 个分类</span>
          </div>
        </header>

        <nav aria-label="资料中心模式" className="mb-5 grid gap-2 sm:grid-cols-2">
          {[
            {
              id: 'catalog' as const,
              name: '按型号查询器件',
              detail: '型号、手册、CAD 与来源导航',
              icon: Search,
            },
            {
              id: 'records' as const,
              name: '我的资料与选型记录',
              detail: '恢复、导出与旧记录兼容',
              icon: History,
            },
          ].map((item) => (
            <button key={item.id} onClick={() => setMode(item.id)} className={`flex items-center gap-3 rounded-xl border p-3 text-left ${mode === item.id ? 'border-blue-500/50 bg-blue-500/10' : 'border-[#30363d] bg-[#161b22] hover:border-[#484f58]'}`}>
              <item.icon size={18} className={mode === item.id ? 'text-blue-400' : 'text-gray-500'} />
              <span>
                <b className="block text-sm text-gray-200">{item.name}</b>
                <small className="text-[10px] text-gray-600">{item.detail}</small>
              </span>
            </button>
          ))}
        </nav>

        {mode === 'solution' && <FunctionalSelectionCenter initialSolution={openedSolution} />}
        {mode === 'records' && (
          <FunctionSolutionRecords
            onOpen={(solution) => {
              setOpenedSolution(solution);
              setMode('solution');
            }}
          />
        )}
        {mode === 'catalog' && (
          <>
            <KnowledgeSourcePanel />
            <section className="mb-5 rounded-xl border border-[#30363d] bg-[#161b22] p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-semibold text-gray-200">按完整型号查找</h2><p className="mt-1 text-[10px] text-gray-600">推荐型号可由 AI 提供；这里负责查找资料、核对型号和保留来源。</p></div><button onClick={() => { setOpenedSolution(undefined); setMode('solution'); }} className="flex items-center gap-1.5 rounded border border-purple-500/30 px-3 py-2 text-xs text-purple-300"><Lightbulb size={13} />批量核验 AI 给出的型号</button></div>
              <div className="grid gap-3 md:grid-cols-[minmax(280px,1fr)_220px_220px]">
                <label className="relative">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索型号、参数或用途，例如 BME280、RS485、10k、去耦…" className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] py-2.5 pl-10 pr-4 text-sm outline-none placeholder:text-gray-600 focus:border-blue-500" />
                </label>
                <label className="relative">
                  <Filter size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <select value={category} onChange={(event) => setCategory(event.target.value)} className="w-full appearance-none rounded-lg border border-[#30363d] bg-[#0d1117] py-2.5 pl-10 pr-4 text-sm outline-none">
                    <option value="">全部类别</option>
                    {categories.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <select value={manufacturer} onChange={(event) => setManufacturer(event.target.value)} className="rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2.5 text-sm outline-none">
                  <option value="">全部厂商</option>
                  {manufacturers.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => setCategory('')} className={`rounded-full px-3 py-1 text-xs ${!category ? 'bg-blue-600 text-white' : 'bg-[#0d1117] text-gray-400'}`}>
                  全部
                </button>
                {categories.map((item) => (
                  <button key={item} onClick={() => setCategory(item)} className={`rounded-full px-3 py-1 text-xs ${category === item ? 'bg-blue-600 text-white' : 'bg-[#0d1117] text-gray-400 hover:text-white'}`}>
                    {item}
                  </button>
                ))}
              </div>
            </section>

            <div className="mb-3 flex items-center justify-between text-xs text-gray-500">
              <span>
                本地匹配 <b className="text-gray-300">{filtered.length}</b> 项
              </span>
              {(query || category || manufacturer) && (
                <button
                  onClick={() => {
                    setSearch('');
                    setCategory('');
                    setManufacturer('');
                  }}
                  className="text-blue-400"
                >
                  清除筛选
                </button>
              )}
            </div>
            {query.length >= 2 && <QueryDetails query={query} localItem={exactMatch} />}
            {filtered.length ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filtered.map((item) => (
                  <ComponentCard key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-[#30363d] py-12 text-center text-gray-500">
                <PackageSearch size={42} className="mx-auto mb-3 opacity-40" />
                <p>本地库没有匹配项</p>
                {query.length >= 2 && <p className="mt-1 text-xs">正在尝试在线查询，也可使用下方资料入口</p>}
              </div>
            )}

            {query.length >= 2 && (
              <section className="mt-7 space-y-6 border-t border-[#30363d] pt-6">
                <div>
                  <h2 className="text-lg font-semibold">“{query}”的在线元器件资料</h2>
                  <p className="mt-1 text-xs text-gray-500">完整型号能获得更准确的资料和采购结果。</p>
                </div>
                <LinkSection title="数据手册与技术资料" icon={FileText} color="blue" items={links.filter((item) => item.type === 'datasheet')} />
                <LinkSection title="符号、封装与 3D 模型" icon={Layers} color="purple" items={links.filter((item) => item.type === 'cad')} />
                <LinkSection title="替代型号与交叉参考" icon={ReplaceAll} color="yellow" items={links.filter((item) => item.type === 'alternative')} />
                <LinkSection title="库存、价格与采购" icon={ShoppingCart} color="green" items={links.filter((item) => item.type === 'distributor')} />
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function QueryDetails({ query, localItem }: { query: string; localItem: CatalogItem | null }) {
  const [details, setDetails] = useState<OnlineDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (localItem) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setFailed(false);
      setDetails(null);
      try {
        const response = await fetch(`${LOCAL_PROXY_BASE}/api/component-details?part=${encodeURIComponent(query)}`, { signal: controller.signal });
        const data = (await response.json()) as OnlineDetails;
        if (!response.ok || data.error) setFailed(true);
        else setDetails(data);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 450);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [localItem, query]);

  if (localItem)
    return (
      <section className="mb-4 overflow-hidden rounded-xl border border-blue-500/30 bg-[#161b22]">
        <div className="border-b border-[#30363d] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-blue-400">型号详情</span>
              <h2 className="mt-1 text-xl font-bold">{localItem.name}</h2>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded bg-blue-500/10 px-2 py-1 text-blue-300">类型：{localItem.subcategory}</span>
                <span className="rounded bg-[#0d1117] px-2 py-1 text-gray-400">类别：{localItem.category}</span>
                <span className="rounded bg-[#0d1117] px-2 py-1 text-gray-400">厂商：{localItem.manufacturer}</span>
              </div>
            </div>
            <span className="rounded-md bg-[#0d1117] px-3 py-1.5 text-xs text-gray-400">封装：{localItem.package}</span>
          </div>
          <div className="mt-4 rounded-lg border border-green-500/15 bg-green-500/5 p-3">
            <h3 className="text-xs font-semibold text-green-400">典型用途</h3>
            <p className="mt-1 text-sm leading-6 text-gray-300">{typicalUse(localItem)}</p>
          </div>
        </div>
        {hasChipDocumentation(localItem) && <ChipManuals input={{ model: localItem.name, manufacturer: localItem.manufacturer, category: localItem.category, isMcu: localItem.isChip, datasheetUrl: localItem.datasheetUrl, referenceUrl: localItem.reference && /\.pdf(?:$|[?#])/i.test(localItem.reference) ? localItem.reference : undefined, productUrl: localItem.reference && !/\.pdf(?:$|[?#])/i.test(localItem.reference) ? localItem.reference : undefined }} />}
        <div className="p-5">
          <h3 className="mb-1 text-xs font-semibold text-gray-300">关键使用参数</h3>
          <p className="mb-3 text-[11px] text-gray-600">用于初步选型；最终设计请核对对应温度等级、封装后缀及最新版数据手册。</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(localItem.parameters).map(([key, value]) => (
              <div key={key} className="rounded-lg bg-[#0d1117] p-3">
                <div className="text-[10px] text-gray-600">{key}</div>
                <div className="mt-1 text-sm font-medium text-gray-200">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  if (loading)
    return (
      <div className="mb-4 rounded-xl border border-[#30363d] bg-[#161b22] p-5 text-center">
        <Loader2 size={20} className="mx-auto mb-2 animate-spin text-blue-400" />
        <p className="text-xs text-gray-500">正在查询 {query} 的重要参数和用途…</p>
      </div>
    );
  if (failed)
    return (
      <section className="mb-4 overflow-hidden rounded-xl border border-yellow-500/20 bg-[#161b22]">
        <div className="flex gap-3 bg-yellow-500/5 p-4">
          <Info size={18} className="shrink-0 text-yellow-400" />
          <div>
            <p className="text-sm text-gray-300">暂未取得该型号的结构化参数</p>
            <p className="mt-1 text-xs text-gray-500">仍可按型号检索完整资料包；厂商未确认前，入口会明确标为 Web 检索。</p>
          </div>
        </div>
        <ChipManuals input={{ model: query }} />
      </section>
    );
  if (!details) return null;
  const specs = details.specs ?? {};
  const onlineManufacturer = details.manufacturer || (typeof specs.manufacturer === 'string' ? specs.manufacturer : undefined);
  return (
    <section className="mb-4 overflow-hidden rounded-xl border border-blue-500/30 bg-[#161b22]">
      <div className="border-b border-[#30363d] p-5">
        <span className="text-[10px] uppercase tracking-wider text-blue-400">在线型号详情</span>
        <h2 className="mt-1 text-xl font-bold">{details.productName || query}</h2>
        {details.productFamily && <p className="mt-1 text-xs text-blue-300">{details.productFamily}</p>}
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {onlineManufacturer && <span className="rounded bg-[#0d1117] px-2 py-1 text-gray-400">厂商：{onlineManufacturer}</span>}
          {details.source && <span className="rounded bg-[#0d1117] px-2 py-1 text-gray-500">参数来源：{details.source}</span>}
        </div>
        <div className="mt-4 rounded-lg border border-green-500/15 bg-green-500/5 p-3">
          <h3 className="text-xs font-semibold text-green-400">功能与用途</h3>
          <p className="mt-1 text-sm leading-6 text-gray-300">{details.description || '请结合数据手册确认器件功能和推荐应用。'}</p>
        </div>
      </div>
      <ChipManuals input={{ model: details.productName || query, manufacturer: onlineManufacturer, category: details.productFamily, datasheetUrl: details.datasheetUrl || details.stUrl, productUrl: details.productUrl }} />
      {Object.keys(specs).length > 0 && (
        <div className="p-5">
          <h3 className="mb-3 text-xs font-semibold text-gray-400">重要参数</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(specs).map(([key, value]) => (
              <div key={key} className="rounded-lg bg-[#0d1117] p-3">
                <div className="text-[10px] uppercase text-gray-600">{key}</div>
                <div className="mt-1 break-words text-xs text-gray-200">{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {(details.features?.length ?? 0) > 0 && (
        <div className="grid gap-2 border-t border-[#30363d] p-5 sm:grid-cols-2">
          {details.features!.map((feature) => (
            <div key={feature} className="flex gap-2 text-xs text-gray-400">
              <CheckCircle size={13} className="shrink-0 text-green-400" />
              {feature}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ChipManuals({ input }: { input: PartDocumentDiscoveryInput }) {
  const discoveryKey = `${input.model}\n${input.manufacturer || ''}\n${input.productUrl || ''}`;
  const [discovery, setDiscovery] = useState<{ key: string; state: 'done' | 'failed'; documents: DiscoveredPartDocument[]; message: string }>({ key: '', state: 'failed', documents: [], message: '' });
  const activeDiscovery = discovery.key === discoveryKey ? discovery : { key: discoveryKey, state: 'loading' as const, documents: [], message: '' };
  const documents = activeDiscovery.documents, discoveryState = input.manufacturer || input.productUrl ? activeDiscovery.state : 'idle', discoveryMessage = activeDiscovery.message;
  const baseManuals = useMemo(() => buildOfficialDocumentLinks({ model: input.model, manufacturer: input.manufacturer, category: input.category, isMcu: input.isMcu, datasheetUrl: input.datasheetUrl, referenceUrl: input.referenceUrl, productUrl: input.productUrl }), [input.category, input.datasheetUrl, input.isMcu, input.manufacturer, input.model, input.productUrl, input.referenceUrl]);
  const manuals = useMemo(() => mergeDiscoveredDocuments(baseManuals, documents), [baseManuals, documents]);
  useEffect(() => {
    if (!input.manufacturer && !input.productUrl) return;
    const controller = new AbortController();
    discoverPartDocuments({ model: input.model, manufacturer: input.manufacturer, productUrl: input.productUrl }, controller.signal)
      .then(result => {
        setDiscovery({ key: discoveryKey, state: 'done', documents: result.documents, message: result.documents.length ? `已从 ${result.manufacturer} 官方页面发现 ${result.documents.length} 份 PDF` : result.failures[0]?.message || '厂商页面未公开可识别的 PDF' });
      })
      .catch(error => {
        if (controller.signal.aborted) return;
        setDiscovery({ key: discoveryKey, state: 'failed', documents: [], message: error instanceof Error ? error.message : '官方 PDF 发现失败' });
      });
    return () => controller.abort();
  }, [discoveryKey, input.manufacturer, input.model, input.productUrl]);
  return (
    <div className="border-b border-[#30363d] bg-blue-500/[0.03] p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-blue-300">
            <BookOpen size={15} />
            完整技术资料包
          </h3>
          <p className="mt-1 text-[11px] text-gray-500">优先直接打开厂商 PDF；未发现 PDF 的资料类型保留检索入口，并需核对适用型号、版本与发布日期。</p>
          {discoveryState === 'loading' && <p className="mt-1 flex items-center gap-1.5 text-[10px] text-blue-400"><Loader2 size={11} className="animate-spin" />正在从厂商官方页面查找 PDF…</p>}
          {(discoveryState === 'done' || discoveryState === 'failed') && <p className={`mt-1 text-[10px] ${documents.length ? 'text-green-400' : 'text-yellow-400'}`}>{discoveryMessage}</p>}
        </div>
        <span className="rounded-full border border-[#30363d] px-2.5 py-1 text-[10px] text-gray-500">{manuals.length} 类资料</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {manuals.map((manual) => (
          <a key={manual.id} href={manual.url} target="_blank" rel="noopener noreferrer" className="group rounded-lg border border-[#30363d] bg-[#0d1117] p-3 hover:border-blue-500/40">
            <div className="flex items-center justify-between">
              <b className="text-xs text-gray-200 group-hover:text-blue-300">{manual.title}</b>
              <ExternalLink size={12} className="text-gray-600 group-hover:text-blue-400" />
            </div>
            <p className="mt-1.5 min-h-8 text-[11px] leading-4 text-gray-600">{manual.description}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[9px]">
              <span className={`rounded px-1.5 py-0.5 ${manual.authoritative ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}>{documentAccessLabel(manual)}</span>
              <span className="truncate text-gray-600">{manual.sourceName}</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function ComponentCard({ item }: { item: CatalogItem }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <article className="overflow-hidden rounded-xl border border-[#30363d] bg-[#161b22] hover:border-[#484f58]">
      <button onClick={() => setExpanded((value) => !value)} className="w-full p-5 text-left">
        <div className="mb-3 flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${item.isChip ? 'bg-blue-500/15 text-blue-400' : 'bg-purple-500/15 text-purple-400'}`}>{item.isChip ? <Cpu size={20} /> : <PackageSearch size={20} />}</div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold">{item.name}</h3>
            <p className="truncate text-xs text-gray-400">
              {item.manufacturer} · {item.subcategory}
            </p>
          </div>
          <span className="rounded bg-[#0d1117] px-2 py-1 text-[10px] text-gray-500">{item.category}</span>
        </div>
        <p className="line-clamp-2 min-h-10 text-sm leading-5 text-gray-400">{item.description}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {Object.entries(item.parameters)
            .slice(0, 4)
            .map(([key, value]) => (
              <div key={key} className="rounded-md bg-[#0d1117] px-2.5 py-2">
                <div className="text-[10px] text-gray-600">{key}</div>
                <div className="mt-0.5 truncate text-xs text-gray-200">{value}</div>
              </div>
            ))}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-[#30363d] px-5 py-4">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <span key={tag} className="flex items-center gap-1 rounded bg-[#0d1117] px-2 py-0.5 text-[10px] text-gray-500">
                <Tag size={9} />
                {tag}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-gray-500">封装：{item.package}</span>
            <div className="flex gap-3">
              {item.reference && (
                <a href={item.reference} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-green-400">
                  <BookOpen size={13} />
                  参考手册
                </a>
              )}
              {item.datasheetUrl ? (
                <a href={item.datasheetUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-400">
                  <ExternalLink size={13} />
                  数据手册
                </a>
              ) : (
                <span className="text-gray-600">可使用在线查询</span>
              )}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

const linkStyles: Record<string, { bg: string; text: string }> = {
  blue: { bg: 'from-blue-500/20 to-cyan-500/20', text: 'text-blue-400' },
  purple: { bg: 'from-purple-500/20 to-pink-500/20', text: 'text-purple-400' },
  yellow: {
    bg: 'from-yellow-500/20 to-orange-500/20',
    text: 'text-yellow-400',
  },
  green: { bg: 'from-green-500/20 to-teal-500/20', text: 'text-green-400' },
};

function LinkSection({ title, icon: Icon, color, items }: { title: string; icon: typeof FileText; color: string; items: PartLink[] }) {
  const style = linkStyles[color] ?? linkStyles.blue;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Icon size={16} className={style.text} />
          {title}
        </h3>
        <span className="text-xs text-gray-600">{items.length} 个来源</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <a key={`${item.source}-${item.type}`} href={item.link} target="_blank" rel="noopener noreferrer" className="group flex gap-3 rounded-lg border border-[#30363d] bg-[#161b22] p-4 hover:border-[#484f58]">
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br ${style.bg}`}>
              <ExternalLink size={14} className={style.text} />
            </div>
            <div className="min-w-0">
              <h4 className="truncate text-sm font-medium group-hover:text-blue-300">{item.name}</h4>
              <p className="mt-0.5 text-xs text-gray-400">{item.source}</p>
              <p className="mt-1 text-xs text-gray-600">{item.description}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
