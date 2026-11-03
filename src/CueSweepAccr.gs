/* CUE-2026-10-21. Accreditation chasers (sweep task 5, spec specs/accreditation-chasers.md, Kiko approved 08:22Z).
 * Suppliers whose accreditation is still incomplete get the form (when it was never sent) or a reminder, in the morning batch.
 * - Who does what: Canvas lists the open rows (accreditation_gaps, code only); Cue finds each supplier's accreditation thread in
 *   Kiko's Gmail and whether they answered; the engine's one ChatGPT call words the batch (this kind's template if it fails).
 *   Kiko approves. Claude is not in the daily run.
 * - Kiko 07:31Z: sent from Kiko's own Gmail, as a reply in the accreditation thread when there is one, suppliers@ in CC so the
 *   documents reach the mailbox Canvas reads. Before each send Canvas re-checks the row is still open; after it, Canvas logs it.
 * - A supplier who answered (form or email) since BSE last wrote gets no email: the line says to read their documents in Canvas.
 * - The file name sorts after CueSweep.gs on purpose: Apps Script runs files in order, and cueKind_ must exist first.
 * - Timing is the engine's Chaser rules (accreditation: first 3, every 3, max 3 days); the max shows as "to decide on" with the
 *   supplier's phone number, so Kiko can call. Urgent when the event is 5 days away or less. Bank numbers never appear. */
const CUE_ACCR_ = { cc: 'suppliers@blankspaceevent.com', soon: 5, subject: 'Supplier accreditation · Blank Space Events' };
/* Bug fixes 27 Oct: an address that cannot take a reply (an invoicing app's sender, no-reply, bounce) is never emailed or searched,
 * and the email never asks for an account number, account name or "acct no.": code turns down a ChatGPT draft that does (the
 * template is used), cuts Canvas's ask list to "Bank details for payment", and refuses Kiko's own edit that does. */
function cueNoReply_(e) { const a = String(e || '').toLowerCase(), local = a.split('@')[0], dom = a.split('@')[1] || '';
  return /^(no-?reply|do-?not-?reply|do_not_reply|donotreply|mailer-daemon|postmaster|bounces?|notifications?|notification-service|message-service|auto-?reply)([+._-].*)?$/.test(local)
    || /(^|\.)(sender|bounces?|mailer|notifications?)\./.test(dom) || /(^|\.)zohoinvoice\.com$/.test(dom); }
