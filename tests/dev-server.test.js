const test = require('node:test');
const assert = require('node:assert/strict');
const { createDevServer } = require('../dev-server');
const { createSubmitHandler } = require('../api/submit');

async function withServer(handleSubmit, callback) {
  const server = createDevServer({ handleSubmit });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  try {
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('serves the complete form and UTFPR logo from the same local origin', async () => {
  const submit = createSubmitHandler({ appendRow: async () => {}, env: {} });
  await withServer(submit, async (origin) => {
    const page = await fetch(origin);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type'), /text\/html/);
    assert.match(await page.text(), /Inteligência artificial no trabalho editorial/);

    const script = await fetch(`${origin}/client.js`);
    assert.equal(script.status, 200);
    assert.match(await script.text(), /fetchImpl\('\/api\/submit'/);

    const logo = await fetch(`${origin}/public/utfpr-logo.png`);
    assert.equal(logo.status, 200);
    assert.match(logo.headers.get('content-type'), /image\/png/);
    assert.deepEqual([...new Uint8Array(await logo.arrayBuffer()).slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  });
});

test('routes local form submissions to the same handler and preserves safe errors', async () => {
  const submit = createSubmitHandler({
    appendRow: async () => { throw new Error('private_key=local-secret'); },
    env: {}
  });
  await withServer(submit, async (origin) => {
    const response = await fetch(`${origin}/api/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publisher: 'Editora Teste',
        institution: 'Universidade Teste',
        usesAI: 'no',
        activities: [],
        policyStatus: 'none',
        reviewerGuidance: 'none',
        benefits: [],
        concerns: [],
        allowIdentification: 'no',
        website: ''
      })
    });
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.ok, false);
    assert.doesNotMatch(JSON.stringify(body), /private_key|local-secret/);

    const method = await fetch(`${origin}/api/submit`);
    assert.equal(method.status, 405);
    assert.equal(method.headers.get('allow'), 'POST');
  });
});
