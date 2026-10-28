// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: ai-relay.
// AI relay (CueRelay.gs, Kiko 23 Oct 03:47Z, specs/ai-relay.md): Cue carries notes between ChatGPT and Claude. No AI call.
const RKEYS = { CUE_RELAY_KEY_CHATGPT: 'cr_' + 'a'.repeat(64), CUE_RELAY_KEY_CLAUDE: 'cr_' + 'b'.repeat(64), CUE_RELAY_KEY_CUE: 'cr_' + 'c'.repeat(64) };
const relayBox = (o = {}) => { const t = sandbox(Object.assign({}, o, { props: Object.assign({}, RKEYS, { CUE_RELAY_GATE: 'on' }, o.props || {}) }));   // the gate tests; RL3 runs the default (off)
  t.post = (q, path) => JSON.parse(t.ctx.doPost({ pathInfo: path != null ? path : q && q.action === 'relay_task_confirm' ? 'confirm' : undefined, postData: { contents: typeof q === 'string' ? q : JSON.stringify(q) } }).text); return t; };
const GPT_NOTE = { action: 'relay_post', key: RKEYS.CUE_RELAY_KEY_CHATGPT, to: 'claude', topic: 'Zapier step 5', body: 'Step 5 still maps f9 from the old field. Please check zap-steps.js line 120.', links: ['https://github.com/kikodacanay14/CanvasWorkspace/pull/2'] };

test('RL1 a note waits for Kiko\'s Pass on, then the receiver lists it once and marks it read; no AI call', () => {
  const t = relayBox();
  assert.strictEqual(t.post({ action: 'relay_list', key: 'cr_wrong' + 'x'.repeat(60) }).error, 'Not allowed.');
  assert.strictEqual(t.post('not json').ok, false);
  const r = t.post(GPT_NOTE); assert.ok(r.ok); assert.strictEqual(r.status, 'waiting for Kiko');
  const row = t.tabs.Relay.rows[1]; assert.deepStrictEqual([row[2], row[3], row[7]], ['chatgpt', 'claude', 'new']);
  const th = row[10], s = t.state(th); assert.strictEqual(s.kind, 'relay'); assert.strictEqual(s.status, 'Needs you');
  assert.ok(t.tabs.Chat.rows.some(c => c[3] === '>' + th && /ChatGPT to Claude \(Canvas Integration\): Zapier step 5/.test(c[2])));
  const claude = { action: 'relay_list', key: RKEYS.CUE_RELAY_KEY_CLAUDE };
  assert.strictEqual(t.post(claude).notes.length, 0, 'not before Pass on');
  const v = t.ctx.cueRelayAct(th, r.id, 'pass'); assert.strictEqual(v.status, 'Done'); assert.strictEqual(v.relay.notes[0].status, 'passed');
  const got = t.post(claude).notes; assert.strictEqual(got.length, 1); assert.strictEqual(got[0].from, 'chatgpt'); deq(got[0].links, GPT_NOTE.links);
  assert.strictEqual(t.post({ action: 'relay_list', key: RKEYS.CUE_RELAY_KEY_CUE }).notes.length, 0, 'Claude in Cue sees only its own');
  assert.strictEqual(t.post({ action: 'relay_read', key: RKEYS.CUE_RELAY_KEY_CHATGPT, ids: [r.id] }).read, 0, 'only the receiver marks read');
  assert.strictEqual(t.post({ action: 'relay_read', key: RKEYS.CUE_RELAY_KEY_CLAUDE, ids: [r.id] }).read, 1);
  assert.strictEqual(t.post(claude).notes.length, 0);
  assert.strictEqual(t.log.gpt.length + t.log.claude.length, 0);
});

