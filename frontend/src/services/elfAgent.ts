import { agentRequest } from './agentClient';
import { agentPaths } from '../application/agent/routes';

export interface ElfSection { index: number; name: string; type: string; flags: string; address: string; offset: number; size: number; entrySize: number; link: number }
export interface ElfSegment { index: number; type: string; flags: number; offset: string; virtualAddress: string; physicalAddress: string; fileSize: number; memorySize: number }
export interface ElfSymbol { table: string; index: number; name: string; address: string; normalizedAddress: string; size: number; binding: string; type: string; visibility: string; sectionIndex: number; sectionName: string }
export interface ElfAnalysis { analysisId: string; expiresAt: string; sha256?: string; format: 'ELF'; bits: 32 | 64; byteOrder: 'little' | 'big'; type: string; machine: string; machineId: number; entry: string; fileSize: number; sections: ElfSection[]; segments: ElfSegment[]; symbolCount: number; namedSymbolCount: number; hasSymbols: boolean; symbolPreview: ElfSymbol[]; dwarfSections: string[]; hasDwarf: boolean; dwarfVersions: number[]; dwarfLineUnits: number; dwarfLineCount: number; hasSourceLines: boolean; warnings: string[] }
export interface ElfSourceLine { file: string; line: number; column: number; address: string }
export interface ElfAddressLookup { requestedAddress: string; normalizedAddress: string; thumbBitCleared: boolean; match: 'exact-symbol' | 'inside-symbol' | 'nearest-symbol' | 'section' | 'unresolved'; confidence: 'high' | 'medium' | 'low' | 'none'; symbol: (ElfSymbol & { offset: string }) | null; section: { index: number; name: string; address: string; size: number; offset: string } | null; source: ElfSourceLine | null; note: string }
export interface ElfDisassemblyWindow { available: boolean; requestedAddress: string; normalizedAddress: string; tool: string | null; instructions: Array<{ address: string; bytes: string; mnemonic: string; operands: string; isTarget: boolean }>; warnings: string[] }

export function analyzeSelectedElf(selectionId: string) { return agentRequest<ElfAnalysis>(agentPaths.elfAnalyze(selectionId), {}, 30000); }
export function lookupElfAddress(analysisId: string, address: string) { return agentRequest<ElfAddressLookup>(agentPaths.elfLookup(analysisId, address)); }
export function disassembleElfAddress(analysisId: string, address: string, before = 16, after = 32) { return agentRequest<ElfDisassemblyWindow>(agentPaths.elfDisassemble(analysisId, address, before, after), {}, 10000); }
