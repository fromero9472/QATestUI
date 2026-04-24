import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ConfluenceImport.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';
const STORAGE_KEY = 'confluence_creds_v1';

const loadCreds = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
};
const saveCreds = (c) => localStorage.setItem(STORAGE_KEY, JSON.stringify(c));

const OP_LABELS = {
  '== true': 'Es true', '== false': 'Es false',
  '== null': 'Es null', '!= null': '!= null',
  '==': 'Igual a', '!=': 'Distinto de',
  'contains': 'Contiene', 'matches': 'Regex',
};

// ──────────────────────────────────────────────────────────────────────────────
// Review Modal
// ──────────────────────────────────────────────────────────────────────────────
function ReviewModal({ result, pageTitle, onAccept, onReject }) {
  const [edited, setEdited] = useState(() => JSON.parse(JSON.stringify(result)));
  const [tab, setTab] = useState('preview'); // 'preview' | 'raw'

  const scenarios = Array.isArray(edited.scenarios) ? edited.scenarios : [];

  const setScenarioField = (si, field, val) => {
    setEdited(prev => {
      const s = [...prev.scenarios];
      s[si] = { ...s[si], [field]: val };
      return { ...prev, scenarios: s };
    });
  };

  const setAssertionField = (si, ai, field, val) => {
    setEdited(prev => {
      const s = [...prev.scenarios];
      const ass = [...s[si].assertions];
      ass[ai] = { ...ass[ai], [field]: val };
      s[si] = { ...s[si], assertions: ass };
      return { ...prev, scenarios: s };
    });
  };

  return (
    <div className="ci-overlay" onClick={(e) => e.target.classList.contains('ci-overlay') && onReject()}>
      <div className="ci-modal">
        {/* Header */}
        <div className="ci-modal__header">
          <div className="ci-modal__title">
            <span className="ci-modal__icon">🔍</span>
            <div>
              <h2>Revisá el análisis de Groq</h2>
              <p>Importado desde: <strong>{pageTitle}</strong></p>
            </div>
          </div>
          <button type="button" className="ci-modal__close" onClick={onReject}>✕</button>
        </div>

        {/* Tabs */}
        <div className="ci-modal__tabs">
          <button
            type="button"
            className={`ci-tab ${tab === 'preview' ? 'ci-tab--active' : ''}`}
            onClick={() => setTab('preview')}
          >
            📋 Preview editable
          </button>
          <button
            type="button"
            className={`ci-tab ${tab === 'raw' ? 'ci-tab--active' : ''}`}
            onClick={() => setTab('raw')}
          >
            🧾 JSON crudo
          </button>
        </div>

        {/* Body */}
        <div className="ci-modal__body">
          {tab === 'raw' ? (
            <pre className="ci-raw">{JSON.stringify(edited, null, 2)}</pre>
          ) : (
            <>
              {/* Global fields */}
              <div className="ci-section">
                <p className="ci-section__title">📄 Feature</p>
                <div className="ci-grid-2">
                  <div className="ci-field">
                    <label>Feature Name</label>
                    <input
                      className="form-control"
                      value={edited.featureName || ''}
                      onChange={e => setEdited(p => ({ ...p, featureName: e.target.value }))}
                    />
                  </div>
                  <div className="ci-field">
                    <label>Endpoint</label>
                    <input
                      className="form-control"
                      value={edited.endpoint || ''}
                      onChange={e => setEdited(p => ({ ...p, endpoint: e.target.value }))}
                    />
                  </div>
                  <div className="ci-field ci-field--full">
                    <label>Base URL</label>
                    <input
                      className="form-control"
                      value={edited.baseUrl || ''}
                      onChange={e => setEdited(p => ({ ...p, baseUrl: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Scenarios */}
              {scenarios.map((s, si) => (
                <div key={si} className="ci-scenario">
                  <div className="ci-scenario__header">
                    <span className="ci-scenario__num">Escenario {si + 1}</span>
                    <span className={`ci-method-badge ci-method-badge--${(s.method || 'GET').toLowerCase()}`}>
                      {s.method || 'GET'}
                    </span>
                  </div>

                  <div className="ci-grid-2" style={{ marginBottom: '0.75rem' }}>
                    <div className="ci-field">
                      <label>Nombre del escenario</label>
                      <input
                        className="form-control"
                        value={s.name || ''}
                        onChange={e => setScenarioField(si, 'name', e.target.value)}
                      />
                    </div>
                    <div className="ci-field">
                      <label>Status esperado</label>
                      <input
                        className="form-control"
                        type="number"
                        value={s.expectedStatus || 200}
                        onChange={e => setScenarioField(si, 'expectedStatus', Number(e.target.value))}
                      />
                    </div>
                  </div>

                  {/* Assertions */}
                  {s.assertions?.length > 0 && (
                    <div className="ci-assertions">
                      <p className="ci-assertions__title">✅ Assertions ({s.assertions.length})</p>
                      {s.assertions.map((a, ai) => (
                        <div key={ai} className="ci-assertion-row">
                          <input
                            className="form-control ci-assert-field"
                            placeholder="campo"
                            value={a.field || ''}
                            onChange={e => setAssertionField(si, ai, 'field', e.target.value)}
                          />
                          <select
                            className="form-control ci-assert-op"
                            value={a.operator || '!= null'}
                            onChange={e => setAssertionField(si, ai, 'operator', e.target.value)}
                          >
                            {Object.entries(OP_LABELS).map(([op, label]) => (
                              <option key={op} value={op}>{label}</option>
                            ))}
                          </select>
                          <input
                            className="form-control ci-assert-value"
                            placeholder="valor"
                            value={a.value || ''}
                            onChange={e => setAssertionField(si, ai, 'value', e.target.value)}
                            disabled={['!= null','== null','== true','== false'].includes(a.operator)}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* DB */}
                  {s.enableDb && (
                    <div className="ci-db-badge">
                      🗄 DB: <strong>{s.dbTable || 'tabla no detectada'}</strong>
                      {s.dbFilter && <span> — WHERE {s.dbFilter}</span>}
                    </div>
                  )}

                  {/* Body preview */}
                  {s.detectedBody && (
                    <div className="ci-body-preview">
                      <p className="ci-assertions__title">📦 Request body</p>
                      <pre>{s.detectedBody}</pre>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="ci-modal__footer">
          <div className="ci-modal__footer-info">
            <span className="ci-badge">{scenarios.length} escenario{scenarios.length !== 1 ? 's' : ''}</span>
            <span className="ci-hint">Podés editar cualquier campo antes de aceptar</span>
          </div>
          <div className="ci-modal__footer-actions">
            <button type="button" className="btn btn--danger-ghost" onClick={onReject}>
              ✕ Rechazar
            </button>
            <button type="button" className="btn btn--success" onClick={() => onAccept(edited)}>
              ✅ Aceptar y aplicar al formulario
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main ConfluenceImport component
// ──────────────────────────────────────────────────────────────────────────────
export default function ConfluenceImport({ onApply }) {
  const saved = loadCreds();
  const [open, setOpen]         = useState(false);
  const [baseUrl, setBaseUrl]   = useState(saved.baseUrl   || '');
  const [email, setEmail]       = useState(saved.email     || '');
  const [token, setToken]       = useState(saved.token     || '');
  const [authType, setAuthType] = useState(saved.authType  || 'basic');
  const [pageUrl, setPageUrl]   = useState('');

  const [connStatus, setConnStatus]   = useState(null); // null | 'ok' | 'error'
  const [connMsg, setConnMsg]         = useState('');
  const [testLoading, setTestLoading] = useState(false);

  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError]     = useState('');

  const [reviewData, setReviewData]     = useState(null);
  const [reviewTitle, setReviewTitle]   = useState('');

  // Persist creds on change
  useEffect(() => {
    saveCreds({ baseUrl, email, token, authType });
  }, [baseUrl, email, token, authType]);

  const handleTest = async () => {
    setTestLoading(true); setConnStatus(null); setConnMsg('');
    try {
      await axios.post(`${BACKEND_URL}/confluence-test`, { baseUrl, email, token, authType });
      setConnStatus('ok');
      setConnMsg('Conexión exitosa');
    } catch (err) {
      setConnStatus('error');
      setConnMsg(err?.response?.data?.error || 'No se pudo conectar');
    } finally { setTestLoading(false); }
  };

  const handleFetch = async () => {
    if (!pageUrl.trim()) return;
    setFetchLoading(true); setFetchError(''); setReviewData(null);
    try {
      const { data } = await axios.post(`${BACKEND_URL}/confluence-fetch`, {
        baseUrl, email, token, authType, pageUrl,
      });
      if (data.success) {
        setReviewTitle(data.pageTitle || 'HU importada');
        setReviewData(data);
      } else {
        setFetchError(data.error || 'Error al obtener la página');
      }
    } catch (err) {
      setFetchError(err?.response?.data?.error || 'Error de conexión con el backend');
    } finally { setFetchLoading(false); }
  };

  const handleAccept = (edited) => {
    onApply(edited);
    setReviewData(null);
    setPageUrl('');
    setOpen(false);
  };

  const handleReject = () => {
    setReviewData(null);
  };

  return (
    <>
      {/* Review modal — fuera del flujo del form */}
      {reviewData && (
        <ReviewModal
          result={reviewData}
          pageTitle={reviewTitle}
          onAccept={handleAccept}
          onReject={handleReject}
        />
      )}

      <div className={`confluence-import ${open ? 'confluence-import--open' : ''}`}>
        {/* Toggle */}
        <button type="button" className="ci-toggle" onClick={() => setOpen(o => !o)}>
          <span className="ci-toggle-left">
            <span className="ci-icon">🔗</span>
            <span className="ci-title">Importar desde Confluence</span>
            <span className="ci-subtitle">Traé una HU y generá el test automáticamente con IA</span>
          </span>
          <div className="ci-toggle-right">
            {connStatus === 'ok'    && <span className="ci-conn-dot ci-conn-dot--ok"    title="Conectado" />}
            {connStatus === 'error' && <span className="ci-conn-dot ci-conn-dot--error" title="Sin conexión" />}
            <span className="ci-chevron">{open ? '▲' : '▼'}</span>
          </div>
        </button>

        {open && (
          <div className="ci-body">

            {/* Credenciales */}
            <div className="ci-section">
              <p className="ci-section__title">🔐 Credenciales</p>

              <div className="ci-field" style={{ marginBottom: '0.75rem' }}>
                <label>Tipo de autenticación</label>
                <select className="form-control" value={authType} onChange={e => setAuthType(e.target.value)}>
                  <option value="basic">Basic (Email + API Token) — Confluence Cloud</option>
                  <option value="bearer">Bearer Token — Confluence Server/Data Center</option>
                </select>
              </div>

              <div className="ci-grid-2" style={{ marginBottom: '0.75rem' }}>
                <div className="ci-field">
                  <label>Base URL</label>
                  <input
                    className="form-control"
                    placeholder="https://tu-org.atlassian.net/wiki"
                    value={baseUrl}
                    onChange={e => setBaseUrl(e.target.value)}
                  />
                </div>
                {authType === 'basic' && (
                  <div className="ci-field">
                    <label>Email</label>
                    <input
                      className="form-control"
                      placeholder="tu@email.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div className="ci-field" style={{ marginBottom: '0.75rem' }}>
                <label>{authType === 'bearer' ? 'Personal Access Token' : 'API Token'}</label>
                <input
                  className="form-control"
                  type="password"
                  placeholder={authType === 'bearer' ? 'Tu token personal de Confluence' : 'ATATTxxxxxxxxxx'}
                  value={token}
                  onChange={e => setToken(e.target.value)}
                />
              </div>

              <div className="ci-test-row">
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={handleTest}
                  disabled={testLoading || !baseUrl.trim() || !token.trim()}
                >
                  {testLoading
                    ? <><span className="spinner" /> Probando...</>
                    : '🔌 Probar conexión'
                  }
                </button>
                {connStatus && (
                  <span className={`ci-conn-msg ci-conn-msg--${connStatus}`}>
                    {connStatus === 'ok' ? '✅' : '❌'} {connMsg}
                  </span>
                )}
              </div>
            </div>

            {/* Importar HU */}
            <div className="ci-section">
              <p className="ci-section__title">📄 Historia de Usuario</p>
              <div className="ci-fetch-row">
                <input
                  className="form-control"
                  placeholder="https://confluence.empresa.com/pages/viewpage.action?pageId=123456"
                  value={pageUrl}
                  onChange={e => setPageUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !fetchLoading && handleFetch()}
                />
                <button
                  type="button"
                  className="btn btn--primary btn--sm ci-fetch-btn"
                  onClick={handleFetch}
                  disabled={fetchLoading || !pageUrl.trim() || !baseUrl.trim() || !token.trim()}
                >
                  {fetchLoading
                    ? <><span className="spinner" /> Importando...</>
                    : '📥 Importar HU'
                  }
                </button>
              </div>
              {fetchError && <p className="ci-error">⚠ {fetchError}</p>}
              <p className="ci-hint">
                Soporta URLs con <code>?pageId=XXXXX</code>, <code>/pages/XXXXX</code> o <code>/display/SPACE/Titulo</code>.
                El contenido se analiza con IA y podés <strong>revisar y editar antes de aplicar</strong>.
              </p>
            </div>

          </div>
        )}
      </div>
    </>
  );
}

