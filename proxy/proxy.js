import http from 'http';
import https from 'https';
import net from 'net';
import dgram from 'dgram';
import { SerialPort } from 'serialport';
import { createHash, randomUUID } from 'crypto';
import { spawn } from 'child_process';
import { createReadStream, createWriteStream } from 'fs';
import { appendFile, lstat, mkdir, open, readFile, readdir, realpath, rename, rm, stat, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { dirname, isAbsolute, join, relative, resolve } from 'path';
import { URL, pathToFileURL } from 'url';
import { analyzeElf, lookupElfAddress } from './elf.js';

const PORT = process.env.EMBEDKIT_PROXY_PORT || 9999;
const HOST = process.env.EMBEDKIT_PROXY_HOST || '127.0.0.1';
const AGENT_VERSION = '1.0.0';
const AGENT_PROTOCOL_VERSION = 1;
const MAX_REQUEST_BYTES = Number(process.env.EMBEDKIT_MAX_REQUEST_BYTES || 2 * 1024 * 1024);
const MAX_NETWORK_SESSIONS = 16;
const MAX_NETWORK_EVENTS = 2000;
const MAX_SERIAL_SESSIONS = 16;
const MAX_BUILD_JOBS = 8;
const MAX_BUILD_EVENTS = 5000;
const MAX_ARTIFACT_HASH_JOBS = 2;
const MAX_FILE_SELECTIONS = 32;
const MAX_SELECTED_FILE_BYTES = Number(process.env.EMBEDKIT_MAX_SELECTED_FILE_BYTES || 512 * 1024 * 1024);
const MAX_FILE_CHUNK_BYTES = 256 * 1024;
const FILE_SELECTION_TTL_MS = 15 * 60 * 1000;
const PROJECT_SCAN_MAX_FILES = 5000;
const PROJECT_SCAN_MAX_DEPTH = 12;
const PROJECT_SCAN_MAX_ENTRIES = 800;
const PROJECT_SCAN_TIMEOUT_MS = 10_000;
const ELF_ANALYSIS_TTL_MS = 15 * 60 * 1000;
const MAX_ELF_ANALYSES = 8;
const SOFTWARE_DETECTION_TIMEOUT_MS = 4000;
const SOFTWARE_VERSION_OUTPUT_LIMIT = 16 * 1024;
const MAX_INSTALL_JOBS = 20;
const MAX_ACTIVE_INSTALL_JOBS = 2;
const MAX_INSTALL_DOWNLOAD_BYTES = 128 * 1024 * 1024;
const SERIAL_STATE_FILE = process.env.EMBEDKIT_SERIAL_STATE_FILE || join(process.cwd(), '.embedkit-state', 'serial-sessions.json');
const NETWORK_STATE_FILE = process.env.EMBEDKIT_NETWORK_STATE_FILE || join(process.cwd(), '.embedkit-state', 'network-sessions.json');
const AGENT_LOG_FILE = process.env.EMBEDKIT_AGENT_LOG_FILE || join(process.cwd(), '.embedkit-state', 'agent.log');
const AGENT_LOG_MAX_BYTES = Number(process.env.EMBEDKIT_AGENT_LOG_MAX_BYTES || 1024 * 1024);
const SOFTWARE_INSTALLATION_STATE_FILE = process.env.EMBEDKIT_SOFTWARE_STATE_FILE || join(process.cwd(), '.embedkit-state', 'software-installations.json');
let agentLoggingInstalled = false, logWriteQueue = Promise.resolve();
let activeArtifactHashJobs = 0;
const systemSerialAdapter = {
  list: () => SerialPort.list(),
  create: options => new SerialPort(options),
};
let serialAdapter = systemSerialAdapter;
let filePickerActive = false;

const softwareDefinitions = [
  { id: 'runtime.node', capabilityId: 'runtime.node', name: 'Node.js', executable: process.execPath, args: ['--version'] },
  { id: 'build.cmake', capabilityId: 'build.cmake', name: 'CMake', executable: 'cmake', args: ['--version'] },
  { id: 'build.ninja', capabilityId: 'build.ninja', name: 'Ninja', executable: 'ninja', args: ['--version'] },
  { id: 'build.make', capabilityId: 'build.make', name: 'Make', executable: process.platform === 'win32' ? 'mingw32-make' : 'make', args: ['--version'] },
  { id: 'compiler.arm.gnu', capabilityId: 'compiler.arm.gnu', name: 'Arm GNU Toolchain', executable: 'arm-none-eabi-gcc', args: ['--version'] },
  { id: 'debug.openocd', capabilityId: 'debug.openocd', name: 'OpenOCD', executable: 'openocd', args: ['--version'] },
  { id: 'debug.pyocd', capabilityId: 'debug.pyocd', name: 'pyOCD', executable: 'pyocd', args: ['--version'] },
];

const productionInstallManifests = [{
  id: 'ninja-1.12.1-win32-x64', softwareId: 'build.ninja', capabilityId: 'build.ninja', name: 'Ninja', version: '1.12.1', platform: 'win32', architecture: 'x64',
  sourceUrl: 'https://github.com/ninja-build/ninja/releases/download/v1.12.1/ninja-win.zip', officialPage: 'https://github.com/ninja-build/ninja/releases/tag/v1.12.1',
  sha256: 'f550fec705b6d6ff58f2db3c374c2277a37691678d6aba463adcbb129108467a', byteLength: 275425, license: 'Apache-2.0', requiresLicenseAcceptance: false,
  archive: 'zip', installSubdirectory: 'ninja/1.12.1', expectedExecutable: 'ninja.exe', verificationArgs: ['--version'], verifiedAt: '2026-10-14',
}];
let installManifests = productionInstallManifests;
const managedInstallations = new Map();
let managedInstallationsLoaded = false;

export function configureInstallManifestRegistry(manifests) {
  installManifests = manifests == null ? productionInstallManifests : manifests.map(validateInstallManifest);
}

export function validateInstallManifest(value) {
  if (!value || typeof value !== 'object' || !/^[a-z0-9][a-z0-9._-]{2,100}$/i.test(value.id || '') || !/^[a-z0-9][a-z0-9._-]{2,100}$/i.test(value.capabilityId || '')) throw new Error('Install manifest identifiers are invalid');
  const source = new URL(value.sourceUrl);
  if (source.protocol !== 'https:' || !['github.com'].includes(source.hostname)) throw new Error('Install manifest must use an allowed official HTTPS source');
  const officialPage = new URL(value.officialPage);
  if (officialPage.protocol !== 'https:' || officialPage.hostname !== 'github.com') throw new Error('Install manifest official page is invalid');
  if (!/^[a-f0-9]{64}$/.test(value.sha256 || '') || !Number.isSafeInteger(value.byteLength) || value.byteLength < 1 || value.byteLength > MAX_INSTALL_DOWNLOAD_BYTES) throw new Error('Install manifest digest or size is invalid');
  if (value.archive !== 'zip' || !/^[a-z0-9._-]+$/i.test(value.expectedExecutable || '') || !Array.isArray(value.verificationArgs) || value.verificationArgs.some(item => typeof item !== 'string' || item.length > 100)) throw new Error('Install manifest archive or verification rule is invalid');
  if (!/^[a-z0-9._/-]+$/i.test(value.installSubdirectory || '') || value.installSubdirectory.split('/').includes('..')) throw new Error('Install manifest target is invalid');
  return { ...value };
}

export function validateArchiveEntries(output, expectedExecutable) {
  const entries = String(output).replace(/\r/g, '').split('\n').filter(Boolean);
  if (!entries.length || entries.length > 1000) throw new Error('Archive entry count is invalid');
  for (const entry of entries) if (entry.includes('\0') || isAbsolute(entry) || entry.replace(/\\/g, '/').split('/').includes('..')) throw new Error('Archive contains an unsafe path');
  if (!entries.some(entry => entry.replace(/^\.\//, '') === expectedExecutable)) throw new Error(`Archive does not contain ${expectedExecutable}`);
  return entries;
}

function runBoundedProcess(executable, args, timeoutMs = 30_000) {
  return new Promise((resolveProcess, reject) => {
    const child = spawn(executable, args, { windowsHide: true, shell: false }); let output = '', settled = false;
    const finish = (error, code) => { if (settled) return; settled = true; clearTimeout(timer); if (error) reject(error); else if (code !== 0) reject(new Error(`${executable} exited with code ${code}`)); else resolveProcess(output.trim()); };
    const append = data => { if (output.length < SOFTWARE_VERSION_OUTPUT_LIMIT) output += data.toString().slice(0, SOFTWARE_VERSION_OUTPUT_LIMIT - output.length); };
    const timer = setTimeout(() => { child.kill(); finish(new Error(`${executable} timed out`)); }, timeoutMs);
    child.stdout.on('data', append); child.stderr.on('data', append); child.on('error', error => finish(error)); child.on('close', code => finish(null, code));
  });
}

function downloadPinnedFile(job, manifest, destination, redirectCount = 0) {
  return new Promise((resolveDownload, reject) => {
    if (redirectCount > 5) { reject(new Error('Too many download redirects')); return; }
    const url = new URL(manifest.sourceUrl);
    if (url.protocol !== 'https:' || !['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com'].includes(url.hostname)) { reject(new Error('Download redirect left the allowed official hosts')); return; }
    const request = https.get(url, { headers: { 'User-Agent': `EmbedKit-Agent/${AGENT_VERSION}` } }, response => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) { response.resume(); const redirected = new URL(response.headers.location, url); downloadPinnedFile(job, { ...manifest, sourceUrl: redirected.toString() }, destination, redirectCount + 1).then(resolveDownload, reject); return; }
      if (response.statusCode !== 200) { response.resume(); reject(new Error(`Official download returned HTTP ${response.statusCode}`)); return; }
      const declared = Number(response.headers['content-length'] || 0);
      if (declared && declared !== manifest.byteLength) { response.resume(); reject(new Error('Official download size does not match the pinned manifest')); return; }
      const output = createWriteStream(destination, { flags: 'wx' }), hash = createHash('sha256'); let received = 0, finished = false;
      const fail = error => { if (finished) return; finished = true; output.destroy(); reject(error); };
      response.on('data', chunk => { received += chunk.length; if (job.cancelRequested) { request.destroy(); fail(new Error('Installation cancelled')); return; } if (received > manifest.byteLength || received > MAX_INSTALL_DOWNLOAD_BYTES) { request.destroy(); fail(new Error('Download exceeded the pinned size')); return; } hash.update(chunk); output.write(chunk); job.progress = Math.min(70, Math.round(received / manifest.byteLength * 70)); });
      response.on('error', fail); output.on('error', fail);
      response.on('end', () => output.end(() => { if (finished) return; finished = true; const digest = hash.digest('hex'); if (received !== manifest.byteLength || digest !== manifest.sha256) reject(new Error('Downloaded package failed SHA-256 or size verification')); else resolveDownload({ byteLength: received, sha256: digest }); }));
    });
    job.request = request; request.on('error', reject); request.setTimeout(30_000, () => request.destroy(new Error('Official download timed out')));
  });
}

let softwareInstallerAdapter = {
  download: downloadPinnedFile,
  extract: async (job, manifest, archivePath, targetPath) => {
    const listing = await runBoundedProcess('tar', ['-tf', archivePath]); validateArchiveEntries(listing, manifest.expectedExecutable);
    if (job.cancelRequested) throw new Error('Installation cancelled');
    await runBoundedProcess('tar', ['-xf', archivePath, '-C', targetPath]);
  },
};

export function configureSoftwareInstallerAdapter(adapter) {
  softwareInstallerAdapter = adapter == null ? { download: downloadPinnedFile, extract: async (job, manifest, archivePath, targetPath) => { const listing = await runBoundedProcess('tar', ['-tf', archivePath]); validateArchiveEntries(listing, manifest.expectedExecutable); if (job.cancelRequested) throw new Error('Installation cancelled'); await runBoundedProcess('tar', ['-xf', archivePath, '-C', targetPath]); } } : adapter;
}

export function extractSoftwareVersion(output) {
  const match = String(output || '').match(/\bv?(\d+(?:\.\d+){0,3}(?:[-+._][0-9A-Za-z.-]+)?)/);
  return match?.[1] || '';
}

function detectSoftwareDefinition(definition) {
  return new Promise(resolveDetection => {
    const startedAt = Date.now(), child = spawn(definition.executable, definition.args, { windowsHide: true, shell: false });
    let output = '', settled = false;
    const finish = available => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolveDetection({ id: definition.id, capabilityId: definition.capabilityId, name: definition.name, available, executable: definition.executable, version: available ? extractSoftwareVersion(output) : '', rawVersion: available ? output.replace(/\r?\n/g, ' ').trim().slice(0, 500) : '', detection: definition.detection || 'path-command', durationMs: Date.now() - startedAt, installedAt: definition.installedAt, manifestId: definition.manifestId });
    };
    const append = data => { if (output.length < SOFTWARE_VERSION_OUTPUT_LIMIT) output += data.toString().slice(0, SOFTWARE_VERSION_OUTPUT_LIMIT - output.length); };
    const timer = setTimeout(() => { child.kill(); finish(false); }, SOFTWARE_DETECTION_TIMEOUT_MS);
    child.stdout.on('data', append); child.stderr.on('data', append); child.on('error', () => finish(false)); child.on('close', code => finish(code === 0));
  });
}

export async function detectDevelopmentSoftware() {
  if (!managedInstallationsLoaded) {
    managedInstallationsLoaded = true;
    try {
      const stored = JSON.parse(await readFile(SOFTWARE_INSTALLATION_STATE_FILE, 'utf8'));
      if (stored?.version === 1 && Array.isArray(stored.installations)) for (const item of stored.installations.slice(0, 100)) if (item && typeof item.id === 'string' && typeof item.executable === 'string' && isAbsolute(item.executable)) managedInstallations.set(item.id, item);
    } catch { /* No previous managed installations. */ }
  }
  const managedDefinitions = [...managedInstallations.values()].map(item => ({ ...item, args: item.verificationArgs, detection: 'managed-installation' }));
  const results = await Promise.all([...softwareDefinitions, ...managedDefinitions].map(detectSoftwareDefinition));
  for (const result of results) if (!result.available && result.detection === 'managed-installation') managedInstallations.delete(result.id);
  return { schemaVersion: 1, platform: process.platform, architecture: process.arch, detectedAt: new Date().toISOString(), installations: results.filter(item => item.available), unavailable: results.filter(item => !item.available).map(item => ({ id: item.id, capabilityId: item.capabilityId, name: item.name })) };
}

async function saveManagedInstallations() {
  await mkdir(dirname(SOFTWARE_INSTALLATION_STATE_FILE), { recursive: true });
  await writeFile(SOFTWARE_INSTALLATION_STATE_FILE, JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), installations: [...managedInstallations.values()].slice(0, 100) }, null, 2), 'utf8');
}

