require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const Handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');
const { body, validationResult } = require('express-validator');
const Groq = require('groq-sdk');
const OpenAI = require('openai');
const axios = require('axios').default || require('axios');

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ─── Groq client (default, using env key) ─────────────────────────────────────
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── GitHub Copilot token cache ────────────────────────────────────────────────
// Maps githubToken → { copilotToken, expiresAt }
const copilotTokenCache = new Map();

async function getCopilotToken(githubToken) {
  const cached = copilotTokenCache.get(githubToken);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.copilotToken; // Still valid for >1 min
  }

  const { data } = await axios.get(
    'https://api.github.com/copilot_internal/v2/token',
    {
      headers: {
        Authorization: `token ${githubToken}`,
        'User-Agent': 'QATestUI/1.0',
        'Editor-Version': 'vscode/1.95.0',
        'Editor-Plugin-Version': 'copilot/1.245.0',
        'Copilot-Integration-Id': 'vscode-chat',
      },
    }
  );

  if (!data.token) throw new Error('No se pudo obtener el token de Copilot. ¿Tenés suscripción activa?');

  // Token expires_at is a Unix timestamp (seconds)
  const expiresAt = (data.expires_at || Math.floor(Date.now() / 1000) + 1800) * 1000;
  copilotTokenCache.set(githubToken, { copilotToken: data.token, expiresAt });
  return data.token;
}

// ─── Multi-provider AI abstraction ────────────────────────────────────────────
// provider: 'groq' | 'openai' | 'github' | 'copilot' | 'ollama'
async function callAI({ provider = 'groq', apiKey, model, messages, ollamaUrl }) {
  if (provider === 'groq') {
    const client = apiKey ? new Groq({ apiKey }) : groq;
    const mdl = model || 'llama-3.3-70b-versatile';
    const completion = await client.chat.completions.create({
      model: mdl, temperature: 0.1, max_tokens: 2048, messages,
    });
    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) throw new Error('Respuesta vacía de Groq');
    return raw;
  }

  if (provider === 'openai') {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OpenAI API key no configurada');
    const client = new OpenAI({ apiKey: key });
    const mdl = model || 'gpt-4o-mini';
    const completion = await client.chat.completions.create({
      model: mdl, temperature: 0.1, max_tokens: 2048, messages,
    });
    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) throw new Error('Respuesta vacía de OpenAI');
    return raw;
  }

  // GitHub Models — OpenAI-compatible API, autenticado con GitHub OAuth token o PAT
  if (provider === 'github') {
    const key = apiKey;
    if (!key) throw new Error('Token de GitHub no disponible. Iniciá sesión con GitHub.');
    const client = new OpenAI({
      apiKey: key,
      baseURL: 'https://models.inference.ai.azure.com',
    });
    const mdl = model || 'gpt-4o-mini';
    const completion = await client.chat.completions.create({
      model: mdl, temperature: 0.1, max_tokens: 2048, messages,
    });
    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) throw new Error('Respuesta vacía de GitHub Models');
    return raw;
  }

  // GitHub Copilot (plan pago) — accede a Claude Sonnet, GPT-4o, o3-mini, Gemini, etc.
  if (provider === 'copilot') {
    const githubToken = apiKey;
    if (!githubToken) throw new Error('Token de GitHub no disponible. Iniciá sesión con GitHub.');

    const copilotToken = await getCopilotToken(githubToken);
    const mdl = model || 'gpt-4o';

    const client = new OpenAI({
      apiKey: copilotToken,
      baseURL: 'https://api.githubcopilot.com',
      defaultHeaders: {
        'Editor-Version': 'vscode/1.95.0',
        'Editor-Plugin-Version': 'copilot/1.245.0',
        'Copilot-Integration-Id': 'vscode-chat',
        'X-GitHub-Api-Version': '2023-11-28',
      },
    });

    const completion = await client.chat.completions.create({
      model: mdl, temperature: 0.1, max_tokens: 2048, messages,
    });
    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) throw new Error('Respuesta vacía de GitHub Copilot');
    return raw;
  }

  if (provider === 'ollama') {
    const base = (ollamaUrl || process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/$/, '');
    const mdl = model || 'llama3';
    const resp = await axios.post(`${base}/api/chat`, {
      model: mdl, stream: false,
      options: { temperature: 0.1 },
      messages,
    }, { timeout: 120000 });
    const raw = resp.data?.message?.content?.trim();
    if (!raw) throw new Error('Respuesta vacía de Ollama');
    return raw;
  }

  throw new Error(`Proveedor de IA desconocido: ${provider}`);
}

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'qatestui-secret-changeme',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 8 * 60 * 60 * 1000 }, // 8h
}));

// ─── GitHub OAuth ──────────────────────────────────────────────────────────────
// Requires GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .env
// Create a GitHub OAuth App at: https://github.com/settings/developers
// Set callback URL to: http://localhost:3001/auth/github/callback

app.get('/auth/github', (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return res.redirect(`${FRONTEND_URL}?auth_error=GITHUB_CLIENT_ID+no+configurado`);
  }
  // read:user para identificar al usuario
  // (Copilot no requiere scope OAuth extra — el acceso se valida con la suscripción)
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${req.protocol}://${req.get('host')}/auth/github/callback`,
    scope: 'read:user',
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

app.get('/auth/github/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect(`${FRONTEND_URL}?auth_error=No+se+recibió+código+de+GitHub`);

  try {
    const { data } = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id:     process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      { headers: { Accept: 'application/json' } }
    );

    if (data.error) throw new Error(data.error_description || data.error);

    const accessToken = data.access_token;

    // Fetch basic user info to show in frontend
    const { data: user } = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'QATestUI' },
    });

    // Pass token + user info back to frontend via redirect with query params
    // (token stored client-side in localStorage — never persisted on server)
    const params = new URLSearchParams({
      github_token: accessToken,
      github_login: user.login,
      github_name:  user.name || user.login,
      github_avatar: user.avatar_url || '',
    });
    res.redirect(`${FRONTEND_URL}?${params}`);
  } catch (err) {
    console.error('GitHub OAuth error:', err.message);
    res.redirect(`${FRONTEND_URL}?auth_error=${encodeURIComponent(err.message)}`);
  }
});

