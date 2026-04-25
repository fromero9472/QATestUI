import React, { useState } from 'react';
import axios from 'axios';
import { Sparkles, ChevronDown, ChevronUp, CheckCircle2, X, Cpu, GitBranch, Lock } from 'lucide-react';
import { useAuth } from '../AuthContext';
import './SmartFill.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

const METHOD_COLORS = {
  GET:    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  POST:   'bg-blue-500/10 text-blue-400 border-blue-500/20',
  PUT:    'bg-amber-500/10 text-amber-400 border-amber-500/20',
  PATCH:  'bg-orange-500/10 text-orange-400 border-orange-500/20',
  DELETE: 'bg-red-500/10 text-red-400 border-red-500/20',
};

// ── Helper: check if AI is ready to use ──────────────────────────────────────
function useAIReady() {
  const { providerId, apiKey, currentProvider, isGitHubLoggedIn, copilotStatus } = useAuth();
  if (['github', 'copilot'].includes(providerId)) {
    if (!isGitHubLoggedIn) return { ready: false, reason: 'Necesitás conectar tu cuenta de GitHub para usar este proveedor.' };
    if (providerId === 'copilot' && copilotStatus !== 'ok') return { ready: false, reason: 'Se verificó que no tenés acceso a GitHub Copilot o todavía no se confirmó la suscripción.' };
    return { ready: true };
  }
  if (currentProvider?.authType === 'apikey' && !apiKey?.trim()) {
    return { ready: false, reason: `Necesitás ingresar tu API Key de ${currentProvider.label} en el panel de Proveedor de IA.` };
  }
  return { ready: true };
}

