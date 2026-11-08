// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: deploy guards.
/* ---------- tools/deploy-guards.cjs: release claims (0036) and version names (0060), observation review 7 Nov 2026 ---------- */
{
  const DG = require(path.join(__dirname, '..', 'tools', 'deploy-guards.cjs'));
  const NOW = new Date(Date.UTC(2026, 10, 7, 10, 0));
  const queue = [
    '# Deploy queue', '```', '### <short name> (Canvas | Cue)', '- Added by: Cue project, 2026-11-07T09:55Z', '- Status: WAITING', '```',
    '### Cue 1.28.44: other session (Cue)', '- Claimed: other session, 7 Nov 2026 09:50Z', '- Status: CLEARED',
    '### Main V500: Canvas only (Canvas)', '- Claimed: x, 2026-11-07T09:55Z', '- Status: WAITING',
    '### Cue 1.28.43: this build (Cue)', '- Claimed: this session, 2026-11-07T09:58Z', '- Status: WAITING',
    '### Main V489 + Cue 1.28.41: shipped (Canvas + Cue)', '- Added by: Cue project, 2026-11-07T09:40Z', '- Status: SHIPPED 7 Nov 2026 09:45Z as Cue 1.28.41',
    '### Old Cue entry (Cue)', '- Added by: Cue project, 6 Nov 2026 08:00Z', '- Status: WAITING',
    '### No time (Cue)', '- Status: WAITING',
  ].join('\n');

  test('DG1 deploy claim: another open Cue claim under 60 minutes blocks; own, Canvas-only, shipped, old and template entries do not', () => {
    const r = DG.claimCheck(queue, { now: NOW, name: 'Cue 1.28.43', sha: 'abcdef1234' });
    deq(r.blocking.map(e => [e.heading, e.ageMinutes]), [['Cue 1.28.44: other session (Cue)', 10]]);
    deq(r.own.map(e => e.heading), ['Cue 1.28.43: this build (Cue)']);
    deq(r.untimed.map(e => e.heading), ['No time (Cue)']);
    assert.strictEqual(DG.claimCheck(queue, { now: new Date(NOW.getTime() + 3600e3), name: 'Cue 1.28.43' }).blocking.length, 0, 'claims expire after 60 minutes');
    const closed = queue.replace('- Status: CLEARED', '- Status: DROPPED 7 Nov 2026 09:59Z');
    assert.strictEqual(DG.claimCheck(closed, { now: NOW, name: 'Cue 1.28.43' }).blocking.length, 0, 'a dropped claim is closed');
    assert.strictEqual(DG.claimCheck(queue, { now: NOW, name: 'Cue 1.28.4' }).own.length, 0, '1.28.4 is not 1.28.43');
  });

  test('DG4 shared claim line: "- Claim: <Version> <name> <time> OPEN" blocks; SHIPPED or ABANDONED on it closes the claim', () => {
    const mk = state => `### Cue 1.28.50 payout fix (Cue)\n- Claim: V230 cue-1.28.50 ${new Date(NOW.getTime() - 10 * 60e3).toISOString().slice(0, 16)}Z ${state}\n`;
    assert.strictEqual(DG.claimCheck(mk('OPEN'), { now: NOW, name: 'Cue 1.28.43' }).blocking.length, 1, 'open shared claim blocks');
    assert.strictEqual(DG.claimCheck(mk('SHIPPED'), { now: NOW, name: 'Cue 1.28.43' }).blocking.length, 0, 'shipped closes it');
    assert.strictEqual(DG.claimCheck(mk('ABANDONED'), { now: NOW, name: 'Cue 1.28.43' }).blocking.length, 0, 'abandoned closes it');
  });
  test('DG2 version names: read from Cue.gs, written and read back in version descriptions, CUE_DEV_ ignored when comparing code', () => {
    assert.strictEqual(DG.versionName("x\nconst CUE_VERSION_ = 'Cue 1.28.42';   // note\n"), 'Cue 1.28.42');
    assert.strictEqual(DG.versionName(fs.readFileSync(path.join(__dirname, '..', 'src', 'Cue.gs'), 'utf8')).startsWith('Cue '), true);
    assert.strictEqual(DG.versionDesc('Cue 1.28.42', '16bd3cb0123'), 'Cue 1.28.42 (16bd3cb)');
    assert.strictEqual(DG.commitOfDesc('Cue 1.28.42 (16bd3cb)'), '16bd3cb');
    assert.strictEqual(DG.commitOfDesc('Cue 16bd3cb'), '16bd3cb', 'older descriptions name the commit only');
    assert.strictEqual(DG.commitOfDesc('Cue check'), '');
    assert.strictEqual(DG.normaliseCueGs('const CUE_DEV_ = true;\n'), 'const CUE_DEV_ = false;\n');
    assert.ok(DG.sameCode({ a: '1', b: '2' }, { b: '2', a: '1' }) && !DG.sameCode({ a: '1' }, { a: '1', b: '2' }));
  });

  test('DG3 the line to record after a live deploy', () => {
    assert.strictEqual(DG.recordLine({ now: NOW, name: 'Cue 1.28.43', live: 224, was: 223, runId: '42' }),
      '- Status: SHIPPED 7 Nov 2026 10:00Z as Cue 1.28.43, Version 224 (was 223; rollback = Version 223). Deploy Cue mode=deploy run 42.');
  });
}