test('RL2 the relay refuses bank details, keys, plain-http links, notes to oneself, oversize notes and a full queue', () => {
  const t = relayBox(), post = x => t.post(Object.assign({}, GPT_NOTE, x));
  assert.ok(/bank details/.test(post({ body: 'Pay to BDO account number 0012 3456 7890' }).error));
  assert.ok(/API key/.test(post({ body: 'use sk-ant-' + 'z'.repeat(30) }).error));
  assert.ok(/password/.test(post({ body: 'login password: hunter2' }).error));
  assert.ok(/https/.test(post({ links: ['http://insecure.example'] }).error));
  assert.ok(/someone else/.test(post({ to: 'chatgpt' }).error));
  assert.ok(/to must be/.test(post({ to: 'kiko' }).error));
  assert.ok(/too long/.test(post({ body: 'x'.repeat(20001) }).error));
  assert.ok(!t.tabs.Relay, 'nothing stored');
  for (let i = 0; i < 30; i++) assert.ok(post({ topic: 'T' + i }).ok);
  assert.ok(/waiting already/.test(post({}).error));
});

test('RL3 by default (gate off, Kiko 04:10Z) notes pass on at once; one thread per topic; a reply on the topic joins it', () => {
  const t = relayBox({ props: { CUE_RELAY_GATE: '' } });
  const a = t.post(GPT_NOTE); assert.strictEqual(a.status, 'passed on');
  const b = t.post({ action: 'relay_post', key: RKEYS.CUE_RELAY_KEY_CLAUDE, to: 'chatgpt', topic: 'zapier STEP 5', body: 'Fixed in 6abe420.' });
  const rows = t.tabs.Relay.rows.slice(1); assert.strictEqual(rows[0][10], rows[1][10]); assert.strictEqual(t.state(rows[0][10]).status, 'Done');
  assert.strictEqual(t.post({ action: 'relay_list', key: RKEYS.CUE_RELAY_KEY_CHATGPT }).notes[0].id, b.id);
});

test('RL4 claude.ai adds a row to the Relay tab with the Sheets connector; the 5-minute tick checks and shows it', () => {
  const t = relayBox(); t.ctx.cueState(); t.ctx.cueRelaySheet_();
  t.tabs.Relay.appendRow(['', '', 'claude', 'cue', 'Bridge change', 'Release v203-main adds action ce_lines_v2.', '', 'new']);
  t.tabs.Relay.appendRow(['', '', 'chatgpt', 'claude', 'Spoof', 'pretend', '', 'new']);
  t.tabs.Relay.appendRow(['', '', 'claude', 'chatgpt', 'Bank', 'account no. 123', '', 'new']);
  t.ctx.cueResume();
  const rows = t.tabs.Relay.rows.slice(1);
  assert.deepStrictEqual(rows.map(r => r[7]), ['new', 'refused', 'refused']); assert.ok(rows.every(r => /^rl-/.test(r[0])));
  assert.ok(/Only Claude/.test(rows[1][9])); assert.ok(/bank details/.test(rows[2][9]));
  t.ctx.cueRelayAct(rows[0][10], rows[0][0], 'pass');
  assert.strictEqual(t.post({ action: 'relay_list', key: RKEYS.CUE_RELAY_KEY_CUE }).notes[0].topic, 'Bridge change');
  t.ctx.cueResume(); assert.strictEqual(t.tabs.Relay.rows.length, 4, 'picked up once');
});

test('RL5 "tell ChatGPT: …" in the chat is Kiko\'s own note, passed on at once with no AI call; Drop keeps a note back', () => {
  const t = relayBox(), r = t.ctx.cueSend('tell ChatGPT: please review the Step 5 diff in Drive https://drive.google.com/file/d/abc', [], '');
  const row = t.tabs.Relay.rows[1]; assert.deepStrictEqual([row[2], row[3], row[7]], ['kiko', 'chatgpt', 'passed']); assert.strictEqual(row[6], 'https://drive.google.com/file/d/abc');
  assert.strictEqual(r.request_id, row[10]); assert.strictEqual(t.log.gpt.length + t.log.claude.length, 0);
  assert.strictEqual(t.post({ action: 'relay_list', key: RKEYS.CUE_RELAY_KEY_CHATGPT }).notes.length, 1);
  assert.throws(() => t.ctx.cueSend('tell claude: account number 1234567890', [], ''), /bank details/);
  const n = t.post(Object.assign({}, GPT_NOTE, { topic: 'Other' })), th = t.tabs.Relay.rows.find(x => x[0] === n.id)[10];
  t.ctx.cueRelayAct(th, n.id, 'drop'); assert.strictEqual(t.post({ action: 'relay_list', key: RKEYS.CUE_RELAY_KEY_CLAUDE }).notes.length, 0);
  assert.throws(() => t.ctx.cueRelayAct(r.request_id, n.id, 'pass'), /not in this thread/);
});

