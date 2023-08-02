const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const { DateTime } = require('luxon');
const ServiceAccount = require('./service-account.json');

async function main(target, data) {
  const serviceAccountAuth = new JWT({
    email: process.env.GOOGLE_SHEET_EMAIL,
    key: ServiceAccount.private_key,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
    ],
  });

  const day = DateTime.fromFormat(target, 'yyyy-MM-dd').toFormat('MMM d, yyyy');
  const document = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);

  await document.loadInfo(); // loads document properties and worksheets

  const sheet = document.sheetsByTitle.Users;
  const rows = await sheet.getRows();
  const row = rows.find((r) => r.get('date') === day);
  if (row) {
    row.assign({
      ...data,
      tad: data.acd + data.atd,
      taw: data.acw + data.atw,
      tam: data.acm + data.atm,
      tcd: data.tccd + data.tctd,
      tcw: data.tccw + data.tctw,
      tcm: data.tccm + data.tctm,
    });
    await row.save();
  }
}

module.exports = main;
