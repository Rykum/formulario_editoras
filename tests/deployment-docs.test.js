const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const readmePath = path.join(__dirname, '..', 'README.md');
const manifestPath = path.join(__dirname, '..', 'apps-script', 'appsscript.json');

test('deployment guide lists files, setup, access policy, and spreadsheet location', () => {
  assert.ok(fs.existsSync(readmePath), 'README.md must document deployment');
  const readme = fs.readFileSync(readmePath, 'utf8');
  for (const filename of ['Code.gs', 'Survey.gs', 'Index.html', 'Styles.html', 'Client.html']) {
    assert.ok(readme.includes(filename), `README.md must name ${filename}`);
  }
  assert.match(readme, /setupSurveySpreadsheet\(\)/);
  assert.match(readme, /Executar como[\s\S]*sele[cç]ione \*\*Eu\*\*/i);
  assert.match(readme, /acesso anônimo[\s\S]*pol[ií]ticas? do Google Workspace|Google Workspace[\s\S]*acesso anônimo/i);
  assert.match(readme, /URL da planilha|link da planilha/i);
});

test('Apps Script manifest uses the V8 runtime and São Paulo time zone', () => {
  assert.ok(fs.existsSync(manifestPath), 'Apps Script manifest must be present');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.runtimeVersion, 'V8');
  assert.equal(manifest.timeZone, 'America/Sao_Paulo');
});

test('documents the Vercel and Google Sheets setup without treating the legacy deployment as migrated', () => {
  const readme = fs.readFileSync(readmePath, 'utf8');
  for (const text of [
    'Vercel',
    'Google Sheets API',
    'GOOGLE_SHEETS_ID',
    'GOOGLE_SERVICE_ACCOUNT_EMAIL',
    'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
    'Respostas organizadas',
    'service account',
    'Apps Script'
  ]) assert.ok(readme.includes(text), `README.md must document ${text}`);
  assert.match(readme, /service account[\s\S]*Editor/i);
  assert.match(readme, /vari[aá]veis de ambiente[\s\S]*sens[ií]vel/i);
  assert.match(readme, /=IFERROR\(SORT\(FILTER\(Respostas!A2:S,Respostas!A2:A<>""\),3,TRUE,2,FALSE\),""\)/);
  assert.match(readme, /implanta[cç][aã]o do Apps Script[\s\S]*(?:externa|legado)[\s\S]*(?:n[aã]o|s[oó])[\s\S]*(?:migrad|desativad)/i);
});

test('configures Vercel local development at the repository root', () => {
  const packagePath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const readme = fs.readFileSync(readmePath, 'utf8');

  assert.equal(packageJson.scripts.dev, 'node --env-file-if-exists=.env.local dev-server.js');
  assert.equal(packageJson.devDependencies?.vercel, undefined, 'local preview must not install Vercel CLI dependencies');
  assert.equal(packageJson.engines.node, '24.x');
  assert.match(readme, /npm install[\s\S]*npm run dev/);
  assert.match(readme, /raiz do reposit[oó]rio/);
  assert.match(readme, /sem elas[\s\S]*API informa/i);
  assert.match(readme, /servidor Node nativo/i);
  assert.match(readme, /Vercel Function/i);
});
