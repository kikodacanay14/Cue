// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: intake.

test('C1 bridge requests are signed like every other bridge caller and use only Cue\'s four actions', () => {
  const t = startToCard();
  deq(t.log.bridge.map(b => b.action), ['find_similar_projects', 'intake_evidence']);
  t.log.bridge.forEach(b => { assert.ok(/^[A-Za-z0-9:_-]{8,120}$/.test(b.command_id)); assert.strictEqual(b.task_id, t.id); assert.ok(b.ts > 0); });
});
test('C2 full run: 4 AI calls (GPT read, Claude cost + GPT research in parallel, GPT RFQs), card waiting for Kiko', () => {
  const t = startToCard();
  assert.strictEqual(t.v.status, 'Needs you'); assert.strictEqual(t.v.metrics.ai_calls, 4);
  assert.strictEqual(t.log.gpt.length, 3); assert.strictEqual(t.log.claude.length, 1);
  deq(t.log.batches.map(b => b.slice().sort()), [['api.openai.com'], ['script.google.com', 'script.google.com'], ['api.anthropic.com', 'api.openai.com'], ['api.openai.com']]);
  assert.ok(t.log.gpt[1].tools && t.log.gpt[1].tools[0].type === 'web_search', 'research uses web search');
  assert.ok(!t.log.gpt[0].tools && !t.log.gpt[2].tools, 'read and RFQ calls do not search the web');
  const rs = JSON.parse(t.log.gpt[1].input);
  deq(rs.price_needed.map(x => x.key), ['R3'], 'only the line with no BSE price, quote or stock is researched');
  deq(rs.known_suppliers, ['Sonic Pro']);
});
test('C3 Canvas rules applied before Kiko sees it: cited quotes, BSE price from the list, research labelled', () => {
  const p = startToCard().v.proposal, [r1, r2, r3] = p.lines;
  deq(r1.sources, ['E1']); assert.strictEqual(r1.cost_basis, 'past quotes'); assert.strictEqual(r1.unit_cost, 48000);
  assert.strictEqual(r2.unit_price, 25000); assert.strictEqual(r2.price_basis, 'BSE package'); assert.strictEqual(r2.cost_basis, 'none', 'unasked research is ignored');
  assert.strictEqual(r3.price_source, ''); assert.ok(r3.flags.some(f => /not shown/.test(f)));
  assert.strictEqual(r3.cost_basis, 'market research'); assert.strictEqual(r3.unit_cost, 150000);
  deq(r3.sources, ['https://drones.example/ph-prices']); assert.ok(r3.flags.indexOf('Research, not history: confirm with an RFQ') >= 0);
  deq(p.totals, { known_cost: 198000, known_price: 25000, optional_cost: 0, optional_price: 0, optional: 0, lines_with_bse_price: 1, lines_without_price: 2,
    lines_without_cost: 1, outsourced: 3, in_house: 0 });
});
test('C4 suppliers: Claude picks only from the Supplier DB; research adds new, unaccredited ones; no guessed emails', () => {
  const p = startToCard().v.proposal;
  deq(p.lines[0].suppliers.map(s => s.name), ['Sonic Pro']);
  deq(p.lines[2].suppliers.map(s => [s.name, s.new, s.email]), [['SkyLights PH', true, 'hello@skylights.example'], ['Guess Co', true, '']]);
  assert.ok(p.lines[1].flags.some(f => /No supplier/.test(f)));
});
test('C5 GPT drafts one RFQ per supplier from Claude\'s names plus research\'s; strangers dropped; subject cannot inject headers', () => {
  const t = startToCard(), p = t.v.proposal, ask = JSON.parse(t.log.gpt[2].input);
  deq(ask.suppliers.map(s => [s.supplier, s.keys.join(','), s.new]), [['Sonic Pro', 'R1', false], ['SkyLights PH', 'R3', true], ['Guess Co', 'R3', true]]);
  assert.ok(!/Acme/.test(t.log.gpt[2].input), 'the client name is not given to the RFQ writer');
  deq(p.rfqs.map(q => q.suppliers[0].name), ['Sonic Pro', 'SkyLights PH', 'Guess Co']);
  assert.ok(!/[\r\n]/.test(p.rfqs[1].subject));
});
test('C6 no gaps and enough suppliers: research is skipped, 3 AI calls', () => {
  const ev = JSON.parse(JSON.stringify(EVIDENCE)), sup = ['A', 'B', 'C', 'D', 'E'].map(n => ({ name: 'Sup ' + n, email: '', accredited: true, preferred: false }));
  ev.R1.suppliers = sup; ev.R2.suppliers = sup; ev.R3 = JSON.parse(JSON.stringify(ev.R1));
  const t = startToCard({ evidence: ev, cost: Object.assign({}, COST, { lines: COST.lines.map(l => Object.assign({}, l, { suppliers: ['Sup A'] })) }) });
  assert.strictEqual(t.v.metrics.ai_calls, 3); assert.strictEqual(t.log.gpt.length, 2);
});
test('C7 metric: calls and seconds recorded; a run over 3 minutes is flagged', () => {
  const fast = startToCard();
  assert.ok(fast.v.metrics.seconds_total > 0 && fast.v.metrics.seconds_total <= 180); assert.strictEqual(fast.v.metrics.flag, '');
  const row = fast.tabs.Requests.rows.find(r => r[0] === fast.id); assert.strictEqual(row[5], 4); assert.strictEqual(row[7], fast.v.metrics.seconds_total);
  const slow = startToCard({ batchStep: 70000 });
  assert.ok(/Over budget: .*s/.test(slow.v.metrics.flag), slow.v.metrics.flag);
  assert.strictEqual(slow.tabs['AI Runs'].rows.length - 1, 4);
});
test('C8 never info@ (Kiko 07:45Z): an old CUE_DRAFTS_IN=canvas setting is ignored; RFQs are drafted in Kiko\'s Gmail', () => {
  const t = startToCard({ props: { CUE_DRAFTS_IN: 'canvas' } }), v = t.ctx.cueApprove(t.id, {});
  assert.strictEqual(v.status, 'Done'); assert.strictEqual(t.log.gmail.length, 3); assert.ok(!t.log.bridge.some(b => b.action === 'make_rfq_drafts'));
  assert.ok(!v.drafts.some(d => d.mailbox));
});
test('C8b default (Kiko 03:25Z): one draft per supplier in Kiko\'s Gmail, To blank without an email, no header injection', () => {
  const t = startToCard(), v = t.ctx.cueApprove(t.id, {});
  assert.strictEqual(v.status, 'Done'); assert.strictEqual(t.log.gmail.length, 3); assert.ok(!t.log.bridge.some(b => b.action === 'make_rfq_drafts'));
  assert.ok(/^To: sales@sonicpro\.example\r\n/.test(t.log.gmail[0])); assert.ok(!/^To:/.test(t.log.gmail[2]), 'no email on file: To left blank');
  assert.ok(/Subject: =\?UTF-8\?B\?/.test(t.log.gmail[1]) && !/Bcc/i.test(t.log.gmail[1].split('\r\n\r\n')[0]));
});
test('C9 edit first: Kiko\'s cost becomes "set by Kiko", removed line and skipped RFQ never reach Canvas', () => {
  const t = startToCard();
  const v = t.ctx.cueApprove(t.id, { event: { venue: 'SMX Aura Hall 2' }, lines: { R1: { unit_cost: 45000 }, R2: { remove: true } }, skip_rfqs: [2] });
  const sp = t.log.submitted;
  assert.strictEqual(v.status, 'Done'); deq(sp.lines.map(l => l.key), ['R1', 'R3']);
  assert.strictEqual(sp.lines[0].cost_basis, 'set by Kiko'); deq(sp.lines[0].sources, []);
  assert.strictEqual(sp.event.venue, 'SMX Aura Hall 2'); assert.strictEqual(sp.rfqs.length, 2);
  assert.throws(() => { const u = startToCard(); u.ctx.cueApprove(u.id, { event: { date: '12/12/2026' } }); }, /2026-11-13/);
});
test('C10 Canvas changes a number on re-check: nothing written, card returns with Canvas\'s numbers', () => {
  const t = startToCard({ canvasCost: 1 }), v = t.ctx.cueApprove(t.id, {});
  assert.strictEqual(v.status, 'Needs you'); assert.ok(!t.log.bridge.some(b => b.action === 'apply_intake'));
  assert.ok(v.notes.some(n => /nothing was written/.test(n)));
});
test('C11 apply fails: stops "Failed", never retried by the trigger; "Check Canvas and finish" calls apply only', () => {
  const t = startToCard({ applyFails: true }), v = t.ctx.cueApprove(t.id, {});
  assert.strictEqual(v.status, 'Failed'); assert.ok(/trying again never writes twice/.test(v.error));
  const own = () => t.log.bridge.filter(b => b.action !== 'mail_waiting' && b.action !== 'crm_log' && b.action !== 'rfp_outbox');   // the hourly email log (CL1) and the RFP outbox (RS1) read on their own
  const before = own().length; t.ctx.cueResume(); assert.strictEqual(own().length, before);
  t.ctx.cueApprove(t.id, {}); deq(own().slice(before).map(b => b.action), ['apply_intake']);
});
test('C12 reject: nothing goes to Canvas', () => {
  const t = startToCard(), v = t.ctx.cueReject(t.id, 'Duplicate');
  assert.strictEqual(t.ctx.cueReject(t.id, 'tapped twice').status, 'Rejected', 'a second Reject is a silent no-op');
  assert.strictEqual(t.tabs.Chat.rows.filter(r => /^Rejected\. Nothing was written/.test(r[2])).length, 1, 'no second chat line');
  assert.strictEqual(v.status, 'Rejected'); assert.strictEqual(t.log.bridge.length, 2);
});
test('C13 only the owner can use Cue', () => {
  const t = sandbox({ viewer: 'someone@example.com' });
  assert.throws(() => t.ctx.cueSend(INQ), /private/); assert.throws(() => t.ctx.cueState(), /private/);
});
test('C14 GPT read fails: Failed before Canvas; Try again resumes and counts the extra call', () => {
  let n = 0; const t = sandbox({ fail: { intake: () => (n++ === 0 ? resp(400, { error: { message: 'bad request' } }) : gptOk(READ)) } });
  const id = t.ctx.cueSend(INQ, [], 'intake').request_id, v = t.ctx.cueRun(id);
  assert.strictEqual(v.status, 'Failed'); assert.strictEqual(t.log.bridge.length, 0); assert.ok(/GPT \(read\): HTTP 400/.test(v.error));
  const w = t.ctx.cueRetry(id); assert.strictEqual(w.status, 'Needs you'); assert.strictEqual(w.metrics.ai_calls, 5);
});
test('C15 research fails: the CE still comes back, gaps stay unknown, and Kiko is told', () => {
  const t = startToCard({ fail: { research: () => resp(500, {}) } });
  assert.strictEqual(t.v.status, 'Needs you'); assert.strictEqual(t.v.proposal.lines[2].cost_basis, 'none');
  assert.ok(t.v.notes.some(n => /Web research did not come back/.test(n))); assert.strictEqual(t.v.metrics.ai_calls, 5, 'one retry of the 500 is counted');
});
test('C16 a Gmail draft that fails is retried alone, never doubled', () => {
  const t = startToCard({ gmailFail: true }), v = t.ctx.cueApprove(t.id, {});
  assert.strictEqual(v.status, 'Done, drafts incomplete');
  const w = t.ctx.cueDrafts(t.id); assert.strictEqual(w.status, 'Done'); assert.strictEqual(t.log.gmail.length, 4);
  deq(w.drafts.map(d => !!d.id), [true, true, true]);
});
test('C17 an inquiry with no requirements stops with a clear message', () => {
  const t = startToCard({ read: Object.assign({}, READ, { requirements: [] }) });
  assert.strictEqual(t.v.status, 'Failed'); assert.ok(/no requirements/.test(t.v.error));
});
test('C18 page state hides keys and raw evidence', () => {
  const t = startToCard(), s = JSON.stringify(t.ctx.cueState());
  ['sk-test', 'sk-ant-test', SECRET, 'past_quotes'].forEach(x => assert.ok(s.indexOf(x) < 0, x));
});

