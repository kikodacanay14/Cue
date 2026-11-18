// Part of test/cue.test.js. Feature: CUE-FLAG-2026-11-18 (src/CueFlags.gs cueFlag/cueFlags_, src/IndexThreads.html flagBtn/flagToggle/
// flagRowHtml/flaggedHtml). Kiko 18 Nov 2026 08:47:46Z "add a feature that allows me to Flag a message. Flagged message now goes to a
// thread named Flagged"; 08:48:00Z "when an item is Flagged i can also Unflag it".
const FL_SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexThreads.html'), 'utf8');
test('FLAG1 Flag keeps one row per message in the Flagged tab, newest first; flagging twice adds nothing; Unflag removes it; a bad key is refused', () => {
  const t = sandbox(), J = x => JSON.parse(JSON.stringify(x));
  const a = { key: 'l:2026-11-18T08:00:00.000Z|Cue', from: 'Updates', who: 'Cue', time: '2026-11-18T08:00:00.000Z', text: 'Sales update: 2 accounts moved', thread: 'k0a' };
  const b = { key: 'r:cue-abc123', from: 'Account Specialist', who: 'Account Specialist', time: '2026-11-18T07:00:00.000Z', text: 'Handover ready', thread: 'as1' };
  t.ctx.cueFlag(a, true); t.ctx.cueFlag(a, true);
  let l = J(t.ctx.cueFlag(b, true));
  assert.deepStrictEqual(l.map(x => x.key), [b.key, a.key], 'newest first, no duplicate');
  assert.strictEqual(l[1].text, a.text); assert.strictEqual(l[1].thread, 'k0a'); assert.strictEqual(l[0].kind, 'agent');
  assert.deepStrictEqual(J(t.ctx.cueState()).flags.map(x => x.key), [b.key, a.key], 'the page gets them');
  l = J(t.ctx.cueFlag(a, false));
  assert.deepStrictEqual(l.map(x => x.key), [b.key], 'unflagged');
  assert.throws(() => t.ctx.cueFlag({ key: 'x:<script>' }, true));
  assert.ok(/'cueSeen', 'cueFlag'/.test(fs.readFileSync(path.join(__dirname, '..', 'src', 'CueCheck.gs'), 'utf8')), 'never run by the cloud check');
});
test('FLAG2 the page: a flag beside Cue and agent messages (not Kiko\'s), filled while flagged; Flagged under General lists them with Open and Unflag', () => {
  const a = FL_SRC.indexOf('  var flagMap = {};'), z = FL_SRC.indexOf('  document.addEventListener(\'click\'', a);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const line = { who: 'Cue', time: '2026-11-18T08:00:00.000Z', text: 'Sales update', request_id: '' };
  const ctx = { esc, noTok: x => x, icon: () => '<svg></svg>', ago: () => '5m ago', msgWhen: () => '', openThread: '',
    state: { chat: [line, { who: 'Kiko', time: '2026-11-18T08:01:00.000Z', text: 'ok' }], flags: [] } };
  vm.runInNewContext(FL_SRC.slice(a, z) + '\nthis.f = { lineFlagItem, flagBtn, flagRowHtml, flaggedHtml };', ctx);
  const f = ctx.f;
  assert.strictEqual(f.lineFlagItem(ctx.state.chat[1]), null, 'Kiko\'s own line has no flag');
  assert.strictEqual(f.lineFlagItem({ who: 'Cue', time: 'x', text: 'not saved' }), null, 'only saved lines');
  const it = f.lineFlagItem(line), off = f.flagBtn(it);
  assert.ok(/data-flag="l:2026-11-18T08:00:00.000Z\|Cue"/.test(off) && /aria-pressed="false"/.test(off) && /Flag this message/.test(off));
  assert.ok(/Flag a message to get back to it later/.test(f.flagRowHtml()) && /data-thread="sys:flagged"/.test(f.flagRowHtml()));
  assert.ok(/Nothing flagged/.test(f.flaggedHtml()));
  ctx.state.flags = [{ key: it.key, at: '2026-11-18T08:05:00Z', who: 'Cue', from: 'Updates', time: line.time, text: 'Sales update', thread: 'k0a' }];
  assert.ok(/ on"/.test(f.flagBtn(it)) && /Unflag this message/.test(f.flagBtn(it)), 'filled while flagged');
  assert.ok(/1 message to get back to/.test(f.flagRowHtml()));
  const h = f.flaggedHtml();
  assert.ok(/Cue · Updates/.test(h) && /data-flag-open="k0a">Open</.test(h) && /data-flag="l:[^"]+">Unflag</.test(h), h);
  assert.ok(h.indexOf('Open') < h.indexOf('Unflag'), 'Unflag last, bottom right');
});
test('FLAG3 wiring: Flagged opens as a list with no reply box; the flag sits on chat bubbles and agent bubbles', () => {
  const chat = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexChat.html'), 'utf8');
  assert.ok(chat.includes("openThread === 'sys:flagged';   // CUE-FLAG-2026-11-18"));
  assert.ok(FL_SRC.includes("if (t.flagged) { setHtml($('tdock'), ''); setHtml($('tmsgs'), flaggedHtml()); return; }"));
  assert.ok(FL_SRC.includes("+ flagBtn(lineFlagItem(m)) + '</div>';"));
  assert.ok(FL_SRC.includes("flagBtn({ key: 'r:' + r.id,"));
  assert.ok(FL_SRC.includes("if (!showArchived && (!tq || 'flagged'.indexOf(tq) >= 0)) h += flagRowHtml();"));
});
test('PU1 Process Updates: first group with CRM and one Project Updates channel for client intakes; a reply box in a many-run channel names the run it goes to', () => {
  assert.ok(FL_SRC.includes("if (r.kind === 'intake') return 'proc:projects';") && FL_SRC.includes("'proc:projects': 'Project Updates'"));
  assert.ok(FL_SRC.includes("[['proc', 'Process Updates'], ['agent', 'Agent Updates'],"));
  assert.ok(FL_SRC.includes("var extra = cvRows.filter(function (r) { return g[0] === (r.k === 'crm' ? 'proc' : 'job'); });"), 'CRM in Process Updates, To do in Jobs');
  assert.ok(FL_SRC.includes("'Reply to the newest: ' + String(replyTitle(last.id) || kindName(last)).slice(0, 60)"));
  assert.ok(/function threadRef\(\) \{[^\n]*th\.reqs\[th\.reqs\.length - 1\]/.test(FL_SRC), 'the reply goes to that same newest run');
});
