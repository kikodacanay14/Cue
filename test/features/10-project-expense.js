// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: project-expense.
test('X1 an expense is recognised from Kiko\'s own words, in code; an inquiry is not', () => {
  const t = sandbox();
  [XTEXT, 'record this payment: gcash to Ace 450', 'proof of transfer for the LED wall', 'liquidation for Telus', 'paid cash for tapes'].forEach(x => assert.ok(t.ctx.cueIsExpense_(x), x));
  [INQ, 'Hi, how are you?', 'new project intake for JBL', 'personal expense: Grab receipt', 'record this receipt as personal'].forEach(x => assert.ok(!t.ctx.cueIsExpense_(x), x));
  assert.throws(() => t.ctx.cueExpense('record this receipt as personal', [], ''), /personal/);
});
test('X2 expense read: 2 AI calls (GPT reads the photo, Claude matches), Canvas looked up by name, nothing saved or uploaded', () => {
  const t = expenseCard();
  assert.strictEqual(t.v.status, 'Needs you'); assert.strictEqual(t.v.kind, 'expense'); assert.strictEqual(t.v.metrics.ai_calls, 2);
  assert.strictEqual(t.log.gpt.length, 1); assert.strictEqual(t.log.claude.length, 1);
  assert.strictEqual(t.log.gpt[0].input[0].content[1].type, 'input_image');
  deq(t.log.bridge.map(b => b.action), ['expense_evidence']); assert.strictEqual(t.log.xev[0].project_hint, 'Telus Trick or Treat Manila');
  assert.ok(!t.log.drive, 'no Drive call: the file is never uploaded to Cue uploads');
  const st = t.state(t.id); assert.ok(!JSON.stringify(st).includes(JPG.data), 'file bytes are not stored'); assert.strictEqual(st.files[0].sha.length, 64);
  assert.strictEqual(t.v.expense.plan.route, 'new_scope'); assert.strictEqual(t.v.expense.project.number, '017');
});
test('X3 Claude\'s plan keeps only ids Canvas listed; invented ones become doubts and block the route', () => {
  const t = expenseCard({ xplan: Object.assign({}, XPLAN, { route: 'existing_scope', scope_id: 'SCP26-017-99', doubts: [] }) });
  const p = t.v.expense.plan; assert.strictEqual(p.route, 'cannot_record'); assert.ok(p.doubts.some(d => /not in Canvas/.test(d)));
  const t2 = expenseCard({ xplan: Object.assign({}, XPLAN, { new_scope: Object.assign({}, XPLAN.new_scope, { requirement_id: 'REQ-FAKE' }), doubts: [] }) });
  assert.strictEqual(t2.v.expense.plan.new_scope.requirement_id, ''); assert.ok(t2.v.expense.plan.doubts.some(d => /CE category/.test(d)));
});
test('X4 approve needs every doubt ticked and the same files; then Canvas records it once with the bridge schema, and the summary says what landed', () => {
  const t = expenseCard();
  assert.throws(() => t.ctx.cueApprove(t.id, { files: [JPG] }), /Tick each point/);
  assert.throws(() => t.ctx.cueApprove(t.id, { cleared: [0], files: [] }), /not in this page any more/);
  assert.throws(() => t.ctx.cueApprove(t.id, { cleared: [0], files: [Object.assign({}, JPG, { data: Buffer.from('another photo').toString('base64') })] }), /not in this page any more/);
  assert.ok(!t.log.recorded);
  const v = t.ctx.cueApprove(t.id, { cleared: [0], files: [JPG], amount: '450' });
  assert.strictEqual(v.status, 'Done'); assert.strictEqual(t.log.recorded.length, 1); assert.strictEqual(t.state(t.id).status, 'Done', 'saved, not left at Writing to Canvas');
  const a = t.log.recorded[0].args; assert.strictEqual(t.log.recorded[0].pid, 'S-25506500TR');
  deq([a.plan.new_scope.requirement_id, a.plan.award, a.plan.paid, a.files[0].role, a.files[0].mime], ['REQ26-10017-05', true, 'cash', 'receipt', 'image/jpeg']);
  assert.ok(t.tabs.Chat.rows.some(r => /Summary for ₱450\.00 Duct Tapes for Trick or Treat – Manila: recorded in Canvas as AP-ACE-TRI-1 on new scope SCP26-017-47, paid; every row read back correctly; receipt filed/.test(r[2])));
});
test('X4b 1.27.7 backfill: an expense approved before the fix (stuck at Writing to Canvas, summary posted) is marked Done on the tick; no Canvas call', () => {
  const t = expenseCard(); t.ctx.cueApprove(t.id, { cleared: [0], files: [JPG] });
  const L = t.ctx.cueLoad_(t.id); L.s.status = 'Writing to Canvas'; L.s.stage = 'Writing to Canvas'; t.ctx.cueSave_(L.sh, L.row, L.s);   // as the old code left it
  const calls = t.log.bridge.length;
  t.ctx.cueFixStuckWrites_(); assert.strictEqual(t.state(t.id).status, 'Writing to Canvas', 'not within 10 minutes of Approve');
  t.ctx.__wait(11 * 60 * 1000); t.ctx.cueResume();
  const s = t.state(t.id); deq([s.status, s.stage], ['Done', 'Done']); assert.ok(s.notes.some(n => /from its summary line/.test(n)));
  assert.strictEqual(t.log.bridge.length, calls, 'no Canvas call');
  const u = expenseCard(); const M = u.ctx.cueLoad_(u.id); M.s.status = 'Writing to Canvas'; M.s.approved_at = new Date(0).toISOString(); u.ctx.cueSave_(M.sh, M.row, M.s);
  u.ctx.cueFixStuckWrites_(); assert.strictEqual(u.state(u.id).status, 'Writing to Canvas', 'no summary line: left alone');
});
test('X5 a stop at a Canvas step comes back to the card; approving again carries on with the same request', () => {
  const t = expenseCard({ xrec: n => n === 1 ? { recorded: false, stopped_at: 'award', error: 'Fill in the Venue survey first.', steps: { scope: { ok: true, id: 'SCP26-017-47' } } } : XREC });
  const v = t.ctx.cueApprove(t.id, { cleared: [0], files: [JPG] });
  assert.strictEqual(v.status, 'Needs you'); assert.ok(/stopped at the award: Fill in the Venue survey/.test(v.error));
  const v2 = t.ctx.cueApprove(t.id, { cleared: [0], files: [JPG] });
  assert.strictEqual(v2.status, 'Done'); assert.strictEqual(t.log.recorded[1].args.request_id, t.id);
});
test('X6 Canvas can\'t tell the project: card asks for it, Claude is not called, Approve refuses', () => {
  const t = expenseCard({ xev: () => ({ project: null, candidates: [], matches: [], lists: {} }) });
  assert.strictEqual(t.v.status, 'Needs you'); assert.ok(/could not tell which project/.test(t.v.error)); assert.strictEqual(t.v.metrics.ai_calls, 1);
  assert.throws(() => t.ctx.cueApprove(t.id, { files: [JPG] }), /not waiting for you/);
});
test('X7 an expense is never resumed or retried without its files', () => {
  const t = expenseCard({ fail: { xread: () => resp(500, {}) } });
  assert.strictEqual(t.v.status, 'Failed'); assert.throws(() => t.ctx.cueRetry(t.id), /Send the expense again/);
  const st = t.state(t.id); st.status = 'Working'; const row = t.tabs.Requests.rows.findIndex(r => r[0] === t.id) + 1;
  t.ctx.cueSave_(t.tabs.Requests, row, st); assert.strictEqual(t.ctx.cueRun(t.id).status, 'Failed');
});
test('X8 a reply in an expense thread keeps that thread\'s Canvas project', () => {
  const t = expenseCard(); const v = t.ctx.cueExpense('paid cash 200 more for tapes, receipt attached', [], t.id);
  assert.strictEqual(t.log.xev[1].project_id, 'S-25506500TR'); assert.ok(!('project_hint' in t.log.xev[1])); assert.strictEqual(v.ref, t.id);
});
test('X9 unsupported or too many files are refused before any AI call', () => {
  const t = sandbox();
  assert.throws(() => t.ctx.cueExpense(XTEXT, [{ name: 'a.txt', type: 'text/plain', data: 'aGk=' }], ''), /photos .* or PDFs/);
  assert.throws(() => t.ctx.cueExpense(XTEXT, [JPG, JPG, JPG, JPG, JPG], ''), /4 files at most/);
  assert.strictEqual(t.log.gpt.length, 0);
});

