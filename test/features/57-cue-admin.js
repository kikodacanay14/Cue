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
  deq([...nav.matchAll(/data-s="([a-z]+)"/g)].map(m => m[1]), ['rules', 'procs', 'tutor', 'chasers', 'triage', 'auto', 'jobchasers', 'sendnotice', 'sched', 'rn', 'log', 'conn', 'usage']);   // release line: AI relay is not live yet, so it has no button here
  ['triage', 'rn'].forEach(s => assert.ok(page.includes('<section data-sec="' + s + '" hidden>'), s));
  assert.ok(/view === 'admin'/.test(page) && /'\?view=admin'/.test(page), 'admin view and the Settings button link');
});

/* CUE-ADMIN-2-2026-10-29 (Kiko 29 Oct 03:17Z-03:21Z): descriptions on Chaser rules, Scheduled tasks and AI relay, the Auto-send list,
 * "Processes and business rules", and Jobs › Chasers (chaser > lined-up chases with time and sender > draft). */

test('AD5 Jobs › Chasers: each chaser kind with its sender, who it goes to and its email template, placeholders in angle brackets; read only', () => {
  const t = sandbox({ rfq: true, award: true });
  const J = JSON.parse(JSON.stringify(t.ctx.cueAdminChasers()));
  deq(J.kinds.map(k => k.kind), ['rfq', 'award', 'payment', 'accreditation', 'signature']);
  assert.ok(J.kinds.every(k => k.about && k.from && k.to && k.body), 'every chaser has a template');
  const r = J.kinds[0];
  deq([r.label, r.subject, r.ai], ['RFQ chasers', 'Re: RFQ: <RFQ title>', true]);
  assert.ok(/^Hi <Supplier name>,/.test(r.body) && r.body.includes('our RFQ for <Event>, sent on <RFQ date>'));
  assert.ok(J.kinds[4].body.includes('<FSA or AR> for <Event> (<Role>)') && J.kinds[4].ai === false, 'signature: fixed wording');
  deq([J.build, J.send], ['07:00', '09:00']);
  deq(t.log.sent || [], [], 'nothing is sent');
  assert.ok(fs.readFileSync(path.join(__dirname, '..', 'src', 'CueCheck.gs'), 'utf8').includes("'cueAdminChasers'"), 'never run by a cloud check');
});

test('AD6 Chaser rules and Scheduled tasks carry what each one is about; a task made in chat says Kiko made it and when', () => {
  const t = sandbox();
  const R = t.ctx.cueRules();
  deq(Object.keys(R.about), Object.keys(R.kinds), 'one line for every chaser on the card');
  assert.ok(Object.values(R.about).every(a => a.about && a.from));
  const S = t.ctx.cueSchedules(), sys = S.filter(x => x.system && !/^sys-gt-/.test(x.id));
  assert.ok(sys.length >= 9 && sys.every(x => x.about.about && /^Asked by Kiko/.test(x.about.asked) && x.about.follows.length && x.about.follows.every(f => f[0] && f[1])), 'every Cue task has an about line, and each Follows item says what it means');
  const sh = t.tabs.Schedule; sh.appendRow(['sch-1', 'Invoice reminder', 'user', 'once', '', '', '2026-10-30', '15:00', 'remind me to send the invoice', 'remind', true, '', '', '', '', new Date('2026-10-23T02:00:00Z')]);
  const u = t.ctx.cueSchedules().filter(x => x.id === 'sch-1')[0];
  deq([u.about.asked, u.about.follows[0][0]], ['Made by Kiko in chat, 23 Oct', 'Reminder']);
});

test('AD7 the page shows the Auto-send rules with each message, the channel icons, the AI relay ? and "Processes and business rules"', () => {
  // release line: AI relay is not live yet, so its ? help and Pass on words are not on this page
  const page = cuePage();
  ['Processes and business rules', 'Canvas sends these by itself', '3 days before the crew member', 'made 2 days before Payment Date Required', 'Support Desk › Freelancers › Waiting for approval',
    'Payment received: &lt;Amount&gt;', 'class="adesc"', 'type="checkbox" disabled checked', 'Please sign your Freelancer Service Agreement', 'aria-label="Email"', 'aria-label="Text"', 'aria-label="App notice"',
    'data-sc-x', 'press <b>Change time</b>'].forEach(w => assert.ok(page.includes(w), w));
});

