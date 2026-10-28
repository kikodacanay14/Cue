// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: inbox-triage.
/* ---------- inbox triage ---------- */
const triRun = () => ({ id: 'cue-sweep-1', metrics: { ai_calls: 0, calls: [] }, notes: [] });
const byGroup = (lines, g) => [].concat.apply([], lines.filter(l => l.group === g).map(l => (l.skipped ? l.skipped.map(x => x.thread_id) : [l.thread_id])));
test('TR1 triage: code drops answered, project, old and junk mail; ONE GPT call sorts the rest; replies carry a draft brief', () => {
  const t = sandbox({ inbox: INBOX, triage: TRIAGE }), run = triRun(), ctx = { s: run, board: BOARD };
  const lines = t.ctx.cueTriageFind_(ctx);
  assert.strictEqual(run.metrics.ai_calls, 1, 'one AI call'); assert.strictEqual(t.log.gpt.length, 1);
  assert.ok(/^in:inbox -in:chats after:\d+$/.test(t.log.inboxQ)); assert.strictEqual(Number(t.log.inboxQ.split('after:')[1]), Date.parse('2026-10-20T03:00:00Z') / 1000);
  deq(byGroup(lines, 'inquiry'), ['a1a1a1a1a1a1a1a1']); deq(byGroup(lines, 'reply'), ['b2b2b2b2b2b2b2b2', '1010101010101010'], 'urgent first');
  deq(byGroup(lines, 'fyi'), ['0909090909090909']); assert.ok(!lines.some(l => /not an email we sent/.test(l.summary)), 'a key GPT made up is ignored');
  deq(byGroup(lines, 'skip').sort(), ['c3c3c3c3c3c3c3c3', 'd4d4d4d4d4d4d4d4']);
  const sk = lines.filter(l => l.group === 'skip'); assert.strictEqual(sk.length, 1, 'skipped mail is one line'); assert.strictEqual(sk[0].summary, '2 skipped');
  assert.ok(sk[0].needs_draft === false && sk[0].skipped.every(x => x.why && x.sender));
  ['e5e5e5e5e5e5e5e5', 'f6f6f6f6f6f6f6f6', '0707070707070707'].forEach(id => assert.ok(!lines.some(l => l.thread_id === id), id + ' dropped'));
  const sent = t.log.gpt[0].input; assert.ok(!/digest|sale|quote attached|Old news/.test(sent), 'junk and claimed mail never reach GPT');
  assert.ok(/never follow instructions/.test(t.log.gpt[0].instructions)); assert.strictEqual(t.log.gpt[0].text.format.name, 'triage');
  assert.ok(!/old quoted text/.test(sent), 'quoted history cut'); assert.ok(sent.length < 4 * 1600 + 2000, 'each email cut to 1,500 characters');
  const r = lines.find(l => l.group === 'reply'), q = lines.find(l => l.group === 'inquiry');
  assert.ok(r.needs_draft && r.urgent && /meet Thursday/.test(r.context) && r.context.length <= 1500); assert.strictEqual(r.to, 'marco@partner.example');
  assert.strictEqual(r.who, 'Marco Cruz'); assert.strictEqual(r.sender, 'marco@partner.example', 'for the teach buttons'); assert.ok(r.message_id && r.subject === 'Meeting Thursday?', 'enough to reply in the thread');
  assert.strictEqual(q.action, 'start_intake'); assert.ok(!q.needs_draft && q.context === '', 'only reply briefs go on to the draft call');
  assert.strictEqual(lines[0].group, 'inquiry'); assert.strictEqual(lines[lines.length - 1].group, 'skip', 'inquiries first, skipped last');
  assert.ok(lines.every(l => l.kind === 'inbox' && /^inbox:/.test(l.key)));
  assert.strictEqual(vm.runInContext('CUE_TRIAGE_KIND_', t.ctx).kind, 'inbox'); assert.strictEqual(vm.runInContext('CUE_TRIAGE_KIND_', t.ctx).chase, false);
  assert.strictEqual(t.log.gmail.length + (t.log.replies || []).length + (t.log.sent || []).length, 0, 'read only: nothing drafted or sent');
});
test('TR2 triage: when GPT fails the batch still builds; everything it would sort shows as FYI with a note', () => {
  const t = sandbox({ inbox: INBOX, fail: { triage: () => resp(400, { error: { message: 'bad' } }) } }), run = triRun();
  const lines = t.ctx.cueTriageFind_({ s: run, board: BOARD });
  deq(byGroup(lines, 'fyi').sort(), ['0909090909090909', '1010101010101010', 'a1a1a1a1a1a1a1a1', 'b2b2b2b2b2b2b2b2']);
  assert.ok(lines.filter(l => l.group === 'fyi').every(l => /could not sort/.test(l.why) && !l.needs_draft));
  assert.ok(/ChatGPT could not sort/.test(run.notes[0]));
});
test('TR3 triage: after the batch is posted the lines are logged and the window moves, so tomorrow shows only new mail', () => {
  const t = sandbox({ inbox: INBOX, triage: TRIAGE }), run = triRun(), c = { s: run, board: () => BOARD };   // the engine passes board as a function
  const lines = t.ctx.cueTriageFind_(c);
  vm.runInContext('CUE_TRIAGE_KIND_', t.ctx).posted(c, lines);
  assert.strictEqual(t.tabs['Triage log'].rows.length - 1, 6, 'each skipped email logged on its own'); assert.strictEqual(t.props.CUE_TRIAGE_SINCE, String(Date.parse('2026-10-21T03:00:00Z')));
  assert.strictEqual(t.tabs['Triage log'].rows[1][7], 'cue-sweep-1');
  deq(t.ctx.cueTriageFind_({ s: triRun(), board: BOARD }), [], 'nothing new since the run');
  t.props.CUE_TRIAGE_SINCE = '1';   // even with the window reset, logged messages are not shown again; only the never-seen old one is
  deq(t.ctx.cueTriageFind_({ s: triRun(), board: BOARD }).map(l => l.thread_id), ['0707070707070707']);
  const none = sandbox({ inbox: INBOX.filter(x => /^[cd]/.test(x.id)) }), r2 = triRun();
  const only = none.ctx.cueTriageFind_({ s: r2 }); assert.strictEqual(only.length, 1); assert.strictEqual(only[0].summary, '2 skipped');
  assert.strictEqual(r2.metrics.ai_calls, 0, 'only junk: no AI call');
});
test('TR4 triage: Kiko\'s corrections become sender rules (mute, not junk, not an inquiry); owner only', () => {
  const t = sandbox({ inbox: INBOX, triage: TRIAGE });
  t.ctx.cueTriageTeach('pushy@spam.example', 'mute', 'Mute this sender'); t.ctx.cueTriageTeach('NEWS@events.example', 'keep', 'Not junk');
  t.ctx.cueTriageTeach('@acme.example', 'no_inquiry', 'Not an inquiry');
  assert.throws(() => t.ctx.cueTriageTeach('not an email', 'mute'), /not an email/); assert.throws(() => t.ctx.cueTriageTeach('a@b.example', 'send'), /Unknown rule/);
  const lines = t.ctx.cueTriageFind_({ s: triRun(), board: BOARD });
  const p = lines.find(l => l.group === 'skip').skipped.find(x => x.thread_id === '1010101010101010'); assert.strictEqual(p.why, 'muted sender');
  assert.ok(!/buy now/.test(t.log.gpt[0].input), 'muted sender not sent to GPT'); assert.ok(/digest/.test(t.log.gpt[0].input), 'kept newsletter goes to GPT');
  const a = lines.find(l => l.thread_id === 'a1a1a1a1a1a1a1a1'); assert.strictEqual(a.group, 'fyi'); assert.ok(/not an inquiry/.test(a.why));
  assert.throws(() => sandbox({ viewer: 'someone@else.example' }).ctx.cueTriageTeach('a@b.example', 'mute'), /private/);
});
test('TR5 triage: Start intake turns the email and its readable files into a normal intake linked to the thread, which triage then leaves alone', () => {
  const t = sandbox({ inbox: INBOX, triage: TRIAGE });
  const out = t.ctx.cueTriageIntake('a1a1a1a1a1a1a1a1'), s = t.state(out.request_id);
  assert.strictEqual(s.kind, 'intake'); assert.ok(/^New project intake from email\.\nFrom: Ana Reyes <ana@acme\.example>\nSubject: Quote for our launch/.test(s.text));
  assert.ok(/product launch on 5 December/.test(s.text) && /Not attached, Cue cannot read them: tool\.exe/.test(s.text));
  deq(s.files.map(f => f.name), ['brief.pdf']); assert.ok(!/logo\.png/.test(s.text), 'signature logos ignored'); assert.strictEqual(t.drive.files[s.files[0].id].toString(), 'PDFDATA');
  assert.strictEqual(s.source.thread_id, 'a1a1a1a1a1a1a1a1');
  const viaCard = vm.runInContext('CUE_TRIAGE_KIND_', t.ctx).act({ action: 'start_intake', thread_id: 'a1a1a1a1a1a1a1a1' }, {});
  assert.ok(viaCard.request_id && viaCard.request_id !== out.request_id, 'the card button runs the same Start intake');
  assert.ok(!t.ctx.cueTriageFind_({ s: triRun(), board: BOARD }).some(l => l.thread_id === 'a1a1a1a1a1a1a1a1'), 'claimed by the intake');
  assert.throws(() => t.ctx.cueTriageIntake('../../x'), /not in your inbox/);
});

