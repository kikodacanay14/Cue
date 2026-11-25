// Part of test/cue.test.js. Feature: CUE-LABELS-2026-11-25 (Kiko 25 Nov 2026: "Labels - i should be ale to add on my own"; "Colors - use
// colors as representation, i should also be able to select from a color wheel or from a selection of colors"; who sees them: "A. Only
// me"). Mockup approved "Approve all", build approved "Yes, build it".
test('OL1 Cue keeps the owner\'s own labels, colours and message labels, cleaned: 30 labels of 24 characters, hex colours, known labels only', () => {
  const t = sandbox({});
  const saved = JSON.parse(JSON.stringify(t.ctx.cueStreamPrefsSave({
    custom: [{ k: 'u1', n: '  Likha <b>Foundation</b> and a very long name  ' }, { k: 'u1', n: 'Duplicate' }, { k: 'bad key', n: 'x' }, { k: 'u2', n: '' }, { k: 'u3', n: 'VIP' }],
    colors: { u1: '#2810DC', email: 'purple', intake: '#c8106e', u9: '#000000', u3: 'red' },
    labels: { 'cue-20261120000142-abcd': 'u1', 'cue-20261120000143-cdef': 'bogus', 'not-an-id': 'email', 'cue-20261120000144-eeee': 'bids' } })));
  assert.deepStrictEqual(saved.custom, [{ k: 'u1', n: 'Likha bFoundation/b and' }, { k: 'u3', n: 'VIP' }]);
  assert.deepStrictEqual(saved.colors, { intake: '#c8106e', u1: '#2810dc' }, 'six-digit hex only, for labels that exist');
  assert.deepStrictEqual(saved.labels, { 'cue-20261120000142-abcd': 'u1', 'cue-20261120000144-eeee': 'bids' });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(t.ctx.cueStreamPrefs_())), saved, 'read back from Cue\'s settings');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(t.ctx.cueStreamPrefsClean_('junk'))), { custom: [], colors: {}, labels: {} });
  assert.ok(/stream_prefs: chk \? null : cueStreamPrefs_\(\)/.test(CODE), 'the page gets them with its state; a check run gets none');
  assert.ok(/function cueStreamPrefsSave\(prefs\) \{\n  cueOwner_\(\);/.test(CODE), 'owner only');
});
function olBox(saved) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexThreads.html'), 'utf8');
  const a = src.indexOf('  var STREAM_LABELS ='), b = src.indexOf('  function renderStreamTools('), c = src.indexOf('  function streamReqKey('), d = src.indexOf('  function fileCardHtml(');
  const calls = [], ctx = { localStorage: { getItem: () => JSON.stringify(saved || {}), setItem() {} }, state: { requests: [] }, calls,
    esc: x => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    call: (fn, args) => calls.push([fn, JSON.parse(JSON.stringify(args))]), dirty() {}, renderChat() {} };
  vm.createContext(ctx); vm.runInContext(src.slice(a, b) + src.slice(c, d), ctx);
  return ctx;
}
test('OL2 a label of my own: added with a clean name, no duplicate or empty name, renamed, and deleted with its colour and its messages', () => {
  const b = olBox({});
  const k = vm.runInContext('streamLabelAdd("  Likha <b> ")', b);
  assert.ok(/^u[a-z0-9]{1,12}$/.test(k), k);
  assert.deepStrictEqual(JSON.parse(vm.runInContext('JSON.stringify([streamPrefs.custom, streamPrefs.colors, streamAll()["' + k + '"]])', b)), [[{ k, n: 'Likha b' }], { [k]: '#2810dc' }, 'Likha b']);
  assert.strictEqual(vm.runInContext('streamLabelAdd("likha B")', b), '', 'same name, any case');
  assert.strictEqual(vm.runInContext('streamLabelAdd("email")', b), '', 'a built-in name');
  assert.strictEqual(vm.runInContext('streamLabelAdd("   ")', b), '', 'empty');
  assert.strictEqual(vm.runInContext('streamLabelRename("' + k + '", "VIP clients")', b), true);
  assert.strictEqual(vm.runInContext('streamLabelRename("' + k + '", "Bids")', b), false, 'cannot take a built-in name');
  assert.strictEqual(vm.runInContext('streamLabelRename("email", "Mail")', b), false, 'built-in labels are not renamed');
  vm.runInContext('streamPrefs.labels["cue-20261120000142-abcd"] = "' + k + '"; streamPrefs.filter = "' + k + '"; streamLabelDel("' + k + '")', b);
  assert.deepStrictEqual(JSON.parse(vm.runInContext('JSON.stringify([streamPrefs.custom, streamPrefs.colors, streamPrefs.labels, streamPrefs.filter])', b)), [[], {}, {}, '']);
});
test('OL3 colours: a built-in swatch name keeps its class, any hex colour draws as its own colour, and a message label follows', () => {
  const b = olBox({ custom: [{ k: 'u1', n: 'Likha' }], colors: { u1: '#FF8800', email: '#123456', intake: 'teal', bids: 'bogus' }, labels: { 'cue-20261120000142-abcd': 'u1', 'cue-20261120000143-cdef': 'u9' } });
  assert.strictEqual(vm.runInContext('streamPill("u1", "")', b), '<span class="stream-pill stream-custom" style="--sc:#ff8800">Likha</span>');
  assert.strictEqual(vm.runInContext('streamPill("email", "")', b), '<span class="stream-pill stream-custom" style="--sc:#123456">Email</span>');
  assert.strictEqual(vm.runInContext('streamPill("intake", "")', b), '<span class="stream-pill stream-teal">Intake</span>');
  assert.strictEqual(vm.runInContext('streamPill("bids", "")', b), '<span class="stream-pill stream-orange">Bids</span>', 'an unknown colour falls back to the default');
  assert.deepStrictEqual(JSON.parse(vm.runInContext('JSON.stringify([streamHex("intake"), streamHex("u1"), streamHex("chat")])', b)), ['#087f83', '#ff8800', '#576579']);
  assert.strictEqual(vm.runInContext('streamCategory({ request_id: ">cue-20261120000142-abcd" })', b), 'u1');
  assert.deepStrictEqual(Object.keys(JSON.parse(vm.runInContext('JSON.stringify(streamPrefs.labels)', b))), ['cue-20261120000142-abcd'], 'a message labelled with a label that no longer exists is dropped');
  assert.strictEqual(vm.runInContext('streamPill("u1", "cue-20261120000142-abcd")', b), '<span class="stream-pill stream-custom" style="--sc:#ff8800">Likha</span>', 'a plain tag on the card; own labels are offered in ⋮ › Label (99-label-menu.js)');
});
test('OL4 saving sends hex colours, own labels and message labels to Cue; the panel shows a colour dot, swatches, the wheel and the only-you note', () => {
  const b = olBox({ custom: [{ k: 'u1', n: 'Likha' }], colors: { intake: 'teal' } });
  vm.runInContext('streamPrefs.colors.u1 = "#ff8800"; saveStreamPrefs()', b);
  assert.deepStrictEqual(b.calls, [['cueStreamPrefsSave', [{ custom: [{ k: 'u1', n: 'Likha' }], colors: { intake: '#087f83', u1: '#ff8800' }, labels: {} }]]]);
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexThreads.html'), 'utf8'), a = src.indexOf('  var streamPal ='), e = src.indexOf('  function renderStreamTools(');
  vm.runInContext(src.slice(a, e) + '\nstreamPal = "u1";', b);
  const html = vm.runInContext('streamRowsHtml()', b);
  assert.ok(/<button type="button" class="sl-sw" data-sl="pal" data-k="u1" style="background:#ff8800" title="Change the colour of Likha"/.test(html), 'colour shown as a dot');
  assert.ok(/<input class="sl-name" data-sl-name="u1" value="Likha" maxlength="24"[^>]*><button type="button" class="sl-del" data-sl="del" data-k="u1">Delete<\/button>/.test(html), 'own label: rename and delete');
  assert.ok(/<span class="sl-name">Email<\/span><span class="small muted">Built in<\/span>/.test(html) && !/data-sl="del" data-k="email"/.test(html), 'built-in labels cannot be deleted');
  assert.strictEqual((html.match(/data-sl="set" data-k="u1"/g) || []).length, 8, 'eight swatches');
  assert.ok(/Other colour <input type="color" data-sl-wheel="u1" value="#ff8800">/.test(html), 'the colour wheel');
  assert.ok(/id="stream-label-new" placeholder="New label name"/.test(html) && /Only you see these\. They follow you on every device\./.test(html));
  assert.ok(/state\.stream_prefs\) \{[^\n]*\n\s*streamFromCue = true; streamAdopt\(state\.stream_prefs\);/.test(src), 'Cue\'s saved copy is adopted once');
});
