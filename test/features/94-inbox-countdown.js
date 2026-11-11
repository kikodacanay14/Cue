// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: team inbox countdown (D1, D2 of
// CanvasWorkspace docs/specs/team-inbox-design.md section 14, Kiko 11 Nov 2026). A Question waits 2 minutes, then the
// sweep trigger sends it. Cancel stops it. Clock is the harness clock: t.ctx.__wait(ms) moves time forward.
const INBOX_WAIT = 2 * 60 * 1000;
const inboxQueue = (t, tab = 'Inbox Queue') => inboxRows(t, tab);

test('T15 a Question is queued with a 2-minute countdown and calls no AI yet', () => {
  const t = inboxBox({ gpt: { inbox_reply: { reply: 'ok' } } });
  const c = inboxChat(t, 'ChatGPT API', 'Canvas PO');
  const r = inboxJson(t.ctx.cueInboxQueue(c, '  Is the fee included?  '));
  deq(r.status, 'Queued');
  const q = inboxQueue(t)[0];
  deq([q[0], q[2]], [r.message_id, 'Queued']);
  assert.strictEqual(new Date(q[1]).getTime() - t.ctx.cueNow_(), INBOX_WAIT, 'send at now + 2 minutes');
  deq(inboxRows(t, 'Inbox Messages')[0][6], 'Queued');
  assert.ok(!t.log.gpt || t.log.gpt.length === 0, 'no OpenAI call during the countdown');
});

test('T16 the sweep sends nothing before the countdown ends', () => {
  const t = inboxBox({ gpt: { inbox_reply: { reply: 'ok' } } });
  const c = inboxChat(t, 'ChatGPT API', 'Canvas PO');
  t.ctx.cueInboxQueue(c, 'Is the fee included?');
  t.ctx.__wait(INBOX_WAIT - 1000);
  t.ctx.cueInboxSweep_();
  deq(inboxQueue(t)[0][2], 'Queued');
  assert.ok(!t.log.gpt || t.log.gpt.length === 0);
});

test('T17 after 2 minutes the sweep sends the Question once and stores the reply', () => {
  const t = inboxBox({ gpt: { inbox_reply: { reply: 'Yes, included.' } } });
  const c = inboxChat(t, 'ChatGPT API', 'Canvas PO');
  const r = inboxJson(t.ctx.cueInboxQueue(c, 'Is the fee included?'));
  t.ctx.__wait(INBOX_WAIT + 1000);
  t.ctx.cueInboxSweep_();
  deq(inboxQueue(t)[0][2], 'Sent');
  assert.strictEqual(t.log.gpt.length, 1, 'one OpenAI call');
  const m = inboxRows(t, 'Inbox Messages').filter(x => x[0] === r.message_id)[0];
  deq([m[6], m[7], m[9]], ['Replied', 'Yes, included.', 'OpenAI API']);
});

test('T18 Cancel before the countdown ends means nothing is sent', () => {
  const t = inboxBox({ gpt: { inbox_reply: { reply: 'ok' } } });
  const c = inboxChat(t, 'ChatGPT API', 'Canvas PO');
  const r = inboxJson(t.ctx.cueInboxQueue(c, 'Is the fee included?'));
  deq(inboxJson(t.ctx.cueInboxCancel(r.message_id)).status, 'Cancelled');
  t.ctx.__wait(INBOX_WAIT + 1000);
  t.ctx.cueInboxSweep_();
  deq(inboxQueue(t)[0][2], 'Cancelled');
  assert.ok(!t.log.gpt || t.log.gpt.length === 0, 'no OpenAI call after Cancel');
  deq(inboxRows(t, 'Inbox Messages')[0][6], 'Cancelled');
});

test('T19 Cancel after the send is refused; a second sweep never sends twice', () => {
  const t = inboxBox({ gpt: { inbox_reply: { reply: 'ok' } } });
  const c = inboxChat(t, 'ChatGPT API', 'Canvas PO');
  const r = inboxJson(t.ctx.cueInboxQueue(c, 'Is the fee included?'));
  t.ctx.__wait(INBOX_WAIT + 1000);
  t.ctx.cueInboxSweep_(); t.ctx.cueInboxSweep_();
  assert.strictEqual(t.log.gpt.length, 1, 'one call across two sweeps');
  assert.throws(() => t.ctx.cueInboxCancel(r.message_id), /already sent or was cancelled/);
});

