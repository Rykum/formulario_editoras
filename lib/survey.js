const SURVEY_OPTIONS = Object.freeze({
  usesAI: ['yes', 'testing', 'no', 'unknown'],
  activities: ['writing', 'revision', 'translation', 'summaries-metadata', 'images-layout', 'accessibility', 'originality', 'editorial-support', 'communication', 'other'],
  policyStatus: ['public', 'private', 'developing', 'none', 'unknown'],
  reviewerGuidance: ['prohibited', 'restricted', 'unrestricted', 'none', 'unknown'],
  reviewerRestrictions: ['declaration', 'confidentiality', 'other'],
  benefits: ['efficiency', 'revision', 'translation', 'accessibility', 'dissemination', 'cost-reduction', 'other', 'none', 'unknown'],
  concerns: ['copyright-plagiarism', 'errors', 'confidentiality-data', 'authorship-quality', 'technology-dependence', 'undisclosed-use', 'other', 'none', 'unknown'],
  allowIdentification: ['yes', 'no']
});

const SURVEY_TEXT_LIMITS = Object.freeze({
  publisher: 200,
  institution: 200,
  toolsUsed: 1000,
  policyUrl: 2048,
  otherActivity: 500,
  otherRestriction: 500,
  otherBenefit: 500,
  otherConcern: 500,
  futurePriority: 2000
});

const SURVEY_HEADERS = Object.freeze([
  'ID', 'Enviado em', 'Editora', 'Instituição', 'Uso de IA', 'Atividades',
  'Outra atividade', 'Política formal', 'Link da política',
  'Orientação para pareceristas', 'Restrições para pareceristas',
  'Outra restrição', 'Benefícios', 'Outro benefício', 'Preocupações',
  'Outra preocupação', 'Prioridade futura', 'Autoriza identificação',
  'Ferramentas de IA utilizadas ou avaliadas'
]);

function sanitizeCellText(value) {
  const text = String(value == null ? '' : value).trim();
  return /^[-=+@]/.test(text) ? "'" + text : text;
}

function addSurveyError(errors, field) {
  if (!errors.includes(field)) errors.push(field);
}

function validateBoundedText(payload, field, required, errors) {
  const value = payload[field];
  if (value == null || value === '') {
    if (required) addSurveyError(errors, field);
    return;
  }
  if (typeof value !== 'string' || value.length > SURVEY_TEXT_LIMITS[field]) {
    addSurveyError(errors, field);
    return;
  }
  if (required && !value.trim()) addSurveyError(errors, field);
}

function validateSingleChoice(data, field, required, errors) {
  const value = data[field];
  if (value == null || value === '') {
    if (required) addSurveyError(errors, field);
    return '';
  }
  if (typeof value !== 'string' || !SURVEY_OPTIONS[field].includes(value)) {
    addSurveyError(errors, field);
    return '';
  }
  return value;
}

function validateMultiChoice(data, field, errors) {
  const value = data[field];
  if (value == null) return [];
  if (!Array.isArray(value)) {
    addSurveyError(errors, field);
    return [];
  }

  const seen = new Set();
  for (const option of value) {
    if (typeof option !== 'string' || !SURVEY_OPTIONS[field].includes(option) || seen.has(option)) {
      addSurveyError(errors, field);
      return [];
    }
    seen.add(option);
  }
  return value;
}

function validateOtherDetail(data, selectedValues, field, errors) {
  if (!selectedValues.includes('other')) return;
  if (typeof data[field] !== 'string' || !data[field].trim()) addSurveyError(errors, field);
}

function validateExclusiveChoices(values, field, errors) {
  if ((values.includes('none') || values.includes('unknown')) && values.length > 1) {
    addSurveyError(errors, field);
  }
}

function isHttpUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value.trim());
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function validateSubmission(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, errors: ['payload'] };
  }

  for (const field of Object.keys(SURVEY_TEXT_LIMITS)) {
    validateBoundedText(payload, field, field === 'publisher' || field === 'institution', errors);
  }

  const usesAI = validateSingleChoice(payload, 'usesAI', true, errors);
  const policyStatus = validateSingleChoice(payload, 'policyStatus', true, errors);
  const reviewerGuidance = validateSingleChoice(payload, 'reviewerGuidance', true, errors);
  validateSingleChoice(payload, 'allowIdentification', true, errors);

  const activities = validateMultiChoice(payload, 'activities', errors);
  if (usesAI === 'yes' || usesAI === 'testing') {
    validateOtherDetail(payload, activities, 'otherActivity', errors);
  }

  if (policyStatus === 'public' && payload.policyUrl != null && payload.policyUrl !== '' && !isHttpUrl(payload.policyUrl)) {
    addSurveyError(errors, 'policyUrl');
  }

  const restrictions = validateMultiChoice(payload, 'reviewerRestrictions', errors);
  if (reviewerGuidance === 'restricted') {
    validateOtherDetail(payload, restrictions, 'otherRestriction', errors);
  }

  const benefits = validateMultiChoice(payload, 'benefits', errors);
  validateExclusiveChoices(benefits, 'benefits', errors);

  const concerns = validateMultiChoice(payload, 'concerns', errors);
  validateExclusiveChoices(concerns, 'concerns', errors);

  return { ok: errors.length === 0, errors };
}

function normalizeSubmission(payload) {
  const normalized = { ...(payload || {}) };
  const usesAI = normalized.usesAI === 'yes' || normalized.usesAI === 'testing';
  const publicPolicy = normalized.policyStatus === 'public';
  const restrictedReview = normalized.reviewerGuidance === 'restricted';

  if (!usesAI) {
    normalized.activities = [];
    normalized.otherActivity = '';
    normalized.toolsUsed = '';
  } else {
    normalized.activities = Array.isArray(normalized.activities) ? [...normalized.activities] : [];
    if (!normalized.activities.includes('other')) normalized.otherActivity = '';
  }

  if (!publicPolicy) normalized.policyUrl = '';

  if (!restrictedReview) {
    normalized.reviewerRestrictions = [];
    normalized.otherRestriction = '';
  } else {
    normalized.reviewerRestrictions = Array.isArray(normalized.reviewerRestrictions)
      ? [...normalized.reviewerRestrictions]
      : [];
    if (!normalized.reviewerRestrictions.includes('other')) normalized.otherRestriction = '';
  }

  normalized.benefits = Array.isArray(normalized.benefits) ? [...normalized.benefits] : [];
  normalized.concerns = Array.isArray(normalized.concerns) ? [...normalized.concerns] : [];
  return normalized;
}

function safeSelections(values) {
  return Array.isArray(values) ? values.map(sanitizeCellText).join('; ') : '';
}

function buildResponseRow(payload, submittedAt, responseId) {
  const data = normalizeSubmission(payload || {});
  const activitiesVisible = data.usesAI === 'yes' || data.usesAI === 'testing';
  const publicPolicy = data.policyStatus === 'public';
  const restrictionsVisible = data.reviewerGuidance === 'restricted';
  const timestamp = submittedAt instanceof Date ? submittedAt.toISOString() : String(submittedAt || '');

  return [
    sanitizeCellText(responseId),
    timestamp,
    sanitizeCellText(data.publisher),
    sanitizeCellText(data.institution),
    sanitizeCellText(data.usesAI),
    activitiesVisible ? safeSelections(data.activities) : '',
    activitiesVisible && data.activities.includes('other') ? sanitizeCellText(data.otherActivity) : '',
    sanitizeCellText(data.policyStatus),
    publicPolicy ? sanitizeCellText(data.policyUrl) : '',
    sanitizeCellText(data.reviewerGuidance),
    restrictionsVisible ? safeSelections(data.reviewerRestrictions) : '',
    restrictionsVisible && data.reviewerRestrictions.includes('other') ? sanitizeCellText(data.otherRestriction) : '',
    safeSelections(data.benefits),
    sanitizeCellText(data.otherBenefit),
    safeSelections(data.concerns),
    sanitizeCellText(data.otherConcern),
    sanitizeCellText(data.futurePriority),
    sanitizeCellText(data.allowIdentification),
    activitiesVisible ? sanitizeCellText(data.toolsUsed) : ''
  ];
}

module.exports = {
  SURVEY_HEADERS,
  validateSubmission,
  normalizeSubmission,
  sanitizeCellText,
  buildResponseRow
};
