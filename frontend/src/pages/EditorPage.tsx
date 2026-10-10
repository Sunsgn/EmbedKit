import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Editor, { type OnMount } from "@monaco-editor/react";
import {
  FolderOpen,
  Play,
  FileCode,
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  Settings,
  Cpu,
  Download as DownloadIcon,
  ExternalLink,
  BookOpen,
  Upload,
  Sparkles,
  Network,
} from "lucide-react";
import type { FileNode, Chip, CompileResult } from "../types";
import { chips } from "../data/chips";
import {
  loadStoredAiConfig,
  localProxyUrl,
  streamAiResponse,
} from "../services/aiService";
import { AI_PROVIDERS, type AiConfig } from "../types/ai";
import {
  loadCurrentWorkspace,
  saveCurrentWorkspace,
} from "../services/workspaceStorage";
import ProjectBuildPanel from "../features/project/ProjectBuildPanel";
import MapAnalysisPanel from "../features/project/MapAnalysisPanel";
import { analyzeMap } from "../utils/mapAnalyzer";
import ProjectArchitecturePanel from "../features/project/ProjectArchitecturePanel";
import { analyzeProjectArchitecture } from "../utils/projectArchitecture";
import { analyzeProgramBehavior } from "../utils/programBehavior";
import type { RuntimeTraceAnalysis } from "../utils/runtimeTrace";
import { clearRuntimeTrace, loadRuntimeTrace, saveRuntimeTrace } from "../services/runtimeTraceStorage";

const defaultFiles: FileNode[] = [
  {
    name: "main.c",
    path: "/main.c",
    content: `#include "stm32f1xx_hal.h"

/**
 * EmbedKit - LED Blink Example
 * Target: STM32F103C8T6
 */

void SystemClock_Config(void);
static void MX_GPIO_Init(void);

int main(void) {
    HAL_Init();
    SystemClock_Config();
    MX_GPIO_Init();

    while (1) {
        HAL_GPIO_TogglePin(GPIOA, GPIO_PIN_5);
        HAL_Delay(500);
    }
}

static void MX_GPIO_Init(void) {
    GPIO_InitTypeDef GPIO_InitStruct = {0};

    __HAL_RCC_GPIOA_CLK_ENABLE();

    GPIO_InitStruct.Pin = GPIO_PIN_5;
    GPIO_InitStruct.Mode = GPIO_MODE_OUTPUT_PP;
    GPIO_InitStruct.Pull = GPIO_NOPULL;
    GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_LOW;
    HAL_GPIO_Init(GPIOA, &GPIO_InitStruct);
}
`,
    language: "c",
  },
  {
    name: "stm32f1xx_hal_conf.h",
    path: "/Inc/stm32f1xx_hal_conf.h",
    content: `#ifndef STM32F1XX_HAL_CONF_H
#define STM32F1XX_HAL_CONF_H

#define HSE_VALUE 8000000
#define HSICAL_VALUE ((uint32_t)RCC_CALIBRATION_VAL)
#define HSE_BYPASS_DISABLE 1U
#define HSI_VALUE 8000000
#define LSI_VALUE 40000
#define LSE_VALUE 32768
#define VDD_VALUE 330

#define USE_HAL_GPIO_REGISTER_CALLBACKS 1
#define USE_HAL_CORTEX_REGISTER_CALLBACKS 1
#define USE_HAL_RCC_REGISTER_CALLBACKS 1

#endif
`,
    language: "h",
  },
  {
    name: "Makefile",
    path: "/Makefile",
    content: `TARGET = led_blink
SRC_DIR = Src
INC_DIR = Inc
BUILD_DIR = Build

CC = arm-none-eabi-gcc
SIZE = arm-none-eabi-size
OBJCOPY = arm-none-eabi-objcopy

CFLAGS = -mcpu=cortex-m3 -mthumb -Wall -Wextra
CFLAGS += -I$(INC_DIR)

SRCS = $(wildcard $(SRC_DIR)/*.c)
OBJS = $(patsubst $(SRC_DIR)/%.c,$(BUILD_DIR)/%.o,$(SRCS))

all: $(BUILD_DIR)/$(TARGET).elf $(BUILD_DIR)/$(TARGET).hex $(BUILD_DIR)/$(TARGET).bin size

$(BUILD_DIR)/%.o: $(SRC_DIR)/%.c
\t$(CC) $(CFLAGS) -c $< -o $@

$(BUILD_DIR)/$(TARGET).elf: $(OBJS)
\t$(CC) $(CFLAGS) -o $@ $^ -T linker.ld

$(BUILD_DIR)/$(TARGET).hex: $(BUILD_DIR)/$(TARGET).elf
\t$(OBJCOPY) -O ihex $< $@

$(BUILD_DIR)/$(TARGET).bin: $(BUILD_DIR)/$(TARGET).elf
\t$(OBJCOPY) -O binary $< $@

size:
\t$(SIZE) $(BUILD_DIR)/$(TARGET).elf

clean:
\trm -rf $(BUILD_DIR)/*

.PHONY: all clean size
`,
    language: "makefile",
  },
];

function createProjectFiles(chip: Chip, projectName: string): FileNode[] {
  const series = chip.series.toLowerCase();
  const halHeader = series.includes("stm32f1")
    ? "stm32f1xx_hal.h"
    : series.includes("stm32f0")
      ? "stm32f0xx_hal.h"
      : series.includes("stm32f4")
        ? "stm32f4xx_hal.h"
        : "stdint.h";
  const source = series.includes("stm32f1")
    ? `/**
 * ${projectName} · STM32F1 HAL 示例
 * Target: ${chip.name}
 * 功能：PC13 LED 闪烁 + USART1 周期发送
 */
#include "stm32f1xx_hal.h"

UART_HandleTypeDef huart1;

static void SystemClock_Config(void);
static void MX_GPIO_Init(void);
static void MX_USART1_UART_Init(void);

int main(void) {
    HAL_Init();
    SystemClock_Config();
    MX_GPIO_Init();
    MX_USART1_UART_Init();

    const uint8_t message[] = "EmbedKit STM32F1 ready\\r\\n";
    for (;;) {
        HAL_GPIO_TogglePin(GPIOC, GPIO_PIN_13);
        HAL_UART_Transmit(&huart1, (uint8_t *)message, sizeof(message) - 1U, 100U);
        HAL_Delay(500U);
    }
}

static void MX_USART1_UART_Init(void) {
    huart1.Instance = USART1;
    huart1.Init.BaudRate = 115200;
    huart1.Init.WordLength = UART_WORDLENGTH_8B;
    huart1.Init.StopBits = UART_STOPBITS_1;
    huart1.Init.Parity = UART_PARITY_NONE;
    huart1.Init.Mode = UART_MODE_TX_RX;
    huart1.Init.HwFlowCtl = UART_HWCONTROL_NONE;
    huart1.Init.OverSampling = UART_OVERSAMPLING_16;
    if (HAL_UART_Init(&huart1) != HAL_OK) { while (1) { } }
}

static void MX_GPIO_Init(void) {
    __HAL_RCC_GPIOC_CLK_ENABLE();
    GPIO_InitTypeDef gpio = {0};
    gpio.Pin = GPIO_PIN_13;
    gpio.Mode = GPIO_MODE_OUTPUT_PP;
    gpio.Pull = GPIO_NOPULL;
    gpio.Speed = GPIO_SPEED_FREQ_LOW;
    HAL_GPIO_Init(GPIOC, &gpio);
}

static void SystemClock_Config(void) {
    /* 这里保留 CubeMX 生成的时钟配置位置，请按板载晶振和电源条件确认。 */
}
`
    : `/**
 * ${projectName}
 * Target: ${chip.name}
 * Generated by EmbedKit
 */
#include <${halHeader}>

int main(void) {
    /* TODO: initialize clock, GPIO and peripherals for ${chip.name}. */
    for (;;) {
        /* TODO: add application logic. */
    }
}
`;
  const header = `#ifndef PROJECT_CONFIG_H\n#define PROJECT_CONFIG_H\n\n#define PROJECT_NAME "${projectName}"\n#define TARGET_CHIP "${chip.name}"\n#define TARGET_CORE "${chip.cores}"\n\n#endif\n`;
  const makefile = `TARGET := ${projectName.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase()}\nBUILD_DIR := Build\nCC := arm-none-eabi-gcc\nCFLAGS := -mcpu=${chip.cores.toLowerCase().includes("m0") ? "cortex-m0" : chip.cores.toLowerCase().includes("m7") ? "cortex-m7" : "cortex-m3"} -mthumb -Wall -Wextra -IInc\n\nall: $(BUILD_DIR)/$(TARGET).elf\n\n$(BUILD_DIR):\n\tmkdir -p $(BUILD_DIR)\n\n$(BUILD_DIR)/main.o: Src/main.c | $(BUILD_DIR)\n\t$(CC) $(CFLAGS) -c $< -o $@\n\n$(BUILD_DIR)/$(TARGET).elf: $(BUILD_DIR)/main.o\n\t$(CC) $(CFLAGS) $^ -o $@\n\nclean:\n\trm -rf $(BUILD_DIR)\n\n.PHONY: all clean\n`;
  const readme = `# ${projectName}\n\n- Target: ${chip.name}\n- Core: ${chip.cores}\n- Frequency: ${chip.frequency}\n- Flash / RAM: ${chip.flash} / ${chip.ram}\n\n## Build\n\nThis browser project is a source scaffold. Install the vendor SDK and ARM GNU Toolchain before running Make.\n\n1. Put vendor startup files and linker script in the project.\n2. Complete clock and peripheral initialization in \`Src/main.c\`.\n3. Run \`make\` to build the firmware.\n`;
  return [
    { name: "main.c", path: "/Src/main.c", content: source, language: "c" },
    {
      name: "project_config.h",
      path: "/Inc/project_config.h",
      content: header,
      language: "h",
    },
    {
      name: "Makefile",
      path: "/Makefile",
      content: makefile,
      language: "makefile",
    },
    {
      name: "README.md",
      path: "/README.md",
      content: readme,
      language: "text",
    },
  ];
}

