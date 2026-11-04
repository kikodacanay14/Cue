// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: Cue messages act like an assistant.
// Kiko 3 Nov 2026 14:30Z: "knowing where the message comes from, why it was sent to me, or why it was sent ... and have a like a
// proposed response to it ... It's like it's a notification. It's not an assistant." Mockup approved 14:57Z ("yes").
// Spec: project files canvas-integration/specs/cue-assistant-messages/.
const AM_READ = { sent: 'A request for a coordination meeting.', purpose: 'Kings Day – Embassy of Belgium.', expect: 'A date and time this week.',
  want: 'They want a meeting with Kiko.', history: 'Nothing earlier.', next: 'Confirm a time.', why: 'Ana is asking for you by name, and the event is in 3 days.',
  reply: 'Hi Ana,\n\nHappy to meet. Would [day, time] work for you?\n\nBest,\nKiko', phone: '', position: '', company: '' };
const amAna = (t, id) => t.state(id).nm.items.filter(x => x.sender === 'ana@client.example')[0];

test('AM1 a new email\'s main-chat post carries the read\'s reason (as a plain sentence, no fixed label) and the proposed reply, from the same one read', () => {
  const t = tySandbox({ mcRead: AM_READ });
  const id = nmRun(t), ana = amAna(t, id);
  const post = t.tabs.Chat.rows.filter(r => r[3] === '>' + ana.chat_id).map(r => r[2])[0] || '';
  assert.ok(/\nAna is asking for you by name, and the event is in 3 days\.\nProposed reply:\nHi Ana,/.test(post), post);
  assert.ok(!/Why you/.test(post), 'Kiko 3 Nov 23:36Z: no fixed label');
  assert.ok(/\nWhat to do next: Confirm a time\./.test(post), 'Kiko\'s 10:15Z context lines stay');
  assert.strictEqual(t.log.mcReads, 1, 'still one AI call per email');
  const chat = t.tabs.Chat.rows.filter(r => r[3] === ana.chat_id).map(r => r[2])[0] || '';
  assert.ok(/\nAna is asking for you by name/.test(chat) && /\nProposed reply:\nHi Ana,/.test(chat) && /Reply here: "draft a reply saying/.test(chat), chat);
});

test('AM1b when the read sees nothing worth adding, no reason line is made up by code', () => {
  const t = tySandbox({ mcRead: Object.assign({}, AM_READ, { why: '' }) });
  const ana = amAna(t, nmRun(t));
  const post = t.tabs.Chat.rows.filter(r => r[3] === '>' + ana.chat_id).map(r => r[2])[0] || '';
  assert.ok(/\nWhat to do next: Confirm a time\.\nProposed reply:\n/.test(post), post);
});

test('AM2 the proposed reply gets Use this reply and Skip buttons in the email\'s chat; no reply means no buttons', () => {
  const t = tySandbox({ mcRead: AM_READ });
  const ana = amAna(t, nmRun(t));
  const asks = t.tabs.Chat.rows.filter(r => /^\?ask-[0-9a-z]+:usereply,skip@/.test(String(r[3])));
  deq(asks.map(r => String(r[3]).split('@')[1]), [ana.chat_id]);
  assert.ok(/nothing is sent before you tap Send/.test(asks[0][2]));
  const t2 = tySandbox({ mcRead: Object.assign({}, AM_READ, { reply: '' }) }); nmRun(t2);
  assert.ok(!t2.tabs.Chat.rows.some(r => /usereply/.test(String(r[3]))), 'no reply needed: no buttons');
});

test('AM3 Use this reply puts the reply on an email card as written: no AI call, nothing sent, the email chat closes', () => {
  const t = tySandbox({ mcRead: AM_READ });
  const ana = amAna(t, nmRun(t)), calls = t.log.gpt.length;
  const q = t.tabs.Chat.rows.filter(r => /usereply/.test(String(r[3])))[0];
  const out = t.ctx.cueAskPick(String(q[3]).match(/^\?(ask-[0-9a-z]+)/)[1], 'usereply');
  const card = t.state(out.request_id);
  deq([card.kind, card.status, card.mail.draft.body, card.ref], ['email', 'Needs you', AM_READ.reply, ana.chat_id]);
  assert.strictEqual(t.log.gpt.length, calls, 'no GPT drafting call');
  assert.ok(!(t.log.sent || []).length, 'nothing sent');
  assert.strictEqual(t.state(ana.chat_id).status, 'Done');
  assert.ok(t.tabs.Chat.rows.some(r => r[3] === out.request_id && /is on the card.*Nothing is sent before you tap\./.test(r[2])));
  assert.throws(() => t.ctx.cueAskPick(String(q[3]).match(/^\?(ask-[0-9a-z]+)/)[1], 'usereply'), /already answered/);
});

test('AM4 Skip closes the email chat and makes no reply', () => {
  const t = tySandbox({ mcRead: AM_READ });
  const ana = amAna(t, nmRun(t)), rows = t.tabs.Requests.rows.length;
  const q = t.tabs.Chat.rows.filter(r => /usereply/.test(String(r[3])))[0];
  t.ctx.cueAskPick(String(q[3]).match(/^\?(ask-[0-9a-z]+)/)[1], 'skip');
  assert.strictEqual(t.state(ana.chat_id).status, 'Done');
  assert.strictEqual(t.tabs.Requests.rows.length, rows, 'no email card made');
  assert.ok(t.tabs.Chat.rows.some(r => r[3] === ana.chat_id && /^Skipped\. No reply was made or sent\.$/.test(r[2])));
});

test('AM5 a scheduled job with new findings gives ChatGPT\'s summary and where to start, with no fixed reason line; nothing new keeps one line', () => {
  const t = gtBox(); const v = t.ctx.cueRun(t.ctx.cueSend('run prospect follow-ups', [], '').request_id);
  const line = t.tabs.Chat.rows.filter(r => r[3] === v.id && /^Prospect follow-ups: 3 new findings/.test(r[2])).map(r => r[2])[0] || '';
  assert.ok(/\nThree prospects are due\.\nMy suggestion:/.test(line), line);
  assert.ok(!/Why you/.test(line), line);
  assert.ok(/\nMy suggestion: start with Follow up Acme proposal \(Acme Corp\), due 2026-10-22\. Send the follow-up\.$/.test(line), line);
  const v2 = t.ctx.cueRun(t.ctx.cueSend('prospect follow-ups', [], '').request_id);
  const l2 = t.tabs.Chat.rows.filter(r => r[3] === v2.id && /^Prospect follow-ups: Nothing new/.test(r[2])).map(r => r[2])[0] || '';
  assert.ok(l2 && !/\n/.test(l2), l2);
});

test('AM6 the page shows "My suggestion:" and "Proposed reply:" as bold labels, and a new email\'s post carries its reply buttons', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexThreads.html'), 'utf8');
  const a = src.indexOf('  function cueLabels(h) {'), fn = src.slice(a, src.indexOf('\n', a + 10));
  const ctx = {}; vm.runInNewContext(fn + '\nthis.f = cueLabels;', ctx);
  assert.strictEqual(ctx.f('Hi\nMy suggestion: y\nProposed reply:\nz'), 'Hi\n<b>My suggestion:</b> y\n<b>Proposed reply:</b>\nz');
  assert.strictEqual(ctx.f('He said Proposed reply: no'), 'He said Proposed reply: no', 'only at the start of a line');
  assert.ok(/msgHtml\(m, pt \? to : ''\) \+ mailAskHtml\(to\)/.test(src) && /usereply: 'Use this reply'/.test(src));
});
