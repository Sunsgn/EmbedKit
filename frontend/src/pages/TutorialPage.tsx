import { useState, useRef } from 'react';
import { BookOpen, Lightbulb, Copy, Check } from 'lucide-react';
import { tutorials } from '../data/tutorials';
import type { Tutorial } from '../types';
import Editor from '@monaco-editor/react';

/* ── simple inline markdown parser ── */
function parseInline(text: string): React.ReactNode {
  // split on **bold**, `code`, and __italic__
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;
  while (remaining.length) {
    const boldIdx = remaining.indexOf('**');
    const codeIdx = remaining.indexOf('`');
    const italicIdx = remaining.indexOf('__');
    let pos = remaining.length;
    let kind: 'bold' | 'code' | 'italic' | null = null;

    if (boldIdx !== -1 && (pos === remaining.length || boldIdx < pos)) { pos = boldIdx; kind = 'bold'; }
    if (codeIdx !== -1 && (pos === remaining.length || codeIdx < pos)) { pos = codeIdx; kind = 'code'; }
    if (italicIdx !== -1 && (pos === remaining.length || italicIdx < pos)) { pos = italicIdx; kind = 'italic'; }

    if (pos > 0 || parts.length) {
      parts.push(remaining.slice(0, pos));
    }

    if (!kind) break;

    if (kind === 'code') {
      const end = remaining.indexOf('`', pos + 1);
      if (end !== -1) {
        parts.push(<code key={key++} className="px-1.5 py-0.5 bg-[#0d1117] text-blue-300 rounded text-xs font-mono border border-[#30363d]">{remaining.slice(pos + 1, end)}</code>);
        remaining = remaining.slice(end + 1);
        continue;
      }
    } else if (kind === 'bold') {
      const end = remaining.indexOf('**', pos + 2);
      if (end !== -1) {
        parts.push(<strong key={key++} className="text-white font-semibold">{remaining.slice(pos + 2, end)}</strong>);
        remaining = remaining.slice(end + 2);
        continue;
      }
    } else if (kind === 'italic') {
      const end = remaining.indexOf('__', pos + 2);
      if (end !== -1) {
        parts.push(<em key={key++} className="text-gray-200">{remaining.slice(pos + 2, end)}</em>);
        remaining = remaining.slice(end + 2);
        continue;
      }
    }
    break;
  }
  if (remaining.length) parts.push(remaining);
  return parts;
}

function renderContent(content: string): React.ReactNode {
  const lines = content.split('\n');
  const result: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // table row (contains |)
    if (line.includes('|') && line.trim().startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim().startsWith('|')) {
        const cells = lines[i].split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1).map(c => c.trim());
        rows.push(cells);
        i++;
      }
      if (rows.length) {
        result.push(
          <table key={result.length} className="w-full border-collapse my-3 text-sm">
            <thead>
              <tr>
                {rows[0].map((cell, ci) => (
                  <th key={ci} className="border border-[#30363d] px-3 py-2 bg-[#161b22] text-white font-semibold text-left">{parseInline(cell)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(1).map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="border border-[#30363d] px-3 py-2 text-gray-300">{parseInline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        );
      }
      continue;
    }

    // horizontal rule
    if (line.trim() === '---' || line.trim() === '***') {
      result.push(<hr key={result.length} className="border-[#30363d] my-4" />);
      i++;
      continue;
    }

    // headers
    if (line.startsWith('### ')) {
      result.push(<h3 key={result.length} className="text-base font-semibold text-white mt-4 mb-2">{parseInline(line.slice(4))}</h3>);
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      result.push(<h2 key={result.length} className="text-lg font-semibold text-white mt-4 mb-2">{parseInline(line.slice(3))}</h2>);
      i++;
      continue;
    }
    if (line.startsWith('# ')) {
      result.push(<h1 key={result.length} className="text-xl font-bold text-white mt-4 mb-2">{parseInline(line.slice(2))}</h1>);
      i++;
      continue;
    }

    // unordered list
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        listItems.push(<li key={i} className="text-gray-300 ml-4 list-disc">{parseInline(lines[i].slice(2))}</li>);
        i++;
      }
      result.push(<ul key={result.length} className="my-2">{listItems}</ul>);
      continue;
    }

    // ordered list
    if (/^\d+\.\s/.test(line)) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        listItems.push(<li key={i} className="text-gray-300 ml-4 list-decimal">{parseInline(lines[i].replace(/^\d+\.\s/, ''))}</li>);
        i++;
      }
      result.push(<ol key={result.length} className="my-2">{listItems}</ol>);
      continue;
    }

    // blank line
    if (line.trim() === '') {
      result.push(<div key={result.length} className="h-2" />);
      i++;
      continue;
    }

    // paragraph
    result.push(<p key={result.length} className="text-gray-300 mb-1 leading-relaxed">{parseInline(line)}</p>);
    i++;
  }

  return result;
}

