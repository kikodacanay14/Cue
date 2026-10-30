// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: ask-cue-subjects.
// CUE-SUBJECTS-2026-10-30 (Kiko 30 Oct 03:55Z "Yes, both changes"): a scheduled job closes its own older waiting runs, and the jobs of one
// subject (Morning, Sales, Friday events) share one thread a day. Sandbox "now" starts Wed 21 Oct 2026, 11:00 Manila.
const sjSet = (t, id, f) => { const L = t.ctx.cueLoad_(id); f(L.s); t.ctx.cueSave_(L.sh, L.row, L.s); };
const sjGet = (t, id) => t.ctx.cueLoad_(id).s;

test('SJ1 a scheduled job closes its own waiting runs from earlier days, with one line; other jobs, today\'s runs and approved runs stay', () => {
  const t = gtBox();
  const a = t.ctx.cueSchedRun_({ run: 'gtask:followups' }, false).task;
  const b = t.ctx.cueSchedRun_({ run: 'gtask:account_research' }, false).task;
  assert.ok(a && b && a !== b);
  [a, b].forEach(id => sjSet(t, id, s => { s.status = 'Needs you'; }));
  t.ctx.__wait(864e5);
  const c = t.ctx.cueSchedRun_({ run: 'gtask:followups' }, false).task;
  assert.strictEqual(sjGet(t, a).status, 'Closed'); assert.strictEqual(sjGet(t, a).closed_from, 'Needs you');
  assert.strictEqual(sjGet(t, b).status, 'Needs you', 'another job is not touched');
  assert.notStrictEqual(sjGet(t, c).status, 'Closed', 'today\'s run stays');
  assert.strictEqual(t.tabs.Chat.rows.filter(r => r[3] === a && /today's run of this job replaced it\. Nothing was sent or changed/.test(r[2])).length, 1);
  assert.ok(!t.log.sent && !t.log.gmail.length, 'nothing sent');
  // An approved run is never closed.
  sjSet(t, c, s => { s.status = 'Needs you'; s.approved_at = Date.now(); });
  t.ctx.__wait(864e5); t.ctx.cueSchedRun_({ run: 'gtask:followups' }, false);
  assert.strictEqual(sjGet(t, c).status, 'Needs you');
});

test('SJ2 Sales: the first job of the day starts "Sales · <day>", the next joins it; a typed run keeps its own thread; the next day starts a new one', () => {
  const t = gtBox();
  const a = t.ctx.cueSchedRun_({ run: 'gtask:followups' }, false).task;
  const b = t.ctx.cueSchedRun_({ run: 'gtask:admin_funnel' }, false).task;
  deq(JSON.parse(JSON.stringify(sjGet(t, a).subject)), { key: 'sales', day: '2026-10-21', title: 'Sales · Wed 21 Oct' });
  assert.ok(!sjGet(t, a).ref, 'the first one is the thread');
  assert.strictEqual(sjGet(t, b).ref, a, 'the second joins it');
  assert.strictEqual(t.ctx.cueView_(sjGet(t, b)).subject.title, 'Sales · Wed 21 Oct');
  const typed = t.ctx.cueSend('run thursday funnel records review', [], '').request_id;
  assert.ok(!sjGet(t, typed).ref && !sjGet(t, typed).subject, 'a run Kiko starts by typing stays on its own');
  const other = t.ctx.cueSchedRun_({ run: 'gtask:account_research' }, false).task;
  assert.ok(!sjGet(t, other).ref && !sjGet(t, other).subject, 'a job with no subject keeps its own thread');
  t.ctx.__wait(864e5);
  const c = t.ctx.cueSchedRun_({ run: 'gtask:followups' }, false).task;
  assert.ok(!sjGet(t, c).ref); assert.strictEqual(sjGet(t, c).subject.title, 'Sales · Thu 22 Oct');
});

test('SJ3 the subject list: Morning, Sales and Friday events hold the jobs on the After picture', () => {
  const t = sandbox(), S = require('vm').runInContext('CUE_SUBJECTS_', t.ctx);
  deq(Object.keys(S).map(k => [k, S[k].title, S[k].jobs.join(',')]), [
    ['morning', 'Morning', 'sweep,gtask:daily_plan'],
    ['sales', 'Sales', 'funnel,gtask:followups,pipeline,gtask:admin_funnel'],
    ['friday', 'Friday events', 'status,gtask:production_readiness']]);
  assert.strictEqual(t.ctx.cueSubjDay_('2026-10-30'), 'Fri 30 Oct');
});

test('SJ4 the page names a subject thread by its subject', () => {
  const html = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'IndexThreads.html'), 'utf8');
  assert.ok(/r\.subject && r\.subject\.title[^\n]*return subj\.subject\.title/.test(html));
});

test('SJ5 Morning batch inbox lines leave out an email Canvas files under a project (Kiko 30 Oct 05:50Z "project emails stay in Team Cue"); Canvas down drops nothing more', () => {
  const W = { on: true, stale: false, checked: 1, items: [{ id: 'b2b2b2b2b2b2b2b2', who: 'Client', name: 'Marco Cruz', pid: 'AC-1', project: 'Acme Year-End' }, { id: '0909090909090909', who: 'Supplier', name: 'X', pid: '', project: '' }] };
  const t = sandbox({ inbox: INBOX, triage: TRIAGE, waiting: W });
  const lines = t.ctx.cueTriageFind_({ s: triRun(), board: BOARD });
  assert.ok(!lines.some(l => l.thread_id === 'b2b2b2b2b2b2b2b2'), 'the project email is not in the batch');
  assert.ok(lines.some(l => l.thread_id === '0909090909090909'), 'an email Canvas knows with no project stays');
  assert.strictEqual(t.log.mailWaiting, 1, 'Canvas read once');
  const d = sandbox({ inbox: INBOX, triage: TRIAGE, waitingFail: true });
  assert.ok(d.ctx.cueTriageFind_({ s: triRun(), board: BOARD }).some(l => l.thread_id === 'b2b2b2b2b2b2b2b2'), 'without Canvas nothing more is dropped');
});
