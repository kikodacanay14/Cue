// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: the CRM timer from Kiko's account (crm_tick).
/* CUE-CRM-TICK-2026-10-29 (bug; Kiko 29 Oct 02:11:02Z "Make all Cue and CRM related timers to my account"): Canvas V329 added the
 * bridge action crm_tick, but no Cue release called it. The "CRM work" job calls it every 15 minutes inside cueResume. The funnel
 * card's switch to Canvas's numbers is tested in FN1 and FN3 (06-pipeline-review.js). */

const crmJobRow = t => t.tabs['Job Runs'].rows.filter(r => r[2] === 'CRM work').pop();

test('CR1 the CRM work job calls crm_tick once every 15 minutes, never on the 5-minute ticks between; Job Runs counts what Auto add added', () => {
  const t = sandbox({ props: { CUE_CRMTICK_AT: '0' }, crmTick: { ran: true, companies: 2, contacts: 1, deals: 0 } });
  assert.ok(t.ctx.cueJobs_().some(j => j.job === 'CRM work' && j.fn === 'cueCrmTickTick_'), 'listed as a job');
  t.ctx.cueResume();
  assert.strictEqual(t.log.crmTick, 1, 'first tick calls');
  deq([crmJobRow(t)[3], crmJobRow(t)[4], crmJobRow(t)[5]], ['OK', '', 3]);
  const b = t.log.bridge.filter(x => x.action === 'crm_tick');
  assert.ok(b.length === 1 && Object.keys(b[0].args || {}).length === 0, 'no arguments');
  t.ctx.__wait(5 * 60e3); t.ctx.cueResume(); t.ctx.__wait(5 * 60e3); t.ctx.cueResume();
  assert.strictEqual(t.log.crmTick, 1, 'not on the next two ticks');
  t.ctx.__wait(5 * 60e3); t.ctx.cueResume();
  assert.strictEqual(t.log.crmTick, 2, 'again at 15 minutes');
  assert.strictEqual(t.log.gpt.length + t.log.claude.length + t.log.gmail.length, 0, 'no AI call, no email');
});

test('CR2 a Canvas failure is a Failed row in Job Runs, is not retried on the next 5-minute tick, and is tried again 15 minutes later', () => {
  const t = sandbox({ props: { CUE_CRMTICK_AT: '0' }, crmTickFail: true });
  t.ctx.cueResume();
  assert.strictEqual(t.log.crmTick, 1); assert.strictEqual(crmJobRow(t)[3], 'Failed'); assert.ok(/Canvas busy|Blocked/.test(crmJobRow(t)[4]), crmJobRow(t)[4]);
  t.ctx.__wait(5 * 60e3); t.ctx.cueResume();
  assert.strictEqual(t.log.crmTick, 1, 'no retry storm');
  t.ctx.__wait(10 * 60e3); t.ctx.cueResume();
  assert.strictEqual(t.log.crmTick, 2, 'retried after 15 minutes');
});

test('CR3 the job is quiet until 15 minutes have passed and never runs in a cloud check', () => {
  const t = sandbox();
  t.ctx.cueResume(); assert.ok(!t.log.crmTick, 'not due by default in the harness');
  const c = sandbox({ props: { CUE_CRMTICK_AT: '0' } });
  c.ctx.CUE_CHECK_ON_ = true; assert.strictEqual(c.ctx.cueCrmTickTick_(), null);
  assert.ok(!c.log.crmTick, 'a check never does Canvas\'s CRM work');
});
