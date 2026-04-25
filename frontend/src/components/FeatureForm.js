import React from 'react';
import { FileText, Radio, AlertTriangle, PlusCircle, Zap } from 'lucide-react';
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
  onSmartFill, onSubmit,
}) {
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">

      {/* ── Confluence Import ── */}
      <ConfluenceImport onApply={onSmartFill} />

      {/* ── Smart Fill ── */}
      <SmartFill onApply={onSmartFill} />

      {/* ── Errors ── */}
      {errors.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-400" />
          <div>
            <p className="font-semibold text-sm mb-1">Por favor corregí los siguientes errores:</p>
            <ul className="text-xs space-y-0.5 list-disc list-inside text-red-400">
              {errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        </div>
      )}

      {/* ── Feature Info ── */}
      <div className="card">
        <p className="card__title"><FileText size={14} /> Información del Feature</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              Feature Name <span className="text-violet-400">*</span>
            </label>
            <input className="form-control" type="text" name="featureName"
              value={form.featureName} onChange={onTopLevel}
              placeholder="Ej: IngresoClienteClaroPay" required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              Endpoint base <span className="text-violet-400">*</span>
            </label>
            <input className="form-control" type="text" name="endpoint"
              value={form.endpoint} onChange={onTopLevel}
              placeholder="Ej: /v1/client/data" required />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Base URL</label>
            <input className="form-control" type="text" name="baseUrl"
              value={form.baseUrl} onChange={onTopLevel}
              placeholder="Ej: https://mi-servicio.apps.osen02.claro.amx" />
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-500/5 border border-violet-500/10 text-violet-300 text-xs">
          <Zap size={12} /> El método HTTP, parámetros, headers y validaciones se configuran por escenario.
        </div>
      </div>

      {/* ── OCP ── */}
      <div className="card">
        <p className="card__title"><Radio size={14} /> Evidencia OpenShift (OCP)</p>
        <label className="flex items-center gap-3 cursor-pointer mb-4 group">
          <div className="relative">
            <input type="checkbox" name="enableOcp" className="sr-only peer"
              checked={!!form.enableOcp}
              onChange={e => onTopLevel({ target: { name: 'enableOcp', value: e.target.checked } })} />
            <div className="w-10 h-5 rounded-full bg-[#1e293b] border border-[#334155] peer-checked:bg-violet-600 transition-colors duration-200" />
            <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 peer-checked:translate-x-5" />
          </div>
          <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
            Habilitar captura de logs OCP en el Background
          </span>
        </label>
        {form.enableOcp && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-[#1e293b]">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">OCP Token</label>
              <input className="form-control" type="text" name="ocpToken"
                value={form.ocpToken} onChange={onTopLevel}
                placeholder="sha256~xxxxxxxxxxxxxxxx" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Namespace / Proyecto</label>
              <input className="form-control" type="text" name="namespace"
                value={form.namespace} onChange={onTopLevel}
                placeholder="Ej: claropay-ar-desa" />
            </div>
          </div>
        )}
      </div>

      {/* ── Live preview strip ── */}
      {(form.featureName || form.endpoint) && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#111827] border border-[#1e293b] text-xs font-mono overflow-x-auto">
          <span className="text-slate-500">📄</span>
          <span className="text-slate-300 font-semibold">{form.featureName || '...'}</span>
          <span className="text-slate-600">·</span>
          {[...new Set(form.scenarios.map(s => s.method))].map((m, i) => (
            <span key={m} className="text-amber-300 font-bold">{i > 0 && <span className="text-slate-600 mx-0.5">|</span>}{m}</span>
          ))}
          <span className="text-emerald-400">{form.endpoint || '/'}</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-400">{form.scenarios.length} escenario{form.scenarios.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* ── Scenarios header ── */}
      <div className="flex items-center justify-between pt-2">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          🎬 Escenarios de prueba
        </h2>
        <span className="px-2.5 py-1 rounded-full bg-[#1e293b] text-slate-400 text-xs font-semibold">
          {form.scenarios.length} escenario{form.scenarios.length !== 1 ? 's' : ''}
        </span>
      </div>

      {form.scenarios.length === 0 && (
        <div className="flex flex-col items-center justify-center py-14 rounded-2xl border border-dashed border-[#1e293b] text-center">
          <span className="text-4xl mb-3">🎬</span>
          <p className="text-slate-400 font-medium mb-1">No hay escenarios todavía</p>
          <p className="text-slate-600 text-sm">Usá <strong className="text-violet-400">Smart Fill</strong> para generarlos o agregá uno manualmente.</p>
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

      <button type="button" className="btn btn--ghost w-full justify-center py-3 border-dashed" onClick={onAddScenario}>
        <PlusCircle size={16} /> Agregar escenario
      </button>

      {/* ── Submit ── */}
      <div className="flex justify-end pt-4 pb-2">
        <button type="submit" className="btn btn--primary px-8 py-3 text-base" disabled={loading}>
          {loading ? <><span className="spinner" /> Generando...</> : <><Zap size={16} /> Generate Feature</>}
        </button>
      </div>
    </form>
  );
}
