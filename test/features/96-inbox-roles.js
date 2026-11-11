// Part of test/cue.test.js. Feature: team inbox role chats and decision routing (src/CueInboxRoles.gs, src/CueInbox.gs).
// Kiko 11 Nov 2026: roles are chats (Tech Lead = BSE Apps & Systems, Account Manager = ChatGPT Account Manager, PO = Cue PO,
// Charter PO, Canvas PO, Chase PO, and QA); run inside Cue on the Claude API (answer A); D3 to D5 routing; Tech Lead approves
// Google Drive access only. AI is the harness mock; nothing calls the Canvas bridge.
const roleBox = (o = {}) => { const t = inboxBox(o); t.ctx.cueInboxSetupRoles(); return t; };
const chatByLabel = (t, label) => inboxRows(t, 'Inbox Chats').filter(r => r[2] === label)[0][0];
const msgRow = (t, id) => inboxRows(t, 'Inbox Messages').filter(r => r[0] === id)[0];

test('R1 role chats are made once: seven chats with their roles and providers, and a second setup adds none', () => {
  const t = roleBox();
  deq(inboxRows(t, 'Inbox Chats').map(r => [r[2], r[8], r[1]]), [['BSE Apps & Systems', 'Tech Lead', 'Claude API'],
    ['ChatGPT Account Manager', 'Account Manager', 'ChatGPT API'], ['Cue PO', 'PO', 'Claude API'], ['Charter PO', 'PO', 'Claude API'],
    ['Canvas PO', 'PO', 'Claude API'], ['Chase PO', 'PO', 'Claude API'], ['QA', 'QA', 'Claude API']]);
  deq(inboxJson(t.ctx.cueInboxSetupRoles()), { added: 0 });
  deq(inboxJson(t.ctx.cueInboxList()).chats.filter(c => c.role).length, 7);
});

test('R2 a Confirm goes to the Tech Lead; its Approve is final, recorded with who and why, one AI call, no Canvas call', () => {
  const t = roleBox({ inboxDecide: { decision: 'Approve', reason: 'Small change, in scope.' } });
  const r = inboxJson(t.ctx.cueInboxSend(chatByLabel(t, 'Canvas PO'), 'Confirm', 'Rename the Gate Pass button?'));
  deq([r.status, r.decision, r.by], ['Recorded', 'Approved', 'BSE Apps & Systems']);
  deq(t.log.claude.length, 1); deq(t.log.gpt.length, 0); deq(t.log.bridge.length, 0);
  assert.ok(/Tech Lead/.test(t.log.claude[0].system) && /Rename the Gate Pass button/.test(t.log.claude[0].messages[0].content));
  const d = inboxRows(t, 'Inbox Decisions')[0];
  deq([d[2], d[4], d[5], d[6]], ['Approved', 'Small change, in scope.', 'BSE Apps & Systems (Tech Lead)', 'Confirm']);
  deq(msgRow(t, r.message_id).slice(13, 15), ['BSE Apps & Systems (Tech Lead)', 'Small change, in scope.']);
});

test('R3 Tech Lead escalates: the Account Manager (ChatGPT) decides, and its Reject is final', () => {
  const t = roleBox({ inboxDecide: { decision: 'Escalate', reason: 'Touches client money.' }, gpt: { inbox_decision: { decision: 'Reject', reason: 'Not in the client budget.' } } });
  const r = inboxJson(t.ctx.cueInboxSend(chatByLabel(t, 'Cue PO'), 'Confirm', 'Add a paid map layer?'));
  deq([r.status, r.decision, r.by], ['Recorded', 'Rejected', 'ChatGPT Account Manager']);
  deq([t.log.claude.length, t.log.gpt.length], [1, 1]);
  assert.ok(/Account Manager/.test(t.log.gpt[0].instructions));
  deq(inboxRows(t, 'Inbox Decisions')[0][5], 'ChatGPT Account Manager (Account Manager)');
});