function compatibleInstallManifests() {
  return installManifests.map(validateInstallManifest).filter(item => item.platform === process.platform && item.architecture === process.arch).map(({ sha256: _sha256, verificationArgs: _verificationArgs, installSubdirectory: _installSubdirectory, expectedExecutable: _expectedExecutable, ...safe }) => safe);
}

function publicInstallJob(job) {
  const { request: _request, rootPath: _rootPath, targetPath: _targetPath, cleanupPath: _cleanupPath, ...safe } = job;
  return safe;
}

function pushInstallEvent(job, level, message) {
  job.events.push({ time: new Date().toISOString(), level, message: String(message).slice(0, 500) });
  if (job.events.length > 100) job.events.splice(0, job.events.length - 100);
}

async function runInstallJob(job, manifest) {
  const archivePath = join(tmpdir(), `embedkit-${job.id}.zip`); let targetCreated = false;
  try {
    pushInstallEvent(job, 'info', `正在从官方来源下载 ${manifest.name} ${manifest.version}`);
    await softwareInstallerAdapter.download(job, manifest, archivePath);
    if (job.cancelRequested) throw new Error('Installation cancelled');
    job.progress = 75; pushInstallEvent(job, 'info', '下载大小和 SHA-256 校验通过');
    let ancestor = job.rootPath;
    for (const segment of manifest.installSubdirectory.split('/')) {
      ancestor = join(ancestor, segment);
      try { const info = await lstat(ancestor); if (info.isSymbolicLink() || !info.isDirectory()) throw new Error('Install target contains a non-directory or symbolic-link ancestor'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; job.cleanupPath = ancestor; break; }
    }
    await mkdir(job.targetPath, { recursive: true }); targetCreated = true;
    await softwareInstallerAdapter.extract(job, manifest, archivePath, job.targetPath);
    if (job.cancelRequested) throw new Error('Installation cancelled');
    job.progress = 90;
    const executable = join(job.targetPath, manifest.expectedExecutable), info = await stat(executable);
    if (!info.isFile()) throw new Error('Installed executable was not found');
    const rawVersion = await runBoundedProcess(executable, manifest.verificationArgs, 10_000), version = extractSoftwareVersion(rawVersion);
    if (job.cancelRequested) throw new Error('Installation cancelled');
    if (!version) throw new Error('Installed software did not return a verifiable version');
    const installation = { id: `${manifest.softwareId}:${manifest.version}:${createHash('sha256').update(executable).digest('hex').slice(0, 12)}`, capabilityId: manifest.capabilityId, name: manifest.name, executable, verificationArgs: manifest.verificationArgs, version, installedAt: new Date().toISOString(), manifestId: manifest.id };
    managedInstallations.set(installation.id, installation); await saveManagedInstallations();
    job.state = 'passed'; job.progress = 100; job.installation = { ...installation, verificationArgs: undefined }; job.installPath = job.targetPath; pushInstallEvent(job, 'info', `安装完成并验证版本 ${version}`);
  } catch (error) {
    job.state = job.cancelRequested || /cancelled/i.test(error.message) ? 'cancelled' : 'failed'; job.error = error.message; pushInstallEvent(job, 'error', error.message);
    if (targetCreated) await rm(job.cleanupPath || job.targetPath, { recursive: true, force: true }).catch(() => undefined);
  } finally {
    job.finishedAt = new Date().toISOString(); job.request = null; await rm(archivePath, { force: true }).catch(() => undefined);
  }
}

async function startInstallJob(options) {
  if ([...installJobs.values()].filter(item => item.state === 'running').length >= MAX_ACTIVE_INSTALL_JOBS) throw new Error(`At most ${MAX_ACTIVE_INSTALL_JOBS} installation jobs may run at once`);
  const manifest = installManifests.map(validateInstallManifest).find(item => item.id === options.manifestId);
  if (!manifest || manifest.platform !== process.platform || manifest.architecture !== process.arch) throw new Error('Install manifest is unavailable for this platform');
  if (manifest.requiresLicenseAcceptance && options.acceptedLicense !== true) throw new Error('License acceptance is required');
  const selection = getFileSelection(options.directorySelectionId, 'directory'), rootPath = await realpath(resolve(selection.path)), targetPath = resolve(rootPath, ...manifest.installSubdirectory.split('/'));
  const relation = relative(rootPath, targetPath);
  if (!relation || relation.startsWith('..') || isAbsolute(relation)) throw new Error('Install target must stay inside the selected directory');
  const rootInfo = await stat(rootPath); if (!rootInfo.isDirectory()) throw new Error('Selected install root is no longer a directory');
  if (await stat(targetPath).then(() => true).catch(() => false)) throw new Error('Install target already exists; choose another root or remove it manually');
  while (installJobs.size >= MAX_INSTALL_JOBS) { const removable = [...installJobs].find(([, item]) => item.state !== 'running'); if (!removable) break; installJobs.delete(removable[0]); }
  const job = { id: randomUUID(), manifestId: manifest.id, softwareId: manifest.softwareId, name: manifest.name, version: manifest.version, state: 'running', progress: 0, startedAt: new Date().toISOString(), finishedAt: '', cancelRequested: false, events: [], error: '', rootPath, targetPath, cleanupPath: '', request: null };
  installJobs.set(job.id, job); void runInstallJob(job, manifest); return publicInstallJob(job);
}

function runPickerProcess(executable, args) {
  return new Promise((resolvePicker, reject) => {
    const child = spawn(executable, args, { windowsHide: false, shell: false });
    let stdout = '', stderr = '', finished = false;
    const timer = setTimeout(() => { if (!finished) child.kill(); }, 5 * 60 * 1000);
    const finish = (error, value) => { if (finished) return; finished = true; clearTimeout(timer); if (error) reject(error); else resolvePicker(value); };
    child.stdout.on('data', data => { stdout += data.toString(); });
    child.stderr.on('data', data => { stderr += data.toString(); });
    child.on('error', error => finish(error));
    child.on('close', code => {
      const path = stdout.trim();
      if (path) finish(null, { cancelled: false, path });
      else if (code === 0 || code === 1) finish(null, { cancelled: true });
      else finish(new Error(stderr.trim() || `System picker exited with code ${code}`));
    });
  });
}

const systemFilePickerAdapter = {
  select: ({ kind }) => {
    if (process.platform === 'win32') {
      const script = kind === 'directory'
        ? "Add-Type -AssemblyName System.Windows.Forms; $d=New-Object System.Windows.Forms.FolderBrowserDialog; $d.Description='Select an embedded project directory'; if($d.ShowDialog() -eq 'OK'){[Console]::Out.Write($d.SelectedPath)}"
        : "Add-Type -AssemblyName System.Windows.Forms; $d=New-Object System.Windows.Forms.OpenFileDialog; $d.Title='Select an embedded development file'; $d.Filter='Embedded files|*.map;*.elf;*.axf;*.out;*.bin;*.hex;*.srec;*.s19|All files|*.*'; if($d.ShowDialog() -eq 'OK'){[Console]::Out.Write($d.FileName)}";
      return runPickerProcess('powershell.exe', ['-NoProfile', '-STA', '-Command', script]);
    }
    if (process.platform === 'darwin') return runPickerProcess('osascript', ['-e', kind === 'directory' ? 'POSIX path of (choose folder with prompt "Select an embedded project directory")' : 'POSIX path of (choose file with prompt "Select an embedded development file")']);
    return runPickerProcess('zenity', ['--file-selection', ...(kind === 'directory' ? ['--directory'] : []), '--title', kind === 'directory' ? 'Select an embedded project directory' : 'Select an embedded development file']);
  },
};
let filePickerAdapter = systemFilePickerAdapter;

function createPathSelection(kind, path, info) {
  if (kind === 'file' && info.size > MAX_SELECTED_FILE_BYTES) throw new Error(`Selected file exceeds ${MAX_SELECTED_FILE_BYTES} bytes`);
  const now = Date.now(), selectionId = randomUUID();
  for (const [id, selection] of fileSelections) if (selection.expiresAt <= now) fileSelections.delete(id);
  while (fileSelections.size >= MAX_FILE_SELECTIONS) fileSelections.delete(fileSelections.keys().next().value);
  const selection = { id: selectionId, kind, path, name: path.split(/[\\/]/).filter(Boolean).pop() || path, size: kind === 'file' ? info.size : undefined, modifiedAt: info.mtime.toISOString(), expiresAt: now + FILE_SELECTION_TTL_MS };
  fileSelections.set(selectionId, selection);
  return { cancelled: false, kind, path, name: selection.name, selectionId, size: selection.size, modifiedAt: selection.modifiedAt, expiresAt: new Date(selection.expiresAt).toISOString() };
}

export function configureSerialAdapter(adapter) {
  if (adapter == null) { serialAdapter = systemSerialAdapter; return; }
  if (typeof adapter.list !== 'function' || typeof adapter.create !== 'function') throw new Error('Serial adapter must provide list() and create()');
  serialAdapter = adapter;
}

export function configureFilePickerAdapter(adapter) {
  if (adapter == null) { filePickerAdapter = systemFilePickerAdapter; return; }
  if (typeof adapter.select !== 'function') throw new Error('File picker adapter must provide select()');
  filePickerAdapter = adapter;
}

async function selectLocalPath(options = {}) {
  const kind = options.kind === 'file' ? 'file' : options.kind === 'directory' ? 'directory' : '';
  if (!kind) throw new Error('Picker kind must be file or directory');
  if (filePickerActive) throw new Error('A system file picker is already open');
  filePickerActive = true;
  try {
    const result = await filePickerAdapter.select({ kind });
    if (result?.cancelled || !result?.path) return { cancelled: true, kind };
    if (!isAbsolute(result.path) || /[\0\r\n]/.test(result.path)) throw new Error('System picker returned an invalid path');
    const path = resolve(result.path), info = await stat(path);
    if (kind === 'directory' ? !info.isDirectory() : !info.isFile()) throw new Error(`Selected path is not a ${kind}`);
    return createPathSelection(kind, path, info);
  } finally { filePickerActive = false; }
}

function getFileSelection(id, requiredKind) {
  const selection = fileSelections.get(id);
  if (!selection || selection.expiresAt <= Date.now()) { fileSelections.delete(id); throw new Error('File selection is missing or expired'); }
  if (requiredKind && selection.kind !== requiredKind) throw new Error(`Selection is not a ${requiredKind}`);
  return selection;
}

const projectIgnoredDirectories = new Set(['.git', '.svn', '.hg', 'node_modules', '.pio', '.cache', '__pycache__', '.idea', '.vscode', 'coverage']);
const projectSourceExtensions = new Set(['.c', '.h', '.cc', '.cpp', '.cxx', '.hpp', '.s', '.asm', '.rs', '.zig']);
const projectConfigNames = new Set(['cmakelists.txt', 'makefile', 'meson.build', 'platformio.ini', 'west.yml', 'prj.conf', 'freertosconfig.h', 'rtconfig.h']);
const projectConfigExtensions = new Set(['.uvprojx', '.uvproj', '.ewp', '.eww', '.ioc', '.project', '.cproject', '.ld', '.icf', '.sct', '.dts', '.dtsi', '.yaml', '.yml']);
const projectArtifactExtensions = new Map([['.bin', 'bin'], ['.hex', 'hex'], ['.elf', 'elf'], ['.axf', 'elf'], ['.out', 'elf'], ['.map', 'map'], ['.srec', 'srec'], ['.s19', 'srec']]);

function addProjectRecognition(recognition, category, value, relativePath, confidence, detail) {
  if (!recognition[category].includes(value)) recognition[category].push(value);
  if (!recognition.evidence.some(item => item.category === category && item.value === value && item.path === relativePath)) recognition.evidence.push({ category, value, path: relativePath, confidence, detail });
}

function recognizeProjectFile(recognition, relativePath) {
  const normalized = relativePath.replace(/\\/g, '/'), name = normalized.split('/').pop() || '', lower = name.toLowerCase(), extension = lower.includes('.') ? lower.slice(lower.lastIndexOf('.')) : '';
  if (lower === 'cmakelists.txt') addProjectRecognition(recognition, 'buildSystems', 'CMake', normalized, 'high', '发现 CMakeLists.txt');
  if (lower === 'makefile' || lower.endsWith('.mk')) addProjectRecognition(recognition, 'buildSystems', 'Make', normalized, 'high', '发现 Makefile 或 .mk');
  if (lower === 'meson.build') addProjectRecognition(recognition, 'buildSystems', 'Meson', normalized, 'high', '发现 meson.build');
  if (lower === 'platformio.ini') { addProjectRecognition(recognition, 'buildSystems', 'PlatformIO', normalized, 'high', '发现 platformio.ini'); addProjectRecognition(recognition, 'ides', 'PlatformIO', normalized, 'medium', 'PlatformIO 工程配置'); }
  if (extension === '.uvprojx' || extension === '.uvproj') { addProjectRecognition(recognition, 'ides', 'Keil µVision', normalized, 'high', '发现 µVision 工程文件'); addProjectRecognition(recognition, 'toolchains', 'Arm Compiler / GNU（待工程配置确认）', normalized, 'medium', 'µVision 可配置多种工具链'); }
  if (extension === '.ewp' || extension === '.eww') { addProjectRecognition(recognition, 'ides', 'IAR Embedded Workbench', normalized, 'high', '发现 IAR 工程文件'); addProjectRecognition(recognition, 'toolchains', 'IAR 工具链', normalized, 'medium', '发现 IAR 工程容器，具体版本待确认'); }
  if (extension === '.project' || extension === '.cproject') addProjectRecognition(recognition, 'ides', 'Eclipse 系工程', normalized, 'medium', '发现 Eclipse 工程元数据');
  if (lower === 'freertosconfig.h') addProjectRecognition(recognition, 'frameworks', 'FreeRTOS', normalized, 'high', '发现 FreeRTOSConfig.h');
  if (lower === 'west.yml' || lower === 'prj.conf') addProjectRecognition(recognition, 'frameworks', 'Zephyr', normalized, 'medium', `发现 ${name}`);
  if (lower === 'rtconfig.h') addProjectRecognition(recognition, 'frameworks', 'RT-Thread', normalized, 'high', '发现 rtconfig.h');
  if (lower === 'tx_api.h') addProjectRecognition(recognition, 'frameworks', 'ThreadX / Azure RTOS', normalized, 'high', '发现 tx_api.h');
  if (extension === '.ioc') { addProjectRecognition(recognition, 'projectTypes', 'MCU 固件工程', normalized, 'medium', '发现芯片配置工程文件'); const chip = name.replace(/\.ioc$/i, ''); if (/^(?:stm32|gd32|at32|ch32|hc32|mm32|n32)/i.test(chip)) addProjectRecognition(recognition, 'chipCandidates', chip, normalized, 'medium', '由配置文件名推断，需结合工程配置确认'); }
}

export async function scanProjectDirectory(rootPath, options = {}) {
  const maxFiles = Math.min(PROJECT_SCAN_MAX_FILES, Math.max(1, Number.isSafeInteger(options.maxFiles) ? options.maxFiles : PROJECT_SCAN_MAX_FILES));
  const maxDepth = Math.min(PROJECT_SCAN_MAX_DEPTH, Math.max(1, Number.isSafeInteger(options.maxDepth) ? options.maxDepth : PROJECT_SCAN_MAX_DEPTH));
  const startedAt = Date.now(), root = await realpath(resolve(rootPath)), rootInfo = await stat(root);
  if (!rootInfo.isDirectory()) throw new Error('Selected project path is no longer a directory');
  const recognition = { projectTypes: [], frameworks: [], ides: [], toolchains: [], buildSystems: [], chipCandidates: [], evidence: [], unknowns: [] };
  const inventory = { scannedAt: '', fileCount: 0, directoryCount: 0, sourceFileCount: 0, configFileCount: 0, artifactCount: 0, maxFiles, maxDepth, truncated: false, entries: [], warnings: [] };
  const artifacts = [], queue = [{ path: root, relativePath: '', depth: 0 }];
  while (queue.length && inventory.fileCount < maxFiles) {
    if (Date.now() - startedAt > PROJECT_SCAN_TIMEOUT_MS) { inventory.truncated = true; inventory.warnings.push(`扫描超过 ${PROJECT_SCAN_TIMEOUT_MS} ms，已停止并保留当前结果`); break; }
    const current = queue.shift(); let children;
    try { children = await readdir(current.path, { withFileTypes: true }); }
    catch (error) { inventory.warnings.push(`无法读取 ${current.relativePath || '.'}：${String(error.message || error).slice(0, 160)}`); continue; }
    children.sort((a, b) => a.name.localeCompare(b.name));
    for (const child of children) {
      if (inventory.fileCount >= maxFiles) { inventory.truncated = true; break; }
      const childRelative = current.relativePath ? `${current.relativePath}/${child.name}` : child.name, childPath = join(current.path, child.name);
      if (child.isSymbolicLink()) { inventory.warnings.push(`已跳过符号链接：${childRelative}`); continue; }
      if (child.isDirectory()) {
        if (projectIgnoredDirectories.has(child.name.toLowerCase()) || /^(?:build|dist|out|target|debug|release)$/i.test(child.name)) continue;
        inventory.directoryCount += 1;
        if (inventory.entries.length < PROJECT_SCAN_MAX_ENTRIES) inventory.entries.push({ path: childRelative, kind: 'directory' });
        if (current.depth < maxDepth) queue.push({ path: childPath, relativePath: childRelative, depth: current.depth + 1 });
        else { inventory.truncated = true; inventory.warnings.push(`已达到最大目录深度：${childRelative}`); }
        continue;
      }
      if (!child.isFile()) continue;
      let info; try { info = await stat(childPath); } catch { inventory.warnings.push(`文件在扫描期间发生变化：${childRelative}`); continue; }
      inventory.fileCount += 1;
      const lower = child.name.toLowerCase(), extension = lower.includes('.') ? lower.slice(lower.lastIndexOf('.')) : '';
      const category = projectArtifactExtensions.has(extension) ? 'artifact' : projectConfigNames.has(lower) || projectConfigExtensions.has(extension) || lower.endsWith('.mk') ? 'config' : projectSourceExtensions.has(extension) ? 'source' : 'other';
      if (category === 'source') inventory.sourceFileCount += 1;
      if (category === 'config') inventory.configFileCount += 1;
      if (category === 'artifact') { inventory.artifactCount += 1; artifacts.push({ path: childRelative, kind: projectArtifactExtensions.get(extension), byteLength: info.size, modifiedAt: info.mtime.toISOString() }); }
      if (inventory.entries.length < PROJECT_SCAN_MAX_ENTRIES) inventory.entries.push({ path: childRelative, kind: 'file', category, byteLength: info.size });
      recognizeProjectFile(recognition, childRelative);
    }
  }
  if (queue.length || inventory.fileCount >= maxFiles) inventory.truncated = true;
  if (!recognition.projectTypes.length && inventory.sourceFileCount > 0) addProjectRecognition(recognition, 'projectTypes', '通用嵌入式源码工程', recognition.evidence[0]?.path || '', 'low', '发现源码，但未识别到确定的平台或框架标记');
  for (const [field, label] of [['frameworks', '框架/RTOS'], ['ides', 'IDE'], ['toolchains', '工具链'], ['buildSystems', '构建系统'], ['chipCandidates', '芯片型号']]) if (!recognition[field].length) recognition.unknowns.push(`${label}未识别`);
  const scores = { high: 1, medium: 0.65, low: 0.35 }, evidenceScore = recognition.evidence.reduce((sum, item) => sum + scores[item.confidence], 0);
  inventory.scannedAt = new Date().toISOString();
  return { schemaVersion: 1, rootName: root.split(/[\\/]/).filter(Boolean).pop() || root, durationMs: Date.now() - startedAt, recognition: { ...recognition, confidence: recognition.evidence.length ? Math.min(1, evidenceScore / Math.max(1, recognition.evidence.length)) : 0 }, inventory, artifacts: artifacts.slice(0, 500) };
}

async function scanSelectedProject(selectionId, options) {
  const selection = getFileSelection(selectionId, 'directory');
  return scanProjectDirectory(selection.path, options);
}

async function readSelectedFileChunk(id, offsetValue, lengthValue) {
  const selection = getFileSelection(id, 'file'), info = await stat(selection.path);
  if (!info.isFile() || info.size !== selection.size) throw new Error('Selected file changed after authorization');
  const offset = Number(offsetValue ?? 0), length = Number(lengthValue ?? MAX_FILE_CHUNK_BYTES);
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Chunk offset must be a non-negative integer');
  if (!Number.isSafeInteger(length) || length < 1 || length > MAX_FILE_CHUNK_BYTES) throw new Error(`Chunk length must be between 1 and ${MAX_FILE_CHUNK_BYTES}`);
  if (offset > info.size) throw new Error('Chunk offset exceeds file size');
  const end = Math.min(info.size, offset + length), handle = await open(selection.path, 'r');
  try { const buffer = Buffer.alloc(end - offset), { bytesRead } = await handle.read(buffer, 0, buffer.length, offset); return { selectionId: id, offset, byteLength: bytesRead, size: info.size, eof: offset + bytesRead >= info.size, encoding: 'base64', data: buffer.subarray(0, bytesRead).toString('base64') }; }
  finally { await handle.close(); }
}

async function analyzeSelectedElf(id) {
  const selection = getFileSelection(id, 'file'), info = await stat(selection.path);
  if (!info.isFile() || info.size !== selection.size) throw new Error('Selected file changed after authorization');
  const handle = await open(selection.path, 'r');
  try {
    const analysis = await analyzeElf({ size: info.size, read: async (offset, length) => {
      if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || offset + length > info.size) throw new Error('ELF parser requested data outside the selected file');
      const buffer = Buffer.alloc(length), { bytesRead } = await handle.read(buffer, 0, length, offset);
      if (bytesRead !== length) throw new Error('Selected ELF file was truncated while reading');
      return new Uint8Array(buffer.buffer, buffer.byteOffset, bytesRead);
    } });
    const now = Date.now(), analysisId = randomUUID();
    for (const [cachedId, cached] of elfAnalyses) if (cached.expiresAt <= now) elfAnalyses.delete(cachedId);
    while (elfAnalyses.size >= MAX_ELF_ANALYSES) elfAnalyses.delete(elfAnalyses.keys().next().value);
    elfAnalyses.set(analysisId, { analysis, expiresAt: now + ELF_ANALYSIS_TTL_MS });
    const { symbols: _symbols, lineRows: _lineRows, ...publicAnalysis } = analysis;
    return { ...publicAnalysis, analysisId, expiresAt: new Date(now + ELF_ANALYSIS_TTL_MS).toISOString() };
  } finally { await handle.close(); }
}

