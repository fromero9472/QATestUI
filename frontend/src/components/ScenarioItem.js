import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Trash2, PlusCircle, X } from 'lucide-react';
import { ActionButton } from './index';
import './ScenarioItem.css';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

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

const METHOD_COLORS = {
  GET:    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  POST:   'bg-blue-500/10 text-blue-400 border-blue-500/20',
  PUT:    'bg-amber-500/10 text-amber-400 border-amber-500/20',
  PATCH:  'bg-orange-500/10 text-orange-400 border-orange-500/20',
  DELETE: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const statusBg = (status) => {
  const s = String(status);
  if (s.startsWith('2')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  if (s.startsWith('4')) return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  if (s.startsWith('5')) return 'bg-red-500/10 text-red-400 border-red-500/20';
  return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
};

function SectionTitle({ children, hint }) {
  return (
    <div className="flex items-center gap-2 mt-5 mb-3">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{children}</p>
      {hint && <span className="text-xs text-slate-600 font-mono">{hint}</span>}
    </div>
  );
}

function KVList({ items, onAdd, onRemove, onChange, keyPlaceholder, valuePlaceholder, addLabel }) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={item.id} className="flex items-center gap-2">
          <input className="form-control flex-1 !py-2 !text-xs" type="text"
            placeholder={keyPlaceholder} value={item.key}
            onChange={e => onChange(i, 'key', e.target.value)} />
          <span className="text-slate-600 text-xs">=</span>
          <input className="form-control flex-1 !py-2 !text-xs" type="text"
            placeholder={valuePlaceholder} value={item.value}
            onChange={e => onChange(i, 'value', e.target.value)} />
           {items.length > 1 && (
             <ActionButton
               icon={X}
               onClick={() => onRemove(i)}
               variant="danger"
               size="sm"
               className="!p-1 !w-7 !h-7 !rounded-lg"
               title="Eliminar"
             />
           )}
        </div>
      ))}
       <ActionButton
         icon={PlusCircle}
         label={addLabel}
         onClick={onAdd}
         variant="ghost"
         size="sm"
         className="mt-1"
       />
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div className="relative">
        <input type="checkbox" className="sr-only peer" checked={checked} onChange={onChange} />
        <div className="w-10 h-5 rounded-full bg-[#1e293b] border border-[#334155] peer-checked:bg-violet-600 transition-colors duration-200" />
        <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 peer-checked:translate-x-5" />
      </div>
      <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{label}</span>
    </label>
  );
}