test('R4 both escalate: the message is Contested for Kiko with both reasons, no decision row; Kiko then decides', () => {
  const t = roleBox({ inboxDecide: { decision: 'Escalate', reason: 'Needs Kiko.' }, gpt: { inbox_decision: { decision: 'Escalate', reason: 'Cannot decide.' } } });
  const r = inboxJson(t.ctx.cueInboxSend(chatByLabel(t, 'QA'), 'Confirm', 'Ship with one known bug?'));
  deq(r.status, 'Contested');
  const m = msgRow(t, r.message_id);
  assert.ok(/BSE Apps & Systems escalated: Needs Kiko/.test(m[14]) && /ChatGPT Account Manager escalated: Cannot decide/.test(m[14]), m[14]);
  deq(inboxRows(t, 'Inbox Decisions').length, 0);
  deq(inboxJson(t.ctx.cueInboxDecide(r.message_id, 'Approve', '')).decision, 'Approved');
  assert.ok(/^Kiko/.test(inboxRows(t, 'Inbox Decisions')[0][5]));
});

test('R5 every access request, Google Drive or another tool, goes to the Tech Lead; a tool must be picked (Kiko 11 Nov 2026: "do not include me in any step")', () => {
  const t = roleBox({ inboxDecide: { decision: 'Approve', reason: 'Project folder only.' } });
  const c = chatByLabel(t, 'Chase PO');
  deq(inboxJson(t.ctx.cueInboxSend(c, 'Request access', 'Drive folder for the Acme project', 'Google Drive')).decision, 'Approved');
  deq(inboxJson(t.ctx.cueInboxSend(c, 'Request access', 'Canvas admin for Jo', 'Other tool')).decision, 'Approved');
  deq(t.log.claude.length, 2);
  assert.throws(() => t.ctx.cueInboxSend(c, 'Request access', 'x'), /Pick the tool/);
});

test('R6 the Tech Lead escalating an access request sends it to the Account Manager, the final decider: its schema has no Escalate', () => {
  const t = roleBox({ inboxDecide: { decision: 'Escalate', reason: 'Personal files inside.' }, gpt: { inbox_decision: { decision: 'Reject', reason: 'HR data.' } } });
  const r = inboxJson(t.ctx.cueInboxSend(chatByLabel(t, 'Cue PO'), 'Request access', 'Drive access to HR folder', 'Google Drive'));
  deq([r.status, r.decision, r.by], ['Recorded', 'Rejected', 'ChatGPT Account Manager']);
  deq(t.log.gpt[0].text.format.schema.properties.decision.enum, ['Approve', 'Reject']);
  assert.ok(/final decider/.test(t.log.gpt[0].instructions));
});

test('R7 a role chat that fails to answer leaves the message Waiting with the reason, and Kiko can still decide', () => {
  const t = roleBox({ fail: { inboxDecide: () => ({ getResponseCode: () => 400, getContentText: () => JSON.stringify({ error: { type: 'invalid_request_error', message: 'bad' } }) }) } });
  const r = inboxJson(t.ctx.cueInboxSend(chatByLabel(t, 'Cue PO'), 'Confirm', 'OK?'));
  deq(r.status, 'Waiting');
  assert.ok(/BSE Apps & Systems did not answer/.test(msgRow(t, r.message_id)[14]));
  deq(inboxJson(t.ctx.cueInboxDecide(r.message_id, 'Reject', '')).decision, 'Rejected');
});

test('R8 with no Tech Lead chat (none set up or retired), a Confirm waits for Kiko as before and no AI is called', () => {
  const t = inboxBox();
  const c = inboxChat(t, 'ChatGPT API', 'Ops');
  deq(inboxJson(t.ctx.cueInboxSend(c, 'Confirm', 'Go?')).status, 'New');
  deq([t.log.claude.length, t.log.gpt.length], [0, 0]);
});

