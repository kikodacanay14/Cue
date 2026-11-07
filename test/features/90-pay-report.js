// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: PAY-DAYS-2026-11-07 (CueMorning.gs).
// Canvas spec docs/specs/payment-days.md, approved by Kiko 7 Nov 2026 13:11Z ("yes"); Kiko 7 Nov SOP answer: "payment days are
// Tuesday and Thursday. The payment report runs Monday and Wednesday." The 8 AM update on Monday and Wednesday lists the requests
// whose pay day is tomorrow (bridge read pay_day_due), with the total. Other days have no section.
const PAY_DUE = { requests: [
  { request_id: 'PR-0001', project_id: 'S-047AB', project: 'Acme Gala', payee: 'Mats Co', approval: '', amount: 1500, balance: 1500, due: '2026-10-22', urgent: false },
  { request_id: 'PR-0002', project_id: 'S-047AB', project: 'Acme Gala', payee: 'Sonic Pro', approval: 'Pending', amount: 800, balance: 300.5, due: '2026-10-20', urgent: true }],
  total: 1800.5 };
const payText = (t, o) => t.tabs.Chat.rows.filter(r => r[3] === o.request_id)[0][2];

test('PY1 Wednesday 8 AM lists Thursday\'s payments, Urgent and approval marks, and the total; asks Canvas for tomorrow', () => {
  const t = k0Box({ payDue: PAY_DUE }); t.ctx.cueSweep(); t.at('2026-10-21', 8, 0);
  const x = payText(t, t.ctx.cueK0Run_(false, 'am'));
  deq(t.log.payDue, [{ day: '2026-10-22' }]);
  assert.ok(/\nPayments for tomorrow \(Thu 22 Oct\)\n- PR-0001 · Acme Gala · Mats Co · ₱1,500\n- PR-0002 · Acme Gala · Sonic Pro · ₱300\.5 · Urgent \(needed Tue 20 Oct\) · Pending\n- Total: ₱1,800\.5/.test(x), x);
});
test('PY2 Monday asks for Tuesday; Tuesday has no payments section and no read', () => {
  const t = k0Box({ payDue: { requests: [], total: 0 } }); t.ctx.cueSweep(); t.at('2026-10-19', 8, 0);
  const x = payText(t, t.ctx.cueK0Run_(false, 'am'));
  deq(t.log.payDue, [{ day: '2026-10-20' }]); assert.ok(/\nPayments for tomorrow \(Tue 20 Oct\)\n- None due tomorrow\./.test(x), x);
  const u = k0Box({ payDue: PAY_DUE }); u.ctx.cueSweep(); u.at('2026-10-20', 8, 0);
  const y = payText(u, u.ctx.cueK0Run_(false, 'am'));
  assert.ok(!u.log.payDue, 'no read on Tuesday'); assert.ok(!/Payments for tomorrow/.test(y));
});
test('PY3 a failed read is named and the rest of the update still goes', () => {
  const t = k0Box({ payDueFail: true }); t.ctx.cueSweep(); t.at('2026-10-21', 8, 0);
  const x = payText(t, t.ctx.cueK0Run_(false, 'am'));
  assert.ok(/Could not read [^\n]*the payments due tomorrow in Canvas/.test(x), x); assert.ok(!/Payments for tomorrow/.test(x));
});
test('PY4 the 2 PM update never lists payments', () => {
  const t = k0Box({ payDue: PAY_DUE, gpt: { chasers_tailor: { drafts: [] } } }); t.at('2026-10-21', 13, 0); t.ctx.cueSweep(); t.at('2026-10-21', 14, 0);
  const x = payText(t, t.ctx.cueK0Run_(false, 'pm')); assert.ok(!/Payments for tomorrow/.test(x)); assert.ok(!t.log.payDue);
});
test('PY5 pay_day_due is a read in the Canvas bridge schema and takes a yyyy-mm-dd day', () => {
  assert.ok(!bridgeCheck('pay_day_due', { day: '2026-10-22' }), 'a yyyy-mm-dd day is accepted');
  assert.ok(bridgeCheck('pay_day_due', { day: '22/10/2026' }), 'a day in another format is refused');
});
