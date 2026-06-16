const { google } = require('googleapis');

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function getAuthUrl() {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/calendar',
    ],
  });
}

async function getTokensFromCode(code) {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  return tokens;
}

async function getUserInfo(accessToken) {
  const client = getOAuthClient();
  client.setCredentials({ access_token: accessToken });
  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const { data } = await oauth2.userinfo.get();
  return data;
}

function getSheetsClient(tokens) {
  const client = getOAuthClient();
  client.setCredentials(tokens);
  return google.sheets({ version: 'v4', auth: client });
}

function getDriveClient(tokens) {
  const client = getOAuthClient();
  client.setCredentials(tokens);
  return google.drive({ version: 'v3', auth: client });
}

function getCalendarClient(tokens) {
  const client = getOAuthClient();
  client.setCredentials(tokens);
  return google.calendar({ version: 'v3', auth: client });
}

module.exports = {
  getAuthUrl,
  getTokensFromCode,
  getUserInfo,
  getSheetsClient,
  getDriveClient,
  getCalendarClient,
};
