// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: task-scheduler.
// Task scheduler (Kiko 22 Oct 00:57Z "Go", specs/task-scheduler.md). Sandbox "now" is Wed 21 Oct 2026, 11:00 Manila (03:00Z).
const phMs = (day, hm) => Date.parse(day + 'T' + hm + ':00+08:00');
const sched = t => (t.tabs.Schedule ? t.tabs.Schedule.rows.slice(1) : []);
const schAsk = t => { const r = t.tabs.Chat.rows.filter(x => /^\?ask-/.test(String(x[3]))).pop(); return r ? String(r[3]).match(/^\?(ask-[0-9a-z]+)/)[1] : ''; };
test('SC1 the when is read in code: every/weekdays/monthly/once/in N, times in am-pm or 24h; a missing or passed time is asked, never guessed', () => {
  const t = sandbox(), now = Date.parse('2026-10-21T03:00:00Z'), P = x => JSON.parse(JSON.stringify(t.ctx.cueSchedParse_(x, now)));
  deq(P('every Monday 9am pipeline review'), { when: { repeat: 'weekly', days: ['Mon'], dom: 0, date: '', time: '09:00' }, rest: 'pipeline review' });
  deq(P('weekdays 8am check bids').when.repeat, 'weekdays'); deq(P('weekdays 8am check bids').rest, 'check bids');
  deq(P('Friday 3pm remind me to send the Telus invoice'), { when: { repeat: 'once', days: [], dom: 0, date: '2026-10-23', time: '15:00' }, rest: 'remind me to send the Telus invoice' });
  deq(P('15th of the month 4pm send the engagement email').when, { repeat: 'monthly', days: [], dom: 15, date: '', time: '16:00' });
  deq(P('16th day of the month at 9am moved contacts').when.dom, 16);
  deq(P('tomorrow 10am readiness for JBL Booth'), { when: { repeat: 'once', days: [], dom: 0, date: '2026-10-22', time: '10:00' }, rest: 'readiness for JBL Booth' });
  deq(P('every Tue and Thu at 9:30 am admin check').when.days, ['Tue', 'Thu']); deq(P('every Tue and Thu at 9:30 am admin check').when.time, '09:30');
  deq(P('daily 19:00 review my spending').when, { repeat: 'daily', days: [], dom: 0, date: '', time: '19:00' });
  deq(P('pipeline review every Monday at 9am').rest, 'pipeline review', 'the when can come after the command');
  deq(P('Wednesday 9am weekly plan').when.date, '2026-10-28', 'today is Wednesday and 9am has passed: next week');
  deq(P('in 2 hours remind me to call Ana').when, { repeat: 'once', days: [], dom: 0, date: '2026-10-21', time: '13:00' });
  assert.ok(/when/.test(P('pipeline review').error)); assert.ok(/What time/.test(P('every Monday pipeline review').error));
  assert.ok(/already passed/.test(P('today 9am pipeline review').error));
  assert.strictEqual(t.ctx.cueSchedNextAt_({ repeat: 'monthly', dom: 31, days: [], time: '09:00' }, phMs('2026-11-01', '00:00')), phMs('2026-11-30', '09:00'), 'a 31st runs on a short month\'s last day');
  assert.strictEqual(t.ctx.cueSchedNextAt_({ repeat: 'weekdays', days: [], time: '08:00' }, phMs('2026-10-23', '09:00')), phMs('2026-10-26', '08:00'), 'Friday after 8: Monday');
});
test('SC2 "Schedule every Monday 9am pipeline review": no AI call, a Save card; Save makes one row, Not that makes none; intake is refused', () => {
  const t = sandbox(); t.ctx.cueSend('Schedule every Monday 9am pipeline review');
  assert.strictEqual(t.log.gpt.length + t.log.claude.length, 0, 'no AI call');
  const q = t.tabs.Chat.rows.filter(r => /^\?ask-/.test(String(r[3]))).pop();
  assert.ok(/:save,not$/.test(q[3]) && /Mon 09:00/.test(q[2]) && /First run: Mon 2026-10-26 09:00/.test(q[2]) && /Pipeline review/.test(q[2]) && /Nothing sends without your Approve/.test(q[2]));
  assert.strictEqual(sched(t).filter(r => /^sch-/.test(r[0])).length, 0, 'nothing saved before Save');
  t.ctx.cueAskPick(schAsk(t), 'save');
  const row = sched(t).filter(r => /^sch-/.test(r[0]));
  assert.strictEqual(row.length, 1); deq([row[0][1], row[0][3], row[0][4], row[0][7], row[0][9], row[0][10]], ['Pipeline review', 'weekly', 'Mon', "'09:00", 'pipeline', true]);   // PC test 01:41Z: written as text so Sheets keeps it a time of day, not a date
  assert.strictEqual(row[0][11].getTime(), phMs('2026-10-26', '09:00'));
  assert.ok(/^Saved\. Pipeline review, Mon 09:00\. Next run Mon 2026-10-26 09:00/.test(t.tabs.Chat.rows.slice(-1)[0][2]));
  assert.throws(() => t.ctx.cueAskPick(schAsk(t), 'save'), /already answered/);
  t.ctx.cueSend('Schedule tomorrow 9am check bids'); t.ctx.cueAskPick(schAsk(t), 'not');
  assert.strictEqual(sched(t).filter(r => /^sch-/.test(r[0])).length, 1); assert.ok(/not scheduled/.test(t.tabs.Chat.rows.slice(-1)[0][2]));
  const n = t.tabs.Chat.rows.length; t.ctx.cueSend('Schedule tomorrow 9am run intake for Acme');
  assert.ok(/Intake cannot be scheduled/.test(t.tabs.Chat.rows.slice(-1)[0][2])); assert.ok(!t.tabs.Chat.rows.slice(n).some(r => /^\?ask-/.test(String(r[3]))), 'no Save card');
  t.ctx.cueSend('Schedule pipeline review'); assert.ok(/could not tell when/.test(t.tabs.Chat.rows.slice(-1)[0][2]));
  t.ctx.cueSend('show my schedules'); const l = t.tabs.Chat.rows.slice(-1)[0][2];
  assert.ok(/Morning sweep: Daily 07:00/.test(l) && /Bid opportunities: Daily 07:00/.test(l) && /Monday HubSpot check: Mon 06:00/.test(l) && /Pipeline review: Mon 09:00, next Mon 2026-10-26 09:00/.test(l) && /HubSpot sales review: Thu 08:00, off/.test(l));
  assert.strictEqual(t.log.gpt.length + t.log.claude.length, 0, 'still no AI call');
});
test('SC3 the 5-minute tick starts due rows once: a reminder fires, a one-time row turns off; nothing due means the sheet is not even read', () => {
  const t = sandbox(); t.ctx.cueSend('Schedule in 1 hour remind me to call Ana'); t.ctx.cueAskPick(schAsk(t), 'save');
  t.ctx.cueResume(); assert.ok(!t.tabs.Chat.rows.some(r => /⏰ Reminder/.test(r[2])), 'not yet');
  const read = t.tabs.Schedule.getRange; t.tabs.Schedule.getRange = () => { throw new Error('read while nothing is due'); };
  deq(t.ctx.cueSchedTick_(), [], 'nothing due: the property alone answers'); t.tabs.Schedule.getRange = read;
  t.ctx.__wait(61 * 60000); t.ctx.cueResume();
  assert.strictEqual(t.tabs.Chat.rows.filter(r => r[2] === '⏰ Reminder: call Ana').length, 1);
  const r = sched(t).filter(x => /^sch-/.test(x[0]))[0]; assert.strictEqual(r[10], false); assert.strictEqual(r[13], 'Reminded');
  t.ctx.__wait(5 * 60000); t.ctx.cueResume(); assert.strictEqual(t.tabs.Chat.rows.filter(r => r[2] === '⏰ Reminder: call Ana').length, 1, 'once');
});
test('SC4 system rows: the 07:00 bid check starts from its row once a day, says when it is late, and never runs twice with the old trigger', () => {
  const t = sandbox(); t.ctx.cueState();
  const v = t.ctx.cueSchedules().filter(x => !/^sys-gt-/.test(x.id)); deq(v.map(x => [x.id, x.when, x.on]), [['sys-sweep', 'Daily 07:00', true], ['sys-bids', 'Daily 07:00', true], ['sys-hubspot', 'Mon 06:00', false], ['sys-pipeline', 'Thu 08:00', false], ['sys-funnel', 'Daily 07:00', true], ['sys-status', 'Fri 07:00', true], ['sys-funnelreview', 'Mon 07:00', false], ['sys-relnotes', 'Daily 19:45', true], ['sys-rfps', 'Every minute', true], ['sys-unsched', 'Daily 07:00', false]]);
  t.ctx.cueSchedSet('sys-sweep', { on: false });
  t.ctx.__wait(phMs('2026-10-22', '10:00') - Date.parse('2026-10-21T03:00:00Z')); t.ctx.cueResume();
  const bids = t.tabs.Requests.rows.slice(1).map(r => t.state(r[0])).filter(s => s.kind === 'bids');
  assert.strictEqual(bids.length, 1); assert.strictEqual(bids[0].how, 'daily'); assert.strictEqual(t.props.CUE_BIDS_DAY, '2026-10-22');
  const row = t.ctx.cueSchedules().filter(x => x.id === 'sys-bids')[0];
  assert.strictEqual(row.result, 'Started (late by 3 h)'); assert.strictEqual(row.task, bids[0].id); assert.strictEqual(row.next, 'Fri 2026-10-23 07:00');
  assert.strictEqual(t.ctx.cueBidsDaily(), null, 'an old 07:00 trigger firing after this does nothing');
  assert.ok(!t.tabs.Requests.rows.slice(1).some(r => t.state(r[0]).kind === 'sweep'), 'the sweep row is off');
});
test('SC5 Settings: on/off, a new time in words, Run now, Delete; Cue\'s own rows cannot be deleted; the sweep\'s hour is Chaser rules\' build hour', () => {
  const t = sandbox(); t.ctx.cueSend('Schedule every Monday 9am pipeline review'); t.ctx.cueAskPick(schAsk(t), 'save');
  const id = t.ctx.cueSchedules().filter(x => !x.system)[0].id;
  assert.strictEqual(t.ctx.cueSchedSet(id, { when: 'weekdays 8am' }).filter(x => x.id === id)[0].when, 'Weekdays 08:00');
  assert.throws(() => t.ctx.cueSchedSet(id, { when: 'weekdays 8am email Ana' }), /Only the time and days/);
  assert.strictEqual(t.ctx.cueSchedSet(id, { on: false }).filter(x => x.id === id)[0].next, '');
  assert.throws(() => t.ctx.cueSchedDelete('sys-bids'), /cannot be deleted|not deleted/);
  assert.throws(() => t.ctx.cueSchedSet('sys-sweep', { when: 'daily 6:30am' }), /on the hour/);
  t.ctx.cueSchedSet('sys-sweep', { when: 'daily 6am' }); assert.strictEqual(t.ctx.cueRules().general.build, 6);
  assert.strictEqual(t.ctx.cueSchedules().filter(x => x.id === 'sys-sweep')[0].when, 'Daily 06:00');
  const r = t.ctx.cueSchedRunNow(id).filter(x => x.id === id)[0]; assert.strictEqual(r.result, 'Started');
  assert.strictEqual(t.state(r.task).kind, 'pipeline');
  assert.strictEqual(t.ctx.cueSchedDelete(id).filter(x => x.id === id).length, 0);
  const s = sandbox({ viewer: 'someone@example.com' });
  ['cueSchedules', 'cueSchedRunNow', 'cueSchedSet', 'cueSchedDelete'].forEach(f => assert.throws(() => s.ctx[f]('sys-bids', {}), /private/, f));
});
test('SC6 the ChatGPT lead-gen and review tasks register as rows (off until Kiko turns them on) and run through cueGtScheduled', () => {
  const t = sandbox(); t.ctx.cueGtSchedules_ = () => [{ key: 'followups', name: 'Prospect follow-up check', repeat: 'weekdays', days: [], time: '08:00', command: 'Prospect follow-ups' },
    { key: 'monthly_email', name: 'Monthly engagement email', repeat: 'monthly', day_of_month: 15, time: '16:00', command: 'Monthly email' },
    { key: 'admin_payments', name: 'Admin Tuesday', repeat: 'weekly', days: ['Tue'], time: '09:00', command: 'Payment records' }];
  t.ctx.cueGtScheduled = k => { (t.log.gt = t.log.gt || []).push(k); return t.log.gt.length > 1 ? null : { request_id: 'cue-gt-1' }; };
  const v = t.ctx.cueSchedules().filter(x => /^sys-gt-/.test(x.id));
  deq(v.map(x => [x.name, x.when, x.on, x.runs]), [['Prospect follow-up check', 'Weekdays 08:00', false, 'ChatGPT'], ['Monthly engagement email', '15th monthly 16:00', false, 'ChatGPT'], ['Admin Tuesday', 'Tue 09:00', false, 'ChatGPT']]);
  t.ctx.__wait(24 * 3600000); t.ctx.cueResume(); assert.ok(!t.log.gt, 'off rows never run');
  t.ctx.cueSchedSet('sys-gt-followups', { on: true }); t.ctx.__wait(phMs('2026-10-23', '08:01') - phMs('2026-10-22', '11:00')); t.ctx.cueResume(); t.ctx.__wait(5 * 60000); t.ctx.cueResume(); t.ctx.__wait(5 * 60000); t.ctx.cueResume();   // 3 rows per tick (Friday 07:00 also has the status row)
  deq(t.log.gt, ['followups']); assert.strictEqual(t.ctx.cueSchedules().filter(x => x.id === 'sys-gt-followups')[0].task, 'cue-gt-1');
  assert.strictEqual(t.ctx.cueSchedRunNow('sys-gt-followups').filter(x => x.id === 'sys-gt-followups')[0].result, 'Already ran today');
});
test('SC7 any other command runs as if typed, even from the trigger with no page user; the result is the usual chat answer or task', () => {
  const t = sandbox({ viewer: 'nobody@example.com' }), x = { id: 'sch-1', name: 'How many projects', time: '09:00', command: 'how many projects this week?', run: 'say' };
  deq(JSON.parse(JSON.stringify(t.ctx.cueSchedResolve_('how many projects this week?'))), { run: 'say', text: 'how many projects this week?' });
  const out = t.ctx.cueSchedRun_(x, false); assert.strictEqual(out.result, 'Answered in chat'); assert.strictEqual(t.log.gpt.length, 1, 'one chat call, as when typed');
  assert.ok(t.tabs.Chat.rows.some(r => /^⏰ How many projects \(scheduled 09:00\)/.test(r[2])));
  assert.throws(() => t.ctx.cueSend('hello'), /private/, 'the page still checks the user');
  deq(['remind me to pay Sonic', 'run the morning sweep', 'check bids', 'pipeline review', 'clean up hubspot'].map(c => t.ctx.cueSchedResolve_(c).run), ['remind', 'sweep', 'bids', 'pipeline', 'hubspot']);
});