app.get('/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// ─── Copilot: verificar suscripción y listar modelos disponibles ───────────────
app.post('/copilot/check', async (req, res) => {
  const { githubToken } = req.body;
  if (!githubToken) return res.status(400).json({ hasCopilot: false, error: 'Token requerido' });

  try {
    const copilotToken = await getCopilotToken(githubToken);

    // Listar modelos disponibles en la suscripción del usuario
    let models = [];
    try {
      const { data } = await axios.get('https://api.githubcopilot.com/models', {
        headers: {
          Authorization: `Bearer ${copilotToken}`,
          'Editor-Version': 'vscode/1.95.0',
          'Editor-Plugin-Version': 'copilot/1.245.0',
          'Copilot-Integration-Id': 'vscode-chat',
        },
      });
      // Filtrar solo modelos de chat
      models = (data?.data || [])
        .filter(m => m.capabilities?.type === 'chat' || m.object === 'model')
        .map(m => m.id);
    } catch {
      // Si falla el listado, usar modelos conocidos como fallback
      models = ['gpt-4o', 'gpt-4o-mini', 'claude-3.5-sonnet', 'claude-3.7-sonnet', 'o3-mini', 'o1-mini'];
    }

    res.json({ hasCopilot: true, models });
  } catch (err) {
    const status = err?.response?.status;
    const msg = err?.response?.data?.message || err.message;
    let friendlyError;
    if (status === 404 || msg?.toLowerCase().includes('not found')) {
      friendlyError = 'Tu cuenta no tiene suscripción activa de GitHub Copilot. Podés usar GitHub Models (gratis).';
    } else if (status === 401 || msg?.toLowerCase().includes('unauthorized')) {
      friendlyError = 'Token de GitHub inválido o sin permisos suficientes.';
    } else {
      friendlyError = msg || 'No se pudo verificar el acceso a Copilot.';
    }
    res.json({ hasCopilot: false, error: friendlyError });
  }
});

// ─── AI Providers info ─────────────────────────────────────────────────────────
app.get('/ai-providers', (req, res) => {
  res.json({
    providers: [
      {
        id: 'groq', label: 'Groq (Recomendado)', requiresKey: true, authType: 'apikey',
        keyConfigured: !!(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your_api_key_here'),
        keyUrl: 'https://console.groq.com/keys',
        models: ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
        defaultModel: 'llama-3.3-70b-versatile',
      },
      {
        id: 'copilot', label: 'GitHub Copilot', requiresKey: false, authType: 'oauth',
        keyConfigured: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
        oauthConfigured: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
        requiresPaidPlan: true,
        // Modelos conocidos — se actualizan dinámicamente desde /copilot/check
        models: ['gpt-4o', 'gpt-4o-mini', 'claude-3.5-sonnet', 'claude-3.7-sonnet', 'o3-mini', 'o1-mini', 'gemini-2.0-flash-001'],
        defaultModel: 'claude-3.5-sonnet',
      },
      {
        id: 'github', label: 'GitHub Models (gratis)', requiresKey: false, authType: 'oauth',
        keyConfigured: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
        oauthConfigured: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
        models: ['gpt-4o-mini', 'gpt-4o', 'Meta-Llama-3.1-70B-Instruct', 'Mistral-large-2411', 'Phi-4'],
        defaultModel: 'gpt-4o-mini',
      },
      {
        id: 'openai', label: 'OpenAI', requiresKey: true, authType: 'apikey',
        keyConfigured: !!process.env.OPENAI_API_KEY,
        keyUrl: 'https://platform.openai.com/api-keys',
        models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
        defaultModel: 'gpt-4o-mini',
      },
      {
        id: 'ollama', label: 'Ollama (Local)', requiresKey: false, authType: 'none',
        keyConfigured: true,
        models: ['llama3', 'llama3.1', 'mistral', 'codellama', 'phi3', 'gemma2'],
        defaultModel: 'llama3',
      },
    ]
  });
});

// ─── Handlebars helpers ────────────────────────────────────────────────────────
Handlebars.registerHelper('upperCase', (str) => (str ? str.toUpperCase() : ''));
Handlebars.registerHelper('eq', (a, b) => a === b);

// ─── Load template ─────────────────────────────────────────────────────────────
const templatePath = path.join(__dirname, 'templates', 'feature.hbs');
const templateSource = fs.readFileSync(templatePath, 'utf8');
const featureTemplate = Handlebars.compile(templateSource);

// ─── Validation rules ──────────────────────────────────────────────────────────
const VALID_OPERATORS = ['!= null', '== null', '== true', '== false', '==', '!=', 'contains', 'matches'];

const featureValidation = [
  body('featureName').trim().notEmpty().withMessage('featureName es requerido'),
  body('endpoint').trim().notEmpty().withMessage('endpoint es requerido'),
  body('scenarios').isArray({ min: 1 }).withMessage('Debe incluir al menos un escenario'),
  body('scenarios.*.name').trim().notEmpty().withMessage('El nombre de cada escenario es requerido'),
  body('scenarios.*.method')
    .isIn(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
    .withMessage('El method de cada escenario debe ser GET, POST, PUT, DELETE o PATCH'),
  body('scenarios.*.expectedStatus')
    .isInt({ min: 100, max: 599 })
    .withMessage('expectedStatus debe ser un código HTTP válido (100-599)'),
  body('scenarios.*.assertions.*.operator')
    .optional()
    .isIn(VALID_OPERATORS)
    .withMessage(`El operador de assertion debe ser uno de: ${VALID_OPERATORS.join(', ')}`),
];

// ─── System prompt para Groq ───────────────────────────────────────────
const SYSTEM_PROMPT = `Sos un asistente experto en QA y testing de APIs REST con Karate DSL.
Tu tarea es analizar texto libre con criterios de aceptación, descripciones funcionales o datos de prueba,
y extraer información estructurada para generar escenarios de test en Karate DSL.

Devolvé SIEMPRE y ÚNICAMENTE un JSON válido con esta estructura exacta (sin texto adicional, sin markdown, sin bloques de código):

{
  "featureName": "string",
  "endpoint": "string",
  "baseUrl": "string",
  "enableOcp": false,
  "ocpToken": "",
  "namespace": "",
  "scenarios": [
    {
      "name": "string",
      "method": "GET|POST|PUT|DELETE|PATCH",
      "expectedStatus": 200,
      "assertions": [
        { "field": "string", "operator": "== true|== false|== null|!= null|==|!=|contains|matches", "value": "string" }
      ],
      "detectedBody": "string o null",
      "detectedParams": [ { "key": "string", "value": "string" } ],
      "enableDb": false,
      "dbTable": "",
      "dbColumns": "",
      "dbFilter": "",
      "dbAssertions": [],
      "enableOcpEvidence": false
    }
  ]
}

═══════════════════════════════════════════════════
REGLA 1 — featureName (MUY IMPORTANTE)
═══════════════════════════════════════════════════
Seguí este orden estricto:
1. Si el texto tiene "Feature: ALGO" → usá "ALGO" tal cual
2. Si el texto menciona un ticket ID con patrón LETRAS-NUMEROS (ej: PCP-54734, JIRA-123, CLA-999, CLP-001) → usá ese ID exacto como featureName
3. Si no hay ticket, generá un nombre PascalCase descriptivo sin espacios

Ejemplos:
- "estoy trabajando con la tarea PCP-54734" → featureName = "PCP-54734"
- "Feature: ValidarLogin" → featureName = "ValidarLogin"
- Sin ticket → featureName = "HistoryCreditProfileBatch"

═══════════════════════════════════════════════════
REGLA 2 — baseUrl y endpoint
═══════════════════════════════════════════════════
- Si el texto contiene una URL completa (https://... o http://...), extraé:
  · baseUrl = todo hasta el primer path component (sin trailing slash)
  · endpoint = el path después del host (ej: /startBatch, /v1/client/data)
- Si el texto tiene "GET /path" o "POST /path", extraé el método y el path
- Si la URL no tiene path explícito pero el texto menciona un path separado, combiná ambos

Ejemplo:
  "https://history-credit-profile-batch-claropay-ar-desa.apps.osen02.claro.amx/\nget /startBatch"
  → baseUrl = "https://history-credit-profile-batch-claropay-ar-desa.apps.osen02.claro.amx"
  → endpoint = "/startBatch"

═══════════════════════════════════════════════════
REGLA 3 — Escenarios
═══════════════════════════════════════════════════
- Generá UN escenario por cada criterio de aceptación
- Un criterio nuevo comienza con "Dado/Given", numeración, o separación visual
- Si el texto pide "organizar una estrategia" sin criterios explícitos, diseñá vos los escenarios necesarios para cubrir el caso
- Para campos booleanos: operador == true o == false
- Para campos que deben existir: != null
- Para mensajes exactos (ej: LIMIT_PAY_OK): operador == con ese valor en assertions
- Si el método es POST/PUT/PATCH, los datos van en detectedBody (JSON string formateado)
- Si el método es GET, los datos van en detectedParams
- No inventes assertions de response si no hay información suficiente; dejá el array vacío

═══════════════════════════════════════════════════
REGLA 4 — Validación de Base de Datos (enableDb) — MUY IMPORTANTE
═══════════════════════════════════════════════════
Activá enableDb: true en un escenario cuando el texto mencione CUALQUIERA de estas palabras o conceptos:
"tabla", "base de datos", "DB", "database", "validar en base", "verificar en base",
"HISTORY", "origen", "destino", "transferencia de datos", "batch", "proceso batch",
"se guarda", "se almacena", "se mueve", "se copia", "registro", "registros"

Cuando enableDb es true:
- dbTable: nombre de la tabla a consultar (SCHEMA.TABLA). Si hay dos tablas (origen y destino), priorizá la tabla DESTINO para la validación post-ejecución
- dbColumns: columnas relevantes a seleccionar, o "*" si no se especifica
- dbFilter: condición WHERE si se puede inferir del contexto, sino ""
- dbAssertions: array de { "column": "nombre_columna", "value": "valor_esperado" } con las validaciones post-request

ESTRATEGIA ESPECIAL PARA PROCESOS BATCH:
Cuando el texto describe un proceso batch que mueve/copia datos de tabla A → tabla B:
  · Creá 2 escenarios:
    1. "Verificar estado DB antes del batch" — solo enableDb: true, dbTable = tabla ORIGEN, sin request HTTP (usá method GET, expectedStatus 200, assertions vacías, y en el nombre indicar que es pre-condición)
    2. "Ejecutar batch y validar transferencia" — enableDb: true, dbTable = tabla DESTINO, con el request HTTP real
  · En el escenario 2, dbAssertions debe validar que los datos llegaron a la tabla destino

═══════════════════════════════════════════════════
REGLA 5 — Evidencia OCP (enableOcpEvidence)
═══════════════════════════════════════════════════
Activá enableOcpEvidence: true (y enableOcp: true a nivel feature) cuando el texto mencione:
"logs", "OpenShift", "OCP", "pod", "evidencia de logs", "validar logs", "servidor"
Si se menciona un namespace o proyecto OpenShift, extraelo en "namespace".

═══════════════════════════════════════════════════
REGLA 6 — Inferencia de namespace desde baseUrl
═══════════════════════════════════════════════════
Si la baseUrl contiene un patrón como "servicio-claropay-ar-AMBIENTE.apps.osen02.claro.amx",
el namespace probable es "claropay-ar-AMBIENTE" (ej: "claropay-ar-desa"). Ponelo en namespace.`;

// ─── POST /parse-criteria (con IA Groq) ────────────────────────────────────
// ─── Post-process: extracciones deterministas que no dependen de la IA ───────
const postProcess = (parsed, originalText) => {
  const text = originalText;

  // ── 1. featureName ────────────────────────────────────────────────────────
  // Prioridad: "Feature: ALGO" > ticket ID (LETRAS-NUMEROS) > lo que devolvió la IA
  const featureLineMatch = text.match(/Feature:\s*(\S+)/i);
  const ticketMatch      = text.match(/\b([A-Z]{2,10}-\d{3,6})\b/);
  if (featureLineMatch) {
    parsed.featureName = featureLineMatch[1].trim();
  } else if (ticketMatch) {
    parsed.featureName = ticketMatch[1];
  }

  // ── 2. baseUrl ────────────────────────────────────────────────────────────
  // Extrae la primera URL completa del texto y quita trailing slash
  const urlMatch = text.match(/https?:\/\/[^\s/]+/);
  if (urlMatch) {
    parsed.baseUrl = urlMatch[0].replace(/\/$/, '');

    // Inferir namespace desde el subdominio (ej: claropay-ar-desa)
    const nsMatch = parsed.baseUrl.match(/(claropay-ar-\w+)/);
    if (nsMatch && !parsed.namespace) {
      parsed.namespace = nsMatch[1];
    }
  }

  // ── 3. endpoint ───────────────────────────────────────────────────────────
  // Busca "GET /path", "POST /path", etc. como primera opción
  const methodPathMatch = text.match(/\b(GET|POST|PUT|DELETE|PATCH)\s+(\/[^\s\n]*)/i);
  if (methodPathMatch) {
    parsed.endpoint = methodPathMatch[2].trim();
  }

  // ── 4. Tablas DB (SCHEMA.TABLA) ───────────────────────────────────────────
  const tableMatches = [...text.matchAll(/\b([A-Z][A-Z0-9_]+\.[A-Z][A-Z0-9_]+)\b/g)].map(m => m[1]);
  const uniqueTables  = [...new Set(tableMatches)];

  // ── 5. enableDb override ──────────────────────────────────────────────────
  const dbKeywords = /tabla|base de datos|\bDB\b|database|validar.*base|verificar.*base|HISTORY|batch|proceso batch|se guarda|se almacena|se mueve|se copia|registros?/i;
  const needsDb    = dbKeywords.test(text) || uniqueTables.length > 0;

  if (needsDb) {
    parsed.scenarios = parsed.scenarios.map((s, idx) => {
      const updated = { ...s, enableDb: true };

      // Solo sobreescribir dbTable si la IA no lo puso
      if (!updated.dbTable) {
        if (uniqueTables.length === 1) {
          updated.dbTable = uniqueTables[0];
        } else if (uniqueTables.length >= 2) {
          // Batch: primer escenario → tabla origen, último → tabla destino
          updated.dbTable = idx === 0 ? uniqueTables[0] : uniqueTables[uniqueTables.length - 1];
        }
      }

      if (!updated.dbColumns) updated.dbColumns = '*';

      return updated;
    });
  }

  return parsed;
};

app.post('/parse-criteria', async (req, res) => {
  const { text, provider = 'groq', apiKey, model, ollamaUrl } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ success: false, errors: ['El texto no puede estar vacío'] });
  }

  // Validate that there is a usable key for cloud providers
  if (provider === 'groq' && !apiKey && (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'your_api_key_here')) {
    return res.status(503).json({
      success: false,
      errors: ['GROQ_API_KEY no configurada. Agregá tu API key en backend/.env (gratis en console.groq.com/keys)']
    });
  }
  if (provider === 'openai' && !apiKey && !process.env.OPENAI_API_KEY) {
    return res.status(503).json({
      success: false,
      errors: ['OpenAI API key no configurada. Ingresá tu key en el panel o en backend/.env como OPENAI_API_KEY']
    });
  }

  try {
    const raw = await callAI({
      provider, apiKey, model, ollamaUrl,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: text }
      ],
    });


    // Extraer el primer JSON objeto balanceado de la respuesta
    const extractBalancedJson = (str) => {
      const start = str.indexOf('{');
      if (start === -1) return null;
      let depth = 0, inString = false, escape = false;
      for (let i = start; i < str.length; i++) {
        const ch = str[i];
        if (escape)          { escape = false; continue; }
        if (ch === '\\')     { escape = true;  continue; }
        if (ch === '"')      { inString = !inString; continue; }
        if (inString)        continue;
        if (ch === '{')      depth++;
        else if (ch === '}') { depth--; if (depth === 0) return str.slice(start, i + 1); }
      }
      return null;
    };

    const jsonStr = extractBalancedJson(raw);
    if (!jsonStr) throw new Error('La IA no devolvió JSON válido');

    const parsed = JSON.parse(jsonStr);

    // ── Post-proceso determinista (regex sobre el texto original) ──
    postProcess(parsed, text);

    // Soporte para respuesta con "scenarios" (array) o "scenario" (legacy)
    if (!Array.isArray(parsed.scenarios)) {
      // Si Groq devolvió el formato viejo con "scenario" singular, convertir
      if (parsed.scenario) {
        parsed.scenarios = [parsed.scenario];
        delete parsed.scenario;
      } else {
        parsed.scenarios = [];
      }
    }

    // Normalizar cada escenario del array
    parsed.scenarios = parsed.scenarios.map(s => ({
      ...s,
      assertions:     Array.isArray(s.assertions)     ? s.assertions     : [],
      detectedParams: Array.isArray(s.detectedParams) ? s.detectedParams : [],
      detectedBody:   s.detectedBody || '',
    }));

    return res.json({ success: true, ...parsed });

  } catch (err) {
    console.error('Error AI provider:', err.message);
    const isApiError = err?.error?.type || err?.status;
    return res.status(500).json({
      success: false,
      errors: [isApiError
        ? `Error de API (${provider}): ${err.message}`
        : err.message || 'No se pudo analizar el criterio. Verificá el formato del texto.'
      ]
    });
  }
});

