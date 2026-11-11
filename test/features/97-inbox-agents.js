// Part of test/cue.test.js. Feature: agents use the team inbox through the Cue sheet's Team Requests tab (src/CueInboxAgents.gs).
// Kiko 11 Nov 2026: "the goal is for things to run without me". No new web door: cueResume sends the rows as the script owner.
const agentBox = (o = {}) => { const t = inboxBox(o); t.ctx.cueSetupRoles = null; t.ctx.cueInboxSetupRoles(); t.ctx.cueSheet_('Team Requests'); return t; };
const reqRow = (t, i) => inboxRows(t, 'Team Requests')[i];

test('A1 an agent row is sent like the page would: Confirm routed to the Tech Lead, row marked Sent with the message ID', () => {
  const t = agentBox({ inboxDecide: { decision: 'Approve', reason: 'Safe.' } });
  t.tabs['Team Requests'].appendRow(['R1', 'Canvas PO', 'Confirm', '', 'Rename the button?', 'canvas-session', '', '', '', '']);
  deq(inboxJson(t.ctx.cueInboxIntake_()), { sent: 1 });
  const r = reqRow(t, 0);
  deq([r[7], /^M-/.test(r[8]), r[9], r[10], r[11]], ['Sent', true, 'Recorded', 'Approved: Safe.', 'BSE Apps & Systems (Tech Lead)']);
  const m = inboxRows(t, 'Inbox Messages').filter(x => x[0] === r[8])[0];
  deq([m[3], m[4], m[6], m[10], m[13]], ['agent: canvas-session', 'Confirm', 'Recorded', 'Approved', 'BSE Apps & Systems (Tech Lead)']);
});

test('A2 a Question row gets the role chat answer; chat names match without case', () => {
  const t = agentBox({ inboxReply: { reply: 'Test the save path.' } });
  t.tabs['Team Requests'].appendRow(['R2', 'qa', 'Question', '', 'What do I test?', 'cue-session', '', '', '', '']);
  t.ctx.cueInboxIntake_();
  const m = inboxRows(t, 'Inbox Messages').filter(x => x[0] === reqRow(t, 0)[8])[0];
  deq([m[6], m[7]], ['Replied', 'Test the save path.']);
  deq([reqRow(t, 0)[10], reqRow(t, 0)[11]], ['Test the save path.', 'QA']);
});

test('A3 unknown chat, bad kind and a missing tool are refused with the reason; nothing is sent and no AI is called', () => {
  const t = agentBox();
  t.tabs['Team Requests'].appendRow(['R3', 'Nobody', 'Question', '', 'hi', 'x', '', '', '', '']);
  t.tabs['Team Requests'].appendRow(['R4', 'QA', 'Order', '', 'hi', 'x', '', '', '', '']);
  t.tabs['Team Requests'].appendRow(['R5', 'QA', 'Request access', '', 'hi', 'x', '', '', '', '']);
  t.ctx.cueInboxIntake_();
  deq([0, 1, 2].map(i => reqRow(t, i)[7]), ['Refused', 'Refused', 'Refused']);
  assert.ok(/No active inbox chat named "Nobody"/.test(reqRow(t, 0)[9]) && /Kind must be/.test(reqRow(t, 1)[9]) && /Pick the tool/.test(reqRow(t, 2)[9]));
  deq([inboxRows(t, 'Inbox Messages').length, t.log.claude.length, t.log.gpt.length], [0, 0, 0]);
});

test('A4 the 3-minute pause applies to agents: the second Question stays New and goes on a later run; done rows are never sent twice', () => {
  const t = agentBox({ inboxReply: { reply: 'ok' } });
  t.tabs['Team Requests'].appendRow(['R6', 'QA', 'Question', '', 'one', 'x', '', '', '', '']);
  t.tabs['Team Requests'].appendRow(['R7', 'QA', 'Question', '', 'two', 'x', '', '', '', '']);
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
  for (let i = 0; i < 7; i++) t.tabs['Team Requests'].appendRow(['R' + i, 'Nobody', 'Question', '', 'x', 'x', '', '', '', '']);
  t.ctx.cueInboxIntake_();
  deq(inboxRows(t, 'Team Requests').filter(r => r[7] === 'Refused').length, 5);
  const cue = fs.readFileSync(path.join(__dirname, '..', 'src', 'Cue.gs'), 'utf8');
  assert.ok(/try \{ cueInboxIntake_\(\); \}/.test(cue));
  const agents = fs.readFileSync(path.join(__dirname, '..', 'src', 'CueInboxAgents.gs'), 'utf8');
  assert.ok(!/function doPost|function doGet|cueBridge/.test(agents));
});

