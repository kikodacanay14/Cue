// Incoming scheduling only; other Messenger tests isolate individual event handling.
function cadenceBox(projects) {
  const t = sandbox(); let now = Date.parse('2026-11-08T02:00:00Z'), pulls = 0, boards = 0;
  t.ctx.cueNow_ = () => now;
  Object.assign(t.props, { MSGR_PAGE_TOKEN: 'test-token', MSGR_RELAY_KEY: 'test-key', MSGR_RELAY_URL: 'https://relay.example.workers.dev' });
  t.ctx.cueBridge_ = (_s, a) => { assert.strictEqual(a, 'get_project_board'); boards++; return { projects }; };
  t.ctx.cueMsgrPullOnce_ = () => { pulls++; return 0; };
  return { t, at: x => { now = Date.parse(x); }, wait: n => { now += n; }, counts: () => [pulls, boards] };
}
test('MC1 normal days: minute kick and scheduler share one hourly pull', () => {
  const b = cadenceBox([]);
  b.t.ctx.cueMsgrKick_(); b.wait(60000); b.t.ctx.cueMsgrPull_(); b.wait(3540000); b.t.ctx.cueMsgrPull_();
  deq(b.counts(), [2, 2]);
});
test('MC2 seven days before through event day, inclusive in Manila', () => {
  const b = cadenceBox([{ id:'S-TEST', date:'11/15/2026', status:'For Event Execution' }]);
  b.t.ctx.cueMsgrPull_(); b.wait(59999); b.t.ctx.cueMsgrPull_(); assert.strictEqual(b.counts()[0],1);
  b.wait(1); b.t.ctx.cueMsgrPull_(); assert.strictEqual(b.counts()[0],2);
  assert.strictEqual(b.t.ctx.cueMsgrCadenceDays_([{id:'P',date:'11/15/2026'}], '2026-11-07'), false);
  assert.strictEqual(b.t.ctx.cueMsgrCadenceDays_([{id:'P',date:'11/15/2026'}], '2026-11-08'), true);
  assert.strictEqual(b.t.ctx.cueMsgrCadenceDays_([{id:'P',date:'2026-11-15'}], '2026-11-15'), true);
  assert.strictEqual(b.t.ctx.cueMsgrCadenceDays_([{id:'P',date:'2026-11-15'}], '2026-11-16'), false);
});
test('MC3 cancelled, not awarded, on hold, invalid and missing dates do not accelerate', () => {
  const b=cadenceBox([]);
  for (const p of [{id:'P',date:'11/08/2026',status:'Not Awarded'}, {id:'P',date:'11/08/2026',adminStatus:'Cancelled'},
    {id:'P',date:'11/08/2026',status:'On Hold'}, {id:'P',date:'2/30/2026'}, {id:'P'}, {date:'11/08/2026'}])
    assert.strictEqual(b.t.ctx.cueMsgrCadenceDays_([p], '2026-11-08'),false);
  assert.strictEqual(b.t.ctx.cueMsgrCadenceDays_([{id:'old',date:'11/01/2026'}, {id:'next',date:'11/12/2026'}], '2026-11-08'),true);
});
test('MC4 event changes refreshed hourly; failed board falls back hourly, retries bounded', () => {
  const b=cadenceBox([{id:'P',date:'11/08/2026'}]); b.t.ctx.cueMsgrPull_();
  b.wait(3600000); b.t.ctx.cueBridge_=()=>{throw new Error('board unavailable');}; b.t.ctx.cueMsgrPull_();
  b.wait(60000); b.t.ctx.cueMsgrPull_(); assert.strictEqual(b.counts()[0],2);
  b.wait(3540000); b.t.ctx.cueBridge_=()=>({projects:[]}); b.t.ctx.cueMsgrPull_(); assert.strictEqual(b.counts()[0],3);
});
test('MC5 Manila midnight changes cadence even before board cache refresh', () => {
  const b=cadenceBox([{id:'P',date:'11/08/2026'}]); b.at('2026-11-08T15:59:00Z'); b.t.ctx.cueMsgrPull_();
  b.at('2026-11-08T16:00:00Z'); b.t.ctx.cueMsgrPull_(); assert.strictEqual(b.counts()[0],1);
});
test('MC6 failure attempts are bounded; lease and missing setup avoid remote calls', () => {
  const b=cadenceBox([]); b.t.props.CUE_MSGR_PULL_RUN=String(b.t.ctx.cueNow_()+1000); b.t.ctx.cueMsgrPull_(); deq(b.counts(),[0,0]);
  delete b.t.props.CUE_MSGR_PULL_RUN; delete b.t.props.MSGR_RELAY_KEY; b.t.ctx.cueMsgrPull_(); deq(b.counts(),[0,0]);
  b.t.props.MSGR_RELAY_KEY='test-key'; b.t.ctx.cueMsgrPullOnce_=()=>{throw new Error('relay unavailable');};
  assert.throws(()=>b.t.ctx.cueMsgrPull_(), /relay unavailable/); assert.ok(!b.t.props.CUE_MSGR_PULL_RUN);
  b.wait(60000); assert.doesNotThrow(()=>b.t.ctx.cueMsgrPull_());
});


test('MC7 issued crew codes keep polling fast for ten minutes only; no expiry/attempt changes', () => {
  const b=cadenceBox([]); b.t.props.CUE_MSGR_CODE_FAST_UNTIL=String(b.t.ctx.cueNow_()+600000);
  b.t.ctx.cueMsgrPull_(); b.wait(60000); b.t.ctx.cueMsgrPull_(); assert.strictEqual(b.counts()[0],2);
  b.wait(540000); b.t.ctx.cueMsgrPull_(); assert.strictEqual(b.counts()[0],2);
  const c=crewBox({crew_match:()=>({status:'code_sent',channel:'mobile',hint:'77',project:'Synthetic Event',first:'Ana'})});
  c.crew('Ana Synthetic Event'); assert.strictEqual(Number(c.t.props.CUE_MSGR_CODE_FAST_UNTIL), c.t.ctx.cueNow_()+600000);
});
