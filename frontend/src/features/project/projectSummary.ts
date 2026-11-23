import type { FileNode } from '../../types';
import { detectProjectBuild, type AgentBuildSystem, type ProjectBuildConfidence, type ProjectBuildKind } from './projectBuildDetection';
import { analyzeProjectRisks, type ProjectFinding } from './projectRiskAnalysis';

export interface ProjectSummary {
  chip: string;
  toolchain: string;
  sdk: string;
  projectType: string;
  peripherals: string[];
  files: number;
  sourceFiles: number;
  headerFiles: number;
  totalLines: number;
  entryPoints: string[];
  buildFiles: string[];
  findings: ProjectFinding[];
  buildKind: ProjectBuildKind;
  buildConfidence: ProjectBuildConfidence;
  buildEvidence: string[];
  agentBuildSystem?: AgentBuildSystem;
}

function stripCCommentsAndStrings(value: string) {
  return value.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\r\n]*/g, '').replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '');
}

export function summarizeProject(files: readonly FileNode[]): ProjectSummary {
  const content = files.map(file => `${file.name}\n${file.content}`).join('\n');
  const modelPattern = /\b(?:STM32[A-Z0-9]+|ESP32(?:-[A-Z0-9]+)*|nRF\d+[A-Z0-9]*|LPC\d+[A-Z0-9]*|GD32[A-Z0-9]+|CH32[A-Z0-9]+|ATmega\w+|ATSAMD\w+|PIC\d+[A-Z0-9]*|RP20\w+|MIMXRT\w+|MK\d+[A-Z0-9]*)\b/gi;
  const counts = [...content.matchAll(modelPattern)].reduce<Record<string, number>>((all, match) => {
    const key = match[0].toUpperCase();
    all[key] = (all[key] || 0) + 1;
    return all;
  }, {});
  const chip = Object.entries(counts).sort((left, right) => right[1] - left[1])[0]?.[0] || '未识别（可手动确认）';
  const detectedBuild = detectProjectBuild(files);
  const sdk = /esp-idf|freertos|zephyr|stm32cube|hal_|cmsis|rt-thread|threadx|mbed os/i.test(content)
    ? content.match(/esp-idf|FreeRTOS|Zephyr|STM32Cube|CMSIS|RT-Thread|ThreadX|Mbed OS/i)?.[0] || 'SDK/框架'
    : '未识别';
  const peripheralNames = ['UART', 'USART', 'SPI', 'I2C', 'CAN', 'USB', 'ADC', 'DAC', 'DMA', 'GPIO', 'TIM', 'Ethernet', 'BLE', 'Wi-Fi'];
  const sourceFiles = files.filter(file => /\.(c|cc|cpp)$/i.test(file.name));
  const headerFiles = files.filter(file => /\.(h|hpp)$/i.test(file.name));
  return {
    chip,
    toolchain: detectedBuild.label,
    sdk,
    projectType: detectedBuild.kind === 'keil' || detectedBuild.kind === 'iar' ? '厂商 IDE 工程' : detectedBuild.kind === 'unknown' ? 'C/C++ 源码' : `${detectedBuild.label} 工程`,
    peripherals: peripheralNames.filter(name => new RegExp(`\\b${name}\\b`, 'i').test(content)),
    files: files.length,
    sourceFiles: sourceFiles.length,
    headerFiles: headerFiles.length,
    totalLines: files.reduce((total, file) => total + file.content.split(/\r?\n/).length, 0),
    entryPoints: sourceFiles.filter(file => /\bmain\s*\(/.test(stripCCommentsAndStrings(file.content))).map(file => file.path),
    buildFiles: files.filter(file => file.name === 'Makefile' || file.name === 'CMakeLists.txt' || file.name === 'CMakePresets.json'
      || ['platformio.ini', 'Kconfig', 'prj.conf', 'sdkconfig', 'SConstruct'].includes(file.name)
      || /\.(uvprojx|uvoptx|ewp|eww|sct|icf|ld|ioc)$/i.test(file.name)).map(file => file.path),
    findings: analyzeProjectRisks(files),
    buildKind: detectedBuild.kind,
    buildConfidence: detectedBuild.confidence,
    buildEvidence: detectedBuild.evidence,
    agentBuildSystem: detectedBuild.agentBuildSystem,
  };
}
