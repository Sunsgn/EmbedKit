import { useState, useRef } from 'react';
import { BookOpen, Lightbulb, Copy, Check } from 'lucide-react';
import { tutorials } from '../data/tutorials';
import type { Tutorial } from '../types';
import Editor from '@monaco-editor/react';

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
              {current.content.split('\n').map((line: string, i: number) => {
                if (line.startsWith('## ')) {
                  return <h2 key={i} className="text-lg font-semibold text-white mt-4 mb-2">{line.replace('## ', '')}</h2>;
                }
                if (line.startsWith('# ')) {
                  return <h1 key={i} className="text-xl font-bold text-white mt-4 mb-2">{line.replace('# ', '')}</h1>;
                }
                if (line.startsWith('- ')) {
                  return <li key={i} className="text-gray-300 ml-4 list-disc">{line.replace('- ', '')}</li>;
                }
                if (line.trim() === '') {
                  return <div key={i} className="h-2" />;
                }
                return <p key={i} className="text-gray-300 mb-1">{line}</p>;
              })}
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
