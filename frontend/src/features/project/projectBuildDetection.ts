import type { FileNode } from '../../types';

export type ProjectBuildKind = 'keil' | 'iar' | 'cmake' | 'esp-idf' | 'zephyr' | 'platformio' | 'make' | 'ninja' | 'unknown';
export type ProjectBuildConfidence = 'high' | 'medium' | 'low';
export type AgentBuildSystem = 'cmake' | 'make' | 'ninja';

export interface ProjectBuildDetection {
  kind: ProjectBuildKind;
  label: string;
  confidence: ProjectBuildConfidence;
  evidence: string[];
  agentBuildSystem?: AgentBuildSystem;
}

interface BuildCandidate {
  kind: ProjectBuildKind;
  label: string;
  score: number;
  evidence: string[];
  agentBuildSystem?: AgentBuildSystem;
}

export function detectProjectBuild(files: readonly FileNode[]): ProjectBuildDetection {
  const names = files.map(file => file.name.toLowerCase());
  const paths = files.map(file => file.path.replace(/\\/g, '/').toLowerCase());
  const content = files.map(file => file.content).join('\n');
  const candidates: BuildCandidate[] = [];
  const add = (kind: ProjectBuildKind, label: string, score: number, evidence: string[], agentBuildSystem?: AgentBuildSystem) => {
    if (score > 0) candidates.push({ kind, label, score, evidence, agentBuildSystem });
  };

  const keilProject = files.find(file => /\.(uvprojx|uvproj)$/i.test(file.name));
  const iarProject = files.find(file => /\.(ewp|eww)$/i.test(file.name));
  add('keil', 'Keil MDK', keilProject ? 100 : 0, keilProject ? [
    `发现 Keil 工程文件 ${keilProject.path}`,
    ...(files.some(file => /\.sct$/i.test(file.name)) ? ['发现 Scatter 链接脚本'] : []),
    ...(paths.some(path => path.includes('/rte/')) ? ['发现 RTE/Pack 配置目录'] : []),
  ] : []);
  add('iar', 'IAR Embedded Workbench', iarProject ? 100 : 0, iarProject ? [
    `发现 IAR 工程文件 ${iarProject.path}`,
    ...(files.some(file => /\.icf$/i.test(file.name)) ? ['发现 ICF 链接配置'] : []),
  ] : []);

  const hasCmake = names.includes('cmakelists.txt');
  const hasIdfRegister = /idf_component_register\s*\(/i.test(content);
  const hasIdfProject = /IDF_PATH|project\.cmake|idf\.cmake/i.test(content);
  const hasSdkconfig = names.some(name => name === 'sdkconfig' || name.startsWith('sdkconfig.'));
  add('esp-idf', 'ESP-IDF / CMake', hasCmake && (hasIdfRegister || hasIdfProject || hasSdkconfig) ? 120 : 0, [
    hasCmake && '发现 CMakeLists.txt',
    hasIdfRegister && '使用 idf_component_register',
    hasIdfProject && '引用 ESP-IDF 构建脚本',
    hasSdkconfig && '发现 sdkconfig',
  ].filter(Boolean) as string[]);

  const hasWest = names.includes('west.yml');
  const hasPrjConf = names.includes('prj.conf');
  const hasKconfig = names.includes('kconfig');
  const hasDts = files.some(file => /\.(dts|dtsi|overlay)$/i.test(file.name));
  add('zephyr', hasWest ? 'nRF Connect / Zephyr' : 'Zephyr',
    (hasWest ? 70 : 0) + (hasPrjConf ? 50 : 0) + (hasKconfig ? 25 : 0) + (hasDts ? 15 : 0) + (hasPrjConf && hasCmake ? 30 : 0), [
      hasWest && '发现 west.yml',
      hasPrjConf && '发现 prj.conf',
      hasKconfig && '发现 Kconfig',
      hasDts && '发现设备树文件',
    ].filter(Boolean) as string[]);

  const hasPlatformio = names.includes('platformio.ini');
  add('platformio', 'PlatformIO', hasPlatformio ? 100 : 0, hasPlatformio ? ['发现 platformio.ini'] : []);
  add('cmake', 'CMake', hasCmake ? 70 : 0, hasCmake ? [
    '发现 CMakeLists.txt',
    ...(names.includes('cmakepresets.json') ? ['发现 CMakePresets.json'] : []),
    ...(files.some(file => /toolchain.*\.cmake$/i.test(file.name)) ? ['发现 CMake 工具链文件'] : []),
  ] : [], 'cmake');
  const hasMake = names.includes('makefile') || files.some(file => /\.mk$/i.test(file.name));
  add('make', 'Make', hasMake ? 60 : 0, hasMake ? [names.includes('makefile') ? '发现 Makefile' : '发现 .mk 构建文件'] : [], 'make');
  const hasNinja = names.includes('build.ninja');
  add('ninja', 'Ninja（已有构建目录）', hasNinja ? 30 : 0, hasNinja ? ['发现 build.ninja；它通常是生成产物，不一定是主工程配置'] : [], 'ninja');

  const best = candidates.sort((left, right) => right.score - left.score)[0];
  if (!best) return { kind: 'unknown', label: '未识别', confidence: 'low', evidence: ['未发现受支持的工程配置文件'] };
  return {
    kind: best.kind,
    label: best.label,
    confidence: best.score >= 90 ? 'high' : best.score >= 60 ? 'medium' : 'low',
    evidence: best.evidence,
    agentBuildSystem: best.agentBuildSystem,
  };
}
