const SURVEY_OPTIONS = {
  usesAI: ['yes', 'testing', 'no', 'unknown'],
  activities: ['writing', 'revision', 'translation', 'summaries-metadata', 'images-layout', 'accessibility', 'originality', 'editorial-support', 'communication', 'other'],
  policyStatus: ['public', 'private', 'developing', 'none', 'unknown'],
  reviewerGuidance: ['prohibited', 'restricted', 'unrestricted', 'none', 'unknown'],
  reviewerRestrictions: ['declaration', 'confidentiality', 'other'],
  benefits: ['efficiency', 'revision', 'translation', 'accessibility', 'dissemination', 'cost-reduction', 'other', 'none', 'unknown'],
  concerns: ['copyright-plagiarism', 'errors', 'confidentiality-data', 'authorship-quality', 'technology-dependence', 'undisclosed-use', 'other', 'none', 'unknown'],
  allowIdentification: ['yes', 'no']
};

const SURVEY_HEADERS = [
  'ID', 'Enviado em', 'Editora', 'Instituição', 'Uso de IA', 'Atividades',
  'Outra atividade', 'Política formal', 'Link da política',
  'Orientação para pareceristas', 'Restrições para pareceristas',
  'Outra restrição', 'Benefícios', 'Outro benefício', 'Preocupações',
  'Outra preocupação', 'Prioridade futura', 'Autoriza identificação'
];

function sanitizeCellText(value) {
  const text = String(value == null ? '' : value).trim();
  return /^[-=+@]/.test(text) ? "'" + text : text;
}

function addSurveyError(errors, field) {
  if (errors.indexOf(field) === -1) errors.push(field);
}

function isSurveyText(value) {
  return typeof value === 'string';
}

function validateSingleChoice(data, field, required, errors) {
  const value = data[field];
  if (value == null || value === '') {
    if (required) addSurveyError(errors, field);
    return '';
  }
  if (typeof value !== 'string' || SURVEY_OPTIONS[field].indexOf(value) === -1) {
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

  const seen = {};
  for (let i = 0; i < value.length; i += 1) {
    const option = value[i];
    if (typeof option !== 'string' || SURVEY_OPTIONS[field].indexOf(option) === -1 || seen[option]) {
      addSurveyError(errors, field);
      return [];
    }
    seen[option] = true;
  }
  return value;
}

function validateOtherDetail(data, selectedValues, field, errors) {
  if (selectedValues.indexOf('other') === -1) return;
  if (!isSurveyText(data[field]) || !data[field].trim()) addSurveyError(errors, field);
}

function validateExclusiveChoices(values, field, errors) {
  if ((values.indexOf('none') !== -1 || values.indexOf('unknown') !== -1) && values.length > 1) {
    addSurveyError(errors, field);
  }
}

function isHttpUrl(value) {
  if (!isSurveyText(value) || !value.trim()) return false;
  return /^https?:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\d{1,5})?(?:[/?#][^\s]*)?$/i.test(value.trim());
}

function validateSubmission(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, errors: ['payload'] };
  }

  ['publisher', 'institution'].forEach(function(field) {
    if (!isSurveyText(payload[field]) || !payload[field].trim()) addSurveyError(errors, field);
  });

  const usesAI = validateSingleChoice(payload, 'usesAI', true, errors);
  const policyStatus = validateSingleChoice(payload, 'policyStatus', true, errors);
  const reviewerGuidance = validateSingleChoice(payload, 'reviewerGuidance', true, errors);
  validateSingleChoice(payload, 'allowIdentification', true, errors);

  let activities = [];
  if (usesAI === 'yes' || usesAI === 'testing') {
    activities = validateMultiChoice(payload, 'activities', errors);
    validateOtherDetail(payload, activities, 'otherActivity', errors);
  }

  if (policyStatus === 'public' && payload.policyUrl != null && payload.policyUrl !== '' && !isHttpUrl(payload.policyUrl)) {
    addSurveyError(errors, 'policyUrl');
  }

  if (reviewerGuidance === 'restricted') {
    const restrictions = validateMultiChoice(payload, 'reviewerRestrictions', errors);
    validateOtherDetail(payload, restrictions, 'otherRestriction', errors);
  }

  const benefits = validateMultiChoice(payload, 'benefits', errors);
  validateExclusiveChoices(benefits, 'benefits', errors);
  validateOtherDetail(payload, benefits, 'otherBenefit', errors);

  const concerns = validateMultiChoice(payload, 'concerns', errors);
  validateExclusiveChoices(concerns, 'concerns', errors);
  validateOtherDetail(payload, concerns, 'otherConcern', errors);

  if (payload.futurePriority != null && !isSurveyText(payload.futurePriority)) {
    addSurveyError(errors, 'futurePriority');
  } else if (isSurveyText(payload.futurePriority) && payload.futurePriority.length > 2000) {
    addSurveyError(errors, 'futurePriority');
  }

  return { ok: errors.length === 0, errors: errors };
}

function safeSurveyOption(value) {
  return sanitizeCellText(value);
}

function safeSurveySelections(values) {
  if (!Array.isArray(values)) return '';
  return values.map(safeSurveyOption).join('; ');
}

function buildResponseRow(payload, submittedAt, responseId) {
  const data = payload || {};
  const usesAI = data.usesAI;
  const policyStatus = data.policyStatus;
  const reviewerGuidance = data.reviewerGuidance;
  const activitiesVisible = usesAI === 'yes' || usesAI === 'testing';
  const publicPolicy = policyStatus === 'public';
  const restrictionsVisible = reviewerGuidance === 'restricted';
  const activities = activitiesVisible && Array.isArray(data.activities) ? data.activities : [];
  const restrictions = restrictionsVisible && Array.isArray(data.reviewerRestrictions) ? data.reviewerRestrictions : [];
  const benefits = Array.isArray(data.benefits) ? data.benefits : [];
  const concerns = Array.isArray(data.concerns) ? data.concerns : [];

  return [
    responseId,
    submittedAt,
    sanitizeCellText(data.publisher),
    sanitizeCellText(data.institution),
    sanitizeCellText(usesAI),
    safeSurveySelections(activities),
    activitiesVisible && activities.indexOf('other') !== -1 ? sanitizeCellText(data.otherActivity) : '',
    sanitizeCellText(policyStatus),
    publicPolicy ? sanitizeCellText(data.policyUrl) : '',
    sanitizeCellText(reviewerGuidance),
    safeSurveySelections(restrictions),
    restrictionsVisible && restrictions.indexOf('other') !== -1 ? sanitizeCellText(data.otherRestriction) : '',
    safeSurveySelections(benefits),
    benefits.indexOf('other') !== -1 ? sanitizeCellText(data.otherBenefit) : '',
    safeSurveySelections(concerns),
    concerns.indexOf('other') !== -1 ? sanitizeCellText(data.otherConcern) : '',
    sanitizeCellText(data.futurePriority),
    sanitizeCellText(data.allowIdentification)
  ];
}