// ─── Shared normalization helper ──────────────────────────────────────────────
const OPS_WITHOUT_VALUE = ['!= null', '== null', '== true', '== false'];

/**
 * Returns true when a raw assertion value is a plain string literal that
 * Karate DSL requires to be wrapped in single quotes (i.e. NOT a number,
 * boolean keyword, null, or already-quoted string).
 */
const needsQuotes = (val) => {
  if (!val || val === 'null' || val === 'true' || val === 'false') return false;
  if (!isNaN(Number(val))) return false; // numeric literal
  // Already wrapped in single or double quotes
  if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) return false;
  return true; // plain string → needs Karate quotes
};

const normalizeScenarios = (scenarios) =>
  scenarios.map((s) => ({
    ...s,
    method:  s.method.toUpperCase(),
    params:  (s.params  || []).filter(p => p.key && p.key.trim()),
    headers: (s.headers || []).filter(h => h.key && h.key.trim()),
    body:    s.body && s.body.trim() ? s.body.trim() : null,
    // DB fields
    enableDb:    !!s.enableDb,
    dbTable:     s.dbTable    || '',
    dbColumns:   s.dbColumns  || '',
    dbFilter:    s.dbFilter   || '',
    dbAssertions: (s.dbAssertions || []).filter(a => a.column && a.column.trim()),
    // OCP fields
    enableOcpEvidence: !!s.enableOcpEvidence,
    assertions: (s.assertions || [])
      .filter(a => a.field && a.field.trim())
      .map(a => {
        const rawValue = OPS_WITHOUT_VALUE.includes(a.operator) ? null : (a.value || '');
        const formattedValue = rawValue && needsQuotes(rawValue) ? `'${rawValue}'` : rawValue;
        return {
          field:    a.field.trim(),
          operator: a.operator || '!= null',
          value:    formattedValue,
        };
      }),
  }));

