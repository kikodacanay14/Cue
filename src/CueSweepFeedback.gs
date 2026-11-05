/* CUE-FEEDBACK-2026-11-05. Client feedback form, the Cue half (spec canvas-integration/specs/client-feedback-cue/spec.md, Feature
 * Board card canvas-client-feedback-form; Kiko approved the spec 5 Nov 2026 04:10Z: "approved", with the recommended A on both
 * questions: each reminder waits for his tap, and only events ending on or after the release day get a line).
 * Kiko's ask (5 Nov 04:03Z): "The day after the event's last day, show me a 'Send feedback form' card for that project. Only I can send
 * it." The email goes from his Gmail signed as Blank Space Events, with a "Give feedback" button to the form link; reminders 5 and 10
 * days after when the client has not submitted; "Stop as soon as Canvas says the client submitted"; "Approve = send, per message".
 * Rules Kiko approved on the card (5 Nov 03:34Z to 03:47Z): only Kiko sends; send unlocks Event Day + 1; it goes to the Direct Client
 * marked in Resources > Client tab; there is a chaser; Closeout "Client feedback collected" ticks itself in Canvas (not Cue).
 * - Who does what: Canvas lists the projects (bridge read client_feedback: form link, Direct Client, last day, submitted) and builds
 *   both emails from Kiko's doc (message_render, templates "C9 Client Feedback Request" and "C9 Client Feedback Chaser", in the
 *   approved client design with the banner). Code finds what is due, and each line goes only when Kiko taps its Send (it.tap). No AI.
 * - Timing is the Chaser rules card's "feedback" row: first line 1 day after the last event day, then every 5 days, at most 3 emails
 *   (the first and two reminders). The engine applies every and max from the Chase log.
 * - Just before each send, Cue asks Canvas again: a client who has submitted gets nothing more. Reminders go as replies in the first
 *   email's Gmail thread. The file name sorts after CueSweep.gs on purpose: cueKind_ must exist before this file registers. */

const CUE_FB_ = { first: 1, every: 5, max: 3, unit: 'days', keys: { first: 'C9 Client Feedback Request', chaser: 'C9 Client Feedback Chaser' },
  from: 'Blank Space Events', since: 'CUE_FB_SINCE', threads: 'CUE_FB_THREADS', projects: 40 };

/** The release day: the first run stores today, so only events ending on or after it get a line (Kiko 5 Nov, question 2, answer A). */
function cueFbSince_(today) {
  const P = PropertiesService.getScriptProperties(), v = String(P.getProperty(CUE_FB_.since) || '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  if (!globalThis.CUE_CHECK_ON_) P.setProperty(CUE_FB_.since, today);
  return today;
}
/** { project id: { t: Gmail thread id, s: subject } of the first feedback email }, so reminders reply under it. */
function cueFbThreads_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(CUE_FB_.threads) || '{}') || {}; } catch (e) { return {}; } }
function cueFbThreadSet_(pid, tid, subject) {
  if (globalThis.CUE_CHECK_ON_) return;
  const m = cueFbThreads_(); m[pid] = { t: tid, s: cueStr_(subject, 300) };
  PropertiesService.getScriptProperties().setProperty(CUE_FB_.threads, JSON.stringify(m));
}
/** Canvas's rows, cleaned: { id, name, lastDay, formUrl, client: { name, first, email }, submitted, submittedAt }. */
function cueFbRows_(s, args) {
  const r = cueBridge_(s, 'client_feedback', args) || {};
  return (r.projects || []).filter(p => p && p.id).slice(0, CUE_FB_.projects).map(p => {
    const c = p.client || {}, name = cueStr_(c.name, 200);
    return { id: cueStr_(p.id, 60), name: cueStr_(p.name || p.id, 200), lastDay: cueAwardDay_(p.lastDay), formUrl: cueStr_(p.formUrl, 500),
      client: { name, first: cueStr_(c.first, 80) || name.split(/\s+/)[0] || '', email: cueEmail_(c.email) || '' },
      submitted: !!p.submitted, submittedAt: cueStr_(p.submittedAt, 40) };
  });
}
/** The email Canvas builds from the doc for this line: { key, subject, text, html, banner, missing }. */
function cueFbRender_(s, it) {
  const f = it.facts || {}, key = f.step > 0 ? CUE_FB_.keys.chaser : CUE_FB_.keys.first;
  const m = cueBridge_(s, 'message_render', { key, data: Object.assign({ first_name: f.first_name || '', event: it.project || '', form_url: f.form_url || '' },
    key === CUE_FB_.keys.chaser ? { original_subject: String(it.thread_subject || f.original_subject || '').replace(/^re:\s*/i, '') } : {}), mode: 'send' }) || {};
  return { key, subject: cueStr_(m.subject, 300), text: String(m.text || ''), html: String(m.html || ''), banner: String(m.banner || '').replace(/[^A-Za-z0-9+/=]/g, ''),
    missing: (m.missing || []).map(String) };
}

