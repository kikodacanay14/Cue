// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: feature-map.
/* ---------- STRUCTURE-PHASE-1: the feature map (tools/map.mjs, specs/cue-structure-review.md item 1.1; Kiko 28 Oct 2026 03:47Z) ---------- */
test('FM1 FEATURE-MAP.md matches the code (run node tools/map.mjs after changing commands, routes, jobs, bridge actions or tabs)', () => {
  const out = require('child_process').spawnSync(process.execPath, [path.join(__dirname, '..', 'tools', 'map.mjs'), '--check'], { encoding: 'utf8' });
  assert.strictEqual(out.status, 0, (out.stderr || out.stdout).trim());
});
test('FM2 the map names every task kind the server runs, and the shared helpers sit in their shared files', () => {
  const map = fs.readFileSync(path.join(__dirname, '..', 'FEATURE-MAP.md'), 'utf8');
  ['intake', 'sweep', 'readiness', 'email', 'funnel'].forEach(k => assert.ok(map.includes('| `' + k + '` |'), k));
  assert.ok(/\| `cueStr_` \| `CueText\.gs` \|/.test(map) && /\| `cueGmail_` \| `CueGmail\.gs` \|/.test(map) && /\| `cueAddDays_` \| `CueDates\.gs` \|/.test(map));
});
