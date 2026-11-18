// Part of test/cue.test.js. Feature: MOBILE-BACK-2026-11-18 (Kiko 18 Nov 2026 02:20Z, phone screenshot: "In mobile there is no way to go
// back to the left panel. There should be a button here that does that"). Two causes: no back control on a narrow screen, and every
// pane icon drew nothing because IndexPages.html declared a second `var IC` in the same script, replacing the viewer's icon set.
const MB_PAGE = require(path.join(__dirname, 'page.js')).cuePage();
test('MB1 the page script declares the icon set IC once, and it holds the back, close and chevron icons', () => {
  deq((MB_PAGE.match(/\bvar IC = \{/g) || []).length, 1, 'one var IC in the joined script');
  const viewer = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexViewer.html'), 'utf8');
  ['back', 'x', 'chev', 'search', 'more', 'reply'].forEach(k => assert.ok(new RegExp('\\n    ' + k + ": '<").test(viewer), 'IC.' + k));
  assert.ok(/var CH_IC = \{ mail:/.test(MB_PAGE) && !/\bIC\.(mail|sms|app)\b/.test(MB_PAGE.replace(/CH_IC\./g, '')), 'channel icons renamed CH_IC');
});
test('MB2 CUE-CHANNELS-2026-11-18: on a phone the channel header starts with a Channels back button to the list, in place of the X; General has one too', () => {
  const th = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexThreads.html'), 'utf8');
  assert.ok(th.includes(`var back = '<button class="pane-back" data-p="pane" aria-label="Back to the channels">' + icon('back') + '<span>Channels</span></button>';`));
  assert.ok(th.includes(`h = back + '<span class="crumb">`), 'a channel header starts with it');
  const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexStyle.html'), 'utf8');
  assert.ok(/\n  \.pane-back \{ display:none; \}/.test(css), 'hidden on a wide screen');
  assert.ok(/@media \(max-width: 640px\) \{[^@]*\.pane-back \{ display:inline-flex; \}[^@]*\.pane-x \{ display:none; \}/.test(css), 'shown on a phone');
  const viewer = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexViewer.html'), 'utf8');
  assert.ok(viewer.includes("if (p === 'pane') return showList();") && viewer.includes("$('gen-back').onclick = showList;"), 'back shows the list');
});
