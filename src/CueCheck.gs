/* CUE-CLOUD-CHECK-2026-10-27 (Kiko 04:48Z "i dont wanna be tied to that computer all day"; spec specs/cue-cloud-check.md,
 * approved 08:28Z). The check link: a robot browser in the cloud (test/checks/run.mjs) opens Cue's own page and sends each of
 * the page's calls here instead of to google.script.run. It runs the same server functions, in check mode.
 *   - The door opens only on the one "Cue check" version tools/check.mjs makes for a run. Everywhere else CUE_CHECK_FP_ is empty
 *     (CueCheckKey.gs), so this door refuses every call, and live /exec stays Google sign-in only.
 *   - A run's key is new each run; only its SHA-256 is in the version. The door also shuts at CUE_CHECK_UNTIL_.
 *   - Check mode locks, all here in Cue's code:
 *       write lock: a Canvas bridge write must name the test project (CUE_CHECK_PID_); reads stay real.
 *       mail lock: a Gmail draft may be sent only when every To, Cc and Bcc address is a test address (CUE_CHECK_MAIL_).
 *       send lock: Canvas actions that email people (CUE_CHECK_SENDS_) are refused unless CUE_CHECK_SEND_ is 'on', which
 *         test/checks/config.json allows only for a project whose crew are all Kiko's own aliases (Kiko 27 Oct 09:16Z: a
 *         real past project stands in for the test project, so its real crew must never be emailed).
 *       other writes: no other web write (HubSpot, TickTick, ...), no spreadsheet but the Cue sheet, no trigger changes.
 *       no leftovers: tasks and chat lines made in a check are tagged; cueResume, Send later and the sweep never run them, and
 *       the page Kiko uses never shows them. check_finish cancels any Send later and closes the run's tasks.
 * A refused write throws; the unsafe ones are also kept for check_finish, so the run fails and says what was stopped. */

const CUE_CHECK_FNS_ = ['cueState', 'cueSend', 'cueRun', 'cueRetry', 'cueApprove', 'cueReject', 'cueReopen', 'cueCloseTask', 'cueArchive',
  'cueAsNew', 'cueAskPick', 'cueSameAnswer', 'cueWrongCommand', 'cueCancelIntake', 'cueRescan', 'cueRfq', 'cueRfqPick', 'cueDrafts',
  'cueFolders', 'cueSupplierCanvas', 'cueSupplierSaved', 'cueReadyFollowups', 'cueReadyPick', 'cueReadyRecheck', 'cueHelpAct',
  'cueBidsClose', 'cueHsClose', 'cueHsLookup', 'cuePipeDone', 'cuePipeFollowUps', 'cueGtAct', 'cueGtClose', 'cueGtDraftAll',
  'cueStatusDone', 'cueStatusTri', 'cueSweepAct', 'cueSweepCancel', 'cueSweepItem', 'cueNmItem', 'cueVendorRfqs', 'cueBatchAdd', 'cueBatchCancel',
  'cueBatchStart', 'cueBatchTake', 'cueExpense', 'cueUsage', 'cueRules',
  'cueCrmLogCheck', 'cueFunnelCheck', 'cueJobsCheck', 'cueRnCheck', 'cueBidsLeadsCheck', 'cueNmCheck'];   // not page calls: the 1.27.34 check script asks the door for one read-only email log run; the 1.27.54 one for one Job Runs row (CueJobs.gs); the sales funnel one for the lines the morning batch would list (CueSweepFunnel.gs); the 1.27.57 one for made-up release notes (CueRelnotes.gs); the 1.27.56 one for the bid leads it would send (CueBids.gs); the 1.27.56 New mail one for a read-only pass over the last day of mail (CueNewMail.gs)
