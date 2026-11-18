// Part of test/cue.test.js. Feature: CUE-JOBS-UPDATES-2026-11-18 (src/IndexThreads.html updThread/chanGroup/renderThreadList,
// src/IndexStyle.html .tgroup.tsub). Kiko 18 Nov 2026 06:15:53Z "the Project Intake should be in Jobs. Add there Updates under Jobs - put
// the Sales - Wed 18 Nov there and 8 AM update"; 06:17:36Z "ChatGPT is a system right? shouldnt it be in Systems? Same with GitHub?".
const JU_SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexThreads.html'), 'utf8');
function juGroup(t) {
  const a = JU_SRC.indexOf('  var SYS_AGENT = '), z = JU_SRC.indexOf('\n  }\n', JU_SRC.indexOf('  function chanGroup(')) + 4, c = { showArchived: false, listGroup: () => 'x' };
  vm.runInNewContext(JU_SRC.slice(a, z) + '\nthis.g = chanGroup;', c);
  return c.g(Object.assign({ chan: '', reqs: [] }, t), {});
}
test('JU1 Jobs › Updates takes the 8 AM and 2 PM updates and the Sales day threads; Project intake and the 2 PM funnel follow-ups go to Jobs', () => {
  deq(juGroup({ reqs: [{ kind: 'k0' }] }), 'jobupd', '8 AM / 2 PM update');
  deq(juGroup({ reqs: [{ kind: 'funnel', subject: { key: 'sales' } }] }), 'jobupd', 'Sales · Wed 18 Nov');
  deq(juGroup({ chan: 'job:sales', reqs: [{ kind: 'gtask' }] }), 'jobupd', 'the Sales channel');
  deq(juGroup({ reqs: [{ kind: 'intake' }] }), 'job', 'Project intake');
  deq(juGroup({ reqs: [{ kind: 'k0fn' }] }), 'job', '2 PM funnel follow-ups (named Project intake)');
  deq(juGroup({ chan: 'job:bids', reqs: [{ kind: 'bids' }] }), 'job', 'other job channels unchanged');
  deq(juGroup({ reqs: [{ kind: 'email' }] }), 'rest', 'other threads stay in Threads');
});
test('JU2 ChatGPT and GitHub sit in Systems; the other agents stay in Agent Updates', () => {
  deq(juGroup({ reqs: [{ agd: { agent: 'ChatGPT' } }] }), 'sys');
  deq(juGroup({ reqs: [{ agd: { agent: 'GitHub' } }] }), 'sys');
  deq(juGroup({ reqs: [{ agd: { agent: 'BSE — Account Specialist' } }] }), 'agent');
});
test('JU3 the Updates heading sits inside Jobs after Canvas\'s rows, folds on its own, and adds its count to Jobs', () => {
  assert.ok(JU_SRC.includes("upd = g[0] === 'job' ? G.jobupd.sort(newest) : []"));
  assert.ok(JU_SRC.includes("var gn = sum(l) + sum(upd) +"));
  assert.ok(/h \+= extra\.map[\s\S]{0,600}if \(upd\.length\) \{[\s\S]{0,200}data-tgroup="jobupd"/.test(JU_SRC));
  const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexStyle.html'), 'utf8');
  assert.ok(/\.tgroup\.tsub \{/.test(css));
});
test('JU4 an email\'s line in General names its sender as its source, so a rule moves only that sender\'s emails; the rules list names it', () => {
  const code = fs.readFileSync(path.join(__dirname, '..', 'src', 'CueNewMail.gs'), 'utf8'), c = {};
  vm.runInNewContext(code.slice(code.indexOf('function cueMailSrc_('), code.indexOf('\n}\n', code.indexOf('function cueMailSrc_(')) + 3) + '\nthis.f = cueMailSrc_;', c);
  deq(c.f({ sender: 'Jessica Allyn <Jessica.Allyn@Example.com>' }, 'mail-type'), 'mail:jessica.allyn@example.com');
  deq(c.f({ sender: 'jessica@telus.com', type: 'Client' }, ''), 'mail:jessica@telus.com|type:Client', 'sender and kind');
  deq(c.f({ sender: '', type: 'Client' }, ''), 'type:Client');
  deq(c.f({ sender: '' }, 'mail-type'), 'mail-type');
  assert.ok(code.includes("cueChat_('Cue', cueMtLine_(x), '', cueMailSrc_(x, 'mail-type'))") && code.includes("cueChat_('Cue', cueMtProjectLine_(l, l.pid), '', cueMailSrc_(l, 'mail-project'))"));
  assert.ok(JU_SRC.includes(`(/^mail:/.test(k) ? 'Emails from ' + k.slice(5) : /^type:/.test(k) ? k.slice(5) + ' emails' : /^words:/.test(k) ? 'Emails with "' + k.slice(6) + '"' : k)`));
});
test('JU5 General shows no "Earlier task" thread row under a message; the message itself opens its thread', () => {
  assert.ok(!JU_SRC.includes('function rowHtml(') && !JU_SRC.includes('rowHtml('), 'the row is gone');
  assert.ok(JU_SRC.includes("h += msgHtml(m, th[root] ? root : '');") && JU_SRC.includes("h += mvAttr(msgHtml(m, pt ? to : ''), m) + mailAskHtml(to);"));
  assert.ok(JU_SRC.includes(`(thread ? ' data-thread="' + esc(thread) + '" title="Open the thread"'`), 'a tap on the message opens the thread');
});
test('JU6 an email\'s post in General can be dragged; once moved it joins the channel and leaves General; the email chat\'s own lines stay in that chat; a press and move never selects text', () => {
  assert.ok(JU_SRC.includes("if (!m || (m.request_id && m.request_id.charAt(0) !== '>')) return '';"), 'a pointer line can have a channel');
  assert.ok(JU_SRC.includes("if (m.request_id && m.request_id.charAt(0) === '>') { var pc = lineChan(m), pat = pc === 'sys:alerts' ? pc : pc && jbRoot[pc]; if (pat) get(pat).lines.push(m); return; }"));
  assert.ok(JU_SRC.includes("var pmc = lineChan(m); if (pmc && chanAt(th, pmc)) { h += movedHtml(m, pmc, th); return; }"));
  assert.ok(JU_SRC.includes("if (by[root] && MAIL_ONLY[by[root].kind]) return;"));
  const mc = fs.readFileSync(path.join(__dirname, '..', 'src', 'CueMailChat.gs'), 'utf8');
  assert.ok(mc.includes("'>' + id, cueMailSrc_(it, '')]") && mc.includes("pointers.forEach(p => cueChat_(p[0], p[1], p[2], p[3]));"), 'the post names its sender');
  const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexStyle.html'), 'utf8');
  assert.ok(/#msgs \.msg\[draggable\] \{ cursor:grab; -webkit-user-select:none; user-select:none;/.test(css));
});
test('JU7 an email asks why it was moved: This sender or All <type> emails or Just this one; the rule takes the reason picked and moves only lines that carry it', () => {
  const t = sandbox(), rows = () => t.tabs.Chat.rows.slice(1);
  t.ctx.cueChat_('Cue', 'New email · Jessica Allyn · Client', '>cue-1', 'mail:jessica@telus.com|type:Client');
  const m = t.ctx.cueState().chat[0];
  deq(JSON.parse(JSON.stringify(t.ctx.cueChanMove(m.time, 'Cue', m.text, 'job:bids'))), { ok: true, ask: true });
  t.ctx.cueChanAnswer(m.time, 'Cue', m.text, true, 'mail:jessica@telus.com');
  let R = JSON.parse(t.props.CUE_CHAN_RULES); deq(R.map(x => [x.src, x.chan]), [['mail:jessica@telus.com', 'job:bids']]);
  t.ctx.cueChat_('Cue', 'New email · Jessica Allyn · Client (2)', '>cue-2', 'mail:jessica@telus.com|type:Client');
  t.ctx.cueChat_('Cue', 'New email · Ben · Client', '>cue-3', 'mail:ben@x.com|type:Client');
  deq(JSON.parse(JSON.stringify(t.ctx.cueAdminChanRules())).map(x => [x.src, x.moved]), [['mail:jessica@telus.com', 1]], 'only Jessica\'s later email');
  const m2 = t.ctx.cueState().chat[2];
  deq(JSON.parse(JSON.stringify(t.ctx.cueChanMove(m2.time, 'Cue', m2.text, 'sys:updates'))).ask, true, 'Ben is not covered yet, so it asks');
  t.ctx.cueChanAnswer(m2.time, 'Cue', m2.text, true, 'nonsense');
  R = JSON.parse(t.props.CUE_CHAN_RULES); deq(R[1].src, 'mail:ben@x.com', 'an unknown reason falls back to the first source');
  assert.ok(JU_SRC.includes("'. Why here?</b>'") && JU_SRC.includes("'This sender'") && JU_SRC.includes("'All ' + p.slice(5) + ' emails'"));
  assert.ok(JU_SRC.includes("call('cueChanAnswer', [m.time, m.who, m.text, all, part]"));
  assert.ok(JU_SRC.includes('data-mv-why="1">Something else…</button>') && JU_SRC.includes("if (w) mvAnswer(m, true, 'words:' + w);"), 'Something else asks why and saves the words');
});
test('JU8 "Something else…": the words Kiko typed become the rule; a later email post with all of them moves, another email or a plain line does not', () => {
  const t = sandbox();
  t.ctx.cueChat_('Cue', 'New email · Jessica · RFQ - VIDEOGRAPHER for SITE ID', '>cue-1', 'mail:jessica@telus.com|type:Client');
  const m = t.ctx.cueState().chat[0];
  t.ctx.cueChanMove(m.time, 'Cue', m.text, 'job:bids'); t.ctx.cueChanAnswer(m.time, 'Cue', m.text, true, 'words:RFQ  Videographer!');
  deq(JSON.parse(t.props.CUE_CHAN_RULES).map(x => x.src), ['words:rfq videographer']);
  t.ctx.cueChat_('Cue', 'New email · Ben · rfq for a videographer', '>cue-2', 'mail:ben@x.com|type:Supplier');
  t.ctx.cueChat_('Cue', 'New email · Ana · RFQ for sound', '>cue-3', 'mail:ana@x.com|type:Client');
  t.ctx.cueChat_('Cue', 'RFQ videographer reminder', '', 'reminder');
  deq(JSON.parse(JSON.stringify(t.ctx.cueAdminChanRules())).map(x => [x.src, x.moved]), [['words:rfq videographer', 1]]);
  const c = {}; vm.runInNewContext(JU_SRC.slice(JU_SRC.indexOf('  function wordsHit('), JU_SRC.indexOf('  function srcParts(')) + '\nthis.f = wordsHit;', c);
  deq([c.f('words:rfq videographer', ['mail:b@x.com'], 'RFQ for a Videographer'), c.f('words:rfq videographer', ['reminder'], 'RFQ videographer'), c.f('words:rfq videographer', ['mail:b@x.com'], 'RFQ sound')], [true, false, false]);
});
