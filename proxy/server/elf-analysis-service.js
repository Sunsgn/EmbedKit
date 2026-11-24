import { createHash, randomUUID } from 'crypto';
import { createReadStream } from 'fs';
import { open, stat } from 'fs/promises';
import { spawn } from 'child_process';
import { analyzeElf, lookupElfAddress, parseElfAddress } from '../elf.js';

export const ELF_ANALYSIS_SERVICE_API_VERSION = 1;

export function createElfAnalysisService({ getSelection, maxAnalyses = 8, ttlMs = 15 * 60 * 1000, spawnProcess = spawn, now = Date.now } = {}) {
  if (typeof getSelection !== 'function') throw new Error('ELF analysis service requires a file selection provider');
  const analyses = new Map();
  const getAnalysis = id => {
    const cached = analyses.get(id);
    if (!cached || cached.expiresAt <= now()) { analyses.delete(id); throw new Error('ELF analysis is missing or expired; select the file again'); }
    return cached;
  };
  const runDisassembler = (executable, args) => new Promise(resolveRun => {
    const child = spawnProcess(executable, args, { windowsHide: true, shell: false });
    let stdout = '', stderr = '', settled = false, timer;
    const finish = result => { if (settled) return; settled = true; clearTimeout(timer); resolveRun(result); };
    const append = (current, chunk) => (current + chunk.toString()).slice(0, 256 * 1024);
    child.stdout.on('data', chunk => { stdout = append(stdout, chunk); }); child.stderr.on('data', chunk => { stderr = append(stderr, chunk); });
    child.on('error', error => finish({ ok: false, error: error.code === 'ENOENT' ? 'not-found' : error.message }));
    child.on('close', code => finish({ ok: code === 0, stdout, error: code === 0 ? '' : stderr.trim().slice(0, 500) || `exit-${code}` }));
    timer = setTimeout(() => { child.kill(); finish({ ok: false, error: 'timeout' }); }, 5000);
  });
  return {
    apiVersion: ELF_ANALYSIS_SERVICE_API_VERSION,
    async analyze(id) {
      const selection = getSelection(id, 'file'), info = await stat(selection.path);
      if (!info.isFile() || info.size !== selection.size) throw new Error('Selected file changed after authorization');
      const handle = await open(selection.path, 'r');
      try {
        const analysis = await analyzeElf({ size: info.size, read: async (offset, length) => {
          if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || offset + length > info.size) throw new Error('ELF parser requested data outside the selected file');
          const buffer = Buffer.alloc(length), { bytesRead } = await handle.read(buffer, 0, length, offset);
          if (bytesRead !== length) throw new Error('Selected ELF file was truncated while reading');
          return new Uint8Array(buffer.buffer, buffer.byteOffset, bytesRead);
        } });
        const sha256 = await new Promise((resolveHash, rejectHash) => { const hash = createHash('sha256'), stream = createReadStream(selection.path, { highWaterMark: 256 * 1024 }); stream.on('data', chunk => hash.update(chunk)); stream.on('end', () => resolveHash(hash.digest('hex'))); stream.on('error', rejectHash); });
        const timestamp = now(), analysisId = randomUUID();
        for (const [cachedId, cached] of analyses) if (cached.expiresAt <= timestamp) analyses.delete(cachedId);
        while (analyses.size >= maxAnalyses) analyses.delete(analyses.keys().next().value);
        analyses.set(analysisId, { analysis, path: selection.path, expiresAt: timestamp + ttlMs });
        const { symbols: _symbols, lineRows: _lineRows, ...publicAnalysis } = analysis;
        return { ...publicAnalysis, sha256, analysisId, expiresAt: new Date(timestamp + ttlMs).toISOString() };
      } finally { await handle.close(); }
    },
    lookup(id, address) { return lookupElfAddress(getAnalysis(id).analysis, address); },
    async disassemble(id, addressValue, beforeValue, afterValue) {
      const cached = getAnalysis(id), requested = parseElfAddress(addressValue), normalized = cached.analysis.machineId === 40 ? requested & ~1n : requested;
      const before = Number(beforeValue ?? 16), after = Number(afterValue ?? 32);
      if (!Number.isSafeInteger(before) || before < 0 || before > 128 || !Number.isSafeInteger(after) || after < 2 || after > 128) throw new Error('Disassembly byte window is outside the supported range');
      const start = normalized > BigInt(before) ? normalized - BigInt(before) : 0n, stop = normalized + BigInt(after);
      const candidates = cached.analysis.machineId === 40 ? ['arm-none-eabi-objdump', 'llvm-objdump', 'objdump'] : cached.analysis.machineId === 243 ? ['riscv-none-elf-objdump', 'riscv64-unknown-elf-objdump', 'llvm-objdump', 'objdump'] : ['llvm-objdump', 'objdump'];
      const attempts = [];
      for (const executable of candidates) {
        const run = await runDisassembler(executable, ['-d', `--start-address=0x${start.toString(16)}`, `--stop-address=0x${stop.toString(16)}`, cached.path]);
        if (!run.ok) { attempts.push(`${executable}: ${run.error}`); continue; }
        const instructions = run.stdout.split(/\r?\n/).map(line => line.match(/^\s*([0-9a-f]+):\s+((?:[0-9a-f]{2,8}\s+)+)\s*([^\s]+)\s*(.*)$/i)).filter(Boolean).slice(0, 128).map(match => { const address = BigInt(`0x${match[1]}`); return { address: `0x${address.toString(16).toUpperCase()}`, bytes: match[2].trim().replace(/\s+/g, ' '), mnemonic: match[3], operands: match[4].trim(), isTarget: address === normalized }; });
        if (!instructions.length) { attempts.push(`${executable}: no-instructions`); continue; }
        return { available: true, requestedAddress: `0x${requested.toString(16).toUpperCase()}`, normalizedAddress: `0x${normalized.toString(16).toUpperCase()}`, tool: executable, instructions, warnings: instructions.some(item => item.isTarget) ? [] : ['反汇编输出没有精确覆盖目标地址；请核对指令边界和目标架构。'] };
      }
      return { available: false, requestedAddress: `0x${requested.toString(16).toUpperCase()}`, normalizedAddress: `0x${normalized.toString(16).toUpperCase()}`, tool: null, instructions: [], warnings: ['本机未找到能够解析该 ELF 架构的 objdump；源码和符号定位仍然可用。', ...attempts.slice(0, 4)] };
    },
  };
}
