// Part of test/cue.test.js. Feature: CUE-LABEL-MENU-2026-11-25 (src/IndexThreads.html moreBtn, labelListHtml, labelSet, streamPill;
// src/IndexStyle.html .msgmenu .lbback/.lbtick). Kiko 25 Nov 2026 02:16:20Z "Can we have the modify card Label appear when the : is
// clicked?"; mockup approved 02:30Z: the card's label is a plain tag, ⋮ shows Reply, Flag, Label, Dismiss, Label turns the menu into
// the label list (Automatic first, a tick on the one in use), one tap saves it, ‹ Label goes back.
const LM_SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexThreads.html'), 'utf8');
function lmBox(saved) {
  const s = LM_SRC, cut = (x, y) => s.slice(s.indexOf(x), s.indexOf(y, s.indexOf(x)));
  const calls = [], ctx = { localStorage: { getItem: () => JSON.stringify(saved || {}), setItem() {} }, state: { requests: [], chat: [], flags: [], dismissed: [] }, calls,
    esc: x => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'), noTok: x => x,
    icon: n => '<svg data-i="' + n + '"></svg>', call: (fn, args) => calls.push([fn, JSON.parse(JSON.stringify(args))]), dirty() {}, renderChat() {},
    document: { addEventListener() {} } };
  vm.createContext(ctx);
  vm.runInContext(cut('  var STREAM_LABELS =', '  function renderStreamTools(') + cut('  function streamReqKey(', '  function fileCardHtml(')
    + cut('  var flagMap = {};', "  document.addEventListener('click'") + cut('  function isDismissed(', '  function menusShut(')
    + cut('  function labelListHtml(', "  document.addEventListener('click'"), ctx);
  return ctx;
}
test('LM1 ⋮ holds Reply, Flag, Label, Dismiss in that order; no Label on a message without a label key', () => {
  const b = lmBox({}), it = { key: 'l:t|Cue', who: 'Cue', time: 't', text: 'x' };
  vm.runInContext('var it = ' + JSON.stringify(it), b);
  const h = vm.runInContext('moreBtn({ reply: "", flag: it, label: "cue-20261125000001-abcd" })', b);
  assert.ok(h.indexOf('>Reply<') < h.indexOf('>Flag<') && h.indexOf('>Flag<') < h.indexOf('data-label-open="cue-20261125000001-abcd">Label') && h.indexOf('>Label') < h.indexOf('>Dismiss<'), 'Reply, Flag, Label, Dismiss');
  assert.ok(!/data-label-open/.test(vm.runInContext('moreBtn({ reply: "", flag: it, label: "" })', b)), 'no label key, no Label');
  assert.ok(/data-label-open/.test(vm.runInContext('moreBtn({ reply: "", flag: null, label: "cue-20261125000001-abcd" })', b)), 'Label alone still gives a ⋮');
});
test('LM2 the label list: ‹ Label, Automatic first, every label, own labels too, a tick on the one in use', () => {
  const b = lmBox({ custom: [{ k: 'u1', n: 'Likha' }], labels: { 'cue-20261125000001-abcd': 'update' } });
  const h = vm.runInContext('labelListHtml("cue-20261125000001-abcd")', b);
  assert.ok(h.indexOf('data-label-back') < h.indexOf('>Automatic<') && h.indexOf('>Automatic<') < h.indexOf('>Chat<'), '‹ Label then Automatic first');
  ['Chat', 'Email', 'Intake', 'Bids', 'Approval', 'Update', 'Likha'].forEach(n => assert.ok(h.includes('</span>' + n + '</button>'), n));
  assert.ok(/aria-checked="true" data-label-set="cue-20261125000001-abcd" data-label-k="update"><span class="lbtick" aria-hidden="true">✓<\/span>Update/.test(h), 'tick on Update');
  assert.strictEqual((h.match(/aria-checked="true"/g) || []).length, 1, 'one tick');
  assert.ok(/aria-checked="true"[^>]*data-label-k=""/.test(vm.runInContext('labelListHtml("cue-20261125000002-abcd")', b)), 'no label set: Automatic ticked');
});
test('LM3 one tap saves the label like the old drop-down; Automatic clears it; a bad id or unknown label is refused', () => {
  const b = lmBox({});
  vm.runInContext('labelSet("cue-20261125000001-abcd", "bids")', b);
  assert.deepStrictEqual(b.calls.pop()[1][0].labels, { 'cue-20261125000001-abcd': 'bids' });
  assert.strictEqual(vm.runInContext('streamCategory({ request_id: ">cue-20261125000001-abcd" })', b), 'bids', 'the card follows');
  vm.runInContext('labelSet("cue-20261125000001-abcd", "")', b);
  assert.deepStrictEqual(b.calls.pop()[1][0].labels, {}, 'Automatic');
  vm.runInContext('labelSet("x<b>", "bids"); labelSet("cue-20261125000001-abcd", "nope")', b);
  assert.strictEqual(b.calls.length, 0, 'refused');
});
test('LM4 wiring: the card tag is plain (no drop-down, no ▾ control), chat bubbles pass their label key, the menu stays open for the list', () => {
  const b = lmBox({});
  assert.strictEqual(vm.runInContext('streamPill("update", "cue-20261125000001-abcd")', b), '<span class="stream-pill stream-emerald">Update</span>');
  assert.ok(!LM_SRC.includes('Message label<select'), 'no Message label drop-down on the card');
  assert.ok(LM_SRC.includes("moreBtn({ reply: rid, flag: fit, label: cat ? streamReqKey(m) : '' })"));
  assert.ok(LM_SRC.includes("if (!b) { if (!(e.target.closest && e.target.closest('[data-label-open], [data-label-back]'))) menusShut(null); return; }"));
  assert.ok(LM_SRC.includes("menusShut(null); labelSet(b.getAttribute('data-label-set'), b.getAttribute('data-label-k'));"), 'a tap closes the menu and saves');
  const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexStyle.html'), 'utf8');
  assert.ok(css.includes('.msg .msgmenu .lbback { font-weight:700; }'));
});
