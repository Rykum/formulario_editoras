const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

test('contains exactly ten stable, numbered question groups', () => {
  const groups = [...html.matchAll(/id="q(\d+)"/g)].map((match) => Number(match[1]));
  assert.deepEqual(groups, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

  const numbers = [...html.matchAll(/class="question-number">(\d{2})</g)].map((match) => match[1]);
  assert.deepEqual(numbers, ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10']);
});

test('keeps activity and tool details inside q4 with a visible non-applicable state', () => {
  const q4 = html.match(/<fieldset\b[^>]*id="q4"[^>]*>([\s\S]*?)<\/fieldset>/);
  assert.ok(q4, 'q4 must be a semantic fieldset');
  assert.match(q4[1], /name="activities"/);
  assert.match(q4[1], /name="toolsUsed"/);
  assert.match(q4[1], /id="q4-not-applicable"[^>]*hidden[^>]*>Não se aplica conforme a resposta anterior\./);
  assert.match(q4[1], /id="q4-controls"/);
});

test('uses accessible choice grouping and does not depend on Apps Script', () => {
  assert.match(html, /<fieldset\b/);
  assert.match(html, /<legend\b[^>]*>/);
  assert.doesNotMatch(html, /google\.script\.run|<\?!= include/);
  assert.match(html, /<script\b[^>]*src="(?:\/|\.\/)client\.js"/);
});

test('uses the official local UTFPR mark on the responsive black, yellow, and white palette', () => {
  const logoPath = path.join(root, 'public', 'utfpr-logo.png');
  const logo = fs.readFileSync(logoPath);
  assert.deepEqual([...logo.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.match(html, /<img\b[^>]*class="brand-logo"[^>]*src="\/public\/utfpr-logo\.png"[^>]*alt="UTFPR/);
  assert.match(styles, /--utfpr-black:\s*#[0-9a-f]{6}/i);
  assert.match(styles, /--utfpr-yellow:\s*#[0-9a-f]{6}/i);
  assert.match(styles, /@media\s*\(max-width:/);
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});