test('X10 card doubts start ticked (Kiko 22 Oct 06:09Z) except the ones Cue\'s own checks raised', () => {
  const t = expenseCard({ xplan: Object.assign({}, XPLAN, { route: 'existing_scope', scope_id: 'SCP26-017-99', doubts: ['Supplier not named; confirm the shop.', 'Date comes from the file name; confirm it.'] }) });
  const x = t.v.expense, d = x.plan.doubts;
  assert.ok(d.length >= 3, JSON.stringify(d));
  assert.deepStrictEqual(x.hard, d.map((v, i) => /not in Canvas|^Pick the |^Add the |^Mark which file |not sure of the project|may already be |already has an awarded quote/.test(v) ? i : -1).filter(i => i >= 0));
  assert.ok(x.hard.indexOf(0) < 0 && x.hard.indexOf(1) < 0, 'Claude\'s doubts start ticked');
  assert.ok(x.hard.indexOf(d.findIndex(v => /not in Canvas/.test(v))) >= 0, 'a missing Canvas id stays unticked');
  assert.deepStrictEqual(t.ctx.cueExpHard_(['Canvas was not sure of the project; check it is X.', 'Canvas thinks this may already be PR-1 (amount).', 'Add the amount.', 'Looks fine.']), [0, 1, 2]);
});
