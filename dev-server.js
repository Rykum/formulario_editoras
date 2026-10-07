const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const submitHandler = require('./api/submit');
const { MAX_BODY_BYTES } = require('./api/submit');

const STATIC_FILES = Object.freeze({
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/client.js': ['client.js', 'text/javascript; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/public/utfpr-logo.png': ['public/utfpr-logo.png', 'image/png']
});

function sendText(response, status, message, headers = {}) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'text/plain; charset=utf-8');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  for (const [name, value] of Object.entries(headers)) response.setHeader(name, value);
  response.end(message);
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      resolve(tooLarge ? Buffer.alloc(MAX_BODY_BYTES + 1) : Buffer.concat(chunks));
    });
    request.on('error', reject);
  });
}

function createDevServer({ root = __dirname, handleSubmit = submitHandler } = {}) {
  return http.createServer((request, response) => {
    let pathname;
    try {
      pathname = new URL(request.url, 'http://localhost').pathname;
    } catch {
      sendText(response, 400, 'Solicitação inválida.');
      return;
    }

    if (pathname === '/api/submit') {
      if (request.method !== 'POST') {
        handleSubmit(request, response);
        return;
      }
      readRequestBody(request)
        .then((body) => {
          request.body = body;
          return handleSubmit(request, response);
        })
        .catch(() => sendText(response, 400, 'Não foi possível ler o envio.'));
      return;
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      sendText(response, 405, 'Método não permitido.', { Allow: 'GET, HEAD' });
      return;
    }

    const asset = STATIC_FILES[pathname];
    if (!asset) {
      sendText(response, 404, 'Página não encontrada.');
      return;
    }

    const filePath = path.join(root, asset[0]);
    fs.readFile(filePath, (error, content) => {
      if (error) {
        sendText(response, 404, 'Arquivo não encontrado.');
        return;
      }
      response.statusCode = 200;
      response.setHeader('Content-Type', asset[1]);
      response.setHeader('Cache-Control', 'no-cache');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.setHeader('Content-Length', content.length);
      response.end(request.method === 'HEAD' ? undefined : content);
    });
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  const server = createDevServer();
  server.listen(port, '127.0.0.1', () => {
    process.stdout.write(`Pesquisa editorial disponível em http://localhost:${port}\n`);
  });
}

module.exports = { createDevServer };
