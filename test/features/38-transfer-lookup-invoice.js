// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: transfer-lookup-invoice.
// ---------- CUE-LOOKUP-2026-10-27: Transfer lookup (read only) and Invoice line edit (CueLookup.gs) ----------
const TX_TR = [['Request ID', 'Bank', 'Account Name', 'Account Number', 'Status', 'PAYMENT DATE', 'CONFIRMATION NUMBER', 'PAID AMOUNT', 'Merchant Reference'],
  ['AP-ACJ-ADM-1', 'GCash', 'JO•••N D.', '09171112222', 'Paid', '10/05/2026', '7045788032198', '1,200.00', ''],
  ['AP-SU-TRI-1', 'GCash', 'SU••••E M.', '09173334444', 'Paid', '10/12/2026', '7046033873147', '3,120.00', ''],
  ['AP-MID-TRI-1', 'BDO Pay', 'SHELL MIDPOINT', '000111222', 'Paid', '10/12/2026', 'QR-PAY2-17917678-84017993', '1,000.00', ''],
  ['AP-CUP-TRI-1', 'Cash', '', '', 'Paid', '', '', '1,200.00', '']];
const TX_PR = [['Request ID', 'Category', "Supplier's Name", 'Payee', 'Cost Item', 'Amount', 'Payment Date Required', 'Event Name'],
  ['AP-SU-TRI-1', 'Costumes', 'Sue M', 'Sue M', 'Costume rental', 3120, '2026-10-12', 'Trick or Treat - Manila'],
  ['AP-CUP-TRI-1', 'Cups', 'Unidentified supplier — cups (cash)', 'Divisoria', 'Cups — PHP1200 paid cash per Kiko', 1200, '2026-10-12', 'Trick or Treat - Manila']];
