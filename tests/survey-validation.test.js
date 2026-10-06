const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAppsScript, validSubmission } = require('./apps-script-harness');

const { validateSubmission, buildResponseRow, SURVEY_HEADERS } = loadAppsScript(['Survey.gs']);

test('accepts a complete response using the approved options', () => {
  const result = validateSubmission(validSubmission());
  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
});

test('rejects an unknown policy status and a missing publisher', () => {
  const result = validateSubmission({ ...validSubmission(), publisher: ' ', policyStatus: 'invented' });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('publisher'));
  assert.ok(result.errors.includes('policyStatus'));
});

test('rejects malformed multi-select data and unknown selected options', () => {
  const malformed = validateSubmission({ ...validSubmission(), activities: 'translation' });
  const unknown = validateSubmission({ ...validSubmission(), benefits: ['invented'] });
  assert.equal(malformed.ok, false);
  assert.ok(malformed.errors.includes('activities'));
  assert.equal(unknown.ok, false);
  assert.ok(unknown.errors.includes('benefits'));
});

test('keeps none and unknown exclusive in multi-select answers', () => {
  const benefits = validateSubmission({ ...validSubmission(), benefits: ['none', 'efficiency'] });
  const concerns = validateSubmission({ ...validSubmission(), concerns: ['unknown', 'errors'] });
  assert.equal(benefits.ok, false);
  assert.equal(concerns.ok, false);
});

test('requires detail when other is selected and accepts only web policy links', () => {
  const missingDetail = validateSubmission({ ...validSubmission(), activities: ['other'], otherActivity: '' });
  const unsafeLink = validateSubmission({ ...validSubmission(), policyUrl: 'javascript:alert(1)' });
  assert.equal(missingDetail.ok, false);
  assert.ok(missingDetail.errors.includes('otherActivity'));
  assert.equal(unsafeLink.ok, false);
  assert.ok(unsafeLink.errors.includes('policyUrl'));
});

test('does not store activity answers when the publisher reports no AI use', () => {
  const payload = { ...validSubmission(), usesAI: 'no', activities: ['translation'] };
  assert.equal(validateSubmission(payload).ok, true);
  const row = buildResponseRow(payload, new Date('2026-10-06T12:00:00Z'), 'id-2');
  assert.equal(row[SURVEY_HEADERS.indexOf('Atividades')], '');
});

test('stores formula-like respondent text as literal text', () => {
  const row = buildResponseRow({ ...validSubmission(), publisher: '=2+2' }, new Date('2026-10-06T12:00:00Z'), 'id-1');
  assert.equal(row[2], "'=2+2");
});
