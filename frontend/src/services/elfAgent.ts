import { agentRequest } from './agentClient';

export interface ElfSection { index: number; name: string; type: string; flags: string; address: string; offset: number; size: number; entrySize: number }
export interface ElfSegment { index: number; type: string; flags: number; offset: string; virtualAddress: string; physicalAddress: string; fileSize: number; memorySize: number }
export interface ElfAnalysis { format: 'ELF'; bits: 32 | 64; byteOrder: 'little' | 'big'; type: string; machine: string; machineId: number; entry: string; fileSize: number; sections: ElfSection[]; segments: ElfSegment[]; symbolCount: number; hasSymbols: boolean; dwarfSections: string[]; hasDwarf: boolean; warnings: string[] }

export function analyzeSelectedElf(selectionId: string) { return agentRequest<ElfAnalysis>(`/api/elf/analyze/${selectionId}`, {}, 30000); }
