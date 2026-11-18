// Part of test/cue.test.js. Feature: JOB-CHANNELS-KEEP-2026-11-18 (src/Cue.gs cueState/cueStateJob_, src/IndexThreads.html threads()).
// Kiko 18 Nov 2026 08:06:01Z "why is there still a separate Thread for Sales -Wed Nov 18? and where are the threads under CRM???".
test('JCK1 a busy day no longer pushes the scheduled jobs out of the list: each job keeps its newest run, and the run its day thread hangs on', () => {
  const t = sandbox();
  const sh = t.tabs.Requests, put = s => { sh.appendRow([s.id]); t.ctx.cueSave_(sh, sh.getLastRow(), s); };
  const subj = { key: 'sales', day: '2026-11-18', title: 'Sales · Wed 18 Nov' };
  put({ id: 'bd1', kind: 'bids', created: '2026-11-17T23:00:00.000Z', status: 'Needs you', text: 'bids', bids: { title: 'Bid check', items: [] } });
  put({ id: 'gt1', kind: 'gtask', gt: { key: 'admin_review', title: 'Project Reviews' }, created: '2026-11-17T23:10:00.000Z', status: 'Done', text: 'review' });
  put({ id: 'fn1', kind: 'funnel', subject: subj, created: '2026-11-17T23:20:00.000Z', status: 'Done', text: 'funnel' });
  put({ id: 'k0a', kind: 'k0', created: '2026-11-17T23:30:00.000Z', status: 'Done', text: '8 AM update' });
  put({ id: 'fn2', kind: 'gtask', gt: { key: 'followups' }, subject: subj, ref: 'fn1', created: '2026-11-18T06:00:00.000Z', status: 'Needs you', text: 'follow-ups' });
  for (let i = 0; i < 25; i++) put({ id: 'in' + i, kind: 'intake', created: '2026-11-18T06:' + String(10 + i) + ':00.000Z', status: 'Done', text: 'intake ' + i });
  const st = JSON.parse(JSON.stringify(t.ctx.cueState())), ids = st.requests.map(r => r.id);
  ['bd1', 'gt1', 'k0a', 'fn2', 'fn1'].forEach(id => assert.ok(ids.indexOf(id) >= 0, id + ' kept: ' + ids));
  assert.ok(st.requests.length <= 20 + 6, 'only the jobs\' newest runs and their roots are added');
  assert.strictEqual(t.ctx.cueStateJob_({ kind: 'gtask' }), '', 'a ChatGPT task with no key is no job');
  assert.strictEqual(t.ctx.cueStateJob_({ kind: 'intake' }), '');
});
test('JCK2 the page: a Sales run whose first run of the day is not in the list sits in Jobs › Updates, not under Threads', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexThreads.html'), 'utf8');
  const a = src.indexOf('  function rootOf('), z = src.indexOf('\n  }\n', src.indexOf('  function threads(')) + 4;
  const reqs = [{ id: 'fn2', kind: 'gtask', gt: { key: 'followups' }, ref: 'fn1', subject: { key: 'sales', title: 'Sales · Wed 18 Nov' }, created: '2026-11-18' },
    { id: 'k0a', kind: 'k0', created: '2026-11-17' }];
  const c = { state: { requests: reqs, chat: [], chan_rules: [] }, agdLabel: x => x, allLines: () => [], askOf: () => null };
  vm.runInNewContext("function byId() { var o = {}; state.requests.forEach(function (r) { o[r.id] = r; }); return o; }\n" + src.slice(a, z) + '\nthis.t = threads();', c);
  const th = Object.keys(c.t).map(k => c.t[k]);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(th.map(x => x.chan))), ['job:updates'], 'one Updates channel: ' + JSON.stringify(th.map(x => [x.root, x.chan])));
  assert.deepStrictEqual(JSON.parse(JSON.stringify(th[0].reqs.map(r => r.id).sort())), ['fn2', 'k0a']);
  c.state.requests = [reqs[0]]; vm.runInNewContext('this.t = threads();', c);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(Object.keys(c.t).map(k => c.t[k].chan))), ['job:updates'], 'the Sales run alone still names its channel');
});
