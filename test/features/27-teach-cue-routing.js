// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: teach-cue-routing.
/* ---------- Teach Cue add-on: learning at once, asking when unsure, wrong command (CueTeach.gs, CueRoute.gs) ---------- */
const askLine = t => t.tabs.Chat.rows.filter(r => /^\?ask-/.test(String(r[3]))).pop();
const askId = r => String(r[3]).match(/^\?(ask-[0-9a-z]+)/)[1];

test('TC5 Kiko\'s intake rules are seeded into Memory once, as rules used in every task', () => {
  const t = sandbox({ props: { CUE_MEMORY_SEEDED: '' } });
  const a = t.ctx.cueTeachFor_('hello'); t.ctx.cueTeachReset_(); t.ctx.cueTeachFor_('hello');
  deq(t.tabs.Memory.rows.slice(1).map(r => [r[0], r[1], r[3], r[5]]), Array(4).fill([true, 'rules', true, 'seed']));
  assert.ok(/same project/.test(a) && /instead of rescanning|does not rescan/.test(a) && /before Kiko taps Approve/.test(a) && /deleted/.test(a));
  deq(t.props.CUE_MEMORY_SEEDED, '1');
});

test('TC6 a correction in chat is saved at once (same chat call, no extra AI call), used on the next call, and Undo switches it off', () => {
  const t = sandbox({ talk: { reply: 'Got it, I will answer next time.', looks_like_inquiry: false, learn: 'When Kiko asks a question in a thread, Cue answers it instead of rescanning.' } });
  t.ctx.cueSend('no, don\'t rescan when I ask a question, just answer', [], '');
  deq(t.log.gpt.length, 1);
  deq(t.tabs.Memory.rows.slice(1).map(r => [r[0], r[1], r[2], r[3]]), [[true, 'rules', 'When Kiko asks a question in a thread, Cue answers it instead of rescanning.', true]]);
  const q = askLine(t); assert.ok(/^Learned: /.test(q[2]) && /:keep,undo$/.test(q[3]));
  assert.ok(/answers it instead of rescanning/.test(t.ctx.cueTeachFor_('anything at all')), 'applies from the next call');
  t.ctx.cueSend('ok thanks', [], '');
  assert.ok(/answers it instead of rescanning/.test(t.log.gpt[1].instructions), 'the very next chat call carries it');
  deq(t.tabs.Memory.rows.length, 2, 'the same rule is not saved twice');
  t.ctx.cueAskPick(askId(q), 'undo');
  deq(t.tabs.Memory.rows[1][0], false); assert.ok(!/rescanning/.test(t.ctx.cueTeachFor_('anything')));
  assert.throws(() => t.ctx.cueAskPick(askId(q), 'keep'), /already answered/);
});

test('TC7 "remember: …" in a task\'s thread is saved with no AI call and asks Keep or Undo in that thread', () => {
  const t = vendorRun(); const n = t.log.gpt.length + t.log.claude.length;
  const out = t.ctx.cueSend('remember: always ask Sonic Pro first for LED walls', [], '', t.id);
  deq([t.log.gpt.length + t.log.claude.length, out.task], [n, t.id]);
  deq(t.tabs.Memory.rows[1].slice(0, 4), [true, 'rules', 'always ask Sonic Pro first for LED walls', true]);
  assert.ok(new RegExp(':keep,undo@' + t.id + '$').test(askLine(t)[3]), 'the question shows in the thread');
  t.ctx.cueSend('from now on cost per requirement', [], '', t.id);
  deq(t.tabs.Memory.rows[2][2], 'From now on, cost per requirement');
  t.ctx.cueSend('Remember: always ask Sonic Pro first for LED walls', [], '', t.id);
  assert.ok(/already have that rule/.test(t.tabs.Chat.rows.pop()[2]));
});

test('TC8 not sure which command: nothing starts, the top 2 show as buttons plus Just chat; a button starts it from the same chat call', () => {
  const talk = VTALK({}, 'Do you want suppliers or a readiness check?'); Object.assign(talk, { sure: false, choices: ['vendor', 'readiness'], readiness: 'Acme Party' });
  const t = sandbox({ talk }); const out = t.ctx.cueSend('LED wall for Acme Party', [], '');
  deq([out.chat, !!out.ask, t.tabs.Requests.rows.length, t.log.gpt.length], [true, true, 1, 1]);
  const q = askLine(t); assert.ok(/:vendor,readiness,chat$/.test(q[3]) && q[2] === 'Do you want suppliers or a readiness check?');
  const go = t.ctx.cueAskPick(askId(q), 'vendor');
  deq([t.log.gpt.length, t.ctx.cueLoad_(go.request_id).s.kind], [1, 'vendor']);
  assert.throws(() => t.ctx.cueAskPick(askId(q), 'readiness'), /already answered/);
  const u = sandbox({ talk }); u.ctx.cueSend('LED wall for Acme Party', [], ''); u.ctx.cueAskPick(askId(askLine(u)), 'chat');
  deq(u.tabs.Requests.rows.length, 1); assert.ok(/Nothing was started/.test(u.tabs.Chat.rows.pop()[2]));
  const w = vendorRun({ gpt: { chat: [VTALK(), talk] } }); w.ctx.cueSend('LED wall for Acme Party', [], '', w.id);   // in a thread it asks in words
  assert.ok(/Did you mean Supplier search or Readiness check\? Say which/.test(w.tabs.Chat.rows.pop()[2]));
});

