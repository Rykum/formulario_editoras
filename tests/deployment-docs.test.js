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
