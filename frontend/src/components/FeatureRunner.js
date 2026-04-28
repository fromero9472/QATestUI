import React, { useState, useEffect, useRef } from 'react';
import {
  Play, RefreshCw, FileCode, Terminal,
  CheckCircle, XCircle, Loader, Wifi, WifiOff, BarChart2,
  Globe, Sparkles, AlertTriangle, Lightbulb, ChevronDown, ChevronUp,
  Cpu, ArrowRight, Plus, Upload, Download, Pencil, Trash2, Check, X, Settings,
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import KarateEditor from './KarateEditor';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

const ENV_STORAGE_KEY = 'qatestui_runner_envs';
const RUNNER_PROPS_STORAGE_KEY = 'qatestui_runner_properties_v1';
const DEFAULT_ENVS = [
  { id: 'desa', label: 'desa', baseUrl: 'https://credit-profile-claropay-ar-desa.apps.osen02.claro.amx' },
  { id: 'prod', label: 'prod', baseUrl: 'https://credit-profile-claropay-ar-prod.apps.osen02.claro.amx' },
];

function normalizeEnv(item = {}) {
  const label = String(item.label || item.id || '').trim();
  const id = String(item.id || label.toLowerCase().replace(/\s+/g, '-')).trim();
  const defaultBaseUrl = DEFAULT_ENVS.find((e) => e.id === id)?.baseUrl || '';
  return {
    id,
    label: label || id,
    baseUrl: String(item.baseUrl || defaultBaseUrl).trim(),
  };
}

function normalizeEnvs(input) {
  const source = Array.isArray(input) && input.length ? input : DEFAULT_ENVS;
  return source
    .map((item) => normalizeEnv(item))
    .filter((item) => item.id);
}

function loadEnvs() {
  try {
    const saved = localStorage.getItem(ENV_STORAGE_KEY);
    if (saved) return normalizeEnvs(JSON.parse(saved));
  } catch {}
  return normalizeEnvs(DEFAULT_ENVS);
}
function saveEnvs(envs) {
  localStorage.setItem(ENV_STORAGE_KEY, JSON.stringify(normalizeEnvs(envs)));
}

function loadRunnerProperties() {
  try {
    const saved = localStorage.getItem(RUNNER_PROPS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        global: typeof parsed.global === 'string' ? parsed.global : '{}',
        perFeature: parsed.perFeature && typeof parsed.perFeature === 'object' ? parsed.perFeature : {},
      };
    }
  } catch {}
  return { global: '{}', perFeature: {} };
}

function generateKarateFeature(form) {
  const safe = (v = '') => String(v).replace(/\r?\n/g, ' ').trim();
  const featureName = safe(form?.featureName || 'FeatureImportado');
  const endpoint = safe(form?.endpoint || '/');
  const baseUrl = safe(form?.baseUrl || '');
  const scenarios = Array.isArray(form?.scenarios) ? form.scenarios : [];

  const lines = [
    `Feature: ${featureName}`,
    '',
    '  Background:',
    `    * def _featureBaseUrl = '${baseUrl}'`,
    '    * url _featureBaseUrl != \'\' ? _featureBaseUrl : baseUrl',
    '',
  ];

  scenarios.forEach((s, idx) => {
    const method = safe((s?.method || 'GET').toUpperCase());
    const name = safe(s?.name || `Escenario ${idx + 1}`);
    const expectedStatus = Number(s?.expectedStatus || 200);
    lines.push(`  Scenario: ${name}`);
    lines.push(`    Given path '${endpoint}'`);

    (s?.params || []).forEach((p) => {
      if (p?.key) lines.push(`    And param ${safe(p.key)} = '${safe(p.value)}'`);
    });
    (s?.headers || []).forEach((h) => {
      if (h?.key) lines.push(`    And header ${safe(h.key)} = '${safe(h.value)}'`);
    });

    const body = (s?.body || '').trim();
    if (body) {
      lines.push('    And request');
      lines.push('    """');
      lines.push(body);
      lines.push('    """');
    }

    lines.push(`    When method ${method}`);
    lines.push(`    Then status ${expectedStatus}`);
    (s?.assertions || []).forEach((a) => {
      if (!a?.field) return;
      const op = safe(a.operator || '!= null');
      const value = (a?.value || '').trim();
      lines.push(value
        ? `    And match response.${safe(a.field)} ${op} ${value}`
        : `    And match response.${safe(a.field)} ${op}`
      );
    });
    lines.push('');
  });

  return lines.join('\n');
}

