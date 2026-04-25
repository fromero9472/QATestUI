import React, { useState } from 'react';
import { Cpu, ChevronDown, ChevronUp, Key, ExternalLink, GitBranch, LogOut, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../AuthContext';

/**
 * AIProviderPanel — Selector de proveedor de IA reutilizable.
 * Se puede embeber en SmartFill, ConfluenceImport, o cualquier sección
 * que dispare llamadas a la IA.
 *
 * Props (opcionales):
 *  - defaultOpen: boolean  → si el panel arranca expandido (default false)
 */
export default function AIProviderPanel({ defaultOpen = false }) {
  const {
    providers, providerId, model, apiKey, ollamaUrl,
    setModel, setApiKey, setOllamaUrl,
    changeProvider, currentProvider,
    githubToken, githubUser, isGitHubLoggedIn,
    loginWithGitHub, logout,
    copilotStatus, copilotError, copilotChecking,
    checkCopilotAccess,
  } = useAuth();

  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-[#1e293b] overflow-hidden">
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#0b0f1a] hover:bg-white/[0.02] transition-colors text-sm"
      >
        <div className="flex items-center gap-2 text-slate-300 font-medium">
          <Cpu size={14} className="text-violet-400" />
          Proveedor de IA:{' '}
          <span className="text-violet-400">{currentProvider.label}</span>
          {currentProvider.paid && (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold">
              PRO
            </span>
          )}
          <span className="text-slate-500 font-mono text-xs">· {model}</span>
        </div>
        {open
          ? <ChevronUp size={13} className="text-slate-500" />
          : <ChevronDown size={13} className="text-slate-500" />}
      </button>

      {open && (
        <div className="p-4 space-y-4 bg-[#0d1117] border-t border-[#1e293b]">

          {/* Provider tabs */}
          <div className="flex flex-wrap gap-2">
            {providers.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => changeProvider(p.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  providerId === p.id
                    ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                }`}
              >
                {['github', 'copilot'].includes(p.id) && <GitBranch size={11} />}
                {p.label}
                {p.paid && (
                  <span className="px-1 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold">PRO</span>
                )}
                {['github', 'copilot'].includes(p.id) && isGitHubLoggedIn && (
                  <span className={`w-1.5 h-1.5 rounded-full inline-block ${
                    p.id === 'copilot'
                      ? (copilotStatus === 'ok' ? 'bg-green-400' : copilotStatus === 'error' ? 'bg-red-400' : 'bg-yellow-400')
                      : 'bg-green-400'
                  }`} />
                )}
              </button>
            ))}
          </div>

          {/* GitHub / Copilot auth panel */}
          {['github', 'copilot'].includes(providerId) && (
            <div className="rounded-xl border border-[#1e293b] p-4 space-y-3 bg-[#0b0f1a]">
              <div className="flex items-center gap-2">
                <GitBranch size={14} className="text-slate-400" />
                <span className="text-xs font-semibold text-slate-300">
                  {providerId === 'copilot' ? 'GitHub Copilot' : 'GitHub Models'}
                </span>
                <span className="text-xs text-slate-500">
                  {providerId === 'copilot' ? '· Requiere suscripción paga' : '· Gratis con tu cuenta'}
                </span>
              </div>

              {!isGitHubLoggedIn ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => loginWithGitHub(providerId)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#238636] hover:bg-[#2ea043] border border-[#238636] text-white text-sm font-semibold transition-colors"
                  >
                    <GitBranch size={15} /> Iniciar sesión con GitHub
                  </button>
                  <p className="text-xs text-slate-500 text-center">El token no se almacena en el servidor</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {githubUser?.avatar && (
                        <img src={githubUser.avatar} alt={githubUser.login} className="w-7 h-7 rounded-full border border-green-500/30" />
                      )}
                      <div>
                        <p className="text-xs font-semibold text-green-500">{githubUser?.name || githubUser?.login}</p>
                        <p className="text-xs text-slate-500">@{githubUser?.login} · Sesión activa</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={logout}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs hover:bg-red-500/20 transition-colors"
                    >
                      <LogOut size={11} /> Cerrar sesión
                    </button>
                  </div>

                  {providerId === 'copilot' && (
                    <div className={`flex flex-col gap-2 p-2.5 rounded-lg text-xs border ${
                      copilotChecking
                        ? 'border-slate-300 bg-slate-800/30 text-slate-400'
                        : copilotStatus === 'ok'
                          ? 'border-green-500/20 bg-green-500/5 text-green-500'
                          : copilotStatus === 'error'
                            ? 'border-red-500/20 bg-red-500/5 text-red-500'
                            : 'border-slate-300 bg-slate-800/30 text-slate-400'
                    }`}>
                      {copilotChecking && (
                        <span className="flex items-center gap-1"><RefreshCw size={12} className="animate-spin" /> Verificando suscripción Copilot...</span>
                      )}
                      {!copilotChecking && copilotStatus === 'ok' && (
                        <span className="flex items-center gap-1"><CheckCircle2 size={12} /> Copilot activo · {providers.find(p => p.id === 'copilot')?.models?.length} modelos</span>
                      )}
                      {!copilotChecking && copilotStatus === 'error' && (
                        <div className="space-y-2">
                          <p>⚠ {copilotError}</p>
                          <button
                            type="button"
                            onClick={() => changeProvider('github')}
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-400 hover:bg-violet-500/30 transition-colors font-semibold"
                          >
                            <GitBranch size={12} /> Usar GitHub Models (gratis)
                          </button>
                        </div>
                      )}
                      {!copilotChecking && copilotStatus === null && (
                        <button
                          type="button"
                          onClick={() => checkCopilotAccess(githubToken)}
                          className="flex items-center gap-1 underline"
                        >
                          <RefreshCw size={11} /> Verificar acceso a Copilot
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Model selector */}
          <div>
            <label className="text-xs text-slate-500 block mb-1">Modelo</label>
            <select className="form-control text-xs" value={model} onChange={e => setModel(e.target.value)}>
              {currentProvider.models.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* API Key (Groq / OpenAI) */}
          {currentProvider.authType === 'apikey' && (
            <div>
              <label className="text-xs text-slate-500 flex items-center gap-1.5 mb-1">
                <Key size={11} /> API Key
                {currentProvider.keyUrl && (
                  <a href={currentProvider.keyUrl} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-0.5 text-violet-400 hover:underline ml-1">
                    Obtener key <ExternalLink size={9} />
                  </a>
                )}
              </label>
              <input
                type="password"
                className="form-control text-xs font-mono"
                placeholder={`Pegá tu ${currentProvider.label} API key`}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                autoComplete="off"
              />
              <p className="text-xs text-slate-500 mt-1">No se guarda en el servidor.</p>
            </div>
          )}

          {/* Ollama URL */}
          {providerId === 'ollama' && (
            <div>
              <label className="text-xs text-slate-500 block mb-1">URL de Ollama</label>
              <input
                type="text"
                className="form-control text-xs font-mono"
                value={ollamaUrl}
                onChange={e => setOllamaUrl(e.target.value)}
                placeholder="http://localhost:11434"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
