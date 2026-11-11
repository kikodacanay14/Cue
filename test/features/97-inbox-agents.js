// Part of test/cue.test.js. Feature: agents use the team inbox through the Cue sheet's Inbox Requests tab (src/CueInboxAgents.gs).
// Kiko 11 Nov 2026: "the goal is for things to run without me". No new web door: cueResume sends the rows as the script owner.
const agentBox = (o = {}) => { const t = inboxBox(o); t.ctx.cueSetupRoles = null; t.ctx.cueInboxSetupRoles(); t.ctx.cueSheet_('Inbox Requests'); return t; };
const reqRow = (t, i) => inboxRows(t, 'Inbox Requests')[i];

test('A1 an agent row is sent like the page would: Confirm routed to the Tech Lead, row marked Sent with the message ID', () => {
  const t = agentBox({ inboxDecide: { decision: 'Approve', reason: 'Safe.' } });
  t.tabs['Inbox Requests'].appendRow(['R1', 'Canvas PO', 'Confirm', '', 'Rename the button?', 'canvas-session', '', '', '', '']);
  deq(inboxJson(t.ctx.cueInboxIntake_()), { sent: 1 });
  const r = reqRow(t, 0);
  deq([r[7], /^M-/.test(r[8]), r[9]], ['Sent', true, 'Recorded Approved']);
  const m = inboxRows(t, 'Inbox Messages').filter(x => x[0] === r[8])[0];
  deq([m[3], m[4], m[6], m[10], m[13]], ['agent: canvas-session', 'Confirm', 'Recorded', 'Approved', 'BSE Apps & Systems (Tech Lead)']);
});

test('A2 a Question row gets the role chat answer; chat names match without case', () => {
  const t = agentBox({ inboxReply: { reply: 'Test the save path.' } });
  t.tabs['Inbox Requests'].appendRow(['R2', 'qa', 'Question', '', 'What do I test?', 'cue-session', '', '', '', '']);
  t.ctx.cueInboxIntake_();
  const m = inboxRows(t, 'Inbox Messages').filter(x => x[0] === reqRow(t, 0)[8])[0];
  deq([m[6], m[7]], ['Replied', 'Test the save path.']);
});

test('A3 unknown chat, bad kind and a missing tool are refused with the reason; nothing is sent and no AI is called', () => {
  const t = agentBox();
  t.tabs['Inbox Requests'].appendRow(['R3', 'Nobody', 'Question', '', 'hi', 'x', '', '', '', '']);
  t.tabs['Inbox Requests'].appendRow(['R4', 'QA', 'Order', '', 'hi', 'x', '', '', '', '']);
  t.tabs['Inbox Requests'].appendRow(['R5', 'QA', 'Request access', '', 'hi', 'x', '', '', '', '']);
  t.ctx.cueInboxIntake_();
  deq([0, 1, 2].map(i => reqRow(t, i)[7]), ['Refused', 'Refused', 'Refused']);
  assert.ok(/No active inbox chat named "Nobody"/.test(reqRow(t, 0)[9]) && /Kind must be/.test(reqRow(t, 1)[9]) && /Pick the tool/.test(reqRow(t, 2)[9]));
  deq([inboxRows(t, 'Inbox Messages').length, t.log.claude.length, t.log.gpt.length], [0, 0, 0]);
});

test('A4 the 3-minute pause applies to agents: the second Question stays New and goes on a later run; done rows are never sent twice', () => {
  const t = agentBox({ inboxReply: { reply: 'ok' } });
  t.tabs['Inbox Requests'].appendRow(['R6', 'QA', 'Question', '', 'one', 'x', '', '', '', '']);
  t.tabs['Inbox Requests'].appendRow(['R7', 'QA', 'Question', '', 'two', 'x', '', '', '', '']);
  t.ctx.cueInboxIntake_();
  deq([reqRow(t, 0)[7], reqRow(t, 1)[7]], ['Sent', 'New']);
  assert.ok(/3-minute pause/.test(reqRow(t, 1)[9]));
  const n0 = t.ctx.cueNow_(); t.ctx.cueNow_ = () => n0 + 4 * 60 * 1000;
  t.ctx.cueInboxIntake_();
  deq([reqRow(t, 0)[7], reqRow(t, 1)[7]], ['Sent', 'Sent']);
  deq(t.log.claude.length, 2);
});

