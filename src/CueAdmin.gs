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
  // CUE-TEMPLATES-2026-10-31: C2 and C3 join the page (spec part 2).
  inquiry: { about: 'C2: follows up a client who went quiet after their inquiry. First follow-up, then the final one, 3 business days apart; then it asks you to park them.',
    from: 'your Gmail', to: 'the inquiry\'s contact in Canvas', sample: { who: '<Contact>', project: '<Client>', times: 0, facts: { contact: '<Contact>', client: '<Client>', inquiry: '<Inquiry>' } } },
  inbox: { about: 'C3: a client replied and is waiting on you. ChatGPT writes only the answer and next step; the rest is your template. Listed in the 8 AM update.',
    from: 'your Gmail, as a reply in their thread', to: 'the person who wrote to you', sample: { who: '<Name>', subject: '<Their subject>' }, middle: '<The direct answer to their question.> <The confirmed next step, with who and when.>' },
  rfq: { about: 'Nudges a supplier who hasn\'t answered your RFQ.', from: 'your Gmail, as a reply in the RFQ thread', to: 'the supplier you sent the RFQ to',
    sample: { who: '<Supplier name>', to: '<supplier email>', thread_subject: 'RFQ: <RFQ title>', project: '<Event>', facts: { rfq_subject: 'RFQ: <RFQ title>', rfq_sent: '<RFQ date>', reply_by: '<Reply-by date>' } } },
  award: { about: 'Asks a client if they have decided on a CE marked "For client awarding".', from: 'your Gmail, in the CE thread', to: 'the client contact on the CE email thread',
    sample: { who: '<Client>', project: '<Event>', facts: { chaser_number: 1, event_date: '<Event date>' } } },
  payment: { about: 'Reminds a client whose billing invoice is past due.', from: 'info@ through Canvas, you in CC', to: 'the client\'s billing contact in Client Desk',
    sample: { project: '<Event>', times: 0, facts: { contact: '<Billing contact>', bis: [{ no: '<BI number>', project: '<Event>', balance_text: '<Balance>', due: '<Due date>' }] } } },
  accreditation: { about: 'Asks a supplier to finish their accreditation.', from: 'your Gmail, suppliers@ in CC', to: 'the supplier\'s email on file in Canvas',
    sample: { who: '<Supplier name>', facts: { contact_name: '<Supplier name>', project: '<Event>', missing: ['<Missing items>'], form_url: '<Accreditation form link>' } } },
  signature: { about: 'Asks crew to sign an FSA or AR they haven\'t signed.', from: 'freelancers@ through Canvas', to: 'the crew member\'s email in Canvas',
    sample: { who: '<Crew>', project: '<Event>', docs: [{ doc: '<FSA or AR>', project: '<Event>', role: '<Role>' }], sign_url: '<Sign link>' } } };