function lookupAnalyzedElf(id, address) {
  const cached = elfAnalyses.get(id);
  if (!cached || cached.expiresAt <= Date.now()) { elfAnalyses.delete(id); throw new Error('ELF analysis is missing or expired; select the file again'); }
  return lookupElfAddress(cached.analysis, address);
}

function installAgentLogging() {
  if (agentLoggingInstalled) return;
  agentLoggingInstalled = true;
  for (const level of ['log', 'warn', 'error']) {
    const original = console[level].bind(console);
    console[level] = (...values) => {
      original(...values);
      const line = `${new Date().toISOString()} [${level.toUpperCase()}] ${values.map(value => value instanceof Error ? value.stack || value.message : typeof value === 'string' ? value : JSON.stringify(value)).join(' ')}\n`;
      logWriteQueue = logWriteQueue.then(async () => {
        await mkdir(dirname(AGENT_LOG_FILE), { recursive: true });
        const size = await stat(AGENT_LOG_FILE).then(value => value.size).catch(() => 0);
        if (size + Buffer.byteLength(line) > AGENT_LOG_MAX_BYTES) {
          await rm(`${AGENT_LOG_FILE}.3`, { force: true });
          await rename(`${AGENT_LOG_FILE}.2`, `${AGENT_LOG_FILE}.3`).catch(() => undefined);
          await rename(`${AGENT_LOG_FILE}.1`, `${AGENT_LOG_FILE}.2`).catch(() => undefined);
          await rename(AGENT_LOG_FILE, `${AGENT_LOG_FILE}.1`).catch(() => undefined);
        }
        await appendFile(AGENT_LOG_FILE, line, 'utf8');
      }).catch(() => undefined);
    };
  }
}
const allowedOrigins = new Set((process.env.EMBEDKIT_ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000,https://sunsgn.github.io')
  .split(',').map(value => value.trim()).filter(Boolean));
const allowedTargets = new Set((process.env.EMBEDKIT_ALLOWED_TARGETS || [
  'http://localhost:11434',
  'http://127.0.0.1:11434',
  'http://localhost:1234',
  'http://127.0.0.1:1234',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3123',
  'http://127.0.0.1:3123',
  'http://localhost:1337',
  'http://127.0.0.1:1337',
  'http://localhost:4891',
  'http://127.0.0.1:4891',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://localhost:5001',
  'http://127.0.0.1:5001',
  'http://localhost:7860',
  'http://127.0.0.1:7860',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
].join(',')).split(',').map(value => value.trim()).filter(Boolean));

export function isAllowedOrigin(origin) {
  return !origin || allowedOrigins.has(origin);
}

function setCORS(req, res) {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    if (req.headers['access-control-request-private-network'] === 'true') {
      res.setHeader('Access-Control-Allow-Private-Network', 'true');
    }
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-EmbedKit-Protocol');
  res.setHeader('Access-Control-Expose-Headers', 'X-EmbedKit-Protocol');
  res.setHeader('X-EmbedKit-Protocol', String(AGENT_PROTOCOL_VERSION));
}

function jsonRes(res, status, data) {
  if (status >= 400 && typeof data?.error === 'string') {
    const message = data.error;
    data = { ...data, code: status === 404 ? 'NOT_FOUND' : status === 403 ? 'FORBIDDEN' : status === 405 ? 'METHOD_NOT_ALLOWED' : status >= 500 ? 'AGENT_INTERNAL_ERROR' : 'INVALID_REQUEST', message, details: data.details ?? null, recoverable: status < 500 };
  }
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

export function validateProxyTarget(targetUrl) {
  let target;
  try {
    target = new URL(targetUrl);
  } catch {
    throw new Error('Invalid proxy target URL');
  }
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) {
    throw new Error('Only credential-free HTTP(S) targets are allowed');
  }
  if (!allowedTargets.has(target.origin)) {
    throw new Error(`Proxy target is not allowed: ${target.origin}`);
  }
  return target;
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    req.on('data', chunk => {
      if (tooLarge) return;
      size += chunk.length;
      if (size > MAX_REQUEST_BYTES) {
        tooLarge = true;
        reject(new Error(`Request body exceeds ${MAX_REQUEST_BYTES} bytes`));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => { if (!tooLarge) resolve(Buffer.concat(chunks)); });
    req.on('error', reject);
  });
}

async function readJSONBody(req) {
  const body = await readRequestBody(req);
  if (!body.length) return {};
  try { return JSON.parse(body.toString('utf8')); }
  catch { throw new Error('Request body must be valid JSON'); }
}

const networkSessions = new Map();
const serialSessions = new Map();
const buildJobs = new Map();
const fileSelections = new Map();
const elfAnalyses = new Map();
const installJobs = new Map();
let restoringSerialSessions = false;

async function persistSerialSessions() {
  const sessions = [...serialSessions.values()].filter(session => session.state === 'connected').map(({ path, baudRate, dataBits, stopBits, parity, flowControl, dtr, rts, frameMode, frameGapMs }) => ({ path, baudRate, dataBits, stopBits, parity, flowControl, dtr, rts, frameMode, frameGapMs }));
  try { await mkdir(dirname(SERIAL_STATE_FILE), { recursive: true }); await writeFile(SERIAL_STATE_FILE, JSON.stringify({ version: 1, sessions }, null, 2), 'utf8'); }
  catch (error) { console.warn(`Unable to save serial sessions: ${error.message}`); }
}

async function restoreSerialSessions() {
  let saved;
  try { saved = JSON.parse(await readFile(SERIAL_STATE_FILE, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') console.warn(`Unable to read saved serial sessions: ${error.message}`); return; }
  if (!Array.isArray(saved?.sessions)) return;
  let failures = 0;
  restoringSerialSessions = true;
  for (const options of saved.sessions.slice(0, MAX_SERIAL_SESSIONS)) {
    let restored = false, lastError;
    for (let attempt = 1; attempt <= 8 && !restored; attempt += 1) {
      try { const { session } = await createSerialSession(options); pushSerialEvent(session, 'system', '已自动恢复上次串口会话'); restored = true; }
      catch (error) { lastError = error; if (attempt < 8) await new Promise(resolve => setTimeout(resolve, 500)); }
    }
    if (!restored) { failures += 1; console.warn(`Unable to restore serial session ${options?.path || ''}: ${lastError?.message || 'unknown error'}`); }
  }
  restoringSerialSessions = false;
  if (!failures) await persistSerialSessions();
}

async function persistNetworkSessions() {
  const sessions = [...networkSessions.values()].filter(session => session.state !== 'closed').map(({ type, mode, host, port, localPort }) => ({ type, mode, host, port, localPort }));
  try { await mkdir(dirname(NETWORK_STATE_FILE), { recursive: true }); await writeFile(NETWORK_STATE_FILE, JSON.stringify({ version: 1, sessions }, null, 2), 'utf8'); }
  catch (error) { console.warn(`Unable to save network sessions: ${error.message}`); }
}

async function restoreNetworkSessions() {
  let saved;
  try { saved = JSON.parse(await readFile(NETWORK_STATE_FILE, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') console.warn(`Unable to read saved network sessions: ${error.message}`); return; }
  if (!Array.isArray(saved?.sessions)) return;
  for (const options of saved.sessions.slice(0, MAX_NETWORK_SESSIONS)) {
    try { const session = createNetworkSession(options.type, options.host, options.port, options.localPort, options.mode); pushNetworkEvent(session, 'system', '已自动恢复上次网络会话'); }
    catch (error) { console.warn(`Unable to restore network session ${options?.type || ''} ${options?.host || ''}:${options?.port || ''}: ${error.message}`); }
  }
  await persistNetworkSessions();
}

export function validateSerialOptions(options = {}) {
  const path = String(options.path || '').trim();
  if (!path || path.length > 260 || /[\r\n\0]/.test(path)) throw new Error('Invalid serial port path');
  const baudRate = Number(options.baudRate ?? 115200), dataBits = Number(options.dataBits ?? 8), stopBits = Number(options.stopBits ?? 1);
  const parity = options.parity || 'none', flowControl = options.flowControl || 'none';
  const frameMode = options.frameMode || 'auto', frameGapMs = Number(options.frameGapMs ?? 30);
  if (!Number.isInteger(baudRate) || baudRate < 50 || baudRate > 12000000) throw new Error('Invalid serial baud rate');
  if (![5, 6, 7, 8].includes(dataBits)) throw new Error('Serial data bits must be 5, 6, 7 or 8');
  if (![1, 1.5, 2].includes(stopBits)) throw new Error('Serial stop bits must be 1, 1.5 or 2');
  if (!['none', 'even', 'odd', 'mark', 'space'].includes(parity)) throw new Error('Invalid serial parity');
  if (!['none', 'hardware'].includes(flowControl)) throw new Error('Invalid serial flow control');
  if (!['auto', 'line', 'idle', 'raw'].includes(frameMode)) throw new Error('Invalid serial frame mode');
  if (!Number.isFinite(frameGapMs) || frameGapMs < 5 || frameGapMs > 2000) throw new Error('Serial frame gap must be between 5 and 2000 ms');
  return { path, baudRate, dataBits, stopBits, parity, flowControl, dtr: options.dtr !== false, rts: options.rts === true, frameMode, frameGapMs };
}

function pushSerialEvent(session, direction, bufferOrText) {
  const buffer = Buffer.isBuffer(bufferOrText) ? bufferOrText : null;
  session.lastEventId += 1;
  session.events.push({ id: session.lastEventId, timestamp: new Date().toISOString(), direction, text: buffer ? buffer.toString('utf8') : String(bufferOrText), hex: buffer ? buffer.toString('hex').match(/.{1,2}/g)?.join(' ').toUpperCase() || '' : '', byteLength: buffer?.length || Buffer.byteLength(String(bufferOrText)) });
  if (session.events.length > MAX_NETWORK_EVENTS) session.events.splice(0, session.events.length - MAX_NETWORK_EVENTS);
  if (direction === 'tx' && buffer) session.txBytes += buffer.length;
}

function publicSerialSession(session, after = 0) {
  const { port: _port, rxBuffer: _rxBuffer, rxTimer: _rxTimer, ...safe } = session;
  return { ...safe, events: session.events.filter(event => event.id > after) };
}

function flushSerialReceive(session) {
  if (!session.rxBuffer.length) return;
  const frame = session.rxBuffer; session.rxBuffer = Buffer.alloc(0); pushSerialEvent(session, 'rx', frame);
}

export function receiveSerialData(session, data) {
  session.rxBytes += data.length;
  if (session.frameMode === 'raw') { pushSerialEvent(session, 'rx', data); return; }
  session.rxBuffer = Buffer.concat([session.rxBuffer, data]);
  if (session.frameMode === 'auto' || session.frameMode === 'line') {
    for (;;) {
      const cr = session.rxBuffer.indexOf(13), lf = session.rxBuffer.indexOf(10);
      const at = cr < 0 ? lf : lf < 0 ? cr : Math.min(cr, lf);
      if (at < 0) break;
      const frame = session.rxBuffer.subarray(0, at); let next = at;
      while (session.rxBuffer[next] === 10 || session.rxBuffer[next] === 13) next += 1;
      session.rxBuffer = session.rxBuffer.subarray(next);
      if (frame.length) pushSerialEvent(session, 'rx', frame);
    }
  }
  if (session.rxTimer) { clearTimeout(session.rxTimer); session.rxTimer = null; }
  if ((session.frameMode === 'auto' || session.frameMode === 'idle') && session.rxBuffer.length) session.rxTimer = setTimeout(() => { session.rxTimer = null; flushSerialReceive(session); }, session.frameGapMs);
}

async function listSerialPorts() {
  return (await serialAdapter.list()).map(port => ({ path: port.path, manufacturer: port.manufacturer || '', serialNumber: port.serialNumber || '', vendorId: port.vendorId || '', productId: port.productId || '', pnpId: port.pnpId || '', friendlyName: port.friendlyName || port.path }));
}

async function createSerialSession(input) {
  const options = validateSerialOptions(input);
  const available = await listSerialPorts();
  if (!available.some(port => port.path.toLowerCase() === options.path.toLowerCase())) throw new Error(`Serial port is not available: ${options.path}`);
  const existing = [...serialSessions.values()].find(session => session.path.toLowerCase() === options.path.toLowerCase() && session.state === 'connected');
  if (existing) {
    if (existing.baudRate !== options.baudRate || existing.dataBits !== options.dataBits || existing.stopBits !== options.stopBits || existing.parity !== options.parity || existing.flowControl !== options.flowControl || existing.frameMode !== options.frameMode || existing.frameGapMs !== options.frameGapMs) throw new Error(`${options.path} is already open with different settings`);
    return { session: existing, reused: true };
  }
  if (serialSessions.size >= MAX_SERIAL_SESSIONS) throw new Error(`At most ${MAX_SERIAL_SESSIONS} serial sessions may be open`);
  const id = randomUUID(), port = serialAdapter.create({ path: options.path, baudRate: options.baudRate, dataBits: options.dataBits, stopBits: options.stopBits, parity: options.parity, rtscts: options.flowControl === 'hardware', autoOpen: false });
  const session = { id, ...options, state: 'connecting', events: [], lastEventId: 0, rxBytes: 0, txBytes: 0, openedAt: new Date().toISOString(), port, rxBuffer: Buffer.alloc(0), rxTimer: null };
  serialSessions.set(id, session); pushSerialEvent(session, 'system', `正在打开 ${options.path} · ${options.baudRate} ${options.dataBits}${options.parity === 'none' ? 'N' : options.parity[0].toUpperCase()}${options.stopBits}`);
  port.on('data', data => receiveSerialData(session, data));
  port.on('error', error => { session.state = 'error'; pushSerialEvent(session, 'system', `串口错误：${error.message}`); });
  port.on('close', error => { if (session.state !== 'closed') { session.state = 'closed'; pushSerialEvent(session, 'system', error ? `串口异常关闭：${error.message}` : '串口已关闭'); } });
  try {
    await new Promise((resolve, reject) => port.open(error => error ? reject(error) : resolve()));
    session.state = 'connected';
    await new Promise((resolve, reject) => port.set({ dtr: options.dtr, rts: options.rts }, error => error ? reject(error) : resolve()));
    pushSerialEvent(session, 'system', `${options.path} 已连接`);
    if (!restoringSerialSessions) await persistSerialSessions();
    return { session, reused: false };
  } catch (error) {
    session.state = 'error'; pushSerialEvent(session, 'system', `打开失败：${error.message}`); serialSessions.delete(id); try { if (port.isOpen) port.close(); } catch { /* already closed */ } throw error;
  }
}

async function closeSerialSession(session) {
  if (!session || session.state === 'closed') return;
  session.state = 'closed'; if (session.rxTimer) { clearTimeout(session.rxTimer); session.rxTimer = null; } flushSerialReceive(session);
  if (session.port.isOpen) await new Promise(resolve => session.port.close(() => resolve()));
  pushSerialEvent(session, 'system', '串口会话已关闭');
}

export function validateHostAndPort(host, port) {
  if (typeof host !== 'string' || !host.trim() || host.length > 255 || /[\s/\\]/.test(host)) throw new Error('Invalid target host');
  const parsedPort = Number(port);
  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) throw new Error('Port must be between 1 and 65535');
  return { host: host.trim(), port: parsedPort };
}

function pushNetworkEvent(session, direction, bufferOrText) {
  const buffer = Buffer.isBuffer(bufferOrText) ? bufferOrText : null;
  session.lastEventId += 1;
  session.events.push({
    id: session.lastEventId,
    timestamp: new Date().toISOString(),
    direction,
    text: buffer ? buffer.toString('utf8') : String(bufferOrText),
    hex: buffer ? buffer.toString('hex').match(/.{1,2}/g)?.join(' ').toUpperCase() || '' : '',
    byteLength: buffer?.length || Buffer.byteLength(String(bufferOrText)),
  });
  if (session.events.length > MAX_NETWORK_EVENTS) session.events.splice(0, session.events.length - MAX_NETWORK_EVENTS);
  if (direction === 'rx' && buffer) session.rxBytes += buffer.length;
  if (direction === 'tx' && buffer) session.txBytes += buffer.length;
}

function publicNetworkSession(session, after = 0) {
  return {
    id: session.id,
    type: session.type,
    mode: session.mode,
    host: session.host,
    port: session.port,
    localAddress: session.localAddress,
    state: session.state,
    rxBytes: session.rxBytes,
    txBytes: session.txBytes,
    clientCount: session.clients?.size || 0,
    events: session.events.filter(event => event.id > after),
  };
}

function closeNetworkSession(session, reason = '会话已关闭') {
  if (!session || session.state === 'closed') return;
  session.state = 'closed';
  if (session.type === 'tcp' && session.mode === 'server') { for (const client of session.clients) client.destroy(); try { session.socket.close(); } catch { /* not listening */ } }
  else if (session.type === 'tcp') session.socket.destroy();
  else { try { session.socket.close(); } catch { /* already closed */ } }
  pushNetworkEvent(session, 'system', reason);
}

function createNetworkSession(type, host, port, localPort, mode = 'client') {
  if (!['tcp', 'udp'].includes(type)) throw new Error('Only TCP and UDP sessions are supported');
  if (!['client', 'server'].includes(mode)) throw new Error('Mode must be client or server');
  if (networkSessions.size >= MAX_NETWORK_SESSIONS) throw new Error(`At most ${MAX_NETWORK_SESSIONS} network sessions may be open`);
  const target = validateHostAndPort(host, port);
  const bindPort = type === 'udp' && mode === 'client' ? Number(localPort || 0) : 0;
  if (!Number.isInteger(bindPort) || bindPort < 0 || bindPort > 65535) throw new Error('Local port must be between 0 and 65535');
  const id = randomUUID();
  const session = { id, type, mode, ...target, localPort: bindPort, localAddress: '', state: 'connecting', events: [], lastEventId: 0, rxBytes: 0, txBytes: 0, socket: null, clients: new Set(), lastPeer: null };
  networkSessions.set(id, session);
  pushNetworkEvent(session, 'system', mode === 'server' ? `正在监听 ${type.toUpperCase()} ${target.host}:${target.port}` : `正在连接 ${type.toUpperCase()} ${target.host}:${target.port}`);

  if (type === 'tcp' && mode === 'client') {
    const socket = net.createConnection({ host: target.host, port: target.port });
    session.socket = socket;
    socket.setNoDelay(true);
    socket.on('connect', () => { session.state = 'connected'; session.localAddress = `${socket.localAddress}:${socket.localPort}`; pushNetworkEvent(session, 'system', `已连接 ${target.host}:${target.port}`); });
    socket.on('data', data => pushNetworkEvent(session, 'rx', data));
    socket.on('error', error => { session.state = 'error'; pushNetworkEvent(session, 'system', `TCP 错误：${error.message}`); });
    socket.on('close', () => { if (session.state !== 'closed') { session.state = 'closed'; pushNetworkEvent(session, 'system', 'TCP 连接已断开'); } });
  } else if (type === 'tcp') {
    const server = net.createServer(socket => {
      session.clients.add(socket); const peer = `${socket.remoteAddress}:${socket.remotePort}`;
      pushNetworkEvent(session, 'system', `客户端已连接 ${peer}`);
      socket.on('data', data => { pushNetworkEvent(session, 'rx', data); session.events[session.events.length - 1].peer = peer; });
      socket.on('error', error => pushNetworkEvent(session, 'system', `客户端 ${peer} 错误：${error.message}`));
      socket.on('close', () => { session.clients.delete(socket); pushNetworkEvent(session, 'system', `客户端已断开 ${peer}`); });
    });
    session.socket = server;
    server.on('error', error => { session.state = 'error'; pushNetworkEvent(session, 'system', `TCP 监听错误：${error.message}`); });
    server.on('close', () => { if (session.state !== 'closed') session.state = 'closed'; });
    server.listen(target.port, target.host, () => { const address = server.address(); session.state = 'connected'; session.localAddress = typeof address === 'object' && address ? `${address.address}:${address.port}` : `${target.host}:${target.port}`; pushNetworkEvent(session, 'system', `TCP 服务端正在监听 ${session.localAddress}`); });
  } else if (mode === 'client') {
    const socket = dgram.createSocket('udp4');
    session.socket = socket;
    socket.on('message', (data, info) => { pushNetworkEvent(session, 'rx', data); session.events[session.events.length - 1].peer = `${info.address}:${info.port}`; });
    socket.on('error', error => { session.state = 'error'; pushNetworkEvent(session, 'system', `UDP 错误：${error.message}`); });
    socket.on('close', () => { session.state = 'closed'; });
    socket.bind(bindPort, '0.0.0.0', () => {
      socket.connect(target.port, target.host, () => { const address = socket.address(); session.state = 'connected'; session.localAddress = `${address.address}:${address.port}`; pushNetworkEvent(session, 'system', `UDP 已就绪，目标 ${target.host}:${target.port}`); });
    });
  } else {
    const socket = dgram.createSocket('udp4');
    session.socket = socket;
    socket.on('message', (data, info) => { session.lastPeer = info; pushNetworkEvent(session, 'rx', data); session.events[session.events.length - 1].peer = `${info.address}:${info.port}`; });
    socket.on('error', error => { session.state = 'error'; pushNetworkEvent(session, 'system', `UDP 监听错误：${error.message}`); });
    socket.on('close', () => { session.state = 'closed'; });
    socket.bind(target.port, target.host, () => { const address = socket.address(); session.state = 'connected'; session.localAddress = `${address.address}:${address.port}`; pushNetworkEvent(session, 'system', `UDP 服务端正在监听 ${session.localAddress}`); });
  }
  return session;
}

export function decodeNetworkPayload(data, encoding) {
  if (typeof data !== 'string') throw new Error('Data must be a string');
  if (encoding === 'text') return Buffer.from(data, 'utf8');
  if (encoding === 'hex') {
    const normalized = data.replace(/0x/gi, '').replace(/[\s,;:_-]+/g, '');
    if (!normalized || !/^[0-9a-f]+$/i.test(normalized) || normalized.length % 2) throw new Error('Invalid HEX payload');
    return Buffer.from(normalized, 'hex');
  }
  throw new Error('Encoding must be text or hex');
}

function validateProjectPath(value) {
  const input = String(value || '').trim();
  if (!input || !isAbsolute(input) || /[\0\r\n]/.test(input)) throw new Error('Project path must be an absolute local directory');
  return resolve(input);
}

function resolveInsideProject(rootPath, value, fallback) {
  const target = resolve(rootPath, String(value || fallback));
  const relation = relative(rootPath, target);
  if (relation.startsWith('..') || isAbsolute(relation)) throw new Error('Build directory must stay inside the project directory');
  return target;
}

export function createBuildCommand(options = {}) {
  const rootPath = validateProjectPath(options.rootPath), system = String(options.system || '').toLowerCase(), action = options.action || 'build', configuration = options.configuration === 'Release' ? 'Release' : 'Debug';
  if (!['cmake', 'make', 'ninja'].includes(system)) throw new Error('Build system must be cmake, make or ninja');
  if (!['configure', 'build', 'clean', 'rebuild'].includes(action)) throw new Error('Build action is not supported');
  const buildPath = resolveInsideProject(rootPath, options.buildDir, 'build'), requestedTool = String(options.toolPath || '').trim();
  if (requestedTool && /[\0\r\n]/.test(requestedTool)) throw new Error('Invalid tool path');
  if (system === 'cmake') {
    const executable = requestedTool || 'cmake';
    if (action === 'configure') return { rootPath, buildPath, executable, args: ['-S', rootPath, '-B', buildPath, `-DCMAKE_BUILD_TYPE=${configuration}`], system, action, configuration };
    const args = ['--build', buildPath, '--config', configuration];
    if (action === 'clean') args.push('--target', 'clean');
    if (action === 'rebuild') args.push('--clean-first');
    return { rootPath, buildPath, executable, args, system, action, configuration };
  }
  if (action === 'configure') throw new Error(`${system} does not require a configure action`);
  const executable = requestedTool || (system === 'ninja' ? 'ninja' : process.platform === 'win32' ? 'mingw32-make' : 'make'), args = [];
  if (system === 'ninja') args.push('-C', buildPath);
  if (action === 'clean') args.push('clean');
  if (action === 'rebuild') args.push('clean', 'all');
  return { rootPath, buildPath, executable, args, system, action, configuration };
}

export function parseBuildDiagnostic(line) {
  const patterns = [
    /^(.*?):(\d+)(?::(\d+))?:\s*(fatal error|error|warning|note|remark):\s*(.*)$/i,
    /^(.+?)\((\d+)(?:,(\d+))?\)\s*:\s*(?:fatal\s+)?(error|warning|note|remark)(?:\s+[A-Z]+\d+)?\s*:\s*(.*)$/i,
    /^"(.+?)",\s*(\d+)(?:\s+column\s+(\d+))?\s*:\s*(fatal error|error|warning|note|remark)(?:\[[^\]]+\])?\s*:\s*(.*)$/i,
  ];
  for (const pattern of patterns) {
    const match = String(line).match(pattern);
    if (!match) continue;
    const level = match[4].toLowerCase();
    return { file: match[1], line: Number(match[2]), column: Number(match[3] || 1), severity: level.includes('error') ? 'error' : level === 'warning' ? 'warning' : 'note', message: match[5] };
  }
  return null;
}

function pushBuildEvent(job, stream, text) {
  for (const line of String(text).replace(/\r/g, '').split('\n').filter(Boolean)) {
    job.lastEventId += 1;
    job.events.push({ id: job.lastEventId, timestamp: new Date().toISOString(), stream, text: line, diagnostic: parseBuildDiagnostic(line) || undefined });
  }
  if (job.events.length > MAX_BUILD_EVENTS) job.events.splice(0, job.events.length - MAX_BUILD_EVENTS);
}

function publicBuildJob(job, after = 0) {
  const { child: _child, ...safe } = job;
  return { ...safe, events: job.events.filter(event => event.id > after) };
}

async function collectBuildArtifacts(rootPath, maxFiles = 2000) {
  const artifacts = [], queue = [{ path: rootPath, depth: 0 }]; let visited = 0;
  while (queue.length && visited < maxFiles) {
    const current = queue.shift(); let entries;
    try { entries = await readdir(current.path, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      if (visited++ >= maxFiles) break;
      const path = join(current.path, entry.name);
      if (entry.isDirectory() && current.depth < 4 && !['.git', 'node_modules'].includes(entry.name)) queue.push({ path, depth: current.depth + 1 });
      else if (entry.isFile() && /\.(elf|axf|out|map|bin|hex|uf2)$/i.test(entry.name)) { const info = await stat(path).catch(() => null); if (info) artifacts.push({ name: entry.name, path, type: entry.name.split('.').pop().toLowerCase(), size: info.size, modifiedAt: info.mtime.toISOString() }); }
    }
  }
  return artifacts.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

async function resolveCurrentBuildArtifact(job, indexValue) {
  const index = Number(indexValue), artifact = Number.isInteger(index) && index >= 0 ? job?.artifacts?.[index] : null;
  if (!artifact) throw new Error('Build artifact was not found');
  const artifactPath = resolve(artifact.path), relation = relative(job.buildPath, artifactPath);
  if (relation.startsWith('..') || isAbsolute(relation)) throw new Error('Build artifact is outside the authorized build directory');
  const info = await stat(artifactPath);
  if (!info.isFile() || info.size !== artifact.size || info.mtime.toISOString() !== artifact.modifiedAt) throw new Error('Build artifact changed after discovery; run or refresh the build again');
  return { artifact, artifactPath, info };
}

export async function authorizeBuildArtifact(job, indexValue) {
  const { artifactPath, info } = await resolveCurrentBuildArtifact(job, indexValue);
  return createPathSelection('file', artifactPath, info);
}

export async function hashBuildArtifact(job, indexValue) {
  const { artifact, artifactPath, info } = await resolveCurrentBuildArtifact(job, indexValue);
  if (info.size > MAX_SELECTED_FILE_BYTES) throw new Error(`Build artifact exceeds ${MAX_SELECTED_FILE_BYTES} byte hash limit`);
  if (activeArtifactHashJobs >= MAX_ARTIFACT_HASH_JOBS) throw new Error('Too many artifact hash jobs are running');
  activeArtifactHashJobs += 1;
  try {
    const sha256 = await new Promise((resolveHash, reject) => {
      const hash = createHash('sha256'), input = createReadStream(artifactPath, { highWaterMark: 256 * 1024 });
      input.on('data', chunk => hash.update(chunk)); input.on('error', reject); input.on('end', () => resolveHash(hash.digest('hex')));
    });
    const after = await stat(artifactPath);
    if (after.size !== artifact.size || after.mtime.toISOString() !== artifact.modifiedAt) throw new Error('Build artifact changed while hashing; run or refresh the build again');
    return { algorithm: 'sha256', digest: sha256, size: artifact.size, modifiedAt: artifact.modifiedAt };
  } finally { activeArtifactHashJobs -= 1; }
}

async function detectBuildEnvironment(rootPathValue) {
  const rootPath = validateProjectPath(rootPathValue), info = await stat(rootPath);
  if (!info.isDirectory()) throw new Error('Project path is not a directory');
  const names = await readdir(rootPath), lower = new Set(names.map(name => name.toLowerCase()));
  const system = lower.has('cmakelists.txt') ? 'cmake' : lower.has('build.ninja') ? 'ninja' : lower.has('makefile') ? 'make' : '';
  const tools = await Promise.all(['cmake', 'ninja', process.platform === 'win32' ? 'mingw32-make' : 'make'].map(executable => new Promise(resolveTool => {
    const child = spawn(executable, ['--version'], { windowsHide: true, shell: false }); let output = '', settled = false;
    const finish = available => { if (settled) return; settled = true; resolveTool({ executable, available, version: output.replace(/\r?\n/g, ' ').trim().slice(0, 180) }); };
    child.stdout.on('data', data => { output += data.toString(); }); child.stderr.on('data', data => { output += data.toString(); }); child.on('error', () => finish(false)); child.on('close', code => finish(code === 0));
  })));
  return { rootPath, system, buildDir: system === 'ninja' && lower.has('build.ninja') ? '.' : 'build', projectFiles: names.filter(name => /^(CMakeLists\.txt|Makefile|build\.ninja|platformio\.ini|.*\.(uvprojx|ewp))$/i.test(name)), tools };
}

async function startBuildJob(options) {
  if ([...buildJobs.values()].filter(job => job.state === 'running').length >= MAX_BUILD_JOBS) throw new Error(`At most ${MAX_BUILD_JOBS} build jobs may run at once`);
  const command = createBuildCommand(options); await stat(command.rootPath).then(info => { if (!info.isDirectory()) throw new Error('Project path is not a directory'); });
  const job = { id: randomUUID(), ...command, state: 'running', exitCode: null, signal: null, startedAt: new Date().toISOString(), finishedAt: '', artifacts: [], events: [], lastEventId: 0, child: null };
  buildJobs.set(job.id, job); pushBuildEvent(job, 'system', `执行：${command.executable} ${command.args.join(' ')}`);
  const child = spawn(command.executable, command.args, { cwd: command.rootPath, windowsHide: true, shell: false, env: { ...process.env, CLICOLOR: '0', NO_COLOR: '1' } }); job.child = child;
  child.stdout.on('data', data => pushBuildEvent(job, 'stdout', data)); child.stderr.on('data', data => pushBuildEvent(job, 'stderr', data));
  child.on('error', error => { pushBuildEvent(job, 'stderr', error.message); job.state = 'failed'; job.finishedAt = new Date().toISOString(); });
  child.on('close', async (code, signal) => { job.exitCode = code; job.signal = signal; const finalState = job.state === 'stopping' ? 'cancelled' : code === 0 ? 'passed' : 'failed'; if (finalState === 'passed' && job.action !== 'clean') job.artifacts = await collectBuildArtifacts(job.buildPath); job.state = finalState; job.finishedAt = new Date().toISOString(); pushBuildEvent(job, 'system', job.state === 'passed' ? `构建成功，发现 ${job.artifacts.length} 个固件产物` : job.state === 'cancelled' ? '构建已停止' : `构建失败，退出码 ${code}`); job.child = null; });
  return job;
}

function fetchJSON(urlStr) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const client = url.protocol === 'https:' ? https : http;
    client.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Invalid JSON from ${urlStr}`)); }
      });
    }).on('error', reject);
  });
}

async function proxyRequest(req, res, targetUrl) {
  let target;
  try {
    target = validateProxyTarget(targetUrl);
  } catch (error) {
    jsonRes(res, 403, { error: error.message });
    return;
  }
  const isHttps = target.protocol === 'https:';
  const client = isHttps ? https : http;

  let body;
  try {
    body = await readRequestBody(req);
  } catch (error) {
    if (!res.headersSent) jsonRes(res, 413, { error: error.message });
    return;
  }

  const headers = {};
  for (const name of ['content-type', 'accept', 'authorization']) {
    if (req.headers[name]) headers[name] = req.headers[name];
  }
  if (body.length) headers['content-length'] = String(body.length);

  const proxyReq = client.request({
    hostname: target.hostname,
    port: target.port || (isHttps ? 443 : 80),
    path: target.pathname + target.search,
    method: req.method,
    headers,
  }, (proxyRes) => {
    const responseHeaders = { ...proxyRes.headers };
    for (const name of Object.keys(responseHeaders)) {
      if (name.toLowerCase().startsWith('access-control-')) delete responseHeaders[name];
    }
    res.writeHead(proxyRes.statusCode || 502, responseHeaders);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    if (res.headersSent) res.destroy(err);
    else jsonRes(res, 502, { error: err.message });
  });
  proxyReq.end(body);
}

function fetchHTML(urlStr, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const client = url.protocol === 'https:' ? https : http;
    const req = client.get(urlStr, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`Timeout after ${timeoutMs}ms for ${urlStr}`));
    });
  });
}

function fetchSnapEDAJSON(urlStr, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const req = https.get(urlStr, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.snapeda.com/',
        'Origin': 'https://www.snapeda.com',
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Invalid JSON from SnapEDA: ${data.substring(0, 100)}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`Timeout after ${timeoutMs}ms for SnapEDA: ${urlStr}`));
    });
  });
}

async function getSnapEDASpecs(chipName) {
  const result = {
    productName: '',
    productFamily: '',
    description: '',
    specs: {},
    features: [],
    hierarchy: [],
    stUrl: '',
    source: 'SnapEDA/Mouser',
  };

  try {
    const suggestions = await fetchSnapEDAJSON(`https://www.snapeda.com/api/v1/search_autocomplete?q=${chipName}`);
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      return null;
    }

    const partNames = [chipName, ...suggestions.filter(s => s.startsWith(chipName))];
    let partData = null;

    for (const partName of partNames) {
      const data = await fetchSnapEDAJSON(`https://www.snapeda.com/api/get_mouser_info_api?part_name=${partName}`);
      if (data && data.ManufacturerPartNumber) {
        partData = data;
        break;
      }
    }

    if (!partData) {
      return null;
    }

    result.productName = partData.ManufacturerPartNumber;
    result.productFamily = partData.Category || '';
    result.description = partData.Description || '';
    result.specs = {
      manufacturer: partData.Manufacturer || '',
      category: partData.Category || '',
      price: partData.Price || '',
      stock: partData.AvailabilityInStock || 'N/A',
      rohs: partData.ROHSStatus || '',
      lifecycle: partData.LifecycleStatus || '',
    };

    if (partData.DataSheetUrl) {
      result.stUrl = partData.DataSheetUrl;
    }

    if (partData.ProductAttributes) {
      const seen = new Set();
      partData.ProductAttributes.forEach(attr => {
        const key = attr.AttributeName;
        if (!seen.has(key)) {
          result.specs[key.toLowerCase()] = attr.AttributeValue;
          seen.add(key);
        }
      });
    }

    const desc = partData.Description || '';
    const clockMatch = desc.match(/(\d+)\s*MHz/);
    if (clockMatch) result.specs.maxClock = `${clockMatch[1]} MHz`;
    const flashMatch = desc.match(/(\d+)\s*[Kk](?:bytes?)?\s*Flash/i);
    if (flashMatch) result.specs.flashMemory = `${flashMatch[1]} KB Flash`;
    const sramMatch = desc.match(/(\d+)\s*[Kk](?:bytes?)?\s*RAM/i);
    if (sramMatch) result.specs.sram = `${sramMatch[1]} KB RAM`;

    const mouserUrl = partData.ProductDetailUrl;
    if (mouserUrl) {
      result.mouserUrl = mouserUrl;
    }

    if (partData.SuggestedReplacement && partData.SuggestedReplacement.length > 0) {
      result.alternatives = partData.SuggestedReplacement.slice(0, 5);
    }

    return result;
  } catch (e) {
    console.log(`SnapEDA lookup failed: ${e.message}`);
    return null;
  }
}

function parseSTProduct(html) {
  const result = {
    productName: '',
    productFamily: '',
    description: '',
    specs: {},
    features: [],
    hierarchy: [],
    stUrl: '',
  };

  // Extract meta description
  const metaDesc = html.match(/<meta name="description" content="([^"]+)"/)?.[1];
  if (metaDesc) result.description = metaDesc.replace(/&[^;]+;/g, ' ');

  // Extract from window.digitalData
  const dataMatch = html.match(/window\.digitalData\s*=\s*({[\s\S]*?});/);
  if (dataMatch) {
    try {
      const digitalData = JSON.parse(dataMatch[1]);
      const prod = digitalData.product?.[0]?.productInfo;
      if (prod) {
        result.productName = prod.productName || '';
        result.specs = { ...prod };
        const tree = prod.tree || {};
        result.productFamily = tree.level4 || tree.level3 || '';
      }
    } catch (e) {}
  }

  // Extract JSON-LD breadcrumbs
  const jsonLdScripts = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
  if (jsonLdScripts) {
    jsonLdScripts.forEach(script => {
      const json = script.replace(/<script[^>]*>|<\/script>/g, '').trim();
      try {
        const data = JSON.parse(json);
        if (data.itemListElement) {
          data.itemListElement.forEach(item => {
            result.hierarchy.push({ name: item.item?.['@type'] === 'WebPage' ? item.name : item.name, url: item.item });
          });
        }
      } catch (e) {}
    });
  }

  // Extract from st-stage-product__copy (short product description)
  const copyMatch = html.match(/<span class="st-stage-product__copy">([\s\S]*?)<\/span>/);
  if (copyMatch) {
    result.shortDescription = copyMatch[1].replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Extract from og:description
  const ogDescMatch = html.match(/<meta property="og:description" content="([^"]+)"/);
  if (ogDescMatch) {
    result.ogDescription = ogDescMatch[1].replace(/&[^;]+;/g, ' ');
  }

  // Extract main product description from overview text
  const overviewIdx = html.indexOf('st-overview');
  if (overviewIdx > 0) {
    const overviewSection = html.slice(overviewIdx, overviewIdx + 3000);
    const textMatch = overviewSection.match(/>([^<]{50,})</);
    if (textMatch && !result.description) {
      result.description = textMatch[1].replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim();
    }
  }

  // Fallback: extract from og:description
  if (!result.description && result.ogDescription) {
    result.description = result.ogDescription;
  }

  // Extract "All features" section
  const featuresIdx = html.indexOf('All features');
  if (featuresIdx > 0) {
    const section = html.slice(featuresIdx, featuresIdx + 5000);
    const text = section.replace(/<[^>]*>/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && l !== 'All features');
    result.features = lines.slice(0, 40);
  }

  // Extract key specs from description and features
  const clockMatch = html.match(/(\d+)\s*MHz/);
  if (clockMatch) result.specs.maxClock = `${clockMatch[1]} MHz`;

  const flashMatch = html.match(/(\d+)\s*Kbytes?\s*of\s*Flash/i);
  if (flashMatch) result.specs.flashMemory = `${flashMatch[1]} KB Flash`;

  const sramMatch = html.match(/(\d+)\s*Kbytes?\s*of\s*SRAM/i);
  if (sramMatch) result.specs.sram = `${sramMatch[1]} KB SRAM`;

  const voltageMatch = html.match(/([\d.]+)\s*to\s*([\d.]+)\s*V/i);
  if (voltageMatch) result.specs.voltageRange = `${voltageMatch[1]}-${voltageMatch[2]} V`;

  const adcMatch = html.match(/(\d+)x\s*(\d+)-bit.*ADC/i);
  if (adcMatch) result.specs.adc = `${adcMatch[1]}x ${adcMatch[2]}-bit ADC`;

  return result;
}

async function getChipDetails(chipName) {
  const rule = detectManufacturer(chipName);
  const productUrl = rule ? rule.productUrl(chipName) : null;
  const snapResult = await getSnapEDASpecs(chipName);
  if (snapResult && snapResult.description && snapResult.description !== 'N/A') {
    if (productUrl) snapResult.productUrl = productUrl;
    return snapResult;
  }

  return {
    error: `No data found for ${chipName}`,
    productUrl: productUrl || `https://www.snapeda.com/search?q=${encodeURIComponent(chipName)}`,
    source: 'Unavailable',
  };
}

function generateStUrlCandidates(name) {
  return [name.toLowerCase()];
}

function detectManufacturer(name) {
  const n = name.toUpperCase();
  const manufacturerRules = [
    { name: 'STMicroelectronics', prefixes: ['STM32', 'STM8'], productUrl: q => `https://www.st.com/en/microcontrollers-microprocessors/${generateStUrlCandidates(q)[0]}.html` },
    { name: 'Texas Instruments', prefixes: ['MSP430', 'LM4F', 'TM4C'], productUrl: q => `https://www.ti.com/product/${q}` },
    { name: 'Espressif', prefixes: ['ESP'], productUrl: q => `https://www.espressif.com/en/products/socs/details/${q.toLowerCase()}` },
    { name: 'Raspberry Pi', prefixes: ['RP2'], productUrl: q => `https://www.raspberrypi.com/documentation/microcontrollers/${q.toLowerCase()}.html` },
  ];
  for (const rule of manufacturerRules) {
    for (const prefix of rule.prefixes) {
      if (n.startsWith(prefix.toUpperCase())) {
        return rule;
      }
    }
  }
  return null;
}

function postJSON(urlStr, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const client = url.protocol === 'https:' ? https : http;
    const data = JSON.stringify(body);
    const req = client.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(responseData)); }
        catch (e) { reject(new Error(`Invalid JSON from ${urlStr}`)); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function detectOpencodeServer(baseURL) {
  const healthUrl = `${baseURL}/global/health`;
  const providerUrl = `${baseURL}/provider`;
  
  try {
    const health = await fetchJSON(healthUrl);
    if (!health || !health.healthy) {
      return null;
    }

    const providerData = await fetchJSON(providerUrl);
    if (!providerData || !providerData.all) {
      return null;
    }

    const models = [];
    const seenIds = new Set();
    
    const providers = Array.isArray(providerData.all) ? providerData.all : 
                      (providerData.all && typeof providerData.all === 'object' ? 
                       Object.values(providerData.all) : []);
    
    for (const provider of providers) {
      if (!provider || !provider.models) continue;
      
      const providerId = provider.id || provider.name || 'unknown';
      const providerModels = typeof provider.models === 'object' ? 
                             Object.values(provider.models) : [];
      
      for (const model of providerModels) {
        if (model && model.id && !seenIds.has(model.id)) {
          seenIds.add(model.id);
          models.push({
            id: model.id,
            name: model.name || model.id,
            provider: providerId,
          });
        }
      }
    }

    return {
      name: 'OpenCode',
      url: baseURL,
      chatUrl: `${baseURL}/message`,
      models,
      version: health.version || 'unknown',
    };
  } catch (e) {
    return null;
  }
}

const withTimeout = (promise, ms) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms))]);

