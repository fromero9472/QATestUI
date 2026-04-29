import React, { useState, useEffect, useCallback, useRef } from 'react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import { Save, Loader, CheckCircle, AlertTriangle, Edit3, Eye, FileText, Code2, Copy, Check } from 'lucide-react';

Prism.languages.karate = {
  comment: { pattern: /#.*/, greedy: true },
  'feature-keyword': {
    pattern: /^(Feature|Background|Scenario Outline|Scenario|Examples)(\s*:.*)?$/m,
    inside: {
      keyword: /^(Feature|Background|Scenario Outline|Scenario|Examples)/,
      title: /:.+/,
    },
  },
  'step-keyword': {
    pattern: /^\s*(Given|When|Then|And|But)\b/m,
    alias: 'keyword',
  },
  'star-step': {
    pattern: /^\s*\*\s.+/m,
    inside: {
      star: { pattern: /^\s*\*/, alias: 'operator' },
      'karate-fn': {
        pattern: /\b(def|set|call|callonce|configure|match|assert|print|read|pause|listen|signal)\b/,
        alias: 'function',
      },
      string: { pattern: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/, greedy: true },
      number: /\b\d+(\.\d+)?\b/,
      operator: /[=!<>]=?|&&|\|\||[+\-*/]/,
      variable: /\b[a-zA-Z_]\w*\b(?=\s*=)/,
    },
  },
  'http-keyword': {
    pattern: /\b(url|path|header|headers|request|response|status|method|params|param|form field|multipart|soap action|retry until)\b/,
    alias: 'keyword',
  },
  'http-method': {
    pattern: /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/,
    alias: 'builtin',
  },
  string: {
    pattern: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/,
    greedy: true,
  },
  docstring: {
    pattern: /"""[\s\S]*?"""/,
    greedy: true,
    alias: 'string',
  },
  property: { pattern: /"[^"]*"(?=\s*:)/, alias: 'attr-name' },
  number: /\b\d+(\.\d+)?\b/,
  'template-var': { pattern: /<[^>]+>/, alias: 'variable' },
  tag: { pattern: /@\w+/, alias: 'symbol' },
  'match-op': { pattern: /\b(contains|only|deep|not|any|each|==|!=)\b/, alias: 'operator' },
  'karate-obj': { pattern: /\bkarate\.[a-zA-Z]+/, alias: 'class-name' },
};

const EDITOR_STYLE = {
  fontFamily: '"Fira Code", "Cascadia Code", "JetBrains Mono", monospace',
  fontSize: 12.5,
  lineHeight: 1.7,
  minHeight: '300px',
  outline: 'none',
};

function parseKarateToFunctional(content = '') {
  const lines = content.split(/\r?\n/);
  const model = { featureName: '', background: [], scenarios: [] };

  let section = null;
  let currentScenario = null;
  let inDoc = false;
  let docLines = [];
  let lastStep = null;

  const pushStep = (target, step) => {
    target.push(step);
    lastStep = step;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (inDoc) {
      if (trimmed === '"""') {
        inDoc = false;
        if (lastStep) lastStep.doc = docLines.join('\n');
        docLines = [];
      } else {
        docLines.push(line);
      }
      continue;
    }

    if (!trimmed || trimmed.startsWith('#')) continue;

    if (/^Feature\s*:/i.test(trimmed)) {
      model.featureName = trimmed.replace(/^Feature\s*:\s*/i, '').trim();
      section = 'feature';
      continue;
    }

    if (/^Background\s*:/i.test(trimmed)) {
      section = 'background';
      continue;
    }

    const scenarioMatch = trimmed.match(/^Scenario(?: Outline)?\s*:\s*(.*)$/i);
    if (scenarioMatch) {
      currentScenario = {
        title: scenarioMatch[1] || 'Escenario',
        steps: [],
      };
      model.scenarios.push(currentScenario);
      section = 'scenario';
      continue;
    }

    if (trimmed === '"""') {
      inDoc = true;
      docLines = [];
      continue;
    }

    const starMatch = trimmed.match(/^\*\s+(.+)$/);
    const kwMatch = trimmed.match(/^(Given|When|Then|And|But)\s+(.+)$/i);

    const target = section === 'background'
      ? model.background
      : (section === 'scenario' && currentScenario ? currentScenario.steps : null);

    if (!target) continue;

    if (starMatch) {
      pushStep(target, { kind: 'star', keyword: '*', text: starMatch[1], doc: null });
      continue;
    }

    if (kwMatch) {
      pushStep(target, { kind: 'step', keyword: kwMatch[1], text: kwMatch[2], doc: null });
      continue;
    }
  }

  return model;
}

function summarizeStep(step) {
  const text = (step.text || '').trim();
  const lower = text.toLowerCase();

  if (lower.startsWith('path ')) return { label: 'Endpoint', value: text.replace(/^path\s+/i, '') };
  if (lower.startsWith('url ')) return { label: 'URL base', value: text.replace(/^url\s+/i, '') };
  if (lower.startsWith('header ')) return { label: 'Header', value: text.replace(/^header\s+/i, '') };
  if (lower.startsWith('request')) return { label: 'Payload', value: 'Se env�a un cuerpo JSON' };
  if (lower.startsWith('method ')) return { label: 'M�todo HTTP', value: text.replace(/^method\s+/i, '').toUpperCase() };
  if (lower.startsWith('status ')) return { label: 'Estado esperado', value: text.replace(/^status\s+/i, '') };
  if (lower.startsWith('match ')) return { label: 'Validaci�n', value: text.replace(/^match\s+/i, '') };

  return { label: step.kind === 'star' ? 'Regla t�cnica' : step.keyword, value: text };
}

function FunctionalView({ code }) {
  const model = parseKarateToFunctional(code);

  return (
    <div className="p-4 space-y-4 bg-black/10">
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Feature</p>
        <p className="text-sm font-semibold text-slate-100">{model.featureName || 'Sin t�tulo'}</p>
        <p className="text-xs text-slate-400 mt-1">
          {model.scenarios.length} escenario(s) � {model.background.length} regla(s) de contexto
        </p>
      </div>

      {model.background.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Contexto (Background)</p>
          <div className="space-y-2">
            {model.background.map((step, idx) => {
              const s = summarizeStep(step);
              return (
                <div key={`bg-${idx}`} className="rounded-lg border border-white/10 bg-black/20 p-2.5">
                  <p className="text-[11px] text-slate-400 mb-0.5">{s.label}</p>
                  <p className="text-xs text-slate-200 break-words">{s.value}</p>
                  {step.doc && <pre className="mt-2 text-[11px] text-slate-300 bg-black/30 rounded p-2 overflow-auto">{step.doc}</pre>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {model.scenarios.map((sc, sIdx) => (
          <div key={`sc-${sIdx}`} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-sm font-semibold text-slate-100">Escenario {sIdx + 1}</p>
              <span className="text-[11px] text-slate-400">{sc.steps.length} paso(s)</span>
            </div>
            <p className="text-xs text-slate-300 mb-3">{sc.title}</p>
            <div className="space-y-2">
              {sc.steps.map((step, stepIdx) => {
                const s = summarizeStep(step);
                return (
                  <div key={`step-${sIdx}-${stepIdx}`} className="rounded-lg border border-white/10 bg-black/20 p-2.5">
                    <p className="text-[11px] text-slate-400 mb-0.5">{s.label}</p>
                    <p className="text-xs text-slate-200 break-words">{s.value}</p>
                    {step.doc && <pre className="mt-2 text-[11px] text-slate-300 bg-black/30 rounded p-2 overflow-auto">{step.doc}</pre>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function KarateEditor({ relativePath, initialContent, backendUrl, onSaved, jumpToLine }) {
  const [code, setCode] = useState(initialContent || '');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [mode, setMode] = useState('edit'); // edit | code | functional
  const [copied, setCopied] = useState(false);
  const editorHostRef = useRef(null);

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
      const res = await fetch(`${backendUrl}/runner/features/save`, {
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

  const handleCopyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error('Error copying code');
    }
  }, [code]);

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

  useEffect(() => {
    const targetLine = Number(jumpToLine?.line);
    if (!targetLine || targetLine < 1) return;

    setMode('edit');
    let attempts = 0;
    const maxAttempts = 20;
    const jump = () => {
      const textarea = editorHostRef.current?.querySelector('textarea');
      if (!textarea) return;

      const lines = code.split('\n');
      const clampedLine = Math.min(targetLine, Math.max(lines.length, 1));
      let cursorPos = 0;
      for (let i = 0; i < clampedLine - 1; i += 1) {
        cursorPos += (lines[i] || '').length + 1;
      }

      textarea.focus();
      textarea.setSelectionRange(cursorPos, cursorPos);

      const computedLineHeight = parseFloat(window.getComputedStyle(textarea).lineHeight) || 20;
      const scrollTop = Math.max((clampedLine - 3) * computedLineHeight, 0);
      textarea.scrollTop = scrollTop;
      if (editorHostRef.current) editorHostRef.current.scrollTop = scrollTop;
    };

    const tryJump = () => {
      attempts += 1;
      const textarea = editorHostRef.current?.querySelector('textarea');
      if (!textarea && attempts < maxAttempts) {
        setTimeout(tryJump, 30);
        return;
      }
      jump();
    };

    requestAnimationFrame(tryJump);
  }, [jumpToLine, code]);

  const highlight = (c) => Prism.highlight(c, Prism.languages.karate, 'karate');

  return (
    <div className="card p-0 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-black/20">
        <div className="flex items-center gap-3">
          <p className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Edit3 size={12} className="text-violet-400" /> Editor
          </p>
          {dirty && (
            <span className="flex items-center gap-1 text-[10px] text-amber-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
              Sin guardar
            </span>
          )}
          {saveMsg && (
            <span className={`flex items-center gap-1 text-[10px] font-medium ${saveMsg.ok ? 'text-green-400' : 'text-red-400'}`}>
              {saveMsg.ok ? <CheckCircle size={11} /> : <AlertTriangle size={11} />}
              {saveMsg.text}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 bg-white/5 border border-white/10 rounded-lg p-0.5">
            <button
              onClick={() => setMode('edit')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${mode === 'edit' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Edit3 size={10} /> Editar
            </button>
            <button
              onClick={() => setMode('code')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${mode === 'code' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Code2 size={10} /> Codigo
            </button>
            <button
              onClick={() => setMode('functional')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${mode === 'functional' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <FileText size={10} /> Funcional
            </button>
           </div>

           <div className="flex items-center gap-2">
             <button
               onClick={handleCopyCode}
               className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${copied ? 'bg-green-600/80 text-white' : 'bg-white/5 border border-white/10 text-slate-400 hover:text-slate-200'}`}
             >
               {copied ? <><Check size={11} /> Copiado!</> : <><Copy size={11} /> Copiar</>}
             </button>
             <button
               onClick={handleSave}
               disabled={!dirty || saving}
               className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600/80 hover:bg-green-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-[11px] font-semibold transition-all"
             >
               {saving ? <Loader size={11} className="animate-spin" /> : <Save size={11} />}
               {saving ? 'Guardando...' : 'Guardar'}
               <span className="text-green-300 text-[9px] font-normal">Ctrl+S</span>
             </button>
           </div>
        </div>
      </div>

      <div ref={editorHostRef} className="overflow-auto" style={{ maxHeight: '460px', backgroundColor: '#1a1b26' }}>
        {mode === 'edit' && (
          <Editor
            value={code}
            onValueChange={handleChange}
            highlight={highlight}
            padding={16}
            style={EDITOR_STYLE}
            textareaClassName="focus:outline-none"
          />
        )}

        {mode === 'code' && (
          <pre
            className="p-4 m-0 text-[12.5px] leading-[1.7] font-mono overflow-auto"
            style={{ backgroundColor: 'transparent' }}
            dangerouslySetInnerHTML={{ __html: highlight(code) }}
          />
        )}

        {mode === 'functional' && <FunctionalView code={code} />}
      </div>

      <div className="flex items-center justify-between px-4 py-1.5 border-t border-white/5 bg-black/20">
        <span className="text-[10px] text-slate-600 font-mono">Karate DSL</span>
        <span className="text-[10px] text-slate-600">{code.split('\n').length} lineas � {code.length} chars</span>
      </div>
    </div>
  );
}