export default function ScenarioItem({
  scenario, index, total,
  onScenarioChange, onRemove,
  onAddListItem, onRemoveListItem, onChangeListItem,
  emptyParam, emptyHeader, emptyAssertion, emptyDbAssertion,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const si = index;
  const change = (field) => (e) => onScenarioChange(si, field, e.target.value);
  const needsBody = ['POST', 'PUT', 'PATCH'].includes(scenario.method);

  return (
    <div className="bg-[#111827] border border-[#1e293b] rounded-2xl overflow-hidden shadow-lg shadow-black/20 mb-3">

      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setCollapsed(c => !c)}>
        <div className="w-7 h-7 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-xs font-bold text-violet-400 shrink-0">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            {scenario.name || <em className="text-slate-500 font-normal">Sin nombre aún...</em>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${METHOD_COLORS[scenario.method] || METHOD_COLORS.GET}`}>
            {scenario.method}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${statusBg(scenario.expectedStatus)}`}>
            {scenario.expectedStatus}
          </span>
          {scenario.assertions.some(a => a.field) && (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-500/10 text-violet-400 border border-violet-500/20">
              {scenario.assertions.filter(a => a.field).length} assert
            </span>
          )}
          <button type="button" onClick={e => { e.stopPropagation(); setCollapsed(c => !c); }}
            className="w-7 h-7 rounded-lg bg-[#1e293b] hover:bg-[#263348] text-slate-400 hover:text-white flex items-center justify-center transition-colors">
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
           <ActionButton
             icon={Trash2}
             onClick={e => { e.stopPropagation(); onRemove(si); }}
             variant="danger"
             size="sm"
             className="!w-7 !h-7"
             title="Eliminar escenario"
           />
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="border-t border-[#1e293b] px-5 py-4 space-y-1">

          {/* Identificación */}
          <SectionTitle hint="🪪 Identificación">Identificación</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Nombre del escenario <span className="text-violet-400">*</span></label>
              <input className="form-control" type="text" value={scenario.name}
                onChange={change('name')} placeholder="Ej: Cliente con perfil premium retorna 200" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">HTTP Method <span className="text-violet-400">*</span></label>
              <select className="form-control" value={scenario.method} onChange={change('method')}>
                {HTTP_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* Query Params */}
          <SectionTitle hint="And param key = 'value'">🔗 Query Params</SectionTitle>
          <KVList
            items={scenario.params}
            onAdd={() => onAddListItem(si, 'params', emptyParam)}
            onRemove={(li) => onRemoveListItem(si, 'params', li)}
            onChange={(li, field, val) => onChangeListItem(si, 'params', li, field, val)}
            keyPlaceholder="Ej: clienteId" valuePlaceholder="Ej: 1234567890" addLabel="Agregar param"
          />

          {/* Headers */}
          <SectionTitle hint="And header Key = 'value'">📨 Headers</SectionTitle>
          <KVList
            items={scenario.headers}
            onAdd={() => onAddListItem(si, 'headers', emptyHeader)}
            onRemove={(li) => onRemoveListItem(si, 'headers', li)}
            onChange={(li, field, val) => onChangeListItem(si, 'headers', li, field, val)}
            keyPlaceholder="Ej: X-Mock-Status" valuePlaceholder="Ej: 200" addLabel="Agregar header"
          />

          {/* Request Body */}
          {needsBody && (
            <>
              <SectionTitle hint="And request { ... }">📦 Request Body (JSON)</SectionTitle>
              <textarea className="form-control font-mono text-xs resize-none" value={scenario.body}
                onChange={change('body')}
                placeholder={'{\n  "uuid": "abc123",\n  "cuit": "20123456789"\n}'}
                rows={5} spellCheck={false} />
            </>
          )}

          {/* Expected Status */}
          <SectionTitle>✅ Respuesta esperada</SectionTitle>
          <div className="max-w-[200px] mb-3">
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">HTTP Status <span className="text-violet-400">*</span></label>
            <input className="form-control" type="number" value={scenario.expectedStatus}
              onChange={change('expectedStatus')} min="100" max="599" placeholder="200" required />
          </div>

          <p className="text-xs text-slate-500 mb-2">Validaciones sobre el response body:</p>
          <div className="space-y-2">
            {scenario.assertions.map((assertion, ai) => {
              const op = OPERATORS.find(o => o.value === assertion.operator) || OPERATORS[0];
              return (
                <div key={assertion.id} className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-mono shrink-0">response.</span>
                  <input className="form-control flex-1 !py-2 !text-xs" type="text"
                    placeholder="Ej: hasClaroPay" value={assertion.field}
                    onChange={e => onChangeListItem(si, 'assertions', ai, 'field', e.target.value)} />
                  <select className="form-control w-40 !py-2 !text-xs" value={assertion.operator}
                    onChange={e => onChangeListItem(si, 'assertions', ai, 'operator', e.target.value)}>
                    {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  {op.hasValue && (
                    <input className="form-control flex-1 !py-2 !text-xs" type="text"
                      placeholder="valor" value={assertion.value}
                      onChange={e => onChangeListItem(si, 'assertions', ai, 'value', e.target.value)} />
                  )}
                  {scenario.assertions.length > 1 && (
                    <button type="button" onClick={() => onRemoveListItem(si, 'assertions', ai)}
                      className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center transition-colors shrink-0">
                      <X size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <button type="button" className="btn btn--ghost btn--sm mt-2"
            onClick={() => onAddListItem(si, 'assertions', emptyAssertion)}>
            <PlusCircle size={13} /> Agregar validación
          </button>

          {/* DB Validation */}
          <SectionTitle hint="DbUtils.queryOne antes/después del request">🗄️ Validación de base de datos</SectionTitle>
          <Toggle checked={!!scenario.enableDb}
            onChange={e => onScenarioChange(si, 'enableDb', e.target.checked)}
            label="Habilitar validación de DB en este escenario" />

          {scenario.enableDb && (
            <div className="mt-3 space-y-3 pl-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Tabla (schema.tabla)</label>
                  <input className="form-control" type="text" value={scenario.dbTable || ''}
                    onChange={e => onScenarioChange(si, 'dbTable', e.target.value)}
                    placeholder="Ej: CPAY_CREDIT_PROFILE.LIMITS" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Columnas</label>
                  <input className="form-control" type="text" value={scenario.dbColumns || ''}
                    onChange={e => onScenarioChange(si, 'dbColumns', e.target.value)}
                    placeholder="Ej: STATUS, AMOUNT" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Filtro WHERE</label>
                <input className="form-control" type="text" value={scenario.dbFilter || ''}
                  onChange={e => onScenarioChange(si, 'dbFilter', e.target.value)}
                  placeholder="Ej: CUIT = '20123456789'" />
              </div>
              <p className="text-xs text-slate-500">Validaciones post-request sobre la DB:</p>
              <div className="space-y-2">
                {(scenario.dbAssertions || []).map((dba, dai) => (
                  <div key={dba.id} className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-mono shrink-0">dbAfter.</span>
                    <input className="form-control flex-1 !py-2 !text-xs" type="text"
                      placeholder="columna" value={dba.column}
                      onChange={e => onChangeListItem(si, 'dbAssertions', dai, 'column', e.target.value)} />
                    <span className="text-slate-600 text-xs">=</span>
                    <input className="form-control flex-1 !py-2 !text-xs" type="text"
                      placeholder="valor esperado" value={dba.value}
                      onChange={e => onChangeListItem(si, 'dbAssertions', dai, 'value', e.target.value)} />
                    {(scenario.dbAssertions || []).length > 1 && (
                      <button type="button" onClick={() => onRemoveListItem(si, 'dbAssertions', dai)}
                        className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center transition-colors shrink-0">
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" className="btn btn--ghost btn--sm"
                onClick={() => onAddListItem(si, 'dbAssertions', emptyDbAssertion)}>
                <PlusCircle size={13} /> Agregar validación DB
              </button>
            </div>
          )}

          {/* OCP Evidence */}
          <SectionTitle hint="Captura logs del pod en OpenShift">🔴 Evidencia de logs OCP</SectionTitle>
          <Toggle checked={!!scenario.enableOcpEvidence}
            onChange={e => onScenarioChange(si, 'enableOcpEvidence', e.target.checked)}
            label="Capturar evidencia de logs OCP en este escenario" />
        </div>
      )}
    </div>
  );
}
