// Cloud deploy for Cue, run by .github/workflows/deploy.yml. Uses clasp, signed in as deploy.json's account.
// Usage: node tools/deploy.mjs check|preview|test|deploy
// check only reads: it shows what would change between the live version and src/. preview pushes src/ to the project's
// head only, so Cue's test link (/dev) runs the new code while the live web app (/exec) stays on its Version. deploy replaces every file in the
// Cue project with src/, makes a new version, points Cue's web app (same /exec address) at it, and reads it back.
// test (Kiko's OK 24 Oct 09:13Z) makes a new version like deploy but points only the separate "Cue test" deployment at it,
// never the live one. /dev cannot load inside Canvas's frame ("You need access"), so Canvas ?dev=1 frames this test
// deployment's /exec address instead. The first run creates that deployment and prints its address. Like preview, it
// pushes to head, so /dev runs this build afterwards too.
// Before anything changes (observation review 7 Nov 2026; tools/deploy-guards.cjs has the rules):
// - version name (0060): preview, test and deploy stop when Apps Script already holds different code under this build's
//   CUE_VERSION_ name, on the head or in a saved version. Preview and test let an earlier commit of this same line keep
//   the name; deploy does not, so every live Version has its own name. Versions are now described "<name> (<commit>)".
// - release claim (0036): deploy stops while another session's open Cue entry in CanvasWorkspace deploy-queue.md was
//   claimed under 60 minutes ago. It reads the file from CUE_DEPLOY_QUEUE_FILE (a local copy) or, with CW_QUEUE_TOKEN
//   (read access to CanvasWorkspace contents), from GitHub. With neither, it says "CLAIM CHECK NOT RUN" and goes on.
//   After a live deploy it prints the Status line to write into that entry.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const G = createRequire(import.meta.url)('./deploy-guards.cjs');

const mode = process.argv[2];
if (!['check', 'preview', 'test', 'deploy'].includes(mode)) { console.error('usage: deploy.mjs check|preview|test|deploy'); process.exit(2); }
const TEST_DESC_ = 'Cue test (Canvas ?dev=1)';
const cfg = JSON.parse(fs.readFileSync('deploy.json', 'utf8'));
const fail = m => { console.error('STOPPED: ' + m); process.exit(1); };
if (/FILL_IN/.test(cfg.account + cfg.scriptId)) fail('fill in account and scriptId in deploy.json first');
const md5 = f => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');
// Only the files clasp pushes (.gs, .html, .json) count; a note like src/AGENTS.md never reaches Apps Script.
const sums = dir => Object.fromEntries(fs.readdirSync(dir).filter(f => /\.(gs|html|json)$/.test(f)).sort().map(f => [f, md5(path.join(dir, f))]));
const summary = l => { if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, l + '\n'); };
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20 });
const tryGit = (...a) => { try { return git(...a); } catch { return null; } };
// The code as the version-name check compares it: md5 per pushed file, with Cue.gs's CUE_DEV_ line read as false.
const md5Of = (f, buf) => crypto.createHash('md5').update(f === 'Cue.gs' ? G.normaliseCueGs(buf.toString('utf8')) : buf).digest('hex');
const codeOfDir = dir => Object.fromEntries(Object.keys(sums(dir)).map(f => [f, md5Of(f, fs.readFileSync(path.join(dir, f)))]));
function codeOfCommit(c) {
  const files = git('ls-tree', '--name-only', c, 'src/').split('\n').map(l => l.slice(4)).filter(f => /\.(gs|html|json)$/.test(f));
  return Object.fromEntries(files.map(f => [f, md5Of(f, execFileSync('git', ['show', `${c}:src/${f}`], { maxBuffer: 64 << 20 }))]));
}

