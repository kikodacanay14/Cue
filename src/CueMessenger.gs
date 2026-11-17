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
/* MSGR-DOC-IMAGE-2026-11-06 (Kiko 6 Nov 2026 08:27Z "Can it show an image instead of a link? Or the FSA viewer?"; 08:31Z picked
 * "Picture of page 1 + button" on the mockup https://claude.ai/artifact/GUJFRMhFhL2HvjPZ8nuNcB, which came with the rule: when
 * Cue can't make the picture, it sends the button card so the paper still goes out). One paper: a short line, then the picture
 * of page 1 (from Canvas, msgr_doc_image) with a "View and sign" button. Without a picture: one card with the same line and
 * button. The button opens the paper's own sign link (the FSA viewer on the crew site). Returns the first send's answer. */
function cueMsgrDocLine_(d) {
  const first = String(d.name || '').trim().split(/\s+/)[0] || 'Hi';
  return first + ', your ' + d.doc + ' for ' + String(d.project || 'your event').trim() + ' is ready to sign. The link works for 30 days. It\'s also in your email.';
}
function cueMsgrDocSend_(s, d) {
  const btn = [['View and sign ' + d.doc, d.sign_link]];
  const card = () => cueMsgrSend_(d.messenger_id, (CUE_MSGR_.doc[d.doc] || d.doc) + '\n' + cueMsgrDocLine_(d), btn);
  let id = '';
  try {
    const img = cueBridge_(s, 'msgr_doc_image', { doc: d.doc, id: d.id }) || {};
    if (img.ok && img.b64 && /^image\/(png|jpeg)$/.test(String(img.mime))) id = cueMsgrUpload_(img.b64, img.mime, d.doc + '-' + d.id);
  } catch (e) { console.warn('Messenger picture ' + d.id + ': ' + e); }
  if (!id) return card();
  const r = cueMsgrSend_(d.messenger_id, cueMsgrDocLine_(d));
  if (!r.ok) return r;
  const token = PropertiesService.getScriptProperties().getProperty('MSGR_PAGE_TOKEN');
  const m = cueMsgrPost_(token, d.messenger_id, { attachment: { type: 'template', payload: { template_type: 'media',
    elements: [{ media_type: 'image', attachment_id: id, buttons: [{ type: 'web_url', url: d.sign_link, title: btn[0][0] }] }] } } });
  if (!m.ok) { console.warn('Messenger picture card ' + d.id + ': ' + m.error); return Object.assign(card(), { ok: true }); }   // the line went; the button must too
  return r;
}
/** Uploads one picture to Meta for a message; returns its attachment id, or '' when Meta did not take it. */
function cueMsgrUpload_(b64, mime, name) {
  const token = PropertiesService.getScriptProperties().getProperty('MSGR_PAGE_TOKEN');
  if (!token) return '';
  const blob = Utilities.newBlob(Utilities.base64Decode(b64), mime, String(name).replace(/[^\w.-]/g, '') + (mime === 'image/png' ? '.png' : '.jpg'));
  const res = UrlFetchApp.fetch('https://graph.facebook.com/v21.0/me/message_attachments', { method: 'post', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token },
    payload: { message: JSON.stringify({ attachment: { type: 'image', payload: { is_reusable: true } } }), filedata: blob } });
  if (res.getResponseCode() !== 200) return '';
  try { return String(JSON.parse(res.getContentText()).attachment_id || ''); } catch (e) { return ''; }
}
/* MSGR-BUTTONS-2026-11-06 (Kiko 08:33Z): a payment notice ends with its item link (Canvas writes it without https://). On
 * Messenger the link becomes a "View details" button under the words; a notice with no link goes as plain text. */
