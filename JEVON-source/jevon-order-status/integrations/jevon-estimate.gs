/** JEVON: перенос сохранённого раскроя в смету. */
const JEVON_BOOKS = { '10': '1Lea0_aXF2fKjLM04kUZvXIyY-FQBOPrJ7AJxukRaWV4' };

function doGet() {
  return reply_({ok:true, service:'JEVON estimate sync', version:1});
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const body = JSON.parse(e.postData.contents);
    const secret = PropertiesService.getScriptProperties().getProperty('JEVON_SYNC_SECRET');
    if (!secret || typeof body.secret !== 'string' || body.secret !== secret) return reply_({ok:false,error:'Доступ запрещён'});
    if (!lock.tryLock(20000)) return reply_({ok:false,error:'Смета занята. Повторите позже.'});
    const props = PropertiesService.getScriptProperties();
    const key = 'SYNC_REV_' + (body.order && body.order.id);
    if (!Number.isSafeInteger(body.revision) || body.revision <= 0) throw Error('Неверная версия раскроя');
    if (Number(props.getProperty(key) || 0) >= body.revision) return reply_({ok:true,orderId:body.order.id,stale:true});
    const result = transfer_(body);
    props.setProperty(key, String(body.revision));
    return reply_(result);
  } catch (err) {
    return reply_({ok:false,error:String(err.message || err)});
  } finally { if (lock.hasLock()) lock.releaseLock(); }
}

function reply_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function transfer_(body) {
  const order = body.order;
  if (!order || !/^\d{2}\/\d{3}$/.test(order.id) || !Array.isArray(body.positions) || body.positions.length > 100) throw Error('Неверные данные заказа');
  const bookId = JEVON_BOOKS[order.id.slice(0,2)];
  if (!bookId) throw Error('Не подключена смета месяца ' + order.id.slice(0,2));
  const book = SpreadsheetApp.openById(bookId);
  const sheet = book.getSheetByName(order.id);
  if (!sheet) throw Error('В таблице нет листа ' + order.id);
  if (sheet.getRange('E4').getDisplayValue() !== order.id) throw Error('Номер заказа в смете не совпадает');
  if (sheet.getRange('C11').getDisplayValue() !== 'Чертёж в Базисе' || !sheet.getRange('J26').getFormula()) throw Error('Структура сметы отличается от шаблона');
  const edits = new Map();
  const notes = new Map();
  const put = (cell, value) => edits.set(cell, value);
  const cleanText = v => String(v || '').trim().slice(0,240);
  put('E5', [cleanText(order.client), cleanText(order.phone)].filter(Boolean).join(' · '));
  put('E6', cleanText(order.product));
  put('L2', cleanText(order.constructor));
  put('H11', '');
  const groups = {cut:[12,13,14], edge:[15,16], drill:[17,18,19,20,21], other:[22,23,24], pack:[25]};
  Object.keys(groups).forEach(g => groups[g].forEach(r => {
    put('C'+r,''); put('G'+r,'');
    if (g !== 'drill') put('H'+r,'');
    notes.set('C'+r,'');
  }));
  const aliases = {
    'Распил ЛДСП 5м²':'Распил ДСП 5м²', 'Распил ЛДСП 6м²':'Распил ДСП 6м²',
    'Распил МДФ 3,4м²':'Распил МДФ', 'ЛДСП':'Распил ДСП 5м²', 'МДФ':'Распил МДФ', 'ХДФ':'Распил ХДФ',
    'Фрезеровка под петли':'Присадка под петли',
    'Присадка под евровинты':'Присадка под евровинты (1х2)',
    'Присадка под эксцентрики':'Присадка под эксцентрики (1х3)',
    'Присадка под шканты':'Присадка под шканты (1х2)',
    'Зенковка отверстий':'Зенковка', 'Паз под ЛХДФ':'Паз под ХДФ',
    'Фрезеровка неровных деталей':'Фрезеровка не ровных деталей',
    'Запил ЛДСП под 45 градусов':'Запил под 45 градусов', 'Запил МДФ под 45 градусов':'Запил под 45 градусов',
    'Упаковка стрейчплёнкой':'Упаковка стрейч-пленкой'
  };
  const entries=[];
  let drawing=0;
  body.positions.forEach(p => {
    if (typeof p.planned !== 'number' || !Number.isFinite(p.planned) || p.planned <= 0 || p.planned > 9999) throw Error('Неверное количество');
    if (p.type === 'Чертёж Базис Мебельщик') { drawing += p.planned; return; }
    let label = aliases[p.type] || p.type;
    if (/^Распил столешниц /.test(label)) label = label.replace('Распил столешниц ','Распил столещницы ');
    if (/^Кромкование овальных деталей /.test(label)) label = label.replace('Кромкование овальных деталей ','Кромкование овал и кривых деталей ');
    const group = Object.keys(groups).find(g => {
      const rule = sheet.getRange('C'+groups[g][0]).getDataValidation();
      return rule && rule.getCriteriaType() === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST && rule.getCriteriaValues()[0].includes(label);
    });
    if (!group) throw Error('Нет соответствия в смете: ' + p.type + '. Раскрой в сайте сохранён.');
    const description=cleanText(p.description), thickness=cleanText(p.thickness);
    const existing=entries.find(x => x.group===group && x.label===label && x.description===description && x.thickness===thickness);
    if (existing) existing.qty += p.planned;
    else entries.push({group,label,description,thickness,qty:p.planned});
  });
  put('H11',drawing || '');
  const used={};
  entries.forEach(x => {
    const index=used[x.group] || 0;
    const row=groups[x.group][index];
    if (!row) throw Error('Недостаточно строк в смете для: ' + x.group + '. Смета не изменена.');
    used[x.group]=index+1;
    put('C'+row,x.label);
    put((x.group==='drill'?'G':'H')+row,x.qty);
    if (x.group!=='drill') put('G'+row,[x.description,x.thickness ? x.thickness+' мм':''].filter(Boolean).join(' · '));
    notes.set('C'+row,x.description ? 'По раскрою: '+x.description:'');
  });
  const backup=[];
  edits.forEach((value,cell) => {
    const range=sheet.getRange(cell);
    if (range.getFormula()) throw Error('Защита формулы: '+cell);
    const rule=range.getDataValidation();
    if (value!=='' && rule && rule.getCriteriaType()===SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST && !rule.getCriteriaValues()[0].includes(value)) throw Error('Значение не разрешено: '+cell);
    backup.push({range,value:range.getValue(),note:range.getNote()});
  });
  try {
    edits.forEach((value,cell) => sheet.getRange(cell).setValue(typeof value==='string' && /^[=+@]/.test(value) ? "'"+value : value));
    notes.forEach((value,cell) => sheet.getRange(cell).setNote(value));
    SpreadsheetApp.flush();
    return {ok:true, orderId:order.id, spreadsheetId:bookId, sheetId:sheet.getSheetId(), total:sheet.getRange('J26').getValue(), positions:entries.length+(drawing?1:0)};
  } catch(err) {
    backup.forEach(x => {x.range.setValue(x.value);x.range.setNote(x.note);});
    SpreadsheetApp.flush();
    throw err;
  }
}