function txBox(o = {}, tr) {
  const t = sandbox(Object.assign({ allow: [] }, o)), cue = t.ctx.SpreadsheetApp.openById, T = gridSheet(tr || TX_TR), P = gridSheet(TX_PR);
  t.ctx.cueNow_ = () => Date.parse('2026-10-27T08:50:00Z');
  t.ctx.SpreadsheetApp = Object.assign({}, t.ctx.SpreadsheetApp, { openById: id => id === '1Z9n6mrG_0kjzafkTxE_F9GzqU3IlQ0P388wV3wwny74'
    ? (o.bseFails ? (() => { throw new Error('no access'); })() : { getSheetByName: n => ({ Transfers: T, 'Payment Request': P })[n] || null }) : cue(id) });
  return t;
}
const lastCue = t => t.tabs.Chat.rows.slice(-1)[0][2];
test('LK1 "is there a gcash transfer for Cups that day": no AI call, no Canvas call; none from 9 to 15 Oct, cash stands; same-day transfers listed; no account numbers', () => {
  const t = txBox(); t.ctx.cueSend('i did pay cash is there a gcash transfer for that day with the same amount for Cups');
  assert.strictEqual(t.log.gpt.length + t.log.claude.length, 0, 'no AI call');
  deq(t.log.bridge.map(b => b.action), ['allow_list'], 'no Canvas call but the allow-list read (CUE-STRUCTURE-4.4)');
  const a = lastCue(t);
  assert.ok(/^No GCash transfer of ₱1,200\.00 from 9 Oct to 15 Oct\. Cash stands\./.test(a), a);
  assert.ok(/AP-CUP-TRI-1 · Cups · Trick or Treat - Manila · ₱1,200\.00 · 12 Oct · Cash/.test(a), a);
  assert.ok(/AP-SU-TRI-1 · GCash SU••••E M\. · 12 Oct · 7046033873147 · ₱3,120\.00/.test(a), 'the GCash transfers that day');
  assert.ok(!/SHELL/.test(a), 'GCash only, as asked');
  assert.ok(/AP-ACJ-ADM-1 .*\(same amount, other day and payee\)/.test(a), 'the 5 Oct ₱1,200 is named, never as a match');
  assert.ok(!/0917|000111222/.test(a), 'no account numbers'); assert.ok(/Read only\. Nothing was changed\./.test(a));
});
test('LK2 same amount in the window is shown as same amount only; a reference finds its row; no amount asks; an unreadable sheet says so', () => {
  const tr = TX_TR.concat([['AP-ZZZ-TRI-1', 'GCash', 'MA•••A O.', '0917', 'Paid', '10/13/2026', '7046999000111', '1,200.00', '']]);
  let t = txBox({}, tr); t.ctx.cueSend('any transfer of 1,200 for AP-CUP-TRI-1?');
  assert.ok(/^Found 1 transfer of ₱1,200\.00 from 9 Oct to 15 Oct\. Same amount only: check the payee/.test(lastCue(t)) && /AP-ZZZ-TRI-1/.test(lastCue(t)), lastCue(t));
  t = txBox(); t.ctx.cueSend('find transfer 7046033873147');
  assert.ok(/^Found 1 transfer with reference 7046033873147:\n- AP-SU-TRI-1/.test(lastCue(t)), lastCue(t));
  t = txBox(); t.ctx.cueSend('is there a gcash transfer for the thing?');
  assert.ok(/^Which payment\?/.test(lastCue(t)), lastCue(t));
  t = txBox({ bseFails: true }); t.ctx.cueSend('any gcash transfer of 1,200 on 12 Oct?');
  assert.ok(/^I could not open BSE Scopes and Transfers \(no access\)/.test(lastCue(t)));
  t = txBox(); const n = t.log.gpt.length; t.ctx.cueSend('send the transfer form to Ana'); assert.strictEqual(t.log.gpt.length, n + 1, 'no lookup word: the chat call handles it');
});
const BI_LIST = { projects: [{ project_id: 'S-25506500TR', name: 'Trick or Treat - Manila', account: 'Telus', score: 3, bis: [],
  pos: [{ no: 'PO-00000-10208316', description: 'PO dated August 27, 2026; payment terms: Net 30.', line_item: 'ToT Manila', billed: false }] },
  { project_id: 'S-11200574TE', name: 'Telus Q2 Leadership Connect', account: 'Telus', score: 1, bis: [{ no: '0013', status: 'Invoicing', po_no: 'PO-00000-10209008', description: 'REC-10301903 for PO-10209008', pdf: 'https://x', locked: '' }], pos: [] }] };
