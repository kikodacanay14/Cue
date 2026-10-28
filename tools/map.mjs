// Feature map (structure review phase 1, item 1.1; Kiko 28 Oct 2026 03:47Z, specs/cue-structure-review.md).
// Reads src/ and writes FEATURE-MAP.md: how commands, cards, files, background jobs, Canvas bridge actions, sheet tabs and AI
// calls connect. The output depends only on the code (no dates), so the test can compare it.
//   node tools/map.mjs           writes FEATURE-MAP.md
//   node tools/map.mjs --check   exits 1 when FEATURE-MAP.md is out of date (test/cue.test.js runs this)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src'), OUT = path.join(ROOT, 'FEATURE-MAP.md');
const files = fs.readdirSync(SRC).filter(f => f.endsWith('.gs')).sort();
const src = Object.fromEntries(files.map(f => [f, fs.readFileSync(path.join(SRC, f), 'utf8')]));
const page = createRequire(import.meta.url)(path.join(ROOT, 'test', 'page.js')).cuePage();   // Index.html joined from its parts

// Where each top-level name is defined.
const def = {};
for (const f of files) for (const m of src[f].matchAll(/^(?:function\s+([A-Za-z0-9_]+)|const\s+([A-Za-z0-9_]+)\s*=)/gm)) def[m[1] || m[2]] = f;
const home = n => def[n] ? '`' + def[n] + '`' : '?';

// Who uses whom, by name.
const uses = {}, usedBy = {}, helperUse = {};
for (const f of files) { uses[f] = new Set(); usedBy[f] = usedBy[f] || new Set(); }
for (const f of files) for (const m of src[f].matchAll(/\b(cue[A-Za-z0-9_]+|CUE_[A-Z0-9_]+)\b/g)) {
  const d = def[m[1]]; if (!d || d === f) continue;
  uses[f].add(d); usedBy[d].add(f);
  (helperUse[m[1]] = helperUse[m[1]] || new Set()).add(f);
}

