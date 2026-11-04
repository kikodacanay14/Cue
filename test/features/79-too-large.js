// Part of test/cue.test.js. TOO-LARGE-2026-11-01 (Kiko's /dev, 1 Nov: "The bid check stopped: This request is too large to store
// (310994 characters)" posted every 10 minutes): a run that outgrows its cells is saved slim as Failed, once, and is not picked up again.
test('TL1 a run too large to store is closed as Failed with a slim copy, so the 5-minute job does not retry it forever', () => {
  const t = bidBox(); const r = t.ctx.cueSend('run bid opportunity check', [], '');
  const L = t.ctx.cueLoad_(r.request_id); L.s.notes = ['x'.repeat(500000)]; L.s.stage = 'Writing';
  assert.throws(() => t.ctx.cueSave_(L.sh, L.row, L.s), /too large to store/);
  t.ctx.cueSave_(L.sh, L.row, Object.assign({}, L.s, { notes: [] }));   // stored state is the old small one, as in the sheet
  const run = t.ctx.cueRunLeased_ ? 'cueRunLeased_' : null; assert.ok(run, 'cueRunLeased_ exists');
  const before = t.tabs.Chat.rows.length;
  const orig = t.ctx.cueBidsFinish_; t.ctx.cueBidsFinish_ = s => { s.notes = ['y'.repeat(500000)]; orig(s); };
  t.ctx.cueRun(r.request_id);
  const st = t.state(r.request_id);
  assert.strictEqual(st.status, 'Failed'); assert.ok(/grew too large to store and was closed/.test(st.error), st.error);
  t.ctx.cueRun(r.request_id);
  assert.strictEqual(t.state(r.request_id).status, 'Failed', 'stays closed');
  assert.ok(t.tabs.Chat.rows.length - before <= 2, 'no message every run');
});
test('TL2 the Opportunities closing list keeps the 30 soonest', () => {
  const t = sandbox(), open = Array.from({ length: 40 }, (_, i) => ({ key: 'k' + i, row: i + 2, deadline_ms: (40 - i) * 1000, docs: '', ref: 'R' + i }));
  const still = vm.runInContext('cueBidsStill_', t.ctx)(open, [], []);
  assert.ok(still.length <= 30, 'at most 30: ' + still.length);
  assert.ok(!still.some(x => /^(k|R)([0-9])$/.test(String(x.key || x.reference))), 'the latest deadlines are the ones left out');
});
test('TL3 a bid check of 310,000 characters (the size that stopped it on 1 and 3 Nov) is stored and read back whole', () => {
  const t = bidBox(); const r = t.ctx.cueSend('run bid opportunity check', [], '');
  const L = t.ctx.cueLoad_(r.request_id); L.s.notes = ['z'.repeat(310000)];
  t.ctx.cueSave_(L.sh, L.row, L.s);
  assert.strictEqual(t.ctx.cueLoad_(r.request_id).s.notes[0].length, 310000);
});
test('TL4 the PhilGEPS read hands thousands of open notices to the screen without storing them (4 Nov: too large even at 450,000)', () => {
  const t = bidBox(); const r = t.ctx.cueSend('run bid opportunity check', [], '');
  const orig = t.ctx.cueBidsPg_;
  t.ctx.cueBidsPg_ = s => {
    s.bids.raw = (s.bids.raw || []).concat(Array.from({ length: 3000 }, (_, i) => ({ source: 'Other PhilGEPS', agency: 'Agency ' + i, reference: 'PG' + i,
      project: 'Supply of office paper lot ' + i + ' '.repeat(150), location: 'Somewhere', abc: 5000, summary: 'Goods, '.repeat(40), relevant: true })));
    delete s.bids.pg; s.stage = 'Checking';
  };
  try { t.ctx.cueRun(r.request_id); } finally { t.ctx.cueBidsPg_ = orig; }
  const st = t.state(r.request_id);
  assert.notStrictEqual(st.status, 'Failed', st.error);
  assert.ok(!st.bids.raw, 'B.raw is never stored');
});
