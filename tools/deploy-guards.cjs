// Pure checks used by tools/deploy.mjs before it changes the Cue project (observation review 7 Nov 2026, package P2
// item 0036 and observation 0060). No clasp, git or network here, so test/features/99-deploy-guards.js can run them.
//
// 1. Release claims (0036): several sessions ship Cue, and one deployed while another was mid-release. Cue and Canvas
//    releases are recorded in CanvasWorkspace deploy-queue.md ("### <name> (Cue)" or "(Canvas + Cue)" entries with a
//    "- Status:" line). A real deploy stops while another session's Cue entry claimed under 60 minutes ago is still open,
//    meaning its status is not SHIPPED, DROPPED or ABANDONED. The claim time is read from the entry's "- Claim:" line (the format CanvasWorkspace releases/README.md step 0 sets), else its "- Claimed:" line,
//    or else its "- Added by:" line. An entry that names this build's version or commit is this session's own claim.
// 2. Version names (0060): a failure was diagnosed against the wrong code because two builds carried the name
//    "Cue 1.28.16". A version name must identify one build. Each Apps Script version is now described
//    "<CUE_VERSION_> (<commit>)", so a failing run's recorded name leads back to its commit.
'use strict';

const CLAIM_MINUTES = 60;
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

// "Cue 1.28.42" from the `const CUE_VERSION_ = 'Cue 1.28.42';` line of src/Cue.gs, or '' when there is none.
function versionName(cueGs) {
  const m = String(cueGs || '').match(/^const CUE_VERSION_ = '([^']+)';/m);
  return m ? m[1] : '';
}

// The Apps Script version description deploy.mjs writes, and the commit read back from one. Older versions were
// described "Cue <7-character commit>", which still names the commit. Anything else (for example "Cue check") gives ''.
const versionDesc = (name, sha) => `${name} (${String(sha).slice(0, 7)})`;
function commitOfDesc(desc) {
  const s = String(desc || '').trim();
  const m = s.match(/^Cue \S+ \(([0-9a-f]{7,40})\)$/) || s.match(/^Cue ([0-9a-f]{7})$/);
  return m ? m[1] : '';
}

// The first UTC time on a line: "2026-11-07T08:34Z", "2026-11-07T08:34:10Z" or "7 Nov 2026 08:34Z" (also "about 08:34Z").
function firstTime(line) {
  const s = String(line || '');
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?Z/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)));
  m = s.match(/\b(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* (\d{4}),?(?: at| about)? (\d{2}):(\d{2})(?::(\d{2}))?Z/i);
  if (m) return new Date(Date.UTC(+m[3], MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1], +m[4], +m[5], +(m[6] || 0)));
  return null;
}

// Every "### " entry of deploy-queue.md outside code fences (the entry template sits in one).
function parseQueue(md) {
  const text = String(md || '').replace(/^```[\s\S]*?^```/gm, '');
  return text.split(/^### /m).slice(1).map(block => {
    const heading = block.split('\n')[0].trim();
    const tag = (heading.match(/\(([^()]*)\)\s*$/) || [])[1] || '';
    const field = name => (block.match(new RegExp('^- ' + name + ':\\s*(.*)$', 'm')) || [])[1];
    // The shared claim line CanvasWorkspace's make_release.py and deploy.mjs read (releases/README.md step 0):
    // "- Claim: <Version> <release name> <ISO time> OPEN|SHIPPED|ABANDONED". Its state closes the claim like a Status does.
    const claim = (field('Claim') || '').trim();
    const claimState = (claim.match(/\b(OPEN|SHIPPED|ABANDONED)\s*$/i) || [])[1] || '';
    const status = (field('Status') || '').trim() || (/^open$/i.test(claimState) ? '' : claimState.toUpperCase());
    const claimLine = claim ? claim : field('Claimed') != null ? field('Claimed') : field('Added by');
    return { heading, cue: /\bCue\b/.test(tag), status, claimedAt: firstTime(claimLine), text: block };
  });
}

const isClosed = status => /^(SHIPPED|DROPPED|ABANDONED)\b/i.test(String(status || '').trim());
const escapeRe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function mentions(entry, name, sha) {
  const byName = name && new RegExp(escapeRe(name) + '(?!\\.?\\d)').test(entry.heading + '\n' + entry.text);
  const bySha = sha && new RegExp('\\b' + escapeRe(String(sha).slice(0, 7))).test(entry.text);
  return Boolean(byName || bySha);
}

// { blocking, own, untimed }: blocking = other sessions' open Cue claims younger than CLAIM_MINUTES; own = entries that
// name this build; untimed = open Cue entries with no claim time (shown, not counted).
function claimCheck(md, { now = new Date(), name = '', sha = '', minutes = CLAIM_MINUTES } = {}) {
  const out = { blocking: [], own: [], untimed: [] };
  for (const e of parseQueue(md)) {
    if (!e.cue || isClosed(e.status)) continue;
    if (mentions(e, name, sha)) { out.own.push(e); continue; }
    if (!e.claimedAt) { out.untimed.push(e); continue; }
    const age = (now.getTime() - e.claimedAt.getTime()) / 60000;
    if (age > -5 && age < minutes) out.blocking.push(Object.assign({ ageMinutes: Math.max(0, Math.round(age)) }, e));
  }
  return out;
}

// The line a session writes into its deploy-queue.md entry after a live deploy.
function recordLine({ now = new Date(), name, live, was, runId }) {
  const d = new Date(now), mon = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')[d.getUTCMonth()];
  const hhmm = String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
  return `- Status: SHIPPED ${d.getUTCDate()} ${mon} ${d.getUTCFullYear()} ${hhmm}Z as ${name}, Version ${live} (was ${was || 'head'}; ` +
    `rollback = Version ${was || 'none'}).${runId ? ' Deploy Cue mode=deploy run ' + runId + '.' : ''}`;
}

// Same code? Two { file: md5 } maps, compared after deploy.mjs has normalised the CUE_DEV_ line.
function sameCode(a, b) {
  const names = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const f of names) if ((a || {})[f] !== (b || {})[f]) return false;
  return true;
}
// Preview and test copies say `const CUE_DEV_ = true;`; src/ and live versions say false. Compare them as false.
const normaliseCueGs = text => String(text).replace(/^const CUE_DEV_ = true;/m, 'const CUE_DEV_ = false;');

module.exports = { CLAIM_MINUTES, versionName, versionDesc, commitOfDesc, firstTime, parseQueue, isClosed, claimCheck, recordLine,
  sameCode, normaliseCueGs };
