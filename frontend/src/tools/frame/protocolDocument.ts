import { formatHex, parseHexBytes } from '../../utils/embeddedTools';
import type { FrameChecksum, FrameTemplate } from './frame';
import { extractProtocolFields, normalizeProtocolFields, validateProtocolFields, type ProtocolFieldDefinition } from './protocolFields';
import { extractProtocolFramework, normalizeProtocolFramework, type ProtocolFramework } from './protocolFramework';

export const PROTOCOL_DEFINITION_SCHEMA = 'embedkit.protocol-definition';
export const PROTOCOL_DEFINITION_VERSION = 2 as const;
export const PROTOCOL_DOCUMENT_MAX_BYTES = 2 * 1024 * 1024;
export const PROTOCOL_DOCUMENT_MAX_LINES = 20_000;

export type ProtocolEvidenceConfidence = 'high' | 'medium' | 'low';

export interface ProtocolDocumentEvidence {
  field: 'header' | 'commandBytes' | 'includeLength' | 'fixedPayloadLength' | 'checksum';
  line: number;
  text: string;
  confidence: ProtocolEvidenceConfidence;
  location?: string;
}

export interface ProtocolDefinition {
  schema: typeof PROTOCOL_DEFINITION_SCHEMA;
  version: typeof PROTOCOL_DEFINITION_VERSION;
  id: string;
  name: string;
  revision: number;
  status: 'candidate' | 'confirmed';
  source: { fileName: string; kind: 'text' | 'csv' | 'tsv' | 'markdown' | 'json' | 'pdf' | 'docx' | 'xlsx'; importedAt: string };
  frame: FrameTemplate;
  framework: ProtocolFramework;
  fields: ProtocolFieldDefinition[];
  evidence: ProtocolDocumentEvidence[];
  unknowns: string[];
  confidence: number;
  updatedAt: string;
}

const checksumKinds = new Set<FrameChecksum>(['none', 'sum8', 'xor8', 'crc16-modbus']);
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const clean = (value: string, limit: number) => Array.from(value).filter((character) => { const code = character.charCodeAt(0); return code >= 0x20 || code === 0x09 || code === 0x0a || code === 0x0d; }).join('').trim().slice(0, limit);

function fileKind(fileName: string): ProtocolDefinition['source']['kind'] {
  const extension = fileName.toLowerCase().split('.').pop();
  if (extension === 'csv') return 'csv';
  if (extension === 'tsv') return 'tsv';
  if (extension === 'md' || extension === 'markdown') return 'markdown';
  if (extension === 'json') return 'json';
  if (extension === 'pdf' || extension === 'docx' || extension === 'xlsx') return extension;
  return 'text';
}

function hexFromLine(line: string) {
  const tokens = [...line.matchAll(/(?:0x)?([0-9a-f]{2})(?![0-9a-f])/gi)].map(match => match[1]);
  if (tokens.length) return formatHex(Uint8Array.from(tokens.map(token => Number.parseInt(token, 16))));
  const compact = line.match(/(?:0x)?([0-9a-f]{4,16})(?![0-9a-f])/i)?.[1];
  return compact && compact.length % 2 === 0 ? compact.match(/../g)!.join(' ').toUpperCase() : '';
}

function numericWidth(line: string) {
  const explicit = line.match(/(?:长度|宽度|size|width|bytes?)[^0-9]{0,12}([12])(?:\s*(?:字节|bytes?))?/i)?.[1]
    ?? line.match(/\b([12])\s*(?:字节|bytes?)\b/i)?.[1];
  return explicit ? Number(explicit) as 1 | 2 : null;
}

