// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: sweep-engine.
/* ---------- sweep engine + task basics (spec specs/sweep-engine.md, Kiko 07:31Z) ---------- */
const PH = (day, hh, mm) => Date.parse(day + 'T' + String(hh).padStart(2, '0') + ':' + String(mm || 0).padStart(2, '0') + ':00+08:00');
function sweepBox(o = {}, kind) {
  const t = sandbox(o); let T = PH('2026-10-21', 7, 0); t.at = (d, h, m) => { T = PH(d, h, m); }; t.ctx.cueNow_ = () => T;
  if (kind !== null) t.ctx.cueKind_(Object.assign({ kind: 'nudge', label: 'RFQ chasers', every: 3, max: 2, draftBrief: 'Ask for the quote.',
    template: it => ({ subject: 'Quote for ' + it.project, body: 'Template nudge for ' + it.who }),
    find: ctx => { const b = ctx.board(); return (o.items || [
      { key: 'rfq:aaaaaaaaaaaaaaaa', project: b.projects[0].name, who: 'Sonic Pro', to: 'sales@sonicpro.example', thread_id: 'aaaaaaaaaaaaaaaa', message_id: '<m1@mail>', thread_subject: 'RFQ: LED wall', why: 'No quote after 3 days', due_since: '2026-10-18' },
      { key: 'rfq:bbbbbbbbbbbbbbbb', project: b.projects[0].name, who: 'Mats Co', to: 'hi@mats.example', why: 'No quote after 4 days', due_since: '2026-10-17' },
      { key: 'rfq:cccccccccccccccc', project: b.projects[0].name, who: 'No Mail Co', to: '', why: 'No quote', due_since: '2026-10-19' }]); } }, kind || {}));
  return t;
}
const chase = t => (t.tabs['Chase log'] ? t.tabs['Chase log'].rows.slice(1) : []);
const batchOf = t => t.ctx.cueState().requests.filter(r => r.kind === 'sweep')[0];

