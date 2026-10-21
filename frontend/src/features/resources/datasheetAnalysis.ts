import type { DocumentExtractionResult } from '../../tools/frame/documentExtraction';

export type DatasheetSectionKind = 'overview' | 'features' | 'applications' | 'pinout' | 'electrical' | 'timing' | 'functional' | 'application' | 'layout' | 'package' | 'revision';

export interface DatasheetPageText { page: number; text: string }
export interface DatasheetSection { id: string; kind: DatasheetSectionKind; title: string; page: number; excerpt: string; confidence: 'high' | 'medium'; evidence: string }
export interface DatasheetSearchMatch { id: string; page: number; excerpt: string; evidence: string }
export interface DatasheetAnalysis { pages: DatasheetPageText[]; sections: DatasheetSection[]; coverage: number; unknownSections: string[] }

const sectionRules: Array<{ kind: DatasheetSectionKind; title: string; pattern: RegExp }> = [
  { kind: 'overview', title: '器件概述', pattern: /^(?:\d+(?:\.\d+)*\s+)?(?:overview|description|general description|器件概述|概述|简介)(?=\s|$|[:：])/i },
  { kind: 'features', title: '主要特性', pattern: /^(?:\d+(?:\.\d+)*\s+)?(?:features?|key features?|主要特性|特性)(?=\s|$|[:：])/i },
  { kind: 'applications', title: '典型应用', pattern: /^(?:\d+(?:\.\d+)*\s+)?(?:applications?|typical applications?|典型应用|应用领域)(?=\s|$|[:：])/i },
  { kind: 'pinout', title: '引脚与封装端子', pattern: /^(?:\d+(?:\.\d+)*\s+)?(?:pin configuration|pin functions?|pin description|terminal configuration|引脚(?:配置|说明|功能))(?=\s|$|[:：])/i },
  { kind: 'electrical', title: '电气特性', pattern: /^(?:\d+(?:\.\d+)*\s+)?(?:electrical characteristics|absolute maximum ratings|recommended operating conditions|电气特性|绝对最大额定值|推荐工作条件)(?=\s|$|[:：])/i },
  { kind: 'timing', title: '时序要求', pattern: /^(?:\d+(?:\.\d+)*\s+)?(?:timing requirements?|switching characteristics|interface timing|时序(?:要求|特性))(?=\s|$|[:：])/i },
  { kind: 'functional', title: '功能与工作原理', pattern: /^(?:\d+(?:\.\d+)*\s+)?(?:detailed description|functional description|device functional modes|工作原理|功能说明)(?=\s|$|[:：])/i },
  { kind: 'application', title: '应用设计', pattern: /^(?:\d+(?:\.\d+)*\s+)?(?:application information|typical application|design procedure|应用信息|应用设计|设计步骤)(?=\s|$|[:：])/i },
  { kind: 'layout', title: '布局与电源建议', pattern: /^(?:\d+(?:\.\d+)*\s+)?(?:layout|layout guidelines?|power supply recommendations?|pcb layout|布局|布线|电源建议)(?=\s|$|[:：])/i },
  { kind: 'package', title: '封装与机械信息', pattern: /^(?:\d+(?:\.\d+)*\s+)?(?:package information|mechanical data|packaging information|封装信息|机械尺寸)(?=\s|$|[:：])/i },
  { kind: 'revision', title: '版本修订记录', pattern: /^(?:\d+(?:\.\d+)*\s+)?(?:revision history|document revision history|修订历史|版本记录)(?=\s|$|[:：])/i },
];

function excerpt(text: string, at = 0, length = 220) {
  return text.slice(Math.max(0, at - 70), Math.min(text.length, at + length)).replace(/\s+/g, ' ').trim();
}

export function parsePdfPageEvidence(text: string): DatasheetPageText[] {
  const marker = /^\[\[来源:PDF 第 (\d+) 页\]\]\s*$/gm, matches = [...text.matchAll(marker)], pages: DatasheetPageText[] = [];
  for (let index = 0; index < matches.length; index += 1) {
    const page = Number(matches[index][1]), start = (matches[index].index ?? 0) + matches[index][0].length, end = matches[index + 1]?.index ?? text.length;
    pages.push({ page, text: text.slice(start, end).trim() });
  }
  return pages;
}

export function analyzeDatasheetExtraction(result: DocumentExtractionResult): DatasheetAnalysis {
  const pages = parsePdfPageEvidence(result.text), sections: DatasheetSection[] = [], found = new Set<DatasheetSectionKind>();
  for (const page of pages) {
    const lines = page.text.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
    for (const line of lines) {
      for (const rule of sectionRules) {
        if (found.has(rule.kind) || !rule.pattern.test(line)) continue;
        found.add(rule.kind);
        sections.push({ id: `${rule.kind}:${page.page}`, kind: rule.kind, title: rule.title, page: page.page, excerpt: excerpt(page.text, Math.max(0, page.text.indexOf(line))), confidence: line.length <= 120 ? 'high' : 'medium', evidence: `PDF 第 ${page.page} 页` });
      }
    }
  }
  const unknownSections = sectionRules.filter(rule => !found.has(rule.kind)).map(rule => rule.title);
  return { pages, sections: sections.sort((a, b) => a.page - b.page), coverage: Math.round(found.size / sectionRules.length * 100), unknownSections };
}

export function searchDatasheetPages(pages: DatasheetPageText[], query: string, limit = 100): DatasheetSearchMatch[] {
  const needle = query.trim().toLocaleLowerCase();
  if (needle.length < 2) return [];
  const matches: DatasheetSearchMatch[] = [];
  for (const page of pages) {
    const lower = page.text.toLocaleLowerCase(); let cursor = 0, occurrence = 0;
    while (matches.length < limit) {
      const at = lower.indexOf(needle, cursor); if (at < 0) break;
      matches.push({ id: `${page.page}:${at}:${occurrence}`, page: page.page, excerpt: excerpt(page.text, at), evidence: `PDF 第 ${page.page} 页` });
      cursor = at + Math.max(needle.length, 1); occurrence += 1;
    }
    if (matches.length >= limit) break;
  }
  return matches;
}
