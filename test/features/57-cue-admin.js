// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: Cue Admin.
/* CUE-ADMIN-2026-10-29 (Kiko 29 Oct 02:13Z-02:42Z; Epic Cue #193, stories #194-#197): ?view=admin shows the Settings sections as one
 * full page in Canvas's look, with two new sections (Triage rules, Release notes); the chat's Settings button opens it in a new tab. */

test('AD1 Triage rules lists the tab newest first, and Remove takes off only the row it names', () => {
  const t = sandbox(), sh = t.tabs['Triage rules'];
  sh.appendRow(['promo@shop.example', 'mute', new Date('2026-10-22T02:00:00Z'), 'promos']);
  sh.appendRow(['@bank.example', 'keep', new Date('2026-10-24T02:00:00Z'), 'bills']);
  sh.appendRow(['promo@shop.example', 'no_inquiry', new Date('2026-10-26T02:00:00Z'), '']);
  const L = t.ctx.cueAdminTriage();
  deq(L.map(x => [x.sender, x.rule, x.set, x.why]), [['promo@shop.example', 'no_inquiry', '26 Oct', ''], ['@bank.example', 'keep', '24 Oct', 'bills'], ['promo@shop.example', 'mute', '22 Oct', 'promos']]);
  const after = t.ctx.cueAdminTriageDel(L[2].key);
  deq(after.map(x => x.rule), ['no_inquiry', 'keep']);
  deq(sh.rows.slice(1).map(r => r[1]), ['keep', 'no_inquiry'], 'the same sender\'s other rule stays');
  deq(t.ctx.cueAdminTriageDel('nobody@x|1').length, 2, 'an unknown row removes nothing');
});

test('AD2 Release notes lists the Release Notes tab newest first, read only', () => {
  const t = sandbox();
  deq(t.ctx.cueAdminRelnotes(), [], 'no tab yet: an empty list, and the tab is made');
  const sh = t.tabs['Release Notes'];
  sh.appendRow(['a', 'Canvas', 'Supplier pages', '2026-10-21 05:10Z', '2026-10-21', 'T1', 'Posted', 'ANN-0011', '']);
  sh.appendRow(['b', 'Cue', 'Cue 1.27.62', '2026-10-28 09:00Z', '2026-10-28', 'T2', 'Skipped', '', '']);
  deq(t.ctx.cueAdminRelnotes().map(x => [x.day, x.app, x.release, x.outcome, x.ann]), [['28 Oct', 'Cue', 'Cue 1.27.62', 'Skipped', ''], ['21 Oct', 'Canvas', 'Supplier pages', 'Posted', 'ANN-0011']]);
});

test('AD3 the admin calls are owner-only, never run by a cloud check, and the page state carries the app address', () => {
  const t = sandbox();
  const never = fs.readFileSync(path.join(__dirname, '..', 'src', 'CueCheck.gs'), 'utf8').match(/const CUE_CHECK_NEVER_ = \[([\s\S]*?)\];/)[1];
  ['cueAdminTriage', 'cueAdminTriageDel', 'cueAdminRelnotes'].forEach(f => assert.ok(never.includes("'" + f + "'"), f));
  assert.ok('app_url' in t.ctx.cueState());
});

test('AD4 the page groups the sections as in the approved mockup and has the two new ones', () => {
  const page = cuePage(), nav = page.slice(page.indexOf('id="snav"'), page.indexOf('<div class="smain">'));
  deq([...nav.matchAll(/class="sgrp">([^<]+)</g)].map(m => m[1]), ['How Cue thinks', 'Rules', 'Jobs', 'System']);
  deq([...nav.matchAll(/data-s="([a-z]+)"/g)].map(m => m[1]), ['rules', 'procs', 'tutor', 'chasers', 'triage', 'auto', 'jobchasers', 'sched', 'rn', 'conn', 'relay', 'usage']);
  ['triage', 'rn'].forEach(s => assert.ok(page.includes('<section data-sec="' + s + '" hidden>'), s));
  assert.ok(/view === 'admin'/.test(page) && /'\?view=admin'/.test(page), 'admin view and the Settings button link');
});