// ─── POST /generate-feature ────────────────────────────────────────────────────
app.post('/generate-feature', featureValidation, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map((e) => e.msg),
    });
  }

  try {
    const { featureName, endpoint, scenarios, baseUrl, enableOcp, ocpToken, namespace } = req.body;
    const normalizedScenarios = normalizeScenarios(scenarios);

    const featureContent = featureTemplate({
      featureName,
      endpoint,
      baseUrl:    baseUrl    || '',
      enableOcp:  !!enableOcp,
      ocpToken:   ocpToken   || '',
      namespace:  namespace  || '',
      scenarios:  normalizedScenarios,
    });

    return res.status(200).json({ success: true, featureName, content: featureContent });
  } catch (err) {
    console.error('Error al generar feature:', err);
    return res.status(500).json({ success: false, errors: ['Error interno al generar el archivo .feature'] });
  }
});

// ─── POST /download-feature ────────────────────────────────────────────────────
app.post('/download-feature', featureValidation, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array().map(e => e.msg) });

  try {
    const { featureName, endpoint, scenarios, baseUrl, enableOcp, ocpToken, namespace } = req.body;
    const normalizedScenarios = normalizeScenarios(scenarios);

    const featureContent = featureTemplate({
      featureName,
      endpoint,
      baseUrl:    baseUrl    || '',
      enableOcp:  !!enableOcp,
      ocpToken:   ocpToken   || '',
      namespace:  namespace  || '',
      scenarios:  normalizedScenarios,
    });

    const safeFileName = featureName.replace(/[^a-z0-9_\-]/gi, '_');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}.feature"`);
    return res.send(featureContent);
  } catch (err) {
    console.error('Error al descargar feature:', err);
    return res.status(500).json({ success: false, errors: ['Error interno al descargar el archivo .feature'] });
  }
});

