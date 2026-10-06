const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAppsScript, validSubmission } = require('./apps-script-harness');

test('setup creates a named response sheet with a frozen header and filter', () => {
  const app = loadAppsScript(['Survey.gs', 'Code.gs']);
  const result = app.setupSurveySpreadsheet();
  assert.equal(app.spreadsheet.name, 'Pesquisa sobre IA nas editoras universitárias');
  assert.equal(result.spreadsheetId, 'spreadsheet-test-id');
  assert.match(result.url, /^https:\/\/docs\.google\.com\/spreadsheets\//);
  assert.ok(app.logger.messages.some((message) => message.includes(result.url)));
  assert.equal(app.sheet.getName(), 'Respostas');
  assert.equal(app.sheet.frozenRows, 1);
  assert.equal(app.sheet.filterCreated, true);
  assert.deepEqual(app.sheet.rows[0], [
    'ID', 'Enviado em', 'Editora', 'Instituição', 'Uso de IA', 'Atividades',
    'Outra atividade', 'Política formal', 'Link da política', 'Orientação para pareceristas',
    'Restrições para pareceristas', 'Outra restrição', 'Benefícios', 'Outro benefício',
    'Preocupações', 'Outra preocupação', 'Prioridade futura', 'Autoriza identificação'
  ]);
});

test('reuses the configured spreadsheet without clearing existing responses', () => {
  const app = loadAppsScript(['Survey.gs', 'Code.gs']);
  app.setupSurveySpreadsheet();
  app.submitResponse(validSubmission());
  const before = app.sheet.rows.length;
  app.setupSurveySpreadsheet();
  assert.equal(app.spreadsheetApp.getCreateCount(), 1);
  assert.equal(app.sheet.rows.length, before);
});

test('appends valid responses and sorts by publisher then newest timestamp', () => {
  const app = loadAppsScript(['Survey.gs', 'Code.gs']);
  app.setupSurveySpreadsheet();
  assert.equal(app.submitResponse(validSubmission({ publisher: 'Editora Zênite' })).ok, true);
  app.session.activeUserKey = 'temporary-user-key-2';
  assert.equal(app.submitResponse(validSubmission({ publisher: 'Editora Aurora' })).ok, true);
  app.session.activeUserKey = 'temporary-user-key-3';
  assert.equal(app.submitResponse(validSubmission({ publisher: 'Editora Aurora' })).ok, true);
  assert.equal(app.sheet.rows.length, 4);
  assert.equal(app.sheet.appendCount, 3);
  assert.deepEqual(JSON.parse(JSON.stringify(app.sheet.lastSortSpec)), [
    { column: 3, ascending: true },
    { column: 2, ascending: false }
  ]);
  assert.deepEqual(app.sheet.rows.slice(1).map((row) => row[2]), [
    'Editora Aurora', 'Editora Aurora', 'Editora Zênite'
  ]);
  assert.equal(app.lock.waitCount, 3);
  assert.equal(app.lock.releaseCount, 3);
});

test('rejects invalid and honeypot submissions without writing to the sheet', () => {
  const app = loadAppsScript(['Survey.gs', 'Code.gs']);
  app.setupSurveySpreadsheet();
  const invalid = app.submitResponse(validSubmission({ policyStatus: 'invented' }));
  const spam = app.submitResponse(validSubmission({ website: 'https://spam.example' }));
  assert.equal(invalid.ok, false);
  assert.equal(spam.ok, false);
  assert.equal(app.sheet.appendCount, 0);
  assert.equal(app.lock.waitCount, 0);
});

test('rejects malformed hidden option answers before acquiring the storage lock', () => {
  const app = loadAppsScript(['Survey.gs', 'Code.gs']);
  app.setupSurveySpreadsheet();
  const invalidActivities = app.submitResponse(validSubmission({ usesAI: 'no', activities: ['invented'] }));
  const invalidRestrictions = app.submitResponse(validSubmission({ reviewerGuidance: 'unrestricted', reviewerRestrictions: 'confidentiality' }));
  assert.equal(invalidActivities.ok, false);
  assert.equal(invalidRestrictions.ok, false);
  assert.equal(app.sheet.appendCount, 0);
  assert.equal(app.lock.waitCount, 0);
});

test('rejects oversized text before acquiring the storage lock', () => {
  const app = loadAppsScript(['Survey.gs', 'Code.gs']);
  app.setupSurveySpreadsheet();
  const result = app.submitResponse(validSubmission({ publisher: 'P'.repeat(201) }));
  assert.equal(result.ok, false);
  assert.equal(app.sheet.appendCount, 0);
  assert.equal(app.lock.waitCount, 0);
});

test('limits repeat submissions by temporary active user key', () => {
  const app = loadAppsScript(['Survey.gs', 'Code.gs']);
  app.setupSurveySpreadsheet();
  const first = app.submitResponse(validSubmission());
  const repeated = app.submitResponse(validSubmission({ publisher: 'Editora Horizonte' }));
  assert.equal(first.ok, true);
  assert.equal(repeated.ok, false);
  assert.match(repeated.message, /aguarde/i);
  assert.equal(app.sheet.appendCount, 1);
  assert.equal(app.scriptCache.lastExpiration, 3600);

  app.session.activeUserKey = 'temporary-user-key-2';
  assert.equal(app.submitResponse(validSubmission({ publisher: 'Editora Horizonte' })).ok, true);
  assert.equal(app.sheet.appendCount, 2);
});

test('fails closed when the temporary active user key is unavailable', () => {
  const app = loadAppsScript(['Survey.gs', 'Code.gs']);
  app.setupSurveySpreadsheet();
  app.session.activeUserKey = '';
  const result = app.submitResponse(validSubmission());
  assert.equal(result.ok, false);
  assert.equal(app.sheet.appendCount, 0);
  assert.equal(app.lock.waitCount, 0);
});

test('does not confirm submissions before spreadsheet setup', () => {
  const app = loadAppsScript(['Survey.gs', 'Code.gs']);
  const result = app.submitResponse(validSubmission());
  assert.equal(result.ok, false);
});

test('serves the survey template and includes named HTML partials', () => {
  const app = loadAppsScript(['Survey.gs', 'Code.gs']);
  const page = app.doGet();
  assert.equal(app.htmlService.lastTemplate, 'Index');
  assert.equal(page.title, 'Pesquisa sobre IA nas editoras universitárias');
  assert.equal(app.include('Styles'), '<!-- Styles -->');
  assert.equal(app.htmlService.lastPartial, 'Styles');
});
