import React, { useState, useMemo } from 'react';
import {
  CheckCircle, XCircle, AlertCircle, Clock, Activity, Zap, Copy,
  ChevronDown, ChevronUp, Filter, Search, Eye, FileJson, TrendingUp
} from 'lucide-react';
import { StatusBadge, StatusIcon, MetricCard } from './StatusBadge';
import { FiltersPanel, AdvancedFilters, applyFilters } from './FiltersPanel';
import { ExportActions, ScenarioActions } from './ActionButtons';
import {
  normalizeReport, formatDuration, calculateSuccessRate, getStatusColor, generateReportSummary, safeValue
} from '../utils/reportHelpers';

/**
 * Resumen superior de ejecución - MEJORADO
 */
function ExecutionSummary({ report, env, feature, onCopySummary }) {
  if (!report) return null;

  // Normalizar datos - nunca más undefined
  const normalized = normalizeReport(report);
  const { status, summary, startedAt, durationMs } = normalized;
  const { total, passed, failed, skipped } = summary;

  const successRate = calculateSuccessRate(total, passed);
  const colors = getStatusColor(status);
  const startDate = new Date(startedAt);
  const formattedTime = startDate.toLocaleString('es-AR');
  const duration = formatDuration(durationMs);

  return (
    <div className={`card border-2 ${colors.border} ${colors.bg} transition-all`}>
      {/* Header con estado */}
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-white/10">
        <div className="flex items-center gap-4">
          {status === 'PASSED' ? (
            <CheckCircle size={40} className={colors.icon} />
          ) : status === 'ERROR' ? (
            <AlertCircle size={40} className={colors.icon} />
          ) : (
            <XCircle size={40} className={colors.icon} />
          )}
          <div>
            <p className={`text-2xl font-bold ${colors.text}`}>
              {status}
            </p>
            <p className="text-xs text-slate-500">Ejecución completada</p>
          </div>
        </div>
        <button
          onClick={() => onCopySummary?.(normalized)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-violet-300 text-xs font-semibold transition-all"
          title="Copiar resumen al portapapeles"
        >
          <Copy size={13} /> Copiar
        </button>
      </div>

      {/* Cards de métricas */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <MetricCard
          label="Total"
          value={total}
          sublabel="Escenarios"
          variant="default"
        />
        <MetricCard
          label="✓ OK"
          value={passed}
          sublabel={`${total > 0 ? ((passed/total)*100).toFixed(0) : 0}%`}
          variant="success"
        />
        <MetricCard
          label="✗ Fallidos"
          value={failed}
          sublabel={`${total > 0 ? ((failed/total)*100).toFixed(0) : 0}%`}
          variant="error"
        />
        <MetricCard
          label="⏭ Skip"
          value={skipped}
          sublabel={`${total > 0 ? ((skipped/total)*100).toFixed(0) : 0}%`}
          variant="default"
        />
        <MetricCard
          label="⏱ Duración"
          value={duration}
          sublabel="Tiempo total"
          variant="warning"
        />
        <MetricCard
          label="Info"
          value={env || 'N/A'}
          sublabel={startDate.toLocaleTimeString('es-AR')}
          variant="default"
        />
      </div>
    </div>
  );
}

/**
 * Tabla de escenarios ejecutados - MEJORADA
 */
export function ScenariosTable({ scenarios = [], onSelectScenario, onCopyError }) {
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const cleanScenarioName = (name = '') => String(name).replace(/^\[[^\]]+\]\s*/, '');

  const normalized = scenarios.map((s) => ({
    name: s.name || 'Unknown',
    status: (s.status || 'UNKNOWN').toUpperCase(),
    durationMs: s.durationMs ?? 0,
    tags: s.tags || [],
    error: s.error || null,
    ...s,
  }));

  const filtered = normalized
    .filter(s => {
      const matchSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = filterStatus === 'all' || s.status.toLowerCase() === filterStatus;
      return matchSearch && matchStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'duration') return a.durationMs - b.durationMs;
      if (sortBy === 'status') {
        const order = { PASSED: 0, FAILED: 1, SKIPPED: 2, ERROR: 3 };
        return (order[a.status] || 999) - (order[b.status] || 999);
      }
      return a.name.localeCompare(b.name);
    });

  if (normalized.length === 0) {
    return (
      <div className="card">
        <p className="card__title mb-4">📋 Escenarios Ejecutados</p>
        <div className="flex items-center justify-center py-12 text-slate-500 text-sm">
          <p>Sin escenarios para mostrar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="mb-4">
        <p className="card__title mb-4">📋 Escenarios Ejecutados ({filtered.length}/{normalized.length})</p>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 mb-4">
          <div className="relative xl:col-span-5">
            <Search size={13} className="absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar escenario..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-black/30 border border-white/10 rounded-lg text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-violet-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1 bg-black/30 border border-white/10 rounded-lg p-1 xl:col-span-4">
            {['all', 'passed', 'failed', 'skipped', 'error'].map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                  filterStatus === s ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {s === 'all' ? 'Todos' : s === 'passed' ? '✓' : s === 'failed' ? '✗' : s === 'skipped' ? '⏭' : '!'}
              </button>
            ))}
          </div>

          <div className="xl:col-span-3">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-xs text-slate-200 outline-none focus:border-violet-500"
            >
              <option value="name">Ordenar: Nombre</option>
              <option value="duration">Ordenar: Duración</option>
              <option value="status">Ordenar: Estado</option>
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs table-fixed min-w-[760px]">
          <colgroup>
            <col className="w-[58%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-white/10 bg-black/20">
              <th className="text-left px-4 py-3 text-slate-400 font-semibold">Escenario</th>
              <th className="text-center px-4 py-3 text-slate-400 font-semibold">Estado</th>
              <th className="text-center px-4 py-3 text-slate-400 font-semibold">Acciones</th>
              <th className="text-center px-4 py-3 text-slate-400 font-semibold">Duración</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((scenario, idx) => (
              <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="px-4 py-3 text-slate-300 font-mono break-words whitespace-normal leading-relaxed">
                  {cleanScenarioName(scenario.name)}
                </td>
                <td className="text-center px-4 py-3">
                  <StatusBadge status={scenario.status} size="sm" />
                </td>
                <td className="text-center px-4 py-3 space-x-1">
                  <button
                    onClick={() => onSelectScenario?.(scenario)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-violet-500/10 border border-violet-500/20 text-violet-300 hover:bg-violet-500/20 transition-all text-[10px] font-semibold"
                  >
                    <Eye size={11} /> Detalles
                  </button>
                  {scenario.error && (
                    <button
                      onClick={() => onCopyError?.(scenario)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-300 hover:bg-red-500/20 transition-all text-[10px] font-semibold"
                    >
                      <Copy size={11} /> Error
                    </button>
                  )}
                </td>
                <td className="text-center px-4 py-3 text-slate-400 font-mono">
                  {formatDuration(scenario.durationMs)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Componente principal del panel de reporting - MEJORADO
 */
export default function ReportingPanel({ runResult, env, feature, selected, onExport }) {
  const [selectedScenario, setSelectedScenario] = useState(null);

  // Normalizar antes de renderizar
  const report = normalizeReport(runResult);

  // Mostrar "Sin ejecuciones" SOLO si no hay reporte en absoluto
  if (!runResult) {
    return (
      <div className="card flex flex-col items-center justify-center py-16 text-slate-500">
        <Activity size={48} className="mb-4 opacity-50" />
        <p className="text-base font-semibold">📊 Sin ejecuciones</p>
        <p className="text-xs mt-2">Ejecutá un feature para ver el reporte</p>
      </div>
    );
  }

  const handleCopyError = (scenario) => {
    const errorText = scenario.error?.message || scenario.error?.stack || 'Sin detalle de error';
    navigator.clipboard.writeText(`❌ ${scenario.name}\n\n${errorText}`);
  };

  const handleExportHTML = () => {
    if (onExport) onExport(report, 'html');
  };

  const handleCopySummary = (rep) => {
    navigator.clipboard.writeText(generateReportSummary(rep));
  };

  return (
    <div className="space-y-5">
      {/* Resumen Ejecutivo */}
      <ExecutionSummary
        report={report}
        env={env}
        feature={selected}
        onCopySummary={handleCopySummary}
      />

      {/* Botones de exportación */}
      <div className="flex justify-end">
        <ExportActions
          onExportHTML={handleExportHTML}
          compact={false}
        />
      </div>

      {/* Tabla de Escenarios */}
      <ScenariosTable
        scenarios={report.scenarios || []}
        onSelectScenario={setSelectedScenario}
        onCopyError={handleCopyError}
      />

      {/* Modal de Evidencia */}
      {selectedScenario && (
        <EvidenceModal scenario={selectedScenario} onClose={() => setSelectedScenario(null)} />
      )}
    </div>
  );
}

/**
 * Modal con detalle completo de evidencia por escenario - MEJORADO
 */
function EvidenceModal({ scenario, onClose }) {
  const [tab, setTab] = useState('summary');
  const formatForView = (value) => {
    if (value === null || value === undefined || value === '') return 'Sin datos';
    if (typeof value === 'string') return value;
    try { return JSON.stringify(value, null, 2); } catch { return String(value); }
  };

  const handleCopyRequest = () => {
    const req = scenario.http?.requestBody || scenario.request || {};
    navigator.clipboard.writeText(JSON.stringify(req, null, 2));
  };

  const handleCopyResponse = () => {
    const res = scenario.http?.responseBody || scenario.response || {};
    navigator.clipboard.writeText(JSON.stringify(res, null, 2));
  };

  const handleCopyError = () => {
    if (scenario.error) {
      navigator.clipboard.writeText(`${scenario.error.message}\n\n${scenario.error.stack}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#0d1117] border border-[#1e293b] shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b border-[#1e293b] bg-[#0d1117]">
          <div className="flex items-center gap-3">
            <StatusIcon status={scenario.status} size={20} />
            <div>
              <p className="font-semibold text-slate-100">
                #{scenario.index} - {scenario.name}
              </p>
              <p className="text-xs text-slate-500">{scenario.status} • {formatDuration(scenario.durationMs)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-all"
          >
            ✕
          </button>
        </div>

        {/* Tabs - MEJORADOS */}
        <div className="flex gap-1 px-6 py-3 border-b border-[#1e293b] bg-black/20 overflow-x-auto">
          {['summary', 'http', 'request', 'response', 'assertions', 'logs', 'db', 'error'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize whitespace-nowrap ${
                tab === t
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t === 'summary' ? 'Resumen' : t === 'http' ? 'HTTP' : t === 'request' ? 'Request' : t === 'response' ? 'Response' : t === 'assertions' ? 'Assertions' : t === 'logs' ? 'Logs' : t === 'db' ? 'DB' : 'Error'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {tab === 'summary' && (
            <div className="space-y-4">
              {/* Metadata */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard
                  label="Índice"
                  value={scenario.index}
                  variant="default"
                />
                <MetricCard
                  label="Estado"
                  value={scenario.status}
                  variant={scenario.status?.toLowerCase() === 'passed' ? 'success' : 'error'}
                />
                <MetricCard
                  label="Duración"
                  value={formatDuration(scenario.durationMs)}
                  variant="warning"
                />
                <MetricCard
                  label="Archivo"
                  value={safeValue(scenario.featureFile)}
                  variant="default"
                />
              </div>

              {/* Tags */}
              {scenario.tags && scenario.tags.length > 0 && (
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <p className="text-xs font-bold text-blue-300 mb-2">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {scenario.tags.map((tag, i) => (
                      <span key={i} className="px-2 py-1 bg-blue-500/20 border border-blue-500/30 rounded text-xs text-blue-300">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Error */}
              {scenario.error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-xs font-bold text-red-400 mb-2">❌ Error</p>
                  <p className="text-xs text-red-200 font-mono whitespace-pre-wrap break-all">
                    {scenario.error.message}
                  </p>
                </div>
              )}
            </div>
          )}

          {tab === 'http' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-xs text-slate-500 mb-1">Método HTTP</p>
                  <p className="font-mono text-amber-300">{safeValue(scenario.http?.method)}</p>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-xs text-slate-500 mb-1">Status esperado</p>
                  <p className="font-mono text-slate-300">{safeValue(scenario.http?.expectedStatus, '-')}</p>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-xs text-slate-500 mb-1">Status obtenido</p>
                  <p className="font-mono text-slate-300">{safeValue(scenario.http?.actualStatus, '-')}</p>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="text-xs text-slate-500 mb-2">URL</p>
                <p className="text-xs text-slate-400 font-mono break-all">{safeValue(scenario.http?.url)}</p>
              </div>
              {scenario.http?.headers && Object.keys(scenario.http.headers).length > 0 && (
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-xs text-slate-500 mb-2">Headers</p>
                  <pre className="bg-black/50 p-2 rounded text-xs text-slate-300 overflow-x-auto">
                    {JSON.stringify(scenario.http.headers, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {tab === 'request' && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <button
                  onClick={handleCopyRequest}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-white/5 border border-white/10 text-slate-400 hover:text-violet-300 transition-all"
                >
                  <Copy size={10} /> Copiar
                </button>
              </div>
              <pre className="bg-black/50 p-3 rounded-lg overflow-x-auto text-xs text-slate-200 whitespace-pre-wrap break-words max-h-96">
                {formatForView(scenario.http?.requestBody ?? scenario.request)}
              </pre>
            </div>
          )}

          {tab === 'response' && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <button
                  onClick={handleCopyResponse}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-white/5 border border-white/10 text-slate-400 hover:text-violet-300 transition-all"
                >
                  <Copy size={10} /> Copiar
                </button>
              </div>
              <pre className="bg-black/50 p-3 rounded-lg overflow-x-auto text-xs text-slate-200 whitespace-pre-wrap break-words max-h-96">
                {formatForView(scenario.http?.responseBody ?? scenario.response)}
              </pre>
            </div>
          )}

          {tab === 'assertions' && (
            <div className="space-y-3">
              {scenario.assertions && scenario.assertions.length > 0 ? (
                <div className="space-y-2">
                  {scenario.assertions.map((ass, i) => (
                    <div key={i} className="p-3 rounded-lg bg-white/5 border border-white/10">
                      <p className="text-xs text-slate-400 font-mono">{ass}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">Sin assertions registradas</p>
              )}
            </div>
          )}

          {tab === 'logs' && (
            <div className="bg-black/50 p-3 rounded-lg max-h-96 overflow-y-auto">
              <p className="text-xs text-slate-400 whitespace-pre-wrap break-words font-mono">
                {scenario.logs && scenario.logs.length > 0 ? scenario.logs.join('\n') : 'Sin logs disponibles'}
              </p>
            </div>
          )}

          {tab === 'db' && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="text-xs text-slate-500 mb-2">Query</p>
                <pre className="bg-black/50 p-2 rounded text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap">
                  {safeValue(scenario.db?.query)}
                </pre>
              </div>
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="text-xs text-slate-500 mb-2">Resultado</p>
                <pre className="bg-black/50 p-2 rounded text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap">
                  {safeValue(scenario.db?.result)}
                </pre>
              </div>
            </div>
          )}

          {tab === 'error' && (
            <div className="space-y-3">
              {scenario.error ? (
                <>
                  <div className="flex justify-end">
                    <button
                      onClick={handleCopyError}
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-white/5 border border-white/10 text-slate-400 hover:text-red-300 transition-all"
                    >
                      <Copy size={10} /> Copiar
                    </button>
                  </div>
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <p className="text-xs font-bold text-red-400 mb-2">Mensaje</p>
                    <p className="text-xs text-red-200 font-mono whitespace-pre-wrap break-all">
                      {scenario.error.message}
                    </p>
                  </div>
                  {scenario.error.stack && (
                    <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                      <p className="text-xs font-bold text-red-400 mb-2">Stack Trace</p>
                      <pre className="bg-black/50 p-2 rounded text-xs text-red-300 overflow-x-auto max-h-64">
                        {scenario.error.stack}
                      </pre>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-slate-500">Sin errores</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex gap-2 justify-end p-6 border-t border-[#1e293b] bg-black/20 flex-wrap" />
      </div>
    </div>
  );
}
