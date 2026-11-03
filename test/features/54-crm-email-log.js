// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: crm-email-log.
// CUE-CRM-EMAIL-LOG-2026-10-26 (spec canvas-crm-funnel.md F5; Kiko 16:10Z "Log automatically").
const WAIT = { on: true, stale: false, checked: 3, items: [
  { id: 'aa01b2c3d4e5f6a7', from: 'Ana Reyes <ana@acme.example>', email: 'ana@acme.example', subject: 'Re: Year-end party CE', at: '2026-10-21T01:30:00Z', unread: true, who: 'Client', name: 'Ana Reyes', pid: 'S-1', project: 'Acme Gala' },
  { id: 'aa02b2c3d4e5f6a7', from: 'Sonic Pro <sales@sonicpro.example>', email: 'sales@sonicpro.example', subject: 'Invoice', at: '2026-10-21T01:00:00Z', unread: false, who: 'Supplier', name: 'Sonic Pro', pid: '', project: '' },
  { id: 'aa03b2c3d4e5f6a7', from: 'joy@beta.example', email: 'joy@beta.example', subject: 'Booth size?', at: '2026-10-20T23:00:00Z', unread: true, who: 'Client', name: '', pid: '', project: '' }] };
const crmTabRows = t => (t.tabs['CRM Email Log'] ? t.tabs['CRM Email Log'].rows.slice(1) : []);

test('CL1 client emails are logged to Accounts once an hour with no tap: clients only, one row per thread per day, no AI call', () => {
  const t = sandbox({ waiting: WAIT });
  const r = t.ctx.cueCrmLogTick_();
  deq([r.logged, r.failed], [2, 0]);
  deq(t.log.crmLog.map(a => [a.kind, a.email, a.date]), [['Email', 'ana@acme.example', '2026-10-21'], ['Email', 'joy@beta.example', '2026-10-21']]);
  assert.ok(/^Email from Ana Reyes: Re: Year-end party CE \(project Acme Gala\)$/.test(t.log.crmLog[0].summary), t.log.crmLog[0].summary);
  assert.ok(t.log.crmLog.every(a => /^cuemail:[A-Za-z0-9_-]+:\d{4}-\d{2}-\d{2}$/.test(a.request_id)), 'request_id fits the bridge pattern');
  assert.ok(!t.log.crmLog.some(a => a.email === 'sales@sonicpro.example'), 'suppliers are not logged');
  deq(crmTabRows(t).map(x => x[7]), ['Logged', 'Logged']);
  assert.strictEqual(t.log.gpt.length + t.log.claude.length, 0, 'no AI call');
  assert.strictEqual(t.ctx.cueCrmLogTick_(), null, 'the same hour does not run twice');
  t.ctx.__wait(3600 * 1000); const r2 = t.ctx.cueCrmLogTick_();
  deq([r2.logged, t.log.crmLog.length, t.log.mailWaiting], [0, 2, 2]);
});

test('CL2 a refused write is listed as Failed and retried next hour; outside 08:00 to 21:00 Manila nothing runs; email check off says so', () => {
  const t = sandbox({ waiting: WAIT, crmFail: ['joy@beta.example'] });
  const r = t.ctx.cueCrmLogRun_();
  deq([r.logged, r.failed], [1, 1]);
  assert.ok(/^Failed: Canvas refused crm_log/.test(crmTabRows(t)[1][7]));
  t.opts.crmFail.length = 0; const r2 = t.ctx.cueCrmLogRun_();
  deq([r2.logged, t.log.crmLog.slice(-1)[0].email], [1, 'joy@beta.example']);
  t.ctx.__wait(12 * 3600 * 1000); const before = t.log.mailWaiting;
  assert.strictEqual(t.ctx.cueCrmLogTick_(), null); assert.strictEqual(t.log.mailWaiting, before, 'no Canvas read at night');
  const off = sandbox({ waiting: { on: false, items: [] } });
  assert.ok(/Email check is off/.test(off.ctx.cueCrmLogRun_().note)); assert.ok(!(off.log.crmLog || []).length);
});

test('CL4 each run claims a plan before its crm_log writes (Canvas refuses a write without one); a CRM refusal is Failed, not Logged', () => {
  const t = sandbox({ waiting: WAIT, crmRefused: ['joy@beta.example'] });
  const r = t.ctx.cueCrmLogRun_();
  deq([r.logged, r.failed], [1, 1]);
  const acts = t.log.bridge.map(b => b.action).filter(a => a !== 'mail_waiting');
  deq(acts, ['claim_plan', 'crm_log', 'crm_log']);
  const plan = t.log.bridge.find(b => b.action === 'claim_plan');
  assert.strictEqual(plan.command_id, 'plan:' + plan.task_id); assert.strictEqual(plan.args.commands.length, 2);
  assert.ok(/^Failed: Canvas refused crm_log: No account matches/.test(crmTabRows(t)[1][7]), crmTabRows(t)[1][7]);
  t.ctx.__wait(60 * 1000); t.ctx.cueCrmLogRun_();
  const plans = t.log.bridge.filter(b => b.action === 'claim_plan');
  assert.strictEqual(plans.length, 2); assert.notStrictEqual(plans[0].task_id, plans[1].task_id, 'a new run is a new task, so its plan is never refused as different');
});

test('CL3 cueResume runs the email log; a Canvas failure never stops the rest of the tick', () => {
  const t = sandbox({ waiting: WAIT });
  t.ctx.cueResume();
  assert.strictEqual((t.log.crmLog || []).length, 2);
  const u = sandbox({ waiting: WAIT, crmFail: ['ana@acme.example', 'joy@beta.example'] });
  u.ctx.cueResume();
  deq(crmTabRows(u).map(x => /^Failed/.test(x[7])), [true, true]);
});
