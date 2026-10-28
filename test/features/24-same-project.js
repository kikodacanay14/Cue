// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: same-project.
test('N1 Kiko 14:22-14:27Z: similar means Project Name, Account and Event Date; Cue asks first; a Project ID in Kiko\'s words needs no question', () => {
  const EXI = [{ project_id: 'S-10243120EX', name: 'Exilara Year End Party', account: 'Exilara', date: '12/10/2026', status: 'For Event Execution', why: 'similar name' },
    { project_id: 'S-12291744DM', name: 'DMCI Year End 2026', account: 'DMCI', date: '12/12/2026', status: 'For Client Awarding', why: 'similar name' }];
  const UNI = Object.assign({}, READ, { client: Object.assign({}, READ.client, { company: 'Unilever' }), event: Object.assign({}, READ.event, { name: 'UNILEVER YEAR END PARTY 2026' }) });
  const t = sandbox({ similar: EXI, read: UNI }), v = t.ctx.cueRun(t.ctx.cueSend('New project intake. Client inquiry:').request_id);
  assert.strictEqual(v.status, 'Needs you', v.error); assert.strictEqual(v.kind, 'intake', 'runs as new');
  assert.ok(!t.log.bridge.some(b => b.action === 'list_project_files'), 'no change function');
  assert.ok((v.notes || []).some(n => /similar name \(Exilara Year End Party; DMCI Year End 2026\).*runs as a new intake/.test(n)), JSON.stringify(v.notes));
  deq(v.similar, [], 'no possible-duplicate line on the card');
  const c = t.ctx;   // the rule itself
  assert.strictEqual(c.cueSameProject_({ x: UNI }, EXI[0]), false);
  assert.strictEqual(c.cueSameProject_({ x: JBL_READ }, JBL[0]), true, 'same client and name');
  assert.strictEqual(c.cueSameProject_({ x: JBL_READ }, JBL[1]), false, 'same client, other event');
  const u = sandbox({ similar: EXI, read: UNI }), w = u.ctx.cueRun(u.ctx.cueSend('New mats for S-10243120EX, requote please', [], 'intake').request_id);
  assert.strictEqual(w.kind, 'change', 'Kiko named the project ID: no question'); assert.strictEqual(w.change.match.project_id, 'S-10243120EX');
  const n = sandbox({ similar: JBL, read: JBL_READ }), nid = n.ctx.cueSend('New project intake. JBL wants new mats').request_id; n.ctx.cueRun(nid);
  const nv = n.ctx.cueSameAnswer(nid, 'new');
  assert.strictEqual(nv.kind, 'intake'); assert.strictEqual(nv.status, 'Needs you', nv.error); assert.ok(nv.proposal, 'No, new project: the full intake runs');
  assert.ok(n.tabs.Chat.rows.some(r => /A new project: running the full intake/.test(r[2])));
  assert.strictEqual(c.cueSameProject_({ x: JBL_READ }, Object.assign({}, JBL[0], { date: '2026-12-20' })), false, 'event date too far apart');
  assert.strictEqual(c.cueSameProject_({ x: Object.assign({}, JBL_READ, { client: { company: '' } }) }, JBL[0]), false, 'no account read: not similar');
  assert.strictEqual(c.cueSameProject_({ x: Object.assign({}, UNI, { event: { name: 'Unilever Year End Party' } }) },
    { name: 'Unilever Year End Party 2026', account: 'Unilever', date: '12/11/2026' }), true, 'same client, same event-type name');
  assert.strictEqual(c.cueSameProject_({ x: UNI }, { name: 'Unilever Year End Party 2025', account: 'Unilever', date: '12/12/2025' }), false, 'last year\'s party is another project');
});

let pass = 0;