test('A5 at most 5 rows per run; cueResume runs the intake; no new web route or doPost for agents', () => {
  const t = agentBox();
  for (let i = 0; i < 7; i++) t.tabs['Inbox Requests'].appendRow(['R' + i, 'Nobody', 'Question', '', 'x', 'x', '', '', '', '']);
  t.ctx.cueInboxIntake_();
  deq(inboxRows(t, 'Inbox Requests').filter(r => r[7] === 'Refused').length, 5);
  const cue = fs.readFileSync(path.join(__dirname, '..', 'src', 'Cue.gs'), 'utf8');
  assert.ok(/try \{ cueInboxIntake_\(\); \}/.test(cue));
  const agents = fs.readFileSync(path.join(__dirname, '..', 'src', 'CueInboxAgents.gs'), 'utf8');
  assert.ok(!/function doPost|function doGet|cueBridge/.test(agents));
});

test('A6 a request is claimed (State Sending, written) before any AI call, so a second overlapping run sends nothing twice (Codex on PR #375)', () => {
  let t, during = null;
  t = agentBox({ inboxDecide: () => { during = reqRow(t, 0)[7]; deq(inboxJson(t.ctx.cueInboxIntake_()), { sent: 0 }); return { decision: 'Approve', reason: 'ok' }; } });
  t.tabs['Inbox Requests'].appendRow(['R1', 'QA', 'Confirm', '', 'Go?', 'x', '', '', '', '']);
  t.ctx.cueInboxIntake_();
  deq(during, 'Sending');
  deq([reqRow(t, 0)[7], inboxRows(t, 'Inbox Messages').length, inboxRows(t, 'Inbox Decisions').length], ['Sent', 1, 1]);
});

test('A7 two chats with the same name are refused with their Chat IDs; a Chat ID picks the exact chat (Codex on PR #375)', () => {
  const t = agentBox({ inboxReply: { reply: 'ok' } });
  const a = inboxChat(t, 'Claude API', 'Ops'), b = inboxChat(t, 'Claude API', 'ops');
  t.tabs['Inbox Requests'].appendRow(['R1', 'Ops', 'Question', '', 'hi', 'x', '', '', '', '']);
  t.tabs['Inbox Requests'].appendRow(['R2', b, 'Question', '', 'hi', 'x', '', '', '', '']);
  t.ctx.cueInboxIntake_();
  deq(reqRow(t, 0)[7], 'Refused');
  assert.ok(reqRow(t, 0)[9].indexOf(a) >= 0 && reqRow(t, 0)[9].indexOf(b) >= 0, reqRow(t, 0)[9]);
  deq(reqRow(t, 1)[7], 'Sent');
  deq(inboxRows(t, 'Inbox Messages').filter(m => m[0] === reqRow(t, 1)[8])[0][1], b);
});

test('A8 a run that dies on one request strands only that row; later rows stay New and go on the next run (Codex on PR #376)', () => {
  const t = agentBox({ inboxDecide: { decision: 'Approve', reason: 'ok' } });
  // A killed run: the write after the first send fails (uncatchable in real Apps Script, so here it throws out of the intake).
  const real = t.ctx.cueInboxSetRow_; let writes = 0;
  t.ctx.cueInboxSetRow_ = function (tab) { if (tab === 'Inbox Requests' && ++writes === 2) throw new Error('script killed'); return real.apply(null, arguments); };
  t.tabs['Inbox Requests'].appendRow(['R1', 'QA', 'Confirm', '', 'one', 'x', '', '', '', '']);
  t.tabs['Inbox Requests'].appendRow(['R2', 'QA', 'Confirm', '', 'two', 'x', '', '', '', '']);
  assert.throws(() => t.ctx.cueInboxIntake_(), /script killed/);
  deq([reqRow(t, 0)[7], reqRow(t, 1)[7]], ['Sending', '']);
  t.ctx.cueInboxSetRow_ = real;
  t.ctx.cueInboxIntake_();
  deq([reqRow(t, 0)[7], reqRow(t, 1)[7]], ['Sending', 'Sent']);
});

