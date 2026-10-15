import { describe, expect, it } from 'vitest';
import { extractProtocolFramework, normalizeProtocolFramework } from './protocolFramework';

describe('protocol framework extraction', () => {
  it('recognizes transport, interaction, frame layout and command catalog with evidence', () => {
    const source = `设备通过 RS485 串口通信，采用 Modbus RTU 主从请求响应方式
帧字段,偏移,长度,说明
帧头,0,2,固定 AA55
地址,2,1,从机地址
长度,3,1,负载长度
命令码,4,1,功能
数据,5,可变,负载
CRC,可变,2,CRC16-Modbus
命令码,命令名称,方向
0x10,读取温度,请求
0x90,读取温度响应,响应`;
    const result = extractProtocolFramework(source);
    expect(result.transports).toEqual(['uart', 'rs485']);
    expect(result.interactions).toEqual(['request-response', 'master-slave']);
    expect(result.families).toContain('modbus-rtu');
    expect(result.frameSegments.map(item => item.role)).toEqual(['header', 'address', 'length', 'command', 'payload', 'checksum']);
    expect(result.messages).toMatchObject([{ command: 0x10, name: '读取温度', direction: 'request' }, { command: 0x90, direction: 'response' }]);
    expect(result.unknowns).toEqual([]);
    expect(normalizeProtocolFramework(result)).toEqual(result);
  });

  it('recognizes a linear frame formula and keeps missing framework areas explicit', () => {
    const result = extractProtocolFramework('帧格式：帧头 + 长度 + 命令 + 数据 + 校验');
    expect(result.families).toEqual(['custom-binary']);
    expect(result.frameSegments).toHaveLength(5);
    expect(result.unknowns).toContain('未识别传输方式');
    expect(result.unknowns).toContain('未识别命令/消息目录');
  });

  it('safely migrates a definition without framework data', () => {
    expect(normalizeProtocolFramework(undefined)).toMatchObject({ messages: [], frameSegments: [], confidence: 0 });
    expect(normalizeProtocolFramework({ families: ['guessed'], transports: [], interactions: [], frameSegments: [], messages: [], unknowns: [], confidence: 1 })).toBeNull();
  });
});
