import { agentRequest } from './agentClient';

export interface ElfSection { index: number; name: string; type: string; flags: string; address: string; offset: number; size: number; entrySize: number; link: number }
export interface ElfSegment { index: number; type: string; flags: number; offset: string; virtualAddress: string; physicalAddress: string; fileSize: number; memorySize: number }
export interface ElfSymbol { table: string; index: number; name: string; address: string; normalizedAddress: string; size: number; binding: string; type: string; visibility: string; sectionIndex: number; sectionName: string }
export interface ElfAnalysis { analysisId: string; expiresAt: string; format: 'ELF'; bits: 32 | 64; byteOrder: 'little' | 'big'; type: string; machine: string; machineId: number; entry: string; fileSize: number; sections: ElfSection[]; segments: ElfSegment[]; symbolCount: number; namedSymbolCount: number; hasSymbols: boolean; symbolPreview: ElfSymbol[]; dwarfSections: string[]; hasDwarf: boolean; dwarfVersions: number[]; dwarfLineUnits: number; dwarfLineCount: number; hasSourceLines: boolean; warnings: string[] }
export interface ElfSourceLine { file: string; line: number; column: number; address: string }
export interface ElfAddressLookup { requestedAddress: string; normalizedAddress: string; thumbBitCleared: boolean; match: 'exact-symbol' | 'inside-symbol' | 'nearest-symbol' | 'section' | 'unresolved'; confidence: 'high' | 'medium' | 'low' | 'none'; symbol: (ElfSymbol & { offset: string }) | null; section: { index: number; name: string; address: string; size: number; offset: string } | null; source: ElfSourceLine | null; note: string }

export function analyzeSelectedElf(selectionId: string) { return agentRequest<ElfAnalysis>(`/api/elf/analyze/${selectionId}`, {}, 30000); }
export function lookupElfAddress(analysisId: string, address: string) { return agentRequest<ElfAddressLookup>(`/api/elf/analyses/${analysisId}/lookup?address=${encodeURIComponent(address)}`); }