test('RL6 Settings makes the three keys, New key replaces only one, and only Kiko can', () => {
  const t = sandbox(); let u0 = 0; t.ctx.Utilities.getUuid = () => (++u0).toString(16).padStart(8, '0') + '-0000-4000-8000-000000000000'; const s = t.ctx.cueRelayKeys('');
  const k = JSON.parse(JSON.stringify(s.relay.keys)); assert.deepStrictEqual(k.map(x => x.slot), ['chatgpt', 'claude', 'cue']); assert.ok(k.every(x => /^cr_[0-9a-f]{64}$/.test(x.key)));
  const s2 = JSON.parse(JSON.stringify(t.ctx.cueRelayKeys('claude').relay.keys));
  assert.strictEqual(s2[0].key, k[0].key); assert.notStrictEqual(s2[1].key, k[1].key); assert.strictEqual(s2[2].key, k[2].key);
  assert.strictEqual(t.ctx.cueRelaySettings_().gate, false, 'off by default'); assert.strictEqual(t.ctx.cueRelayGate(true).relay.gate, true);
  assert.throws(() => t.ctx.cueRelayUrlSet('https://evil.example/exec'), /relay address/);
  assert.strictEqual(t.ctx.cueRelayUrlSet('https://script.google.com/macros/s/AKfycbRELAY_test-123456789/exec').relay.url, 'https://script.google.com/macros/s/AKfycbRELAY_test-123456789/exec');
  const u = sandbox({ viewer: 'someone@else.test' }); assert.throws(() => u.ctx.cueRelayKeys(''), /private/);
});

// 1.31 (Kiko 23 Oct 04:13Z "If i started in gpt i want the process to complete in gpt"): ChatGPT reads Canvas, hands Cue work and
// confirms the write itself after Kiko says yes. The relay door has no signed-in viewer, so these run as someone who is not Kiko.
const PDF64 = Buffer.from('%PDF-1.4 merry quote').toString('base64');
const gptBox = (o = {}) => relayBox(Object.assign({ viewer: 'anyone@example.com', props: { CUE_RELAY_GATE: '' } }, o));
const GK = RKEYS.CUE_RELAY_KEY_CHATGPT;
const kick = t => { assert.ok((t.log.triggers || []).indexOf('cueRelayKick') >= 0, 'a one-off trigger starts it'); t.ctx.cueRelayKick(); };

test('RL7 canvas_read: only the allow-listed reads, a real project ID, bank and signature fields stripped; never a write', () => {
  const t = gptBox({ snap: { projects: [{ project_id: 'S-31628060SP', ce_total: 98000, bank_account: '1234-5678', payees: [{ name: 'Ace', account_no: '99', signature_url: 'x' }] }] } });
  const r = t.post({ action: 'canvas_read', key: GK, read: 'finance_snapshot', args: { project_ids: ['S-31628060SP'] } });
  assert.ok(r.ok, JSON.stringify(r)); deq(r.result, { projects: [{ project_id: 'S-31628060SP', ce_total: 98000, payees: [{ name: 'Ace' }] }] });
  deq(t.log.snapArgs, { project_ids: ['S-31628060SP'] });
  assert.ok(/takes only/.test(t.post({ action: 'canvas_read', key: GK, read: 'ce_update_costs', args: {} }).error));
  assert.ok(/takes only/.test(t.post({ action: 'canvas_read', key: GK, read: 'record_expense' }).error));
  assert.ok(/Canvas project ID/.test(t.post({ action: 'canvas_read', key: GK, read: 'ce_lines', project_id: 'Merry GCash' }).error));
  assert.strictEqual(t.post({ action: 'canvas_read', key: 'cr_' + 'z'.repeat(64), read: 'ce_lines' }).error, 'Not allowed.');
  assert.ok(t.post({ action: 'canvas_read', key: GK, read: 'ce_lines', project_id: 's-31628060sp' }).result.lines.length === 3);
  deq(t.log.bridge.map(b => b.action), ['finance_snapshot', 'ce_lines'], 'refused reads never reach Canvas');
});

