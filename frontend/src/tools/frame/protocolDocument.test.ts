import { describe, expect, it } from 'vitest';
import { confirmProtocolDefinition, extractProtocolDefinition, normalizeProtocolDefinition, parseProtocolDocument } from './protocolDocument';

describe('protocol document extraction', () => {
  it('extracts a reviewable frame candidate with original line evidence', () => {
    const result = extractProtocolDefinition(`# 温控器通信协议 V2\n帧头：AA 55\n长度字段：1 字节，表示命令加负载\n命令码宽度：2 字节\n校验方式：CRC16-Modbus`, 'controller.md');
    expect(result).toMatchObject({ status: 'candidate', source: { fileName: 'controller.md', kind: 'markdown' }, frame: { header: 'AA 55', commandBytes: 2, includeLength: true, checksum: 'crc16-modbus' }, unknowns: [] });
    expect(result.evidence.map(item => [item.field, item.line])).toEqual([['header', 2], ['includeLength', 3], ['commandBytes', 4], ['checksum', 5]]);
  });

  it('keeps ambiguous fields unknown instead of presenting defaults as confirmed facts', () => {
    const result = extractProtocolDefinition('设备每秒主动上报一次温度。', 'notes.txt');
    expect(result.frame).toMatchObject({ header: 'AA 55', commandBytes: 1, includeLength: true, checksum: 'none' });
    expect(result.confidence).toBe(0);
    expect(result.unknowns).toHaveLength(4);
  });

  it('requires explicit confirmation before producing a confirmed versioned model', () => {
    const candidate = extractProtocolDefinition('帧头=5A A5\n固定负载长度：4 字节\n命令宽度：1 字节\n无校验', 'protocol.txt');
    const confirmed = confirmProtocolDefinition(candidate, '温控器协议', candidate.frame);
    expect(confirmed).toMatchObject({ schema: 'embedkit.protocol-definition', version: 1, status: 'confirmed', name: '温控器协议', frame: { header: '5A A5', includeLength: false, fixedPayloadLength: 4 } });
    expect(normalizeProtocolDefinition({ ...confirmed, frame: { ...confirmed.frame, header: '' } })).toBeNull();
  });

  it('imports only compatible versioned JSON definitions', () => {
    const confirmed = confirmProtocolDefinition(extractProtocolDefinition('帧头：AA 55', 'a.txt'), 'A', { header: 'AA 55', commandBytes: 1, includeLength: true, checksum: 'sum8' });
    expect(parseProtocolDocument(JSON.stringify(confirmed), 'a.json').id).toBe(confirmed.id);
    expect(() => parseProtocolDocument('{"version":99}', 'a.json')).toThrow(/版本不受支持/);
  });

  it('carries PDF pages and spreadsheet rows into field evidence', () => {
    const definition = parseProtocolDocument('[[来源:PDF 第 12 页]]\n帧头：A5 5A\n[[来源:XLSX 工作表 Commands 行 8]]\n命令码宽度：2 字节', 'protocol.pdf');
    expect(definition.source.kind).toBe('pdf');
    expect(definition.evidence.find((item) => item.field === 'header')?.location).toBe('PDF 第 12 页');
    expect(definition.evidence.find((item) => item.field === 'commandBytes')?.location).toBe('XLSX 工作表 Commands 行 8');
  });
});
