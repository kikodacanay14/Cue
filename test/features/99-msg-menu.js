// Part of test/cue.test.js. Feature: CUE-MSG-MENU-2026-11-18 (src/IndexThreads.html moreBtn/menusShut/dismissKey/disAskHtml/chanUndo,
// src/CueFlags.gs cueDismiss/cueDismissed_, src/CueChannels.gs cueChanUndo, src/IndexStyle.html .msgmenu). Kiko 18 Nov 2026 10:13:48Z
// "for the messages we should have a ... and when clicked it would show Reply, Flag or (whats a term for do not include anymore)";
// 10:14:18Z "im okay with dismiss - it will then ask a reason why right?".
const MM_SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexThreads.html'), 'utf8');
test('MM1 Dismiss keeps one row per message in the Dismissed tab; Undo removes it; the page gets the keys; a bad key is refused', () => {
  const t = sandbox(), J = x => JSON.parse(JSON.stringify(x));
  const a = { key: 'r:cue-abc123', who: 'Account Specialist', time: '2026-11-18T07:00:00.000Z', text: 'Handover ready' };
  t.ctx.cueDismiss(a, true); const l = J(t.ctx.cueDismiss(a, true));
  deq(l, ['r:cue-abc123'], 'twice adds nothing');
  deq(J(t.ctx.cueState()).dismissed, ['r:cue-abc123']);
  deq(J(t.ctx.cueDismiss(a, false)), [], 'Undo');
  assert.throws(() => t.ctx.cueDismiss({ key: 'x:<b>' }, true), /which message/);
  assert.ok(/'cueFlag', 'cueDismiss', 'cueChanUndo'/.test(fs.readFileSync(path.join(__dirname, '..', 'src', 'CueCheck.gs'), 'utf8')), 'never run by the cloud check');
});
test('MM2 a General line dismissed goes to the hidden channel; Undo brings it back; Undo on a line that was not dismissed is refused', () => {
  const t = sandbox(), rows = () => t.tabs.Chat.rows.slice(1);
  t.ctx.cueChat_('Cue', 'Messenger welcome screen not set (token expired). Cue tries again every hour.', '', 'msgr-setup');
  const m = t.ctx.cueState().chat[0];
  deq(JSON.parse(JSON.stringify(t.ctx.cueChanMove(m.time, 'Cue', m.text, 'sys:dismissed'))), { ok: true, ask: true }, 'asks why');
  deq(rows()[0][6], 'sys:dismissed?');
  t.ctx.cueChanUndo(m.time, 'Cue', m.text); deq(rows()[0][6], '', 'back in General');
  assert.throws(() => t.ctx.cueChanUndo(m.time, 'Cue', m.text), /not dismissed/);
});
test('MM3 the ⋯ menu: Reply only when the message names a task, Flag or Unflag, Dismiss; a flagged message keeps its filled flag beside the ⋯', () => {
  const a = MM_SRC.indexOf('  var flagMap = {};'), z = MM_SRC.indexOf("  document.addEventListener('click'", a);
  const b = MM_SRC.indexOf('  function isDismissed('), e = MM_SRC.indexOf('  function menusShut(');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const ctx = { esc, noTok: x => x, icon: n => '<svg data-i="' + n + '"></svg>', state: { chat: [], flags: [], dismissed: [] } };
  vm.runInNewContext(MM_SRC.slice(a, z) + MM_SRC.slice(b, e) + '\nthis.moreBtn = moreBtn; this.isDismissed = isDismissed;', ctx);
  const it = { key: 'l:2026-11-18T08:00:00.000Z|Cue', who: 'Cue', time: '2026-11-18T08:00:00.000Z', text: 'x' };
  let h = ctx.moreBtn({ reply: 'cue-1', flag: it });
  assert.ok(/data-more="1"/.test(h) && /data-i="more"/.test(h) && /<div class="msgmenu" role="menu" hidden>/.test(h));
  assert.ok(h.indexOf('>Reply<') < h.indexOf('>Flag<') && h.indexOf('>Flag<') < h.indexOf('>Dismiss<'), 'Reply, Flag, Dismiss in that order');
  assert.ok(!/class="rp fl/.test(h), 'no flag beside the ⋯ until flagged');
  assert.ok(/data-reply-q="l:2026-11-18T08:00:00.000Z\|Cue">Reply</.test(ctx.moreBtn({ reply: '', flag: it })), 'Reply on every message: no task means a quoted reply (Kiko 10:22:25Z)');
  deq(ctx.moreBtn({ reply: '', flag: null }), '', 'Kiko\'s own line: no ⋯');
  ctx.state.flags = [{ key: it.key }]; h = ctx.moreBtn({ reply: '', flag: it });
  assert.ok(/class="rp fl on"/.test(h) && />Unflag</.test(h));
  ctx.state.dismissed = [it.key]; assert.ok(ctx.isDismissed(it.key) && !ctx.isDismissed(''));
});
test('MM4 wiring: a dismissed message shows nowhere (General, channels, agent bubbles, counts); a General line asks why with the move reasons; others show Undo', () => {
  assert.ok(MM_SRC.includes("var fit = lineFlagItem(m); if (fit && isDismissed(fit.key)) return dismissedHtml(fit.key);"));
  assert.ok(MM_SRC.includes("if (isDismissed('r:' + r.id)) return dismissedHtml('r:' + r.id);"));
  assert.ok(MM_SRC.includes("if (isDismissed('r:' + r.id)) return false;   // CUE-MSG-MENU-2026-11-18"), 'out of the count');
  assert.ok(MM_SRC.includes("if (c === 'sys:dismissed') return;   // CUE-MSG-MENU-2026-11-18"), 'joins no channel');
  assert.ok(MM_SRC.includes("if (mk && msg.hasAttribute('draggable')) return chanMove(mvRef[Number(mk)], 'sys:dismissed');"), 'a General line uses the move, so it asks why');
  assert.ok(/<b>Dismissed\. Why\?<\/b>/.test(MM_SRC) && /Just this one/.test(MM_SRC) && /'This sender'/.test(MM_SRC) && MM_SRC.includes("'Why dismiss it?'"));
  assert.ok(MM_SRC.includes("'sys:dismissed': 'Hidden (dismissed)'"), 'Settings › Channel rules names it');
  assert.ok(MM_SRC.includes("if (!rp && replyQ && box === $('box')) { t = withQuote(replyQ, t); setReply(''); }") && MM_SRC.includes("function withQuote(q, t) { return 'Replying to ' + q + '\\n\\n' + t; }"), 'a quoted reply goes out with the quote first');
  assert.ok(MM_SRC.includes("This subject</button>") && MM_SRC.includes("(subj ? 'Just this email' : 'Just this one')"), 'Kiko 10:17:14Z: just that email, the subject, the sender');
  const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexStyle.html'), 'utf8');
  assert.ok(/\.msg \.msgmenu \{ position:absolute;/.test(css) && /\.msg \.rp\.more \+ \.rp\.fl \{ right:-76px; \}/.test(css));
});
test('MM5 Move in the ⋯ menu (Kiko 18 Nov 2026 13:45:47Z): a draggable General line gets Move after Reply; it opens the Move to… list; drag still works', () => {
  const a = MM_SRC.indexOf('  function mvKey('), z = MM_SRC.indexOf('  function movedHtml(');
  const m = { who: 'Cue', time: '2026-11-18T08:00:00.000Z', text: 'x' };
  const ctx = { askOf: () => null, state: { chat: [m] } };
  vm.runInNewContext('var justMoved = {}, mvRef = [];\n' + MM_SRC.slice(a, z) + '\nthis.mvAttr = mvAttr; this.mvRef = mvRef;', ctx);
  const menu = '<div class="msgmenu" role="menu" hidden><button role="menuitem" data-reply-q="k">Reply</button><button role="menuitem" data-flag="k">Flag</button><button role="menuitem" data-dismiss="k">Dismiss</button></div>';
  const h = ctx.mvAttr('<div class="msg cue">x' + menu + '</div>', m);
  assert.ok(/^<div draggable="true" data-mvk="0" class="msg /.test(h), 'still draggable');
  assert.ok(h.indexOf('>Reply<') < h.indexOf('data-mv-open="0">Move<') && h.indexOf('>Move<') < h.indexOf('>Flag<'), 'Reply, Move, Flag, Dismiss');
  const own = ctx.mvAttr('<div class="msg me">y' + menu + '</div>', { who: 'Kiko', time: 't', text: 'y' });
  assert.ok(!/>Move</.test(own), 'a line that cannot move has no Move');
  assert.ok(MM_SRC.includes("var o = mvRef[Number(b.getAttribute('data-mv-open'))]; if (o) mvSheet(o);"), 'Move opens the Move to… list');
  const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexStyle.html'), 'utf8');
  assert.ok(/@media \(min-width:641px\) \{ \.mvsheet \{ left:50%;/.test(css), 'a small centred box on a PC');
});
