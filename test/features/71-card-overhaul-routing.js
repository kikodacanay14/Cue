// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: card overhaul phase 2 (routing and removed cards).
// Kiko approved the card review page 30 Oct 2026 07:59Z: "dont include" on the HubSpot clean-up card (07:45Z); the Thursday funnel
// records review and the Monday funnel lines repeat the Sales funnel card (06:57Z).
test('CO1 removed and duplicate rows are off: a new sheet ships them off, an older sheet turns them off once, and a later turn-on by hand sticks', () => {
  const t = sandbox(); t.ctx.cueState(); t.ctx.cueSchedules();
  const on = id => (t.ctx.cueSchedules().filter(x => x.id === id)[0] || {}).on;
  ['sys-hubspot', 'sys-funnelreview', 'sys-unsched'].forEach(id => assert.strictEqual(on(id), false, id + ' ships off'));
  // An older sheet that had them on (seeded before v9): the seed turns each off once.
  ['sys-hubspot', 'sys-funnelreview'].forEach(id => t.ctx.cueSchedSet(id, { on: true }));
  t.props.CUE_SCHED_SEED = 'v7:old'; t.ctx.cueSchedSeed_();
  ['sys-hubspot', 'sys-funnelreview'].forEach(id => assert.strictEqual(on(id), false, id + ' turned off'));
  assert.ok(/sys-hubspot/.test(t.props.CUE_SCHED_OFF_ONCE) && /sys-funnelreview/.test(t.props.CUE_SCHED_OFF_ONCE));
  // Turned on again by hand, it stays on through a later seed.
  t.ctx.cueSchedSet('sys-hubspot', { on: true }); t.props.CUE_SCHED_SEED = 'v8:old'; t.ctx.cueSchedSeed_();
  assert.strictEqual(on('sys-hubspot'), true);
});
test('CO2 Today\'s tasks in the Morning thread: counts by place from Canvas plus Personal from the batch, no task repeated, and the batch drops its task lines', () => {
  const vm = require('vm'), fs = require('fs'), path = require('path');
  const page = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexThreads.html'), 'utf8');
  const fn = page.match(/function todayHtml\(t\) \{[\s\S]*?\n  \}\n/)[0];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const box = { esc, CUE_HOST: { canvas: {} }, localStorage: { getItem: () => '' }, canvasToday: [
    { k: 'a:Accenture', name: 'Accenture', overdue: 1, today: 1, assigned: 1 }, { k: 'crm', name: 'CRM', overdue: 0, today: 2, assigned: 0 },
    { k: 'todo', name: 'To do', overdue: 0, today: 0, assigned: 0 }] };
  const t = { reqs: [{ kind: 'sweep', batch: { items: [{ kind: 'tasks', why: 'Overdue since 2026-10-28', project: 'Secret task name' }, { kind: 'tasks', why: 'Due today', project: 'Other' }, { kind: 'rfq', why: 'no quote' }] } }] };
  vm.runInNewContext(fn + 'out = todayHtml(t);', Object.assign(box, { t }));
  const h = box.out;
  assert.ok(/Today's tasks/.test(h) && /7 tasks today, 2 overdue/.test(h), 'header counts: ' + h.slice(0, 300));
  assert.ok(/data-cteam="a:Accenture">Accenture ›/.test(h) && /<td>Personal<\/td><td>1<\/td><td>1<\/td><td>0<\/td><td>2<\/td>/.test(h), 'rows by place');
  assert.ok(!/To do/.test(h), 'an empty place is left out'); assert.ok(!/Secret task name/.test(h), 'no task repeated, counts only');
  assert.ok(/<th>Where<\/th><th>Overdue<\/th><th>Due today<\/th><th>Assigned to you<\/th><th>Total<\/th>/.test(h));
  box.localStorage = { getItem: () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10) };
  vm.runInNewContext('out = todayHtml(t);', box); assert.strictEqual(box.out, '', 'Done for now hides it until tomorrow');
  const pages = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexPages.html'), 'utf8');
  assert.ok(/b\.items\.forEach\(function \(it\) \{ if \(it\.kind === 'tasks'\) return;/.test(pages), 'the batch card leaves out its task lines');
  assert.ok(/threadTitle\(t\) === 'Morning'\) h = h\.slice\(0, cardsAt\) \+ todayHtml\(t\)/.test(page), 'the card leads the Morning thread');
});
