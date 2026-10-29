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
