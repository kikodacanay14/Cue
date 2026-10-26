/* CUE-REPLY-DRAFTS-2026-10-26 (Kiko 04:49Z "if its an Emails waiting... shouldnt there be a draft already that we need to review
 * and send?"; 05:58Z "Draft every waiting email"; 06:00Z "can we see the draft here and send from here"; 06:04Z "just me";
 * 06:09Z "Yes, Cue drafts them"). Spec: canvas-integration/specs/email-reply-drafts.md. Cue 1.27.32.
 * Every 30 minutes, Mon to Sat 8 AM to 6 PM Manila, Cue asks Canvas (bridge read mail_waiting) for Kiko's client and supplier
 * emails still waiting. Each email waiting 4 working hours or more, with no draft yet in its Gmail thread, gets one "Draft an
 * email" reply request (CueMail.gs): code reads the thread in Kiko's Gmail, then one GPT call drafts the reply in Kiko's style.
 * The card in Ask Cue is the usual one: Kiko edits, then Approve and send (one confirm) or Save to Gmail drafts. Nothing is sent
 * or saved before Kiko taps. At most 30 a day and 4 per run. Setting "Reply drafts" (CUE_REPLY_DRAFTS), default off.
 * No new Google access: Cue already has gmail.readonly and gmail.compose. Emails are untrusted data, as in CueMail.gs. */

const CUE_RD_ = { every_min: 30, wait_h: 4, cap: 30, per_run: 4, start_h: 8, end_h: 18, keep_days: 7 };
const CUE_RD_ABOUT_ = 'Reply to the newest message in this thread for Kiko. Answer what they asked only where the thread gives the facts. '
  + 'Never promise or state a price, a date, a payment or bank details: say Kiko will confirm, and write [like this] for anything Kiko must fill.';

function cueRdOn_() { return cueProp_('CUE_REPLY_DRAFTS', 'off') === 'on'; }

/** Settings: Kiko turns reply drafts on or off. */
function cueRdSet(on) {
  cueOwner_();
  PropertiesService.getScriptProperties().setProperty('CUE_REPLY_DRAFTS', on ? 'on' : 'off');
  return cueSettings();
}

/** Working hours between two times: Mon to Sat, 8 AM to 6 PM Manila, in 15-minute steps (Canvas's cmcWorkHours_ rule). */
function cueRdWorkHours_(from, to) {
  let h = 0; const step = 15 * 60e3;
  for (let t = from; t < to && h < 200; t += step) {
    const d = new Date(t + 8 * 3600e3), wd = d.getUTCDay(), hr = d.getUTCHours();
    if (wd !== 0 && hr >= CUE_RD_.start_h && hr < CUE_RD_.end_h) h += 0.25;
  }
  return h;
}

function cueRdState_() {
  let st = null; try { st = JSON.parse(cueProp_('CUE_RD_STATE', '{}')); } catch (e) { st = null; }
  st = st && typeof st === 'object' ? st : {};
  return { day: String(st.day || ''), count: Number(st.count) || 0, done: st.done && typeof st.done === 'object' ? st.done : {} };
}
function cueRdStateSave_(st) {
  const cut = cueNow_() - CUE_RD_.keep_days * 864e5;
  Object.keys(st.done).forEach(k => { if (!(Number(st.done[k].on) > cut)) delete st.done[k]; });
  PropertiesService.getScriptProperties().setProperty('CUE_RD_STATE', JSON.stringify(st));
}

/** Called by cueResume (every 5 minutes); does its work at most every 30 minutes, in working hours, with the setting on.
 * Returns the request ids it started. */
