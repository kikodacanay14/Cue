// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: Kiko's UI rules (30 Oct 2026 06:12Z).
/* UI-RULES-2026-10-30: table headers darker, bold and a size bigger than values; values regular and a size smaller; buttons at the
 * bottom right of their card; labels never look like buttons; icons beside text sit in the middle. Style in IndexStyle.html. */

const UR_CSS = () => require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'IndexStyle.html'), 'utf8');
const UR_BLOCK = () => { const c = UR_CSS(); return c.slice(c.indexOf('UI-RULES-2026-10-30'), c.lastIndexOf('</style>')); };

test('UR1 table headers are dark, bold and a size bigger than the regular values', () => {
  const b = UR_BLOCK(), px = re => +(b.match(re) || [])[1];
  assert.ok(/table th \{[^}]*color:var\(--white\) !important;[^}]*font-weight:700 !important;/.test(b), 'header dark and bold');
  assert.ok(/table td \{[^}]*font-weight:400;/.test(b) && /table td :is\(b, strong\) \{ font-weight:400; \}/.test(b), 'values never bold');
  assert.ok(px(/table th \{[^}]*font-size:(\d+)px/) > px(/table td \{[^}]*font-size:(\d+)px/), 'header bigger than value');
});
test('UR2 section headers and field names are a size bigger than the 13px card text', () => {
  const b = UR_BLOCK(), css = UR_CSS();
  assert.ok(/\.label, details\.sec > summary \{ font-size:14px;[^}]*font-weight:700;/.test(b), 'section headers 14px bold');
  assert.ok(/\.fk \{ font-size:14px; \}/.test(b) && /\.fk \{ color:var\(--text\); font-weight:700; \}/.test(css), 'field names 14px, dark, bold');
  assert.ok(/\.card \.small \{ font-weight:400; \}/.test(css) && /\.small \{ font-size:13px; \}/.test(css), 'values 13px regular');
});
test('UR3 buttons sit at the bottom right of their card', () => {
  assert.ok(/\.card \.actions, dialog \.actions \{ justify-content:flex-end; \}/.test(UR_BLOCK()));
});
test('UR4 labels are flat square-cornered tags, unlike the round pill buttons', () => {
  const b = UR_BLOCK();
  assert.ok(/\.tag \{ border-radius:4px;[^}]*cursor:default; \}/.test(b), 'tag square corners, no hand cursor');
  assert.ok(/\.btn \{ border:0; border-radius:9999px;/.test(UR_CSS()), 'buttons stay pills');
});
test('UR5 icons beside a label or button text sit in the middle', () => {
  const b = UR_BLOCK();
  assert.ok(/\.btn \{ display:inline-flex; align-items:center;/.test(b));
  assert.ok(/\.btn svg, \.tag svg, \.fk svg, \.label svg, summary svg \{ vertical-align:middle;/.test(b));
  assert.ok(/#settings \.ic \{ vertical-align:middle; \}/.test(b));
});
