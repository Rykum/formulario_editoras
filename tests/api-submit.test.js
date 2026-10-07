const test = require('node:test');
const assert = require('node:assert/strict');

const { createSubmitHandler } = require('../api/submit');
const { createSheetsAppender } = require('../lib/google-sheets');

function validPayload(overrides = {}) {
  return {
    publisher: 'Editora Exemplo',
    institution: 'Universidade Exemplo',
    usesAI: 'no',
    toolsUsed: '',
    activities: [],
    otherActivity: '',
    policyStatus: 'none',
    policyUrl: '',
    reviewerGuidance: 'none',
    reviewerRestrictions: [],
    otherRestriction: '',
    benefits: ['efficiency'],
    otherBenefit: '',
    concerns: ['errors'],
    otherConcern: '',
    futurePriority: '',
    allowIdentification: 'no',
    website: '',
    ...overrides
  };
}

function fakeResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(body) { this.body = body || ''; }
  };
}

function makeRequest(body, method = 'POST') {
  return { method, body };
}

function responseJson(response) {
  return JSON.parse(response.body);
}

test('appends one normalized nineteen-column text row for a valid submission', async () => {
  const rows = [];
  const handler = createSubmitHandler({ appendRow: async (row) => rows.push(row), env: {} });
  const response = fakeResponse();

  await handler(makeRequest(validPayload({ publisher: '=Editora Exemplo' })), response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(responseJson(response), { ok: true, message: 'Resposta registrada.' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].length, 19);
  assert.ok(rows[0].every((value) => typeof value === 'string'));
  assert.equal(rows[0][2], "'=Editora Exemplo");
  assert.match(rows[0][0], /^[0-9a-f-]{36}$/i);
  assert.ok(Number.isFinite(Date.parse(rows[0][1])));
});

test('rejects methods other than POST and advertises the accepted method', async () => {
  let calls = 0;
  const handler = createSubmitHandler({ appendRow: async () => { calls += 1; }, env: {} });
  const response = fakeResponse();

  await handler(makeRequest(validPayload(), 'GET'), response);

  assert.equal(response.statusCode, 405);
  assert.equal(response.headers.allow, 'POST');
  assert.equal(calls, 0);
});

test('rejects malformed and non-object request bodies before appending', async () => {
  let calls = 0;
  const handler = createSubmitHandler({ appendRow: async () => { calls += 1; }, env: {} });

  for (const body of ['{', null, ['not', 'an object']]) {
    const response = fakeResponse();
    await handler(makeRequest(body), response);
    assert.equal(response.statusCode, 400);
    assert.equal(responseJson(response).ok, false);
  }
  assert.equal(calls, 0);
});

test('rejects requests over 32 KiB without attempting JSON parsing or Sheets access', async () => {
  let calls = 0;
  const handler = createSubmitHandler({ appendRow: async () => { calls += 1; }, env: {} });
  const response = fakeResponse();

  await handler(makeRequest('x'.repeat(32 * 1024 + 1)), response);

  assert.equal(response.statusCode, 413);
  assert.equal(calls, 0);
});

test('rejects a filled honeypot and invalid survey choices without appending', async () => {
  let calls = 0;
  const handler = createSubmitHandler({ appendRow: async () => { calls += 1; }, env: {} });

  const spam = fakeResponse();
  await handler(makeRequest(validPayload({ website: 'spam' })), spam);
  assert.equal(spam.statusCode, 400);

  const invalid = fakeResponse();
  await handler(makeRequest(validPayload({ usesAI: 'sometimes' })), invalid);
  assert.equal(invalid.statusCode, 400);
  assert.ok(Array.isArray(responseJson(invalid).errors));
  assert.equal(calls, 0);
});

test('returns only a safe server error when Sheets is unavailable', async () => {
  const handler = createSubmitHandler({
    appendRow: async () => { throw new Error('private_key=SHOULD_NOT_LEAK'); },
    env: {}
  });
  const response = fakeResponse();

  await handler(makeRequest(validPayload()), response);

  assert.equal(response.statusCode, 503);
  assert.equal(responseJson(response).ok, false);
  assert.doesNotMatch(response.body, /private_key|SHOULD_NOT_LEAK/);
});

test('appends each simultaneous valid response exactly once', async () => {
  const rows = [];
  const handler = createSubmitHandler({
    appendRow: async (row) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      rows.push(row);
    },
    env: {}
  });
  const firstResponse = fakeResponse();
  const secondResponse = fakeResponse();

  await Promise.all([
    handler(makeRequest(validPayload({ publisher: 'Editora A' })), firstResponse),
    handler(makeRequest(validPayload({ publisher: 'Editora B' })), secondResponse)
  ]);

  assert.equal(rows.length, 2);
  assert.equal(firstResponse.statusCode, 200);
  assert.equal(secondResponse.statusCode, 200);
  assert.deepEqual(new Set(rows.map((row) => row[2])), new Set(['Editora A', 'Editora B']));
});

test('configures the official Sheets client for RAW append using server-only credentials', async () => {
  let jwtConfig;
  let sheetsConfig;
  let appendConfig;
  class FakeJwt {
    constructor(config) { jwtConfig = config; }
  }
  const fakeGoogle = {
    auth: { JWT: FakeJwt },
    sheets(config) {
      sheetsConfig = config;
      return { spreadsheets: { values: { append: async (request) => { appendConfig = request; } } } };
    }
  };
  const append = createSheetsAppender(fakeGoogle);
  const row = Array.from({ length: 19 }, (_, index) => String(index));
  const env = {
    GOOGLE_SHEETS_ID: 'spreadsheet-id',
    GOOGLE_SERVICE_ACCOUNT_EMAIL: 'survey@example.iam.gserviceaccount.com',
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: 'line-one\\nline-two'
  };

  await append(row, env);

  assert.equal(jwtConfig.email, env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
  assert.equal(jwtConfig.key, 'line-one\nline-two');
  assert.deepEqual(jwtConfig.scopes, ['https://www.googleapis.com/auth/spreadsheets']);
  assert.equal(sheetsConfig.version, 'v4');
  assert.ok(sheetsConfig.auth instanceof FakeJwt);
  assert.equal(appendConfig.spreadsheetId, 'spreadsheet-id');
  assert.equal(appendConfig.range, 'Respostas!A:S');
  assert.equal(appendConfig.valueInputOption, 'RAW');
  assert.equal(appendConfig.insertDataOption, 'INSERT_ROWS');
  assert.deepEqual(appendConfig.requestBody.values, [row]);
});

test('fails closed when any required Sheets credential is absent', async () => {
  let clientCreated = false;
  const fakeGoogle = {
    auth: { JWT: class { constructor() { clientCreated = true; } } },
    sheets() { clientCreated = true; }
  };
  const append = createSheetsAppender(fakeGoogle);

  await assert.rejects(append(Array(19).fill(''), { GOOGLE_SHEETS_ID: 'only-id' }));
  assert.equal(clientCreated, false);
});
