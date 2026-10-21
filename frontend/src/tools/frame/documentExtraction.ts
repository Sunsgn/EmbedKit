import { strFromU8, unzipSync } from 'fflate';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

export const DOCUMENT_FILE_MAX_BYTES = 50 * 1024 * 1024;
export const DOCUMENT_EXPANDED_MAX_BYTES = 64 * 1024 * 1024;
export const DOCUMENT_TEXT_MAX_BYTES = 2 * 1024 * 1024;
export const DOCUMENT_PDF_MAX_PAGES = 1000;
export const DOCUMENT_SHEET_MAX_ROWS = 20_000;

export type DocumentKind = 'pdf' | 'docx' | 'xlsx';

export interface DocumentExtractionResult {
  schema: 'embedkit.document-extraction';
  version: 1;
  fileName: string;
  kind: DocumentKind;
  fileBytes: number;
  extractedAt: string;
  text: string;
  units: number;
  unitLabel: '页' | '段落/表格行' | '工作表行';
  warnings: string[];
}

export class DocumentExtractionError extends Error {
  readonly code: 'UNSUPPORTED_DOCUMENT' | 'FILE_TOO_LARGE' | 'DAMAGED_DOCUMENT' | 'DOCUMENT_LIMIT_EXCEEDED' | 'OCR_REQUIRED' | 'PASSWORD_REQUIRED' | 'CANCELLED';
  constructor(code: DocumentExtractionError['code'], message: string) { super(message); this.name = 'DocumentExtractionError'; this.code = code; }
}

type Progress = (message: string) => void;
const encoder = new TextEncoder();
const marker = (location: string) => `[[来源:${location.replace(/[\]\r\n]/g, ' ')}]]`;
const textBytes = (value: string) => encoder.encode(value).length;

function assertTextLimit(value: string) {
  if (textBytes(value) > DOCUMENT_TEXT_MAX_BYTES) throw new DocumentExtractionError('DOCUMENT_LIMIT_EXCEEDED', '提取文本超过 2 MiB 上限，请缩小文档范围或拆分文件');
}

function parseXml(value: string, label: string) {
  const document = new DOMParser().parseFromString(value, 'application/xml');
  if (document.querySelector('parsererror')) throw new DocumentExtractionError('DAMAGED_DOCUMENT', `${label} XML 已损坏`);
  return document;
}

function elements(parent: ParentNode, localName: string) {
  return Array.from(parent.querySelectorAll('*')).filter((node) => node.localName === localName);
}

function directElements(parent: ParentNode) {
  return Array.from(parent.childNodes).filter((node): node is Element => node.nodeType === Node.ELEMENT_NODE);
}

function nodeText(parent: ParentNode) {
  return elements(parent, 't').map((node) => node.textContent ?? '').join('');
}

function unzipOffice(bytes: Uint8Array) {
  let entryCount = 0, declaredExpanded = 0, limitExceeded = false;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, { filter: (entry) => {
      entryCount += 1; declaredExpanded += entry.originalSize;
      if (entryCount > 10_000 || declaredExpanded > DOCUMENT_EXPANDED_MAX_BYTES) { limitExceeded = true; return false; }
      return entry.name === '[Content_Types].xml' || entry.name === 'word/document.xml' || entry.name === 'xl/workbook.xml' || entry.name === 'xl/_rels/workbook.xml.rels' || entry.name === 'xl/sharedStrings.xml' || /^xl\/worksheets\/[^/]+\.xml$/i.test(entry.name);
    } });
  } catch { throw new DocumentExtractionError('DAMAGED_DOCUMENT', 'Office 文件不是有效的 OOXML ZIP 文档'); }
  if (limitExceeded) throw new DocumentExtractionError('DOCUMENT_LIMIT_EXCEEDED', entryCount > 10_000 ? 'Office 文档内部文件超过 10,000 项上限' : 'Office 文档解压后超过 64 MiB 上限');
  return files;
}

function xmlFile(files: Record<string, Uint8Array>, path: string, required = true) {
  const value = files[path];
  if (!value) { if (required) throw new DocumentExtractionError('DAMAGED_DOCUMENT', `Office 文档缺少 ${path}`); return ''; }
  return strFromU8(value);
}

