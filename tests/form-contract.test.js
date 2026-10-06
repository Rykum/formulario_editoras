const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appsScriptDirectory = path.join(__dirname, '..', 'apps-script');

function readSurveySources() {
  const filenames = ['Index.html', 'Styles.html', 'Client.html'];
  const missing = filenames.filter((filename) => !fs.existsSync(path.join(appsScriptDirectory, filename)));
  assert.deepEqual(missing, [], `survey files are missing: ${missing.join(', ')}`);
  return Object.fromEntries(filenames.map((filename) => [
    filename,
    fs.readFileSync(path.join(appsScriptDirectory, filename), 'utf8')
  ]));
}

function loadClientHelpers(clientHtml) {
  const match = clientHtml.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i);
  assert.ok(match, 'Client.html must contain a script element');
  const context = vm.createContext({});
  vm.runInContext(match[1], context, { filename: 'Client.html' });
  return context;
}

test('shows the four survey sections and exactly ten question groups', () => {
  const { 'Index.html': page } = readSurveySources();
  for (const heading of [
    'Identificação da editora',
    'Uso e orientações sobre IA',
    'Percepções e prioridades',
    'Identificação em publicações'
  ]) assert.ok(page.includes(heading), `missing section heading: ${heading}`);

  for (let question = 1; question <= 10; question += 1) {
    const matches = page.match(new RegExp(`\\bid="q${question}"`, 'g')) || [];
    assert.equal(matches.length, 1, `question group q${question} must appear exactly once`);
  }
});

test('uses a contemporary visual system with a highlighted hero and card-based form sections', () => {
  const styles = readSurveySources()['Styles.html'];
  const root = styles.match(/:root\s*{([\s\S]*?)}/)?.[1] || '';
  const hero = styles.match(/\.hero\s*{([\s\S]*?)}/)?.[1] || '';
  const formSection = styles.match(/\.form-section\s*{([\s\S]*?)}/)?.[1] || '';

  assert.match(root, /--forest:\s*#[0-9a-f]{6}/i);
  assert.match(root, /--mint:\s*#[0-9a-f]{6}/i);
  assert.match(hero, /background:/);
  assert.match(hero, /border-radius:\s*\d+px/);
  assert.match(formSection, /background:\s*var\(--surface\)/);
  assert.match(formSection, /border-radius:\s*\d+px/);
  assert.match(styles, /@media\s*\(max-width:\s*860px\)/);
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test('choice groups use visible legends and labels associated with their controls', () => {
  const { 'Index.html': page } = readSurveySources();
  for (const question of [3, 4, 5, 6, 7, 8, 10]) {
    const match = page.match(new RegExp(`<fieldset\\b[^>]*\\bid="q${question}"[^>]*>([\\s\\S]*?)<\\/fieldset>`));
    assert.ok(match, `question q${question} must use a fieldset`);
    const legend = match[1].match(/<legend\b[^>]*>([\s\S]*?)<\/legend>/);
    assert.ok(legend, `question q${question} needs a legend`);
    assert.ok(legend[1].replace(/<[^>]*>/g, '').trim(), `question q${question} needs a visible legend`);
    const inputIds = [...match[1].matchAll(/<input\b[^>]*\bid="([^"]+)"/g)].map((item) => item[1]);
    assert.ok(inputIds.length > 0, `question q${question} needs native choice controls`);
    for (const id of inputIds) {
      const explicitlyLabeled = new RegExp(`<label\\b[^>]*\\bfor="${id}"`).test(match[1]);
      const implicitlyLabeled = new RegExp(`<label\\b[^>]*>\\s*<input\\b[^>]*\\bid="${id}"`).test(match[1]);
      assert.ok(explicitlyLabeled || implicitlyLabeled, `control ${id} needs an associated label`);
    }
  }
});

test('conditional visibility follows the controlling survey answers', () => {
  const { 'Client.html': client } = readSurveySources();
  const { getConditionalVisibility } = loadClientHelpers(client);
  assert.equal(getConditionalVisibility({ usesAI: 'yes' }).activities, true);
  assert.equal(getConditionalVisibility({ usesAI: 'testing' }).activities, true);
  assert.equal(getConditionalVisibility({ usesAI: 'no' }).activities, false);
  assert.equal(getConditionalVisibility({ usesAI: 'unknown' }).activities, false);
  assert.equal(getConditionalVisibility({ policyStatus: 'public' }).policyUrl, true);
  assert.equal(getConditionalVisibility({ policyStatus: 'private' }).policyUrl, false);
  assert.equal(getConditionalVisibility({ reviewerGuidance: 'restricted' }).reviewerRestrictions, true);
  assert.equal(getConditionalVisibility({ reviewerGuidance: 'unrestricted' }).reviewerRestrictions, false);
});

test('normalizes hidden conditional answers without mutating the form payload', () => {
  const { 'Client.html': client } = readSurveySources();
  const { normalizeConditionalAnswers } = loadClientHelpers(client);
  const original = { usesAI: 'no', activities: ['translation'], otherActivity: 'tradução', policyStatus: 'private', policyUrl: 'https://example.org/policy', reviewerGuidance: 'unrestricted', reviewerRestrictions: ['declaration'] };
  const normalized = normalizeConditionalAnswers(original);
  assert.deepEqual(JSON.parse(JSON.stringify(normalized.activities)), []);
  assert.equal(normalized.otherActivity, '');
  assert.equal(normalized.policyUrl, '');
  assert.deepEqual(JSON.parse(JSON.stringify(normalized.reviewerRestrictions)), []);
  assert.equal(normalized.otherRestriction, '');
  assert.equal(original.activities[0], 'translation');
  assert.equal(original.policyUrl, 'https://example.org/policy');
});

test('maps only a confirmed server response to success and never inserts answers as HTML', () => {
  const { 'Client.html': client } = readSurveySources();
  const { getSubmissionNotice } = loadClientHelpers(client);
  assert.deepEqual(JSON.parse(JSON.stringify(getSubmissionNotice({ ok: true }))), {
    kind: 'success', message: 'Resposta registrada.'
  });
  assert.deepEqual(JSON.parse(JSON.stringify(getSubmissionNotice({ ok: false, message: 'Você já enviou uma resposta recentemente. Aguarde antes de tentar novamente.' }))), {
    kind: 'error', message: 'Você já enviou uma resposta recentemente. Aguarde antes de tentar novamente.'
  });
  assert.deepEqual(JSON.parse(JSON.stringify(getSubmissionNotice({ ok: false, message: '<img src=x>' }))), {
    kind: 'error', message: 'Não foi possível enviar sua resposta. Tente novamente.'
  });
  assert.equal(getSubmissionNotice(null).kind, 'error');
  assert.doesNotMatch(client, /\.innerHTML\s*=/);
  assert.match(client, /\.textContent\s*=/);
});
