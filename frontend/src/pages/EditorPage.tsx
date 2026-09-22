import { useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';
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
} from 'lucide-react';
import type { FileNode, Chip, CompileResult } from '../types';
import { chips } from '../data/chips';

const defaultFiles: FileNode[] = [
  {
    name: 'main.c',
    path: '/main.c',
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
    language: 'c',
  },
  {
    name: 'stm32f1xx_hal_conf.h',
    path: '/Inc/stm32f1xx_hal_conf.h',
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
    language: 'h',
  },
  {
    name: 'Makefile',
    path: '/Makefile',
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
    language: 'makefile',
  },
];

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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ '/Inc': true });

  const grouped: Record<string, FileNode[]> = {};
  files.forEach((f) => {
    const dir = f.path.substring(0, f.path.lastIndexOf('/')) || '/';
    if (!grouped[dir]) grouped[dir] = [];
    grouped[dir].push(f);
  });

  const toggleDir = (dir: string) => {
    setExpanded((prev) => ({ ...prev, [dir]: !prev[dir] }));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#30363d]">
        <span className="text-xs font-semibold text-gray-400 uppercase">Explorer</span>
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
            {dir !== '/' && (
              <button
                onClick={() => toggleDir(dir)}
                className="w-full flex items-center gap-1 px-3 py-1 text-sm text-gray-300 hover:bg-[#1c2128] rounded"
              >
                {expanded[dir] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <FolderOpen size={14} className="text-blue-400" />
                <span className="truncate">{dir === '/Inc' ? 'Inc' : dir === '/Src' ? 'Src' : dir}</span>
              </button>
            )}
            {expanded[dir] &&
              dirFiles.map((f) => (
                <div
                  key={f.path}
                  className={`group flex items-center gap-2 px-3 py-1 text-sm cursor-pointer rounded mr-2
                    ${f.path === activeFile ? 'bg-blue-500/20 text-blue-300' : 'text-gray-400 hover:text-white hover:bg-[#1c2128]'}`}
                  onClick={() => onFileSelect(f.path)}
                >
                  <FileCode size={14} className={f.name.endsWith('.c') ? 'text-blue-400' : f.name.endsWith('.h') ? 'text-purple-400' : 'text-gray-500'} />
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
        Click "Build" to compile
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className={`px-3 py-2 border-b border-[#30363d] text-sm font-medium ${result.success ? 'text-green-400' : 'text-red-400'}`}>
        {result.success ? 'Build Success' : 'Build Failed'}
        {result.size && ` · ${result.size} bytes`}
      </div>
      <pre className="flex-1 p-3 text-xs font-mono text-gray-300 overflow-auto scrollbar-thin whitespace-pre-wrap">
        {result.output}
      </pre>
    </div>
  );
}

export default function EditorPage() {
  const [files, setFiles] = useState<FileNode[]>(defaultFiles);
  const [activeFile, setActiveFile] = useState('/main.c');
  const [selectedChip, setSelectedChip] = useState<Chip>(chips[0]);
  const [compileResult, setCompileResult] = useState<CompileResult | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [showOutput, setShowOutput] = useState(true);

  const activeContent = files.find((f) => f.path === activeFile)?.content || '';

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      setFiles((prev) =>
        prev.map((f) => (f.path === activeFile ? { ...f, content: value } : f))
      );
    }
  }, [activeFile]);

  const handleAddFile = () => {
    const name = prompt('File name:');
    if (name) {
      const ext = name.split('.').pop() || 'c';
      const lang: FileNode['language'] =
        ext === 'h' ? 'h' : ext === 'cpp' ? 'cpp' : ext === 'toml' ? 'toml' : 'c';
      const newFile: FileNode = {
        name,
        path: `/${name}`,
        content: '',
        language: lang,
      };
      setFiles((prev) => [...prev, newFile]);
      setActiveFile(newFile.path);
    }
  };

  const handleDeleteFile = (path: string) => {
    setFiles((prev) => prev.filter((f) => f.path !== path));
    if (activeFile === path) {
      setActiveFile(files[0]?.path || '');
    }
  };

  const handleCompile = async () => {
    setIsCompiling(true);
    // Mock compilation - replace with actual API call
    setTimeout(() => {
      setCompileResult({
        success: true,
        output: `Compiling for ${selectedChip.name}...
Building ${files.length} source file(s)...
Linking...
Size:
   text    data     bss     dec     hex filename
   1234       0     256   1490    5ca main.elf

Build successful!`,
        size: 1234,
      });
      setIsCompiling(false);
    }, 1500);
  };

  const handleDownload = () => {
    const file = files.find((f) => f.path === activeFile);
    if (file) {
      const blob = new Blob([file.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const chipLang = activeFile.split('.').pop();

  return (
    <div className="flex h-full">
      {/* File Explorer */}
      <div className="w-56 bg-[#0d1117] border-r border-[#30363d] flex flex-col">
        <FileTree
          files={files}
          activeFile={activeFile}
          onFileSelect={setActiveFile}
          onAddFile={handleAddFile}
          onDeleteFile={handleDeleteFile}
        />
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="h-12 bg-[#161b22] border-b border-[#30363d] flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
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
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <span className="text-xs text-gray-500">
              {selectedChip.cores} · {selectedChip.frequency} · {selectedChip.flash} Flash
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-300 hover:text-white
                bg-[#0d1117] hover:bg-[#1c2128] rounded-lg transition-colors"
            >
              <DownloadIcon size={14} />
              Save
            </button>
            <button
              onClick={handleCompile}
              disabled={isCompiling}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white
                bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50"
            >
              <Play size={14} fill="currentColor" />
              {isCompiling ? 'Building...' : 'Build'}
            </button>
            <button
              onClick={() => setShowOutput(!showOutput)}
              className={`p-1.5 rounded-lg transition-colors ${showOutput ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 hover:text-white'}`}
            >
              <Settings size={16} />
            </button>
          </div>
        </div>

        {/* Editor + Output */}
        <div className="flex-1 flex min-h-0">
          <div className={`flex-1 min-w-0 ${showOutput ? 'border-r border-[#30363d]' : ''}`}>
            <Editor
              height="100%"
              language={chipLang || 'c'}
              value={activeContent}
              onChange={handleEditorChange}
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
          </div>

          {showOutput && (
            <div className="w-80 bg-[#0d1117]">
              <OutputPanel result={compileResult} />
            </div>
          )}
        </div>

        {/* Status Bar */}
        <div className="h-6 bg-[#161b22] border-t border-[#30363d] flex items-center justify-between px-3 text-xs text-gray-500">
          <span>{activeFile} · {chipLang?.toUpperCase()}</span>
          <span>{files.length} file(s) · {selectedChip.name}</span>
        </div>
      </div>
    </div>
  );
}