// Page calls the check never runs: settings, keys, schedules, Kiko's own rules and files. The page shows them as an error.
const CUE_CHECK_NEVER_ = ['cueFixAccess', 'cueSettings', 'cueRelayAct', 'cueRelayGate', 'cueRelayKeys', 'cueRelayUrlSet', 'cueRelayWrites',
  'cueRulesSave', 'cueMyRules', 'cueMyRuleSave', 'cueMyPatternDemote', 'cueTutorSet', 'cueSchedules', 'cueSchedSet', 'cueSchedDelete',
  'cueSchedRunNow', 'cueUsagePrices', 'cueAdminTriage', 'cueAdminTriageDel', 'cueAdminRelnotes', 'cueAdminChasers', 'cueAdminLog', 'cueAdminCanvasChasers', 'cueAdminCanvasChaseSend', 'cueAdminSnBoard', 'cueAdminSnItems', 'cueAdminSnPrepare', 'cueAdminSnSend', 'cueFinSave', 'cueFinSheet', 'cueLearnChats', 'cueFileData', 'cueUpload'];
// Bridge actions that only read. Every other action is a write and must name the test project.
// Canvas bridge actions that email someone. Refused in a check unless CUE_CHECK_SEND_ === 'on'.
const CUE_CHECK_SENDS_ = ['crew_docs_send', 'ar_email', 'send_payment_chasers', 'send_doc_reminder'];
const CUE_CHECK_READS_ = ['inbox_new', 'search_projects', 'find_similar_projects', 'get_project', 'get_project_board', 'list_project_files', 'canvas_link',
  'intake_evidence', 'expense_evidence', 'supplier_check', 'supplier_lookup', 'status_digest', 'overdue_billings', 'mail_waiting',
  'list_unsigned_docs', 'help_qa', 'get_readiness', 'finance_snapshot', 'crew_docs', 'crew_docs_job', 'ce_lines', 'accreditation_gaps', 'crm_funnel', 'crm_report',
  'bi_list', 'allow_list', 'read_rows', 'rfp_outbox'];   // generic bridge reads (CueEdit.gs); rfp_outbox: Kiko's queued RFPs (CueRfpSend.gs); write_rows and allow_list_set name no project, so a check stops them

const cueCheckTag_ = () => String(CUE_CHECK_FP_).slice(0, 12);
const cueCheckOn_ = () => !!globalThis.CUE_CHECK_ON_;

/** The door (doPost on the check version). q = { action, key, fn?, args? }. */
function cueCheckDoor_(q) {
  const no = { ok: false, error: 'Not allowed.' };
  if (!CUE_CHECK_FP_ || CUE_CHECK_FP_ === 'off' || !CUE_CHECK_PID_ || !CUE_CHECK_MAIL_) return no;
  if (!q || !cueCheckKeyOk_(q.key)) return no;
  // After the run ends only check_finish still works, for 30 minutes, so a slow run can still cancel and close what it made.
  const late = !(cueNow_() < Number(CUE_CHECK_UNTIL_));
  if (late && (q.action !== 'check_finish' || !(cueNow_() < Number(CUE_CHECK_UNTIL_) + 30 * 60e3))) return { ok: false, error: 'This check run has ended.' };
  if (!cueCheckEnter_()) return { ok: false, error: 'Check mode could not lock Cue down here, so nothing ran.' };
  if (q.action === 'check_ping') return { ok: true, version: CUE_VERSION_, project_id: CUE_CHECK_PID_, send: CUE_CHECK_SEND_ === 'on', until: Number(CUE_CHECK_UNTIL_) };
  if (q.action === 'check_finish') return Object.assign({ ok: true }, cueCheckFinish_());
  if (q.action !== 'check_call') return { ok: false, error: 'Unknown check action.' };
  const fn = String(q.fn || '');
  if (CUE_CHECK_FNS_.indexOf(fn) < 0 || typeof globalThis[fn] !== 'function') return { ok: false, error: fn + ' is not part of a check.' };
  try {
    const out = globalThis[fn].apply(null, Array.isArray(q.args) ? q.args : []);
    return { ok: true, result: out === undefined ? null : JSON.parse(JSON.stringify(out)) };
  } catch (e) { return { ok: false, error: String((e && e.message) || e).slice(0, 1000) }; }
}

/** The run's key matches the fingerprint in this version. Compares every byte. */
function cueCheckKeyOk_(key) {
  const k = String(key || '');
  if (k.length < 32) return false;
  const got = cueSha_(k), want = String(CUE_CHECK_FP_);
  if (got.length !== want.length) return false;
  let diff = 0; for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ want.charCodeAt(i);
  return !diff;
}