function cueMsgrLinkSplit_(text) {
  const m = String(text).match(/^([\s\S]*?)[\s.:]*\s((?:https:\/\/)?[a-z0-9-]+(?:\.[a-z0-9-]+)+\/\S*)\s*$/i);
  const words = m ? m[1].replace(/\s*(?:Details|Link|View)\s*$/i, '').trim() : '';
  if (!words) return null;
  return { text: /[.!?)]$/.test(words) ? words : words + '.', url: /^https:\/\//i.test(m[2]) ? m[2] : 'https://' + m[2] };
}
/** One Messenger text to one person (Send API, RESPONSE type: inside the 24-hour window only). */
function cueMsgrSend_(psid, text, buttons) {
  const token = PropertiesService.getScriptProperties().getProperty('MSGR_PAGE_TOKEN');
  if (!token) return { ok: false, error: 'no MSGR_PAGE_TOKEN' };
  /* Buttons go as a button template (Kiko 5 Nov 04:54Z "There are no buttons showing", 04:56Z "Yes"): they stay on the message,
   * where quick replies vanished as soon as the person typed. A tap comes back as a postback. */
  /* MSGR-BUTTONS-2026-11-06 (Kiko 6 Nov 08:33Z "Can we do that kind of button all the time?"): a button whose second part is
   * an https link opens that page (web_url); any other is a tap that comes back as a postback. */
  const message = buttons
    ? { attachment: { type: 'template', payload: { template_type: 'button', text: String(text).slice(0, 640),
        buttons: buttons.map(b => /^https:\/\//.test(b[1]) ? { type: 'web_url', url: b[1], title: b[0] } : { type: 'postback', title: b[0], payload: b[1] }) } } }
    : { text: String(text).slice(0, 2000) };
  return cueMsgrPost_(token, psid, message);
}
/** Posts one message (RESPONSE type) to Meta. */
function cueMsgrPost_(token, psid, message) {
  const res = UrlFetchApp.fetch(CUE_MSGR_.api, { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ recipient: { id: String(psid) }, messaging_type: 'RESPONSE', message }) });
  const code = res.getResponseCode();
  if (code === 200) return { ok: true };
  let msg = ''; try { msg = (JSON.parse(res.getContentText()).error || {}).message || ''; } catch (e) { msg = ''; }
  return { ok: false, error: 'Meta ' + code + (msg ? ': ' + String(msg).slice(0, 160) : '') };
}

/** Tells Canvas a document went out on Messenger (once, A11). On success the local note is dropped; on failure it stays for the next tick. */
function cueMsgrMark_(s, d, k, P) {
  try {
    // DOC-MENU-2026-11-07: a Message on FB ask (now_at) gets its own request id, so the bridge runs the mark again and Canvas clears the ask.
    const r = cueBridge_(s, 'msgr_mark', { request_id: 'msgr:' + d.doc + ':' + d.id + (d.now_at ? ':' + d.now_at : ''), doc: d.doc, id: d.id, email: d.email, psid: String(d.messenger_id) }) || {};
    if (r.ok) P.deleteProperty('CUE_MSGR_SENT_' + k);
  } catch (e) { console.warn('Messenger mark ' + k + ': ' + e); }
}
/** The job (Job Runs "Messenger sign links"). Returns how many documents went out on Messenger this tick. */
function cueMsgrTick_() {
  const P = PropertiesService.getScriptProperties(), now = cueNow_();
  if (now - Number(P.getProperty('CUE_MSGR_LAST') || 0) < CUE_MSGR_.everyMs) return 0;
  P.setProperty('CUE_MSGR_LAST', String(now));
  if (!P.getProperty('MSGR_PAGE_TOKEN')) return 0;   // not set up yet (Meta app approval pending)
  const paid = cueMsgrPayRun_();   // PAY-MSGR-2026-11-06: before the sign links, which may throw
  return cueMsgrRun_(now).sent + paid;
}

/* PAY-MSGR-2026-11-06 (Kiko 6 Nov 2026 00:49Z: "Can you switch all payments related notifications to facebook messenger instead
 * rather than sms"; 01:00Z "Yes, SMS backup", rule R-PMN-1). Canvas holds each payment text for a person Messenger can reach
 * (CanvasWorkspace src/PayMessenger.gs). Each tick Cue collects them (msgr_pay_due), sends each on Messenger and reports back
 * (msgr_pay_mark): ok = sent; not ok = Canvas texts it by SMS now. Without a Page token Cue never asks, and Canvas holds
 * nothing while Cue has not asked in the last 40 minutes (pmnCueOn_), so every payment text goes by SMS. With MSGR_PAY_TEMPLATE set (an approved Meta utility template, one body variable) the text goes as
 * a utility message, which Meta delivers outside the 24-hour window; otherwise as a normal reply (inside the window only).
 * No AI call. The text is Canvas's SMS wording; it carries no bank details (R6). */
function cueMsgrPayRun_() {
  const s = { id: 'msgr-pay' }, P = PropertiesService.getScriptProperties();
  let items = [];
  try { items = (cueBridge_(s, 'msgr_pay_due', {}) || {}).items || []; } catch (e) { console.warn('Messenger payments: ' + e); return 0; }
  let sent = 0;
  items.forEach(x => {
    const k = 'CUE_MSGR_PAY_' + x.id;
    let r = P.getProperty(k) ? { ok: true } : null;   // Meta took it on an earlier tick; only the report is retried
    if (!r) r = cueMsgrPaySend_(x.psid, x.text);
    if (r.ok && !P.getProperty(k)) { P.setProperty(k, String(cueNow_())); sent++; }
    try {
      const a = { request_id: 'msgrpay:' + x.id, id: x.id, ok: !!r.ok };
      if (!r.ok) a.why = String(r.error || 'not sent').slice(0, 300);
      const m = cueBridge_(s, 'msgr_pay_mark', a) || {};
      if (m.ok) P.deleteProperty(k);
    } catch (e) { console.warn('Messenger payment mark ' + x.id + ': ' + e); }
  });
  return sent;
}
/** One payment text: a utility message when MSGR_PAY_TEMPLATE is set, else a normal reply (24-hour window only). */
function cueMsgrPaySend_(psid, text) {
  const P = PropertiesService.getScriptProperties(), tpl = String(P.getProperty('MSGR_PAY_TEMPLATE') || '').trim();
  if (!tpl) { const l = cueMsgrLinkSplit_(text); return l ? cueMsgrSend_(psid, l.text, [['View details', l.url]]) : cueMsgrSend_(psid, text); }
  const token = P.getProperty('MSGR_PAGE_TOKEN');
  const body = String(text).replace(/^Blank Space Events:\s*/, '').slice(0, 900);
  const res = UrlFetchApp.fetch(CUE_MSGR_.api, { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ recipient: { id: String(psid) }, messaging_type: 'UTILITY',
      message: { template: { name: tpl, language: { code: 'en' }, components: [{ type: 'body', parameters: [{ type: 'text', text: body }] }] } } }) });
  const code = res.getResponseCode();
  if (code === 200) return { ok: true };
  let msg = ''; try { msg = (JSON.parse(res.getContentText()).error || {}).message || ''; } catch (e) { msg = ''; }
  return { ok: false, error: 'Meta ' + code + (msg ? ': ' + String(msg).slice(0, 160) : '') };
}
/** One pass: { sent, skipped: [{ id, why }], failed: [{ id, why }] }. */
function cueMsgrRun_(now) {
  const s = { id: 'msgr' }, o = cueBridge_(s, 'msgr_due', {}) || {}, out = { sent: 0, skipped: [], failed: [] };
  try { cueMsgrTell_(s, o.tell, now); } catch (e) { console.error('Messenger tell: ' + e); }   // CUE-CREW-MATCH-2026-11-05
  // A send Meta accepted is remembered here first, so a failed msgr_mark is retried on the next tick without a second message.
  const P = PropertiesService.getScriptProperties(), held = k => P.getProperty('CUE_MSGR_SENT_' + k);
  /* BUGFIX-MSGR-LAST-2026-11-06 (Kiko 6 Nov 03:30Z, linked by "I'm crew" and the code at 00:28 Manila, yet their FSA never came;
   * 03:31Z "Please check if this would happen to others too"): the code link and staff Link never wrote "Last Messenger message"
   * in Canvas, so every linked crew member looked outside the 24-hour window. When Canvas has no time, Cue uses the last time
   * in its own Messenger People tab and copies it to Canvas once. That time can be Cue's own "you're linked" message (staff Link
   * before this fix), so a Meta "outside of allowed window" answer for it is a skip, not a failure, and is not tried again
   * until the time changes. */
  let people = null;
  const lastOf = d => {
    if (String(d.last_message || '').trim() || !d.messenger_id) return { at: d.last_message, cue: false };
    try { people = people || cueMsgrPeople_(); } catch (e) { people = {}; }
    const p = people[String(d.messenger_id)] || {};
    return { at: p.last || '', cue: !!p.last, email: p.email || d.email || '' };
  };
  const synced = {};
  (o.docs || []).forEach(d => {
    /* DOC-MENU-2026-11-07 (Kiko 7 Nov 2026: "Message on FB" in Canvas Resources › FSA / AR, "build" 15:23Z): staff asked Canvas to send
     * this paper now (now_at), so it goes out on this tick even when it went on Messenger before. Same 24-hour window as always. */
    const k = d.doc + ':' + d.id + (d.now_at ? ':' + d.now_at : '');
    if (d.sent && !d.now_at) { if (held(k)) P.deleteProperty('CUE_MSGR_SENT_' + k); return; }
    if (held(k)) { cueMsgrMark_(s, d, k, P); return; }
    if (!d.messenger_id || !d.sign_link) { out.skipped.push({ id: d.id, why: 'not linked' }); return; }
    const L = lastOf(d);
    if (!cueMsgrInWindow_(L.at, now)) { out.skipped.push({ id: d.id, why: 'last message over 24 hours ago' }); return; }
    if (L.cue && P.getProperty('CUE_MSGR_OUT_' + k) === L.at) { out.skipped.push({ id: d.id, why: 'outside Meta\'s window' }); return; }
    const r = cueMsgrDocSend_(s, d);
    if (!r.ok && L.cue && /outside of allowed window/i.test(r.error)) { P.setProperty('CUE_MSGR_OUT_' + k, String(L.at)); out.skipped.push({ id: d.id, why: 'outside Meta\'s window' }); return; }
    if (!r.ok) { out.failed.push({ id: d.id, why: r.error }); return; }
    // Meta took it, so the window is open: Canvas gets the time too (once per person), for payment notices and later papers.
    if (L.cue && L.email && !synced[d.messenger_id]) {
      synced[d.messenger_id] = 1;
      try { cueBridge_(s, 'fl_social_save', { request_id: 'msgrlast:' + d.messenger_id + ':' + String(L.at).replace(/[^0-9A-Za-z]/g, ''), email: L.email, last_message: L.at }); }
      catch (e) { console.error('Messenger last-message copy: ' + e); }
    }
    P.setProperty('CUE_MSGR_SENT_' + k, String(cueNow_()));
    out.sent++;
    cueMsgrMark_(s, d, k, P);
  });
  if (out.failed.length) throw new Error('Messenger: ' + out.failed.length + ' not sent (' + out.failed.map(x => x.id + ': ' + x.why).join('; ').slice(0, 250) + ')');
  return out;
}

