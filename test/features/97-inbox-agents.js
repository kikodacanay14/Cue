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