export function normalizeProtocolDefinition(value: unknown): ProtocolDefinition | null {
  if (!object(value) || value.schema !== PROTOCOL_DEFINITION_SCHEMA || (value.version !== 1 && value.version !== PROTOCOL_DEFINITION_VERSION) || typeof value.id !== 'string' || typeof value.name !== 'string' || !object(value.source) || !object(value.frame)) return null;
  const commandBytes = value.frame.commandBytes === 2 ? 2 : value.frame.commandBytes === 1 ? 1 : null;
  const checksum = checksumKinds.has(value.frame.checksum as FrameChecksum) ? value.frame.checksum as FrameChecksum : null;
  if (!commandBytes || !checksum || typeof value.frame.header !== 'string' || typeof value.frame.includeLength !== 'boolean') return null;
  let header: string; try { const bytes = parseHexBytes(value.frame.header); if (!bytes.length || bytes.length > 16) return null; header = formatHex(bytes); } catch { return null; }
  const fixedPayloadLength = Number.isSafeInteger(value.frame.fixedPayloadLength) && Number(value.frame.fixedPayloadLength) >= 0 && Number(value.frame.fixedPayloadLength) <= 65535 ? Number(value.frame.fixedPayloadLength) : 0;
  const fields = normalizeProtocolFields(value.fields); if (!fields) return null;
  const framework = normalizeProtocolFramework(value.framework); if (!framework) return null;
  if (!Array.isArray(value.evidence) || value.evidence.length > 100 || !Array.isArray(value.unknowns) || value.unknowns.length > 20) return null;
  const allowedFields = new Set<ProtocolDocumentEvidence['field']>(['header', 'commandBytes', 'includeLength', 'fixedPayloadLength', 'checksum']), allowedConfidence = new Set<ProtocolEvidenceConfidence>(['high', 'medium', 'low']);
  const evidence = value.evidence.map(item => object(item) && allowedFields.has(item.field as ProtocolDocumentEvidence['field']) && Number.isSafeInteger(item.line) && Number(item.line) > 0 && typeof item.text === 'string' && allowedConfidence.has(item.confidence as ProtocolEvidenceConfidence) ? { field: item.field as ProtocolDocumentEvidence['field'], line: Number(item.line), text: clean(item.text, 1000), confidence: item.confidence as ProtocolEvidenceConfidence, ...(typeof item.location === 'string' ? { location: clean(item.location, 300) } : {}) } : null);
  if (evidence.some(item => item === null)) return null;
  const kind = ['text', 'csv', 'tsv', 'markdown', 'json', 'pdf', 'docx', 'xlsx'].includes(String(value.source.kind)) ? value.source.kind as ProtocolDefinition['source']['kind'] : 'text';
  return { schema: PROTOCOL_DEFINITION_SCHEMA, version: PROTOCOL_DEFINITION_VERSION, id: clean(value.id, 200), name: clean(value.name, 200), revision: Number.isSafeInteger(value.revision) && Number(value.revision) > 0 ? Number(value.revision) : 1, status: value.status === 'confirmed' ? 'confirmed' : 'candidate', source: { fileName: clean(String(value.source.fileName ?? ''), 300), kind, importedAt: typeof value.source.importedAt === 'string' ? value.source.importedAt : new Date(0).toISOString() }, frame: { header, commandBytes, includeLength: value.frame.includeLength, checksum, fixedPayloadLength }, framework, fields, evidence: evidence as ProtocolDocumentEvidence[], unknowns: value.unknowns.filter(item => typeof item === 'string').map(item => clean(item, 300)), confidence: typeof value.confidence === 'number' && Number.isFinite(value.confidence) ? Math.max(0, Math.min(1, value.confidence)) : 0, updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date(0).toISOString() };
}

