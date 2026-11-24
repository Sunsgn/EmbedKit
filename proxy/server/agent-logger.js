import { appendFile, mkdir, rename, rm, stat } from 'fs/promises';
import { dirname } from 'path';

export const AGENT_LOGGER_API_VERSION = 1;

const redactSensitiveText = value => String(value)
  .replace(/\b(Bearer)\s+[A-Za-z0-9._~+\/-]+=*/gi, '$1 [REDACTED]')
  .replace(/\b(api[_-]?key|token|password|secret)\b\s*[:=]\s*([^\s,;}]+)/gi, '$1=[REDACTED]');

export function formatAgentLogValue(value) {
  if (value instanceof Error) return redactSensitiveText(value.stack || value.message);
  if (typeof value === 'string') return redactSensitiveText(value);
  try { return redactSensitiveText(JSON.stringify(value)); }
  catch { return '[Unserializable value]'; }
}

export function createAgentLogger({ file, maxBytes = 1024 * 1024, maxBackups = 3, maxLineBytes = 16 * 1024 } = {}) {
  let installed = false;
  let queue = Promise.resolve();
  const rotate = async () => {
    await rm(`${file}.${maxBackups}`, { force: true });
    for (let index = maxBackups - 1; index >= 1; index -= 1) await rename(`${file}.${index}`, `${file}.${index + 1}`).catch(() => undefined);
    await rename(file, `${file}.1`).catch(() => undefined);
  };
  const write = (level, values) => {
    const content = values.map(formatAgentLogValue).join(' ');
    const prefix = `${new Date().toISOString()} [${String(level).toUpperCase()}] `;
    const available = Math.max(0, maxLineBytes - Buffer.byteLength(prefix) - 1);
    const bounded = Buffer.from(content).subarray(0, available).toString('utf8');
    const line = `${prefix}${bounded}\n`;
    queue = queue.then(async () => {
      await mkdir(dirname(file), { recursive: true });
      const size = await stat(file).then(value => value.size).catch(() => 0);
      if (size + Buffer.byteLength(line) > maxBytes) await rotate();
      await appendFile(file, line, 'utf8');
    }).catch(() => undefined);
    return queue;
  };
  const install = (target = console) => {
    if (installed || !file) return;
    installed = true;
    for (const level of ['log', 'warn', 'error']) {
      const original = target[level].bind(target);
      target[level] = (...values) => { original(...values); void write(level, values); };
    }
  };
  return { apiVersion: AGENT_LOGGER_API_VERSION, install, write, flush: () => queue };
}
