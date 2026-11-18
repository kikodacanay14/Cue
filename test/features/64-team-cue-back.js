// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: team-cue-back.
/* TEAM-CUE-BACK (Kiko 29 Oct 2026 15:59Z "can there be a button in Ask Cue that switches me back the other chat"): inside Canvas,
 * Ask Cue's header shows "Back to Team Cue", which asks Canvas ({canvasWs:'cueBack'}) to open the Team Cue panel. */
test('TCB1 Back to Team Cue: hidden on its own, shown inside Canvas, and asks Canvas to switch', () => {
  const page = cuePage();
  assert.ok(/<button class="btn ghost tcue" id="team-cue" type="button" hidden>Back to Team Cue<\/button>/.test(page), 'header button, hidden by default');
  const src = page.slice(page.indexOf('  function teamCueBtn() {'), page.indexOf('  // 1.27.23 (PC check 24 Oct 14:29Z)'));
  const sent = [], btn = { hidden: true, onclick: null }, ctx = vm.createContext({ sent, document: { getElementById: id => id === 'team-cue' ? btn : null } });
  ctx.CUE_HOST = {};
  vm.runInContext(src + '\nthis.teamCueBtn = teamCueBtn;', ctx);
  ctx.teamCueBtn(); assert.strictEqual(btn.hidden, true, 'standalone Cue: no button');
  ctx.CUE_HOST.canvas = { postMessage: (m, o) => sent.push([m, o]) };
  ctx.teamCueBtn(); assert.strictEqual(btn.hidden, false, 'inside Canvas: shown');
  btn.onclick(); deq(sent, [[{ canvasWs: 'cueBack' }, '*']]);
  assert.ok(page.indexOf("cueCover(''); teamCueBtn(); return; }") > 0, 'shown once Canvas answers cueHost');
});
/* ASK-CUE-ROWS (Kiko 15:56Z, 15:58Z, card pick 16:01Z "Inside Ask Cue's list"): Canvas's CRM and To do rows list in Ask Cue. */
test('TCB2 From Canvas rows: only CRM and To do, cleaned, listed on top, and a tap asks Canvas for that thread', () => {
  const page = cuePage();
  const src = page.slice(page.indexOf('  var canvasRows = [];'), page.indexOf('  function teamCueBtn() {'));
  const ctx = vm.createContext({ String, Math });
  vm.runInContext(src + '\nthis.set = canvasRowsSet; this.get = function () { return canvasRows; };', ctx);
  ctx.set([{ k: 'crm', name: 'CRM', sub: 'Call back Unilever', n: '5' }, { k: 'mail', name: 'x' }, null, { k: 'todo', sub: 'Release payment', n: -2 }]);
  deq(JSON.parse(JSON.stringify(ctx.get())), [{ k: 'crm', name: 'CRM', sub: 'Call back Unilever', n: 5 }, { k: 'todo', name: 'To do', sub: 'Release payment', n: 0 }]);
  assert.ok(page.indexOf("if (d.canvasWs === 'cueRows' && e.source === CUE_HOST.canvas && Array.isArray(d.rows))") > 0, 'only from Canvas');
  assert.ok(page.indexOf("var cvRows = !showArchived && !tq && CUE_HOST.canvas ? canvasRows : [];") > 0 && page.indexOf("var extra = g[0] === 'job' ? cvRows : [];") > 0, 'listed at the top of Jobs (CUE-CHANNELS-2026-11-18)');
  assert.ok(page.indexOf("CUE_HOST.canvas.postMessage({ canvasWs: 'cueTeam', k: b.getAttribute('data-cteam') }, '*')") > 0, 'tap asks Canvas');
});