function stripCCommentsAndStrings(value: string) {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\r\n]*/g, "")
    .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, "");
}

function inspectProject(files: FileNode[], chipName: string): CompileResult {
  const sourceFiles = files.filter((file) => /\.(c|cpp)$/i.test(file.name));
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!sourceFiles.length) errors.push("未找到 .c 或 .cpp 源文件");
  if (
    !files.some(
      (file) => file.name === "Makefile" || file.name === "CMakeLists.txt",
    )
  )
    warnings.push("未找到 Makefile 或 CMakeLists.txt");
  for (const file of sourceFiles) {
    const code = stripCCommentsAndStrings(file.content);
    const open = (code.match(/{/g) || []).length;
    const close = (code.match(/}/g) || []).length;
    if (open !== close) errors.push(`${file.path}：大括号数量不匹配`);
  }
  if (
    sourceFiles.length &&
    !sourceFiles.some((file) =>
      /\bmain\s*\(/.test(stripCCommentsAndStrings(file.content)),
    )
  )
    warnings.push("未检测到 main() 入口函数");
  const findings = analyzeProjectRisks(files);
  warnings.push(
    `目标芯片：${chipName}；当前仅进行本地结构检查，未调用 ARM GCC、Keil 或 IAR`,
  );
  warnings.push("请使用厂商工具或实际工具链完成最终编译、链接、下载和硬件验证");
  const output = [
    "EmbedKit 工程检查（参考模式）",
    `检查文件：${files.length} 个，源文件：${sourceFiles.length} 个`,
    errors.length
      ? `错误：\n${errors.map((item) => `  ✗ ${item}`).join("\n")}`
      : "错误：无",
    warnings.length
      ? `提示：\n${warnings.map((item) => `  ! ${item}`).join("\n")}`
      : "",
    findings.length
      ? `静态风险：\n${findings.map((item) => `  ${item.severity === "high" ? "✗" : item.severity === "medium" ? "!" : "·"} [${item.severity.toUpperCase()}] ${item.title} · ${item.file}${item.line ? `:${item.line}` : ""}\n    ${item.recommendation}`).join("\n")}`
      : "静态风险：未命中当前规则",
    errors.length
      ? "检查未通过，请先修正错误。"
      : "基础结构检查通过；这不代表已完成真实编译。",
  ]
    .filter(Boolean)
    .join("\n");
  return {
    success: errors.length === 0,
    output,
    size: files.reduce((total, file) => total + file.content.length, 0),
  };
}

interface ProjectSummary {
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
  buildKind: 'keil' | 'iar' | 'cmake' | 'esp-idf' | 'zephyr' | 'platformio' | 'make' | 'ninja' | 'unknown';
  buildConfidence: 'high' | 'medium' | 'low';
  buildEvidence: string[];
  agentBuildSystem?: 'cmake' | 'make' | 'ninja';
}

interface ProjectFinding {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  file: string;
  line: number;
  evidence: string;
  recommendation: string;
}

