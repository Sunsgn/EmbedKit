import { describe, expect, it, vi } from 'vitest';
import { BROWSER_SERIAL_SETTINGS_KEY, browserSerialPortName, filterBrowserSerialEntries, isBrowserSerialChooserCancellation, isRecoverableBrowserSerialReadError, loadBrowserSerialSettings, openBrowserSerialPort, parseBrowserSerialHex, saveBrowserSerialSettings, unescapeBrowserSerialText } from './browserSerialModel';

describe('browser serial model', () => {
  it('loads versioned settings defensively and parses terminal input deterministically', () => {
    expect(loadBrowserSerialSettings({ getItem: () => '{damaged' })).toEqual({});
    expect(parseBrowserSerialHex('0xDE AD-BE:EF')).toEqual(Uint8Array.from([0xde, 0xad, 0xbe, 0xef]));
    expect(() => parseBrowserSerialHex('ABC')).toThrow(/完整字节/);
    expect(unescapeBrowserSerialText('AT\\r\\n\\x4F\\u004B')).toBe('AT\r\nOK');
    const values = new Map<string, string>();
    saveBrowserSerialSettings({ baud: '115200' }, { setItem: (key, value) => values.set(key, value) });
    expect(JSON.parse(values.get(BROWSER_SERIAL_SETTINGS_KEY)!)).toEqual({ baud: '115200', version: 3 });
  });

  it('filters RX/TX evidence and formats stable USB identity labels', () => {
    const entries = [
      { direction: 'rx' as const, text: 'ok', bytes: [0x4f, 0x4b] },
      { direction: 'tx' as const, text: 'AT' },
      { direction: 'system' as const, text: 'connected' },
    ];
    expect(filterBrowserSerialEntries({ entries }, '4f 4b', true, true, false)).toEqual([entries[0]]);
    expect(browserSerialPortName({ name: 'COM7', getInfo: () => ({ usbVendorId: 0x1a86, usbProductId: 0x7523 }) }, 1)).toBe('COM7 · VID:1A86 PID:7523');
  });

  it('classifies recoverable failures and retries only transient open failures', async () => {
    expect(isBrowserSerialChooserCancellation(new DOMException('cancelled', 'AbortError'))).toBe(true);
    expect(isRecoverableBrowserSerialReadError(new Error('framing error'))).toBe(true);
    const open = vi.fn().mockRejectedValueOnce(new DOMException('temporarily unavailable', 'NetworkError')).mockResolvedValueOnce(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    await expect(openBrowserSerialPort({ open, close }, { baudRate: 115200 }, 0)).resolves.toBe(true);
    expect(open).toHaveBeenCalledTimes(2);
    expect(close).toHaveBeenCalledOnce();
  });
});
