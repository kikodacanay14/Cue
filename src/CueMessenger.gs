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
function cueMsgrSend_(psid, text, buttons) {
  const token = PropertiesService.getScriptProperties().getProperty('MSGR_PAGE_TOKEN');
  if (!token) return { ok: false, error: 'no MSGR_PAGE_TOKEN' };
  const message = { text: String(text).slice(0, 2000) };
  if (buttons) message.quick_replies = buttons.map(b => ({ content_type: 'text', title: b[0], payload: b[1] }));
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
    const r = cueBridge_(s, 'msgr_mark', { request_id: 'msgr:' + d.doc + ':' + d.id, doc: d.doc, id: d.id, email: d.email, psid: String(d.messenger_id) }) || {};
    if (r.ok) P.deleteProperty('CUE_MSGR_SENT_' + k);
  } catch (e) { console.warn('Messenger mark ' + k + ': ' + e); }
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
  // A send Meta accepted is remembered here first, so a failed msgr_mark is retried on the next tick without a second message.
  const P = PropertiesService.getScriptProperties(), held = k => P.getProperty('CUE_MSGR_SENT_' + k);
  (o.docs || []).forEach(d => {
    const k = d.doc + ':' + d.id;
    if (d.sent) { if (held(k)) P.deleteProperty('CUE_MSGR_SENT_' + k); return; }
    if (held(k)) { cueMsgrMark_(s, d, k, P); return; }
    if (!d.messenger_id || !d.sign_link) { out.skipped.push({ id: d.id, why: 'not linked' }); return; }
    if (!cueMsgrInWindow_(d.last_message, now)) { out.skipped.push({ id: d.id, why: 'last message over 24 hours ago' }); return; }
    const r = cueMsgrSend_(d.messenger_id, cueMsgrText_(d));
    if (!r.ok) { out.failed.push({ id: d.id, why: r.error }); return; }
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
  crew: 'Welcome to the crew po. Para ma-link ka, open mo lang ang Messenger link sa email namin. Wala ka pang email from us? '
    + 'Reply ka lang dito with your full name and event, and our team will help you.'
};
const CUE_MSGR_TRI_ = { crew: 'TRI_CREW', client: 'TRI_CLIENT', buttons: [['I\'m crew', 'TRI_CREW'], ['Client or inquiry', 'TRI_CLIENT']] };

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
  if (!p) return cueMsgrTriage_(psid, at, text, String((msg.quick_reply || {}).payload || ''));
  p.last = at;
  cueBridge_(s, 'fl_social_save', { request_id: 'msgrlast:' + psid + ':' + at.replace(/[^0-9A-Za-z]/g, ''), email: p.email, last_message: at });
  cueLocked_(() => {
    cueMsgrChatFor_(p); cueMsgrPersonSave_(p);
    const L = cueLoad_(p.chat);
    if (L && L.s.status !== 'Needs you') { L.s.status = 'Needs you'; L.s.stage = 'Needs you'; L.s.card_at = cueNow_(); delete L.s.archived; cueSave_(L.sh, L.row, L.s); }
  });
  if (text) cueChat_(p.name + ' · Messenger', text, p.chat);
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
function cueMsgrTriage_(psid, at, text, tap) {
  let T = cueMsgrTri_(psid);
  if (tap === CUE_MSGR_TRI_.client || tap === CUE_MSGR_TRI_.crew) {
    const crew = tap === CUE_MSGR_TRI_.crew;
    T = T || { first: text };
    T.st = crew ? 'crew' : 'ask_help'; T.last = at;
    cueMsgrSend_(psid, crew ? CUE_MSGR_SAY_.crew : CUE_MSGR_SAY_.help);
    const chat = cueMsgrTriChat_(psid, T, crew ? 'Crew, not linked yet' : 'Client or inquiry');
    cueMsgrTriSave_(psid, T);
    cueChat_('Cue', T.name + ' tapped "' + (crew ? 'I\'m crew' : 'Client or inquiry') + '" on Messenger.'
      + (T.first && T.first !== text ? ' First message: "' + cueStr_(T.first, 200) + '"' : ''), chat);
    return true;
  }
  if (!T) {
    const r = cueMsgrSend_(psid, CUE_MSGR_SAY_.greet, CUE_MSGR_TRI_.buttons);
    if (!r.ok) {   // 5 Nov 04:29Z: a refused greeting saved nothing, so the next message tries again instead of going quiet
      cueChat_('Cue', 'Messenger: new message from someone not linked as crew' + (text ? ': "' + cueStr_(text, 200) + '"' : '')
        + '. The greeting was not sent (' + r.error + '); Cue tries again on their next message.', '');
      return true;
    }
    cueMsgrTriSave_(psid, { st: 'asked', first: text, last: at });
    cueChat_('Cue', 'Messenger: new message from someone not linked as crew' + (text ? ': "' + cueStr_(text, 200) + '"' : '')
      + '. Cue asked them to pick I\'m crew or Client or inquiry; if they pick, they get their own chat here.', '');
    return true;
  }
  T.last = at;
  if (!T.chat) { cueMsgrTriSave_(psid, T); return true; }   // no tap yet: stays in the Page inbox
  if (T.st === 'ask_help' && text) { cueMsgrSend_(psid, CUE_MSGR_SAY_.thanks); T.st = 'client'; }
  cueMsgrTriSave_(psid, T);
  cueMsgrTriChat_(psid, T, T.st === 'crew' ? 'Crew, not linked yet' : 'Client or inquiry');
  if (text) cueChat_(T.name + ' · Messenger', text, T.chat);
  return true;
}
/** Kiko's words in a Messenger chat: "done" closes it; anything else goes to the crew member on Messenger, inside the window (R10). */
function cueMsgrSaid_(c) {
  if (!c.ref || c.has || c.mode === 'intake') return null;
  const L = cueLoad_(c.ref); if (!L || L.s.kind !== 'msgr') return null;
  const t = String(c.text || '').trim(), M = L.s.msgr, p = cueMsgrPeople_()[M.psid] || cueMsgrTri_(M.psid) || { last: '' };
  cueChat_('Kiko', t, L.s.id);
  if (/^(done|close( it| this)?)[.!]?$/i.test(t)) {
    const s = cueMsgrClose_(L.s.id); cueChat_('Cue', 'Closed. A new message from ' + M.name + ' opens it again.', L.s.id); return cueView_(s);
  }
  if (!cueMsgrInWindow_(p.last, cueNow_())) {
    cueChat_('Cue', 'Messenger is closed for ' + M.name + ': their last message was over 24 hours ago, so Facebook will not deliver this. '
      + 'Reach them by SMS or email instead.', L.s.id);
    return cueView_(L.s);
  }
  const r = cueMsgrSend_(M.psid, t);
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
function cueMsgrPullOnce_() {
  const P = PropertiesService.getScriptProperties(), url = String(P.getProperty('MSGR_RELAY_URL') || '').replace(/\/+$/, ''), key = P.getProperty('MSGR_RELAY_KEY');
  if (!/^https:\/\/[\w.-]+(\/[\w.-]*)*$/.test(url) || !key || !P.getProperty('MSGR_PAGE_TOKEN')) return 0;   // not set up yet
  const auth = { Authorization: 'Bearer ' + key };
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
