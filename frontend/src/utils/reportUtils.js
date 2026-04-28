/**
 * Utility para parsear resultados de Karate desde logs
 */

export function parseKarateScenarios(logs) {
  const scenarios = [];
  let currentScenario = null;

  logs.forEach((log) => {
    const text = log.text || '';

    // Detectar inicio de Scenario
    if (text.includes('Scenario:')) {
      if (currentScenario) scenarios.push(currentScenario);

      const match = text.match(/Scenario:\s*(.+)/);
      currentScenario = {
        name: match ? match[1].trim() : 'Unknown',
        status: 'PENDING',
        durationMs: 0,
        tags: [],
        request: {},
        response: {},
        assertions: [],
        logs: [],
        error: null,
      };
    }

    // Agregar log al scenario actual
    if (currentScenario) {
      currentScenario.logs.push(text);
    }

    // Detectar PASSED
    if (text.includes('Status code')) {
      if (currentScenario && !currentScenario.status.includes('PASSED')) {
        currentScenario.status = 'PASSED';
      }
    }

    // Detectar FAILED
    if (text.includes('failed') || text.includes('Failed') || text.includes('ERROR')) {
      if (currentScenario) {
        currentScenario.status = 'FAILED';
        if (!currentScenario.error) {
          currentScenario.error = {
            message: text,
            stack: text,
          };
        }
      }
    }
  });

  if (currentScenario) scenarios.push(currentScenario);
  return scenarios;
}

export function generateReport(executionData) {
  return {
    executionId: `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    featureName: executionData.featureName || 'Feature',
    environment: executionData.environment || 'unknown',
    baseUrl: executionData.baseUrl || '',
    status: executionData.success ? 'PASSED' : 'FAILED',
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: executionData.durationMs || 0,
    summary: {
      total: executionData.summary?.total || 0,
      passed: executionData.summary?.passed || 0,
      failed: executionData.summary?.failed || 0,
      skipped: executionData.summary?.skipped || 0,
    },
    scenarios: executionData.scenarios || [],
  };
}

export function exportReportAsJSON(report) {
  const data = JSON.stringify(report, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `karate-reporte-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportReportAsHTML(report) {
  const safe = (v, fallback = 'Sin datos') => (v === null || v === undefined || v === '' ? fallback : v);
  const formatBody = (value) => {
    if (value === null || value === undefined || value === '') return 'Sin datos';
    if (typeof value === 'string') return value;
    try { return JSON.stringify(value, null, 2); } catch { return String(value); }
  };

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Reporte Karate - ${report.featureName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', sans-serif; background: #0b1220; color: #dbe3f4; padding: 20px; }
    .container { max-width: 1280px; margin: 0 auto; background: #111a2e; border: 1px solid #26324a; border-radius: 10px; padding: 24px; }
    h1 { color: #dbe3f4; margin-bottom: 20px; }
    .summary { display: grid; grid-template-columns: repeat(6, 1fr); gap: 15px; margin-bottom: 30px; }
    .summary-card { background: #0f1729; border: 1px solid #22304a; padding: 15px; border-radius: 6px; }
    .summary-card.passed { border-left-color: #28a745; }
    .summary-card.failed { border-left-color: #dc3545; }
    .summary-card h3 { color: #90a0bf; font-size: 12px; font-weight: 600; margin-bottom: 8px; text-transform: uppercase; }
    .summary-card .value { color: #dbe3f4; font-size: 24px; font-weight: bold; }
    .scenarios { margin-top: 30px; }
    .scenario { background: #0f1729; border: 1px solid #22304a; border-radius: 6px; padding: 15px; margin-bottom: 15px; }
    .scenario.passed { border-left: 4px solid #28a745; }
    .scenario.failed { border-left: 4px solid #dc3545; }
    .scenario h3 { color: #dbe3f4; margin-bottom: 10px; }
    .scenario-details { margin-top: 10px; }
    .scenario-detail { color: #9db0d7; font-size: 12px; margin: 5px 0; }
    .error { background: #351818; color: #ffb6b6; padding: 10px; border-radius: 4px; margin-top: 10px; font-family: monospace; }
    pre { background: #0b1220; color: #dbe3f4; border: 1px solid #22304a; border-radius: 6px; padding: 8px; margin-top: 8px; white-space: pre-wrap; }
    footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #22304a; color: #90a0bf; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Reporte Karate</h1>

    <div class="summary">
      <div class="summary-card">
        <h3>Feature</h3>
        <div class="value">${safe(report.featureName)}</div>
      </div>
      <div class="summary-card ${report.status === 'PASSED' ? 'passed' : 'failed'}">
        <h3>Estado</h3>
        <div class="value">${safe(report.status)}</div>
      </div>
      <div class="summary-card">
        <h3>Total</h3>
        <div class="value">${report.summary.total}</div>
      </div>
      <div class="summary-card passed">
        <h3>Pasados</h3>
        <div class="value">${report.summary.passed}</div>
      </div>
      <div class="summary-card failed">
        <h3>Fallidos</h3>
        <div class="value">${report.summary.failed}</div>
      </div>
      <div class="summary-card">
        <h3>Duración</h3>
        <div class="value">${(report.durationMs / 1000).toFixed(2)}s</div>
      </div>
    </div>

    <div class="scenarios">
      <h2>Escenarios</h2>
      ${report.scenarios.map(s => `
        <div class="scenario ${s.status?.toLowerCase()}">
          <h3>${safe(s.name)} <span style="color: #90a0bf; font-size: 12px;">${safe(s.status)}</span></h3>
          <div class="scenario-details">
            <div class="scenario-detail">⏱ Duración: ${((s.durationMs || 0) / 1000).toFixed(2)}s</div>
            <div class="scenario-detail">🌐 Método: ${safe(s.http?.method)}</div>
            <div class="scenario-detail">🔗 Endpoint: ${safe(s.http?.url)}</div>
            <div class="scenario-detail">📈 Status esperado: ${safe(s.http?.expectedStatus)}</div>
            <div class="scenario-detail">📉 Status obtenido: ${safe(s.http?.actualStatus)}</div>
            <details><summary>Request</summary><pre>${formatBody(s.http?.requestBody)}</pre></details>
            <details><summary>Response</summary><pre>${formatBody(s.http?.responseBody)}</pre></details>
            ${s.error ? `<div class="error">❌ ${safe(s.error?.message)}<pre>${safe(s.error?.stack)}</pre></div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>

    <footer>
      <p>Generado: ${new Date(report.finishedAt).toLocaleString('es-AR')}</p>
      <p>Ambiente: ${report.environment} | Base URL: ${report.baseUrl}</p>
    </footer>
  </div>
</body>
</html>
  `;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `karate-reporte-${Date.now()}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function copyReportSummary(report) {
  const summary = `
🎯 REPORTE DE EJECUCIÓN KARATE

📋 Feature: ${report.featureName}
🌍 Ambiente: ${report.environment}
📊 Estado: ${report.status}
⏱ Duración: ${(report.durationMs / 1000).toFixed(2)}s

📈 RESUMEN
━━━━━━━━━━━━━━━━━━━
Total escenarios: ${report.summary.total}
✅ Pasados: ${report.summary.passed}
❌ Fallidos: ${report.summary.failed}
⏭ Saltados: ${report.summary.skipped}

🔗 Base URL: ${report.baseUrl}
📅 Generado: ${new Date(report.finishedAt).toLocaleString('es-AR')}
`.trim();

  navigator.clipboard.writeText(summary);
}

