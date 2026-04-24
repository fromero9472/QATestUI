import React from 'react';
import ScenarioItem from './ScenarioItem';
import SmartFill from './SmartFill';
import ConfluenceImport from './ConfluenceImport';
import './FeatureForm.css';

export default function FeatureForm({
  form, loading, errors,
  onTopLevel, onScenarioChange,
  onAddScenario, onRemoveScenario,
  onAddListItem, onRemoveListItem, onChangeListItem,
  emptyParam, emptyHeader, emptyAssertion, emptyDbAssertion,
  onSmartFill,
  onSubmit,
}) {
  return (
    <form onSubmit={onSubmit} noValidate>

      {/* ── Confluence Import (flujo separado con review modal) ── */}
      <ConfluenceImport onApply={onSmartFill} />

      {/* ── Smart Fill ── */}
      <SmartFill onApply={onSmartFill} />

      {/* ── Error messages ── */}
      {errors.length > 0 && (
        <div className="error-list" role="alert">
          <p>⚠ Por favor corregí los siguientes errores:</p>
          <ul>
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {/* ── Feature info ── */}
      <div className="card">
        <p className="card__title">📄 Información del Feature</p>
        <div className="form-group">
          <label>Feature Name <span className="required">*</span></label>
          <input className="form-control" type="text" name="featureName"
            value={form.featureName} onChange={onTopLevel}
            placeholder="Ej: IngresoClienteClaroPay" required />
        </div>
        <div className="form-group">
          <label>Endpoint base <span className="required">*</span></label>
          <input className="form-control" type="text" name="endpoint"
            value={form.endpoint} onChange={onTopLevel}
            placeholder="Ej: /v1/client/data" required />
        </div>
        <div className="form-group">
          <label>Base URL</label>
          <input className="form-control" type="text" name="baseUrl"
            value={form.baseUrl} onChange={onTopLevel}
            placeholder="Ej: https://mi-servicio.apps.osen02.claro.amx" />
        </div>
        <div className="method-note">
          💡 El método HTTP, los parámetros, headers y validaciones se configuran por escenario.
        </div>
      </div>

      {/* ── OpenShift / OCP config ── */}
      <div className="card">
        <p className="card__title">🔴 Evidencia OpenShift (OCP)</p>
        <div className="form-group toggle-row">
          <label className="toggle-label">
            <input type="checkbox" name="enableOcp"
              checked={!!form.enableOcp}
              onChange={e => onTopLevel({ target: { name: 'enableOcp', value: e.target.checked } })} />
            <span>Habilitar captura de logs OCP en el Background</span>
          </label>
        </div>
        {form.enableOcp && (
          <div className="grid-2">
            <div className="form-group">
              <label>OCP Token</label>
              <input className="form-control" type="text" name="ocpToken"
                value={form.ocpToken} onChange={onTopLevel}
                placeholder="sha256~xxxxxxxxxxxxxxxx" />
            </div>
            <div className="form-group">
              <label>Namespace / Proyecto</label>
              <input className="form-control" type="text" name="namespace"
                value={form.namespace} onChange={onTopLevel}
                placeholder="Ej: claropay-ar-desa" />
            </div>
          </div>
        )}
      </div>

      {/* ── Live preview ── */}
      {(form.featureName || form.endpoint) && (
        <div className="form-preview-strip">
          📄 <strong>{form.featureName || '...'}</strong>
          &nbsp;·&nbsp;
          {[...new Set(form.scenarios.map(s => s.method))].map((m, i) => (
            <span key={m} style={{ color: '#fcd34d', fontWeight: 700 }}>
              {i > 0 && ' | '}{m}
            </span>
          ))}
          &nbsp;
          <span style={{ color: '#6ee7b7' }}>{form.endpoint || '/'}</span>
          &nbsp;·&nbsp;
          {form.scenarios.length} escenario{form.scenarios.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* ── Scenarios ── */}
      <div className="scenarios-header">
        <h2 className="scenarios-title">🎬 Escenarios de prueba</h2>
        <span className="scenarios-count">
          {form.scenarios.length} escenario{form.scenarios.length !== 1 ? 's' : ''}
        </span>
      </div>

      {form.scenarios.length === 0 && (
        <div className="scenarios-empty">
          <span className="scenarios-empty__icon">🎬</span>
          <p>No hay escenarios todavía.</p>
          <p>Usá <strong>Smart Fill</strong> para generarlos automáticamente o agregá uno manualmente.</p>
        </div>
      )}

      {form.scenarios.map((scenario, index) => (
        <ScenarioItem
          key={scenario.id}
          scenario={scenario}
          index={index}
          total={form.scenarios.length}
          onScenarioChange={onScenarioChange}
          onRemove={onRemoveScenario}
          onAddListItem={onAddListItem}
          onRemoveListItem={onRemoveListItem}
          onChangeListItem={onChangeListItem}
          emptyParam={emptyParam}
          emptyHeader={emptyHeader}
          emptyAssertion={emptyAssertion}
          emptyDbAssertion={emptyDbAssertion}
        />
      ))}

      <button type="button" className="btn btn--ghost btn--add-scenario" onClick={onAddScenario}>
        ＋ Agregar escenario
      </button>

      {/* ── Submit ── */}
      <div className="form-actions">
        <button type="submit" className="btn btn--primary btn--generate" disabled={loading}>
          {loading ? (<><span className="spinner" /> Generando...</>) : (<>⚡ Generate Feature</>)}
        </button>
      </div>
    </form>
  );
}