const kikoRows = t => inboxRows(t, 'For Kiko');
const later = (t, ms) => { const n0 = t.ctx.cueNow_(); t.ctx.cueNow_ = () => n0 + ms; };

test('K1 a Contested Confirm and an Other-tool request land on the For Kiko tab once, after a minute; settled ones do not', () => {
  const t = agentBox({ inboxDecide: { decision: 'Escalate', reason: 'Needs Kiko.' }, gpt: { inbox_decision: { decision: 'Escalate', reason: 'Cannot decide.' } } });
  t.ctx.cueSheet_('For Kiko');
  const c = chatByLabel(t, 'QA');
  t.ctx.cueInboxSend(c, 'Confirm', 'Ship with one known bug?');
  t.ctx.cueInboxSend(c, 'Request access', 'Canvas admin for Jo', 'Other tool');
  t.ctx.cueForKikoSync_();
  deq(kikoRows(t).length, 0);   // younger than a minute
  later(t, 2 * 60 * 1000);
  t.ctx.cueForKikoSync_(); t.ctx.cueForKikoSync_();
  deq(kikoRows(t).map(r => [r[2], r[3], r[8]]), [['QA', 'Confirm', 'Open'], ['QA', 'Request access', 'Open']]);
  assert.ok(/could not decide/.test(kikoRows(t)[0][5]) && /Other tool/.test(kikoRows(t)[1][5]));
});

test('K2 Kiko types Approve or Reject in Your answer: recorded as his decision, row Done; other text asks again', () => {
  const t = agentBox();
  t.ctx.cueSheet_('For Kiko');
  const c = chatByLabel(t, 'QA');
  const a = inboxJson(t.ctx.cueInboxSend(c, 'Request access', 'Canvas admin for Jo', 'Other tool'));
  const b = inboxJson(t.ctx.cueInboxSend(c, 'Request access', 'Sheets for Ana', 'Other tool'));
  later(t, 2 * 60 * 1000); t.ctx.cueForKikoSync_();
  t.tabs['For Kiko'].rows[1][7] = 'approve'; t.tabs['For Kiko'].rows[2][7] = 'maybe later';
  t.ctx.cueForKikoSync_();
  deq([kikoRows(t)[0][8], kikoRows(t)[1][8]], ['Done', 'Open']);
  assert.ok(/Type Approve or Reject/.test(kikoRows(t)[1][9]));
  const m = inboxRows(t, 'Inbox Messages').filter(x => x[0] === a.message_id)[0];
  deq([m[6], m[10], m[13]], ['Recorded', 'Approved', 'Kiko (For Kiko tab)']);
  deq(inboxRows(t, 'Inbox Decisions').length, 1);
});

test('K3 an item decided on the Inbox page turns Done; an agent row without a Message ID turns Answered when Kiko writes', () => {
  const t = agentBox();
  t.ctx.cueSheet_('For Kiko');
  const r = inboxJson(t.ctx.cueInboxSend(chatByLabel(t, 'QA'), 'Request access', 'x', 'Other tool'));
  later(t, 2 * 60 * 1000); t.ctx.cueForKikoSync_();
  t.ctx.cueInboxDecide(r.message_id, 'Reject', '');
  t.tabs['For Kiko'].appendRow(['K-agent', '', 'Canvas PO', 'Question', 'Which client logo goes on the banner?', 'Only Kiko knows', '', '', 'Open', '', 'agent: canvas']);
  t.ctx.cueForKikoSync_();
  deq(kikoRows(t)[0][8], 'Done');
  deq(kikoRows(t)[1][8], 'Open');
  t.tabs['For Kiko'].rows[2][7] = 'Use the blue one';
  t.ctx.cueForKikoSync_();
  deq(kikoRows(t)[1][8], 'Answered');
});