// ─── POST /confluence-test ─────────────────────────────────────────────────────
app.post('/confluence-test', async (req, res) => {
  const { baseUrl, email, token, authType } = req.body;
  if (!baseUrl || !token) {
    return res.status(400).json({ success: false, error: 'Faltan baseUrl y token' });
  }

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (authType === 'bearer') {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      headers['Authorization'] = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;
    }

    // Probamos con el endpoint de spaces que existe en Cloud y Server
    await axios.get(`${baseUrl.replace(/\/$/, '')}/rest/api/space?limit=1`, {
      headers,
      timeout: 6000,
    });

    return res.json({ success: true, message: 'Conexión exitosa' });
  } catch (err) {
    const status = err?.response?.status;
    const code   = err?.code;
    if (code === 'ENOTFOUND' || code === 'EAI_AGAIN')
      return res.status(503).json({ success: false, error: '🔒 No se puede resolver el host. Verificá que la VPN esté conectada.' });
    if (code === 'ECONNREFUSED')
      return res.status(503).json({ success: false, error: '🔌 Conexión rechazada. El servidor Confluence no está accesible desde esta red.' });
    if (code === 'ETIMEDOUT' || code === 'ECONNABORTED')
      return res.status(503).json({ success: false, error: '⏱ Tiempo de espera agotado. Verificá la VPN y la Base URL.' });
    if (status === 401) return res.status(401).json({ success: false, error: 'Credenciales inválidas (401 Unauthorized)' });
    if (status === 403) return res.status(403).json({ success: false, error: 'Sin permisos (403 Forbidden)' });
    if (status === 404) return res.status(404).json({ success: false, error: 'URL no encontrada (404). Verificá la Base URL' });
    return res.status(500).json({ success: false, error: `No se pudo conectar: ${err.message}` });
  }
});

