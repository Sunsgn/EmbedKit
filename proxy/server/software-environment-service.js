import { createHash, randomUUID } from 'crypto';
import https from 'https';
import { spawn } from 'child_process';
import { createWriteStream } from 'fs';
import { lstat, mkdir, readFile, realpath, rm, stat, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { dirname, isAbsolute, join, relative, resolve } from 'path';

export const SOFTWARE_ENVIRONMENT_API_VERSION = 1;

const DEFAULT_MAX_DOWNLOAD_BYTES = 128 * 1024 * 1024;
const DEFAULT_DEFINITIONS = [
  { id: 'runtime.node', capabilityId: 'runtime.node', name: 'Node.js', executable: process.execPath, args: ['--version'] },
  { id: 'build.cmake', capabilityId: 'build.cmake', name: 'CMake', executable: 'cmake', args: ['--version'] },
  { id: 'build.ninja', capabilityId: 'build.ninja', name: 'Ninja', executable: 'ninja', args: ['--version'] },
  { id: 'build.make', capabilityId: 'build.make', name: 'Make', executable: process.platform === 'win32' ? 'mingw32-make' : 'make', args: ['--version'] },
  { id: 'compiler.arm.gnu', capabilityId: 'compiler.arm.gnu', name: 'Arm GNU Toolchain', executable: 'arm-none-eabi-gcc', args: ['--version'] },
  { id: 'debug.openocd', capabilityId: 'debug.openocd', name: 'OpenOCD', executable: 'openocd', args: ['--version'] },
  { id: 'debug.pyocd', capabilityId: 'debug.pyocd', name: 'pyOCD', executable: 'pyocd', args: ['--version'] },
];
const DEFAULT_MANIFESTS = [{
  id: 'ninja-1.12.1-win32-x64', softwareId: 'build.ninja', capabilityId: 'build.ninja', name: 'Ninja', version: '1.12.1', platform: 'win32', architecture: 'x64',
  sourceUrl: 'https://github.com/ninja-build/ninja/releases/download/v1.12.1/ninja-win.zip', officialPage: 'https://github.com/ninja-build/ninja/releases/tag/v1.12.1',
  sha256: 'f550fec705b6d6ff58f2db3c374c2277a37691678d6aba463adcbb129108467a', byteLength: 275425, license: 'Apache-2.0', requiresLicenseAcceptance: false,
  archive: 'zip', installSubdirectory: 'ninja/1.12.1', expectedExecutable: 'ninja.exe', verificationArgs: ['--version'], verifiedAt: '2026-10-14',
}];

export function validateInstallManifest(value, maxDownloadBytes = DEFAULT_MAX_DOWNLOAD_BYTES) {
  if (!value || typeof value !== 'object' || !/^[a-z0-9][a-z0-9._-]{2,100}$/i.test(value.id || '') || !/^[a-z0-9][a-z0-9._-]{2,100}$/i.test(value.capabilityId || '')) throw new Error('Install manifest identifiers are invalid');
  const source = new URL(value.sourceUrl);
  if (source.protocol !== 'https:' || !['github.com'].includes(source.hostname)) throw new Error('Install manifest must use an allowed official HTTPS source');
  const officialPage = new URL(value.officialPage);
  if (officialPage.protocol !== 'https:' || officialPage.hostname !== 'github.com') throw new Error('Install manifest official page is invalid');
  if (!/^[a-f0-9]{64}$/.test(value.sha256 || '') || !Number.isSafeInteger(value.byteLength) || value.byteLength < 1 || value.byteLength > maxDownloadBytes) throw new Error('Install manifest digest or size is invalid');
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

export function extractSoftwareVersion(output) {
  return String(output || '').match(/\bv?(\d+(?:\.\d+){0,3}(?:[-+._][0-9A-Za-z.-]+)?)/)?.[1] || '';
}

export function createSoftwareEnvironmentService({
  stateFile,
  getDirectorySelection,
  agentVersion = '1.0.0',
  definitions = DEFAULT_DEFINITIONS,
  manifests = DEFAULT_MANIFESTS,
  platform = process.platform,
  architecture = process.arch,
  maxDownloadBytes = DEFAULT_MAX_DOWNLOAD_BYTES,
  maxJobs = 20,
  maxActiveJobs = 2,
  detectionTimeoutMs = 4000,
  outputLimit = 16 * 1024,
  processSpawner = spawn,
  httpsAdapter = https,
} = {}) {
  let manifestRegistry = manifests.map(value => validateInstallManifest(value, maxDownloadBytes));
  const managedInstallations = new Map();
  const jobs = new Map();
  let managedInstallationsLoaded = false;

  const runProcess = (executable, args, timeoutMs = 30_000) => new Promise((resolveProcess, reject) => {
    const child = processSpawner(executable, args, { windowsHide: true, shell: false });
    let output = '', settled = false;
    const finish = (error, code) => { if (settled) return; settled = true; clearTimeout(timer); if (error) reject(error); else if (code !== 0) reject(new Error(`${executable} exited with code ${code}`)); else resolveProcess(output.trim()); };
    const append = data => { if (output.length < outputLimit) output += data.toString().slice(0, outputLimit - output.length); };
    const timer = setTimeout(() => { child.kill(); finish(new Error(`${executable} timed out`)); }, timeoutMs);
    child.stdout.on('data', append); child.stderr.on('data', append); child.on('error', error => finish(error)); child.on('close', code => finish(null, code));
  });
  const downloadPinnedFile = (job, manifest, destination, redirectCount = 0) => new Promise((resolveDownload, reject) => {
    if (redirectCount > 5) { reject(new Error('Too many download redirects')); return; }
    const url = new URL(manifest.sourceUrl);
    if (url.protocol !== 'https:' || !['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com'].includes(url.hostname)) { reject(new Error('Download redirect left the allowed official hosts')); return; }
    const request = httpsAdapter.get(url, { headers: { 'User-Agent': `EmbedKit-Agent/${agentVersion}` } }, response => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) { response.resume(); const redirected = new URL(response.headers.location, url); downloadPinnedFile(job, { ...manifest, sourceUrl: redirected.toString() }, destination, redirectCount + 1).then(resolveDownload, reject); return; }
      if (response.statusCode !== 200) { response.resume(); reject(new Error(`Official download returned HTTP ${response.statusCode}`)); return; }
      const declared = Number(response.headers['content-length'] || 0);
      if (declared && declared !== manifest.byteLength) { response.resume(); reject(new Error('Official download size does not match the pinned manifest')); return; }
      const output = createWriteStream(destination, { flags: 'wx' }), hash = createHash('sha256'); let received = 0, finished = false;
      const fail = error => { if (finished) return; finished = true; output.destroy(); reject(error); };
      response.on('data', chunk => { received += chunk.length; if (job.cancelRequested) { request.destroy(); fail(new Error('Installation cancelled')); return; } if (received > manifest.byteLength || received > maxDownloadBytes) { request.destroy(); fail(new Error('Download exceeded the pinned size')); return; } hash.update(chunk); output.write(chunk); job.progress = Math.min(70, Math.round(received / manifest.byteLength * 70)); });
      response.on('error', fail); output.on('error', fail);
      response.on('end', () => output.end(() => { if (finished) return; finished = true; const digest = hash.digest('hex'); if (received !== manifest.byteLength || digest !== manifest.sha256) reject(new Error('Downloaded package failed SHA-256 or size verification')); else resolveDownload({ byteLength: received, sha256: digest }); }));
    });
    job.request = request; request.on('error', reject); request.setTimeout(30_000, () => request.destroy(new Error('Official download timed out')));
  });
  const defaultInstaller = () => ({
    download: downloadPinnedFile,
    extract: async (job, manifest, archivePath, targetPath) => {
      const listing = await runProcess('tar', ['-tf', archivePath]);
      validateArchiveEntries(listing, manifest.expectedExecutable);
      if (job.cancelRequested) throw new Error('Installation cancelled');
      await runProcess('tar', ['-xf', archivePath, '-C', targetPath]);
    },
  });
  let installer = defaultInstaller();
  const configureInstaller = adapter => { installer = adapter == null ? defaultInstaller() : adapter; };
  const configureManifests = values => { manifestRegistry = values == null ? DEFAULT_MANIFESTS.map(value => validateInstallManifest(value, maxDownloadBytes)) : values.map(value => validateInstallManifest(value, maxDownloadBytes)); };
  const detectDefinition = definition => new Promise(resolveDetection => {
    const startedAt = Date.now(), child = processSpawner(definition.executable, definition.args, { windowsHide: true, shell: false });
    let output = '', settled = false;
    const finish = available => { if (settled) return; settled = true; clearTimeout(timer); resolveDetection({ id: definition.id, capabilityId: definition.capabilityId, name: definition.name, available, executable: definition.executable, version: available ? extractSoftwareVersion(output) : '', rawVersion: available ? output.replace(/\r?\n/g, ' ').trim().slice(0, 500) : '', detection: definition.detection || 'path-command', durationMs: Date.now() - startedAt, installedAt: definition.installedAt, manifestId: definition.manifestId }); };
    const append = data => { if (output.length < outputLimit) output += data.toString().slice(0, outputLimit - output.length); };
    const timer = setTimeout(() => { child.kill(); finish(false); }, detectionTimeoutMs);
    child.stdout.on('data', append); child.stderr.on('data', append); child.on('error', () => finish(false)); child.on('close', code => finish(code === 0));
  });
  const detect = async () => {
    if (!managedInstallationsLoaded) {
      managedInstallationsLoaded = true;
      try {
        const stored = JSON.parse(await readFile(stateFile, 'utf8'));
        if (stored?.version === 1 && Array.isArray(stored.installations)) for (const item of stored.installations.slice(0, 100)) if (item && typeof item.id === 'string' && typeof item.executable === 'string' && isAbsolute(item.executable)) managedInstallations.set(item.id, item);
      } catch { /* No previous managed installations. */ }
    }
    const managedDefinitions = [...managedInstallations.values()].map(item => ({ ...item, args: item.verificationArgs, detection: 'managed-installation' }));
    const results = await Promise.all([...definitions, ...managedDefinitions].map(detectDefinition));
    for (const result of results) if (!result.available && result.detection === 'managed-installation') managedInstallations.delete(result.id);
    return { schemaVersion: 1, platform, architecture, detectedAt: new Date().toISOString(), installations: results.filter(item => item.available), unavailable: results.filter(item => !item.available).map(item => ({ id: item.id, capabilityId: item.capabilityId, name: item.name })) };
  };
  const saveManaged = async () => { await mkdir(dirname(stateFile), { recursive: true }); await writeFile(stateFile, JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), installations: [...managedInstallations.values()].slice(0, 100) }, null, 2), 'utf8'); };
  const listManifests = () => ({ schemaVersion: 1, manifests: manifestRegistry.map(value => validateInstallManifest(value, maxDownloadBytes)).filter(item => item.platform === platform && item.architecture === architecture).map(({ sha256: _sha256, verificationArgs: _verificationArgs, installSubdirectory: _installSubdirectory, expectedExecutable: _expectedExecutable, ...safe }) => safe) });
  const publicJob = job => { const { request: _request, rootPath: _rootPath, targetPath: _targetPath, cleanupPath: _cleanupPath, ...safe } = job; return safe; };
  const pushEvent = (job, level, message) => { job.events.push({ time: new Date().toISOString(), level, message: String(message).slice(0, 500) }); if (job.events.length > 100) job.events.splice(0, job.events.length - 100); };
  const runJob = async (job, manifest) => {
    const archivePath = join(tmpdir(), `embedkit-${job.id}.zip`); let targetCreated = false;
    try {
      pushEvent(job, 'info', `正在从官方来源下载 ${manifest.name} ${manifest.version}`); await installer.download(job, manifest, archivePath);
      if (job.cancelRequested) throw new Error('Installation cancelled');
      job.progress = 75; pushEvent(job, 'info', '下载大小和 SHA-256 校验通过');
      let ancestor = job.rootPath;
      for (const segment of manifest.installSubdirectory.split('/')) { ancestor = join(ancestor, segment); try { const info = await lstat(ancestor); if (info.isSymbolicLink() || !info.isDirectory()) throw new Error('Install target contains a non-directory or symbolic-link ancestor'); } catch (error) { if (error.code !== 'ENOENT') throw error; job.cleanupPath = ancestor; break; } }
      await mkdir(job.targetPath, { recursive: true }); targetCreated = true; await installer.extract(job, manifest, archivePath, job.targetPath);
      if (job.cancelRequested) throw new Error('Installation cancelled');
      job.progress = 90;
      const executable = join(job.targetPath, manifest.expectedExecutable), info = await stat(executable);
      if (!info.isFile()) throw new Error('Installed executable was not found');
      const rawVersion = await runProcess(executable, manifest.verificationArgs, 10_000), version = extractSoftwareVersion(rawVersion);
      if (job.cancelRequested) throw new Error('Installation cancelled');
      if (!version) throw new Error('Installed software did not return a verifiable version');
      const installation = { id: `${manifest.softwareId}:${manifest.version}:${createHash('sha256').update(executable).digest('hex').slice(0, 12)}`, capabilityId: manifest.capabilityId, name: manifest.name, executable, verificationArgs: manifest.verificationArgs, version, installedAt: new Date().toISOString(), manifestId: manifest.id };
      managedInstallations.set(installation.id, installation); await saveManaged();
      job.state = 'passed'; job.progress = 100; job.installation = { ...installation, verificationArgs: undefined }; job.installPath = job.targetPath; pushEvent(job, 'info', `安装完成并验证版本 ${version}`);
    } catch (error) {
      job.state = job.cancelRequested || /cancelled/i.test(error.message) ? 'cancelled' : 'failed'; job.error = error.message; pushEvent(job, 'error', error.message);
      if (targetCreated) await rm(job.cleanupPath || job.targetPath, { recursive: true, force: true }).catch(() => undefined);
    } finally { job.finishedAt = new Date().toISOString(); job.request = null; await rm(archivePath, { force: true }).catch(() => undefined); }
  };
  const startJob = async options => {
    if ([...jobs.values()].filter(item => item.state === 'running').length >= maxActiveJobs) throw new Error(`At most ${maxActiveJobs} installation jobs may run at once`);
    const manifest = manifestRegistry.map(value => validateInstallManifest(value, maxDownloadBytes)).find(item => item.id === options.manifestId);
    if (!manifest || manifest.platform !== platform || manifest.architecture !== architecture) throw new Error('Install manifest is unavailable for this platform');
    if (manifest.requiresLicenseAcceptance && options.acceptedLicense !== true) throw new Error('License acceptance is required');
    if (typeof getDirectorySelection !== 'function') throw new Error('Directory selection service is unavailable');
    const selection = getDirectorySelection(options.directorySelectionId, 'directory'), rootPath = await realpath(resolve(selection.path)), targetPath = resolve(rootPath, ...manifest.installSubdirectory.split('/'));
    const relation = relative(rootPath, targetPath);
    if (!relation || relation.startsWith('..') || isAbsolute(relation)) throw new Error('Install target must stay inside the selected directory');
    const rootInfo = await stat(rootPath); if (!rootInfo.isDirectory()) throw new Error('Selected install root is no longer a directory');
    if (await stat(targetPath).then(() => true).catch(() => false)) throw new Error('Install target already exists; choose another root or remove it manually');
    while (jobs.size >= maxJobs) { const removable = [...jobs].find(([, item]) => item.state !== 'running'); if (!removable) break; jobs.delete(removable[0]); }
    const job = { id: randomUUID(), manifestId: manifest.id, softwareId: manifest.softwareId, name: manifest.name, version: manifest.version, state: 'running', progress: 0, startedAt: new Date().toISOString(), finishedAt: '', cancelRequested: false, events: [], error: '', rootPath, targetPath, cleanupPath: '', request: null };
    jobs.set(job.id, job); void runJob(job, manifest); return publicJob(job);
  };
  const cancelJob = job => { job.cancelRequested = true; job.request?.destroy(new Error('Installation cancelled')); };

  return {
    apiVersion: SOFTWARE_ENVIRONMENT_API_VERSION,
    configureInstaller,
    configureManifests,
    detect,
    listManifests,
    startJob,
    getJob: id => jobs.get(id),
    publicJob,
    cancelJob,
  };
}
