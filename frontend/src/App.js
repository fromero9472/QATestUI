import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Zap, Activity, WifiOff, Sun, Moon } from 'lucide-react';

// ── Theme helpers ─────────────────────────────────────────────────
const THEME_KEY = 'qatestui_theme';

function getInitialTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  // Detect system preference
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme) {
  const html = document.documentElement;
  if (theme === 'light') { html.classList.add('light'); html.classList.remove('dark'); }
  else                   { html.classList.remove('light'); html.classList.add('dark'); }
  localStorage.setItem(THEME_KEY, theme);
}
import FeatureForm from './components/FeatureForm';
import FeatureOutput from './components/FeatureOutput';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

const uid = () => Date.now() + Math.random();

export const emptyParam       = () => ({ id: uid(), key: '', value: '' });
export const emptyHeader      = () => ({ id: uid(), key: '', value: '' });
export const emptyAssertion   = () => ({ id: uid(), field: '', operator: '!= null', value: '' });
export const emptyDbAssertion = () => ({ id: uid(), column: '', value: '' });

const emptyScenario = () => ({
  id: uid(), name: '', method: 'GET',
  params: [emptyParam()], headers: [emptyHeader()], body: '', expectedStatus: 200,
  assertions: [emptyAssertion()],
  enableDb: false, dbTable: '', dbColumns: '', dbFilter: '', dbAssertions: [emptyDbAssertion()],
  enableOcpEvidence: false,
});

const initialForm = { featureName: '', endpoint: '', baseUrl: '', enableOcp: false, ocpToken: '', namespace: '', scenarios: [] };