// // AI provider mini-selector
function RunnerAIPanel({ open, setOpen }) {
  const { providers, model, currentProvider, setModel, setApiKey, setOllamaUrl,
          changeProvider, isGitHubLoggedIn, loginWithGitHub, apiKey, ollamaUrl } = useAuth();
  return (
    <div className="rounded-xl border border-[#1e293b] overflow-hidden">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#0b0f1a] hover:bg-white/[0.02] transition-colors text-sm">
        <div className="flex items-center gap-2 text-slate-300 font-medium">
          <Cpu size={14} className="text-violet-400" />
          IA para analisis: <span className="text-violet-400">{currentProvider.label}</span>
          <span className="text-slate-500 font-mono text-xs">? {model}</span>
        </div>
        {open ? <ChevronUp size={13} className="text-slate-500" /> : <ChevronDown size={13} className="text-slate-500" />}
      </button>
      {open && (
        <div className="p-4 space-y-3 bg-[#0d1117] border-t border-[#1e293b]">
          <div className="flex flex-wrap gap-2">
            {providers.map(p => (
              <button key={p.id} type="button" onClick={() => changeProvider(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all
                  ${currentProvider.id === p.id ? 'bg-violet-500/20 border-violet-500/40 text-violet-300' : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            {currentProvider.models?.map(m => (
              <button key={m} type="button" onClick={() => setModel(m)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all
                  ${model === m ? 'bg-blue-500/20 border-blue-500/30 text-blue-300' : 'bg-white/5 border-white/10 text-slate-500 hover:text-slate-300'}`}>
                {m}
              </button>
            ))}
          </div>
          {currentProvider.requiresKey && (
            <input type="password" className="form-control text-xs font-mono"
              placeholder={`API Key de ${currentProvider.label}`}
              defaultValue={apiKey} onBlur={e => setApiKey(e.target.value)} />
          )}
          {currentProvider.authType === 'oauth' && !isGitHubLoggedIn && (
            <button type="button" onClick={() => loginWithGitHub(currentProvider.id)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 text-xs font-semibold hover:bg-white/10 transition-all">
              Conectar GitHub para usar {currentProvider.label}
            </button>
          )}
          {currentProvider.id === 'ollama' && (
            <input type="text" className="form-control text-xs font-mono"
              placeholder="http://localhost:11434" defaultValue={ollamaUrl}
              onBlur={e => setOllamaUrl(e.target.value)} />
          )}
        </div>
      )}
    </div>
  );
}

function AIAnalysis({ logs, featureName, exitCode, summary }) {
  const { buildAIPayload } = useAuth();
  const [analysis, setAnalysis] = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  const analyze = async () => {
    setLoading(true); setError(null); setAnalysis(null);
    try {
      // Keep the request small and stable; backend also trims before sending to AI.
      const compactLogs = (logs || [])
        .slice(-250)
        .map((l) => ({
          type: l?.type || 'info',
          text: String(l?.text || '').slice(0, 1200),
        }));

      const res  = await fetch(`${BACKEND_URL}/runner/analyze`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logs: compactLogs,
          featureName,
          exitCode,
          summary,
          ...buildAIPayload({}),
        }),
      });

      const raw = await res.text();
      let data = null;
      try { data = JSON.parse(raw); }
      catch {
        if (!res.ok) throw new Error(`Error ${res.status}: respuesta no JSON del backend.`);
        throw new Error('Respuesta inv�lida del backend.');
      }
      if (!res.ok || !data.success) throw new Error(data?.error || `Error ${res.status}`);
      setAnalysis(data.analysis);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <p className="card__title mb-0"><Sparkles size={14} className="text-violet-400" /> Analisis con IA</p>
        {!analysis
          ? <button onClick={analyze} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600/80 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-semibold transition-all">
              {loading ? <><Loader size={12} className="animate-spin" /> Analizando...</> : <><Sparkles size={12} /> {exitCode !== 0 ? 'Diagnosticar error' : 'Analizar resultado'}</>}
            </button>
          : <button onClick={analyze} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-slate-200 text-xs transition-all">
              <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Reanalizar
            </button>}
      </div>
      {error && <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs"><AlertTriangle size={13}/>{error}</div>}
      {loading && !analysis && <div className="flex items-center justify-center py-8 text-slate-500 text-xs gap-2"><Loader size={14} className="animate-spin text-violet-400"/>La IA est? analizando el output...</div>}
      {analysis && (
        <div className="space-y-3">
          <div className={`flex items-start gap-3 p-3 rounded-xl border text-xs ${analysis.status === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-200' : 'bg-red-500/10 border-red-500/20 text-red-200'}`}>
            {analysis.status === 'success' ? <CheckCircle size={14} className="mt-0.5 shrink-0 text-green-400"/> : <XCircle size={14} className="mt-0.5 shrink-0 text-red-400"/>}
            <p className="leading-relaxed">{analysis.summary}</p>
          </div>
          {analysis.rootCause && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <p className="text-xs font-semibold text-amber-400 mb-1 flex items-center gap-1.5"><AlertTriangle size={12}/>Causa ra?z</p>
              <p className="text-xs text-amber-200 leading-relaxed">{analysis.rootCause}</p>
            </div>
          )}
          {analysis.failedTests?.length > 0 && (
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <p className="text-xs font-semibold text-slate-300 mb-2">Tests fallidos</p>
              <ul className="space-y-1">{analysis.failedTests.map((t,i) => <li key={i} className="flex items-start gap-2 text-xs text-red-300"><XCircle size={11} className="mt-0.5 shrink-0"/>{t}</li>)}</ul>
            </div>
          )}
          {analysis.fixes?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-300 flex items-center gap-1.5"><Lightbulb size={13} className="text-violet-400"/>C?mo resolverlo</p>
              {analysis.fixes.map((fix,i) => (
                <div key={i} className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
                  <p className="text-xs font-semibold text-violet-300 mb-1">{fix.title}</p>
                  <p className="text-xs text-slate-300 leading-relaxed">{fix.description}</p>
                </div>
              ))}
            </div>
          )}
          {analysis.nextSteps?.length > 0 && (
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <p className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5"><ArrowRight size={12} className="text-blue-400"/>Pr?ximos pasos</p>
              <ol className="space-y-1">{analysis.nextSteps.map((s,i) => <li key={i} className="text-xs text-slate-300 flex items-start gap-2"><span className="text-blue-400 font-bold shrink-0">{i+1}.</span>{s}</li>)}</ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReportSummary({ summary }) {
  if (!summary) return null;
  const { featuresPassed=0, featuresFailed=0, scenariosPassed=0, scenariosfailed=0, elapsedTime } = summary;
  const allOk = featuresFailed === 0 && scenariosfailed === 0;
  return (
    <div className={`card border ${allOk ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
      <div className="flex items-center gap-2 mb-3"><BarChart2 size={14} className={allOk?'text-green-400':'text-red-400'}/><p className="text-xs font-semibold text-slate-200">?ltimo reporte Karate</p></div>
      <div className="grid grid-cols-4 gap-3">
        {[{label:'Features OK',val:featuresPassed,color:'text-green-400'},{label:'Features fail',val:featuresFailed,color:'text-red-400'},{label:'Scenarios OK',val:scenariosPassed,color:'text-green-400'},{label:'Scenarios fail',val:scenariosfailed,color:'text-red-400'}].map(({label,val,color})=>(
          <div key={label} className="text-center p-2 rounded-xl bg-black/20"><p className={`text-xl font-bold ${color}`}>{val}</p><p className="text-[10px] text-slate-400 mt-0.5">{label}</p></div>
        ))}
      </div>
      {elapsedTime && <p className="text-[10px] text-slate-500 mt-2 text-right">Tiempo: {(elapsedTime/1000).toFixed(1)}s</p>}
    </div>
  );
}

function FeatureItem({ feature, selected, onSelect, onRename, onDelete, onExport }) {
  const [renaming,  setRenaming]  = useState(false);
  const [newName,   setNewName]   = useState('');
  const [hovering,  setHovering]  = useState(false);
  const [deleting,  setDeleting]  = useState(false);
  const inputRef = useRef(null);

  const startRename = (e) => {
    e.stopPropagation();
    setNewName(feature.name.replace('.feature', ''));
    setRenaming(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const confirmRename = () => {
    if (newName.trim() && newName.trim() !== feature.name.replace('.feature','')) {
      onRename(feature, newName.trim());
    }
    setRenaming(false);
  };

  const cancelRename = () => setRenaming(false);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') confirmRename();
    if (e.key === 'Escape') cancelRename();
  };

  if (renaming) {
    return (
      <li className="px-1">
        <div className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-violet-600 border border-violet-400">
          <input ref={inputRef} value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-xs font-mono text-white outline-none min-w-0" />
          <span className="text-violet-200 text-[10px] shrink-0">.feature</span>
          <button onClick={confirmRename} className="p-0.5 text-green-300 hover:text-green-100 transition-all"><Check size={12}/></button>
          <button onClick={cancelRename}  className="p-0.5 text-violet-200 hover:text-white transition-all"><X size={12}/></button>
        </div>
      </li>
    );
  }

   return (
     <li onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
       <div className={`flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs transition-all cursor-pointer
         ${selected ? 'bg-violet-600 border border-violet-500 text-white font-semibold' : 'hover:bg-white/5 text-slate-300 border border-transparent'}`}
         onClick={() => onSelect(feature)}>
         <span className="truncate font-mono flex-1">{feature.name.replace('.feature','')}</span>
        {/* Botones inline: solo al hover */}
        {hovering && (
          <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
            <button onClick={(e) => { e.stopPropagation(); onExport(feature); }}
              title="Exportar" className={`p-1 rounded transition-all ${selected ? 'hover:bg-white/20 text-violet-200 hover:text-white' : 'hover:bg-white/10 text-slate-500 hover:text-blue-400'}`}>
              <Download size={10}/>
            </button>
            <button onClick={startRename}
              title="Renombrar" className={`p-1 rounded transition-all ${selected ? 'hover:bg-white/20 text-violet-200 hover:text-white' : 'hover:bg-white/10 text-slate-500 hover:text-violet-400'}`}>
              <Pencil size={10}/>
            </button>
            {!deleting
              ? <button onClick={() => setDeleting(true)}
                  title="Eliminar" className={`p-1 rounded transition-all ${selected ? 'hover:bg-white/20 text-violet-200 hover:text-red-300' : 'hover:bg-white/10 text-slate-500 hover:text-red-400'}`}>
                  <Trash2 size={10}/>
                </button>
              : <div className="flex items-center gap-0.5">
                  <button onClick={() => { onDelete(feature); setDeleting(false); }}
                    className="p-1 rounded bg-red-500/30 text-red-300 hover:bg-red-500/50 transition-all">
                    <Check size={10}/>
                  </button>
                  <button onClick={() => setDeleting(false)}
                    className={`p-1 rounded transition-all ${selected ? 'text-violet-200 hover:bg-white/20' : 'text-slate-500 hover:bg-white/10 hover:text-slate-300'}`}>
                    <X size={10}/>
                  </button>
                </div>
            }
          </div>
        )}
      </div>
    </li>
  );
}

function CreateModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState('');

  const submit = async () => {
    if (!name.trim()) return setErr('Ingres? un nombre');
    setBusy(true); setErr('');
    const ok = await onCreate(name.trim());
    if (!ok) setErr('No se pudo crear. ?Ya existe ese nombre?');
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-96 rounded-2xl bg-[#0d1117] border border-[#1e293b] shadow-2xl p-6">
        <p className="font-semibold text-slate-100 mb-4 flex items-center gap-2"><Plus size={16} className="text-violet-400"/>Nuevo Feature</p>
        <input autoFocus value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          className="form-control mb-1" placeholder="Ej: PCP-99999" />
        <p className="text-[10px] text-slate-500 mb-4">Se crear? como <span className="font-mono text-slate-400">{name || 'nombre'}.feature</span></p>
        {err && <p className="text-xs text-red-400 mb-3">{err}</p>}
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-slate-200 text-xs font-semibold transition-all">Cancelar</button>
          <button onClick={submit} disabled={busy}
            className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-semibold transition-all flex items-center gap-2">
            {busy ? <Loader size={12} className="animate-spin"/> : <Plus size={12}/>} Crear
          </button>
        </div>
      </div>
    </div>
  );
}

function EnvConfigModal({ envs, onClose, onSave }) {
  const [list, setList] = useState(normalizeEnvs(envs));
  const [newLabel, setNewLabel] = useState('');
  const [newBaseUrl, setNewBaseUrl] = useState('');
  const [err, setErr] = useState('');

  const addEnv = () => {
    const label = newLabel.trim();
    const id = label.toLowerCase().replace(/\s+/g, '-');
    const baseUrl = newBaseUrl.trim();
    if (!label) return setErr('Ingresa un nombre');
    if (list.find((e) => e.id === id)) return setErr('Ya existe ese ambiente');
    setList((prev) => [...prev, { id, label, baseUrl }]);
    setNewLabel('');
    setNewBaseUrl('');
    setErr('');
  };

  const removeEnv = (id) => {
    if (list.length <= 1) return setErr('Debe haber al menos un ambiente');
    setList((prev) => prev.filter((e) => e.id !== id));
    setErr('');
  };

  const updateEnv = (id, patch) => {
    setList((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    setErr('');
  };

  const confirmUpdateLabel = (id, val) => {
    const label = val.trim();
    if (!label) return;
    const newId = label.toLowerCase().replace(/\s+/g, '-');
    if (newId !== id && list.some((e) => e.id === newId)) {
      setErr('Ya existe ese ambiente');
      return;
    }
    setList((prev) => prev.map((e) => (e.id === id ? { ...e, id: newId, label } : e)));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[720px] max-w-[95vw] rounded-2xl bg-[#0d1117] border border-[#1e293b] shadow-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold text-slate-100 flex items-center gap-2">
            <Settings size={15} className="text-violet-400"/> Configurar ambientes
          </p>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-all"><X size={14}/></button>
        </div>

        <p className="text-xs text-slate-500 mb-4">
          Se pasan como <code className="bg-white/5 px-1.5 rounded font-mono">-Dkarate.env=nombre</code> a Maven.
        </p>

        <div className="space-y-2 mb-4">
          {list.map(e => (
            <div key={e.id} className="grid grid-cols-[180px_1fr_auto_auto] gap-2 items-center">
              <input value={e.label}
                onChange={ev => updateEnv(e.id, { label: ev.target.value })}
                onBlur={ev => confirmUpdateLabel(e.id, ev.target.value)}
                onKeyDown={ev => ev.key === 'Enter' && ev.target.blur()}
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-200 text-xs font-mono outline-none focus:border-violet-500 transition-all"/>
              <input value={e.baseUrl || ''}
                onChange={ev => updateEnv(e.id, { baseUrl: ev.target.value })}
                placeholder="https://api.mi-ambiente.com"
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-200 text-xs font-mono outline-none focus:border-violet-500 transition-all"/>
              <span className="text-[10px] text-slate-600 font-mono shrink-0 w-20 truncate">id: {e.id}</span>
              <button onClick={() => removeEnv(e.id)}
                className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all shrink-0">
                <Trash2 size={12}/>
              </button>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-[180px_1fr_auto] gap-2 mb-1">
          <input value={newLabel} onChange={e => { setNewLabel(e.target.value); setErr(''); }}
            onKeyDown={e => e.key === 'Enter' && addEnv()}
            placeholder="Nuevo ambiente (ej: staging)"
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-200 text-xs font-mono outline-none focus:border-violet-500 transition-all"/>
          <input value={newBaseUrl} onChange={e => { setNewBaseUrl(e.target.value); setErr(''); }}
            onKeyDown={e => e.key === 'Enter' && addEnv()}
            placeholder="URL base (ej: https://api-stg.midominio.com)"
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-200 text-xs font-mono outline-none focus:border-violet-500 transition-all"/>
          <button onClick={addEnv}
            className="px-3 py-2 rounded-lg bg-violet-600/80 hover:bg-violet-500 text-white text-xs font-semibold transition-all flex items-center gap-1.5">
            <Plus size={12}/> Agregar
          </button>
        </div>
        {err && <p className="text-xs text-red-400 mt-1 mb-2">{err}</p>}

        <div className="flex gap-2 justify-end mt-5 pt-4 border-t border-white/5">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-slate-200 text-xs font-semibold transition-all">
            Cancelar
          </button>
          <button onClick={() => { onSave(normalizeEnvs(list)); onClose(); }}
            className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-all flex items-center gap-2">
            <Check size={12}/> Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// Componente principal
export default function FeatureRunner() {
  const [agentStatus, setAgentStatus] = useState('checking');
  const [features,    setFeatures]    = useState([]);
  const [loadingList, setLoadingList] = useState(false);
   const [selected,    setSelected]    = useState(null);
   const [fileContent, setFileContent] = useState('');
   const [envs,        setEnvs]        = useState(() => loadEnvs());
   const [env,         setEnv]         = useState(() => loadEnvs()[0]?.id || 'desa');
   const [showEnvConfig, setShowEnvConfig] = useState(false);
   const runnerProps = loadRunnerProperties();
   const [logs,        setLogs]        = useState([]);
   const [running,     setRunning]     = useState(false);
   const [runResult,   setRunResult]   = useState(null);
   const [lastReport,  setLastReport]  = useState(null);
   const [aiPanelOpen, setAiPanelOpen] = useState(false);
   const [showCreate,  setShowCreate]  = useState(false);
   const [toastMsg,    setToastMsg]    = useState('');
   const logsEndRef   = useRef(null);
   const importRef    = useRef(null);

  useEffect(() => { checkAgent(); }, []); // eslint-disable-line
  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  // Load from Confluence Import if available
  useEffect(() => {
    const confluenceData = localStorage.getItem('qatestui_confluence_import');
    if (confluenceData && agentStatus === 'ok') {
      try {
        const form = JSON.parse(confluenceData);
        const featureContent = generateKarateFeature(form);
        const featureName = `${form.featureName || 'Feature'}-${Date.now()}`;

        api('POST', '/runner/features/create', { name: featureName })
          .then((created) => {
            if (!created?.success || !created?.feature?.relativePath) {
              throw new Error(created?.error || 'No se pudo crear el feature en Runner');
            }
            return api('POST', '/runner/features/save', {
              path: created.feature.relativePath,
              content: featureContent,
            }).then((saved) => {
              if (!saved?.success) throw new Error(saved?.error || 'No se pudo guardar el feature');
              return created.feature;
            });
          })
          .then((createdFeature) => {
            localStorage.removeItem('qatestui_confluence_import');
            fetchFeatures();
            selectFeature(createdFeature);
            toast('Feature desde Confluence cargado al Runner');
          })
          .catch(err => console.warn('Error loading confluence import:', err));
      } catch (err) {
        console.warn('Error parsing confluence import:', err);
      }
    }
  }, [agentStatus]);

  const toast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3000); };

  const parsePropsJson = (text, label) => {
    const raw = (text || '').trim();
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`${label} debe ser un JSON objeto`);
      }
      return parsed;
    } catch (err) {
      throw new Error(`${label} inv�lido: ${err.message}`);
    }
  };

   const persistRunnerProps = (next) => {
     localStorage.setItem(RUNNER_PROPS_STORAGE_KEY, JSON.stringify(next));
   };

   const handleSaveEnvs = (newEnvs) => {
    saveEnvs(newEnvs);
    setEnvs(newEnvs);
    if (!newEnvs.find(e => e.id === env)) setEnv(newEnvs[0]?.id || '');
    toast('Ambientes guardados');
  };

  const api = async (method, path, body) => {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  };

  const checkAgent = async () => {
    setAgentStatus('checking');
    try {
      const data = await api('GET', '/runner/health');
      if (data.status === 'OK') { setAgentStatus('ok'); fetchFeatures(); fetchReport(); }
      else setAgentStatus('down');
    } catch { setAgentStatus('down'); }
  };

  const fetchFeatures = async () => {
    setLoadingList(true);
    try { const d = await api('GET', '/runner/features'); setFeatures(d.features || []); }
    catch { setFeatures([]); }
    finally { setLoadingList(false); }
  };

  const fetchReport = async () => {
    try { const d = await api('GET', '/runner/report'); if (d.success) setLastReport(d.summary); } catch {}
  };

   const selectFeature = async (feature) => {
     setSelected(feature); setRunResult(null); setLogs([]); setFileContent('');
     try { const d = await api('GET', `/runner/features/content?path=${encodeURIComponent(feature.relativePath)}`); setFileContent(d.content || ''); }
     catch { setFileContent('// Error al cargar el archivo'); }
   };

   const handleRename = async (feature, newName) => {
    const d = await api('POST', '/runner/features/rename', { oldPath: feature.relativePath, newName });
    if (d.success) {
      toast(`✅ Renombrado a ${d.feature.name}`);
      setFeatures(prev => prev.map(f => f.relativePath === feature.relativePath ? d.feature : f));
      if (selected?.relativePath === feature.relativePath) setSelected(d.feature);
    } else {
      toast(`�?� ${d.error}`);
    }
  };

  const handleDelete = async (feature) => {
    const d = await api('DELETE', '/runner/features', { path: feature.relativePath });
    if (d.success) {
      toast(`🗑 ${feature.name} eliminado`);
      setFeatures(prev => prev.filter(f => f.relativePath !== feature.relativePath));
      if (selected?.relativePath === feature.relativePath) { setSelected(null); setFileContent(''); setLogs([]); setRunResult(null); }
    } else { toast(`�?� ${d.error}`); }
  };

  const handleExport = async (feature) => {
    try {
      const d = await api('GET', `/runner/features/content?path=${encodeURIComponent(feature.relativePath)}`);
      const blob = new Blob([d.content], { type: 'text/plain' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = feature.name;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast(`⬇ Exportado: ${feature.name}`);
    } catch { toast('Error al exportar'); }
  };

  const handleCreate = async (name) => {
    const d = await api('POST', '/runner/features/create', { name });
    if (d.success) {
      toast(`✅ Creado: ${d.feature.name}`);
      setFeatures(prev => [...prev, d.feature]);
      setShowCreate(false);
      selectFeature(d.feature);
      return true;
    }
    return false;
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    const d = await api('POST', '/runner/features/import', { name: file.name, content });
    if (d.success) {
      toast(`✅ Importado: ${d.feature.name}`);
      setFeatures(prev => [...prev, d.feature]);
      selectFeature(d.feature);
    } else { toast(`�?� ${d.error}`); }
    e.target.value = '';
  };

  const runFeature = async (featurePath) => {
    setLogs([]); setRunResult(null); setRunning(true);
    try {
      const globalProps = parsePropsJson(runnerProps.global, 'Properties globales');
      const selectedFeaturePropsRaw = featurePath ? (runnerProps.perFeature?.[featurePath] || '{}') : '{}';
      const selectedFeatureProps = parsePropsJson(selectedFeaturePropsRaw, 'Properties del feature');
      const mergedProperties = { ...globalProps, ...selectedFeatureProps };

      const res = await fetch(`${BACKEND_URL}/runner/run`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          featurePath: featurePath || null,
          env,
          baseUrl: envs.find(e => e.id === env)?.baseUrl || '',
          properties: mergedProperties,
        }),
      });
      const reader = res.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n'); buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const { type, data } = JSON.parse(line.slice(6));
            if (type === 'done') { setRunResult(data); if (data.summary) setLastReport(data.summary); }
            else setLogs(prev => [...prev, { type, text: typeof data === 'string' ? data : JSON.stringify(data) }]);
          } catch {}
        }
      }
    } catch (err) {
      setLogs(prev => [...prev, { type: 'error', text: err.message }]);
      setRunResult({ success: false, exitCode: 1, message: 'Error de conexion' });
    } finally { setRunning(false); }
  };

  return (
    <div className="space-y-4">
      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
      {showEnvConfig && <EnvConfigModal envs={envs} onClose={() => setShowEnvConfig(false)} onSave={handleSaveEnvs} />}

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-[#0d1117] border border-[#1e293b] text-slate-200 text-xs font-semibold shadow-xl animate-pulse">
          {toastMsg}
        </div>
      )}

      {/* Panel IA */}
      <RunnerAIPanel open={aiPanelOpen} setOpen={setAiPanelOpen} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {agentStatus === 'checking' && <Loader size={12} className="animate-spin text-slate-400"/>}
          {agentStatus === 'ok'       && <Wifi size={12} className="text-green-400"/>}
          {agentStatus === 'down'     && <WifiOff size={12} className="text-red-400"/>}
          <span className={`text-[11px] font-semibold ${agentStatus === 'ok' ? 'text-green-400' : agentStatus === 'down' ? 'text-red-400' : 'text-slate-400'}`}>
            {agentStatus === 'ok' ? 'Agente activo' : agentStatus === 'down' ? 'Agente ca?do' : 'Verificando...'}
          </span>
          <button onClick={checkAgent} className="p-0.5 rounded hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-all"><RefreshCw size={11}/></button>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <Globe size={13} className="text-slate-400"/>
            <span className="text-xs text-slate-400">Ambiente:</span>
            <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
              {envs.map(e => (
                <button key={e.id} onClick={() => setEnv(e.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all
                    ${env === e.id ? 'bg-violet-600 text-white shadow shadow-violet-500/30' : 'text-slate-400 hover:text-slate-200'}`}>
                  {e.label}
                </button>
               ))}
             </div>
             <button onClick={() => setShowEnvConfig(true)} title="Configurar ambientes"
               className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-violet-400 transition-all">
               <Settings size={13}/>
             </button>
           </div>
          {/* Base URL del ambiente seleccionado */}
          {envs.find(e => e.id === env)?.baseUrl && (
            <p className="text-[10px] font-mono text-slate-500 truncate max-w-xs" title={envs.find(e => e.id === env)?.baseUrl}>
              URL: {envs.find(e => e.id === env)?.baseUrl}
            </p>
          )}
         </div>
       </div>

       {agentStatus === 'down' && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300">
          <WifiOff size={16} className="mt-0.5 shrink-0"/>
          <div>
            <p className="font-semibold text-sm">Runner Agent no disponible</p>
            <p className="text-xs text-red-400 mt-1">Ejecut? <code className="bg-red-500/20 px-1 rounded">start.ps1</code> o verific? que el agente est? en <code className="bg-red-500/20 px-1 rounded">localhost:4000</code>.</p>
          </div>
        </div>
      )}

      {agentStatus === 'ok' && (
        <div className="flex gap-4" style={{ minHeight: '60vh' }}>

          {/* Lista features con gesti?n */}
          <div className="w-64 shrink-0 flex flex-col gap-3">
            <div className="card flex-1 flex flex-col">
              {/* Header lista */}
              <div className="flex items-center justify-between mb-3">
                <p className="card__title mb-0"><FileCode size={13}/> Features</p>
                <button onClick={fetchFeatures} className="p-1 rounded-lg hover:bg-white/5 text-slate-400 hover:text-slate-200 transition-all">
                  <RefreshCw size={12} className={loadingList ? 'animate-spin' : ''}/>
                </button>
              </div>

              {/* Acciones: crear + importar */}
              <div className="flex gap-1.5 mb-3">
                <button onClick={() => setShowCreate(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-300 hover:bg-violet-500/20 text-[11px] font-semibold transition-all">
                  <Plus size={11}/> Nuevo
                </button>
                <button onClick={() => importRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 hover:bg-blue-500/20 text-[11px] font-semibold transition-all">
                  <Upload size={11}/> Importar
                </button>
                <input ref={importRef} type="file" accept=".feature" className="hidden" onChange={handleImport}/>
              </div>

              {/* Lista */}
              {loadingList
                ? <div className="flex items-center justify-center py-8 text-slate-500 text-xs gap-2"><Loader size={13} className="animate-spin"/>Cargando...</div>
                : features.length === 0
                  ? <p className="text-xs text-slate-500 text-center py-8">No se encontraron .feature</p>
                  : <ul className="space-y-0.5 flex-1 overflow-y-auto">
                      {features.map(f => (
                        <FeatureItem key={f.relativePath} feature={f}
                          selected={selected?.relativePath === f.relativePath}
                          onSelect={selectFeature}
                          onRename={handleRename}
                          onDelete={handleDelete}
                          onExport={handleExport}
                        />
                      ))}
                    </ul>
              }

              {/* Correr todos */}
              <div className="mt-4 pt-3 border-t border-white/5">
                <button onClick={() => runFeature(null)} disabled={running}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-violet-600/80 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-semibold transition-all">
                  {running ? <Loader size={12} className="animate-spin"/> : <Play size={12}/>} Correr todos
                </button>
              </div>
            </div>
          </div>

          {/* Panel derecho */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            {selected ? (
              <>
                <div className="card">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-slate-100 font-mono truncate">{selected.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{selected.relativePath}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => handleExport(selected)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-blue-400 text-xs font-semibold transition-all">
                        <Download size={12}/> Exportar
                      </button>
                      <button onClick={() => runFeature(selected.relativePath)} disabled={running}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600/80 hover:bg-green-500 disabled:opacity-40 text-white text-xs font-semibold transition-all">
                        {running ? <Loader size={13} className="animate-spin"/> : <Play size={13}/>} Ejecutar ({env})
                      </button>
                    </div>
                  </div>
                </div>

                {fileContent !== '' && (
                  <KarateEditor
                    relativePath={selected?.relativePath}
                    initialContent={fileContent}
                    backendUrl={BACKEND_URL}
                    onSaved={(newContent) => setFileContent(newContent)}
                  />
                )}
              </>
            ) : (
              <div className="card flex items-center justify-center text-slate-500 text-sm" style={{minHeight:'120px'}}>
                Seleccion? un feature para verlo y ejecutarlo
              </div>
            )}

            {/* Output */}
            {(logs.length > 0 || running || runResult) && (
              <div className="card">
                <p className="card__title mb-3"><Terminal size={13}/> Output</p>
                {runResult && (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl mb-3 text-xs font-semibold ${runResult.success ? 'bg-green-500/10 border border-green-500/20 text-green-300' : 'bg-red-500/10 border border-red-500/20 text-red-300'}`}>
                    {runResult.success ? <CheckCircle size={14}/> : <XCircle size={14}/>} {runResult.message}
                  </div>
                )}
                <div className="bg-black/50 rounded-xl p-3 font-mono text-xs overflow-auto" style={{maxHeight:'300px'}}>
                  {logs.map((log,i) => (
                    <div key={i} className={`leading-relaxed whitespace-pre-wrap break-all ${log.type==='error'?'text-red-400':log.type==='success'?'text-green-400':log.type==='info'?'text-violet-300':'text-slate-300'}`}>
                      {log.text}
                    </div>
                  ))}
                  {running && <div className="flex items-center gap-2 text-slate-500 mt-2"><Loader size={11} className="animate-spin"/> Ejecutando Maven...</div>}
                  <div ref={logsEndRef}/>
                </div>
              </div>
            )}

            {/* Análisis IA */}
            {runResult && logs.length > 0 && (
              <AIAnalysis logs={logs} featureName={selected?.name} exitCode={runResult.exitCode} summary={runResult.summary}/>
            )}

            {/* Reporte */}
            {!running && logs.length === 0 && <ReportSummary summary={lastReport}/>}
          </div>
        </div>
      )}
    </div>
  );
}
