// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: table alignment.
/* TABLE-ALIGN (Kiko 29 Oct 2026 14:32Z: "UI rule - for tables where the table values are numbers - align center. Headers are always
 * aligned center"). The style lives in IndexStyle.html, the script that tags number cells (bs-num) at the end of IndexCards.html. */

const TA_SRC = f => require('fs').readFileSync(require('path').join(__dirname, '..', 'src', f), 'utf8');

test('TA1 every table header is centred and number cells (bs-num) are centred', () => {
  const css = TA_SRC('IndexStyle.html');
  assert.ok(/table th \{ text-align:center !important; \}/.test(css), 'header rule');
  assert.ok(/table td\.bs-num[^{]*\{ text-align:center !important; \}/.test(css), 'number cell rule');
  assert.ok(!/table\.rnw th \{ text-align:left/.test(css), 'Settings tables no longer left-align headers');
});
test('TA2 the number test centres amounts, counts and percents, and leaves IDs, codes and dates alone', () => {
  const js = TA_SRC('IndexCards.html'), m = js.match(/var NUM = (\/.*\/);/);
  assert.ok(m, 'NUM pattern present');
  const NUM = (0, eval)(m[1]);
  ['12', '₱1,250.00', '(₱300)', '45%', '-3', '1.5k'].forEach(s => assert.ok(NUM.test(s), s));
  ['PR-0042', 'P9', '29 Oct', 'S-25506500TR', 'Chairs', '0976 494 2398'].forEach(s => assert.ok(!NUM.test(s), s));
  assert.ok(/classList\.contains\('facts'\)/.test(js), 'key/value facts tables are skipped');
});
test('TA3 short columns (every filled cell 12 characters or fewer) are centred whole (Kiko 14:51Z "middle align tables for short columns and the headers")', () => {
  const js = TA_SRC('IndexCards.html');
  assert.ok(/SHORT = 12;/.test(js), 'short limit is 12 characters');
  assert.ok(/colShort\[c\] && colFill\[c\]/.test(js), 'a filled short column is tagged whole');
  assert.ok(/button/.test(js.slice(js.indexOf('colShort[c] = false') - 200, js.indexOf('colShort[c] = false'))), 'button columns are not short');
});
