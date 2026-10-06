const SPREADSHEET_NAME = 'Pesquisa sobre IA nas editoras universitárias';
const RESPONSE_SHEET_NAME = 'Respostas';
const SPREADSHEET_PROPERTY = 'SPREADSHEET_ID';

function setupSurveySpreadsheet() {
  const properties = PropertiesService.getScriptProperties();
  const savedId = properties.getProperty(SPREADSHEET_PROPERTY);
  let spreadsheet;

  if (savedId) {
    spreadsheet = SpreadsheetApp.openById(savedId);
    if (!spreadsheet.getSheetByName(RESPONSE_SHEET_NAME)) {
      throw new Error('A aba de respostas não foi encontrada.');
    }
    return { spreadsheetId: savedId, url: spreadsheet.getUrl() };
  }

  spreadsheet = SpreadsheetApp.create(SPREADSHEET_NAME);
  const sheet = spreadsheet.getSheets()[0];
  sheet.setName(RESPONSE_SHEET_NAME);
  sheet.getRange(1, 1, 1, SURVEY_HEADERS.length).setValues([SURVEY_HEADERS]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, SURVEY_HEADERS.length).createFilter();
  properties.setProperty(SPREADSHEET_PROPERTY, spreadsheet.getId());

  return { spreadsheetId: spreadsheet.getId(), url: spreadsheet.getUrl() };
}

function getResponseSheet() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_PROPERTY);
  if (!spreadsheetId) throw new Error('A planilha ainda não foi configurada.');
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheet = spreadsheet.getSheetByName(RESPONSE_SHEET_NAME);
  if (!sheet) throw new Error('A aba de respostas não foi encontrada.');
  return sheet;
}

function submitResponse(payload) {
  if (payload && payload.website) {
    return { ok: false, message: 'Não foi possível validar o envio.' };
  }

  const validation = validateSubmission(payload || {});
  if (!validation.ok) return { ok: false, message: 'Revise os campos destacados.' };

  const lock = LockService.getScriptLock();
  let lockAcquired = false;
  try {
    lock.waitLock(30000);
    lockAcquired = true;
    const sheet = getResponseSheet();
    sheet.appendRow(buildResponseRow(payload, new Date(), Utilities.getUuid()));
    const count = sheet.getLastRow() - 1;
    if (count > 1) {
      sheet.getRange(2, 1, count, SURVEY_HEADERS.length).sort([
        { column: 3, ascending: true },
        { column: 2, ascending: false }
      ]);
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
