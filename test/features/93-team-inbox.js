// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: team inbox (src/CueInbox.gs, src/Inbox.html).
// Spec: CanvasWorkspace docs/specs/team-inbox.md, design docs/specs/team-inbox-design.md (sections 4, 5, 6, 7, 9), approved by Kiko
// 11 Nov 2026 (decisions 1 b, 2 a, 3 a, 4 a; screens approved 17:29 Manila). Claude.ai pull endpoint (C7) is held: T11 checks it is absent.
// No test reaches a real service: OpenAI is the harness mock, and nothing here calls the Canvas bridge.
const INBOX_DAY = 24 * 60 * 60 * 1000;
const inboxBox = (o = {}) => { const t = sandbox(o); t.ctx.cueSheet_('Inbox Chats'); t.ctx.cueSheet_('Inbox Messages'); t.ctx.cueSheet_('Inbox Decisions'); return t; };
const inboxChat = (t, provider, label) => t.ctx.cueInboxAddChat({ provider, label }).chat_id;
const inboxRows = (t, tab) => t.tabs[tab].rows.slice(1);
const inboxJson = x => JSON.parse(JSON.stringify(x));

test('T1 a Question to a claude.ai chat is saved as New, waits, and calls no AI', () => {
  const t = inboxBox();
  const c = inboxChat(t, 'claude.ai', 'Canvas Ops');
  const r = inboxJson(t.ctx.cueInboxSend(c, 'Question', '  Is the Pay day on Thursday?  '));
  deq(r.status, 'New');
  const row = inboxRows(t, 'Inbox Messages')[0];
  deq([row[1], row[4], row[5], row[6]], [c, 'Question', 'Is the Pay day on Thursday?', 'New']);
  assert.ok(!t.log.gpt || t.log.gpt.length === 0, 'no OpenAI call for a claude.ai chat');
});

test('T2 a Question to a ChatGPT API chat is answered through the Responses API and stored as the reply', () => {
  const t = inboxBox({ gpt: { inbox_reply: { reply: 'Thursday, 22 Oct.' } } });
  const c = inboxChat(t, 'ChatGPT API', 'Supplier quotes');
  const r = inboxJson(t.ctx.cueInboxSend(c, 'Question', 'When is the pay day?'));
  deq([r.status, r.reply], ['Replied', 'Thursday, 22 Oct.']);
  assert.strictEqual(t.log.gpt.length, 1, 'one OpenAI call');
  assert.strictEqual(t.log.gpt[0].store, true, 'store true so the thread continues');
  assert.strictEqual(t.log.gpt[0].text.format.type, 'json_schema');
  const row = inboxRows(t, 'Inbox Messages')[0];
  deq([row[6], row[7], row[9]], ['Replied', 'Thursday, 22 Oct.', 'OpenAI API']);
  assert.ok(t.tabs['AI Runs'].rows.length >= 2, 'the call is logged in AI Runs (header + 1 row)');
});

test('T3 a failed ChatGPT call leaves the message Waiting, after at most two calls (one retry)', () => {
  const t = inboxBox({ fail: { inbox_reply: () => ({ getResponseCode: () => 500, getContentText: () => JSON.stringify({ error: { message: 'boom' } }) }) } });
  const c = inboxChat(t, 'ChatGPT API', 'Old intake chat');
  const r = inboxJson(t.ctx.cueInboxSend(c, 'Question', 'hello'));
  deq(r.status, 'Waiting');
  assert.ok(/boom|GPT|HTTP 500/.test(r.error), r.error);
  assert.ok(t.log.gpt.length <= 2, 'at most two calls, got ' + t.log.gpt.length);
  deq(inboxRows(t, 'Inbox Messages')[0][6], 'Waiting');
});

test('T4 a message over 4,000 characters is refused, not cut, and no row is written', () => {
  const t = inboxBox();
  const c = inboxChat(t, 'claude.ai', 'Payments check');
  assert.throws(() => t.ctx.cueInboxSend(c, 'Question', 'x'.repeat(4001)), /over 4000 characters/);
  assert.strictEqual(inboxRows(t, 'Inbox Messages').length, 0);
  inboxJson(t.ctx.cueInboxSend(c, 'Question', 'x'.repeat(4000)));   // exactly 4,000 is allowed
  assert.strictEqual(inboxRows(t, 'Inbox Messages').length, 1);
});

test('T5 an open message older than 7 days shows Expired on the next list, and its row is updated', () => {
  const t = inboxBox();
  const c = inboxChat(t, 'claude.ai', 'Canvas Ops');
  t.tabs['Inbox Messages'].appendRow(['M-old', c, new Date(Date.parse('2026-10-21T03:00:00Z') - 8 * INBOX_DAY).toISOString(), 'kiko@example.com', 'Question', 'old', 'New', '', '', '', '', '']);
  t.tabs['Inbox Messages'].appendRow(['M-new', c, new Date(Date.parse('2026-10-20T03:00:00Z')).toISOString(), 'kiko@example.com', 'Question', 'recent', 'New', '', '', '', '', '']);
  const d = inboxJson(t.ctx.cueInboxList());
  const byId = Object.fromEntries(d.messages.map(m => [m.message_id, m.status]));
  deq([byId['M-old'], byId['M-new']], ['Expired', 'New']);
  deq(inboxRows(t, 'Inbox Messages')[0][6], 'Expired');
});

