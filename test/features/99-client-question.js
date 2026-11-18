// Part of test/cue.test.js. Feature: CLIENT-QUESTION-2026-11-18 (CueAgentDrafts.gs, CueRfpSend.gs, IndexCards.html). Kiko 18 Nov 2026
// 10:22:01Z: "Add Agent Drafts type client_question. When the client's Gmail thread is known, send a reply-all in that thread. Otherwise
// send a new email to the project's main client contact (PROJ Contacts, else Client Desk). If there's no contact, refuse. It is sent
// only on Kiko's Send tap, from his Gmail via the RFP Outbox. Send back carries Kiko's answer to the agent and sends nothing."
const cqDraft = (n, o = {}) => agdDraft(n, Object.assign({ agent: 'Account agent', door: 'ChatGPT', type: 'client_question', type_label: 'Client question',
  item: 'Stage size', recipient: 'Ana Reyes (ana@acme.example)', subject: "Quick question · King's Day", body: 'Hi Ana,\n\nHow wide is the stage area?' }, o));
const CQ_ITEM = o => Object.assign({ key: 'agentclient:DRF-0031:anareyes:mabc1250', kind: 'agentclient', rfp_id: 'DRF-0031', supplier: 'Ana Reyes',
  to: ['ana@acme.example'], cc: [], subject: "Quick question · King's Day", body: 'Hi Ana,\n\nHow wide is the stage area?\n\nKiko', thread_id: '',
  queued_by: 'kiko@example.com', queued_at: '2026-11-18T10:40:00Z' }, o || {});
const cqThread = (o = {}) => ({ '18c2f0a9b7d1e3f4': [
  { id: 'm1', payload: { headers: [{ name: 'From', value: 'Kiko <kiko@example.com>' }, { name: 'To', value: 'Ana Reyes <ana@acme.example>' }, { name: 'Subject', value: "King's Day brief" }, { name: 'Message-ID', value: '<one@mail>' }] } },
  { id: 'm2', payload: { headers: [{ name: 'From', value: o.from || '"Ana Reyes" <Ana@Acme.example>' }, { name: 'To', value: 'kiko@example.com, ben@acme.example' },
    { name: 'Cc', value: 'Info <info@blankspaceevent.com>, ana@acme.example' }, { name: 'Subject', value: "Re: King's Day brief" }, { name: 'Message-ID', value: '<two@mail>' }].concat(o.replyTo ? [{ name: 'Reply-To', value: o.replyTo }] : []) } },
  { id: 'm3', labelIds: ['DRAFT'], payload: { headers: [{ name: 'From', value: 'kiko@example.com' }, { name: 'Subject', value: 'draft' }] } }] });
const cqMime = t => t.log.gmail.map(m => m.replace(/Subject: =\?UTF-8\?B\?([^?]+)\?=/, (x, b) => 'Subject: ' + Buffer.from(b, 'base64').toString('utf8')));

test('CQ1 a client question waits as a card in its agent\'s thread; Cue never sends it on its own', () => {
  const b = agdBox({ drafts: [cqDraft(31)] });
  assert.strictEqual(b.t.ctx.cueAgdTick_(), 1);
  const s = b.reqs()[0];
  assert.strictEqual(s.agd.type, 'client_question'); assert.strictEqual(s.status, 'Needs you');
  assert.ok(/Account agent drafted a client question: Stage size/.test(b.chat(s.id).join('\n')));
  assert.strictEqual(b.st.decide.length, 0); assert.strictEqual(b.t.log.gmail.length, 0, 'nothing goes out before Kiko taps Send');
});

test('CQ2 Send passes Kiko\'s tap to Canvas once; the card says it goes from his Gmail; Send back carries his answer and sends nothing', () => {
  const b = agdBox({ drafts: [cqDraft(31), cqDraft(32, { item: 'Parking' })], answer: (a, st) => {
    const d = st.drafts.filter(x => x.draft_id === a.draft_id)[0];
    Object.assign(d, { status: a.decision === 'send' ? 'Sending' : 'Sent back', decided: '2026-11-18 18:40', note: a.note || '' });
    return { ok: true, queued: a.decision === 'send', draft: Object.assign({}, d) }; } });
  b.t.ctx.cueAgdTick_();
  const [s1, s2] = b.reqs();
  b.t.ctx.cueAgdDecide_(s1.id, { decision: 'send' });
  deq(JSON.parse(JSON.stringify(b.st.decide.map(x => [x.draft_id, x.decision]))), [['DRF-0031', 'send']]);
  assert.strictEqual(b.t.ctx.cueAgdLine_({ type: 'client_question', status: 'Sending' }), 'Approved. It goes out from your Gmail within a minute.');
  assert.throws(() => b.t.ctx.cueAgdDecide_(s2.id, { decision: 'send_back' }), /Say what the agent should change/);
  b.t.ctx.cueAgdDecide_(s2.id, { decision: 'send_back', note: 'The stage is 12 by 8 metres.' });
  assert.strictEqual(b.st.decide[1].note, 'The stage is 12 by 8 metres.'); assert.strictEqual(b.st.decide[1].decision, 'send_back');
  assert.strictEqual(b.t.log.gmail.length, 0, 'Cue sends nothing itself; Canvas queues it for the RFP Outbox');
});