function cueRdTick_() {
  if (!cueRdOn_()) return [];
  const now = cueNow_(), d = new Date(now + 8 * 3600e3), wd = d.getUTCDay(), hr = d.getUTCHours();
  if (wd === 0 || hr < CUE_RD_.start_h || hr >= CUE_RD_.end_h) return [];
  if (now - Number(cueProp_('CUE_RD_LAST', '0')) < CUE_RD_.every_min * 60e3) return [];
  PropertiesService.getScriptProperties().setProperty('CUE_RD_LAST', String(now));
  const day = Utilities.formatDate(new Date(now), 'Asia/Manila', 'yyyy-MM-dd'), st = cueRdState_();
  if (st.day !== day) { st.day = day; st.count = 0; }
  if (st.count >= CUE_RD_.cap) return [];
  const r = cueBridge_({ id: 'cue-rd-' + now.toString(36) }, 'mail_waiting', {}) || {};
  const due = (r.items || []).filter(i => /^[0-9a-f]{8,24}$/.test(String(i.id || '')) && Number(i.at) > 0
      && cueRdWorkHours_(Number(i.at), now) >= CUE_RD_.wait_h && !(st.done[i.id] && Number(st.done[i.id].at) >= Number(i.at)))
    .sort((a, b) => Number(a.at) - Number(b.at));
  const started = [];
  for (let k = 0; k < due.length && started.length < CUE_RD_.per_run && st.count < CUE_RD_.cap; k++) {
    const i = due[k];
    let T = null; try { T = cueRdThread_(i.id); } catch (e) { console.warn('Reply drafts: thread ' + i.id + ': ' + e); continue; }
    st.done[i.id] = { at: Number(i.at), on: now };   // looked at: one draft per newest message, never a second for the same one
    if (!T || T.has_draft || !T.inbound) continue;   // Kiko already started a reply, or the newest message is Kiko's
    started.push(cueRdStart_(i, T)); st.count++;
  }
  cueRdStateSave_(st);
  return started;
}

/** Kiko's Gmail thread, read only: the newest message that is not a draft, and whether the thread already holds a draft. */
function cueRdThread_(threadId) {
  const t = cueGmail_('/threads/' + threadId + '?format=full'), msgs = (t && t.messages) || [];
  const has_draft = msgs.some(m => (m.labelIds || []).indexOf('DRAFT') >= 0);
  const real = msgs.filter(m => (m.labelIds || []).indexOf('DRAFT') < 0).sort((a, b) => Number(a.internalDate) - Number(b.internalDate));
  const m = real[real.length - 1]; if (!m) return null;
  const h = {}; ((m.payload && m.payload.headers) || []).forEach(x => { h[String(x.name).toLowerCase()] = String(x.value || ''); });
  const from = cueEmail_((String(h.from || '').match(/<([^>]+)>/) || [0, h.from || ''])[1].trim()).toLowerCase();
  const sent = (m.labelIds || []).indexOf('SENT') >= 0 || (from && from === cueMe_().toLowerCase());
  let last = ''; try { last = cueStyleClean_(cueStyleBody_(m.payload)).slice(0, 2000); } catch (e) { last = ''; }
  return { thread_id: threadId, message_id: cueStr_(h['message-id'], 300), from, subject: cueStr_(h.subject, 300), has_draft, inbound: !sent,
    date: new Date(Number(m.internalDate) || 0).toISOString().slice(0, 10), last: last || cueStr_(m.snippet, 300) };
}

/** One reply request, straight to "GPT drafting"; cueResume runs it like any "Draft an email" request. */
function cueRdStart_(i, T) {
  const now = cueNow_(), d = new Date(now);
  const id = 'cue-' + Utilities.formatDate(d, 'Asia/Manila', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 65536).toString(16).padStart(4, '0');
  const who = cueStr_(i.name || i.from || i.email, 200).trim(), addr = cueEmail_(i.email || T.from) || T.from;
  const M = { job: 'reply', auto: true, to: who, to_addr: addr, about: CUE_RD_ABOUT_, audience: CUE_MAIL_AUD_.indexOf(i.who) >= 0 ? i.who : 'other',
    project: cueStr_(i.project, 200).trim(), canvas: i.pid ? cueStr_('Canvas project ' + i.pid + (i.project ? ' "' + i.project + '"' : ''), 300) : '',
    thread: { thread_id: T.thread_id, message_id: T.message_id, to: addr, subject: T.subject || cueStr_(i.subject, 300), date: T.date, inbound: true, last: T.last } };
  const s = { id, version: CUE_VERSION_, kind: 'email', created: d.toISOString(), started: now,
    text: 'Reply draft for ' + (who || addr) + '\'s email "' + M.thread.subject + '" (waiting since ' + T.date + ')', files: [], status: 'Working',
    stage: 'GPT drafting', ref: '', mail: M, metrics: { ai_calls: 0, calls: [] }, notes: [] };
  cueLocked_(() => { const sh = cueSheet_('Requests'); sh.appendRow([id]); cueSave_(sh, sh.getLastRow(), s); });
  cueChat_('Cue', 'Drafting a reply to ' + (who || addr) + '\'s email "' + M.thread.subject + '". It has waited 4 working hours or more. Nothing is sent before you tap.', id);
  return id;
}