const SENT = [
  { id: 'm1', thread: 'th1', ms: 1760000000000, to: 'Mats Co <sales@matsco.example>', subject: 'RFQ: JBL launch floor mats', snippet: 'Please quote 40 mats' },
  { id: 'm2', thread: 'th1', ms: 1760100000000, to: 'sales@matsco.example', subject: 'Re: RFQ: JBL launch floor mats', snippet: 'Following up' },
  { id: 'm3', thread: 'th2', ms: 1760050000000, to: 'Print Hub <hello@printhub.example>, kiko@example.com', subject: 'RFQ - JBL mats printing', snippet: 'Quote for printing' },
  { id: 'm4', thread: 'th3', ms: 1760060000000, to: 'kiko@example.com', subject: 'RFQ internal JBL', snippet: 'internal only' },
  { id: 'm5', thread: 'th4', ms: 1760070000000, to: 'tents@tentco.example', subject: 'RFQ: JBL tent', snippet: 'tent quote' }];
const REQUOTES = { requotes: [{ k: 'T1', supplier: 'Mats Co', body: 'Hi Mats Co,\nThe JBL mat designs changed; updated files attached. Please requote by Friday.\nBlank Space Events' },
  { k: 'T3', supplier: 'Print Hub', body: 'Hi Print Hub,\nUpdated JBL mat artwork attached. Please send a revised quote.\nBlank Space Events' },
  { k: 'T3', supplier: 'Print Hub again', body: 'duplicate' }, { k: 'T99', supplier: 'Made up', body: 'x' }], note: 'Skipped the tent thread.' };
const CHANGE_READ = Object.assign({}, READ, { kind: 'change_request', requirements: [],
  change: { project: 'JBL', what_changed: 'New floor mat designs (8 files).', search_terms: ['mats'], suppliers: [] } });
