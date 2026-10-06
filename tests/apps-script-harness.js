const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function validSubmission(overrides = {}) {
  return {
    publisher: 'Editora Aurora', institution: 'Universidade Aurora',
    usesAI: 'yes', activities: ['translation'], otherActivity: '',
    policyStatus: 'public', policyUrl: 'https://example.org/policy',
    reviewerGuidance: 'restricted', reviewerRestrictions: ['confidentiality'], otherRestriction: '',
    benefits: ['efficiency'], otherBenefit: '', concerns: ['errors'], otherConcern: '',
    futurePriority: 'Capacitação editorial', allowIdentification: 'no', website: '',
    ...overrides
  };
}

function loadAppsScript(files) {
  const context = vm.createContext({ console });
  for (const file of files) {
    const filePath = path.join(__dirname, '..', 'apps-script', file);
    if (!fs.existsSync(filePath)) continue;
    vm.runInContext(fs.readFileSync(filePath, 'utf8'), context, { filename: filePath });
  }
  for (const name of ['SURVEY_OPTIONS', 'SURVEY_HEADERS']) {
    if (vm.runInContext(`typeof ${name} !== 'undefined'`, context)) {
      context[name] = vm.runInContext(name, context);
    }
  }
  return context;
}

module.exports = { loadAppsScript, validSubmission };
