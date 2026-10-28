// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: process-mapper.
// ---------- Process Mapper (Kiko 08:07Z, specs/process-mapper.md) ----------
const STEP = (title, block, who, extra) => Object.assign({ title, block, who, input: 'in', output: 'out', writes: '', sends: false, readback: false, why_owner: 'fits' }, extra || {});
const MAP = { name: 'RFQ chasers', goal: 'Nudge suppliers who have not quoted.', target: 'Zapier', trigger: 'Every weekday at 07:00', scheduled: true,
  steps: [STEP('Find unanswered RFQs', 'Read email', 'Code'), STEP('Draft nudges', 'Ask Claude', 'Claude'), STEP('Kiko approves', 'Wait for Kiko', 'Kiko'),
    STEP('Send the nudges', 'Send email', 'Code', { sends: true })],
  est_seconds: 40, questions: ['Chase after 3 working days?'], zap_steps: ['Add a Schedule by Zapier trigger named "Schedule"'], reply: 'Mapped it in 4 steps.' };
const TALK_MAP = { reply: 'Claude is mapping it.', looks_like_inquiry: false, start_intake: '', task: '', workflow: { job: 'map', name: 'RFQ chasers' } };
function mapToCard(o) {
  const t = sandbox(Object.assign({ talk: TALK_MAP, cost: MAP }, o || {}));
  const id = t.ctx.cueSend('Map how we chase suppliers who have not quoted, as a Zap', [], '').request_id;
  return Object.assign(t, { id, v: t.ctx.cueRun(id) });
}
test('W1 a map ask: chat call + one Claude call, a card with blocks and owners, no Canvas, Gmail or bridge use', () => {
  const t = mapToCard(), v = t.v;
  assert.strictEqual(v.kind, 'workflow'); assert.strictEqual(v.status, 'Needs you'); assert.strictEqual(v.metrics.ai_calls, 1, 'Claude only (the chat call is its own)');
  assert.strictEqual(t.log.claude.length, 1); assert.strictEqual(t.log.gpt.length, 1, 'just the chat call');
  assert.strictEqual(t.log.bridge.filter(b => b.action !== 'search_projects').length, 0); deq(t.log.search || [], ['quoted', 'zap'], 'the chat lookup, also a read'); assert.strictEqual(t.log.gmail.length, 0);
  deq(v.workflow.map.steps.map(x => [x.n, x.block, x.who]), [[1, 'Read email', 'Code'], [2, 'Ask Claude', 'Claude'], [3, 'Wait for Kiko', 'Kiko'], [4, 'Send email', 'Code']]);
  deq(v.workflow.flags, [], 'a clean map has no flags');
  const ask = JSON.parse(t.log.claude[0].messages[0].content);
  deq(ask.blocks, ['Read email', 'Read Canvas', 'Ask Claude', 'Ask ChatGPT', 'Wait for Kiko', 'Write to Canvas', 'Make Gmail draft', 'Send email', 'Save file', 'Schedule']);
  assert.ok(/chase suppliers/.test(ask.kiko_asked));
  assert.ok(t.tabs.Chat.rows.some(x => x[3] === '>' + t.id), 'main chat points to the new thread');
});
test('W2 the rules are checked in code: ungated send, ChatGPT writing Canvas, no readback, unknown block, owner mismatch, budget, schedule + ChatGPT', () => {
  const bad = Object.assign({}, MAP, { est_seconds: 400, steps: [STEP('Email the client the invoice', 'Send email', 'Code', { sends: true }), STEP('Update the project', 'Write to Canvas', 'ChatGPT', { writes: 'Canvas' }),
    STEP('Think', 'Ask Claude', 'ChatGPT'), STEP('Magic', 'Teleport', 'Code'), STEP('a', 'Ask Claude', 'Claude'), STEP('b', 'Ask Claude', 'Claude'), STEP('c', 'Ask Claude', 'Claude'), STEP('d', 'Ask ChatGPT', 'ChatGPT')] });
  const f = mapToCard({ cost: bad }).v.workflow.flags, rules = f.map(x => x.step + ':' + x.rule);
  ['1:5', '2:1', '2:2', '2:7', '3:6', '4:6', '0:3', '0:4'].forEach(r => assert.ok(rules.indexOf(r) >= 0, 'missing flag ' + r + ' in ' + rules));
  assert.ok(f.some(x => /never sent without you/.test(x.text)), 'money/client wording on an ungated send');
  assert.strictEqual(f.filter(x => x.rule === 3).length, 2, 'too many AI steps and too slow');
});
test('W3 a reply in the thread revises (one Claude call); "check with GPT" asks ChatGPT; both stay waiting for Kiko', () => {
  const t = mapToCard();
  const r1 = t.ctx.cueSend('make step 2 ChatGPT instead', [], '', t.id); assert.strictEqual(r1.request_id, t.id);
  const v1 = t.ctx.cueRun(t.id);
  assert.strictEqual(v1.status, 'Needs you'); assert.strictEqual(t.log.claude.length, 2); assert.strictEqual(v1.workflow.revisions, 1);
  const ask = JSON.parse(t.log.claude[1].messages[0].content); assert.strictEqual(ask.revise, 'make step 2 ChatGPT instead'); assert.ok(ask.current_map && ask.current_map.steps.length === 4);
  t.opts.gpt = { workflow_check: { verdict: 'Solid, one gap.', concerns: ['No stop after 2 nudges'] } };
  t.ctx.cueSend('check with GPT please', [], '', t.id); const v2 = t.ctx.cueRun(t.id);
  assert.strictEqual(v2.status, 'Needs you'); assert.strictEqual(v2.workflow.check.verdict, 'Solid, one gap.'); assert.strictEqual(t.log.claude.length, 2, 'no extra Claude call');
  assert.strictEqual(v2.metrics.ai_calls, 3);
});
test('W4 approve saves to the Workflows tab only; a second approval of the same name is version 2; reject saves nothing', () => {
  const t = mapToCard(), v = t.ctx.cueApprove(t.id, {});
  assert.strictEqual(v.status, 'Done'); assert.strictEqual(v.workflow.saved.version, 1);
  const rows = t.tabs.Workflows.rows; assert.strictEqual(rows.length, 2);
  deq(rows[1].slice(1, 6), ['RFQ chasers', 1, 'Zapier', 'Approved', 'Every weekday at 07:00']);
  assert.ok(/1\. Read email \(Code\): Find unanswered RFQs/.test(rows[1][6])); assert.strictEqual(JSON.parse(rows[1][10]).length, 4);
  assert.strictEqual(t.log.bridge.filter(b => b.action !== 'search_projects').length + t.log.gmail.length, 0, 'nothing written outside Cue'); deq(t.log.search || [], ['quoted', 'zap'], 'the chat lookup, also a read');
  assert.throws(() => t.ctx.cueApprove(t.id, {}), /not waiting/);
  const id2 = t.ctx.cueSend('Map the RFQ chasers zap again', [], '').request_id, v2 = t.ctx.cueRun(id2);
  assert.strictEqual(v2.workflow.updates.version, 1, 'finds the saved version');
  assert.ok(JSON.parse(t.log.claude[1].messages[0].content).saved.steps.length === 4, 'Claude gets the saved steps to update');
  assert.strictEqual(t.ctx.cueApprove(id2, {}).workflow.saved.version, 2);
  const u = mapToCard(); u.ctx.cueReject(u.id, ''); assert.ok(!u.tabs.Workflows || u.tabs.Workflows.rows.length <= 1, 'nothing saved on reject');
});
test('W5 a screenshot with a map word: GPT reads it first (2 AI calls), then Claude maps from what GPT read', () => {
  const t = sandbox({ cost: MAP, gpt: { workflow_read: { steps: '1. Gmail: new email labelled RFQ\n2. Filter', note: '' } } });
  const png = { name: 'zap.png', type: 'image/png', data: Buffer.from('fake png').toString('base64') };
  const id = t.ctx.cueSend('map this zap', [png], '').request_id, v = t.ctx.cueRun(id);
  assert.strictEqual(v.kind, 'workflow'); assert.strictEqual(v.metrics.ai_calls, 2); assert.strictEqual(t.log.gpt[0].text.format.name, 'workflow_read');
  assert.ok(JSON.parse(t.log.claude[0].messages[0].content).from_files.indexOf('labelled RFQ') >= 0);
  const i2 = sandbox().ctx.cueSend('Acme inquiry attached', [png], '').request_id; assert.ok(i2, 'files without a map word still start an intake');
});
test('W6 Claude failing on the first map stops the run with the error; on a revision the old map stays', () => {
  const t = mapToCard({ fail: { cost: () => resp(400, { error: { type: 'invalid_request_error', message: 'nope' } }) } });
  assert.strictEqual(t.v.status, 'Failed'); assert.ok(/Claude/.test(t.v.error));
  const u = mapToCard(); u.opts.fail = { cost: () => resp(400, { error: { type: 'x', message: 'nope' } }) };
  u.ctx.cueSend('drop step 4', [], '', u.id); const v = u.ctx.cueRun(u.id);
  assert.strictEqual(v.status, 'Needs you'); assert.strictEqual(v.workflow.map.steps.length, 4); assert.ok(v.notes.some(n => /could not revise/.test(n)));
});