/** Cue's own scheduled tasks: what each does, who asked for it and when, and what it follows ([name, what it means]). */
const CUE_ADMIN_SCHED_ = {
  // CUE-K0-2026-10-31 (spec cue-message-redesign-spec.md, approved by Kiko 31 Oct 2026). silent: with the 8 AM update on, the job posts
  // nothing to the main chat (rule R2); what it finds shows in the 8 AM update, and a failure still says so.
  'sys-k0': { spec: 'cue-message-redesign-spec.md', about: 'Weekdays at 8:00: Yesterday\'s summary (with Tracker tasks completed and moved), Today\'s focus (your Shared Task Tracker, each ongoing project\'s timeline, team tasks to nudge), the New opportunities card and New clients (reply "add 2" or "no 2"). While it is on, the jobs marked Silent post nothing to the chat.',
    asked: 'Asked by Kiko 31 Oct, spec and mockup approved 31 Oct', follows: [['Your 8 AM format', 'Critical today; Yesterday\'s summary (projects, opportunities, company); Today\'s work (assigned, review, follow up, blocked). Empty parts are left out.'], ['Approve = send', 'Chasers, contacts, bids and Friday updates go only for the numbers you name.']] },
  'sys-k0pm': { spec: 'cue-message-redesign-spec.md', about: 'Weekdays at 2 PM: the funnel\'s follow-ups and every chaser due, numbered. Reply "1, 3" and Cue drafts them (tailored to each client\'s latest email) as cards to check; each goes only when you press Send.',
    asked: 'Asked by Kiko 1 Nov ("2PM Funnel, Chasers")', follows: [['Draft, then you send', 'A pick drafts; nothing goes out until you press Send on that email.']] },
  'sys-newmail': { silent: true, spec: 'cue-message-redesign-spec.md', about: 'Reads new mail in your Gmail and info@ every 5 minutes; Claude sorts it every 30 minutes into the New mail thread.',
    asked: 'Asked by Kiko 27 Oct; made silent 31 Oct', follows: [['Silent', 'No chat line for new mail; it stays in the New mail thread.']] },
  'sys-contacts': { silent: true, spec: 'gmail-new-contacts.md', about: 'Finds people you email who are not in Canvas yet. They come to you as "Add contact" lines in the 8 AM update.',
    asked: 'Asked by Kiko 29 Oct; into the 8 AM update 31 Oct', follows: [['Approve = add', 'Nobody is added to Canvas until you name them in your reply.']] },
  'sys-accred': { silent: true, spec: 'client-accreditation.md', about: 'Files clients\' accreditation replies under each company\'s Accreditation thread every 30 minutes.',
    asked: 'Asked by Kiko 29 Oct', follows: [['Silent', 'No chat line; the company\'s thread is marked Needs you.']] },
  'sys-crm': { silent: true, spec: 'canvas-crm-funnel.md', about: 'Runs Canvas\'s 15-minute CRM work from your account (stage moves Canvas already does, follow-up dates).',
    asked: 'Asked by Kiko 29 Oct', follows: [['Silent', 'Nothing in the chat.']] },
  'sys-sweep': { silent: true, spec: 'sweep-engine.md', about: 'Weekdays at 1:00 PM: finds every chaser due today for your 2 PM update. Pick them by number and Cue drafts them; a picked email goes only when you press Send on its card, and other ticked emails only after you tap Approve and send.',
    asked: 'Asked by Kiko, approved 21 Oct', follows: [['Chaser rules', 'When each chaser starts, how often it repeats and when it stops.', 'chasers'], ['Send each', 'Nothing goes out until you press Send on that chaser\'s card; each email is sent on its own.'], ['Sweep engine spec', 'Code finds the lines, ChatGPT writes the words in one call, a template covers a failed call.']] },
  'sys-bids': { silent: true, spec: 'bid-opportunities.md', about: 'Weekdays at 6:30 ChatGPT checks the agreed bid sources and Cue\'s own code reads New PhilGEPS; new bids that pass the screen show in the New opportunities card under the 8 AM update. Only events, events management, and lights and sounds.',
    asked: 'Asked by Kiko 21 Oct (route B)', follows: [['Kiko\'s 8-step bid workflow', 'ChatGPT searches the sources and reads each notice; code screens and dedupes against your bid sheet.'], ['₱50k to ₱1M', 'Only bids with an approved budget in this range pass.'], ['NCR + 6 provinces, never Bataan', 'NCR, Batangas, Laguna, Cavite, Rizal, Bulacan and Quezon.'], ['No bid submitted', 'It never registers, pays a fee or submits a bid.']] },
  'sys-status': { silent: true, spec: 'status-reports.md', about: 'Fridays at 5 PM, one client email per active event: each requirement\'s progress, the timeline, the readiness score, open risks and issues, tasks, and Go to Canvas.',
    asked: 'Asked by Kiko 29 Oct 12:57Z', follows: [['Fresh readiness scan first', 'Canvas reruns each event\'s readiness checklist before the email is built.'], ['What the client site shows', 'Requirements, timeline, risks, issues and tasks come from what the client already sees on Canvas; supplier names and peso amounts are cut.'], ['Sent only on your tap', 'Each email goes from your Gmail only when you tap its Send.']] },
  'sys-funnelreview': { spec: 'canvas-crm-funnel.md', about: 'Follow-ups due, inquiries and delivered projects gone quiet, and clients to win back.',
    asked: 'Asked by Kiko, approved 26 Oct', follows: [['CRM funnel spec F6', 'Reads Canvas\'s Sales funnel once per run.'], ['Canvas\'s quiet limits', 'How long an inquiry or delivered project can go quiet is set in Canvas.'], ['Drafts only', 'Inquiry and win-back emails go to your Gmail Drafts; you send each one.']] },
  'sys-funnel': { silent: true, spec: 'sales-funnel-tasks.md', about: 'Weekdays at 1:15 PM, for the 2 PM update: Canvas\'s Accounts dashboard on the Today card: companies per P0 to P9 stage, follow-up emails due, accreditations, projects at risk and the deals waiting for award.',
    asked: 'Asked by Kiko 24 Oct ("Yes, build both")', follows: [['Canvas CRM dashboard', 'Reads the P0 tab and Canvas\'s Sales funnel in one run.'], ['Code only, no AI', 'No AI call and no cost.'], ['Read only', 'Deal stage and amount are never changed here.']] },
  'sys-relnotes': { spec: 'daily-release-notes.md', about: 'Turns today\'s Canvas and Cue releases into New and Fixed lines. You tap Post; staff see it at 8 PM.',
    asked: 'Asked by Kiko 27 Oct', follows: [['Daily release notes spec', 'Reads the Release Log tab: what went live since 7:45 PM yesterday.'], ['Staff only', 'Posted as a Canvas announcement to staff, not emailed.'], ['Posts only on your tap', 'Nothing is posted until you tap Post; Skip today drops it.']] },
  'sys-rfps': { about: 'Sends the RFPs you pressed Send on in Canvas, from your Gmail, AccountsPayables@ in CC.',
    asked: 'Asked by Kiko 28 Oct ("from me")', follows: [['Supplier RFPs', 'Canvas queues the RFPs you press Send on; Cue sends them from your Gmail with AccountsPayables@ in CC.'], ['Sent once', 'Each RFP is recorded the moment Gmail sends it, so it never goes twice.']] },
  'sys-unsched': { spec: 'task-scheduler.md', about: 'Tells you about any task waiting on you that has no due date or reminder.',
    asked: 'Asked by Kiko 22 Oct (task scheduler)', follows: [['Task scheduler spec', 'Looks for tasks waiting on you (Needs you, Failed, Reopened) with no due date or reminder.'], ['Code only, no AI', 'No AI call and no cost.']] } };