test('K4 only a whole Approve or Reject counts: "Approve? not yet" asks again and records nothing (Codex on PR #376)', () => {
  const t = agentBox();
  t.ctx.cueSheet_('For Kiko');
  const r = inboxJson(t.ctx.cueInboxSend(chatByLabel(t, 'QA'), 'Request access', 'x', 'Other tool'));
  later(t, 2 * 60 * 1000); t.ctx.cueForKikoSync_();
  t.tabs['For Kiko'].rows[1][7] = 'Approve? Not yet, wait for my confirmation';
  t.ctx.cueForKikoSync_();
  deq(kikoRows(t)[0][8], 'Open');
  deq(inboxRows(t, 'Inbox Decisions').length, 0);
  t.tabs['For Kiko'].rows[1][7] = 'Reject';
  t.ctx.cueForKikoSync_();
  deq([kikoRows(t)[0][8], inboxRows(t, 'Inbox Messages').filter(m => m[0] === r.message_id)[0][10]], ['Done', 'Rejected']);
});

test('K5 a decision made on the page while the sheet answer is processed is kept, not overwritten (Codex on PR #376)', () => {
  const t = agentBox();
  t.ctx.cueSheet_('For Kiko');
  const r = inboxJson(t.ctx.cueInboxSend(chatByLabel(t, 'QA'), 'Request access', 'x', 'Other tool'));
  later(t, 2 * 60 * 1000); t.ctx.cueForKikoSync_();
  t.tabs['For Kiko'].rows[1][7] = 'Approve';
  t.ctx.cueInboxDecide(r.message_id, 'Reject', '');   // decided on the page after Kiko typed Approve in the sheet
  t.ctx.cueForKikoSync_();
  deq(inboxRows(t, 'Inbox Decisions').map(d => d[2]), ['Rejected']);
  deq(kikoRows(t)[0][8], 'Done');
});

test('A9 a paused Question goes back to New at once, so a run that dies afterwards does not strand it (Codex on PR #376)', () => {
  const t = agentBox({ inboxReply: { reply: 'ok' } });
  t.tabs['Inbox Requests'].appendRow(['R1', 'QA', 'Question', '', 'one', 'x', '', '', '', '']);
  t.ctx.cueInboxIntake_();
  t.tabs['Inbox Requests'].appendRow(['R2', 'QA', 'Question', '', 'two', 'x', '', '', '', '']);
  t.tabs['Inbox Requests'].appendRow(['R3', 'QA', 'Confirm', '', 'go?', 'x', '', '', '', '']);
  const real = t.ctx.cueInboxSetRow_; let writes = 0;
  t.ctx.cueInboxSetRow_ = function (tab) { if (tab === 'Inbox Requests' && ++writes === 4) throw new Error('script killed'); return real.apply(null, arguments); };
  assert.throws(() => t.ctx.cueInboxIntake_(), /script killed/);
  t.ctx.cueInboxSetRow_ = real;
  deq(reqRow(t, 1)[7], 'New');
  later(t, 4 * 60 * 1000); t.ctx.cueInboxIntake_();
  deq(reqRow(t, 1)[7], 'Sent');
});

test('K6 the sync writes only State and Note: an answer typed while the row is processed is kept (Codex on PR #376)', () => {
  const t = agentBox();
  t.ctx.cueSheet_('For Kiko');
  t.tabs['For Kiko'].appendRow(['K-a', '', 'Canvas PO', 'Question', 'Banner color?', 'Only Kiko knows', '', 'Blue', 'Open', '', 'agent: canvas']);
  t.tabs['For Kiko'].appendRow(['K-b', '', 'Canvas PO', 'Question', 'Logo?', 'Only Kiko knows', '', 'Old', 'Open', '', 'agent: canvas']);
  const real = t.ctx.cueForKikoMark_; let once = true;
  t.ctx.cueForKikoMark_ = function () { if (once) { once = false; t.tabs['For Kiko'].rows[2][7] = 'Use red instead'; } return real.apply(null, arguments); };
  t.ctx.cueForKikoSync_();
  deq(kikoRows(t).map(r => [r[7], r[8]]), [['Blue', 'Answered'], ['Use red instead', 'Answered']]);
});

test('K7 the For Kiko sync runs under one lock, so overlapping runs cannot add an item twice (Codex on PR #376)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'CueInboxAgents.gs'), 'utf8');
  assert.ok(/function cueForKikoSync_\(\) \{[\s\S]{0,300}return cueLocked_\(\(\) => cueForKikoSyncLocked_\(\)\);/.test(src));
});
