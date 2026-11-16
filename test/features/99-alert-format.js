// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: email alert wording and format
// (CUE-ALERT-FORMAT-2026-11-16). Kiko 16 Nov 2026 14:55Z: "can we still work on how Cue rewords and summarizes things... and formats
// messages? ... bold on headers please"; decision card 15:13Z "New type Own work, one line"; scope and mockup approved 15:14Z "1 yes".
// Uses tySandbox and TY_SORT from 71-ask-cue-types.js and nmRun from 55-new-mail.js.

test('AF1 the page draws an email post\'s section labels bold, only at the start of a line', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexThreads.html'), 'utf8');
  const a = src.indexOf('  function cueLabels(h) {'), fn = src.slice(a, src.indexOf('\n', a + 10));
  const ctx = {}; vm.runInNewContext(fn + '\nthis.f = cueLabels;', ctx);
  assert.strictEqual(ctx.f('New email · Ana Reyes · Client\n\nSubject: Booth\n\nWhat they sent: A request.\n\nWhat it is for: The order.\n\nWhat they expect: A quote.\n\nWhat to do next: Send it.'),
    '<b>New email</b> · Ana Reyes · Client\n\n<b>Subject:</b> Booth\n\n<b>What they sent:</b> A request.\n\n<b>What it is for:</b> The order.\n\n<b>What they expect:</b> A quote.\n\n<b>What to do next:</b> Send it.');
  assert.strictEqual(ctx.f('New in this conversation · Ana'), '<b>New in this conversation</b> · Ana');
  assert.strictEqual(ctx.f('From the thread and the project&#39;s emails: x\nSuggested next step: y\nWhat they want: z'),
    '<b>From the thread and the project&#39;s emails:</b> x\n<b>Suggested next step:</b> y\n<b>What they want:</b> z', 'the email\'s own chat, after esc()');
  assert.strictEqual(ctx.f('She wrote Subject: hello'), 'She wrote Subject: hello', 'never inside a sentence');
  assert.strictEqual(ctx.f('New emails arrived'), 'New emails arrived', 'only the label itself');
});

test('AF2 the main chat post shows the sender\'s company from the read, without the address, with a blank line between sections', () => {
  const t = tySandbox({ mcRead: { sent: 'Your start date is moved to Wednesday 18 Nov.', purpose: 'Your engagement.', expect: 'Nothing. For your information only.',
    want: 'x', history: '', next: 'Watch for their email.', phone: '', position: '', company: 'Crescendo Collective' } });
  const id = nmRun(t), ana = t.state(id).nm.items.filter(x => x.sender === 'ana@client.example')[0];
  const post = t.tabs.Chat.rows.filter(r => r[3] === '>' + ana.chat_id).map(r => r[2])[0] || '';
  assert.ok(/^New email · Ana Reyes, Crescendo Collective · Client · /.test(post) && !/ana@client/.test(post), post);
  deq(post.split('\n\n').slice(1).map(x => x.split(':')[0]), ['Subject', 'What they sent', 'What it is for', 'What they expect', 'What to do next']);
  assert.strictEqual(t.log.mcReads, 1, 'still one AI call per email');
});

test('AF3 the read is told to write to Kiko as "you", not repeat the sender, keep each field short and give days with dates', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'CueMailChat.gs'), 'utf8');
  assert.ok(/Write to Kiko as "you" and "your": never write "Kiko", "he" or "his" about him/.test(src));
  assert.ok(/Do not repeat the sender\\'s name or company/.test(src) && /at most 20 words/.test(src) && /"Wednesday 18 Nov"/.test(src));
  assert.ok(/'\. Today is ' \+ Utilities\.formatDate\(new Date\(cueNow_\(\)\), 'Asia\/Manila', 'EEEE d MMM yyyy'\)/.test(src), 'today\'s date goes with the email');
});

test('AF4 Own work is One line even when the Triage types tab does not list it; a setting Kiko saved wins', () => {
  const t = tySandbox();
  deq([t.ctx.cueMtTypes_()['Own work']], ['One line'], 'empty tab: the starting list has it');
  t.tabs['Triage types'].appendRow(['Client', 'Own chat', new Date(), 'x']);
  deq([t.ctx.cueMtTypes_()['Own work'], t.ctx.cueMtTypes_().Client], ['One line', 'Own chat'], 'older tab without Own work');
  t.tabs['Triage types'].appendRow(['Own work', 'Own chat', new Date(), 'Cue Admin']);
  deq([t.ctx.cueMtTypes_()['Own work']], ['Own chat'], 'Kiko\'s row wins');
});

test('AF5 an email typed Own work gets one line, no full alert, no own chat and no "new kind of email" question', () => {
  const sort = body => { const r = TY_SORT(body); r.items.forEach(x => { if (x.type === 'Client') x.type = 'Own work'; }); return r; };
  const t = tySandbox({ nmSort: sort }); t.ctx.cueMtTypes_();   // opens the tab
  t.tabs['Triage types'].appendRow(['Client', 'Own chat', new Date(), 'x']);
  const id = nmRun(t), ana = t.state(id).nm.items.filter(x => x.sender === 'ana@client.example')[0];
  deq([ana.type, ana.removed, ana.chat_id || ''], ['Own work', 'oneline', '']);
  assert.ok(t.tabs.Chat.rows.some(r => /^\[Own work\] Ana Reyes: /.test(r[2])), 'one line in the main chat');
  assert.ok(!t.tabs.Chat.rows.some(r => /^New email|^New kind of email: "Own work"/.test(r[2])));
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'CueTriage.gs'), 'utf8');
  assert.ok(/Own work \(Kiko\\'s own outside jobs/.test(src), 'the sort is told what Own work is');
});