// ─── POST /confluence-fetch ────────────────────────────────────────────────────
app.post('/confluence-fetch', async (req, res) => {
  const { baseUrl, email, token, authType, pageUrl } = req.body;
  if (!baseUrl || !token || !pageUrl) {
    return res.status(400).json({ success: false, error: 'Faltan parámetros' });
  }

  try {
    const base = baseUrl.replace(/\/$/, '');
    const headers = { 'Content-Type': 'application/json' };
    if (authType === 'bearer') {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      headers['Authorization'] = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;
    }

    // Extraer pageId de la URL
    let pageId = null;
    const byId    = pageUrl.match(/[?&]pageId=(\d+)/);
    const byPath  = pageUrl.match(/\/pages\/(\d+)/);
    if (byId)   pageId = byId[1];
    if (byPath) pageId = byPath[1];

    let apiUrl;
    if (pageId) {
      apiUrl = `${base}/rest/api/content/${pageId}?expand=body.storage,title`;
    } else {
      // Formato /display/SPACE/Titulo
      const displayMatch = pageUrl.match(/\/display\/([^/?#]+)\/([^?#]+)/);
      if (!displayMatch) {
        return res.status(400).json({ success: false, error: 'No se pudo extraer el pageId de la URL. Usá la URL completa con ?pageId=XXXXX' });
      }
      const spaceKey = displayMatch[1];
      const title    = decodeURIComponent(displayMatch[2].replace(/\+/g, ' '));
      apiUrl = `${base}/rest/api/content?title=${encodeURIComponent(title)}&spaceKey=${spaceKey}&expand=body.storage`;
    }

    const response = await axios.get(apiUrl, { headers, timeout: 10000 });
    const page = response.data?.results?.[0] || (response.data?.type ? response.data : null);

    if (!page) {
      return res.status(404).json({ success: false, error: 'Página no encontrada en Confluence' });
    }

    const htmlContent = page.body?.storage?.value || '';
    const title       = page.title || 'Sin título';

    // Convertir HTML de Confluence a texto plano legible
    const plainText = htmlContent
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<\/tr>/gi, '\n')
      .replace(/<\/th>/gi, ' | ')
      .replace(/<\/td>/gi, ' | ')
      .replace(/<\/h[1-6]>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // Truncar a 6000 chars para no exceder el contexto de Groq
    const MAX_CHARS = 6000;
    const truncated = plainText.length > MAX_CHARS
      ? plainText.slice(0, MAX_CHARS) + '\n\n[...contenido truncado para análisis...]'
      : plainText;

    const fullText = `${title}\n\n${truncated}`;

    // Llamar a Groq con el mismo pipeline que /parse-criteria
    if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'your_api_key_here') {
      return res.status(503).json({ success: false, error: 'GROQ_API_KEY no configurada' });
    }

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: fullText },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) throw new Error('Respuesta vacía de Groq');

    // Extraer el primer JSON objeto balanceado de la respuesta
    const extractBalancedJson = (str) => {
      const start = str.indexOf('{');
      if (start === -1) return null;
      let depth = 0;
      let inString = false;
      let escape = false;
      for (let i = start; i < str.length; i++) {
        const ch = str[i];
        if (escape)          { escape = false; continue; }
        if (ch === '\\')     { escape = true;  continue; }
        if (ch === '"')      { inString = !inString; continue; }
        if (inString)        continue;
        if (ch === '{')      depth++;
        else if (ch === '}') { depth--; if (depth === 0) return str.slice(start, i + 1); }
      }
      return null;
    };

    const jsonStr = extractBalancedJson(raw);
    if (!jsonStr) throw new Error('La IA no devolvió JSON válido');

    const parsed = JSON.parse(jsonStr);
    postProcess(parsed, fullText);

    if (!Array.isArray(parsed.scenarios)) {
      parsed.scenarios = parsed.scenario ? [parsed.scenario] : [];
      delete parsed.scenario;
    }

    parsed.scenarios = parsed.scenarios.map(s => ({
      ...s,
      assertions:     Array.isArray(s.assertions)     ? s.assertions     : [],
      detectedParams: Array.isArray(s.detectedParams) ? s.detectedParams : [],
      detectedBody:   s.detectedBody || '',
    }));

    return res.json({
      success: true,
      pageTitle: title,
      rawText:   fullText,
      ...parsed,
    });

  } catch (err) {
    console.error('Error confluence-fetch:', err.message);
    const status = err?.response?.status;
    const code   = err?.code;
    if (code === 'ENOTFOUND' || code === 'EAI_AGAIN')
      return res.status(503).json({ success: false, error: '🔒 No se puede resolver el host. Verificá que la VPN esté conectada.' });
    if (code === 'ECONNREFUSED')
      return res.status(503).json({ success: false, error: '🔌 Conexión rechazada. El servidor Confluence no está accesible desde esta red.' });
    if (code === 'ETIMEDOUT' || code === 'ECONNABORTED')
      return res.status(503).json({ success: false, error: '⏱ Tiempo de espera agotado. Verificá la VPN y la Base URL.' });
    if (status === 401) return res.status(401).json({ success: false, error: 'Credenciales inválidas (401)' });
    if (status === 403) return res.status(403).json({ success: false, error: 'Sin permisos (403)' });
    return res.status(500).json({ success: false, error: `Error: ${err.message}` });
  }
});

