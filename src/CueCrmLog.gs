/* CUE-CRM-EMAIL-LOG-2026-10-26 (spec canvas-crm-funnel.md, part F5; Kiko approved the spec 16:08Z and chose "Log
 * automatically" 16:10Z, which relaxes the approve-every-Canvas-write rule for these email logs only).
 * Every hour from 08:00 to 21:00 Manila, Cue logs Kiko's waiting client emails to Canvas Accounts › Activity, so the CRM
 * funnel knows who was last in touch. No AI call and no tap.
 *   - Source: the bridge read mail_waiting (Kiko's Emails waiting list: known senders, headers only, no email text). Only
 *     senders Canvas knows as Client are logged; suppliers are not.
 *   - Write: the bridge's crm_log, one row per email thread per day (kind Email, the sender, the subject, the project).
 *     request_id "cuemail:<id>:<day>" makes a repeat a no-op on Canvas's side, so a retry never logs twice.
 *   - The Cue sheet's "CRM Email Log" tab lists every row Cue logged or tried to log, so Kiko can see what went in.
 *     Canvas has no way to remove an Activity row yet (asked of Canvas Integration), so there is no Undo here. */

const CUE_CRMLOG_ = { tab: 'CRM Email Log', head: ['Time', 'Key', 'Contact', 'Email', 'Subject', 'Project', 'Canvas ID', 'Result'], from: 8, to: 21, max: 40 };

function cueCrmLogSheet_() {
  const ss = SpreadsheetApp.openById(cueProp_('CUE_SHEET_ID', ''));
  let sh = ss.getSheetByName(CUE_CRMLOG_.tab);
  if (!sh) { sh = ss.insertSheet(CUE_CRMLOG_.tab); sh.appendRow(CUE_CRMLOG_.head); }
  return sh;
}
/** The keys already logged (or already in Canvas), from the tab. */
function cueCrmLogDone_(sh) {
  const n = sh.getLastRow(), done = {};
  if (n < 2) return done;
  sh.getRange(2, 1, n - 1, CUE_CRMLOG_.head.length).getValues().forEach(r => { if (/^(Logged|Already logged)$/.test(String(r[7]))) done[String(r[1])] = 1; });
  return done;
}
/** YYYY-MM-DD in Manila from the email's time, '' when unreadable. */
function cueCrmLogDay_(at) { const ms = Date.parse(String(at || '')); return isNaN(ms) ? '' : cuePh_(ms).day; }

/** From cueResume: once an hour, 08:00 to 21:00 Manila. */
function cueCrmLogTick_() {
  const ph = cuePh_(cueNow_()), slot = ph.day + ' ' + ph.hour, P = PropertiesService.getScriptProperties();
  if (ph.hour < CUE_CRMLOG_.from || ph.hour > CUE_CRMLOG_.to || P.getProperty('CUE_CRMLOG_AT') === slot) return null;
  P.setProperty('CUE_CRMLOG_AT', slot);
  return cueCrmLogRun_();
}

/** One run: read the waiting list, log the client emails not logged yet. Returns { logged, failed, skipped, note }. */
function cueCrmLogRun_() {
  const s = { id: 'crmlog-' + cuePh_(cueNow_()).day };
  let w = null;
  try { w = cueBridge_(s, 'mail_waiting', {}) || {}; }
  catch (e) { return { logged: 0, failed: 0, skipped: 0, note: 'Could not read the waiting list: ' + String((e && e.message) || e).slice(0, 200) }; }
  if (!w.on) return { logged: 0, failed: 0, skipped: 0, note: 'Email check is off in Canvas.' };
  const sh = cueCrmLogSheet_(), done = cueCrmLogDone_(sh), seen = {};
  const todo = (w.items || []).filter(i => i && String(i.who) === 'Client' && cueEmail_(i.email)).map(i => {
    const day = cueCrmLogDay_(i.at), key = 'cuemail:' + String(i.id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 50) + ':' + day;
    return Object.assign({}, i, { day, key });
  }).filter(i => i.day && i.key.length >= 20 && !done[i.key] && !seen[i.key] && (seen[i.key] = 1));
  const list = todo.slice(0, CUE_CRMLOG_.max);
  if (!list.length) return { logged: 0, failed: 0, skipped: todo.length, note: '' };
  const args = list.map(i => ({ request_id: i.key, kind: 'Email', contact: cueStr_(i.name || '', 120), email: cueStr_(i.email, 200).toLowerCase(),
    summary: cueStr_('Email from ' + (i.name || i.from || i.email) + ': ' + (i.subject || '(no subject)') + (i.project ? ' (project ' + i.project + ')' : ''), 1000), date: i.day }));
  // CUE-CRMLOG-PLAN-2026-10-27: crm_log is a bridge write, so each batch of up to 20 is its own task with a claimed plan first
  // (Canvas refuses a write with "no claimed plan for this task"). Then one request per email, all at once; one refusal never
  // stops the others (cueBridgeAll_ would throw on the first).
  const run = 'crmlog-' + cueNow_().toString(36), out = [];
  for (let b = 0; b < list.length; b += 20) {
    const t = { id: run + '-' + (b / 20) }, part = args.slice(b, b + 20).map((a, n) => ({ command_id: 'cue:' + t.id + ':crm_log:' + n, action: 'crm_log', args: a }));
    let res = null, err = '';
    try { cueBridgePlan_(t, part); res = UrlFetchApp.fetchAll(part.map(c => cueBridgeReq_(t, c.action, c.args, '', c.command_id))); }
    catch (e) { err = String((e && e.message) || e); }
    part.forEach((c, n) => out.push(err ? { err } : { res: res[n] }));
  }
  const now = new Date(cueNow_()).toISOString(), rows = [];
  let logged = 0, failed = 0;
  list.forEach((i, n) => {
    let id = '', result = '';
    try { if (out[n].err) throw new Error(out[n].err);
      const r = cueBridgeParse_('crm_log', out[n].res) || {};
      if (r.refused) throw new Error('Canvas refused crm_log: ' + r.refused);   // the CRM door answers a refusal instead of throwing
      id = String((r.act && r.act.ID) || r.ID || ''); result = r.again ? 'Already logged' : 'Logged'; logged++; }
    catch (e) { result = 'Failed: ' + String((e && e.message) || e).slice(0, 200); failed++; }
    rows.push([now, i.key, i.name || '', i.email, cueStr_(i.subject || '', 200), i.project || '', id, result]);
  });
  cueLocked_(() => rows.forEach(r => sh.appendRow(r)));
  return { logged, failed, skipped: todo.length - list.length, note: '' };
}