function detectProjectBuild(files: FileNode[]) {
  const names = files.map(file => file.name.toLowerCase()), paths = files.map(file => file.path.replace(/\\/g, '/').toLowerCase()), content = files.map(file => file.content).join('\n');
  const candidates: Array<{ kind: ProjectSummary['buildKind']; label: string; score: number; evidence: string[]; agentBuildSystem?: ProjectSummary['agentBuildSystem'] }> = [];
  const add = (kind: ProjectSummary['buildKind'], label: string, score: number, evidence: string[], agentBuildSystem?: ProjectSummary['agentBuildSystem']) => { if (score > 0) candidates.push({ kind, label, score, evidence, agentBuildSystem }); };
  const keilProject = files.find(file => /\.(uvprojx|uvproj)$/i.test(file.name)), iarProject = files.find(file => /\.(ewp|eww)$/i.test(file.name));
  add('keil', 'Keil MDK', keilProject ? 100 : 0, keilProject ? [`发现 Keil 工程文件 ${keilProject.path}`, ...(files.some(file => /\.sct$/i.test(file.name)) ? ['发现 Scatter 链接脚本'] : []), ...(paths.some(path => path.includes('/rte/')) ? ['发现 RTE/Pack 配置目录'] : [])] : []);
  add('iar', 'IAR Embedded Workbench', iarProject ? 100 : 0, iarProject ? [`发现 IAR 工程文件 ${iarProject.path}`, ...(files.some(file => /\.icf$/i.test(file.name)) ? ['发现 ICF 链接配置'] : [])] : []);
  const hasCmake = names.includes('cmakelists.txt'), hasIdfRegister = /idf_component_register\s*\(/i.test(content), hasIdfProject = /IDF_PATH|project\.cmake|idf\.cmake/i.test(content), hasSdkconfig = names.some(name => name === 'sdkconfig' || name.startsWith('sdkconfig.'));
  add('esp-idf', 'ESP-IDF / CMake', hasCmake && (hasIdfRegister || hasIdfProject || hasSdkconfig) ? 120 : 0, [hasCmake && '发现 CMakeLists.txt', hasIdfRegister && '使用 idf_component_register', hasIdfProject && '引用 ESP-IDF 构建脚本', hasSdkconfig && '发现 sdkconfig'].filter(Boolean) as string[]);
  const hasWest = names.includes('west.yml'), hasPrjConf = names.includes('prj.conf'), hasKconfig = names.includes('kconfig'), hasDts = files.some(file => /\.(dts|dtsi|overlay)$/i.test(file.name));
  add('zephyr', hasWest ? 'nRF Connect / Zephyr' : 'Zephyr', (hasWest ? 70 : 0) + (hasPrjConf ? 50 : 0) + (hasKconfig ? 25 : 0) + (hasDts ? 15 : 0) + (hasPrjConf && hasCmake ? 30 : 0), [hasWest && '发现 west.yml', hasPrjConf && '发现 prj.conf', hasKconfig && '发现 Kconfig', hasDts && '发现设备树文件'].filter(Boolean) as string[]);
  const hasPlatformio = names.includes('platformio.ini');
  add('platformio', 'PlatformIO', hasPlatformio ? 100 : 0, hasPlatformio ? ['发现 platformio.ini'] : []);
  add('cmake', 'CMake', hasCmake ? 70 : 0, hasCmake ? ['发现 CMakeLists.txt', ...(names.includes('cmakepresets.json') ? ['发现 CMakePresets.json'] : []), ...(files.some(file => /toolchain.*\.cmake$/i.test(file.name)) ? ['发现 CMake 工具链文件'] : [])] : [], 'cmake');
  const hasMake = names.includes('makefile') || files.some(file => /\.mk$/i.test(file.name));
  add('make', 'Make', hasMake ? 60 : 0, hasMake ? [names.includes('makefile') ? '发现 Makefile' : '发现 .mk 构建文件'] : [], 'make');
  const hasNinja = names.includes('build.ninja');
  add('ninja', 'Ninja（已有构建目录）', hasNinja ? 30 : 0, hasNinja ? ['发现 build.ninja；它通常是生成产物，不一定是主工程配置'] : [], 'ninja');
  const best = candidates.sort((a, b) => b.score - a.score)[0];
  if (!best) return { kind: 'unknown' as const, label: '未识别', confidence: 'low' as const, evidence: ['未发现受支持的工程配置文件'], agentBuildSystem: undefined };
  return { kind: best.kind, label: best.label, confidence: (best.score >= 90 ? 'high' : best.score >= 60 ? 'medium' : 'low') as ProjectSummary['buildConfidence'], evidence: best.evidence, agentBuildSystem: best.agentBuildSystem };
}

function analyzeProjectRisks(files: FileNode[]): ProjectFinding[] {
  const findings: ProjectFinding[] = [];
  const add = (
    severity: ProjectFinding["severity"],
    title: string,
    file: FileNode,
    line: number,
    evidence: string,
    recommendation: string,
  ) =>
    findings.push({
      id: `${file.path}:${line}:${title}`,
      severity,
      title,
      file: file.path,
      line,
      evidence: evidence.trim().slice(0, 180),
      recommendation,
    });
  for (const file of files.filter((item) =>
    /\.(c|cc|cpp|h|hpp)$/i.test(item.name),
  )) {
    const lines = file.content.split(/\r?\n/);
    lines.forEach((source, index) => {
      const line = index + 1;
      if (/\b(gets|strcpy|strcat|sprintf)\s*\(/.test(source))
        add(
          "high",
          "使用无边界字符串函数",
          file,
          line,
          source,
          "改用带容量限制的接口，并检查截断和结尾字符。",
        );
      if (
        /\b(password|passwd|secret|token|api[_-]?key)\b\s*=\s*["'][^"']+["']/i.test(
          source,
        )
      )
        add(
          "high",
          "疑似硬编码凭据",
          file,
          line,
          source,
          "将凭据移出源码，使用安全存储或生产注入机制。",
        );
      if (/\b(malloc|calloc|realloc|free)\s*\(/.test(source))
        add(
          "medium",
          "运行期动态内存",
          file,
          line,
          source,
          "确认碎片、失败路径和并发安全；实时任务优先考虑静态内存池。",
        );
      if (
        /\b(HAL_Delay|sleep|usleep|vTaskDelay)\s*\(/.test(source) &&
        /(?:IRQHandler|Callback|_ISR|\bisr\b)/i.test(
          lines.slice(Math.max(0, index - 20), index + 1).join("\n"),
        )
      )
        add(
          "high",
          "中断或回调上下文中存在阻塞调用",
          file,
          line,
          source,
          "中断中只记录事件，把延时和业务处理移到任务或主循环。",
        );
      if (/\b(TODO|FIXME|HACK)\b/i.test(source))
        add(
          "low",
          "存在未完成标记",
          file,
          line,
          source,
          "发布前确认该标记是否影响功能、安全或量产配置。",
        );
      if (
        /\bprintf\s*\(/.test(source) &&
        /(?:IRQHandler|Callback|_ISR|\bisr\b)/i.test(
          lines.slice(Math.max(0, index - 20), index + 1).join("\n"),
        )
      )
        add(
          "medium",
          "中断或回调中输出日志",
          file,
          line,
          source,
          "改用无阻塞环形缓冲，在低优先级任务中输出。",
        );
    });
  }
  const sources = files.filter((item) => /\.(c|cc|cpp)$/i.test(item.name));
  if (
    sources.length &&
    !sources.some((file) =>
      /\bmain\s*\(/.test(stripCCommentsAndStrings(file.content)),
    )
  )
    findings.push({
      id: "project:no-main",
      severity: "high",
      title: "未识别到程序入口",
      file: "/",
      line: 0,
      evidence: "所有已导入源文件中均未发现 main()",
      recommendation:
        "确认是否漏选入口文件，或检查工程是否使用非标准启动框架。",
    });
  if (
    !files.some(
      (file) =>
        file.name === "Makefile" ||
        file.name === "CMakeLists.txt" ||
        ["platformio.ini", "Kconfig", "prj.conf", "sdkconfig", "SConstruct"].includes(file.name) ||
        /\.(uvprojx|ewp)$/i.test(file.name),
    )
  )
    findings.push({
      id: "project:no-build",
      severity: "medium",
      title: "未导入构建配置",
      file: "/",
      line: 0,
      evidence: "未发现 Makefile、CMakeLists.txt、Keil 或 IAR 工程文件",
      recommendation:
        "导入完整工程目录，以便确认宏定义、包含路径、链接脚本和目标芯片。",
    });
  const rank = { high: 0, medium: 1, low: 2 } as const;
  return findings.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

function summarizeProject(files: FileNode[]): ProjectSummary {
  const content = files
    .map((file) => `${file.name}\n${file.content}`)
    .join("\n");
  const modelPattern =
    /\b(?:STM32[A-Z0-9]+|ESP32(?:-[A-Z0-9]+)*|nRF\d+[A-Z0-9]*|LPC\d+[A-Z0-9]*|GD32[A-Z0-9]+|CH32[A-Z0-9]+|ATmega\w+|ATSAMD\w+|PIC\d+[A-Z0-9]*|RP20\w+|MIMXRT\w+|MK\d+[A-Z0-9]*)\b/gi;
  const candidates = [...content.matchAll(modelPattern)].map(
    (match) => match[0],
  );
  const counts = candidates.reduce<Record<string, number>>((all, item) => {
    const key = item.toUpperCase();
    all[key] = (all[key] || 0) + 1;
    return all;
  }, {});
  const chip =
    Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
    "未识别（可手动确认）";
  const detectedBuild = detectProjectBuild(files), toolchain = detectedBuild.label;
  const sdk = /esp-idf|freertos|zephyr|stm32cube|hal_|cmsis|rt-thread|threadx|mbed os/i.test(content)
    ? content.match(/esp-idf|FreeRTOS|Zephyr|STM32Cube|CMSIS|RT-Thread|ThreadX|Mbed OS/i)?.[0] ||
      "SDK/框架"
    : "未识别";
  const peripheralNames = [
    "UART",
    "USART",
    "SPI",
    "I2C",
    "CAN",
    "USB",
    "ADC",
    "DAC",
    "DMA",
    "GPIO",
    "TIM",
    "Ethernet",
    "BLE",
    "Wi-Fi",
  ];
  const sourceFiles = files.filter((file) => /\.(c|cc|cpp)$/i.test(file.name)),
    headerFiles = files.filter((file) => /\.(h|hpp)$/i.test(file.name));
  return {
    chip,
    toolchain,
    sdk,
    projectType: detectedBuild.kind === 'keil' || detectedBuild.kind === 'iar' ? "厂商 IDE 工程" : detectedBuild.kind === 'unknown' ? 'C/C++ 源码' : `${detectedBuild.label} 工程`,
    peripherals: peripheralNames.filter((name) =>
      new RegExp(`\\b${name}\\b`, "i").test(content),
    ),
    files: files.length,
    sourceFiles: sourceFiles.length,
    headerFiles: headerFiles.length,
    totalLines: files.reduce(
      (total, file) => total + file.content.split(/\r?\n/).length,
      0,
    ),
    entryPoints: sourceFiles
      .filter((file) =>
        /\bmain\s*\(/.test(stripCCommentsAndStrings(file.content)),
      )
      .map((file) => file.path),
    buildFiles: files
      .filter(
        (file) =>
          file.name === "Makefile" ||
          file.name === "CMakeLists.txt" ||
          file.name === "CMakePresets.json" ||
          ["platformio.ini", "Kconfig", "prj.conf", "sdkconfig", "SConstruct"].includes(file.name) ||
          /\.(uvprojx|uvoptx|ewp|eww|sct|icf|ld|ioc)$/i.test(file.name),
      )
      .map((file) => file.path),
    findings: analyzeProjectRisks(files),
    buildKind: detectedBuild.kind,
    buildConfidence: detectedBuild.confidence,
    buildEvidence: detectedBuild.evidence,
    agentBuildSystem: detectedBuild.agentBuildSystem,
  };
}

function FileTree({
  files,
  activeFile,
  onFileSelect,
  onAddFile,
  onDeleteFile,
}: {
  files: FileNode[];
  activeFile: string;
  onFileSelect: (path: string) => void;
  onAddFile: () => void;
  onDeleteFile: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "/Inc": true,
    "/Src": true,
  });

  const grouped: Record<string, FileNode[]> = {};
  files.forEach((f) => {
    const dir = f.path.substring(0, f.path.lastIndexOf("/")) || "/";
    if (!grouped[dir]) grouped[dir] = [];
    grouped[dir].push(f);
  });

  const toggleDir = (dir: string) => {
    setExpanded((prev) => ({ ...prev, [dir]: !prev[dir] }));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#30363d]">
        <span className="text-xs font-semibold text-gray-400 uppercase">
          Explorer
        </span>
        <button
          onClick={onAddFile}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin py-2">
        {Object.entries(grouped).map(([dir, dirFiles]) => (
          <div key={dir}>
            {dir !== "/" && (
              <button
                onClick={() => toggleDir(dir)}
                className="w-full flex items-center gap-1 px-3 py-1 text-sm text-gray-300 hover:bg-[#1c2128] rounded"
              >
                {expanded[dir] ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )}
                <FolderOpen size={14} className="text-blue-400" />
                <span className="truncate">
                  {dir === "/Inc" ? "Inc" : dir === "/Src" ? "Src" : dir}
                </span>
              </button>
            )}
            {expanded[dir] &&
              dirFiles.map((f) => (
                <div
                  key={f.path}
                  className={`group flex items-center gap-2 px-3 py-1 text-sm cursor-pointer rounded mr-2
                    ${f.path === activeFile ? "bg-blue-500/20 text-blue-300" : "text-gray-400 hover:text-white hover:bg-[#1c2128]"}`}
                  onClick={() => onFileSelect(f.path)}
                >
                  <FileCode
                    size={14}
                    className={
                      f.name.endsWith(".c")
                        ? "text-blue-400"
                        : f.name.endsWith(".h")
                          ? "text-purple-400"
                          : "text-gray-500"
                    }
                  />
                  <span className="truncate flex-1">{f.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteFile(f.path);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function OutputPanel({ result }: { result: CompileResult | null }) {
  if (!result) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 text-sm">
        点击“检查代码”进行本地工程结构检查
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div
        className={`px-3 py-2 border-b border-[#30363d] text-sm font-medium ${result.success ? "text-green-400" : "text-red-400"}`}
      >
        {result.success ? "结构检查通过（非真实编译）" : "结构检查发现问题"}
        {result.size && ` · ${result.size} bytes`}
      </div>
      <pre className="flex-1 p-3 text-xs font-mono text-gray-300 overflow-auto scrollbar-thin whitespace-pre-wrap">
        {result.output}
      </pre>
    </div>
  );
}

function ChipGuide({ chip }: { chip: Chip }) {
  const useCases = chip.peripherals
    .filter((item) =>
      [
        "USART",
        "UART",
        "SPI",
        "I2C",
        "CAN",
        "USB",
        "ETH",
        "ADC",
        "DAC",
        "TIM",
      ].includes(item),
    )
    .slice(0, 6);
  const familyQuery = encodeURIComponent(
    `${chip.name} ${chip.series} reference manual`,
  );
  return (
    <div className="flex-1 overflow-y-auto border-b border-[#30363d] p-4 scrollbar-thin">
      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-wider text-blue-400">
          嵌入式工程助手
        </p>
        <h2 className="mt-1 text-lg font-semibold text-white">目标环境资料</h2>
        <p className="mt-1 text-xs text-gray-500">
          {chip.manufacturer} · {chip.series}
        </p>
      </div>
      <div className="mb-4 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
        <h3 className="text-xs font-semibold text-blue-300">目标环境概览</h3>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <span className="text-gray-500">
            内核 <b className="ml-1 text-gray-200">{chip.cores}</b>
          </span>
          <span className="text-gray-500">
            主频 <b className="ml-1 text-gray-200">{chip.frequency}</b>
          </span>
          <span className="text-gray-500">
            Flash <b className="ml-1 text-gray-200">{chip.flash}</b>
          </span>
          <span className="text-gray-500">
            RAM <b className="ml-1 text-gray-200">{chip.ram}</b>
          </span>
        </div>
      </div>
      <div className="mb-4">
        <h3 className="mb-2 flex items-center gap-1 text-xs font-semibold text-gray-300">
          <BookOpen size={13} className="text-green-400" />
          官方资料
        </h3>
        <div className="space-y-2">
          {chip.datasheetUrl && (
            <a
              href={chip.datasheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-md bg-[#161b22] px-3 py-2 text-xs text-gray-300 hover:text-blue-300"
            >
              数据手册
              <ExternalLink size={12} />
            </a>
          )}
          <a
            href={`https://cn.bing.com/search?q=${familyQuery}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-md bg-[#161b22] px-3 py-2 text-xs text-gray-300 hover:text-blue-300"
          >
            参考手册与应用笔记
            <ExternalLink size={12} />
          </a>
        </div>
      </div>
      <div className="mb-4">
        <h3 className="mb-2 text-xs font-semibold text-gray-300">
          可关注的外设
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {useCases.map((item) => (
            <span
              key={item}
              className="rounded bg-[#161b22] px-2 py-1 text-[10px] text-gray-400"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 text-[11px] leading-5 text-gray-500">
        <b className="text-yellow-300">集成流程</b>
        <br />
        1. 用官方工具确认芯片、封装、时钟和引脚。
        <br />
        2. 在此编辑或复制参考代码。
        <br />
        3. 放入 Keil、IAR、CubeMX 或厂商 SDK 工程。
        <br />
        4. 使用真实工具链编译并在硬件上验证。
        <br />
        <span className="text-yellow-200/70">
          本页面不会替代厂商工程生成器。
        </span>
      </div>
    </div>
  );
}

void ChipGuide;

function ProjectSummaryPanel({ summary, onFindingSelect }: { summary: ProjectSummary; onFindingSelect: (finding: ProjectFinding) => void }) {
  return (
    <div className="max-h-[420px] overflow-y-auto border-b border-[#30363d] bg-purple-500/[0.03] p-4 scrollbar-thin">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-purple-300">导入工程摘要</h3>
        <span className="text-[10px] text-gray-600">
          {summary.files} 个文件
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <span className="text-gray-500">
          芯片 <b className="ml-1 text-gray-200">{summary.chip}</b>
        </span>
        <span className="text-gray-500">
          工具链 <b className="ml-1 text-gray-200">{summary.toolchain}</b>
        </span>
        <span className="text-gray-500">
          SDK <b className="ml-1 text-gray-200">{summary.sdk}</b>
        </span>
        <span className="text-gray-500">
          类型 <b className="ml-1 text-gray-200">{summary.projectType}</b>
        </span>
      </div>
      <div className="mt-3 rounded border border-blue-500/20 bg-blue-500/5 p-2"><div className="flex items-center justify-between"><b className="text-[10px] text-blue-300">自动识别：{summary.toolchain}</b><span className={`text-[8px] uppercase ${summary.buildConfidence === "high" ? "text-green-400" : summary.buildConfidence === "medium" ? "text-yellow-400" : "text-gray-500"}`}>{summary.buildConfidence} confidence</span></div><ul className="mt-1 space-y-0.5 text-[9px] text-gray-500">{summary.buildEvidence.map(item => <li key={item}>• {item}</li>)}</ul></div>
      <div className="mt-3 grid grid-cols-3 gap-1.5 text-center text-[10px]">
        <span className="rounded bg-[#161b22] p-1.5 text-gray-500"><b className="block text-gray-200">{summary.sourceFiles}</b>源文件</span>
        <span className="rounded bg-[#161b22] p-1.5 text-gray-500"><b className="block text-gray-200">{summary.headerFiles}</b>头文件</span>
        <span className="rounded bg-[#161b22] p-1.5 text-gray-500"><b className="block text-gray-200">{summary.totalLines}</b>代码行</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {(summary.peripherals.length
          ? summary.peripherals
          : ["未识别外设"]
        ).map((item) => (
          <span
            key={item}
            className="rounded bg-[#161b22] px-2 py-1 text-[10px] text-gray-400"
          >
            {item}
          </span>
        ))}
      </div>
      <div className="mt-3 border-t border-[#30363d] pt-3">
        <div className="mb-2 flex items-center justify-between"><b className="text-[11px] text-gray-300">本地静态风险</b><span className={`text-[10px] ${summary.findings.some(item => item.severity === "high") ? "text-red-400" : summary.findings.length ? "text-yellow-400" : "text-green-400"}`}>{summary.findings.length ? `${summary.findings.length} 项` : "未命中规则"}</span></div>
        <div className="space-y-1.5">{summary.findings.slice(0, 8).map(item => <button type="button" key={item.id} onClick={() => onFindingSelect(item)} disabled={!item.line || item.file === "/"} title={item.line && item.file !== "/" ? `打开 ${item.file}:${item.line}` : "这是工程级问题，没有可跳转的源码位置"} className={`block w-full rounded border p-2 text-left transition-colors disabled:cursor-default ${item.severity === "high" ? "border-red-500/20 bg-red-500/5 enabled:hover:border-red-400/60" : item.severity === "medium" ? "border-yellow-500/20 bg-yellow-500/5 enabled:hover:border-yellow-400/60" : "border-[#30363d] bg-[#161b22] enabled:hover:border-blue-400/50"}`}><div className="flex items-center justify-between gap-2"><b className={`text-[10px] ${item.severity === "high" ? "text-red-300" : item.severity === "medium" ? "text-yellow-300" : "text-gray-300"}`}>{item.title}</b><span className="shrink-0 text-[8px] uppercase text-gray-600">{item.severity}</span></div><p className="mt-1 truncate font-mono text-[8px] text-gray-600" title={item.evidence}>{item.file}{item.line ? `:${item.line}` : ""} · {item.evidence}</p><p className="mt-1 text-[9px] leading-4 text-gray-500">{item.recommendation}</p>{item.line > 0 && item.file !== "/" && <span className="mt-1 block text-[9px] text-blue-400">点击定位到源码 →</span>}</button>)}</div>
        {summary.findings.length > 8 && <p className="mt-2 text-[9px] text-gray-600">其余 {summary.findings.length - 8} 项请在“检查代码”结果或导出报告中查看。</p>}
      </div>
    </div>
  );
}

function AiReportPanel({
  report,
  analyzing,
}: {
  report: string;
  analyzing: boolean;
}) {
  if (!report && !analyzing) return null;
  return (
    <div className="max-h-72 shrink-0 overflow-y-auto border-b border-[#30363d] bg-purple-500/[0.04] p-4 scrollbar-thin">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-purple-300">
        <Sparkles size={13} />
        AI 工程分析
        {analyzing && (
          <span className="text-[10px] text-gray-500">分析中…</span>
        )}
      </div>
      <pre className="whitespace-pre-wrap text-[11px] leading-5 text-gray-300">
        {report || "正在整理工程摘要和关键代码片段…"}
      </pre>
    </div>
  );
}

function ProjectLanding({
  onImport,
  error,
}: {
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
  error: string;
}) {
  return (
    <div className="flex h-full items-center justify-center bg-[#0d1117] p-6">
      <div className="w-full max-w-2xl rounded-2xl border border-[#30363d] bg-[#161b22] p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-400">
          <Upload size={26} />
        </div>
        <h1 className="text-2xl font-semibold text-white">
          导入真实工程开始分析
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-gray-400">
          这里不生成与芯片无关的通用工程。请导入已有的嵌入式工程，系统会识别芯片、工具链、SDK、文件结构和常见外设。
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500">
            <Upload size={16} />
            选择工程文件
            <input
              type="file"
              multiple
              className="hidden"
              onChange={onImport}
            />
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#30363d] bg-[#0d1117] px-5 py-2.5 text-sm font-medium text-gray-300 hover:border-blue-500/50 hover:text-white">
            <FolderOpen size={16} />
            选择工程目录
            <input
              type="file"
              multiple
              className="hidden"
              onClick={(event) => {
                (
                  event.currentTarget as HTMLInputElement & {
                    webkitdirectory?: boolean;
                  }
                ).webkitdirectory = true;
              }}
              onChange={onImport}
            />
          </label>
        </div>
        {error && (
          <p className="mx-auto mt-3 max-w-md rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        )}
        <div className="mt-6 grid gap-3 text-left sm:grid-cols-3">
          <div className="rounded-lg bg-[#0d1117] p-3">
            <b className="text-xs text-gray-200">支持导入</b>
            <p className="mt-1 text-[11px] leading-5 text-gray-500">
              C/C++、头文件、Makefile、CMake、Keil、IAR
            </p>
          </div>
          <div className="rounded-lg bg-[#0d1117] p-3">
            <b className="text-xs text-gray-200">自动识别</b>
            <p className="mt-1 text-[11px] leading-5 text-gray-500">
              芯片、SDK、工具链、工程类型和外设
            </p>
          </div>
          <div className="rounded-lg bg-[#0d1117] p-3">
            <b className="text-xs text-gray-200">分析结果</b>
            <p className="mt-1 text-[11px] leading-5 text-gray-500">
              工程摘要、代码结构和官方资料入口
            </p>
          </div>
        </div>
        <p className="mt-5 text-[11px] text-gray-600">
          当前阶段不会执行真实编译，也不会替代厂商 IDE。
        </p>
      </div>
    </div>
  );
}

export default function EditorPage() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<FileNode[]>(() =>
    defaultFiles.length
      ? createProjectFiles(
          { ...chips[0], name: "未指定目标芯片", series: "generic" },
          "embedkit_project",
        )
      : defaultFiles,
  );
  const [activeFile, setActiveFile] = useState("/Src/main.c");
  const [selectedChip, setSelectedChip] = useState<Chip>(chips[0]);
  const [projectName, setProjectName] = useState("embedkit_project");
  const [compileResult, setCompileResult] = useState<CompileResult | null>(
    null,
  );
  const [isCompiling, setIsCompiling] = useState(false);
  const [showOutput, setShowOutput] = useState(true);
  const [activeToolPanel, setActiveToolPanel] = useState<'architecture' | 'map' | 'build' | null>(null);
  const [runtimeTrace, setRuntimeTrace] = useState<RuntimeTraceAnalysis | null>(null);
  const [selectedMapPath, setSelectedMapPath] = useState("");
  const [projectLoaded, setProjectLoaded] = useState(false);
  const [importError, setImportError] = useState("");
  const [aiReport, setAiReport] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const projectSummary = useMemo(
    () => (projectLoaded ? summarizeProject(files) : null),
    [files, projectLoaded],
  );
  const mapFiles = useMemo(() => files.filter(file => /\.map$/i.test(file.name)).sort((a, b) => (b.lastModified ?? 0) - (a.lastModified ?? 0)), [files]);
  const mapOptions = useMemo(() => mapFiles.map(file => ({ file, analysis: analyzeMap(file.content) })), [mapFiles]);
  const projectArchitecture = useMemo(() => projectLoaded ? analyzeProjectArchitecture(files) : null, [files, projectLoaded]);
  const programBehavior = useMemo(() => projectLoaded ? analyzeProgramBehavior(files) : null, [files, projectLoaded]);
  const selectedMap = mapOptions.find(item => item.file.path === selectedMapPath) ?? mapOptions[0];
  const mapFile = selectedMap?.file, mapAnalysis = selectedMap?.analysis;

  useEffect(() => {
    if (!activeToolPanel) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setActiveToolPanel(null); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [activeToolPanel]);

  useEffect(() => {
    if (!projectLoaded) return;
    let cancelled = false;
    void loadRuntimeTrace(projectName).then(trace => { if (!cancelled) setRuntimeTrace(trace); }).catch(() => { /* IndexedDB may be unavailable. */ });
    return () => { cancelled = true; };
  }, [projectLoaded, projectName]);

  const handleRuntimeTraceChange = useCallback((trace: RuntimeTraceAnalysis | null) => {
    setRuntimeTrace(trace);
    if (trace) void saveRuntimeTrace(projectName, trace).catch(() => { /* Keep the in-memory trace when persistence is unavailable. */ });
    else void clearRuntimeTrace(projectName).catch(() => { /* The visible state is already cleared. */ });
  }, [projectName]);

  useEffect(() => {
    let cancelled = false;
    void loadCurrentWorkspace()
      .then((workspace) => {
        if (cancelled || !workspace?.files.length) return;
        setFiles(workspace.files);
        setActiveFile(
          workspace.files.some((file) => file.path === workspace.activeFile)
            ? workspace.activeFile
            : workspace.files[0].path,
        );
        setProjectName(workspace.name);
        setProjectLoaded(true);
      })
      .catch(() => {
        /* IndexedDB may be disabled in a private browser context. */
      })
      .finally(() => {
        if (!cancelled) setWorkspaceReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!workspaceReady || !projectSummary) return;
    const timer = window.setTimeout(() => {
      void saveCurrentWorkspace({ name: projectName, files, activeFile });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [activeFile, files, projectName, projectSummary, workspaceReady]);

  const activeContent = files.find((f) => f.path === activeFile)?.content || "";
  const handleEditorMount: OnMount = (editor) => { editorRef.current = editor; };
  const handleFindingSelect = useCallback((finding: ProjectFinding) => {
    if (!finding.line || finding.file === "/") return;
    setActiveFile(finding.file);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const editor = editorRef.current, lineNumber = Math.min(finding.line, editor?.getModel()?.getLineCount() ?? finding.line);
      if (!editor) return;
      editor.revealLineInCenter(lineNumber);
      editor.setPosition({ lineNumber, column: 1 });
      editor.focus();
    }));
  }, []);
  const handleBuildDiagnostic = useCallback(
    (diagnostic: { file: string; line: number }) => {
      const normalized = diagnostic.file.replace(/\\/g, "/").toLowerCase();
      const target = files.find((file) => {
        const path = file.path.replace(/\\/g, "/").toLowerCase();
        return normalized.endsWith(path.replace(/^\//, "")) || path.endsWith(normalized.replace(/^\//, ""));
      });
      if (target) handleFindingSelect({ id: `build:${target.path}:${diagnostic.line}`, severity: "high", title: "编译诊断", file: target.path, line: diagnostic.line, evidence: "", recommendation: "" });
    },
    [files, handleFindingSelect],
  );
  const handleMapModuleSelect = useCallback((module: string) => {
    const normalized = module.replace(/\\/g, "/"), nested = normalized.match(/\(([^()]+\.(?:o|obj))\)/i)?.[1], objectName = (nested || normalized.split('/').pop() || normalized).replace(/\.(?:o|obj)$/i, '').toLowerCase();
    const target = files.find(file => /\.(c|cc|cpp|s|S)$/i.test(file.name) && file.name.replace(/\.[^.]+$/, '').toLowerCase() === objectName);
    if (target) handleFindingSelect({ id: `map:${target.path}`, severity: 'low', title: 'MAP 模块', file: target.path, line: 1, evidence: module, recommendation: '' });
  }, [files, handleFindingSelect]);

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined) {
        setFiles((prev) =>
          prev.map((f) =>
            f.path === activeFile ? { ...f, content: value } : f,
          ),
        );
      }
    },
    [activeFile],
  );

  const handleAddFile = () => {
    const name = prompt("File name:");
    if (name) {
      const ext = name.split(".").pop() || "c";
      const lang: FileNode["language"] =
        ext === "h"
          ? "h"
          : ext === "cpp"
            ? "cpp"
            : ext === "toml"
              ? "toml"
              : "c";
      const newFile: FileNode = {
        name,
        path: `/${name}`,
        content: "",
        language: lang,
      };
      setFiles((prev) => [...prev, newFile]);
      setActiveFile(newFile.path);
    }
  };

  const handleImportFiles = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const raw = Array.from(event.target.files ?? []);
    if (raw.some((file) => /\.zip$/i.test(file.name))) {
      setImportError(
        "暂不支持直接解析 ZIP。请解压后选择工程目录，或多选工程文件。",
      );
      event.target.value = "";
      return;
    }
    const selected = raw.filter(
      (file) =>
        /\.(c|cc|cpp|h|hpp|s|S|ld|sct|icf|ioc|uvprojx|uvoptx|ewp|eww|mk|txt|md|map|hex|cmake|json|yml|yaml|toml|ini|conf|config|dts|dtsi|overlay|py)$/i.test(
          file.name,
        ) ||
        file.name === "Makefile" ||
        file.name === "CMakeLists.txt" ||
        ["Kconfig", "sdkconfig", "SConstruct"].includes(file.name),
    );
    if (!selected.length) {
      setImportError(
        "没有找到可分析的工程文件，请选择 C/C++、Makefile、CMake、Keil 或 IAR 文件。",
      );
      event.target.value = "";
      return;
    }
    if (selected.some((file) => file.size > (/\.map$/i.test(file.name) ? 20 : 2) * 1024 * 1024)) {
      setImportError("源码和配置文件单个不能超过 2 MB，MAP 文件不能超过 20 MB。");
      event.target.value = "";
      return;
    }
    if (
      selected.reduce((total, file) => total + file.size, 0) >
      50 * 1024 * 1024
    ) {
      setImportError("可分析文件总大小不能超过 50 MB。");
      event.target.value = "";
      return;
    }
    const imported = await Promise.all(
      selected.map(async (file) => {
        const ext = file.name.split(".").pop()?.toLowerCase() || "text";
        const language: FileNode["language"] =
          ext === "h" || ext === "hpp"
            ? "h"
            : ext === "cpp" || ext === "cc"
              ? "cpp"
              : ext === "c"
                ? "c"
                : ext === "cmake" || file.name === "Makefile"
                  ? "makefile"
                  : "text";
        return {
          name: file.name,
          path: `/${file.webkitRelativePath || file.name}`,
          content: await file.text(),
          language,
          size: file.size,
          lastModified: file.lastModified,
        };
      }),
    );
    setFiles(imported);
    setActiveFile(
      imported.find((file) => /\.(c|cpp)$/i.test(file.name))?.path ||
        imported[0].path,
    );
    setProjectName(
      selected[0].webkitRelativePath?.split("/")[0] || "imported_project",
    );
    const summary = summarizeProject(imported);
    setProjectLoaded(true);
    const detectedChip = chips.find((chip) => chip.name.toUpperCase() === summary.chip || summary.chip.includes(chip.name.toUpperCase()));
    if (detectedChip) setSelectedChip(detectedChip);
    setImportError("");
    setAiReport("");
    setCompileResult(null);
    event.target.value = "";
  };

  const handleDeleteFile = (path: string) => {
    setFiles((prev) => prev.filter((f) => f.path !== path));
    if (activeFile === path) {
      setActiveFile(files[0]?.path || "");
    }
  };

  const handleCompile = async () => {
    setIsCompiling(true);
    setTimeout(() => {
      setCompileResult(
        inspectProject(files, projectSummary?.chip || selectedChip.name),
      );
      setIsCompiling(false);
    }, 1500);
  };

  const handleAiAnalyze = async () => {
    if (!projectSummary || analyzing) return;
    let config: AiConfig | null = {
      provider: "local",
      model: "qwen2.5:7b",
      apiKey: "",
      customEndpoint: localProxyUrl(
        "http://localhost:11434/v1/chat/completions",
      ),
    };
    try {
      const saved = loadStoredAiConfig() || config;
      config =
        saved.provider === "huggingface" && !saved.apiKey ? config : saved;
    } catch {
      /* 使用本地默认配置 */
    }
    const provider = config?.provider ? AI_PROVIDERS[config.provider] : null;
    const hasEndpoint =
      config?.provider === "custom"
        ? Boolean(config.customEndpoint)
        : config?.provider === "local"
          ? Boolean(config.customEndpoint || provider?.endpoint)
          : Boolean(provider?.endpoint);
    const hasCredential =
      !provider?.requiresKey || Boolean(config?.apiKey || config?.customApiKey);
    if (
      !config?.provider ||
      !config.model ||
      !provider ||
      !hasEndpoint ||
      !hasCredential
    ) {
      setAiReport(
        "尚未连接真实 AI。请先进入“AI 助手”页面配置可用模型、API 地址和密钥；工程分析不会使用模拟回答。",
      );
      return;
    }
    if (
      config.provider !== "local" &&
      !window.confirm(
        `将向 ${provider.name} 发送工程摘要和最多 50 KB 的源码片段。是否继续？`,
      )
    )
      return;
    const source = files
      .filter((file) => /\.(c|cc|cpp|h|hpp)$/i.test(file.name))
      .map(
        (file) => `\n===== ${file.path} =====\n${file.content.slice(0, 12000)}`,
      )
      .join("\n")
      .slice(0, 50000);
    const prompt = `请分析下面导入的嵌入式工程。只能根据提供的工程事实和代码判断，不要臆测未提供的芯片或 SDK。\n\n工程摘要：${JSON.stringify(projectSummary, null, 2)}\n\n源码片段：${source}\n\n请用中文输出：\n1. 工程实际使用的芯片、工具链、SDK依据\n2. 外设和关键入口的用途\n3. 明确指出至少 3 个风险或待验证项，并引用文件路径\n4. 给出按优先级排序的修改建议\n5. 无法确认的内容标记“需要官方手册或硬件验证”`;
    setAnalyzing(true);
    setAiReport("");
    await streamAiResponse(
      config,
      [{ role: "user", content: prompt }],
      (chunk) => setAiReport((current) => current + chunk),
      () => setAnalyzing(false),
      (error) => {
        setAiReport(`AI 分析失败：${error}`);
        setAnalyzing(false);
      },
    );
  };

  const handleDownload = () => {
    const file = files.find((f) => f.path === activeFile);
    if (file) {
      const blob = new Blob([file.content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleExportAnalysis = () => {
    if (!projectSummary) return;
    const riskRows = projectSummary.findings.length ? projectSummary.findings.map((item, index) => `${index + 1}. **${item.severity.toUpperCase()} · ${item.title}**\n   - 位置：\`${item.file}${item.line ? `:${item.line}` : ""}\`\n   - 证据：\`${item.evidence.replace(/`/g, "'")}\`\n   - 建议：${item.recommendation}`).join("\n") : "未命中当前本地规则。该结果不代表工程不存在其他问题。";
    const architectureRows = projectArchitecture ? projectArchitecture.layers.map(layer => `- **${layer.name}**：${layer.nodes.map(node => `${node.name}（${node.file}:${node.line}）`).join("、") || layer.files.join("、") || "未识别"}`).join("\n") : "未执行程序框架分析。";
    const flowEvidenceRows = projectArchitecture ? `> 注册回调：${projectArchitecture.callbacks.map(item => item.name).join("、") || "未识别"}；静态调用解析率 ${(projectArchitecture.coverage.resolvedRate * 100).toFixed(1)}% （${projectArchitecture.coverage.resolvedCallSites}/${projectArchitecture.coverage.callSites}）。` : "";
    const flowDetails = projectArchitecture?.flows.length ? projectArchitecture.flows.map(flow => `### ${flow.title}\n\n${flow.steps.map(step => `${"  ".repeat(step.depth)}- ${step.name}（${step.control === 'loop' ? '循环内' : step.control === 'branch' ? '条件分支' : step.relation}，${step.file}:${step.line}）`).join("\n")}\n\n${flow.notes.map(note => `> ${note}`).join("\n")}`).join("\n\n") : "未识别到可展开的执行流程。";
    const flowRows = [flowEvidenceRows, flowDetails].filter(Boolean).join("\n\n");
    const stateRows = programBehavior?.stateMachines.length ? programBehavior.stateMachines.map(machine => `### ${machine.name}\n\n- 状态变量：\`${machine.variable}\`\n- 状态：${machine.states.join("、")}\n${machine.transitions.map(item => `- ${item.from} → ${item.to}${item.event ? `，条件：\`${item.event}\`` : ""}（${item.file}:${item.line}）`).join("\n")}`).join("\n\n") : "未识别到状态机。";
    const concurrencyRows = programBehavior ? `- 任务：${programBehavior.tasks.map(item => `${item.name}（入口 ${item.entry || "?"}，栈 ${item.stack || "?"}，优先级 ${item.priority || "?"}）`).join("；") || "未识别"}\n- 同步资源：${programBehavior.resources.map(item => `${item.kind} ${item.name}（写：${item.writers.join("/") || "?"}；读：${item.readers.join("/") || "?"}）`).join("；") || "未识别"}\n- 回调：${programBehavior.callbacks.map(item => `${item.callback} ← ${item.api}`).join("；") || "未识别"}` : "未执行并发分析。";
    const traceRows = runtimeTrace ? `- 事件：${runtimeTrace.events.length}\n- 上下文：${runtimeTrace.contexts.join("、") || "未标记"}\n- 时间跨度：${runtimeTrace.durationMs.toFixed(3)} ms\n\n${runtimeTrace.events.slice(0, 1000).map(item => `- ${item.timestamp.toFixed(3)} · ${item.type} · ${item.name}${item.context ? ` · ${item.context}` : ""}`).join("\n")}${runtimeTrace.events.length > 1000 ? `\n\n> 报告仅列出前1000条，完整轨迹保存在本地工作区。` : ""}` : "尚未导入真实设备运行轨迹。";
    const optimizationRows = mapAnalysis?.optimizations.length ? mapAnalysis.optimizations.map((item, index) => `${index + 1}. **${item.title}**：${item.minBytes.toLocaleString()}～${item.maxBytes.toLocaleString()} 字节（${item.confidence} 可信度）\n   - 依据：${item.basis}\n   - 操作：${item.action}`).join("\n") : "没有足够的 MAP 信息量化优化空间。";
    const report = `# EmbedKit 工程分析报告\n\n- 工程：${projectName}\n- 生成时间：${new Date().toLocaleString()}\n- 芯片：${projectSummary.chip}\n- 构建体系：${projectSummary.toolchain}（可信度 ${projectSummary.buildConfidence}）\n- 识别依据：${projectSummary.buildEvidence.join("；")}\n- SDK：${projectSummary.sdk}\n- 工程类型：${projectSummary.projectType}\n- 文件：${projectSummary.files}（源文件 ${projectSummary.sourceFiles}，头文件 ${projectSummary.headerFiles}）\n- 总行数：${projectSummary.totalLines}\n- 入口：${projectSummary.entryPoints.join(", ") || "未识别"}\n- 构建配置：${projectSummary.buildFiles.join(", ") || "未识别"}\n- 外设：${projectSummary.peripherals.join(", ") || "未识别"}\n\n## 程序执行流程\n\n- 运行模型：${projectArchitecture?.runtime ?? "未识别"}\n- 分析可信度：${projectArchitecture?.confidence ?? "low"}\n- 任务：${projectArchitecture?.tasks.map(item => item.name).join("、") || "未识别"}\n- 中断/回调：${projectArchitecture?.interrupts.map(item => item.name).join("、") || "未识别"}\n\n${flowRows}\n\n## 状态机\n\n${stateRows}\n\n## 并发资源\n\n${concurrencyRows}\n\n## 真实设备轨迹\n\n${traceRows}\n\n## 程序分层\n\n${architectureRows}\n\n## MAP 优化空间\n\n${optimizationRows}\n\n## 本地静态风险\n\n${riskRows}\n\n## 能力边界\n\n本报告是源码、工程配置、产物和已导入运行轨迹的关联结果。优化空间是待验证区间；宏、函数指针、任务调度、中断抢占和运行时注册仍可能影响流程完整性。\n`;
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([report], { type: "text/markdown;charset=utf-8" })); link.download = `${projectName || "project"}-analysis.md`; link.click(); URL.revokeObjectURL(link.href);
  };

  const chipLang = activeFile.split(".").pop();

  return (
    <div className="relative flex h-full overflow-hidden">
      {/* File Explorer */}
      {projectSummary && (
        <div className="w-56 bg-[#0d1117] border-r border-[#30363d] flex flex-col">
          <FileTree
            files={files}
            activeFile={activeFile}
            onFileSelect={setActiveFile}
            onAddFile={handleAddFile}
            onDeleteFile={handleDeleteFile}
          />
        </div>
      )}

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-[#30363d] bg-[#161b22] px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden lg:block">
              <b className="text-sm text-gray-200">工程分析</b>
              <span className="ml-2 text-[10px] text-gray-600">
                导入工程、查看摘要与参考代码
              </span>
            </div>
            {projectSummary && (
              <div className="flex items-center gap-2 bg-[#0d1117] rounded-lg px-3 py-1.5">
                <Cpu size={14} className="text-blue-400" />
                <select
                  value={selectedChip.id}
                  onChange={(e) => {
                    const chip = chips.find((c) => c.id === e.target.value);
                    if (chip) setSelectedChip(chip);
                  }}
                  className="bg-transparent text-sm text-gray-300 outline-none cursor-pointer"
                >
                  {chips.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {projectSummary && (
              <span className="text-xs text-gray-500">
                {selectedChip.cores} · {selectedChip.frequency} ·{" "}
                {selectedChip.flash} Flash
              </span>
            )}
          </div>

          <div className="flex min-w-0 shrink items-center gap-1.5 overflow-x-auto py-1 scrollbar-thin">
            <label
              className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-[#0d1117] px-2.5 py-1.5 text-xs text-gray-300 hover:text-white"
              title="导入已有 C/C++ 工程文件或目录中的文件"
            >
              <Upload size={14} /> 导入工程
              <input
                type="file"
                multiple
                className="hidden"
                onClick={(event) => { (event.currentTarget as HTMLInputElement & { webkitdirectory?: boolean }).webkitdirectory = true; }}
                onChange={handleImportFiles}
              />
            </label>
            <button
              onClick={handleDownload}
              className="flex shrink-0 items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-300 hover:text-white
                bg-[#0d1117] hover:bg-[#1c2128] rounded-lg transition-colors"
            >
              <DownloadIcon size={14} />
              当前文件
            </button>
            <button onClick={handleExportAnalysis} disabled={!projectSummary} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#0d1117] px-2.5 py-1.5 text-xs text-gray-300 hover:bg-[#1c2128] hover:text-white disabled:opacity-40"><DownloadIcon size={14} />分析报告</button>
            {projectArchitecture && <button onClick={() => setActiveToolPanel(value => value === 'architecture' ? null : 'architecture')} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs ${activeToolPanel === 'architecture' ? "bg-cyan-500/20 text-cyan-300" : "bg-[#0d1117] text-gray-300 hover:text-white"}`}><Network size={13} />程序框架</button>}
            {mapFile && mapAnalysis && <button onClick={() => setActiveToolPanel(value => value === 'map' ? null : 'map')} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs ${activeToolPanel === 'map' ? "bg-purple-500/20 text-purple-300" : "bg-[#0d1117] text-gray-300 hover:text-white"}`}><BookOpen size={13} />MAP 分析</button>}
            <button
              onClick={handleCompile}
              disabled={isCompiling || !projectSummary}
              className="flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white
                bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50"
            >
              <Play size={14} fill="currentColor" />
              {isCompiling ? "检查中..." : "检查代码"}
            </button>
            {(projectSummary?.agentBuildSystem || projectSummary?.buildKind === "unknown") ? <button onClick={() => setActiveToolPanel(value => value === 'build' ? null : 'build')} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs ${activeToolPanel === 'build' ? "bg-green-500/20 text-green-300" : "bg-[#0d1117] text-gray-300 hover:text-white"}`}><Play size={13} />{projectSummary.agentBuildSystem ? `${projectSummary.toolchain} 构建` : "高级构建设置"}</button> : projectSummary && <span className="shrink-0 rounded-lg border border-[#30363d] px-2.5 py-1.5 text-[10px] text-gray-500">{projectSummary.toolchain} 管理构建</span>}
            <button
              onClick={() => void handleAiAnalyze()}
              disabled={!projectSummary || analyzing}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-purple-600 px-2.5 py-1.5 text-xs text-white hover:bg-purple-500 disabled:opacity-40"
              title="使用已配置的 AI 分析导入工程"
            >
              <Sparkles size={14} />
              {analyzing ? "分析中..." : "AI 分析"}
            </button>
            <button
              onClick={() => { setShowOutput(!showOutput); setActiveToolPanel(null); }}
              className={`p-1.5 rounded-lg transition-colors ${showOutput ? "bg-blue-500/20 text-blue-400" : "text-gray-400 hover:text-white"}`}
            >
              <Settings size={16} />
            </button>
          </div>
        </div>

        {/* Editor + Output */}
        <div className="flex-1 flex min-h-0">
          <div
            className={`flex-1 min-w-0 ${showOutput && projectSummary ? "border-r border-[#30363d]" : ""}`}
          >
            {projectSummary ? (
              <Editor
                height="100%"
                language={chipLang || "c"}
                value={activeContent}
                onChange={handleEditorChange}
                onMount={handleEditorMount}
                theme="vs-dark"
                options={{
                  fontSize: 14,
                  lineHeight: 20,
                  minimap: { enabled: true },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 4,
                  bracketPairColorization: { enabled: true },
                  suggestOnTriggerCharacters: true,
                }}
              />
            ) : (
              <ProjectLanding
                onImport={handleImportFiles}
                error={importError}
              />
            )}
          </div>

          {showOutput && projectSummary && (
            <div className="flex w-80 flex-col bg-[#0d1117] xl:w-96">
              <ProjectSummaryPanel summary={projectSummary} onFindingSelect={handleFindingSelect} />
              <AiReportPanel report={aiReport} analyzing={analyzing} />
              <div className="h-52 shrink-0 border-t border-[#30363d]">
                <OutputPanel result={compileResult} />
              </div>
            </div>
          )}
        </div>

        {/* Status Bar */}
        <div className="h-6 bg-[#161b22] border-t border-[#30363d] flex items-center justify-between px-3 text-xs text-gray-500">
          <span>
            {projectSummary
              ? `${activeFile} · ${chipLang?.toUpperCase()}`
              : "尚未导入工程"}
          </span>
          <span>
            {projectSummary
              ? `${projectName} · ${files.length} 个文件 · ${projectSummary.chip}`
              : "导入工程后显示分析摘要"}
          </span>
        </div>
      </div>
      {activeToolPanel && <button type="button" aria-label="关闭分析工具" onClick={() => setActiveToolPanel(null)} className="absolute inset-x-0 top-12 bottom-0 z-20 bg-black/25" />}
      {activeToolPanel && <div className="absolute top-12 right-0 bottom-0 z-30 flex max-w-full shadow-[-18px_0_40px_rgba(0,0,0,0.38)]">
        {activeToolPanel === 'build' && <ProjectBuildPanel suggestedSystem={projectSummary?.agentBuildSystem} onClose={() => setActiveToolPanel(null)} onDiagnostic={(diagnostic) => { handleBuildDiagnostic(diagnostic); setActiveToolPanel(null); }} onArtifactAnalyze={(artifact, selectionId) => { const type = artifact.type.toLowerCase(), route = type === 'map' ? '/toolbox/map' : type === 'bin' ? '/toolbox/firmware' : type === 'hex' ? '/toolbox/ihex' : '/toolbox/elf'; navigate(route, { state: { selectionId, fileName: artifact.name, source: 'build-artifact' } }); }} />}
        {activeToolPanel === 'map' && mapFile && mapAnalysis && <MapAnalysisPanel options={mapOptions.map(item => ({ path: item.file.path, name: item.file.name, lastModified: item.file.lastModified, analysis: item.analysis }))} selectedPath={mapFile.path} onSelect={setSelectedMapPath} onClose={() => setActiveToolPanel(null)} onModuleSelect={(module) => { handleMapModuleSelect(module); setActiveToolPanel(null); }} />}
        {activeToolPanel === 'architecture' && projectArchitecture && programBehavior && <ProjectArchitecturePanel architecture={projectArchitecture} behavior={programBehavior} trace={runtimeTrace} onTraceChange={handleRuntimeTraceChange} onClose={() => setActiveToolPanel(null)} onSelect={(file, line) => { handleFindingSelect({ id: `architecture:${file}:${line}`, severity: 'low', title: '程序框架', file, line, evidence: '', recommendation: '' }); setActiveToolPanel(null); }} />}
      </div>}
    </div>
  );
}