/* CUE-ADMIN-2-2026-10-29 (Kiko 29 Oct 03:17Z-03:21Z): descriptions on Chaser rules, Scheduled tasks and AI relay, the Auto-send list,
 * "Processes and business rules", and Jobs › Chasers (chaser > lined-up chases with time and sender > draft). */

test('AD5 Jobs › Chasers: each chaser kind with today\'s lines (when, sender, draft) and the ones lined up in the Chase log, read only', () => {
  const t = sweepBox({}, { kind: 'rfq' }); t.at('2026-10-21', 10, 0); t.ctx.cueSweep();
  const log = t.tabs['Chase log'];
  log.appendRow(['rfq:later1', 'rfq', 'Gala', 'Light Co', '2026-10-20', 1, '2026-10-24', false, 'draft']);
  log.appendRow(['rfq:done1', 'rfq', 'Gala', 'Max Co', '2026-10-20', 2, '2026-10-24', false, 'draft']);
  log.appendRow(['rfq:muted', 'rfq', 'Gala', 'Mute Co', '2026-10-20', 1, '2026-10-24', true, '']);
  const J = JSON.parse(JSON.stringify(t.ctx.cueAdminChasers()));
  deq(J.kinds.map(k => k.kind), ['rfq', 'award', 'payment', 'accreditation', 'signature']);
  const r = J.kinds[0];
  deq([r.label, r.from, r.lines.length > 0], ['RFQ chasers', 'your Gmail, as a reply in the RFQ thread', true]);
  assert.ok(r.lines.every(x => x.when === 'Today, 09:00 once you Approve' && typeof x.body === 'string'), 'today: the send time and the draft');
  deq(r.next.map(x => [x.who, x.when]), [['Light Co', '24 Oct, in the 07:00 batch']], 'max reached (2 of 2) and muted lines are left out');
  deq([J.batch.status, J.send, J.build], ['Needs you', '09:00', '07:00']);
  deq(t.log.sent || [], [], 'nothing is sent');
  assert.ok(fs.readFileSync(path.join(__dirname, '..', 'src', 'CueCheck.gs'), 'utf8').includes("'cueAdminChasers'"), 'never run by a cloud check');
});

test('AD6 Chaser rules and Scheduled tasks carry what each one is about; a task made in chat says Kiko made it and when', () => {
  const t = sandbox();
  const R = t.ctx.cueRules();
  deq(Object.keys(R.about), Object.keys(R.kinds), 'one line for every chaser on the card');
  assert.ok(Object.values(R.about).every(a => a.about && a.from));
  const S = t.ctx.cueSchedules(), sys = S.filter(x => x.system && !/^sys-gt-/.test(x.id));
  assert.ok(sys.length >= 9 && sys.every(x => x.about.about && /^Asked by Kiko/.test(x.about.asked) && x.about.follows.length), 'every Cue task has an about line');
  const sh = t.tabs.Schedule; sh.appendRow(['sch-1', 'Invoice reminder', 'user', 'once', '', '', '2026-10-30', '15:00', 'remind me to send the invoice', 'remind', true, '', '', '', '', new Date('2026-10-23T02:00:00Z')]);
  const u = t.ctx.cueSchedules().filter(x => x.id === 'sch-1')[0];
  deq([u.about.asked, u.about.follows[0]], ['Made by Kiko in chat, 23 Oct', 'Reminder']);
});

test('AD7 the page shows the Auto-send rules, the AI relay description and "Processes and business rules"', () => {
  const page = cuePage();
  ['Processes and business rules', 'Canvas sends these by itself', '3 days before the crew member', 'made 2 days before Payment Date Required', 'Support Desk › Freelancers › Waiting for approval',
    'A mailbox inside Cue where ChatGPT and Claude leave notes', 'data-jc-open'].forEach(w => assert.ok(page.includes(w), w));
});
