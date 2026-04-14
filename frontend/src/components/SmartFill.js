import React, { useState } from 'react';
import axios from 'axios';
import './SmartFill.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

const OP_LABELS = {
  '== true':  'Es true',
  '== false': 'Es false',
  '== null':  'Es null',
  '!= null':  '!= null',
  '==':       'Igual a',
  '!=':       'Distinto de',
  'contains': 'Contiene',
  'matches':  'Regex',
};

export default function SmartFill({ onApply }) {
  const [open, setOpen]       = useState(false);
  const [text, setText]       = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState('');

  const handleParse = async () => {
    if (!text.trim()) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const { data } = await axios.post(`${BACKEND_URL}/parse-criteria`, { text });
      if (data.success) setResult(data);
      else setError(data.errors?.[0] || 'No se pudo analizar el texto.');
    } catch {
      setError('Error de conexión con el backend.');
    } finally { setLoading(false); }
  };

  const handleApply = () => {
    if (result) { onApply(result); setOpen(false); setText(''); setResult(null); }
  };

  const handleClose = () => { setOpen(false); setText(''); setResult(null); setError(''); };

  // Compatibilidad: soporta tanto "scenarios" (array) como "scenario" (legacy)
  const scenarios = result
    ? (Array.isArray(result.scenarios) ? result.scenarios : result.scenario ? [result.scenario] : [])
    : [];

  return (
    <div className={`smart-fill ${open ? 'smart-fill--open' : ''}`}>

      {/* ── Toggle button ── */}
      <button type="button" className="smart-fill__toggle" onClick={() => setOpen(o => !o)}>
        <span className="sf-toggle-left">
          <span className="sf-icon">✨</span>
          <span className="sf-title">Smart Fill</span>
          <span className="sf-subtitle">Pegá tus criterios de aceptación y completamos el formulario</span>
        </span>
        <span className="sf-chevron">{open ? '▲' : '▼'}</span>
      </button>

      {/* ── Panel ── */}
      {open && (
        <div className="smart-fill__body">
          <p className="sf-hint">
            📋 Pegá el texto de <strong>uno o varios criterios</strong> (<strong>Dado / Cuando / Entonces</strong>).
            Detectamos todos los escenarios automáticamente — revisás antes de aplicar, ningún campo se sobreescribe sin confirmación.
          </p>

          <textarea
            className="form-control sf-textarea"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={`Podés pegar múltiples criterios:\n\nDado que un cliente ingresa con uuid de ClaroPay y profileName != "Básico"\nCuando se invoca /v1/client/data\nEntonces HTTP 200, hasClaroPay = true...\n\nDado que ClaroPay responde 404\nCuando /v1/client/data procesa...\nEntonces HTTP 200, hasClaroPay = false, message = CLIENT_PAY_NOT_FOUND...`}
            rows={10}
            spellCheck={false}
          />

          <div className="sf-actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleParse}
              disabled={loading || !text.trim()}
            >
              {loading ? <><span className="spinner" /> Analizando...</> : '✨ Analizar criterios'}
            </button>
            {result && (
              <button type="button" className="btn btn--success" onClick={handleApply}>
                ✅ Aplicar {scenarios.length > 1 ? `${scenarios.length} escenarios` : 'al formulario'}
              </button>
            )}
            <button type="button" className="btn btn--ghost" onClick={handleClose}>
              Cancelar
            </button>
          </div>

          {error && <p className="sf-error">⚠ {error}</p>}

          {/* ── Detection preview ── */}
          {result && (
            <div className="sf-preview">
              <p className="sf-preview__title">
                🔍 Lo que detectamos — revisá antes de aplicar:
                {scenarios.length > 1 && (
                  <span className="sf-scenarios-badge">{scenarios.length} escenarios detectados</span>
                )}
              </p>

              {/* Datos globales */}
              <div className="sf-detected-grid">
                <div className="sf-det-item">
                  <span className="sf-det-label">Feature Name</span>
                  <span className="sf-det-value">{result.featureName || <em className="sf-empty">No detectado</em>}</span>
                </div>
                <div className="sf-det-item">
                  <span className="sf-det-label">Endpoint</span>
                  <code className="sf-det-value sf-code">{result.endpoint || <em className="sf-empty">No detectado</em>}</code>
                </div>
              </div>

              {/* Un bloque por escenario */}
              {scenarios.map((s, idx) => (
                <div key={idx} className="sf-scenario-block">
                  <p className="sf-scenario-block__title">
                    <span className="sf-scenario-num">Escenario {idx + 1}</span>
                    {s.name && <span className="sf-scenario-block__name">{s.name}</span>}
                  </p>

                  <div className="sf-detected-grid sf-detected-grid--compact">
                    <div className="sf-det-item">
                      <span className="sf-det-label">Method</span>
                      <span className="scenario-tag scenario-tag--method sf-det-value">{s.method}</span>
                    </div>
                    <div className="sf-det-item">
                      <span className="sf-det-label">Status esperado</span>
                      <code className="sf-code">{s.expectedStatus}</code>
                    </div>
                    <div className="sf-det-item">
                      <span className="sf-det-label">Assertions</span>
                      <span className="sf-det-value">{s.assertions.length} validación{s.assertions.length !== 1 ? 'es' : ''}</span>
                    </div>
                  </div>

                  {s.assertions.length > 0 && (
                    <div className="sf-assertions-preview">
                      <p className="sf-assertions-preview__title">Validaciones:</p>
                      {s.assertions.map((a, i) => (
                        <div key={i} className="sf-assertion-chip">
                          <code>response.<strong>{a.field}</strong> {a.operator}{a.value ? ` "${a.value}"` : ''}</code>
                          <span className="sf-op-label">{OP_LABELS[a.operator] || a.operator}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {s.detectedParams?.length > 0 && (
                    <div className="sf-assertions-preview">
                      <p className="sf-assertions-preview__title">🔗 Params / datos:</p>
                      {s.detectedParams.map((p, i) => (
                        <div key={i} className="sf-assertion-chip">
                          <code><strong>{p.key}</strong> = {p.value}</code>
                        </div>
                      ))}
                    </div>
                  )}

                  {s.detectedBody && (
                    <div className="sf-assertions-preview">
                      <p className="sf-assertions-preview__title">📦 Request body:</p>
                      <pre className="sf-body-preview">{s.detectedBody}</pre>
                    </div>
                  )}
                </div>
              ))}

              <div className="sf-apply-note">
                💡 Hacé clic en <strong>"Aplicar{scenarios.length > 1 ? ` ${scenarios.length} escenarios` : ' al formulario'}"</strong> para pre-completar los campos.
                Podés ajustar cualquier cosa antes de generar el feature.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
