/* CUE-ADMIN-2026-10-29 (Kiko 29 Oct 02:13Z "all the Cue admin stuff system config and app settings ... a separate page?";
 * 02:16Z "cue.blankspaceevent.com"; 02:17Z "On a separate page"; 02:42Z "yes" to previews/admin-settings/cue-admin-page.png).
 * Epic Cue #193. Cue Admin is the page doGet serves for ?view=admin: the Settings sections as one full page in Canvas's look.
 * This file holds the two sections that are new on it:
 *   - Triage rules (story #195): the rows of the Triage rules tab, and Remove for one row. The rules themselves work as before
 *     (CueTriage.gs reads the tab on each run).
 *   - Release notes (story #196): the newest rows of the Release Notes tab (CueRelnotes.gs), read only. */

const CUE_ADMIN_RN_MAX_ = 30;

/** This deployment's address; the chat's Settings button opens it with ?view=admin (story #197). */
function cueAdminAppUrl_() { try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; } }

const cueAdminDay_ = v => { const t = v instanceof Date ? v.getTime() : Date.parse(String(v || '')); return isNaN(t) ? String(v || '') : cueRnDay_(cuePh_(t).day); };

/** Triage rules, newest first: { sender, rule, set, why, key }. key names the row for cueAdminTriageDel. */
function cueAdminTriage() {
  cueOwner_();
  return cueTriageTab_('Triage rules').map(r => ({ sender: String(r[0] || '').trim(), rule: String(r[1] || ''), set: cueAdminDay_(r[2]), why: String(r[3] || ''),
    key: String(r[0] || '').trim().toLowerCase() + '|' + (r[2] instanceof Date ? r[2].getTime() : String(r[2] || '')) }))
    .filter(x => x.sender).reverse();
}

/** Removes the Triage rules row named by key (sender and the time it was set), then returns the list again. */
function cueAdminTriageDel(key) {
  cueOwner_();
  const sh = cueSheet_('Triage rules'), n = sh.getLastRow() - 1;
  if (n > 0) {
    const rows = sh.getRange(2, 1, n, 3).getValues();
    for (let i = rows.length - 1; i >= 0; i--) {
      const r = rows[i], k = String(r[0] || '').trim().toLowerCase() + '|' + (r[2] instanceof Date ? r[2].getTime() : String(r[2] || ''));
      if (k === String(key || '')) { sh.deleteRow(i + 2); break; }
    }
  }
  return cueAdminTriage();
}

/** Release notes, newest first: { day, app, release, outcome, ann }. */
function cueAdminRelnotes() {
  cueOwner_();
  const sh = cueRnSheet_(), n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, CUE_RN_HEAD_.length).getValues().reverse().slice(0, CUE_ADMIN_RN_MAX_)
    .map(r => ({ day: cueAdminDay_(r[4] || r[3]), app: String(r[1] || ''), release: String(r[2] || ''), outcome: String(r[6] || ''), ann: String(r[7] || '') }));
}

/* CUE-ADMIN-2-2026-10-29 (Kiko 29 Oct 03:17Z "Chaser Rules - can you indicate like a small copy what that chaser is about? Auto-send ...
 * just indicate the process or business rule that auto triggers it"; 03:19Z "Scheduled Task - have a small description of what each task
 * does and when it was authored. Authored by. Show What process, skills and business rules it follows. AI Relay - add a description";
 * 03:21Z "Job Chasers if it can show What Job Chaser it is > (expand) Jobs that are scheduled to run and on which platform > (expand)
 * draft of email"). Epic Cue #193. The words below describe what the code already does; they change nothing it does. */

/** One line per chaser kind: what it chases, and who the email comes from. */
const CUE_ADMIN_CHASE_ = {
  rfq: { about: 'Nudges a supplier who hasn\'t answered your RFQ.', from: 'your Gmail, as a reply in the RFQ thread' },
  award: { about: 'Asks a client if they have decided on a CE marked "For client awarding".', from: 'your Gmail, in the CE thread' },
  payment: { about: 'Reminds a client whose billing invoice is past due.', from: 'info@ through Canvas, you in CC' },
  accreditation: { about: 'Asks a supplier to finish their accreditation.', from: 'your Gmail, suppliers@ in CC' },
  signature: { about: 'Asks crew to sign an FSA or AR they haven\'t signed.', from: 'freelancers@ through Canvas' } };

