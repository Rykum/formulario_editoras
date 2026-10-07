const test = require('node:test');
const assert = require('node:assert/strict');

const {
  SURVEY_HEADERS,
  validateSubmission,
  normalizeSubmission,
  sanitizeCellText,
  buildResponseRow
} = require('../lib/survey');

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

test('normalizes hidden activity and reviewer fields without mutating the submitted payload', () => {
  const input = validPayload({
    activities: ['translation'],
    otherActivity: 'stale activity detail',
    toolsUsed: 'stale tool',
    policyStatus: 'private',
    policyUrl: 'https://example.org/policy',
    reviewerGuidance: 'unrestricted',
    reviewerRestrictions: ['declaration'],
    otherRestriction: 'stale restriction',
    benefits: ['efficiency'],
    otherBenefit: 'stale benefit',
    concerns: ['errors'],
    otherConcern: 'stale concern'
  });

  const normalized = normalizeSubmission(input);

  assert.deepEqual(normalized.activities, []);
  assert.equal(normalized.otherActivity, '');
  assert.equal(normalized.toolsUsed, '');
  assert.equal(normalized.policyUrl, '');
  assert.deepEqual(normalized.reviewerRestrictions, []);
  assert.equal(normalized.otherRestriction, '');
  assert.equal(normalized.otherBenefit, 'stale benefit');
  assert.equal(normalized.otherConcern, 'stale concern');
  assert.deepEqual(input.activities, ['translation']);
  assert.equal(input.toolsUsed, 'stale tool');
});

test('preserves open benefit and concern text even when the respondent does not select other', () => {
  const payload = validPayload({
    benefits: ['efficiency'],
    otherBenefit: 'Comentário sobre agilidade',
    concerns: ['errors'],
    otherConcern: 'Comentário sobre revisão humana'
  });
  const normalized = normalizeSubmission(payload);
  const row = buildResponseRow(payload, '2026-10-07T12:00:00.000Z', 'open-text-id');

  assert.equal(normalized.otherBenefit, 'Comentário sobre agilidade');
  assert.equal(normalized.otherConcern, 'Comentário sobre revisão humana');
  assert.equal(row[13], 'Comentário sobre agilidade');
  assert.equal(row[15], 'Comentário sobre revisão humana');
});

test('requires details for selected other activity and reviewer restriction', () => {
  const missingActivityDetail = validateSubmission(validPayload({
    usesAI: 'yes',
    activities: ['other']
  }));
  const missingRestrictionDetail = validateSubmission(validPayload({
    reviewerGuidance: 'restricted',
    reviewerRestrictions: ['other']
  }));

  assert.equal(missingActivityDetail.ok, false);
  assert.ok(missingActivityDetail.errors.includes('otherActivity'));
  assert.equal(missingRestrictionDetail.ok, false);
  assert.ok(missingRestrictionDetail.errors.includes('otherRestriction'));
});

test('rejects invalid single choices, duplicate selections, and contradictory exclusive options', () => {
  assert.equal(validateSubmission(validPayload({ usesAI: 'sometimes' })).ok, false);
  assert.equal(validateSubmission(validPayload({ activities: ['writing', 'writing'] })).ok, false);
  assert.equal(validateSubmission(validPayload({ benefits: ['none', 'efficiency'] })).ok, false);
  assert.equal(validateSubmission(validPayload({ concerns: ['unknown', 'errors'] })).ok, false);
});

test('rejects missing required identity and malformed public policy links', () => {
  assert.equal(validateSubmission(validPayload({ publisher: '  ' })).ok, false);
  assert.equal(validateSubmission(validPayload({ institution: '' })).ok, false);
  assert.equal(validateSubmission(validPayload({ policyStatus: 'public', policyUrl: 'javascript:alert(1)' })).ok, false);
});

test('enforces every existing response text limit', () => {
  const limits = [
    ['publisher', 200],
    ['institution', 200],
    ['toolsUsed', 1000],
    ['policyUrl', 2048],
    ['otherActivity', 500],
    ['otherRestriction', 500],
    ['otherBenefit', 500],
    ['otherConcern', 500],
    ['futurePriority', 2000]
  ];

  for (const [field, limit] of limits) {
    const payload = validPayload({ [field]: 'x'.repeat(limit + 1) });
    const result = validateSubmission(payload);
    assert.equal(result.ok, false, `${field} should reject ${limit + 1} characters`);
    assert.ok(result.errors.includes(field), `${field} should be named in validation errors`);
  }
});

test('writes a compatible nineteen-column row and protects formula-leading text', () => {
  const payload = validPayload({
    publisher: '=Editora Exemplo',
    institution: 'Universidade Exemplo',
    usesAI: 'yes',
    toolsUsed: 'ChatGPT',
    activities: ['revision', 'translation'],
    policyStatus: 'public',
    policyUrl: 'https://example.org/policy',
    reviewerGuidance: 'restricted',
    reviewerRestrictions: ['declaration', 'other'],
    otherRestriction: 'Não inserir originais',
    benefits: ['efficiency', 'other'],
    otherBenefit: 'Mais agilidade',
    concerns: ['copyright-plagiarism', 'other'],
    otherConcern: 'Uso sem transparência',
    futurePriority: '+capacitação',
    allowIdentification: 'yes'
  });
  const timestamp = '2026-10-07T12:00:00.000Z';
  const row = buildResponseRow(payload, timestamp, 'response-id');

  assert.equal(SURVEY_HEADERS.length, 19);
  assert.deepEqual(SURVEY_HEADERS, [
    'ID', 'Enviado em', 'Editora', 'Instituição', 'Uso de IA', 'Atividades',
    'Outra atividade', 'Política formal', 'Link da política',
    'Orientação para pareceristas', 'Restrições para pareceristas',
    'Outra restrição', 'Benefícios', 'Outro benefício', 'Preocupações',
    'Outra preocupação', 'Prioridade futura', 'Autoriza identificação',
    'Ferramentas de IA utilizadas ou avaliadas'
  ]);
  assert.deepEqual(row, [
    'response-id', timestamp, "'=Editora Exemplo", 'Universidade Exemplo', 'yes',
    'revision; translation', '', 'public', 'https://example.org/policy',
    'restricted', 'declaration; other', 'Não inserir originais',
    'efficiency; other', 'Mais agilidade', 'copyright-plagiarism; other',
    'Uso sem transparência', "'+capacitação", 'yes', 'ChatGPT'
  ]);
  assert.equal(sanitizeCellText('  @SHEET  '), "'@SHEET");
});