/* ---------- the receiving half (CUE-MSGR-2026-11-02, plan Task 6) ----------
 * Meta posts each crew message to the Messenger relay (relay/messenger-worker.js), which checks Meta's signature and holds
 * the event. Every 5 minutes (Job Runs "Messenger inbox") Cue collects the held events with its key (MSGR_RELAY_KEY), so Cue
 * needs no public address: live /exec stays Google sign-in only. Then, for each event:
 *   - a message carrying a crew member's sealed m.me ref: saves the link-up in Canvas (fl_social_save, no tap: D11), remembers
 *     the person in the "Messenger People" tab and says they are linked;
 *   - a message from a linked person: updates their last-message time in Canvas and adds it to their Cue chat
 *     "Messenger · <name>" (one chat per person, mockup MSG-5); Kiko answers there by typing;
 *   - anyone else: the triage (CUE-MSGR-TRIAGE-2026-11-05, cueMsgrTriage_ below); nothing is saved in Canvas.
 * Crew messages are untrusted data: Cue never follows instructions inside them and makes no AI call on them. */
const cueMsgrId_ = () => 'cue-' + Utilities.formatDate(new Date(cueNow_()), 'Asia/Manila', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 65536).toString(16).padStart(4, '0');
function cueMsgrClose_(id) {
  return cueLocked_(() => { const L = cueLoad_(id); L.s.closed_from = L.s.status; L.s.status = 'Done'; L.s.stage = 'Done'; delete L.s.nudge; cueSave_(L.sh, L.row, L.s); return L.s; });
}
const CUE_MSGR_PEOPLE_ = { tab: 'Messenger People', head: ['PSID', 'Email', 'Name', 'Last message', 'Chat'] };
const CUE_MSGR_SAY_ = {
  linked: n => 'Hi ' + n + '! You\'re linked to Blank Space Events. Your papers to sign will come here too. Reply anytime if you have a question.',
  stranger: 'Thanks for messaging Blank Space Events! This chat is for our crew. If you are crew, open the Messenger link in your email from us. '
    + 'For anything else, email info@blankspaceevent.com.',
  badLink: 'Thanks for messaging Blank Space Events! That link did not work. Please open the Messenger link in your newest email from us.',
  /* CUE-MSGR-TRIAGE-2026-11-05 (Kiko 4 Nov 2026 14:59Z "lets triage coz if its a customer inquiry... i want it"; 15:14Z two
   * buttons, "make the response warm"; 15:50Z the wording; 5 Nov 04:09Z "any initial message should provide triage already").
   * Mockup: CanvasWorkspace docs/mockups/crew-msgr-channels/messenger-triage.png. Kiko's words, kept as he wrote them. */
  greet: 'Hi! Thank you for reaching out to Blank Space Events. Para ma-assist ka namin agad, pili ka lang po sa baba.',
  help: 'Happy to help po. Ano pong maitutulong namin? Share mo lang kung para saan ang message mo.',
  thanks: 'Salamat po sa pag-message. I have passed the details to Kiko and he will get back to you. You may also contact Kiko Dacanay at '
    + 'kikodacanay@blankspaceevent.com or 0976 494 2398.',
  // Until the crew registration form ships (plan T3), "I'm crew" points to the Messenger link in their email.
  // Kiko 5 Nov 05:49Z "Also remove the note about the email": the email-link sentences are gone, the rest is his approved wording.
  crew: 'Welcome to the crew po. Reply ka lang dito with your full name and event, and our team will help you.',
  /* CUE-MSGR-CREW-ACK-2026-11-05 (Kiko 5 Nov 07:22Z: "There was no response in my message earlier when it asked me for the
   * event name and my name"): one reply right after a crew member sends their details, then quiet until the team answers. */
  crewAck: 'Salamat po! Natanggap na namin ang details mo. Babalikan ka ng team namin dito sa Messenger as soon as possible.',
  /* CUE-CREW-MATCH-2026-11-05 (Kiko 5 Nov 2026 11:49Z "Ok deploy" on CanvasWorkspace canvas-integration/specs/crew-messenger-channels/
   * crew-match-flow.png): Canvas matches the name and event (crew_match) and sends a 6-digit code. Kiko's words, as approved. */
  code: (ev, last2) => 'Salamat po! Nakita ka namin sa team ng ' + ev + '. Nag-send kami ng 6-digit code sa '
    + (last2 ? 'mobile mo na nagtatapos sa ' + last2 : 'email mo') + '. I-type mo lang dito ang code para ma-connect ka.',
  crewLinked: n => 'Hi ' + n + '! Naka-connect ka na sa Blank Space Events dito sa Messenger. Dito na rin namin ipapadala ang papers mo '
    + 'to sign (FSA and AR) at updates for your events. Reply ka lang anytime kung may tanong ka.',
  wrong: left => 'Mali po ang code. May ' + left + ' ' + (left === 1 ? 'try' : 'tries') + ' ka pa.',
  notLinked: 'Hindi pa namin ma-connect ang Messenger mo. Babalikan ka ng team namin dito.',
  noContact: 'Salamat po! Kailangan lang namin i-confirm ang details mo. Babalikan ka ng team namin dito.'
};
const CUE_MSGR_TRI_ = { crew: 'TRI_CREW', client: 'TRI_CLIENT', start: 'TRI_START', buttons: [['I\'m crew', 'TRI_CREW'], ['Client or inquiry', 'TRI_CLIENT']] };

