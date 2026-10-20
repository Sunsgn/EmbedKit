import type { PartDocumentKind, PartParameter, PartRecord } from '../types';
import { agentRequest, AgentClientError } from './agentClient';

export interface PartSourceCapability { id: string; name: string; kind: 'manufacturer' | 'distributor' | 'aggregator' | 'user-import'; state: 'configured' | 'unavailable'; capabilities: string[]; dataScope: string; authoritative: boolean }
export interface PartSourceStatus { schemaVersion: 1; sources: PartSourceCapability[]; limits: { queryLength: number; automaticPdfDownload: boolean; parametricSearch: boolean; documentResults?: number } }
export interface OnlinePartDetails { query: string; productName: string; manufacturer?: string; description: string; specs: Record<string, string>; features: string[]; source: string; productUrl?: string; datasheetUrl?: string }
export interface DiscoveredPartDocument { kind: PartDocumentKind; title: string; url: string; sourceName: string; authoritative: true; scope: 'exact-model' | 'family'; discoveredFrom: string }
export interface PartDocumentDiscoveryResult { schemaVersion: 1; model: string; manufacturer: string; documents: DiscoveredPartDocument[]; failures: Array<{ code: string; message: string; url?: string }>; discoveredAt: string; limits?: { maxDocuments: number; maxPages: number; cacheSeconds: number } }

const text = (value: unknown, limit: number) => typeof value === 'string' && value.trim() ? value.trim().slice(0, limit) : '';
const safeUrl = (value: unknown) => { const raw = text(value, 2048); if (!raw) return undefined; try { const url = new URL(raw); return ['https:', 'http:'].includes(url.protocol) ? url.toString() : undefined; } catch { return undefined; } };

export async function getPartSourceStatus(): Promise<PartSourceStatus> {
  const result = await agentRequest<PartSourceStatus>('/api/parts/sources', {}, 3000);
  if (result.schemaVersion !== 1 || !Array.isArray(result.sources) || result.sources.length > 32 || !result.limits) throw new AgentClientError('invalid-response', '在线器件来源状态格式无效');
  return result;
}

export async function lookupOnlinePart(model: string, signal?: AbortSignal): Promise<OnlinePartDetails> {
  const query = model.trim();
  if (query.length < 2 || query.length > 120 || !/^[\p{L}\p{N}][\p{L}\p{N}._+\-/ ]*$/u.test(query)) throw new AgentClientError('invalid-response', '请输入 2～120 个字符的完整器件型号');
  const raw = await agentRequest<Record<string, unknown>>(`/api/component-details?part=${encodeURIComponent(query)}`, { signal }, 12000);
  if (raw.error) throw new AgentClientError('http', text(raw.error, 500) || '在线来源没有找到该型号');
  const specs: Record<string, string> = {};
  if (raw.specs && typeof raw.specs === 'object' && !Array.isArray(raw.specs)) for (const [key, value] of Object.entries(raw.specs).slice(0, 64)) { const label = text(key, 120), detail = text(value, 500); if (label && detail) specs[label] = detail; }
  const features = Array.isArray(raw.features) ? raw.features.slice(0, 40).map(value => text(value, 500)).filter(Boolean) : [];
  return { query, productName: text(raw.productName, 200) || query, manufacturer: text(raw.manufacturer, 200) || text(specs.manufacturer, 200) || undefined, description: text(raw.description, 2000) || '在线来源未提供器件描述。', specs, features, source: text(raw.source, 120) || '在线聚合来源', productUrl: safeUrl(raw.productUrl), datasheetUrl: safeUrl(raw.datasheetUrl ?? raw.stUrl) };
}

export async function discoverPartDocuments(input: { model: string; manufacturer?: string; productUrl?: string }, signal?: AbortSignal): Promise<PartDocumentDiscoveryResult> {
  const model = input.model.trim(), params = new URLSearchParams({ part: model });
  if (input.manufacturer?.trim()) params.set('manufacturer', input.manufacturer.trim());
  if (input.productUrl) params.set('productUrl', input.productUrl);
  const raw = await agentRequest<Record<string, unknown>>(`/api/parts/documents?${params}`, { signal }, 30000);
  if (raw.schemaVersion !== 1 || !Array.isArray(raw.documents) || raw.documents.length > 24 || !Array.isArray(raw.failures)) throw new AgentClientError('invalid-response', '官方 PDF 发现结果格式无效');
  const allowedKinds = new Set<PartDocumentKind>(['datasheet', 'reference-manual', 'user-guide', 'programming-manual', 'application-note', 'errata', 'hardware-design-guide', 'getting-started-guide', 'product-page', 'other']);
  const documents: DiscoveredPartDocument[] = [];
  for (const value of raw.documents) {
    if (!value || typeof value !== 'object') continue;
    const item = value as Record<string, unknown>, kind = text(item.kind, 50) as PartDocumentKind, url = safeUrl(item.url), discoveredFrom = safeUrl(item.discoveredFrom);
    if (!allowedKinds.has(kind) || !url?.startsWith('https:') || !discoveredFrom?.startsWith('https:')) continue;
    documents.push({ kind, title: text(item.title, 300) || 'PDF 文档', url, sourceName: text(item.sourceName, 120) || '厂商官方资料', authoritative: true, scope: item.scope === 'exact-model' ? 'exact-model' : 'family', discoveredFrom });
  }
  const failures = raw.failures.slice(0, 3).flatMap(value => value && typeof value === 'object' ? [{ code: text((value as Record<string, unknown>).code, 80) || 'discovery-failed', message: text((value as Record<string, unknown>).message, 300) || '未找到官方 PDF', url: safeUrl((value as Record<string, unknown>).url) }] : []);
  return { schemaVersion: 1, model: text(raw.model, 120) || model, manufacturer: text(raw.manufacturer, 200), documents, failures, discoveredAt: text(raw.discoveredAt, 80) || new Date().toISOString() };
}

export function onlineDetailsToPart(details: OnlinePartDetails): PartRecord {
  const id = `online:${details.productName.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-')}`;
  const sourceId = `online:${details.source.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'source'}`, evidenceId = `${id}:lookup`, now = new Date().toISOString();
  const parameterKey = (label: string) => `raw:${label.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'parameter'}`;
  const parameters: PartParameter[] = Object.entries(details.specs).map(([label, value]) => ({ key: parameterKey(label), label, valueType: 'text', value, conditions: [], evidenceIds: [evidenceId], status: 'imported' }));
  return { schemaVersion: 1, id, manufacturer: details.manufacturer || '待确认', mpn: details.productName, category: '在线发现器件', subcategory: '待分类', description: details.description, tags: [], variants: [{ mpn: details.productName, lifecycle: 'unknown' }], parameters, documents: [...(details.datasheetUrl ? [{ id: `${id}:datasheet`, kind: 'datasheet' as const, title: '数据手册', url: details.datasheetUrl, sourceId }] : []), ...(details.productUrl ? [{ id: `${id}:product`, kind: 'product-page' as const, title: '产品页面', url: details.productUrl, sourceId }] : [])], sources: [{ id: sourceId, kind: 'aggregator', name: details.source, url: details.productUrl }], evidence: [{ id: evidenceId, sourceId, url: details.productUrl, retrievedAt: now, note: '在线型号发现结果；保留原始字段供通用条件匹配，正式判断前仍需核验官方资料。' }], createdAt: now, updatedAt: now };
}