export function extractProtocolDefinition(source: string, fileName = '粘贴文本'): ProtocolDefinition {
  if (new TextEncoder().encode(source).length > PROTOCOL_DOCUMENT_MAX_BYTES) throw new Error('协议资料超过 2 MiB 文本处理上限');
  const lines = source.replace(/\r/g, '').split('\n');
  if (lines.length > PROTOCOL_DOCUMENT_MAX_LINES) throw new Error(`协议资料超过 ${PROTOCOL_DOCUMENT_MAX_LINES} 行上限`);
  const evidence: ProtocolDocumentEvidence[] = [];
  let header = '', commandBytes: 1 | 2 = 1, includeLength = true, fixedPayloadLength = 0, checksum: FrameChecksum = 'none';
  let headerFound = false, commandFound = false, lengthFound = false, checksumFound = false;
  let location = '';
  const add = (field: ProtocolDocumentEvidence['field'], index: number, text: string, confidence: ProtocolEvidenceConfidence) => evidence.push({ field, line: index + 1, text: clean(text, 1000), confidence, ...(location ? { location } : {}) });
  lines.forEach((raw, index) => {
    const line = raw.trim(); if (!line) return;
    const sourceMarker = line.match(/^\[\[来源:(.+)\]\]$/); if (sourceMarker) { location = clean(sourceMarker[1], 300); return; }
    if (!headerFound && /(?:帧头|包头|起始符|同步字|frame\s*header|sync\s*(?:word|byte)?)/i.test(line)) { const value = hexFromLine(line.replace(/^(?:[^:=：]{0,40})[:=：]/, '')); if (value) { header = value; headerFound = true; add('header', index, raw, 'high'); } }
    if (!commandFound) { const commandPart = line.match(/(?:命令(?:字|码)?|指令(?:字|码)?|command|cmd)(.*)$/i)?.[1]; const width = commandPart === undefined ? null : numericWidth(commandPart); if (width) { commandBytes = width; commandFound = true; add('commandBytes', index, raw, 'medium'); } }
    if (!lengthFound && /(?:无|不含|没有|without|no)\s*(?:长度|length)/i.test(line)) { includeLength = false; lengthFound = true; add('includeLength', index, raw, 'high'); }
    if (!lengthFound && /(?:长度字段|数据长度|负载长度|payload\s*length|length\s*field)/i.test(line)) { includeLength = true; lengthFound = true; add('includeLength', index, raw, 'medium'); }
    if (/固定(?:负载|数据)?长度|fixed\s*(?:payload\s*)?length/i.test(line)) { const value = line.match(/(?:=|:|：|为|is)?\s*(\d{1,5})\s*(?:字节|bytes?)?/i)?.[1]; if (value && Number(value) <= 65535) { fixedPayloadLength = Number(value); includeLength = false; lengthFound = true; add('fixedPayloadLength', index, raw, 'high'); } }
    if (!checksumFound && /(?:校验|checksum|crc)/i.test(line)) {
      const detected: FrameChecksum | null = /crc\s*[-_/]?\s*16.*(?:modbus|a001)|modbus.*crc/i.test(line) ? 'crc16-modbus' : /xor\s*[-_]?\s*8|异或/i.test(line) ? 'xor8' : /sum\s*[-_]?\s*8|累加和|和校验/i.test(line) ? 'sum8' : /(?:无|不含|没有|none|no)\s*(?:校验|checksum|crc)/i.test(line) ? 'none' : null;
      if (detected) { checksum = detected; checksumFound = true; add('checksum', index, raw, detected === 'none' ? 'medium' : 'high'); }
    }
  });
  const unknowns = [...(!headerFound ? ['未识别帧头'] : []), ...(!commandFound ? ['未识别命令字段宽度，暂按 1 字节'] : []), ...(!lengthFound ? ['未确认长度字段语义，暂按单字节“命令+负载长度”'] : []), ...(!checksumFound ? ['未识别校验算法，暂按无校验'] : [])];
  const fields = extractProtocolFields(source);
  unknowns.push(...validateProtocolFields(fields));
  const framework = extractProtocolFramework(source);
  const name = clean(lines.find(line => line.trim())?.replace(/^#+\s*/, '') || fileName.replace(/\.[^.]+$/, ''), 200);
  const now = new Date().toISOString();
  return { schema: PROTOCOL_DEFINITION_SCHEMA, version: PROTOCOL_DEFINITION_VERSION, id: crypto.randomUUID(), name, revision: 1, status: 'candidate', source: { fileName: clean(fileName, 300), kind: fileKind(fileName), importedAt: now }, frame: { header: header || 'AA 55', commandBytes, includeLength, checksum, fixedPayloadLength }, framework, fields, evidence, unknowns, confidence: Math.min(1, evidence.length / 4), updatedAt: now };
}

export function confirmProtocolDefinition(candidate: ProtocolDefinition, name: string, frame: FrameTemplate): ProtocolDefinition {
  const normalized = normalizeProtocolDefinition({ ...candidate, name, status: 'confirmed', frame, revision: candidate.status === 'confirmed' ? candidate.revision + 1 : candidate.revision, updatedAt: new Date().toISOString() });
  if (!normalized) throw new Error('协议模型字段无效，请检查帧头、长度、命令宽度和校验配置');
  return normalized;
}

export function parseProtocolDocument(source: string, fileName: string) {
  if (fileKind(fileName) !== 'json') return extractProtocolDefinition(source, fileName);
  let value: unknown; try { value = JSON.parse(source); } catch { throw new Error('协议 JSON 不是有效的 JSON 文档'); }
  const normalized = normalizeProtocolDefinition(value);
  if (!normalized) throw new Error('协议 JSON 格式或版本不受支持');
  return normalized;
}