/** The about line for one row of the Schedule tab (x from cueSchedRead_). */
function cueAdminSchedAbout_(x) {
  const A = CUE_ADMIN_SCHED_[x.id];
  if (A) return { about: A.about, asked: A.asked + ' · built by Claude', spec: A.spec || '', follows: A.follows.map(f => f.slice()), silent: !!A.silent && typeof cueK0On_ === 'function' && cueK0On_() };
  if (/^gtask:/.test(x.run)) return { about: 'Runs "' + (x.command || x.name) + '" from your handbook with ChatGPT; you decide on each finding.',
    asked: 'Asked by Kiko 21 Oct, "Go" 22 Oct · built by Claude', spec: 'lead-gen-tasks.md', follows: [['Your handbook skill: ' + x.name, 'ChatGPT follows that skill\'s numbered steps.'], ['Code checks every step', 'A step not reported or a record not read marks the card Incomplete.'], ['Drafts only, nothing sent', 'You decide each finding: draft or open in Canvas.']] };
  return { about: x.command ? 'Runs "' + x.command + '" as if you typed it.' : '', asked: 'Made by Kiko in chat' + (x.created ? ', ' + cueAdminDay_(new Date(x.created)) : ''),
    follows: [[x.run === 'remind' ? 'Reminder' : 'Runs as if you typed it', x.run === 'remind' ? 'Cue reminds you at that time.' : 'It starts the same task as typing the command.'], ['Nothing sends without your Approve', 'Emails stay drafts and Canvas writes wait for you.']] };
}

/** Jobs › Chasers: each chaser kind with its rule and its email template, the placeholders in <angle brackets> (Kiko 29 Oct 03:35Z:
 *  the specific chases come to Kiko in Cue's morning batch, so this page shows "the generic templates for each chaser"). Read only. */