test('RL8 CE costs from ChatGPT, start to finish in ChatGPT: queued, Cue matches, proposal with a one-time code, Kiko confirms, Canvas saved', () => {
  const t = gptBox({ gpt: { cecost: CEC_MATCH }, search: { 'jbl booth': { projects: [{ project_id: 'S-31628060SP', name: 'JBL Booth Fabrication', account: 'JBL', date: '2026-11-05' }], total: 1 } } });
  const q = t.post({ action: 'relay_task', key: GK, kind: 'ce_cost', project: 'JBL Booth', text: 'Zaina sent revised costs, see the quote.',
    openaiFileIdRefs: [{ name: 'quote.pdf', id: 'file-1', mime_type: 'application/pdf', download_link: 'https://files.oaiusercontent.com/file-1' }] });
  assert.ok(q.ok, JSON.stringify(q)); assert.strictEqual(q.state, 'queued'); assert.strictEqual(t.log.oai.length, 1, 'ChatGPT\'s file fetched at once');
  assert.strictEqual(t.post({ action: 'relay_task_status', key: GK, id: q.id }).state, 'queued');
  assert.strictEqual(t.post({ action: 'relay_task_status', key: RKEYS.CUE_RELAY_KEY_CUE, id: q.id }).ok, false, 'only the sender sees its task');
  kick(t);
  assert.ok((t.log.triggers || []).indexOf('cueRelayKick') < 0, 'the one-off trigger removes itself');
  const st = t.post({ action: 'relay_task_status', key: GK, id: q.id });
  assert.strictEqual(st.state, 'needs_kiko', JSON.stringify(st)); assert.ok(/^\d{6}$/.test(st.confirm_code));
  deq(st.proposal.lines.map(l => [l.key, l.cost_now, l.cost_new, l.change]), [['L1', 70000, 85000, true], ['L2', 5000, 6000, true], ['L3', null, null, false]]);
  const g = t.log.gpt.filter(b => b.text.format.name === 'cecost'); assert.strictEqual(g.length, 1, 'one AI call');
  assert.ok(g[0].input[0].content.some(p => p.type === 'input_file' && p.filename === 'quote.pdf'), 'the quote ChatGPT sent is read');
  assert.ok(!t.log.ceWrites, 'nothing written before the confirm');
  assert.strictEqual(t.post({ action: 'relay_task_status', key: GK, id: q.id }).confirm_code, st.confirm_code, 'same proposal, same code');
  assert.ok(/old or wrong/.test(t.post({ action: 'relay_task_confirm', key: GK, id: q.id, code: '000000' }).error));
  assert.ok(/goes to \/exec\/confirm/.test(t.post({ action: 'relay_task_confirm', key: GK, id: q.id, code: st.confirm_code }, '').error), 'never through the plain path');
  assert.ok(/Only relay_task_confirm/.test(t.post({ action: 'canvas_read', key: GK, read: 'ce_lines' }, 'confirm').error));
  const done = t.post({ action: 'relay_task_confirm', key: GK, id: q.id, code: st.confirm_code, edits: { rows: { L2: { tick: false } } } });
  assert.strictEqual(done.state, 'done', JSON.stringify(done));
  deq(t.log.ceWrites.length, 1); deq(t.log.ceWrites[0].args.lines, [{ req_id: 'REQ-1', unit_cost: 85000, was: 70000 }]);
  deq(done.result.saved.map(x => [x.req_id, x.saved]), [['REQ-1', true]]);
  assert.ok(/old or wrong|not waiting/.test(t.post({ action: 'relay_task_confirm', key: GK, id: q.id, code: st.confirm_code }).error), 'a code works once');
  assert.ok(t.tabs.Chat.rows.some(r => /Kiko confirmed this in ChatGPT/.test(r[2])), 'Cue\'s thread shows who confirmed');
});