test('A6 a request is claimed (State Sending, written) before any AI call, so a second overlapping run sends nothing twice (Codex on PR #375)', () => {
  let t, during = null;
  t = agentBox({ inboxDecide: () => { during = reqRow(t, 0)[7]; deq(inboxJson(t.ctx.cueInboxIntake_()), { sent: 0 }); return { decision: 'Approve', reason: 'ok' }; } });
  t.tabs['Team Requests'].appendRow(['R1', 'QA', 'Confirm', '', 'Go?', 'x', '', '', '', '']);
  t.ctx.cueInboxIntake_();
  deq(during, 'Sending');
  deq([reqRow(t, 0)[7], inboxRows(t, 'Inbox Messages').length, inboxRows(t, 'Inbox Decisions').length], ['Sent', 1, 1]);
});

test('A7 two chats with the same name are refused with their Chat IDs; a Chat ID picks the exact chat (Codex on PR #375)', () => {
  const t = agentBox({ inboxReply: { reply: 'ok' } });
  const a = inboxChat(t, 'Claude API', 'Ops'), b = inboxChat(t, 'Claude API', 'ops');
  t.tabs['Team Requests'].appendRow(['R1', 'Ops', 'Question', '', 'hi', 'x', '', '', '', '']);
  t.tabs['Team Requests'].appendRow(['R2', b, 'Question', '', 'hi', 'x', '', '', '', '']);
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
  t.ctx.cueInboxSetRow_ = function (tab) { if (tab === 'Team Requests' && ++writes === 2) throw new Error('script killed'); return real.apply(null, arguments); };
  t.tabs['Team Requests'].appendRow(['R1', 'QA', 'Confirm', '', 'one', 'x', '', '', '', '']);
  t.tabs['Team Requests'].appendRow(['R2', 'QA', 'Confirm', '', 'two', 'x', '', '', '', '']);
  assert.throws(() => t.ctx.cueInboxIntake_(), /script killed/);
  deq([reqRow(t, 0)[7], reqRow(t, 1)[7]], ['Sending', '']);
  t.ctx.cueInboxSetRow_ = real;
  t.ctx.cueInboxIntake_();
  deq([reqRow(t, 0)[7], reqRow(t, 1)[7]], ['Sending', 'Sent']);
});

const kikoRows = t => inboxRows(t, 'For Kiko');
const kikoBox = () => { const t = inboxBox(); t.ctx.cueSheet_('For Kiko'); inboxChat(t, 'ChatGPT API', 'QA'); return t; };   // no Tech Lead chat, so Confirms and access requests stay undecided
const later = (t, ms) => { const n0 = t.ctx.cueNow_(); t.ctx.cueNow_ = () => n0 + ms; };

test('K1 a Contested Confirm and a Contested access request land on the For Kiko tab once, after a minute; settled ones do not', () => {
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
  assert.ok(/could not decide/.test(kikoRows(t)[0][5]) && /could not decide/.test(kikoRows(t)[1][5]));
});