function project(name) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), name + '-'));
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, '.clasp.json'), JSON.stringify({ scriptId: cfg.scriptId, rootDir: 'src',
    scriptExtensions: ['.gs'], htmlExtensions: ['.html'], jsonExtensions: ['.json'] }));
  return root;
}
function clasp(cwd, ...args) {
  const out = execFileSync('clasp', [...args, '--json'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  return JSON.parse(out.slice(out.search(/[\[{]/)));
}
const pull = (root, v) => { clasp(root, 'pull', '--versionNumber', String(v)); return path.join(root, 'src'); };
function diff(label, a, b) {
  const names = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  const changed = names.filter(f => a[f] !== b[f]).map(f => `${f}: ${!a[f] ? 'new' : !b[f] ? 'removed' : 'changed'}`);
  console.log(`${label}: ${changed.length ? changed.length + ' file(s) differ' : 'identical'}`);
  changed.forEach(c => console.log('  ' + c));
  return changed.length;
}

const want = sums('src');
const work = project('cue');
const who = clasp(work, 'show-authorized-user');
console.log(`signed in as ${who.email}`);
if (String(who.email).toLowerCase() !== cfg.account.toLowerCase()) fail(`the saved sign-in is ${who.email}, deploy.json says ${cfg.account}`);
const dep = clasp(work, 'list-deployments').find(d => d.deploymentId === cfg.deploymentId);
if (!dep) fail('Cue web app deployment not found in that project');
const live = dep.versionNumber;
console.log(`Cue web app is on Version ${live || '(head)'}`);
if (live) diff(`live Version ${live} vs src/`, sums(pull(work, live)), want);

// Version name (0060). The full history of every branch is needed to tell this line's earlier commits from others.
const NAME = G.versionName(fs.readFileSync('src/Cue.gs', 'utf8'));
if (!NAME) fail('src/Cue.gs has no "const CUE_VERSION_ = \'...\';" line, so this build has no version name');
const shallow = (tryGit('rev-parse', '--is-shallow-repository') || '').trim() === 'true';
if (tryGit('fetch', '--quiet', ...(shallow ? ['--unshallow'] : []), 'origin', '+refs/heads/*:refs/remotes/origin/*') === null)
  fail('could not fetch the branch history to check the version name');
const HEAD = git('rev-parse', 'HEAD').trim();
const ours = codeOfDir('src');
const onOurLine = c => { try { execFileSync('git', ['merge-base', '--is-ancestor', c, HEAD], { stdio: 'ignore' }); return true; } catch { return false; } };
const clashes = [], earlier = [];
{
  const headDir = project('was-head');
  clasp(headDir, 'pull');
  const hs = path.join(headDir, 'src');
  const headName = fs.existsSync(path.join(hs, 'Cue.gs')) ? G.versionName(fs.readFileSync(path.join(hs, 'Cue.gs'), 'utf8')) : '';
  if (headName === NAME && !G.sameCode(codeOfDir(hs), ours)) {
    const theirs = codeOfDir(hs);
    const from = git('rev-list', '--max-count=40', HEAD, '--', 'src/').split('\n').filter(Boolean)
      .find(c => G.versionName(tryGit('show', `${c}:src/Cue.gs`) || '') === NAME && G.sameCode(codeOfCommit(c), theirs));
    if (from && mode !== 'deploy') earlier.push(`the head holds ${NAME} from earlier commit ${from.slice(0, 7)} of this line`);
    else clashes.push(`the Apps Script head runs different code under ${NAME}` + (from ? ` (earlier commit ${from.slice(0, 7)})` : ' (no commit on this line matches it)'));
  }
  const unknown = [];
  for (const v of clasp(work, 'list-versions')) {
    const c = G.commitOfDesc(v.description);
    if (!c) continue;
    const full = (tryGit('rev-parse', '--verify', '--quiet', c + '^{commit}') || '').trim();
    if (!full) { unknown.push(v.versionNumber); continue; }
    if (full === HEAD || G.versionName(tryGit('show', `${full}:src/Cue.gs`) || '') !== NAME || G.sameCode(codeOfCommit(full), ours)) continue;
    if (mode !== 'deploy' && onOurLine(full)) earlier.push(`Version ${v.versionNumber} holds ${NAME} from earlier commit ${c}`);
    else clashes.push(`Version ${v.versionNumber} ("${v.description}") is ${NAME} on commit ${c}, with different code`);
  }
  if (unknown.length) console.log(`version name: Versions ${unknown.join(', ')} name commits no branch holds now; not compared`);
}
earlier.forEach(e => console.log('version name: allowed for ' + mode + ': ' + e));
if (clashes.length) {
  clashes.forEach(c => console.log('version name: ' + c));
  const m = `${NAME} already names other code. Raise CUE_VERSION_ in src/Cue.gs so the name identifies this build only.`;
  if (mode === 'check') console.log('CHECK: preview, test and deploy would stop: ' + m);
  else fail(m);
} else console.log(earlier.length ? `version name: no other line of history uses ${NAME}` : `version name: ${NAME} names only this build`);

// Release claims (0036). Read the record; a set token that fails is an error, a missing one is reported, not hidden.
async function readQueue() {
  if (process.env.CUE_DEPLOY_QUEUE_FILE) return fs.readFileSync(process.env.CUE_DEPLOY_QUEUE_FILE, 'utf8');
  if (!process.env.CW_QUEUE_TOKEN) return null;
  const r = await fetch('https://api.github.com/repos/kikodacanay14/CanvasWorkspace/contents/deploy-queue.md?ref=main', {
    headers: { Authorization: 'Bearer ' + process.env.CW_QUEUE_TOKEN, Accept: 'application/vnd.github.raw', 'User-Agent': 'cue-deploy' } });
  if (!r.ok) fail(`could not read CanvasWorkspace deploy-queue.md (HTTP ${r.status})`);
  return r.text();
}
if (mode === 'deploy' || mode === 'check') {
  const queue = await readQueue();
  if (queue === null) {
    const l = 'CLAIM CHECK NOT RUN: CanvasWorkspace deploy-queue.md is private and this run has no CW_QUEUE_TOKEN or CUE_DEPLOY_QUEUE_FILE. Check the queue by hand before mode=deploy.';
    console.log(l); summary(l);
  } else {
    const r = G.claimCheck(queue, { name: NAME, sha: HEAD });
    r.own.forEach(e => console.log(`claim: this build's entry "${e.heading}" (status ${e.status || 'none'})`));
    if (!r.own.length) console.log(`claim: no open deploy-queue.md entry names ${NAME} or ${HEAD.slice(0, 7)}; add one before deploying`);
    r.untimed.forEach(e => console.log(`claim: open entry "${e.heading}" has no claim time; not counted`));
    if (r.blocking.length) {
      r.blocking.forEach(e => console.log(`claim: "${e.heading}" claimed ${e.ageMinutes} min ago, status ${e.status || 'none'}`));
      const m = `another session's Cue release is open in deploy-queue.md (claimed under ${G.CLAIM_MINUTES} minutes ago). Wait until it is SHIPPED, DROPPED or ABANDONED, or ask that session.`;
      if (mode === 'deploy') fail(m);
      console.log('CHECK: deploy would stop: ' + m);
    } else console.log('claim: no other open Cue claim under ' + G.CLAIM_MINUTES + ' minutes old');
  }
}
if (mode === 'check') { console.log('CHECK OK: nothing was changed'); process.exit(0); }

const pushDir = project('push');
for (const f of Object.keys(want)) fs.copyFileSync(path.join('src', f), path.join(pushDir, 'src', f));
if (mode === 'preview' || mode === 'test') {
  // PC test 01:41Z: test taps on /dev graduated Kiko's real tutor patterns. Head code says it is the test build, so Cue
  // skips learning there. Only the pushed copy changes; src/ and every live version keep CUE_DEV_ = false.
  const f = path.join(pushDir, 'src', 'Cue.gs'), was = fs.readFileSync(f, 'utf8'), now = was.replace(/^const CUE_DEV_ = false;/m, 'const CUE_DEV_ = true;');
  if (now === was) fail('Cue.gs has no "const CUE_DEV_ = false;" line to mark the test build');
  fs.writeFileSync(f, now); want['Cue.gs'] = md5(f);
}
const desc = G.versionDesc(NAME, HEAD);   // "Cue 1.28.42 (16bd3cb)": the commit actually checked out
clasp(pushDir, 'push', '--force');
if (mode === 'preview') {
  // The test link is the head deployment's /dev address, never the live /exec deployment's. Read head back so a stale push shows.
  const head = clasp(work, 'list-deployments').find(d => !d.versionNumber);
  const devUrl = head ? `https://script.google.com/macros/s/${head.deploymentId}/dev` : '(no head deployment found)';
  const headDir = project('head');
  clasp(headDir, 'pull');
  const stale = diff('head vs src/', sums(path.join(headDir, 'src')), want);
  const line = `Cue preview pushed (${desc}): test link ${devUrl} ; live stays on Version ${live || 'head'}; head files ${stale ? 'MISMATCH' : 'match'}`;
  console.log('PREVIEW: ' + line);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, line + '\n');
  if (stale) fail('head does not match src/ after the push');
  process.exit(0);
}
const { versionNumber } = clasp(pushDir, 'create-version', desc);
if (mode === 'test') {
  // Only the test deployment moves. The live deployment is read again afterwards to prove it did not.
  // deploy.json testDeploymentId names it once it exists; until then (first run) a new one is made and its id printed.
  const all = clasp(work, 'list-deployments');
  const tid = cfg.testDeploymentId || (all.find(d => d.deploymentId !== cfg.deploymentId && String(d.description || '').startsWith(TEST_DESC_)) || {}).deploymentId;
  if (tid === cfg.deploymentId) fail('testDeploymentId is the live deployment');
  const t = tid ? clasp(pushDir, 'update-deployment', tid, '--versionNumber', String(versionNumber), '--description', TEST_DESC_ + ' ' + desc)
    : clasp(pushDir, 'create-deployment', '--versionNumber', String(versionNumber), '--description', TEST_DESC_ + ' ' + desc);
  const after = clasp(work, 'list-deployments').find(d => d.deploymentId === cfg.deploymentId);
  if (!after || after.versionNumber !== live) fail(`live deployment moved from Version ${live} to ${after && after.versionNumber}`);
  if (!t || !t.deploymentId || Number(t.versionNumber) !== Number(versionNumber)) fail(`test deployment is not on Version ${versionNumber}: ${JSON.stringify(t)}`);
  const line = `Cue test deployment on Version ${versionNumber} (${desc}): https://script.google.com/a/macros/blankspaceevent.com/s/${t.deploymentId}/exec ; live stays on Version ${live}`;
  console.log('TEST: ' + line);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, line + '\n');
  process.exit(0);
}
const done = clasp(pushDir, 'update-deployment', cfg.deploymentId, '--versionNumber', String(versionNumber), '--description', desc);
const bad = diff(`live Version ${done.versionNumber} vs src/`, sums(pull(project('verify'), done.versionNumber)), want);
const line = `Cue is live as Version ${done.versionNumber} (was ${live || 'head'}; rollback = Version ${live || 'none'}); files ${bad ? 'MISMATCH' : 'match'}`;
console.log('LIVE: ' + line);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, line + '\n');
if (done.versionNumber !== versionNumber || bad) fail('after-deploy check failed');
const rec = G.recordLine({ name: NAME, live: done.versionNumber, was: live, runId: process.env.GITHUB_RUN_ID });
console.log('RECORD in CanvasWorkspace deploy-queue.md, in this release\'s entry:\n' + rec);
summary('Record in deploy-queue.md: ' + rec);