test('TC8b answering a question deletes its CUE_ASK_ property; blank leftovers and 30-day-old questions are removed when the next one opens', () => {
  const talk = VTALK({}, 'Do you want suppliers or a readiness check?'); Object.assign(talk, { sure: false, choices: ['vendor', 'readiness'], readiness: 'Acme Party' });
  const t = sandbox({ talk }), asks = () => Object.keys(t.props).filter(k => /^CUE_ASK_/.test(k)).sort();
  t.ctx.cueSend('LED wall for Acme Party', [], ''); const id = askId(askLine(t));
  deq(asks(), ['CUE_ASK_' + id]);
  assert.throws(() => t.ctx.cueAskPick(id, 'nope'), /not one of the choices/); deq(asks(), ['CUE_ASK_' + id], 'a bad pick keeps it open');
  t.ctx.cueAskPick(id, 'chat'); deq(asks(), [], 'answered: gone, not blank');
  const now = t.ctx.cueNow_(), day = 86400000, key = ms => 'CUE_ASK_ask-' + ms.toString(36) + '2r0';
  Object.assign(t.props, { [key(now - day)]: '', [key(now - 31 * day)]: '{"type":"remember"}', [key(now - 29 * day)]: '{"type":"remember"}', CUE_ASK_odd: '' });
  t.ctx.cueSend('LED wall for Acme Party', [], ''); const id2 = askId(askLine(t));
  deq(asks(), ['CUE_ASK_' + id2, key(now - 29 * day)].sort(), 'blank and 31-day-old removed; 29-day-old and the new one kept');
  deq(t.ctx.cueAskTidy_(), 0);
});

test('TC9 wrong command: the task closes, the right one starts from the same message, and Cue asks once to remember; Yes feeds the next chat calls', () => {
  const ready = { reply: 'Checking Canvas.', looks_like_inquiry: false, start_intake: '', task: '', readiness: 'Acme Party', sure: true, choices: [] };
  const t = mailRun({ gpt: { chat: [mailAsk({}), ready] } }); deq(t.v.status, 'Needs you'); assert.ok(t.v.can_redo);
  const out = t.ctx.cueWrongCommand(t.id, 'readiness');
  deq([t.ctx.cueLoad_(t.id).s.status, t.ctx.cueLoad_(out.request_id).s.kind], ['Closed', 'readiness']);
  assert.ok(/Kiko corrected Cue: this message is a Readiness check request/.test(t.log.gpt.filter(b => b.text.format.name === 'chat')[1].input));
  const q = askLine(t); assert.ok(/^Remember that "email Mats Co asking if they can deliver a day early" means Readiness check\?$/.test(q[2]) && /:yes,no$/.test(q[3]));
  t.ctx.cueAskPick(askId(q), 'yes');
  deq(t.tabs['Routing examples'].rows.slice(1).map(r => r.slice(1)), [['email Mats Co asking if they can deliver a day early', 'readiness']]);
  deq([...t.ctx.cueRouteExamples_('can Mats Co deliver early')], ['"email Mats Co asking if they can deliver a day early" means Readiness check']);
  assert.throws(() => t.ctx.cueWrongCommand(t.id, 'email'), /no longer be redone/);
  t.ctx.cueSend('can Mats Co deliver early', [], '');
  assert.ok(/What Kiko meant before/.test(t.log.gpt.filter(b => b.text.format.name === 'chat').pop().input));
});


const CHATS_OUT = { items: [
  { kind: 'rule', text: 'Kiko wants costing per requirement, not per item.', topic: 'rules', command: '' },
  { kind: 'fact', text: 'Acme Corp is a repeat client that pays in 30 days.', topic: 'clients', command: '' },
  { kind: 'phrase', text: 'quote this for me', topic: 'about Kiko', command: 'intake' },
  { kind: 'phrase', text: 'just thinking out loud', topic: 'about Kiko', command: 'chat' },
  { kind: 'fact', text: 'Card 4111 1111 1111 1111 is for BSE', topic: 'money', command: '' }] };
