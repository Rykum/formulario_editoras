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

function cssVariable(name) {
  const rootTokens = styles.match(/:root\s*{([\s\S]*?)}/)?.[1] || '';
  return rootTokens.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1] || '';
}

function cssRule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return styles.match(new RegExp(`(?:^|\\n)${escaped}\\s*{([^}]*)}`, 'i'))?.[1] || '';
}

function contrastRatio(foreground, background) {
  const luminance = (hex) => {
    const channels = hex.slice(1).match(/../g).map((channel) => Number.parseInt(channel, 16) / 255);
    const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
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

test('uses UTFPR black, yellow, and white with readable text contrast', () => {
  assert.equal(cssVariable('utfpr-black').toUpperCase(), '#333333');
  assert.equal(cssVariable('utfpr-yellow').toUpperCase(), '#FFC814');
  assert.equal(cssVariable('surface').toUpperCase(), '#FFFFFF');
  assert.equal(cssVariable('focus-ring').toUpperCase(), '#333333');
  assert.ok(contrastRatio(cssVariable('utfpr-black'), cssVariable('surface')) >= 4.5);
  assert.ok(contrastRatio(cssVariable('utfpr-black'), cssVariable('utfpr-yellow')) >= 4.5);
  assert.ok(contrastRatio(cssVariable('utfpr-yellow'), cssVariable('utfpr-black')) >= 4.5);
  assert.ok(contrastRatio(cssVariable('focus-ring'), cssVariable('surface')) >= 4.5);
  assert.match(page, /<meta name="theme-color" content="#FFC814">/i);
});

test('styles the research team as a horizontal UTFPR badge', () => {
  const badge = cssRule('.research-team');
  const names = cssRule('.research-team strong');
  const roles = cssRule('.research-team p span');

  assert.match(badge, /display:\s*flex/);
  assert.match(badge, /background:\s*var\(--utfpr-black\)/);
  assert.match(badge, /border-left:\s*4px solid var\(--utfpr-yellow\)/);
  assert.match(names, /color:\s*#fff/i);
  assert.match(roles, /color:\s*var\(--utfpr-yellow\)/);
});

test('styles the institutional tag as a softly raised white rectangle', () => {
  const label = cssRule('.header-label');

  assert.match(label, /border-radius:\s*1[0-2]px/);
  assert.match(label, /background:\s*var\(--surface\)/);
  assert.match(label, /box-shadow:/);
  assert.match(label, /color:\s*var\(--utfpr-black\)/);
});

test('places a thin yellow outline just behind the white survey form', () => {
  const form = cssRule('.form-shell');
  const outline = cssRule('.form-shell::before');

  assert.match(form, /isolation:\s*isolate/);
  assert.match(outline, /position:\s*absolute/);
  assert.match(outline, /inset:\s*\d+px\s+-\d+px\s+-\d+px\s+\d+px/);
  assert.match(outline, /border:\s*1px solid var\(--utfpr-yellow\)/);
  assert.match(outline, /pointer-events:\s*none/);
});

test('keeps interactive choices, keyboard focus, responsive layout, and reduced-motion support', () => {
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
