// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: card overhaul phase 2 (routing and removed cards).
// Kiko approved the card review page 30 Oct 2026 07:59Z: "dont include" on the HubSpot clean-up card (07:45Z); the Thursday funnel
// records review and the Monday funnel lines repeat the Sales funnel card (06:57Z).
test('CO1 removed and duplicate rows are off: a new sheet ships them off, an older sheet turns them off once, and a later turn-on by hand sticks', () => {
  const t = sandbox(); t.ctx.cueState(); t.ctx.cueSchedules();
  const on = id => (t.ctx.cueSchedules().filter(x => x.id === id)[0] || {}).on;
  ['sys-hubspot', 'sys-funnelreview'].forEach(id => assert.strictEqual(on(id), false, id + ' ships off'));
  // An older sheet that had them on (seeded before v9): the seed turns each off once.
  ['sys-hubspot', 'sys-funnelreview'].forEach(id => t.ctx.cueSchedSet(id, { on: true }));
  t.props.CUE_SCHED_SEED = 'v7:old'; t.ctx.cueSchedSeed_();
  ['sys-hubspot', 'sys-funnelreview'].forEach(id => assert.strictEqual(on(id), false, id + ' turned off'));
  assert.ok(/sys-hubspot/.test(t.props.CUE_SCHED_OFF_ONCE) && /sys-funnelreview/.test(t.props.CUE_SCHED_OFF_ONCE));
  // Turned on again by hand, it stays on through a later seed.
  t.ctx.cueSchedSet('sys-hubspot', { on: true }); t.props.CUE_SCHED_SEED = 'v8:old'; t.ctx.cueSchedSeed_();
  assert.strictEqual(on('sys-hubspot'), true);
});
