import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';
axios.defaults.withCredentials = true;

// ── localStorage keys ──────────────────────────────────────────────────────────
const K = {
  PROVIDER:       'qatestui_ai_provider',
  MODEL:          'qatestui_ai_model',
  APIKEY:         'qatestui_ai_apikey',          // legacy key (kept for migration)
  APIKEY_PREFIX:  'qatestui_ai_apikey_',         // per-provider: qatestui_ai_apikey_groq, etc.
  OLLAMA_URL:     'qatestui_ollama_url',
  GITHUB_USER:    'qatestui_github_user',
  COPILOT_MODELS: 'qatestui_copilot_models',
};

export const DEFAULT_PROVIDERS = [
  {
    id: 'groq', label: 'Groq', requiresKey: true, authType: 'apikey',
    keyUrl: 'https://console.groq.com/keys',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
    defaultModel: 'llama-3.3-70b-versatile',
  },
  {
    id: 'copilot', label: 'GitHub Copilot', requiresKey: false, authType: 'oauth', paid: true,
    models: ['gpt-4o', 'gpt-4o-mini', 'claude-3.5-sonnet', 'claude-3.7-sonnet', 'o3-mini', 'o1-mini', 'gemini-2.0-flash-001'],
    defaultModel: 'claude-3.5-sonnet',
  },
  {
    id: 'github', label: 'GitHub Models', requiresKey: false, authType: 'oauth',
    models: ['gpt-4o-mini', 'gpt-4o', 'Meta-Llama-3.1-70B-Instruct', 'Mistral-large-2411', 'Phi-4'],
    defaultModel: 'gpt-4o-mini',
  },
  {
    id: 'openai', label: 'OpenAI', requiresKey: true, authType: 'apikey',
    keyUrl: 'https://platform.openai.com/api-keys',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    defaultModel: 'gpt-4o-mini',
  },
  {
    id: 'ollama', label: 'Ollama (Local)', requiresKey: false, authType: 'none',
    models: ['llama3', 'llama3.1', 'mistral', 'codellama', 'phi3', 'gemma2'],
    defaultModel: 'llama3',
  },
];

const read = (key, fallback = null) => {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    try { return JSON.parse(v); } catch { return v; }
  } catch { return fallback; }
};