async function detectOpenAICompatible(name, baseURL) {
  try {
    const data = await withTimeout(fetchJSON(`${baseURL}/v1/models`), 2500);
    if (!data || !Array.isArray(data.data)) return null;
    const models = data.data.filter(model => model && model.id).map(model => ({ id: model.id, name: model.name || model.id }));
    if (!models.length) return null;
    return { name, url: baseURL, chatUrl: `${baseURL}/v1/chat/completions`, models };
  } catch (e) {
    return null;
  }
}

async function detectServers() {
  const servers = [];
  
  const commonPorts = [3123, 3000, 8080, 7860, 11434, 1234];
  
  try {
    const ollamaData = await withTimeout(fetchJSON('http://localhost:11434/api/tags'), 3000);
    if (ollamaData && ollamaData.models) {
      servers.push({
        name: 'Ollama',
        url: 'http://localhost:11434',
        chatUrl: 'http://localhost:11434/v1/chat/completions',
        models: ollamaData.models.map((m) => ({
          id: m.name,
          name: m.name,
          size: m.size ? `${(m.size / 1024 / 1024 / 1024).toFixed(1)} GB` : 'Unknown',
        })),
      });
    }
  } catch (e) { }

  try {
    const lmData = await withTimeout(fetchJSON('http://localhost:1234/v1/models'), 3000);
    if (lmData && lmData.data) {
      servers.push({
        name: 'LM Studio',
        url: 'http://localhost:1234',
        chatUrl: 'http://localhost:1234/v1/chat/completions',
        models: lmData.data.map((m) => ({
          id: m.id,
          name: m.id,
        })),
      });
    }
  } catch (e) { }

  const compatibleServers = [
    ['Jan', 'http://localhost:1337'],
    ['GPT4All', 'http://localhost:4891'],
    ['text-generation-webui', 'http://localhost:5000'],
    ['KoboldCpp', 'http://localhost:5001'],
    ['vLLM', 'http://localhost:8000'],
    ['LocalAI / llama.cpp', 'http://localhost:8080'],
  ];
  for (const [name, baseURL] of compatibleServers) {
    const detected = await detectOpenAICompatible(name, baseURL);
    if (detected && !servers.some(server => server.url === detected.url)) servers.push(detected);
  }

  for (const port of commonPorts) {
    if (port === 11434 || port === 1234) continue;
    const baseURL = `http://localhost:${port}`;
    try {
      const opencodeServer = await withTimeout(detectOpencodeServer(baseURL), 5000);
      if (opencodeServer) {
        servers.push(opencodeServer);
        break;
      }
    } catch (e) { }
  }

  return servers;
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = requestUrl.pathname;

  setCORS(req, res);
  if (!isAllowedOrigin(req.headers.origin)) {
    jsonRes(res, 403, { error: 'Origin is not allowed' });
    return;
  }
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (!['GET', 'POST', 'DELETE'].includes(req.method || '')) {
    jsonRes(res, 405, { error: 'Only GET, POST and DELETE are supported' });
    return;
  }

  if (pathname === '/api/agent/status' && req.method === 'GET') {
    jsonRes(res, 200, { available: true, name: 'EmbedKit Local Agent', version: AGENT_VERSION, protocolVersion: AGENT_PROTOCOL_VERSION, uptimeSeconds: Math.floor(process.uptime()), serialSessions: serialSessions.size, networkSessions: networkSessions.size, buildJobs: buildJobs.size, capabilities: ['serial', 'tcp-client', 'tcp-server', 'udp-client', 'udp-server', 'session-restore', 'network-session-restore', 'structured-errors', 'project-build', 'project-scan', 'local-picker', 'local-file-read', 'elf-analysis', 'software-environment', 'software-installation'] });
    return;
  }

  if (pathname === '/api/environment/installations' && req.method === 'GET') {
    try { jsonRes(res, 200, await detectDevelopmentSoftware()); }
    catch (error) { jsonRes(res, 500, { error: error.message }); }
    return;
  }

  if (pathname === '/api/environment/install-manifests' && req.method === 'GET') {
    try { jsonRes(res, 200, { schemaVersion: 1, manifests: compatibleInstallManifests() }); }
    catch (error) { jsonRes(res, 500, { error: error.message }); }
    return;
  }

  if (pathname === '/api/environment/install-jobs' && req.method === 'POST') {
    try { jsonRes(res, 202, await startInstallJob(await readJSONBody(req))); }
    catch (error) { jsonRes(res, 400, { error: error.message }); }
    return;
  }

  const installJobMatch = pathname.match(/^\/api\/environment\/install-jobs\/([0-9a-f-]+)$/i);
  if (installJobMatch) {
    const job = installJobs.get(installJobMatch[1]);
    if (!job) { jsonRes(res, 404, { error: 'Installation job not found' }); return; }
    if (req.method === 'GET') { jsonRes(res, 200, publicInstallJob(job)); return; }
    if (req.method === 'DELETE') { if (job.state !== 'running') { jsonRes(res, 409, { error: 'Installation job is not running' }); return; } job.cancelRequested = true; job.request?.destroy(new Error('Installation cancelled')); jsonRes(res, 202, publicInstallJob(job)); return; }
    jsonRes(res, 405, { error: 'Unsupported operation for installation job' }); return;
  }

  if (pathname === '/api/files/select' && req.method === 'POST') {
    try { jsonRes(res, 200, await selectLocalPath(await readJSONBody(req))); }
    catch (error) { jsonRes(res, 400, { error: error.message }); }
    return;
  }

  if (pathname === '/api/projects/scan' && req.method === 'POST') {
    try { const body = await readJSONBody(req); jsonRes(res, 200, await scanSelectedProject(body.selectionId, body)); }
    catch (error) { jsonRes(res, 400, { error: error.message }); }
    return;
  }

  const fileSelectionMatch = pathname.match(/^\/api\/files\/selections\/([0-9a-f-]+)(?:\/(chunk))?$/i);
  if (fileSelectionMatch) {
    try {
      const id = fileSelectionMatch[1], operation = fileSelectionMatch[2];
      if (req.method === 'DELETE' && !operation) { jsonRes(res, 200, { revoked: fileSelections.delete(id) }); return; }
      if (req.method !== 'GET') { jsonRes(res, 405, { error: 'Unsupported operation for file selection' }); return; }
      if (operation === 'chunk') { jsonRes(res, 200, await readSelectedFileChunk(id, requestUrl.searchParams.get('offset'), requestUrl.searchParams.get('length'))); return; }
      const selection = getFileSelection(id), { path: _path, expiresAt, ...safe } = selection;
      jsonRes(res, 200, { ...safe, expiresAt: new Date(expiresAt).toISOString() });
    } catch (error) { jsonRes(res, 400, { error: error.message }); }
    return;
  }

  const elfAnalysisMatch = pathname.match(/^\/api\/elf\/analyze\/([0-9a-f-]+)$/i);
  if (elfAnalysisMatch && req.method === 'GET') {
    try { jsonRes(res, 200, await analyzeSelectedElf(elfAnalysisMatch[1])); }
    catch (error) { jsonRes(res, 400, { error: error.message }); }
    return;
  }

  const elfLookupMatch = pathname.match(/^\/api\/elf\/analyses\/([0-9a-f-]+)\/lookup$/i);
  if (elfLookupMatch && req.method === 'GET') {
    try { jsonRes(res, 200, lookupAnalyzedElf(elfLookupMatch[1], requestUrl.searchParams.get('address'))); }
    catch (error) { jsonRes(res, 400, { error: error.message }); }
    return;
  }

  if (pathname === '/api/build/detect' && req.method === 'POST') {
    try { const body = await readJSONBody(req); jsonRes(res, 200, await detectBuildEnvironment(body.rootPath)); }
    catch (error) { jsonRes(res, 400, { error: error.message }); }
    return;
  }

  if (pathname === '/api/build/jobs') {
    if (req.method === 'GET') { jsonRes(res, 200, { jobs: [...buildJobs.values()].map(job => publicBuildJob(job)) }); return; }
    if (req.method === 'POST') {
      try { jsonRes(res, 201, publicBuildJob(await startBuildJob(await readJSONBody(req)))); }
      catch (error) { jsonRes(res, 400, { error: error.message }); }
      return;
    }
  }

  const buildArtifactMatch = pathname.match(/^\/api\/build\/jobs\/([0-9a-f-]+)\/artifacts\/(\d+)\/select$/i);
  if (buildArtifactMatch) {
    if (req.method !== 'POST') { jsonRes(res, 405, { error: 'Build artifact authorization requires POST' }); return; }
    const job = buildJobs.get(buildArtifactMatch[1]);
    if (!job) { jsonRes(res, 404, { error: 'Build job not found' }); return; }
    try { jsonRes(res, 200, await authorizeBuildArtifact(job, buildArtifactMatch[2])); }
    catch (error) { jsonRes(res, 400, { error: error.message }); }
    return;
  }

  const buildArtifactHashMatch = pathname.match(/^\/api\/build\/jobs\/([0-9a-f-]+)\/artifacts\/(\d+)\/hash$/i);
  if (buildArtifactHashMatch) {
    if (req.method !== 'POST') { jsonRes(res, 405, { error: 'Build artifact hashing requires POST' }); return; }
    const job = buildJobs.get(buildArtifactHashMatch[1]);
    if (!job) { jsonRes(res, 404, { error: 'Build job not found' }); return; }
    try { jsonRes(res, 200, await hashBuildArtifact(job, buildArtifactHashMatch[2])); }
    catch (error) { jsonRes(res, 400, { error: error.message }); }
    return;
  }

  const buildMatch = pathname.match(/^\/api\/build\/jobs\/([0-9a-f-]+)$/i);
  if (buildMatch) {
    const job = buildJobs.get(buildMatch[1]);
    if (!job) { jsonRes(res, 404, { error: 'Build job not found' }); return; }
    if (req.method === 'GET') { const after = Math.max(0, Number(requestUrl.searchParams.get('after') || 0)); jsonRes(res, 200, publicBuildJob(job, Number.isFinite(after) ? after : 0)); return; }
    if (req.method === 'DELETE') { if (job.child && job.state === 'running') { job.state = 'stopping'; job.child.kill(); } jsonRes(res, 200, publicBuildJob(job)); return; }
    jsonRes(res, 405, { error: 'Unsupported operation for build job' });
    return;
  }

  if (pathname === '/api/serial/status' && req.method === 'GET') {
    jsonRes(res, 200, { available: true, activeSessions: serialSessions.size, maxSessions: MAX_SERIAL_SESSIONS });
    return;
  }

  if (pathname === '/api/serial/ports' && req.method === 'GET') {
    try { jsonRes(res, 200, { ports: await listSerialPorts() }); }
    catch (error) { jsonRes(res, 500, { error: error.message }); }
    return;
  }

  if (pathname === '/api/serial/sessions') {
    if (req.method === 'GET') { jsonRes(res, 200, { sessions: [...serialSessions.values()].map(session => publicSerialSession(session)) }); return; }
    if (req.method === 'POST') {
      try { const body = await readJSONBody(req), { session, reused } = await createSerialSession(body); jsonRes(res, reused ? 200 : 201, { ...publicSerialSession(session), reused }); }
      catch (error) { jsonRes(res, 400, { error: error.message }); }
      return;
    }
  }

  const serialMatch = pathname.match(/^\/api\/serial\/sessions\/([0-9a-f-]+)(?:\/(send|signals|config))?$/i);
  if (serialMatch) {
    const session = serialSessions.get(serialMatch[1]);
    if (!session) { jsonRes(res, 404, { error: 'Serial session not found' }); return; }
    if (serialMatch[2] === 'send' && req.method === 'POST') {
      try { if (session.state !== 'connected' || !session.port.isOpen) throw new Error('Serial session is not connected'); const body = await readJSONBody(req), payload = decodeNetworkPayload(body.data, body.encoding); await new Promise((resolve, reject) => session.port.write(payload, error => error ? reject(error) : session.port.drain(drainError => drainError ? reject(drainError) : resolve()))); pushSerialEvent(session, 'tx', payload); jsonRes(res, 200, { sent: payload.length }); }
      catch (error) { jsonRes(res, 400, { error: error.message }); }
      return;
    }
    if (serialMatch[2] === 'signals' && req.method === 'POST') {
      try { const body = await readJSONBody(req); if (typeof body.dtr === 'boolean') session.dtr = body.dtr; if (typeof body.rts === 'boolean') session.rts = body.rts; await new Promise((resolve, reject) => session.port.set({ dtr: session.dtr, rts: session.rts }, error => error ? reject(error) : resolve())); pushSerialEvent(session, 'system', `控制信号 DTR=${session.dtr ? 'ON' : 'OFF'} RTS=${session.rts ? 'ON' : 'OFF'}`); await persistSerialSessions(); jsonRes(res, 200, { dtr: session.dtr, rts: session.rts }); }
      catch (error) { jsonRes(res, 400, { error: error.message }); }
      return;
    }
    if (serialMatch[2] === 'config' && req.method === 'POST') {
      try {
        if (session.state !== 'connected' || !session.port.isOpen) throw new Error('Serial session is not connected');
        const body = await readJSONBody(req), baudRate = Number(body.baudRate);
        if (!Number.isInteger(baudRate) || baudRate < 50 || baudRate > 12000000) throw new Error('Invalid serial baud rate');
        await new Promise((resolve, reject) => session.port.update({ baudRate }, error => error ? reject(error) : resolve()));
        session.baudRate = baudRate;
        pushSerialEvent(session, 'system', `波特率已切换为 ${baudRate}`);
        await persistSerialSessions();
        jsonRes(res, 200, { baudRate });
      } catch (error) { jsonRes(res, 400, { error: error.message }); }
      return;
    }
    if (!serialMatch[2] && req.method === 'GET') { const after = Math.max(0, Number(requestUrl.searchParams.get('after') || 0)); jsonRes(res, 200, publicSerialSession(session, Number.isFinite(after) ? after : 0)); return; }
    if (!serialMatch[2] && req.method === 'DELETE') { await closeSerialSession(session); serialSessions.delete(session.id); await persistSerialSessions(); jsonRes(res, 200, { closed: true }); return; }
    jsonRes(res, 405, { error: 'Unsupported operation for serial session' });
    return;
  }

  if (pathname === '/api/network/status' && req.method === 'GET') {
    jsonRes(res, 200, { available: true, protocols: ['tcp', 'udp'], modes: ['client', 'server'], activeSessions: networkSessions.size, maxSessions: MAX_NETWORK_SESSIONS });
    return;
  }

  if (pathname === '/api/network/sessions' && req.method === 'GET') {
    jsonRes(res, 200, { sessions: [...networkSessions.values()].map(session => publicNetworkSession(session)) });
    return;
  }

  if (pathname === '/api/network/sessions' && req.method === 'POST') {
    try {
      const body = await readJSONBody(req);
      const session = createNetworkSession(body.type, body.host, body.port, body.localPort, body.mode);
      await persistNetworkSessions();
      jsonRes(res, 201, publicNetworkSession(session));
    } catch (error) {
      jsonRes(res, 400, { error: error.message });
    }
    return;
  }

  const networkMatch = pathname.match(/^\/api\/network\/sessions\/([0-9a-f-]+)(?:\/(send))?$/i);
  if (networkMatch) {
    const session = networkSessions.get(networkMatch[1]);
    if (!session) { jsonRes(res, 404, { error: 'Network session not found' }); return; }
    if (networkMatch[2] === 'send' && req.method === 'POST') {
      try {
        if (session.state !== 'connected') throw new Error('Network session is not connected');
        const body = await readJSONBody(req);
        const payload = decodeNetworkPayload(body.data, body.encoding);
        if (session.type === 'tcp' && session.mode === 'client') session.socket.write(payload);
        else if (session.type === 'tcp') {
          if (!session.clients.size) throw new Error('No TCP client is connected');
          for (const client of session.clients) client.write(payload);
        } else if (session.mode === 'client') session.socket.send(payload);
        else {
          if (!session.lastPeer) throw new Error('No UDP peer has sent data yet');
          session.socket.send(payload, session.lastPeer.port, session.lastPeer.address);
        }
        pushNetworkEvent(session, 'tx', payload);
        if (session.mode === 'server' && session.type === 'udp' && session.lastPeer) session.events[session.events.length - 1].peer = `${session.lastPeer.address}:${session.lastPeer.port}`;
        jsonRes(res, 200, { sent: payload.length });
      } catch (error) {
        jsonRes(res, 400, { error: error.message });
      }
      return;
    }
    if (!networkMatch[2] && req.method === 'GET') {
      const after = Math.max(0, Number(requestUrl.searchParams.get('after') || 0));
      jsonRes(res, 200, publicNetworkSession(session, Number.isFinite(after) ? after : 0));
      return;
    }
    if (!networkMatch[2] && req.method === 'DELETE') {
      closeNetworkSession(session);
      networkSessions.delete(session.id);
      await persistNetworkSessions();
      jsonRes(res, 200, { closed: true });
      return;
    }
    jsonRes(res, 405, { error: 'Unsupported operation for network session' });
    return;
  }

  if (pathname === '/api/chip-details' || pathname === '/api/component-details') {
    const chipName = requestUrl.searchParams.get('chip') || requestUrl.searchParams.get('part');
    if (!chipName) {
      jsonRes(res, 400, { error: 'Missing "chip" or "part" parameter' });
      return;
    }
    const details = await getChipDetails(chipName);
    jsonRes(res, 200, details);
    return;
  }

  if (pathname === '/api/servers') {
    const servers = await detectServers();
    jsonRes(res, 200, { servers });
    return;
  }

  if (pathname === '/api/models') {
    const serverName = requestUrl.searchParams.get('server');
    const servers = await detectServers();
    const matched = servers.find(s => s.name.toLowerCase() === serverName?.toLowerCase());
    if (matched) {
      jsonRes(res, 200, { models: matched.models, server: matched.name });
    } else {
      jsonRes(res, 404, { error: `Server "${serverName}" not found` });
    }
    return;
  }

  if (pathname.startsWith('/proxy/')) {
    const targetUrl = pathname.slice(7);
    if (targetUrl) {
      await proxyRequest(req, res, targetUrl);
      return;
    }
  }

  const targetUrl = requestUrl.searchParams.get('target');
  if (targetUrl) {
    await proxyRequest(req, res, targetUrl);
    return;
  }

  jsonRes(res, 404, { error: 'Unknown path. Use /api/network/*, /api/chip-details, /api/servers, /api/models, or /proxy/<url>' });
});