/** find(ctx): one line per project from Event Day + 1 that is waiting on the client's feedback. */
function cueFbFind_(ctx) {
  const rule = Object.assign({}, CUE_FB_, ctx.rule ? ctx.rule('feedback') : {});
  if (rule.on === false) return [];
  const rows = cueFbRows_(ctx.s, { since: cueFbSince_(ctx.today) }), log = cueChaseLog_(), out = [];
  rows.forEach(p => {
    const key = 'feedback:' + p.id, L = log[key] || null, times = L ? L.times : 0;
    if (p.submitted) {   // Canvas says the client submitted: no more lines; say so once if Cue had emailed them
      if (times > 0 && !(L && L.muted) && !globalThis.CUE_CHECK_ON_) {
        cueChat_('Cue', 'Feedback received: ' + p.name + (p.client.name ? ' (' + p.client.name + ')' : '') + ' sent the client feedback form' + (p.submittedAt ? ' on ' + p.submittedAt : '') + '.', ctx.s.id);
        cueChaseWrite_(log, { key, kind: 'feedback', project: p.name, who: p.client.name }, { muted: true, note: 'received' });
      }
      return;
    }
    if (!p.lastDay || cueAddDays_(p.lastDay, rule.first || 1) > ctx.today) return;   // send unlocks Event Day + 1
    const base = { key, project: p.name, project_id: p.id, status_checked: true, who: p.client.name, due_since: p.lastDay,
      facts: { step: times, first_name: p.client.first, form_url: p.formUrl, last_day: p.lastDay } };
    if (!p.client.email) { out.push(Object.assign(base, { no_email: true, needs_draft: false,
      why: 'Event ended ' + p.lastDay + '. Mark the Direct Client in Resources > Client tab in Canvas, with an email, to send the feedback form.' })); return; }
    if (!p.formUrl) { out.push(Object.assign(base, { no_email: true, needs_draft: false, why: 'Event ended ' + p.lastDay + '. Canvas has no feedback form link for this project yet.' })); return; }
    const it = Object.assign(base, { to: p.client.email, tap: true, short: times ? 'Reminder ' + times + ' of ' + ((rule.max || CUE_FB_.max) - 1) : 'Send feedback form',
      why: times ? 'Feedback form sent, no answer yet. Reminder ' + times + ' of ' + ((rule.max || CUE_FB_.max) - 1) : 'Event ended ' + p.lastDay + '. Send the client feedback form' });
    const th = cueFbThreads_()[p.id] || {};
    if (times && th.t) Object.assign(it, { thread_id: th.t, thread_subject: th.s || '' });
    try {   // what Kiko sees on Preview is Canvas's own build of the email
      const m = cueFbRender_(ctx.s, it);
      Object.assign(it, { subject: m.subject || (it.thread_subject ? 'Re: ' + it.thread_subject.replace(/^re:\s*/i, '') : ''), body: m.text, fb_html: m.html, fb_key: m.key });
      if (m.missing.length) it.why += '. Missing in the email: ' + m.missing.join(', ');
    } catch (e) { it.why += '. The email could not be built: ' + cueStr_((e && e.message) || e, 200); }
    out.push(it);
  });
  return out;
}

/** send(it, s): Kiko tapped Send on this one line. Asks Canvas again first, so a client who has submitted gets nothing. */
function cueFbSend_(it, s) {
  const pid = String(it.project_id || ''), row = cueFbRows_(s, { since: String((it.facts || {}).last_day || ''), id: pid }).filter(p => p.id === pid)[0];
  if (!row) throw new Error('Canvas no longer lists this project for client feedback, so nothing was sent.');
  if (row.submitted) throw new Error(row.client.name ? row.client.name + ' already sent the feedback form, so nothing was sent.' : 'The client already sent the feedback form, so nothing was sent.');
  const to = row.client.email || cueEmail_(it.to);
  if (!to) throw new Error('No Direct Client email in Canvas. Mark the Direct Client in Resources > Client tab.');
  const th = cueFbThreads_()[pid] || {};
  const f = Object.assign({}, it.facts, { first_name: row.client.first || (it.facts || {}).first_name, form_url: row.formUrl || (it.facts || {}).form_url, original_subject: th.s || '' });
  const step = Number(f.step) || 0, tid = step ? (it.thread_id || th.t || '') : '';
  const edited = !!it.fb_html && !it.html && !!String(it.body || '').trim();   // Kiko changed the words in the box: they go as he typed them (cueSweepSendOne clears html)
  const m = cueFbRender_(s, Object.assign({}, it, { facts: f }));
  if (!edited && m.missing.length) throw new Error('The email is missing ' + m.missing.join(', ') + ', so nothing was sent.');
  if (!m.subject && !step) throw new Error('The template ' + m.key + ' has no subject in the doc, so nothing was sent.');
  const subject = m.subject || th.s || it.thread_subject || it.subject;
  const sent = cueFbMail_({ to, subject, text: edited ? it.body : m.text, html: edited ? '' : m.html, banner: m.banner, thread_id: tid });
  if (!step && sent.thread_id) cueFbThreadSet_(pid, sent.thread_id, subject);
  return sent.message_id;
}