// ── Per-provider API key helpers ───────────────────────────────────────────────
const readApiKey  = (pid) => read(K.APIKEY_PREFIX + pid, '') || read(K.APIKEY, ''); // fallback to legacy
const saveApiKey  = (pid, val) => {
  localStorage.setItem(K.APIKEY_PREFIX + pid, val);
  localStorage.setItem(K.APIKEY, val); // keep legacy in sync for current provider
};
const clearLegacyApiKey = () => localStorage.removeItem(K.APIKEY);

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [providers, setProviders]    = useState(DEFAULT_PROVIDERS);
  const [providerId, _setProviderId] = useState(() => read(K.PROVIDER, 'groq'));
  const [model, _setModel]           = useState(() => read(K.MODEL, 'llama-3.3-70b-versatile'));
  // Load API key for the initially-selected provider
  const [apiKey, _setApiKey]         = useState(() => readApiKey(read(K.PROVIDER, 'groq')));
  const [ollamaUrl, _setOllamaUrl]   = useState(() => read(K.OLLAMA_URL, 'http://localhost:11434'));

  const [githubToken, _setGithubToken] = useState('');
  const [githubUser,  _setGithubUser]  = useState(() => read(K.GITHUB_USER, null));

  // copilot check
  const [copilotStatus,  setCopilotStatus]  = useState(null); // null | 'ok' | 'error'
  const [copilotError,   setCopilotError]   = useState('');
  const [copilotChecking, setCopilotChecking] = useState(false);
  const [authError, setAuthError] = useState('');

  // ── Setters with persistence ──────────────────────────────────────────────────
  const setProviderId = (v) => { _setProviderId(v); localStorage.setItem(K.PROVIDER, v); };
  const setModel      = (v) => { _setModel(v);      localStorage.setItem(K.MODEL, v);    };
  // setApiKey saves both per-provider and legacy key
  const setApiKey     = (v) => {
    _setApiKey(v);
    saveApiKey(providerId, v);
  };
  const setOllamaUrl  = (v) => { _setOllamaUrl(v);  localStorage.setItem(K.OLLAMA_URL, v); };

  const setGithubToken = (v) => {
    _setGithubToken(v);
  };
  const setGithubUser = (v) => {
    _setGithubUser(v);
    if (v) localStorage.setItem(K.GITHUB_USER, JSON.stringify(v));
    else   localStorage.removeItem(K.GITHUB_USER);
  };

  // ── Handle GitHub OAuth callback from URL ─────────────────────────────────────
  useEffect(() => {
    const params      = new URLSearchParams(window.location.search);
    const authSuccess = params.get('auth_success');
    const authError   = params.get('auth_error');

    if (authSuccess) {
      setAuthError('');
      // Restore target provider chosen before OAuth (copilot/github)
      const target = params.get('auth_target') || localStorage.getItem(K.PROVIDER) || 'copilot';
      if (target === 'github') {
        setProviderId('github');
        setModel('gpt-4o-mini');
      } else {
        setProviderId('copilot');
        setModel('claude-3.5-sonnet');
      }
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (authError) {
      const decoded = decodeURIComponent(authError);
      console.warn('GitHub OAuth error:', decoded);
      setAuthError(decoded);
      window.history.replaceState({}, '', window.location.pathname);
    }
    axios.get(`${BACKEND_URL}/auth/session`, { withCredentials: true })
      .then(({ data }) => {
        if (data?.loggedIn) {
          setGithubToken('session');
          setGithubUser(data.user || null);
        } else {
          setGithubToken('');
          setGithubUser(null);
        }
      })
      .catch(() => {
        setGithubToken('');
        setGithubUser(null);
      });
  // eslint-disable-next-line
  }, []);

  // ── Auto-check copilot when token + provider copilot ─────────────────────────
  useEffect(() => {
    if (githubToken && providerId === 'copilot' && copilotStatus === null && !copilotChecking) {
      checkCopilotAccess(githubToken);
    }
  // eslint-disable-next-line
  }, [githubToken, providerId]);

  const checkCopilotAccess = useCallback(async (token = '') => {
    setCopilotChecking(true);
    setCopilotStatus(null);
    setCopilotError('');
    try {
      const payload = token && token !== 'session' ? { githubToken: token } : {};
      const { data } = await axios.post(`${BACKEND_URL}/copilot/check`, payload, { withCredentials: true });
      if (data.hasCopilot) {
        setCopilotStatus('ok');
        if (data.models?.length > 0) {
          setProviders(prev => prev.map(p => p.id === 'copilot' ? { ...p, models: data.models } : p));
          localStorage.setItem(K.COPILOT_MODELS, JSON.stringify(data.models));
        }
      } else {
        setCopilotStatus('error');
        setCopilotError(data.error || 'Sin suscripción activa de Copilot.');
        // Auto-switch to GitHub Models (free) if copilot fails
        setProviderId('github');
        _setModel('gpt-4o-mini');
        localStorage.setItem(K.MODEL, 'gpt-4o-mini');
      }
    } catch (err) {
      setCopilotStatus('error');
      setCopilotError(err?.response?.data?.error || 'No se pudo verificar Copilot.');
      // Auto-switch to GitHub Models (free) on error
      setProviderId('github');
      _setModel('gpt-4o-mini');
      localStorage.setItem(K.MODEL, 'gpt-4o-mini');
    } finally {
      setCopilotChecking(false);
    }
  }, []);

  // ── Provider change ───────────────────────────────────────────────────────────
  const changeProvider = useCallback((pid) => {
    setProviderId(pid);
    const p = DEFAULT_PROVIDERS.find(x => x.id === pid);
    if (p) setModel(p.defaultModel);
    // Restore the saved API key for this provider (or empty if none saved)
    // Never clear a key when switching — each provider keeps its own key in localStorage
    if (!['github', 'copilot'].includes(pid)) {
      const saved = readApiKey(pid);
      _setApiKey(saved);
      saveApiKey(pid, saved);
    }
    // reset copilot check when switching to copilot
    if (pid === 'copilot') setCopilotStatus(null);
  }, []);

  // ── GitHub login ──────────────────────────────────────────────────────────────
  const loginWithGitHub = useCallback((targetProvider = 'copilot', opts = {}) => {
    // Chequear si el logout anterior marcó que debemos forzar reauth
    const shouldForce = opts?.forceLogin || sessionStorage.getItem('qatestui_force_next_login') === '1';
    sessionStorage.removeItem('qatestui_force_next_login'); // Limpiar flag

    // Si es force login (cambiar cuenta), limpiar sesión actual primero
    if (shouldForce) {
      console.log('[AuthContext] Force login requested - clearing local session');
      setGithubToken('');
      setGithubUser(null);
      setCopilotStatus(null);
      setCopilotError('');
      localStorage.removeItem(K.COPILOT_MODELS);
      localStorage.removeItem(K.GITHUB_USER);
    }

    localStorage.setItem(K.PROVIDER, targetProvider);
    const target = targetProvider === 'github' ? 'github' : 'copilot';
    const forceLogin = shouldForce ? '1' : '0';
    const loginUrl = `${BACKEND_URL}/auth/github?provider=${encodeURIComponent(target)}&force_login=${forceLogin}&ts=${Date.now()}`;
    console.log('[AuthContext] Redirecting to GitHub OAuth:', { target, forceLogin: shouldForce, url: loginUrl });
    window.location.assign(loginUrl);
  }, []);

  // ── GitHub logout ─────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    console.log('[AuthContext] Logging out - clearing session');
    try {
      await axios.get(`${BACKEND_URL}/auth/logout`, { withCredentials: true });
    } catch (err) {
      console.warn('[AuthContext] Logout request failed:', err);
    }

    // Limpiar estado local
    setGithubToken('');
    setGithubUser(null);
    setCopilotStatus(null);
    setCopilotError('');
    setCopilotChecking(false);
    setAuthError('');
    localStorage.removeItem(K.COPILOT_MODELS);
    localStorage.removeItem(K.GITHUB_USER);

    // Marcar que el próximo login debe ser forzado
    sessionStorage.setItem('qatestui_force_next_login', '1');

    if (['github', 'copilot'].includes(providerId)) changeProvider('groq');
  }, [providerId, changeProvider]);

  const currentProvider = providers.find(p => p.id === providerId) || providers[0];
  const isGitHubLoggedIn = !!githubToken;

  // ── AI call helper — payload builder ─────────────────────────────────────────
  const buildAIPayload = useCallback((extra = {}) => {
    const payload = { provider: providerId, model, ...extra };
    if (currentProvider.authType === 'apikey' && apiKey) payload.apiKey = apiKey;
    if (providerId === 'ollama') payload.ollamaUrl = ollamaUrl;
    return payload;
  }, [providerId, model, apiKey, ollamaUrl, currentProvider]);

  return (
    <AuthContext.Provider value={{
      // providers list
      providers, setProviders,
      // current selection
      providerId, model, apiKey, ollamaUrl,
      setModel, setApiKey, setOllamaUrl,
      changeProvider,
      currentProvider,
      // github
      githubToken, githubUser,
      isGitHubLoggedIn,
      loginWithGitHub, logout,
      // copilot
      copilotStatus, copilotError, copilotChecking,
      authError,
      checkCopilotAccess,
      // helper
      buildAIPayload,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

