/* CUE-CRM-TICK-2026-10-29 (bug). Kiko 29 Oct 2026 02:11:02Z: "Make all Cue and CRM related timers to my account. The rest is with
 * Info". Canvas V329 shipped the bridge action crm_tick (handoffs/crm-tick-from-cue.md in CanvasWorkspace), but no Cue release
 * called it, so info@'s 15-minute crmTick trigger kept doing the CRM work.
 * Every 15 minutes this job asks Canvas to run that work: the Accounts cache, deals following award status, the monthly win-back
 * list and Auto add when it is on. Once Canvas sees Cue's call, info@'s trigger deletes itself; if Cue stops calling for 40
 * minutes, Canvas falls back to it as before, so there is never a gap.
 *   - One bridge call, crm_tick (queue, no arguments, no ledger row). No AI, no email, no Gmail, no new trigger: it runs inside
 *     cueResume's 5-minute tick, as a job, so a failure shows in the Job Runs tab and the call is tried again 15 minutes later.
 *   - The time is noted before the call, so a slow or failed Canvas run is never repeated on the next 5-minute tick.
 *   - A cloud check never calls it: the CRM work writes to Canvas's sheets. */
const CUE_CRMTICK_ = { every_min: 15, slack_ms: 30 * 1000 };   // the 5-minute ticks drift a few seconds; 30 s slack keeps it on every third tick

/** The job: runs Canvas's CRM work when 15 minutes have passed since the last call. Returns null when not due, else the number of
 * clients and contacts Auto add added (for the Job Runs Count column). */
function cueCrmTickTick_() {
  if (globalThis.CUE_CHECK_ON_ || UrlFetchApp.__cueCheck === true) return null;   // a check version never does Canvas's CRM work
  const now = cueNow_(), P = PropertiesService.getScriptProperties(), last = Number(P.getProperty('CUE_CRMTICK_AT') || 0);
  if (now - last < CUE_CRMTICK_.every_min * 60 * 1000 - CUE_CRMTICK_.slack_ms) return null;
  P.setProperty('CUE_CRMTICK_AT', String(now));
  const r = cueBridge_({ id: 'crmtick-' + now.toString(36) }, 'crm_tick', {}) || {};
  return (Number(r.companies) || 0) + (Number(r.contacts) || 0);
}