test('T20 a Question to a claude.ai chat is queued, then stays New after the countdown (pull held)', () => {
  const t = inboxBox();
  const c = inboxChat(t, 'claude.ai', 'Canvas Ops');
  const r = inboxJson(t.ctx.cueInboxQueue(c, 'Is the pay day on Thursday?'));
  t.ctx.__wait(INBOX_WAIT + 1000);
  t.ctx.cueInboxSweep_();
  deq(inboxQueue(t)[0][2], 'Sent');
  const m = inboxRows(t, 'Inbox Messages').filter(x => x[0] === r.message_id)[0];
  deq(m[6], 'New');
  assert.ok(!t.log.gpt || t.log.gpt.length === 0, 'no OpenAI call for claude.ai');
});

test('T21 queue and cancel are owner only', () => {
  const t = inboxBox({ viewer: 'other@example.com' });
  const c = 'CH-direct';
  t.tabs['Inbox Chats'].rows.push([c, 'ChatGPT API', 'Canvas PO', 'Active', '', '', new Date().toISOString()]);   // seeded without the owner-only add
  assert.throws(() => t.ctx.cueInboxQueue(c, 'hi'), /owner|Only|not allowed/i);
  assert.throws(() => t.ctx.cueInboxCancel('M-x'), /owner|Only|not allowed/i);
});

test('T22 no every-minute inbox trigger (1.28.61, Google too-many-scripts limit); the 5-minute cueResume sends anything still queued', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'Cue.gs'), 'utf8');
  assert.ok(!/newTrigger\('cueInboxSweep'\)/.test(src) && /try \{ cueInboxSweep_\(\); \}/.test(src), 'no 1-minute trigger; cueResume sweeps');
});

test('T23 the trigger version is 8 or more, so live Cue deletes the old every-minute inbox trigger', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'Cue.gs'), 'utf8');
  const v = +(src.match(/const CUE_TRIGGERS_NOW_ = '(\d+)'/) || [])[1];
  assert.ok(v >= 8, 'CUE_TRIGGERS_NOW_ is ' + v);
  assert.ok(/'cueHsWeekly', 'cueInboxSweep'\]\.indexOf/.test(src), '1.28.61: the old 1-minute sweep trigger is deleted on live');
});

test('T25 one Question per chat every 3 minutes: a second one is refused with the seconds left; another chat, a Confirm and a Question after 3 minutes all go', () => {
  const t = inboxBox({ gpt: { inbox_reply: { reply: 'ok' } } });
  const a = inboxChat(t, 'ChatGPT API', 'A'), b = inboxChat(t, 'ChatGPT API', 'B');
  deq(inboxJson(t.ctx.cueInboxSend(a, 'Question', 'one')).status, 'Replied');
  assert.throws(() => t.ctx.cueInboxSend(a, 'Question', 'two'), /This chat can take another Question in 1[0-9]{2} seconds\./);
  deq(inboxJson(t.ctx.cueInboxSend(b, 'Question', 'other chat')).status, 'Replied');
  deq(inboxJson(t.ctx.cueInboxSend(a, 'Confirm', 'go?')).status, 'New');
  const n0 = t.ctx.cueNow_(); t.ctx.cueNow_ = () => n0 + 3 * 60 * 1000;
  deq(inboxJson(t.ctx.cueInboxSend(a, 'Question', 'three')).status, 'Replied');
  deq(t.log.gpt.length, 3);
});

test('T26 the 3-minute pause check and the new message row run inside one lock (Codex on Cue PR #372)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'CueInbox.gs'), 'utf8');
  assert.ok(/cueLocked_\(\(\) => \{\s*if \(kind === 'Question'\)[\s\S]{0,700}appendRow\(\[msgId[\s\S]{0,200}\}\);/.test(src));
});