export default function App() {
  const [form, setForm]       = useState(initialForm);
  const [output, setOutput]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors]   = useState([]);
  const [backendOk, setBackendOk] = useState(null);
  const [theme, setTheme]     = useState(() => getInitialTheme());

  // Apply theme on mount + on change
  useEffect(() => { applyTheme(theme); }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  useEffect(() => {
    const check = async () => {
      try { await axios.get(`${BACKEND_URL}/health`, { timeout: 3000 }); setBackendOk(true); }
      catch { setBackendOk(false); }
    };
    check();
    const iv = setInterval(check, 15000);
    return () => clearInterval(iv);
  }, []);

  const handleTopLevel = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleScenarioChange = (si, field, value) =>
    setForm((p) => { const s = [...p.scenarios]; s[si] = { ...s[si], [field]: value }; return { ...p, scenarios: s }; });

  const addScenario    = () => setForm((p) => ({ ...p, scenarios: [...p.scenarios, emptyScenario()] }));
  const removeScenario = (si) => setForm((p) => ({ ...p, scenarios: p.scenarios.filter((_, i) => i !== si) }));

  const addListItem = (si, listKey, factory) =>
    setForm((p) => { const s = [...p.scenarios]; s[si] = { ...s[si], [listKey]: [...s[si][listKey], factory()] }; return { ...p, scenarios: s }; });

  const removeListItem = (si, listKey, li) =>
    setForm((p) => { const s = [...p.scenarios]; s[si] = { ...s[si], [listKey]: s[si][listKey].filter((_, i) => i !== li) }; return { ...p, scenarios: s }; });

  const changeListItem = (si, listKey, li, field, value) =>
    setForm((p) => { const s = [...p.scenarios]; const lst = [...s[si][listKey]]; lst[li] = { ...lst[li], [field]: value }; s[si] = { ...s[si], [listKey]: lst }; return { ...p, scenarios: s }; });

  const stripIds = (arr) => arr.map(({ id, ...rest }) => rest);

  const buildPayload = () => ({
    featureName: form.featureName, endpoint: form.endpoint, baseUrl: form.baseUrl || '',
    enableOcp: !!form.enableOcp, ocpToken: form.ocpToken || '', namespace: form.namespace || '',
    scenarios: form.scenarios.map(({ id, ...s }) => ({
      ...s,
      expectedStatus: Number(s.expectedStatus),
      params:       stripIds(s.params).filter(({ key }) => key.trim()),
      headers:      stripIds(s.headers).filter(({ key }) => key.trim()),
      assertions:   stripIds(s.assertions).filter(({ field }) => field.trim()),
      dbAssertions: stripIds(s.dbAssertions || []).filter(({ column }) => column.trim()),
    })),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors([]); setOutput(null); setLoading(true);
    try {
      const { data } = await axios.post(`${BACKEND_URL}/generate-feature`, buildPayload());
      setOutput(data);
    } catch (err) {
      setErrors(err?.response?.data?.errors || ['Error de conexión. ¿Está corriendo el backend?']);
    } finally { setLoading(false); }
  };

  const handleDownload = async () => {
    try {
      const resp = await axios.post(`${BACKEND_URL}/download-feature`, buildPayload(), { responseType: 'blob' });
      const url  = window.URL.createObjectURL(new Blob([resp.data]));
      const a    = document.createElement('a');
      a.href = url;
      a.setAttribute('download', `${form.featureName.replace(/[^a-z0-9_\-]/gi, '_')}.feature`);
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch { setErrors(['Error al descargar el archivo.']); }
  };

  const handleReset = () => { setForm(initialForm); setOutput(null); setErrors([]); };

  const handleSmartFill = (parsed) => {
    setForm((prev) => {
      const rawScenarios = Array.isArray(parsed.scenarios) ? parsed.scenarios : parsed.scenario ? [parsed.scenario] : [];
      const newScenarios = rawScenarios.map((s) => {
        const needsBody = ['POST', 'PUT', 'PATCH'].includes(s.method);
        const params  = (!needsBody && s.detectedParams?.length > 0) ? s.detectedParams.map(p => ({ id: uid(), key: p.key, value: p.value })) : [emptyParam()];
        const headers = needsBody ? [{ id: uid(), key: 'Content-Type', value: 'application/json' }] : [emptyHeader()];
        return {
          id: uid(), name: s.name || '', method: s.method || 'POST', params, headers,
          body: needsBody && s.detectedBody ? s.detectedBody : '',
          expectedStatus: s.expectedStatus || 200,
          assertions: s.assertions?.length > 0 ? s.assertions.map(a => ({ id: uid(), field: a.field, operator: a.operator, value: a.value || '' })) : [emptyAssertion()],
          enableDb: !!s.enableDb, dbTable: s.dbTable || '', dbColumns: s.dbColumns || '', dbFilter: s.dbFilter || '',
          dbAssertions: s.dbAssertions?.length > 0 ? s.dbAssertions.map(a => ({ id: uid(), column: a.column, value: a.value || '' })) : [emptyDbAssertion()],
          enableOcpEvidence: !!s.enableOcpEvidence,
        };
      });
      if (newScenarios.length === 0) return prev;
      return {
        featureName: parsed.featureName || prev.featureName,
        endpoint:    parsed.endpoint    || prev.endpoint,
        baseUrl:     parsed.baseUrl     || prev.baseUrl     || '',
        enableOcp:   parsed.enableOcp   || prev.enableOcp   || false,
        ocpToken:    parsed.ocpToken    || prev.ocpToken    || '',
        namespace:   parsed.namespace   || prev.namespace   || '',
        scenarios:   prev.scenarios.length === 0 ? newScenarios : [...prev.scenarios, ...newScenarios],
      };
    });
  };

  return (
    <div className="min-h-screen flex flex-col">

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0b0f1a]/80 border-b border-[#1e293b]">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <Zap size={18} className="text-white" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
                QATestUI
              </span>
              <span className="text-xs text-slate-500 font-medium">Karate Generator</span>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Backend status badge */}
            {backendOk === false && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium">
                <WifiOff size={12} />
                Backend offline
              </div>
            )}
            {backendOk === true && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                <Activity size={12} />
                Backend online
              </div>
            )}
            {backendOk === null && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-500/10 border border-slate-500/30 text-slate-400 text-xs font-medium">
                <span className="spinner" style={{ marginRight: 0, width: 10, height: 10 }} />
                Verificando...
              </div>
            )}
            <span className="px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-400 text-xs font-bold">v2.0</span>

            {/* ── Theme toggle ── */}
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              className="
                relative flex items-center gap-1.5 px-3 py-1.5 rounded-full
                bg-white/10 backdrop-blur-md border border-white/10
                text-xs font-semibold
                hover:bg-white/20
                transition-all duration-300 ease-in-out
                overflow-hidden group
              "
              style={{ color: theme === 'dark' ? '#fbbf24' : '#7c3aed' }}
            >
              <span className="transition-all duration-300 ease-in-out">
                {theme === 'dark'
                  ? <Sun size={14} className="transition-transform duration-300 group-hover:rotate-12" />
                  : <Moon size={14} className="transition-transform duration-300 group-hover:-rotate-12" />
                }
              </span>
              <span className="transition-all duration-300">
                {theme === 'dark' ? 'Claro' : 'Oscuro'}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      {!output && (
        <section className="max-w-5xl mx-auto w-full px-6 pt-12 pb-8">
          <div className="mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold mb-4">
              <Zap size={11} /> Powered by Groq AI
            </span>
          </div>
          <h1 className="text-4xl font-extrabold text-white mb-3 leading-tight">
            Generá tests Karate{' '}
            <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">en segundos</span>
          </h1>
          <p className="text-slate-400 text-lg mb-6 max-w-2xl">
            Completá el formulario con tus criterios de aceptación y obtenés un archivo <span className="text-violet-300 font-mono">.feature</span> listo para ejecutar.
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: '⚡ Karate DSL', color: 'bg-violet-500/10 border-violet-500/20 text-violet-300' },
              { label: '✅ Cualquier endpoint', color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' },
              { label: '📋 Params dinámicos', color: 'bg-blue-500/10 border-blue-500/20 text-blue-300' },
              { label: '⬇ Descarga directa', color: 'bg-amber-500/10 border-amber-500/20 text-amber-300' },
            ].map(({ label, color }) => (
              <span key={label} className={`px-3 py-1 rounded-full border text-xs font-semibold ${color}`}>{label}</span>
            ))}
          </div>
        </section>
      )}

      {/* ── Main ── */}
      <main className="max-w-5xl mx-auto w-full px-6 pb-16 flex-1">
        {!output ? (
          <FeatureForm
            form={form}
            loading={loading}
            errors={errors}
            onTopLevel={handleTopLevel}
            onScenarioChange={handleScenarioChange}
            onAddScenario={addScenario}
            onRemoveScenario={removeScenario}
            onAddListItem={addListItem}
            onRemoveListItem={removeListItem}
            onChangeListItem={changeListItem}
            emptyParam={emptyParam}
            emptyHeader={emptyHeader}
            emptyAssertion={emptyAssertion}
            emptyDbAssertion={emptyDbAssertion}
            onSmartFill={handleSmartFill}
            onSubmit={handleSubmit}
          />
        ) : (
          <FeatureOutput output={output} onDownload={handleDownload} onReset={handleReset} />
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-[#1e293b] py-6 text-center text-slate-600 text-xs">
        QATestUI © 2026 — Generador automático de tests Karate para equipos de QA
      </footer>
    </div>
  );
}