function cueAccrAsksAccount_(t) { return /\b(account|acct)\.?\s*(number|no\b|no\.|num\b|#)|\baccount\s+name\b|\bacct\b/i.test(String(t || '')); }
const cueAccrAskItem_ = n => cueAccrAsksAccount_(n) ? 'Bank details for payment' : n;

const cueAccrKey_ = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 60) || 'x';
const cueAccrList_ = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a[0] || '';

/** Kiko's newest accreditation message with each supplier: { [i]: { thread_id, message_id, subject, from_them, day } }. Gmail read only. */
function cueAccrThreads_(rows) {
  const tok = { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, out = {};
  const ask = rows.map((r, i) => ({ i, q: 'subject:"Supplier accreditation" newer_than:1y (' + r.sent_to.map(e => 'from:' + e + ' OR to:' + e + ' OR cc:' + e).join(' OR ') + ')' }))
    .filter(x => rows[x.i].sent_to.length);
  if (!ask.length) return out;
  const lists = UrlFetchApp.fetchAll(ask.map(x => ({ url: CUE_GMAIL_ + '/messages?maxResults=1&q=' + encodeURIComponent(x.q), muteHttpExceptions: true, headers: tok })));
  const got = [];
  lists.forEach((res, n) => {
    if (res.getResponseCode() === 403 && /scope/i.test(res.getContentText())) throw new Error('Cue does not have Gmail access yet. Tap Fix Google access in the Threads pane.');
    if (res.getResponseCode() !== 200) return;
    const m = (JSON.parse(res.getContentText() || '{}').messages || [])[0];
    if (m) got.push({ i: ask[n].i, id: m.id });
  });
  if (!got.length) return out;
  UrlFetchApp.fetchAll(got.map(g => ({ url: CUE_GMAIL_ + '/messages/' + g.id + '?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Message-ID',
    muteHttpExceptions: true, headers: tok }))).forEach((res, n) => {
    if (res.getResponseCode() !== 200) return;
    const m = JSON.parse(res.getContentText()), h = {};
    ((m.payload && m.payload.headers) || []).forEach(x => { h[String(x.name).toLowerCase()] = String(x.value || ''); });
    const from = String((h.from.match(/<([^>]+)>/) || [0, h.from])[1] || '').trim().toLowerCase(), r = rows[got[n].i];
    out[got[n].i] = { thread_id: m.threadId, message_id: cueStr_(h['message-id'], 300), subject: cueStr_(h.subject, 300),
      from_them: r.sent_to.indexOf(from) >= 0, day: cuePh_(Number(m.internalDate)).day };
  });
  return out;
}

/* ACCR-CLIENTS-2026-11-03 (Kiko 30 Oct 10:52Z: "whats wrong is that this is a client. we are the supplier"; proposal approved 3 Nov
 * 14:59Z): a row whose name is a client in Canvas Accounts (Client Desk) is a client's own accreditation of BSE, so the morning batch
 * leaves it out; that client keeps its own Accreditation thread. Canvas answers client_check read only, one call per row, in parallel.
 * When Canvas cannot say (an older Canvas, Client Desk off, a read error), the row stays in, as before. */
function cueAccrClients_(s, rows) {
  const names = rows.map(r => cueStr_(r.supplier, 200)), ask = names.map((n, i) => ({ n, i })).filter(x => String(x.n).trim());
  if (!ask.length) return {};
  let res = [];
  try { res = UrlFetchApp.fetchAll(ask.map(x => cueBridgeReq_(s, 'client_check', { company: x.n, contacts: [] }))); } catch (e) { console.warn('Accreditation client check: ' + e); return {}; }
  const out = {};
  res.forEach((r, k) => { try { const o = cueBridgeParse_('client_check', r) || {}; if (o.client === 'existing') out[ask[k].i] = true; } catch (e) { /* Canvas cannot say: keep the row */ } });
  return out;
}

/* ACCR-SHOPS-2026-11-04 (PC check 3 Nov: Booking.com and Shell were chased for accreditation; Kiko 3 Nov 23:37Z "yes" to Cue
 * skipping shops and booking sites like these on its own). They are awarded payees (hotel nights, fuel, toll RFID) that are never
 * accredited, so the morning batch leaves them out. Only the names seen so far are listed; Stop chasing still covers any other. */
const CUE_ACCR_SHOPS_ = /\b(booking\.com|shell|autosweep)\b/i;

/** The morning lines: one per supplier. */
function cueAccrFind_(ctx) {
  const g = cueBridge_(ctx.s, 'accreditation_gaps', {}) || { rows: [] }, rule = ctx.rule('accreditation'), today = ctx.today;
  const all = (g.rows || []).map(r => Object.assign({}, r, { sent_to: (r.sent_to || []).map(e => String(e).toLowerCase()).filter(e => cueEmail_(e) && !cueNoReply_(e)) }));
  const shops = all.filter(r => !CUE_ACCR_SHOPS_.test(String(r.supplier || '')));
  const isClient = cueAccrClients_(ctx.s, shops), rows = shops.filter((r, i) => !isClient[i]);
  const th = cueAccrThreads_(rows);
  return rows.map((r, i) => {
    const t = th[i] || null;
    // Sent by hand from a Drafts-only batch: Canvas has no date yet, but Kiko's Gmail has the email.
    const byHand = t && !t.from_them && t.day > (r.form_sent || '') && t.day > (r.last_reminder || '') ? t.day : '';
    const last = [r.form_sent || '', r.last_reminder || '', byHand].sort().pop(), first = !r.form_sent && !byHand;
    const soon = r.event_date && r.event_date >= today && r.event_date <= cueAddDays_(today, CUE_ACCR_.soon);
    const contact = r.contact && (r.contact.name || r.contact.phone) ? ' Contact: ' + [r.contact.name, r.contact.phone].filter(String).join(', ') + '.' : '';
    const base = { key: (first ? 'accr-form:' : 'accr:') + cueAccrKey_(r.supplier), project: r.project || '', project_id: r.project_id || '', project_status: r.project_status, who: r.supplier,
      to: r.sent_to.join(', '), priority: soon ? 'urgent' : 'normal', due_since: last || r.opened || today,
      facts: { supplier: r.supplier, contact_name: (r.contact && r.contact.name) || '', missing: r.missing, project: r.project || '', event_date: r.event_date || '',
        form_url: g.form_url || '', first_email: first, asks: (r.asks || []).map(([h, items]) => [h, (items || []).map(cueAccrAskItem_)]) } };
    if (t) Object.assign(base, { thread_id: t.thread_id, message_id: t.message_id, thread_subject: t.subject });
    const answered = r.replied_since || (t && t.from_them && last && t.day >= last ? t.day : '');
    if (answered) return Object.assign(base, { no_email: true, needs_draft: false,
      why: 'They answered on ' + answered + (r.replied_by === 'form' ? ' (accreditation form)' : '') + '. Read their documents in Canvas; still missing: ' + r.missing.join(', ') + '.' });
    if (!r.sent_to.length) return Object.assign(base, { no_email: true, needs_draft: false, why: 'No email address on file. Add one in Canvas to chase. Missing: ' + r.missing.join(', ') + '.' + contact });
    const gap = r.reminders || r.last_reminder ? rule.every || 3 : rule.first || 3;   // the engine's Chase log also applies every and max
    if (!first && today < (rule.unit === 'working' ? cueAddWork_ : cueAddDays_)(last, gap)) return null;
    return Object.assign(base, { why: (first ? 'Accreditation form not sent yet' : 'Form sent ' + r.form_sent + (r.reminders ? ', ' + r.reminders + ' reminder(s)' : ''))
      + '. Missing: ' + r.missing.join(', ') + '.' + (soon ? ' Event on ' + r.event_date + '.' : '') + contact });
  }).filter(Boolean);
}

/** The plain wording, used when ChatGPT fails (and as ChatGPT's guide). */
function cueAccrTemplate_(it) {
  const f = it.facts || {}, hi = 'Hi ' + (f.contact_name || f.supplier || it.who) + ',\n\n', on = f.project ? ' on ' + f.project : '', sign = '\n\nThank you,\nKiko\nBlank Space Events';
  if (f.first_email) {
    const asks = (f.asks || []).map(([h, items]) => h + ':\n' + items.map(n => '- ' + n).join('\n')).join('\n\n');
    return { subject: CUE_ACCR_.subject + (f.project ? ' · ' + f.project : ''),
      body: hi + 'Thank you for working with us' + on + '. To set you up in our supplier records and process your payments, please complete our Vendor Accreditation Form:\n'
        + f.form_url + '\n\n' + asks + '\n\nIf you have any questions or clarifications, feel free to hit reply.' + sign };
  }
  return { subject: CUE_ACCR_.subject + (f.project ? ' · ' + f.project : ''),
    body: hi + 'A quick reminder about our Vendor Accreditation Form' + (f.project ? ' for ' + f.project : '') + '. We still need: '
      + cueAccrList_((f.missing || []).map(m => m.toLowerCase() === 'bank details' ? 'your bank details' : m)) + '.\n\nYou can send them through the form:\n' + f.form_url
      + '\n\nIf you already sent them, reply to this email and we will check.' + sign };
}
/** ChatGPT's words, with the form link put back if it was dropped. */
const cueAccrBody_ = it => { const u = (it.facts || {}).form_url || '', b = String(it.body || '').trim() || cueAccrTemplate_(it).body;
  return u && b.indexOf(u) < 0 ? b + '\n\nThe form: ' + u : b; };

/** One draft in Kiko's Gmail with suppliers@ in CC: a reply in the accreditation thread when there is one. Returns the draft id. */
function cueAccrDraft_(it) {
  if (cueAccrAsksAccount_(cueAccrBody_(it))) throw new Error('The email never asks for an account number or account name. Say "bank details" and send them to the form. Edit it and retry.');
  const b64 = t => Utilities.base64Encode(Utilities.newBlob(String(t)).getBytes()), cc = cueProp_('CUE_ACCR_CC', CUE_ACCR_.cc);
  const subj0 = it.thread_id && it.thread_subject ? it.thread_subject : it.subject || cueAccrTemplate_(it).subject;
  const subj = it.thread_id && !/^re:/i.test(subj0) ? 'Re: ' + subj0 : subj0;
  const mime = 'To: ' + it.to + '\r\n' + (cueEmail_(cc) ? 'Cc: ' + cc + '\r\n' : '') + 'Subject: =?UTF-8?B?' + b64(subj.replace(/[\r\n]+/g, ' ')) + '?=\r\n'
    + (it.thread_id && it.message_id ? 'In-Reply-To: ' + it.message_id + '\r\nReferences: ' + it.message_id + '\r\n' : '')
    + 'MIME-Version: 1.0\r\n' + (it.html ? cueRfpRich_(cueAccrBody_(it), it.html, '') : 'Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n' + b64(cueAccrBody_(it)));   // CUE-TEMPLATES-2026-10-31: the designed email
  const msg = { raw: Utilities.base64EncodeWebSafe(Utilities.newBlob(mime).getBytes()) };
  if (it.thread_id) msg.threadId = it.thread_id;
  const res = UrlFetchApp.fetch(CUE_GMAIL_ + '/drafts', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, payload: JSON.stringify({ message: msg }) });
  let o = null; try { o = JSON.parse(res.getContentText()); } catch (e) { o = null; }
  if (res.getResponseCode() !== 200 || !o || !o.id) throw new Error('Gmail did not make the draft (HTTP ' + res.getResponseCode() + ')');
  return o.id;
}
const cueAccrReq_ = (s, it, stage) => ({ request_id: cueStr_(s.id + ':' + stage + ':' + cueAccrKey_(it.who), 80), supplier: cueStr_(it.who, 200), stage });

/** At send time (after Kiko's Approve and send): Canvas re-checks, Cue sends from Kiko's Gmail, Canvas logs it. */
function cueAccrSend_(it, s) {
  const chk = cueBridge_(s, 'log_accreditation_reminder', cueAccrReq_(s, it, 'check'));
  if (!chk || !chk.open) throw new Error('Not sent: Canvas shows ' + it.who + ' is no longer missing anything.');
  if (!it.draft_id) it.draft_id = cueAccrDraft_(it);
  const sent = cueGmailSend_(it.draft_id);
  try { cueBridge_(s, 'log_accreditation_reminder', Object.assign(cueAccrReq_(s, it, 'sent'), { to: cueStr_(it.to, 500) }, it.thread_id ? { thread_id: it.thread_id } : {})); }
  catch (e) { s.notes.push('Sent to ' + it.who + ', but Canvas could not log it: ' + cueStr_((e && e.message) || e, 200)); }
  return sent;
}

cueKind_({ kind: 'accreditation', label: 'S1 Accreditation chasers', every: 3, max: 3, sendAllowed: true,
  // CUE-TEMPLATES-2026-10-31: Kiko's S1 Accreditation follow-up wording and look, no AI call. The first request keeps Cue's own wording
  // until Canvas sends S1 from info@ (part 3).
  template: it => ((it.facts || {}).first_email ? cueAccrTemplate_(it) : cueTplS1_(it)), check: it => !cueAccrAsksAccount_(it.body), find: cueAccrFind_, draft: it => cueAccrDraft_(it), send: cueAccrSend_ });