function cueMsgrPeopleTab_() { return cueSheet_(CUE_MSGR_PEOPLE_.tab); }   // made on first use from CUE_TABS_
/** { psid: { row, psid, email, name, last, chat } } */
function cueMsgrPeople_() {
  const sh = cueMsgrPeopleTab_(), out = {};
  if (sh.getLastRow() >= 2) sh.getRange(2, 1, sh.getLastRow() - 1, CUE_MSGR_PEOPLE_.head.length).getValues().forEach((r, i) => {
    const p = String(r[0] || '').trim(); if (p) out[p] = { row: i + 2, psid: p, email: String(r[1] || ''), name: String(r[2] || ''), last: String(r[3] || ''), chat: String(r[4] || '') };
  });
  return out;
}
function cueMsgrPersonSave_(p) {
  const sh = cueMsgrPeopleTab_(), row = [p.psid, p.email, p.name, p.last, p.chat || ''];
  if (p.row) sh.getRange(p.row, 1, 1, row.length).setValues([row]); else { sh.appendRow(row); p.row = sh.getLastRow(); }
  return p;
}
/** Name and gender from Meta (needs the profile permissions); {} when Meta does not answer. */
function cueMsgrProfile_(psid) {
  const token = PropertiesService.getScriptProperties().getProperty('MSGR_PAGE_TOKEN');
  if (!token) return {};
  try {
    const res = UrlFetchApp.fetch('https://graph.facebook.com/v21.0/' + encodeURIComponent(psid) + '?fields=name,gender',
      { muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + token } });
    if (res.getResponseCode() !== 200) return {};
    const o = JSON.parse(res.getContentText());
    return { name: cueStr_(o.name || '', 120), gender: cueStr_(o.gender || '', 20) };
  } catch (e) { return {}; }
}
/** The person's Cue chat (one per crew member), made when missing. Returns its id. Call locked. */
function cueMsgrChatFor_(p) {
  if (p.chat && cueLoad_(p.chat)) return p.chat;
  const sh = cueSheet_('Requests'), id = cueMsgrId_();
  const s = { id, version: CUE_VERSION_, kind: 'msgr', created: new Date(cueNow_()).toISOString(), started: cueNow_(), ref: '',
    text: 'Messenger · ' + (p.name || p.email || 'crew member'), status: 'Needs you', stage: 'Needs you', card_at: cueNow_(),
    msgr: { psid: p.psid, email: p.email, name: p.name }, metrics: { ai_calls: 0, calls: [] }, notes: [] };
  sh.appendRow([id]); cueSave_(sh, sh.getLastRow(), s);
  p.chat = id;
  return id;
}
/** The door's msgr_event: one Meta webhook body. Returns { ok, handled }. */
function cueMsgrEvent_(body) {
  let handled = 0;
  ((body && body.entry) || []).forEach(en => ((en && en.messaging) || []).forEach(m => {
    try { if (cueMsgrOne_(m)) handled++; } catch (e) { console.error('Messenger event: ' + e); }
  }));
  return { ok: true, handled };
}
function cueMsgrOne_(m) {
  const psid = String((m.sender || {}).id || '').trim(), msg = m.message || {};
  if (!/^\d{1,40}$/.test(psid) || msg.is_echo) return false;   // our own messages come back as echoes
  const at = new Date(Number(m.timestamp) || cueNow_()).toISOString(), text = cueStr_(msg.text || '', 2000);
  const ref = cueStr_((m.referral || {}).ref || ((m.postback || {}).referral || {}).ref || '', 400), s = { id: 'msgr' };
  const people = cueMsgrPeople_();
  let p = people[psid];
  if (ref) {
    const prof = cueMsgrProfile_(psid);
    const r = cueBridge_(s, 'fl_social_save', { request_id: 'msgrlink:' + psid + ':' + at.replace(/[^0-9A-Za-z]/g, ''), ref, messenger_id: psid,
      messenger_name: prof.name || '', gender: prof.gender || '', linked_at: at, last_message: at }) || {};
    if (!r.ok) {
      cueMsgrSend_(psid, CUE_MSGR_SAY_.badLink);
      cueChat_('Cue', 'Messenger: someone opened a crew Messenger link that did not work (' + cueStr_(r.error || 'not saved', 160) + '). Nothing was saved.', '');
      return true;
    }
    p = Object.assign(p || { psid }, { email: r.email, name: prof.name || (p && p.name) || r.email, last: at });
    cueLocked_(() => { cueMsgrChatFor_(p); cueMsgrPersonSave_(p); });
    cueMsgrSend_(psid, CUE_MSGR_SAY_.linked(String(p.name || '').split(/\s+/)[0] || 'there'));
    cueChat_('Cue', 'Linked on Messenger: ' + p.name + ' (' + p.email + ').', p.chat);
    if (text) cueChat_(p.name + ' · Messenger', text, p.chat);
    return true;
  }
  if (!p && /\bstart over\b/i.test(text)) {   // Kiko 5 Nov 05:21Z typed "Start over daw" in Messenger: the person can reset themselves too
    const P = PropertiesService.getScriptProperties(); P.deleteProperty('MSGR_TRI_' + psid); P.deleteProperty('MSGR_TOLD_' + psid);
  }
  if (!p) {
    const pb = m.postback || {}, typed = CUE_MSGR_TRI_.buttons.find(b => b[0].toLowerCase() === text.trim().toLowerCase().replace(/[\u2019]/g, "'"));
    const tap = String(pb.payload || (msg.quick_reply || {}).payload || (typed ? typed[1] : ''));
    return cueMsgrTriage_(psid, at, text || cueStr_(pb.title || '', 200), tap, !!m.relay_replied);
  }
  p.last = at;
  if (p.email) cueBridge_(s, 'fl_social_save', { request_id: 'msgrlast:' + psid + ':' + at.replace(/[^0-9A-Za-z]/g, ''), email: p.email, last_message: at });   // CUE-CREW-MATCH: staff-linked crew may have no key
  cueLocked_(() => {
    cueMsgrChatFor_(p); cueMsgrPersonSave_(p);
    const L = cueLoad_(p.chat);
    if (L && L.s.status !== 'Needs you') { L.s.status = 'Needs you'; L.s.stage = 'Needs you'; L.s.card_at = cueNow_(); delete L.s.archived; cueSave_(L.sh, L.row, L.s); }
  });
  if (text) { cueChat_(p.name + ' · Messenger', text, p.chat); cueAlertMsgr_(p.chat, p.name, text); }   // CUE-ALERTS-2026-11-16 (never throws)
  return true;
}
/* CUE-MSGR-TRIAGE-2026-11-05: someone not linked as crew. Their first message gets the greeting with two tap buttons, once.
 * "Client or inquiry": Cue asks how it can help; their next message gets the thanks, and the person gets one Cue chat
 * ("Messenger · <name> · Client or inquiry", Needs you) where Kiko reads everything they send and can answer by typing.
 * "I'm crew": the crew reply, and one Cue chat ("· Crew, not linked yet") so staff can send the link.
 * No tap: one line in Ask Cue with their first words (as 1.28.19.1); later untapped messages stay in the Page inbox.
 * State per person in script property MSGR_TRI_<psid>: { st: asked | crew | ask_help | client, chat, name, last }. No AI call. */
function cueMsgrTri_(psid) { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('MSGR_TRI_' + psid) || 'null'); } catch (e) { return null; } }
function cueMsgrTriSave_(psid, T) { PropertiesService.getScriptProperties().setProperty('MSGR_TRI_' + psid, JSON.stringify(T)); return T; }
/** The person's one Cue chat, made when missing, and set to Needs you. Returns its id. */
function cueMsgrTriChat_(psid, T, label) {
  if (!T.name) T.name = cueMsgrProfile_(psid).name || 'Messenger guest';
  return cueLocked_(() => {
    const p = { psid, email: '', name: T.name, chat: T.chat };
    cueMsgrChatFor_(p);
    const L = cueLoad_(p.chat);
    if (L) { L.s.text = 'Messenger · ' + T.name + ' · ' + label; L.s.msgr.lead = label; L.s.status = 'Needs you'; L.s.stage = 'Needs you';
      L.s.card_at = cueNow_(); delete L.s.archived; cueSave_(L.sh, L.row, L.s); }
    T.chat = p.chat;
    return p.chat;
  });
}
/* CUE-MSGR-ONE-LINE-2026-11-05 (Kiko 5 Nov 2026 13:07Z: "Also why am i still getting 1 notif per message? I raised this yesterday";
 * 13:08Z: "why do i get 1 notif per messatge"): one person on Messenger is one line in the main chat. The first "new message from
 * someone not linked" line becomes the pointer to their chat once they tap, so the chat's row under it updates in place; the later
 * steps (details sent, no mobile or email, 3 wrong codes) post in that chat, which turns Needs you, not as new main-chat lines. */
