// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: G1 deploy base check (tools/base-guard.cjs).
// Kiko 8 Nov 2026 01:22Z "G1, G2, G3, G4, G5, L1": Deploy Cue refuses to put live a branch that lacks code already live
// (5 Nov: V202 built on V200 wiped the triage release live as V201). These run real git in a temp repo.
const BG = require(path.join(__dirname, '..', 'tools', 'base-guard.cjs'));
function bgRepo() {
  const os = require('os'), cp = require('child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cue-base-'));
  const git = (...a) => cp.execFileSync('git', a, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git('init', '-q', '-b', 'main'); git('config', 'user.email', 't@example.test'); git('config', 'user.name', 'T');
  git('config', 'commit.gpgsign', 'false');
  fs.mkdirSync(path.join(dir, 'src'));
  const put = (f, body) => fs.writeFileSync(path.join(dir, 'src', f), body);
  const commit = msg => { git('add', '-A'); git('commit', '-q', '-m', msg); return git('rev-parse', 'HEAD').trim(); };
  // live: the files of a commit, written to a separate folder the way clasp pulls a Version.
  const live = sha => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'cue-live-'));
    return git('ls-tree', '--name-only', sha, 'src/').split('\n').filter(Boolean).map(p => {
      const name = p.replace(/^src\//, ''); fs.writeFileSync(path.join(out, name), git('show', sha + ':' + p)); return [name, path.join(out, name)];
    });
  };
  const run = (a, input) => cp.execFileSync('git', a, { cwd: dir, encoding: 'utf8', input, stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'] });
  return { dir, git, put, commit, live, run };
}
const BG_LINES = n => Array.from({ length: n }, (_, i) => 'line ' + i).join('\n') + '\n';
test('BG1 the live commit is in this branch: deploy may go ahead', () => {
  const r = bgRepo();
  r.put('Cue.gs', BG_LINES(20)); r.put('Index.html', 'a\n'); const v1 = r.commit('v1');
  r.put('Index.html', 'a\nb\n'); r.commit('next');
  const res = BG.branchHasLive('Cue ' + v1.slice(0, 7), r.live(v1), r.run);
  deq([res.ok, res.missing], [true, []]);
});
test('BG2 V202 case: a branch cut before the live release is refused and names the file it would wipe', () => {
  const r = bgRepo();
  r.put('Cue.gs', BG_LINES(20)); r.put('Index.html', 'a\n'); r.commit('base V200');
  r.git('checkout', '-q', '-b', 'triage');
  r.put('Index.html', 'a\ntriage\n'); const v201 = r.commit('triage V201');
  r.git('checkout', '-q', 'main');
  const l = BG_LINES(20).split('\n'); l[2] = 'friday copy'; r.put('Cue.gs', l.join('\n')); r.commit('friday on the old base');
  const res = BG.branchHasLive('Cue ' + v201.slice(0, 7), r.live(v201), r.run);
  deq([res.ok, res.missing], [false, ['Index.html']]);
});
test('BG3 the live release reached this branch by a squash merge, with later work on top: allowed', () => {
  const r = bgRepo();
  r.put('Cue.gs', BG_LINES(40)); r.commit('base');
  r.git('checkout', '-q', '-b', 'release');
  const l = BG_LINES(40).split('\n'); l[30] = 'released fix'; r.put('Cue.gs', l.join('\n')); const rel = r.commit('1.28.47');
  r.git('checkout', '-q', 'main');
  const m = BG_LINES(40).split('\n'); m[2] = 'not yet live'; r.put('Cue.gs', m.join('\n')); r.commit('1.28.43');
  m[30] = 'released fix'; r.put('Cue.gs', m.join('\n')); r.commit('squash of 1.28.47');
  const res = BG.branchHasLive('Cue ' + rel.slice(0, 7), r.live(rel), r.run);
  deq([res.ok, res.missing], [true, []]);
});
test('BG4 no commit in the live description: falls back to files, allowed when the branch once held every live file', () => {
  const r = bgRepo();
  r.put('Cue.gs', 'x\n'); const a = r.commit('a');
  r.put('Cue.gs', 'x\ny\n'); r.commit('b');
  deq(BG.branchHasLive('Cue local', r.live(a), r.run).ok, true);
});
test('BG5 commit not found and a live file this branch never held: refused', () => {
  const r = bgRepo();
  r.put('Cue.gs', 'x\n'); r.commit('a');
  const out = fs.mkdtempSync(path.join(require('os').tmpdir(), 'cue-live-'));
  fs.writeFileSync(path.join(out, 'Cue.gs'), 'hand edit in the browser\n');
  const res = BG.branchHasLive('Cue 1234abc', [['Cue.gs', path.join(out, 'Cue.gs')]], r.run);
  deq([res.ok, res.missing], [false, ['Cue.gs']]);
});
test('BG6 Deploy Cue wires it in: check reports, deploy stops, deploy.mjs fetches full history', () => {
  const tool = fs.readFileSync(path.join(__dirname, '..', 'tools', 'deploy.mjs'), 'utf8');
  assert.ok(/base = branchHasLive\(dep\.description,/.test(tool), 'deploy.mjs runs the base check on the live deployment');
  assert.ok(/if \(mode === 'deploy' && !base\.ok\)\s*\n\s*fail\(/.test(tool), 'deploy stops when the branch lacks live code');
  assert.ok(tool.indexOf("if (mode === 'deploy' && !base.ok)") < tool.indexOf("clasp(pushDir, 'push', '--force')"), 'it stops before anything is pushed');
  assert.ok(/'--unshallow'/.test(tool) && tool.indexOf("'--unshallow'") < tool.indexOf('base = branchHasLive('), 'deploy.mjs fetches the whole history before the check');
  deq(BG.liveCommit('Cue 8fe0da5'), '8fe0da5');
  deq(BG.liveCommit('Cue local'), '');
});
test('BG7 live 1.28.47 vs a branch stamped 1.28.45 that holds its Messenger change: the version stamp alone never blocks', () => {
  const r = bgRepo();
  r.put('Cue.gs', "const CUE_VERSION_ = 'Cue 1.28.42';\n" + BG_LINES(20)); r.put('CueMessenger.gs', BG_LINES(20)); r.commit('1.28.42');
  r.git('checkout', '-q', '-b', 'rel');
  const m = BG_LINES(20).split('\n'); m[10] = 'send again on now_at';
  r.put('CueMessenger.gs', m.join('\n')); r.put('Cue.gs', "const CUE_VERSION_ = 'Cue 1.28.47';\n" + BG_LINES(20)); const rel = r.commit('1.28.47');
  r.git('checkout', '-q', 'main');
  const c = BG_LINES(20).split('\n'); c[3] = 'report a bug';
  r.put('Cue.gs', "const CUE_VERSION_ = 'Cue 1.28.45';\n" + c.join('\n')); r.put('CueMessenger.gs', m.join('\n')); r.commit('1.28.45 with the 1.28.47 change squashed in');
  deq(BG.branchHasLive('Cue ' + rel.slice(0, 7), r.live(rel), r.run).ok, true);
  r.put('CueMessenger.gs', BG_LINES(20)); r.commit('the Messenger change lost');
  const res = BG.branchHasLive('Cue ' + rel.slice(0, 7), r.live(rel), r.run);
  deq([res.ok, res.missing], [false, ['CueMessenger.gs']]);
});
test('BG9 Codex review: a live change right next to the stamp is checked on its own; the stamp in the same hunk never blocks', () => {
  const r = bgRepo();
  r.put('Cue.gs', "const CUE_VERSION_ = 'Cue 1.28.42';\n" + BG_LINES(20)); const base = r.commit('1.28.42');
  r.git('checkout', '-q', '-b', 'rel');
  const m = BG_LINES(20).split('\n'); m[0] = 'new first line';
  r.put('Cue.gs', "const CUE_VERSION_ = 'Cue 1.28.47';\n" + m.join('\n')); const rel = r.commit('1.28.47');
  r.git('checkout', '-q', 'main');
  r.put('Cue.gs', "const CUE_VERSION_ = 'Cue 1.28.45';\n" + m.join('\n')); r.commit('1.28.45 with the change squashed in');
  deq(BG.branchHasLive('Cue ' + rel.slice(0, 7), r.live(rel), r.run).ok, true);
  r.put('Cue.gs', "const CUE_VERSION_ = 'Cue 1.28.45';\n" + BG_LINES(20)); r.commit('the change lost');
  deq(BG.branchHasLive('Cue ' + rel.slice(0, 7), r.live(rel), r.run).missing, ['Cue.gs']);
  deq(!!base, true);
});
test('BG10 Codex review: only the CUE_VERSION_ declaration is exempt; a changed line that uses CUE_VERSION_ is still checked', () => {
  const r = bgRepo();
  const f = flag => "const CUE_VERSION_ = 'Cue 1.28.42';\n" + BG_LINES(10) + 'return { version: CUE_VERSION_, feature: ' + flag + ' };\n' + BG_LINES(10);
  r.put('Cue.gs', f(false)); r.commit('base');
  r.git('checkout', '-q', '-b', 'rel'); r.put('Cue.gs', f(true)); const rel = r.commit('feature on');
  r.git('checkout', '-q', 'main'); r.put('Admin.gs', 'x\n'); r.commit('other work');
  const res = BG.branchHasLive('Cue ' + rel.slice(0, 7), r.live(rel), r.run);
  deq([res.ok, res.missing], [false, ['Cue.gs']]);
});
test('BG8 G4: Deploy Cue counts saved versions and from 180 raises a run warning; it never stops the run', () => {
  const tool = fs.readFileSync(path.join(__dirname, '..', 'tools', 'deploy.mjs'), 'utf8');
  const at = tool.indexOf("clasp(work, 'list-versions')"), g4 = tool.slice(at, tool.indexOf("if (mode === 'check') { console.log('CHECK OK"));
  assert.ok(at > 0 && at < tool.indexOf("if (mode === 'check') { console.log('CHECK OK"), 'check mode shows it too');
  assert.ok(/saved >= 180/.test(g4) && /::warning title=Saved versions/.test(g4) && /GITHUB_STEP_SUMMARY/.test(g4));
  assert.ok(!/fail\(/.test(g4), 'never fails the run');
});
test('BG11 Codex review: a live change to a file Deploy Cue never pushes (src/AGENTS.md) does not block', () => {
  const r = bgRepo();
  r.put('Cue.gs', BG_LINES(20)); r.put('AGENTS.md', 'notes\n'); r.commit('base');
  r.git('checkout', '-q', '-b', 'rel'); r.put('AGENTS.md', 'notes\nmore notes\n'); const rel = r.commit('notes only');
  r.git('checkout', '-q', 'main'); r.put('Admin.gs', 'x\n'); r.commit('other work');
  const res = BG.branchHasLive('Cue ' + rel.slice(0, 7), r.live(rel).filter(([n]) => n !== 'AGENTS.md'), r.run);
  deq([res.ok, res.missing], [true, []]);
});
test('BG12 Codex review: the stamp as an unchanged context line beside a live change never blocks', () => {
  const r = bgRepo();
  const f = (stamp, first) => "const CUE_VERSION_ = 'Cue " + stamp + "';\n" + first + '\n' + BG_LINES(20);
  r.put('Cue.gs', f('1.28.42', 'old first')); r.commit('base');
  r.git('checkout', '-q', '-b', 'rel'); r.put('Cue.gs', f('1.28.42', 'new first')); const rel = r.commit('feature only');
  r.git('checkout', '-q', 'main'); r.put('Cue.gs', f('1.28.45', 'new first')); r.commit('1.28.45 with the feature squashed in');
  deq(BG.branchHasLive('Cue ' + rel.slice(0, 7), r.live(rel), r.run).ok, true);
  r.put('Cue.gs', f('1.28.45', 'old first')); r.commit('the feature lost');
  deq(BG.branchHasLive('Cue ' + rel.slice(0, 7), r.live(rel), r.run).missing, ['Cue.gs']);
});
test('BG13 Codex review: a template renamed live is checked, not skipped as a rename', () => {
  const r = bgRepo();
  r.put('Cue.gs', BG_LINES(10)); r.put('Old.html', BG_LINES(10)); r.commit('base');
  r.git('checkout', '-q', '-b', 'rel'); r.git('mv', 'src/Old.html', 'src/New.html'); const rel = r.commit('rename');
  r.git('checkout', '-q', 'main'); r.put('Admin.gs', 'x\n'); r.commit('other work');
  const res = BG.branchHasLive('Cue ' + rel.slice(0, 7), r.live(rel), r.run);
  deq([res.ok, res.missing], [false, ['New.html', 'Old.html']]);
});