test('RL9 a code goes stale after 10 minutes; Settings can switch ChatGPT confirms off; a question comes back and Kiko\'s answer carries on', () => {
  const t = gptBox({ gpt: { cecost: CEC_MATCH }, search: { 'jbl booth': { projects: [{ project_id: 'S-31628060SP', name: 'JBL Booth Fabrication' }], total: 1 } } });
  const q = t.post({ action: 'relay_task', key: GK, kind: 'ce_cost', project: 'JBL Booth', text: 'Booth fabrication 85,000.' });
  kick(t);
  const st = t.post({ action: 'relay_task_status', key: GK, id: q.id }); t.ctx.__wait(11 * 60 * 1000);
  assert.ok(/old or wrong/.test(t.post({ action: 'relay_task_confirm', key: GK, id: q.id, code: st.confirm_code }).error));
  const st2 = t.post({ action: 'relay_task_status', key: GK, id: q.id }); assert.notStrictEqual(st2.confirm_code, st.confirm_code);
  t.props.CUE_RELAY_WRITES = 'off';
  assert.ok(/turned off/.test(t.post({ action: 'relay_task_confirm', key: GK, id: q.id, code: st2.confirm_code }).error)); assert.ok(!t.log.ceWrites);
  const u = gptBox({ gpt: { cecost: CEC_MATCH } });
  const a = u.post({ action: 'relay_task', key: GK, kind: 'ce_cost', project: 'Nowhere Fest', text: 'Booth 85,000' }); kick(u);
  const qn = u.post({ action: 'relay_task_status', key: GK, id: a.id });
  deq([qn.state, /no project like "Nowhere Fest"/.test(qn.question)], ['question', true]);
  assert.ok(!qn.confirm_code, 'nothing to confirm yet');
});

test('RL10 an expense from ChatGPT with its receipt: Cue reads it, Kiko clears the points in ChatGPT, Canvas records it with the same file', () => {
  const t = gptBox();
  const q = t.post({ action: 'relay_task', key: GK, kind: 'expense', text: XTEXT, files: [JPG] }); assert.ok(q.ok, JSON.stringify(q));
  kick(t);
  const st = t.post({ action: 'relay_task_status', key: GK, id: q.id });
  assert.strictEqual(st.state, 'needs_kiko', JSON.stringify(st)); assert.strictEqual(st.proposal.plan.route, 'new_scope');
  deq(st.proposal.points_to_check.map(x => x.n), [0]);
  assert.ok(t.log.gpt.some(b => b.text.format.name === 'expense' && b.input[0].content.some(p => p.type === 'input_image')), 'the receipt is read');
  const bad = t.post({ action: 'relay_task_confirm', key: GK, id: q.id, code: st.confirm_code });
  assert.ok(/Tick each point/.test(bad.error), JSON.stringify(bad)); assert.ok(!t.log.recorded);
  const st2 = t.post({ action: 'relay_task_status', key: GK, id: q.id });
  const done = t.post({ action: 'relay_task_confirm', key: GK, id: q.id, code: st2.confirm_code, edits: { cleared: [0], files: [] } });
  assert.strictEqual(done.state, 'done', JSON.stringify(done)); assert.strictEqual(t.log.recorded.length, 1);
  deq([t.log.recorded[0].args.files[0].mime, t.log.recorded[0].args.files[0].data], ['image/jpeg', JPG.data], 'the file ChatGPT sent, from Cue\'s Drive');
  deq(done.result.canvas.request_id, 'AP-ACE-TRI-1');
});

