import React, { useState, useEffect } from 'react';
import axios from 'axios';
import FeatureForm from './components/FeatureForm';
import FeatureOutput from './components/FeatureOutput';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

const uid = () => Date.now() + Math.random();

export const emptyParam     = () => ({ id: uid(), key: '', value: '' });
export const emptyHeader    = () => ({ id: uid(), key: '', value: '' });
export const emptyAssertion = () => ({ id: uid(), field: '', operator: '!= null', value: '' });

const emptyScenario = () => ({
  id: uid(),
  name: '',
  method: 'GET',
  params:     [emptyParam()],
  headers:    [emptyHeader()],
  body:       '',
  expectedStatus: 200,
  assertions: [emptyAssertion()],
});

const initialForm = {
  featureName: '',
  endpoint: '',
  scenarios: [],
};

export default function App() {
  const [form, setForm]           = useState(initialForm);
  const [output, setOutput]       = useState(null);
  const [loading, setLoading]     = useState(false);
  const [errors, setErrors]       = useState([]);
  const [backendOk, setBackendOk] = useState(null);

  // ── Check backend status ────────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      try { await axios.get(`${BACKEND_URL}/health`, { timeout: 3000 }); setBackendOk(true); }
      catch { setBackendOk(false); }
    };
    check();
    const iv = setInterval(check, 15000);
    return () => clearInterval(iv);
  }, []);

  // ── Form field handlers ─────────────────────────────────────────
  const handleTopLevel = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleScenarioChange = (si, field, value) =>
    setForm((p) => {
      const s = [...p.scenarios];
      s[si] = { ...s[si], [field]: value };
      return { ...p, scenarios: s };
    });

  const addScenario    = () => setForm((p) => ({ ...p, scenarios: [...p.scenarios, emptyScenario()] }));
  const removeScenario = (si) => setForm((p) => ({ ...p, scenarios: p.scenarios.filter((_, i) => i !== si) }));

  const addListItem = (si, listKey, factory) =>
    setForm((p) => {
      const s = [...p.scenarios];
      s[si] = { ...s[si], [listKey]: [...s[si][listKey], factory()] };
      return { ...p, scenarios: s };
    });

  const removeListItem = (si, listKey, li) =>
    setForm((p) => {
      const s = [...p.scenarios];
      s[si] = { ...s[si], [listKey]: s[si][listKey].filter((_, i) => i !== li) };
      return { ...p, scenarios: s };
    });

  const changeListItem = (si, listKey, li, field, value) =>
    setForm((p) => {
      const s   = [...p.scenarios];
      const lst = [...s[si][listKey]];
      lst[li]   = { ...lst[li], [field]: value };
      s[si]     = { ...s[si], [listKey]: lst };
      return { ...p, scenarios: s };
    });

  const stripIds = (arr) => arr.map(({ id, ...rest }) => rest);

  const buildPayload = () => ({
    featureName: form.featureName,
    endpoint:    form.endpoint,
    scenarios:   form.scenarios.map(({ id, ...s }) => ({
      ...s,
      expectedStatus: Number(s.expectedStatus),
      params:     stripIds(s.params).filter(({ key }) => key.trim()),
      headers:    stripIds(s.headers).filter(({ key }) => key.trim()),
      assertions: stripIds(s.assertions).filter(({ field }) => field.trim()),
    })),
  });

  // ── Submit ──────────────────────────────────────────────────────
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

  // ── Download ────────────────────────────────────────────────────
  const handleDownload = async () => {
    try {
      const resp = await axios.post(`${BACKEND_URL}/download-feature`, buildPayload(), { responseType: 'blob' });
      const url  = window.URL.createObjectURL(new Blob([resp.data]));
      const a    = document.createElement('a');
      a.href     = url;
      a.setAttribute('download', `${form.featureName.replace(/[^a-z0-9_\-]/gi, '_')}.feature`);
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch { setErrors(['Error al descargar el archivo.']); }
  };

  const handleReset = () => { setForm(initialForm); setOutput(null); setErrors([]); };

  // ── Smart Fill: merge parsed criteria into form ─────────────────
  const handleSmartFill = (parsed) => {
    setForm((prev) => {
      // Soporte para "scenarios" (array nuevo) o "scenario" (legacy)
      const rawScenarios = Array.isArray(parsed.scenarios)
        ? parsed.scenarios
        : parsed.scenario
          ? [parsed.scenario]
          : [];

      const newScenarios = rawScenarios.map((s) => {
        const needsBody = ['POST', 'PUT', 'PATCH'].includes(s.method);

        const params = (!needsBody && s.detectedParams?.length > 0)
          ? s.detectedParams.map(p => ({ id: uid(), key: p.key, value: p.value }))
          : [emptyParam()];

        const headers = needsBody
          ? [{ id: uid(), key: 'Content-Type', value: 'application/json' }]
          : [emptyHeader()];

        const bodyValue = needsBody && s.detectedBody ? s.detectedBody : '';

        return {
          id:             uid(),
          name:           s.name           || '',
          method:         s.method         || 'POST',
          params,
          headers,
          body:           bodyValue,
          expectedStatus: s.expectedStatus || 200,
          assertions:     s.assertions?.length > 0
                            ? s.assertions.map(a => ({ id: uid(), field: a.field, operator: a.operator, value: a.value || '' }))
                            : [emptyAssertion()],
        };
      });

      if (newScenarios.length === 0) return prev;

      const isEmpty = prev.scenarios.length === 0;

      return {
        featureName: parsed.featureName || prev.featureName,
        endpoint:    parsed.endpoint    || prev.endpoint,
        scenarios:   isEmpty ? newScenarios : [...prev.scenarios, ...newScenarios],
      };
    });
  };

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="app">

      {/* ── Header ── */}
      <header className="app-header">
        <div className="app-header__logo">
          <span className="logo-icon">⚡</span>
          <div>
            <h1>QATestUI</h1>
            <p>Karate Feature Generator</p>
          </div>
        </div>
        <div className="header-right">
          <div className={`header-status ${backendOk === false ? 'header-status--error' : ''}`}>
            <span className={`status-dot ${backendOk === false ? 'status-dot--error' : ''}`} />
            {backendOk === null && 'Verificando...'}
            {backendOk === true  && 'Backend conectado'}
            {backendOk === false && 'Backend offline'}
          </div>
          <span className="app-header__badge">v2.0</span>
        </div>
      </header>

      {/* ── Hero ── */}
      {!output && (
        <section className="app-hero">
          <h2>Generá tests Karate en segundos</h2>
          <p>Completá el formulario con tus criterios de aceptación y obtenés un archivo <strong>.feature</strong> listo para ejecutar.</p>
          <div className="hero-chips">
            <span className="chip chip--purple">⚡ Karate DSL</span>
            <span className="chip chip--green">✅ Cualquier endpoint</span>
            <span className="chip chip--blue">📋 Params y headers dinámicos</span>
            <span className="chip chip--orange">⬇ Descarga directa</span>
          </div>
        </section>
      )}

      {/* ── Main content ── */}
      <main className="app-main">
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
            onSmartFill={handleSmartFill}
            onSubmit={handleSubmit}
          />
        ) : (
          <FeatureOutput output={output} onDownload={handleDownload} onReset={handleReset} />
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="app-footer">
        QATestUI © 2026 — Generador automático de tests Karate para equipos de QA
      </footer>
    </div>
  );
}

