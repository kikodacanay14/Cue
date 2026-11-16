// Part of test/cue.test.js. Feature: ROLE-NAMES-2026-11-16 (CueAgentDrafts.gs cueAgdLabel_, IndexChat.html agdLabel). Kiko 16 Nov
// 2026 13:13Z "lets change ECII to Procurement Specialist and ECI to Event Specialist"; Cue and dashboard labels approved "aproved 9
// and 10". Display only: the stored agent name stays the thread key and is what agent_message sends.
test('ROLE1 the shown name maps ECII to Procurement Specialist and ECI to Event Specialist, whole words only, the same on server and page', () => {
  const t = sandbox(), page = cuePage(), ctx = {}; vm.createContext(ctx);
  vm.runInContext(page.match(/  function agdLabel\(v\) \{[^\n]*\n/)[0], ctx);
  const cases = [['ECII agent', 'Procurement Specialist agent'], ['ECII RFP agent', 'Procurement Specialist RFP agent'], ['ECI agent', 'Event Specialist agent'],
    ['Account Specialist', 'Account Specialist'], ['ECIIX agent', 'ECIIX agent'], ['', ''], [null, '']];
  cases.forEach(([a, b]) => { assert.strictEqual(t.ctx.cueAgdLabel_(a), b, String(a)); assert.strictEqual(ctx.agdLabel(a), b, 'page: ' + a); });
});
test('ROLE2 the thread and the agent list show the new name, the stored name stays the key, and a tag with either name reaches the same agent', () => {
  const b = tagBox(), ecii = b.root('ECII agent');
  const v = JSON.parse(JSON.stringify(b.t.ctx.cueView_(b.t.ctx.cueLoad_(ecii).s)));
  assert.strictEqual(v.name, 'Procurement Specialist agent'); assert.strictEqual(v.agd.agent, 'ECII agent', 'stored name kept');
  assert.strictEqual(pageKindName(v), 'Procurement Specialist agent');
  const ag = JSON.parse(JSON.stringify(b.t.ctx.cueAgdAgents_())).filter(a => a.agent === 'ECII agent')[0];
  assert.strictEqual(ag.label, 'Procurement Specialist agent');
  const r1 = b.t.ctx.cueSend('@Procurement Specialist agent ask for the LED quote', [], '', '', '', 'rolemsg0001');
  const r2 = b.t.ctx.cueSend('@ECII agent ask for the truss quote', [], '', '', '', 'rolemsg0002');
  assert.deepStrictEqual([r1.agent, r1.thread, r2.agent, r2.thread], ['ECII agent', ecii, 'ECII agent', ecii]);
  assert.deepStrictEqual(b.st.msgs.map(m => m.agent), ['ECII agent', 'ECII agent'], 'Canvas still gets the stored name');
  assert.deepStrictEqual(b.rows('@' + ecii).filter(l => /^Kiko/.test(l)), ['Kiko: @Procurement Specialist agent ask for the LED quote', 'Kiko: @Procurement Specialist agent ask for the truss quote']);
  assert.ok(b.rows(ecii).some(l => l === 'Cue: Saved for Procurement Specialist agent · it reads it on its next run'));
  assert.throws(() => b.t.ctx.cueSend('@Procurement Specialist agent', [], '', '', ''), /Type your message after Procurement Specialist agent\./);
});
test('ROLE3 the page: the @ list shows and inserts the new name, the old name still matches, and an older main-chat row draws the new tag', () => {
  const page = cuePage();
  ['esc(agdLabel(a.agent))', "'@' + agdLabel(a.agent) + ' '", '[agdLabel(a.agent), a.agent]', "'<span class=\"tag\">@' + esc(lb)"].forEach(x => assert.ok(page.indexOf(x) >= 0, x));
  assert.ok(!/esc\(A\.agent\)/.test(page), 'every card shows the new name');
  assert.ok(/agdLabel\(x0\.agd\.agent\)/.test(page), 'the thread box names the agent by its new name');
});
