// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: one-cue.
/* ONE-CUE (Kiko 29 Oct 2026 15:26Z, 15:27Z, 15:39Z "clean up the notifications and threads so that they only appear once"): inside
 * Canvas's Cue panel, Canvas lists Ask Cue's threads, each in one home. Cue sends them up (panelFeed) and drops its own list there. */
const oneCueFeed = () => {
  const page = cuePage(), src = page.slice(page.indexOf('  var CUE_CRM_K = '), page.indexOf("  $('tab-threads').onclick"));
  const sent = [], ctx = vm.createContext({ JSON, Date, String, Object, sent });
  ctx.CUE_HOST = { canvas: { postMessage: (m) => sent.push(m) }, panel: true };
  ctx.noTok = x => String(x || '');
  ctx.threadTitle = t => t.title; ctx.threadState = t => t.st || { text: 'Done' };
  vm.runInContext(src + '\nthis.panelFeed = panelFeed;', ctx);
  return { ctx, sent };
};
const oneTh = (id, reqs, extra) => Object.assign({ root: id, title: id, lines: [{ who: 'Cue', text: id + ' line\nmore', time: '2026-10-29T01:00:00Z' }],
  reqs: reqs.map((r, i) => Object.assign({ id: i ? id + '-' + i : id, status: 'Needs you', created: '2026-10-29T00:00:00Z' }, r)) }, extra || {});
test('OC1 one Cue: each Ask Cue thread goes up with its one home, its job family and its project', () => {
  const { ctx, sent } = oneCueFeed(), need = { need: 1, text: 'Needs you' };
  const th = {
    p1: oneTh('p1', [{ kind: 'pipeline' }], { st: need }),
    n1: oneTh('n1', [{ kind: 'newmail' }]),
    f1: oneTh('f1', [{ kind: 'gtask', gt: { key: 'followups' } }]),
    a1: oneTh('a1', [{ kind: 'gtask', gt: { key: 'admin_funnel' } }]),
    d1: oneTh('d1', [{ kind: 'gtask', gt: { key: 'daily_plan' } }]),
    s1: oneTh('s1', [{ kind: 'gtask', gt: { key: 'personal_spending' } }]),
    e1: oneTh('e1', [{ kind: 'personal' }]),
    r1: oneTh('r1', [{ kind: 'ar', ar: { project: 'Telus Q2 Leadership Connect', project_id: 'S-25506500TR' } }]),
    c1: oneTh('c1', [{ kind: 'change', change: { project: 'Hiraya Rewards and Recognitions' } }]),
    i1: oneTh('i1', [{ kind: 'intake' }]),
    w1: oneTh('w1', [{ kind: 'sweep', day: '2026-10-29' }]),
    x1: oneTh('x1', [{ kind: 'bids', archived: true }])
  };
  ctx.byId = () => { const o = {}; Object.keys(th).forEach(k => th[k].reqs.forEach(r => { o[r.id] = r; })); return o; };
  ctx.panelFeed(th);
  assert.strictEqual(sent.length, 1); const L = sent[0].list, by = {}; L.forEach(x => { by[x.id] = x; });
  assert.strictEqual(sent[0].canvasWs, 'cueThreads');
  deq(Object.keys(by).sort(), ['a1', 'c1', 'd1', 'e1', 'f1', 'i1', 'n1', 'p1', 'r1', 's1', 'w1'], 'archived threads stay out');
  deq(['p1', 'f1', 'a1'].map(k => by[k].home), ['crm', 'crm', 'crm'], 'sales reviews and lead jobs: CRM');
  deq([by.n1.home, by.s1.home, by.e1.home, by.d1.home, by.i1.home, by.w1.home], ['mail', 'personal', 'personal', 'todo', 'todo', 'todo']);
  deq([by.r1.home, by.r1.pid, by.r1.project], ['project', 'S-25506500TR', 'Telus Q2 Leadership Connect']);
  deq([by.c1.home, by.c1.pid, by.c1.project], ['project', '', 'Hiraya Rewards and Recognitions'], 'a project by name: Canvas matches the name');
  deq([by.p1.need, by.p1.fam, by.d1.fam, by.w1.fam, by.c1.fam], [true, 'k:pipeline', 'gt:daily_plan', 'k:sweep', ''], 'runs of one job share a family');
  assert.strictEqual(by.n1.line, 'n1 line', 'first line of Cue\'s last message');
  ctx.panelFeed(th); assert.strictEqual(sent.length, 1, 'nothing changed: nothing sent');
  ctx.CUE_HOST.panel = false; th.p1.title = 'Pipeline review'; ctx.panelFeed(th); assert.strictEqual(sent.length, 1, 'not in the panel: never sent');
});
test('OC2 one Cue: only the Canvas host turns on panel mode; inside it Ask Cue hides its own list and job pointers, Kiko\'s own answers stay', () => {
  const page = cuePage();
  assert.ok(/if \(d\.panel\) \{ CUE_HOST\.panel = true; document\.body\.classList\.add\('in-panel'\)/.test(page));
  assert.ok(/d\.canvasWs === 'cueHost' && !CUE_HOST\.canvas\) \{ CUE_HOST\.canvas = e\.source;/.test(page), 'panel mode rides on the one cueHost');
  assert.ok(/if \(CUE_HOST\.panel && !answers\) return;/.test(page), 'job pointers skip; a pointer answering Kiko still shows');
  assert.ok(/body\.in-panel nav, body\.in-panel #page-threads/.test(page), 'no Threads button or list inside the panel');
  assert.ok(/renderThreadList\(th\); panelFeed\(th\);/.test(page));
});
