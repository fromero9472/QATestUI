require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');
const { body, validationResult } = require('express-validator');
const Groq = require('groq-sdk');
const axios = require('axios').default || require('axios');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Groq client ───────────────────────────────────────────────────────────────
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

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
  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ success: false, errors: ['El texto no puede estar vacío'] });
  }

  if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'your_api_key_here') {
    return res.status(503).json({
      success: false,
      errors: ['GROQ_API_KEY no configurada. Agregá tu API key en backend/.env (gratis en console.groq.com/keys)']
    });
  }

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      max_tokens: 2048,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: text }
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) throw new Error('Respuesta vacía de Groq');

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
    console.error('Error Groq:', err.message);
    const isGroqError = err?.error?.type || err?.status;
    return res.status(500).json({
      success: false,
      errors: [isGroqError
        ? `Error de Groq API: ${err.message}`
        : 'No se pudo analizar el criterio. Verificá el formato del texto.'
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

// ─── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'OK', timestamp: new Date() }));

// ─── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 QATestUI Backend corriendo en http://localhost:${PORT}`);
  console.log(`   POST /generate-feature  → genera el .feature como JSON`);
  console.log(`   POST /download-feature  → descarga el .feature como archivo`);
  console.log(`   GET  /health            → estado del servidor\n`);
});