/** Cue's own scheduled tasks: what each does, who asked for it and when, and what it follows. */
const CUE_ADMIN_SCHED_ = {
  'sys-sweep': { about: 'Builds the morning batch: every chaser due today, plus inbox and sales lines. Nothing sends until you Approve; approved ones go at the send time.',
    asked: 'Asked by Kiko, approved 21 Oct', follows: ['Chaser rules', 'Approve = send', 'Sweep engine spec'] },
  'sys-bids': { about: 'ChatGPT checks the 11 agreed bid sources; the card shows only new bids that pass the screen.',
    asked: 'Asked by Kiko 21 Oct (route B)', follows: ['Kiko\'s 8-step bid workflow', '₱150k to ₱700k', 'NCR + 6 provinces, never Bataan', 'No bid submitted'] },
  'sys-hubspot': { about: 'Finds duplicates, missing links and missing info in HubSpot. Fixes only the ones you tick.',
    asked: 'Asked by Kiko, approved 21 Oct', follows: ['HubSpot clean-up spec', 'No permanent delete', 'Canvas fields fixed in Canvas'] },
  'sys-status': { about: 'One digest of every active project, plus client update drafts and new tasks, issues and risks from last week\'s emails.',
    asked: 'Asked by Kiko, approved 22 Oct', follows: ['Status reports spec', 'Client-safe only (no money or suppliers)', 'Drafts, never sent'] },
  'sys-funnelreview': { about: 'Follow-ups due, inquiries and delivered projects gone quiet, and clients to win back.',
    asked: 'Asked by Kiko, approved 26 Oct', follows: ['CRM funnel spec F6', 'Canvas\'s quiet limits', 'Drafts only'] },
  'sys-relnotes': { about: 'Turns today\'s Canvas and Cue releases into New and Fixed lines. You tap Post; staff see it at 8 PM.',
    asked: 'Asked by Kiko 27 Oct', follows: ['Daily release notes spec', 'Staff only', 'Posts only on your tap'] },
  'sys-pipeline': { about: 'Reviews open HubSpot deals and suggests the next step for each.',
    asked: 'Asked by Kiko, approved 21 Oct', follows: ['Pipeline health spec', 'Read only'] },
  'sys-rfps': { about: 'Sends the RFPs you pressed Send on in Canvas, from your Gmail, AccountsPayables@ in CC.',
    asked: 'Asked by Kiko 28 Oct ("from me")', follows: ['Supplier RFPs', 'Sent once'] },
  'sys-unsched': { about: 'Tells you about any task waiting on you that has no due date or reminder.',
    asked: 'Asked by Kiko 22 Oct (task scheduler)', follows: ['Task scheduler spec', 'Code only, no AI'] } };

/** The about line for one row of the Schedule tab (x from cueSchedRead_). */
function cueAdminSchedAbout_(x) {
  const A = CUE_ADMIN_SCHED_[x.id];
  if (A) return { about: A.about, asked: A.asked + ' · built by Claude', follows: A.follows.slice() };
  if (/^gtask:/.test(x.run)) return { about: 'Runs "' + (x.command || x.name) + '" from your handbook with ChatGPT; you decide on each finding.',
    asked: 'Asked by Kiko 21 Oct, "Go" 22 Oct · built by Claude', follows: ['Your handbook skill: ' + x.name, 'Code checks every step', 'Drafts only, nothing sent'] };
  return { about: x.command ? 'Runs "' + x.command + '" as if you typed it.' : '', asked: 'Made by Kiko in chat' + (x.created ? ', ' + cueAdminDay_(new Date(x.created)) : ''),
    follows: [x.run === 'remind' ? 'Reminder' : 'Runs as if you typed it', 'Nothing sends without your Approve'] };
}

/** Jobs › Chasers: per chaser kind, today's lines (when and from where, with the draft) and the ones lined up for later days. Read only. */
function cueAdminChasers() {
  cueOwner_();
  const rules = cueRules_(), G = rules.general, today = cuePh_(cueNow_()).day;
  const b = cueRecent_(2).filter(x => x.kind === 'sweep' && x.day === today && !x.check)[0] || null, items = b && b.batch ? b.batch.items || [] : [];
  let log = {}; try { log = cueChaseLog_(); } catch (e) { console.warn('Cue Admin chasers: Chase log: ' + e); }
  const at = h => String(h).padStart(2, '0') + ':00', hm = v => { const p = cuePh_(Date.parse(v)); return String(p.hour).padStart(2, '0') + ':' + String(p.minute).padStart(2, '0'); };
  const when = it => it.sent_id ? 'Sent ' + (it.sent_at ? hm(it.sent_at) : 'today') : it.removed ? (it.removed === 'sent' ? 'Sent' : 'Taken off today\'s batch')
    : b.status === 'Needs you' ? 'Today, ' + at(G.send) + ' once you Approve' : 'Today (batch ' + String(b.status || '').toLowerCase() + ')';
  return { day: cueAdminDay_(today), batch: b ? { id: b.id, status: b.status } : null, build: at(G.build), send: at(G.send),
    kinds: Object.keys(CUE_ADMIN_CHASE_).map(kind => {
      const R = rules.kinds[kind] || {}, A = CUE_ADMIN_CHASE_[kind], seen = {};
      const lines = items.filter(it => it.kind === kind && !it.no_email).map(it => { seen[it.key] = 1;
        return { who: String(it.who || ''), project: String(it.project || ''), to: String(it.to || ''), why: String(it.why || ''), times: Number(it.times) || 0,
          when: when(it), from: A.from, subject: String(it.subject || it.thread_subject || ''), body: String(it.body || '') }; });
      const next = Object.keys(log).filter(k => { const L = log[k]; return L.kind === kind && !seen[k] && !L.muted && L.next && L.next > today && !(R.max && L.times >= R.max); })
        .map(k => ({ who: log[k].who, project: log[k].project, times: log[k].times, next: log[k].next }))
        .sort((x, y) => x.next.localeCompare(y.next)).slice(0, 30)
        .map(x => ({ who: x.who, project: x.project, times: x.times, when: cueAdminDay_(x.next) + ', in the ' + at(G.build) + ' batch', from: A.from }));
      return { kind, label: R.label || kind, on: R.on !== false, about: A.about, from: A.from, lines, next };
    }) };
}