/** Turns check mode on: wraps the web, spreadsheet and trigger services. False if they cannot be wrapped (then nothing runs). */
function cueCheckEnter_() {
  if (cueCheckOn_()) return true;
  const U = UrlFetchApp, S = SpreadsheetApp, A = ScriptApp;
  const pass = (t, k) => { const v = t[k]; return typeof v === 'function' ? v.bind(t) : v; };
  const fetch = (u, o) => { cueCheckAllow_(Object.assign({ url: u }, o || {})); return U.fetch(u, o); };
  const fetchAll = reqs => { (reqs || []).forEach(cueCheckAllow_); return U.fetchAll(reqs); };
  const openById = id => { if (String(id) !== cueProp_('CUE_SHEET_ID', '')) cueCheckStop_('opening a spreadsheet other than the Cue sheet', true); return S.openById(id); };
  try {
    globalThis.CUE_CHECK_WEB_ = U;
    globalThis.UrlFetchApp = new Proxy(U, { get: (t, k) => (k === 'fetch' ? fetch : k === 'fetchAll' ? fetchAll : k === '__cueCheck' ? true : pass(t, k)) });
    globalThis.SpreadsheetApp = new Proxy(S, { get: (t, k) => (k === 'openById' ? openById : k === 'openByUrl' || k === 'create' ? () => cueCheckStop_('opening another spreadsheet', true)
      : k === '__cueCheck' ? true : pass(t, k)) });
    globalThis.ScriptApp = new Proxy(A, { get: (t, k) => (k === 'newTrigger' || k === 'deleteTrigger' ? () => cueCheckStop_('changing Cue\'s triggers', true)
      : k === '__cueCheck' ? true : pass(t, k)) });
  } catch (e) { console.error('Check mode: ' + e); return false; }
  if (!(UrlFetchApp.__cueCheck === true && SpreadsheetApp.__cueCheck === true && ScriptApp.__cueCheck === true)) return false;
  globalThis.CUE_CHECK_ON_ = true;
  return true;
}

/** Throws; an unsafe attempt is also kept so check_finish fails the run. quiet = housekeeping Cue tries on its own (not unsafe). */
function cueCheckStop_(what, quiet) {
  if (!quiet) {
    try {
      const c = CacheService.getScriptCache(), k = 'cue-check-stopped-' + cueCheckTag_(), was = JSON.parse(c.get(k) || '[]');
      was.push(String(what).slice(0, 300)); c.put(k, JSON.stringify(was.slice(-50)), 21600);
    } catch (e) { console.error('Check log: ' + e); }
  }
  throw new Error('Check mode stopped ' + what + '.');
}