/* CUE-ADMIN-LOG-2026-10-29 (Kiko 29 Oct 03:43Z "It has to be all not split"; 03:46Z "a Historical or Log page? filtered by the different
 * Jobs. and Status"): Cue Admin › Log. */

test('AD8 Log lists the Job Runs tab newest first in Manila time, with every job name and status to filter on; read only', () => {
  const t = sandbox(), sh = t.ctx.cueSheet_('Job Runs');
  sh.appendRow(['2026-10-28T23:00:00.000Z', '2026-10-28T23:00:04.000Z', 'New mail', 'OK', '', 3]);
  sh.appendRow(['2026-10-29T01:05:00.000Z', '2026-10-29T01:05:01.000Z', 'CRM email log', 'Failed', 'HubSpot said 401', '']);
  sh.appendRow(['2026-10-29T01:10:00.000Z', '2026-10-29T01:10:00.000Z', 'Old job', 'OK', '', '']);
  const L = JSON.parse(JSON.stringify(t.ctx.cueAdminLog()));
  deq(L.rows.map(x => [x.job, x.status, x.time, x.from]), [['Old job', 'OK', '09:10', 'Cue'], ['CRM email log', 'Failed', '09:05', 'Cue'], ['New mail', 'OK', '07:00', 'Cue']]);
  deq([L.rows[1].error, L.rows[2].count, L.rows[2].secs], ['HubSpot said 401', '3', 4]);
  assert.ok(L.jobs.includes('Schedules') && L.jobs.includes('Old job'), 'every job in this build, and any job named in the tab');
  assert.ok(fs.readFileSync(path.join(__dirname, '..', 'src', 'CueCheck.gs'), 'utf8').includes("'cueAdminLog'"), 'never run by a cloud check');
  deq([L.canvas_error, L.failed7], ['', 0]);
  const page = cuePage();
  ['<section data-sec="log" hidden>', 'data-log="job"', 'data-log="status"', "call('cueAdminLog'"].forEach(w => assert.ok(page.includes(w), w));
});

test('AD9 Log adds every Canvas email and text (sent_log, 30 days) in time order, with Canvas\'s failed count and text credit; a Canvas miss keeps the Cue rows', () => {
  const t = sandbox({ sentLog: { days: 30, failed7: 1, sms_credit: 1240, rows: [
    { at: '2026-10-29 09:06', job: 'Payment sent', kind: 'Payment', channel: 'text', to: '639170000000', name: 'Crew B', project: 'Gala', project_id: 'P-1', subject: '', by: 'info@', status: 'Failed', error: 'number not reachable' },
    { at: '2026-10-29 08:00', job: 'Final reminder', kind: 'Final', channel: 'email', to: 'd@example.com', name: 'Crew D', project: 'Launch', project_id: 'P-2', subject: 'Final reminder: Launch', by: 'info@', status: 'No address', error: '' }] } });
  const sh = t.ctx.cueSheet_('Job Runs');
  sh.appendRow(['2026-10-29T00:30:00.000Z', '2026-10-29T00:30:02.000Z', 'New mail', 'OK', '', 2]);
  const L = JSON.parse(JSON.stringify(t.ctx.cueAdminLog()));
  deq(t.log.sentLog, [{ days: 30 }]);
  deq(L.rows.map(x => [x.time, x.from, x.job, x.status]), [['09:06', 'Canvas', 'Payment sent', 'Failed'], ['08:30', 'Cue', 'New mail', 'OK'], ['08:00', 'Canvas', 'Final reminder', 'No address']]);
  deq([L.rows[0].channel, L.rows[0].name, L.rows[0].error, L.failed7, L.sms_credit], ['text', 'Crew B', 'number not reachable', 1, 1240]);
  deq(L.statuses, ['OK', 'Failed', 'No address']);
  assert.ok(L.jobs.includes('Payment sent') && L.jobs.includes('Final reminder'));
  const t2 = sandbox({ sentLogFail: true }); t2.ctx.cueSheet_('Job Runs').appendRow(['2026-10-29T00:30:00.000Z', '2026-10-29T00:30:02.000Z', 'New mail', 'OK', '', 2]);
  const L2 = JSON.parse(JSON.stringify(t2.ctx.cueAdminLog()));
  deq(L2.rows.map(x => x.job), ['New mail']); assert.ok(/unknown action/.test(L2.canvas_error));
});
