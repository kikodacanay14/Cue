// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: card-families.
/* ---------- STRUCTURE-PHASE-2 item 2.3 (Kiko 28 Oct 2026 04:21Z; story Cue #140): card families ----------
 * The page's kindOf (IndexThreads.html) gives each task kind its name, card family, work steps and whether a finished task keeps its
 * card. It replaced three hand-written kind chains; a render of every kind in five states was the same before and after (PR notes). */
const CF_LINE = /^ {6}([a-z]+): \{ name: (.*?), family: '([a-z]+)', steps: ([A-Z]+|null), card: /gm;

test('CF1 every task kind the server knows has one line in the page\'s kindOf, with a family from the four', () => {
  const page = cuePage(), rows = [...page.matchAll(CF_LINE)], fam = Object.fromEntries(rows.map(m => [m[1], m[3]]));
  deq(rows.length, new Set(rows.map(m => m[1])).size, 'one line per kind');
  rows.forEach(m => assert.ok(['approve', 'draft', 'info', 'question'].indexOf(m[3]) >= 0, m[1] + ' family ' + m[3]));
  Object.keys(sandbox().ctx.cueCommands_()).forEach(k => assert.ok(fam[k], k + ' has a card family in the page'));
});

test('CF2 each step list kindOf names is defined in the page, and a kind with no name or steps falls back to the intake\'s', () => {
  const page = cuePage();
  [...page.matchAll(CF_LINE)].map(m => m[4]).filter(x => x !== 'null').forEach(v => assert.ok(new RegExp('var ' + v + ' = \\[').test(page), v + ' is defined'));
  assert.ok(/function kindName\(r\) \{ var n = kindOf\(r\)\.name; return \(typeof n === 'function' \? n\(r\) : n\) \|\| 'Project intake'; \}/.test(page));
  assert.ok(/var list = kindOf\(r\)\.steps \|\| \(r\.status === 'Writing to Canvas' \? WRITE : STEPS\)/.test(page));
});
