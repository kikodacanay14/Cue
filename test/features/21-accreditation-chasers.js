// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: accreditation-chasers.
/* ---------- accreditation chasers (spec specs/accreditation-chasers.md, Kiko 08:22Z) ---------- */
const ACCR = { today: '2026-10-21', form_url: 'https://docs.google.com/forms/d/VAF/viewform', subject: 'Supplier accreditation · Blank Space Events', rows: [
  { supplier: 'Sonic Pro', kind: 'Corporation', missing: ['Business Permit', 'Bank details'], status: 'Form sent', opened: '2026-10-14', form_sent: '2026-10-15',
    sent_to: ['ben@sonic.example'], contact: { name: 'Ben Cruz', phone: '0917 111 2222' }, reminders: 0, last_reminder: '', replied_since: '', replied_by: '',
    project_id: 'S-1', project: 'Acme Gala', event_date: '2026-10-24', project_status: 'For Production Start', asks: [['Please have these ready', ['Your TIN']]] },
  { supplier: 'Build Co', kind: '', missing: ['TIN', 'Bank details'], status: 'Open', opened: '2026-10-20', form_sent: '', sent_to: ['hello@build.example'],
    contact: { name: '', phone: '' }, reminders: 0, last_reminder: '', replied_since: '', replied_by: '', project_id: '', project: '', event_date: '', asks: [['Everyone', ['Your TIN', 'Bank details']]] },
  { supplier: 'Fresh Co', missing: ['TIN'], status: 'Form sent', form_sent: '2026-10-20', sent_to: ['a@fresh.example'], contact: {}, reminders: 0, last_reminder: '', replied_since: '', project: 'Acme Gala', event_date: '2026-12-01', asks: [] },
  { supplier: 'Answered Co', missing: ['TIN'], status: 'Form sent', form_sent: '2026-10-10', sent_to: ['x@answered.example'], contact: {}, reminders: 1, last_reminder: '2026-10-14', replied_since: '2026-10-16', replied_by: 'form', project: '', event_date: '', asks: [] },
  { supplier: 'No Mail Co', missing: ['TIN'], status: 'Open', form_sent: '', sent_to: [], contact: { name: 'Ana', phone: '0918' }, reminders: 0, project: '', event_date: '', asks: [] }] };
const ACCR_MSGS = [{ id: 'acc1', thread: 'thr-sonic', ms: Date.parse('2026-10-15T03:00:00Z'), subject: 'Supplier accreditation · Blank Space Events · Acme Gala', from: 'BSE Suppliers <suppliers@blankspaceevent.com>', snippet: '' }];
const accrBox = (o = {}) => sweepBox(Object.assign({ accr: ACCR, msgs: ACCR_MSGS, gmailList: q => (/sonic/.test(q) ? ACCR_MSGS : []) }, o), null);
const accrItems = b => b.batch.items.filter(i => i.kind === 'accreditation');

test('AC1 accreditation: one line per open supplier; the form when never sent, a reminder 3 days after; urgent near the event; answered and no-email lines send nothing', () => {
  const t = accrBox(); t.ctx.cueSweep(); const b = batchOf(t), it = accrItems(b);
  deq(it.map(i => [i.key, i.who, i.priority, !!i.no_email]).sort(), [['accr-form:buildco', 'Build Co', 'normal', false], ['accr-form:nomailco', 'No Mail Co', 'normal', true],
    ['accr:answeredco', 'Answered Co', 'normal', true], ['accr:sonicpro', 'Sonic Pro', 'urgent', false]]);
  assert.ok(!it.some(i => i.who === 'Fresh Co'), 'form sent yesterday: not due until 3 days after');
  const sonic = t.state(b.id).batch.items.find(i => i.who === 'Sonic Pro');   // the card view leaves thread ids out
  deq([sonic.thread_id, sonic.message_id, sonic.to], ['thr-sonic', '<acc1@mail>', 'ben@sonic.example']);
  assert.ok(/0917 111 2222/.test(sonic.why) && /Event on 2026-10-24/.test(sonic.why));
  assert.ok(/answered on 2026-10-16 \(accreditation form\)/.test(it.find(i => i.who === 'Answered Co').why));
  assert.ok(/No email address on file/.test(it.find(i => i.who === 'No Mail Co').why));
  deq(it.filter(i => i.selected).map(i => i.who).sort(), ['Build Co', 'Sonic Pro'], 'only the sendable lines are ticked');
  assert.strictEqual(t.log.accrGaps, 1, 'one Canvas read');
  assert.ok(t.log.gmailQs.some(q => /subject:"Supplier accreditation".*from:ben@sonic\.example/.test(q)), 'looks for the thread in Kiko\'s Gmail');
});

