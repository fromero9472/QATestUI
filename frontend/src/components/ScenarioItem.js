import React, { useState } from 'react';
import './ScenarioItem.css';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

// Operators: label shown in UI → value stored
const OPERATORS = [
  { label: 'Existe / != null',  value: '!= null',   hasValue: false },
  { label: 'Es null',           value: '== null',   hasValue: false },
  { label: 'Es true',           value: '== true',   hasValue: false },
  { label: 'Es false',          value: '== false',  hasValue: false },
  { label: 'Igual a…',          value: '==',        hasValue: true  },
  { label: 'Distinto de…',      value: '!=',        hasValue: true  },
  { label: 'Contiene…',         value: 'contains',  hasValue: true  },
  { label: 'Match regex…',      value: 'matches',   hasValue: true  },
];

const statusColor = (status) => {
  const s = String(status);
  if (s.startsWith('2')) return 'status-2xx';
  if (s.startsWith('4')) return 'status-4xx';
  if (s.startsWith('5')) return 'status-5xx';
  return '';
};

// ── Reusable key/value row list ──────────────────────────────────
function KVList({ items, onAdd, onRemove, onChange, keyPlaceholder, valuePlaceholder, addLabel }) {
  return (
    <div className="kv-list">
      {items.map((item, i) => (
        <div key={item.id} className="kv-row">
          <input
            className="form-control kv-key"
            type="text"
            placeholder={keyPlaceholder}
            value={item.key}
            onChange={(e) => onChange(i, 'key', e.target.value)}
          />
          <span className="kv-sep">=</span>
          <input
            className="form-control kv-value"
            type="text"
            placeholder={valuePlaceholder}
            value={item.value}
            onChange={(e) => onChange(i, 'value', e.target.value)}
          />
          {items.length > 1 && (
            <button type="button" className="btn btn--sm kv-remove" onClick={() => onRemove(i)} title="Eliminar">✕</button>
          )}
        </div>
      ))}
      <button type="button" className="btn btn--ghost btn--sm btn--add-kv" onClick={onAdd}>
        ＋ {addLabel}
      </button>
    </div>
  );
}

