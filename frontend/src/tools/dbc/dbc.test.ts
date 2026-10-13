import { describe, expect, it } from 'vitest';
import { decodeCanLog, decodeDbcMessage, filterCanLogFrames, findDbcMessage, parseCanLog, parseDbc } from './dbc';

const sample = `BO_ 256 Engine: 8 ECU
 SG_ Speed : 0|16@1+ (0.1,0) [0|250] "km/h" Dash
 SG_ Temp : 23|8@0- (1,-40) [-40|215] "C" Dash
VAL_ 256 Speed 0 "Stopped" 1000 "Moving";`;
describe('CAN DBC tool domain', () => {
  it('parses messages, signals and value tables', () => { const db = parseDbc(sample); expect(db).toMatchObject({ signalCount: 2 }); expect(findDbcMessage(db, 256)?.signals[0].values).toEqual({ '0': 'Stopped', '1000': 'Moving' }); });
  it('decodes Intel and Motorola signals with scaling and signed values', () => { const message = parseDbc(sample).messages[0]; const result = decodeDbcMessage(message, 'E8 03 FF 00 00 00 00 00'); expect(result.signals[0]).toMatchObject({ raw: 1000, value: 100, text: 'Moving', inRange: true }); expect(result.signals[1]).toMatchObject({ raw: -1, value: -41, inRange: false }); });
  it('handles DBC extended identifiers', () => { const db = parseDbc('BO_ 2147483939 Extended: 1 ECU\n SG_ Flag : 0|1@1+ (1,0) [0|1] "" ECU'); expect(db.messages[0]).toMatchObject({ id: 291, extended: true }); });
  it('rejects invalid databases and frame lengths', () => { expect(() => parseDbc('VERSION "1"')).toThrow('BO_'); expect(() => decodeDbcMessage(parseDbc(sample).messages[0], '00')).toThrow('需要 8 字节'); });
  it('parses candump hash, bracket, and CSV logs while isolating bad rows', () => {
    const result = parseCanLog(`(1710000000.125) can0 100#E803FF0000000000
1710000001.250 can1 100 [8] E8 03 00 00 00 00 00 00
bad row`);
    expect(result.frames).toHaveLength(2); expect(result.frames[0]).toMatchObject({ timestamp: 1710000000.125, channel: 'can0', id: 0x100, extended: false });
    expect(result.errors).toMatchObject([{ line: 3, message: '不支持的日志行格式' }]);
    const csv = parseCanLog('timestamp,channel,can_id,data\n1.5,CAN_A,0x100,E803000000000000');
    expect(csv.frames[0]).toMatchObject({ timestamp: 1.5, channel: 'CAN_A', id: 0x100 });
  });
  it('filters by time and CAN ID then batch decodes with evidence statistics', () => {
    const database = parseDbc(sample), parsed = parseCanLog(`(1.0) can0 100#E803FF0000000000
(2.0) can0 100#0000000000000000
(3.0) can0 123#0102
(4.0) can0 100#00`);
    const filtered = filterCanLogFrames(parsed.frames, { id: '100', startTime: 1.5, endTime: 4 });
    expect(filtered.map(item => item.line)).toEqual([2, 4]);
    const decoded = decodeCanLog(database, parsed.frames);
    expect(decoded).toMatchObject({ unmatched: 1, failed: 1, outOfRange: 1 });
    expect(decoded.rows).toHaveLength(4); expect(decoded.rows[0]).toMatchObject({ line: 1, message: 'Engine', signal: 'Speed', value: 100 });
  });
  it('enforces log size and declared DLC bounds', () => {
    expect(() => parseCanLog(`can0 100 [2] 01`)).not.toThrow();
    expect(parseCanLog(`can0 100 [2] 01`).errors[0].message).toContain('DLC 声明');
    expect(() => parseCanLog('x'.repeat(5 * 1024 * 1024 + 1))).toThrow('5 MiB');
  });
});