const PNG = Buffer.from('89504e470d0a1a0a-fake-floor-plan').toString('base64'), PDF = Buffer.from('%PDF-1.7 fake brief').toString('base64');
const TXT = Buffer.from('Need 2 LED walls and a stage, 8x4m.').toString('base64');
test('C19 attachments: saved in Cue uploads, sent to GPT in the read call only, still 4 AI calls, no file data in page state', () => {
  const t = sandbox(), files = [{ name: 'floor plan.png', type: 'image/png', data: PNG }, { name: 'brief.pdf', type: 'application/pdf', data: PDF },
    { name: 'notes.txt', type: 'text/plain', data: TXT }];
  const id = t.ctx.cueSend('', files).request_id, v = t.ctx.cueRun(id);
  assert.strictEqual(v.status, 'Needs you'); assert.strictEqual(v.metrics.ai_calls, 4);
  deq(v.files.map(f => f.name), ['floor plan.png', 'brief.pdf', 'notes.txt']);
  assert.strictEqual(t.props.CUE_UPLOADS_FOLDER, 'folder-1');
  deq(Object.values(t.drive.parent), ['folder-1', 'folder-1', 'folder-1']);
  assert.strictEqual(t.drive.files.f2.toString(), '%PDF-1.7 fake brief', 'bytes round-trip');
  const c = t.log.gpt[0].input[0].content;
  deq(c.map(p => p.type), ['input_text', 'input_image', 'input_file', 'input_text']);
  assert.ok(/attached files/.test(c[0].text) && /Attached: floor plan\.png, brief\.pdf, notes\.txt/.test(c[0].text));
  assert.strictEqual(c[1].image_url, 'data:image/png;base64,' + PNG);
  assert.strictEqual(c[2].file_data, 'data:application/pdf;base64,' + PDF); assert.strictEqual(c[2].filename, 'brief.pdf');
  assert.ok(c[3].text.indexOf('<attachment name="notes.txt">\nNeed 2 LED walls') === 0);
  assert.ok(typeof t.log.gpt[1].input === 'string' && typeof t.log.gpt[2].input === 'string', 'research and RFQ calls get no files');
  assert.ok(/attached/i.test(t.log.gpt[0].instructions));
  const st = JSON.stringify(t.ctx.cueState()); [PNG, PDF, TXT].forEach(x => assert.ok(st.indexOf(x) < 0, 'no file data in state'));
  assert.ok(/📎 floor plan\.png, brief\.pdf, notes\.txt/.test(st), 'chat line names the files');
});
test('C20 attachment limits: type, size, count, empty; a short message with no file is still refused; a trashed folder is remade', () => {
  const t = sandbox(), send = (txt, f) => () => t.ctx.cueSend(txt, f, 'intake');
  assert.throws(send(INQ, [{ name: 'x.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', data: PDF }]), /Save it as a PDF/);
  assert.throws(send(INQ, [{ name: 'big.pdf', type: 'application/pdf', data: Buffer.alloc(10 * 1024 * 1024 + 1).toString('base64') }]), /over 10 MB/);
  assert.throws(send(INQ, Array(31).fill({ name: 'a.txt', type: 'text/plain', data: TXT })), /30 files at most/);   // 1.27.5: was 10
  assert.throws(send(INQ, [{ name: 'e.txt', type: 'text/plain', data: '' }]), /empty/);
  assert.throws(send('hi', []), /at least a sentence/);
  assert.strictEqual(t.tabs.Requests.rows.length, 1, 'nothing saved for refused sends');
  const u = sandbox({ props: { CUE_UPLOADS_FOLDER: 'old' }, folderTrashed: true }); u.ctx.cueSend('', [{ name: 'a.txt', type: 'text/plain', data: TXT }]);
  assert.strictEqual(u.props.CUE_UPLOADS_FOLDER, 'folder-1');
  const w = sandbox({ props: { CUE_UPLOADS_FOLDER: 'kept' } }); w.ctx.cueSend('', [{ name: 'a.txt', type: 'text/plain', data: TXT }]);
  assert.strictEqual(w.drive.parent.f1, 'kept');
});

test('C20b image batches: "more coming" holds files across messages, Done sends one task with all of them, no AI call until then', () => {
  const t = sandbox(), up = n => ({ id: t.ctx.cueUpload({ name: n, type: 'image/png', data: PNG }).id });
  const ids1 = Array.from({ length: 10 }, (_, i) => up('p' + i + '.png')), ids2 = Array.from({ length: 10 }, (_, i) => up('q' + i + '.png'));
  let v = t.ctx.cueBatchAdd('', 'New project intake for the Acme launch', ids1);
  deq([v.main.count, v.main.msgs, v.main.asked], [10, 1, false]);
  v = t.ctx.cueBatchAdd('', '', ids2.concat(ids1.slice(0, 2)));   // a file sent twice counts once
  deq([v.main.count, v.main.msgs], [20, 2]);
  assert.strictEqual(t.ctx.cueState().batches.main.count, 20, 'the page sees it after a reload');
  assert.strictEqual(t.log.gpt.length + t.log.claude.length, 0, 'no AI call while holding');
  assert.strictEqual(t.tabs.Requests.rows.length, 1, 'no task yet');
  const r = t.ctx.cueBatchTake('', 'this is the stage');
  assert.strictEqual(r.text, 'New project intake for the Acme launch\n\nthis is the stage'); assert.strictEqual(r.files.length, 20); deq(r.batches, {});
  const id = t.ctx.cueSend(r.text, r.files.map(f => ({ id: f.id }))).request_id, s = t.ctx.cueRun(id);
  assert.strictEqual(s.files.length, 20); assert.strictEqual(t.log.gpt[0].input[0].content.filter(c => c.type === 'input_image').length, 20, 'one read call gets all 20');
  // The cap: 30 files for one task.
  const u = sandbox(), uu = n => ({ id: u.ctx.cueUpload({ name: n, type: 'image/png', data: PNG }).id });
  u.ctx.cueBatchAdd('', 'x', Array.from({ length: 25 }, (_, i) => uu('a' + i + '.png')));
  assert.throws(() => u.ctx.cueBatchAdd('', '', Array.from({ length: 6 }, (_, i) => uu('b' + i + '.png'))), /most for one task \(30 files\)\. I am holding 25/);
  assert.strictEqual(u.ctx.cueState().batches.main.count, 25, 'a refused message adds nothing');
  // A file Cue did not upload is refused.
  assert.throws(() => u.ctx.cueBatchAdd('', '', [{ id: 'someone-elses' }]), /did not finish uploading|not one Cue uploaded/);
});
test('C20c image batches: Done with no instruction asks once; threads keep their own batch; Cancel and the 2-hour drop say nothing was sent', () => {
  const t = sandbox(), up = n => ({ id: t.ctx.cueUpload({ name: n, type: 'image/png', data: PNG }).id });
  t.ctx.cueBatchStart(''); deq(t.ctx.cueState().batches.main, { count: 0, msgs: 0, mb: 0, texts: 0, asked: false });
  t.ctx.cueBatchAdd('', '', [up('a.png'), up('b.png')]);
  const a = t.ctx.cueBatchTake('', ''); deq([a.ask, a.count, a.batches.main.asked], [true, 2, true]);
  const b = t.ctx.cueBatchTake('', 'record these as receipts'); assert.strictEqual(b.text, 'record these as receipts'); assert.strictEqual(b.files.length, 2);
  assert.throws(() => t.ctx.cueBatchTake('', 'x'), /No batch is open/);
  t.ctx.cueBatchAdd('cue-20261022000000-abcd', 'for this thread', [up('c.png')]); t.ctx.cueBatchAdd('', 'main one', [up('d.png')]);
  const st = t.ctx.cueState().batches; deq([st.main.count, st['cue-20261022000000-abcd'].count], [1, 1]);
  deq(t.ctx.cueBatchCancel('').dropped, 1); deq(Object.keys(t.ctx.cueState().batches), ['cue-20261022000000-abcd']);
  assert.throws(() => t.ctx.cueBatchAdd('', 'y'.repeat(5001)), /more text than a batch can hold/);
  t.ctx.__wait(2 * 3600000 + 1000); deq(t.ctx.cueState().batches, {});
  const line = t.tabs.Chat.rows.filter(r => /Dropped the batch of 1 file/.test(r[2]))[0];
  assert.ok(line && /Nothing was sent/.test(line[2]) && line[3] === 'cue-20261022000000-abcd', 'the drop is said in its thread');
  assert.strictEqual(t.log.gpt.length + t.log.claude.length, 0);
});
test('C20d page: phrases that start, finish and cancel a batch', () => {
  const html = cuePage();
  const BATCH_RE = eval(html.match(/var BATCH_RE = (\/.*\/i);/)[1]), CANCEL = eval(html.match(/var BCANCEL_RE = (\/.*\/i);/)[1]);
  const doneSaid = eval('(' + html.match(/function doneSaid\(t\) \{[\s\S]*?\n  \}/)[0] + ')');
  ['more coming', 'New intake for Unilever, more coming', "I'm sending images in batches", 'sending them in batches', 'more photos to come', 'batch mode'].forEach(x => assert.ok(BATCH_RE.test(x), x));
  ['what is coming next week?', 'send the batch report', 'more'].forEach(x => assert.ok(!BATCH_RE.test(x), x));
  deq(['done', 'Done.', "that's all", 'go', 'done, this is for the Unilever launch', 'all sent!', 'done with the photos', 'go to the venue'].map(doneSaid),
    ['', '', '', '', 'this is for the Unilever launch', '', 'with the photos', null]);
  assert.strictEqual(doneSaid('donee'), null); assert.strictEqual(doneSaid('these are done designs'), null);
  assert.ok(CANCEL.test('cancel batch') && CANCEL.test('Cancel') && !CANCEL.test('cancel the RFQ'));
});