test('S1 Cue has two triggers, the 5-minute resume and the 1-minute RFP sender (28 Oct), installed by setup and when Cue opens (the 07:00 sweep is a Schedule row since the scheduler)', () => {
  const t = sandbox(); t.ctx.cueState();
  deq(t.log.triggers.slice(), ['cueResume', 'cueRfpKick']);
  t.ctx.cueSetup(); deq(t.log.triggers.slice(), ['cueResume', 'cueRfpKick'], 'not installed twice, and setup adds no Monday HubSpot trigger');
});
test('S2 nothing to chase: no card, one chat line, no AI call, no Canvas read when no kind asks', () => {
  const t = sweepBox({}, null); t.ctx.cueSweep();
  assert.ok(!batchOf(t) || batchOf(t).status === 'Done'); assert.strictEqual(t.log.gpt.length, 0); assert.ok(!t.log.board);
  assert.ok(t.tabs.Chat.rows.some(r => /nothing to chase today/.test(r[2])));
  t.ctx.cueSweep(); assert.strictEqual(t.tabs.Requests.rows.length, 2, 'the 07:00 trigger builds once a day');
});
test('S3 batch: one Canvas read, one ChatGPT call for all lines, threads kept, Needs you, nothing sent yet', () => {
  const t = sweepBox(); t.ctx.cueSweep(); const b = batchOf(t);
  assert.strictEqual(b.status, 'Needs you'); assert.strictEqual(t.log.board, 1); assert.strictEqual(t.log.gpt.length, 1); assert.strictEqual(b.metrics.ai_calls, 1);
  deq(b.batch.items.map(i => [i.who, i.selected, i.send_ok, i.in_thread]), [['Mats Co', true, true, false], ['Sonic Pro', true, true, true], ['No Mail Co', true, false, false]]);
  assert.ok(/GPT nudge for Sonic Pro about Acme Party/.test(b.batch.items[1].body)); assert.ok(!t.log.sent && !t.log.replies && !t.log.gmail.length, 'nothing sent or drafted');
  assert.ok(t.tabs.Chat.rows.some(r => r[3] === '>' + b.id && /Morning batch is ready: 3 RFQ chasers/.test(r[2])));
});
test('S4 approved before 9:00: drafts now, sent at 9:00 PH by the resume trigger, then not chased again for `every` days', () => {
  const t = sweepBox(); t.ctx.cueSweep(); const id = batchOf(t).id; t.at('2026-10-21', 7, 40);
  const v = t.ctx.cueApprove(id, { send: true, bodies: { 'rfq:bbbbbbbbbbbbbbbb': 'Edited by Kiko' } });
  assert.strictEqual(v.status, 'Scheduled'); assert.ok(!t.log.sent, 'not sent before 9');
  assert.strictEqual(t.log.replies.length, 1, 'Sonic Pro: a reply in its RFQ thread'); assert.strictEqual(t.log.gmail.length, 2, 'two new drafts (one with no email)');
  assert.ok(/Edited by Kiko|RWRpdGVkIGJ5IEtpa28/.test(t.log.gmail[0]));
  t.at('2026-10-21', 8, 59); t.ctx.cueResume(); assert.ok(!t.log.sent);
  t.at('2026-10-21', 9, 0); t.ctx.cueResume(); assert.strictEqual(t.log.sent.length, 2, 'the two with email go out; no-email stays a draft');
  const b = batchOf(t); assert.strictEqual(b.status, 'Done'); deq(b.batch.items.map(i => i.sent), [true, true, false]);
  deq(chase(t).map(r => [r[0], r[5], r[6], r[8]]).sort(), [['rfq:aaaaaaaaaaaaaaaa', 1, '2026-10-24', 'sent'], ['rfq:bbbbbbbbbbbbbbbb', 1, '2026-10-24', 'sent'], ['rfq:cccccccccccccccc', 1, '2026-10-24', 'draft']]);
  t.at('2026-10-22', 7, 0); t.ctx.cueSweep(); assert.ok(t.tabs.Chat.rows.some(r => /nothing to chase today/.test(r[2])), 'inside the 3-day window');
  t.at('2026-10-24', 7, 0); t.ctx.cueSweep(); const n = batchOf(t); assert.strictEqual(n.batch.items.length, 3); deq(n.batch.items.map(i => i.times), [1, 1, 1]);
});
test('S5 approved after 9:00 sends at once; a kind with sendAllowed false (payments) is drafts only even on Approve and send', () => {
  const t = sweepBox({}, { sendAllowed: false }); t.at('2026-10-21', 10, 0); t.ctx.cueSweep();
  const v = t.ctx.cueApprove(batchOf(t).id, { send: true }); assert.strictEqual(v.status, 'Done'); assert.ok(!t.log.sent, 'payments never sent');
  const u = sweepBox(); u.at('2026-10-21', 10, 0); u.ctx.cueSweep();
  assert.strictEqual(u.ctx.cueApprove(batchOf(u).id, { send: true, skip: ['rfq:cccccccccccccccc'] }).status, 'Done'); assert.strictEqual(u.log.sent.length, 2);
  assert.strictEqual(chase(u).length, 2, 'the skipped line is not logged as chased');
});
test('S5b a kind with its own send and draft hooks (payments from info@ via Canvas): no Gmail draft in Kiko\'s account; sent at 9:00 by the hook', () => {
  const sent = [], drafted = [];
  const t = sweepBox({}, { send: it => { sent.push(it.key); return 'canvas-' + it.key; }, draft: it => { drafted.push(it.key); return 'info-draft'; } });
  t.ctx.cueSweep(); const id = batchOf(t).id; t.ctx.cueApprove(id, { send: true, skip: ['rfq:cccccccccccccccc'] });
  assert.ok(!t.log.replies && !t.log.gmail.length, 'nothing in Kiko\'s Gmail'); assert.strictEqual(sent.length, 0, 'held for 9:00');
  t.at('2026-10-21', 9, 0); t.ctx.cueResume(); assert.strictEqual(sent.length, 2); assert.strictEqual(batchOf(t).status, 'Done');
  const u = sweepBox({}, { send: () => 'x', draft: it => { drafted.push(it.key); return 'info-draft'; } }); u.ctx.cueSweep();
  u.ctx.cueApprove(batchOf(u).id, { send: false }); assert.strictEqual(drafted.length, 3); assert.ok(!u.log.gmail.length);
});
test('S6 ChatGPT fails: every line gets its template and the batch still arrives (scheduled jobs never depend on ChatGPT)', () => {
  const t = sweepBox({ fail: { chasers: () => resp(400, { error: { message: 'bad' } }) } }); t.ctx.cueSweep(); const b = batchOf(t);
  assert.strictEqual(b.status, 'Needs you'); deq(b.batch.items.map(i => i.drafted_by), ['template', 'template', 'template']);
  assert.ok(/Template nudge for Mats Co/.test(b.batch.items[0].body)); assert.ok(b.notes.some(n => /templates used/.test(n)));
});
test('S7 chased the max times: Cue stops and flags it to Kiko once (Kiko 07:31Z)', () => {
  const t = sweepBox(); t.at('2026-10-21', 10, 0);
  for (const d of ['2026-10-21', '2026-10-24']) { t.at(d, 10, 0); t.ctx.cueSweep(); t.ctx.cueApprove(batchOf(t).id, { send: true }); }
  t.at('2026-10-27', 7, 0); t.ctx.cueSweep(); const b = batchOf(t);
  assert.strictEqual(b.batch.items.length, 0); assert.strictEqual(b.batch.stopped.length, 3); assert.strictEqual(b.batch.stopped[0].times, 2);
  t.at('2026-10-28', 7, 0); t.ctx.cueSweep(); assert.ok(t.tabs.Chat.rows.some(r => /nothing to chase today/.test(r[2])), 'flagged once');
});
test('S8 Skip today brings a line back tomorrow; Stop chasing keeps it out', () => {
  const t = sweepBox(); t.ctx.cueSweep(); const id = batchOf(t).id;
  t.ctx.cueSweepItem(id, 'rfq:aaaaaaaaaaaaaaaa', 'skip'); t.ctx.cueSweepItem(id, 'rfq:bbbbbbbbbbbbbbbb', 'mute');
  const b = batchOf(t); deq(b.batch.items.map(i => [i.who, i.removed, i.selected]), [['Mats Co', 'mute', false], ['Sonic Pro', 'skip', false], ['No Mail Co', '', true]]);
  t.ctx.cueCloseTask(id);
  t.at('2026-10-22', 7, 0); t.ctx.cueSweep(); deq(batchOf(t).batch.items.map(i => i.who).sort(), ['No Mail Co', 'Sonic Pro']);
});
test('S9 Cancel before 9:00 keeps them as drafts and sends nothing', () => {
  const t = sweepBox(); t.ctx.cueSweep(); const id = batchOf(t).id; t.ctx.cueApprove(id, { send: true });
  assert.strictEqual(t.ctx.cueSweepCancel(id).status, 'Done'); t.at('2026-10-21', 9, 5); t.ctx.cueResume(); assert.ok(!t.log.sent);
  assert.ok(t.tabs.Chat.rows.some(r => /Cancelled\. Nothing was sent/.test(r[2])));
});
test('S10 one kind failing (Canvas down) is a note; other kinds and the 15-per-kind cap still apply', () => {
  const many = Array.from({ length: 18 }, (_, i) => ({ key: 'pay:' + i, project: 'P' + i, who: 'Client ' + i, to: 'c' + i + '@x.example', why: 'Unpaid' }));
  const t = sweepBox({ boardFail: true }); t.ctx.cueKind_({ kind: 'pay', label: 'Payment chasers', sendAllowed: false, template: it => ({ body: 'Pay please ' + it.who }), find: () => many });
  t.ctx.cueSweep(); const b = batchOf(t);
  assert.strictEqual(b.batch.items.length, 15); assert.strictEqual(b.batch.over, 3); assert.ok(b.notes.some(n => /RFQ chasers: could not check/.test(n)));
  assert.strictEqual(t.log.gpt.length, 0, 'template-only kind: no AI call');
});
test('S11 task basics: due date, priority and reminder; due tasks show in the batch; reminders wait out quiet hours', () => {
  const t = startToCard(); let T = PH('2026-10-21', 11, 0); t.ctx.cueNow_ = () => T;
  assert.throws(() => t.ctx.cueTaskSet(t.id, { due: 'Friday' }), /YYYY-MM-DD/); assert.throws(() => t.ctx.cueTaskSet(t.id, { priority: 'urgent' }), /High, Normal or Low/);
  const v = t.ctx.cueTaskSet(t.id, { due: '2026-10-22', priority: 'high', remind: '2026-10-21T22:30' });
  assert.strictEqual(v.due, '2026-10-22'); assert.strictEqual(v.priority, 'High');
  T = PH('2026-10-21', 22, 35); t.ctx.cueResume(); assert.ok(!t.state(t.id).nudge, 'quiet hours: held');
  T = PH('2026-10-22', 7, 0); t.ctx.cueResume(); assert.ok(t.state(t.id).nudge); assert.ok(t.tabs.Chat.rows.some(r => r[3] === '>' + t.id && /^Reminder: Acme Corp/.test(r[2])));
  t.ctx.cueSweep(); const b = t.ctx.cueState().requests.filter(r => r.kind === 'sweep')[0];
  deq(b.batch.items.map(i => [i.kind, i.why, i.priority, i.no_email, i.task_id]), [['tasks', 'Due today', 'urgent', true, t.id]]);
  assert.strictEqual(t.log.gpt.length, 3 + 0, 'due tasks need no AI');
});
test('S12 Close works on any task that is not running; Archive needs it closed; chat can set a due date (no extra AI call)', () => {
  const t = startToCard(); assert.throws(() => t.ctx.cueArchive(t.id, true), /Close the task first/);
  assert.strictEqual(t.ctx.cueCloseTask(t.id).status, 'Closed'); assert.ok(t.tabs.Chat.rows.some(r => /Closed\. Nothing was written or sent/.test(r[2])));
  assert.strictEqual(t.ctx.cueArchive(t.id, true).archived, true); assert.strictEqual(t.ctx.cueReopen(t.id).status, 'Reopened');
  const u = startToCard({ talk: { reply: 'Done, due Friday.', looks_like_inquiry: false, start_intake: '', task: '', run_sweep: false, task_set: { due: '2026-10-24', priority: '', remind: '' } } });
  const before = u.log.gpt.length; u.ctx.cueSend('make this due friday', [], 'chat', u.id);
  assert.strictEqual(u.state(u.id).due, '2026-10-24'); assert.strictEqual(u.log.gpt.length, before + 1);
  assert.ok(/Today is Wednesday 2026-10-21/.test(u.log.gpt[u.log.gpt.length - 1].input), 'GPT knows today in PH time');
});
test('S13 an older batch never approved is closed when the next one is built; Approve on a closed batch is refused', () => {
  const t = sweepBox(); t.ctx.cueSweep(); const old = batchOf(t).id;
  t.at('2026-10-22', 7, 0); t.ctx.cueSweep();
  assert.strictEqual(t.state(old).status, 'Closed'); assert.throws(() => t.ctx.cueApprove(old, { send: true }), /closed/);
  assert.strictEqual(batchOf(t).batch.items.length, 3, 'its lines come back today');
});