export default function SmartFill({ onApply }) {
  const {
    providerId, currentProvider,
    githubUser, isGitHubLoggedIn,
    copilotStatus, copilotError,
    loginWithGitHub,
    buildAIPayload,
  } = useAuth();

  const { ready: isAIReady, reason: notReadyReason } = useAIReady();

  const [open, setOpen]       = useState(false);
  const [text, setText]       = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState('');

  const handleParse = async () => {
    if (!text.trim()) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const payload = buildAIPayload({ text });
      const { data } = await axios.post(`${BACKEND_URL}/parse-criteria`, payload, { withCredentials: true });
      if (data.success) setResult(data);
      else setError(data.errors?.[0] || 'No se pudo analizar el texto.');
    } catch (err) {
      setError(err?.response?.data?.errors?.[0] || 'Error de conexión con el backend.');
    } finally { setLoading(false); }
  };

  const handleApply = () => {
    if (result) { onApply(result); setOpen(false); setText(''); setResult(null); }
  };
  const handleClose = () => { setOpen(false); setText(''); setResult(null); setError(''); };

  const scenarios = result
    ? (Array.isArray(result.scenarios) ? result.scenarios : result.scenario ? [result.scenario] : [])
    : [];

  const canAnalyze = text.trim() && !loading && isAIReady;

  return (
    <div className="bg-[#111827] border border-[#1e293b] rounded-2xl overflow-hidden shadow-lg shadow-black/20 mb-4">

      {/* Toggle header */}
      <button type="button" onClick={() => isAIReady && setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-5 py-4 transition-colors duration-150 group ${isAIReady ? 'hover:bg-white/[0.02]' : 'cursor-not-allowed opacity-60'}`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            {isAIReady ? <Sparkles size={15} className="text-violet-400" /> : <Lock size={15} className="text-slate-500" />}
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-white">Smart Fill</p>
            <p className="text-xs text-slate-500">
              {isAIReady ? 'Pegá tus criterios de aceptación y completamos el formulario' : 'Configurá el Proveedor de IA para usar esta función'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isGitHubLoggedIn && isAIReady && (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold">
              {githubUser?.avatar && <img src={githubUser.avatar} alt="" className="w-3.5 h-3.5 rounded-full" />}
              {githubUser?.login}
            </span>
          )}
          {isAIReady && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold">
              <Cpu size={10} /> {currentProvider.label}
            </span>
          )}
          {!isAIReady
            ? <Lock size={14} className="text-slate-600" />
            : open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />
          }
        </div>
      </button>

      {/* Lock notice (when not ready) */}
      {!isAIReady && (
        <div className="border-t border-[#1e293b] px-5 py-4 flex items-center gap-3 bg-amber-500/5">
          <Lock size={14} className="text-amber-400 shrink-0" />
          <p className="text-xs text-amber-300">{notReadyReason}</p>
          {['github', 'copilot'].includes(providerId) && !isGitHubLoggedIn && (
            <button type="button" onClick={() => loginWithGitHub(providerId)}
              className="ml-auto shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-semibold transition-colors">
              <GitBranch size={12} /> Conectar GitHub
            </button>
          )}
        </div>
      )}

      {open && isAIReady && (
        <div className="border-t border-[#1e293b] p-5 space-y-4">

          {copilotStatus === 'error' && providerId === 'copilot' && (
            <div className="text-xs text-red-400 p-3 rounded-xl bg-red-500/5 border border-red-500/20">
              ⚠ {copilotError}
            </div>
          )}

          <p className="text-xs text-slate-400">
            📋 Pegá el texto de <strong className="text-slate-300">uno o varios criterios</strong> (<strong className="text-slate-300">Dado / Cuando / Entonces</strong>).
          </p>

          <textarea
            className="form-control resize-none font-mono text-xs leading-relaxed"
            value={text} onChange={e => setText(e.target.value)}
            placeholder={`Dado que un cliente ingresa con uuid de ClaroPay\nCuando se invoca /v1/client/data\nEntonces HTTP 200, hasClaroPay = true...`}
            rows={8} spellCheck={false}
          />

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn--primary" onClick={handleParse} disabled={!canAnalyze}>
              {loading ? <><span className="spinner" />Analizando...</> : <><Sparkles size={14} />Analizar criterios</>}
            </button>
            {result && (
              <button type="button" className="btn btn--success" onClick={handleApply}>
                <CheckCircle2 size={14} /> Aplicar {scenarios.length > 1 ? `${scenarios.length} escenarios` : 'al formulario'}
              </button>
            )}
            <button type="button" className="btn btn--ghost" onClick={handleClose}>
              <X size={14} /> Cancelar
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-400 p-3 rounded-xl bg-red-500/5 border border-red-500/20">
              ⚠ {error}
            </div>
          )}

          {result && (
            <div className="space-y-3 pt-2 border-t border-[#1e293b]">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-300">🔍 Lo que detectamos — revisá antes de aplicar:</p>
                {scenarios.length > 1 && (
                  <span className="px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold">
                    {scenarios.length} escenarios
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-[#0b0f1a] border border-[#1e293b]">
                <div>
                  <span className="text-xs text-slate-500 block mb-0.5">Feature Name</span>
                  <span className="text-sm text-slate-200">{result.featureName || <em className="text-slate-600">No detectado</em>}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block mb-0.5">Endpoint</span>
                  <code className="text-sm text-emerald-400 font-mono">{result.endpoint || <em className="text-slate-600">No detectado</em>}</code>
                </div>
              </div>
              {scenarios.map((s, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-[#0b0f1a] border border-[#1e293b] space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Escenario {idx + 1}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${METHOD_COLORS[s.method] || METHOD_COLORS.GET}`}>{s.method}</span>
                    <code className="text-xs text-slate-400 font-mono">HTTP {s.expectedStatus}</code>
                    {s.name && <span className="text-xs text-slate-400 italic truncate">{s.name}</span>}
                  </div>
                  {s.assertions?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {s.assertions.map((a, i) => (
                        <span key={i} className="px-2 py-1 rounded-lg bg-[#111827] border border-[#1e293b] text-xs font-mono text-slate-300">
                          <strong className="text-violet-300">{a.field}</strong> {a.operator}{a.value ? ` "${a.value}"` : ''}
                        </span>
                      ))}
                    </div>
                  )}
                  {s.detectedBody && (
                    <pre className="text-xs bg-[#111827] rounded-lg p-3 text-slate-400 overflow-auto border border-[#1e293b] font-mono">{s.detectedBody}</pre>
                  )}
                </div>
              ))}
              <p className="text-xs text-slate-500">
                💡 Hacé clic en <strong className="text-violet-400">"Aplicar"</strong> para pre-completar los campos.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

