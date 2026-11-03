// Part of test/cue.test.js. Feature: no repeated messages (Kiko 3 Nov 2026: "The redundant messages. You see the message in the thread,
// you see the message in the main chat, and then after a while, you see it again").
test('NR1 a Cue line word for word the newest line in the same place is posted once; another place, a line from Kiko in between, or a day later posts it', () => {
  const t = sandbox(), C = t.tabs.Chat.rows, n0 = C.length;
  t.ctx.cueChat_('Cue', 'The bid check stopped: too large.', 'cue-20261021110000-aaaa');
  t.ctx.cueChat_('Cue', '[Platform notices] DMARC report; no reply needed.', '');
  t.ctx.cueChat_('Cue', 'The bid check stopped: too large.', 'cue-20261021110000-aaaa');   // the 10-minute repeat
  t.ctx.cueChat_('Cue', '[Platform notices] DMARC report; no reply needed.', '');          // the identical second email
  assert.strictEqual(C.length - n0, 2, 'repeats dropped: ' + JSON.stringify(C.slice(n0).map(r => r[2])));
  t.ctx.cueChat_('Cue', 'The bid check stopped: too large.', '>cue-20261021110000-aaaa');   // a pointer is another place
  assert.strictEqual(C.length - n0, 3);
  t.ctx.cueChat_('Kiko', 'try again', 'cue-20261021110000-aaaa');
  t.ctx.cueChat_('Cue', 'The bid check stopped: too large.', 'cue-20261021110000-aaaa');   // answers Kiko: new
  assert.strictEqual(C.length - n0, 5);
  t.ctx.cueChat_('Kiko', 'ok', 'cue-20261021110000-aaaa'); t.ctx.cueChat_('Kiko', 'ok', 'cue-20261021110000-aaaa');   // Kiko's own lines always post
  assert.strictEqual(C.length - n0, 7);
  C[C.length - 1][0] = new Date(Date.parse('2026-10-19T03:00:00Z')); C[C.length - 2][0] = C[C.length - 1][0];
  t.ctx.cueChat_('Cue', 'Same as yesterday.', 'cue-x'); C[C.length - 1][0] = new Date(Date.parse('2026-10-19T03:00:00Z'));
  t.ctx.cueChat_('Cue', 'Same as yesterday.', 'cue-x');   // older than a day: posts
  assert.strictEqual(C.length - n0, 9);
});

test('NR2 one run at a time: a run whose lease is held in the Script Properties does not run again; the lease is let go when the run ends', () => {
  const t = sandbox(), id = t.ctx.cueSend(INQ, [], 'intake').request_id, n0 = t.tabs.Chat.rows.length, k = 'CUE_RUN_' + id;
  t.props[k] = String(Date.parse('2026-10-21T04:00:00Z'));   // another run of the same request holds it (3 Nov 19:00: two at once)
  t.ctx.cueRun(id);
  assert.strictEqual(t.tabs.Chat.rows.length, n0, 'the second run posted nothing');
  assert.strictEqual(t.state(id).status, 'Working');
  delete t.props[k];
  t.ctx.cueRun(id);
  assert.notStrictEqual(t.state(id).status, 'Working', 'the run itself goes ahead');
  assert.ok(!(k in t.props), 'lease let go');
});
