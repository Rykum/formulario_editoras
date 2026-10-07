const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const client = fs.readFileSync(path.join(root, 'client.js'), 'utf8');

function loadClientHelpers() {
  return vm.createContext({});
}

test('shows the four survey sections and exactly ten question groups in order', () => {
  for (const heading of [
    'Identificação da editora',
    'Uso e orientações sobre IA',
    'Percepções e prioridades',
    'Autorização de identificação'
  ]) assert.ok(page.includes(heading), `missing section heading: ${heading}`);

  const groups = [...page.matchAll(/id="q(\d+)"/g)].map((match) => Number(match[1]));
  assert.deepEqual(groups, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const numbers = [...page.matchAll(/class="question-number">(\d{2})</g)].map((match) => match[1]);
  assert.deepEqual(numbers, ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10']);
});

test('uses a light UTFPR visual system with interactive choices and reduced-motion support', () => {
  const rootTokens = styles.match(/:root\s*{([\s\S]*?)}/)?.[1] || '';

  assert.match(rootTokens, /--utfpr-green:\s*#[0-9a-f]{6}/i);
  assert.match(rootTokens, /--utfpr-gold:\s*#[0-9a-f]{6}/i);
  assert.match(rootTokens, /--surface:\s*#(?:fff|ffffff)\b/i);
  assert.match(styles, /\.choice:has\(input:checked\)/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /@media\s*\(max-width:/);
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test('shows an accessible character count for the open priority response', () => {
  assert.match(page, /id="future-priority-hint"/);
  assert.match(page, /id="future-priority-counter"[^>]*aria-live="off"/);
  assert.match(page, /aria-describedby="future-priority-hint future-priority-counter"/);
});

test('choice groups use visible legends and labels associated with their controls', () => {
  for (const question of [3, 4, 5, 6, 7, 8, 10]) {
    const match = page.match(new RegExp(`<fieldset\\b[^>]*\\bid="q${question}"[^>]*>([\\s\\S]*?)<\\/fieldset>`));
    assert.ok(match, `question q${question} must use a fieldset`);
    const legend = match[1].match(/<legend\b[^>]*>([\s\S]*?)<\/legend>/);
    assert.ok(legend, `question q${question} needs a visible legend`);
    assert.ok(legend[1].replace(/<[^>]*>/g, '').trim());
    const labeledChoices = [...match[1].matchAll(/<label\b[^>]*>[\s\S]*?<input\b[^>]*type="(?:radio|checkbox)"[\s\S]*?<\/label>/g)];
    assert.ok(labeledChoices.length > 0, `question q${question} needs labeled native choices`);
  }
});

test('conditional questions preserve fixed numbering and clear only fields that no longer apply', () => {
  const context = loadClientHelpers();
  vm.runInContext(client, context);
  const { getConditionalVisibility, normalizeConditionalAnswers } = context;

  assert.equal(getConditionalVisibility({ usesAI: 'yes' }).activities, true);
  assert.equal(getConditionalVisibility({ usesAI: 'testing' }).activities, true);
  assert.equal(getConditionalVisibility({ usesAI: 'no' }).activities, false);
  assert.equal(getConditionalVisibility({ policyStatus: 'public' }).policyUrl, true);
  assert.equal(getConditionalVisibility({ policyStatus: 'private' }).policyUrl, false);
  assert.equal(getConditionalVisibility({ reviewerGuidance: 'restricted' }).reviewerRestrictions, true);

  const original = {
    usesAI: 'no', activities: ['translation'], toolsUsed: 'ChatGPT', otherActivity: 'tradução',
    policyStatus: 'private', policyUrl: 'https://example.org/policy',
    reviewerGuidance: 'unrestricted', reviewerRestrictions: ['declaration'],
    otherBenefit: 'Comentário aberto', benefits: ['efficiency']
  };
  const normalized = normalizeConditionalAnswers(original);
  assert.deepEqual(JSON.parse(JSON.stringify(normalized.activities)), []);
  assert.equal(normalized.toolsUsed, '');
  assert.equal(normalized.otherActivity, '');
  assert.equal(normalized.policyUrl, '');
  assert.deepEqual(JSON.parse(JSON.stringify(normalized.reviewerRestrictions)), []);
  assert.equal(normalized.otherBenefit, 'Comentário aberto');
  assert.equal(original.activities[0], 'translation');
  assert.equal(original.policyUrl, 'https://example.org/policy');
});

test('formats the open-response character count for Brazilian Portuguese', () => {
  const context = loadClientHelpers();
  vm.runInContext(client, context);
  assert.equal(context.formatCharacterCount('', 2000), '0 / 2.000 caracteres');
  assert.equal(context.formatCharacterCount('Edição', 2000), '6 / 2.000 caracteres');
});

test('maps only confirmed API success to success and uses safe text messages', () => {
  const context = loadClientHelpers();
  vm.runInContext(client, context);
  const { getSubmissionNotice } = context;

  assert.deepEqual(JSON.parse(JSON.stringify(getSubmissionNotice({ ok: true }))), {
    kind: 'success', message: 'Resposta registrada.'
  });
  assert.equal(getSubmissionNotice({ ok: false, message: 'private_key=secret' }).kind, 'error');
  assert.notEqual(getSubmissionNotice({ ok: false, message: 'private_key=secret' }).message, 'private_key=secret');
  assert.doesNotMatch(client, /\.innerHTML\s*=/);
  assert.match(client, /\.textContent\s*=/);
});
