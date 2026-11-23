import { createHash, randomUUID } from 'crypto';
import { createReadStream } from 'fs';
import { readdir, stat } from 'fs/promises';
import { spawn } from 'child_process';
import { isAbsolute, join, relative, resolve } from 'path';

export const BUILD_SERVICE_API_VERSION = 1;

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

export function createBuildCommand(options = {}, platform = process.platform) {
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
  const executable = requestedTool || (system === 'ninja' ? 'ninja' : platform === 'win32' ? 'mingw32-make' : 'make'), args = [];
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

export function createBuildService({
  createSelection,
  maxJobs = 8,
  maxEvents = 5000,
  maxHashJobs = 2,
  maxArtifactBytes = 512 * 1024 * 1024,
  platform = process.platform,
  spawnProcess = spawn,
} = {}) {
  if (typeof createSelection !== 'function') throw new Error('Build service requires a bounded file selection adapter');
  const jobs = new Map();
  let activeHashJobs = 0;

  const pushEvent = (job, stream, text) => {
    for (const line of String(text).replace(/\r/g, '').split('\n').filter(Boolean)) {
      job.lastEventId += 1;
      job.events.push({ id: job.lastEventId, timestamp: new Date().toISOString(), stream, text: line, diagnostic: parseBuildDiagnostic(line) || undefined });
    }
    if (job.events.length > maxEvents) job.events.splice(0, job.events.length - maxEvents);
  };
  const publicJob = (job, after = 0) => {
    const { child: _child, ...safe } = job;
    return { ...safe, events: job.events.filter(event => event.id > after) };
  };
  const collectArtifacts = async (rootPath, maxFiles = 2000) => {
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
  };
  const currentArtifact = async (job, indexValue) => {
    const index = Number(indexValue), artifact = Number.isInteger(index) && index >= 0 ? job?.artifacts?.[index] : null;
    if (!artifact) throw new Error('Build artifact was not found');
    const artifactPath = resolve(artifact.path), relation = relative(job.buildPath, artifactPath);
    if (relation.startsWith('..') || isAbsolute(relation)) throw new Error('Build artifact is outside the authorized build directory');
    const info = await stat(artifactPath);
    if (!info.isFile() || info.size !== artifact.size || info.mtime.toISOString() !== artifact.modifiedAt) throw new Error('Build artifact changed after discovery; run or refresh the build again');
    return { artifact, artifactPath, info };
  };

  return {
    apiVersion: BUILD_SERVICE_API_VERSION,
    size: () => jobs.size,
    listJobs: () => [...jobs.values()],
    getJob: id => jobs.get(id),
    publicJob,
    stopJob(job) { if (job.child && job.state === 'running') { job.state = 'stopping'; job.child.kill(); } },
    async detectEnvironment(rootPathValue) {
      const rootPath = validateProjectPath(rootPathValue), info = await stat(rootPath);
      if (!info.isDirectory()) throw new Error('Project path is not a directory');
      const names = await readdir(rootPath), lower = new Set(names.map(name => name.toLowerCase()));
      const system = lower.has('cmakelists.txt') ? 'cmake' : lower.has('build.ninja') ? 'ninja' : lower.has('makefile') ? 'make' : '';
      const tools = await Promise.all(['cmake', 'ninja', platform === 'win32' ? 'mingw32-make' : 'make'].map(executable => new Promise(resolveTool => {
        const child = spawnProcess(executable, ['--version'], { windowsHide: true, shell: false }); let output = '', settled = false;
        const finish = available => { if (settled) return; settled = true; resolveTool({ executable, available, version: output.replace(/\r?\n/g, ' ').trim().slice(0, 180) }); };
        child.stdout.on('data', data => { output += data.toString(); }); child.stderr.on('data', data => { output += data.toString(); }); child.on('error', () => finish(false)); child.on('close', code => finish(code === 0));
      })));
      return { rootPath, system, buildDir: system === 'ninja' && lower.has('build.ninja') ? '.' : 'build', projectFiles: names.filter(name => /^(CMakeLists\.txt|Makefile|build\.ninja|platformio\.ini|.*\.(uvprojx|ewp))$/i.test(name)), tools };
    },
    async startJob(options) {
      if ([...jobs.values()].filter(job => job.state === 'running').length >= maxJobs) throw new Error(`At most ${maxJobs} build jobs may run at once`);
      const command = createBuildCommand(options, platform); await stat(command.rootPath).then(info => { if (!info.isDirectory()) throw new Error('Project path is not a directory'); });
      const job = { id: randomUUID(), ...command, state: 'running', exitCode: null, signal: null, startedAt: new Date().toISOString(), finishedAt: '', artifacts: [], events: [], lastEventId: 0, child: null };
      jobs.set(job.id, job); pushEvent(job, 'system', `执行：${command.executable} ${command.args.join(' ')}`);
      const child = spawnProcess(command.executable, command.args, { cwd: command.rootPath, windowsHide: true, shell: false, env: { ...process.env, CLICOLOR: '0', NO_COLOR: '1' } }); job.child = child;
      child.stdout.on('data', data => pushEvent(job, 'stdout', data)); child.stderr.on('data', data => pushEvent(job, 'stderr', data));
      child.on('error', error => { pushEvent(job, 'stderr', error.message); job.state = 'failed'; job.finishedAt = new Date().toISOString(); });
      child.on('close', async (code, signal) => { job.exitCode = code; job.signal = signal; const finalState = job.state === 'stopping' ? 'cancelled' : code === 0 ? 'passed' : 'failed'; if (finalState === 'passed' && job.action !== 'clean') job.artifacts = await collectArtifacts(job.buildPath); job.state = finalState; job.finishedAt = new Date().toISOString(); pushEvent(job, 'system', job.state === 'passed' ? `构建成功，发现 ${job.artifacts.length} 个固件产物` : job.state === 'cancelled' ? '构建已停止' : `构建失败，退出码 ${code}`); job.child = null; });
      return job;
    },
    async authorizeArtifact(job, indexValue) { const { artifactPath, info } = await currentArtifact(job, indexValue); return createSelection('file', artifactPath, info); },
    async hashArtifact(job, indexValue) {
      const { artifact, artifactPath, info } = await currentArtifact(job, indexValue);
      if (info.size > maxArtifactBytes) throw new Error(`Build artifact exceeds ${maxArtifactBytes} byte hash limit`);
      if (activeHashJobs >= maxHashJobs) throw new Error('Too many artifact hash jobs are running');
      activeHashJobs += 1;
      try {
        const sha256 = await new Promise((resolveHash, reject) => { const hash = createHash('sha256'), input = createReadStream(artifactPath, { highWaterMark: 256 * 1024 }); input.on('data', chunk => hash.update(chunk)); input.on('error', reject); input.on('end', () => resolveHash(hash.digest('hex'))); });
        const after = await stat(artifactPath);
        if (after.size !== artifact.size || after.mtime.toISOString() !== artifact.modifiedAt) throw new Error('Build artifact changed while hashing; run or refresh the build again');
        return { algorithm: 'sha256', digest: sha256, size: artifact.size, modifiedAt: artifact.modifiedAt };
      } finally { activeHashJobs -= 1; }
    },
  };
}