// Moved from 06-pipeline-review.js (HUBSPOT-REMOVAL-2026-11-01): the thread ✓ and "Close older runs", on runs that are not pipeline reviews.
const addRun = (C, k, kind, st, day, extra) => C.cueLocked_(() => { const sh = C.cueSheet_('Requests'); sh.appendRow([k]);
  C.cueSave_(sh, sh.getLastRow(), Object.assign({ id: k, kind, ref: '', status: st, stage: st, created: day + 'T01:00:00.000Z', text: 'x', files: [], notes: [], metrics: {} }, extra || {})); });
test('C39 the ✓ in every thread (Kiko 24 Oct): closes every open run in the thread, older ones too; a running run is left alone; nothing written', () => {
  const t = sandbox(), C = t.ctx, id = 'cue-20261021110400-root';
  addRun(C, id, 'bids', 'Needs you', '2026-10-21');
  addRun(C, 'cue-20261021110500-aaaa', 'bids', 'Failed', '2026-10-21', { ref: id }); addRun(C, 'cue-20261021110600-bbbb', 'bids', 'Working', '2026-10-21', { ref: id });
  assert.throws(() => C.cueCloseThread('cue-made-up-0000'), /No such task/);
  deq(C.cueCloseThread('cue-20261021110500-aaaa'), { closed: 2, running: 1 }, 'any run of the thread finds its root');
  deq([id, 'cue-20261021110500-aaaa', 'cue-20261021110600-bbbb'].map(k => C.cueLoad_(k).s.status), ['Closed', 'Closed', 'Working']);
  assert.ok(t.tabs.Chat.rows.some(x => x[3] === id && /^Closed 2 runs\. Nothing was written or sent\. 1 still running/.test(x[2])));
  deq(C.cueCloseThread(id), { closed: 0, running: 1 }); assert.ok(!t.log.sent && !t.log.replies, 'nothing sent');
  const html = cuePage();
  assert.ok(/data-act="close-thread" data-id="' \+ esc\(it\.id\)/.test(html) && /return !CLOSED\[r\.status\]/.test(html), 'the header ✓ shows while any run is open');
  assert.ok(/act === 'close-thread'[\s\S]{0,900}cueCancelIntake/.test(html), 'an intake saved in Canvas still asks to cancel and remove');
});
test('C40 "Close older runs" closes only scheduled jobs from before today, plus any run of a removed kind; one main-chat line', () => {
  const t = sandbox(), C = t.ctx;
  addRun(C, 'cue-20261020090000-b1d0', 'bids', 'Needs you', '2026-10-20'); addRun(C, 'cue-20261020090100-9700', 'gtask', 'Failed', '2026-10-20');
  addRun(C, 'cue-20261020090200-1a7e', 'intake', 'Needs you', '2026-10-20'); addRun(C, 'cue-20261021090300-70da', 'bids', 'Needs you', '2026-10-21');
  addRun(C, 'cue-20261021090400-0ld1', 'hubspot', 'Needs you', '2026-10-21'); addRun(C, 'cue-20261021090500-0ld2', 'pipeline', 'Needs you', '2026-10-21');
  const before = t.tabs.Chat.rows.length;
  deq(C.cueCloseOlder(), { closed: 4 });
  deq(['cue-20261020090000-b1d0', 'cue-20261020090100-9700', 'cue-20261020090200-1a7e', 'cue-20261021090300-70da', 'cue-20261021090400-0ld1', 'cue-20261021090500-0ld2'].map(k => C.cueLoad_(k).s.status),
    ['Closed', 'Closed', 'Needs you', 'Needs you', 'Closed', 'Closed'], 'Kiko\'s intake and today\'s runs stay; removed kinds close');
  const said = t.tabs.Chat.rows.slice(before).filter(x => /older run/.test(x[2]));
  assert.strictEqual(said.length, 1, 'one line for the tap'); assert.strictEqual(said[0][2], 'Closed 4 older runs. Nothing was written or sent.'); assert.strictEqual(String(said[0][3] || ''), '', 'in the main chat, not a thread');
  const html = cuePage();
  assert.ok(/data-act="close-older"/.test(html) && /act === 'close-older'\) \{ b\.disabled = true; return call\('cueCloseOlder'/.test(html));
  const kinds = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'CueSweep.gs'), 'utf8').match(/CUE_OLD_KINDS_ = \[([^\]]+)\]/)[1].replace(/'/g, '').split(/,\s*/);
  assert.ok(html.indexOf('var OLDK = { ' + kinds.map(k => k + ': 1').join(', ') + ' }') > 0, 'the page and the server close the same kinds');
  assert.ok(/'Fix contact in Canvas'/.test(html), 'a contact finding opens Canvas to fix it, no delete');
});
