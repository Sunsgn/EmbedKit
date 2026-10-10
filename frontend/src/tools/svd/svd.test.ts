import { describe, expect, it } from 'vitest';
import { parseSvd, searchSvd } from './svd';

const sample = `<device><name>DemoMCU</name><peripherals><peripheral><name>GPIOA</name><baseAddress>0x40020000</baseAddress><access>read-write</access><registers><register><name>MODER</name><description>mode register</description><addressOffset>0x00</addressOffset><size>32</size><resetValue>0xA8000000</resetValue><fields><field><name>MODE0</name><bitOffset>0</bitOffset><bitWidth>2</bitWidth></field><field><name>MODE1</name><bitRange>[3:2]</bitRange></field></fields></register><register><name>AFR%s</name><addressOffset>0x20</addressOffset><dim>2</dim><dimIncrement>4</dimIncrement><dimIndex>L,H</dimIndex></register></registers></peripheral></peripherals></device>`;
describe('CMSIS-SVD tool domain', () => {
  it('parses addresses, fields, masks and register arrays', () => { const result = parseSvd(sample); expect(result).toMatchObject({ name: 'DemoMCU', registerCount: 3, fieldCount: 2 }); expect(result.peripherals[0].registers.map(item => [item.name, item.address])).toEqual([['MODER', 0x40020000], ['AFRL', 0x40020020], ['AFRH', 0x40020024]]); expect(result.peripherals[0].registers[0].fields.map(item => item.mask)).toEqual([3, 12]); });
  it('searches peripheral, register, description and field text', () => { const result = parseSvd(sample); expect(searchSvd(result, 'mode').map(item => item.name)).toEqual(['MODER']); expect(searchSvd(result, 'GPIOA')).toHaveLength(3); });
  it('isolates invalid registers and reports warnings', () => { const result = parseSvd(sample.replace('<addressOffset>0x00</addressOffset>', '<addressOffset>bad</addressOffset>')); expect(result.registerCount).toBe(2); expect(result.warnings[0]).toContain('MODER'); });
  it('rejects malformed and non-SVD XML', () => { expect(() => parseSvd('<device>')).toThrow('XML'); expect(() => parseSvd('<root/>')).toThrow('device'); });
});