test('C21 small talk: one GPT call, no intake, both lines in the chat; an inquiry-looking message offers the intake; the opener still starts one', () => {
  const t = sandbox(), r = t.ctx.cueSend('hey GPT / Claude, how are you');
  assert.strictEqual(r.chat, true); assert.strictEqual(r.reply, 'Doing well! Ready when you are.'); assert.strictEqual(r.suggest_intake, false);
  assert.strictEqual(t.log.gpt.length, 1); assert.strictEqual(t.log.claude.length + t.log.bridge.length, 0);
  assert.strictEqual(t.tabs.Requests.rows.length, 1, 'no request made');
  deq(t.tabs.Chat.rows.slice(1).map(x => x[1]), ['Kiko', 'Cue']);
  assert.ok(/how are you/.test(t.log.gpt[0].input) && /never pretend/.test(t.log.gpt[0].instructions));
  const AI = t.tabs['AI Runs'].rows.slice(1); deq(AI.map(x => [x[2], x[3], x[9]]), [['chat', 'Claude', 'Failed'], ['chat', 'GPT', 'OK']], 'Claude first; unreachable, the GPT form call answers');
  const u = sandbox({ talk: { reply: 'That looks like an inquiry.', looks_like_inquiry: true } });
  assert.strictEqual(u.ctx.cueSend(INQ).suggest_intake, true);
  assert.ok(u.ctx.cueSend('New project intake. ' + INQ).request_id, 'opener starts an intake');
  assert.throws(() => u.ctx.cueSend('   '), /Type a message/);
  const w = sandbox({ fail: { chat: () => resp(500, {}) } }); assert.ok(/could not answer/.test(w.ctx.cueSend('hello').reply));
});

test('C22 change request: 2 AI calls, finds the sent RFQ threads, one reply per supplier, drafts in the original threads with the files, Canvas untouched', () => {
  const t = sandbox({ read: CHANGE_READ });
  const up = t.ctx.cueUpload({ name: 'mat 1.png', type: 'image/png', data: PNG });
  const id = t.ctx.cueSend('this for JBL new mats that needs to resent to suppliers. find the emails sent before and ask for a requote', [{ id: up.id }]).request_id;
  const v = t.ctx.cueRun(id);
  assert.strictEqual(v.status, "Needs you", v.error); assert.strictEqual(v.kind, "change"); assert.strictEqual(v.metrics.ai_calls, 2);
  deq(t.log.bridge.map(b => b.action), ['find_similar_projects'], 'only the duplicate check (no requirements to look up)'); assert.strictEqual(t.log.claude.length, 0, 'no Claude');
  assert.ok(/^in:sent newer_than:1y .*"JBL" OR "mats"/.test(t.log.gmailQ), t.log.gmailQ);
  deq(v.change.drafts.map(d => [d.k, d.to]), [['T1', 'sales@matsco.example'], ['T3', 'hello@printhub.example']], 'own address dropped, dup and unknown keys dropped');
  assert.strictEqual(v.change.found, 3, 'internal-only thread dropped; th1 kept once');
  const cands = JSON.parse(t.log.gpt[1].input).candidates; assert.strictEqual(cands[0].subject, 'Re: RFQ: JBL launch floor mats', 'latest message of th1');
  assert.ok(/data/.test(t.log.gpt[1].instructions));
  const d = t.ctx.cueApprove(id, { skip: ['T3'] });
  assert.strictEqual(d.status, 'Done'); assert.strictEqual(t.log.replies.length, 1, 'only the ticked supplier');
  const pl = t.log.replies[0].payload;
  assert.ok(/^multipart\/related; boundary=/.test(t.log.replies[0].type));
  assert.ok(pl.indexOf('{"message":{"threadId":"th1"}}') > 0, 'in the original thread');
  assert.ok(/In-Reply-To: <m2@mail>/.test(pl) && /To: sales@matsco\.example/.test(pl));
  assert.ok(pl.indexOf('filename="mat 1.png"') > 0 && pl.indexOf(PNG.slice(0, 20)) > 0, 'file attached');
  assert.ok(t.tabs.Chat.rows.some(r => /Nothing was sent and nothing changed in Canvas/.test(r[2])));
  assert.throws(() => t.ctx.cueApprove(id, {}), /not waiting/);
});
test('C23 change request edge cases: nothing found, nothing matched, all unticked, a failed draft retries only the missing one, upload ids are checked', () => {
  const a = sandbox({ read: CHANGE_READ, sent: [] }), ia = a.ctx.cueSend('New project intake. JBL mats changed, requote please', [], 'intake').request_id;
  const va = a.ctx.cueRun(ia); assert.strictEqual(va.status, 'Needs you', JSON.stringify(va.error)); assert.ok(/found no RFQ emails/.test(va.change.note));
  const b = sandbox({ read: CHANGE_READ, requotes: { requotes: [], note: 'none match' } }), ib = b.ctx.cueSend('New project intake. JBL mats changed, requote please').request_id;
  assert.ok(/matched this change/.test(b.ctx.cueRun(ib).change.note));
  const c = sandbox({ read: CHANGE_READ, replyFail: true }), ic = c.ctx.cueSend('New project intake. JBL mats changed, requote please').request_id; c.ctx.cueRun(ic);
  assert.throws(() => c.ctx.cueApprove(ic, { skip: ['T1', 'T3'] }), /Tick at least one/);
  const v1 = c.ctx.cueApprove(ic, {}); assert.strictEqual(v1.status, 'Done, drafts incomplete'); assert.strictEqual(c.log.replies.length, 2);
  const v2 = c.ctx.cueApprove(ic, {}); assert.strictEqual(v2.status, 'Done'); assert.strictEqual(c.log.replies.length, 3, 'only the failed one again');
  assert.throws(() => c.ctx.cueSend('x', [{ id: 'not-ours' }]), /did not finish uploading|not one Cue uploaded/);
});

