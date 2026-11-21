// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: teach-cue.
/* ---------- Teach Cue (CueTeach.gs, specs/teach-cue.md) ---------- */
const MEMORY = { summary: 'Twelve memories; one card number left out.', facts: [
  { text: 'Kiko runs Blank Space Events (BSE), an events company in the Philippines.', topic: 'BSE', always: true, replaces: 0 },
  { text: 'Kiko prefers short, direct answers.', topic: 'preferences', always: true, replaces: 0 },
  { text: 'Kiko always asks Sonic Pro first for LED wall quotes.', topic: 'suppliers', always: false, replaces: 0 },
  { text: 'Acme Corp pays in 30 days and wants VAT-inclusive quotes.', topic: 'clients', always: false, replaces: 3 },
  { text: 'My card is 4111 1111 1111 1111', topic: 'money', always: false, replaces: 0 },
  { text: 'Kiko prefers short, direct answers.', topic: 'preferences', always: false, replaces: 0 },
  { text: 'Old fact already saved', topic: 'tools', always: false, replaces: 0 },
  { text: '   ', topic: 'tools', always: false, replaces: 0 }] };
const PROCESS = { summary: 'Two skills became two processes.', processes: [
  { name: 'Manage project intake', goal: 'Turn an inquiry into a costed project.', trigger: 'new event inquiry, RFP, brief or quotation request',
    steps: [{ title: 'Read the inquiry and attachments', who: 'ChatGPT', writes: '', sends: false, readback: false },
      { title: 'Cost each requirement from past quotes', who: 'Claude', writes: '', sends: false, readback: false },
      { title: 'Add the project to Canvas', who: 'Canvas', writes: 'Canvas', sends: false, readback: false },
      { title: 'Send RFQs to 5 suppliers', who: 'Code', writes: '', sends: true, readback: false }], questions: ['Five suppliers per scope?'], updates: '' },
  { name: 'Finance admin', goal: 'Record expenses.', trigger: 'receipt, expense, reimbursement', steps: [], questions: [], updates: '' }] };
function teachRun(say, o) { const t = sandbox(o); if (o && o.before) o.before(t); const out = t.ctx.cueSend(say, [], ''); const v = t.ctx.cueRun(out.request_id); return Object.assign(t, { id: out.request_id, v }); }

test('TC1 "learn my memory" + paste: no chat call, 1 Claude call (no memory added to it), a card; repeats, secrets and known facts dropped; nothing saved yet', () => {
  const t = teachRun('Learn my memory:\n- Runs BSE\n- Prefers short answers\n- Card 4111 1111 1111 1111', { before: u => { u.tabs.Memory = sheetMock();
    [['On', 'Topic', 'Fact', 'Always', 'Saved', 'Request'], [true, 'tools', 'Old fact already saved', false, '', ''], [true, 'clients', 'Acme pays in 45 days', false, '', '']].forEach(r => u.tabs.Memory.appendRow(r)); } });
  deq([t.log.gpt.length, t.log.claude.length, t.v.kind, t.v.status, t.v.metrics.ai_calls], [0, 1, 'memory', 'Needs you', 1]);
  const ask = JSON.parse(t.log.claude[0].messages[0].content);
  assert.ok(!/\d{4} \d{4} \d{4}/.test(ask.pasted) && /\[number\]/.test(ask.pasted), 'card number masked before it leaves Cue');
  deq(ask.known_facts.map(f => f.n), [2, 3]); assert.ok(!/What Kiko told Cue/.test(t.log.claude[0].system), 'the learn call gets no memory block');
  deq(t.v.teach.facts.map(f => [f.k, f.topic, f.always, f.replaces]), [['F1', 'BSE', true, ''], ['F2', 'preferences', true, ''], ['F3', 'suppliers', false, ''], ['F4', 'clients', false, 'Acme pays in 45 days']]);
  assert.ok(t.v.notes.some(n => /password, key or account number/.test(n)) && t.v.notes.some(n => /already in your Memory tab/.test(n)));
  deq(t.tabs.Memory.rows.length, 3, 'nothing written before approval');
  assert.ok(!JSON.stringify(t.state(t.id)).includes('Prefers short answers'), 'the paste is not kept after Claude read it');
  assert.throws(() => sandbox().ctx.cueSend('learn my memory', [], ''), /Paste your memory list/);
});

