// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: no-hubspot.
// HUBSPOT-REMOVAL-2026-11-01 (Kiko 1 Nov 2026: "Delete the Hubspot code"; earlier "its still mentioning Hubspot. Can we make sure that we
// remove it from the process"): Cue has no HubSpot feature and shows no HubSpot word. The sales funnel reads Canvas only.

// The code part of each line: block comments (/* ... */) and line comments (// ...) are left out, so history notes may stay.
function nhCodeLines(text) {
  const out = []; let inBlock = false;
  text.split('\n').forEach((line, i) => {
    let code = '', rest = line;
    while (rest.length) {
      if (inBlock) { const e = rest.indexOf('*/'); if (e < 0) { rest = ''; break; } rest = rest.slice(e + 2); inBlock = false; continue; }
      const b = rest.search(/\/\*/), l = rest.search(/(^|[^:'"])\/\//);
      const lc = l < 0 ? -1 : (rest[l] === '/' ? l : l + 1);
      if (b >= 0 && (lc < 0 || b < lc)) { code += rest.slice(0, b); rest = rest.slice(b + 2); inBlock = true; continue; }
      if (lc >= 0) { code += rest.slice(0, lc); rest = ''; break; }
      code += rest; rest = '';
    }
    out.push({ n: i + 1, line, code });
  });
  return out;
}
// The only code lines that may name HubSpot: the internal ids of removed kinds and Schedule rows, so old saved data is closed or dropped.
// They are never shown to Kiko and never sent to an AI.
const NH_ALLOWED = ["const CUE_GONE_KINDS_ = ['hubspot', 'pipeline'];", "const CUE_SCHED_GONE_ = ['sys-hubspot', 'sys-pipeline'];"];

test('NH1 no file in src/ calls hubapi.com, and HubSpot is named only in comments (plus the two internal id lists of removed things)', () => {
  const dir = path.join(__dirname, '..', 'src'), bad = [], api = [];
  fs.readdirSync(dir).filter(f => /\.(gs|html)$/.test(f)).forEach(f => {
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    if (/hubapi\.com/i.test(text)) api.push(f);
    nhCodeLines(text).forEach(x => { if (/hub\s?spot/i.test(x.code) && !NH_ALLOWED.some(a => x.line.indexOf(a) >= 0)) bad.push(f + ':' + x.n + ': ' + x.line.trim().slice(0, 140)); });
  });
  deq(api, [], 'no HubSpot API address');
  deq(bad, [], 'HubSpot outside comments');
  ['CueHubspot.gs', 'CuePipeline.gs', 'CueSweepHubspot.gs'].forEach(f => assert.ok(!fs.existsSync(path.join(dir, f)), f + ' is deleted'));
  const page = cuePage();
  ['hs-approve', 'hs-lookup', 'hs-close', 'fn-task', 'gt-hubspot', 'pipe-draft', 'send-pipe', 'cueFunnelTaskDone', 'cueHsLookup', 'cuePipeFollowUps'].forEach(w => assert.ok(page.indexOf(w) < 0, w + ' is gone from the page'));
});

test('NH2 the seeded Schedule list has no HubSpot or pipeline row, and a sheet seeded with the old v12 rows loses them once', () => {
  const t = sandbox(); t.ctx.cueState();
  const ids = () => t.ctx.cueSchedules().map(x => x.id);
  assert.ok(ids().indexOf('sys-funnel') >= 0, 'the list is seeded');
  ['sys-hubspot', 'sys-pipeline'].forEach(id => assert.ok(ids().indexOf(id) < 0, id + ' is not seeded'));
  // A sheet from before 1 Nov: the two rows are there (as v12 seeded them) and the seed signature is v12.
  const sh = t.ctx.cueSchedSheet_(), now = t.ctx.cueNow_();
  [['sys-hubspot', 'Monday HubSpot check', 'weekly', ['Mon'], '06:00', 'hubspot', 'HubSpot clean-up scan'], ['sys-pipeline', 'HubSpot sales review', 'weekly', ['Thu'], '08:00', 'pipeline', 'Pipeline review']]
    .forEach(r => { sh.appendRow([r[0]]); t.ctx.cueSchedWrite_(sh, { row: sh.getLastRow(), id: r[0], name: r[1], type: 'system', repeat: r[2], days: r[3], dom: 0, date: '', time: r[4],
      command: r[6], run: r[5], on: true, next: now + 3600e3, last: 0, result: '', task: '', created: now }); });
  t.props.CUE_SCHED_SEED = 'v12:' + String(t.props.CUE_SCHED_SEED || '').split(':').slice(1).join(':');
  const before = t.tabs.Schedule.rows.length;
  const list = t.ctx.cueSchedules();
  ['sys-hubspot', 'sys-pipeline'].forEach(id => assert.ok(!list.some(x => x.id === id), id + ' dropped from the list'));
  assert.ok(!t.tabs.Schedule.rows.some(r => /^sys-(hubspot|pipeline)$/.test(String(r[0]))), 'both rows deleted from the tab');
  assert.ok(/^v1[3-9]:/.test(t.props.CUE_SCHED_SEED), 'seed signature bumped (v13 or later)');
  assert.ok(list.some(x => x.id === 'sys-funnel') && list.some(x => x.id === 'sys-bids'), 'the other rows stay');
  assert.ok(!JSON.stringify(list).match(/hub\s?spot/i), 'no HubSpot word in the list Settings shows');
  const runs = vm.runInContext('CUE_SCHED_RUNS_', t.ctx); assert.ok(!('hubspot' in runs) && !('pipeline' in runs), 'no run label for removed jobs');
});

test('NH3 "clean up hubspot" and "pipeline review" typed in chat start no task: they go to the normal chat call', () => {
  ['clean up hubspot', 'pipeline review', 'my hubspot tasks'].forEach(w => {
    const t = sandbox(); const r = t.ctx.cueSend(w);
    const kinds = t.tabs.Requests.rows.slice(1).map(x => t.state(x[0]).kind);
    assert.ok(!kinds.some(k => k === 'hubspot' || k === 'pipeline' || k === 'funnel'), w + ': no task started (' + kinds.join() + ')');
    assert.ok(!(r && r.request_id), w + ': no request id');
    assert.ok(t.log.gpt.length + t.log.claude.length >= 1, w + ': the chat call ran');
    assert.ok(t.tabs.Chat.rows.some(x => x[1] === 'Kiko' && x[2] === w), w + ': Kiko\'s line is in the chat');
  });
  const { ctx } = sandbox();
  assert.strictEqual(ctx.cueFunnelAsked_('my hubspot tasks'), false);
  assert.ok(!vm.runInContext('CUE_TALK_SCHEMA_', ctx).properties.command, 'the chat call has no pipeline command');
  assert.ok(!('pipeline' in vm.runInContext('CUE_ROUTE_CMDS_', ctx)), 'Wrong command? does not offer the pipeline review');
});

test('NH4 an old saved request of kind hubspot or pipeline never throws: cueRun closes it, cueState lists it, Approve says it is gone', () => {
  const t = sandbox(), C = t.ctx;
  const add = (id, kind, status) => C.cueLocked_(() => { const sh = C.cueSheet_('Requests'); sh.appendRow([id]);
    C.cueSave_(sh, sh.getLastRow(), { id, kind, ref: '', status, stage: 'Reading HubSpot', created: '2026-10-21T01:00:00.000Z', text: 'old run', files: [], notes: [], metrics: { ai_calls: 0, calls: [] },
      hs: { title: 'Monday HubSpot check', groups: [] }, pipe: { title: 'Pipeline review', counts: {} } }); });
  add('cue-20261021090000-0hs1', 'hubspot', 'Working'); add('cue-20261021090100-0pp1', 'pipeline', 'Needs you');
  let v; assert.doesNotThrow(() => { v = C.cueRun('cue-20261021090000-0hs1'); });
  deq([v.status, v.kind], ['Closed', 'removed'], 'a working run of a removed kind closes instead of running the intake');
  assert.ok(!('hs' in v) && !('pipe' in v), 'no HubSpot or pipeline view');
  let st; assert.doesNotThrow(() => { st = C.cueState(); });
  assert.ok(st.requests.some(r => r.id === 'cue-20261021090100-0pp1'), 'the waiting one is listed');
  assert.doesNotThrow(() => C.cueRun('cue-20261021090100-0pp1'), 'a waiting one is left as it is');
  assert.throws(() => C.cueApprove('cue-20261021090100-0pp1', {}), /no longer has this kind of task/);
  assert.doesNotThrow(() => C.cueResume());
  assert.strictEqual(C.cueTaskName_({ kind: 'pipeline' }), 'a task Cue no longer has');
  assert.ok(!/hub\s?spot/i.test(C.cueTodayFrom_(st.requests, '2026-10-21').rows.map(r => r.eyebrow + r.title).join(' ')), 'no HubSpot row on the Today card');
  assert.strictEqual(pageKindName({ kind: 'removed' }), 'Removed task', 'the page names it plainly');
});