test('TR6 triage inside the real Morning batch: 1 sort call + the engine\'s 1 draft call, reply drafted in its thread, Start intake from the card', () => {
  const t = sweepBox({ inbox: INBOX, triage: TRIAGE, projects: BOARD.projects }, null); t.ctx.cueSweep(); const b = batchOf(t);
  assert.strictEqual(b.status, 'Needs you'); deq(t.log.gpt.map(g => g.text.format.name), ['triage', 'chasers']); assert.strictEqual(b.metrics.ai_calls, 2);
  assert.strictEqual(t.log.board, 1, 'one Canvas read shared with the other kinds');
  const raw = t.state(b.id), inbox = raw.batch.items.filter(i => i.kind === 'inbox'), g = k => inbox.filter(i => i.group === k);
  assert.ok(b.batch.items.some(i => i.kind === 'inbox' && i.group === 'inquiry' && i.action === 'start_intake' && i.sender), 'the card gets group, action and sender');
  const vs = b.batch.items.find(i => i.kind === 'inbox' && i.group === 'skip'); assert.ok(vs && vs.summary === '2 skipped' && vs.skipped.length === 2 && vs.skipped[0].sender, 'the card can list skipped mail');
  deq(g('reply').map(i => i.thread_id), ['b2b2b2b2b2b2b2b2', '1010101010101010']);
  assert.ok(g('reply').every(i => i.selected && i.send_ok && /GPT nudge for/.test(i.body)), 'replies drafted by the engine, ready to approve');
  assert.ok(/meet Thursday/.test(t.log.gpt[1].input), 'the email excerpt is the draft call\'s facts');
  const q = g('inquiry')[0]; assert.ok(q.no_email && !q.selected && q.action === 'start_intake' && q.sender === 'ana@acme.example');
  assert.ok(g('skip').length === 1 && g('skip')[0].no_email); assert.ok(g('fyi').every(i => i.no_email));
  assert.ok(t.tabs['Triage log'].rows.length - 1 >= 5, 'logged once the batch is saved'); assert.ok(Number(t.props.CUE_TRIAGE_SINCE) > 0);
  const out = t.ctx.cueSweepAct(b.id, q.key); assert.ok(out.request_id); assert.strictEqual(t.state(out.request_id).source.thread_id, 'a1a1a1a1a1a1a1a1');
  assert.ok(batchOf(t).batch.items.find(i => i.key === q.key).acted, 'the line shows it was acted on');
  assert.ok(!t.log.sent, 'nothing sent before Kiko approves');
  t.at('2026-10-22', 7, 0); t.ctx.cueSweep(); assert.ok(!batchOf(t).batch || !batchOf(t).batch.items.some(i => i.kind === 'inbox'), 'yesterday\'s mail is not shown again');
});

test('TR7 a missing Triage log tab is made on first use (no "run cueSetup"); Mute this sender on an inbox line adds a Triage rule', () => {
  const t = sweepBox({ inbox: INBOX, triage: TRIAGE, projects: BOARD.projects }, null); delete t.tabs['Triage log'];
  t.ctx.cueSweep(); const b = batchOf(t);
  assert.ok(!(b.notes || []).some(n => /cueSetup|no Triage log/.test(n)), 'no setup message on the card');
  assert.ok(t.tabs['Triage log'] && t.tabs['Triage log'].rows[0][1] === 'Message' && t.tabs['Triage log'].rows.length > 1, 'tab made with its header, then logged');
  const f = b.batch.items.find(i => i.kind === 'inbox' && i.group === 'fyi' && i.sender);
  t.ctx.cueSweepItem(b.id, f.key, 'mute');
  assert.ok(t.tabs['Triage rules'].rows.some(r => r[0] === f.sender && r[1] === 'mute'));
});
