// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: new mail shows only in the main chat.
// Kiko 3 Nov 2026 06:30Z: "the new mails are redundant. only make them appear on the left. if i ask it to do an action that is the
// only time it will show in the threadss". The Threads list (src/IndexThreads.html, listShows) leaves out an email's own chat and a
// new-kind-of-email question until Kiko asks for something in it or another task joins it.
const ML_SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexThreads.html'), 'utf8');
const ML_FN = (() => {
  const a = ML_SRC.indexOf('  var MAIL_ONLY = '), b = ML_SRC.indexOf('  function threadState(th) {');
  assert.ok(a > 0 && b > a, 'listShows sits just above threadState');
  const ctx = {}; vm.runInNewContext(ML_SRC.slice(a, b) + '\nthis.listShows = listShows;', ctx); return ctx.listShows;
})();
const mlTh = (kinds, said) => ({ reqs: kinds.map((k, i) => ({ id: 'r' + i, kind: k, status: 'Needs you' })),
  lines: [{ who: 'Cue', text: 'Ana Cruz · Client\nSubject: Booth' }].concat((said || []).map(t => ({ who: 'Kiko', text: t }))) });

test('ML1 a new email\'s own chat and a new-kind question stay out of the Threads list', () => {
  deq([ML_FN(mlTh(['mail'])), ML_FN(mlTh(['mailtype'])), ML_FN(mlTh(['mailtype'], ['ignore']))], [false, false, false]);
});

test('ML2 a mail chat joins the list once Kiko asks for something in it or another task joins it; a plain "done" does not', () => {
  deq([ML_FN(mlTh(['mail'], ['draft a reply saying yes'])), ML_FN(mlTh(['mail'], ['what did they ask last week?'])), ML_FN(mlTh(['mail', 'email'])), ML_FN(mlTh(['mail', 'intake']))],
    [true, true, true, true]);
  deq([ML_FN(mlTh(['mail'], ['done'])), ML_FN(mlTh(['mail'], ['Ok, done.']))], [false, false]);
});

test('ML3 every other thread is listed as before, and the list and its count both use the same check', () => {
  deq(['intake', 'newmail', 'bids', 'gtask', 'email', 'sweep', 'personal'].map(k => ML_FN(mlTh([k]))), [true, true, true, true, true, true, true]);
  assert.ok(/listShows\(th\[k\]\) && threadState\(th\[k\]\)\.need/.test(ML_SRC), 'the Waiting on you count (needThreadsN) skips hidden mail chats');
  assert.ok(/\|\| !listShows\(t\)\) return;/.test(ML_SRC), 'the list skips hidden mail chats');
});

// Kiko 3 Nov 2026 10:15Z: "when you post on the left give some context. like what did they send, what time, what is it for, what do
// they expect, what needs to be done after?" (CueMailChat.gs cueMcLeft_, from the same one Haiku read).
test('ML4 the main chat post for a new email says who, when, what they sent, what it is for, what they expect and what to do next', () => {
  const t = tySandbox({ mcRead: { sent: 'A request to add 2 booths to the order.', purpose: 'The booth order for their November launch.', expect: 'A revised quote by Friday.',
    want: 'They want a quote.', history: 'Nothing earlier.', next: 'Send the revised quote.', phone: '', position: '', company: '' } });
  const id = nmRun(t), ana = t.state(id).nm.items.filter(x => x.sender === 'ana@client.example')[0];
  const post = t.tabs.Chat.rows.filter(r => r[3] === '>' + ana.chat_id).map(r => r[2])[0] || '';
  const lines = post.split('\n');
  assert.ok(/^New email: Ana Reyes <ana@client\.example> · Client · 2026-10-21$/.test(lines[0]), lines[0]);   // the test double prints the day; Apps Script prints "21 Oct, 11:40 AM" (d MMM, h:mm a, Manila)
  deq(lines.slice(1), ['Subject: Booth count', 'What they sent: A request to add 2 booths to the order.', 'What it is for: The booth order for their November launch.',
    'What they expect: A revised quote by Friday.', 'What to do next: Send the revised quote.']);
  assert.strictEqual(t.log.mcReads, 1, 'still one AI call per email');
  assert.ok(t.tabs.Chat.rows.some(r => r[3] === ana.chat_id && /^Ana Reyes · Client/.test(r[2])), 'the chat itself still starts with Cue\'s full read');
});

test('ML5 when the read comes back empty, the post still says who, when and what the email says, and leaves out what only the read knows', () => {
  const t = tySandbox({ mcRead: {} });
  const id = nmRun(t), ana = t.state(id).nm.items.filter(x => x.sender === 'ana@client.example')[0];
  const post = t.tabs.Chat.rows.filter(r => r[3] === '>' + ana.chat_id).map(r => r[2])[0] || '';
  assert.ok(/^New email: Ana Reyes/.test(post) && /\nWhat they sent: \S/.test(post), post);
  assert.ok(!/What they expect|What to do next/.test(post));
});
