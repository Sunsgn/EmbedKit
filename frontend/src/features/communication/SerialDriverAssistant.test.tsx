import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SerialDriverAssistant from './SerialDriverAssistant';
import { selectLocalFile } from '../../services/localFiles';
import { installSerialDriver, scanSerialDrivers, type SerialDriverScan } from '../../services/serialAgent';

vi.mock('../../services/localFiles', () => ({ selectLocalFile: vi.fn() }));
vi.mock('../../services/serialAgent', () => ({ scanSerialDrivers: vi.fn(), installSerialDriver: vi.fn() }));

const missingScan: SerialDriverScan = { schemaVersion: 1, platform: 'win32', supported: true, detectedAt: '2026-11-19T00:00:00Z', limits: { maxDevices: 64, maxHardwareIdsPerDevice: 16 }, devices: [{ instanceId: 'USB\\VID_1A86&PID_7523\\A', friendlyName: 'USB2.0-Serial', manufacturer: '', deviceClass: 'Unknown USB', status: 'Error', problemCode: 28, driverState: 'missing', vendorId: '1A86', productId: '7523', hardwareIds: ['USB\\VID_1A86&PID_7523'], evidence: 'USB\\VID_1A86&PID_7523\\A', recommendation: { id: 'wch-usb-serial', name: 'WCH USB 转串口驱动', vendor: '南京沁恒微电子', vendorId: '1A86', officialPage: 'https://www.wch-ic.com/downloads/CH341SER_ZIP.html', sourceType: 'manufacturer', verifiedAt: '2026-11-19', applicableVendorId: '1A86', automaticDownload: false } }] };
const readyScan: SerialDriverScan = { ...missingScan, detectedAt: '2026-11-19T00:01:00Z', devices: missingScan.devices.map(item => ({ ...item, problemCode: 0, driverState: 'ready' as const, status: 'OK' })) };

describe('SerialDriverAssistant', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(scanSerialDrivers).mockResolvedValue(missingScan); vi.stubGlobal('confirm', vi.fn(() => true)); });

  it('automatically diagnoses missing drivers and keeps official evidence', async () => {
    render(<SerialDriverAssistant onPortsChanged={vi.fn()} />);
    expect(await screen.findByText('USB2.0-Serial')).toBeVisible();
    expect(screen.getByText('驱动缺失')).toBeVisible();
    expect(screen.getByRole('link', { name: '打开厂商官方下载页' })).toHaveAttribute('href', 'https://www.wch-ic.com/downloads/CH341SER_ZIP.html');
    expect(screen.getByText(/VID_1A86 PID_7523/)).toBeVisible();
  });

  it('requires confirmation, installs a selected INF, and refreshes ports', async () => {
    const onPortsChanged = vi.fn().mockResolvedValue(undefined);
    vi.mocked(selectLocalFile).mockResolvedValue({ cancelled: false, kind: 'file', name: 'wch.inf', selectionId: 'selection-1' });
    vi.mocked(installSerialDriver).mockResolvedValue({ schemaVersion: 1, state: 'completed', selectedFile: 'wch.inf', startedAt: '2026-11-19T00:00:00Z', finishedAt: '2026-11-19T00:01:00Z', before: missingScan, after: readyScan, evidence: { installer: 'pnputil.exe', arguments: ['/add-driver', '[selected INF]', '/install'], userConfirmed: true } });
    render(<SerialDriverAssistant onPortsChanged={onPortsChanged} />);
    fireEvent.click(await screen.findByRole('button', { name: '选择已解压的 INF 并安装' }));
    await waitFor(() => expect(installSerialDriver).toHaveBeenCalledWith('selection-1'));
    expect(selectLocalFile).toHaveBeenCalledWith('serial-driver-inf');
    expect(confirm).toHaveBeenCalled(); expect(onPortsChanged).toHaveBeenCalled();
    expect(await screen.findByText(/已通过 pnputil.exe 安装 wch.inf/)).toBeVisible();
  });
});
