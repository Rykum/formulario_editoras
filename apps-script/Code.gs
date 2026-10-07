const SPREADSHEET_NAME = 'Pesquisa sobre IA nas editoras universitárias';
const RESPONSE_SHEET_NAME = 'Respostas';
const SPREADSHEET_PROPERTY = 'SPREADSHEET_ID';
const SUBMISSION_COOLDOWN_SECONDS = 3600;

function setupSurveySpreadsheet() {
  const properties = PropertiesService.getScriptProperties();
  const savedId = properties.getProperty(SPREADSHEET_PROPERTY);
  let spreadsheet;

  if (savedId) {
    spreadsheet = SpreadsheetApp.openById(savedId);
    const existingSheet = spreadsheet.getSheetByName(RESPONSE_SHEET_NAME);
    if (!existingSheet) {
      throw new Error('A aba de respostas não foi encontrada.');
    }
    ensureSurveyHeaders(existingSheet);
    const existing = { spreadsheetId: savedId, url: spreadsheet.getUrl() };
    Logger.log('URL da planilha de respostas: ' + existing.url);
    return existing;
  }

  spreadsheet = SpreadsheetApp.create(SPREADSHEET_NAME);
  const sheet = spreadsheet.getSheets()[0];
  sheet.setName(RESPONSE_SHEET_NAME);
  sheet.getRange(1, 1, 1, SURVEY_HEADERS.length).setValues([SURVEY_HEADERS]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, SURVEY_HEADERS.length).createFilter();
  properties.setProperty(SPREADSHEET_PROPERTY, spreadsheet.getId());

  const result = { spreadsheetId: spreadsheet.getId(), url: spreadsheet.getUrl() };
  Logger.log('URL da planilha de respostas: ' + result.url);
  return result;
}

function getResponseSheet() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_PROPERTY);
  if (!spreadsheetId) throw new Error('A planilha ainda não foi configurada.');
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheet = spreadsheet.getSheetByName(RESPONSE_SHEET_NAME);
  if (!sheet) throw new Error('A aba de respostas não foi encontrada.');
  ensureSurveyHeaders(sheet);
  return sheet;
}

function ensureSurveyHeaders(sheet) {
  const lastColumn = sheet.getLastColumn();
  const existingHeaders = lastColumn > 0
    ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0]
    : [];
  const missingHeaders = SURVEY_HEADERS.filter(function(header) {
    return existingHeaders.indexOf(header) === -1;
  });

  if (missingHeaders.length > 0) {
    sheet.getRange(1, lastColumn + 1, 1, missingHeaders.length).setValues([missingHeaders]);
  }

  const targetColumns = Math.max(lastColumn + missingHeaders.length, SURVEY_HEADERS.length);
  const currentFilter = sheet.getFilter();
  if (!currentFilter || currentFilter.getRange().getNumColumns() < targetColumns) {
    if (currentFilter) currentFilter.remove();
    sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), targetColumns).createFilter();
  }
}

function submitResponse(payload) {
  if (payload && payload.website) {
    return { ok: false, message: 'Não foi possível validar o envio.' };
  }

  const validation = validateSubmission(payload || {});
  if (!validation.ok) return { ok: false, message: 'Revise os campos destacados.' };

  const activeUserKey = Session.getTemporaryActiveUserKey();
  if (typeof activeUserKey !== 'string' || !activeUserKey.trim() || activeUserKey.length > 200) {
    return { ok: false, message: 'Não foi possível validar o envio. Atualize a página e tente novamente.' };
  }
  const cacheKey = 'survey-submission:' + activeUserKey;

  const lock = LockService.getScriptLock();
  let lockAcquired = false;
  try {
    lock.waitLock(30000);
    lockAcquired = true;
    const cache = CacheService.getScriptCache();
    if (cache.get(cacheKey)) {
      return { ok: false, message: 'Você já enviou uma resposta recentemente. Aguarde antes de tentar novamente.' };
    }

    const sheet = getResponseSheet();
    sheet.appendRow(buildResponseRow(payload, new Date(), Utilities.getUuid()));
    const count = sheet.getLastRow() - 1;
    if (count > 1) {
      try {
        sheet.getRange(2, 1, count, SURVEY_HEADERS.length).sort([
          { column: 3, ascending: true },
          { column: 2, ascending: false }
        ]);
      } catch (sortError) {
        Logger.log('A resposta foi registrada, mas a ordenação da planilha falhou.');
      }
    }
    try {
      cache.put(cacheKey, '1', SUBMISSION_COOLDOWN_SECONDS);
    } catch (cacheError) {
      Logger.log('A resposta foi registrada, mas o limite temporário de envios não foi aplicado.');
    }
    return { ok: true, message: 'Resposta registrada.' };
  } catch (error) {
    return { ok: false, message: 'Não foi possível registrar a resposta. Tente novamente.' };
  } finally {
    if (lockAcquired) lock.releaseLock();
  }
}

function doGet() {
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('Pesquisa sobre IA nas editoras universitárias');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