/** One outgoing request. Reads (GET) pass. Writes pass only where the locks allow them. */
function cueCheckAllow_(r) {
  const url = String((r && r.url) || ''), m = String((r && r.method) || 'get').toLowerCase();
  if (m === 'get') return;
  const bridge = cueProp_('CUE_BRIDGE_URL', '');
  if (bridge && url.indexOf(bridge + '?') === 0) return cueCheckBridgeOk_(r.payload);
  if (/^https:\/\/api\.(openai|anthropic)\.com\//.test(url)) return;                          // AI calls (they cost, they write nothing)
  if (url === 'https://oauth2.googleapis.com/tokeninfo') return;                                  // Cue reads its own access
  if (/^https:\/\/www\.googleapis\.com\/(upload\/)?drive\/v3\/files([/?]|$)/.test(url)) return;   // Cue's own Drive files (drive.file)
  if (/^https:\/\/gmail\.googleapis\.com\/gmail\/v1\/users\/me\/drafts\/send$/.test(url)) return cueCheckDraftOk_(r.payload);
  if (/^https:\/\/gmail\.googleapis\.com\/(upload\/)?gmail\/v1\/users\/me\/drafts([/?]|$)/.test(url)) return;   // a draft sends nothing
  cueCheckStop_('a write to ' + url.split('?')[0]);
}

/** Write lock: a bridge write must name the test project; a plan must be one cueBridgePlan_ checked. */
function cueCheckBridgeOk_(payload) {
  let b = null; try { b = JSON.parse(String(payload || '')); } catch (e) { b = null; }
  if (!b || !b.action) return cueCheckStop_('a Canvas call Cue could not read');
  if (b.action === 'claim_plan') {
    if (b.args && b.args.plan_hash && b.args.plan_hash === globalThis.CUE_CHECK_PLAN_) return;
    return cueCheckStop_('a Canvas plan outside the test project');
  }
  if (CUE_CHECK_SENDS_.indexOf(b.action) >= 0 && CUE_CHECK_SEND_ !== 'on') return cueCheckStop_('Canvas ' + b.action + ' (this check may not email anyone)');
  if (CUE_CHECK_READS_.indexOf(b.action) >= 0) return;
  if (String(b.project_id || '') === String(CUE_CHECK_PID_)) return;
  cueCheckStop_('Canvas ' + b.action + ' on ' + (b.project_id || 'no project') + ' (only ' + CUE_CHECK_PID_ + ' may be written)');
}
/** cueBridgePlan_ calls this before it claims a plan: every command must name the test project. */
function cueCheckPlan_(cmds, planHash) {
  const mail = cmds.filter(c => CUE_CHECK_SENDS_.indexOf(c.action) >= 0 && CUE_CHECK_SEND_ !== 'on');
  if (mail.length) cueCheckStop_('Canvas ' + mail[0].action + ' (this check may not email anyone)');
  const bad = cmds.filter(c => String(c.pid || '') !== String(CUE_CHECK_PID_));
  if (bad.length) cueCheckStop_('Canvas ' + bad[0].action + ' on ' + (bad[0].pid || 'no project') + ' (only ' + CUE_CHECK_PID_ + ' may be written)');
  globalThis.CUE_CHECK_PLAN_ = planHash;
}

/** Mail lock: reads the draft's To, Cc and Bcc and lets it go only if every address is a test address. */
function cueCheckDraftOk_(payload) {
  let id = ''; try { id = String(JSON.parse(String(payload || '')).id || ''); } catch (e) { id = ''; }
  if (!/^[\w-]+$/.test(id)) return cueCheckStop_('sending an email Cue could not read');
  const res = globalThis.CUE_CHECK_WEB_.fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts/' + id
    + '?format=metadata&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Bcc', { muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } });
  let d = null; try { d = JSON.parse(res.getContentText()); } catch (e) { d = null; }
  const heads = (d && d.message && d.message.payload && d.message.payload.headers) || [];
  const to = [].concat.apply([], heads.filter(h => /^(to|cc|bcc)$/i.test(h.name)).map(h => String(h.value || '').match(/[^\s<>,;"']+@[^\s<>,;"']+/g) || []));
  const ok = new RegExp(CUE_CHECK_MAIL_, 'i'), bad = to.filter(a => !ok.test(a));
  if (!to.length || bad.length) cueCheckStop_('an email to ' + (bad.join(', ') || 'nobody') + ' (only test addresses may get mail)');
}

/** End of a run: cancels any Send later, closes the run's tasks, reports what check mode stopped. */
function cueCheckFinish_() {
  const tag = cueCheckTag_(), out = { closed: 0, later_cancelled: 0, stopped: [] };
  cueLocked_(() => {
    const sh = cueSheet_('Requests');
    cueRows_(sh).forEach((r, i) => {
      let s = null; try { s = JSON.parse(r.slice(10, 10 + CUE_CELLS_).join('')); } catch (e) { return; }
      if (!s || s.check !== tag || s.check_closed) return;
      if (s.ar && s.ar.send_at) { delete s.ar.send_at; out.later_cancelled++; }
      if (s.batch && s.batch.send_at) { delete s.batch.send_at; out.later_cancelled++; }
      s.check_closed = cueNow_(); delete s.lease_until;
      if (['Done', 'Rejected', 'Failed'].indexOf(s.status) < 0) { s.status = 'Done'; s.stage = 'Closed by the check'; }
      cueSave_(sh, i + 2, s); out.closed++;
    });
  });
  try { out.stopped = JSON.parse(CacheService.getScriptCache().get('cue-check-stopped-' + tag) || '[]'); } catch (e) { out.stopped = ['the check log could not be read']; }
  return out;
}
