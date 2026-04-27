import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Link2, ChevronDown, ChevronUp, Plug, Download, CheckCircle2, XCircle,
  Wifi, WifiOff, RotateCcw, Sparkles, MessageSquare, Pencil, Eye, Code2, X, Undo2, Lock, GitBranch,
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import './ConfluenceImport.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';
const STORAGE_KEY = 'confluence_creds_v1';

const loadCreds = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; } };
const saveCreds = (c) => localStorage.setItem(STORAGE_KEY, JSON.stringify(c));

const OP_LABELS = {
  '== true': 'Es true', '== false': 'Es false',
  '== null': 'Es null', '!= null': '!= null',
  '==': 'Igual a', '!=': 'Distinto de',
  'contains': 'Contiene', 'matches': 'Regex',
};

const REFINE_SUGGESTIONS = [
  'Separalo en 2 escenarios: happy path y error',
  'El endpoint es POST, no GET. Corregí el método',
  'Agregá un escenario de error con status 400',
  'Habilitá evidencia OCP para todos los escenarios',
  'Agregá validación de base de datos',
];

const ASK_SUGGESTIONS = [
  '¿La HU menciona validar logs?',
  '¿Hay criterios de error o casos negativos?',
  '¿Se menciona base de datos o tablas?',
  '¿Qué campos del response hay que validar?',
  '¿La HU especifica el método HTTP?',
  '¿Hay algún campo de autenticación requerido?',
];

const METHOD_COLORS = {
  GET:    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  POST:   'bg-blue-500/10    text-blue-400    border-blue-500/20',
  PUT:    'bg-amber-500/10   text-amber-400   border-amber-500/20',
  PATCH:  'bg-orange-500/10  text-orange-400  border-orange-500/20',
  DELETE: 'bg-red-500/10     text-red-400     border-red-500/20',
};

// ── Helper: check if AI is ready to use ──────────────────────────────────────
function useAIReady() {
  const { providerId, apiKey, currentProvider, isGitHubLoggedIn, copilotStatus, copilotChecking } = useAuth();
  if (['github', 'copilot'].includes(providerId)) {
    if (!isGitHubLoggedIn) return { ready: false, reason: 'Necesitás conectar tu cuenta de GitHub para usar este proveedor.' };
    if (providerId === 'copilot' && copilotStatus === 'error') return { ready: false, reason: 'Tu cuenta no tiene suscripción activa de GitHub Copilot. Usá GitHub Models (gratis).' };
    return { ready: true };
  }
  if (currentProvider?.authType === 'apikey' && !apiKey?.trim()) {
    return { ready: false, reason: `Necesitás ingresar tu API Key de ${currentProvider.label} en el panel de Proveedor de IA.` };
  }
  return { ready: true };
}

