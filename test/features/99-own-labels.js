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
