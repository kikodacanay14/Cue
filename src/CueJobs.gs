/**
 * STRUCTURE-PHASE-3 (3.1, Kiko 28 Oct 2026 06:05Z "yes"; spec specs/cue-structure-review.md): the background jobs cueResume runs
 * every 5 minutes, in one list, and the "Job Runs" tab that records each run.
 *
 * Before this, cueResume was a fixed chain of try blocks and a failure went only to the Apps Script log, which Kiko never sees
 * (the old Canvas email check stopped on 25 Oct and nobody knew). Now each run writes one row: Started, Finished, Job, Result
 * ("OK" or "Failed"), Error (first line) and Count (what the job returned, when it is a number or a list).
 *
 * Shape agreed with the notifications thread (05:37Z): Cue has no jobs view of its own. Canvas Admin reads this tab through a
 * read-only bridge action (story N8, the "everything sent" log) and raises the one failure alert (N9). Cue never writes to
 * Canvas for this. Rows older than 30 days are deleted once a day (Kiko 28 Oct 2026 06:08Z, "Yes, keep 30 days"). Each job keeps its own timing ("due" checks stay inside the job), so nothing runs more or less often.
 * A job names its function, looked up when it runs: a release branch that does not carry a feature (for example the CRM email
 * log on the live line, or the 1.27.7 stuck-write fix on main) skips that job and writes no row, where the old chain threw "is not defined" into the log every tick.
 */
function cueJobs_() {
  return [
    { job: 'Reminders and approved sends', fn: 'cueSweepTick_' },   // reminders, and 9:00 sends Kiko approved
    { job: 'Bid check tidy', fn: 'cueBidsTidyAll_' },               // once: one Bid check thread per day
    { job: 'Stuck write fix', fn: 'cueFixStuckWrites_' },          // 1.27.7: CE cost / expense approved before the save fix
    { job: 'Relay notes', fn: 'cueRelaySweep_' },                   // notes claude.ai added to the Relay tab
    { job: 'ChatGPT tasks', fn: 'cueRelayTasks_' },                 // tasks ChatGPT handed over (if the one-off trigger missed them)
    { job: 'FSA and AR Send later', fn: 'cueArDue_' },              // CREW-DOCS-2026-10-26: FSAs and ARs Kiko chose to Send later
    { job: 'Emails waiting check', fn: 'cueMaTick_' },              // CUE-MAIL-ALERTS-2026-10-27: Emails waiting file for Canvas, every 10 minutes
    { job: 'Project log', fn: 'cuePlogFlush_' },                    // CUE-PROJECT-LOG-2026-10-27: emails, task summaries and chasers to the project logs
    { job: 'Messenger inbox', fn: 'cueMsgrPull_' },                   // CUE-MSGR-2026-11-02: crew messages held by the Messenger relay, every 5 min, no AI
    { job: 'Messenger sign links', fn: 'cueMsgrTick_' },              // CUE-MSGR-2026-11-02: unsigned FSA and AR links on Messenger, every 15 min, no AI
    { job: 'Release notes at 8 PM', fn: 'cueRnDue_' },              // CUE-RELNOTES-2026-10-27: release notes Kiko approved before 8 PM
    { job: 'CRM email log', fn: 'cueCrmLogTick_' },                 // CUE-CRM-EMAIL-LOG-2026-10-26: client emails to Accounts › Activity, hourly
    { job: 'New mail', fn: 'cueNmTick_', row: 'sys-newmail' },                          // CUE-NEW-MAIL-2026-10-27: new mail in Kiko's inbox and info@, Claude sorts every 30 min
    { job: 'New contacts from Gmail', fn: 'cueCnTick_', row: 'sys-contacts' },          // CUE-CONTACT-NEW-2026-10-29: 3-year rewind, then weekly; one Approve card at a time
    { job: 'CRM work', fn: 'cueCrmTickTick_', row: 'sys-crm' },                     // CUE-CRM-TICK-2026-10-29: Canvas's 15-minute CRM work, from Kiko's account (bridge crm_tick)
    { job: 'Client accreditation mail', fn: 'cueAcTick_', row: 'sys-accred' },
    { job: '8 AM update after the morning batch', fn: 'cueK0Retry_' },   // CUE-K0-2026-10-31: the update waits while the 07:00 batch still drafts         // CLIENT-ACCRED-THREADS-2026-10-29: replies into each company's Accreditation thread, every 30 min
    { job: 'New PhilGEPS read', fn: 'cueBidsPgTick_' },             // CUE-BIDS-PG-2026-11-01: the public bulletin board, hourly 7 AM to 7 PM, no AI
    { job: 'Service Desk reports', fn: 'cueSdTick_' },              // SERVICE-DESK-2026-11-07: Canvas bug reports to Kiko's chat, every 15 min, no AI
    { job: 'Schedules', fn: 'cueSchedTick_', last: true }          // last, after the tasks: a task it starts runs on the next tick in its own 6 minutes
  ];
}

