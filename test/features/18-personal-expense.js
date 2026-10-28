// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: personal-expense.
/* ---------- Personal expense (CuePersonal.gs) ---------- */
const PE_HEAD = ['Date', 'Supplier / Payee', 'Amount (PHP)', 'Transaction Type', 'Sender Account', 'Type of Cost', 'Bank', 'Request ID', 'Project Name', 'Description',
  'Reference Number', 'Recipient Name (Original)', 'Recipient Account / Mobile', 'Service Fee (PHP)', 'Total Charged (PHP)', 'Invoice No.', 'Evidence Status',
  'Source Screenshot', 'OCR Confidence', 'Direction', 'Raw OCR / Captured Details', 'MONTH', 'MONTH NAME', 'Supporting Proof / Reference Links', 'Amount / Date Match Key'];
function gridSheet(rows, formulas) {
  const v = rows.map(r => r.slice()), f = (formulas || rows.map(() => [])).map(r => r.slice()), log = { formats: [], text: [] };
  const sh = { v, f, log, getLastRow: () => v.length, getLastColumn: () => v[0].length, getMaxRows: () => v.length + 5, insertRowsAfter: () => {},
    getRange: (r, c, nr = 1, nc = 1) => {
      const cells = (get) => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => get(r - 1 + i, c - 1 + j)));
      const put = (i, j, x, src) => { while (v.length <= i) v.push([]); while (f.length <= i) f.push([]); v[i][j] = x; f[i][j] = src || ''; };
      return { getValues: () => cells((i, j) => (v[i] && v[i][j] !== undefined ? v[i][j] : '')), getFormulas: () => cells((i, j) => (f[i] && f[i][j]) || ''),
        setValues: a => a.forEach((row, i) => row.forEach((x, j) => put(r - 1 + i, c - 1 + j, x))),
        setNumberFormat: fm => { log.text.push([r, c, fm]); },
        copyTo: (d, type) => { if (type === 'PASTE_FORMAT') return log.formats.push(r); for (let j = 0; j < nc; j++) { const src = f[r - 1][c - 1 + j]; if (src) d.__put(src); } },
        __put: src => put(r - 1, c - 1, '=' + src.replace(/^=/, '') + '@' + r, src) };
    } };
  return sh;
}
const PE_OLD = ['10/16/2026', 'MCDO 474 HOMEWORKS', 371, 'Merchant Payment', 'Not shown', 'Personal — Lunch', 'GCash', '', 'Personal Expense', 'Lunch', 'GCash: 784554821', '', '', '', 371, '', 'Successful', 'a.jpg', 'High', 'Outgoing', '', 10, 'October', '', '2026-10-16|371|784554821'];
const PE_ITEM = { date: '2026-10-21', time: '12:30 PM', payee: 'Jollibee Homeworks', principal: 250, fee: null, total: 250, txn_type: 'Merchant Payment', sender_account: '', bank: 'GCash',
  ref: '0012345678901', ref_kind: 'bank', recipient_name: 'Jollibee', recipient_account: '09171234567', invoice_no: 'OR 000123', evidence: 'paid_proof', direction: 'outgoing',
  cost_type: 'Personal — Food', description: 'Lunch', details: 'PHP250 sent', files: ['lunch.png'], confidence: 'High', unsure: false, unsure_why: '' };
function peBox(o = {}) {
  const t = sandbox(Object.assign({ props: { CUE_PERSONAL_FOLDER: 'pe-folder' }, allow: [] }, o, { personal: o.personal || { items: [PE_ITEM], notes: '' } }));   // allow: [] keeps Transfers direct (SH2 covers the bridge read)
  const pe = gridSheet([PE_HEAD, PE_OLD], [[], PE_HEAD.map(h => (h === 'MONTH' ? '=MONTH(A2)' : ''))]);
  const tr = gridSheet([['Request ID', 'CONFIRMATION NUMBER', 'PAID AMOUNT', 'Merchant Reference', 'Invoice Number'], ['AP-TEN-ANN-1', 'BN-555666777', 27450, '', '']]);
  const pr = gridSheet([['Amount', 'Request ID', 'Payee'], [1580, 'AP-HOS-1', 'Thirst GK Mobile Beverage Services']]);
  const cue = t.ctx.SpreadsheetApp.openById;
  t.ctx.SpreadsheetApp = { flush: () => {}, CopyPasteType: { PASTE_FORMAT: 'PASTE_FORMAT', PASTE_FORMULA: 'PASTE_FORMULA' },
    openById: id => id === '1w1W1KOwsDBXynNv9-_AFhvEyxqdyffgT4PVBGGSI_rQ' ? { getSheetByName: n => (n === 'Personal Expense 2' ? pe : null) }
      : id === '1Z9n6mrG_0kjzafkTxE_F9GzqU3IlQ0P388wV3wwny74' ? (o.bseFails ? (() => { throw new Error('no access'); })() : { getSheetByName: n => ({ Transfers: tr, 'Payment Request': pr })[n] || null }) : cue(id) };
  return Object.assign(t, { pe });
}
const PE_PNG = { name: 'lunch.png', type: 'image/png', data: Buffer.from('png-bytes').toString('base64') };
function peCard(o, text) { const t = peBox(o); const r = t.ctx.cueSend(text || 'personal expense, lunch today', [PE_PNG], ''); const v = t.ctx.cueRun(r.request_id); return Object.assign(t, { id: r.request_id, v }); }