// Bridge action names from the schema copy of Canvas src/ZapBridge.gs.
const zb = fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'ZapBridge.gs'), 'utf8');
// No line counts anywhere: the map changes only when connections change, so parallel PRs rarely clash on it.
const zbBlock = zb.slice(zb.indexOf('ZB_ACTIONS_'));
const actions = new Set([...zbBlock.matchAll(/^ {2}([a-z][a-z0-9_]+): \{/gm)].map(m => m[1]));
const bridgeOf = f => [...new Set([...src[f].matchAll(/'([a-z][a-z0-9_]+)'/g)].map(m => m[1]).filter(a => actions.has(a)))].sort();
const tabsOf = f => [...new Set([
  ...[...src[f].matchAll(/(?:getSheetByName|insertSheet|cueSheet_)\(\s*'([^']+)'/g)].map(m => m[1]),
  ...[...src[f].matchAll(/^const CUE_[A-Z0-9_]*TAB_\s*=\s*'([^']+)'/gm)].map(m => m[1])])].sort();
const count = (s, re) => (s.match(re) || []).length;

// The body of a top-level function.
function body(f, name) {
  const s = src[f], i = s.indexOf('\nfunction ' + name + '(');
  if (i < 0) return '';
  const j = s.indexOf('\n}\n', i);
  return s.slice(i, j < 0 ? s.length : j + 2);
}

// ---------- commands: kinds, their run, approve and stopped line (the command list, CueCommands.gs) ----------
// STRUCTURE-PHASE-2 (items 2.1 and 2.2): the kinds and the routing order are read from the command list itself, one entry per line.
const cmds = src['CueCommands.gs'] || '';
const runMap = {}, appMap = {}, stopMap = {}, nameMap = {}, cmdMap = {};
for (const m of body('CueCommands.gs', 'cueCommands_').matchAll(/^ {4}([a-z]+): \{ name: '((?:[^'\\]|\\.)*)', cmd: '([a-z]*)', run: (cue[A-Za-z0-9_]+|null), approve: ([^,]+), stopped: '((?:[^'\\]|\\.)*)' \},$/gm)) {
  nameMap[m[1]] = m[2].replace(/\\'/g, "'"); cmdMap[m[1]] = m[3];
  if (m[4] !== 'null') runMap[m[1]] = m[4];
  const ap = (m[5].match(/cue[A-Za-z0-9_]+/) || [])[0]; if (ap) appMap[m[1]] = ap;
  stopMap[m[1]] = m[6].replace(/\\'/g, "'");
}
const routeNames = {};
const rc = (src['CueRoute.gs'] || '').match(/const CUE_ROUTE_CMDS_ = \{([^}]*)\}/);
if (rc) for (const m of rc[1].matchAll(/([a-z]+): '([^']+)'/g)) routeNames[m[1]] = m[2];
const pageKinds = {};
for (const m of page.matchAll(/kind === '([a-z]+)'/g)) pageKinds[m[1]] = (pageKinds[m[1]] || 0) + 1;
// Card families (STRUCTURE-PHASE-2 item 2.3): kindOf in the page, one line per kind.
const famMap = {};
for (const m of page.matchAll(/^ {6}([a-z]+): \{ name: .*?, family: '([a-z]+)', steps: /gm)) famMap[m[1]] = m[2];
const FAM = { approve: 'Approve', draft: 'Draft and send', info: 'Info', question: 'Question' };
const kinds = [...new Set([...Object.keys(nameMap), ...Object.keys(pageKinds)])].sort();
const label = k => nameMap[k] || 'Page only (not in the command list)';

// ---------- routing: the command list's word checks, then what the chat call can start, in order ----------
const HELPERS = new Set(['cueRoutes_', 'cueTalkRoutes_', 'cueOnIt_', 'cueChat_', 'cueReadyHome_']);   // list plumbing and chat lines, not commands
const routeRows = (fn) => [...body('CueCommands.gs', fn).matchAll(/^ {4}\{ key: '([a-z_-]+)', name: '((?:[^'\\]|\\.)*)', (.*)\},?$/gm)].map(m => {
  const [, key, name, rest] = m, said = rest.split(/\b(?:go): /)[0], go = rest.split(/\bgo: /)[1] || '';
  const fns = s => [...new Set([...s.matchAll(/\b(cue[A-Za-z0-9]+_|CUE_[A-Z0-9_]+_RE_)/g)].map(x => x[1]).filter(n => !HELPERS.has(n)))];
  return { key, name: name.replace(/\\'/g, "'"), checks: fns(said), starts: fns(go).filter(n => fns(said).indexOf(n) < 0) };
});
const steps = routeRows('cueRoutes_'), talkSteps = routeRows('cueTalkRoutes_');

// ---------- background jobs ----------
const resume = body('Cue.gs', 'cueResume');
const jobs = [...resume.matchAll(/^  try \{ (cue[A-Za-z0-9_]+)\(\);[^\n]*\}(?:\s*\/\/\s*([^\n]*))?$/gm)].map(m => [m[1], (m[2] || '').trim()]);

// ---------- page calls ----------
const pageCalls = [...new Set([...page.matchAll(/call\('(cue[A-Za-z0-9]+)'/g)].map(m => m[1]))].sort();
const byFile = {};
pageCalls.forEach(n => { const f = def[n] || '?'; (byFile[f] = byFile[f] || []).push(n); });

// ---------- write ----------
const esc = t => String(t).replace(/\|/g, '\\|');
const L = [];
L.push('# Cue feature map', '');
L.push('Made from the code by `node tools/map.mjs` (structure review phase 1, item 1.1). Do not edit by hand: change the code and run');
L.push('the script again. `test/cue.test.js` fails when this file is out of date.', '');
L.push(`Counts: ${files.length} server files, ${Object.keys(def).length} top-level names, ${kinds.length} task kinds, ${steps.length} word checks before the`);
L.push(`chat call, ${jobs.length} background jobs in the 5-minute trigger, ${pageCalls.length} page-to-server functions, ${actions.size} bridge actions in the Canvas bridge copy.`, '');

L.push('## 1. Commands (task kinds)', '');
L.push('A kind is the name a task carries from start to card. Each kind is one line in `cueCommands_` (`CueCommands.gs`): its run, its Approve');
L.push('and its "stopped" line. "Wrong command?" is its name in that list (`CUE_ROUTE_CMDS_`). Card family is its line in the page\'s `kindOf`');
L.push('(`IndexThreads.html`): Approve (one write Kiko approves), Draft and send (emails), Info (an answer or report) or Question (buttons that pick).');
L.push('Page checks count the kind\'s remaining `kind === ...` checks in the page.', '');
L.push('| Kind | What it is | Wrong command? | Card family | Runs in | Approve in | Page checks |', '|---|---|---|---|---|---|---|');
for (const k of kinds) L.push(`| \`${k}\` | ${esc(label(k))} | ${esc(routeNames[cmdMap[k]] || '')} | ${FAM[famMap[k]] || ''} | ${runMap[k] ? home(runMap[k]) : nameMap[k] ? '`CueIntake.gs` (default)' : 'none'} | ${appMap[k] ? home(appMap[k]) : nameMap[k] ? 'intake (default)' : 'none'} | ${pageKinds[k] || 0} |`);
L.push('');

L.push('## 2. Routing order', '');
L.push('Who answers which words first. `cueSendWith_` (in `Cue.gs`) goes down `cueRoutes_` (`CueCommands.gs`); the first that answers wins.');
L.push('If none answers, the AI chat call reads the message, and its answer starts the first command in the second list that it filled in.', '');
const fnList = a => a.map(n => '`' + n + '`' + (def[n] && def[n] !== 'CueCommands.gs' ? ' in ' + home(n) : '')).join(', ');
steps.forEach((r, i) => L.push(`${i + 1}. \`${r.key}\`: ${esc(r.name)}. Checks ${fnList(r.checks) || 'nothing'}${r.starts.length ? '; starts ' + fnList(r.starts) : ''}.`));
L.push('', 'Then a supplier to register (`cueIsSupplier_` in ' + home('cueIsSupplier_') + ') skips the chat call. Otherwise the chat call (`cueTalk_`) answers, and it starts, in this order:', '');
talkSteps.forEach((r, i) => L.push(`${i + 1}. \`talk.${r.key}\`: ${esc(r.name)}. Starts ${fnList(r.starts) || 'nothing'}.`));
L.push('', 'Last, `talk.start_intake` starts a project intake (or a supplier registration).', '');

L.push('## 3. Background jobs (one trigger, every 5 minutes)', '');
L.push('`cueResume` in `Cue.gs` runs these in order, resumes waiting tasks, and last runs the scheduler (`cueSchedTick_`). Each job has its own');
L.push('timing inside its own code.', '');
L.push('| # | Job | File | Note in the code |', '|---|---|---|---|');
jobs.forEach(([n, note], i) => L.push(`| ${i + 1} | \`${n}\` | ${home(n)} | ${esc(note)} |`));
L.push('');

L.push('## 4. Files: what each one touches', '');
L.push('Bridge actions are names from `test/fixtures/ZapBridge.gs` found in the file. AI sites count the places a file calls GPT or Claude,');
L.push('not calls per run. "Used by" and "Uses" count other files.', '');
L.push('| File | Canvas bridge actions | Sheet tabs | GPT sites | Claude sites | Used by | Uses |', '|---|---|---|---|---|---|---|');
for (const f of files) {
  const s = src[f], b = bridgeOf(f), t = tabsOf(f);
  L.push(`| \`${f}\` | ${b.map(x => '`' + x + '`').join(', ')} | ${esc(t.join(', '))} | ${count(s, /\bcueGpt_\(/g)} | ${count(s, /\bcueClaude(Parts)?_\(/g)} | ${usedBy[f].size} | ${uses[f].size} |`);
}
L.push('');

L.push('## 5. Shared helpers', '');
L.push('Names used by 5 or more other files, and the file that holds them.', '');
L.push('| Helper | Lives in | Used by files |', '|---|---|---|');
Object.entries(helperUse).filter(([, v]) => v.size >= 5).sort((a, b) => b[1].size - a[1].size || (a[0] < b[0] ? -1 : 1))
  .forEach(([n, v]) => L.push(`| \`${n}\` | ${home(n)} | ${v.size} |`));
L.push('');

L.push('## 6. What the page calls', '');
L.push('Server functions `Index.html` calls, by the file that holds them.', '');
Object.keys(byFile).sort().forEach(f => L.push(`- \`${f}\`: ${byFile[f].map(n => '`' + n + '`').join(', ')}`));
L.push('');

const out = L.join('\n');
if (process.argv.includes('--check')) {
  const now = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (now !== out) { console.error('FEATURE-MAP.md is out of date. Run: node tools/map.mjs'); process.exit(1); }
  console.log('FEATURE-MAP.md is current.');
} else {
  fs.writeFileSync(OUT, out);
  console.log('Wrote FEATURE-MAP.md');
}