test('TC2 approve memory: ticked facts, as edited, go to the Memory tab (an update replaces its row); later calls carry Always facts plus matching ones only', () => {
  const t = teachRun('learn my memory ' + 'x'.repeat(40), { before: u => { u.tabs.Memory = sheetMock();
    [['On', 'Topic', 'Fact', 'Always', 'Saved', 'Request'], [true, 'tools', 'Uses Canva for decks', false, '', ''], [true, 'clients', 'Acme pays in 45 days', false, '', '']].forEach(r => u.tabs.Memory.appendRow(r)); } });
  const d = t.ctx.cueApprove(t.id, { skip: ['F2', 'F5'], bodies: { F3: 'Kiko asks Sonic Pro first for LED wall quotes.' }, always: ['F1'] });
  deq(d.status, 'Done');
  deq(t.tabs.Memory.rows.slice(1).map(r => [r[0], r[1], r[2], r[3]]), [[true, 'tools', 'Uses Canva for decks', false],
    [true, 'clients', 'Acme Corp pays in 30 days and wants VAT-inclusive quotes.', false],
    [true, 'BSE', 'Kiko runs Blank Space Events (BSE), an events company in the Philippines.', true], [true, 'suppliers', 'Kiko asks Sonic Pro first for LED wall quotes.', false]]);
  const led = t.ctx.cueTeachFor_('Find LED wall suppliers in Cebu'), other = t.ctx.cueTeachFor_('Draft a birthday note');
  assert.ok(/Kiko runs Blank Space Events/.test(led) && /Sonic Pro first/.test(led) && !/Acme/.test(led) && !/Canva/.test(led));
  assert.ok(/Kiko runs Blank Space Events/.test(other) && !/Sonic Pro/.test(other));
  t.tabs.Memory.rows[4][0] = false; t.ctx.cueTeachReset_(); assert.ok(!/Sonic Pro/.test(t.ctx.cueTeachFor_('LED wall suppliers')), 'switched off in the sheet');
  const call = t.ctx.cueClaude_({ step: 'x', system: 'You test.', user: 'Acme Corp quote terms', schema: {} });
  assert.ok(/^You test\.\n\nWhat Kiko told Cue to remember/.test(JSON.parse(call.req.payload).system) && /Acme Corp pays in 30 days/.test(JSON.parse(call.req.payload).system));
  const c = teachRun('learn my memory ' + 'x'.repeat(40)); deq(c.ctx.cueReject(c.id, '').status, 'Rejected'); assert.ok(!c.tabs.Memory, 'one-tap reject saves nothing');
});

