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

/** Cue's own scheduled tasks: what each does, who asked for it and when, and what it follows ([name, what it means]). */
const CUE_ADMIN_SCHED_ = {
  'sys-sweep': { about: 'Builds the morning batch: every chaser due today, plus inbox and sales lines. Nothing sends until you Approve; approved ones go at the send time.',
    asked: 'Asked by Kiko, approved 21 Oct', follows: [['Chaser rules', 'When each chaser starts, how often it repeats and when it stops (Rules › Chaser rules).'], ['Approve = send', 'Nothing goes out until you tap Approve on the batch card; Approve sends.'], ['Sweep engine spec', 'Code finds the lines, ChatGPT writes the words in one call, a template covers a failed call.']] },
  'sys-bids': { about: 'ChatGPT checks the 11 agreed bid sources; the card shows only new bids that pass the screen.',
    asked: 'Asked by Kiko 21 Oct (route B)', follows: [['Kiko\'s 8-step bid workflow', 'ChatGPT searches the sources and reads each notice; code screens and dedupes against your bid sheet.'], ['₱150k to ₱700k', 'Only bids with an approved budget in this range pass.'], ['NCR + 6 provinces, never Bataan', 'NCR, Batangas, Laguna, Cavite, Rizal, Bulacan and Quezon.'], ['No bid submitted', 'It never registers, pays a fee or submits a bid.']] },
  'sys-hubspot': { about: 'Finds duplicates, missing links and missing info in HubSpot. Fixes only the ones you tick.',
    asked: 'Asked by Kiko, approved 21 Oct', follows: [['HubSpot clean-up spec', 'Finds duplicates, missing links and missing info; Claude checks the unsure ones.'], ['No permanent delete', 'An archive goes to HubSpot\'s recycle bin for 90 days.'], ['Canvas fields fixed in Canvas', 'Fields that come from Canvas are fixed in Client Desk; the hourly sync carries them.']] },
  'sys-status': { about: 'One digest of every active project, plus client update drafts and new tasks, issues and risks from last week\'s emails.',
    asked: 'Asked by Kiko, approved 22 Oct', follows: [['Status reports spec', 'Every active project in one Canvas read, plus last week\'s emails per project.'], ['Client-safe only (no money or suppliers)', 'Money, costs, margins, prices, supplier names and internal risks are taken out of client drafts.'], ['Drafts, never sent', 'Client updates wait as drafts for you.']] },
  'sys-funnelreview': { about: 'Follow-ups due, inquiries and delivered projects gone quiet, and clients to win back.',
    asked: 'Asked by Kiko, approved 26 Oct', follows: [['CRM funnel spec F6', 'Reads Canvas\'s Sales funnel once per run.'], ['Canvas\'s quiet limits', 'How long an inquiry or delivered project can go quiet is set in Canvas.'], ['Drafts only', 'Inquiry and win-back emails go to your Gmail Drafts; you send each one.']] },
  'sys-funnel': { about: 'Counts your HubSpot deals per stage (the sales funnel) and lists your open HubSpot tasks, overdue first, on the Today card.',
    asked: 'Asked by Kiko 24 Oct ("Yes, build both")', follows: [['Sales funnel tasks spec', 'Reads every HubSpot deal and your open HubSpot tasks in one run.'], ['Code only, no AI', 'No AI call and no cost.'], ['One task at a time', 'Mark done closes one HubSpot task; deal stage and amount are never changed here.']] },   // release line: the live line has the HubSpot funnel row
  'sys-relnotes': { about: 'Turns today\'s Canvas and Cue releases into New and Fixed lines. You tap Post; staff see it at 8 PM.',
    asked: 'Asked by Kiko 27 Oct', follows: [['Daily release notes spec', 'Reads the Release Log tab: what went live since 7:45 PM yesterday.'], ['Staff only', 'Posted as a Canvas announcement to staff, not emailed.'], ['Posts only on your tap', 'Nothing is posted until you tap Post; Skip today drops it.']] },
  'sys-pipeline': { about: 'Reviews open HubSpot deals and suggests the next step for each.',
    asked: 'Asked by Kiko, approved 21 Oct', follows: [['Pipeline health spec', 'Flags each open deal with fixed rules and its newest email.'], ['Read only', 'Nothing is written to HubSpot or Canvas; follow-ups are drafted only when you ask.']] },
  'sys-rfps': { about: 'Sends the RFPs you pressed Send on in Canvas, from your Gmail, AccountsPayables@ in CC.',
    asked: 'Asked by Kiko 28 Oct ("from me")', follows: [['Supplier RFPs', 'Canvas queues the RFPs you press Send on; Cue sends them from your Gmail with AccountsPayables@ in CC.'], ['Sent once', 'Each RFP is recorded the moment Gmail sends it, so it never goes twice.']] },
  'sys-unsched': { about: 'Tells you about any task waiting on you that has no due date or reminder.',
    asked: 'Asked by Kiko 22 Oct (task scheduler)', follows: [['Task scheduler spec', 'Looks for tasks waiting on you (Needs you, Failed, Reopened) with no due date or reminder.'], ['Code only, no AI', 'No AI call and no cost.']] } };

/** The about line for one row of the Schedule tab (x from cueSchedRead_). */
function cueAdminSchedAbout_(x) {
  const A = CUE_ADMIN_SCHED_[x.id];
  if (A) return { about: A.about, asked: A.asked + ' · built by Claude', follows: A.follows.map(f => f.slice()) };
  if (/^gtask:/.test(x.run)) return { about: 'Runs "' + (x.command || x.name) + '" from your handbook with ChatGPT; you decide on each finding.',
    asked: 'Asked by Kiko 21 Oct, "Go" 22 Oct · built by Claude', follows: [['Your handbook skill: ' + x.name, 'ChatGPT follows that skill\'s numbered steps.'], ['Code checks every step', 'A step not reported or a record not read marks the card Incomplete.'], ['Drafts only, nothing sent', 'You decide each finding: draft, HubSpot or open in Canvas.']] };
  return { about: x.command ? 'Runs "' + x.command + '" as if you typed it.' : '', asked: 'Made by Kiko in chat' + (x.created ? ', ' + cueAdminDay_(new Date(x.created)) : ''),
    follows: [[x.run === 'remind' ? 'Reminder' : 'Runs as if you typed it', x.run === 'remind' ? 'Cue reminds you at that time.' : 'It starts the same task as typing the command.'], ['Nothing sends without your Approve', 'Emails stay drafts and Canvas writes wait for you.']] };
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