const JBL = [{ project_id: 'S-31628060SP', name: 'JBL Launch', account: 'JBL', date: '2026-11-05', status: 'For Client Awarding', why: 'similar name' },
  { project_id: 'S-31628061SP', name: 'JBL Roadshow', account: 'JBL', date: '2026-11-20', status: 'Lead', why: 'similar name' }];
const JBL_READ = Object.assign({}, READ, { client: Object.assign({}, READ.client, { company: 'JBL' }), event: Object.assign({}, READ.event, { name: 'JBL Launch', date: '2026-11-05' }) });
test('C24 intake steps first: a Canvas duplicate switches a "new project" read to the change function, with the project folder files', () => {
  const t = sandbox({ similar: JBL, read: JBL_READ });   // GPT read it as new_project; Canvas says it already exists, and the names really match
  const id = t.ctx.cueSend('New project intake. JBL wants new mats, 3m x 2m, please get quotes').request_id;
  const q = t.ctx.cueRun(id);   // Kiko 14:26Z: Cue asks first
  assert.strictEqual(q.status, 'Needs you', q.error); assert.strictEqual(q.stage, 'Same project?'); assert.strictEqual(q.kind, 'intake');
  deq(q.same.map(p => p.project_id), ['S-31628060SP'], 'only the one with the same name, account and close date');
  assert.ok(!t.log.bridge.some(b => b.action === 'list_project_files'), 'nothing done before Kiko answers');
  assert.ok(t.tabs.Chat.rows.some(r => /looks the same: JBL Launch \(JBL, 2026-11-05\)\. Is this the same project\?/.test(r[2])));
  assert.throws(() => t.ctx.cueSameAnswer(id, 'S-99'), /not one of the choices/);
  const v = t.ctx.cueSameAnswer(id, 'S-31628060SP');
  assert.strictEqual(v.status, 'Needs you', v.error); assert.strictEqual(v.kind, 'change'); assert.strictEqual(v.metrics.ai_calls, 2, 'read + requotes, no costing');
  assert.throws(() => t.ctx.cueSameAnswer(id, 'new'), /not waiting/);
  deq(t.log.bridge.map(b => b.action), ['find_similar_projects', 'intake_evidence', 'find_similar_projects', 'intake_evidence', 'list_project_files']);
  assert.strictEqual(t.log.filesFor, 'S-31628060SP'); assert.strictEqual(t.log.claude.length, 0, 'no Claude costing');
  assert.strictEqual(v.change.project, 'JBL Launch'); assert.strictEqual(v.change.match.why, 'similar name'); deq(v.change.others, [], 'JBL Roadshow is another event, not a possible match');
  assert.strictEqual(v.change.project_files.length, 2); assert.strictEqual(v.change.project_files[1].url, '', 'non-Drive link dropped');
  assert.strictEqual(v.change.folder_url, 'https://drive.google.com/drive/folders/PF1');
  assert.ok(/"JBL Launch"/.test(t.log.gmailQ), t.log.gmailQ);
  assert.ok(JSON.parse(t.log.gpt[1].input).project_folder_files[0].indexOf('JBL mats v2.pdf') > 0, 'GPT sees the folder file names');
  assert.ok(t.tabs.Chat.rows.some(r => /Canvas already has this project: JBL Launch/.test(r[2])));
  assert.strictEqual(v.change.can_run_new, true);
  // Kiko: not this project. It runs as a new intake: costing, RFQs, no second duplicate switch.
  const n = t.ctx.cueAsNew(id);
  assert.strictEqual(n.kind, 'intake'); assert.strictEqual(n.status, 'Needs you', n.error); assert.ok(n.proposal, 'costed proposal'); assert.strictEqual(n.change, null);
  assert.strictEqual(t.log.claude.length, 1); assert.throws(() => t.ctx.cueAsNew(id), /Only a change request/);
});
test('C25 change without a Canvas match or past emails still shows a card; a folder error is a note', () => {
  const a = sandbox({ read: CHANGE_READ, sent: [] }), ia = a.ctx.cueSend('JBL mats changed, requote please', [], 'intake').request_id;
  const va = a.ctx.cueRun(ia);
  assert.strictEqual(va.status, 'Needs you', va.error); assert.strictEqual(va.metrics.ai_calls, 1, 'no requote call when nothing was found');
  assert.strictEqual(va.change.match, null); assert.ok(/found no RFQ emails/.test(va.change.note)); deq(va.change.drafts, []);
  assert.strictEqual(va.change.can_run_new, false, 'nothing to cost');
  assert.throws(() => a.ctx.cueAsNew(ia), /no requirements/);
  assert.strictEqual(a.ctx.cueReject(ia, '').status, 'Rejected');
  const b = sandbox({ similar: JBL, read: JBL_READ, filesFail: true }), ib = b.ctx.cueSend('New project intake. JBL wants new mats').request_id;
  b.ctx.cueRun(ib); const vb = b.ctx.cueSameAnswer(ib, 'S-31628060SP');
  assert.strictEqual(vb.status, 'Needs you', vb.error); deq(vb.change.project_files, []); assert.ok(vb.notes.some(x => /could not list the project folder/.test(x)));
});

