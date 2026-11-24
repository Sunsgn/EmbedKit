import { spawn } from 'child_process';

export const SERIAL_DRIVER_API_VERSION = 1;

export const DEFAULT_SERIAL_DRIVER_REGISTRY = [
  { id: 'wch-usb-serial', vendorId: '1A86', name: 'WCH USB 转串口驱动', vendor: '南京沁恒微电子', officialPage: 'https://www.wch-ic.com/downloads/CH341SER_ZIP.html', sourceType: 'manufacturer', verifiedAt: '2026-11-19' },
  { id: 'silabs-cp210x', vendorId: '10C4', name: 'CP210x USB 转 UART VCP 驱动', vendor: 'Silicon Labs', officialPage: 'https://www.silabs.com/developer-tools/usb-to-uart-bridge-vcp-drivers', sourceType: 'manufacturer', verifiedAt: '2026-11-19' },
  { id: 'ftdi-vcp', vendorId: '0403', name: 'FTDI VCP 驱动', vendor: 'FTDI', officialPage: 'https://ftdichip.com/drivers/vcp-drivers/', sourceType: 'manufacturer', verifiedAt: '2026-11-19' },
];

export function extractUsbHardwareIdentity(values) {
  for (const value of Array.isArray(values) ? values : [values]) {
    const match = String(value || '').match(/VID_([0-9A-F]{4}).*PID_([0-9A-F]{4})/i);
    if (match) return { vendorId: match[1].toUpperCase(), productId: match[2].toUpperCase(), evidence: String(value).slice(0, 300) };
  }
  return { vendorId: '', productId: '', evidence: '' };
}

export function parsePnpUtilProblemDevices(output, problemCode = 28) {
  return String(output || '').replace(/\r/g, '').split(/\n\s*\n/).map(block => {
    const lines = block.split('\n').map(line => line.trim()).filter(Boolean), values = lines.map(line => line.match(/:\s+(.*)$/)?.[1]?.trim()).filter(Boolean);
    const instanceId = values.find(value => /^(?:USB|FTDIBUS)\\/i.test(value)) || '';
    const hardwareIds = lines.map(line => line.match(/(?:USB|FTDIBUS)\\[^\s]+/i)?.[0]).filter(Boolean);
    const identity = extractUsbHardwareIdentity([instanceId, ...hardwareIds]);
    if (!instanceId || !identity.vendorId) return null;
    return { instanceId, friendlyName: values[1] || 'USB 设备（驱动缺失）', manufacturer: '', deviceClass: 'Unknown USB', status: 'Error', problemCode, hardwareIds: [...new Set(hardwareIds)] };
  }).filter(Boolean);
}

export function classifySerialDriverDevice(value, registry = DEFAULT_SERIAL_DRIVER_REGISTRY) {
  const hardwareIds = Array.isArray(value?.hardwareIds) ? value.hardwareIds.map(item => String(item).slice(0, 300)).slice(0, 16) : [];
  const identity = extractUsbHardwareIdentity([value?.instanceId, ...hardwareIds]), problemCode = Number(value?.problemCode || 0);
  const recommendation = registry.find(item => item.vendorId === identity.vendorId);
  return {
    instanceId: String(value?.instanceId || '').slice(0, 500),
    friendlyName: String(value?.friendlyName || '未知 USB 设备').slice(0, 200),
    manufacturer: String(value?.manufacturer || '').slice(0, 200),
    deviceClass: String(value?.deviceClass || '').slice(0, 100),
    status: String(value?.status || '').slice(0, 100),
    problemCode,
    driverState: problemCode === 0 ? 'ready' : problemCode === 28 ? 'missing' : 'error',
    vendorId: identity.vendorId,
    productId: identity.productId,
    hardwareIds,
    evidence: identity.evidence,
    recommendation: recommendation ? { ...recommendation, applicableVendorId: recommendation.vendorId, automaticDownload: false } : null,
  };
}