test('R9 a Question to a Claude API role chat is answered by one Claude call with its role and recent answers', () => {
  const t = roleBox({ inboxReply: { reply: 'Test the save path first.' } });
  const c = chatByLabel(t, 'QA');
  deq(inboxJson(t.ctx.cueInboxSend(c, 'Question', 'What do I test?')).reply, 'Test the save path first.');
  const n0 = t.ctx.cueNow_(); t.ctx.cueNow_ = () => n0 + 4 * 60 * 1000;   // past the 3-minute pause
  inboxJson(t.ctx.cueInboxSend(c, 'Question', 'And then?'));
  assert.ok(/Your role: QA/.test(t.log.claude[1].system));
  assert.ok(/Q: What do I test\?\nA: Test the save path first\./.test(t.log.claude[1].messages[0].content));
  deq(msgRow(t, inboxRows(t, 'Inbox Messages')[0][0])[9], 'Claude API');
});

test('R10 the countdown sweep answers a queued Question in a Claude API chat', () => {
  const t = roleBox({ inboxReply: { reply: 'Yes.' } });
  t.ctx.cueSheet_('Inbox Queue');
  const q = inboxJson(t.ctx.cueInboxQueue(chatByLabel(t, 'Canvas PO'), 'Is V526 ready?'));
  t.ctx.cueNow_ = () => Date.parse(q.send_at) + 1000;
  t.ctx.cueInboxSweep_();
  deq(msgRow(t, q.message_id)[6], 'Replied');
});

test('R11 setup and every routed call are owner only; role instructions name Kiko\'s Drive-only rule', () => {
  const o = inboxBox({ viewer: 'other@example.com' });
  assert.throws(() => o.ctx.cueInboxSetupRoles(), /private to its owner/);
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'CueInboxRoles.gs'), 'utf8');
  assert.ok(/Google Drive access only/.test(src));
  assert.ok(!/cueBridge/.test(src), 'no Canvas call in role routing');
});

test('R12 each PO chat is told its own name, so Cue PO and Charter PO get different prompts (Codex on PR #366)', () => {
  const t = roleBox({ inboxReply: { reply: 'ok' } });
  t.ctx.cueInboxSend(chatByLabel(t, 'Cue PO'), 'Question', 'What is next?');
  t.ctx.cueInboxSend(chatByLabel(t, 'Charter PO'), 'Question', 'What is next?');
  assert.ok(/Your chat name: Cue PO\./.test(t.log.claude[0].system) && /Your chat name: Charter PO\./.test(t.log.claude[1].system));
  const g = roleBox({ inboxDecide: { decision: 'Escalate', reason: 'x' }, gpt: { inbox_decision: { decision: 'Approve', reason: 'ok' } } });
  g.ctx.cueInboxSend(chatByLabel(g, 'QA'), 'Confirm', 'Go?');
  assert.ok(/Your chat name: ChatGPT Account Manager\./.test(g.log.gpt[0].instructions));
});

test('R13 a decision Kiko makes while a role call is running is kept, never overwritten (Codex on PR #366)', () => {
  let t;
  t = roleBox({ inboxDecide: () => { const id = inboxRows(t, 'Inbox Messages').slice(-1)[0][0]; t.ctx.cueInboxDecide(id, 'Reject', ''); return { decision: 'Approve', reason: 'late' }; } });
  const r = inboxJson(t.ctx.cueInboxSend(chatByLabel(t, 'Cue PO'), 'Confirm', 'Go?'));
  deq(r.decision, 'Rejected');
  deq(inboxRows(t, 'Inbox Decisions').length, 1);
  assert.ok(/^Kiko/.test(inboxRows(t, 'Inbox Decisions')[0][5]));
});

test('R18 a hidden Cue tab stops refreshing and refreshes once when shown (Kiko 11 Nov 2026, "too many scripts running", answer A)', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexThreads.html'), 'utf8');
  assert.ok(/function schedule\(\) \{ clearTimeout\(polling\); polling = null; if \(document\.hidden\) return; polling = setTimeout\(refresh, busy\(\) \? 2000 : 20000\); \}/.test(html));
  assert.ok(/addEventListener\('visibilitychange', function \(\) \{ if \(!document\.hidden && !polling\) refresh\(\); \}\)/.test(html));
});