export function startServer({ detectAi = true, restoreSerial = true, restoreNetwork = restoreSerial, host = HOST, port = PORT } = {}) {
  installAgentLogging();
  return server.listen(port, host, async () => {
    const address = server.address();
    const listeningHost = typeof address === 'object' && address ? address.address : host;
    const listeningPort = typeof address === 'object' && address ? address.port : port;
    console.log(`\n✅ EmbedKit local proxy running on http://${listeningHost}:${listeningPort}`);
    if (restoreSerial) await restoreSerialSessions();
    if (restoreNetwork) await restoreNetworkSessions();
    if (!detectAi) return;
    const servers = await detectServers();
    if (servers.length > 0) {
      console.log(`\n🔍 Detected local AI servers:`);
      for (const s of servers) {
        console.log(`   ${s.name} at ${s.url} — ${s.models.length} model(s)`);
        const shown = s.models.slice(0, 5);
        for (const m of shown) {
          console.log(`     • ${m.name}`);
        }
        if (s.models.length > 5) {
          console.log(`     ... and ${s.models.length - 5} more`);
        }
      }
    } else {
      console.log(`\n⚠️  No local AI servers detected. Start Ollama or LM Studio.`);
    }
    console.log(`\n在 EmbedKit 中设置端点为: http://${listeningHost}:${listeningPort}/proxy/http://localhost:11434/v1/chat/completions`);
    console.log(`\n按 Ctrl+C 停止代理\n`);
  });
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) startServer();
