// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: Cue Admin › Auto-Send by journey.
/* AUTO-SEND-JOURNEY-2026-11-06 (Kiko 5 Nov 16:55Z: "Auto-Send - should contain all the communications that are automatically sent
 * either mail, sms, fb - should show the customer journey and show communication per stage"; mockup
 * https://claude.ai/artifact/2bL1ZBzGqZgV3Ct9iFSMHq, Kiko "yes" 6 Nov 01:28Z). */
const AS_P = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexPages.html'), 'utf8');
const AS_DATA = Function('return ' + AS_P.match(/var AS_J = (\{[\s\S]*?\n {2}\});/)[1])();
const AS_KEYS = (() => {
  const M = Function('return ' + fs.readFileSync(path.join(__dirname, '..', 'src', 'CueMsgTemplates.gs'), 'utf8').match(/const CUE_MT_MAP_ = (\[[\s\S]*?\n\]);/)[1])();
  return M.map(r => r[0] + ' ' + (r[1] === 'SMS' ? 'SMS' : r[2]));
})();
test('AS1 four journeys in the Templates order of who gets it; Crew opens first; counts match the mockup Kiko approved', () => {
  assert.match(AS_P, /var AS_LANES = \[\['C', 'Clients'\], \['R', 'Crew'\], \['S', 'Suppliers'\], \['T', 'Team'\]\], AS = \{ lane: 'R' \};/);
  const n = l => AS_DATA[l].steps.reduce((t, s) => t + s[3].length, 0);
  assert.deepStrictEqual(['C', 'R', 'S'].map(n), [0, 8, 1]);
  assert.ok(n('T') >= 3, 'Team: approval, status changed, supplier awarded, your day');
  assert.match(AS_DATA.C.none, /No client message goes out by itself/);
});
test('AS2 every step is a Templates journey code of its lane, in order, and every Template button names a real template or none', () => {
  Object.keys(AS_DATA).forEach(l => {
    const codes = AS_DATA[l].steps.map(s => s[0]);
    assert.ok(codes.every(c => c[0] === l), l + ' codes');
    assert.deepStrictEqual(codes.slice().sort((a, b) => +a.slice(1) - +b.slice(1)), codes, l + ' in journey order');
    AS_DATA[l].steps.forEach(s => s[3].forEach(m => {
      assert.strictEqual(m.length, 5, m[0]); assert.ok(m[0] && m[1] && m[3], m[0]);
      assert.strictEqual(m[2].length, 4, m[0] + ': Email, Text, Messenger, App notice'); assert.ok(m[2].some(Boolean), m[0] + ' goes somewhere');
      if (m[4]) { assert.ok(AS_KEYS.indexOf(m[4]) >= 0, m[4] + ' is a Templates key'); assert.strictEqual(m[4].split(' ')[0], s[0], m[4] + ' sits under its own step'); }
    }));
  });
});
test('AS3 crew papers and payment texts show Messenger (Cue sends them there, SMS backup); a step with no message says so', () => {
  const R = {}; AS_DATA.R.steps.forEach(s => { R[s[0]] = s[3]; });
  assert.ok(R.R5[0][2][2] && R.R6.every(m => m[2][2]) && R.R7[0][2][2]);
  assert.ok(!AS_DATA.S.steps.some(s => s[3].some(m => m[2][2])), 'suppliers have no Messenger link-up');
  assert.match(AS_P, /Nothing goes out by itself at this step\./);
});
test('AS4 the page: section and frame-ready title, lane buttons, icons with names, and Template opens Templates on that message', () => {
  assert.match(cuePage(), /<section data-sec="auto" hidden><div class="label" style="margin-top:0">Auto-Send<\/div><div id="w-as"><\/div><\/section>/);
  assert.match(AS_P, /data-as-lane="' \+ l\[0\] \+ '" aria-pressed="' \+ \(AS\.lane === l\[0\]\) \+ '"/);
  assert.match(AS_P, /role="img" aria-label="' \+ AS_IC\[i\]\[0\] \+ '"/);
  assert.match(AS_P, /MT\.f = \{ who: t\.getAttribute\('data-as-who'\), ch: \/ SMS\$\/\.test\(k\) \? 'SMS' : 'Email', st: '' \}/);
  assert.match(AS_P, /if \(k\) MT\.sel = k;\s*settingsTab\('templates'\);/);
  assert.match(AS_P, /if \(sec === 'auto'\) asDraw\(\);/);
  const S = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexStyle.html'), 'utf8');
  assert.match(S, /#w-as table\.astbl th \{ text-align:center; vertical-align:middle;/, 'headers centred (UI rule)');
  assert.match(S, /@media \(max-width:700px\) \{ #w-as table\.astbl/, 'rows stack on a phone');
});