/** CUE-K0-2026-10-31: a background job's On switch (its Schedule row). No row yet = on, as before. One read per tick. */
function cueJobOn_(id) {
  if (!globalThis.CUE_JOB_ROWS_) { const m = {}; try { const sh = cueSheet_(CUE_SCHED_TAB_); if (sh) cueSchedRead_(sh).forEach(x => { m[x.id] = x.on; }); } catch (e) { console.warn('Job switches: ' + e); } globalThis.CUE_JOB_ROWS_ = m; }
  return globalThis.CUE_JOB_ROWS_[id] !== false;
}

/** Runs one job and adds its row to `rows`. A failure is caught here, so the next job still runs (as the old try chain did). */
function cueJobRun_(j, rows) {
  const run = globalThis[j.fn];
  if (typeof run !== 'function') return;   // not in this build
  if (j.row && !cueJobOn_(j.row)) return;   // CUE-K0-2026-10-31: switched off in Cue Admin › Jobs › Scheduled tasks
  const started = new Date(cueNow_());
  let out, err = '';
  try { out = run(); }
  catch (e) { err = String((e && e.message) || e).split('\n')[0].slice(0, 300); console.error(j.job + ': ' + e); }
  const count = typeof out === 'number' ? out : Array.isArray(out) ? out.length : out && typeof out.added === 'number' ? out.added : '';
  rows.push([started.toISOString(), new Date(cueNow_()).toISOString(), j.job, err ? 'Failed' : 'OK', err, count]);
}

const CUE_JOB_KEEP_DAYS_ = 30;   // Kiko 28 Oct 2026 06:08Z: "Yes, keep 30 days"

/** One write per tick for all its rows, then the daily trim. Logging never stops a job: a failure goes to the Apps Script log only. */
function cueJobLog_(rows) {
  if (!rows.length) return;
  try {
    const sh = cueSheet_('Job Runs');
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    cueJobTrim_(sh, rows[0][0]);
  } catch (e) { console.error('Job Runs: ' + e); }
}

/** Once a day (the first tick of the UTC day): deletes the rows started more than 30 days ago. Rows are written in time order, so
 * the old ones are the top rows under the header. */
function cueJobTrim_(sh, nowIso) {
  const day = String(nowIso).slice(0, 10), P = PropertiesService.getScriptProperties();
  if (P.getProperty('CUE_JOB_TRIM_DAY') === day) return 0;
  P.setProperty('CUE_JOB_TRIM_DAY', day);
  const n = sh.getLastRow() - 1;
  if (n < 1) return 0;
  const cut = new Date(Date.parse(nowIso) - CUE_JOB_KEEP_DAYS_ * 864e5).toISOString();
  const started = sh.getRange(2, 1, n, 1).getValues();
  let old = 0;
  while (old < n && String(started[old][0]) < cut) old++;
  if (old) sh.deleteRows(2, old);
  return old;
}

/** Cloud check only (test/checks/1.27.54-job-runs.check.mjs, through the check door): runs one job the way cueResume does (looked
 * up by name, timed, its row written in one write with the daily trim) and reads its row back from the Job Runs tab. The job is
 * "Bid check tidy": a one-off from 1.27.2 that returns 0 without writing once it has run. Writes that one row to Cue's own sheet. */
function cueJobsCheck() {
  cueOwner_();
  const j = cueJobs_().filter(x => x.fn === 'cueBidsTidyAll_')[0], rows = [];
  cueJobRun_(j, rows);
  cueJobLog_(rows);
  const sh = cueSheet_('Job Runs'), n = sh.getLastRow() - 1;
  const back = n > 0 ? sh.getRange(2, 1, n, CUE_TABS_['Job Runs'].length).getValues().filter(r => String(r[0]) === rows[0][0] && r[2] === j.job) : [];
  return { wrote: rows[0], read: back.map(r => r.map(String)), header: sh.getRange(1, 1, 1, CUE_TABS_['Job Runs'].length).getValues()[0], rows: n,
    trim_day: PropertiesService.getScriptProperties().getProperty('CUE_JOB_TRIM_DAY') || '' };
}