// ─── POST /confluence-ask ──────────────────────────────────────────────────────
// Responde preguntas sobre el contenido de la HU y, si aplica, sugiere cambios
app.post('/confluence-ask', async (req, res) => {
  const { rawText, question } = req.body;
  if (!rawText || !question) {
    return res.status(400).json({ success: false, error: 'Faltan rawText o question' });
  }
  if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'your_api_key_here') {
    return res.status(503).json({ success: false, error: 'GROQ_API_KEY no configurada' });
  }

  const ASK_PROMPT = `Sos un asistente experto en QA que analiza Historias de Usuario de Confluence.

El usuario te va a hacer una pregunta sobre el contenido de una HU (Historia de Usuario).
Tu respuesta debe tener SIEMPRE este formato JSON exacto (sin markdown, sin texto extra):

{
  "answer": "Respuesta clara en español a la pregunta del usuario, basada en el contenido de la HU",
  "hasSuggestion": true o false,
  "suggestionLabel": "Descripción corta de qué cambiaría (ej: 'Habilitar OCP en todos los escenarios')",
  "suggestion": null o el JSON completo del análisis actualizado con la misma estructura que usás normalmente
}

REGLAS:
- "answer": respondé la pregunta directamente. Si la HU no menciona algo, decilo claramente.
- "hasSuggestion": true SOLO si la pregunta implica un cambio concreto que mejoraría el test (ej: "¿habría que validar logs?" → podés sugerir habilitar OCP)
- "suggestionLabel": frase corta que explica el cambio sugerido
- "suggestion": si hasSuggestion es true, devolvé el JSON completo actualizado con la misma estructura de siempre (featureName, endpoint, baseUrl, scenarios, etc.). Si hasSuggestion es false, devolvé null.

Si el usuario pregunta algo como "¿dice algo de X?" y la respuesta es sí, ofrecer una sugerencia con ese cambio aplicado.
Si la respuesta es no, no sugerir nada.`;

  try {
    const combinedText = `CONTENIDO DE LA HU:\n${rawText}\n\nPREGUNTA DEL USUARIO:\n${question}`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: ASK_PROMPT },
        { role: 'user',   content: combinedText },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) throw new Error('Respuesta vacía de Groq');

    const extractBalancedJson = (str) => {
      const start = str.indexOf('{');
      if (start === -1) return null;
      let depth = 0, inString = false, escape = false;
      for (let i = start; i < str.length; i++) {
        const ch = str[i];
        if (escape)          { escape = false; continue; }
        if (ch === '\\')     { escape = true;  continue; }
        if (ch === '"')      { inString = !inString; continue; }
        if (inString)        continue;
        if (ch === '{')      depth++;
        else if (ch === '}') { depth--; if (depth === 0) return str.slice(start, i + 1); }
      }
      return null;
    };

    const jsonStr = extractBalancedJson(raw);
    if (!jsonStr) throw new Error('La IA no devolvió JSON válido');

    const result = JSON.parse(jsonStr);

    // Si hay sugerencia, post-procesarla igual que el resto
    if (result.hasSuggestion && result.suggestion) {
      postProcess(result.suggestion, rawText);
      if (!Array.isArray(result.suggestion.scenarios)) {
        result.suggestion.scenarios = result.suggestion.scenario ? [result.suggestion.scenario] : [];
        delete result.suggestion.scenario;
      }
      result.suggestion.scenarios = result.suggestion.scenarios.map(s => ({
        ...s,
        assertions:     Array.isArray(s.assertions)     ? s.assertions     : [],
        detectedParams: Array.isArray(s.detectedParams) ? s.detectedParams : [],
        detectedBody:   s.detectedBody || '',
      }));
    }

    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('Error confluence-ask:', err.message);
    return res.status(500).json({ success: false, error: `Error al procesar la pregunta: ${err.message}` });
  }
});

// ─── POST /confluence-refine ───────────────────────────────────────────────────
// Toma el rawText ya obtenido + un prompt de refinamiento del usuario,
// y vuelve a llamar a Groq para mejorar el análisis
app.post('/confluence-refine', async (req, res) => {
  const { rawText, refinementPrompt } = req.body;
  if (!rawText || !refinementPrompt) {
    return res.status(400).json({ success: false, error: 'Faltan rawText o refinementPrompt' });
  }
  if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'your_api_key_here') {
    return res.status(503).json({ success: false, error: 'GROQ_API_KEY no configurada' });
  }

  try {
    const combinedText = `${rawText}

═══════════════════════════════════════════════════
INSTRUCCIONES ADICIONALES DEL USUARIO:
═══════════════════════════════════════════════════
${refinementPrompt}`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: combinedText },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) throw new Error('Respuesta vacía de Groq');

    const extractBalancedJson = (str) => {
      const start = str.indexOf('{');
      if (start === -1) return null;
      let depth = 0, inString = false, escape = false;
      for (let i = start; i < str.length; i++) {
        const ch = str[i];
        if (escape)          { escape = false; continue; }
        if (ch === '\\')     { escape = true;  continue; }
        if (ch === '"')      { inString = !inString; continue; }
        if (inString)        continue;
        if (ch === '{')      depth++;
        else if (ch === '}') { depth--; if (depth === 0) return str.slice(start, i + 1); }
      }
      return null;
    };

    const jsonStr = extractBalancedJson(raw);
    if (!jsonStr) throw new Error('La IA no devolvió JSON válido');

    const parsed = JSON.parse(jsonStr);
    postProcess(parsed, combinedText);

    if (!Array.isArray(parsed.scenarios)) {
      parsed.scenarios = parsed.scenario ? [parsed.scenario] : [];
      delete parsed.scenario;
    }
    parsed.scenarios = parsed.scenarios.map(s => ({
      ...s,
      assertions:     Array.isArray(s.assertions)     ? s.assertions     : [],
      detectedParams: Array.isArray(s.detectedParams) ? s.detectedParams : [],
      detectedBody:   s.detectedBody || '',
    }));

    return res.json({ success: true, ...parsed });
  } catch (err) {
    console.error('Error confluence-refine:', err.message);
    return res.status(500).json({ success: false, error: `Error al refinar: ${err.message}` });
  }
});

// ─── RUNNER AGENT PROXY ────────────────────────────────────────────────────────
const RUNNER_AGENT_URL   = process.env.RUNNER_AGENT_URL   || 'http://localhost:4000';
const RUNNER_AGENT_TOKEN = process.env.RUNNER_AGENT_TOKEN || 'local-dev-token';

const agentHeaders = () => ({
  'Content-Type':  'application/json',
  'x-agent-token': RUNNER_AGENT_TOKEN,
});

// GET /runner/health — estado del agente
app.get('/runner/health', async (req, res) => {
  try {
    const { data } = await axios.get(`${RUNNER_AGENT_URL}/health`, { headers: agentHeaders(), timeout: 3000 });
    res.json(data);
  } catch (err) {
    const isDown = err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND';
    res.status(isDown ? 503 : 500).json({
      success: false, status: 'DOWN',
      error: isDown ? '🔌 Runner Agent no disponible. Ejecutá start.ps1 para levantarlo.' : err.message,
    });
  }
});

// GET /runner/features — lista los .feature del proyecto
app.get('/runner/features', async (req, res) => {
  try {
    const { data } = await axios.get(`${RUNNER_AGENT_URL}/features`, { headers: agentHeaders(), timeout: 5000 });
    res.json(data);
  } catch (err) {
    const isDown = err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND';
    res.status(isDown ? 503 : 500).json({
      success: false,
      error: isDown ? '🔌 Runner Agent no disponible. ¿Está corriendo en el puerto 4000?' : err.message,
    });
  }
});