test('CQ3 the RFP Outbox sends a new client question from Kiko\'s Gmail to the one contact Canvas named, and tells Canvas Sent', () => {
  const t = sandbox({ rfpBox: [CQ_ITEM()] });
  const r = t.ctx.cueRfpSendTick_();
  deq([r.sent, r.failed, r.reported], [1, 0, 1]);
  const m = cqMime(t)[0];
  assert.ok(/^To: ana@acme\.example\r\nSubject: Quick question · King's Day\r\n/.test(m), m);
  assert.ok(!/In-Reply-To/.test(m) && !/\r\nCc:/.test(m));
  deq(JSON.parse(JSON.stringify(t.log.rfpSent)), [{ key: CQ_ITEM().key, status: 'Sent', thread_id: 'thr1abcdef', message_id: 'sent1abcdef' }]);
});

test('CQ4 with the client\'s thread it is a reply-all: everyone on the last email, Kiko left out, once each, under Re: the thread subject', () => {
  const t = sandbox({ rfpBox: [CQ_ITEM({ to: [], thread_id: '18c2f0a9b7d1e3f4', subject: 'ignored for a reply' })], threads: cqThread() });
  const r = t.ctx.cueRfpSendTick_();
  deq([r.sent, r.reported], [1, 1]);
  const m = cqMime(t)[0];
  assert.ok(/^To: ana@acme\.example, ben@acme\.example\r\nCc: info@blankspaceevent\.com\r\nSubject: Re: King's Day brief\r\nIn-Reply-To: <two@mail>\r\nReferences: <two@mail>\r\n/.test(m), m);
  deq(t.log.draftThreads, ['18c2f0a9b7d1e3f4']);
  const r2 = sandbox({ rfpBox: [CQ_ITEM({ to: [], thread_id: '18c2f0a9b7d1e3f4' })], threads: cqThread({ replyTo: 'events@acme.example' }) });
  r2.ctx.cueRfpSendTick_();
  assert.ok(/^To: events@acme\.example, ben@acme\.example\r\n/.test(cqMime(r2)[0]), 'Reply-To wins over From, as Gmail does');
});

test('CQ5 a thread Gmail can\'t open, or one with no one but Kiko, fails with the reason and sends nothing', () => {
  const t = sandbox({ rfpBox: [CQ_ITEM({ to: [], thread_id: '18c2f0a9b7d1e3f5' })], threads: cqThread() });
  const r = t.ctx.cueRfpSendTick_();
  deq([r.sent, r.failed], [0, 1]); assert.strictEqual(t.log.gmail.length, 0);
  assert.strictEqual(t.log.rfpSent[0].status, 'Failed'); assert.ok(/Gmail could not open the client's thread/.test(t.log.rfpSent[0].note), t.log.rfpSent[0].note);
  const only = { '18c2f0a9b7d1e3f4': [{ id: 'm1', payload: { headers: [{ name: 'From', value: 'kiko@example.com' }, { name: 'To', value: 'Kiko <KIKO@example.com>' }, { name: 'Subject', value: 'Note' }] } }] };
  const t2 = sandbox({ rfpBox: [CQ_ITEM({ to: [], thread_id: '18c2f0a9b7d1e3f4' })], threads: only });
  t2.ctx.cueRfpSendTick_();
  assert.strictEqual(t2.log.gmail.length, 0); assert.ok(/no one to reply to except you/.test(t2.log.rfpSent[0].note));
});

test('CQ6 the page: a reply-all card shows no subject box and says who it goes to; the note box asks for Kiko\'s answer', () => {
  const page = cuePage(), grab = name => { const a = page.indexOf('  function ' + name + '('); return page.slice(a, page.indexOf('\n  }\n', a) + 4); };
  const ctx = { editing: {} }; vm.createContext(ctx);
  vm.runInContext(grab('esc') + '\n' + page.match(/  var AGD_FROM = [^\n]*\n/)[0] + page.match(/  var AGD_PILL = [^\n]*\n[^\n]*\n/)[0] + grab('agdCardHtml'), ctx);
  const b = agdBox({ drafts: [cqDraft(31), cqDraft(32, { item: 'Parking', recipient: "Reply-all in the client's email thread", subject: '' })] }); b.t.ctx.cueAgdTick_();
  const [n, ra] = b.reqs().map(s => JSON.parse(JSON.stringify(b.t.ctx.cueView_(s))));
  const hn = ctx.agdCardHtml(n), hr = ctx.agdCardHtml(ra);
  assert.ok(/<td>From<\/td><td>Your Gmail<\/td>/.test(hn) && /ana@acme\.example/.test(hn) && /Quick question/.test(hn));
  assert.ok(/placeholder="Your answer for the agent, or what should change"/.test(hn));
  assert.ok(/Reply-all in the client&#39;s email thread|Reply-all in the client's email thread/.test(hr) && /Re: the thread/.test(hr) && /as Reply all does/.test(hr));
  ctx.editing[ra.id] = 1; ctx.editing[n.id] = 1;
  assert.ok(!/data-agd-subject=/.test(ctx.agdCardHtml(ra)) && /data-agd-body=/.test(ctx.agdCardHtml(ra)));
  assert.ok(/data-agd-subject=/.test(ctx.agdCardHtml(n)), 'a new email keeps its subject box');
});

test('CQ7 the bridge copy takes client_question with a thread_id', () => {
  assert.strictEqual(bridgeCheck('draft_add', { agent: 'Account agent', type: 'client_question', project_id: 'S-26579436KI', item: 'Stage size', body: 'Hi', thread_id: '18c2f0a9b7d1e3f4' }), '');
  assert.ok(/thread_id/.test(bridgeCheck('draft_add', { agent: 'A', type: 'client_question', item: 'x', body: 'y', thread_id: 'not a thread' })));
});
