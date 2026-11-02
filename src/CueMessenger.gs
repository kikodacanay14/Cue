/* CUE-MSGR-2026-11-02 (Kiko 2 Nov 2026: Messenger for crew papers. Spec and plan in CanvasWorkspace:
 * handoffs/messenger-crew-papers-spec.md, docs/superpowers/plans/2026-11-02-messenger-crew-papers.md).
 * The sender: every 15 minutes Cue asks Canvas for unsigned FSAs and ARs of crew who linked their Messenger (msgr_due), and
 * sends each one's sign link on Messenger once (msgr_mark records it in Canvas, A11), only while Meta's 24-hour window from
 * the crew member's last message is open (R1). Outside the window nothing is sent; the document is tried again on a later
 * tick, so it goes out if the crew member messages again while it is still unsigned. Email and SMS are unchanged (R3).
 * No AI call. Sends are automatic (R4, Kiko approved 2 Nov 2026). Needs script property MSGR_PAGE_TOKEN; without it the job
 * does nothing and says so once a day in Job Runs. Bank details are never in the text (R6): only the sign link goes. */

const CUE_MSGR_ = {
  api: 'https://graph.facebook.com/v21.0/me/messages',
  windowMs: 24 * 3600 * 1000,
  everyMs: 15 * 60 * 1000,
  doc: { FSA: 'Freelancer Service Agreement', AR: 'Acknowledgement Receipt' }
};

/** True only when the last message time is readable and under 24 hours old (a blank or bad time is outside, never inside). */
function cueMsgrInWindow_(last, now) {
  const t = Date.parse(String(last == null ? '' : last).trim());
  if (isNaN(t)) return false;
  const age = new Date(now).getTime() - t;
  return age >= 0 && age < CUE_MSGR_.windowMs;
}
/** The message: first name, the document, the project and its sign link. */
function cueMsgrText_(d) {
  const first = String(d.name || '').trim().split(/\s+/)[0] || 'Hi';
  return first + ', your ' + (CUE_MSGR_.doc[d.doc] || d.doc) + ' for ' + String(d.project || 'your event').trim() + ' is ready to sign: '
    + d.sign_link + '\nThe link works for 30 days. It\'s also in your email.';
}
/** One Messenger text to one person (Send API, RESPONSE type: inside the 24-hour window only). */
function cueMsgrSend_(psid, text) {
  const token = PropertiesService.getScriptProperties().getProperty('MSGR_PAGE_TOKEN');
  if (!token) return { ok: false, error: 'no MSGR_PAGE_TOKEN' };
  const res = UrlFetchApp.fetch(CUE_MSGR_.api, { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ recipient: { id: String(psid) }, messaging_type: 'RESPONSE', message: { text: String(text).slice(0, 2000) } }) });
  const code = res.getResponseCode();
  if (code === 200) return { ok: true };
  let msg = ''; try { msg = (JSON.parse(res.getContentText()).error || {}).message || ''; } catch (e) { msg = ''; }
  return { ok: false, error: 'Meta ' + code + (msg ? ': ' + String(msg).slice(0, 160) : '') };
}

/** The job (Job Runs "Messenger sign links"). Returns how many documents went out on Messenger this tick. */
function cueMsgrTick_() {
  const P = PropertiesService.getScriptProperties(), now = cueNow_();
  if (now - Number(P.getProperty('CUE_MSGR_LAST') || 0) < CUE_MSGR_.everyMs) return 0;
  P.setProperty('CUE_MSGR_LAST', String(now));
  if (!P.getProperty('MSGR_PAGE_TOKEN')) return 0;   // not set up yet (Meta app approval pending)
  return cueMsgrRun_(now).sent;
}
/** One pass: { sent, skipped: [{ id, why }], failed: [{ id, why }] }. */
function cueMsgrRun_(now) {
  const s = { id: 'msgr' }, o = cueBridge_(s, 'msgr_due', {}) || {}, out = { sent: 0, skipped: [], failed: [] };
  (o.docs || []).forEach(d => {
    if (d.sent) return;
    if (!d.messenger_id || !d.sign_link) { out.skipped.push({ id: d.id, why: 'not linked' }); return; }
    if (!cueMsgrInWindow_(d.last_message, now)) { out.skipped.push({ id: d.id, why: 'last message over 24 hours ago' }); return; }
    const r = cueMsgrSend_(d.messenger_id, cueMsgrText_(d));
    if (!r.ok) { out.failed.push({ id: d.id, why: r.error }); return; }
    cueBridge_(s, 'msgr_mark', { request_id: 'msgr:' + d.doc + ':' + d.id, doc: d.doc, id: d.id, email: d.email, psid: String(d.messenger_id) });
    out.sent++;
  });
  if (out.failed.length) throw new Error('Messenger: ' + out.failed.length + ' not sent (' + out.failed.map(x => x.id + ': ' + x.why).join('; ').slice(0, 250) + ')');
  return out;
}
