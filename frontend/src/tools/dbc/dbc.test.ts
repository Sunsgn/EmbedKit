import { describe, expect, it } from 'vitest';
import { decodeDbcMessage, findDbcMessage, parseDbc } from './dbc';

const sample = `BO_ 256 Engine: 8 ECU
 SG_ Speed : 0|16@1+ (0.1,0) [0|250] "km/h" Dash
 SG_ Temp : 23|8@0- (1,-40) [-40|215] "C" Dash
VAL_ 256 Speed 0 "Stopped" 1000 "Moving";`;
describe('CAN DBC tool domain', () => {
  it('parses messages, signals and value tables', () => { const db = parseDbc(sample); expect(db).toMatchObject({ signalCount: 2 }); expect(findDbcMessage(db, 256)?.signals[0].values).toEqual({ '0': 'Stopped', '1000': 'Moving' }); });
  it('decodes Intel and Motorola signals with scaling and signed values', () => { const message = parseDbc(sample).messages[0]; const result = decodeDbcMessage(message, 'E8 03 FF 00 00 00 00 00'); expect(result.signals[0]).toMatchObject({ raw: 1000, value: 100, text: 'Moving', inRange: true }); expect(result.signals[1]).toMatchObject({ raw: -1, value: -41, inRange: false }); });
  it('handles DBC extended identifiers', () => { const db = parseDbc('BO_ 2147483939 Extended: 1 ECU\n SG_ Flag : 0|1@1+ (1,0) [0|1] "" ECU'); expect(db.messages[0]).toMatchObject({ id: 291, extended: true }); });
  it('rejects invalid databases and frame lengths', () => { expect(() => parseDbc('VERSION "1"')).toThrow('BO_'); expect(() => decodeDbcMessage(parseDbc(sample).messages[0], '00')).toThrow('需要 8 字节'); });
});
