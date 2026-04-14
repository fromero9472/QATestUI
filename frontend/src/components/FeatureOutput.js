import React, { useState } from 'react';
import './FeatureOutput.css';

export default function FeatureOutput({ output, onDownload, onReset }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(output.content);
    } catch {
      const el = document.createElement('textarea');
      el.value = output.content;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lineCount     = output.content.split('\n').length;
  const scenarioCount = (output.content.match(/Scenario:/g) || []).length;
  const fieldCount    = (output.content.match(/match response\./g) || []).length;
  const safeFileName  = output.featureName.replace(/[^a-z0-9_\-]/gi, '_');

  return (
    <div className="output-wrapper">

      {/* ── Success banner ── */}
      <div className="output-banner">
        <div className="output-banner__icon">✅</div>
        <div className="output-banner__text">
          <h2>¡Feature generado exitosamente!</h2>
          <p>
            <strong>{output.featureName}</strong> — listo para copiar a tu proyecto Karate.
          </p>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="output-stats">
        <div className="stat-box">
          <div className="stat-box__value">{scenarioCount}</div>
          <div className="stat-box__label">Escenarios</div>
        </div>
        <div className="stat-box">
          <div className="stat-box__value">{fieldCount}</div>
          <div className="stat-box__label">Validaciones</div>
        </div>
        <div className="stat-box">
          <div className="stat-box__value">{lineCount}</div>
          <div className="stat-box__label">Líneas</div>
        </div>
        <div className="stat-box">
          <div className="stat-box__value">.feature</div>
          <div className="stat-box__label">Formato</div>
        </div>
      </div>

      {/* ── Action bar ── */}
      <div className="output-actions">
        <button className="btn btn--success" onClick={onDownload}>
          ⬇ Descargar {safeFileName}.feature
        </button>
        <button
          className={`btn ${copied ? 'btn--success' : 'btn--ghost'}`}
          onClick={handleCopy}
        >
          {copied ? '✔ Copiado!' : '📋 Copiar código'}
        </button>
        <button className="btn btn--ghost" onClick={onReset}>
          ← Nuevo feature
        </button>
      </div>

      {/* ── Code viewer (macOS style) ── */}
      <div className="output-card">
        <div className="output-card__header">
          <div className="output-filename">
            <div className="output-filename-dots">
              <span className="dot dot--red" />
              <span className="dot dot--yellow" />
              <span className="dot dot--green" />
            </div>
            📄 {safeFileName}.feature
          </div>
          <span className="output-lang">Karate DSL</span>
        </div>
        <pre className="output-code">
          <code>{output.content}</code>
        </pre>
      </div>

      {/* ── Quick guide ── */}
      <div className="output-guide card">
        <p className="card__title">🚀 Cómo ejecutar este test</p>
        <ol className="guide-steps">
          <li>
            Descargá el archivo y copialo a <code>src/test/resources/</code> en tu proyecto Karate.
          </li>
          <li>
            Definí <code>baseUrl</code> en tu <code>karate-config.js</code>:<br />
            <code>{'var config = { baseUrl: "https://api.tu-entorno.com" };'}</code>
          </li>
          <li>
            Ejecutá con Maven:<br />
            <code>{'mvn test -Dtest=KarateRunner -Dkarate.env=qa'}</code>
          </li>
          <li>
            O directamente:<br />
            <code>{'java -jar karate.jar ' + safeFileName + '.feature'}</code>
          </li>
        </ol>
      </div>
    </div>
  );
}
