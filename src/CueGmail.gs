/* Gmail helpers that many Cue features use (read, draft, reply in thread, send).
 * STRUCTURE-PHASE-1 (Kiko 28 Oct 2026 03:47Z, specs/cue-structure-review.md item 1.3): moved here unchanged from the feature
 * file named above each block, so shared helpers live in shared files. Apps Script shares one global space, so no call changed. */

// From CueChange.gs
const CUE_GMAIL_ = 'https://gmail.googleapis.com/gmail/v1/users/me';

/* ---------- Gmail, read only ---------- */
function cueGmail_(path) {
  const res = UrlFetchApp.fetch(CUE_GMAIL_ + path, { muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } });
  if (res.getResponseCode() === 403 && /scope/i.test(res.getContentText())) throw new Error('Cue does not have Gmail access yet. Tap Fix Google access in the Threads pane.');
  if (res.getResponseCode() !== 200) throw new Error('Gmail search said HTTP ' + res.getResponseCode() + cueGoogleWhy_(res));
  return JSON.parse(res.getContentText() || '{}');
}
function cueOwnDomain_() { try { return String(Session.getEffectiveUser().getEmail()).toLowerCase().split('@')[1] || ''; } catch (e) { return ''; } }

/** Sends a draft Cue made (gmail.compose covers drafts.send). Returns the sent message id. Only after Kiko's Approve and send. */
function cueGmailSend_(draftId) {
  const res = UrlFetchApp.fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts/send', { method: 'post', contentType: 'application/json',
    muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, payload: JSON.stringify({ id: draftId }) });
  let o = null; try { o = JSON.parse(res.getContentText()); } catch (e) { o = null; }
  if (res.getResponseCode() !== 200 || !o || !o.id) throw new Error('Gmail did not send it; it is still in your Drafts (HTTP ' + res.getResponseCode() + ')' + cueGoogleWhy_(res));
  return o.id;
}

/** One reply draft in thread f, with attachments. Multipart upload, so big attachments fit (Gmail allows 35 MB). */
function cueGmailReply_(f, body, files) {
  const b64 = t => Utilities.base64Encode(Utilities.newBlob(String(t)).getBytes());
  const wrap = t => t.replace(/.{1,76}/g, '$&\r\n');
  const subj = /^re:/i.test(f.subject) ? f.subject : 'Re: ' + f.subject, mix = 'cue_mix_' + cueNow_().toString(36);
  let mime = 'To: ' + f.to + '\r\nSubject: =?UTF-8?B?' + b64(subj.replace(/[\r\n]+/g, ' ')) + '?=\r\n'
    + (f.message_id ? 'In-Reply-To: ' + f.message_id + '\r\nReferences: ' + f.message_id + '\r\n' : '')
    + 'MIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="' + mix + '"\r\n\r\n'
    + '--' + mix + '\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n' + wrap(b64(body)) + '\r\n';
  (files || []).forEach(a => {
    const n = a.name.replace(/["\\\r\n]/g, '_');
    mime += '--' + mix + '\r\nContent-Type: ' + a.type + '; name="' + n + '"\r\nContent-Disposition: attachment; filename="' + n + '"\r\n'
      + 'Content-Transfer-Encoding: base64\r\n\r\n' + wrap(a.b64) + '\r\n';
  });
  mime += '--' + mix + '--\r\n';
  const rel = 'cue_rel_' + cueNow_().toString(36);
  const payload = '--' + rel + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify({ message: { threadId: f.thread_id } }) + '\r\n'
    + '--' + rel + '\r\nContent-Type: message/rfc822\r\n\r\n' + mime + '\r\n--' + rel + '--';
  const res = UrlFetchApp.fetch('https://gmail.googleapis.com/upload/gmail/v1/users/me/drafts?uploadType=multipart', { method: 'post',
    contentType: 'multipart/related; boundary=' + rel, payload, muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } });
  let o = null; try { o = JSON.parse(res.getContentText()); } catch (e) { o = null; }
  if (res.getResponseCode() !== 200 || !o || !o.id) throw new Error('Gmail did not make the draft (HTTP ' + res.getResponseCode() + ')' + cueGoogleWhy_(res));
  return o.id;
}

// From CueIntake.gs
/** Makes one Gmail draft through the Gmail API (gmail.compose scope only). To is left blank when the supplier has no email. */
function cueGmailDraft_(to, subject, body) {
  const b64 = t => Utilities.base64Encode(Utilities.newBlob(String(t)).getBytes());
  const mime = (cueEmailList_(to) ? 'To: ' + cueEmailList_(to) + '\r\n' : '') + 'Subject: =?UTF-8?B?' + b64(String(subject || '').replace(/[\r\n]+/g, ' ')) + '?=\r\n'
    + 'MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n' + b64(body || '');
  const res = UrlFetchApp.fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', { method: 'post', contentType: 'application/json',
    muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    payload: JSON.stringify({ message: { raw: Utilities.base64EncodeWebSafe(Utilities.newBlob(mime).getBytes()) } }) });
  let o = null; try { o = JSON.parse(res.getContentText()); } catch (e) { o = null; }
  if (res.getResponseCode() !== 200 || !o || !o.id) throw new Error('Gmail did not make the draft (HTTP ' + res.getResponseCode() + ')');
  return o.id;
}
