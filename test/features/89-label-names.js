// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: LABEL-NAMES-2026-11-07 (IndexStyle.html).
// Kiko 7 Nov 2026 12:34Z "use a label", 12:45Z "approve all": Cue labels use the Canvas Brand.html variant names (accent, warn,
// crit, good, plain) with the same colours as before; the old names new/pref/flag stay only as CSS aliases.
const LN_SRC = () => ['IndexPages.html', 'IndexCards.html', 'IndexThreads.html', 'IndexStyle.html', 'Index.html']
  .map(f => { try { return require('fs').readFileSync(require('path').join(__dirname, '..', 'src', f), 'utf8'); } catch (e) { return ''; } }).join('\n');
test('LN1 each Brand.html variant has the same colours as its old Cue name', () => {
  const c = LN_SRC();
  [['warn', 'new', '#FBF0D9', '#8A5300'], ['good', 'pref', '#E5F3EA', '#1E7A46'], ['crit', 'flag', '#FBE9E7', '#B3261E']].forEach(([v, old, bg, fg]) => {
    assert.ok(new RegExp('\\.tag\\.' + v + ', \\.tag\\.' + old + ' \\{ background:' + bg + '; color:' + fg + '; \\}').test(c), v + ' = ' + old);
  });
  assert.ok(/\.tag\.accent, \.tag\.plain \{ background:#ECEAFD; color:#2810DC; \}/.test(c), 'accent and plain = the base tag colours');
});
test('LN2 no page markup uses the old label names any more', () => {
  const c = LN_SRC().replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/tag (new|pref|flag)\b/.test(c), 'no "tag new|pref|flag" in markup');
  assert.ok(!/class="tag' \+ \([^)]*' (new|pref|flag)'/.test(c), 'no dynamic old names');
});
