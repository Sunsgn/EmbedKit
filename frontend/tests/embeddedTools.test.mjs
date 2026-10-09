import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeBinary, analyzeCanFrame, calculateAdc, calculateTimerPwm, parseIntelHex } from '../src/utils/embeddedTools.ts';

test('analyzes classic standard and extended CAN frames', () => {
  const standard = analyzeCanFrame('123', false, 'DE AD BE EF', 500000);
  assert.equal(standard.idHex, '0x123');
  assert.equal(standard.dlc, 4);
  assert.equal(standard.durationUs > 0, true);
  assert.throws(() => analyzeCanFrame('800', false, ''), /0x7FF/);
  assert.equal(analyzeCanFrame('1ABCDE', true, '').extended, true);
});

test('calculates timer PWM frequency and duty cycle', () => {
  const result = calculateTimerPwm(72000000, 71, 999, 250);
  assert.equal(result.frequencyHz, 1000);
  assert.equal(result.dutyPercent, 25);
  assert.throws(() => calculateTimerPwm(72000000, 0, 99, 101), /CCR/);
});

test('calculates ADC pin and divider source voltage', () => {
  const result = calculateAdc(12, 3.3, 2048, 10000, 10000);
  assert.equal(Math.abs(result.pinVoltage - 1.6504) < 0.001, true);
  assert.equal(Math.abs(result.sourceVoltage - 3.3008) < 0.002, true);
  assert.throws(() => calculateAdc(12, 3.3, 4096), /0 到 4095/);
});

test('parses Intel HEX, validates checksum and emits a padded BIN', () => {
  const source = ':020000040800F2\n:0400100001020304E2\n:00000001FF';
  const result = parseIntelHex(source);
  assert.equal(result.minAddress, 0x08000010);
  assert.equal(result.dataBytes, 4);
  assert.deepEqual([...result.binary], [1, 2, 3, 4]);
  assert.equal(result.eof, true);
  assert.throws(() => parseIntelHex(':0400100001020304E3'), /校验和/);
});

test('summarizes binary content without changing it', () => {
  const result = analyzeBinary(Uint8Array.from([0, 0xff, 1, 2]));
  assert.equal(result.size, 4);
  assert.equal(result.zeroBytes, 1);
  assert.equal(result.erasedBytes, 1);
  assert.deepEqual([...result.head], [0, 0xff, 1, 2]);
});
