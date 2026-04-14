require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');
const { body, validationResult } = require('express-validator');
const Groq = require('groq-sdk');

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

// ─── System prompt para Groq ───────────────────────────────────────────────
const SYSTEM_PROMPT = `Sos un asistente experto en QA y testing de APIs REST.
Tu tarea es analizar texto de criterios de aceptación (formato Dado/Cuando/Entonces o Given/When/Then)
y/o datos de prueba, y extraer información estructurada para generar tests con Karate DSL.

IMPORTANTE: El texto puede contener UNO o VARIOS criterios de aceptación. Debés detectar TODOS y generar un escenario por cada uno.
Un criterio nuevo comienza con "Dado" / "Given" o con una nueva sección numerada / separada visualmente.

Devolvé SIEMPRE y ÚNICAMENTE un JSON válido con esta estructura exacta (sin texto adicional, sin markdown):

{
  "featureName": "string (nombre del feature en PascalCase, sin espacios)",
  "endpoint": "string (path del endpoint, ej: /v1/client/data)",
  "scenarios": [
    {
      "name": "string (descripción del escenario, máximo 120 chars)",
      "method": "GET|POST|PUT|DELETE|PATCH",
      "expectedStatus": 200,
      "assertions": [
        {
          "field": "string (campo del response, puede tener notación de punto ej: data.hasClaroPay)",
          "operator": "== true|== false|== null|!= null|==|!=|contains|matches",
          "value": "string (solo si el operador es ==, !=, contains o matches, sino vacío)"
        }
      ],
      "detectedBody": "string (JSON del request body si aplica, sino null)",
      "detectedParams": [
        { "key": "string", "value": "string" }
      ]
    }
  ]
}

Reglas importantes:
- Generá UN objeto en el array "scenarios" por CADA criterio de aceptación encontrado en el texto
- Para campos booleanos del response usá: == true, == false
- Para campos que deben existir: != null
- Para campos que deben ser null: == null
- Para mensajes de error específicos (ej: CLIENT_DATA_FOUND_OK, CLIENT_PAY_NOT_FOUND): usa == con el valor exacto en el campo "message" o "data.message"
- Si hay un JSON de request en el texto, poné el contenido formateado en detectedBody del escenario correspondiente
- Si hay datos de prueba (uuid, cuit, nim, etc.) con valores reales, ponelos en detectedParams del escenario correspondiente
- Si el método es POST/PUT/PATCH los datos van en detectedBody, si es GET van en detectedParams
- El featureName debe ser PascalCase sin espacios ni caracteres especiales
- Analizá TODO el texto incluyendo la sección de datos de prueba si la hay
- Si solo hay un criterio, igualmente devolvé el array "scenarios" con un solo elemento`;

// ─── POST /parse-criteria (con IA Groq) ────────────────────────────────────
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

    // Extraer el JSON de la respuesta (por si la IA agrega texto extra)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('La IA no devolvió JSON válido');

    const parsed = JSON.parse(jsonMatch[0]);

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

// ─── POST /generate-feature ────────────────────────────────────────────────────
app.post('/generate-feature', featureValidation, (req, res) => {
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map((e) => e.msg),
    });
  }

  try {
    const { featureName, endpoint, scenarios } = req.body;

    const OPS_WITHOUT_VALUE = ['!= null', '== null', '== true', '== false'];

    const normalizedScenarios = scenarios.map((s) => ({
      ...s,
      method:  s.method.toUpperCase(),
      params:  (s.params  || []).filter(p => p.key && p.key.trim()),
      headers: (s.headers || []).filter(h => h.key && h.key.trim()),
      body:    s.body && s.body.trim() ? s.body.trim() : null,
      assertions: (s.assertions || [])
        .filter(a => a.field && a.field.trim())
        .map(a => ({
          field:    a.field.trim(),
          operator: a.operator || '!= null',
          value:    OPS_WITHOUT_VALUE.includes(a.operator) ? null : (a.value || ''),
        })),
    }));

    const featureContent = featureTemplate({ featureName, endpoint, scenarios: normalizedScenarios });

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
    const { featureName, endpoint, scenarios } = req.body;

    const OPS_WITHOUT_VALUE = ['!= null', '== null', '== true', '== false'];

    const normalizedScenarios = scenarios.map((s) => ({
      ...s,
      method:  s.method.toUpperCase(),
      params:  (s.params  || []).filter(p => p.key && p.key.trim()),
      headers: (s.headers || []).filter(h => h.key && h.key.trim()),
      body:    s.body && s.body.trim() ? s.body.trim() : null,
      assertions: (s.assertions || [])
        .filter(a => a.field && a.field.trim())
        .map(a => ({
          field:    a.field.trim(),
          operator: a.operator || '!= null',
          value:    OPS_WITHOUT_VALUE.includes(a.operator) ? null : (a.value || ''),
        })),
    }));

    const featureContent = featureTemplate({ featureName, endpoint, scenarios: normalizedScenarios });

    // Sanitize filename
    const safeFileName = featureName.replace(/[^a-z0-9_\-]/gi, '_');

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeFileName}.feature"`
    );
    return res.send(featureContent);
  } catch (err) {
    console.error('Error al descargar feature:', err);
    return res.status(500).json({
      success: false,
      errors: ['Error interno al descargar el archivo .feature'],
    });
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

