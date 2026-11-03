// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: card overhaul phase 2 (routing and removed cards).
// Kiko approved the card review page 30 Oct 2026 07:59Z: "dont include" on the HubSpot clean-up card (07:45Z); the Thursday funnel
// records review and the Monday funnel lines repeat the Sales funnel card (06:57Z).
test('CO1 removed and duplicate rows are off: a new sheet ships them off, an older sheet turns them off once, and a later turn-on by hand sticks', () => {
  const t = sandbox(); t.ctx.cueState(); t.ctx.cueSchedules();
  const on = id => (t.ctx.cueSchedules().filter(x => x.id === id)[0] || {}).on;
  ['sys-funnelreview', 'sys-unsched'].forEach(id => assert.strictEqual(on(id), false, id + ' ships off'));
  // An older sheet that had them on (seeded before v9): the seed turns each off once.
  ['sys-funnelreview', 'sys-unsched'].forEach(id => t.ctx.cueSchedSet(id, { on: true }));
  t.props.CUE_SCHED_SEED = 'v7:old'; t.ctx.cueSchedSeed_();
  ['sys-funnelreview', 'sys-unsched'].forEach(id => assert.strictEqual(on(id), false, id + ' turned off'));
  assert.ok(/sys-unsched/.test(t.props.CUE_SCHED_OFF_ONCE) && /sys-funnelreview/.test(t.props.CUE_SCHED_OFF_ONCE));
  // Turned on again by hand, it stays on through a later seed.
  t.ctx.cueSchedSet('sys-unsched', { on: true }); t.props.CUE_SCHED_SEED = 'v8:old'; t.ctx.cueSchedSeed_();
  assert.strictEqual(on('sys-unsched'), true);
});
test('CO2 Today\'s tasks in the Morning thread: counts by place from Canvas plus Personal from the batch, no task repeated, and the batch drops its task lines', () => {
  const vm = require('vm'), fs = require('fs'), path = require('path');
  const page = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexThreads.html'), 'utf8');
  const fn = page.match(/function todayTasksHtml\(t\) \{[\s\S]*?\n  \}\n/)[0];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const box = { esc, CUE_HOST: { canvas: {} }, localStorage: { getItem: () => '' }, canvasToday: [
    { k: 'a:Accenture', name: 'Accenture', overdue: 1, today: 1, assigned: 1 }, { k: 'crm', name: 'CRM', overdue: 0, today: 2, assigned: 0 },
    { k: 'todo', name: 'To do', overdue: 0, today: 0, assigned: 0 }] };
  const t = { reqs: [{ kind: 'sweep', batch: { items: [{ kind: 'tasks', why: 'Overdue since 2026-10-28', project: 'Secret task name' }, { kind: 'tasks', why: 'Due today', project: 'Other' }, { kind: 'rfq', why: 'no quote' }] } }] };
  vm.runInNewContext(fn + 'out = todayTasksHtml(t);', Object.assign(box, { t }));
  const h = box.out;
  assert.ok(/Today's tasks/.test(h) && /7 tasks today, 2 overdue/.test(h), 'header counts: ' + h.slice(0, 300));
  assert.ok(/data-cteam="a:Accenture">Accenture ›/.test(h) && /<td>Personal<\/td><td>1<\/td><td>1<\/td><td>0<\/td><td>2<\/td>/.test(h), 'rows by place');
  assert.ok(!/To do/.test(h), 'an empty place is left out'); assert.ok(!/Secret task name/.test(h), 'no task repeated, counts only');
  assert.ok(/<th>Where<\/th><th>Overdue<\/th><th>Due today<\/th><th>Assigned to you<\/th><th>Total<\/th>/.test(h));
  box.localStorage = { getItem: () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10) };
  vm.runInNewContext('out = todayTasksHtml(t);', box); assert.strictEqual(box.out, '', 'Done for now hides it until tomorrow');
  const pages = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexPages.html'), 'utf8');
  assert.ok(/b\.items\.forEach\(function \(it\) \{ if \(it\.kind === 'tasks'\) return;/.test(pages), 'the batch card leaves out its task lines');
  assert.ok(/threadTitle\(t\) === 'Morning'\) h = h\.slice\(0, cardsAt\) \+ todayTasksHtml\(t\)/.test(page), 'the card leads the Morning thread');
});
test('CO3 New mail buttons follow the review (no Mute sender, no Not an inquiry) and a New mail reply is "Reply ready" with Send reply', () => {
  const vm = require('vm'), fs = require('fs'), path = require('path'), src = n => fs.readFileSync(path.join(__dirname, '..', 'src', n), 'utf8');
  const pages = src('IndexPages.html'), cards = src('IndexCards.html');
  const fn = pages.match(/  var NM_GROUP = [\s\S]*?\n  function nmCardHtml\(r\) \{[\s\S]*?\n  \}\n/)[0];
  const box = { esc: s => String(s), ago: () => 'now' };
  const it = (key, group, extra) => Object.assign({ key, group, who: 'Ana', subject: 'S ' + key, url: 'https://mail.google.com/x' }, extra || {});
  box.it = it;
  vm.runInNewContext(fn + 'out = nmCardHtml({ id: "n1", status: "Needs you", nm: { day: "Fri 30 Oct", items: [it("a", "inquiry"), it("b", "reply"), it("c", "fyi"), it("d", "reply", { acted: "reply", task_id: "cue-9" })] } });', box);
  const h = box.out;
  assert.ok(!/nm-mute|Mute sender|nm-noinq|Not an inquiry/.test(h), 'mute and not-an-inquiry gone');
  assert.ok(/data-act="nm-intake">Start intake/.test(h) && />Mark read</.test(h) && />Got it</.test(h), 'inquiry and FYI buttons');
  assert.strictEqual((h.match(/Open in Gmail/g) || []).length, 1, 'Open in Gmail on FYI only');
  assert.ok(/data-open-task="cue-9">Open reply/.test(h) && /Reply ready/.test(h), 'a drafted reply points to its card');
  const mc = cards.match(/  function mailCardHtml\(r\) \{[\s\S]*?\n  \}\n/)[0];
  const b2 = { esc: s => String(s), NEED: { 'Needs you': 1 }, metricLine: () => '' };
  vm.runInNewContext(mc + 'out = mailCardHtml({ id: "e1", status: "Needs you", mail: { job: "reply", to: "Ana", draft: { to: "a@x", subject: "Re: S", body: "Hi" } } });', b2);
  assert.ok(/>Reply ready</.test(b2.out) && /data-act="mail-send"[^>]*>Send reply</.test(b2.out) && /<textarea class="mail"/.test(b2.out), 'Reply ready, editable, Send reply');
});
