// Part of test/cue.test.js. Feature: CUE-ONE-BAR-2026-11-25 (Kiko 25 Nov 2026, screenshots of the Account Specialist channel inside
// Canvas: "make the header like Cue > Channels > Account Specialist - like a breadcrumb and should be clickable to navigate"; "There
// are 2 x for Close? Retain 1 only"; "remove the Archive button already"; "Please change the hover effect - font cant be read";
// "Remove the 'Messges here go to...."; "Yes, all Cue" to the Canvas font. Mockup approved "Approve all", build approved "Yes, build it").
const OB = { page: require(path.join(__dirname, 'page.js')).cuePage(), src: f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8') };
test('OB1 breadcrumb: the list, General and a channel each show Cue › Channels › name; Cue opens General and Channels opens the list', () => {
  const index = OB.src('Index.html'), th = OB.src('IndexThreads.html'), viewer = OB.src('IndexViewer.html');
  assert.ok(/<div class="lhead" id="lhead"><span class="crumb"><button type="button" id="l-home">Cue<\/button><span class="sep" aria-hidden="true">›<\/span><span class="t" aria-current="page">Channels<\/span><\/span>/.test(index), 'list header');
  assert.ok(/<span class="crumb"><button type="button" id="gen-home">Cue<\/button><span class="sep" aria-hidden="true">›<\/span><button type="button" id="gen-back">Channels<\/button><span class="sep" aria-hidden="true">›<\/span><span class="t" aria-current="page">General<\/span><\/span>/.test(index), 'General header');
  assert.ok(th.includes(`'<span class="sep" aria-hidden="true">›</span><span class="t" aria-current="page" title="' + esc(name) + '">' + esc(name) + '</span></span>'`), 'the channel name is the last part and is not a button');
  assert.ok(viewer.includes("$('gen-home').onclick = $('l-home').onclick = goGeneral;") && viewer.includes("if (p === 'close') return goGeneral();") && viewer.includes("if (p === 'pane') return showList();"), 'Cue goes to General, Channels to the list');
});
test('OB2 one close only and no Archive button: the channel header draws neither the ✕ nor the three dots', () => {
  const th = OB.src('IndexThreads.html'), head = th.slice(th.indexOf('function renderPaneTabs'), th.indexOf("setHtml($('ptabs'), h)"));
  assert.ok(head.length > 200, 'found the header builder');
  assert.ok(!/pane-x/.test(head) && !/Back to General/.test(head), 'no second close');
  assert.ok(!/data-p="task"/.test(head) && !/'Archive'/.test(head), 'no three-dot Archive button');
  assert.ok(/'check', 'Close this thread'/.test(head), 'the close-thread tick stays');
});
test('OB3 hover on a coloured channel bar is a tint that keeps the text readable, never the white panel colour', () => {
  const css = OB.src('IndexStyle.html');
  assert.ok(/#ptabs\.cat-crm button:hover, #ptabs\.cat-gen button:hover,[^{]*\{ background:rgba\(255,255,255,\.16\); color:#fff; \}/.test(css), 'white text on a light tint');
  assert.ok(/#ptabs\.cat-proj button:hover,[^{]*\{ background:rgba\(22,21,27,\.1\); color:#16151B; \}/.test(css), 'ink text on the blue bar');
});
test('OB4 the "Messages here go to ... only" line is never shown', () => {
  assert.ok(/\$\('tagnote'\)\.hidden = true;/.test(OB.page) && !/'Messages here go to /.test(OB.page), 'the sentence is no longer built');
});
test('OB5 all of Cue uses the Canvas font: DM Sans is loaded and named, Quicksand is not', () => {
  assert.ok(/fonts\.googleapis\.com\/css2\?family=DM\+Sans:/.test(OB.src('Index.html')) && /--font:'DM Sans', system-ui/.test(OB.src('IndexStyle.html')));
  assert.ok(!/family=Quicksand/.test(OB.page) && !/'Quicksand'/.test(OB.page) && !/Quicksand/.test(OB.src('CueTemplates.gs')), 'no Quicksand in the page or the email templates');
});
test('OB6 a channel\'s chat box is General\'s: paper clip, text box and a Send button in one row, on the same ground', () => {
  const index = OB.src('Index.html'), css = OB.src('IndexStyle.html');
  const t = index.slice(index.indexOf('<div class="tcomposer" id="tcomposer"'), index.indexOf('</aside>', index.indexOf('id="tcomposer"')));
  assert.ok(/<div class="row">\s*<button class="btn ghost attach" id="tattach"[^>]*>📎<\/button>\s*<textarea id="tbox"[^>]*><\/textarea>\s*<button class="btn" id="tsend">Send<\/button>\s*<\/div>/.test(t), t);
  assert.ok(!/class="rbox"|class="rtools"/.test(t), 'the old boxed input and the tools row are gone');
  assert.ok(/<button class="btn ghost attach" id="attach"[^>]*>📎<\/button>/.test(index) && /<button class="btn" id="send">Send<\/button>/.test(index), 'General uses the same controls');
  assert.ok(/\n  \.tcomposer \{ flex:none; background:var\(--head\); border-top:1px solid var\(--line\); padding:10px 16px; \}/.test(css) && /\n  \.composer \{ background:var\(--head\); border-top:1px solid var\(--line\); padding:10px 16px; \}/.test(css), 'same ground, line and padding');
  assert.ok(OB.page.includes("$('tsend').onclick = function () { if (openThread) sendFrom($('tbox'), 'tfiles', threadRef()); };") && OB.page.includes("$('tattach').onclick = function () { hostFiles('tfiles'); $('picker').click(); };"), 'send and attach still do what they did');
});
test('OB7 General: each labelled message has a 4px colour stripe on its left and its label at the upper right', () => {
  const css = OB.src('IndexStyle.html');
  assert.ok(/body\.cue-stream #msgs > \.msg\.cue:has\(\.stream-pill\) \{ border-inline-start:4px solid var\(--stream-magenta\); \}/.test(css));
  assert.ok(/body\.cue-stream #msgs > \.msg > \.stream-label-control, body\.cue-stream #msgs > \.msg > \.stream-pill \{ float:right; margin:0 0 4px 12px; \}/.test(css));
});
test('OB8 the Project Intake Request card shows one grey "Saved" with Reopen inside it; the decision is not repeated as a chat bubble', () => {
  const cards = OB.src('IndexCards.html'), th = OB.src('IndexThreads.html');
  assert.ok(!/Saved decision: /.test(cards) && !/This card now shows your saved edits/.test(cards), 'the two extra notices are gone');
  // CUE-INTAKE-FOOT-SAVED-2026-11-26 (Kiko 26 Nov 2026 "Reopen is misplaced"): Saved and Reopen sit in the card's bottom bar, after the original message.
  assert.ok(cards.includes(`var savedFoot = settled ? '<p class="cue-r1-saved" role="status"><span>Saved</span></p>' + (CLOSED[r.status] ? '<button type="button" class="btn ghost" data-act="reopen" data-id="' + id + '">Reopen</button>' : '')`), 'Saved and Reopen together in the card');
  assert.ok(cards.includes(`'</div><div class="actions">' + savedFoot + editButtons`) && /\.cue-r1-inquiry \.actions \.cue-r1-saved\{margin:0 auto 0 0/.test(cards), 'in the bottom bar, Saved on the left');
  assert.ok(/\.cue-r1-inquiry \.cue-r1-saved\{display:flex;[^}]*color:var\(--muted,#5B5766\);font-weight:600\}/.test(cards) && !/\.cue-r1-saved\{[^}]*(border:1px|background:#f1faf5)/.test(cards), 'grey text, no green box');
  assert.ok(th.includes(`h.indexOf('data-act="reopen" data-id="' + esc(lastR.id) + '"') < 0`), 'the thread adds Reopen only when no card drew it');
  const a = OB.page.indexOf('  function agentDecisionEcho('), ctx = {}; vm.createContext(ctx);
  vm.runInContext(OB.page.slice(a, OB.page.indexOf('\n  }\n', a) + 4), ctx);
  const card = { agd: { handover: { project_inquiry: {} } } };
  ['Confirm new project 2d55a58c', 'New project', 'Register project', 'Reject intake', 'Use project S-31753672PA'].forEach(t => assert.strictEqual(ctx.agentDecisionEcho(card, { text: t }), true, t));
  assert.strictEqual(ctx.agentDecisionEcho(card, { text: 'Please confirm the venue first' }), false, 'a typed reply still shows');
  assert.strictEqual(ctx.agentDecisionEcho({ agd: { handover: {} } }, { text: 'Reject intake' }), false, 'only on the intake request card');
});
test('OB9 inside Canvas only the page\'s own header is hidden; a card\'s header band (Project Intake Request, Email Intake) still shows', () => {
  const css = OB.src('IndexStyle.html');
  assert.ok(/body\.in-canvas > header \{ display:none; \}/.test(css), 'the page header, a direct child of body');
  assert.ok(!/body\.in-canvas header\b/.test(css), 'no rule reaches a <header> inside a card');
  assert.ok(/<header class="cue-r1-head">/.test(OB.src('IndexCards.html')) && /<header class="cue-email-hero">/.test(OB.src('IndexCards.html')), 'the cards do use <header>');
});
test('OB10 the intake request card and the Email Intake card: Canvas font, a 4px colour stripe on the left, the label at the header\'s upper right', () => {
  const cards = OB.src('IndexCards.html');
  assert.ok(!/font:[^;}']*\d(px)?[^;}']* system-ui/.test(cards), 'no card style names system-ui as its font');
  assert.ok(/\.card\.cue-r1-inquiry\{border-inline-start:4px solid #C8106E\}\.card\.cue-email-report\{border-inline-start:4px solid #23006F\}/.test(cards));
  assert.ok(cards.includes("'</h2>' + cardLabel('intake') + '</header>"), 'label inside the intake request header');
  // CUE-EMAIL-NOLABEL-2026-11-26 (Kiko 26 Nov 2026, screenshot of the Email Intake card on his phone: "remove label"): no label there.
  assert.ok(cards.includes("<h2>Email Intake</h2></div>") && !cards.includes("cardLabel('email')"), 'no label on the Email Intake card');
  assert.ok(/\.cue-r1-inquiry \.cue-r1-head\{display:flex;align-items:center;justify-content:space-between;/.test(cards), 'title left, label right');
});
// CUE-BAR-IN-CANVAS-2026-11-25 (Kiko 25 Nov 2026, Canvas bar approved "2. A"): the breadcrumb moves into Canvas's purple bar.
function obWhere(over) {
  const chat = OB.src('IndexChat.html'), a = chat.indexOf("  var cueWhereSent = '';"), b = chat.indexOf('  function goGeneral() {');
  const posts = [], cls = new Set(over.cls || []);
  const ctx = { CUE_HOST: { canvas: over.noCanvas ? null : { postMessage: m => posts.push(JSON.parse(JSON.stringify(m))) } }, openThread: over.thread || '',
    document: { body: { classList: { contains: k => cls.has(k) } }, querySelector: () => (over.name == null ? null : { textContent: over.name }) } };
  vm.createContext(ctx); vm.runInContext(chat.slice(a, b), ctx);
  return { ctx, posts, cls };
}
test('OB11 inside Canvas, once Canvas says it draws the bar, Cue tells it where it is: the list, General, or a channel by name; once per change', () => {
  const g = obWhere({ cls: ['bar-in-canvas'] }); g.ctx.cueWhereTell(); g.ctx.cueWhereTell();
  assert.deepStrictEqual(g.posts, [{ canvasWs: 'cueWhere', view: 'general', name: '' }], 'General, sent once');
  g.cls.add('ch-list'); g.ctx.cueWhereTell();
  assert.deepStrictEqual(g.posts[1], { canvasWs: 'cueWhere', view: 'list', name: '' });
  const t = obWhere({ cls: ['bar-in-canvas'], thread: 'cue-1', name: 'Account Specialist' }); t.ctx.cueWhereTell();
  assert.deepStrictEqual(t.posts, [{ canvasWs: 'cueWhere', view: 'thread', name: 'Account Specialist' }]);
  const long = obWhere({ cls: ['bar-in-canvas'], thread: 'cue-1', name: 'x'.repeat(300) }); long.ctx.cueWhereTell();
  assert.strictEqual(long.posts[0].name.length, 120);
  const old = obWhere({ cls: [] }); old.ctx.cueWhereTell();
  assert.deepStrictEqual(old.posts, [], 'an older Canvas that never said cueBar gets nothing');
  const alone = obWhere({ cls: ['bar-in-canvas'], noCanvas: true }); alone.ctx.cueWhereTell();
  assert.deepStrictEqual(alone.posts, [], 'Cue on its own tells nobody');
});
test('OB12 the bar\'s messages come only from Canvas: cueBar hides Cue\'s own breadcrumb, cueNav goes to the list or General', () => {
  const chat = OB.src('IndexChat.html'), css = OB.src('IndexStyle.html'), th = OB.src('IndexThreads.html');
  assert.ok(chat.includes("if (d.canvasWs === 'cueBar' && e.source === CUE_HOST.canvas) { document.body.classList.add('bar-in-canvas'); cueWhereSent = ''; cueWhereTell(); return; }"));
  assert.ok(chat.includes("if (d.canvasWs === 'cueNav' && e.source === CUE_HOST.canvas) { if (d.to === 'list') showList(); else if (d.to === 'general') goGeneral(); cueWhereTell(); return; }"));
  assert.ok(/body\.bar-in-canvas \.crumb \{ display:none; \} body\.bar-in-canvas #ptabs:not\(:has\(\.ibtn\)\) \{ display:none; \}/.test(css), 'Cue hides its copy, and an empty channel header');
  assert.ok(th.includes("setHtml($('ptabs'), h); cueWhereTell();") && chat.includes("document.body.classList.add('ch-list'); cueWhereTell(); }"), 'told on every view change');
});
test('OB11 phone width guard (Kiko 26 Nov 2026, answer B): the page, images and message text never make Cue wider than the screen', () => {
  const st = OB.src('IndexStyle.html');
  assert.ok(st.includes('html { overflow:hidden; max-width:100vw; } body { max-width:100vw; } img, video { max-width:100%; } .msg { overflow-wrap:break-word; }'), 'the guard is in the stylesheet');
  assert.ok(st.indexOf('CUE-PHONE-WIDTH-GUARD-2026-11-26') < st.indexOf('body { margin:0;'), 'before the body rule, which keeps overflow:hidden');
});