test('PE1 "personal expense" routes to its own task: one GPT read with the image, no Canvas, card waits for Kiko', () => {
  const t = peCard();
  assert.strictEqual(t.v.kind, 'personal'); assert.strictEqual(t.v.status, 'Needs you'); assert.strictEqual(t.v.metrics.ai_calls, 1);
  assert.strictEqual(t.log.gpt.length, 1); assert.strictEqual(t.log.claude.length, 0); deq(t.log.bridge.map(b => b.action), ['allow_list'], 'no Canvas call but the allow-list read');
  assert.ok(JSON.stringify(t.log.gpt[0].input).indexOf('input_image') >= 0, 'GPT sees the proof');
  const x = t.v.personal.items[0]; assert.strictEqual(x.state, 'new'); assert.strictEqual(x.selected, true);
  assert.ok(t.tabs.Chat.rows.some(r => /Nothing is saved yet/.test(r[2])));
  assert.strictEqual(t.ctx.cueIsPersonal_('record this as personal please'), true);
  assert.strictEqual(t.ctx.cueIsPersonal_('Hi BSE, we need an LED wall for our personal assistant summit'), false);
});
test('PE2 checks: duplicate reference, Transfers reference (project), own-wallet top-up and receipt-only are set apart', () => {
  const items = [Object.assign({}, PE_ITEM, { ref: '784554821', payee: 'MCDO again' }), Object.assign({}, PE_ITEM, { ref: 'BN-555666777', payee: 'Tent City' }),
    Object.assign({}, PE_ITEM, { ref: '99887766', direction: 'internal', txn_type: 'Internal Transfer', payee: 'Kiko GCash' }),
    Object.assign({}, PE_ITEM, { ref: '', evidence: 'receipt_only', payee: 'Lalamove', date: '2026-10-20' }),
    Object.assign({}, PE_ITEM, { ref: '', payee: 'Thirst GK', recipient_name: '', total: 1580, principal: 1580, date: '2026-10-19' })];
  const v = peCard({ personal: { items, notes: '' } }).v.personal.items;
  deq(v.map(x => [x.state, x.selected]), [['duplicate', false], ['project', false], ['not_expense', false], ['evidence', true], ['project', false]]);
  assert.strictEqual(v[0].row, 2); assert.strictEqual(v[1].request_id, 'AP-TEN-ANN-1'); assert.strictEqual(v[4].request_id, 'AP-HOS-1');
});
test('PE3 GPT unsure: Claude looks again with the same image (2 AI calls) and its reading replaces only that item', () => {
  const unsure = Object.assign({}, PE_ITEM, { unsure: true, unsure_why: 'blurry total', total: 2500 });
  const t = peCard({ personal: { items: [unsure], notes: '' }, cost: { items: [Object.assign({}, PE_ITEM, { total: 250 })], notes: '' } });
  assert.strictEqual(t.v.metrics.ai_calls, 2); assert.strictEqual(t.log.claude.length, 1);
  const c = t.log.claude[0].messages[0].content; assert.ok(Array.isArray(c) && c[0].type === 'image' && c[0].source.media_type === 'image/png');
  const x = t.v.personal.items[0]; assert.strictEqual(x.total, 250); assert.strictEqual(x.checked, true);
});
test('PE4 approve: one row after the last, formulas kept, references as text, proof moved to My Drive, read back, summary', () => {
  const t = peCard();
  const d = t.ctx.cueApprove(t.id, { items: { 0: { description: 'Lunch with Joy', fee: '' } } });
  assert.strictEqual(d.status, 'Done'); const x = d.personal.items[0];
  assert.strictEqual(x.saved_row, 3); assert.strictEqual(x.verified, true);
  const row = t.pe.v[2], col = h => PE_HEAD.indexOf(h);
  assert.strictEqual(row[col('Supplier / Payee')], 'Jollibee Homeworks'); assert.strictEqual(row[col('Description')], 'Lunch with Joy');
  assert.strictEqual(row[col('Reference Number')], 'GCash: 0012345678901'); assert.strictEqual(row[col('Recipient Account / Mobile')], '09171234567');
  assert.strictEqual(row[col('Service Fee (PHP)')], '', 'unknown fee stays blank'); assert.strictEqual(row[col('Total Charged (PHP)')], 250);
  assert.strictEqual(t.pe.f[2][col('MONTH')], '=MONTH(A2)', 'formula column copied, not overwritten');
  assert.ok(t.pe.log.text.some(e => e[0] === 3 && e[1] === col('Reference Number') + 1 && e[2] === '@'));
  assert.ok(/^https:\/\/drive\.google\.com\/file\/d\/f1\/view$/.test(row[col('Supporting Proof / Reference Links')]));
  assert.ok(/pe-folder&removeParents=folder-1/.test(t.drive.parent.f1), 'moved from Cue uploads into the proofs folder');
  deq(t.log.bridge.map(b => b.action), ['allow_list'], 'no Canvas write'); assert.strictEqual(t.log.gmail.length, 0);
  assert.ok(t.tabs.Chat.rows.some(r => /^Summary for Personal expense: Jollibee Homeworks: saved 1 row to Personal Expense 2 \(row 3\)/.test(r[2]) && r[3] === '>' + t.id));
});
test('PE5 never a second row: approving again is refused, and a reference saved meanwhile is not written', () => {
  const t = peCard();
  t.ctx.cueApprove(t.id, {}); assert.throws(() => t.ctx.cueApprove(t.id, {}), /cannot be saved now/); assert.strictEqual(t.pe.v.length, 3);
  const u = peCard(); u.pe.v.push(PE_OLD.map((c, i) => (i === PE_HEAD.indexOf('Reference Number') ? 'GCash: 0012345678901' : c)));
  const d = u.ctx.cueApprove(u.id, {}); assert.strictEqual(d.status, 'Done, not all saved'); assert.strictEqual(u.pe.v.length, 3);
  assert.ok(/already in the sheet/.test(d.personal.items[0].save_error));
});
test('PE6 edits: untick leaves nothing to save; a bad amount is refused before anything is written', () => {
  const t = peCard();
  assert.throws(() => t.ctx.cueApprove(t.id, { items: { 0: { selected: false } } }), /Tick at least one/);
  assert.throws(() => t.ctx.cueApprove(t.id, { items: { 0: { selected: true, total: 'abc' } } }), /must be a number/);
  assert.strictEqual(t.pe.v.length, 2);
});
test('PE7 BSE sheet unreadable: Kiko is told to check it; receipt-only rows carry no paid amount', () => {
  const t = peCard({ bseFails: true, personal: { items: [Object.assign({}, PE_ITEM, { evidence: 'receipt_only' })], notes: '' } });
  assert.ok(t.v.notes.some(n => /Could not open BSE Scopes and Transfers/.test(n)));
  t.ctx.cueApprove(t.id, {}); const row = t.pe.v[2];
  assert.strictEqual(row[PE_HEAD.indexOf('Amount (PHP)')], ''); assert.strictEqual(row[PE_HEAD.indexOf('Total Charged (PHP)')], '');
  assert.strictEqual(row[PE_HEAD.indexOf('Direction')], 'Evidence only');
});

test('PE8 same day and amount: a payment with no reference is "maybe recorded"; two different references are not duplicates', () => {
  const items = [Object.assign({}, PE_ITEM, { ref: '', payee: 'MCDO 474', date: '2026-10-16', total: 371, principal: 371 }),
    Object.assign({}, PE_ITEM, { ref: '5550001112', payee: 'MCDO 474', date: '2026-10-16', total: 371, principal: 371 })];
  const v = peCard({ personal: { items, notes: '' } }).v.personal.items;
  deq(v.map(x => [x.state, x.selected]), [['maybe_duplicate', false], ['new', true]]);
});