test('K2 Kiko types Approve or Reject in Your answer: recorded as his decision, row Done; other text asks again', () => {
  const t = kikoBox();
  const c = inboxRows(t, 'Inbox Chats')[0][0];
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
  const t = kikoBox();
  const r = inboxJson(t.ctx.cueInboxSend(inboxRows(t, 'Inbox Chats')[0][0], 'Request access', 'x', 'Other tool'));
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
  const t = kikoBox();
  const r = inboxJson(t.ctx.cueInboxSend(inboxRows(t, 'Inbox Chats')[0][0], 'Request access', 'x', 'Other tool'));
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
  const t = kikoBox();
  const r = inboxJson(t.ctx.cueInboxSend(inboxRows(t, 'Inbox Chats')[0][0], 'Request access', 'x', 'Other tool'));
  later(t, 2 * 60 * 1000); t.ctx.cueForKikoSync_();
  t.tabs['For Kiko'].rows[1][7] = 'Approve';
  t.ctx.cueInboxDecide(r.message_id, 'Reject', '');   // decided on the page after Kiko typed Approve in the sheet
  t.ctx.cueForKikoSync_();
  deq(inboxRows(t, 'Inbox Decisions').map(d => d[2]), ['Rejected']);
  deq(kikoRows(t)[0][8], 'Done');
});

