// Part of test/cue.test.js. Feature: CHANNEL-SEEN-2026-11-18 (src/Cue.gs cueSeen/cueSeenMap_, src/IndexThreads.html seenOut/reviewN/
// markSeen, src/IndexChat.html goThread). Kiko 18 Nov 2026 08:37:10Z "the number in the thread i thought we had that changed already?",
// 08:38:43Z "also i have clicked on each of those messages", 08:40:28Z "there is no mark read on each".
const CS_SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexThreads.html'), 'utf8');
test('SEEN1 Cue notes when Kiko opened a channel: the newest time wins, a bad key or time is refused, cueState hands the times to the page', () => {
  const t = sandbox();
  t.ctx.cueSeen('agent:account specialist'.replace(' ', '-'), '2026-11-18T08:00:00.000Z');
  t.ctx.cueSeen('agent:account-specialist', '2026-11-18T07:00:00.000Z');
  const m = JSON.parse(JSON.stringify(t.ctx.cueSeen('job:updates', '2026-11-18T08:10:00.000Z')));
  assert.strictEqual(m['agent:account-specialist'], '2026-11-18T08:00:00.000Z', 'an older open does not move the time back');
  assert.strictEqual(m['job:updates'], '2026-11-18T08:10:00.000Z');
  assert.throws(() => t.ctx.cueSeen('<bad key>', '2026-11-18T08:00:00.000Z'));
  assert.throws(() => t.ctx.cueSeen('job:updates', 'yesterday'));
  assert.strictEqual(JSON.parse(JSON.stringify(t.ctx.cueState())).seen['job:updates'], '2026-11-18T08:10:00.000Z');
});
test('SEEN2 the number goes to 0 when Kiko opens the channel or thread (Kiko 08:47:46Z); anything newer counts again', () => {
  const b = CS_SRC.indexOf('  var NEED = {'), e = CS_SRC.indexOf('  var OLDK = {');
  const a = CS_SRC.indexOf('  function seenOut('), z = CS_SRC.indexOf('\n  }\n', CS_SRC.indexOf('  function reviewN(')) + 4;
  const ctx = { state: { seen: { ag: '2026-11-18T08:00:00Z', 'job:updates': '2026-11-18T08:00:00Z', task1: '2026-11-18T08:00:00Z' } } };
  vm.runInNewContext(CS_SRC.slice(b, e) + CS_SRC.slice(a, z) + '\nthis.reviewN = reviewN;', ctx);
  const old = '2026-11-18T07:00:00Z', fresh = '2026-11-18T08:30:00Z';
  const agent = { reqs: [{ agd: { status: 'Unread' }, created: old }, { agd: { status: 'Unread' }, created: old }, { agd: { status: 'Waiting for Kiko' }, created: old }, { agd: { status: 'Unread' }, created: fresh }] };
  assert.strictEqual(ctx.reviewN(agent), 4, 'before opening: every open item');
  assert.strictEqual(ctx.reviewN(agent, 'ag'), 1, 'after opening: only the update that came later');
  const job = { chan: 'job:updates', reqs: [{ status: 'Needs you', created: old }, { status: 'Failed', created: old }, { status: 'Needs you', created: fresh }] };
  assert.strictEqual(ctx.reviewN(job, 'job:updates'), 1);
  assert.strictEqual(ctx.reviewN({ reqs: [{ status: 'Needs you', created: old }] }, 'task1'), 0, 'a thread too');
  assert.strictEqual(ctx.reviewN(agent, 'never-opened'), 4);
});
test('SEEN3 opening a channel notes it, and the row stops saying Needs you once nothing counts', () => {
  const chat = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexChat.html'), 'utf8');
  assert.ok(/openPane\(\{ key: 't:' \+ id, type: 'thread', id: id \}\); showConv\(\);\n    markSeen\(id\);/.test(chat), 'goThread notes the open');
  assert.ok(CS_SRC.includes("call('cueSeen', [k, now]"), 'one server call, no Canvas write');
  assert.ok(CS_SRC.includes("if (!rn && st.need) st = { color: 'var(--muted)', text: '' };"));
  assert.ok(!/cueAgdDecide|agd-read/.test(CS_SRC.slice(CS_SRC.indexOf('  function markSeen('), CS_SRC.indexOf('  function markSeen(') + 600)), 'nothing is marked read in Canvas');
});
