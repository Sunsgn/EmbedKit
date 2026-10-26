import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import CodeMirror, { EditorView, type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { cpp } from '@codemirror/lang-cpp';

export interface CodeEditorHandle {
  goToLine: (line: number) => void;
  focus: () => void;
}

interface CodeEditorProps {
  value: string;
  language?: string;
  height?: string | number;
  readOnly?: boolean;
  fontSize?: number;
  ariaLabel?: string;
  onChange?: (value: string) => void;
}

const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(function CodeEditor(
  { value, language = 'c', height = '100%', readOnly = false, fontSize = 14, ariaLabel = '代码编辑器', onChange },
  ref,
) {
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const extensions = useMemo(() => {
    const languageExtension = /^(?:c|h|cc|cpp|cxx)$/i.test(language) ? [cpp()] : [];
    return [
      ...languageExtension,
      EditorView.theme({
        '&': { height: '100%', fontSize: `${fontSize}px`, backgroundColor: '#0d1117' },
        '.cm-scroller': { overflow: 'auto', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' },
        '.cm-content': { minHeight: '100%' },
        '.cm-gutters': { backgroundColor: '#111820', borderRight: '1px solid #30363d' },
      }),
    ];
  }, [fontSize, language]);

  useImperativeHandle(ref, () => ({
    goToLine(line) {
      const view = editorRef.current?.view;
      if (!view) return;
      const target = view.state.doc.line(Math.max(1, Math.min(line, view.state.doc.lines)));
      view.dispatch({ selection: { anchor: target.from }, scrollIntoView: true });
      view.focus();
    },
    focus() {
      editorRef.current?.view?.focus();
    },
  }), []);

  const resolvedHeight = typeof height === 'number' ? `${height}px` : height;
  return (
    <div className="h-full min-h-0 overflow-hidden" style={{ height: resolvedHeight }} aria-label={ariaLabel}>
      <CodeMirror
        ref={editorRef}
        value={value}
        height={resolvedHeight}
        theme="dark"
        extensions={extensions}
        editable={!readOnly}
        readOnly={readOnly}
        indentWithTab={!readOnly}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: !readOnly,
          highlightActiveLineGutter: !readOnly,
          highlightSelectionMatches: true,
          bracketMatching: true,
          autocompletion: !readOnly,
        }}
        onChange={onChange}
      />
    </div>
  );
});

export default CodeEditor;
