// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: canvas-project-lookup.
test('LK1 chat looks up Canvas projects: one search per name word, matches go to GPT, the prompt never says no access; a failed search is said plainly', () => {
  const SEL = { project_id: 'S-12345678AB', name: 'AMI - Selecta Merchandising Installation', account: 'AMI Group', date: '11/15/2026', status: 'For Client Awarding' };
  const HAL = { project_id: 'S-22345678AB', name: 'AMI Group Customized Halloween Gift Boxes', account: 'AMI Group', date: '10/31/2026', status: 'For Production Start' };
  const t = sandbox({ search: { ami: { projects: [SEL, HAL], total: 2 }, selecta: { projects: [SEL], total: 1 } } });
  t.ctx.cueSend('lookup AMI Group - Selecta project');
  deq(t.log.search || [], ['ami', 'selecta']); assert.strictEqual(t.log.gpt.length, 1);
  const inp = t.log.gpt[0].input;
  assert.ok(/Canvas projects: S-12345678AB \| AMI - Selecta/.test(inp), 'Selecta passed to GPT'); assert.ok(!/Halloween/.test(inp), 'one-word match dropped');
  assert.ok(/CAN look up Canvas projects/.test(t.log.gpt[0].instructions) && !/cannot change Canvas, look up/.test(t.log.gpt[0].instructions));
  const u = sandbox({ searchFail: true }); u.ctx.cueSend('what is the status of Selecta');
  assert.ok(/Canvas search failed/.test(u.log.gpt[0].input));
  const w = sandbox(); w.ctx.cueSend('find Zebra');
  assert.ok(/none matched "zebra"/.test(w.log.gpt[0].input));
});

test('LK2 "run full project intake" stays an intake even with a Canvas name match, with a note; change search never uses the client name alone', () => {
  const t = sandbox({ similar: JBL });
  const id = t.ctx.cueSend('New project intake. JBL wants new mats, 3m x 2m. Run full project intake now.').request_id, v = t.ctx.cueRun(id);
  assert.notStrictEqual(v.kind, 'change'); assert.ok(t.log.claude.length >= 1, 'costed');
  assert.ok((v.notes || []).some(n => /Canvas already has JBL Launch/.test(n)), JSON.stringify(v.notes));
  const u = sandbox({ similar: JBL, read: CHANGE_READ }), w = u.ctx.cueRun(u.ctx.cueSend('Start intake: JBL mats, 3m x 2m', [], 'intake').request_id);
  assert.notStrictEqual(w.kind, 'change', 'Start intake wins even when GPT reads a change');
});

test('LK3 a lookup only answers: GPT setting start_intake or claiming a start is overridden with what Canvas has', () => {
  const SEL = { project_id: 'S-15364680AM', name: 'AMI - Selecta Merchandising Installation Project', account: 'AMI Group', date: '12/15/2026', status: 'For Admin Completion' };
  const t = sandbox({ search: { selecta: { projects: [SEL], total: 1 }, ami: { projects: [SEL], total: 1 } },
    talk: { reply: 'Found it. I\'ve started the intake and I\'m running costing now.', looks_like_inquiry: false, start_intake: 'AMI - Selecta: run full project intake now with the attached files', task: '', readiness: '' } });
  const r = t.ctx.cueSend('can you look up the selecta project from AMI');
  assert.strictEqual(r.start_intake, ''); assert.ok(/S-15364680AM/.test(r.reply) && /Nothing was started/.test(r.reply), r.reply);
  assert.strictEqual(t.tabs.Requests.rows.length, 1, 'no request made');
  const u = sandbox({ talk: { reply: 'Starting it now.', looks_like_inquiry: false, start_intake: 'AMI - Selecta: run full project intake now with the attached files', task: '', readiness: '' } });
  const x = u.ctx.cueSend('start intake for selecta'); assert.ok(x.start_intake || x.request_id, 'an explicit ask still starts');
});

test('LK4 chat never claims work without a run: a claim gets a plain correction; a real start does not', () => {
  const t = sandbox({ talk: { reply: 'Yes, I\'ve pulled the requirements and I\'m working on them.', looks_like_inquiry: false, start_intake: '', task: '', readiness: '' } });
  const r = t.ctx.cueSend('do you have the requirements?');
  assert.ok(/nothing is running yet/.test(r.reply), r.reply); assert.strictEqual(t.tabs.Requests.rows.length, 1);
  assert.ok(/You do no work from chat yourself/.test(t.log.gpt[0].instructions));
});

test('LK5 "cost them by item" in an intake thread starts at costing: no GPT read, same requirements and files, item-level ask to Claude', () => {
  const t = startToCard(), gpt0 = t.log.gpt.length;
  const r = t.ctx.cueSend('can you cost them by item?', [], '', t.id);
  assert.ok(r.request_id && r.request_id !== t.id); const s0 = t.ctx.cueLoad_(r.request_id).s;
  assert.strictEqual(s0.stage, 'Checking Canvas'); assert.strictEqual(s0.ref, t.id); assert.strictEqual(s0.item_level, true);
  const v = t.ctx.cueRun(r.request_id);
  assert.strictEqual(v.status, 'Needs you', v.error); assert.strictEqual(v.kind, 'intake');
  assert.ok(!v.metrics.calls.some(c => c.step === 'read'), 'no GPT read');
  assert.ok(/item-level costing/.test(t.log.claude[t.log.claude.length - 1].messages[0].content.map ? JSON.stringify(t.log.claude[t.log.claude.length - 1].messages) : String(t.log.claude[t.log.claude.length - 1].messages[0].content)));
  assert.ok(t.tabs.Chat.rows.some(x => x[3] === r.request_id && /No new intake/.test(x[2])));
  const u = sandbox(); assert.ok(!u.ctx.cueSend('can you cost them by item?', [], '', '').request_id, 'no thread with a read: not a re-cost');
});

test('A10 the Chaser rules card drives the timing: first chaser after 1 business day; paused means no award lines', () => {
  const t = awardBox({ projects: [AW({ awaiting: { since: '2026-10-20' } })] }); t.ctx.cueRulesSave({ 'award.first': 1 });
  t.ctx.cueSweep(); const [it] = awItems(t); assert.ok(/, 1 business day with no award decision\. .*Chaser 1 of 3/.test(it.why), it.why);
  const u = awardBox(); u.ctx.cueRulesSave({ 'award.on': false }); u.ctx.cueSweep();
  assert.ok(u.tabs.Chat.rows.some(r => /nothing to chase today/.test(r[2]))); assert.ok(!u.log.queries, 'no Gmail search when paused');
});
