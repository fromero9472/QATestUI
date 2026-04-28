/**
 * Helpers para normalizar datos del reporte Karate
 * Evita "undefined" y asegura valores por defecto
 */

export const DEFAULT_REPORT = {
  executionId: '',
  featureName: 'Sin nombre',
  environment: 'N/A',
  baseUrl: '',
  status: 'UNKNOWN',
  startedAt: new Date().toISOString(),
  finishedAt: new Date().toISOString(),
  durationMs: 0,
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
  },
  scenarios: [],
};

/**
 * Normaliza un reporte crudoación
 */
export function normalizeReport(report) {
  if (!report) return DEFAULT_REPORT;

  const summary = report.summary || DEFAULT_REPORT.summary;
  const scenarios = Array.isArray(report.scenarios) ? report.scenarios : [];

  return {
    executionId: report.executionId || '',
    featureName: report.featureName || DEFAULT_REPORT.featureName,
    environment: report.environment || 'N/A',
    baseUrl: report.baseUrl || '',
    status: report.status || 'UNKNOWN',
    startedAt: report.startedAt || DEFAULT_REPORT.startedAt,
    finishedAt: report.finishedAt || DEFAULT_REPORT.finishedAt,
    durationMs: report.durationMs ?? 0,
    summary: {
      total: summary.total ?? 0,
      passed: summary.passed ?? 0,
      failed: summary.failed ?? 0,
      skipped: summary.skipped ?? 0,
    },
    // Normalizar cada escenario con su índice
    scenarios: scenarios.map((s, idx) => normalizeScenario(s, idx)),
  };
}

/**
 * Normaliza un escenario con estructura COMPLETA
 * Preparado para recibir más datos de Karate en el futuro
 */
export function normalizeScenario(scenario, index = 0) {
  if (!scenario) {
    return createEmptyScenario(index);
  }

  return {
    // Básico
    id: scenario.id || `scenario-${index}`,
    index: index + 1,
    name: scenario.name || 'Unknown',
    status: (scenario.status || 'UNKNOWN').toUpperCase(),
    durationMs: scenario.durationMs ?? 0,

    // Karate metadata
    tags: Array.isArray(scenario.tags) ? scenario.tags : [],
    featureFile: scenario.featureFile || 'Sin datos',
    line: scenario.line ?? null,

    // HTTP details
    http: {
      method: scenario.http?.method || scenario.method || 'Sin datos',
      url: scenario.http?.url || scenario.url || 'Sin datos',
      expectedStatus: scenario.http?.expectedStatus ?? scenario.expectedStatus ?? null,
      actualStatus: scenario.http?.actualStatus ?? scenario.actualStatus ?? null,
      headers: scenario.http?.headers || scenario.headers || {},
      requestBody: scenario.http?.requestBody ?? scenario.request ?? null,
      responseBody: scenario.http?.responseBody ?? scenario.response ?? null,
    },

    // Test data & results
    steps: Array.isArray(scenario.steps) ? scenario.steps : [],
    assertions: Array.isArray(scenario.assertions) ? scenario.assertions : [],
    testData: scenario.testData || {},
    db: scenario.db || { query: null, result: null },

    // Logs & errors
    logs: Array.isArray(scenario.logs) ? scenario.logs : [],
    error: scenario.error ? {
      message: scenario.error.message || 'Error desconocido',
      stack: scenario.error.stack || '',
    } : null,
  };
}

/**
 * Crea un escenario vacío con la estructura completa
 */
function createEmptyScenario(index = 0) {
  return {
    id: `scenario-${index}`,
    index: index + 1,
    name: 'Unknown',
    status: 'UNKNOWN',
    durationMs: 0,
    tags: [],
    featureFile: 'Sin datos',
    line: null,
    http: {
      method: 'Sin datos',
      url: 'Sin datos',
      expectedStatus: null,
      actualStatus: null,
      headers: {},
      requestBody: null,
      responseBody: null,
    },
    steps: [],
    assertions: [],
    testData: {},
    db: { query: null, result: null },
    logs: [],
    error: null,
  };
}

/**
 * Formatea duración a string legible
 */
export function formatDuration(ms) {
  if (ms == null || isNaN(ms)) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Calcula porcentaje de éxito
 */
export function calculateSuccessRate(total, passed) {
  if (total === 0) return 0;
  return Math.round((passed / total) * 100);
}

/**
 * Retorna color según estado
 */
export function getStatusColor(status) {
  const s = status?.toUpperCase() || 'UNKNOWN';

  switch (s) {
    case 'PASSED':
      return {
        bg: 'bg-green-500/10',
        border: 'border-green-500/20',
        text: 'text-green-300',
        icon: 'text-green-400',
        label: 'text-green-400',
      };
    case 'FAILED':
      return {
        bg: 'bg-red-500/10',
        border: 'border-red-500/20',
        text: 'text-red-300',
        icon: 'text-red-400',
        label: 'text-red-400',
      };
    case 'ERROR':
      return {
        bg: 'bg-red-600/10',
        border: 'border-red-600/20',
        text: 'text-red-200',
        icon: 'text-red-500',
        label: 'text-red-500',
      };
    case 'SKIPPED':
      return {
        bg: 'bg-slate-500/10',
        border: 'border-slate-500/20',
        text: 'text-slate-300',
        icon: 'text-slate-400',
        label: 'text-slate-400',
      };
    default:
      return {
        bg: 'bg-slate-500/10',
        border: 'border-slate-500/20',
        text: 'text-slate-300',
        icon: 'text-slate-400',
        label: 'text-slate-400',
      };
  }
}

/**
 * Genera el resumen textual del reporte
 */
export function generateReportSummary(report) {
  const { featureName, environment, status, summary, durationMs, startedAt } = normalizeReport(report);
  const date = new Date(startedAt).toLocaleString('es-AR');
  const duration = formatDuration(durationMs);

  return `
📊 REPORTE DE EJECUCIÓN KARATE

📋 Feature: ${featureName}
🌍 Ambiente: ${environment}
📊 Estado: ${status}
⏱ Duración: ${duration}

📈 RESULTADOS
━━━━━━━━━━━━━━━━━━━
Total: ${summary.total}
✅ Pasados: ${summary.passed}
❌ Fallidos: ${summary.failed}
⏭ Saltados: ${summary.skipped}

📅 Generado: ${date}
  `.trim();
}

/**
 * Valida si un reporte tiene datos válidos
 */
export function isValidReport(report) {
  return report && report.summary && typeof report.summary.total === 'number';
}

/**
 * Retorna un valor seguro para UI - nunca undefined/null
 */
export function safeValue(value, fallback = 'Sin datos') {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object' && Object.keys(value).length === 0) return fallback;
  return value;
}

/**
 * Formatea un objeto/string para mostrar en UI
 */
export function formatValue(value) {
  if (value === null || value === undefined) return 'Sin datos';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

