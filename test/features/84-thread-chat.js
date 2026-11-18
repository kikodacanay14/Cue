// Part of test/cue.test.js. Features approved by Kiko 3 Nov 2026 14:59Z ("yes yes tes"): chat format in threads, the Fold button
// inside the card, and accreditation chasers that leave out clients.
const tcPage = () => require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'IndexThreads.html'), 'utf8');
const tcFn = (page, name) => { const m = page.match(new RegExp('function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}\\n')); assert.ok(m, name + ' found'); return m[0]; };
const tcEsc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// The page's thread render with its helpers, and plain stand-ins for the card makers and the rest of the page.
function tcBox(min) {
  const vm = require('vm'), page = tcPage(), out = {};
  const code = page.match(/  var ACT_RE = [^\n]*\n/)[0] + tcFn(page, 'lineKind') + tcFn(page, 'learnHtml') + tcFn(page, 'msgHtml')
    + page.match(/  var FOLD_BTN = [^\n]*\n/)[0] + tcFn(page, 'foldIn') + tcFn(page, 'renderThread');
  const box = { esc: tcEsc, out, cardMin: min ? { root1: true } : {}, tbOpen: false, CLOSED: {}, WORK: {}, NEED: { 'Needs you': 1 },
    askOf: m => { const x = String(m.request_id || '').match(/^([?!])(ask-[0-9a-z]+)(?::([a-z,]*))?$/); return x ? { open: x[1] === '?', id: x[2], choices: (x[3] || '').split(',').filter(Boolean) } : null; },
    askHtml: m => /^\?ask/.test(m.request_id || '') ? '<div class="actions"><button>Keep</button><button>Undo</button></div>' : '',
    richText: tcEsc, tickText: m => tcEsc(m.text), msgWhen: () => '', replyTitle: () => '', workHtmlOf: () => '', wrongHtml: () => '', requestHtml: () => '',
    cardOf: r => '<div class="card"><b>' + r.id + '</b></div>', todayTasksHtml: () => '', threadTitle: () => 'Email to Infor', threadState: () => ({ need: true, text: 'Needs you' }),
    $: id => id, setHtml: (id, h) => { out[id] = h; }, bind: () => {}, flagBtn: () => '', moreBtn: () => '', isDismissed: () => false, lineFlagItem: () => null };
  vm.runInNewContext(code, box);
  return box;
}

