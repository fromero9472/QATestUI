import React from 'react';
import { TrendingUp, Activity, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { MetricCard, StatusBadge } from './index';
import { formatDuration, normalizeReport } from '../utils/reportHelpers';

/**
 * ReportStats - Componente de estadísticas del reporte
 *
 * Props:
 * - report: Objeto del reporte normalizado
 * - showTrending: boolean - mostrar gráficos de tendencia
 */
export default function ReportStats({ report, showTrending = true }) {
  if (!report) {
    return (
      <div className="p-6 rounded-lg bg-slate-900/50 border border-slate-700 text-center text-slate-500">
        <Activity size={32} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm">Sin estadísticas disponibles</p>
      </div>
    );
  }

  const normalized = normalizeReport(report);
  const { summary, status, durationMs } = normalized;
  const { total, passed, failed, skipped } = summary;

  const successRate = total > 0 ? ((passed / total) * 100).toFixed(1) : 0;
  const failureRate = total > 0 ? ((failed / total) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-4">
      {/* Resumen rápido */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard
          label="Total Escenarios"
          value={total}
          sublabel={`${status}`}
          variant="default"
        />
        <MetricCard
          label="✓ Exitosos"
          value={passed}
          sublabel={`${successRate}%`}
          variant="success"
        />
        <MetricCard
          label="✗ Fallidos"
          value={failed}
          sublabel={`${failureRate}%`}
          variant="error"
        />
        <MetricCard
          label="⏭ Saltados"
          value={skipped}
          sublabel="Excluidos"
          variant="default"
        />
        <MetricCard
          label="⏱ Duración"
          value={formatDuration(durationMs)}
          sublabel="Tiempo total"
          variant="warning"
        />
      </div>

      {/* Barra de estado */}
      {showTrending && (
        <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700">
          <p className="text-xs font-bold text-slate-400 uppercase mb-3">Distribución</p>
          <div className="flex items-center h-8 gap-0 rounded-lg overflow-hidden border border-white/10">
            {total > 0 && (
              <>
                <div
                  className="bg-green-500 h-full transition-all hover:bg-green-400"
                  style={{ width: `${(passed / total) * 100}%` }}
                  title={`${passed} Exitosos (${successRate}%)`}
                />
                <div
                  className="bg-red-500 h-full transition-all hover:bg-red-400"
                  style={{ width: `${(failed / total) * 100}%` }}
                  title={`${failed} Fallidos (${failureRate}%)`}
                />
                {skipped > 0 && (
                  <div
                    className="bg-slate-500 h-full transition-all hover:bg-slate-400"
                    style={{ width: `${(skipped / total) * 100}%` }}
                    title={`${skipped} Saltados`}
                  />
                )}
              </>
            )}
          </div>
          <div className="flex gap-4 mt-2 text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500" /> Exitosos
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500" /> Fallidos
            </span>
            {skipped > 0 && (
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-slate-500" /> Saltados
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

