// Part of test/cue.test.js. Feature: CUE-DRAG-TO-CHANNEL-2026-11-18 (src/CueChannels.gs, cueChat_ source column F, cueState chat src/mv
// and chan_rules; IndexThreads.html lineChan/threads/renderMain movedHtml, drag and the phone "Move to…" sheet; IndexPages.html Channel
// rules). Kiko 18 Nov 2026 04:31:41Z "Messages in General Chat can i drag and drop them to a channel? That would then become a rule that
// messages like those should be moved to that channel"; 05:08:40Z chose "By where it came from"; mockup approved "okay" 05:20:38Z.
const DC_SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexThreads.html'), 'utf8');
function dcThreads(reqs, lines, rules) {
  const page = cuePage(), ctx = {}; vm.createContext(ctx);
  vm.runInContext(page.match(/  function agdLabel\(v\) \{[^\n]*\n/)[0], ctx);
  const a = DC_SRC.indexOf('  function rootOf('), z = DC_SRC.indexOf('\n  }\n', DC_SRC.indexOf('  function threads(')) + 4;
  const c = { state: { requests: reqs, chat: lines, chan_rules: rules || [] }, agdLabel: ctx.agdLabel, allLines: () => lines || [], askOf: () => null };
  vm.runInNewContext("function byId() { var o = {}; state.requests.forEach(function (r) { o[r.id] = r; }); return o; }\n" + DC_SRC.slice(a, z)
    + '\nthis.t = threads(); this.lineChan = lineChan; this.chanAt = chanAt;', c);
  return c;
}
const dcBox = () => { const t = sandbox(); return { t, rows: () => t.tabs.Chat.rows.slice(1) }; };

test('DC1 Cue tags its own General posts with where they came from (column F); other lines keep four columns', () => {
  const b = dcBox();
  b.t.ctx.cueChat_('Cue', 'Messenger welcome screen not set (token expired). Cue tries again every hour.', '', 'msgr-setup');
  b.t.ctx.cueChat_('Cue', 'Hello', '');
  b.t.ctx.cueChat_('Cue', 'Started.', '>cue-1');
  const R = b.rows();
  deq([R[0].length, R[0][4], R[0][5]], [6, '', 'msgr-setup']);
  deq([R[1].length, R[2].length], [4, 4]);
  const chat = b.t.ctx.cueState().chat;
  deq(chat.map(m => m.src || ''), ['msgr-setup', '', '']);
  // every General post Cue writes itself names its source
  const code = fs.readdirSync(path.join(__dirname, '..', 'src')).filter(f => /\.gs$/.test(f)).map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n');
  const keys = [...code.matchAll(/cueChat_\('Cue',(?:(?!cueChat_\(|\n\s*(?:function|const|let|if|return)\b)[\s\S])*?'', (?:cueMailSrc_\(\w+, )?'([a-z-]+)'\)/g)].map(m => m[1]);
  deq([...new Set(keys)].sort((x, y) => x.localeCompare(y)), ['bids', 'chaserrules', 'closeolder', 'editlog', 'funnel', 'mail-project', 'mail-type', 'msgr-crew', 'msgr-link', 'msgr-setup', 'msgr-triage',
    'reminder', 'route', 'sched', 'servicedesk', 'sweep', 'ticktick', 'unsched']);
  const names = DC_SRC.slice(DC_SRC.indexOf('  var SRC_NAME = {'), DC_SRC.indexOf('  function srcName('));
  keys.forEach(k => assert.ok(names.includes(k + "'") || names.includes(' ' + k + ':'), 'a plain name for ' + k));
});

test('DC2 a move: column G holds the channel with "?" while the question is open; "Yes, always" saves the rule; a later line from the same source counts as moved', () => {
  const b = dcBox();
  b.t.ctx.cueChat_('Cue', 'Messenger welcome screen not set (a).', '', 'msgr-setup');
  const m = b.t.ctx.cueState().chat[0];
  assert.throws(() => b.t.ctx.cueChanMove(m.time, 'Cue', m.text, 'General'), /not a channel/);
  assert.throws(() => b.t.ctx.cueChanMove('2020-01-01T00:00:00.000Z', 'Cue', m.text, 'sys:alerts'), /no longer in the chat/);
  deq(JSON.parse(JSON.stringify(b.t.ctx.cueChanMove(m.time, 'Cue', m.text, 'sys:alerts'))), { ok: true, ask: true });
  deq(b.rows()[0][6], 'sys:alerts?');
  deq(b.t.ctx.cueState().chat[0].mv, 'sys:alerts?');
  b.t.ctx.cueChanAnswer(m.time, 'Cue', m.text, true);
  deq(b.rows()[0][6], 'sys:alerts');
  const rules = JSON.parse(b.t.props.CUE_CHAN_RULES);
  deq([rules.length, rules[0].src, rules[0].chan, !!rules[0].at, 'off' in rules[0]], [1, 'msgr-setup', 'sys:alerts', true, false]);
  b.t.ctx.cueChat_('Cue', 'Messenger welcome screen not set (b).', '', 'msgr-setup');
  b.t.ctx.cueChat_('Cue', 'Unscheduled check: everything is scheduled.', '', 'unsched');
  const L = JSON.parse(JSON.stringify(b.t.ctx.cueAdminChanRules()));
  deq(L.map(x => [x.src, x.chan, x.moved]), [['msgr-setup', 'sys:alerts', 1]], 'the moved line itself is a per-line move, not counted twice');
  deq(JSON.parse(JSON.stringify(b.t.ctx.cueState().chan_rules)).length, 1);
});

test('DC3 "Just this one" saves no rule; a line with no source asks nothing; removing a rule keeps its entry with off and drops it from the list', () => {
  const b = dcBox();
  b.t.ctx.cueChat_('Cue', 'Unscheduled check: everything is scheduled.', '', 'unsched');
  b.t.ctx.cueChat_('Cue', 'Plain line', '');
  const [a, p] = b.t.ctx.cueState().chat;
  b.t.ctx.cueChanMove(a.time, 'Cue', a.text, 'sys:updates'); b.t.ctx.cueChanAnswer(a.time, 'Cue', a.text, false);
  deq([b.rows()[0][6], b.t.props.CUE_CHAN_RULES || '[]'], ['sys:updates', '[]']);
  deq(JSON.parse(JSON.stringify(b.t.ctx.cueChanMove(p.time, 'Cue', p.text, 'job:bids'))), { ok: true, ask: false });
  deq([b.rows()[0][6], b.rows()[1][6]], ['sys:updates', 'job:bids'], 'two lines in the same millisecond are told apart by their text');
  b.t.ctx.cueChanMove(a.time, 'Cue', a.text, 'sys:updates'); b.t.ctx.cueChanAnswer(a.time, 'Cue', a.text, true);
  deq(JSON.parse(JSON.stringify(b.t.ctx.cueChanRuleDel('unsched'))), []);
  const r = JSON.parse(b.t.props.CUE_CHAN_RULES);
  deq([r.length, r[0].src, !!r[0].off], [1, 'unsched', true]);
  assert.ok(/'cueChanMove', 'cueChanAnswer'/.test(fs.readFileSync(path.join(__dirname, '..', 'src', 'CueCheck.gs'), 'utf8')), 'never run by the cloud check');
});

test('DC4 the page: a moved line and a line its rule covers join the channel (not General, not Alerts); a rule covers only lines from while it was on; no channel in the list keeps it in General', () => {
  const reqs = [{ id: 'b1', kind: 'bids', created: '2026-11-17' }, { id: 'r1', kind: 'relnotes', created: '2026-11-17' }];
  const L = [
    { who: 'Cue', request_id: '', text: 'Messenger welcome screen not set (old)', src: 'msgr-setup', time: '2026-11-18T01:00:00.000Z' },
    { who: 'Cue', request_id: '', text: 'Messenger welcome screen not set (new)', src: 'msgr-setup', time: '2026-11-18T06:00:00.000Z' },
    { who: 'Cue', request_id: '', text: 'Messenger welcome screen not set (after off)', src: 'msgr-setup', time: '2026-11-18T09:00:00.000Z' },
    { who: 'Cue', request_id: '', text: 'Unscheduled check: everything is scheduled.', src: 'unsched', time: '2026-11-18T05:00:00.000Z', mv: 'sys:updates?' },
    { who: 'Cue', request_id: '', text: 'Reminder: call the venue', src: 'reminder', time: '2026-11-18T05:30:00.000Z', mv: 'job:funnel' },
    { who: 'Cue', request_id: '', text: 'The sweep did not run: x', src: 'sweep', time: '2026-11-18T05:40:00.000Z' }];
  const c = dcThreads(reqs, L, [{ src: 'msgr-setup', chan: 'job:bids', at: '2026-11-18T05:00:00.000Z', off: '2026-11-18T08:00:00.000Z' }]);
  deq(L.map(m => c.lineChan(m)), ['', 'job:bids', '', 'sys:updates', 'job:funnel', '']);
  deq(c.t.b1.lines.map(m => m.text), ['Messenger welcome screen not set (new)']);
  deq(c.t.r1.lines.map(m => m.text), ['Unscheduled check: everything is scheduled.']);
  deq(c.t['sys:alerts'].lines.map(m => m.text), ['The sweep did not run: x'], 'the old and the after-off Messenger lines are General, not alerts');
  deq([c.chanAt(c.t, 'job:funnel'), c.chanAt(c.t, 'sys:alerts'), c.chanAt(c.t, 'job:bids')], ['', 'sys:alerts', 'b1'], 'Sales funnel has no channel yet, so its line stays in General');
});

test('DC5 General: a moved line leaves only the approved question (Just this one / Yes, always, bottom right) or "Moved to X."; only Cue\'s saved lines can be dragged; drop targets are Jobs and Systems rows', () => {
  const m = DC_SRC.slice(DC_SRC.indexOf('  function renderMain(th) {'), DC_SRC.indexOf('  function renderMain(th) {') + 2500);
  assert.ok(/if \(mc && chanAt\(th, mc\)\) \{ h \+= movedHtml\(m, mc, th\); return; \}/.test(m));
  assert.ok(DC_SRC.includes("'<div class=\"card mvask\"' + mvTag(m) + '><b>Moved to ' + esc(nm) + '</b>'") && DC_SRC.includes("Also send future <b>' + esc(srcName(m.src)) + '</b> messages to ' + esc(nm) + '? You can remove this in Settings › Channel rules.</div>'"));
  assert.ok(DC_SRC.includes('<button class="btn ghost" data-mv-ans="0">Just this one</button><button class="btn" data-mv-ans="1">Yes, always</button>'));
  assert.ok(/\.card\.mvask \.actions \{ justify-content:flex-end; \}/.test(fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexStyle.html'), 'utf8')));
  assert.ok(DC_SRC.includes("if (m.who === 'Kiko' || !m.time || askOf(m) || !state.chat.some(function (x) { return x === m; })) return html;"));
  assert.ok(DC_SRC.includes("var dc = th[x.k] && /^(job|sys):/.test(th[x.k].chan || '') ? ' data-chan=\"' + esc(th[x.k].chan) + '\"' : '';"));
  assert.ok(DC_SRC.includes("mvPress = setTimeout(function () { mvPress = 0; mvSheet(mvRef[Number(m.getAttribute('data-mvk'))]); }, 500);"), 'phone: long press 500 ms');
  assert.ok(DC_SRC.includes("var h = '<div class=\"mvdim\" data-mv-x=\"1\"></div><div class=\"mvsheet\" role=\"dialog\" aria-label=\"Move to\"><div class=\"hd\">Move to…</div>'"));
});

test('DC6 Cue Admin › Channel rules: under Rules before Triage; Source, Goes to, Added, Moved, Remove; headers and short columns centred; Remove asks first', () => {
  const page = cuePage(), pages = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexPages.html'), 'utf8'), css = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexStyle.html'), 'utf8');
  assert.ok(page.includes('<button data-s="chanrules">Channel rules</button><button data-s="triage">Triage</button>'));
  assert.ok(page.includes('<section data-sec="chanrules" hidden>'));
  assert.ok(pages.includes("'<div class=\"card\"><table class=\"chr\"><thead><tr><th>Source</th><th>Goes to</th><th>Added</th><th>Moved</th><th></th></tr></thead><tbody>'"));
  assert.ok(/table\.chr th \{[^}]*text-align:center; vertical-align:middle;/.test(css) && /table\.chr td \{[^}]*vertical-align:middle; text-align:center; \} table\.chr td\.l \{ text-align:left; \}/.test(css));
  assert.ok(pages.includes("ask('Remove the rule for ' + srcName(src) + '?', 'New messages from it stay in General. Messages it already moved stay in their channel.', null, 'Remove',"));
});
