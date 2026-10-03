/** JEVON: synchronizes filled orders from the September estimate to the order site. */
const JEVON_SOURCE_ID = '1R9eqLVv7ngPeokjTdim3MXz4zxJA5fmQMVZxZsvPfsk';
const JEVON_IMPORT_URL = 'https://jevon-order-status.rajabalisharipov87.chatgpt.site/api/import-orders';

function syncOrdersToJevon() {
  const key = PropertiesService.getScriptProperties().getProperty('JEVON_SYNC_KEY');
  if (!key) throw new Error('Set JEVON_SYNC_KEY in Script properties first.');
  const spreadsheet = SpreadsheetApp.openById(JEVON_SOURCE_ID);
  const orders = [];
  ['Далер', 'Умед', 'Озод', 'Анвар'].forEach(name => {
    const sheet = spreadsheet.getSheetByName(name);
    if (!sheet) throw new Error('Missing constructor tab: ' + name);
    const last = sheet.getLastRow();
    if (last < 4) return;
    const rows = sheet.getRange(4, 2, last - 3, 7).getDisplayValues();
    rows.forEach(row => {
      const id = row[0].trim(), client = row[1].trim(), product = row[2].trim();
      if (!/^\d{2}\/[1-4]\d{2}$/.test(id) || !client || client === 'Клиент/телефон' || !product || product === 'Мебель') return;
      if (['Далер', 'Умед', 'Озод', 'Анвар'][Number(id.split('/')[1][0]) - 1] !== name) return;
      orders.push({ id, client, product, created: row[3], materialDate: row[4], completed: row[5], shipped: row[6], constructor: name });
    });
  });
  const response = UrlFetchApp.fetch(JEVON_IMPORT_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + key },
    payload: JSON.stringify({ spreadsheetId: JEVON_SOURCE_ID, orders }),
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() !== 200) throw new Error('JEVON sync failed: HTTP ' + response.getResponseCode() + ' ' + response.getContentText());
  console.log('Orders checked: ' + orders.length + '. ' + response.getContentText());
}

function installJevonSync() {
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === 'syncOrdersToJevon')
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger('syncOrdersToJevon').timeBased().everyMinutes(5).create();
  syncOrdersToJevon();
}
