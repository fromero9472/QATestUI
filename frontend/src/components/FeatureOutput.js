import React, { useState } from 'react';
import { Download, Copy, Check, ArrowLeft, FileCode2, Zap } from 'lucide-react';
import './FeatureOutput.css';

export default function FeatureOutput({ output, onDownload, onReset }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(output.content); }
    catch {
      const el = document.createElement('textarea');
      el.value = output.content; document.body.appendChild(el); el.select();
      document.execCommand('copy'); document.body.removeChild(el);
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const lineCount     = output.content.split('\n').length;
  const scenarioCount = (output.content.match(/Scenario:/g) || []).length;
  const fieldCount    = (output.content.match(/match response\./g) || []).length;
  const safeFileName  = output.featureName.replace(/[^a-z0-9_\-]/gi, '_');

  return (
    <div className="space-y-4 pt-4">

      {/* ── Success banner ── */}
      <div className="flex items-center gap-4 p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-2xl shrink-0">
          ✅
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">¡Feature generado exitosamente!</h2>
          <p className="text-sm text-slate-400">
            <span className="text-emerald-400 font-semibold">{output.featureName}</span> — listo para copiar a tu proyecto Karate.
          </p>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { value: scenarioCount, label: 'Escenarios' },
          { value: fieldCount,    label: 'Validaciones' },
          { value: lineCount,     label: 'Líneas' },
          { value: '.feature',    label: 'Formato' },
        ].map(({ value, label }) => (
          <div key={label} className="bg-[#111827] border border-[#1e293b] rounded-2xl p-4 text-center">
            <div className="text-2xl font-extrabold text-white mb-1">{value}</div>
            <div className="text-xs text-slate-500 font-medium">{label}</div>
          </div>
        ))}
      </div>

      {/* ── Actions ── */}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn--success" onClick={onDownload}>
          <Download size={15} /> Descargar {safeFileName}.feature
        </button>
        <button className={`btn ${copied ? 'btn--success' : 'btn--ghost'}`} onClick={handleCopy}>
          {copied ? <><Check size={14} /> Copiado!</> : <><Copy size={14} /> Copiar código</>}
        </button>
        <button className="btn btn--ghost" onClick={onReset}>
          <ArrowLeft size={14} /> Nuevo feature
        </button>
      </div>

      {/* ── Code viewer ── */}
      <div className="bg-[#0b0f1a] border border-[#1e293b] rounded-2xl overflow-hidden shadow-lg">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e293b] bg-[#111827]">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500/70" />
              <span className="w-3 h-3 rounded-full bg-amber-500/70" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/70" />
            </div>
            <span className="text-xs font-medium text-slate-400 font-mono">
              <FileCode2 size={12} className="inline mr-1" />{safeFileName}.feature
            </span>
          </div>
          <span className="text-xs text-slate-600 font-mono">Karate DSL</span>
        </div>
        <pre className="p-5 text-xs text-slate-300 overflow-auto leading-relaxed font-mono max-h-[60vh]">
          <code>{output.content}</code>
        </pre>
      </div>

      {/* ── Quick guide ── */}
      <div className="card">
        <p className="card__title"><Zap size={14} /> Cómo ejecutar este test</p>
        <ol className="space-y-3 list-decimal list-inside text-sm text-slate-400">
          <li>
            Descargá el archivo y copialo a <code className="px-1.5 py-0.5 rounded bg-[#0b0f1a] text-violet-300 text-xs font-mono border border-[#1e293b]">src/test/resources/</code>
          </li>
          <li>
            Definí <code className="px-1.5 py-0.5 rounded bg-[#0b0f1a] text-violet-300 text-xs font-mono border border-[#1e293b]">baseUrl</code> en tu{' '}
            <code className="px-1.5 py-0.5 rounded bg-[#0b0f1a] text-violet-300 text-xs font-mono border border-[#1e293b]">karate-config.js</code>
          </li>
          <li>
            Ejecutá con Maven: <code className="px-1.5 py-0.5 rounded bg-[#0b0f1a] text-emerald-300 text-xs font-mono border border-[#1e293b]">mvn test -Dtest=KarateRunner -Dkarate.env=qa</code>
          </li>
          <li>
            O directamente: <code className="px-1.5 py-0.5 rounded bg-[#0b0f1a] text-emerald-300 text-xs font-mono border border-[#1e293b]">java -jar karate.jar {safeFileName}.feature</code>
          </li>
        </ol>
      </div>
    </div>
  );
}