function extractDocx(bytes: Uint8Array, fileName: string): DocumentExtractionResult {
  const files = unzipOffice(bytes), document = parseXml(xmlFile(files, 'word/document.xml'), 'DOCX document.xml');
  const body = elements(document, 'body')[0];
  if (!body) throw new DocumentExtractionError('DAMAGED_DOCUMENT', 'DOCX 缺少正文');
  const lines: string[] = [], warnings: string[] = [];
  let paragraph = 0, table = 0, units = 0;
  for (const child of directElements(body)) {
    if (child.localName === 'p') {
      const value = nodeText(child).trim(); paragraph += 1;
      if (value) { lines.push(marker(`DOCX 段落 ${paragraph}`), value); units += 1; }
    } else if (child.localName === 'tbl') {
      table += 1; let row = 0;
      for (const rowNode of directElements(child).filter((node) => node.localName === 'tr')) {
        row += 1; const cells = directElements(rowNode).filter((node) => node.localName === 'tc').map((cell) => nodeText(cell).replace(/\s+/g, ' ').trim());
        if (cells.some(Boolean)) { lines.push(marker(`DOCX 表格 ${table} 行 ${row}`), cells.join('\t')); units += 1; }
      }
    }
    if (textBytes(lines.join('\n')) > DOCUMENT_TEXT_MAX_BYTES) throw new DocumentExtractionError('DOCUMENT_LIMIT_EXCEEDED', 'DOCX 提取文本超过 2 MiB 上限');
  }
  if (!lines.length) warnings.push('DOCX 未提取到正文文字，可能只有图片、文本框或不受支持的嵌入对象');
  const text = lines.join('\n'); assertTextLimit(text);
  return { schema: 'embedkit.document-extraction', version: 1, fileName, kind: 'docx', fileBytes: bytes.byteLength, extractedAt: new Date().toISOString(), text, units, unitLabel: '段落/表格行', warnings };
}