function cueAdminChasers() {
  cueOwner_();
  const rules = cueRules_(), G = rules.general, at = h => String(h).padStart(2, '0') + ':00';
  return { build: at(G.build), send: at(G.send),
    kinds: Object.keys(CUE_ADMIN_CHASE_).map(kind => {
      const R = rules.kinds[kind] || {}, A = CUE_ADMIN_CHASE_[kind], k = cueKinds_().filter(x => x.kind === kind)[0];
      let tpl = { subject: '', body: '' };
      try { if (k && typeof k.wrap === 'function' && A.middle) tpl = k.wrap(JSON.parse(JSON.stringify(A.sample)), A.middle) || tpl; else if (k && typeof k.template === 'function') tpl = k.template(JSON.parse(JSON.stringify(A.sample))) || tpl; } catch (e) { console.warn('Cue Admin chasers: ' + kind + ' template: ' + e); }
      return { kind, label: R.label || kind, on: R.on !== false, about: A.about, from: A.from, to: A.to,
        ai: !!(k && k.draftBrief), subject: String(tpl.subject || ''), body: String(tpl.body || '') };
    }) };
}

/* CUE-ADMIN-LOG-2026-10-29 (Kiko 29 Oct 03:43Z "Reporting ... It has to be all not split"; 03:46Z "Maybe we can do a Historical or Log
 * page? filtered by the different Jobs. and Status"). Epic Cue #193. Cue Admin › Log, one list for both systems, newest first:
 *   - every background job Cue ran, from the Job Runs tab (30 days, CueJobs.gs): status OK or Failed;
 *   - every email and text Canvas sent (bridge read sent_log, 30 days; Canvas SentLog.gs): status Sent, Failed or No address.
 * With the job names and statuses the page filters on, Canvas's failed count for the last 7 days and the Semaphore text credit.
 * If Canvas can't be read, the Cue rows still show and canvas_error says why. Read only. */
const CUE_ADMIN_LOG_MAX_ = 1000;
function cueAdminLog() {
  cueOwner_();
  const sh = cueSheet_('Job Runs'), n = sh.getLastRow() - 1, rows = [];
  if (n > 0) sh.getRange(Math.max(2, n - CUE_ADMIN_LOG_MAX_ + 2), 1, Math.min(n, CUE_ADMIN_LOG_MAX_), 6).getValues().reverse().forEach(r => {
    const t = r[0] instanceof Date ? r[0].getTime() : Date.parse(String(r[0] || ''));
    if (!r[2] || isNaN(t)) return;
    const p = cuePh_(t), secs = Math.round(((r[1] instanceof Date ? r[1].getTime() : Date.parse(String(r[1] || ''))) - t) / 1000);
    rows.push({ at: new Date(t).toISOString(), day: cueRnDay_(p.day), time: String(p.hour).padStart(2, '0') + ':' + String(p.minute).padStart(2, '0'),
      from: 'Cue', job: String(r[2]), status: String(r[3]) === 'Failed' ? 'Failed' : 'OK', error: String(r[4] || ''),
      count: r[5] === '' || r[5] == null ? '' : String(r[5]), secs: isNaN(secs) ? '' : secs });
  });
  const out = { jobs: cueJobs_().map(j => j.job), rows, failed7: null, sms_credit: null, canvas_error: '' };
  try {
    const c = cueBridge_(cueAdminS_(), 'sent_log', { days: 30 }) || {};
    out.failed7 = typeof c.failed7 === 'number' ? c.failed7 : null;
    out.sms_credit = typeof c.sms_credit === 'number' ? c.sms_credit : null;
    (c.rows || []).forEach(x => {
      const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(String(x.at || ''));   // Manila time already
      if (!m) return;
      rows.push({ at: new Date(Date.parse(m[1] + 'T' + m[2] + ':00+08:00')).toISOString(), day: cueRnDay_(m[1]), time: m[2], from: 'Canvas',
        job: String(x.job || 'Canvas notice'), status: String(x.status || ''), error: String(x.error || ''), count: '', secs: '',
        channel: x.channel === 'text' ? 'text' : 'email', kind: String(x.kind || ''), name: String(x.name || x.to || ''), to: String(x.to || ''),
        project: String(x.project || ''), subject: String(x.subject || '') });
    });
  } catch (e) { out.canvas_error = cueStr_((e && e.message) || e, 300); }
  rows.sort((a, b) => a.at < b.at ? 1 : a.at > b.at ? -1 : 0);
  rows.forEach(x => { if (out.jobs.indexOf(x.job) < 0) out.jobs.push(x.job); });
  out.statuses = ['OK', 'Sent', 'Failed', 'No address'].filter(st => rows.some(x => x.status === st));
  return out;
}
