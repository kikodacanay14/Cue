// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: payment-chasers.
/* ---------- payment chasers (spec specs/payment-chasers.md, Kiko approved 08:16Z) ---------- */
const OVERDUE = { today: '2026-10-21', min_days_late: 7, more: 0, skipped: [{ no: '1045', project: 'Gamma Gala', why: 'The BI has no total, so the amount owed is unknown.' }], bis: [
  { no: '1041', project_id: 'S-31628060SP', project: 'Synthetic Expo', company: 'Acme Corp', client: 'Ana Reyes', total: 120000, collected: 40000, balance: 80000,
    total_text: 'PHP 120,000.00', balance_text: 'PHP 80,000.00', due: '2026-10-01', days_late: 20, to: 'ap@acme.example', to_name: 'Fe Santos', to_source: 'billing contact (Client Desk)',
    thread: { thread_id: 'th1041abcd', message_id: '<a1@mail>', subject: 'Billing Invoice BI 1041', sent_on: '2026-09-01', to: ['ana@acme.example'], cc: [], last_from_bse: '2026-09-01', client_replied: null } },
  { no: '1047', project_id: 'S-31628061SP', project: 'Acme Roadshow', company: 'Acme Corp', client: 'Ana Reyes', total: 25000, collected: 0, balance: 25000,
    total_text: 'PHP 25,000.00', balance_text: 'PHP 25,000.00', due: '2026-10-10', days_late: 11, to: 'ap@acme.example', to_name: 'Fe Santos', to_source: 'billing contact (Client Desk)', thread: null },
  { no: '1043', project_id: 'S-40000001AA', project: 'Beta Launch', company: 'Beta Inc', client: 'Ben Cruz', total: 80000, collected: 0, balance: 80000,
    total_text: 'PHP 80,000.00', balance_text: 'PHP 80,000.00', due: '2026-09-16', days_late: 35, to: 'ben@beta.example', to_name: 'Ben Cruz', to_source: 'invoice contact',
    thread: { thread_id: 'th1043abcd', subject: 'BI 1043', client_replied: { on: '2026-10-15', from: 'ben@beta.example', snippet: 'We are processing it this week.' } } },
  { no: '1050', project_id: 'S-40000009ZZ', project: 'Zeta Fair', company: 'Zeta', client: 'Zed', total: 5000, collected: 0, balance: 5000,
    total_text: 'PHP 5,000.00', balance_text: 'PHP 5,000.00', due: '2026-10-05', days_late: 16, to: '', to_name: 'Zed', to_source: '', thread: null }] };
const GOODPAY = x => 'Dear Fe, a gentle reminder on ' + x.facts.bis.map(b => 'BI ' + b.no + ' (' + b.balance_text + ')').join(' and ') + ', total ' + x.facts.total_balance_text + '. When can we expect payment?';
function payBox(o = {}) { const t = sweepBox(Object.assign({ overdue: OVERDUE, chaserBody: GOODPAY }, o), null); return t; }
const payItems = t => t.state(batchOf(t).id).batch.items.filter(i => i.kind === 'payment');   // the saved items (html and bis are not in the page view)