test('RL12 a project intake from ChatGPT runs Cue\'s phased intake; phase 1 comes back to confirm, and RFQ emails never go through the relay', () => {
  const t = gptBox({ phased: true });
  const q = t.post({ action: 'relay_task', key: GK, kind: 'intake', text: 'Telus wants a Trick or Treat booth in BGC on 25 Oct, 300 pax, ingress 24 Oct.', files: [{ name: 'brief.pdf', type: 'application/pdf', data: PDF64 }] });
  assert.ok(q.ok, JSON.stringify(q)); kick(t);
  const row = t.tabs.Relay.rows.find(r => r[0] === q.id); assert.strictEqual(row[7], 'started', JSON.stringify(row));
  const s = t.state(row[10]); deq([s.kind, s.phased, s.files.map(f => f.name)], ['intake', true, ['brief.pdf']]);
  assert.ok(/^From ChatGPT: Telus wants/.test(s.text));
  let st = t.post({ action: 'relay_task_status', key: GK, id: q.id });
  for (let i = 0; i < 3 && st.state === 'working'; i++) { t.ctx.cueRelayKick(); st = t.post({ action: 'relay_task_status', key: GK, id: q.id }); }
  assert.strictEqual(st.state, 'needs_kiko', JSON.stringify(st).slice(0, 400)); assert.ok(/phase 1 of 4/.test(st.proposal.what));
  const c1 = t.post({ action: 'relay_task_confirm', key: GK, id: q.id, code: st.confirm_code });
  assert.ok(c1.ok, JSON.stringify(c1).slice(0, 400)); assert.ok(t.log.bridge.some(b => b.action === 'intake_add_project'), 'phase 1 writes the project, as Approve does');
  const x = t.ctx.cueLoad_(row[10]); x.s.status = 'Needs you'; x.s.phase = 4; t.ctx.cueSave_(x.sh, x.row, x.s);
  const p4 = t.post({ action: 'relay_task_status', key: GK, id: q.id });
  deq([p4.state, /emails never go through the relay/.test(p4.say), !!p4.confirm_code], ['done', true, false]);
  assert.ok(/not waiting/.test(t.post({ action: 'relay_task_confirm', key: GK, id: q.id, code: st.confirm_code }).error), 'no RFQ send from ChatGPT');
});

test('RL11 relay tasks refuse bad input before any AI call: kind, project, file types, size, bank details, a failed download, the queue cap', () => {
  const t = gptBox({ oaiFail: true }), post = x => t.post(Object.assign({ action: 'relay_task', key: GK }, x));
  assert.ok(/kind is/.test(post({ kind: 'delete', text: 'x' }).error));
  assert.ok(/Give project/.test(post({ kind: 'ce_cost', text: 'costs' }).error));
  assert.ok(/photos .* or PDFs/.test(post({ kind: 'expense', text: 'receipt', files: [{ name: 'a.txt', type: 'text/plain', data: 'aGk=' }] }).error));
  assert.ok(/more than 6 MB/.test(post({ kind: 'expense', text: 'receipt', files: [{ name: 'a.pdf', type: 'application/pdf', data: 'A'.repeat(9 * 1024 * 1024) }] }).error));
  assert.ok(/bank details/.test(post({ kind: 'expense', text: 'Pay Ace, account number 1234-5678' }).error));
  assert.ok(/download failed/.test(post({ kind: 'expense', text: 'receipt', openaiFileIdRefs: [{ name: 'r.jpg', mime_type: 'image/jpeg', download_link: 'https://files.oaiusercontent.com/r' }] }).error));
  for (let i = 0; i < 10; i++) assert.ok(post({ kind: 'intake', text: 'Client needs a 3x3 booth in BGC on 5 Nov, 200 pax. ' + i }).ok);
  assert.ok(/10 of your tasks queued/.test(post({ kind: 'intake', text: 'Client needs a 3x3 booth in BGC on 5 Nov, 200 pax.' }).error));
  assert.strictEqual(t.log.gpt.length + t.log.claude.length, 0, 'no AI call at the door');
  assert.strictEqual(t.log.triggers.filter(h => h === 'cueRelayKick').length, 1, 'one waiting trigger, not one per task');
});
