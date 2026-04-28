import React from 'react';
import { ChevronDown, ChevronUp, Copy, Download } from 'lucide-react';
import { StatusBadge } from './index';
import { formatDuration, safeValue } from '../utils/reportHelpers';

/**
 * Card expandible para mostrar un escenario
 */
export default function ScenarioCard({
  scenario,
  expanded = false,
  onToggle,
  onCopyError,
  onDownload,
}) {
  if (!scenario) return null;

  const {
    index,
    name,
    status,
    durationMs,
    tags = [],
    error,
  } = scenario;

  return (
    <div className="bg-[#111827] border border-[#1e293b] rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow mb-2">
      {/* Header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors group"
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Número */}
          <div className="w-7 h-7 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-xs font-bold text-violet-400 shrink-0">
            {index}
          </div>

          {/* Nombre */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate group-hover:text-violet-300 transition-colors">
              {safeValue(name)}
            </p>
            {tags.length > 0 && (
              <div className="flex gap-1 mt-1 flex-wrap">
                {tags.slice(0, 2).map((tag, i) => (
                  <span
                    key={i}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/20"
                  >
                    {tag}
                  </span>
                ))}
                {tags.length > 2 && (
                  <span className="text-[10px] text-slate-500">+{tags.length - 2}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Status + Duración */}
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <StatusBadge status={status} size="sm" />
          <span className="text-xs text-slate-400 font-mono">{formatDuration(durationMs)}</span>

          {/* Botones de acciones rápidas */}
          <div className="flex gap-1">
            {error && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCopyError?.(scenario);
                }}
                className="p-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                title="Copiar error"
              >
                <Copy size={13} />
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDownload?.(scenario);
              }}
              className="p-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors"
              title="Descargar escenario"
            >
              <Download size={13} />
            </button>
          </div>

          {/* Expand icon */}
          <div className="p-1">
            {expanded ? (
              <ChevronUp size={16} className="text-slate-400" />
            ) : (
              <ChevronDown size={16} className="text-slate-400" />
            )}
          </div>
        </div>
      </button>

      {/* Detail Section */}
      {expanded && (
        <div className="border-t border-[#1e293b] px-5 py-4 bg-black/30 space-y-3">
          <ScenarioDetail scenario={scenario} />
        </div>
      )}
    </div>
  );
}

/**
 * Detalle del escenario cuando está expandido
 */
function ScenarioDetail({ scenario }) {
  const {
    id,
    featureFile,
    line,
    http = {},
    steps = [],
    assertions = [],
    testData = {},
    logs = [],
    error,
  } = scenario;

  return (
    <div className="space-y-3 text-xs">
      {/* Metadata */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <div className="p-2 rounded-lg bg-white/5 border border-white/10">
          <p className="text-slate-500 text-[10px] uppercase mb-0.5">ID</p>
          <p className="text-slate-300 font-mono truncate">{safeValue(id)}</p>
        </div>
        <div className="p-2 rounded-lg bg-white/5 border border-white/10">
          <p className="text-slate-500 text-[10px] uppercase mb-0.5">Feature</p>
          <p className="text-slate-300 font-mono text-[10px] truncate">{safeValue(featureFile)}</p>
        </div>
        {line && (
          <div className="p-2 rounded-lg bg-white/5 border border-white/10">
            <p className="text-slate-500 text-[10px] uppercase mb-0.5">Línea</p>
            <p className="text-slate-300 font-mono">{line}</p>
          </div>
        )}
      </div>

      {/* HTTP Details */}
      {Object.keys(http).some(k => http[k] !== null && http[k] !== 'Sin datos') && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <p className="text-emerald-400 font-semibold mb-2">HTTP Details</p>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            {http.method && http.method !== 'Sin datos' && (
              <div>
                <p className="text-slate-500">Método</p>
                <p className="text-amber-300 font-mono font-bold">{http.method}</p>
              </div>
            )}
            {http.actualStatus && (
              <div>
                <p className="text-slate-500">Status</p>
                <p className={`font-mono font-bold ${http.actualStatus >= 200 && http.actualStatus < 300 ? 'text-green-300' : 'text-red-300'}`}>
                  {http.actualStatus}
                </p>
              </div>
            )}
          </div>
          {http.url && http.url !== 'Sin datos' && (
            <p className="text-slate-400 font-mono break-all mt-2">{http.url}</p>
          )}
        </div>
      )}

      {/* Assertions */}
      {assertions.length > 0 && (
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <p className="text-blue-400 font-semibold mb-2">Assertions ({assertions.length})</p>
          <div className="space-y-1">
            {assertions.slice(0, 3).map((a, i) => (
              <p key={i} className="text-slate-400 font-mono text-[10px] truncate">
                {typeof a === 'string' ? a : JSON.stringify(a)}
              </p>
            ))}
            {assertions.length > 3 && (
              <p className="text-slate-500 text-[10px]">+{assertions.length - 3} más</p>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-red-400 font-semibold mb-2">Error</p>
          <p className="text-red-300 font-mono text-[10px] break-all">{safeValue(error.message)}</p>
        </div>
      )}

      {/* Logs */}
      {logs.length > 0 && (
        <div className="p-3 rounded-lg bg-slate-500/10 border border-slate-500/20">
          <p className="text-slate-400 font-semibold mb-2">Logs ({logs.length})</p>
          <div className="max-h-24 overflow-y-auto bg-black/30 rounded p-2 font-mono text-[10px] text-slate-400">
            {Array.isArray(logs)
              ? logs.slice(0, 5).map((log, i) => <div key={i}>{safeValue(log)}</div>)
              : <div>{safeValue(logs)}</div>
            }
            {Array.isArray(logs) && logs.length > 5 && (
              <div className="text-slate-600">... +{logs.length - 5} líneas más</div>
            )}
          </div>
        </div>
      )}

      {/* Steps */}
      {steps.length > 0 && (
        <div className="p-3 rounded-lg bg-slate-500/10 border border-slate-500/20">
          <p className="text-slate-400 font-semibold mb-2">Steps ({steps.length})</p>
          <div className="space-y-1">
            {steps.slice(0, 5).map((step, i) => (
              <div key={i} className="text-slate-400 text-[10px]">
                <span className="text-slate-600">{i + 1}.</span> {safeValue(typeof step === 'string' ? step : step.text || '')}
              </div>
            ))}
            {steps.length > 5 && (
              <p className="text-slate-600 text-[10px]">... +{steps.length - 5} pasos más</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

