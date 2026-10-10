export type MapFormat = 'keil-armcc' | 'keil-armclang' | 'iar' | 'gnu' | 'unknown';
export type MapSeverity = 'critical' | 'warning' | 'info' | 'success';

export interface MapRegion { name: string; origin: number; length: number; used: number; attributes: string }
export interface MapSection { name: string; address: number; size: number; module?: string }
export interface MapModule { name: string; code: number; roData: number; rwData: number; ziData: number; total: number }
export interface MapSymbol { name: string; address: number; size: number; section: string; module?: string }
export interface MapCoverage {
  score: number;
  confidence: 'high' | 'medium' | 'low';
  evidence: string[];
  capabilities: { totals: boolean; capacity: boolean; modules: boolean; sections: boolean; symbols: boolean };
}
export interface MapInsight {
  id: string;
  severity: MapSeverity;
  category: 'capacity' | 'module' | 'symbol' | 'layout' | 'quality';
  title: string;
  detail: string;
  recommendation: string;
  bytes?: number;
  module?: string;
  symbol?: string;
  section?: string;
}
export interface MapOptimization {
  id: string;
  target: 'flash' | 'ram' | 'both';
  title: string;
  minBytes: number;
  maxBytes: number;
  confidence: 'high' | 'medium' | 'low';
  basis: string;
  action: string;
  module?: string;
  symbol?: string;
}
export interface MapAnalysis {
  format: MapFormat;
  formatLabel: string;
  regions: MapRegion[];
  sections: MapSection[];
  modules: MapModule[];
  symbols: MapSymbol[];
  totals: { flash: number; ram: number; code: number; roData: number; rwData: number; ziData: number };
  coverage: MapCoverage;
  insights: MapInsight[];
  optimizations: MapOptimization[];
  warnings: string[];
}
export interface MapDeltaItem { name: string; before: number; after: number; delta: number }
export interface MapComparison {
  status: 'improved' | 'regressed' | 'mixed' | 'unchanged' | 'insufficient';
  confidence: 'high' | 'medium' | 'low';
  totals: MapAnalysis['totals'];
  modules: MapDeltaItem[];
  symbols: MapDeltaItem[];
  warnings: string[];
}

interface ParsedMap extends Omit<MapAnalysis, 'format' | 'formatLabel' | 'coverage' | 'insights' | 'optimizations'> { evidence: string[] }

