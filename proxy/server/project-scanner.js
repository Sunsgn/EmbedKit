import { readdir, realpath, stat } from 'fs/promises';
import { join, resolve } from 'path';

export const PROJECT_SCANNER_API_VERSION = 1;
export const PROJECT_SCAN_LIMITS = Object.freeze({ maxFiles: 5000, maxDepth: 12, maxEntries: 800, timeoutMs: 10_000, maxArtifacts: 500 });

const ignoredDirectories = new Set(['.git', '.svn', '.hg', 'node_modules', '.pio', '.cache', '__pycache__', '.idea', '.vscode', 'coverage']);
const sourceExtensions = new Set(['.c', '.h', '.cc', '.cpp', '.cxx', '.hpp', '.s', '.asm', '.rs', '.zig']);
const configNames = new Set(['cmakelists.txt', 'makefile', 'meson.build', 'platformio.ini', 'west.yml', 'prj.conf', 'freertosconfig.h', 'rtconfig.h']);
const configExtensions = new Set(['.uvprojx', '.uvproj', '.ewp', '.eww', '.ioc', '.project', '.cproject', '.ld', '.icf', '.sct', '.dts', '.dtsi', '.yaml', '.yml']);
const artifactExtensions = new Map([['.bin', 'bin'], ['.hex', 'hex'], ['.elf', 'elf'], ['.axf', 'elf'], ['.out', 'elf'], ['.map', 'map'], ['.srec', 'srec'], ['.s19', 'srec']]);

function addRecognition(recognition, category, value, relativePath, confidence, detail) {
  if (!recognition[category].includes(value)) recognition[category].push(value);
  if (!recognition.evidence.some(item => item.category === category && item.value === value && item.path === relativePath)) recognition.evidence.push({ category, value, path: relativePath, confidence, detail });
}

function recognizeFile(recognition, relativePath) {
  const normalized = relativePath.replace(/\\/g, '/'), name = normalized.split('/').pop() || '', lower = name.toLowerCase(), extension = lower.includes('.') ? lower.slice(lower.lastIndexOf('.')) : '';
  if (lower === 'cmakelists.txt') addRecognition(recognition, 'buildSystems', 'CMake', normalized, 'high', '发现 CMakeLists.txt');
  if (lower === 'makefile' || lower.endsWith('.mk')) addRecognition(recognition, 'buildSystems', 'Make', normalized, 'high', '发现 Makefile 或 .mk');
  if (lower === 'meson.build') addRecognition(recognition, 'buildSystems', 'Meson', normalized, 'high', '发现 meson.build');
  if (lower === 'platformio.ini') { addRecognition(recognition, 'buildSystems', 'PlatformIO', normalized, 'high', '发现 platformio.ini'); addRecognition(recognition, 'ides', 'PlatformIO', normalized, 'medium', 'PlatformIO 工程配置'); }
  if (extension === '.uvprojx' || extension === '.uvproj') { addRecognition(recognition, 'ides', 'Keil µVision', normalized, 'high', '发现 µVision 工程文件'); addRecognition(recognition, 'toolchains', 'Arm Compiler / GNU（待工程配置确认）', normalized, 'medium', 'µVision 可配置多种工具链'); }
  if (extension === '.ewp' || extension === '.eww') { addRecognition(recognition, 'ides', 'IAR Embedded Workbench', normalized, 'high', '发现 IAR 工程文件'); addRecognition(recognition, 'toolchains', 'IAR 工具链', normalized, 'medium', '发现 IAR 工程容器，具体版本待确认'); }
  if (extension === '.project' || extension === '.cproject') addRecognition(recognition, 'ides', 'Eclipse 系工程', normalized, 'medium', '发现 Eclipse 工程元数据');
  if (lower === 'freertosconfig.h') addRecognition(recognition, 'frameworks', 'FreeRTOS', normalized, 'high', '发现 FreeRTOSConfig.h');
  if (lower === 'west.yml' || lower === 'prj.conf') addRecognition(recognition, 'frameworks', 'Zephyr', normalized, 'medium', `发现 ${name}`);
  if (lower === 'rtconfig.h') addRecognition(recognition, 'frameworks', 'RT-Thread', normalized, 'high', '发现 rtconfig.h');
  if (lower === 'tx_api.h') addRecognition(recognition, 'frameworks', 'ThreadX / Azure RTOS', normalized, 'high', '发现 tx_api.h');
  if (extension === '.ioc') { addRecognition(recognition, 'projectTypes', 'MCU 固件工程', normalized, 'medium', '发现芯片配置工程文件'); const chip = name.replace(/\.ioc$/i, ''); if (/^(?:stm32|gd32|at32|ch32|hc32|mm32|n32)/i.test(chip)) addRecognition(recognition, 'chipCandidates', chip, normalized, 'medium', '由配置文件名推断，需结合工程配置确认'); }
}