test('PY1 find: one Canvas read, one email per client (BIs grouped, oldest first), replied and no-email lines need Kiko, notes for skipped BIs', () => {
  const t = payBox(); t.ctx.cueSweep(); const b = batchOf(t), it = payItems(t);
  assert.strictEqual(t.log.overdue, 1); assert.strictEqual(t.log.gpt.length, 0, 'no AI call: Kiko\'s C7 template (31 Oct)'); assert.ok(!t.log.paySends, 'nothing sent at build');
  deq(b.batch.items.filter(i => i.kind === 'payment').map(i => [i.who, i.to, i.no_email, i.selected, i.in_thread]).sort(), [['Ben Cruz', 'ben@beta.example', true, false, true], ['Fe Santos', 'ap@acme.example', false, true, true], ['Zed', '', true, false, false]]);
  const acme = it.filter(i => i.who === 'Fe Santos')[0];
  assert.ok(/BI 1041, BI 1047: PHP 105,000.00 owed, 20 days overdue \(due 2026-10-01\)\. From info@, CC you/.test(acme.why), acme.why);
  assert.ok(/^Hi Fe,\n\nA quick check-in on billing invoices 1041, 1047/.test(acme.body) && /Total due: PHP 105,000.00/.test(acme.body), acme.body); assert.strictEqual(acme.drafted_by, 'template');
  assert.ok(/\nThanks!\nBlank Space Events\nAccounts Receivable$/.test(acme.body) && /background:#55D7E5/.test(acme.html), 'C7 sign-off and the client banner');
  assert.ok(/client replied on 2026-10-15/i.test(it.filter(i => i.who === 'Ben Cruz')[0].why)); assert.ok(/No billing email found/.test(it.filter(i => i.who === 'Zed')[0].why));
  assert.ok(!(t.log.chaserItems || []).length, 'nothing goes to ChatGPT');
  assert.ok(b.notes.some(n => /BI 1045 \(Gamma Gala\): The BI has no total/.test(n)));
});
test('PY2 check: the C7 template names every BI and its balance, so Canvas\'s check always passes (no AI draft to turn down)', () => {
  const t = payBox({ chaserBody: () => 'Dear Fe, kindly settle your balance soon.' }); t.ctx.cueSweep();
  const acme = payItems(t).filter(i => i.who === 'Fe Santos')[0];
  assert.strictEqual(acme.drafted_by, 'template'); assert.ok(t.ctx.cuePayCheck_(acme));
  assert.ok(/BI 1041, Synthetic Expo: PHP 80,000.00, due 2026-10-01/.test(acme.body), acme.body);
  assert.ok(!batchOf(t).notes.some(n => /left out a required detail/.test(n)));
});
test('PY3 Approve and send before 9:00: nothing in Kiko\'s Gmail; at 9:00 Canvas sends from info@ in the BI thread; chased again in 7 days', () => {
  const t = payBox(); t.ctx.cueSweep(); const id = batchOf(t).id; t.at('2026-10-21', 7, 30);
  const v = t.ctx.cueApprove(id, { send: true }); assert.strictEqual(v.status, 'Scheduled'); assert.ok(!t.log.paySends && !t.log.gmail.length && !t.log.replies);
  assert.ok(t.tabs.Chat.rows.some(r => /will go out at 09:00\. Nothing has gone out yet/.test(r[2])));
  t.at('2026-10-21', 9, 0); t.ctx.cueResume();
  assert.strictEqual(t.log.paySends.length, 1); const a = t.log.paySends[0];
  deq([a.key, a.mode, a.bis, a.balance, a.to, a.thread_id], ['payment:bi:1041:c1', 'send', ['1041', '1047'], 105000, 'ap@acme.example', 'th1041abcd']);
  assert.ok(bridgeCheck('send_payment_chasers', a) === '', 'matches the Canvas bridge schema');
  assert.strictEqual(batchOf(t).status, 'Done'); deq(chase(t).filter(r => r[1] === 'payment').map(r => [r[0], r[5], r[6], r[8]]), [['payment:bi:1041', 1, '2026-10-28', 'sent']]);
  t.at('2026-10-28', 7, 0); t.ctx.cueSweep(); t.at('2026-10-28', 10, 0); t.ctx.cueApprove(batchOf(t).id, { send: true });
  assert.strictEqual(t.log.paySends[1].key, 'payment:bi:1041:c2', 'second chaser has its own once-only key');
});
test('PY4 Drafts only saves an info@ draft through Canvas; Kiko\'s edit that drops the amount is refused before Canvas; a Canvas refusal shows on the line', () => {
  const t = payBox(); t.ctx.cueSweep(); t.ctx.cueApprove(batchOf(t).id, { send: false });
  deq(t.log.paySends.map(a => a.mode), ['draft']); assert.ok(!t.log.gmail.length); assert.ok(t.tabs.Chat.rows.some(r => /1 in info@'s Drafts/.test(r[2])));
  const u = payBox(); u.ctx.cueSweep(); u.at('2026-10-21', 10, 0);
  u.ctx.cueApprove(batchOf(u).id, { send: true, bodies: { 'payment:bi:1041': 'Hi Fe, BI 1041 and BI 1047 are overdue, please pay.' } });
  const e = payItems(u).filter(i => i.who === 'Fe Santos')[0]; assert.ok(!u.log.paySends); assert.ok(/must name BI 1041, BI 1047 and state the balance \(PHP 105,000.00\)/.test(e.error));
  const w = payBox({ payRefuse: 'The balance changed from PHP 105,000.00 to PHP 25,000.00 since the batch was built. Nothing was sent; run the sweep again.' });
  w.ctx.cueSweep(); w.at('2026-10-21', 10, 0); w.ctx.cueApprove(batchOf(w).id, { send: true });
  assert.ok(/balance changed/.test(payItems(w).filter(i => i.who === 'Fe Santos')[0].error)); assert.strictEqual(batchOf(w).status, 'Done, drafts incomplete');
  assert.strictEqual(chase(w).filter(r => r[1] === 'payment').length, 0, 'not logged as chased');
});
test('PY5 at most 3 chasers, then the engine flags it to Kiko; Canvas down is a note, not a failed batch', () => {
  const t = payBox(); ['2026-10-21', '2026-10-28', '2026-11-04'].forEach(d => { t.at(d, 7, 0); t.ctx.cueSweep(); t.at(d, 10, 0); t.ctx.cueApprove(batchOf(t).id, { send: true }); });
  assert.strictEqual(t.log.paySends.length, 3); t.at('2026-11-11', 7, 0); t.ctx.cueSweep();
  const b = batchOf(t); assert.ok(b.batch.stopped.some(i => i.key === 'payment:bi:1041')); assert.strictEqual(payItems(t).filter(i => i.key === 'payment:bi:1041').length, 0);
  const u = sweepBox({ overdueFail: true }, null); u.ctx.cueSweep(); assert.ok(u.tabs.Chat.rows.some(r => /nothing to chase today/.test(r[2])));
});
test('PY6 the Chaser rules card drives payments: first sets the days late asked of Canvas, every sets the next due, off skips the Canvas read', () => {
  const t = payBox(); t.ctx.cueRulesSave({ 'payment.first': 10, 'payment.every': 5 }); t.at('2026-10-21', 10, 0); t.ctx.cueSweep();
  assert.strictEqual(t.log.bridge.filter(b => b.action === 'overdue_billings')[0].args.min_days_late, 10);
  t.ctx.cueApprove(batchOf(t).id, { send: true }); assert.strictEqual(chase(t).filter(r => r[1] === 'payment')[0][6], '2026-10-26');
  const u = payBox(); u.ctx.cueRulesSave({ 'payment.on': false }); u.ctx.cueSweep(); assert.ok(!u.log.overdue, 'paused: no Canvas read');
});

test('Q5 BSE\'s own supplier applications (accreditation, vendor registration) are not RFQs: left out of the search and never chased', () => {
  const mine = { bbbb0000000000b1: [gm('b1', PH('2026-10-12', 10), KIKO, 'karen@results.example', 'Request for Supplier Accreditation — Events Management & Technical Production | Blank Space Events OPC')],
    bbbb0000000000b2: [gm('b2', PH('2026-10-12', 10), KIKO, 'manila@state.example', 'Vendor Registration / Procurement Process Inquiry — Events & Technical Production')],
    bbbb0000000000b3: [gm('b3', PH('2026-10-12', 10), KIKO, 'supplier@dxc.example', 'Philippines event supplier accreditation — Blank Space Events OPC')] };
  const threads = Object.assign({}, RFQ_THREADS, mine), sent = Object.keys(threads).map(t => ({ id: threads[t][0].id, thread: t, ms: Number(threads[t][0].internalDate), to: '', subject: '', snippet: '' }));
  const t = rfqBox({ threads, sent, sentSearch: sent.filter(m => m.id !== 'cue-sent-1') }); t.ctx.cueSweep();
  deq(rfqBatch(t).batch.items.map(i => i.key), ['rfq:aaaa0000000000a6', 'rfq:aaaa0000000000a1']);
  assert.ok(/-subject:accreditation -subject:"vendor registration"/.test(t.log.gmailQ), t.log.gmailQ);
  deq(['RFQ | BEKO Booth', 'Request for Supplier Accreditation', 'Vendor Registration / Procurement Process Inquiry', 'Supplier enrollment form', 'Re: RFQ: LED wall'].map(x => t.ctx.cueRfqNotRfq_(x)), [false, true, true, true, false]);
});
test('Q1 finds only RFQs still waiting: 3 working days, no reply in or out of the thread, no draft waiting, project open, not muted by setting, outside BSE', () => {
  const t = rfqBox(); t.ctx.cueSweep(); const b = rfqBatch(t);
  assert.strictEqual(b.status, 'Needs you');
  deq(b.batch.items.map(i => [i.key, i.who, i.to, i.priority]), [['rfq:aaaa0000000000a6', 'SkyLights PH', 'hello@skylights.example', 'urgent'], ['rfq:aaaa0000000000a1', 'Sonic Pro', 'sales@sonicpro.example', 'normal']]);
  const sky = b.batch.items[0], sonic = b.batch.items[1];
  assert.strictEqual(sky.project, 'Acme Party', 'Canvas name for a thread Cue sent'); assert.ok(/event on 2026-10-25/.test(sky.why), sky.why);
  assert.strictEqual(sonic.project, 'LED wall 4x3', 'no Canvas link: the RFQ subject'); assert.ok(/No reply 3 working days after your RFQ/.test(sonic.why), sonic.why);
  assert.ok(/in:sent newer_than:30d \(RFQ OR RFQs OR RFP OR requote/.test(t.log.gmailQ) && /"quotation request"/.test(t.log.gmailQ), 'RFQ and RFP words (one S2 chaser, 31 Oct), not client quotations');
  assert.ok(t.log.threads.indexOf('aaaa0000000000a6') >= 0, 'Cue\'s own RFQ found by its sent message id, whatever its subject');
  assert.strictEqual(t.log.board, 1, 'one Canvas read'); assert.strictEqual(t.log.gpt.length, 0, 'no AI call: Kiko\'s S2 template (31 Oct)');
  assert.strictEqual(b.metrics.ai_calls, 0); assert.ok(!t.log.replies && !t.log.sent, 'nothing drafted or sent before Kiko approves');
});
test('Q2 approve and send: replies in the original thread (In-Reply-To the RFQ), logged; next nudge only 3 working days later; max 2 then Kiko decides', () => {
  const t = rfqBox(); t.at('2026-10-21', 10, 0); t.ctx.cueSweep();
  const v = t.ctx.cueApprove(rfqBatch(t).id, { send: true, skip: ['rfq:aaaa0000000000a6'] });
  assert.strictEqual(v.status, 'Done'); assert.strictEqual(t.log.replies.length, 1); assert.strictEqual(t.log.sent.length, 1);
  const p = t.log.replies[0].payload; assert.ok(p.indexOf('"threadId":"aaaa0000000000a1"') >= 0); assert.ok(/In-Reply-To: <r1@mail>/.test(p)); assert.ok(/To: sales@sonicpro\.example/.test(p));
  const row = chase(t).find(r => r[0] === 'rfq:aaaa0000000000a1'); assert.strictEqual(row[5], 1); assert.strictEqual(row[8], 'sent');
  for (const d of ['2026-10-22', '2026-10-23']) { t.at(d, 7, 0); t.ctx.cueSweep(); assert.ok(!(rfqBatch(t).batch || { items: [] }).items.some(i => i.key === 'rfq:aaaa0000000000a1'), d + ': inside 3 working days'); }
  t.at('2026-10-26', 10, 0); t.ctx.cueSweep(); const b = rfqBatch(t), it = b.batch.items.find(i => i.key === 'rfq:aaaa0000000000a1');
  assert.ok(it && /after your last nudge/.test(it.why), 'Mon 26: 3 working days after the nudge'); assert.ok(!b.batch.items.some(i => i.key === 'rfq:aaaa0000000000a6'), 'event passed: not chased');
  t.ctx.cueApprove(b.id, { send: true });
  t.at('2026-10-29', 7, 0); t.ctx.cueSweep(); const c = rfqBatch(t);
  deq(c.batch.stopped.map(i => [i.key, i.times]), [['rfq:aaaa0000000000a1', 2]]); deq(c.batch.items.map(i => i.key), ['rfq:aaaa0000000000a2'], 'only the Stage RFQ, due since Thu 22 and never approved');
});
test('Q3 Canvas down: a note, status and event dates unchecked, normal 3-day rule; Gmail without access: the kind is a note and the batch still comes', () => {
  const t = rfqBox({ boardFail: true }); t.ctx.cueSweep(); const b = rfqBatch(t);
  deq(b.batch.items.map(i => i.key).sort(), ['rfq:aaaa0000000000a1', 'rfq:aaaa0000000000a7'], 'no event date: SkyLights waits the normal 3 days; lost status unknown');
  assert.ok(b.notes.some(n => /Canvas did not answer/.test(n)));
  const u = rfqBox({ gmailScope: true }); u.ctx.cueSweep();
  assert.ok(u.tabs.Chat.rows.some(r => /nothing to chase today.*S2 RFQ and RFP chasers: could not check \(Cue does not have Gmail access/.test(r[2])));
});
test('Q4 template when ChatGPT fails: names the supplier, project, RFQ date and a reply-by two working days out', () => {
  const t = rfqBox({ fail: { chasers: () => resp(500, {}) } }); t.ctx.cueSweep(); const it = t.state(rfqBatch(t).id).batch.items.find(i => i.key === 'rfq:aaaa0000000000a1');
  assert.strictEqual(it.drafted_by, 'template'); assert.ok(/^Hi Sonic Pro,/.test(it.body));
  assert.ok(/Checking in on our request for LED wall 4x3\. Could you send your itemized quote by Friday 23 October\?/.test(it.body), it.body);
  assert.ok(/background:#CD5023/.test(it.html) && /\nThanks!\nKiko Dacanay\nBlank Space Events$/.test(it.body), 'S2: supplier banner, Kiko\'s sign-off');
  deq([t.ctx.cueWorkDays_('2026-10-16', '2026-10-21'), t.ctx.cueWorkDays_('2026-10-23', '2026-10-26'), t.ctx.cueRfqDay_('2026-10-24T16:00:00.000Z'), t.ctx.cueRfqDay_('12/5/2026')], [3, 1, '2026-10-25', '2026-12-05']);
});