// ─────────────────────────────────────────────────────────────────────
// Review Modal
// ─────────────────────────────────────────────────────────────────────
function ReviewModal({ result, pageTitle, rawText, onAccept, onReject }) {
  const { buildAIPayload, currentProvider } = useAuth();
  const [edited, setEdited]               = useState(() => JSON.parse(JSON.stringify(result)));
  const [tab, setTab]                     = useState('preview');
  const [refineMode, setRefineMode]       = useState('ask');
  const [refinePrompt, setRefinePrompt]   = useState('');
  const [refineLoading, setRefineLoading] = useState(false);
  const [refineError, setRefineError]     = useState('');
  const [history, setHistory]             = useState([]);
  const [askAnswer, setAskAnswer]         = useState(null);
  const [askSuggestion, setAskSuggestion] = useState(null);
  const [askSuggestionLabel, setAskSuggestionLabel] = useState('');

  const providerLabel = currentProvider?.label || 'IA';

  const scenarios = Array.isArray(edited.scenarios) ? edited.scenarios : [];

  const setGlobal = (field, val) => setEdited(p => ({ ...p, [field]: val }));
  const setScenarioField = (si, field, val) =>
    setEdited(prev => { const s = [...prev.scenarios]; s[si] = { ...s[si], [field]: val }; return { ...prev, scenarios: s }; });
  const setAssertionField = (si, ai, field, val) =>
    setEdited(prev => { const s = [...prev.scenarios]; const ass = [...s[si].assertions]; ass[ai] = { ...ass[ai], [field]: val }; s[si] = { ...s[si], assertions: ass }; return { ...prev, scenarios: s }; });
  const removeAssertion = (si, ai) =>
    setEdited(prev => { const s = [...prev.scenarios]; s[si] = { ...s[si], assertions: s[si].assertions.filter((_, i) => i !== ai) }; return { ...prev, scenarios: s }; });
  const addAssertion = (si) =>
    setEdited(prev => { const s = [...prev.scenarios]; s[si] = { ...s[si], assertions: [...s[si].assertions, { field: '', operator: '!= null', value: '' }] }; return { ...prev, scenarios: s }; });

  const handleRefine = async () => {
    if (!refinePrompt.trim()) return;
    setRefineLoading(true); setRefineError(''); setAskAnswer(null); setAskSuggestion(null);
    setHistory(h => [...h, JSON.parse(JSON.stringify(edited))]);
    try {
      const aiPayload = buildAIPayload({});
      const { data } = await axios.post(`${BACKEND_URL}/confluence-refine`, {
        rawText,
        refinementPrompt: refinePrompt,
        ...aiPayload,
      });
      if (data.success) { setEdited(data); setRefinePrompt(''); setTab('preview'); }
      else setRefineError(data.error || 'Error al refinar');
    } catch (err) { setRefineError(err?.response?.data?.error || 'Error de conexión'); }
    finally { setRefineLoading(false); }
  };

  const handleAsk = async () => {
    if (!refinePrompt.trim()) return;
    setRefineLoading(true); setRefineError(''); setAskAnswer(null); setAskSuggestion(null);
    try {
      const aiPayload = buildAIPayload({});
      const { data } = await axios.post(`${BACKEND_URL}/confluence-ask`, {
        rawText,
        question: refinePrompt,
        ...aiPayload,
      });
      if (data.success) {
        setAskAnswer(data.answer);
        if (data.hasSuggestion && data.suggestion) { setAskSuggestion(data.suggestion); setAskSuggestionLabel(data.suggestionLabel || 'Aplicar cambio sugerido'); }
        setRefinePrompt('');
      } else setRefineError(data.error || 'Error al consultar');
    } catch (err) { setRefineError(err?.response?.data?.error || 'Error de conexión'); }
    finally { setRefineLoading(false); }
  };

  const handleApplySuggestion = () => {
    if (!askSuggestion) return;
    setHistory(h => [...h, JSON.parse(JSON.stringify(edited))]);
    setEdited(askSuggestion); setAskAnswer(null); setAskSuggestion(null); setAskSuggestionLabel(''); setTab('preview');
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    setEdited(history[history.length - 1]); setHistory(h => h.slice(0, -1));
  };


  const TABS = [
    { id: 'preview', icon: <Eye size={13} />, label: 'Preview editable' },
    { id: 'refine',  icon: <Sparkles size={13} />, label: 'Refinar con IA' },
    { id: 'raw',     icon: <Code2 size={13} />, label: 'JSON' },
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onReject()}>
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-[#0f172a] border border-[#1e293b] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e293b] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Sparkles size={15} className="text-violet-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Revisá el análisis de {providerLabel}</h2>
              <p className="text-xs text-slate-500">Importado desde: <span className="text-slate-400">{pageTitle}</span></p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button type="button" className="btn btn--ghost btn--sm gap-1.5" onClick={handleUndo}>
                <Undo2 size={13} /> Deshacer ({history.length})
              </button>
            )}
            <button type="button" onClick={onReject} className="w-8 h-8 rounded-lg bg-[#1e293b] hover:bg-[#263348] text-slate-400 hover:text-white transition-colors flex items-center justify-center">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4 shrink-0">
          {TABS.map(({ id, icon, label }) => (
            <button key={id} type="button"
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150
                ${tab === id ? 'bg-violet-600 text-white shadow shadow-violet-500/30' : 'text-slate-400 hover:text-white hover:bg-[#1e293b]'}`}>
              {icon} {label}
              {id === 'refine' && history.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/20 text-[10px]">{history.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* JSON tab */}
          {tab === 'raw' && (
            <pre className="text-xs text-slate-300 bg-[#0b0f1a] rounded-xl p-4 overflow-auto border border-[#1e293b] leading-relaxed">
              {JSON.stringify(edited, null, 2)}
            </pre>
          )}


          {/* Refine tab */}
          {tab === 'refine' && (
            <div className="space-y-4">
              {/* Mode toggle */}
              <div className="flex gap-2 p-1 rounded-xl bg-[#0b0f1a] border border-[#1e293b]">
                {[
                  { id: 'ask',      icon: <MessageSquare size={13} />, label: 'Preguntar sobre la HU' },
                  { id: 'instruct', icon: <Pencil size={13} />,        label: 'Dar instrucciones' },
                ].map(({ id, icon, label }) => (
                  <button key={id} type="button"
                    onClick={() => { setRefineMode(id); setRefinePrompt(''); setRefineError(''); if (id === 'instruct') { setAskAnswer(null); setAskSuggestion(null); } }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all duration-150
                      ${refineMode === id ? 'bg-[#1e293b] text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                    {icon} {label}
                  </button>
                ))}
              </div>

              {/* Ask mode */}
              {refineMode === 'ask' && (
                <>
                  <p className="text-xs text-slate-400">Preguntale a {providerLabel} sobre el contenido de la HU. Si la respuesta implica un cambio, te va a ofrecer aplicarlo.</p>
                  <div className="flex flex-wrap gap-2">
                    {ASK_SUGGESTIONS.map((s, i) => (
                      <button key={i} type="button" onClick={() => setRefinePrompt(s)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#1e293b] hover:bg-[#263348] text-slate-400 hover:text-white text-xs transition-colors border border-[#334155]">
                        {s}
                      </button>
                    ))}
                  </div>
                  <textarea className="form-control resize-none" rows={3} value={refinePrompt}
                    onChange={e => setRefinePrompt(e.target.value)}
                    placeholder="Ej: ¿La HU menciona validar logs?"
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); !refineLoading && refinePrompt.trim() && handleAsk(); } }} />
                  {refineError && <p className="text-xs text-red-400 flex items-center gap-1"><XCircle size={13} />{refineError}</p>}
                  <button type="button" className="btn btn--primary" onClick={handleAsk} disabled={refineLoading || !refinePrompt.trim()}>
                    {refineLoading ? <><span className="spinner" />Consultando...</> : <><MessageSquare size={14} />Preguntar a {providerLabel}</>}
                  </button>

                  {askAnswer && (
                    <div className="p-4 rounded-xl bg-violet-500/5 border border-violet-500/20 space-y-3">
                      <p className="text-xs font-semibold text-violet-400">🤖 Respuesta de {providerLabel}</p>
                      <p className="text-sm text-slate-300">{askAnswer}</p>
                      {askSuggestion && (
                        <div className="flex items-center justify-between pt-3 border-t border-violet-500/20">
                          <div>
                            <p className="text-xs font-semibold text-violet-300">💡 Sugerencia disponible</p>
                            <p className="text-xs text-slate-400">{askSuggestionLabel}</p>
                          </div>
                          <div className="flex gap-2">
                            <button type="button" className="btn btn--success btn--sm" onClick={handleApplySuggestion}>
                              <CheckCircle2 size={13} /> Aplicar
                            </button>
                            <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setAskAnswer(null); setAskSuggestion(null); }}>
                              Ignorar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Instruct mode */}
              {refineMode === 'instruct' && (
                <>
                  <p className="text-xs text-slate-400">Escribí instrucciones para que {providerLabel} corrija o mejore el análisis. El resultado reemplaza el preview (podés deshacer).</p>
                  <div className="flex flex-wrap gap-2">
                    {REFINE_SUGGESTIONS.map((s, i) => (
                      <button key={i} type="button" onClick={() => setRefinePrompt(p => p ? `${p}\n${s}` : s)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#1e293b] hover:bg-[#263348] text-slate-400 hover:text-white text-xs transition-colors border border-[#334155]">
                        {s}
                      </button>
                    ))}
                  </div>
                  <textarea className="form-control resize-none" rows={5} value={refinePrompt}
                    onChange={e => setRefinePrompt(e.target.value)}
                    placeholder={`Ej:\n- "Separalo en 2 escenarios"\n- "El método debe ser POST"`} />
                  {refineError && <p className="text-xs text-red-400 flex items-center gap-1"><XCircle size={13} />{refineError}</p>}
                  <div className="flex gap-2">
                    <button type="button" className="btn btn--primary" onClick={handleRefine} disabled={refineLoading || !refinePrompt.trim()}>
                      {refineLoading ? <><span className="spinner" />Re-analizando...</> : <><Sparkles size={14} />Re-analizar con {providerLabel}</>}
                    </button>
                    {history.length > 0 && (
                      <button type="button" className="btn btn--ghost" onClick={handleUndo}><Undo2 size={14} />Deshacer</button>
                    )}
                  </div>
                  {history.length > 0 && (
                    <p className="text-xs text-emerald-400">✅ Re-análisis aplicado {history.length} vez{history.length > 1 ? 'es' : ''}. Revisá el <strong>Preview editable</strong>.</p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Preview tab */}
          {tab === 'preview' && (
            <div className="space-y-4">
              {/* Feature global fields */}
              <div className="card !mb-0">
                <p className="card__title">📄 Feature</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Feature Name</label>
                    <input className="form-control" value={edited.featureName || ''} onChange={e => setGlobal('featureName', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Endpoint</label>
                    <input className="form-control" value={edited.endpoint || ''} onChange={e => setGlobal('endpoint', e.target.value)} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs text-slate-400 mb-1">Base URL</label>
                    <input className="form-control" value={edited.baseUrl || ''} onChange={e => setGlobal('baseUrl', e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Scenarios */}
              {scenarios.map((s, si) => (
                <div key={si} className="bg-[#0b0f1a] border border-[#1e293b] rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Escenario {si + 1}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${METHOD_COLORS[s.method] || METHOD_COLORS.GET}`}>{s.method || 'GET'}</span>
                    {s.enableDb && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">🗄 DB</span>}
                    {s.enableOcpEvidence && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">🔴 OCP</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Nombre</label>
                      <input className="form-control" value={s.name || ''} onChange={e => setScenarioField(si, 'name', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Status esperado</label>
                      <input className="form-control" type="number" value={s.expectedStatus || 200} onChange={e => setScenarioField(si, 'expectedStatus', Number(e.target.value))} />
                    </div>
                  </div>

                  {/* Assertions */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">✅ Assertions</p>
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => addAssertion(si)}>+ Agregar</button>
                    </div>
                    {s.assertions?.length === 0 && <p className="text-xs text-slate-600 italic">Sin assertions detectadas.</p>}
                    <div className="space-y-2">
                      {s.assertions?.map((a, ai) => (
                        <div key={ai} className="flex gap-2 items-center">
                          <input className="form-control !py-1.5 !text-xs flex-1" placeholder="campo" value={a.field || ''} onChange={e => setAssertionField(si, ai, 'field', e.target.value)} />
                          <select className="form-control !py-1.5 !text-xs w-32" value={a.operator || '!= null'} onChange={e => setAssertionField(si, ai, 'operator', e.target.value)}>
                            {Object.entries(OP_LABELS).map(([op, label]) => <option key={op} value={op}>{label}</option>)}
                          </select>
                          <input className="form-control !py-1.5 !text-xs flex-1" placeholder="valor" value={a.value || ''}
                            onChange={e => setAssertionField(si, ai, 'value', e.target.value)}
                            disabled={['!= null','== null','== true','== false'].includes(a.operator)} />
                          <button type="button" className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center transition-colors shrink-0"
                            onClick={() => removeAssertion(si, ai)}><X size={13} /></button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {s.enableDb && (
                    <div className="px-3 py-2 rounded-xl bg-cyan-500/5 border border-cyan-500/20 text-xs text-cyan-400">
                      🗄 DB: <strong>{s.dbTable || 'tabla no detectada'}</strong>
                      {s.dbFilter && <span> — WHERE {s.dbFilter}</span>}
                    </div>
                  )}
                  {s.detectedBody && (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 mb-1">📦 Request body</p>
                      <pre className="text-xs bg-[#0b0f1a] rounded-xl p-3 text-slate-300 overflow-auto border border-[#1e293b]">{s.detectedBody}</pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#1e293b] shrink-0">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-[#1e293b] text-slate-400 text-xs font-semibold">
              {scenarios.length} escenario{scenarios.length !== 1 ? 's' : ''}
            </span>
            <span className="text-xs text-slate-600 hidden sm:block">
              {tab === 'preview' ? 'Editá campos directamente o usá Refinar con IA' : 'Los cambios se aplican al preview antes de aceptar'}
            </span>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn btn--danger-ghost btn--sm" onClick={onReject}>
              <X size={13} /> Rechazar
            </button>
            {tab !== 'refine' && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setTab('refine')}>
                <Sparkles size={13} /> Refinar
              </button>
            )}
            <button type="button" className="btn btn--success btn--sm" onClick={() => onAccept(edited)}>
              <CheckCircle2 size={13} /> Aceptar y aplicar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Main ConfluenceImport
// ─────────────────────────────────────────────────────────────────────
export default function ConfluenceImport({ onApply }) {
  const { buildAIPayload, providerId, loginWithGitHub, isGitHubLoggedIn, githubUser, currentProvider } = useAuth();
  const { ready: isAIReady, reason: notReadyReason } = useAIReady();
  const saved = loadCreds();
  const [open, setOpen]         = useState(false);
  const [baseUrl, setBaseUrl]   = useState(saved.baseUrl  || '');
  const [email, setEmail]       = useState(saved.email    || '');
  const [token, setToken]       = useState(saved.token    || '');
  const [authType, setAuthType] = useState(saved.authType || 'basic');
  const [pageUrl, setPageUrl]   = useState('');

  const [connStatus, setConnStatus]   = useState(null);
  const [connMsg, setConnMsg]         = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError]   = useState('');
  const [reviewData, setReviewData]   = useState(null);
  const [reviewTitle, setReviewTitle] = useState('');

  useEffect(() => { saveCreds({ baseUrl, email, token, authType }); }, [baseUrl, email, token, authType]);

  const handleTest = async () => {
    setTestLoading(true); setConnStatus(null); setConnMsg('');
    try {
      await axios.post(`${BACKEND_URL}/confluence-test`, { baseUrl, email, token, authType });
      setConnStatus('ok'); setConnMsg('Conexión exitosa');
    } catch (err) {
      setConnStatus('error'); setConnMsg(err?.response?.data?.error || 'No se pudo conectar');
    } finally { setTestLoading(false); }
  };

  const handleFetch = async () => {
    if (!pageUrl.trim()) return;
    setFetchLoading(true); setFetchError(''); setReviewData(null);
    try {
      const aiPayload = buildAIPayload({});
      const { data } = await axios.post(`${BACKEND_URL}/confluence-fetch`, {
        baseUrl, email, token, authType, pageUrl,
        ...aiPayload,
      });
      if (data.success) { setReviewTitle(data.pageTitle || 'HU importada'); setReviewData(data); }
      else setFetchError(data.error || 'Error al obtener la página');
    } catch (err) { setFetchError(err?.response?.data?.error || 'Error de conexión con el backend'); }
    finally { setFetchLoading(false); }
  };

  const handleAccept = (edited) => { onApply(edited); setReviewData(null); setPageUrl(''); setOpen(false); };
  const handleReject = () => setReviewData(null);

  const isVpnError = connMsg.includes('VPN') || connMsg.includes('resolver') || connMsg.includes('ENOTFOUND');

  return (
    <>
      {reviewData && (
        <ReviewModal result={reviewData} pageTitle={reviewTitle} rawText={reviewData.rawText || ''} onAccept={handleAccept} onReject={handleReject} />
      )}

      <div className="bg-[#111827] border border-[#1e293b] rounded-2xl overflow-hidden shadow-lg shadow-black/20 mb-4">
        {/* Toggle button */}
        <button
          type="button"
          onClick={() => isAIReady && setOpen(o => !o)}
          className={`w-full flex items-center justify-between px-5 py-4 transition-colors duration-150 group ${isAIReady ? 'hover:bg-white/[0.02]' : 'cursor-not-allowed opacity-60'}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              {isAIReady ? <Link2 size={15} className="text-blue-400" /> : <Lock size={15} className="text-slate-500" />}
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-white">Importar desde Confluence</p>
              <p className="text-xs text-slate-500">
                {isAIReady ? 'Traé una HU y generá el test automáticamente con IA' : 'Configurá el Proveedor de IA para usar esta función'}
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
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
                <Link2 size={10} /> {currentProvider.label}
              </span>
            )}
            {connStatus === 'ok'    && isAIReady && <span className="w-2 h-2 rounded-full bg-emerald-400 shadow shadow-emerald-400/50" />}
            {connStatus === 'error' && isAIReady && <span className="w-2 h-2 rounded-full bg-red-400 shadow shadow-red-400/50" />}
            {!isAIReady
              ? <Lock size={14} className="text-slate-600" />
              : open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />
            }
          </div>
        </button>

        {/* Lock notice */}
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
          <div className="border-t border-[#1e293b] p-5 space-y-5">


            {/* Credenciales */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                🔐 Credenciales
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Tipo de autenticación</label>
                  <select className="form-control" value={authType} onChange={e => setAuthType(e.target.value)}>
                    <option value="basic">Basic (Email + API Token) — Confluence Cloud</option>
                    <option value="bearer">Bearer Token — Confluence Server/Data Center</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Base URL</label>
                    <input className="form-control" placeholder="https://tu-org.atlassian.net/wiki" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} />
                  </div>
                  {authType === 'basic' && (
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">Email</label>
                      <input className="form-control" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">{authType === 'bearer' ? 'Personal Access Token' : 'API Token'}</label>
                  <input className="form-control" type="password" placeholder={authType === 'bearer' ? 'Tu token personal' : 'ATATTxxxxxxxxxx'} value={token} onChange={e => setToken(e.target.value)} />
                </div>

                {/* Test connection */}
                <div className="flex items-center gap-3 flex-wrap">
                  <button type="button" className="btn btn--ghost btn--sm" onClick={handleTest} disabled={testLoading || !baseUrl.trim() || !token.trim()}>
                    {testLoading ? <><span className="spinner" />Probando...</> : <><Plug size={13} />Probar conexión</>}
                  </button>
                  {connStatus === 'ok' && (
                    <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                      <CheckCircle2 size={13} /> {connMsg}
                    </span>
                  )}
                </div>

                {connStatus === 'error' && (
                  <div className={`flex items-start gap-3 p-3 rounded-xl border text-sm ${isVpnError ? 'bg-amber-500/5 border-amber-500/20 text-amber-300' : 'bg-red-500/5 border-red-500/20 text-red-300'}`}>
                    {isVpnError ? <WifiOff size={16} className="mt-0.5 shrink-0" /> : <XCircle size={16} className="mt-0.5 shrink-0" />}
                    <div>
                      <p className="font-semibold text-xs">{isVpnError ? 'VPN desconectada' : 'Error de conexión'}</p>
                      <p className="text-xs opacity-80 mt-0.5">{connMsg}</p>
                      {isVpnError && <p className="text-xs opacity-60 mt-1">Conectate a la VPN corporativa y volvé a probar.</p>}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Importar HU */}
            <div className="border-t border-[#1e293b] pt-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">📄 Historia de Usuario</p>
              <div className="flex gap-2">
                <input className="form-control flex-1"
                  placeholder="https://confluence.empresa.com/pages/viewpage.action?pageId=123456"
                  value={pageUrl} onChange={e => setPageUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !fetchLoading && handleFetch()} />
                <button type="button" className="btn btn--primary shrink-0" onClick={handleFetch}
                  disabled={fetchLoading || !pageUrl.trim() || !baseUrl.trim() || !token.trim()}>
                  {fetchLoading ? <><span className="spinner" />Importando...</> : <><Download size={15} />Importar HU</>}
                </button>
              </div>
              {fetchError && (
                <p className="flex items-center gap-1.5 text-xs text-red-400 mt-2"><XCircle size={13} />{fetchError}</p>
              )}
              <p className="text-xs text-slate-600 mt-2">
                Soporta URLs con <code className="text-slate-500">?pageId=XXXXX</code>, <code className="text-slate-500">/pages/XXXXX</code> o <code className="text-slate-500">/display/SPACE/Titulo</code>.
                El contenido se analiza con IA y podés <strong className="text-slate-400">revisar y editar antes de aplicar</strong>.
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

