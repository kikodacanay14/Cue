// Cloud deploy for Cue, run by .github/workflows/deploy.yml. Uses clasp, signed in as deploy.json's account.
// Usage: node tools/deploy.mjs check|preview|test|deploy
// check only reads: it shows what would change between the live version and src/. preview pushes src/ to the project's
// head only, so Cue's test link (/dev) runs the new code while the live web app (/exec) stays on its Version. deploy replaces every file in the
// Cue project with src/, makes a new version, points Cue's web app (same /exec address) at it, and reads it back.
// test (Kiko's OK 24 Oct 09:13Z) makes a new version like deploy but points only the separate "Cue test" deployment at it,
// never the live one. /dev cannot load inside Canvas's frame ("You need access"), so Canvas ?dev=1 frames this test
// deployment's /exec address instead. The first run creates that deployment and prints its address. Like preview, it
// pushes to head, so /dev runs this build afterwards too.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const { branchHasLive } = createRequire(import.meta.url)('./base-guard.cjs');

const mode = process.argv[2];
if (!['check', 'preview', 'test', 'deploy'].includes(mode)) { console.error('usage: deploy.mjs check|preview|test|deploy'); process.exit(2); }
const TEST_DESC_ = 'Cue test (Canvas ?dev=1)';
const cfg = JSON.parse(fs.readFileSync('deploy.json', 'utf8'));
const fail = m => { console.error('STOPPED: ' + m); process.exit(1); };
if (/FILL_IN/.test(cfg.account + cfg.scriptId)) fail('fill in account and scriptId in deploy.json first');
const md5 = f => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');
// Only the files clasp pushes (.gs, .html, .json) count; a note like src/AGENTS.md never reaches Apps Script.
const sums = dir => Object.fromEntries(fs.readdirSync(dir).filter(f => /\.(gs|html|json)$/.test(f)).sort().map(f => [f, md5(path.join(dir, f))]));

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
// G1 (Kiko 8 Nov 2026): the branch must already contain the live Version's code (tools/base-guard.cjs), so a deploy never wipes
// live code. Needs the full history (deploy.yml checks out with fetch-depth 0). check reports it; deploy stops on it.
let base = { ok: true, missing: [] };
if (live) {
  const liveDir = path.join(work, 'src');
  base = branchHasLive(dep.description, Object.keys(sums(liveDir)).map(f => [f, path.join(liveDir, f)]),
    (args, input) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 28, input, stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'ignore'] }));
  console.log(base.ok ? `BASE OK: this branch contains live Version ${live} (${base.how})`
    : `BASE: this branch is missing live Version ${live} code (${base.how}): ${base.missing.join(', ')}`);
}
if (mode === 'check') { console.log('CHECK OK: nothing was changed'); process.exit(0); }
if (mode === 'deploy' && !base.ok)
  fail(`live Version ${live} has code this branch does not (${base.missing.join(', ')}). Someone else deployed, or the branch is on an old base: rebuild on the live Version first.`);

const pushDir = project('push');
for (const f of Object.keys(want)) fs.copyFileSync(path.join('src', f), path.join(pushDir, 'src', f));
if (mode === 'preview' || mode === 'test') {
  // PC test 01:41Z: test taps on /dev graduated Kiko's real tutor patterns. Head code says it is the test build, so Cue
  // skips learning there. Only the pushed copy changes; src/ and every live version keep CUE_DEV_ = false.
  const f = path.join(pushDir, 'src', 'Cue.gs'), was = fs.readFileSync(f, 'utf8'), now = was.replace(/^const CUE_DEV_ = false;/m, 'const CUE_DEV_ = true;');
  if (now === was) fail('Cue.gs has no "const CUE_DEV_ = false;" line to mark the test build');
  fs.writeFileSync(f, now); want['Cue.gs'] = md5(f);
}
const desc = 'Cue ' + (process.env.GITHUB_SHA || 'local').slice(0, 7);
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
