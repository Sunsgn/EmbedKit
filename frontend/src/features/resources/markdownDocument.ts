export type MarkdownBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'code'; language: string; text: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'quote'; text: string }
  | { type: 'rule' };

const tableSeparator = /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/;

function tableCells(line: string) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
}

export function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n'), blocks: MarkdownBlock[] = [];
  let index = 0, paragraph: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
  };
  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (!line.trim()) { flushParagraph(); index += 1; continue; }
    const fence = line.match(/^```\s*([^\s]*)/);
    if (fence) {
      flushParagraph();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index] ?? '')) { code.push(lines[index] ?? ''); index += 1; }
      if (index < lines.length) index += 1;
      blocks.push({ type: 'code', language: fence[1] ?? '', text: code.join('\n') });
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) { flushParagraph(); blocks.push({ type: 'heading', level: heading[1].length, text: heading[2].trim() }); index += 1; continue; }
    if (/^\s*(?:---+|___+|\*\*\*+)\s*$/.test(line)) { flushParagraph(); blocks.push({ type: 'rule' }); index += 1; continue; }
    if (index + 1 < lines.length && line.includes('|') && tableSeparator.test(lines[index + 1] ?? '')) {
      flushParagraph();
      const headers = tableCells(line), rows: string[][] = [];
      index += 2;
      while (index < lines.length && (lines[index] ?? '').includes('|') && (lines[index] ?? '').trim()) { rows.push(tableCells(lines[index] ?? '')); index += 1; }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }
    const listItem = line.match(/^\s*(?:(\d+)\.|[-*+])\s+(.+)$/);
    if (listItem) {
      flushParagraph();
      const ordered = Boolean(listItem[1]), items = [listItem[2]];
      index += 1;
      while (index < lines.length) {
        const next = (lines[index] ?? '').match(/^\s*(?:(\d+)\.|[-*+])\s+(.+)$/);
        if (!next || Boolean(next[1]) !== ordered) break;
        items.push(next[2]); index += 1;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }
    const quote = line.match(/^>\s?(.*)$/);
    if (quote) { flushParagraph(); blocks.push({ type: 'quote', text: quote[1] }); index += 1; continue; }
    paragraph.push(line.trim()); index += 1;
  }
  flushParagraph();
  return blocks;
}