const CHATS = n => Array.from({ length: n }, (_, i) => ({ title: 'Chat ' + i, date: '2026-10-' + String(1 + i % 20).padStart(2, '0'), text: 'Kiko: please cost this per requirement, chat ' + i + '\nAI: ok' }));
test('TC10 "learn from chats": the page sends the newest chats; Claude reads them 10 per call in parallel; one card; approve saves facts to Memory and phrasings to routing', () => {
  const t = sandbox({ fail: { chats: () => resp(500, {}) } });
  const out = t.ctx.cueLearnChats({ source: 'ChatGPT', total: 120, chats: CHATS(25).concat([{ title: 'empty', text: '' }]) });
  const v = t.ctx.cueRun(out.request_id);
  deq([v.kind, v.status, t.log.chatBatches, v.metrics.ai_calls], ['memory', 'Needs you', 4, 4]);   // 3 batches + 1 retry of the failed one
  const ask = JSON.parse(t.log.claude[0].messages[0].content); deq([ask.chats.length, ask.chats[0].title], [10, 'Chat 0']);
  deq(v.teach.facts.map(f => [f.topic, f.always, f.phrase]), [['rules', true, false], ['clients', false, false], ['command phrasings', false, true]]);
  assert.ok(v.notes.some(n => /1 of 3 batches did not come back/.test(n)) && v.notes.some(n => /password, key or account number/.test(n)));
  assert.ok(/From your 25 newest ChatGPT chats \(of 120\)/.test(v.teach.summary));
  assert.ok(t.drive.meta.f1 && t.drive.meta.f1.trashed, 'the chats file is binned after reading');
  assert.ok(!t.tabs.Memory, 'nothing saved before approve');
  t.ctx.cueApprove(out.request_id, { skip: ['F2'], bodies: { F3: 'changed' } });
  deq(t.tabs.Memory.rows.slice(1).map(r => [r[1], r[2], r[3]]), [['rules', 'Kiko wants costing per requirement, not per item.', true]]);
  deq(t.tabs['Routing examples'].rows.slice(1).map(r => r.slice(1)), [['quote this for me', 'intake']]);
  assert.throws(() => sandbox().ctx.cueLearnChats({ chats: [] }), /no conversations/);
});

test('TC11 My rules: lists Memory newest first (learned rules show at once); Kiko adds, edits, switches off and deletes; a moved row is never changed', () => {
  const t = sandbox({ props: { CUE_MEMORY_SEEDED: '' } });
  let v = t.ctx.cueMyRules();
  deq([v.rows.length, v.rows[0].row, v.rows[0].on, v.rows[0].topic, v.rows[0].from], [4, 5, true, 'rules', 'seed']);
  t.ctx.cueLearnNow_('Cost per requirement unless Kiko asks for item level.', '');
  v = t.ctx.cueMyRules(); deq([v.rows.length, v.rows[0].text, v.rows[0].from], [5, 'Cost per requirement unless Kiko asks for item level.', 'chat']);
  v = t.ctx.cueMyRuleSave({ add: '  RFQs   never go out from info@. ' });
  deq([v.rows[0].text, v.rows[0].from, v.rows[0].always, v.rows[0].on], ['RFQs never go out from info@.', 'Kiko', true, true]);
  assert.ok(/never go out from info@/.test(t.ctx.cueTeachFor_('anything')), 'used from the next call');
  assert.throws(() => t.ctx.cueMyRuleSave({ add: 'rfqs never go out from INFO@.' }), /already in the list/);
  assert.throws(() => t.ctx.cueMyRuleSave({ add: 'short' }), /few words/);
  const r = v.rows[0];
  v = t.ctx.cueMyRuleSave({ row: r.row, was: r.text, text: 'RFQs and CEs never go out from info@.' });
  deq(t.tabs.Memory.rows[r.row - 1][2], 'RFQs and CEs never go out from info@.');
  v = t.ctx.cueMyRuleSave({ row: r.row, was: 'RFQs and CEs never go out from info@.', on: false });
  deq(t.tabs.Memory.rows[r.row - 1][0], false); assert.ok(!/info@/.test(t.ctx.cueTeachFor_('anything')), 'switched off is not used');
  assert.throws(() => t.ctx.cueMyRuleSave({ row: r.row, was: 'something else', del: true }), /changed since this list loaded/);
  deq(t.tabs.Memory.rows.length, 7);
  v = t.ctx.cueMyRuleSave({ row: 2, was: t.tabs.Memory.rows[1][2], del: true });
  deq([t.tabs.Memory.rows.length, v.rows.length, v.rows[v.rows.length - 1].row], [6, 5, 2]);
});
