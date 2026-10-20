import type { PartDocumentKind } from '../../types';

export type DocumentAccess = 'official-direct' | 'official-search' | 'site-search' | 'web-search';

export interface PartDocumentLink {
  id: string;
  kind: PartDocumentKind;
  title: string;
  description: string;
  url: string;
  sourceName: string;
  access: DocumentAccess;
  authoritative: boolean;
  scope: 'exact-model' | 'family' | 'manufacturer-search' | 'web-search';
}

export interface PartDocumentDiscoveryInput {
  model: string;
  manufacturer?: string;
  category?: string;
  isMcu?: boolean;
  datasheetUrl?: string;
  referenceUrl?: string;
  productUrl?: string;
}

interface ManufacturerAdapter {
  aliases: string[];
  name: string;
  domains: string[];
  search?: (terms: string) => string;
}

const manufacturers: ManufacturerAdapter[] = [
  { aliases: ['stmicro', 'st micro'], name: 'STMicroelectronics', domains: ['st.com'], search: (terms) => `https://www.st.com/content/st_com/en/search.html#q=${encodeURIComponent(terms)}` },
  { aliases: ['nxp'], name: 'NXP', domains: ['nxp.com'], search: (terms) => `https://www.nxp.com/search?keyword=${encodeURIComponent(terms)}` },
  { aliases: ['texas instruments', 'texas instrument', 'ti'], name: 'Texas Instruments', domains: ['ti.com'], search: (terms) => `https://www.ti.com/sitesearch/en-us/docs/universalsearch.tsp?searchTerm=${encodeURIComponent(terms)}` },
  { aliases: ['microchip', 'atmel'], name: 'Microchip', domains: ['microchip.com'], search: (terms) => `https://www.microchip.com/en-us/search?searchQuery=${encodeURIComponent(terms)}` },
  { aliases: ['nordic'], name: 'Nordic Semiconductor', domains: ['nordicsemi.com'], search: (terms) => `https://www.nordicsemi.com/search?query=${encodeURIComponent(terms)}` },
  { aliases: ['infineon', 'cypress'], name: 'Infineon', domains: ['infineon.com'], search: (terms) => `https://www.infineon.com/search?query=${encodeURIComponent(terms)}` },
  { aliases: ['renesas'], name: 'Renesas', domains: ['renesas.com'], search: (terms) => `https://www.renesas.com/en/search?keywords=${encodeURIComponent(terms)}` },
  { aliases: ['espressif'], name: 'Espressif', domains: ['espressif.com'], search: (terms) => `https://www.espressif.com/en/search/node?keys=${encodeURIComponent(terms)}` },
  { aliases: ['gigadevice', 'gd32'], name: 'GigaDevice', domains: ['gd-mcu.com', 'gigadevice.com'] },
  { aliases: ['wch', 'nanjing qinheng'], name: 'WCH', domains: ['wch-ic.com'] },
  { aliases: ['raspberry pi'], name: 'Raspberry Pi', domains: ['raspberrypi.com'] },
  { aliases: ['bosch sensortec', 'bosch'], name: 'Bosch Sensortec', domains: ['bosch-sensortec.com'] },
  { aliases: ['analog devices', 'maxim'], name: 'Analog Devices', domains: ['analog.com'] },
  { aliases: ['silicon labs', 'silabs'], name: 'Silicon Labs', domains: ['silabs.com'] },
  { aliases: ['wiznet'], name: 'WIZnet', domains: ['wiznet.io'] },
  { aliases: ['winbond'], name: 'Winbond', domains: ['winbond.com'] },
  { aliases: ['sensirion'], name: 'Sensirion', domains: ['sensirion.com'] },
];

const descriptions: Record<PartDocumentKind, string> = {
  datasheet: '引脚、封装、电气特性、时序与极限参数',
  'reference-manual': '外设功能、寄存器、时钟和详细工作方式',
  'user-guide': '开发板、评估套件或器件的安装、配置与操作步骤',
  'programming-manual': '内核、指令、异常、中断和软件编程模型',
  'application-note': '典型电路、软件示例、参数计算与应用限制',
  errata: '已知芯片问题、受影响版本和官方规避方法',
  'hardware-design-guide': '供电、布局、布线、接口保护与硬件设计建议',
  'getting-started-guide': '从工具准备到首个示例运行的入门流程',
  'product-page': '厂商发布的最新文档、工具、软件和生命周期信息',
  other: '其他技术资料',
};

