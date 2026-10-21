// Cloud deploy for Cue, run by .github/workflows/deploy.yml. Uses clasp, signed in as deploy.json's account.
// Usage: node tools/deploy.mjs check|deploy
// check only reads: it shows what would change between the live version and src/. deploy replaces every file in the
// Cue project with src/, makes a new version, points Cue's web app (same /exec address) at it, and reads it back.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const mode = process.argv[2];
if (!['check', 'deploy'].includes(mode)) { console.error('usage: deploy.mjs check|deploy'); process.exit(2); }
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
if (live) diff(`live Version ${live} vs src/`, sums(pull(work, live)), want);
if (mode === 'check') { console.log('CHECK OK: nothing was changed'); process.exit(0); }

const pushDir = project('push');
for (const f of Object.keys(want)) fs.copyFileSync(path.join('src', f), path.join(pushDir, 'src', f));
const desc = 'Cue ' + (process.env.GITHUB_SHA || 'local').slice(0, 7);
clasp(pushDir, 'push', '--force');
const { versionNumber } = clasp(pushDir, 'create-version', desc);
const done = clasp(pushDir, 'update-deployment', cfg.deploymentId, '--versionNumber', String(versionNumber), '--description', desc);
const bad = diff(`live Version ${done.versionNumber} vs src/`, sums(pull(project('verify'), done.versionNumber)), want);
const line = `Cue is live as Version ${done.versionNumber} (was ${live || 'head'}; rollback = Version ${live || 'none'}); files ${bad ? 'MISMATCH' : 'match'}`;
console.log('LIVE: ' + line);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, line + '\n');
if (done.versionNumber !== versionNumber || bad) fail('after-deploy check failed');
