import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { DOCUMENT_FILE_MAX_BYTES, extractProtocolDocumentFile } from './documentExtraction';

const file = (bytes: Uint8Array, name: string, type: string) => new File([bytes as BlobPart], name, { type });

function minimalPdf(text = 'Frame Header: AA 55') {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let output = '%PDF-1.4\n', offset = new TextEncoder().encode(output).length;
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(offset); const value = `${index + 1} 0 obj\n${object}\nendobj\n`; output += value; offset += new TextEncoder().encode(value).length; });
  const xref = offset;
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((value) => `${String(value).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return strToU8(output);
}

describe('local protocol document extraction', () => {
  it('extracts PDF text with page evidence', async () => {
    await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
    const result = await extractProtocolDocumentFile(file(minimalPdf(), 'protocol.pdf', 'application/pdf'));
    expect(result.kind).toBe('pdf');
    expect(result.text).toContain('[[来源:PDF 第 1 页]]');
    expect(result.text).toContain('Frame Header: AA 55');
  }, 20_000);

  it('requires OCR when a PDF has no extractable text layer', async () => {
    await expect(extractProtocolDocumentFile(file(minimalPdf(''), 'scan.pdf', 'application/pdf'))).rejects.toMatchObject({ code: 'OCR_REQUIRED' });
  }, 20_000);

  it('extracts DOCX paragraphs and table rows', async () => {
    const archive = zipSync({
      '[Content_Types].xml': strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
      'word/document.xml': strToU8('<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>帧头：AA 55</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>命令码</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>1 字节</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>'),
    });
    const result = await extractProtocolDocumentFile(file(archive, 'protocol.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'));
    expect(result.text).toContain('[[来源:DOCX 段落 1]]\n帧头：AA 55');
    expect(result.text).toContain('[[来源:DOCX 表格 1 行 1]]\n命令码\t1 字节');
  });

  it('extracts shared strings and cell positions from XLSX sheets', async () => {
    const archive = zipSync({
      '[Content_Types].xml': strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
      'xl/workbook.xml': strToU8('<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="协议表" sheetId="1" r:id="rId1"/></sheets></workbook>'),
      'xl/_rels/workbook.xml.rels': strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'),
      'xl/sharedStrings.xml': strToU8('<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>帧头</t></si><si><t>AA 55</t></si></sst>'),
      'xl/worksheets/sheet1.xml': strToU8('<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="2"><c r="A2" t="s"><v>0</v></c><c r="B2" t="s"><v>1</v></c></row></sheetData></worksheet>'),
    });
    const result = await extractProtocolDocumentFile(file(archive, 'protocol.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'));
    expect(result.text).toBe('[[来源:XLSX 工作表 协议表 行 2]]\n帧头\tAA 55');
  });

  it('rejects damaged and legacy Office documents with structured errors', async () => {
    await expect(extractProtocolDocumentFile(file(strToU8('legacy'), 'protocol.doc', 'application/msword'))).rejects.toMatchObject({ code: 'UNSUPPORTED_DOCUMENT' });
    await expect(extractProtocolDocumentFile(file(strToU8('broken'), 'protocol.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))).rejects.toMatchObject({ code: 'DAMAGED_DOCUMENT' });
  });

  it('rejects oversized input before reading its contents', async () => {
    let read = false;
    const oversized = { name: 'large.pdf', size: DOCUMENT_FILE_MAX_BYTES + 1, arrayBuffer: async () => { read = true; return new ArrayBuffer(0); } } as File;
    await expect(extractProtocolDocumentFile(oversized)).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });
    expect(read).toBe(false);
  });
});
