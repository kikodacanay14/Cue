/* CUE-MAIL-ALERTS-2026-10-27 (bug: Kiko's Emails waiting in Canvas said "The email check hasn't run for a while" on 27 Oct;
 * coordinator 10:34Z "find out why the mailcheck stopped and fix it first").
 * What broke: Canvas's Emails waiting list is read from canvas-email-alerts.json in Kiko's Drive. The separate "Canvas email check"
 * app (CanvasWorkspace mailcheck/) wrote it from a 10-minute trigger in Kiko's account. Its last write was 25 Oct 01:31Z, the
 * moment Kiko tapped Turn on; the trigger never wrote again and Google sent no failure email, so nobody saw it stop. Cue's own
 * 5-minute trigger has run without a gap since, and Cue runs as Kiko with Gmail read access.
 * The fix: Cue writes the same file for Kiko every 10 minutes from cueResume, with the same rules as mailcheck's mcPick_:
 *   - Inbox threads whose newest message is from outside BSE, within 14 days, not from a no-reply address; headers only.
 *   - The file is Cue's own (drive.file), in Kiko's Drive, shared view-only with info@ without a share email. Canvas picks the
 *     newest such file Kiko owns (Canvas rel-v292-mailfix), so this one wins over the stopped one.
 *   - Unchanged threads are not read again: a thread is re-read only when its Gmail historyId moves.
 * No AI, nothing sent, labelled or changed in Gmail. Emails are untrusted data. */

const CUE_MA_ = { file: 'canvas-email-alerts.json', every_min: 10, days: 14, max: 40, canvas: 'info@blankspaceevent.com' };

/** From cueResume: one check every 10 minutes. Returns the number of waiting threads written, or null when not due. */
function cueMaTick_() {
  const P = PropertiesService.getScriptProperties(), now = cueNow_();
  if (now - (Number(P.getProperty('CUE_MA_AT')) || 0) < CUE_MA_.every_min * 60e3 - 30e3) return null;
  P.setProperty('CUE_MA_AT', String(now));
  return cueMaRun_();
}

function cueMaRun_() {
  const me = cueMe_().toLowerCase(), now = cueNow_();
  if (!/@blankspaceevent\.com$/.test(me)) return null;   // Canvas reads the file only for a BSE account
  const threads = cueMaWaiting_(me, now);
  cueMaWrite_({ email: me, on: true, checked: now, by: 'cue', threads });
  return threads.length;
}

/** Inbox threads waiting on Kiko, newest first. Threads whose historyId did not move come from the last run. */
function cueMaWaiting_(me, now) {
  const list = cueGmail_('/threads?labelIds=INBOX&maxResults=' + CUE_MA_.max).threads || [];
  const cache = CacheService.getScriptCache(), old = {};
  try { (JSON.parse(cache.get('cue_ma_seen') || '[]') || []).forEach(x => { old[x.id] = x; }); } catch (e) { /* read all again */ }
  const fresh = list.filter(t => !(old[t.id] && old[t.id].h === String(t.historyId)));
  const got = {};
  cueGmailAll_(fresh.map(t => '/threads/' + encodeURIComponent(t.id) + '?format=metadata&metadataHeaders=From&metadataHeaders=Subject'))
    .forEach(t => { got[t.id] = cueMaPick_([t], me, now)[0] || null; });
  const seen = [], out = [];
  list.forEach(t => {
    let row;
    if (t.id in got) row = got[t.id];
    else if (old[t.id] && old[t.id].h === String(t.historyId)) row = old[t.id].r;
    else return;   // failed to load this time: read again next run
    seen.push({ id: t.id, h: String(t.historyId), r: row });
    if (row && now - row.at <= CUE_MA_.days * 864e5) out.push(row);
  });
  try { cache.put('cue_ma_seen', JSON.stringify(seen), 6 * 3600); } catch (e) { /* too big: read all next run */ }
  return out.sort((a, b) => b.at - a.at);
}

/** Pure, the same rules as mailcheck/Code.gs mcPick_: Gmail thread resources (format=metadata) -> threads waiting on the person. */
function cueMaPick_(threads, me, now) {
  const dom = e => String(e || '').toLowerCase().split('@')[1] || '', own = dom(me), out = [];
  const head = (m, n) => (((m.payload || {}).headers || []).find(x => String(x.name).toLowerCase() === n) || {}).value || '';
  (threads || []).forEach(t => {
    const msgs = (t.messages || []).slice().sort((a, b) => Number(a.internalDate) - Number(b.internalDate));
    const last = msgs[msgs.length - 1]; if (!last) return;
    const at = Number(last.internalDate) || 0;
    if (!at || now - at > CUE_MA_.days * 864e5) return;
    const from = cueMaAddr_(head(last, 'from'));
    if (!from.email || dom(from.email) === own) return;          // the last word is ours: answered
    if (/^(no-?reply|do-?not-?reply|mailer-daemon|postmaster|notifications?)@/i.test(from.email)) return;
    const ours = msgs.some(m => dom(cueMaAddr_(head(m, 'from')).email) === own);
    out.push({ id: String(t.id), from: from.name || from.email, email: from.email, subject: String(head(last, 'subject') || '(no subject)').slice(0, 200),
      at, unread: (last.labelIds || []).indexOf('UNREAD') >= 0, count: msgs.length, repliedBefore: ours });
  });
  return out.sort((a, b) => b.at - a.at);
}

/** "Name <a@b.c>" or "a@b.c" -> {name, email}; email is '' when it is not an address. */
function cueMaAddr_(v) {
  const s = String(v || '').trim(), m = s.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  const email = (m ? m[2] : s).trim().toLowerCase();
  return { name: m ? m[1].trim() : '', email: /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) ? email : '' };
}

/** Cue's own copy of the file (drive.file), shared view-only with info@ once, with no share email. */
function cueMaWrite_(data) {
  const P = PropertiesService.getScriptProperties(), body = JSON.stringify(data);
  let id = P.getProperty('CUE_MA_FILE') || '';
  if (id) {
    try { cueDrive_('patch', 'https://www.googleapis.com/upload/drive/v3/files/' + id + '?uploadType=media', { contentType: 'application/json', payload: body }); return id; }
    catch (e) { id = ''; }   // gone: make a new one
  }
  id = cueDrive_('post', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=media', { contentType: 'application/json', payload: body }).id;
  cueDrive_('patch', CUE_DRIVE_ + '/' + id, { contentType: 'application/json', payload: JSON.stringify({ name: CUE_MA_.file,
    description: 'Canvas email alerts written by Cue: who emailed you and when, for Emails waiting in Canvas. Headers only.' }) });
  cueDrive_('post', CUE_DRIVE_ + '/' + id + '/permissions?sendNotificationEmail=false', { contentType: 'application/json',
    payload: JSON.stringify({ role: 'reader', type: 'user', emailAddress: CUE_MA_.canvas }) });
  P.setProperty('CUE_MA_FILE', id);
  return id;
}