function cueMsgrPointTold_(T, chat) {
  if (!T || !T.told || !chat) return;
  try {
    const sh = cueSheet_('Chat'), n = sh.getLastRow() - 1; if (n < 1) return;
    const k = Math.min(n, 500), rows = sh.getRange(n + 2 - k, 1, k, 4).getValues();
    for (let i = rows.length - 1; i >= 0; i--) if (String(rows[i][1]) === 'Cue' && String(rows[i][2]) === T.told && !String(rows[i][3] || '')) {
      sh.getRange(n + 2 - k + i, 4, 1, 1).setValues([['>' + chat]]); break; }
    delete T.told;
  } catch (e) { console.warn('Messenger line: ' + e); }
}
function cueMsgrTriage_(psid, at, text, tap, replied) {   // replied: the relay already answered this tap (CUE-MSGR-INSTANT-2026-11-05)
  let T = cueMsgrTri_(psid);
  if (tap === CUE_MSGR_TRI_.client || tap === CUE_MSGR_TRI_.crew) {
    const crew = tap === CUE_MSGR_TRI_.crew;
    T = T || { first: text };
    T.st = crew ? 'crew' : 'ask_help'; T.last = at;
    if (!replied) cueMsgrSend_(psid, crew ? CUE_MSGR_SAY_.crew : CUE_MSGR_SAY_.help);
    const chat = cueMsgrTriChat_(psid, T, crew ? 'Crew, not linked yet' : 'Client or inquiry');
    cueMsgrPointTold_(T, chat);
    cueMsgrTriSave_(psid, T);
    cueChat_('Cue', T.name + ' tapped "' + (crew ? 'I\'m crew' : 'Client or inquiry') + '" on Messenger.'
      + (T.first && T.first !== text ? ' First message: "' + cueStr_(T.first, 200) + '"' : ''), chat);
    return true;
  }
  if (!T) {
    /* One Ask Cue line per person in total (Kiko 5 Nov 04:33Z "its still sending 1 notif per message"): MSGR_TOLD_<psid> marks
     * the line, so a person 1.28.19.1 already noted, or whose greeting Facebook refused, gets no second line. */
    const P = PropertiesService.getScriptProperties(), told = 'MSGR_TOLD_' + psid, first = !P.getProperty(told);
    const r = cueMsgrSend_(psid, CUE_MSGR_SAY_.greet, CUE_MSGR_TRI_.buttons);
    let line = '';
    if (first) {
      P.setProperty(told, at);
      line = 'Messenger: new message from someone not linked as crew' + (text ? ': "' + cueStr_(text, 200) + '"' : '')
        + (r.ok ? '. Cue asked them to pick I\'m crew or Client or inquiry; if they pick, they get their own chat here.'
          : '. The greeting was not sent (' + r.error + '); Cue tries again on their next message.');
      cueChat_('Cue', line, '');
    }
    if (!r.ok) return true;   // 5 Nov 04:29Z: a refused greeting saves no triage state, so the next message tries again
    cueMsgrTriSave_(psid, Object.assign({ st: 'asked', first: text, last: at }, line ? { told: line } : {}));
    return true;
  }
  T.last = at;
  if (!T.chat) {   // no tap yet (Kiko 5 Nov 04:51Z "Its not responding..."): a typed message gets the greeting and buttons again, no new Ask Cue line
    if (cueMsgrSend_(psid, CUE_MSGR_SAY_.greet, CUE_MSGR_TRI_.buttons).ok) T.asked = at;
    cueMsgrTriSave_(psid, T); return true;
  }
  if (T.st === 'ask_help' && text) { cueMsgrSend_(psid, CUE_MSGR_SAY_.thanks); T.st = 'client'; }
  if (T.st === 'crew' && text) { const done = cueMsgrCrewMatch_(psid, at, text, T); if (done) return true; }
  /* A crew member's details get one reply and one line in the main chat; later messages stay quiet until the team answers
   * from the Cue chat (cueMsgrSaid_ clears T.acked). Since CUE-CREW-MATCH-2026-11-05 this is the "not sure" reply: Canvas found
   * no one person on a live team for what they wrote. */
  const ack = T.st === 'crew' && text && !T.acked && !T.m;
  if (ack && cueMsgrSend_(psid, CUE_MSGR_SAY_.crewAck).ok) T.acked = at;
  if (ack) T.m = 'unsure';
  cueMsgrTriSave_(psid, T);
  cueMsgrTriChat_(psid, T, T.st === 'crew' ? 'Crew, not linked yet' : 'Client or inquiry');
  if (text) { cueChat_(T.name + ' · Messenger', text, T.chat); cueAlertMsgr_(T.chat, T.name, text); }   // CUE-ALERTS-2026-11-16 (never throws)
  if (ack) cueChat_('Cue', T.name + ' (crew, not linked yet) sent their details on Messenger: "' + cueStr_(text, 200) + '". Reply in their chat.', T.chat);   // CUE-MSGR-ONE-LINE
  return true;
}
/* CUE-CREW-MATCH-2026-11-05: a crew member's details or code. T.m = 'code' (a code is waiting), 'wait' (no mobile and no email:
 * staff tap Link in Canvas), 'locked' (3 wrong codes), 'unsure' (not matched; later details are tried again quietly).
 * Returns true when it handled the message (reply sent, chat updated), false to fall back to the "not sure" reply. */