test('TC3 "learn my process": 1 Claude call, steps with an owner each, Process Mapper rule flags; approve saves to Workflows with Use in prompts; matching calls follow it', () => {
  const t = teachRun('learn my process\nManage Project Intake skill: read the inquiry, cost it, add to Canvas, send RFQs.');
  deq([t.log.gpt.length, t.log.claude.length, t.v.kind, t.v.status], [0, 1, 'process', 'Needs you']);
  deq(t.v.teach.procs.map(p => p.name), ['Manage project intake'], 'a process with no steps is dropped');
  const p = t.v.teach.procs[0];
  deq(p.steps, 'ChatGPT: Read the inquiry and attachments\nClaude: Cost each requirement from past quotes\nCanvas: Add the project to Canvas\nCode: Send RFQs to 5 suppliers');
  assert.ok(p.flags.some(f => /Writes to Canvas with no Wait for Kiko/.test(f)) && p.flags.some(f => /not read back/.test(f)) && p.flags.some(f => /Sends with no Wait for Kiko/.test(f)));
  const d = t.ctx.cueApprove(t.id, { skip: [], bodies: { P1: '1. ChatGPT: Read the inquiry and attachments\nClaude: Cost each requirement from past quotes\nKiko: Approve the costing\nCanvas: Add the project to Canvas and read it back\nKiko: Approve and send the RFQs',
    'P1:when': 'new event inquiry, RFP, brief, quotation request' } });
  deq(d.status, 'Done');
  const row = t.tabs.Workflows.rows[1];
  deq([t.tabs.Workflows.rows[0][12], row[1], row[2], row[3], row[4], row[5], row[7], row[12]], ['Use in prompts', 'Manage project intake', 1, 'Cue', 'Approved', 'new event inquiry, RFP, brief, quotation request', '', true]);
  assert.ok(/^1\. ChatGPT: Read the inquiry/.test(row[6]) && /5\. Kiko: Approve and send the RFQs$/.test(row[6]));
  const hit = t.ctx.cueTeachFor_('New event inquiry from Acme with a brief attached'), miss = t.ctx.cueTeachFor_('Record this receipt');
  assert.ok(/approved process "Manage project intake"/.test(hit) && /3\. Kiko: Approve the costing/.test(hit)); deq(miss, '');
  const again = teachRun('learn my process: intake again ' + 'x'.repeat(20), { before: u => { u.tabs.Workflows = t.tabs.Workflows; } });
  deq(JSON.parse(again.log.claude[0].messages[0].content).saved.map(x => x.name), ['Manage project intake']);
  again.ctx.cueApprove(again.id, {}); deq(t.tabs.Workflows.rows[2].slice(1, 3), ['Manage project intake', 2]);
});

test('TC4 Teach Cue is invisible until Kiko approves: no tabs means every call is exactly as before; a mapped Zap is not used in prompts', () => {
  const t = sandbox();
  deq(t.ctx.cueTeachFor_('LED wall inquiry'), '');
  const call = JSON.parse(t.ctx.cueGpt_({ step: 'x', system: 'You test.', user: 'hello', schema: {}, name: 'x' }).req.payload);
  deq(call.instructions, 'You test.');
  t.tabs.Workflows = sheetMock(); t.tabs.Workflows.appendRow(['Saved', 'Name', 'Version', 'Target', 'Status', 'Trigger', 'Steps', 'Flags', 'AI calls', 'Zap build steps', 'Steps JSON', 'Request']);
  t.tabs.Workflows.appendRow(['', 'RFQ chasers', 1, 'Zapier', 'Approved', 'Every weekday', '1. Read email (Code): x', '', 0, '', '[]', 'cue-1', false]);
  t.ctx.cueTeachReset_(); deq(t.ctx.cueTeachFor_('RFQ chasers every weekday'), '');
  t.ctx.cueWorkflowTab_(); deq(t.tabs.Workflows.rows[0][12], 'Use in prompts', 'an old Workflows tab gets the new header');
});

test('SAME1 live 16:45Z: "new project intake" for a project Canvas already has asks Same project? before phase 1, never an error', () => {
  const rd = JSON.parse(JSON.stringify(READ)); rd.client.company = 'AMI Group'; rd.event.name = 'UNILEVER YEAR END PARTY 2026'; rd.event.date = '2026-12-11';
  const t = sandbox({ phased: true, gpt: { intake: rd }, similar: [{ project_id: 'S-11267432UN', name: 'Unilever Year End Party 2026', account: 'AMI Group', date: '12/11/2026', status: 'For Admin Completion', why: 'same client within 7 days, similar name' }] });
  const up = t.ctx.cueUpload({ name: 'image.png', type: 'image/png', data: PNG });
  const id = t.ctx.cueSend('new project intake', [{ id: up.id }], 'intake').request_id, v = t.ctx.cueRun(id);
  deq([v.stage, v.status], ['Same project?', 'Needs you']);
});

