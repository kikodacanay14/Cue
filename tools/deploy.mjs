// Cloud deploy for Cue, run by .github/workflows/deploy.yml. Uses clasp, signed in as deploy.json's account.
// Usage: node tools/deploy.mjs check|preview|deploy
// check only reads: it shows what would change between the live version and src/. preview pushes src/ to the project's
// head only, so Cue's test link (/dev) runs the new code while the live web app (/exec) stays on its Version. deploy replaces every file in the
// Cue project with src/, makes a new version, points Cue's web app (same /exec address) at it, and reads it back.
// AI relay (Kiko 23 Oct 2026, "Add it to Deploy Cue"; src/CueRelay.gs): deploy then makes a second version whose manifest
// says access ANYONE_ANONYMOUS and points the deployment described "Cue relay" at it (made on the first run). Apps Script
// takes web-app access from a version's manifest, so the page's /exec stays MYSELF. On that deployment every page call
// stops at cueOwner_ and doPost answers only relay calls with a key. Head (/dev) is pushed back to the MYSELF manifest.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const mode = process.argv[2];
if (!['check', 'preview', 'deploy'].includes(mode)) { console.error('usage: deploy.mjs check|preview|deploy'); process.exit(2); }
const cfg = JSON.parse(fs.readFileSync('deploy.json', 'utf8'));
const fail = m => { console.error('STOPPED: ' + m); process.exit(1); };
if (/FILL_IN/.test(cfg.account + cfg.scriptId)) fail('fill in account and scriptId in deploy.json first');
const md5 = f => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');
const sums = dir => Object.fromEntries(fs.readdirSync(dir).sort().map(f => [f, md5(path.join(dir, f))]));

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
const RELAY_DESC = 'Cue relay';
const relayDep = () => clasp(work, 'list-deployments').find(d => d.deploymentId !== cfg.deploymentId && String(d.description || '').startsWith(RELAY_DESC));
{ const r = relayDep(); console.log(r ? `Cue relay is on Version ${r.versionNumber}: https://script.google.com/macros/s/${r.deploymentId}/exec` : 'Cue relay: no deployment yet (the next mode=deploy makes it)'); }
if (live) diff(`live Version ${live} vs src/`, sums(pull(work, live)), want);
if (mode === 'check') { console.log('CHECK OK: nothing was changed'); process.exit(0); }

const pushDir = project('push');
for (const f of Object.keys(want)) fs.copyFileSync(path.join('src', f), path.join(pushDir, 'src', f));
if (mode === 'preview') {
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
const done = clasp(pushDir, 'update-deployment', cfg.deploymentId, '--versionNumber', String(versionNumber), '--description', desc);
const bad = diff(`live Version ${done.versionNumber} vs src/`, sums(pull(project('verify'), done.versionNumber)), want);
const line = `Cue is live as Version ${done.versionNumber} (was ${live || 'head'}; rollback = Version ${live || 'none'}); files ${bad ? 'MISMATCH' : 'match'}`;
console.log('LIVE: ' + line);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, line + '\n');
if (done.versionNumber !== versionNumber || bad) fail('after-deploy check failed');

// The relay: same files, manifest access ANYONE_ANONYMOUS, its own version and deployment. Head goes back to MYSELF after.
const man = path.join(pushDir, 'src', 'appsscript.json'), mine = fs.readFileSync(man, 'utf8'), m = JSON.parse(mine);
if (!m.webapp || m.webapp.access !== 'MYSELF' || m.webapp.executeAs !== 'USER_DEPLOYING') fail('appsscript.json webapp must be MYSELF / USER_DEPLOYING');
m.webapp.access = 'ANYONE_ANONYMOUS';
let relayLine;
try {
  fs.writeFileSync(man, JSON.stringify(m, null, 2) + '\n');
  clasp(pushDir, 'push', '--force');
  const rv = clasp(pushDir, 'create-version', desc + ' relay').versionNumber, was = relayDep(), rdesc = RELAY_DESC + ' (' + desc + ')';
  const r = was ? clasp(pushDir, 'update-deployment', was.deploymentId, '--versionNumber', String(rv), '--description', rdesc)
    : clasp(pushDir, 'create-deployment', '--versionNumber', String(rv), '--description', rdesc);
  const id = r.deploymentId || (was && was.deploymentId) || (relayDep() || {}).deploymentId;
  relayLine = `Cue relay is on Version ${rv} (was ${was ? was.versionNumber : 'none'}): https://script.google.com/macros/s/${id}/exec`;
} finally {
  fs.writeFileSync(man, mine);
  clasp(pushDir, 'push', '--force');   // head and /dev stay owner-only
}
console.log('RELAY: ' + relayLine);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, relayLine + '\n');
