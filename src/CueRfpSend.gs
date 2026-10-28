/**
 * CUE-RFP-SEND-2026-10-28 (Kiko 28 Oct 2026 07:35Z "i want it to send it when i click send", 07:45Z "from me"): the RFPs and RFP
 * follow-ups Kiko presses Send on in Canvas go out from Kiko's own Gmail, sent by his Cue.
 *
 * Canvas runs as info@ and cannot send as Kiko. So Kiko's Send click in Canvas (Scope Details > Send RFP, or Team Cue > Email >
 * RFP follow-ups > Send follow-up) puts one item per supplier in Canvas's RFP Outbox and logs the RFP as Queued. Every 5 minutes
 * this job reads the outbox (bridge `rfp_outbox`, read), sends each item from Kiko's Gmail (a draft, then drafts.send, so the
 * gmail.compose scope Cue already has covers it), and reports it (bridge `rfp_sent`, queue). Canvas then marks the RFP Log row
 * Sent with Kiko's Gmail thread, or Not sent. A follow-up goes as a reply in the RFP's own thread.
 *
 * Sent once: right after Gmail sends an item, a script property records it, so a report that fails is retried on the next tick
 * without sending again. Staff RFPs never come here: Canvas opens a compose window in their own Gmail (Kiko 27 Oct 11:22Z).
 * A cloud check only reads the outbox and returns what this tick would send.
 */
const CUE_RFPS_ = { max: 10 };   // one tick sends at most 10 emails, well inside the 6-minute run

/** From cueResume. Returns { sent, failed, reported, note }. */
function cueRfpSendTick_() {
  const s = { id: 'rfpsend-' + cuePh_(cueNow_()).day };
  let box;
  try { box = cueBridge_(s, 'rfp_outbox', {}) || {}; }
  catch (e) { return { sent: 0, failed: 0, reported: 0, note: 'Could not read the RFP Outbox: ' + String((e && e.message) || e).slice(0, 200) }; }
  const items = (box.items || []).filter(x => x && x.key).slice(0, CUE_RFPS_.max);
  if (globalThis.CUE_CHECK_ON_) return { sent: 0, failed: 0, reported: 0, note: '', would: items.map(x => ({ key: x.key, kind: x.kind, to: x.to, cc: x.cc, subject: x.subject })) };
  const P = PropertiesService.getScriptProperties(), out = { sent: 0, failed: 0, reported: 0, note: '' };
  items.forEach(x => {
    const mark = 'CUE_RFPS_' + cueSha_(x.key).slice(0, 24);
    let done = null; try { done = JSON.parse(P.getProperty(mark) || 'null'); } catch (e) { done = null; }
    if (!done) {
      try { done = Object.assign({ status: 'Sent' }, cueRfpSendOne_(x)); out.sent++; }
      catch (e) { done = { status: 'Failed', note: cueStr_(String((e && e.message) || e).split('\n')[0], 300) }; out.failed++; }
      P.setProperty(mark, JSON.stringify(done));
    }
    const args = { key: x.key, status: done.status };
    if (done.thread_id) args.thread_id = done.thread_id;
    if (done.message_id) args.message_id = done.message_id;
    if (done.note) args.note = done.note;
    try { cueBridge_(s, 'rfp_sent', args); P.deleteProperty(mark); out.reported++; }
    catch (e) { out.note = 'Could not tell Canvas yet (tries again in 5 minutes): ' + String((e && e.message) || e).slice(0, 200); }
  });
  return out;
}

/** Sends one outbox item from Kiko's Gmail. Returns { thread_id, message_id }. Throws with a plain reason when Gmail can't. */
function cueRfpSendOne_(x) {
  const to = (x.to || []).map(cueEmail_).filter(Boolean), cc = (x.cc || []).map(cueEmail_).filter(Boolean);
  if (!to.length) throw new Error('No supplier email to send it to.');
  const b64 = t => Utilities.base64Encode(Utilities.newBlob(String(t)).getBytes());
  const subject = cueStr_(x.subject, 300).replace(/[\r\n]+/g, ' ');
  const ref = x.thread_id ? cueRfpLastId_(x.thread_id) : '';
  const mime = 'To: ' + to.join(', ') + '\r\n' + (cc.length ? 'Cc: ' + cc.join(', ') + '\r\n' : '')
    + 'Subject: =?UTF-8?B?' + b64(subject) + '?=\r\n'
    + (ref ? 'In-Reply-To: ' + ref + '\r\nReferences: ' + ref + '\r\n' : '')
    + 'MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n' + b64(x.body || '');
  const message = Object.assign({ raw: Utilities.base64EncodeWebSafe(Utilities.newBlob(mime).getBytes()) }, x.thread_id ? { threadId: x.thread_id } : {});
  const auth = { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() };
  const res = UrlFetchApp.fetch(CUE_GMAIL_ + '/drafts', { method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: auth, payload: JSON.stringify({ message }) });
  let d = null; try { d = JSON.parse(res.getContentText()); } catch (e) { d = null; }
  if (res.getResponseCode() !== 200 || !d || !d.id) throw new Error('Gmail did not make the draft (HTTP ' + res.getResponseCode() + ')' + cueGoogleWhy_(res));
  const r2 = UrlFetchApp.fetch(CUE_GMAIL_ + '/drafts/send', { method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: auth, payload: JSON.stringify({ id: d.id }) });
  let m = null; try { m = JSON.parse(r2.getContentText()); } catch (e) { m = null; }
  if (r2.getResponseCode() !== 200 || !m || !m.id) throw new Error('Gmail did not send it; it is still in your Drafts (HTTP ' + r2.getResponseCode() + ')' + cueGoogleWhy_(r2));
  return { thread_id: String(m.threadId || x.thread_id || ''), message_id: String(m.id) };
}

/** The Message-ID header of the last email in a thread, so the follow-up threads for the supplier too. '' when Gmail can't say. */
function cueRfpLastId_(threadId) {
  try {
    const t = cueGmail_('/threads/' + encodeURIComponent(threadId) + '?format=metadata&metadataHeaders=Message-ID');
    const last = (t.messages || []).slice(-1)[0];
    const h = ((last && last.payload && last.payload.headers) || []).filter(x => /^message-id$/i.test(x.name))[0];
    return h ? String(h.value).replace(/[\r\n]/g, '') : '';
  } catch (e) { return ''; }
}