const queries: Partial<Record<PartDocumentKind, string>> = {
  datasheet: 'datasheet',
  'reference-manual': 'reference manual',
  'user-guide': 'user guide user manual usage manual',
  'programming-manual': 'programming manual',
  'application-note': 'application note',
  errata: 'errata sheet',
  'hardware-design-guide': 'hardware design guide layout guideline',
  'getting-started-guide': 'getting started guide quick start',
  'product-page': 'product page technical documents',
};

const titles: Record<PartDocumentKind, string> = {
  datasheet: '数据手册',
  'reference-manual': '参考手册',
  'user-guide': '用户／使用手册',
  'programming-manual': '编程手册',
  'application-note': '应用笔记',
  errata: '勘误',
  'hardware-design-guide': '硬件设计指南',
  'getting-started-guide': '入门指南',
  'product-page': '官方产品页',
  other: '其他资料',
};

function safeHttpUrl(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function adapterFor(manufacturer?: string, ...urls: Array<string | undefined>) {
  const normalized = manufacturer?.trim().toLowerCase() ?? '';
  const byName = manufacturers.find((adapter) => adapter.aliases.some((alias) => normalized.includes(alias)));
  if (byName) return byName;
  for (const value of urls) {
    const safe = safeHttpUrl(value);
    if (!safe) continue;
    const hostname = new URL(safe).hostname.toLowerCase();
    const byDomain = manufacturers.find((adapter) => adapter.domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`)));
    if (byDomain) return byDomain;
  }
  return undefined;
}

function officialUrl(url: string, adapter?: ManufacturerAdapter) {
  if (!adapter) return false;
  const hostname = new URL(url).hostname.toLowerCase();
  return adapter.domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

function searchLink(model: string, kind: PartDocumentKind, adapter?: ManufacturerAdapter): Pick<PartDocumentLink, 'url' | 'sourceName' | 'access' | 'authoritative' | 'scope'> {
  const terms = `${model} ${queries[kind] ?? 'technical document'}`.trim();
  if (adapter?.search) return { url: adapter.search(terms), sourceName: adapter.name, access: 'official-search', authoritative: true, scope: 'manufacturer-search' };
  if (adapter) return { url: `https://www.bing.com/search?q=${encodeURIComponent(`site:${adapter.domains[0]} ${terms} PDF`)}`, sourceName: adapter.name, access: 'site-search', authoritative: false, scope: 'manufacturer-search' };
  return { url: `https://www.bing.com/search?q=${encodeURIComponent(`${terms} PDF manufacturer official`)}`, sourceName: '厂商待确认', access: 'web-search', authoritative: false, scope: 'web-search' };
}

export function buildOfficialDocumentLinks(input: PartDocumentDiscoveryInput): PartDocumentLink[] {
  const model = input.model.trim().slice(0, 160);
  if (!model) return [];
  const adapter = adapterFor(input.manufacturer, input.productUrl, input.datasheetUrl, input.referenceUrl);
  const isMcu = input.isMcu ?? /微控制器|处理器|\bMCU\b/i.test(input.category ?? '');
  const kinds: PartDocumentKind[] = isMcu
    ? ['datasheet', 'reference-manual', 'user-guide', 'programming-manual', 'application-note', 'errata', 'hardware-design-guide', 'getting-started-guide', 'product-page']
    : ['datasheet', 'user-guide', 'application-note', 'errata', 'hardware-design-guide', 'getting-started-guide', 'product-page'];
  const direct = new Map<PartDocumentKind, string | undefined>([
    ['datasheet', safeHttpUrl(input.datasheetUrl)],
    ['reference-manual', safeHttpUrl(input.referenceUrl)],
    ['product-page', safeHttpUrl(input.productUrl)],
  ]);

  return kinds.slice(0, 12).map((kind) => {
    const url = direct.get(kind);
    const discovered = url
      ? { url, sourceName: adapter?.name ?? input.manufacturer?.trim() ?? '外部来源', access: 'official-direct' as const, authoritative: officialUrl(url, adapter), scope: 'exact-model' as const }
      : searchLink(model, kind, adapter);
    return { id: `${model.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'part'}:${kind}`, kind, title: titles[kind], description: descriptions[kind], ...discovered };
  });
}

export function documentAccessLabel(link: PartDocumentLink) {
  if (link.access === 'official-direct' && link.authoritative) return '官方直链';
  if (link.access === 'official-direct') return '外部直链 · 待核验';
  if (link.access === 'official-search') return '厂商官网检索';
  if (link.access === 'site-search') return '官方站点定向搜索';
  return 'Web 检索 · 厂商待确认';
}