// GET /runner/features/content?path= — contenido de un .feature
app.get('/runner/features/content', async (req, res) => {
  try {
    const { data } = await axios.get(
      `${RUNNER_AGENT_URL}/features/content?path=${encodeURIComponent(req.query.path || '')}`,
      { headers: agentHeaders(), timeout: 5000 }
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /runner/features/save
app.post('/runner/features/save', async (req, res) => {
  try {
    const { data } = await axios.post(`${RUNNER_AGENT_URL}/features/save`, req.body, { headers: agentHeaders(), timeout: 5000 });
    res.json(data);
  } catch (err) { res.status(err?.response?.status || 500).json({ success: false, error: err?.response?.data?.error || err.message }); }
});

// POST /runner/features/rename
app.post('/runner/features/rename', async (req, res) => {
  try {
    const { data } = await axios.post(`${RUNNER_AGENT_URL}/features/rename`, req.body, { headers: agentHeaders(), timeout: 5000 });
    res.json(data);
  } catch (err) { res.status(err?.response?.status || 500).json({ success: false, error: err?.response?.data?.error || err.message }); }
});

// POST /runner/features/create
app.post('/runner/features/create', async (req, res) => {
  try {
    const { data } = await axios.post(`${RUNNER_AGENT_URL}/features/create`, req.body, { headers: agentHeaders(), timeout: 5000 });
    res.json(data);
  } catch (err) { res.status(err?.response?.status || 500).json({ success: false, error: err?.response?.data?.error || err.message }); }
});

// POST /runner/features/import
app.post('/runner/features/import', async (req, res) => {
  try {
    const { data } = await axios.post(`${RUNNER_AGENT_URL}/features/import`, req.body, { headers: agentHeaders(), timeout: 5000 });
    res.json(data);
  } catch (err) { res.status(err?.response?.status || 500).json({ success: false, error: err?.response?.data?.error || err.message }); }
});

// DELETE /runner/features
app.delete('/runner/features', async (req, res) => {
  try {
    const { data } = await axios.delete(`${RUNNER_AGENT_URL}/features`, { headers: agentHeaders(), data: req.body, timeout: 5000 });
    res.json(data);
  } catch (err) { res.status(err?.response?.status || 500).json({ success: false, error: err?.response?.data?.error || err.message }); }
});

// POST /runner/analyze — analiza el output de Maven/Karate con IA
app.post('/runner/analyze', async (req, res) => {
  const { logs, featureName, exitCode, summary, provider = 'groq', apiKey, model, ollamaUrl } = req.body;
  if (!logs || !logs.length) {
    return res.status(400).json({ success: false, error: 'No hay logs para analizar' });
  }

  const logsText = logs.map(l => `[${l.type.toUpperCase()}] ${l.text}`).join('\n');
  const status   = exitCode === 0 ? 'EXITOSO' : 'FALLIDO';
  const summaryText = summary
    ? `\nResumen Karate: ${summary.featuresPassed} features OK, ${summary.featuresFailed} fallidos, ${summary.scenariosPassed} scenarios OK, ${summary.scenariosfailed} fallidos.`
    : '';

  const RUNNER_PROMPT = `Sos un experto en QA automation con Karate DSL y Maven.
Analizá el siguiente output de consola de una ejecución de tests y respondé en español con este JSON exacto (sin markdown):

{
  "status": "success|failure|error",
  "summary": "Resumen en 1-2 líneas de qué pasó",
  "rootCause": "Causa raíz del problema (null si fue exitoso)",
  "failedTests": ["lista de tests/scenarios que fallaron con su error"],
  "fixes": [
    { "title": "Título corto de la acción", "description": "Explicación detallada de cómo resolverlo" }
  ],
  "nextSteps": ["paso 1", "paso 2"]
}

REGLAS:
- Si el build fue exitoso (BUILD SUCCESS), status = "success", rootCause = null, fixes = []
- Si hay errores de conexión (ECONNREFUSED, timeout, SSL), identificalos como causa raíz
- Si hay assertion failures de Karate, listá cada scenario fallido con el campo que falló
- Si hay errores de Maven/Java (ClassNotFoundException, etc.), explicá cómo resolverlos
- Los fixes deben ser accionables y específicos para el contexto de Karate/QA
- Siempre respondé en español`;

  try {
    const raw = await callAI({
      provider, apiKey, model, ollamaUrl,
      messages: [
        { role: 'system', content: RUNNER_PROMPT },
        { role: 'user', content: `Feature: ${featureName || 'todos'}\nResultado: ${status}${summaryText}\n\nLOGS:\n${logsText.slice(0, 8000)}` },
      ],
    });

    const start = raw.indexOf('{');
    const end   = raw.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('La IA no devolvió JSON válido');
    const parsed = JSON.parse(raw.slice(start, end + 1));
    return res.json({ success: true, analysis: parsed });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /runner/report — último reporte Karate
app.get('/runner/report', async (req, res) => {
  try {
    const { data } = await axios.get(`${RUNNER_AGENT_URL}/report`, { headers: agentHeaders(), timeout: 5000 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /runner/run — ejecuta Maven, hace pipe del SSE del agente al cliente
app.post('/runner/run', async (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  const send = (type, data) =>
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`);

  try {
    const agentRes = await axios.post(
      `${RUNNER_AGENT_URL}/run`,
      req.body,
      { headers: agentHeaders(), responseType: 'stream', timeout: 0 }
    );
    agentRes.data.on('data',  chunk => res.write(chunk));
    agentRes.data.on('end',   ()    => res.end());
    agentRes.data.on('error', err   => { send('error', err.message); res.end(); });
  } catch (err) {
    const isDown = err.code === 'ECONNREFUSED';
    send('error', isDown
      ? '🔌 Runner Agent no disponible. Ejecutá start.ps1 para levantarlo.'
      : err.message
    );
    send('done', { exitCode: 1, success: false, message: '❌ No se pudo conectar al Runner Agent' });
    res.end();
  }
});

// ─── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'OK', timestamp: new Date() }));

// ─── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 QATestUI Backend corriendo en http://localhost:${PORT}`);
  console.log(`   POST /generate-feature  → genera el .feature como JSON`);
  console.log(`   POST /download-feature  → descarga el .feature como archivo`);
  console.log(`   GET  /health            → estado del servidor\n`);
});

