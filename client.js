function getConditionalVisibility(answers) {
  const response = answers || {};
  return {
    activities: response.usesAI === 'yes' || response.usesAI === 'testing',
    policyUrl: response.policyStatus === 'public',
    reviewerRestrictions: response.reviewerGuidance === 'restricted'
  };
}

function normalizeConditionalAnswers(answers) {
  const normalized = { ...(answers || {}) };
  const visibility = getConditionalVisibility(normalized);

  if (!visibility.activities) {
    normalized.activities = [];
    normalized.otherActivity = '';
    normalized.toolsUsed = '';
  } else if (!Array.isArray(normalized.activities)) {
    normalized.activities = [];
  }
  if (!normalized.activities.includes('other')) normalized.otherActivity = '';

  if (!visibility.policyUrl) normalized.policyUrl = '';

  if (!visibility.reviewerRestrictions) {
    normalized.reviewerRestrictions = [];
    normalized.otherRestriction = '';
  } else if (!Array.isArray(normalized.reviewerRestrictions)) {
    normalized.reviewerRestrictions = [];
  }
  if (!normalized.reviewerRestrictions.includes('other')) normalized.otherRestriction = '';

  if (!Array.isArray(normalized.benefits)) normalized.benefits = [];
  if (!normalized.benefits.includes('other')) normalized.otherBenefit = '';
  if (!Array.isArray(normalized.concerns)) normalized.concerns = [];
  if (!normalized.concerns.includes('other')) normalized.otherConcern = '';
  return normalized;
}

function formatCharacterCount(value, maxLength) {
  const count = String(value || '').length;
  const limit = Number(maxLength) || 0;
  return count.toLocaleString('pt-BR') + ' / ' + limit.toLocaleString('pt-BR') + ' caracteres';
}

function serializeSurveyForm(form) {
  const formData = new FormData(form);
  return {
    publisher: formData.get('publisher') || '',
    institution: formData.get('institution') || '',
    usesAI: formData.get('usesAI') || '',
    toolsUsed: formData.get('toolsUsed') || '',
    activities: formData.getAll('activities'),
    otherActivity: formData.get('otherActivity') || '',
    policyStatus: formData.get('policyStatus') || '',
    policyUrl: formData.get('policyUrl') || '',
    reviewerGuidance: formData.get('reviewerGuidance') || '',
    reviewerRestrictions: formData.getAll('reviewerRestrictions'),
    otherRestriction: formData.get('otherRestriction') || '',
    benefits: formData.getAll('benefits'),
    otherBenefit: formData.get('otherBenefit') || '',
    concerns: formData.getAll('concerns'),
    otherConcern: formData.get('otherConcern') || '',
    futurePriority: formData.get('futurePriority') || '',
    allowIdentification: formData.get('allowIdentification') || '',
    website: formData.get('website') || ''
  };
}

function clearConditionalControls(element) {
  element.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach((control) => {
    control.checked = false;
  });
  element.querySelectorAll('input[type="text"], input[type="url"], textarea').forEach((control) => {
    control.value = '';
    if (control.name === 'otherBenefit' || control.name === 'otherConcern') control.required = false;
  });
}

function setConditionalVisibility(element, visible) {
  if (!element) return;
  element.hidden = !visible;
  if (!visible) clearConditionalControls(element);
}

function isChoiceSelected(form, name, value) {
  return Boolean(form.querySelector('input[name="' + name + '"][value="' + value + '"]:checked'));
}

function updateOtherDetail(form, name, fieldId) {
  const field = form.querySelector('#' + fieldId);
  const otherSelected = isChoiceSelected(form, name, 'other');
  setConditionalVisibility(field, otherSelected);
  const textInput = field && field.querySelector('input, textarea');
  if (textInput) textInput.required = otherSelected;
}

function updateOpenAnswerRequirement(form, name, choiceName, choiceValue) {
  const field = form.querySelector('[name="' + name + '"]');
  if (field) field.required = isChoiceSelected(form, choiceName, choiceValue);
}

function enforceExclusiveSelection(control) {
  if (!control.checked || (control.name !== 'benefits' && control.name !== 'concerns')) return;
  const group = control.form.querySelectorAll('input[name="' + control.name + '"]');
  const isExclusive = control.value === 'none' || control.value === 'unknown';
  group.forEach((peer) => {
    if (peer !== control && (isExclusive || peer.value === 'none' || peer.value === 'unknown')) peer.checked = false;
  });
}

function updateSurveyConditionals(form) {
  const answers = {
    usesAI: (form.querySelector('input[name="usesAI"]:checked') || {}).value || '',
    policyStatus: (form.querySelector('input[name="policyStatus"]:checked') || {}).value || '',
    reviewerGuidance: (form.querySelector('input[name="reviewerGuidance"]:checked') || {}).value || ''
  };
  const visibility = getConditionalVisibility(answers);
  const q4Controls = form.querySelector('#q4-controls');
  const q4Prerequisite = form.querySelector('#q4-prerequisite');
  const q4NotApplicable = form.querySelector('#q4-not-applicable');
  if (q4Controls) {
    q4Controls.hidden = !visibility.activities;
    if (!visibility.activities) clearConditionalControls(q4Controls);
  }
  if (q4Prerequisite) q4Prerequisite.hidden = Boolean(answers.usesAI);
  if (q4NotApplicable) q4NotApplicable.hidden = visibility.activities || !answers.usesAI;

  setConditionalVisibility(form.querySelector('#policy-url-field'), visibility.policyUrl);
  setConditionalVisibility(form.querySelector('#reviewer-restrictions'), visibility.reviewerRestrictions);
  updateOtherDetail(form, 'activities', 'other-activity-field');
  updateOtherDetail(form, 'reviewerRestrictions', 'other-restriction-field');
  updateOpenAnswerRequirement(form, 'otherBenefit', 'benefits', 'other');
  updateOpenAnswerRequirement(form, 'otherConcern', 'concerns', 'other');
}

function initializeSurveyForm() {
  const form = document.getElementById('survey-form');
  if (!form) return;

  const priorityField = form.querySelector('#future-priority');
  const priorityCounter = form.querySelector('#future-priority-counter');
  const updatePriorityCounter = () => {
    if (!priorityField || !priorityCounter) return;
    priorityCounter.textContent = formatCharacterCount(priorityField.value, priorityField.maxLength);
  };

  if (priorityField && priorityCounter) {
    priorityField.addEventListener('input', updatePriorityCounter);
    updatePriorityCounter();
  }

  form.addEventListener('change', (event) => {
    enforceExclusiveSelection(event.target);
    updateSurveyConditionals(form);
  });

  updateSurveyConditionals(form);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSurveyForm);
  } else {
    initializeSurveyForm();
  }
}
