import { describe, expect, it } from 'vitest';
import { parseMarkdownBlocks } from './markdownDocument';

describe('parseMarkdownBlocks', () => {
  it('parses the block forms used by the embedded knowledge documents', () => {
    const blocks = parseMarkdownBlocks('# 标题\n\n说明 **内容**。\n\n- 一\n- 二\n\n| 项 | 值 |\n| --- | --- |\n| A | B |\n\n```text\ncode\n```');
    expect(blocks.map(block => block.type)).toEqual(['heading', 'paragraph', 'list', 'table', 'code']);
    expect(blocks.find(block => block.type === 'table')).toMatchObject({ headers: ['项', '值'], rows: [['A', 'B']] });
    expect(blocks.find(block => block.type === 'code')).toMatchObject({ language: 'text', text: 'code' });
  });

  it('closes an unterminated code fence at end of input without looping', () => {
    expect(parseMarkdownBlocks('```c\nint main(void) {').at(-1)).toMatchObject({ type: 'code', language: 'c' });
  });
});
