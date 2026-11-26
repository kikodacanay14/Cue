/**
 * CUE-ALERTS-2026-11-16: Cue alerts on Kiko's Android phone (spec canvas-integration/specs/cue-android-notifications.md, ADR-0198).
 * Kiko 16 Nov 2026: "A. Cue's own push" (15:14:25Z), mockups ALERT-1 to ALERT-3 "Approve all three" (15:18:24Z),
 * "Yes, group within 5 min" (15:20:47Z), "Yes, build it" (17:22:27Z).
 *
 * Cue posts each alert to the cue-alerts Cloudflare Worker (alerts/alerts-worker.js), which pushes it to the phones turned on at
 * its setup page. Script Properties: CUE_ALERTS_KEY, which Cue makes itself and hands to the Worker when Kiko taps Connect alerts (no paste),
 * and optionally CUE_ALERTS_URL (default CUE_ALERTS_DEFAULT_). Without the key nothing is sent and nothing fails.
 *
 * - Five types (ALERT-3), each with an On switch; all start On.
 * - Grouping (ADR-0198): the first line in a thread alerts at once. More lines in that thread within 5 minutes of the last one
 *   replace that alert with one that counts them ("Account Specialist · 2 updates"), without a second sound. After 5 minutes of
 *   quiet, the next line alerts again.
 * - Alert text never carries bank details, amounts or files (cueAlertClean_).
 * - A failed send is logged and never stops the job that called it.
 */
const CUE_ALERT_TYPES_ = [
  { id: 'am', name: '8 AM update' },
  { id: 'ok', name: 'New item for your OK' },
  { id: 'agent', name: 'Agent update' },
  { id: 'msgr', name: 'Messenger message for you' },
  { id: 'job', name: 'Failed job' }
];
const CUE_ALERT_GROUP_MS_ = 5 * 60 * 1000;   // ADR-0198, Kiko 16 Nov 2026 15:20:47Z "Yes, group within 5 min"
const CUE_ALERT_PROP_ = 'CUE_ALERTS_STATE';
const CUE_ALERTS_DEFAULT_ = 'https://cue-alerts.kikodacanay14-17a.workers.dev';   // the cue-alerts Worker; Script Property CUE_ALERTS_URL overrides it
const cueAlertUrl_ = () => cueProp_('CUE_ALERTS_URL', CUE_ALERTS_DEFAULT_).replace(/\/+$/, '');

function cueAlertState_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(CUE_ALERT_PROP_) || '{}'); } catch (e) { return {}; } }
function cueAlertSave_(S) { PropertiesService.getScriptProperties().setProperty(CUE_ALERT_PROP_, JSON.stringify(S)); }
function cueAlertOn_(S, type) { return !(S.off || {})[type]; }
function cueAlertReady_() { return /^https:\/\/\S+$/.test(cueAlertUrl_()) && !!cueProp_('CUE_ALERTS_KEY', ''); }

/** No bank details, amounts or files in an alert: peso and other money amounts, long digit runs (account and card numbers),
 * links and file names come out. Then one line, cut to n characters. */
