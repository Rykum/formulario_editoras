const { google } = require('googleapis');

function createSheetsAppender(googleClient = google) {
  return async function appendResponseRow(row, env = process.env) {
    const spreadsheetId = env.GOOGLE_SHEETS_ID;
    const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const configuredKey = env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

    if (!spreadsheetId || !email || !configuredKey) {
      throw new Error('Google Sheets service configuration is incomplete.');
    }
    if (!Array.isArray(row) || row.length !== 19 || row.some((cell) => typeof cell !== 'string')) {
      throw new Error('A response row must contain nineteen string values.');
    }

    const auth = new googleClient.auth.JWT({
      email,
      key: configuredKey.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const sheets = googleClient.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Respostas!A:S',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] }
    });
  };
}

const appendResponseRow = createSheetsAppender();

module.exports = { appendResponseRow, createSheetsAppender };