const DUP = { 'acme year-end party': { projects: [{ project_id: 'S-11267432UN', name: 'Acme Year-End Party', account: 'Acme Corp', date: '12/12/2026', status: 'For Admin Completion' }], total: 1 } };
const INQUIRY_APPROVAL = { inquiry: { types: ['Event'], theme: 'Garden launch', theme_owner: '', deliverables: ['Pitch Deck'] } };
test('SAME2 live 16:52Z: Canvas refusing a project it already has turns into the Same project? card in the thread, not an error', () => {
  const later = {}, t = phStart({ projectDup: 9, search: later }), chat0 = t.tabs.Chat.rows.length; Object.assign(later, DUP);   // Canvas lists it only after the check
  const v = t.ctx.cueApprove(t.id, INQUIRY_APPROVAL);
  deq([v.stage, v.status, v.dup, v.error || '', v.same.map(x => x.project_id)], ['Same project?', 'Needs you', true, '', ['S-11267432UN']]);
  assert.ok(t.tabs.Chat.rows.slice(chat0).every(x => x[3] === t.id), 'only in the thread');
  assert.ok(/Canvas already has Acme Year-End Party \(S-11267432UN/.test(JSON.stringify(t.tabs.Chat.rows)));
});
test('UNDO3 Kiko 16:53Z: Cancel intake asks Canvas to remove what the intake wrote, closes the task, and a second tap changes nothing', () => {
  const t = phStart(); t.ctx.cueApprove(t.id, INQUIRY_APPROVAL); t.ctx.cueApprove(t.id, {});
  const v = t.ctx.cueCancelIntake(t.id, '');
  deq([t.log.phRemove, v.status, v.stage, !!v.canvas.removed], [[{ request_id: t.id, project_id: 'S-99900001ZZ' }], 'Rejected', 'Cancelled', true]);
  assert.ok(/Removed S-99900001ZZ from Canvas: the project, 2 requirement lines, 1 contact and its folders/.test(JSON.stringify(t.tabs.Chat.rows)));
  t.ctx.cueCancelIntake(t.id, ''); deq(t.log.phRemove.length, 1);
  const u = phStart(); u.ctx.cueReject(u.id); assert.throws(() => u.ctx.cueCancelIntake(u.id, ''), /Nothing from this intake is in Canvas/);
  const w = phStart({ removeUnknown: true }); w.ctx.cueApprove(w.id, INQUIRY_APPROVAL);
  const x = w.ctx.cueCancelIntake(w.id, ''); deq([x.status, /until its next update/.test(x.error)], ['Needs you', true]);
});
test('UNDO4 Same project? after a refusal: "Remove it, add this one" removes that project, then shows phase 1 again for one approval', () => {
  const later = {}, t = phStart({ projectDup: 1, search: later }); Object.assign(later, DUP); t.ctx.cueApprove(t.id, INQUIRY_APPROVAL);
  assert.throws(() => t.ctx.cueCancelIntake(t.id, 'S-1'), /not one of the choices/);
  const v = t.ctx.cueCancelIntake(t.id, 'S-11267432UN');
  deq([t.log.phRemove, v.stage, v.ph.phase, t.log.phProject.length], [[{ project_id: 'S-11267432UN' }], 'Project details', 1, 1]);
  const w = t.ctx.cueApprove(t.id, INQUIRY_APPROVAL); deq([w.ph.phase, w.canvas.project_id], [2, 'S-99900001ZZ']);
});

test('SAME3 live 17:03Z: an exact name and date match in Canvas asks Same project? before phase 1, even when the similar list is empty', () => {
  const t = phStart({ search: DUP });
  deq([t.v.stage, t.v.status, t.v.dup, (t.log.phProject || []).length], ['Same project?', 'Needs you', true, 0]);
});
test('ASK1 live 17:03Z: a question in an intake thread is answered, not used as a re-read note', () => {
  const t = phStart(), n = t.log.gpt ? t.log.gpt.length : 0;
  assert.strictEqual(t.ctx.cuePhReply_(t.id, 'shouldnt it ask me if they were the same?', []), null);
  assert.strictEqual(t.ctx.cuePhReply_(t.id, 'why is it slow', []), null);
  assert.ok(t.ctx.cuePhReply_(t.id, 'the venue is SMX Aura', []).in_place);
});
