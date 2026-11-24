export interface PartCatalogItem {
  name: string;
  manufacturer: string;
  category: string;
  subcategory: string;
  description: string;
  package: string;
  parameters: Record<string, string>;
  tags: string[];
  isChip?: boolean;
}

export type PartSearchLinkType = 'datasheet' | 'cad' | 'alternative' | 'distributor';

export interface PartSearchLink {
  name: string;
  source: string;
  description: string;
  link: string;
  type: PartSearchLinkType;
}

const link = (query: string, source: string, suffix: string, description: string, url: string, type: PartSearchLinkType): PartSearchLink => ({
  name: `${query} ${suffix}`,
  source,
  description,
  link: url,
  type,
});

export function buildPartSearchLinks(value: string): PartSearchLink[] {
  const query = value.trim(), encoded = encodeURIComponent(query);
  if (query.length < 2) return [];
  return [
    link(query, 'AllDatasheet', '数据手册', '按完整型号查询 PDF 数据手册', `https://www.alldatasheet.com/view.jsp?Searchword=${encoded}`, 'datasheet'),
    link(query, 'Datasheet Archive', '技术资料', '元器件数据手册与历史型号检索', `https://www.datasheetarchive.com/?q=${encoded}`, 'datasheet'),
    link(query, 'SnapMagic', '符号与封装', '查询原理图符号、PCB 封装与 3D 模型', `https://www.snapeda.com/search/?q=${encoded}`, 'cad'),
    link(query, 'Ultra Librarian', 'CAD 模型', '查询封装、符号及 3D 模型', `https://www.ultralibrarian.com/search?query=${encoded}`, 'cad'),
    link(query, '半导小芯', '替代型号', '查询参数相近器件与国产替代型号', `https://www.semiee.com/search?searchModel=${encoded}`, 'alternative'),
    link(query, 'Findchips', '交叉参考', '比较型号、库存及交叉参考信息', `https://www.findchips.com/search/${encoded}`, 'alternative'),
    link(query, 'Octopart', '库存与价格', '聚合多个授权分销商的库存和价格', `https://octopart.com/search?q=${encoded}`, 'distributor'),
    link(query, '立创商城', '国内采购', '查询参数、数据手册、库存和价格', `https://so.szlcsc.com/global.html?k=${encoded}`, 'distributor'),
    link(query, 'DigiKey', '授权采购', '查询可订购型号、参数和库存', `https://www.digikey.cn/zh/products/result?keywords=${encoded}`, 'distributor'),
    link(query, 'Mouser', '授权采购', '查询元器件参数、生命周期和库存', `https://www.mouser.cn/c/?q=${encoded}`, 'distributor'),
  ];
}

export function normalizePartModel(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function filterPartCatalog<T extends PartCatalogItem>(catalog: T[], query: string, category = '', manufacturer = ''): T[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  return catalog.filter(item => {
    const searchable = [item.name, item.manufacturer, item.category, item.subcategory, item.description, item.package, ...item.tags, ...Object.keys(item.parameters), ...Object.values(item.parameters)].join(' ').toLowerCase();
    return (!tokens.length || tokens.every(token => searchable.includes(token))) && (!category || item.category === category) && (!manufacturer || item.manufacturer === manufacturer);
  });
}

export function findExactPart<T extends PartCatalogItem>(catalog: T[], filtered: T[], query: string): T | null {
  if (query.trim().length < 2) return null;
  const model = normalizePartModel(query);
  return catalog.find(item => normalizePartModel(item.name) === model) ?? (filtered.length === 1 ? filtered[0] : null);
}

export function describeTypicalPartUse(item: PartCatalogItem) {
  if (!item.isChip) return item.description;
  const text = `${item.name} ${item.subcategory} ${item.tags.join(' ')}`.toUpperCase();
  if (/ESP|WIFI|BLUETOOTH|BLE/.test(text)) return '适合物联网终端、无线传感器、智能家居、设备联网和边缘控制。';
  if (/NRF/.test(text)) return '适合低功耗蓝牙设备、可穿戴设备、无线传感器和遥控器。';
  if (/IMX|CORTEX-A/.test(text)) return '适合嵌入式 Linux、图形界面、边缘网关和高性能人机交互。';
  if (/RP2|AVR|ATMEGA|ATTINY/.test(text)) return '适合入门开发、教育实验、简单控制器和低成本原型。';
  if (/CAN|ETH|STM32|GD32|CH32|CORTEX-M/.test(text)) return '适合工业控制、仪器仪表、电机控制、数据采集和通信网关。';
  return '适合通用嵌入式控制、外设驱动、数据采集和实时任务处理。';
}

export function supportsPartDocumentation(item: PartCatalogItem) {
  return Boolean(item.isChip) || !['无源器件', '连接器'].includes(item.category);
}
