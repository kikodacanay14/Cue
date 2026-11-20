// Part of test/cue.test.js. Feature: CUE-CHANNELS-2026-11-18 (src/Index.html, IndexThreads.html threads/chanKey/renderThreadList/
// renderMain, IndexChat.html goGeneral/showList/showConv, IndexStyle.html). Kiko 18 Nov 2026 04:18:47Z "All the channels and threads put
// them on the left. conversation now goes to the right. Merge all the Agents channels"; groups 04:22:53Z and 04:30:16Z; open-to-review
// counts 04:27:02Z; "no chat or message should appear twice" 04:22:53Z; mockup approved and "build" 04:32:32Z.
const CH_SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexThreads.html'), 'utf8');
function chThreads(reqs, lines) {
  const page = cuePage(), ctx = {}; vm.createContext(ctx);
  vm.runInContext(page.match(/  function agdLabel\(v\) \{[^\n]*\n/)[0], ctx);
  const a = CH_SRC.indexOf('  function rootOf('), z = CH_SRC.indexOf('\n  }\n', CH_SRC.indexOf('  function threads(')) + 4;
  const c = { state: { requests: reqs }, agdLabel: ctx.agdLabel, allLines: () => lines || [], askOf: () => null };
  vm.runInNewContext("function byId() { var o = {}; state.requests.forEach(function (r) { o[r.id] = r; }); return o; }\n" + CH_SRC.slice(a, z) + '\nthis.t = threads(); this.chanKey = chanKey;', c);
  return c;
}
test('CH1 each scheduled job is one channel: every run joins the oldest run; every ChatGPT scheduled task joins Jobs › Updates (Kiko 08:49:40Z); Cue Dev and release notes go to Systems › Updates', () => {
  const c = chThreads([
    { id: 'b2', kind: 'bids', created: '2026-11-18' }, { id: 'b1', kind: 'bids', created: '2026-11-17' },
    { id: 'g2', kind: 'gtask', gt: { key: 'admin_payments' }, created: '2026-11-18' }, { id: 'g1', kind: 'gtask', gt: { key: 'production_readiness' }, created: '2026-11-17' },
    { id: 'g3', kind: 'gtask', gt: { key: 'lead_scan' }, created: '2026-11-17' },
    { id: 's2', kind: 'sweep', subject: { key: 'morning' }, created: '2026-11-18' }, { id: 's1', kind: 'sweep', created: '2026-11-17' },
    { id: 'd1', agd: { agent: 'Cue Dev Team' }, created: '2026-11-18' }, { id: 'r1', kind: 'relnotes', created: '2026-11-17' },
    { id: 'a1', agd: { agent: 'AS' }, created: '2026-11-18' }, { id: 'x1', kind: 'intake', created: '2026-11-18' }],
    [{ who: 'Cue', request_id: 'b2', text: 'new bids' }, { who: 'Cue', request_id: '', text: 'The sweep did not run today' }, { who: 'Cue', request_id: '', text: 'Good morning' }]);
  const byName = (x, y) => x.localeCompare(y), keys = Object.keys(c.t).sort(byName);
  deq(JSON.parse(JSON.stringify(keys)), ['a1', 'b1', 'r1', 's1', 'sys:alerts', 'x1'].sort(byName));
  deq([c.t.b1.chan, c.t.s1.chan, c.t.r1.chan, c.t['sys:alerts'].chan, c.t.a1.chan, c.t.x1.chan], ['job:bids', 'job:updates', 'sys:updates', 'sys:alerts', '', 'proc:projects'], 'a client intake joins Process Updates › Project Updates (Kiko 09:04:16Z)');
  deq(JSON.parse(JSON.stringify(c.t.s1.reqs.map(r => r.id).sort(byName))), ['g1', 'g2', 'g3', 's1', 's2'], 'the ChatGPT tasks and the Morning batch share Jobs › Updates');
  deq(c.t.b1.reqs.map(r => r.id), ['b1', 'b2'], 'oldest first'); deq(c.t.b1.lines.length, 1, 'a run\'s lines follow it into the channel');
  deq(c.t.r1.reqs.map(r => r.id).sort(byName), ['d1', 'r1'], 'Cue Dev and release notes share Updates');
  deq(c.t['sys:alerts'].lines.map(m => m.text), ['The sweep did not run today'], 'only the failure note goes to Alerts');
  deq(c.t._home('b2'), 'b1', 'a run\'s own id finds its channel');
});
test('CH2 the count beside a channel is what is open for Kiko to review: Needs you tasks, agent drafts Waiting for Kiko and Unread updates; zero shows nothing', () => {
  const a = CH_SRC.indexOf('  function seenOut('), z = CH_SRC.indexOf('\n  }\n', CH_SRC.indexOf('  function reviewN(')) + 4, ctx = { state: {} };
  const b = CH_SRC.indexOf('  var NEED = {'), e = CH_SRC.indexOf('  var OLDK = {');
  vm.runInNewContext(CH_SRC.slice(b, e) + CH_SRC.slice(a, z) + '\nfunction isDismissed() { return false; }\nthis.reviewN = reviewN;', ctx);
  deq(ctx.reviewN({ reqs: [{ status: 'Needs you' }, { status: 'Done' }, { agd: { status: 'Waiting for Kiko' } }, { agd: { status: 'Unread' } }, { agd: { status: 'Read' } }, { status: 'Working', nudge: 1 }] }), 4);
  assert.ok(CH_SRC.includes(`var badge = function (n, what) { return n ? '<i class="badge rvn"`), 'zero shows no badge');
});
test('CH3 the list: General first, then Agent Updates, Jobs (CRM and To do from Canvas on top), Systems, Threads; agents show initials; General has no Cue icon', () => {
  assert.ok(CH_SRC.includes(`h += '<button class="trow gen' + (openThread ? '' : ' sel') + '" data-general="1"><i class="dot"`), 'General row, a dot not the Cue logo');
  assert.ok(CH_SRC.includes("[['proc', 'Project and Process Updates'], ['agent', 'Agent Updates'], ['sys', 'Systems'], ['rest', 'Threads']]"));
  assert.ok(CH_SRC.includes(`(x.ag ? '<span class="chico" aria-hidden="true">' + esc(initials(x.title))`));
  assert.ok(CH_SRC.includes("if (b.hasAttribute('data-general')) return goGeneral();"));
});
test('CH4 no message shows twice: General leaves out agent-tag copies, alert notes, pointers and first messages of listed channels, and the bids card of a listed run', () => {
  const m = CH_SRC.slice(CH_SRC.indexOf('  function listed(id, th)'), CH_SRC.indexOf('  function listed(id, th)') + 4000);
  assert.ok(/request_id\.charAt\(0\) === '%'\) \{ var br = by\[m\.request_id\.slice\(1\)\]; if \(br && !listed\(br\.id, th\)\)/.test(m), 'bids card only when its run is not listed');
  assert.ok(/if \(pt && listed\(to, th\) && !answers\) return;/.test(m), 'pointer left out when its channel holds it');
  assert.ok(/if \(listed\(root, th\)\) return;/.test(m), 'a listed task\'s first message stays in its channel');
});
test('CH5 layout: the list on the left, General or the open channel on the right; a phone shows one at a time with a Channels back button; Canvas hides Cue\'s header', () => {
  const page = fs.readFileSync(path.join(__dirname, '..', 'src', 'Index.html'), 'utf8'), css = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexStyle.html'), 'utf8');
  const chat = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexChat.html'), 'utf8');
  assert.ok(page.indexOf('<aside class="clist" id="clist"') < page.indexOf('<div class="left" id="general"'), 'list first');
  assert.ok(/<div class="lhead" id="lhead">[\s\S]{0,200}id="dot"[\s\S]{0,200}id="team-cue"/.test(page), 'dot and Back to Team Cue moved to the list header');
  assert.ok(/<div class="lfoot"><button class="avatar" id="avatar"[^>]*>K<\/button><label for="avatar">Settings<\/label><\/div>\n<\/aside>/.test(page), 'K sits at the foot of the list (Kiko 06:19:02Z)');
  assert.ok(/body\.ch-thread \.pane, body\.ch-thread \.pane\.shut \{ display:flex; \}/.test(css) && /body\.ch-thread \.left \{ display:none; \}/.test(css));
  assert.ok(/body\.in-canvas header \{ display:none; \}/.test(css), 'Canvas\'s purple bar carries the logo');
  assert.ok(/@media \(max-width: 640px\) \{[^@]*body:not\(\.ch-list\) \.clist \{ display:none; \}[^@]*body\.ch-list \.left, body\.ch-list \.pane/.test(css));
  assert.ok(chat.includes("document.body.classList.toggle('ch-thread', !!openThread);") && chat.includes("if (window.matchMedia && matchMedia('(max-width: 640px)').matches && !document.body.classList.contains('cue-stream')) showList();"));
});