test('AC2 a supplier reply in Kiko\'s Gmail after the last email turns the reminder into "read their documents"', () => {
  const reply = [{ id: 'acc2', thread: 'thr-sonic', ms: Date.parse('2026-10-17T03:00:00Z'), subject: 'Re: Supplier accreditation', from: 'Ben <ben@sonic.example>', snippet: '' }];
  const t = accrBox({ msgs: reply, gmailList: q => (/sonic/.test(q) ? reply : []) }); t.ctx.cueSweep();
  const s = accrItems(batchOf(t)).find(i => i.who === 'Sonic Pro');
  assert.ok(s.no_email && /They answered on 2026-10-17/.test(s.why));
});

test('AC3 drafts only: Kiko\'s Gmail draft replies in the accreditation thread, suppliers@ in CC; nothing is logged in Canvas', () => {
  const t = accrBox(); t.ctx.cueSweep(); const id = batchOf(t).id; t.ctx.cueApprove(id, { send: false });
  const raws = t.log.gmail; assert.strictEqual(raws.length, 2);
  const sonic = raws.find(r => /ben@sonic/.test(r)), body = Buffer.from(sonic.split('\r\n\r\n')[1], 'base64').toString('utf8');
  assert.ok(/^To: ben@sonic\.example\r\nCc: suppliers@blankspaceevent\.com\r\n/.test(sonic) && /In-Reply-To: <acc1@mail>/.test(sonic));
  assert.ok(body.indexOf('https://docs.google.com/forms/d/VAF/viewform') >= 0, 'the form link is always in');
  assert.ok(!t.log.accrLog, 'drafts are not logged in Canvas');
  assert.ok(!(t.log.sent || []).length, 'nothing sent');
});

test('AC4 approve and send at 9:00: Canvas re-checks, the email goes from Kiko\'s Gmail, Canvas logs it; a row closed since is not sent', () => {
  const t = accrBox({ accrClosed: ['Build Co'] }); t.ctx.cueSweep(); const id = batchOf(t).id; t.ctx.cueApprove(id, { send: true });
  assert.ok(!(t.log.sent || []).length, 'before 9:00 nothing goes');
  t.at('2026-10-21', 9, 5); t.ctx.cueSweepTick_();
  const b = batchOf(t), it = accrItems(b);
  deq(t.log.accrLog.map(a => [a.supplier, a.stage]), [['Sonic Pro', 'check'], ['Sonic Pro', 'sent'], ['Build Co', 'check']]);
  deq(t.log.accrLog[1].thread_id, 'thr-sonic');
  assert.strictEqual(t.log.sent.length, 1);
  assert.ok(/no longer missing anything/.test(it.find(i => i.who === 'Build Co').error));
  assert.ok(t.log.accrLog.every(a => !bridgeCheck('log_accreditation_reminder', a)), 'arguments fit the real bridge schema');
});

test('AC5 ChatGPT drops the form link: Cue puts it back; ChatGPT down: the template is used', () => {
  const t = accrBox(); t.ctx.cueSweep(); const id = batchOf(t).id; t.ctx.cueApprove(id, { send: false });
  assert.ok(t.log.gmail.every(r => Buffer.from(r.split('\r\n\r\n')[1], 'base64').toString('utf8').indexOf('/forms/d/VAF/viewform') >= 0));
  const u = accrBox({ fail: { chasers: () => resp(500, {}) } }); u.ctx.cueSweep();
  const f = accrItems(batchOf(u)).find(i => i.who === 'Build Co');
  assert.ok(f.drafted_by === 'template' && /Vendor Accreditation Form/.test(f.body) && /- Bank details/.test(f.body));
});

test('AC7 a form Kiko sent by hand from a Drafts-only batch counts as sent: no second form, a reminder 3 days later', () => {
  const mine = [{ id: 'acc3', thread: 'thr-build', ms: Date.parse('2026-10-21T02:00:00Z'), subject: 'Supplier accreditation · Blank Space Events', from: 'Kiko <kiko@example.com>', snippet: '' }];
  const box = () => accrBox({ msgs: mine, gmailList: q => (/build/.test(q) ? mine : []) });
  const t = box(); t.at('2026-10-22', 7, 0); t.ctx.cueSweep();
  assert.ok(!accrItems(batchOf(t)).some(i => i.who === 'Build Co'), 'sent yesterday by hand: nothing today');
  const u = box(); u.at('2026-10-24', 7, 0); u.ctx.cueSweep();
  deq(accrItems(batchOf(u)).filter(i => i.who === 'Build Co').map(i => i.key), ['accr:buildco']);
});

test('AC6 Canvas down: the other kinds still run and the batch says accreditation could not be checked', () => {
  const t = sweepBox({ accrFail: true }); t.ctx.cueSweep(); const b = batchOf(t);
  assert.ok(b.batch.items.length > 0 && b.notes.some(n => /Accreditation chasers: could not check/.test(n)));
});
