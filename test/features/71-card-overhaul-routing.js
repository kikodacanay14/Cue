// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: card overhaul phase 2 (routing and removed cards).
// Kiko approved the card review page 30 Oct 2026 07:59Z; on it he said "dont include" on the HubSpot clean-up card (07:45Z).
test('CO1 the Monday HubSpot check is off: a sheet that had it on turns it off once, it stays in the list, and a later turn-on by hand sticks', () => {
  const t = sandbox(); t.ctx.cueState(); t.ctx.cueSchedules();
  const rows = t.tabs.Schedule.rows, i = rows.findIndex(r => r[0] === 'sys-hubspot');
  assert.ok(i > 0, 'the row is still listed');
  assert.strictEqual(t.ctx.cueSchedules().filter(x => x.id === 'sys-hubspot')[0].on, false);
  // An older sheet seeded with the row on: the v8 seed turns it off.
  t.ctx.cueSchedSet('sys-hubspot', { on: true }); t.props.CUE_SCHED_SEED = 'v7:old'; t.ctx.cueSchedSeed_();
  assert.strictEqual(t.ctx.cueSchedules().filter(x => x.id === 'sys-hubspot')[0].on, false);
  // Turned on again by hand after the seed, it stays on.
  t.ctx.cueSchedSet('sys-hubspot', { on: true }); t.ctx.cueSchedSeed_();
  assert.strictEqual(t.ctx.cueSchedules().filter(x => x.id === 'sys-hubspot')[0].on, true);
});
