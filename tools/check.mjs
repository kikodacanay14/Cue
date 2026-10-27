// Cloud check link for Cue, run by .github/workflows/check.yml (spec specs/cue-cloud-check.md, Kiko ok 27 Oct 2026 08:28Z).
// Usage: node tools/check.mjs open | close
// open: makes a new random key for this run and pushes a copy of src/ whose CueCheckKey.gs holds only the key's SHA-256, the
//   end time, the Canvas test project, the test email pattern and whether it may email anyone (test/checks/config.json), with web-app access ANYONE_ANONYMOUS.
//   It makes one version of that copy, points the "Cue check" deployment at it, then pushes the head it found back, so /dev and
//   the triggers run exactly what they ran before. Writes url and key (masked) to $GITHUB_OUTPUT. Live /exec is never touched.
// close: points "Cue check" at the "off" version (CUE_CHECK_FP_ = 'off': the door refuses everything), making it once if needed.
//   The "Cue check off" deployment remembers which version that is. Run close after every check, pass or fail.
// Each check run uses one Apps Script version (as a PC check's test deployment did); projects hold 200, so delete old ones in
// the Apps Script project history now and then.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const mode = process.argv[2];
if (!['open', 'close'].includes(mode)) { console.error('usage: check.mjs open|close'); process.exit(2); }
const cfg = JSON.parse(fs.readFileSync('deploy.json', 'utf8'));
// The script being checked (CUE_CHECK_SCRIPT, set by the workflow) may bring its own test/checks/<name>.config.json, so each
// check names its own project and send setting; otherwise test/checks/config.json.
const SCRIPT = String(process.env.CUE_CHECK_SCRIPT || '');
if (SCRIPT && !/^[A-Za-z0-9._-]+$/.test(SCRIPT)) { console.error('STOPPED: CUE_CHECK_SCRIPT must be a name like 1.27.33-crew-docs'); process.exit(1); }
const confFile = SCRIPT && fs.existsSync(path.join('test', 'checks', SCRIPT + '.config.json')) ? path.join('test', 'checks', SCRIPT + '.config.json') : path.join('test', 'checks', 'config.json');
const conf = JSON.parse(fs.readFileSync(confFile, 'utf8'));
const fail = m => { console.error('STOPPED: ' + m); process.exit(1); };
const RUN_MINUTES = 45;                      // the door shuts by itself after this (check_finish works 30 minutes more)
const CHECK_DESC = 'Cue check', OFF_DESC = 'Cue check off';

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
const md5 = f => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');
const sums = dir => Object.fromEntries(fs.readdirSync(dir).sort().map(f => [f, md5(path.join(dir, f))]));
const out = (k, v) => { if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, k + '=' + v + '\n'); };
const summary = line => { console.log(line); if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, line + '\n'); };

const work = project('cue');
const who = clasp(work, 'show-authorized-user');
if (String(who.email).toLowerCase() !== cfg.account.toLowerCase()) fail(`the saved sign-in is ${who.email}, deploy.json says ${cfg.account}`);
// First real run (27 Oct 2026 09:37Z): the list did not show the deployment just made under its description, so close could
// not find it. Read both shapes clasp may print (flat, or under deploymentConfig), and say what it printed when nothing matches.
const deps = () => clasp(work, 'list-deployments').map(d => {
  const c = d.deploymentConfig || {};
  return { deploymentId: d.deploymentId, versionNumber: d.versionNumber != null ? d.versionNumber : c.versionNumber,
    description: String(d.description != null ? d.description : c.description != null ? c.description : '') };
});
const named = desc => {
  const all = deps(), hit = all.find(d => d.deploymentId !== cfg.deploymentId && d.description === desc);
  if (!hit) console.log('No "' + desc + '" deployment in: ' + JSON.stringify(all.map(d => [d.deploymentId.slice(0, 12), d.versionNumber, d.description])));
  return hit;
};