const invAsk = t => t.tabs.Chat.rows.filter(r => /^\?ask-/.test(String(r[3]))).pop();
const invId = t => /^\?(ask-[0-9a-z]+):/.exec(invAsk(t)[3])[1];
test('IL1 "add REC-10307792 to the Telus trick or treat invoice": bi_list read, an Approve card, nothing written before Approve; Approve writes the PO line once', () => {
  const t = txBox(); t.ctx.cueSend('can you update the invoice for Telus trick or treat and add the REC number REC-10307792. it has to show in the invoice when printed');
  assert.strictEqual(t.log.gpt.length + t.log.claude.length, 0, 'no AI call');
  deq(t.log.biList, [{ query: 'telus trick or treat' }]);
  const q = invAsk(t); assert.ok(/:approve,not$/.test(q[3]), q[3]);
  assert.ok(/^Put this line on Trick or Treat - Manila's invoice\?\nREC-10307792 for PO-00000-10208316\nWhere: no invoice yet, so on PO PO-00000-10208316, which New invoice copies/.test(q[2]), q[2]);
  assert.ok(/Description becomes: REC-10307792 for PO-00000-10208316\. PO dated August 27/.test(q[2]));
  assert.ok(!t.log.invLines, 'nothing written before Approve');
  t.ctx.cueAskPick(invId(t), 'approve');
  deq(t.log.invLines, [{ pid: 'S-25506500TR', args: { line: 'REC-10307792 for PO-00000-10208316', po_no: 'PO-00000-10208316' } }]);
  assert.ok(/^Saved on PO PO-00000-10208316\. Trick or Treat - Manila's invoice will print "REC-10307792 for PO-00000-10208316" under "Purchase Order #"/.test(lastCue(t)), lastCue(t));
  assert.throws(() => t.ctx.cueAskPick(invId(t), 'approve'), /already answered/);
  const u = txBox(); u.ctx.cueSend('add REC-10307792 to the Telus trick or treat invoice'); u.ctx.cueAskPick(invId(u), 'not');
  assert.ok(!u.log.invLines && /not added/.test(lastCue(u)));
});
test('IL2 an open BI takes the line; a locked BI, two open BIs, a tie and a refusal each stop with the reason', () => {
  const one = { projects: [{ project_id: 'S-11200574TE', name: 'Telus Q2 Leadership Connect', account: 'Telus', score: 2, pos: [],
    bis: [{ no: '0013', status: 'Invoicing', po_no: 'PO-00000-10209008', description: 'Old text', pdf: 'https://x', locked: '' }] }] };
  let t = txBox({ bis: one }); t.ctx.cueSend('add REC-1234567 to the Telus leadership connect invoice');
  assert.ok(/Where: BI 0013 \(Invoicing\)/.test(invAsk(t)[2]) && /The saved PDF keeps the old text/.test(invAsk(t)[2]));
  t.ctx.cueAskPick(invId(t), 'approve');
  deq(t.log.invLines[0].args, { line: 'REC-1234567 for PO-00000-10209008', bi_no: '0013' });
  assert.ok(/^Saved\. BI 0013's Description now starts with "REC-1234567 for PO-00000-10209008"\. Its saved PDF still has the old text/.test(lastCue(t)));
  const locked = JSON.parse(JSON.stringify(one)); locked.projects[0].bis[0].locked = 'BI 0013 is Paid, so it can\'t be edited.';
  t = txBox({ bis: locked }); t.ctx.cueSend('add REC-1234567 to the Telus leadership connect invoice');
  assert.ok(/locked \(BI 0013: BI 0013 is Paid/.test(lastCue(t)) && !invAsk(t));
  const two = JSON.parse(JSON.stringify(one)); two.projects[0].bis.push({ no: '0014', status: 'Invoicing', po_no: '', description: '', locked: '' });
  t = txBox({ bis: two }); t.ctx.cueSend('add REC-1234567 to the Telus leadership connect invoice');
  assert.ok(/has 2 open invoices \(BI 0013, BI 0014\)/.test(lastCue(t)));
  t.ctx.cueSend('add REC-1234567 to BI 14 for Telus leadership connect invoice');
  assert.ok(/Where: BI 0014/.test(invAsk(t)[2]), invAsk(t)[2]);
  const tie = JSON.parse(JSON.stringify(BI_LIST)); tie.projects[1].score = 3;
  t = txBox({ bis: tie }); t.ctx.cueSend('add REC-10307792 to the Telus invoice'); assert.ok(/^Which one\?/.test(lastCue(t)));
  t = txBox({ invRefused: 'BI 0013 has payment advice on PA row 9, so it can\'t be edited. Nothing was saved.' });
  t.ctx.cueSend('add REC-10307792 to the Telus trick or treat invoice'); t.ctx.cueAskPick(invId(t), 'approve');
  assert.ok(/^Canvas refused: BI 0013 has payment advice/.test(lastCue(t)));
  assert.ok(bridgeCheck('invoice_line', { line: 'REC-1', bi_no: '0013' }) === '' || !bridgeCheck('invoice_line', { line: 'REC-1', bi_no: '0013' }), 'schema takes it');
  assert.ok(bridgeCheck('invoice_line', { line: '', bi_no: '0013' }), 'an empty line is refused by the schema');
});
