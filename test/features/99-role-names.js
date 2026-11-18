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
test('ROLE4 a draft under the new name joins the old-name thread, and replies go out under the newest name (Kiko "APPROVE 1-8", item 5)', () => {
  const st = { msgs: [] }, drafts = [agdUpd(40)];
  const t = sandbox({ bridgeFn: b => {
    if (b.action === 'agent_drafts') return { drafts };
    if (b.action === 'agent_message') { st.msgs.push(b.args); return { ok: true, message: { message_id: 'DRF-0099', at: '2026-11-16 16:00', text: b.args.text } }; }
  } });
  delete t.props.CUE_AGD_STATE; t.ctx.cueAgdTick_();
  const reqs = () => t.tabs.Requests.rows.slice(1).map(r => { try { return JSON.parse(r.slice(10).join('')); } catch (e) { return null; } }).filter(s => s && s.kind === 'agentdraft');
  const root = reqs()[0].id;
  t.ctx.cueAgdSay(root, 'before the rename', 'rolemsg0003');
  drafts.push(agdUpd(41, { agent: 'Procurement Specialist agent' })); delete t.props.CUE_AGD_STATE; t.ctx.cueAgdTick_();
  const all = reqs(); assert.strictEqual(all.length, 2); assert.strictEqual(all[1].ref, root, 'the new-name draft joins the old thread');
  t.ctx.cueAgdSay(root, 'after the rename', 'rolemsg0004');
  assert.deepStrictEqual(st.msgs.map(m => m.agent), ['ECII agent', 'Procurement Specialist agent']);
  const ag = JSON.parse(JSON.stringify(t.ctx.cueAgdAgents_())); assert.strictEqual(ag.length, 1); assert.deepStrictEqual([ag[0].agent, ag[0].ref], ['Procurement Specialist agent', root]);
});
test('ROLE5 AGENT-FULL-NAMES-2026-11-18 (Kiko 18 Nov 2026 02:15:58Z "why are the names AS, MM?"): AS shows as Account Specialist and MM as Multimedia, whole words only, server and page alike', () => {
  const t = sandbox(), page = cuePage(), ctx = {}; vm.createContext(ctx);
  vm.runInContext(page.match(/  function agdLabel\(v\) \{[^\n]*\n/)[0], ctx);
  [['AS', 'Account Specialist'], ['MM', 'Multimedia'], ['AS agent', 'Account Specialist agent'], ['MMX', 'MMX'], ['MASS', 'MASS'], ['Dot', 'Dot']]
    .forEach(([a, b]) => { assert.strictEqual(t.ctx.cueAgdLabel_(a), b, a); assert.strictEqual(ctx.agdLabel(a), b, 'page: ' + a); });
});
test('ROLE6 AGENT-CHANNELS-2026-11-18 (Kiko 02:16:48Z "there used to be channels per agent. How come others disappeared?"): a busy agent no longer pushes the others out of the list', () => {
  const drafts = [agdDraft(1, { agent: 'Finance agent' }), agdUpd(2, { agent: 'ECII agent' })].concat(Array.from({ length: 25 }, (_, i) => agdUpd(10 + i, { agent: 'AS', item: 'L' + i })));
  const b = agdBox({ drafts }); b.t.ctx.cueAgdTick_();
  const st = JSON.parse(JSON.stringify(b.t.ctx.cueState()));
  const agents = {}; st.requests.forEach(r => { if (r.agd && r.agd.agent) agents[r.agd.agent] = 1; });
  ['Finance agent', 'ECII agent', 'AS'].forEach(a => assert.ok(agents[a], a + ' keeps a thread: ' + Object.keys(agents)));
  assert.ok(st.requests.length <= 20 + 3, 'only one extra request per agent');
});
