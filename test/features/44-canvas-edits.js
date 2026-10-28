// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: canvas-edits.
// ---------- CUE-EDIT-2026-10-27: generic Canvas edits (CueEdit.gs) ----------
const ED_ALLOW = [
  { book: 'tracker', tab: 'BI', key: 'BI NUMBER', mode: 'update', columns: ['PROJECT ID', 'BI NUMBER', 'DESCRIPTION', 'STATUS'], writable: ['DESCRIPTION'],
    rows: [{ _row: 14, 'PROJECT ID': 'S-25506500TR', 'BI NUMBER': '0014', DESCRIPTION: 'PO dated August 27, 2026', STATUS: 'For Submission' },
      { _row: 13, 'PROJECT ID': 'S-11200574TE', 'BI NUMBER': '0013', DESCRIPTION: 'REC-10301903 for PO-10209008', STATUS: 'Paid' }] },
  { book: 'scopes', tab: 'Transfers', key: 'Request ID', mode: 'read', columns: ['Request ID', 'Bank', 'PAID AMOUNT'], writable: [], rows: [] }];
const ED_PLAN = { ok: true, question: '', book: 'tracker', tab: 'BI', where: [{ column: 'BI NUMBER', equals: '0014', contains: '' }],
  set: [{ column: 'Description', value: 'Attn: Kressy Pascual', how: 'before' }], add: false, key: '' };   // Claude's own spelling of the column
