import { Fragment, type ReactNode, useMemo } from 'react';
import { resolveEmbeddedKnowledgeLink, type EmbeddedKnowledgeDocument } from '../../data/embeddedKnowledgeBase';
import { parseMarkdownBlocks } from './markdownDocument';

function inlineContent(text: string, current: EmbeddedKnowledgeDocument, openDocument: (document: EmbeddedKnowledgeDocument) => void): ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index} className="rounded bg-black/30 px-1 py-0.5 text-[0.92em] text-cyan-300">{part.slice(1, -1)}</code>;
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index} className="font-semibold text-gray-200">{part.slice(2, -2)}</strong>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const target = resolveEmbeddedKnowledgeLink(current, link[2]);
      if (target) return <button key={index} type="button" onClick={() => openDocument(target)} className="text-blue-400 underline decoration-blue-500/40 underline-offset-2 hover:text-blue-300">{link[1]}</button>;
      if (/^https:\/\//i.test(link[2])) return <a key={index} href={link[2]} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline decoration-blue-500/40 underline-offset-2">{link[1]}</a>;
      return <span key={index} className="text-gray-400">{link[1]}</span>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

export default function KnowledgeMarkdownReader({ document, onOpenDocument }: { document: EmbeddedKnowledgeDocument; onOpenDocument: (document: EmbeddedKnowledgeDocument) => void }) {
  const blocks = useMemo(() => parseMarkdownBlocks(document.content), [document.content]);
  return <div className="space-y-4 text-sm leading-7 text-gray-400">
    {blocks.map((block, index) => {
      if (index === 0 && block.type === 'heading' && block.level === 1) return null;
      if (block.type === 'heading') {
        const className = block.level === 2 ? 'border-b border-[#30363d] pb-2 pt-3 text-lg font-semibold text-gray-100' : block.level === 3 ? 'pt-2 text-base font-semibold text-gray-200' : 'pt-1 text-sm font-semibold text-gray-300';
        return <h2 key={index} className={className}>{inlineContent(block.text, document, onOpenDocument)}</h2>;
      }
      if (block.type === 'paragraph') return <p key={index}>{inlineContent(block.text, document, onOpenDocument)}</p>;
      if (block.type === 'quote') return <blockquote key={index} className="border-l-2 border-blue-500/50 bg-blue-500/5 px-4 py-2 text-gray-400">{inlineContent(block.text, document, onOpenDocument)}</blockquote>;
      if (block.type === 'rule') return <hr key={index} className="border-[#30363d]" />;
      if (block.type === 'code') return <div key={index} className="theme-canvas theme-border overflow-hidden rounded-lg border"><div className="theme-border border-b px-3 py-1 text-[9px] uppercase text-gray-600">{block.language || 'text'}</div><pre className="overflow-x-auto p-3 text-xs leading-5 text-gray-300"><code>{block.text}</code></pre></div>;
      if (block.type === 'list') {
        const Tag = block.ordered ? 'ol' : 'ul';
        return <Tag key={index} className={`space-y-1 pl-6 ${block.ordered ? 'list-decimal' : 'list-disc'}`}>{block.items.map((item, itemIndex) => <li key={itemIndex} className="pl-1">{inlineContent(item, document, onOpenDocument)}</li>)}</Tag>;
      }
      return <div key={index} className="theme-border overflow-x-auto rounded-lg border"><table className="min-w-full border-collapse text-left text-xs"><thead className="bg-white/[0.04] text-gray-300"><tr>{block.headers.map((cell, cellIndex) => <th key={cellIndex} className="theme-border border-b border-r px-3 py-2 last:border-r-0">{inlineContent(cell, document, onOpenDocument)}</th>)}</tr></thead><tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex} className="theme-border border-b last:border-0">{block.headers.map((_, cellIndex) => <td key={cellIndex} className="theme-border border-r px-3 py-2 align-top last:border-r-0">{inlineContent(row[cellIndex] ?? '', document, onOpenDocument)}</td>)}</tr>)}</tbody></table></div>;
    })}
  </div>;
}
