import { agentRequest } from './agentClient';
import { agentPaths } from '../application/agent/routes';

export interface SerialAgentPort { path: string; manufacturer: string; serialNumber: string; vendorId: string; productId: string; pnpId: string; friendlyName: string }
export interface SerialAgentEvent { id: number; timestamp: string; direction: 'rx' | 'tx' | 'system'; text: string; hex: string; byteLength: number }
export type SerialFrameMode = 'auto' | 'line' | 'idle' | 'raw';
export interface SerialAgentSession { id: string; path: string; baudRate: number; dataBits: number; stopBits: number; parity: string; flowControl: string; dtr: boolean; rts: boolean; frameMode?: SerialFrameMode; frameGapMs?: number; state: 'connecting' | 'connected' | 'error' | 'closed'; rxBytes: number; txBytes: number; openedAt: string; events: SerialAgentEvent[]; reused?: boolean }
export interface OpenSerialOptions { path: string; baudRate: number; dataBits?: number; stopBits?: number; parity?: string; flowControl?: string; dtr?: boolean; rts?: boolean; frameMode?: SerialFrameMode; frameGapMs?: number }
export interface SerialDriverRecommendation { id: string; name: string; vendor: string; vendorId: string; officialPage: string; sourceType: 'manufacturer'; verifiedAt: string; applicableVendorId: string; automaticDownload: boolean }
export interface SerialDriverDevice { instanceId: string; friendlyName: string; manufacturer: string; deviceClass: string; status: string; problemCode: number; driverState: 'ready' | 'missing' | 'error'; vendorId: string; productId: string; hardwareIds: string[]; evidence: string; recommendation: SerialDriverRecommendation | null }
export interface SerialDriverScan { schemaVersion: 1; platform: string; supported: boolean; detectedAt: string; devices: SerialDriverDevice[]; limits: { maxDevices: number; maxHardwareIdsPerDevice: number }; message?: string }
export interface SerialDriverInstallResult { schemaVersion: 1; state: 'completed'; selectedFile: string; startedAt: string; finishedAt: string; before: SerialDriverScan; after: SerialDriverScan; evidence: { installer: string; arguments: string[]; userConfirmed: boolean } }

export async function listSerialPorts() { return (await agentRequest<{ ports: SerialAgentPort[] }>(agentPaths.serialPorts)).ports; }
export async function listSerialSessions() { return (await agentRequest<{ sessions: SerialAgentSession[] }>(agentPaths.serialSessions)).sessions; }
export async function openSerialSession(options: OpenSerialOptions) { return await agentRequest<SerialAgentSession>(agentPaths.serialSessions, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(options) }); }
export async function readSerialSession(id: string, after = 0) { return await agentRequest<SerialAgentSession>(agentPaths.serialSession(id, after)); }
export async function closeSerialSession(id: string) { return await agentRequest<{ closed: boolean }>(agentPaths.serialSession(id), { method: 'DELETE' }); }
export async function sendSerialData(id: string, data: string, encoding: 'text' | 'hex') { return await agentRequest<{ sent: number }>(agentPaths.serialSend(id), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data, encoding }) }); }
export async function setSerialSignals(id: string, dtr: boolean, rts: boolean) { return await agentRequest<{ dtr: boolean; rts: boolean }>(agentPaths.serialSignals(id), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dtr, rts }) }); }
export async function updateSerialBaudRate(id: string, baudRate: number) { return await agentRequest<{ baudRate: number }>(agentPaths.serialConfig(id), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baudRate }) }); }
export async function scanSerialDrivers() { return await agentRequest<SerialDriverScan>(agentPaths.serialDrivers, {}, 20_000); }
export async function installSerialDriver(selectionId: string) { return await agentRequest<SerialDriverInstallResult>(agentPaths.serialDriverInstall, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ selectionId, confirmed: true }) }, 150_000); }
