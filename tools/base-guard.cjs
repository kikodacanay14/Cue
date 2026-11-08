// G1 (Kiko 8 Nov 2026 01:22Z, "G1, G2, G3, G4, G5, L1"): Deploy Cue refuses to put live a branch that is missing code that
// is already live. Canvas does the same with release.json's expectLiveVersion; Cue deploys src/ whole, so it checks the code.
// Why: on 5 Nov 2026 V202 (built on V200) wiped the triage release already live as V201, and on 6 Nov a branch cut from
// 1.28.22 ran a deploy check that would have wiped 1.28.23 onward.
//
// Every Deploy Cue version is described "Cue <7-char commit>". The branch contains live when merging that commit into HEAD
// changes nothing under src/ (a plain ancestor, or the same change arrived by a squash merge). When the commit cannot be
// found (its branch was deleted), it falls back to files: every live file must be one this branch's history has held.
// run(args) runs git with those arguments and returns stdout (throws on a non-zero exit).
// Returns { ok, how, missing }: missing lists the src/ files live has that the branch lacks.
function liveCommit(desc) {
  const m = String(desc || '').match(/^Cue ([0-9a-f]{7,40})\b/);
  return m ? m[1] : '';
}
function missingFromBranch(liveBlobs, seen) {
  return Object.keys(liveBlobs).filter(f => !(seen[f] && seen[f].has(liveBlobs[f]))).sort();
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
function branchHasLive(liveDesc, liveFiles, run) {
  const tryRun = a => { try { return run(a).trim(); } catch (e) { return null; } };
  const short = liveCommit(liveDesc);
  const sha = short && tryRun(['rev-parse', '--verify', '--quiet', short + '^{commit}']);
  if (sha) {
    if (tryRun(['merge-base', '--is-ancestor', sha, 'HEAD']) !== null) return { ok: true, how: `live commit ${short} is in this branch`, missing: [] };
    const tree = tryRun(['merge-tree', '--write-tree', 'HEAD', sha]);
    const diff = tree === null ? null : tryRun(['diff', '--name-only', 'HEAD', tree.split('\n')[0], '--', 'src/']);
    const missing = diff === null ? ['(merge conflict)'] : diff.split('\n').filter(Boolean).map(f => f.replace(/^src\//, '')).sort();
    if (!missing.length) return { ok: true, how: `live commit ${short}'s changes are already in this branch`, missing };
    // A squash merge loses the ancestry and can make the merge look like a conflict; the file check below decides.
    const files = byFiles(liveFiles, run, tryRun);
    if (files.ok) return { ok: true, how: `every live file was held by this branch (merge of ${short} was not clean)`, missing: [] };
    return { ok: false, how: `live commit ${short} has changes this branch lacks`, missing };
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
module.exports = { liveCommit, missingFromBranch, seenFromRawLog, branchHasLive };