test('C26 missing Gmail access: a plain message, and Fix Google access resets only when Google says a scope is missing', () => {
  const t = sandbox({ read: CHANGE_READ, gmailScope: true, scopes: ['spreadsheets', 'gmail.compose', 'drive.file'] });
  const v = t.ctx.cueRun(t.ctx.cueSend('JBL mats changed, requote please', [], 'intake').request_id);
  assert.strictEqual(v.status, 'Failed'); assert.ok(/does not have Gmail access yet/.test(v.error), v.error);
  const a = t.ctx.cueFixAccess(); deq(a.missing, ['gmail.readonly']); assert.strictEqual(a.reset, true); assert.strictEqual(t.log.invalidated, 1);
  assert.strictEqual(a.url, 'https://script.google.com/macros/s/CUE/exec'); assert.ok(/access_token/.test(JSON.stringify(t.log.tokeninfo)));
  const ok = sandbox({ scopes: ['spreadsheets', 'https://mail.google.com/', 'drive.file'] }).ctx.cueFixAccess();
  assert.strictEqual(ok.reset, false, 'full Gmail scope covers readonly and compose'); deq(ok.missing, []);
  assert.ok(/Google access still missing: gmail.readonly/.test(sandbox({ scopes: ['gmail.compose', 'drive.file'] }).ctx.cueSetup()));
});

test('C27 requotes carry every file Kiko sent for the project in the last day; a reply to a task can start the run from chat', () => {
  const t = sandbox({ similar: JBL, read: CHANGE_READ,
    talk: { reply: 'On it.', looks_like_inquiry: false, start_intake: 'JBL Booth Fabrication: the designs changed; requote with all the new files attached' } });
  const up = n => ({ id: t.ctx.cueUpload({ name: n, type: 'image/png', data: PNG }).id });
  const id1 = t.ctx.cueSend('JBL new mats, requote please', [up('a.png'), up('b.png')]).request_id;
  assert.strictEqual(t.ctx.cueRun(id1).status, 'Needs you'); t.ctx.cueReject(id1, 'load again with new files');
  const id2 = t.ctx.cueSend('more images for JBL', [up('b.png'), up('c.png')]).request_id;
  const v2 = t.ctx.cueRun(id2);
  deq(v2.change.attach.map(f => [f.name, f.from === 'this message', f.selected]), [['b.png', true, true], ['c.png', true, true], ['a.png', false, false]], 'newest copy of b wins; old a.png listed, not ticked');
  // Kiko replies to the JBL task in chat: "load again with new files". Cue starts the run itself, tied to that task.
  const r = t.ctx.cueSend('load again with new files', [], '', id2);
  assert.ok(r.request_id, 'started a run, no extra tap'); assert.ok(t.log.gpt.some(g => /replying about this task: change request for JBL Launch/.test(JSON.stringify(g))), 'the chat call saw the task');
  const v3 = t.ctx.cueRun(r.request_id);
  assert.strictEqual(v3.kind, 'change'); deq(v3.change.attach.map(f => f.name).sort(), ['a.png', 'b.png', 'c.png']);
  deq(v3.change.attach.filter(f => f.selected).map(f => f.name).sort(), ['b.png', 'c.png'], 'no new files: the newest batch (the task replied to) is ticked, older ones are not');
  assert.ok(t.tabs.Chat.rows.some(x => x[1] === 'Kiko' && x[3] === id2), 'Kiko\'s reply is filed under the task');
  const aId = v3.change.attach.filter(f => f.name === 'a.png')[0].id, before = (t.log.replies || []).length;
  const d = t.ctx.cueApprove(r.request_id, { files_skip: [aId] });
  assert.strictEqual(d.status, 'Done');
  const pl = t.log.replies[before].payload;
  assert.ok(pl.indexOf('filename="b.png"') > 0 && pl.indexOf('filename="c.png"') > 0 && pl.indexOf('filename="a.png"') < 0, 'unticked file left out');
});