const difficultyLabel: Record<string, string> = {
  beginner: '入门',
  intermediate: '进阶',
  advanced: '高级',
};

const difficultyColor: Record<string, string> = {
  beginner: 'text-green-400 bg-green-500/10',
  intermediate: 'text-yellow-400 bg-yellow-500/10',
  advanced: 'text-red-400 bg-red-500/10',
};

export default function TutorialPage() {
  const [selectedTutorial, setSelectedTutorial] = useState(tutorials[0].id);
  const [copied, setCopied] = useState(false);
  const current = tutorials.find((t: Tutorial) => t.id === selectedTutorial)!;
  const editorRef = useRef<any>(null);

  const handleCopy = () => {
    if (current.codeExample) {
      navigator.clipboard.writeText(current.codeExample);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="flex h-full">
        {/* Tutorial List */}
        <div className="w-72 bg-[#161b22] border-r border-[#30363d] flex flex-col flex-shrink-0">
          <div className="p-4 border-b border-[#30363d]">
            <h2 className="text-lg font-bold text-white mb-1">教程</h2>
            <p className="text-xs text-gray-400">从入门到精通嵌入式开发</p>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-2">
            {tutorials.map((t: Tutorial) => (
              <button
                key={t.id}
                onClick={() => setSelectedTutorial(t.id)}
                className={`w-full text-left p-3 rounded-lg transition-colors
                  ${selectedTutorial === t.id
                    ? 'bg-blue-500/10 border border-blue-500/30'
                    : 'border border-transparent hover:bg-[#1c2128]'
                  }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Lightbulb size={14} className="text-yellow-400" />
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${difficultyColor[t.difficulty]}`}>
                    {difficultyLabel[t.difficulty]}
                  </span>
                </div>
                <h3 className={`text-sm font-medium ${selectedTutorial === t.id ? 'text-blue-300' : 'text-white'}`}>
                  {t.title}
                </h3>
                <p className="text-xs text-gray-500 mt-1">{t.category}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Tutorial Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="p-6 border-b border-[#30363d]">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen size={18} className="text-blue-400" />
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${difficultyColor[current.difficulty]}`}>
                {difficultyLabel[current.difficulty]}
              </span>
              <span className="text-xs font-medium px-2 py-0.5 bg-gray-500/10 text-gray-400 rounded-full">
                {current.category}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">{current.title}</h1>
          </div>

          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto scrollbar-thin p-6">
            {/* Content */}
            <div className="prose prose-invert prose-sm max-w-none mb-6">
              {renderContent(current.content)}
            </div>

            {/* Code Example */}
            {current.codeExample && (
              <div className="bg-[#0d1117] border border-[#30363d] rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-[#30363d]">
                  <span className="text-xs text-gray-400">C</span>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? '已复制' : '复制代码'}
                  </button>
                </div>
                <Editor
                  height="350"
                  language="c"
                  value={current.codeExample}
                  theme="vs-dark"
                  options={{
                    readOnly: true,
                    fontSize: 13,
                    minimap: { enabled: false },
                    automaticLayout: true,
                    scrollBeyondLastLine: false,
                  }}
                  onMount={(editor) => { editorRef.current = editor; }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
