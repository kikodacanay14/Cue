// G1 (Kiko 8 Nov 2026 01:22Z, "G1, G2, G3, G4, G5, L1"): Deploy Cue refuses to put live a branch that is missing code that
// is already live. Canvas does the same with release.json's expectLiveVersion; Cue deploys src/ whole, so it checks the code.
// Why: on 5 Nov 2026 V202 (built on V200) wiped the triage release already live as V201, and on 6 Nov a branch cut from
// 1.28.22 ran a deploy check that would have wiped 1.28.23 onward.
//
// Every Deploy Cue version is described "Cue <7-char commit>". The branch contains live when that commit is an ancestor, or
// when every change it made since the shared base is already in the branch (a squash merge). When the commit cannot be
// found (its branch was deleted), it falls back to files: every live file must be one this branch's history has held.
// Returns { ok, how, missing }: missing lists the src/ files live has that the branch lacks.
function liveCommit(desc) {
  const m = String(desc || '').match(/^Cue ([0-9a-f]{7,40})\b/);
  return m ? m[1] : '';
}
function missingFromBranch(liveBlobs, seen) {
  return Object.keys(liveBlobs).filter(f => !(seen[f] && seen[f].has(liveBlobs[f]))).sort((a, b) => a.localeCompare(b));
}
// raw: output of `git log -m --no-abbrev --format= --raw --no-renames HEAD -- src/`.
function seenFromRawLog(raw) {
  const seen = {};
  for (const ln of String(raw).split('\n')) {
    const m = ln.match(/^:\d+ \d+ [0-9a-f]+ ([0-9a-f]+) [A-Z]+\tsrc\/([^/\t]+)$/);
    if (m && !/^0+$/.test(m[1])) (seen[m[2]] = seen[m[2]] || new Set()).add(m[1]);
  }
  return seen;
}
// diff: `git diff -U1 <base> <live> -- src/`. Returns [{ file, patch, stampOnly }], one per hunk, each a patch git apply takes.
// stampOnly: the hunk only changes the CUE_VERSION_ line, which every release changes and a newer branch rightly differs on.
function hunks(diff) {
  const out = [];
  for (const sec of String(diff).split(/^(?=diff --git )/m).filter(x => x.startsWith('diff --git '))) {
    const at = sec.search(/^@@ /m);
    if (at < 0) continue;
    const head = sec.slice(0, at), file = (head.match(/^\+\+\+ b\/src\/(.+)$/m) || head.match(/^--- a\/src\/(.+)$/m) || [])[1] || '?';
    for (const h of sec.slice(at).split(/^(?=@@ )/m)) {
      const changed = h.split('\n').slice(1).filter(l => /^[+-]/.test(l));
      out.push({ file, patch: head + h.replace(/\n?$/, '\n'), stampOnly: changed.length > 0 && changed.every(l => /\bCUE_VERSION_\b/.test(l)) });
    }
  }
  return out;
}
// run(args, input) runs git with those arguments (input, if given, on stdin) and returns stdout; it throws on a non-zero exit.
function branchHasLive(liveDesc, liveFiles, run) {
  const tryRun = (a, i) => { try { return run(a, i).trim(); } catch (e) { return null; } };
  const short = liveCommit(liveDesc);
  const sha = short && tryRun(['rev-parse', '--verify', '--quiet', short + '^{commit}']);
  const base = sha && tryRun(['merge-base', 'HEAD', sha]);
  if (sha && base) {
    if (tryRun(['merge-base', '--is-ancestor', sha, 'HEAD']) !== null) return { ok: true, how: `live commit ${short} is in this branch`, missing: [] };
    // The branch holds live when every change live made since the shared base is already in the branch: each hunk, run
    // backwards, applies to the branch. A squash merge keeps the changes but loses the ancestry, so this still passes.
    const missing = [...new Set(hunks(run(['diff', '-U1', base, sha, '--', 'src/']))
      .filter(h => !h.stampOnly && tryRun(['apply', '--reverse', '--check', '-C1', '-'], h.patch) === null).map(h => h.file))].sort((a, b) => a.localeCompare(b));
    return { ok: !missing.length, how: missing.length ? `live commit ${short} has changes this branch lacks`
      : `live commit ${short}'s changes are all in this branch (version stamp aside)`, missing };
  }
  const files = byFiles(liveFiles, run, tryRun);
  return { ok: files.ok, how: `live commit ${short || '(none in the description)'} not found; compared files`, missing: files.missing };
}
function byFiles(liveFiles, run, tryRun) {
  // Compare the live files' git blobs against every blob src/ ever had on this branch (plus today's src/).
  const liveBlobs = Object.fromEntries(liveFiles.map(([name, file]) => [name, run(['hash-object', file]).trim()]));
  const seen = seenFromRawLog(run(['log', '-m', '--no-abbrev', '--format=', '--raw', '--no-renames', 'HEAD', '--', 'src/']));
  for (const name of Object.keys(liveBlobs)) {
    const b = tryRun(['rev-parse', '--verify', '--quiet', 'HEAD:src/' + name]);
    if (b) (seen[name] = seen[name] || new Set()).add(b);
  }
  const missing = missingFromBranch(liveBlobs, seen);
  return { ok: !missing.length, missing };
}
module.exports = { liveCommit, missingFromBranch, seenFromRawLog, hunks, branchHasLive };