test('C28 threads: the redo run points at its task, and a reply in a thread sees only that thread, not the main chat', () => {
  const t = sandbox({ similar: JBL, read: CHANGE_READ, talk: { reply: 'Noted.', looks_like_inquiry: false, start_intake: '' } });
test('C29 approve and send (Kiko 06:17Z): edited text goes out, only after send:true; drafts only never sends; a failed send retries alone', () => {
  const t = sandbox({ read: CHANGE_READ, sendFail: true });

test('C30 a main-chat message about an existing task: Kiko\'s line stays with a pointer, the answer goes in that task\'s thread', () => {
  const t = sandbox({ read: CHANGE_READ });

test('C31 project folder (Kiko 06:45Z): approved files go into the Canvas project folder; photos to Designs & Visuals; a failure is a note and retries once', () => {
  const t = sandbox({ similar: JBL, read: CHANGE_READ, saveFail: true });

test('C32 a task started from the main chat: Kiko\'s line and Cue\'s acknowledgement stay in the chat, pointing at the new thread', () => {
  const t = sandbox(), id = t.ctx.cueSend(INQ, [], 'intake').request_id;
  deq(t.tabs.Chat.rows.slice(-4).map(x => [x[1], x[3]]), [['Kiko', ''], ['Cue', '>' + id], ['Kiko', id], ['Cue', id]]);
  assert.ok(/started a thread/.test(t.tabs.Chat.rows.slice(-3)[0][2]));
  const r = t.ctx.cueSend('also add a photo booth', [], 'intake', id).request_id;
  assert.ok(!t.tabs.Chat.rows.some(x => x[3] === '>' + r), 'a run started inside a thread needs no pointer');
});

test('C34 task rules (Kiko 06:57Z): a new message about a task from the last 7 days reopens its thread, by name or by Canvas project', () => {
  const t = sandbox({ similar: JBL, read: CHANGE_READ });
  const id = t.ctx.cueSend('New project intake. JBL mats changed, requote please', [], 'intake').request_id; t.ctx.cueRun(id);
  t.ctx.cueApprove(id, { skip: ['T3'] });
  // By name, before any AI call: files plus "JBL" in the text join the JBL thread, and the main chat says so.
  const r = t.ctx.cueSend('add these to JBL as well and send again', [{ name: 'S9.png', type: 'image/png', data: PNG }]).request_id;
  assert.strictEqual(t.ctx.cueLoad_(r).s.ref, id);
  assert.ok(t.tabs.Chat.rows.some(x => x[3] === '>' + r && /reopened its thread/.test(x[2])), 'main chat names the reopened thread');
  // By Canvas project: no name in the text, but Canvas matches the same project, so the run moves into the thread.
  const q = t.ctx.cueSend('New project intake. the floor mats changed again, requote please', [], 'intake').request_id;
  assert.strictEqual(t.ctx.cueLoad_(q).s.ref, '');
  t.ctx.cueRun(q);
  const s = t.ctx.cueLoad_(q).s; assert.ok(s.ref === r || s.ref === id, 'joined the JBL thread: ' + s.ref);
  assert.ok(t.tabs.Chat.rows.some(x => x[3] === '>' + q && /continues in its thread/.test(x[2])));
  // Unrelated work still gets its own thread.
  const n = t.ctx.cueSend(INQ, [], 'intake').request_id;
  assert.strictEqual(t.ctx.cueLoad_(n).s.ref, '');
});

test('C35 Reopen (Kiko 07:15Z): a finished task can be reopened into Needs you, closed again, and a new run in its thread settles it', () => {
  const t = sandbox({ similar: JBL, read: CHANGE_READ });
  const id = t.ctx.cueSend('New project intake. JBL mats changed, requote please', [], 'intake').request_id; t.ctx.cueRun(id);
  t.ctx.cueApprove(id, { skip: ['T3'] });
  assert.throws(() => t.ctx.cueCloseTask('cue-made-up-0000'), /No such request/);
  let v = t.ctx.cueReopen(id); assert.strictEqual(v.status, 'Reopened');
  assert.ok(t.tabs.Chat.rows.some(x => x[3] === id && /^Reopened\./.test(x[2])));
  assert.throws(() => t.ctx.cueReopen(id), /Only a finished task/);
  v = t.ctx.cueCloseTask(id); assert.strictEqual(v.status, 'Done');
  t.ctx.cueReopen(id);
  const r = t.ctx.cueSend('also add a photo booth for JBL', [], 'intake', id).request_id;
  assert.strictEqual(t.ctx.cueLoad_(id).s.status, 'Done', 'the new run carries the work; the reopened one is settled');
  assert.strictEqual(t.ctx.cueLoad_(r).s.ref, id);
});

test('C36 budget (Kiko 07:19Z): only Cue\'s own time counts, not the time a card waits for Kiko', () => {
  const t = sandbox({ similar: JBL, read: CHANGE_READ });
  const id = t.ctx.cueSend('New project intake. JBL mats changed, requote please', [], 'intake').request_id; t.ctx.cueRun(id);
  t.ctx.__wait(600000);   // the card waits 10 minutes for Kiko
  const v = t.ctx.cueApprove(id, { skip: ['T3'] });
  assert.ok(v.metrics.seconds_total > 600, 'ready time still includes the wait: ' + v.metrics.seconds_total);
  assert.ok(v.metrics.seconds_work < 180, 'Cue worked ' + v.metrics.seconds_work + ' s');
  assert.strictEqual(v.metrics.flag, '');
});

test('C37 C1 intake (Kiko approved 07:46Z): every contact, deadline, schedule, optional and excluded lines, Date TBC, past CE prices, folders readback', () => {
  const read = JSON.parse(JSON.stringify(READ));
  read.client.contacts = [{ name: 'Ana Reyes', role: 'HR', email: 'ana@acme.example', phone: '' }, { name: 'Ben Cruz', role: 'Finance', email: 'ben@acme.example', phone: '0918' }];
  Object.assign(read.event, { date: '', deadline: '2026-10-23', schedule: { ingress: 'Dec 12 6 AM', hours: '6-11 PM', egress: 'Dec 13 1 AM' } });
  read.requirements[0].status = 'included'; read.requirements[1].status = 'optional'; read.requirements[2].status = 'included';
  read.requirements.push({ category: 'Food', description: 'Catering', quantity: 1, occurrence: 1, search_terms: 'catering', status: 'excluded' });
  const ev = JSON.parse(JSON.stringify(EVIDENCE)); ev.R1.ce_prices = [{ req_id: 'REQ-77', project: 'S-1', description: 'LED wall 4x3', unit: 65000 }];
  const cost = JSON.parse(JSON.stringify(COST));
  Object.assign(cost.lines[0], { unit_price: 65000, price_basis: 'past CE prices', price_sources: ['REQ-77'] });
  Object.assign(cost.lines[2], { unit_price: 300000, price_basis: 'past CE prices', price_sources: ['REQ-404'] });
  const t = startToCard({ read, evidence: ev, cost }), p = t.v.proposal;
  deq(p.client.contacts.map(c => c.name + '/' + c.role), ['Ana Reyes/HR', 'Ben Cruz/Finance']);
  deq([p.event.date, p.event.date_tbc, p.event.deadline, p.event.schedule.hours, p.excluded], ['', true, '2026-10-23', '6-11 PM', ['Catering']]);
  deq(p.lines.map(l => [l.key, l.status, l.price_basis, l.unit_price]), [['R1', 'included', 'past CE prices', 65000], ['R2', 'optional', 'BSE package', 25000], ['R3', 'included', 'none', 0]]);
  assert.ok(p.lines[2].flags.indexOf('No selling price: set it') >= 0 && p.lines[2].flags.some(f => /no CE price it was shown/.test(f)));
  deq([p.totals.known_price, p.totals.optional, p.totals.optional_price], [65000, 1, 25000]);
  assert.ok(t.v.notes.some(n => /Date TBC/.test(n))); assert.ok(!(p.questions || []).some(q => /event date/i.test(q)), 'no date question any more');
  assert.ok(/proposal due 2026-10-23/.test(JSON.stringify(t.tabs.Chat.rows)));
  const rq = t.log.gpt.find(b => b.text.format.name === 'rfqs'); assert.ok(/2026-10-22/.test(JSON.stringify(rq)), 'quotes asked back before the proposal deadline');
  const v = t.ctx.cueApprove(t.id, { lines: { R3: { unit_price: 280000 }, R1: { status: 'optional' } } });
  const sub = t.log.submitted;
  deq([sub.client.contacts.length, sub.event.deadline, sub.event.date, sub.lines.map(l => l.status + ':' + l.price_basis)], [2, '2026-10-23', '', ['optional:past CE prices', 'optional:BSE package', 'included:set by Kiko']]);
  deq([v.canvas.date_tbc, v.canvas.contacts_added, v.canvas.folders_missing], [true, 2, []]);
  assert.ok(/Date TBC/.test(JSON.stringify(t.tabs.Chat.rows)) && /All project folders are there/.test(JSON.stringify(t.tabs.Chat.rows)));
});
test('C38 missing folders after the write are flagged, and "Make folders again" asks Canvas for that project only', () => {
  const t = startToCard({ missingFolders: ['Admin Folder', 'Visual Materials'] }); const v = t.ctx.cueApprove(t.id, {});
  deq(v.canvas.folders_missing, ['Admin Folder', 'Visual Materials']); assert.ok(/Missing folders: Admin Folder, Visual Materials/.test(JSON.stringify(t.tabs.Chat.rows)));
  const w = t.ctx.cueFolders(t.id); deq([t.log.madeFolders, w.canvas.folders_missing], ['S-99900001ZZ', []]);
});
test('C33 summary (Kiko 06:55Z): a finished task posts one line in the main chat and its thread, from what happened', () => {
  const t = sandbox({ similar: JBL, read: CHANGE_READ });
  const id = t.ctx.cueSend('New project intake. JBL mats changed, requote please', [], 'intake').request_id; t.ctx.cueRun(id);
  t.ctx.cueApprove(id, { skip: ['T3'], send: true });
  const main = t.tabs.Chat.rows.filter(x => x[3] === '>' + id && /^Summary for/.test(x[2]));
  assert.strictEqual(main.length, 1); assert.ok(/sent 1 requote \(/.test(main[0][2]), main[0][2]);
  assert.ok(t.tabs.Chat.rows.some(x => x[3] === id && /^Summary for/.test(x[2])), 'also in the thread');
  const w = startToCard(); w.ctx.cueReject(w.id, 'client cancelled');
  assert.ok(w.tabs.Chat.rows.some(x => x[3] === '>' + w.id && /rejected; nothing was written or sent/.test(x[2])));
});
  const up = n => ({ id: t.ctx.cueUpload({ name: n, type: n.endsWith('.pdf') ? 'application/pdf' : 'image/png', data: n.endsWith('.pdf') ? PDF : PNG }).id });
  const id = t.ctx.cueSend('JBL new mats, requote please', [up('S1.png'), up('brief.pdf')]).request_id; t.ctx.cueRun(id);
  assert.ok(!t.log.saved, 'nothing saved before Kiko approves');
  const d = t.ctx.cueApprove(id, {});
  deq(t.log.saved.map(x => [x.pid, x.name, x.type]), [['S-31628060SP', 'S1.png', 'Designs & Visuals'], ['S-31628060SP', 'brief.pdf', 'Client Documents']]);
  assert.ok(t.log.saved[1].bytes > 0);
  deq(d.project_saved.map(x => [x.name, !!x.url]), [['S1.png', false], ['brief.pdf', true]]);
  assert.ok(d.notes.some(n => /Not saved to the project folder yet: S1\.png/.test(n)));
  // An intake: after Canvas makes the project, the brief goes to Brief & Planning.
  const w = sandbox(), iw = w.ctx.cueSend('', [{ name: 'brief.pdf', type: 'application/pdf', data: PDF }]).request_id; w.ctx.cueRun(iw);
  const v = w.ctx.cueApprove(iw, {});
  deq(w.log.saved.map(x => [x.pid, x.name, x.type]), [['S-99900001ZZ', 'brief.pdf', 'Brief & Planning']]);
  assert.ok(w.tabs.Chat.rows.some(x => /Saved 1 file to the Canvas project folder: brief\.pdf/.test(x[2])));
  assert.strictEqual(v.status, 'Done');
  // A new project with no Drive folder yet (no event date): Cue says the files are in Canvas Files, not the project folder.
  const n = sandbox({ noFolder: true }), inn = n.ctx.cueSend('', [{ name: 'brief.pdf', type: 'application/pdf', data: PDF }]).request_id; n.ctx.cueRun(inn);
  n.ctx.cueApprove(inn, {});
  assert.ok(n.tabs.Chat.rows.some(x => /Saved 1 file to Canvas Files for this project \(it has no Drive project folder yet/.test(x[2])));
  assert.ok(!n.tabs.Chat.rows.some(x => /to the Canvas project folder/.test(x[2])));
});
  const id = t.ctx.cueSend('New project intake. JBL mats changed, requote please', [], 'intake').request_id; t.ctx.cueRun(id);
  t.opts.talk = { reply: 'The JBL requotes are waiting for you.', looks_like_inquiry: false, start_intake: '', task: id };
  const r = t.ctx.cueSend('whats happening with jbl?');
  assert.strictEqual(r.task, id);
  deq(t.tabs.Chat.rows.slice(-4).map(x => [x[1], x[3]]), [['Kiko', ''], ['Cue', '>' + id], ['Kiko', id], ['Cue', id]]);
  assert.ok(t.tabs.Chat.rows.some(x => x[1] === 'Cue' && x[3] === '>' + id && /Answered in the (?!that task).+ thread/.test(x[2])), 'pointer in the main chat');
  assert.ok(t.tabs.Chat.rows.some(x => x[1] === 'Cue' && x[3] === id && /requotes are waiting/.test(x[2])), 'answer in the thread');
  assert.ok(JSON.stringify(t.log.gpt[t.log.gpt.length - 1]).indexOf(id + ': change request for') >= 0, 'GPT saw the task list');
  t.opts.talk = { reply: 'Hi!', looks_like_inquiry: false, start_intake: '', task: 'cue-made-up-0000' };
  assert.strictEqual(t.ctx.cueSend('hello').task, '', 'an unknown task id is ignored');
});
  const id = t.ctx.cueSend('New project intake. JBL mats changed, requote please', [], 'intake').request_id; t.ctx.cueRun(id);
  assert.throws(() => t.ctx.cueApprove(id, { bodies: { T1: '   ' }, send: true }), /is empty/);
  const v = t.ctx.cueApprove(id, { bodies: { T1: 'Hi Mats Co, edited by Kiko.' }, send: true });
  assert.ok(Buffer.from(t.log.replies[0].payload.split('base64\r\n\r\n')[1].split('\r\n--')[0].replace(/\r\n/g, ''), 'base64').toString().indexOf('edited by Kiko') >= 0, 'edited body in the email');
  deq(t.log.sent, ['reply-1', 'reply-2'], 'both drafts sent'); assert.strictEqual(v.status, 'Done, drafts incomplete', 'first send failed');
  assert.deepStrictEqual(v.change.drafts.map(d => d.sent), [false, true]);
  const v2 = t.ctx.cueApprove(id, {}); assert.strictEqual(v2.status, 'Done'); deq(t.log.sent, ['reply-1', 'reply-2', 'reply-1'], 'only the failed one again, no new draft');
  assert.strictEqual(t.log.replies.length, 2);
  assert.ok(t.tabs.Chat.rows.some(x => /^Sent 2 requotes from your Gmail/.test(x[2])));
  const u = sandbox({ read: CHANGE_READ }), iu = u.ctx.cueSend('New project intake. JBL mats changed, requote please', [], 'intake').request_id; u.ctx.cueRun(iu);
  assert.strictEqual(u.ctx.cueApprove(iu, {}).status, 'Done'); assert.ok(!u.log.sent, 'drafts only sends nothing');
  // Intake: edited RFQ goes out; the supplier with no email stays a draft.
  const w = startToCard(), card = w.v, i0 = card.proposal.rfqs[0];
  const d = w.ctx.cueApprove(w.id, { rfqs: { 0: { subject: 'RFQ edited', body: 'Edited RFQ text' } }, send: true });
  assert.strictEqual(d.status, 'Done'); assert.ok(/Edited RFQ text|RWRpdGVkIFJGUSB0ZXh0/.test(w.log.gmail[0]), 'edited text');
  assert.strictEqual(w.log.sent.length, 2, 'two with emails sent, the one without stays a draft');
  assert.ok(w.tabs.Chat.rows.some(x => /2 RFQ\(s\) sent from your Gmail\. 1 had no email address/.test(x[2])));
  assert.ok(i0);
});

  t.ctx.cueSend('main chat secret line about lunch', [], 'chat');
  const id = t.ctx.cueSend('New project intake. JBL mats changed, requote please', [], 'intake').request_id; t.ctx.cueRun(id);
  const v = t.ctx.cueState().requests.filter(r => r.id === id)[0]; assert.strictEqual(v.ref, '', 'a new task starts its own thread');
  const before = t.log.gpt.length; t.ctx.cueSend('also cc Joy please', [], '', id);
  const seen = JSON.stringify(t.log.gpt.slice(before));
  assert.ok(/JBL mats changed/.test(seen), 'thread history included'); assert.ok(!/secret line about lunch/.test(seen), 'main chat left out');
  assert.ok(t.tabs.Chat.rows.filter(x => x[3] === id).length >= 3, 'reply and answer filed under the task');
});
