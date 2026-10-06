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

function createAppsScriptServices() {
  const properties = new Map();
  const sheet = {
    name: 'Sheet1', rows: [], appendCount: 0, frozenRows: 0,
    filterCreated: false, lastSortSpec: null,
    setName(name) { this.name = name; return this; },
    getName() { return this.name; },
    setFrozenRows(count) { this.frozenRows = count; },
    getLastRow() { return this.rows.length; },
    getLastColumn() { return this.rows[0] ? this.rows[0].length : 0; },
    appendRow(row) { this.rows.push(row.slice()); this.appendCount += 1; },
    getRange(startRow, startColumn, rowCount = 1, columnCount = 1) {
      const currentSheet = this;
      return {
        setValues(values) {
          for (let rowOffset = 0; rowOffset < rowCount; rowOffset += 1) {
            const rowIndex = startRow - 1 + rowOffset;
            if (!currentSheet.rows[rowIndex]) currentSheet.rows[rowIndex] = [];
            for (let columnOffset = 0; columnOffset < columnCount; columnOffset += 1) {
              currentSheet.rows[rowIndex][startColumn - 1 + columnOffset] = values[rowOffset][columnOffset];
            }
          }
          return this;
        },
        createFilter() { currentSheet.filterCreated = true; return this; },
        sort(spec) {
          currentSheet.lastSortSpec = spec;
          const start = startRow - 1;
          const segment = currentSheet.rows.slice(start, start + rowCount);
          segment.sort((left, right) => {
            for (const rule of spec) {
              const a = left[rule.column - 1];
              const b = right[rule.column - 1];
              const aTime = a && typeof a.getTime === 'function' ? a.getTime() : Date.parse(a);
              const bTime = b && typeof b.getTime === 'function' ? b.getTime() : Date.parse(b);
              const isDate = !Number.isNaN(aTime) && !Number.isNaN(bTime) && a && b && typeof a.getTime === 'function' && typeof b.getTime === 'function';
              const comparison = isDate ? aTime - bTime : String(a ?? '').localeCompare(String(b ?? ''));
              if (comparison !== 0) return rule.ascending ? comparison : -comparison;
            }
            return 0;
          });
          currentSheet.rows.splice(start, segment.length, ...segment);
          return this;
        }
      };
    }
  };

  const spreadsheet = {
    name: '',
    getId() { return 'spreadsheet-test-id'; },
    getUrl() { return 'https://docs.google.com/spreadsheets/d/spreadsheet-test-id/edit'; },
    getSheets() { return [sheet]; },
    getSheetByName(name) { return sheet.name === name ? sheet : null; }
  };
  const lock = {
    waitCount: 0, releaseCount: 0, lastTimeout: null,
    waitLock(timeout) { this.waitCount += 1; this.lastTimeout = timeout; },
    releaseLock() { this.releaseCount += 1; }
  };
  const scriptProperties = {
    getProperty(key) { return properties.has(key) ? properties.get(key) : null; },
    setProperty(key, value) { properties.set(key, value); return this; }
  };
  let createCount = 0;
  let uuidCount = 0;
  const htmlService = {
    lastTemplate: '', lastPartial: '',
    createTemplateFromFile(name) {
      this.lastTemplate = name;
      return { evaluate() { return { title: '', setTitle(title) { this.title = title; return this; } }; } };
    },
    createHtmlOutputFromFile(name) {
      this.lastPartial = name;
      return { getContent() { return `<!-- ${name} -->`; } };
    }
  };
  const services = {
    sheet,
    lock,
    properties: scriptProperties,
    htmlService,
    spreadsheet,
    spreadsheetApp: {
      create(name) { createCount += 1; spreadsheet.name = name; return spreadsheet; },
      openById(id) {
        if (id !== spreadsheet.getId()) throw new Error('Planilha não encontrada.');
        return spreadsheet;
      },
      getCreateCount() { return createCount; }
    },
    utilities: { getUuid() { uuidCount += 1; return `response-${uuidCount}`; } }
  };
  return services;
}

function loadAppsScript(files) {
  const services = createAppsScriptServices();
  const context = vm.createContext({
    console,
    sheet: services.sheet,
    lock: services.lock,
    PropertiesService: { getScriptProperties: () => services.properties },
    SpreadsheetApp: services.spreadsheetApp,
    LockService: { getScriptLock: () => services.lock },
    Utilities: services.utilities,
    HtmlService: services.htmlService
  });
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
  context.sheet = services.sheet;
  context.lock = services.lock;
  context.properties = services.properties;
  context.spreadsheet = services.spreadsheet;
  context.spreadsheetApp = services.spreadsheetApp;
  context.htmlService = services.htmlService;
  return context;
}

module.exports = { loadAppsScript, validSubmission };
