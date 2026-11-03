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

// CUE-TEMPLATES-2026-10-31: a draft is text plus the designed html now; this reads its text part (or the whole body of a plain one).
const mimeText = r => { const m = String(r).match(/Content-Type: text\/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n([A-Za-z0-9+\/=\r\n]+)/); return m ? Buffer.from(m[1].replace(/\r\n/g, ''), 'base64').toString('utf8') : ''; };
test('AC3 drafts only: Kiko\'s Gmail draft replies in the accreditation thread, suppliers@ in CC; nothing is logged in Canvas', () => {
  const t = accrBox(); t.ctx.cueSweep(); const id = batchOf(t).id; t.ctx.cueApprove(id, { send: false });
  const raws = t.log.gmail; assert.strictEqual(raws.length, 2);
  const sonic = raws.find(r => /ben@sonic/.test(r)), body = mimeText(sonic);
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
  assert.ok(t.log.gmail.every(r => mimeText(r).indexOf('/forms/d/VAF/viewform') >= 0));
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
test('AC8 no-reply senders are never emailed: dropped from To and from the Gmail search; a supplier with only a no-reply address is a call line', () => {
  const rows = ACCR.rows.map(r => r.supplier === 'Build Co' ? Object.assign({}, r, { sent_to: ['message-service@sender.zohoinvoice.com', 'Heidi@Build.example'] })
    : r.supplier === 'Fresh Co' ? Object.assign({}, r, { form_sent: '', sent_to: ['noreply@fresh.example', 'bounce@mailer.fresh.example'] }) : r);
  const t = accrBox({ accr: Object.assign({}, ACCR, { rows }) }); t.ctx.cueSweep(); const st = t.state(batchOf(t).id).batch.items;
  deq(st.find(i => i.who === 'Build Co').to, 'heidi@build.example');
  const fresh = accrItems(batchOf(t)).find(i => i.who === 'Fresh Co');
  assert.ok(fresh.no_email && /No email address on file/.test(fresh.why), 'only no-reply addresses: nothing to email');
  assert.ok(!t.log.gmailQs.some(q => /zohoinvoice|noreply@|mailer\.fresh/.test(q)), 'no-reply addresses are not searched either');
  deq(['no-reply@x.example', 'do-not-reply@x.example', 'mailer-daemon@x.example', 'notifications@x.example', 'a@sender.zohoinvoice.com', 'ben@sonic.example', 'replies@x.example']
    .map(e => t.ctx.cueNoReply_(e)), [true, true, true, true, true, false, false]);
});

test('AC9 the email never asks for an account number: a ChatGPT draft that does is replaced by the template, Canvas\'s ask list is cut to "Bank details", and Kiko\'s edit that asks is refused', () => {
  const rows = ACCR.rows.map(r => r.supplier === 'Build Co' ? Object.assign({}, r, { asks: [['Everyone', ['Your TIN', 'Bank details for payment (bank, account name and account number)']]] }) : r);
  const t = accrBox({ accr: Object.assign({}, ACCR, { rows }), chaserBody: x => 'Hi ' + x.facts.supplier + ', please send your bank, account name and account number. ' + x.facts.form_url });
  t.ctx.cueSweep(); const b = batchOf(t), st = t.state(b.id).batch.items.filter(i => i.kind === 'accreditation' && !i.no_email);
  assert.ok(st.length === 2 && st.every(i => i.drafted_by === 'template'), 'ChatGPT asked for the account number: template used');
  assert.ok(st.every(i => !/account (name|number|no)/i.test(i.body)), 'the template never asks either');
  const build = st.find(i => i.who === 'Build Co'); assert.ok(/- Bank details for payment\n/.test(build.body) || /- Bank details for payment$/m.test(build.body), build.body);
  // CUE-TEMPLATES-2026-10-31: no ChatGPT draft any more (Kiko's templates), so nothing is turned down and no note is needed
  const u = accrBox(); u.ctx.cueSweep(); u.at('2026-10-21', 10, 0);
  u.ctx.cueApprove(batchOf(u).id, { send: false, bodies: { 'accr-form:buildco': 'Hi, please reply with your account number. https://docs.google.com/forms/d/VAF/viewform' } });
  const e = u.state(batchOf(u).id).batch.items.find(i => i.who === 'Build Co');
  assert.ok(/never asks for an account number/.test(e.error), e.error); assert.ok(!u.log.gmail.some(r => /build\.example/.test(r)), 'no draft made');
  deq(['Please send your acct. no.', 'Account No: ___', 'your account name please', 'send your bank details', 'Account #'].map(x => t.ctx.cueAccrAsksAccount_(x)), [true, true, true, false, true]);
});
/* ---------- project status fit (Kiko 28 Oct 04:46Z: "Cue - shouldnt ask or give tasks that should only be done for projects that are in a different status") ---------- */
test('PS1 the map: each chaser kind fits only the Canvas phases it belongs to; Canvas\'s phase wins, unknown or blank status is kept', () => {
  const t = sandbox(), fit = (k, st, ad, ph) => t.ctx.cueStatusFits_(k, { status: st, admin: ad, phase: ph });
  assert.ok(fit('rfq', 'For CE Creation') && fit('rfq', 'For Production Start') && !fit('rfq', 'For Service Invoicing') && !fit('rfq', 'Completed') && !fit('rfq', 'On Hold') && !fit('rfq', 'Cancelled'));
  assert.ok(fit('award', 'For Client Awarding') && !fit('award', 'For Event Execution') && !fit('award', 'Not Awarded'));
  assert.ok(fit('accreditation', 'For Production Start') && fit('accreditation', 'For Project Review') && !fit('accreditation', 'Completed') && !fit('accreditation', 'Cancelled') && !fit('accreditation', 'Not Awarded'));
  assert.ok(fit('signature', 'For Event Execution') && fit('signature', 'Completed') && !fit('signature', 'On Hold') && !fit('signature', 'Canceled'));
  assert.ok(fit('payment', 'Cancelled') && fit('payment', 'On Hold') && fit('payment', 'Completed'), 'money owed is chased whatever the status');
  assert.ok(fit('rfq', '', '') && fit('rfq', 'For Event Proper') && fit('accreditation', 'Closed Lost'), 'blank or unknown status: kept (the kind\'s own checks still apply)');
  assert.ok(!fit('rfq', '', 'Cancelled'), 'blank PROJECT STATUS: ADMIN STATUS decides, as on the Canvas board');
  assert.ok(!fit('rfq', 'For CE Creation', '', 'Complete'), 'the phase Canvas sends wins');
  assert.ok(fit('rfq', 'For Event Proper', '', 'Other Status'), 'Canvas files an unknown status under Other Status: still kept');
  assert.ok(fit('nudge', 'Cancelled'), 'a kind with no project (inbox, HubSpot) is never filtered');
});
test('PS2 accreditation: a supplier on a cancelled, not awarded or completed project gets no line; a note says how many were left out and why', () => {
  const rows = ACCR.rows.map(r => r.supplier === 'Sonic Pro' ? Object.assign({}, r, { project_status: 'Cancelled' })
    : r.supplier === 'Fresh Co' ? Object.assign({}, r, { project_id: 'S-9', project_status: 'Completed', form_sent: '2026-10-10' }) : r);
  const t = accrBox({ accr: Object.assign({}, ACCR, { rows }) }); t.ctx.cueSweep(); const b = batchOf(t), it = accrItems(b);
  assert.ok(!it.some(i => /Sonic Pro|Fresh Co/.test(i.who)), it.map(i => i.who).join());
  assert.ok(it.some(i => i.who === 'Build Co'), 'no project: kept');
  assert.ok(b.notes.some(n => /Left out 2 lines whose project status does not fit: S1 Accreditation chasers for Acme Gala \(Cancelled\), S1 Accreditation chasers for Acme Gala \(Completed\)/.test(n)), b.notes.join(' | '));
  assert.ok(!t.log.board, 'the rows carry the status: no extra Canvas read');
});
test('PS3 RFQ: a supplier quote on a project in Closure, Complete or On Hold is not chased; a live project still is', () => {
  const t = rfqBox({ projects: [{ id: 'S-1', name: 'Acme Party', status: 'For Service Invoicing', phase: 'Closure', date: '2026-10-25' }, { id: 'S-2', name: 'Beta Expo', status: 'Closed Lost', date: '2026-11-20' }] });
  t.ctx.cueSweep(); const b = rfqBatch(t);
  deq(b.batch.items.map(i => i.key), ['rfq:aaaa0000000000a1'], 'SkyLights (Acme Party, now invoicing) left out; the unlinked RFQ stays');
  assert.ok(b.notes.some(n => /Left out 1 line whose project status does not fit: S2 RFQ and RFP chasers for Acme Party \(For Service Invoicing\)/.test(n)), b.notes.join(' | '));
  assert.strictEqual(t.log.board, 1, 'still one Canvas read');
});
test('PS4 signature: crew papers on an On Hold project are not chased; payment chasers keep a cancelled project\'s overdue BI', () => {
  const t = signBox({ unsigned: UNSIGNED.map(d => d.name === 'Ana Cruz' ? Object.assign({}, d, { project_status: 'On Hold' }) : d) }); t.at('2026-11-15', 7, 0); t.ctx.cueSweep();
  const b = batchOf(t); assert.ok(!b.batch.items.some(i => i.who === 'Ana Cruz')); assert.ok(b.batch.items.some(i => i.who === 'Dee Paz')); assert.ok(!t.log.board, 'no board read');
  const p = payBox({ projects: [{ id: 'S-31628060SP', name: 'Synthetic Expo', status: 'Cancelled' }] }); p.ctx.cueSweep();
  assert.ok(payItems(p).some(i => i.who === 'Fe Santos'), 'BI still owed'); assert.ok(!p.log.board, 'payment needs no status read');
});
test('PS5 Canvas board down: lines that need a status read are kept, with one note; the batch still comes', () => {
  const t = sweepBox({ boardFail: true, accr: { today: '2026-10-21', rows: [] } }, null);
  t.ctx.cueKind_({ kind: 'rfq', label: 'RFQ chasers', every: 3, max: 2, template: it => ({ subject: 'x', body: 'y' }),
    find: () => [{ key: 'rfq:dddddddddddddddd', project: 'Acme Party', project_id: 'S-1', who: 'Sonic Pro', to: 's@sonic.example', why: 'No quote', due_since: '2026-10-18' }] });
  t.ctx.cueSweep(); const b = batchOf(t);
  assert.ok(b.batch.items.some(i => i.key === 'rfq:dddddddddddddddd'));
  assert.ok(b.notes.some(n => /Project status could not be read from Canvas/.test(n)), b.notes.join(' | '));
});