function cueAlertClean_(t, n) {
  let s = String(t == null ? '' : t)
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\S+\.(pdf|docx?|xlsx?|csv|pptx?|jpe?g|png|heic|zip)\b/gi, 'a file')
    .replace(/(₱|PHP|Php|\bP(?=\s?\d)|US\$|\$)\s?\d[\d,]*(\.\d+)?(?:\s?[kKmM]\b)?/g, 'an amount')   // \bP: the P of "HTTP 500" is not a peso sign (25 Nov 2026)
    .replace(/\d[\d,]*(\.\d+)?\s?(pesos|php)\b/gi, 'an amount')
    .replace(/\b(account|acct|a\/c|iban|card)\s*(no\.?|number|#)?\s*[:#]?\s*[\dXx*•](?:[\s-]?[\dXx*•]){3,}/gi, '$1 …')
    .replace(/\b\d(?:[\s-]?\d){9,}\b/g, '…')
    .replace(/\*\*|__|`/g, '').replace(/\s+/g, ' ').trim();
  n = n || 160;
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
/** The Cue link that opens a thread (?thread=…); without a thread, Cue itself, or a Cue Admin section (?view=admin&sec=…). */
function cueAlertLink_(threadId, sec) {
  const base = cueProp_('CUE_ALERTS_OPEN', '') || cueAdminAppUrl_();
  if (!/^https:\/\//.test(base)) return '';
  if (sec) return base + '?view=admin&sec=' + encodeURIComponent(sec);
  return threadId ? base + '?thread=' + encodeURIComponent(threadId) : base;
}

/** Sends one alert. type: one of CUE_ALERT_TYPES_; tag: the Cue thread (grouping key, and what Android replaces); who: the
 * grouped title's name ("Account Specialist" in "Account Specialist · 2 updates"); open: { thread } or { sec } for the tap.
 * Returns what happened ('sent', 'grouped', 'off', 'not set up', 'failed'). Never throws. */
function cueAlert_(type, tag, title, text, who, open) {
  try {
    if (!cueAlertReady_()) return 'not set up';
    const S = cueAlertState_();
    if (!cueAlertOn_(S, type)) return 'off';
    const now = cueNow_(), G = S.th = S.th || {}, g = G[tag];
    Object.keys(G).forEach(k => { if (now - G[k].at > 864e5) delete G[k]; });   // a day of quiet: forgotten
    const grouped = !!(g && now - g.at <= CUE_ALERT_GROUP_MS_);
    const n = grouped ? (g.n || 1) + 1 : 1;
    G[tag] = { at: now, n };
    const head = grouped ? cueAlertClean_(who || title, 60) + ' · ' + n + ' updates' : cueAlertClean_(title, 80);
    open = open || {};
    const r = UrlFetchApp.fetch(cueAlertUrl_() + '/send', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + cueProp_('CUE_ALERTS_KEY', '') },
      payload: JSON.stringify({ title: head, body: cueAlertClean_(text, 160), url: cueAlertLink_(open.thread, open.sec), tag: String(tag || 'cue').slice(0, 80), renotify: !grouped }) });
    const ok = r.getResponseCode() === 200;
    if (ok) (S.last = S.last || {})[type] = new Date(now).toISOString();
    cueAlertSave_(S);
    if (!ok) { console.warn('Cue alert: the alerts service answered ' + r.getResponseCode()); return 'failed'; }
    return grouped ? 'grouped' : 'sent';
  } catch (e) { console.warn('Cue alert: ' + e); return 'failed'; }
}

/* ---------- hooks: one line each where the event happens ---------- */

/** The 8 AM update (am) and the 2 PM chasers for Kiko's OK (pm, only when some are due). K is cueK0Build_'s result. */
function cueAlertK0_(mode, id, K) {
  if (mode === 'am') {
    const n = (K.items || []).length, first = String(K.text || '').split('\n').slice(1).map(x => x.trim()).filter(Boolean)[0] || 'Tap to open the update in Cue.';
    return cueAlert_('am', id, '8 AM update' + (n ? ': ' + n + ' item' + (n === 1 ? '' : 's') + ' for your OK' : ' is ready'), first.replace(/^\d+\.\s*/, ''), '8 AM update', { thread: id });
  }
  if (mode === 'pm' && K.chasers) return cueAlert_('ok', id, '2 PM chasers: ' + K.chasers + ' for your OK', 'Reply in Cue with the numbers to draft them.', '2 PM chasers', { thread: id });
  return '';
}
/** A new agent card (a draft waiting for Kiko, or an unread update). Grouped per agent thread. */
function cueAlertAgent_(rootId, cardId, agent, line) { return cueAlert_('agent', rootId, agent, line, agent, { thread: cardId }); }
/** A Messenger message Cue hands to Kiko: it lands in that person's chat in Cue. */
function cueAlertMsgr_(chatId, name, text) { return cueAlert_('msgr', chatId, 'Messenger · ' + name, text, 'Messenger · ' + name, { thread: chatId }); }
/** A background job that failed (CueJobs.gs). Opens Cue Admin › Scheduled tasks. */
function cueAlertJob_(job, err) { return cueAlert_('job', 'job:' + job, 'Job failed: ' + job, err || 'It stopped with an error.', 'Job failed: ' + job, { sec: 'sched' }); }
/** Called by cueJobRun_ after every job run. A job that keeps failing runs every 5 minutes, which is right at the edge of the
 * 5-minute grouping, so it could sound every run. Kiko 16 Nov 2026 17:36:51Z, decision card: "Once, until it works again": the
 * alert goes when a job turns from OK to Failed, and again only after it has run OK once. Only a change is written. */
function cueAlertJobRun_(job, err) {
  try {
    const P = PropertiesService.getScriptProperties();
    if (!globalThis.CUE_ALERT_JOBS_) { try { globalThis.CUE_ALERT_JOBS_ = JSON.parse(P.getProperty('CUE_ALERT_JOBS') || '{}'); } catch (e) { globalThis.CUE_ALERT_JOBS_ = {}; } }
    const F = globalThis.CUE_ALERT_JOBS_, was = !!F[job];
    if (!!err === was) return '';
    if (err) F[job] = 1; else delete F[job];
    P.setProperty('CUE_ALERT_JOBS', JSON.stringify(F));
    return err ? cueAlertJob_(job, err) : '';
  } catch (e) { console.warn('Cue alert (job): ' + e); return 'failed'; }
}

/* ---------- Cue Settings › Jobs › Phone alerts (ALERT-3) ---------- */

/** The Phone alerts table: each type with its switch and last sent time, and how many phones are on. */
function cueAlerts() {
  cueOwner_();
  const S = cueAlertState_(), ready = cueAlertReady_();
  let phones = null;
  if (ready) try {
    const r = UrlFetchApp.fetch(cueAlertUrl_() + '/status', { headers: { Authorization: 'Bearer ' + cueProp_('CUE_ALERTS_KEY', '') }, muteHttpExceptions: true });
    if (r.getResponseCode() === 200) phones = Number(JSON.parse(r.getContentText()).phones) || 0;
  } catch (e) { console.warn('Cue alerts status: ' + e); }
  return { ready, phones, types: CUE_ALERT_TYPES_.map(t => ({ id: t.id, name: t.name, on: cueAlertOn_(S, t.id), last: (S.last || {})[t.id] || '' })) };
}
/** Connect alerts (no paste): Cue makes its own key and hands it to the Worker's /pair, which takes it once while the
 * pairing window opened at deploy time is open. Cue keeps the key only when the Worker took it. */
function cueAlertsConnect() {
  cueOwner_();
  const key = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  const r = UrlFetchApp.fetch(cueAlertUrl_() + '/pair', { method: 'post', contentType: 'application/json', muteHttpExceptions: true, payload: JSON.stringify({ key }) });
  if (r.getResponseCode() !== 200) throw new Error(r.getResponseCode() === 403 ? 'The alerts service is not open for connecting. Ask Claude to open it, then try again.' : 'The alerts service did not answer (' + r.getResponseCode() + '). Try again.');
  PropertiesService.getScriptProperties().setProperty('CUE_ALERTS_KEY', key);
  return cueAlerts();
}
/** Turns one alert type on or off. */
function cueAlertsSet(id, on) {
  cueOwner_();
  if (!CUE_ALERT_TYPES_.some(t => t.id === id)) throw new Error('Unknown alert: ' + id);
  cueLocked_(() => { const S = cueAlertState_(); S.off = S.off || {}; if (on) delete S.off[id]; else S.off[id] = true; cueAlertSave_(S); });
  return cueAlerts();
}
/** A new one-time setup link (10 minutes) for Open setup page. Also keeps this Cue's address, so a tap on an alert opens it. */
function cueAlertsSetup() {
  cueOwner_();
  if (!cueAlertReady_()) throw new Error('Phone alerts are not connected yet. Tap Connect alerts first.');
  const app = cueAdminAppUrl_();
  if (/^https:\/\/script\.google\.com\/\S+\/exec$/.test(app)) PropertiesService.getScriptProperties().setProperty('CUE_ALERTS_OPEN', app);
  const r = UrlFetchApp.fetch(cueAlertUrl_() + '/code', { method: 'post', headers: { Authorization: 'Bearer ' + cueProp_('CUE_ALERTS_KEY', '') }, muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error('The alerts service did not answer (' + r.getResponseCode() + '). Try again.');
  const o = JSON.parse(r.getContentText());
  if (!/^https:\/\//.test(String(o.url || ''))) throw new Error('The alerts service gave no setup link. Try again.');
  return { url: o.url, minutes: o.minutes || 10 };
}
/** Send a test alert: to every phone that is on, outside the switches and the grouping. */
function cueAlertsTest() {
  cueOwner_();
  if (!cueAlertReady_()) throw new Error('Phone alerts are not connected yet. Tap Connect alerts first.');
  const r = UrlFetchApp.fetch(cueAlertUrl_() + '/send', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + cueProp_('CUE_ALERTS_KEY', '') },
    payload: JSON.stringify({ title: 'Cue test alert', body: 'Alerts are working on this phone.', url: cueAlertLink_(''), tag: 'cue-test', renotify: true }) });
  if (r.getResponseCode() !== 200) throw new Error('The test alert did not go out (' + r.getResponseCode() + '). Try again.');
  const o = JSON.parse(r.getContentText());
  return { phones: Number(o.phones) || 0, sent: Number(o.sent) || 0 };
}