function safeOfficePath(target: string) {
  const normalized = target.replace(/\\/g, '/').replace(/^\//, '');
  const full = normalized.startsWith('xl/') ? normalized : `xl/${normalized}`;
  if (full.split('/').includes('..')) throw new DocumentExtractionError('DAMAGED_DOCUMENT', 'XLSX 工作表路径越界');
  return full;
}

function columnIndex(reference: string) {
  const letters = reference.match(/^[A-Z]+/i)?.[0]?.toUpperCase() ?? 'A';
  return [...letters].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function extractXlsx(bytes: Uint8Array, fileName: string): DocumentExtractionResult {
  const files = unzipOffice(bytes);
  const workbook = parseXml(xmlFile(files, 'xl/workbook.xml'), 'XLSX workbook.xml');
  const relationships = parseXml(xmlFile(files, 'xl/_rels/workbook.xml.rels'), 'XLSX workbook relationships');
  const relationMap = new Map(elements(relationships, 'Relationship').map((node) => [node.getAttribute('Id') ?? '', node.getAttribute('Target') ?? '']));
  const sharedXml = xmlFile(files, 'xl/sharedStrings.xml', false);
  const shared = sharedXml ? elements(parseXml(sharedXml, 'XLSX sharedStrings.xml'), 'si').map(nodeText) : [];
  const lines: string[] = [], warnings: string[] = [];
  let units = 0;
  for (const sheet of elements(workbook, 'sheet')) {
    const name = sheet.getAttribute('name') || '未命名工作表';
    const relationId = sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ?? sheet.getAttribute('r:id') ?? '';
    const target = relationMap.get(relationId);
    if (!target) { warnings.push(`工作表“${name}”缺少关系路径，已跳过`); continue; }
    const sheetDocument = parseXml(xmlFile(files, safeOfficePath(target)), `XLSX 工作表 ${name}`);
    for (const row of elements(sheetDocument, 'row')) {
      if (units >= DOCUMENT_SHEET_MAX_ROWS) throw new DocumentExtractionError('DOCUMENT_LIMIT_EXCEEDED', `XLSX 超过 ${DOCUMENT_SHEET_MAX_ROWS.toLocaleString()} 个工作表行上限`);
      const values: string[] = [];
      for (const cell of directElements(row).filter((node) => node.localName === 'c')) {
        const at = Math.min(255, columnIndex(cell.getAttribute('r') ?? 'A1'));
        const type = cell.getAttribute('t');
        const raw = elements(cell, 'v')[0]?.textContent ?? '';
        const value = type === 's' ? shared[Number(raw)] ?? '' : type === 'inlineStr' ? nodeText(cell) : type === 'b' ? raw === '1' ? 'TRUE' : 'FALSE' : raw;
        while (values.length <= at) values.push(''); values[at] = value;
      }
      while (values.length && !values[values.length - 1]) values.pop();
      if (values.some(Boolean)) { const rowNumber = row.getAttribute('r') || String(units + 1); lines.push(marker(`XLSX 工作表 ${name} 行 ${rowNumber}`), values.join('\t')); units += 1; }
      if (textBytes(lines.join('\n')) > DOCUMENT_TEXT_MAX_BYTES) throw new DocumentExtractionError('DOCUMENT_LIMIT_EXCEEDED', 'XLSX 提取文本超过 2 MiB 上限');
    }
  }
  if (!lines.length) warnings.push('XLSX 未提取到单元格内容');
  const text = lines.join('\n'); assertTextLimit(text);
  return { schema: 'embedkit.document-extraction', version: 1, fileName, kind: 'xlsx', fileBytes: bytes.byteLength, extractedAt: new Date().toISOString(), text, units, unitLabel: '工作表行', warnings };
}

async function extractPdf(bytes: Uint8Array, fileName: string, progress?: Progress, signal?: AbortSignal): Promise<DocumentExtractionResult> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const task = pdfjs.getDocument({ data: bytes, stopAtErrors: true, useSystemFonts: true, disableFontFace: true });
  let passwordRequired = false;
  task.onPassword = () => { passwordRequired = true; void task.destroy(); };
  try {
    const document = await task.promise, pageCount = document.numPages;
    if (pageCount > DOCUMENT_PDF_MAX_PAGES) { await task.destroy(); throw new DocumentExtractionError('DOCUMENT_LIMIT_EXCEEDED', `PDF 超过 ${DOCUMENT_PDF_MAX_PAGES.toLocaleString()} 页上限`); }
    const lines: string[] = [], warnings: string[] = ['PDF 多栏、浮动文本框或复杂表格的阅读顺序可能需要人工校对'];
    let textPages = 0;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      if (signal?.aborted) { await task.destroy(); throw new DocumentExtractionError('CANCELLED', '文档解析已取消'); }
      progress?.(`正在提取 PDF 第 ${pageNumber}/${document.numPages} 页`);
      const page = await document.getPage(pageNumber), content = await page.getTextContent();
      const pageLines: string[] = []; let current = '';
      for (const item of content.items) {
        if (!('str' in item)) continue;
        const value = item.str.trim();
        if (value) current += `${current ? ' ' : ''}${value}`;
        if (item.hasEOL && current) { pageLines.push(current); current = ''; }
      }
      if (current) pageLines.push(current);
      if (pageLines.length) { lines.push(marker(`PDF 第 ${pageNumber} 页`), ...pageLines); textPages += 1; }
      else warnings.push(`PDF 第 ${pageNumber} 页没有文本层`);
      if (textBytes(lines.join('\n')) > DOCUMENT_TEXT_MAX_BYTES) { await task.destroy(); throw new DocumentExtractionError('DOCUMENT_LIMIT_EXCEEDED', 'PDF 提取文本超过 2 MiB 上限，请拆分文档或缩小页数'); }
      page.cleanup();
    }
    await task.destroy();
    if (!textPages) throw new DocumentExtractionError('OCR_REQUIRED', 'PDF 没有可提取文本层，可能是扫描件；需要 OCR 后才能建立可靠协议模型');
    const text = lines.join('\n'); assertTextLimit(text);
    return { schema: 'embedkit.document-extraction', version: 1, fileName, kind: 'pdf', fileBytes: bytes.byteLength, extractedAt: new Date().toISOString(), text, units: pageCount, unitLabel: '页', warnings };
  } catch (reason) {
    if (reason instanceof DocumentExtractionError) throw reason;
    if (passwordRequired || (reason instanceof Error && /password/i.test(`${reason.name} ${reason.message}`))) throw new DocumentExtractionError('PASSWORD_REQUIRED', 'PDF 已加密，需要先在可信工具中解除密码保护');
    throw new DocumentExtractionError('DAMAGED_DOCUMENT', `PDF 读取失败：${reason instanceof Error ? reason.message : String(reason)}`);
  }
}

export async function extractProtocolDocumentFile(file: File, progress?: Progress, signal?: AbortSignal): Promise<DocumentExtractionResult> {
  if (signal?.aborted) throw new DocumentExtractionError('CANCELLED', '文档解析已取消');
  if (file.size > DOCUMENT_FILE_MAX_BYTES) throw new DocumentExtractionError('FILE_TOO_LARGE', '文档超过 50 MiB 文件上限');
  const extension = file.name.toLowerCase().split('.').pop();
  if (!['pdf', 'docx', 'xlsx'].includes(extension ?? '')) throw new DocumentExtractionError('UNSUPPORTED_DOCUMENT', '仅支持 PDF、DOCX 和 XLSX；旧版 DOC/XLS 请先另存为新版格式');
  progress?.(`正在读取 ${file.name}`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (signal?.aborted) throw new DocumentExtractionError('CANCELLED', '文档解析已取消');
  if (extension === 'pdf') return extractPdf(bytes, file.name, progress, signal);
  progress?.(`正在解析 ${extension?.toUpperCase()} 结构`);
  return extension === 'docx' ? extractDocx(bytes, file.name) : extractXlsx(bytes, file.name);
}