function cueMsgrCrewMatch_(psid, at, text, T) {
  const s = { id: 'msgr' }, rid = k => k + ':' + psid + ':' + at.replace(/[^0-9A-Za-z]/g, '');
  const log = () => { cueMsgrTriChat_(psid, T, 'Crew, not linked yet'); cueChat_(T.name + ' · Messenger', text, T.chat); };
  const call = (action, args) => { try { return cueBridge_(s, action, args) || null; } catch (e) { console.error('Messenger ' + action + ': ' + e); return null; } };
  if (T.m === 'wait' || T.m === 'locked') { cueMsgrTriSave_(psid, T); log(); return true; }
  const code = String(text).replace(/\s+/g, '');
  if (T.m === 'code' && /^\d{6}$/.test(code)) {
    const r = call('crew_code_check', { request_id: rid('crewcode'), psid, code });
    if (r && r.status === 'linked') return cueMsgrCrewLinked_(psid, at, T, r, text);
    if (r && r.status === 'wrong') { cueMsgrSend_(psid, CUE_MSGR_SAY_.wrong(r.left)); cueMsgrTriSave_(psid, T); log(); return true; }
    if (r && r.status === 'locked') {
      cueMsgrSend_(psid, CUE_MSGR_SAY_.notLinked); T.m = 'locked'; cueMsgrTriSave_(psid, T); log();
      cueChat_('Cue', (r.name || T.name) + ' typed 3 wrong codes on Messenger. Nothing was linked.', T.chat);   // CUE-MSGR-ONE-LINE
      return true;
    }
    if (!r || r.status !== 'none') { cueMsgrTriSave_(psid, T); log(); return true; }   // Canvas busy: the code stays; they can type it again
    text = T.details || text;   // the code ran out: send a new one for the same details
  }
  if (T.m === 'code' && !/^\d{6}$/.test(code)) { cueMsgrTriSave_(psid, T); log(); return true; }   // words while a code waits: chat only
  const m = call('crew_match', { request_id: rid('crewmatch'), psid, messenger_name: cueStr_(T.name || '', 120), text: cueStr_(text, 1000) });
  if (!m) return false;
  if (m.status === 'already') return cueMsgrCrewLinked_(psid, at, T, m, text);
  if (m.status === 'code_sent') {
    cueMsgrSend_(psid, CUE_MSGR_SAY_.code(m.project, m.channel === 'mobile' ? m.hint : ''));
    T.m = 'code'; T.details = cueStr_(text, 1000); cueMsgrTriSave_(psid, T); log();
    cueChat_('Cue', 'Matched to ' + (m.person || T.name) + ' on ' + m.project + '. Cue sent them a 6-digit code by ' + (m.channel === 'mobile' ? 'SMS' : 'email') + '.', T.chat);
    return true;
  }
  if (m.status === 'no_contact') {
    cueMsgrSend_(psid, CUE_MSGR_SAY_.noContact); T.m = 'wait'; cueMsgrTriSave_(psid, T); log();
    cueChat_('Cue', (m.person || T.name) + ' (crew, ' + m.project + ') messaged on Messenger but has no mobile or email on file, so Cue could not send a code. '
      + 'Check who they are, then tap Link in the project\'s Communication Config or on the Freelancers page.', T.chat);   // CUE-MSGR-ONE-LINE
    return true;
  }
  if (m.status === 'locked') { T.m = 'locked'; cueMsgrTriSave_(psid, T); log(); return true; }
  if (T.m === 'unsure') { cueMsgrTriSave_(psid, T); log(); return true; }   // still not sure: already told once, stay quiet
  return false;   // not sure: the crewAck reply and main-chat line
}
/** Linked (right code, or already on their row): the approved reply, their Messenger People row and their crew chat. */
function cueMsgrCrewLinked_(psid, at, T, r, text) {
  cueMsgrSend_(psid, CUE_MSGR_SAY_.crewLinked(r.first || String(T.name || '').split(/\s+/)[0] || 'there'));
  const p = { psid, email: r.key || '', name: T.name, last: at, chat: T.chat };
  cueLocked_(() => { cueMsgrChatFor_(p); cueMsgrPersonSave_(p); });
  // BUGFIX-MSGR-LAST-2026-11-06: the code they just typed is their last message; Canvas needs it for the 24-hour window.
  if (p.email) try { cueBridge_({ id: 'msgr' }, 'fl_social_save', { request_id: 'msgrlast:' + psid + ':' + at.replace(/[^0-9A-Za-z]/g, ''), email: p.email, last_message: at }); }
  catch (e) { console.error('Messenger last-message save: ' + e); }
  const P = PropertiesService.getScriptProperties(); P.deleteProperty('MSGR_TRI_' + psid);
  cueChat_(T.name + ' · Messenger', text, p.chat);
  cueChat_('Cue', 'Linked on Messenger: ' + T.name + (r.project ? ' (crew, ' + r.project + ')' : '') + '.', p.chat);
  return true;
}
/* CREW-RESTORE-2026-11-06 (Kiko 6 Nov 2026 02:04Z, with screenshots of the King's Day crew Messenger lines: "these people messaged
 * this what i want you to rtestore"; 02:05Z "i cant find whjere to approve or link them"; 02:05Z picked "Add to Canvas list, you tap
 * Link: Cue sends each saved first message to Canvas. They appear under Freelancers and King's Day Communication Config with a Link
 * button. Nobody is messaged."). Once: everyone who wrote to the Page but never tapped "I'm crew" (or tapped and was never matched)
 * goes to Canvas's crew_wait with their first message, which lists them for Link and sends no code. Run from cueResume until every
 * call has gone through, then never again (CUE_CREW_RESTORE_DONE). Nothing is sent on Messenger. */
function cueMsgrCrewRestore_() {
  const P = PropertiesService.getScriptProperties();
  if (globalThis.CUE_CHECK_ON_ || P.getProperty('CUE_CREW_RESTORE_DONE') === '1') return null;
  const all = P.getProperties(), out = { listed: [], skipped: 0, failed: 0 };
  Object.keys(all).filter(k => /^MSGR_TRI_\d+$/.test(k)).sort().forEach(k => {
    const psid = k.slice(9); let T = null; try { T = JSON.parse(all[k]); } catch (e) { return; }
    if (!T || T.restored || !(T.st === 'asked' || (T.st === 'crew' && !T.m))) return;
    const text = cueStr_(T.details || T.first || '', 1000); if (!text) return;
    let r = null;
    try { r = cueBridge_({ id: 'msgr' }, 'crew_wait', { request_id: 'crewwait:' + psid, psid, messenger_name: cueStr_(T.name && T.name !== 'Messenger guest' ? T.name : '', 120), text }) || {}; }
    catch (e) { out.failed++; console.error('crew_wait ' + psid + ': ' + e); return; }
    T.restored = String(r.status || 'done'); cueMsgrTriSave_(psid, T);
    if (r.status === 'to_link' || r.status === 'no_match') out.listed.push(r.person || cueStr_(text.split('\n')[0], 40)); else out.skipped++;
  });
  if (!out.failed) P.setProperty('CUE_CREW_RESTORE_DONE', '1');
  if (out.listed.length) cueChat_('Cue', 'Put ' + out.listed.length + ' Messenger crew on Canvas\'s Link list (they wrote before tapping "I\'m crew"): '
    + out.listed.join(', ') + '. Link them on the Freelancers page or the project\'s Communication Config. Nobody was messaged.', '');
  return out;
}
/** People staff linked (Link) or turned down (Not mine) in Canvas, from msgr_due: told once, then msgr_told. */
// MSGR-TOLD-ONCE-2026-11-06 (Codex review of 1.28.30): a told person is remembered locally (CUE_MSGR_TOLD_<psid>:<status>) right after
// Meta accepts the message and Cue saves them, so a failed msgr_told is retried alone on the next tick: no second message, no second
// Messenger People row or chat. The note is dropped once Canvas records it.
function cueMsgrTell_(s, tell, now) {
  const P = PropertiesService.getScriptProperties();
  (tell || []).forEach(x => {
    if (!/^\d{1,40}$/.test(String(x.psid || ''))) return;
    const k = 'CUE_MSGR_TOLD_' + x.psid + ':' + x.status;
    let at = P.getProperty(k);
    if (!at) {
      const T = cueMsgrTri_(x.psid) || { name: '' }, linked = x.status === 'linked';
      const r = cueMsgrSend_(x.psid, linked ? CUE_MSGR_SAY_.crewLinked(x.first || String(T.name || '').split(/\s+/)[0] || 'there') : CUE_MSGR_SAY_.notLinked);
      if (!r.ok) { console.error('Messenger tell ' + x.psid + ': ' + r.error); return; }
      at = String(now); P.setProperty(k, at);
      /* BUGFIX-MSGR-LAST-2026-11-06: their last message is the one they sent (T.last), not this "you're linked" message from us.
       * Canvas gets it too, so their papers and payment notices see the right 24-hour window. */
      const tl = Date.parse(String(T.last || '')), inb = !isNaN(tl) && tl <= now ? String(T.last) : '';
      if (linked) { const p = { psid: x.psid, email: x.key || '', name: T.name || x.first, last: inb || new Date(now).toISOString(), chat: T.chat };
        cueLocked_(() => { cueMsgrChatFor_(p); cueMsgrPersonSave_(p); }); P.deleteProperty('MSGR_TRI_' + x.psid);
        if (inb && p.email) try { cueBridge_(s, 'fl_social_save', { request_id: 'msgrlast:' + x.psid + ':' + inb.replace(/[^0-9A-Za-z]/g, ''), email: p.email, last_message: inb }); }
        catch (e) { console.error('Messenger last-message save: ' + e); } }
      else if (T.chat) { T.m = 'locked'; cueMsgrTriSave_(x.psid, T); }
    }
    try { const m = cueBridge_(s, 'msgr_told', { request_id: 'msgrtold:' + x.psid + ':' + x.status + ':' + at, psid: String(x.psid), status: x.status });
      if (m && m.ok) P.deleteProperty(k); }
    catch (e) { console.error('msgr_told: ' + e); }
  });
}
/** Kiko's words in a Messenger chat: "done" closes it; anything else goes to the crew member on Messenger, inside the window (R10). */
function cueMsgrSaid_(c) {
  if (!c.ref || c.has || c.mode === 'intake') return null;
  const L = cueLoad_(c.ref); if (!L || L.s.kind !== 'msgr') return null;
  const t = String(c.text || '').trim(), M = L.s.msgr, p = cueMsgrPeople_()[M.psid] || cueMsgrTri_(M.psid) || { last: '' };
  cueChat_('Kiko', t, L.s.id);
  /* "start over" (Kiko 5 Nov 05:15Z, testing from his own account: "I didnt see those"): someone not linked as crew is made new
   * again (triage state and the Ask Cue mark dropped), so their next message gets the greeting and buttons as a first-timer. */
  if (/^start over[.!]?$/i.test(t) && !cueMsgrPeople_()[M.psid]) {
    const P = PropertiesService.getScriptProperties(); P.deleteProperty('MSGR_TRI_' + M.psid); P.deleteProperty('MSGR_TOLD_' + M.psid);
    const s = cueMsgrClose_(L.s.id);
    cueChat_('Cue', 'Started over. ' + M.name + '\'s next Messenger message gets the greeting and buttons as a new person.', L.s.id);
    return cueView_(s);
  }
  if (/^(done|close( it| this)?)[.!]?$/i.test(t)) {
    const s = cueMsgrClose_(L.s.id); cueChat_('Cue', 'Closed. A new message from ' + M.name + ' opens it again.', L.s.id); return cueView_(s);
  }
  if (!cueMsgrInWindow_(p.last, cueNow_())) {
    cueChat_('Cue', 'Messenger is closed for ' + M.name + ': their last message was over 24 hours ago, so Facebook will not deliver this. '
      + 'Reach them by SMS or email instead.', L.s.id);
    return cueView_(L.s);
  }
  const r = cueMsgrSend_(M.psid, t);
  const T = r.ok && cueMsgrTri_(M.psid); if (T && (T.acked || T.m === 'unsure')) { delete T.acked; if (T.m === 'unsure') delete T.m; cueMsgrTriSave_(M.psid, T); }   // the team answered: the next details get a reply again
  cueChat_('Cue', r.ok ? 'Sent on Messenger.' : 'Not sent: ' + r.error + '.', L.s.id);
  return cueView_(L.s);
}