const EMPTY_TOTALS = { flash: 0, ram: 0, code: 0, roData: 0, rwData: 0, ziData: 0 };
const hex = (value: string) => Number.parseInt(value.replace(/^0x/i, '').replace(/h$/i, ''), 16) || 0;
const numeric = (value: string) => /^(?:0x[\da-f]+|[\da-f]+h)$/i.test(value.trim()) ? hex(value.trim()) : Number.parseInt(value.replace(/[,']/g, ''), 10) || 0;
const basename = (value: string) => {
  const normalized = value.trim().replace(/\\/g, '/').replace(/^LOAD\s+/i, '');
  const archive = normalized.match(/([^/\s]+\.(?:a|lib))\(([^()]+\.(?:o|obj))\)/i);
  return archive ? `${archive[1]}(${archive[2]})` : normalized.split('/').pop() || normalized;
};
const unique = <T>(items: T[], key: (item: T) => string) => [...new Map(items.map(item => [key(item), item])).values()];
const sectionKind = (name: string) => {
  const value = name.toLowerCase();
  if (/(?:^|\.)(?:bss|zi|noinit|heap|stack|common)(?:\.|$)/.test(value)) return 'zi';
  if (/(?:^|\.)(?:data|rw|sdata)(?:\.|$)/.test(value)) return 'rw';
  if (/(?:^|\.)(?:rodata|const|ro)(?:\.|$)/.test(value)) return 'ro';
  if (/(?:^|\.)(?:text|code|init|fini|vectors?|isr_vector)(?:\.|$)/.test(value)) return 'code';
  return 'other';
};

export function detectMapFormat(content: string): MapFormat {
  const scores: Record<Exclude<MapFormat, 'unknown'>, number> = { 'keil-armcc': 0, 'keil-armclang': 0, iar: 0, gnu: 0 };
  if (/ARM Linker|Memory Map of the image|Image component sizes|Execution Region/i.test(content)) scores['keil-armcc'] += 4;
  if (/ArmClang|armlink.*6\.|LLVM Linker|Toolchain:\s*Arm Compiler 6/i.test(content)) scores['keil-armclang'] += 6;
  if (/IAR ELF Linker|ILINK|MODULE SUMMARY|PLACEMENT SUMMARY|CROSS REFERENCE.*IAR/i.test(content)) scores.iar += 5;
  if (/Linker script and memory map|Memory Configuration|GNU ld|LOAD\s+.*\.(?:o|a)\b|OUTPUT\(/i.test(content)) scores.gnu += 4;
  const [format, score] = (Object.entries(scores) as [Exclude<MapFormat, 'unknown'>, number][]).sort((a, b) => b[1] - a[1])[0];
  return score > 0 ? format : 'unknown';
}

function addModule(target: Map<string, MapModule>, name: string, code: number, roData: number, rwData: number, ziData: number) {
  const key = basename(name);
  if (!key || ![code, roData, rwData, ziData].some(Boolean)) return;
  const current = target.get(key) ?? { name: key, code: 0, roData: 0, rwData: 0, ziData: 0, total: 0 };
  current.code += code;
  current.roData += roData;
  current.rwData += rwData;
  current.ziData += ziData;
  current.total = current.code + current.roData + current.rwData + current.ziData;
  target.set(key, current);
}

function addByKind(target: Map<string, MapModule>, module: string, name: string, size: number) {
  const kind = sectionKind(name);
  addModule(target, module, kind === 'code' ? size : 0, kind === 'ro' ? size : 0, kind === 'rw' ? size : 0, kind === 'zi' ? size : 0);
}

function totalsFromSections(sections: MapSection[]) {
  const aggregate = sections.filter(item => !item.module);
  const source = aggregate.length ? aggregate : sections;
  const totals = { ...EMPTY_TOTALS };
  for (const item of source) {
    const kind = sectionKind(item.name);
    if (kind === 'code') totals.code += item.size;
    if (kind === 'ro') totals.roData += item.size;
    if (kind === 'rw') totals.rwData += item.size;
    if (kind === 'zi') totals.ziData += item.size;
  }
  totals.flash = totals.code + totals.roData + totals.rwData;
  totals.ram = totals.rwData + totals.ziData;
  return totals;
}

function parseGnu(content: string): ParsedMap {
  const regions: MapRegion[] = [], sections: MapSection[] = [], symbols: MapSymbol[] = [], modules = new Map<string, MapModule>();
  const warnings: string[] = [], evidence: string[] = [];
  const lines = content.split(/\r?\n/);
  let inMemory = false, currentSection = '';
  for (const line of lines) {
    if (/^\s*Memory Configuration\s*$/i.test(line)) { inMemory = true; evidence.push('Memory Configuration'); continue; }
    if (inMemory && /^\s*(?:Linker script and memory map|Linker script)/i.test(line)) { inMemory = false; continue; }
    if (inMemory) {
      const match = line.match(/^\s*(\S+)\s+(0x[\da-f]+)\s+(0x[\da-f]+)\s*(\S*)/i);
      if (match && !/^name$/i.test(match[1])) regions.push({ name: match[1], origin: hex(match[2]), length: hex(match[3]), used: 0, attributes: match[4] || '' });
      continue;
    }
    const output = line.match(/^(\.[\w.$+-]+)\s+(0x[\da-f]+)\s+(0x[\da-f]+)(?:\s+(.+))?$/i);
    if (output) { currentSection = output[1]; sections.push({ name: output[1], address: hex(output[2]), size: hex(output[3]), module: output[4]?.trim() }); continue; }
    const contribution = line.match(/^\s+(\.[^\s]+)\s+(0x[\da-f]+)\s+(0x[\da-f]+)\s+(.+?(?:\.(?:o|obj|a|lib)(?:\)|\b)).*)$/i);
    if (contribution) {
      const item = { name: contribution[1], address: hex(contribution[2]), size: hex(contribution[3]), module: contribution[4].trim() };
      sections.push(item); addByKind(modules, item.module, item.name, item.size); currentSection = item.name; continue;
    }
    const symbolWithSize = line.match(/^\s*(0x[\da-f]+)\s+(0x[\da-f]+)\s+([A-Za-z_.$][\w.$@+-]*)\s*$/i);
    const symbol = symbolWithSize ?? line.match(/^\s*(0x[\da-f]+)\s+([A-Za-z_.$][\w.$@+-]*)\s*$/i);
    if (symbol && currentSection) symbols.push(symbolWithSize ? { name: symbol[3], address: hex(symbol[1]), size: hex(symbol[2]), section: currentSection } : { name: symbol[2], address: hex(symbol[1]), size: 0, section: currentSection });
  }
  const aggregate = sections.filter(item => !item.module), regionSections = aggregate.length ? aggregate : sections;
  for (const region of regions) {
    const end = region.origin + region.length;
    region.used = regionSections.reduce((sum, section) => sum + Math.max(0, Math.min(end, section.address + section.size) - Math.max(region.origin, section.address)), 0);
  }
  if (sections.length) evidence.push(`${sections.length} 个 Section`);
  if (modules.size) evidence.push(`${modules.size} 个目标文件/库`);
  if (!regions.length) warnings.push('未找到 Memory Configuration，无法确定 Flash/RAM 的物理容量。');
  return { regions: unique(regions, item => `${item.name}:${item.origin}`), sections, modules: [...modules.values()].sort((a, b) => b.total - a.total), symbols, totals: totalsFromSections(sections), warnings, evidence };
}

function parseKeil(content: string): ParsedMap {
  const regions: MapRegion[] = [], sections: MapSection[] = [], modules = new Map<string, MapModule>(), symbols: MapSymbol[] = [];
  const warnings: string[] = [], evidence: string[] = [];
  let componentRows = 0;
  for (const line of content.split(/\r?\n/)) {
    const region = line.match(/Execution Region\s+(\S+)\s+\(Exec base:\s*(0x[\da-f]+).*?Size:\s*(0x[\da-f]+).*?Max:\s*(0x[\da-f]+)/i);
    if (region) { const used = hex(region[3]); regions.push({ name: region[1], origin: hex(region[2]), length: hex(region[4]), used, attributes: '' }); sections.push({ name: region[1], address: hex(region[2]), size: used }); continue; }
    const component = line.match(/^\s*([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)(?:\s+[\d,]+)?\s+(.+?\.(?:o|obj|a|lib)(?:\)|\s*$).*)$/i);
    if (component) { addModule(modules, component[6], numeric(component[1]), numeric(component[3]), numeric(component[4]), numeric(component[5])); componentRows += 1; continue; }
    const memoryRow = line.match(/^\s*(0x[\da-f]+)\s+(0x[\da-f]+)\s+(?:Code|Data|Zero)\s+(?:RO|RW)\s+\d+\s+([^\s]+)\s+(.+?\.(?:o|obj|a|lib).*)$/i);
    if (memoryRow) { sections.push({ name: memoryRow[3], address: hex(memoryRow[1]), size: hex(memoryRow[2]), module: memoryRow[4].trim() }); continue; }
    const symbol = line.match(/^\s*(\S+)\s+(0x[\da-f]+)\s+(?:Thumb|ARM|Data|Number)\s+([\d,]+)\s+(.+?\.(?:o|obj).*)$/i);
    if (symbol) symbols.push({ name: symbol[1], address: hex(symbol[2]), size: numeric(symbol[3]), section: '', module: basename(symbol[4]) });
  }
  if (regions.length) evidence.push(`${regions.length} 个 Execution Region`);
  if (componentRows) evidence.push(`Image component sizes：${componentRows} 行`);
  if (symbols.length) evidence.push(`${symbols.length} 个符号`);
  const values = [...modules.values()].sort((a, b) => b.total - a.total);
  const totals = values.reduce((all, item) => ({ flash: all.flash + item.code + item.roData + item.rwData, ram: all.ram + item.rwData + item.ziData, code: all.code + item.code, roData: all.roData + item.roData, rwData: all.rwData + item.rwData, ziData: all.ziData + item.ziData }), { ...EMPTY_TOTALS });
  if (!values.length) warnings.push('未找到 Image component sizes 模块汇总表，模块排行不可用。');
  return { regions, sections, modules: values, symbols: symbols.sort((a, b) => b.size - a.size), totals, warnings, evidence };
}

function parseIar(content: string): ParsedMap {
  const modules = new Map<string, MapModule>(), sections: MapSection[] = [], regions: MapRegion[] = [], symbols: MapSymbol[] = [];
  const warnings: string[] = [], evidence: string[] = [];
  for (const line of content.split(/\r?\n/)) {
    const row = line.match(/^\s*(.+?\.(?:o|obj|r\d+|a|lib)(?:\([^)]*\))?)\s+([\d,']+)\s+([\d,']+)\s+([\d,']+)\s+([\d,']+)\s*$/i);
    if (row) { addModule(modules, row[1], numeric(row[2]), numeric(row[3]), numeric(row[4]), numeric(row[5])); continue; }
    const section = line.match(/^\s*([.\w$-]+)\s+(0x[\da-f]+)\s+(0x[\da-f]+|[\d,']+)(?:\s+(.+?\.(?:o|obj|a|lib).*))?\s*$/i);
    if (section) { const item = { name: section[1], address: hex(section[2]), size: numeric(section[3]), module: section[4]?.trim() }; sections.push(item); if (item.module) addByKind(modules, item.module, item.name, item.size); }
    const region = line.match(/^\s*([\w.$-]+)\s+(0x[\da-f]+)\s*-\s*(0x[\da-f]+)\s+([\d,']+)\s+bytes/i);
    if (region) regions.push({ name: region[1], origin: hex(region[2]), length: hex(region[3]) - hex(region[2]) + 1, used: numeric(region[4]), attributes: '' });
  }
  const read = (pattern: RegExp) => { const match = content.match(pattern); return match ? numeric(match[1]) : 0; };
  const code = read(/([\d,']+)\s+bytes? of readonly\s+code memory/i), roData = read(/([\d,']+)\s+bytes? of readonly\s+data memory/i), rwData = read(/([\d,']+)\s+bytes? of readwrite\s+data memory/i);
  let ziData = read(/([\d,']+)\s+bytes? of zero initialized\s+data memory/i);
  const totalRw = read(/([\d,']+)\s+bytes? of readwrite\s+memory/i);
  if (!ziData && totalRw > rwData) ziData = totalRw - rwData;
  if (code || roData || rwData || ziData) evidence.push('IAR memory summary');
  if (regions.length) evidence.push(`${regions.length} 个内存范围`);
  const values = [...modules.values()].sort((a, b) => b.total - a.total);
  if (values.length) evidence.push(`${values.length} 个模块`);
  if (!values.length) warnings.push('未找到可识别的 IAR MODULE SUMMARY，模块排行不可用。');
  return { regions, sections, modules: values, symbols, totals: { flash: code + roData + rwData, ram: rwData + ziData, code, roData, rwData, ziData }, warnings, evidence };
}

function coverageOf(parsed: ParsedMap, format: MapFormat): MapCoverage {
  const capabilities = { totals: parsed.totals.flash > 0 || parsed.totals.ram > 0, capacity: parsed.regions.some(item => item.length > 0), modules: parsed.modules.length > 0, sections: parsed.sections.length > 0, symbols: parsed.symbols.length > 0 };
  const score = Math.min(100, (format === 'unknown' ? 0 : 20) + (capabilities.totals ? 25 : 0) + (capabilities.capacity ? 20 : 0) + (capabilities.modules ? 20 : 0) + (capabilities.sections ? 10 : 0) + (capabilities.symbols ? 5 : 0));
  return { score, confidence: score >= 75 ? 'high' : score >= 45 ? 'medium' : 'low', evidence: parsed.evidence, capabilities };
}

function buildInsights(parsed: ParsedMap, coverage: MapCoverage): MapInsight[] {
  const insights: MapInsight[] = [];
  for (const region of parsed.regions.filter(item => item.length > 0)) {
    const rate = region.used / region.length, remaining = region.length - region.used;
    if (rate >= 1) insights.push({ id: `region-overflow:${region.name}`, severity: 'critical', category: 'capacity', title: `${region.name} 已超出或用满`, detail: `使用率 ${(rate * 100).toFixed(1)}%，剩余 ${remaining} 字节。`, recommendation: '立即检查链接布局、区域容量配置和最近新增模块。', bytes: remaining, section: region.name });
    else if (rate >= 0.9) insights.push({ id: `region-critical:${region.name}`, severity: 'critical', category: 'capacity', title: `${region.name} 空间不足`, detail: `已使用 ${(rate * 100).toFixed(1)}%，仅剩 ${remaining.toLocaleString()} 字节。`, recommendation: '优先查看模块增长和大符号，给量产版本保留升级与配置余量。', bytes: remaining, section: region.name });
    else if (rate >= 0.75) insights.push({ id: `region-warning:${region.name}`, severity: 'warning', category: 'capacity', title: `${region.name} 余量偏低`, detail: `已使用 ${(rate * 100).toFixed(1)}%，剩余 ${remaining.toLocaleString()} 字节。`, recommendation: '建立版本基线并关注后续增长；检查是否存在可裁剪组件。', bytes: remaining, section: region.name });
  }
  const totalModule = parsed.modules.reduce((sum, item) => sum + item.total, 0);
  for (const [index, module] of parsed.modules.slice(0, 5).entries()) {
    const share = totalModule ? module.total / totalModule : 0;
    if (index < 3 || share >= 0.1) insights.push({ id: `module:${module.name}`, severity: share >= 0.25 ? 'warning' : 'info', category: 'module', title: `${module.name} 占用 ${module.total.toLocaleString()} 字节`, detail: `在已解析模块中占 ${(share * 100).toFixed(1)}%；Code ${module.code.toLocaleString()}，RO ${module.roData.toLocaleString()}，RW ${module.rwData.toLocaleString()}，ZI ${module.ziData.toLocaleString()}。`, recommendation: module.ziData >= Math.max(module.code, module.roData) ? '重点检查静态数组、通信缓存和任务栈配置。' : '点击定位对应源码，结合功能必要性检查可裁剪代码与常量。', bytes: module.total, module: module.name });
  }
  for (const symbol of parsed.symbols.filter(item => item.size > 0).sort((a, b) => b.size - a.size).slice(0, 3)) insights.push({ id: `symbol:${symbol.name}:${symbol.address}`, severity: 'info', category: 'symbol', title: `大符号 ${symbol.name}`, detail: `${symbol.size.toLocaleString()} 字节，位于 ${symbol.section || '未知 Section'}${symbol.module ? `，来自 ${symbol.module}` : ''}。`, recommendation: '确认尺寸符合设计，数组/缓存应结合真实峰值设置。', bytes: symbol.size, module: symbol.module, symbol: symbol.name, section: symbol.section });
  const layout = parsed.sections.filter(item => /(?:padding|pad|fill|\.ARM\.exidx|\.debug)/i.test(item.name) && item.size > 0).sort((a, b) => b.size - a.size)[0];
  if (layout) insights.push({ id: `layout:${layout.name}:${layout.address}`, severity: 'info', category: 'layout', title: `布局占用：${layout.name}`, detail: `${layout.size.toLocaleString()} 字节。`, recommendation: '检查对齐、链接脚本和调试段是否计入最终镜像。', bytes: layout.size, module: layout.module, section: layout.name });
  if (coverage.score < 45) insights.unshift({ id: 'quality:low', severity: 'warning', category: 'quality', title: '当前结论完整度较低', detail: `仅识别到 ${coverage.score}% 的核心信息，不能据此判断全部内存风险。`, recommendation: '确认导入的是链接器完整 MAP，而不是简化摘要；仍可在 Section/符号页查看已识别内容。' });
  if (!insights.some(item => item.severity === 'critical' || item.severity === 'warning') && coverage.score >= 45) insights.unshift({ id: 'quality:ok', severity: 'success', category: 'quality', title: '未发现明确的容量风险', detail: '已解析范围内没有区域达到 75% 告警线。', recommendation: '建议保留此 MAP 作为版本基线，后续使用版本对比监控增长。' });
  return insights;
}

function buildOptimizations(parsed: ParsedMap): MapOptimization[] {
  const opportunities: MapOptimization[] = [];
  const layout = parsed.sections.filter(item => /(?:padding|pad|fill)/i.test(item.name) && item.size > 0).sort((a, b) => b.size - a.size)[0];
  if (layout) opportunities.push({ id: `padding:${layout.name}:${layout.address}`, target: 'flash', title: `压缩 ${layout.name} 对齐填充`, minBytes: Math.floor(layout.size * 0.25), maxBytes: layout.size, confidence: 'medium', basis: `MAP 中该布局段占用 ${layout.size.toLocaleString()} 字节；可释放量取决于链接顺序和对齐约束。`, action: '按对齐要求重排 Section 或调整链接脚本，修改后对比 MAP 验证。', module: layout.module });
  const ziModules = parsed.modules.filter(item => item.ziData >= 1024).sort((a, b) => b.ziData - a.ziData).slice(0, 3);
  for (const module of ziModules) opportunities.push({ id: `zi:${module.name}`, target: 'ram', title: `核查 ${module.name} 静态内存`, minBytes: Math.floor(module.ziData * 0.05), maxBytes: Math.floor(module.ziData * 0.25), confidence: 'low', basis: `该模块 ZI/BSS 为 ${module.ziData.toLocaleString()} 字节，通常来自缓冲区、数组、任务栈或对象池。`, action: '测量真实峰值后调整缓存、队列、栈深度或对象池；未测量前不要直接缩小。', module: module.name });
  const codeModules = parsed.modules.filter(item => item.code + item.roData >= 4096).sort((a, b) => b.code + b.roData - a.code - a.roData).slice(0, 2);
  for (const module of codeModules) {
    const flash = module.code + module.roData;
    opportunities.push({ id: `flash:${module.name}`, target: 'flash', title: `评估 ${module.name} 功能裁剪`, minBytes: Math.floor(flash * 0.03), maxBytes: Math.floor(flash * 0.15), confidence: 'low', basis: `该模块 Code+RO 为 ${flash.toLocaleString()} 字节；估算区间来自功能裁剪和常量合并，不代表必然可释放。`, action: '检查未启用功能、日志、协议选项和重复常量；通过编译开关逐项验证。', module: module.name });
  }
  const largeSymbols = parsed.symbols.filter(item => item.size >= 1024 && item.module).sort((a, b) => b.size - a.size).slice(0, 2);
  for (const symbol of largeSymbols) opportunities.push({ id: `symbol-opt:${symbol.name}:${symbol.address}`, target: sectionKind(symbol.section) === 'zi' || sectionKind(symbol.section) === 'rw' ? 'ram' : 'flash', title: `复核大对象 ${symbol.name}`, minBytes: Math.floor(symbol.size * 0.1), maxBytes: Math.floor(symbol.size * 0.3), confidence: 'medium', basis: `符号尺寸 ${symbol.size.toLocaleString()} 字节，可直接定位到对象级别核查。`, action: '确认元素数量、数据类型、生命周期和峰值；可考虑缩窄类型、按需分配或复用。', module: symbol.module, symbol: symbol.name });
  return opportunities.sort((a, b) => b.maxBytes - a.maxBytes).slice(0, 8);
}

export function analyzeMap(content: string): MapAnalysis {
  const format = detectMapFormat(content), parsed = format === 'gnu' ? parseGnu(content) : format === 'iar' ? parseIar(content) : format === 'keil-armcc' || format === 'keil-armclang' ? parseKeil(content) : parseGnu(content);
  const labels: Record<MapFormat, string> = { 'keil-armcc': 'Keil ARMCC / armlink 5', 'keil-armclang': 'Keil ArmClang / armlink 6', iar: 'IAR ILINK', gnu: 'GNU ld / LLVM lld / ESP-IDF', unknown: '未知格式（通用降级解析）' };
  if (format === 'unknown') parsed.warnings.unshift('未能确定 MAP 工具链，已使用通用链接映射规则降级解析。');
  const coverage = coverageOf(parsed, format);
  return { format, formatLabel: labels[format], regions: parsed.regions, sections: parsed.sections, modules: parsed.modules, symbols: parsed.symbols, totals: parsed.totals, warnings: parsed.warnings, coverage, insights: buildInsights(parsed, coverage), optimizations: buildOptimizations(parsed) };
}

const deltasFor = (current: Array<{ name: string; size: number }>, baseline: Array<{ name: string; size: number }>) => {
  const after = new Map(current.map(item => [item.name, item.size])),
    before = new Map(baseline.map(item => [item.name, item.size]));
  return [...new Set([...before.keys(), ...after.keys()])]
    .map(name => ({ name, before: before.get(name) ?? 0, after: after.get(name) ?? 0, delta: (after.get(name) ?? 0) - (before.get(name) ?? 0) }))
    .filter(item => item.delta !== 0)
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta));
};

export function compareMapAnalyses(current: MapAnalysis, baseline: MapAnalysis): MapComparison {
  const totals = {
      flash: current.totals.flash - baseline.totals.flash,
      ram: current.totals.ram - baseline.totals.ram,
      code: current.totals.code - baseline.totals.code,
      roData: current.totals.roData - baseline.totals.roData,
      rwData: current.totals.rwData - baseline.totals.rwData,
      ziData: current.totals.ziData - baseline.totals.ziData,
    },
    comparable = current.coverage.capabilities.totals && baseline.coverage.capabilities.totals,
    sameFormat = current.format === baseline.format && current.format !== 'unknown',
    confidence = !comparable || Math.min(current.coverage.score, baseline.coverage.score) < 45
      ? 'low'
      : sameFormat && Math.min(current.coverage.score, baseline.coverage.score) >= 75
        ? 'high'
        : 'medium',
    movements = [totals.flash, totals.ram].filter(value => value !== 0),
    status = confidence === 'low'
      ? 'insufficient'
      : !movements.length
        ? 'unchanged'
        : movements.every(value => value <= 0)
          ? 'improved'
          : movements.every(value => value >= 0)
            ? 'regressed'
            : 'mixed',
    warnings: string[] = [];
  if (!comparable) warnings.push('至少一份 MAP 缺少 Flash/RAM 汇总，不能判定优化成效。');
  if (current.format !== baseline.format)
    warnings.push(`工具链格式不同（${baseline.formatLabel} → ${current.formatLabel}），模块和符号差异只作参考。`);
  if (!current.coverage.capabilities.modules || !baseline.coverage.capabilities.modules)
    warnings.push('至少一份 MAP 缺少模块表，无法完整定位增长来源。');
  return {
    status,
    confidence,
    totals,
    modules: deltasFor(
      current.modules.map(item => ({ name: item.name, size: item.total })),
      baseline.modules.map(item => ({ name: item.name, size: item.total })),
    ),
    symbols: deltasFor(
      current.symbols.filter(item => item.size > 0).map(item => ({ name: `${item.module ?? '?'}:${item.name}`, size: item.size })),
      baseline.symbols.filter(item => item.size > 0).map(item => ({ name: `${item.module ?? '?'}:${item.name}`, size: item.size })),
    ),
    warnings,
  };
}