/** One email from Kiko's Gmail, shown as "Blank Space Events", with the banner inline (cid:mtbanner); a reminder threads under the
 *  first email. Returns { thread_id, message_id }. */
function cueFbMail_(x) {
  const b64 = t => Utilities.base64Encode(Utilities.newBlob(String(t)).getBytes()), wrap = t => String(t).replace(/.{1,76}/g, '$&\r\n');
  const me = cueEmail_(String(Session.getEffectiveUser().getEmail() || ''));
  const ref = x.thread_id ? cueRfpLastId_(x.thread_id) : '';
  let subject = String(x.subject || '').replace(/[\r\n]+/g, ' ');
  if (x.thread_id && !/^re:/i.test(subject)) subject = 'Re: ' + subject;
  const id = cueNow_().toString(36), alt = 'cue_fba_' + id, rel = 'cue_fbr_' + id;
  const alts = '--' + alt + '\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n' + wrap(b64(x.text || '')) + '\r\n'
    + (x.html ? '--' + alt + '\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n' + wrap(b64(x.html)) + '\r\n' : '') + '--' + alt + '--\r\n';
  let mime = (me ? 'From: =?UTF-8?B?' + b64(CUE_FB_.from) + '?= <' + me + '>\r\n' : '') + 'To: ' + x.to + '\r\nSubject: =?UTF-8?B?' + b64(subject) + '?=\r\n'
    + (ref ? 'In-Reply-To: ' + ref + '\r\nReferences: ' + ref + '\r\n' : '') + 'MIME-Version: 1.0\r\n';
  mime += x.banner && x.html && x.html.indexOf('cid:mtbanner') >= 0
    ? 'Content-Type: multipart/related; boundary="' + rel + '"\r\n\r\n--' + rel + '\r\nContent-Type: multipart/alternative; boundary="' + alt + '"\r\n\r\n' + alts
      + '--' + rel + '\r\nContent-Type: image/png; name="banner.png"\r\nContent-Transfer-Encoding: base64\r\nContent-ID: <mtbanner>\r\nContent-Disposition: inline; filename="banner.png"\r\n\r\n' + wrap(x.banner) + '\r\n--' + rel + '--\r\n'
    : 'Content-Type: multipart/alternative; boundary="' + alt + '"\r\n\r\n' + alts;
  const auth = { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() };
  const message = Object.assign({ raw: Utilities.base64EncodeWebSafe(Utilities.newBlob(mime).getBytes()) }, x.thread_id ? { threadId: x.thread_id } : {});
  const res = UrlFetchApp.fetch(CUE_GMAIL_ + '/drafts', { method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: auth, payload: JSON.stringify({ message }) });
  let d = null; try { d = JSON.parse(res.getContentText()); } catch (e) { d = null; }
  if (res.getResponseCode() !== 200 || !d || !d.id) throw new Error('Gmail did not make the email (HTTP ' + res.getResponseCode() + ')' + cueGoogleWhy_(res));
  const r2 = UrlFetchApp.fetch(CUE_GMAIL_ + '/drafts/send', { method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: auth, payload: JSON.stringify({ id: d.id }) });
  let o = null; try { o = JSON.parse(r2.getContentText()); } catch (e) { o = null; }
  if (r2.getResponseCode() !== 200 || !o || !o.id) throw new Error('Gmail did not send it; it is still in your Drafts (HTTP ' + r2.getResponseCode() + ')' + cueGoogleWhy_(r2));
  return { thread_id: String(o.threadId || x.thread_id || ''), message_id: String(o.id) };
}

cueKind_({ kind: 'feedback', label: 'C9 Client feedback', every: CUE_FB_.every, max: CUE_FB_.max, unit: CUE_FB_.unit, sendAllowed: true,
  find: cueFbFind_, send: cueFbSend_, template: it => ({ subject: it.subject || '', body: it.body || '', html: it.fb_html || '' }) });