/* ---------- collecting from the relay (Job Runs "Messenger inbox") ---------- */
/** Collects held events from the relay, handles them, then tells the relay which to drop. Returns how many were handled. */
/** CUE-MSGR-FAST-2026-11-05 (Kiko 5 Nov 04:30Z "5 minuites is not good"): the pull also runs from the 1-minute trigger
 * (cueRfpKick), so a reply goes out within about a minute. A short lease (CUE_MSGR_PULL_RUN) keeps the 1-minute and 5-minute
 * runs from collecting the same events twice. Returns how many were handled, or 0 while another run holds the lease. */
function cueMsgrPull_() {
  const P = PropertiesService.getScriptProperties(), l = LockService.getScriptLock(), now = cueNow_();
  if (!l.tryLock(5000)) return 0;
  try { if (Number(P.getProperty('CUE_MSGR_PULL_RUN') || 0) > now) return 0; P.setProperty('CUE_MSGR_PULL_RUN', String(now + 4 * 60 * 1000)); }
  finally { l.releaseLock(); }
  try { return cueMsgrPullOnce_(); } finally { P.deleteProperty('CUE_MSGR_PULL_RUN'); }
}
/** The 1-minute run (from cueRfpKick). Writes a Job Runs row only when it handled a message or failed, so quiet minutes leave none. */
function cueMsgrKick_() {
  if (globalThis.CUE_CHECK_ON_) return null;
  const started = new Date(cueNow_()).toISOString();
  let n = 0, err = '';
  try { n = cueMsgrPull_() || 0; } catch (e) { err = String((e && e.message) || e).split('\n')[0].slice(0, 300); console.error('Messenger inbox (1 min): ' + e); }
  if (n || err) { try { cueJobLog_([[started, new Date(cueNow_()).toISOString(), 'Messenger inbox', err ? 'Failed' : 'OK', err, n]]); } catch (e) { console.error('Job Runs: ' + e); } }
  return n;
}
/* CUE-MSGR-INSTANT-2026-11-05 (Kiko 5 Nov 11:53Z "right after I click I'm crew, automatically there's a response"; 12:00Z "Yes,
 * ship it"): the relay answers I'm crew and Client or inquiry taps itself, at once, so it keeps the Page token and the list of
 * linked crew (who get no triage reply). Cue sends both when either changes; only a hash of them is kept here. */
function cueMsgrRelaySync_(url, auth, P) {
  try {
    const token = P.getProperty('MSGR_PAGE_TOKEN') || '', linked = Object.keys(cueMsgrPeople_()).sort();
    const h = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token + '|' + linked.join(',')));
    if (P.getProperty('CUE_MSGR_RELAY_SYNC') === h) return;
    const r = UrlFetchApp.fetch(url + '/sync', { method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: auth,
      payload: JSON.stringify({ token, linked }) });
    if (r.getResponseCode() === 200) P.setProperty('CUE_MSGR_RELAY_SYNC', h);
  } catch (e) { console.error('Messenger relay sync: ' + e); }
}
function cueMsgrPullOnce_() {
  const P = PropertiesService.getScriptProperties(), url = String(P.getProperty('MSGR_RELAY_URL') || '').replace(/\/+$/, ''), key = P.getProperty('MSGR_RELAY_KEY');
  if (!/^https:\/\/[\w.-]+(\/[\w.-]*)*$/.test(url) || !key || !P.getProperty('MSGR_PAGE_TOKEN')) return 0;   // not set up yet
  if (P.getProperty('CUE_MSGR_PROFILE_V') !== CUE_MSGR_PROFILE_V_ && !(Number(P.getProperty('CUE_MSGR_PROFILE_TRY') || 0) > cueNow_() - 3600000)) { P.setProperty('CUE_MSGR_PROFILE_TRY', String(cueNow_())); try { cueMsgrProfileSet_(); } catch (e) { console.error('Messenger welcome screen: ' + e); } }
  const auth = { Authorization: 'Bearer ' + key };
  cueMsgrRelaySync_(url, auth, P);
  const res = UrlFetchApp.fetch(url + '/events', { muteHttpExceptions: true, headers: auth });
  if (res.getResponseCode() !== 200) throw new Error('Messenger relay answered ' + res.getResponseCode());
  const items = (JSON.parse(res.getContentText()).events || []).slice(0, 50), done = [];
  let handled = 0;
  items.forEach(it => {
    try { handled += cueMsgrEvent_(it.event).handled; done.push(it.id); } catch (e) { console.error('Messenger inbox ' + it.id + ': ' + e); }
  });
  if (done.length) UrlFetchApp.fetch(url + '/ack', { method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: auth,
    payload: JSON.stringify({ ids: done }) });
  return handled;
}