test('THC1 a thread is a chat: Cue replies are bubbles, status lines are small one-liners, a Learned note is its own box; the main chat is unchanged', () => {
  const b = tcBox(), at = s => '2026-11-03T0' + s + ':00Z';
  b.renderThread({ root: 'root1', reqs: [], lines: [
    { who: 'Cue', text: 'Registering a supplier. GPT is reading it first; nothing is saved until you approve.', time: at('1:00'), request_id: 'cue-1' },
    { who: 'Kiko', text: 'why is it adding us as a supplier', time: at('2:00'), request_id: 'cue-1' },
    { who: 'Cue', text: 'Good catch, that\'s backwards. Infor is the client here.', time: at('3:00'), request_id: 'cue-1' },
    { who: 'Cue', text: 'Learned: "The sender\'s company is the client." It applies from your next message.', time: at('4:00'), request_id: '?ask-1:keep,undo' }] });
  const h = b.out.tmsgs;
  assert.ok(/<div class="msg cue act"[^>]*title="Registering a supplier[^"]*"><span class="who">Cue<\/span><span class="actx">Registering a supplier/.test(h), 'status line: ' + h.slice(0, 300));
  assert.ok(/<div class="msg cue"><span class="who">Cue<\/span>Good catch/.test(h), 'reply is a plain Cue bubble');
  assert.ok(/<div class="msg me"><span class="who">Kiko<\/span>why is it/.test(h), 'Kiko unchanged');
  assert.ok(/<div class="msg cue learn"><span class="who">Cue<\/span><span class="tag">Learned<\/span><span class="lt">&quot;The sender's company is the client.&quot;<\/span><span class="small muted">Applies from your next message.<\/span><div class="actions">/.test(h), 'Learned box: ' + h);
  b.out.x = b.msgHtml({ who: 'Cue', text: 'Rejected. Nothing was written to Canvas.', time: at('5:00'), request_id: 'cue-1' }, '');
  assert.ok(/^<div class="msg cue"><span class="who">Cue<\/span>Rejected\./.test(b.out.x), 'main chat keeps its look');
  const css = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'IndexStyle.html'), 'utf8');
  assert.ok(/#tmsgs \.msg\.cue \{ max-width:88%; background:var\(--panel\); border:1px solid var\(--line\); border-radius:12px 12px 12px 2px;/.test(css), 'bubble');
  assert.ok(/#tmsgs \.msg\.cue\.act \{[^}]*font-size:12px/.test(css) && /\.actx \{ display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; \}/.test(css), '12px, one line');
  assert.ok(/#tmsgs \.msg\.cue\.learn \{[^}]*background:#FFF8D9; border:1px dashed #F06A25;/.test(css), 'pale yellow, dashed BSE orange');
});

test('THC2 cards sit in the conversation where they were posted, so a done or rejected card does not stick to the bottom; Fold is inside each card', () => {
  const b = tcBox(), at = s => '2026-11-03T0' + s + ':00Z';
  const lines = [{ who: 'Cue', text: 'Registering a supplier.', time: at('1:00') }, { who: 'Cue', text: 'Ready for you: Blank Space Events OPC.', time: at('2:00') },
    { who: 'Cue', text: 'Rejected. Nothing was written to Canvas.', time: at('3:00') }, { who: 'Kiko', text: 'why is it adding us', time: at('4:00') }];
  b.renderThread({ root: 'root1', reqs: [{ id: 'SUPCARD', created: at('1:00'), card_at: '2026-11-03T02:00:01Z' }, { id: 'NEWER', created: at('5:00') }], lines });
  const h = b.out.tmsgs, i = s => h.indexOf(s);
  assert.ok(i('Ready for you') < i('SUPCARD') && i('SUPCARD') < i('Rejected.') && i('Rejected.') < i('why is it'), 'card after the line it came with: ' + h);
  assert.ok(i('why is it') < i('NEWER'), 'a later task\'s card comes after the conversation before it');
  assert.ok(/<div class="card"><button class="tfold" data-tmin="1" aria-label="Fold the card"><svg[^>]*>.*?<\/svg>Fold<\/button><b>SUPCARD/.test(h), 'Fold sits inside the card');
  assert.strictEqual(b.out.tdock, '', 'no bar while open');
  assert.strictEqual(b.foldIn('<details class="card"><summary>x</summary></details>').indexOf('<div class="tcardw"><button class="tfold"'), 0, 'another shape gets a box with the button');
  const f = tcBox(true); f.renderThread({ root: 'root1', reqs: [{ id: 'SUPCARD', created: at('1:00') }], lines });
  assert.ok(!/SUPCARD/.test(f.out.tmsgs) && /Ready for you/.test(f.out.tmsgs), 'folded: the card leaves the conversation');
  assert.ok(/<button class="tdock" data-tmin="0"[^>]*><span class="tdt">Email to Infor<\/span><span class="need">Needs you<\/span>/.test(f.out.tdock), 'folded: one bar above the reply box');
  assert.ok(!/tcards-bar/.test(tcPage()), 'the old chevron above the card is gone');
});

test('THC3 accreditation chasers leave out a row whose name is a client in Canvas Accounts; when Canvas cannot say, the row stays', () => {
  const t = accrBox({ deskClients: ['Build Co'] }); t.ctx.cueSweep();
  const it = accrItems(batchOf(t));
  assert.ok(!it.some(i => i.who === 'Build Co'), 'a client is not chased as a supplier');
  assert.ok(it.some(i => i.who === 'Sonic Pro') && it.some(i => i.who === 'No Mail Co'), 'suppliers still chased');
  deq(t.log.deskCheck.map(a => a.company).sort(), ACCR.rows.map(r => r.supplier).sort(), 'one read-only check per row');
  assert.ok(t.log.deskCheck.every(a => !bridgeCheck('client_check', a)), 'arguments fit the real bridge schema');
  const u = accrBox({ deskUnknown: true }); u.ctx.cueSweep();
  assert.ok(accrItems(batchOf(u)).some(i => i.who === 'Build Co'), 'an older Canvas: nothing left out');
});

test('THC4 the chasers card says one true thing about sending: Send on a picked line, Approve and send for the ticked ones; never "each email goes only when you press Send" next to a 9:00 send', () => {
  const pages = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'IndexPages.html'), 'utf8');
  const card = pages.match(/function sweepCardHtml\(r\) \{[\s\S]*?\n  \}\n/)[0];
  assert.ok(!/'\. Pick in the 2 PM update; each email goes only when you press Send/.test(card), 'the contradicting header is gone');
  assert.ok(/\(taps \? ' Pick in the 2 PM update; a picked email goes only when you press Send\.' : ''\) \+ \(mail \? ' Ticked emails go only after you tap Approve and send\.' : ''\)/.test(card));
  assert.ok(/Approve and send makes them now and sends the ticked ones at 9:00/.test(card), 'the footer still says when');
});

test('THC5 shops and booking sites (Kiko 3 Nov 23:37Z "yes"): Booking.com, Shell and Autosweep are not chased for accreditation and not checked against Client Desk', () => {
  const extra = ['Booking.com', 'Shell', 'Shell / Autosweep RFID'].map(n => Object.assign({}, ACCR.rows[1], { supplier: n }));
  const t = accrBox({ accr: Object.assign({}, ACCR, { rows: ACCR.rows.concat(extra) }) }); t.ctx.cueSweep();
  const it = accrItems(batchOf(t));
  assert.ok(!it.some(i => /booking|shell|autosweep/i.test(i.who)), 'skipped: ' + it.map(i => i.who).join(', '));
  assert.ok(it.some(i => i.who === 'Build Co') && it.some(i => i.who === 'Sonic Pro'), 'suppliers still chased');
  assert.ok(!t.log.deskCheck.some(a => /booking|shell/i.test(a.company)), 'no Canvas call for them');
});