const TALK_ED = { reply: 'I can\'t edit Canvas.', looks_like_inquiry: false, start_intake: '', task: '', canvas_edit: 'Put "Attn: Kressy Pascual" at the start of the description of BI 0014.' };
test('ED1 "put Attn: Kressy Pascual on BI 0014": the chat call routes it to Claude, one Approve card with old and new; nothing written before Approve; Approve writes once', () => {
  const t = sandbox({ talk: TALK_ED });
  t.ctx.cueSend('put Attn: Kressy Pascual on the description of BI 0014', [], '');
  const msgs = t.tabs.Chat.rows.map(x => String(x[2]));
  assert.ok(msgs.indexOf('I can\'t edit Canvas.') < 0, 'the chat call\'s guess is not shown');
  assert.ok(msgs.some(m => /^Working out the change/.test(m)));
  assert.strictEqual(t.log.claude.length, 1, 'one Claude call');
  assert.ok(/BI \(key BI NUMBER, mode update\)[\s\S]*writable: DESCRIPTION/.test(t.log.claude[0].messages[0].content), 'Claude sees the allowed tabs and columns');
  deq(t.log.readRows.map(a => a.where || []), [[], [], [{ column: 'BI NUMBER', equals: '0014' }]], 'columns of each allowed tab, then the row');
  const card = t.tabs.Chat.rows.find(x => /^\?ask-/.test(String(x[3])));
  assert.ok(card && /Change this in Canvas\?\nBI, BI NUMBER 0014\nDESCRIPTION: PO dated August 27, 2026\n  becomes: Attn: Kressy Pascual\. PO dated August 27, 2026/.test(card[2]), card && card[2]);
  assert.ok(!(t.log.genWrites || []).length && !Object.keys(t.log.plans_ || {}).length, 'nothing written or planned before Approve');
  const id = String(card[3]).slice(1).split(':')[0];
  t.ctx.cueAskPick(id, 'approve');
  deq(t.log.genWrites, [{ action: 'write_rows', args: { book: 'tracker', tab: 'BI', key: '0014', set: { DESCRIPTION: 'Attn: Kressy Pascual. PO dated August 27, 2026' } } }]);
  assert.ok(/^Saved\. BI 0014 now reads:\nDESCRIPTION: Attn: Kressy Pascual\. PO dated August 27, 2026$/.test(t.tabs.Chat.rows[t.tabs.Chat.rows.length - 1][2]));
  assert.throws(() => t.ctx.cueAskPick(id, 'approve'), /already answered/, 'one answer per card, so one write');
  assert.strictEqual(bridgeCheck('write_rows', t.log.genWrites[0].args), '', 'real bridge schema');
});
test('ED5 the cloud check\'s ask, \'put "Cloud check" at the start of the description of BI 0014\', is a Canvas edit, not an invoice REC line', () => {
  const t = sandbox({ talk: Object.assign({}, TALK_ED, { canvas_edit: 'Put "Cloud check" at the start of the description of BI 0014.' }) });
  t.ctx.cueSend('put "Cloud check" at the start of the description of BI 0014', [], '');
  const msgs = t.tabs.Chat.rows.map(x => String(x[2]));
  assert.ok(!msgs.some(m => /^No project with a billing invoice or PO matches/.test(m)), msgs.join(' | '));
  assert.strictEqual(t.log.claude.length, 1, 'one Claude call');
  assert.ok(t.tabs.Chat.rows.some(x => /^\?ask-/.test(String(x[3])) && /^Change this in Canvas\?\nBI, BI NUMBER 0014/.test(String(x[2]))), msgs.join(' | '));
  // A REC number still takes the invoice line route, BI number or not.
  const u = txBox(); u.ctx.cueSend('add REC-10307792 to the Telus trick or treat invoice');
  assert.ok(/^Put this line on Trick or Treat - Manila's invoice\?/.test(String((u.tabs.Chat.rows.find(x => /^\?ask-/.test(String(x[3]))) || [])[2])));
});
test('ED2 a column Cue may not write, no matching row, two rows, already there, Not that, and a Canvas refusal all stop with nothing written', () => {
  const cardOf = t => t.tabs.Chat.rows.filter(x => /^\?ask-/.test(String(x[3]))).length;
  const last = t => String(t.tabs.Chat.rows[t.tabs.Chat.rows.length - 1][2]);
  let t = sandbox({ talk: TALK_ED, edit: Object.assign({}, ED_PLAN, { set: [{ column: 'STATUS', value: 'Paid', how: 'replace' }] }) });
  t.ctx.cueSend('mark BI 0014 paid', [], ''); assert.ok(/STATUS can't be changed by Cue in BI\. Cue can change: DESCRIPTION\. Nothing was changed\./.test(last(t)), last(t)); assert.strictEqual(cardOf(t), 0);
  t = sandbox({ talk: TALK_ED, edit: Object.assign({}, ED_PLAN, { where: [{ column: 'BI NUMBER', equals: '0099', contains: '' }] }) });
  t.ctx.cueSend('fix BI 0099', [], ''); assert.ok(/^No BI row matches \(BI NUMBER = 0099\)/.test(last(t)), last(t));
  t = sandbox({ talk: TALK_ED, edit: Object.assign({}, ED_PLAN, { where: [{ column: 'BI NUMBER', equals: '', contains: '001' }] }) });
  t.ctx.cueSend('fix the 001 invoice', [], ''); assert.ok(/^2 BI rows match\. Which one\? BI NUMBER 0014, BI NUMBER 0013/.test(last(t)), last(t));
  t = sandbox({ talk: TALK_ED, edit: Object.assign({}, ED_PLAN, { set: [{ column: 'DESCRIPTION', value: 'PO dated', how: 'before' }] }) });
  t.ctx.cueSend('add PO dated to BI 0014', [], ''); assert.ok(/^Already there/.test(last(t)), last(t));
  t = sandbox({ talk: TALK_ED, edit: Object.assign({}, ED_PLAN, { ok: false, question: 'Cue can edit BI descriptions only. Which BI?' }) });
  t.ctx.cueSend('change the thing', [], ''); assert.strictEqual(last(t), 'Cue can edit BI descriptions only. Which BI?');
  t = sandbox({ talk: TALK_ED }); t.ctx.cueSend('put Attn on BI 0014', [], '');
  let id = String(t.tabs.Chat.rows.find(x => /^\?ask-/.test(String(x[3])))[3]).slice(1).split(':')[0];
  t.ctx.cueAskPick(id, 'not'); assert.ok(/Nothing was written to Canvas/.test(last(t))); assert.ok(!(t.log.genWrites || []).length);
  t = sandbox({ talk: TALK_ED, genRefused: 'BI 0014 is Paid, so it can\'t be edited. Nothing was saved.' }); t.ctx.cueSend('put Attn on BI 0014', [], '');
  id = String(t.tabs.Chat.rows.find(x => /^\?ask-/.test(String(x[3])))[3]).slice(1).split(':')[0];
  t.ctx.cueAskPick(id, 'approve'); assert.ok(/^Canvas refused: BI 0014 is Paid/.test(last(t)), last(t));
});
test('ED3 "allow cue to edit ... in <tab> in <book>, key <col>": no AI call, an Approve card, then one allow_list_set; read and add forms; no key stops', () => {
  const t = sandbox(), last = () => String(t.tabs.Chat.rows[t.tabs.Chat.rows.length - 1][2]);
  t.ctx.cueSend('allow cue to edit Amount, Description in Payment Request in scopes, key Request ID', [], '');
  assert.strictEqual(t.log.gpt.length + t.log.claude.length, 0, 'no AI call');
  const card = t.tabs.Chat.rows.find(x => /^\?ask-/.test(String(x[3])));
  assert.ok(/^Let Cue change Amount, Description in Payment Request \(scopes\), finding rows by Request ID\?/.test(card[2]), card[2]);
  t.ctx.cueAskPick(String(card[3]).slice(1).split(':')[0], 'approve');
  deq(t.log.genWrites, [{ action: 'allow_list_set', args: { type: 'tab', book: 'scopes', name: 'Payment Request', mode: 'update', read: 'all', write: 'Amount, Description', key: 'Request ID' } }]);
  assert.strictEqual(bridgeCheck('allow_list_set', t.log.genWrites[0].args), ''); assert.ok(/^Done\. Cue can now change Amount, Description in Payment Request\./.test(last()));
  t.ctx.cueSend('allow cue to read Supplier Entries in scopes', [], '');
  assert.ok(/^Let Cue read Supplier Entries \(scopes\)\?/.test(last()), last());
  t.ctx.cueSend('allow cue to edit Amount in Payment Request in scopes', [], '');
  assert.ok(/Which column finds the row\?/.test(last()), last());
});
test('ED4 Canvas allows nothing yet: a plain answer with how to allow a tab, no Claude call, nothing written', () => {
  let t = sandbox({ talk: TALK_ED, allow: [] }); t.ctx.cueSend('put Attn on BI 0014', [], '');
  assert.ok(/not allowed to edit any Canvas tab yet/.test(t.tabs.Chat.rows[t.tabs.Chat.rows.length - 1][2])); assert.strictEqual(t.log.claude.length, 0);
});
