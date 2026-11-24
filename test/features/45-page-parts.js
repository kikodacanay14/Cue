// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: page-parts.
/* ---------- STRUCTURE-PHASE-2 item 2.4 (Kiko 28 Oct 2026 04:21Z; story Cue #141): the page in parts ----------
 * src/Index.html holds the markup and puts each part in its place; doGet serves it as a template (cueInclude_ in Cue.gs).
 * Joined, the page is the 3,156-line file from before the split plus one blank line where the note on the parts sits. */
const PG_PARTS = ['IndexStyle', 'IndexChat', 'IndexViewer', 'IndexThreads', 'IndexPages', 'IndexCards'];

test('PG1 every part is put in exactly once, in order, and each one is a file in src/', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'src', 'Index.html'), 'utf8');
  deq([...index.matchAll(/<\?!= cueInclude_\('([A-Za-z0-9]+)'\) \?>/g)].map(m => m[1]), PG_PARTS);
  const files = fs.readdirSync(path.join(__dirname, '..', 'src')).filter(f => /^Index.+\.html$/.test(f)).map(f => f.replace(/\.html$/, '')).sort();
  deq(files, PG_PARTS.slice().sort(), 'no part file is left out of the page');
  assert.ok(!/<\?/.test(index.replace(/<\?!= cueInclude_\('[A-Za-z0-9]+'\) \?>|<\?(?!=)[\s\S]*?\?>/g, '')), 'no other template tags');
});

// LIVE-SYNC-2026-11-25: the live cards (Apps Script versions 280 to 284) build their own <style> text inside the script, so the one-style
// rule is checked on the page markup outside the script.
test('PG2 the joined page is one page with one script, and that script is valid JavaScript', () => {
  const page = cuePage();
  deq([(page.match(/<script>/g) || []).length, (page.match(/<\/script>/g) || []).length, (page.replace(page.slice(page.indexOf('<script>'), page.indexOf('</script>')), '').match(/<style>/g) || []).length, (page.match(/<\?/g) || []).length], [1, 1, 1, 0]);
  const js = page.slice(page.indexOf('<script>') + 8, page.indexOf('</script>'));
  assert.doesNotThrow(() => new vm.Script(js), 'the parts join into one script');
  assert.ok(/^\n\(function \(\) \{/.test(js) && /\}\)\(\);\n$/.test(js), 'one function still wraps the whole script');
});

test('PG3 doGet serves Index as a template, and cueInclude_ gives a part without its last newline', () => {
  const t = sandbox(), seen = [];
  t.ctx.HtmlService.createTemplateFromFile = n => { seen.push(n); return { evaluate: () => ({ setTitle() { return this; }, addMetaTag() { return this; }, setXFrameOptionsMode() { return this; }, setFaviconUrl() { return this; } }), getRawContent: () => fs.readFileSync(path.join(__dirname, '..', 'src', n + '.html'), 'utf8') }; };
  t.ctx.HtmlService.XFrameOptionsMode = { DEFAULT: 'DEFAULT', ALLOWALL: 'ALLOWALL' };
  t.ctx.HtmlService.createHtmlOutputFromFile = n => { throw new Error('Exception: Malformed HTML content: ' + n); };   // what Apps Script does to a script-only part
  t.ctx.cueIconUrl_ = () => '';
  t.ctx.doGet({ parameter: {} });
  deq(seen, ['Index']);
  seen.length = 0;
  const part = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexViewer.html'), 'utf8');
  deq([part.endsWith('\n'), t.ctx.cueInclude_('IndexViewer') === part.slice(0, -1)], [true, true]);
  PG_PARTS.forEach(n => t.ctx.cueInclude_(n));   // hotfix 28 Oct: every part is read raw, never through the HTML parser
  deq(seen, ['IndexViewer'].concat(PG_PARTS));
});