export default function ScenarioItem({
  scenario, index, total,
  onScenarioChange, onRemove,
  onAddListItem, onRemoveListItem, onChangeListItem,
  emptyParam, emptyHeader, emptyAssertion,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const si = index;

  const change = (field) => (e) => onScenarioChange(si, field, e.target.value);

  const needsBody = ['POST', 'PUT', 'PATCH'].includes(scenario.method);

  return (
    <div className="scenario-card">

      {/* ── Header ── */}
      <div className="scenario-header" onClick={() => setCollapsed(c => !c)}>
        <div className="scenario-header__left">
          <div className="scenario-number">{index + 1}</div>
          <span className="scenario-name-preview">
            {scenario.name || <em>Sin nombre aún...</em>}
          </span>
        </div>
        <div className="scenario-meta">
          <span className="scenario-tag scenario-tag--method">{scenario.method}</span>
          <span className={`scenario-tag scenario-tag--${statusColor(scenario.expectedStatus)}`}>
            HTTP {scenario.expectedStatus}
          </span>
          {scenario.params.some(p => p.key) && (
            <span className="scenario-tag scenario-tag--info">
              {scenario.params.filter(p => p.key).length} param{scenario.params.filter(p => p.key).length !== 1 ? 's' : ''}
            </span>
          )}
          {scenario.assertions.some(a => a.field) && (
            <span className="scenario-tag scenario-tag--assert">
              {scenario.assertions.filter(a => a.field).length} assert{scenario.assertions.filter(a => a.field).length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="scenario-header__actions" onClick={e => e.stopPropagation()}>
          <button type="button" className="btn btn--ghost btn--sm"
            onClick={() => setCollapsed(c => !c)}>
            {collapsed ? '▼' : '▲'}
          </button>
          {total >= 1 && (
            <button type="button" className="btn btn--danger-ghost btn--sm"
              onClick={() => onRemove(si)} title="Eliminar escenario">🗑</button>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      {!collapsed && (
        <div className="scenario-body">

          {/* ── Identificación ── */}
          <p className="scenario-section-title">🪪 Identificación</p>
          <div className="grid-3">
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Nombre del escenario <span className="required">*</span></label>
              <input className="form-control" type="text" value={scenario.name}
                onChange={change('name')} placeholder="Ej: Cliente con perfil premium retorna 200" required />
            </div>
            <div className="form-group">
              <label>HTTP Method <span className="required">*</span></label>
              <select className="form-control" value={scenario.method} onChange={change('method')}>
                {HTTP_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* ── Query Params ── */}
          <p className="scenario-section-title">🔗 Query Params
            <span className="section-hint">And param key = 'value'</span>
          </p>
          <KVList
            items={scenario.params}
            onAdd={() => onAddListItem(si, 'params', emptyParam)}
            onRemove={(li) => onRemoveListItem(si, 'params', li)}
            onChange={(li, field, val) => onChangeListItem(si, 'params', li, field, val)}
            keyPlaceholder="Ej: clienteId"
            valuePlaceholder="Ej: 1234567890"
            addLabel="Agregar param"
          />

          {/* ── Headers ── */}
          <p className="scenario-section-title">📨 Headers
            <span className="section-hint">And header Key = 'value'</span>
          </p>
          <KVList
            items={scenario.headers}
            onAdd={() => onAddListItem(si, 'headers', emptyHeader)}
            onRemove={(li) => onRemoveListItem(si, 'headers', li)}
            onChange={(li, field, val) => onChangeListItem(si, 'headers', li, field, val)}
            keyPlaceholder="Ej: X-Mock-Status"
            valuePlaceholder="Ej: 200"
            addLabel="Agregar header"
          />

          {/* ── Request Body (solo POST/PUT/PATCH) ── */}
          {needsBody && (
            <>
              <p className="scenario-section-title">📦 Request Body (JSON)
                <span className="section-hint">And request {'{ ... }'}</span>
              </p>
              <div className="form-group">
                <textarea
                  className="form-control body-textarea"
                  value={scenario.body}
                  onChange={change('body')}
                  placeholder={'{\n  "uuid": "abc123",\n  "cuit": "20123456789"\n}'}
                  rows={5}
                  spellCheck={false}
                />
              </div>
            </>
          )}

          {/* ── Expected status + Assertions ── */}
          <p className="scenario-section-title">✅ Respuesta esperada</p>
          <div className="form-group" style={{ maxWidth: '200px', marginBottom: '1rem' }}>
            <label>HTTP Status esperado <span className="required">*</span></label>
            <input className="form-control" type="number" value={scenario.expectedStatus}
              onChange={change('expectedStatus')} min="100" max="599" placeholder="200" required />
          </div>

          <p className="section-sublabel">Validaciones sobre el response body:</p>
          <div className="assertions-list">
            {scenario.assertions.map((assertion, ai) => {
              const op = OPERATORS.find(o => o.value === assertion.operator) || OPERATORS[0];
              return (
                <div key={assertion.id} className="assertion-row">
                  <span className="assertion-prefix">response.</span>
                  <input
                    className="form-control assertion-field"
                    type="text"
                    placeholder="Ej: hasClaroPay"
                    value={assertion.field}
                    onChange={e => onChangeListItem(si, 'assertions', ai, 'field', e.target.value)}
                  />
                  <select
                    className="form-control assertion-op"
                    value={assertion.operator}
                    onChange={e => onChangeListItem(si, 'assertions', ai, 'operator', e.target.value)}
                  >
                    {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  {op.hasValue && (
                    <input
                      className="form-control assertion-value"
                      type="text"
                      placeholder="valor"
                      value={assertion.value}
                      onChange={e => onChangeListItem(si, 'assertions', ai, 'value', e.target.value)}
                    />
                  )}
                  {scenario.assertions.length > 1 && (
                    <button type="button" className="btn btn--sm kv-remove"
                      onClick={() => onRemoveListItem(si, 'assertions', ai)}>✕</button>
                  )}
                </div>
              );
            })}
          </div>
          <button type="button" className="btn btn--ghost btn--sm btn--add-kv"
            onClick={() => onAddListItem(si, 'assertions', emptyAssertion)}>
            ＋ Agregar validación
          </button>

        </div>
      )}
    </div>
  );
}
