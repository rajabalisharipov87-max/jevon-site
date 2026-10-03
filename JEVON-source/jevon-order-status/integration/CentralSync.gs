/** Bound to the JEVON central spreadsheet. All site imports originate here. */
const JEVON_CENTRAL_ID = '1lZoqtNusqap7_C7VbHvckOM6Mxt_bTQyheSfh1Ekeao';
const JEVON_SITE_IMPORT = 'https://jevon-order-status.rajabalisharipov87.chatgpt.site/api/import-orders';

function syncCentralOrders() {
  const central = SpreadsheetApp.openById(JEVON_CENTRAL_ID);
  const settings = central.getSheetByName('Настройки');
  const destination = central.getSheetByName('Заказы');
  if (!settings || !destination) throw new Error('Central spreadsheet tabs are missing.');
  const sourceUrl = String(settings.getRange('B3').getDisplayValue()).trim();
  const month = String(settings.getRange('B4').getDisplayValue()).trim();
  const match = sourceUrl.match(/\/spreadsheets\/d\/([\w-]+)/);
  if (!match || !month) throw new Error('Fill the monthly spreadsheet URL and month in Настройки!B3:B4.');
  const source = SpreadsheetApp.openById(match[1]);
  const existing = destination.getLastRow() > 2
    ? destination.getRange(3, 1, destination.getLastRow() - 2, 9).getDisplayValues() : [];
  const known = new Map(existing.map((row, index) => [row[0], index + 3]));
  const added = [], updated = [];
  ['Далер', 'Умед', 'Озод', 'Анвар'].forEach((person, groupIndex) => {
    const sheet = source.getSheetByName(person);
    if (!sheet) throw new Error('Monthly estimate is missing the tab ' + person);
    const count = sheet.getLastRow() - 3;
    if (count < 1) return;
    sheet.getRange(4, 2, count, 7).getDisplayValues().forEach(row => {
      const id = row[0].trim(), client = row[1].trim(), product = row[2].trim();
      if (!/^\d{2}\/[1-4]\d{2}$/.test(id) || Number(id.split('/')[1][0]) !== groupIndex + 1 ||
          !client || client === 'Клиент/телефон' || !product || product === 'Мебель') return;
      const record = [id, person, client, product, row[3], row[4], row[5], row[6], month];
      const targetRow = known.get(id);
      if (targetRow) {
        if (JSON.stringify(record) !== JSON.stringify(existing[targetRow - 3])) updated.push([targetRow, record]);
      } else {
        added.push(record);
        known.set(id, -1);
      }
    });
  });
  updated.forEach(([row, record]) => destination.getRange(row, 1, 1, 9).setValues([record]));
  if (added.length) destination.getRange(destination.getLastRow() + 1, 1, added.length, 9).setValues(added);
  SpreadsheetApp.flush();
  const all = destination.getLastRow() > 2 ? destination.getRange(3, 1, destination.getLastRow() - 2, 9).getDisplayValues() : [];
  const orders = all.filter(row => /^\d{2}\/[1-4]\d{2}$/.test(row[0]))
    .map(row => ({ id: row[0], constructor: row[1], client: row[2], product: row[3],
      created: row[4], materialDate: row[5], completed: row[6], shipped: row[7] }));
  const secret = PropertiesService.getScriptProperties().getProperty('JEVON_SYNC_KEY');
  if (!secret) throw new Error('Set JEVON_SYNC_KEY in Script properties.');
  const response = UrlFetchApp.fetch(JEVON_SITE_IMPORT, {
    method: 'post', contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + secret },
    payload: JSON.stringify({ spreadsheetId: JEVON_CENTRAL_ID, orders }), muteHttpExceptions: true,
  });
  if (response.getResponseCode() !== 200) throw new Error('Site import failed: ' + response.getResponseCode() + ' ' + response.getContentText());
  console.log('New: ' + added.length + ', updated: ' + updated.length + ', site: ' + response.getContentText());
}

function installCentralSync() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'syncCentralOrders')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('syncCentralOrders').timeBased().everyMinutes(5).create();
  syncCentralOrders();
}
