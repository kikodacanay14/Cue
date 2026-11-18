// Part of test/cue.test.js. Feature: CARD-WRAP-2026-11-18 (Kiko 18 Nov 2026 04:11:18Z, screenshot of an AS handover card whose long
// Drive links ran past the card edge: "and it went out of the card"). Every card wraps long links and unbroken text inside itself;
// wide tables other than the facts table keep their columns and scroll in their own box.
test('CWR1 every card wraps long links inside itself; wide tables keep their column widths', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexStyle.html'), 'utf8');
  assert.ok(/\.card \{ min-width:0; max-width:100%; overflow-wrap:anywhere; \}/.test(css), 'cards wrap long links anywhere and never grow past their pane');
  assert.ok(/\.card table:not\(\.facts\) \{ overflow-wrap:break-word; \}/.test(css), 'other tables keep their own column widths');
  const card = css.indexOf('  .card { background:'), wrap = css.indexOf('.card { min-width:0;');
  assert.ok(card > 0 && wrap > card, 'the wrap rule follows the base card rule');
});