/* CUE-MSGR-WELCOME-2026-11-05 (Kiko 5 Nov 04:51Z "just by visiting the page you already get a message. Cant we do thst?",
 * 04:54Z "Why not the greeting is the triage?", 04:56Z "Yes" to welcome screen, menu and buttons that stay): the Page's Messenger
 * profile shows the approved greeting and the two triage options before anyone types (ice breakers), a Get Started button
 * (needed for the menu), and a menu by the typing box with the same two options. Set once per version, then on every change
 * of CUE_MSGR_PROFILE_V_. The app is also subscribed to postbacks, so taps reach the relay. */
const CUE_MSGR_PROFILE_V_ = '1';
function cueMsgrProfileBody_() {
  const B = CUE_MSGR_TRI_.buttons;
  return {
    greeting: [{ locale: 'default', text: CUE_MSGR_SAY_.greet.slice(0, 160) }],
    get_started: { payload: CUE_MSGR_TRI_.start },
    ice_breakers: [{ locale: 'default', call_to_actions: B.map(b => ({ question: b[0], payload: b[1] })) }],
    persistent_menu: [{ locale: 'default', composer_input_disabled: false, call_to_actions: B.map(b => ({ type: 'postback', title: b[0], payload: b[1] })) }]
  };
}
/** Sets the welcome screen and menu, and subscribes the app to messages, postbacks and referrals. Returns { ok, error }. */
function cueMsgrProfileSet_() {
  const P = PropertiesService.getScriptProperties(), token = P.getProperty('MSGR_PAGE_TOKEN');
  if (!token) return { ok: false, error: 'no MSGR_PAGE_TOKEN' };
  const call = (u, body) => {
    const r = UrlFetchApp.fetch(u, { method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + token }, payload: JSON.stringify(body) });
    if (r.getResponseCode() === 200) return '';
    let m = ''; try { m = (JSON.parse(r.getContentText()).error || {}).message || ''; } catch (e) { m = ''; }
    return 'Meta ' + r.getResponseCode() + (m ? ': ' + String(m).slice(0, 160) : '');
  };
  const e1 = call('https://graph.facebook.com/v21.0/me/subscribed_apps', { subscribed_fields: ['messages', 'messaging_postbacks', 'messaging_referrals'] });
  const e2 = call('https://graph.facebook.com/v21.0/me/messenger_profile', cueMsgrProfileBody_());
  const err = [e1 && 'subscribe: ' + e1, e2 && 'welcome screen: ' + e2].filter(Boolean).join('; ');
  if (!err) P.setProperty('CUE_MSGR_PROFILE_V', CUE_MSGR_PROFILE_V_);
  else if (P.getProperty('CUE_MSGR_PROFILE_ERR') !== CUE_MSGR_PROFILE_V_) {   // one Ask Cue line per version, not one per hourly retry
    P.setProperty('CUE_MSGR_PROFILE_ERR', CUE_MSGR_PROFILE_V_);
    cueChat_('Cue', 'Messenger welcome screen not set (' + err + '). Cue tries again every hour.', '');
  }
  return { ok: !err, error: err };
}

/* ---------- Settings › Connections › Messenger (owner only) ---------- */
function cueMsgrSettings_() {
  const P = PropertiesService.getScriptProperties();
  return { key: P.getProperty('MSGR_RELAY_KEY') || '', url: P.getProperty('MSGR_RELAY_URL') || '', token: !!P.getProperty('MSGR_PAGE_TOKEN') };
}
/** Makes or replaces the key the Messenger relay takes from Cue (MSGR_RELAY_KEY = the relay's CUE_KEY); the old key stops at once. */
function cueMsgrKey() {
  cueOwner_();
  PropertiesService.getScriptProperties().setProperty('MSGR_RELAY_KEY', 'mr_' + (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''));
  return cueSettings();
}
/* CUE-MSGR-CONNECT-2026-11-04 (Kiko 4 Nov 2026 02:31Z "If there's a way for you to do it instead, please do so"; card "Yes, build it"
 * 02:35Z): Connect Facebook replaces both pastes. Cue keeps a random proof and sends only its SHA-256 as the sign-in state; after
 * Kiko signs in to Facebook, the relay holds a new relay key and the Page token for 10 minutes, and Finish collects them with the proof. */
/** Starts Connect Facebook: returns the relay address to open in a new tab. Needs the relay address saved first. */
function cueMsgrConnect() {
  cueOwner_();
  const P = PropertiesService.getScriptProperties(), url = String(P.getProperty('MSGR_RELAY_URL') || '').replace(/\/+$/, '');
  if (!/^https:\/\/[\w.-]+\.[a-z]{2,}(\/[\w.-]*)*$/.test(url)) throw new Error('Save the relay address first.');
  const proof = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').toLowerCase();
  P.setProperty('MSGR_CONNECT_PROOF', proof);
  return { url: url + '/connect?state=' + cueMsgrSha_(proof) };
}
function cueMsgrSha_(t) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, t).map(b => ((b + 256) % 256).toString(16).padStart(2, '0')).join('');
}
/** Finishes Connect Facebook: collects the relay key and the Page token from the relay (once) and saves both. Neither is shown. */
function cueMsgrFinish() {
  cueOwner_();
  const P = PropertiesService.getScriptProperties(), url = String(P.getProperty('MSGR_RELAY_URL') || '').replace(/\/+$/, ''), proof = P.getProperty('MSGR_CONNECT_PROOF');
  if (!proof || !url) throw new Error('Press Connect Facebook first.');
  const res = UrlFetchApp.fetch(url + '/claim?proof=' + proof, { muteHttpExceptions: true });
  if (res.getResponseCode() === 404) throw new Error('Facebook sign-in is not finished yet (or took over 10 minutes). Finish it in the other tab, or press Connect Facebook again.');
  if (res.getResponseCode() !== 200) throw new Error('The relay answered ' + res.getResponseCode() + '.');
  const got = JSON.parse(res.getContentText());
  if (!/^mr_[0-9a-f]{64}$/.test(String(got.key || '')) || !/^[A-Za-z0-9_-]{60,}$/.test(String(got.token || ''))) throw new Error('The relay sent something unexpected. Nothing was saved.');
  P.setProperty('MSGR_RELAY_KEY', got.key);
  P.setProperty('MSGR_PAGE_TOKEN', got.token);
  P.deleteProperty('MSGR_CONNECT_PROOF');
  return cueSettings();
}
/** Saves the relay address (https://…workers.dev) and/or Facebook's Page token. The token is never shown again; an empty token is kept as it was. */
function cueMsgrSave(url, token) {
  cueOwner_();
  const P = PropertiesService.getScriptProperties(), u = String(url || '').trim().replace(/\/+$/, ''), t = String(token || '').trim();
  if (u && !/^https:\/\/[\w.-]+\.[a-z]{2,}(\/[\w.-]*)*$/.test(u)) throw new Error('Paste the relay address, like https://bse-messenger-relay.<you>.workers.dev');
  if (t && !/^[A-Za-z0-9_-]{60,}$/.test(t)) throw new Error('That does not look like a Page access token. Copy it again from the Meta app (Messenger API settings, Generate).');
  if (u) P.setProperty('MSGR_RELAY_URL', u);
  if (t) P.setProperty('MSGR_PAGE_TOKEN', t);
  return cueSettings();
}