export function createSerialDriverService({
  listPorts,
  getSelection,
  platform = process.platform,
  registry = DEFAULT_SERIAL_DRIVER_REGISTRY,
  processSpawner = spawn,
  maxDevices = 64,
  maxInfBytes = 10 * 1024 * 1024,
} = {}) {
  const runProcess = (executable, args, timeoutMs) => new Promise((resolveProcess, reject) => {
    const child = processSpawner(executable, args, { windowsHide: true, shell: false });
    let output = '', settled = false;
    const finish = (error, code) => { if (settled) return; settled = true; clearTimeout(timer); if (error) reject(error); else if (code !== 0) reject(new Error(`${executable} exited with code ${code}`)); else resolveProcess(output.trim()); };
    const append = data => { if (output.length < 64 * 1024) output += data.toString().slice(0, 64 * 1024 - output.length); };
    const timer = setTimeout(() => { child.kill(); finish(new Error(`${executable} timed out`)); }, timeoutMs);
    child.stdout.on('data', append); child.stderr.on('data', append); child.on('error', error => finish(error)); child.on('close', code => finish(null, code));
  });
  const systemAdapter = {
    platform,
    scan: async () => {
      if (platform !== 'win32') return [];
      const [ports, missingOutput] = await Promise.all([listPorts(), runProcess('pnputil.exe', ['/enum-devices', '/problem', '28', '/deviceids'], 15_000)]);
      const ready = ports.map(port => ({ instanceId: port.pnpId || port.path, friendlyName: port.friendlyName || port.path, manufacturer: port.manufacturer || '', deviceClass: 'Ports', status: 'OK', problemCode: 0, hardwareIds: [port.pnpId || `USB\\VID_${port.vendorId || ''}&PID_${port.productId || ''}`] }));
      const missing = parsePnpUtilProblemDevices(missingOutput, 28), seen = new Set(ready.map(item => item.instanceId.toLowerCase()));
      return [...ready, ...missing.filter(item => !seen.has(item.instanceId.toLowerCase()))];
    },
    install: async path => runProcess('pnputil.exe', ['/add-driver', path, '/install'], 120_000),
  };
  let adapter = systemAdapter;
  const configureAdapter = value => {
    if (value == null) { adapter = systemAdapter; return; }
    if (typeof value.scan !== 'function' || typeof value.install !== 'function' || typeof value.platform !== 'string') throw new Error('Serial driver adapter must provide platform, scan() and install()');
    adapter = value;
  };
  const scan = async () => {
    const detectedAt = new Date().toISOString(), supported = adapter.platform === 'win32';
    if (!supported) return { schemaVersion: 1, platform: adapter.platform, supported: false, detectedAt, devices: [], limits: { maxDevices, maxHardwareIdsPerDevice: 16 }, message: '当前平台不支持 Windows PnP 串口驱动诊断' };
    const raw = await adapter.scan();
    if (!Array.isArray(raw)) throw new Error('Serial driver adapter returned an invalid device list');
    const devices = raw.slice(0, maxDevices).map(value => classifySerialDriverDevice(value, registry));
    return { schemaVersion: 1, platform: adapter.platform, supported: true, detectedAt, devices, limits: { maxDevices, maxHardwareIdsPerDevice: 16 } };
  };
  const install = async (options = {}) => {
    if (adapter.platform !== 'win32') throw new Error('Serial driver installation is only available on Windows');
    if (options.confirmed !== true) throw new Error('Explicit confirmation is required before installing a driver');
    if (typeof getSelection !== 'function') throw new Error('File selection service is unavailable');
    const selection = getSelection(options.selectionId, 'file');
    if (!/\.inf$/i.test(selection.name || '') || !/\.inf$/i.test(selection.path || '')) throw new Error('Selected driver file must be an INF file');
    if (selection.size > maxInfBytes) throw new Error('Selected INF file exceeds the 10 MiB limit');
    const startedAt = new Date().toISOString(), before = await scan();
    await adapter.install(selection.path);
    const after = await scan(), finishedAt = new Date().toISOString();
    return { schemaVersion: 1, state: 'completed', selectedFile: selection.name, startedAt, finishedAt, before, after, evidence: { installer: 'pnputil.exe', arguments: ['/add-driver', '[selected INF]', '/install'], userConfirmed: true } };
  };
  return { apiVersion: SERIAL_DRIVER_API_VERSION, configureAdapter, scan, install };
}
