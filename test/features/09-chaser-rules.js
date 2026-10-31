// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: chaser-rules.
/* ---------- chaser rules (Kiko 08:12Z, spec specs/chaser-rules.md, approved 08:15Z) ---------- */
test('R1 defaults are the ones each chaser agreed; nothing saved yet', () => {
  const t = sandbox(), r = t.ctx.cueRules();
  deq(['rfq', 'award', 'payment', 'accreditation', 'signature'].map(k => [r.kinds[k].first, r.kinds[k].every, r.kinds[k].max, r.kinds[k].unit]),
    [[3, 3, 2, 'working'], [3, 5, 3, 'working'], [7, 7, 3, 'days'], [3, 3, 3, 'days'], [1, 2, 3, 'days']]);
  deq(r.general, { build: 7, send: 9, quiet_from: 21, quiet_to: 7, per_kind: 15, per_batch: 40 });
});
// A test stub replaces a real chaser kind of the same name (payment, award, ...) once those kind files load.
function stubKind(t, def) { const ks = t.ctx.cueKinds_(); const i = ks.findIndex(k => k.kind === def.kind); if (i >= 0) ks.splice(i, 1); t.ctx.cueKind_(def); }
test('R2 Kiko saves a change: checked, kept in the Rules tab, noted in the chat, used by the next batch', () => {
  const t = sweepBox(); stubKind(t, { kind: 'payment', label: 'Payment chasers', template: it => ({ body: 'Pay ' + it.who }),
    find: ctx => [{ key: 'pay:1', project: 'P', who: 'Client', to: 'c@x.example', why: 'Unpaid ' + ctx.rule('payment').first + 'd' }] });
  const r = t.ctx.cueRulesSave({ 'payment.every': 5, 'payment.first': '10', 'rfq.on': false });
  assert.strictEqual(r.kinds.payment.every, 5); assert.strictEqual(r.kinds.payment.first, 10); assert.strictEqual(r.kinds.rfq.on, false);
  assert.ok(t.tabs.Chat.rows.some(x => /C7 Payment chasers: then every 7 → 5/.test(x[2]) && /S2 RFQ and RFP chasers: paused/.test(x[2])));
  deq(t.tabs.Rules.rows.slice(1).map(x => [x[0], x[1]]), [['payment.every', 5], ['payment.first', 10], ['rfq.on', false]]);
  t.at('2026-10-21', 10, 0); t.ctx.cueSweep(); const b = batchOf(t);
  assert.ok(b.batch.items.some(i => /Unpaid 10d/.test(i.why)), 'the kind reads rule.first');
  t.ctx.cueApprove(b.id, { send: true }); assert.strictEqual(chase(t).filter(x => x[0] === 'pay:1')[0][6], '2026-10-26', 'next due uses every = 5');
});
test('R3 bad values are refused with a plain reason; nothing is saved', () => {
  const t = sandbox();
  assert.throws(() => t.ctx.cueRulesSave({ 'payment.every': 0 }), /whole number from 1 to 60/);
  assert.throws(() => t.ctx.cueRulesSave({ 'general.send': 6 }), /from 7 to 20/);
  assert.throws(() => t.ctx.cueRulesSave({ 'general.build': 9, 'general.send': 9 }), /after the time the batch is built/);
  assert.throws(() => t.ctx.cueRulesSave({ 'nope.every': 3 }), /Unknown chaser/);
  assert.ok(!t.tabs.Rules || t.tabs.Rules.rows.length <= 1);
});
test('R4 a broken value typed into the Rules tab falls back to the default and the batch says so', () => {
  const t = sweepBox(); t.ctx.cueRules(); t.tabs.Rules.appendRow(['nudge.every', 'soon']);
  t.ctx.cueSweep(); const b = batchOf(t); assert.strictEqual(b.status, 'Needs you'); assert.ok(b.notes.some(n => /nudge\.every = "soon" is not valid/.test(n)));
});
test('R5 send time and working days: approved at 9:30 waits for a 10:00 send; working-day rules skip the weekend', () => {
  const t = sweepBox(); t.ctx.cueRulesSave({ 'general.send': 10 }); stubKind(t, { kind: 'award', label: 'CE award chasers', template: () => ({ body: 'Any news?' }),
    find: () => [{ key: 'award:1', project: 'Acme', who: 'Ana', to: 'ana@acme.example', why: 'CE sent' }] });
  t.at('2026-10-23', 7, 0); t.ctx.cueSweep(); t.at('2026-10-23', 9, 30);
  assert.strictEqual(t.ctx.cueApprove(batchOf(t).id, { send: true }).status, 'Scheduled');
  t.at('2026-10-23', 10, 0); t.ctx.cueResume(); assert.ok(t.log.sent.length >= 1);
  assert.strictEqual(chase(t).filter(x => x[0] === 'award:1')[0][6], '2026-10-30', 'Friday + 5 working days = next Friday');
});
test('R5b a line may set its own interval (it.every), e.g. RFQ event-soon every 1 working day', () => {
  const t = sweepBox({ items: [{ key: 'rfq:dddddddddddddddd', project: 'Soon', who: 'S', to: 's@x.example', why: 'event in 3 days', every: 1 }] });
  t.at('2026-10-21', 10, 0); t.ctx.cueSweep(); t.ctx.cueApprove(batchOf(t).id, { send: true });
  assert.strictEqual(chase(t)[0][6], '2026-10-22');
});
test('R6 moving the build time moves the sweep\'s Schedule row (no trigger)', () => {
  const t = sandbox(); t.ctx.cueState(); t.ctx.cueRulesSave({ 'general.build': 6, 'general.send': 9 });
  assert.ok(!t.log.triggers.some(h => h === 'cueSweep')); assert.strictEqual(t.ctx.cueSchedules().filter(x => x.id === 'sys-sweep')[0].when, 'Daily 06:00');
});
