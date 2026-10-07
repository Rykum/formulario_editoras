const { randomUUID } = require('node:crypto');
const { buildResponseRow, normalizeSubmission, validateSubmission } = require('../lib/survey');
const { appendResponseRow } = require('../lib/google-sheets');

const MAX_BODY_BYTES = 32 * 1024;
const SAFE_FAILURE = 'Não foi possível registrar a resposta agora. Tente novamente.';

function parseRequestBody(request) {
  let body = request.body;
  if (Buffer.isBuffer(body)) body = body.toString('utf8');

  let serialized;
  try {
    serialized = typeof body === 'string' ? body : JSON.stringify(body);
  } catch {
    return { ok: false, status: 400 };
  }

  if (typeof serialized === 'string' && Buffer.byteLength(serialized, 'utf8') > MAX_BODY_BYTES) {
    return { ok: false, status: 413 };
  }

  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return { ok: false, status: 400 };
    }
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, status: 400 };
  }
  return { ok: true, body };
}

function sendJson(response, status, body, headers = {}) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  for (const [name, value] of Object.entries(headers)) response.setHeader(name, value);
  response.end(JSON.stringify(body));
}

function createSubmitHandler({ appendRow = appendResponseRow, env = process.env } = {}) {
  return async function submitHandler(request, response) {
    if (request.method !== 'POST') {
      sendJson(response, 405, { ok: false, message: 'Método não permitido.' }, { Allow: 'POST' });
      return;
    }

    const parsed = parseRequestBody(request);
    if (!parsed.ok) {
      if (parsed.status === 413) {
        sendJson(response, 413, { ok: false, message: 'A solicitação excede o tamanho permitido.' });
      } else {
        sendJson(response, 400, { ok: false, message: 'Não foi possível validar o envio.' });
      }
      return;
    }

    if (typeof parsed.body.website === 'string' && parsed.body.website.trim()) {
      sendJson(response, 400, { ok: false, message: 'Não foi possível validar o envio.' });
      return;
    }

    const validation = validateSubmission(parsed.body);
    if (!validation.ok) {
      sendJson(response, 400, {
        ok: false,
        message: 'Revise os campos destacados.',
        errors: validation.errors
      });
      return;
    }

    const submission = normalizeSubmission(parsed.body);
    const row = buildResponseRow(submission, new Date().toISOString(), randomUUID());

    try {
      await appendRow(row, env);
      sendJson(response, 200, { ok: true, message: 'Resposta registrada.' });
    } catch {
      sendJson(response, 503, { ok: false, message: SAFE_FAILURE });
    }
  };
}

const handler = createSubmitHandler();

module.exports = handler;
module.exports.createSubmitHandler = createSubmitHandler;
module.exports.MAX_BODY_BYTES = MAX_BODY_BYTES;