test('A9 a paused Question goes back to New at once, so a run that dies afterwards does not strand it (Codex on PR #376)', () => {
  const t = agentBox({ inboxReply: { reply: 'ok' } });
  t.tabs['Team Requests'].appendRow(['R1', 'QA', 'Question', '', 'one', 'x', '', '', '', '']);
  t.ctx.cueInboxIntake_();
  t.tabs['Team Requests'].appendRow(['R2', 'QA', 'Question', '', 'two', 'x', '', '', '', '']);
  t.tabs['Team Requests'].appendRow(['R3', 'QA', 'Confirm', '', 'go?', 'x', '', '', '', '']);
  const real = t.ctx.cueInboxSetRow_; let writes = 0;
  t.ctx.cueInboxSetRow_ = function (tab) { if (tab === 'Team Requests' && ++writes === 4) throw new Error('script killed'); return real.apply(null, arguments); };
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

test('A10 with the Inbox page gone, cueResume syncs project chats once role chats exist; no header button (Kiko 11 Nov 2026)', () => {
  const cue = fs.readFileSync(path.join(__dirname, '..', 'src', 'Cue.gs'), 'utf8');
  assert.ok(/some\(c => c\.v\[8\]\)\) cueInboxSyncProjectsCore_\(false\)/.test(cue));
  const idx = fs.readFileSync(path.join(__dirname, '..', 'src', 'Index.html'), 'utf8') + fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexPages.html'), 'utf8');
  assert.ok(!/inbox-link|view=inbox/.test(idx));
  const t = agentBox(); t.ctx.cueInboxSetupRolesCore_();
  deq(inboxRows(t, 'Inbox Chats').filter(r => r[8]).length, 7);
});

test('A11 the team tabs live in their own spreadsheet "BSE AI Team", made once in Kiko\'s Drive (Kiko 11 Nov 2026: "do it in a new spreadsheet")', () => {
  const t = agentBox();
  deq(t.props.CUE_TEAM_SHEET_ID, 'new');
  const cue = fs.readFileSync(path.join(__dirname, '..', 'src', 'Cue.gs'), 'utf8');
  assert.ok(/const CUE_TEAM_TABS_ = \['Team Requests', 'For Kiko', 'Team Daily', 'Closed'\];/.test(cue) && /SpreadsheetApp\.create\('BSE AI Team'\)/.test(cue));
});

const teamAt = (t, iso) => { t.ctx.cueNow_ = () => Date.parse(iso); };
test('D1 daily jobs run once a day after 08:00 Manila, at most 2 per run, write a Team Daily note and queue requests to other roles', () => {
  const t = agentBox({ teamDaily: b => ({ note: 'Two projects at risk.', requests: /Canvas PO/.test(b.system) ? [{ to: 'BSE Apps & Systems', kind: 'Confirm', message: 'Move Kings Day to Execution?' }, { to: 'Nobody', kind: 'Question', message: 'x' }] : [] }),
    gpt: { team_daily: { note: 'Client risks noted.', requests: [] } } });
  t.ctx.cueSheet_('Team Daily');
  teamAt(t, '2026-11-12T23:30:00Z');   // 07:30 Manila: too early
  deq(t.ctx.cueTeamDaily_(), 0);
  teamAt(t, '2026-11-13T00:30:00Z');   // 08:30 Manila
  deq(t.ctx.cueTeamDaily_(), 2);
  deq(t.ctx.cueTeamDaily_(), 2);
  deq(t.ctx.cueTeamDaily_(), 1);
  deq(t.ctx.cueTeamDaily_(), 0);   // all five done today
  deq(inboxRows(t, 'Team Daily').map(r => r[1]), ['Canvas PO', 'ChatGPT Account Manager', 'Cue PO', 'QA', 'BSE Apps & Systems']);
  const reqs = inboxRows(t, 'Team Requests');
  deq(reqs.map(r => [r[1], r[2], r[5]]), [['BSE Apps & Systems', 'Confirm', 'Canvas PO']]);   // unknown "to" dropped
  deq(t.log.bridge.filter(b => b.action === 'get_project_board').length, 1);   // the board is read once and shared
  assert.ok(t.log.bridge.every(b => b.action === 'get_project_board'), 'only the read-only board');
});

test('D2 the next day the jobs run again; with no role chats nothing runs', () => {
  const t = agentBox();
  t.ctx.cueSheet_('Team Daily');
  teamAt(t, '2026-11-13T00:30:00Z'); for (let i = 0; i < 4; i++) t.ctx.cueTeamDaily_();
  teamAt(t, '2026-11-14T00:30:00Z'); deq(t.ctx.cueTeamDaily_(), 2);
  const bare = inboxBox(); teamAt(bare, '2026-11-13T00:30:00Z'); deq(bare.ctx.cueTeamDaily_(), 0);
});

test('CL1 finished rows move to the Closed tab: Team Requests Sent and Refused, For Kiko Done and Answered; open rows stay (Kiko 11 Nov 2026)', () => {
  const t = agentBox({ inboxReply: { reply: 'Test the save path.' } });
  t.tabs['Team Requests'].appendRow(['R1', 'QA', 'Question', '', 'What do I test?', 'cue-session', '', '', '', '']);
  t.tabs['Team Requests'].appendRow(['R2', 'Nobody', 'Question', '', 'hi', 'x', '', '', '', '']);
  t.ctx.cueInboxIntake_();
  t.tabs['Team Requests'].appendRow(['R3', 'QA', 'Question', '', 'later', 'x', '', 'New', '', '']);
  t.ctx.cueSheet_('For Kiko').appendRow(['K1', '', 'QA', 'Question', 'Pick a date', 'x', '', '0', 'Answered', 'n', 'QA']);
  t.ctx.cueSheet_('For Kiko').appendRow(['K2', '', 'QA', 'Question', 'Still open', 'x', '', '', 'Open', 'n', 'QA']);
  deq(t.ctx.cueTeamClose_(), { moved: 3 });
  deq(inboxRows(t, 'Team Requests').map(r => r[0]), ['R3']);
  deq(inboxRows(t, 'For Kiko').map(r => r[0]), ['K2']);
  const c = inboxRows(t, 'Closed');
  deq(c.map(r => [r[1], r[2], r[7]]), [['Team Requests', 'R1', 'Sent'], ['Team Requests', 'R2', 'Refused'], ['For Kiko', 'K1', 'Answered']]);
  deq([c[0][6], c[2][6]], ['Test the save path. (QA)', '0']);
  assert.ok(/^M-/.test(c[0][10]));
  deq(t.ctx.cueTeamClose_(), { moved: 0 });
});

test('CL2 Team Requests is left alone while a row is Sending, unless that row is older than 30 minutes', () => {
  const t = agentBox();
  const now = t.ctx.cueNow_();
  t.tabs['Team Requests'].appendRow(['R1', 'QA', 'Question', '', 'a', 'x', new Date(now - 60000).toISOString(), 'Sending', '', '']);
  t.tabs['Team Requests'].appendRow(['R2', 'QA', 'Question', '', 'b', 'x', '', 'Refused', '', 'why']);
  deq(t.ctx.cueTeamClose_(), { moved: 0 });
  t.tabs['Team Requests'].rows[1][6] = new Date(now - 31 * 60000).toISOString();
  deq(t.ctx.cueTeamClose_(), { moved: 1 });
  deq(inboxRows(t, 'Team Requests').map(r => r[0]), ['R1']);
});

test('A12 cueResume makes the role chats once, even if the old Inbox page was never opened (Codex on PR #376)', () => {
  const t = inboxBox({ props: { CUE_ROLES_SET: '' } });
  t.ctx.cueResume();
  deq(inboxRows(t, 'Inbox Chats').filter(c => c[8]).length, 7);
  deq(t.props.CUE_ROLES_SET, '1');
});

test('CL3 a Sent request whose message is still undecided stays open; once decided later, the decision is copied onto it and it closes (Codex on PR #376)', () => {
  const t = agentBox();
  const now = t.ctx.cueNow_();
  t.ctx.cueSheet_('Inbox Messages').appendRow(['M-x', 'CH-1', new Date(now).toISOString(), 'agent: x', 'Confirm', 'Ship it?', 'Waiting', '', '', '', '', '', '', '', 'no answer']);
  t.tabs['Team Requests'].appendRow(['R1', 'QA', 'Confirm', '', 'Ship it?', 'x', '', 'Sent', 'M-x', 'Waiting', '', '']);
  deq(t.ctx.cueTeamClose_(), { moved: 0 });
  const m = t.tabs['Inbox Messages'].rows.filter(r => r[0] === 'M-x')[0];
  m[6] = 'Recorded'; m[10] = 'Rejected'; m[13] = 'Kiko (For Kiko tab)'; m[14] = 'Not yet.';
  deq(t.ctx.cueTeamClose_(), { moved: 1 });
  const c = inboxRows(t, 'Closed')[0];
  deq([c[2], c[6]], ['R1', 'Rejected: Not yet. (Kiko (For Kiko tab))']);
});

test('CL4 a daily job is claimed before its AI call, so an overlapping run cannot pick it again (Codex on PR #376)', () => {
  let t = null; const seen = [];
  t = agentBox({ teamDaily: () => { seen.push(String(t.props.CUE_TEAM_DAY || '')); return { note: 'ok', requests: [] }; }, gpt: { team_daily: { note: 'ok', requests: [] } } });
  t.ctx.cueSheet_('Team Daily');
  teamAt(t, '2026-11-13T00:30:00Z');
  t.ctx.cueTeamDaily_();
  assert.ok(seen.length && seen.every(s => /^2026-11-13\|Canvas PO,ChatGPT Account Manager$/.test(s)), seen.join(' / '));
});

test('CL5 the QA and Cue PO job reads the whole last 24 hours of Job Runs, not only the last 500 rows (Codex on PR #376)', () => {
  const t = agentBox();
  const now = Date.parse('2026-11-13T00:30:00Z'), sh = t.ctx.cueSheet_('Job Runs');
  sh.appendRow([new Date(now - 30 * 3600e3).toISOString(), '', 'Old job', 'Failed', 'too old', '']);
  sh.appendRow([new Date(now - 12 * 3600e3).toISOString(), '', 'Sweep', 'Failed', 'quota', '']);
  for (let i = 0; i < 600; i++) sh.appendRow([new Date(now - 11 * 3600e3 + i * 60000).toISOString(), '', 'Sweep', 'OK', '', '']);
  const out = t.ctx.cueTeamContext_('jobs', now);
  assert.ok(/Sweep: failed 1 times; last error: quota/.test(out) && !/Old job/.test(out), out);
});

test('CL6 cueSetup makes the team tabs only in BSE AI Team, never in the Cue sheet (Codex on PR #376)', () => {
  const cue = fs.readFileSync(path.join(__dirname, '..', 'src', 'Cue.gs'), 'utf8');
  assert.ok(/Object\.keys\(CUE_TABS_\)\.forEach\(n => \{ if \(CUE_TEAM_TABS_\.indexOf\(n\) < 0 && !ss\.getSheetByName\(n\)\)/.test(cue));
});