test('T6 Approve on a Confirm message records the decision and runs nothing (no outbound call)', () => {
  const t = inboxBox();
  const c = inboxChat(t, 'ChatGPT API', 'Payments check');
  const m = inboxJson(t.ctx.cueInboxSend(c, 'Confirm', 'Release payment PR-0001 to Mats Co?'));
  deq(m.status, 'New');
  assert.ok(!t.log.gpt || t.log.gpt.length === 0, 'a Confirm makes no AI call');
  const d = inboxJson(t.ctx.cueInboxDecide(m.message_id, 'Approve', 'ok'));
  deq([d.decision, inboxRows(t, 'Inbox Messages')[0][6], inboxRows(t, 'Inbox Messages')[0][10]], ['Approved', 'Recorded', 'Approved']);
  deq(inboxRows(t, 'Inbox Decisions').map(r => [r[1], r[2], r[4]]), [[m.message_id, 'Approved', 'ok']]);
  assert.ok(!t.log.bridge || t.log.bridge.length === 0, 'no Canvas bridge call');
});

test('T7 Reject on a Confirm message records the decision and runs nothing', () => {
  const t = inboxBox();
  const c = inboxChat(t, 'claude.ai', 'Supplier quotes');
  const m = inboxJson(t.ctx.cueInboxSend(c, 'Confirm', 'Send quote to supplier?'));
  inboxJson(t.ctx.cueInboxDecide(m.message_id, 'Reject', ''));
  deq([inboxRows(t, 'Inbox Messages')[0][6], inboxRows(t, 'Inbox Messages')[0][10]], ['Recorded', 'Rejected']);
  assert.ok(!t.log.gpt || t.log.gpt.length === 0);
  assert.ok(!t.log.gmail || t.log.gmail.length === 0, 'no mail sent');
});

test('T8 a decision only applies to a Confirm message, and only Approve or Reject is accepted', () => {
  const t = inboxBox();
  const c = inboxChat(t, 'claude.ai', 'Canvas Ops');
  const q = inboxJson(t.ctx.cueInboxSend(c, 'Question', 'Which day?'));
  assert.throws(() => t.ctx.cueInboxDecide(q.message_id, 'Approve', ''), /Only Confirm and Request access messages/);
  const m = inboxJson(t.ctx.cueInboxSend(c, 'Confirm', 'Go?'));
  assert.throws(() => t.ctx.cueInboxDecide(m.message_id, 'Maybe', ''), /Approve or Reject/);
});

test('T9 a retired chat takes no new messages; its old messages stay', () => {
  const t = inboxBox();
  const c = inboxChat(t, 'ChatGPT API', 'Old intake chat');
  inboxJson(t.ctx.cueInboxSend(c, 'Question', 'first'));
  inboxJson(t.ctx.cueInboxRetire(c));
  assert.throws(() => t.ctx.cueInboxSend(c, 'Question', 'second'), /retired/);
  assert.strictEqual(inboxRows(t, 'Inbox Messages').length, 1);
});

test('T10 every inbox server function is owner only', () => {
  const t = inboxBox({ viewer: 'other@example.com' });
  assert.throws(() => t.ctx.cueInboxList(), /private to its owner/);
  assert.throws(() => t.ctx.cueInboxAddChat({ provider: 'claude.ai', label: 'x' }), /private to its owner/);
  assert.throws(() => t.ctx.cueInboxSend('C', 'Question', 'x'), /private to its owner/);
  assert.throws(() => t.ctx.cueInboxDecide('M', 'Approve', ''), /private to its owner/);
});

test('T11 no Canvas bridge call and no outside request in the inbox code (the bridge is untouched)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'CueInbox.gs'), 'utf8');
  assert.ok(!/cueBridgeReq_|script\.google\.com|ZAD_SECRET/.test(src), 'no bridge or outside call in CueInbox.gs');
});

test('T12 the claude.ai pull endpoint (C7) is held: no route reads or writes inbox messages from outside Cue', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'Cue.gs'), 'utf8');
  assert.ok(!/q\.inbox\b|e\.parameter\.inbox\b|\?inbox=/.test(src), 'no ?inbox= route before Kiko approves C7');
});

test('T13 the inbox page follows the brand: DM Sans, no empty links, no text under 12px, no Archivo Black', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'Inbox.html'), 'utf8');
  assert.ok(/family=DM\+Sans/.test(html), 'DM Sans loaded');
  assert.ok(!/href="#"|href=""/.test(html), 'no placeholder links');
  assert.ok(!/font-family[^;]*Archivo/.test(html), 'Archivo Black is for display moments only, none used here');
  const sizes = [...html.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map(m => +m[1]);
  assert.ok(sizes.length > 0 && Math.min(...sizes) >= 12, 'smallest text ' + Math.min(...sizes));
  assert.ok(/outline:\s*2px solid var\(--blue\)/.test(html), 'visible focus ring');
});

test('T14 the page route serves Inbox.html and the tabs exist in the sheet setup list', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'Cue.gs'), 'utf8');
  assert.ok(/q\.view === 'inbox'[\s\S]{0,120}createHtmlOutputFromFile\('Inbox'\)/.test(src), 'inbox view route');
  const t = inboxBox();
  deq(t.tabs['Inbox Messages'].rows[0].slice(0, 3), ['Message ID', 'Chat ID', 'Created']);
  deq(t.tabs['Inbox Decisions'].rows[0], ['Decision ID', 'Message ID', 'Decision', 'Decided at', 'Note', 'Decided by', 'Kind']);
  deq(t.tabs['Inbox Chats'].rows[0].slice(-1), ['Project ID']);
});