/** A copy of src/ with the lock values filled in and the manifest open to callers without Google sign-in. */
function lockedCopy(lock) {
  const dir = project('push');
  for (const f of fs.readdirSync('src')) fs.copyFileSync(path.join('src', f), path.join(dir, 'src', f));
  const keyFile = path.join(dir, 'src', 'CueCheckKey.gs'), was = fs.readFileSync(keyFile, 'utf8');
  const empty = ["const CUE_CHECK_FP_ = '';", 'const CUE_CHECK_UNTIL_ = 0;', "const CUE_CHECK_PID_ = '';", "const CUE_CHECK_MAIL_ = '';", "const CUE_CHECK_SEND_ = '';"];
  if (!empty.every(x => was.split(x).length === 2)) fail('CueCheckKey.gs in src/ must hold the five empty lock values, once each');
  const now = was.replace("const CUE_CHECK_FP_ = '';", () => 'const CUE_CHECK_FP_ = ' + JSON.stringify(lock.fp) + ';')
    .replace('const CUE_CHECK_UNTIL_ = 0;', () => 'const CUE_CHECK_UNTIL_ = ' + Number(lock.until) + ';')
    .replace("const CUE_CHECK_PID_ = '';", () => 'const CUE_CHECK_PID_ = ' + JSON.stringify(lock.pid) + ';')
    .replace("const CUE_CHECK_MAIL_ = '';", () => 'const CUE_CHECK_MAIL_ = ' + JSON.stringify(lock.mail) + ';')
    .replace("const CUE_CHECK_SEND_ = '';", () => 'const CUE_CHECK_SEND_ = ' + JSON.stringify(lock.send) + ';');
  fs.writeFileSync(keyFile, now);
  // Like the /dev build: test taps never teach Cue's tutor (CUE_DEV_ in Cue.gs).
  const cue = path.join(dir, 'src', 'Cue.gs'), c = fs.readFileSync(cue, 'utf8'), d = c.replace(/^const CUE_DEV_ = false;/m, 'const CUE_DEV_ = true;');
  if (d === c) fail('Cue.gs has no "const CUE_DEV_ = false;" line');
  fs.writeFileSync(cue, d);
  const man = path.join(dir, 'src', 'appsscript.json'), m = JSON.parse(fs.readFileSync(man, 'utf8'));
  if (!m.webapp || m.webapp.access !== 'MYSELF' || m.webapp.executeAs !== 'USER_DEPLOYING') fail('appsscript.json webapp must be MYSELF / USER_DEPLOYING');
  m.webapp.access = 'ANYONE_ANONYMOUS';
  fs.writeFileSync(man, JSON.stringify(m, null, 2) + '\n');
  return dir;
}

/** Pushes `dir`, makes a version, and always pushes the saved head back (then checks it matches). */
function versionOf(dir, desc) {
  const head = project('head'); clasp(head, 'pull');
  const before = sums(path.join(head, 'src'));
  let v;
  try { clasp(dir, 'push', '--force'); v = clasp(dir, 'create-version', desc).versionNumber; }
  finally {
    clasp(head, 'push', '--force');
    const back = project('back'); clasp(back, 'pull');
    const after = sums(path.join(back, 'src')), bad = Object.keys(Object.assign({}, before, after)).filter(f => before[f] !== after[f]);
    if (bad.length) fail('head was not put back as it was: ' + bad.join(', '));
  }
  if (!v) fail('no version was made');
  return v;
}
function point(desc, version) {
  const d = named(desc), label = desc + ' (Version ' + version + ')';
  const r = d ? clasp(work, 'update-deployment', d.deploymentId, '--versionNumber', String(version), '--description', desc)
    : clasp(work, 'create-deployment', '--versionNumber', String(version), '--description', desc);
  const id = r.deploymentId || (d && d.deploymentId) || (named(desc) || {}).deploymentId;
  if (!id) fail('could not find the ' + desc + ' deployment after pointing it at Version ' + version);
  console.log(label + ': https://script.google.com/macros/s/' + id + '/exec');
  return id;
}

if (mode === 'open') {
  if (!/^[A-Za-z0-9-]{4,}$/.test(String(conf.project_id || ''))) fail(confFile + ' has no Canvas project id');
  try { new RegExp(conf.mail); } catch (e) { fail(confFile + ' mail is not a valid pattern'); }
  const key = crypto.randomBytes(32).toString('hex');
  if (process.env.GITHUB_ACTIONS) console.log('::add-mask::' + key);
  const fp = crypto.createHash('sha256').update(key).digest('hex'), until = Date.now() + RUN_MINUTES * 60e3;
  const desc = CHECK_DESC + ' ' + (process.env.GITHUB_SHA || 'local').slice(0, 7);
  const v = versionOf(lockedCopy({ fp, until, pid: conf.project_id, mail: conf.mail, send: conf.send === true ? 'on' : 'no' }), desc);
  const id = point(CHECK_DESC, v);
  out('url', 'https://script.google.com/macros/s/' + id + '/exec'); out('key', key);
  summary(`Cue check link open on Version ${v} until ${new Date(until).toISOString()} (writes only to ${conf.project_id}; ${conf.send === true ? 'may email the test addresses' : 'emails no one'}). Live /exec untouched.`);
} else {
  const had = named(OFF_DESC);
  let offV = had && had.versionNumber;
  if (!offV) { offV = versionOf(lockedCopy({ fp: 'off', until: 1, pid: 'off', mail: 'off', send: 'no' }), OFF_DESC); point(OFF_DESC, offV); }
  if (!named(CHECK_DESC)) fail('could not find the "' + CHECK_DESC + '" deployment to shut; its door still shuts by itself at the end time');
  point(CHECK_DESC, offV);
  summary(`Cue check link shut: it now runs the off Version ${offV}, which refuses every call.`);
}