export async function scanProjectDirectory(rootPath, options = {}) {
  const maxFiles = Math.min(PROJECT_SCAN_LIMITS.maxFiles, Math.max(1, Number.isSafeInteger(options.maxFiles) ? options.maxFiles : PROJECT_SCAN_LIMITS.maxFiles));
  const maxDepth = Math.min(PROJECT_SCAN_LIMITS.maxDepth, Math.max(1, Number.isSafeInteger(options.maxDepth) ? options.maxDepth : PROJECT_SCAN_LIMITS.maxDepth));
  const startedAt = Date.now(), root = await realpath(resolve(rootPath)), rootInfo = await stat(root);
  if (!rootInfo.isDirectory()) throw new Error('Selected project path is no longer a directory');
  const recognition = { projectTypes: [], frameworks: [], ides: [], toolchains: [], buildSystems: [], chipCandidates: [], evidence: [], unknowns: [] };
  const inventory = { scannedAt: '', fileCount: 0, directoryCount: 0, sourceFileCount: 0, configFileCount: 0, artifactCount: 0, maxFiles, maxDepth, truncated: false, entries: [], warnings: [] };
  const artifacts = [], queue = [{ path: root, relativePath: '', depth: 0 }];
  while (queue.length && inventory.fileCount < maxFiles) {
    if (Date.now() - startedAt > PROJECT_SCAN_LIMITS.timeoutMs) { inventory.truncated = true; inventory.warnings.push(`扫描超过 ${PROJECT_SCAN_LIMITS.timeoutMs} ms，已停止并保留当前结果`); break; }
    const current = queue.shift(); let children;
    try { children = await readdir(current.path, { withFileTypes: true }); }
    catch (error) { inventory.warnings.push(`无法读取 ${current.relativePath || '.'}：${String(error.message || error).slice(0, 160)}`); continue; }
    children.sort((a, b) => a.name.localeCompare(b.name));
    for (const child of children) {
      if (inventory.fileCount >= maxFiles) { inventory.truncated = true; break; }
      const childRelative = current.relativePath ? `${current.relativePath}/${child.name}` : child.name, childPath = join(current.path, child.name);
      if (child.isSymbolicLink()) { inventory.warnings.push(`已跳过符号链接：${childRelative}`); continue; }
      if (child.isDirectory()) {
        if (ignoredDirectories.has(child.name.toLowerCase()) || /^(?:build|dist|out|target|debug|release)$/i.test(child.name)) continue;
        inventory.directoryCount += 1;
        if (inventory.entries.length < PROJECT_SCAN_LIMITS.maxEntries) inventory.entries.push({ path: childRelative, kind: 'directory' });
        if (current.depth < maxDepth) queue.push({ path: childPath, relativePath: childRelative, depth: current.depth + 1 });
        else { inventory.truncated = true; inventory.warnings.push(`已达到最大目录深度：${childRelative}`); }
        continue;
      }
      if (!child.isFile()) continue;
      let info; try { info = await stat(childPath); } catch { inventory.warnings.push(`文件在扫描期间发生变化：${childRelative}`); continue; }
      inventory.fileCount += 1;
      const lower = child.name.toLowerCase(), extension = lower.includes('.') ? lower.slice(lower.lastIndexOf('.')) : '';
      const category = artifactExtensions.has(extension) ? 'artifact' : configNames.has(lower) || configExtensions.has(extension) || lower.endsWith('.mk') ? 'config' : sourceExtensions.has(extension) ? 'source' : 'other';
      if (category === 'source') inventory.sourceFileCount += 1;
      if (category === 'config') inventory.configFileCount += 1;
      if (category === 'artifact') { inventory.artifactCount += 1; artifacts.push({ path: childRelative, kind: artifactExtensions.get(extension), byteLength: info.size, modifiedAt: info.mtime.toISOString() }); }
      if (inventory.entries.length < PROJECT_SCAN_LIMITS.maxEntries) inventory.entries.push({ path: childRelative, kind: 'file', category, byteLength: info.size });
      recognizeFile(recognition, childRelative);
    }
  }
  if (queue.length || inventory.fileCount >= maxFiles) inventory.truncated = true;
  if (!recognition.projectTypes.length && inventory.sourceFileCount > 0) addRecognition(recognition, 'projectTypes', '通用嵌入式源码工程', recognition.evidence[0]?.path || '', 'low', '发现源码，但未识别到确定的平台或框架标记');
  for (const [field, label] of [['frameworks', '框架/RTOS'], ['ides', 'IDE'], ['toolchains', '工具链'], ['buildSystems', '构建系统'], ['chipCandidates', '芯片型号']]) if (!recognition[field].length) recognition.unknowns.push(`${label}未识别`);
  const scores = { high: 1, medium: 0.65, low: 0.35 }, evidenceScore = recognition.evidence.reduce((sum, item) => sum + scores[item.confidence], 0);
  inventory.scannedAt = new Date().toISOString();
  return { schemaVersion: PROJECT_SCANNER_API_VERSION, rootName: root.split(/[\\/]/).filter(Boolean).pop() || root, durationMs: Date.now() - startedAt, recognition: { ...recognition, confidence: recognition.evidence.length ? Math.min(1, evidenceScore / Math.max(1, recognition.evidence.length)) : 0 }, inventory, artifacts: artifacts.slice(0, PROJECT_SCAN_LIMITS.maxArtifacts) };
}
