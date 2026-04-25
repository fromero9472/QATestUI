import React, { useState, useEffect, useCallback } from 'react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import { Save, Loader, CheckCircle, AlertTriangle, Edit3, Eye } from 'lucide-react';

// ─── Karate DSL grammar para Prism ───────────────────────────────────────────
Prism.languages.karate = {
  // Comentarios
  'comment': { pattern: /#.*/, greedy: true },

  // Feature / Background / Scenario keywords (línea completa resaltada)
  'feature-keyword': {
    pattern: /^(Feature|Background|Scenario Outline|Scenario|Examples)(\s*:.*)?$/m,
    inside: {
      'keyword': /^(Feature|Background|Scenario Outline|Scenario|Examples)/,
      'title': /:.+/,
    }
  },

  // Given / When / Then / And / But
  'step-keyword': {
    pattern: /^\s*(Given|When|Then|And|But)\b/m,
    alias: 'keyword',
  },

  // Karate * steps
  'star-step': {
    pattern: /^\s*\*\s.+/m,
    inside: {
      'star': { pattern: /^\s*\*/, alias: 'operator' },
      // def / set / call / configure / match / assert
      'karate-fn': {
        pattern: /\b(def|set|call|callonce|configure|match|assert|print|read|pause|listen|signal)\b/,
        alias: 'function',
      },
      'string': { pattern: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/, greedy: true },
      'number': /\b\d+(\.\d+)?\b/,
      'operator': /[=!<>]=?|&&|\|\||[+\-*/]/,
      'variable': /\b[a-zA-Z_]\w*\b(?=\s*=)/,
    }
  },

  // path / header / request / status / method keywords
  'http-keyword': {
    pattern: /\b(url|path|header|headers|request|response|status|method|params|param|form field|multipart|soap action|retry until)\b/,
    alias: 'keyword',
  },

  // HTTP methods
  'http-method': {
    pattern: /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/,
    alias: 'builtin',
  },

  // Strings
  'string': {
    pattern: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/,
    greedy: true,
  },

  // Doc strings """..."""
  'docstring': {
    pattern: /"""[\s\S]*?"""/,
    greedy: true,
    alias: 'string',
  },

  // JSON-like keys
  'property': { pattern: /"[^"]*"(?=\s*:)/, alias: 'attr-name' },

  // Numbers
  'number': /\b\d+(\.\d+)?\b/,

  // Variables Karate <var>
  'template-var': {
    pattern: /<[^>]+>/,
    alias: 'variable',
  },

  // Tags @tag
  'tag': {
    pattern: /@\w+/,
    alias: 'symbol',
  },

  // match operators
  'match-op': {
    pattern: /\b(contains|only|deep|not|any|each|==|!=)\b/,
    alias: 'operator',
  },

  // karate.* calls
  'karate-obj': {
    pattern: /\bkarate\.[a-zA-Z]+/,
    alias: 'class-name',
  },
};

// ─── Estilos del editor ───────────────────────────────────────────────────────
const EDITOR_STYLE = {
  fontFamily: '"Fira Code", "Cascadia Code", "JetBrains Mono", monospace',
  fontSize: 12.5,
  lineHeight: 1.7,
  minHeight: '300px',
  outline: 'none',
};

// ─── Componente ───────────────────────────────────────────────────────────────
export default function KarateEditor({ relativePath, initialContent, backendUrl, onSaved }) {
  const [code,    setCode]    = useState(initialContent || '');
  const [dirty,   setDirty]   = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [saveMsg, setSaveMsg] = useState(null); // { ok: bool, text: string }
  const [mode,    setMode]    = useState('edit'); // 'edit' | 'view'

  // Sincronizar cuando cambia el archivo seleccionado
  useEffect(() => {
    setCode(initialContent || '');
    setDirty(false);
    setSaveMsg(null);
  }, [relativePath, initialContent]);

  const handleChange = (val) => {
    setCode(val);
    setDirty(true);
    setSaveMsg(null);
  };

  const handleSave = useCallback(async () => {
    if (!dirty || !relativePath) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const res  = await fetch(`${backendUrl}/runner/features/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: relativePath, content: code }),
      });
      const data = await res.json();
      if (data.success) {
        setDirty(false);
        setSaveMsg({ ok: true, text: 'Guardado correctamente' });
        onSaved?.(code);
      } else {
        setSaveMsg({ ok: false, text: data.error || 'Error al guardar' });
      }
    } catch (err) {
      setSaveMsg({ ok: false, text: err.message });
    } finally {
      setSaving(false);
    }
  }, [dirty, relativePath, code, backendUrl, onSaved]);

  // Ctrl+S para guardar
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSave]);

  const highlight = (c) => Prism.highlight(c, Prism.languages.karate, 'karate');

  return (
    <div className="card p-0 overflow-hidden flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-black/20">
        <div className="flex items-center gap-3">
          <p className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Edit3 size={12} className="text-violet-400"/> Editor
          </p>
          {dirty && (
            <span className="flex items-center gap-1 text-[10px] text-amber-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block"/>
              Sin guardar
            </span>
          )}
          {saveMsg && (
            <span className={`flex items-center gap-1 text-[10px] font-medium ${saveMsg.ok ? 'text-green-400' : 'text-red-400'}`}>
              {saveMsg.ok ? <CheckCircle size={11}/> : <AlertTriangle size={11}/>}
              {saveMsg.text}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle edit / view */}
          <div className="flex items-center gap-0.5 bg-white/5 border border-white/10 rounded-lg p-0.5">
            <button onClick={() => setMode('edit')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all
                ${mode === 'edit' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
              <Edit3 size={10}/> Editar
            </button>
            <button onClick={() => setMode('view')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all
                ${mode === 'view' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
              <Eye size={10}/> Vista
            </button>
          </div>

          {/* Save button */}
          <button onClick={handleSave} disabled={!dirty || saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600/80 hover:bg-green-500
              disabled:opacity-30 disabled:cursor-not-allowed text-white text-[11px] font-semibold transition-all">
            {saving ? <Loader size={11} className="animate-spin"/> : <Save size={11}/>}
            {saving ? 'Guardando...' : 'Guardar'}
            <span className="text-green-300 text-[9px] font-normal">Ctrl+S</span>
          </button>
        </div>
      </div>

      {/* Editor o preview */}
      <div className="overflow-auto" style={{ maxHeight: '400px', backgroundColor: '#1a1b26' }}>
        {mode === 'edit' ? (
          <Editor
            value={code}
            onValueChange={handleChange}
            highlight={highlight}
            padding={16}
            style={EDITOR_STYLE}
            textareaClassName="focus:outline-none"
          />
        ) : (
          /* Vista: pre con syntax highlight, no editable */
          <pre className="p-4 m-0 text-[12.5px] leading-[1.7] font-mono overflow-auto"
               style={{ backgroundColor: 'transparent' }}
               dangerouslySetInnerHTML={{ __html: highlight(code) }} />
        )}
      </div>

      {/* Línea de estado */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t border-white/5 bg-black/20">
        <span className="text-[10px] text-slate-600 font-mono">Karate DSL</span>
        <span className="text-[10px] text-slate-600">{code.split('\n').length} líneas · {code.length} chars</span>
      </div>
    </div>
  );
}

