/* CUE-2026-10-21. RFQ chasers: chasing sweep task 2 (spec: specs/rfq-chasers.md, Kiko approved 07:49Z). Loads after CueSweep.gs.
 * Every morning batch lists the suppliers who got an RFQ from Kiko and have not replied, as a nudge in the original thread.
 * - Who does what: code finds and checks (Kiko's sent Gmail, read only), Canvas gives project status and event date (the engine's
 *   one get_project_board read, only when a thread is linked to a Canvas project), ChatGPT drafts the nudges inside the engine's one
 *   combined call (template if it fails), Kiko approves, code sends. Claude is not used. No AI call of its own.
 * - RFQs go out from Kiko's own Gmail only, never info@ (Kiko 07:45Z), so every RFQ is visible here.
 * - Chase when: Kiko's message is the last one in the thread, to an outside address; nobody outside BSE answered (in the thread, or
 *   a new email from that address since); the wait in Kiko's Chaser rules card has passed (default 3 working days, then every 3;
 *   1 and 1 when the event is within 7 days); no draft already waiting in the thread; project not lost, cancelled or past;
 *   address not in CUE_RFQ_NEVER. The engine stops at the rule's max (default 2) and hands the supplier to Kiko. */

const CUE_RFQ_ = { lookbackDays: 30, maxThreads: 60, soonDays: 7 };
// Used only when the Chaser rules card has no rfq rule (Kiko approved 3 / 3 / max 2 working days; event within 7 days: 1 and 1).
const CUE_RFQ_RULE_ = { on: true, first: 3, every: 3, max: 2, unit: 'working', soon_first: 1, soon_every: 1 };
const CUE_RFQ_Q_ = '(RFQ OR RFQs OR requote OR "request for quotation" OR "request for quote")';
// Bug fix 27 Oct: BSE's own applications to become a client's supplier (accreditation, vendor registration) mention "RFQ" in the
// body, so the search found them and they were chased as RFQs. They are left out of the search and, by their first subject, here.
const CUE_RFQ_NOT_Q_ = ' -subject:accreditation -subject:"vendor registration" -subject:"supplier registration"';
function cueRfqNotRfq_(subj) { return /accredit|\b(vendor|supplier)\s+(registration|enroll?ment|onboarding)\b|procurement process/i.test(String(subj || '')); }
const CUE_PUBLIC_MAIL_ = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com'];

/** Mon to Fri days after day `from` up to and including `to` (both YYYY-MM-DD, PH dates). */
function cueWorkDays_(from, to) {
  let n = 0;
  for (let d = cueAddDays_(from, 1); d <= to && n < 400; d = cueAddDays_(d, 1)) { const w = new Date(d + 'T00:00:00Z').getUTCDay(); if (w > 0 && w < 6) n++; }
  return n;
}
/** A Canvas event date as a PH date: 'YYYY-MM-DD', 'M/D/YYYY', or a sheet date serialised as an ISO moment. '' when unknown. */
function cueRfqDay_(v) {
  const t = String(v || '').trim();
  let m = /^(\d{4}-\d{2}-\d{2})$/.exec(t);
  if (m) return m[1];
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (m) return m[3] + '-' + m[1].padStart(2, '0') + '-' + m[2].padStart(2, '0');
  const ms = Date.parse(t);
  return isFinite(ms) && /^\d{4}-\d{2}-\d{2}T/.test(t) ? cuePh_(ms).day : '';
}
const cueRfqAddr_ = h => String(h || '').split(',').map(a => cueEmail_((a.match(/<([^>]+)>/) || [0, a])[1].trim()).toLowerCase()).filter(String);
const cueRfqName_ = h => { const m = /^\s*"?([^"<,]+?)"?\s*</.exec(String(h || '')); return m ? m[1].trim() : ''; };
const cueRfqTopic_ = s => String(s || '').replace(/^\s*((re|fwd?|fw)\s*:\s*)+/i, '').replace(/^\s*RFQs?\s*[:\-–]?\s*/i, '').trim();

/** Threads, Canvas project ids and supplier names from Cue's own runs: intake RFQs it sent, and requotes in their RFQ threads. */
function cueRfqKnown_() {
  const byMsg = {}, byThread = {};
  cueRecent_(CUE_RFQ_.lookbackDays).forEach(x => {
    if (x.kind === 'change' && x.change) {
      const pid = (x.change.match && x.change.match.project_id) || '', name = (x.change.match && x.change.match.name) || x.change.project || '';
      (x.change.found || []).forEach(f => { if (f.thread_id) byThread[f.thread_id] = { pid, project: name }; });
    } else if (x.canvas && x.canvas.project_id) {
      const name = (x.read && x.read.event && x.read.event.name) || '';
      (x.drafts || []).forEach(d => { if (d.sent_id) byMsg[d.sent_id] = { pid: x.canvas.project_id, project: name, supplier: d.supplier || '' }; });
    }
  });
  return { byMsg, byThread };
}

/** find(ctx) for the rfq kind. Gmail reads only; nothing is drafted, sent or written here. */
function cueRfqFind_(ctx) {
  const rule = Object.assign({}, CUE_RFQ_RULE_, ctx.rule ? ctx.rule('rfq') : {});
  if (rule.on === false) return [];
  const me = cueMe_().toLowerCase(), own = me.split('@')[1] || '';
  const isUs = a => a === me || (!!own && CUE_PUBLIC_MAIL_.indexOf(own) < 0 && a.split('@')[1] === own);
  const never = cueProp_('CUE_RFQ_NEVER', '').toLowerCase().split(',').map(x => x.trim()).filter(String);
  const blocked = a => never.some(n => a === n || a.split('@')[1] === n.replace(/^@/, ''));
  const auth = { muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } };
  const many = urls => (urls.length ? UrlFetchApp.fetchAll(urls.map(url => Object.assign({ url }, auth))) : [])
    .map(r => (r.getResponseCode() === 200 ? JSON.parse(r.getContentText() || '{}') : null));
  // 1. Candidate threads: Kiko's sent RFQs (search), plus every RFQ Cue sent itself, whatever its subject.
  const known = cueRfqKnown_(), threads = {};
  (cueGmail_('/messages?maxResults=100&q=' + encodeURIComponent('in:sent newer_than:' + CUE_RFQ_.lookbackDays + 'd ' + CUE_RFQ_Q_ + CUE_RFQ_NOT_Q_)).messages || [])
    .forEach(m => { threads[m.threadId] = 1; });
  const ours = Object.keys(known.byMsg);
  many(ours.map(id => CUE_GMAIL_ + '/messages/' + encodeURIComponent(id) + '?format=minimal')).forEach(m => { if (m && m.threadId) threads[m.threadId] = 1; });
  Object.keys(known.byThread).forEach(t => { threads[t] = 1; });
  const ids = Object.keys(threads).filter(t => /^[0-9a-f]{8,24}$/i.test(t)).slice(0, CUE_RFQ_.maxThreads);
  // 2. Read each thread's headers and keep the ones where Kiko is still waiting.
  const hdr = ['From', 'To', 'Subject', 'Message-ID'].map(h => '&metadataHeaders=' + h).join('');
  const waiting = [];
  many(ids.map(t => CUE_GMAIL_ + '/threads/' + t + '?format=metadata' + hdr)).forEach((th, i) => {
    if (!th || !th.messages || !th.messages.length) return;
    const msgs = th.messages.map(m => { const h = {}; ((m.payload && m.payload.headers) || []).forEach(x => { h[String(x.name).toLowerCase()] = String(x.value || ''); });
      return { id: m.id, ms: Number(m.internalDate) || 0, draft: (m.labelIds || []).indexOf('DRAFT') >= 0, h, from: cueRfqAddr_(h.from)[0] || '', snippet: cueStr_(m.snippet, 300) }; })
      .sort((a, b) => a.ms - b.ms);
    if (msgs.some(m => m.draft)) return;                          // a nudge or reply is already waiting in Drafts
    if (cueRfqNotRfq_(msgs[0].h.subject)) return;                 // BSE's own supplier application, not an RFQ
    const last = msgs[msgs.length - 1];
    if (!isUs(last.from)) return;                                 // the supplier (or someone else) spoke last
    const to = cueRfqAddr_(last.h.to).filter(a => !isUs(a));
    if (!to.length || blocked(to[0])) return;
    const k = msgs.map(m => known.byMsg[m.id]).filter(Boolean)[0] || known.byThread[ids[i]] || {};
    const first = msgs.filter(m => isUs(m.from))[0] || last;
    waiting.push({ thread_id: ids[i], to: to[0], who: cueRfqName_(last.h.to) || k.supplier || to[0], subject: msgs[0].h.subject || last.h.subject || '',
      message_id: cueStr_(last.h['message-id'], 300), last_ms: last.ms, rfq_day: cuePh_(first.ms).day, snippet: first.snippet, pid: k.pid || '', project: k.project || '' });
  });
  if (!waiting.length) return [];
  // 3. Canvas (one read, through the engine): lost, cancelled or past projects are dropped; an event within 7 days is chased sooner.
  let board = {};
  if (waiting.some(w => w.pid)) {
    try { (ctx.board().projects || []).forEach(p => { board[String(p.id)] = p; }); }
    catch (e) { ctx.s.notes.push('RFQ chasers: Canvas did not answer, so project status and event dates were not checked.'); board = {}; }
  }
  const log = cueChaseLog_(), out = [];
  const count = (a, b) => (rule.unit === 'days' ? Math.round((Date.parse(b) - Date.parse(a)) / 864e5) : cueWorkDays_(a, b));
  waiting.forEach(w => {
    const p = board[w.pid] || null, event = p ? cueRfqDay_(p.date || p.eventDate || p['event date']) : '';
    if (p && /lost|cancel|not awarded|dropped|void/i.test(String(p.status || '') + ' ' + String(p.adminStatus || ''))) return;
    if (event && event < ctx.today) return;
    const soon = !!event && event <= cueAddDays_(ctx.today, CUE_RFQ_.soonDays);
    // Timing from Kiko's Chaser rules card: first chase after rule.first, then rule.every (event soon: soon_first, soon_every).
    // After Cue's own nudge the engine also holds the line until its Next due; a follow-up Kiko wrote by hand restarts the wait.
    const L = log['rfq:' + w.thread_id], lastDay = cuePh_(w.last_ms).day, nudged = !!(L && L.times && L.last >= lastDay), since = nudged ? L.last : lastDay;
    const wait = soon ? (nudged ? rule.soon_every : rule.soon_first) : (L && L.times ? rule.every : rule.first);
    const gone = count(since, ctx.today);
    if (gone < Math.max(1, Number(wait) || 1)) return;
    out.push({ key: 'rfq:' + w.thread_id, project: (p && p.name) || w.project || cueRfqTopic_(w.subject) || 'your RFQ', project_id: w.pid, who: w.who, to: w.to,
      thread_id: w.thread_id, message_id: w.message_id, thread_subject: w.subject, due_since: since, priority: soon ? 'urgent' : 'normal', after_ms: w.last_ms,
      every: soon ? Math.max(1, Math.min(60, Math.round(Number(rule.soon_every) || 1))) : undefined,   // the engine's Next due uses it (event soon)
      why: 'No reply ' + gone + (rule.unit === 'days' ? ' day' : ' working day') + (gone === 1 ? '' : 's') + ' after your ' + (nudged ? 'last nudge' : 'RFQ') + (soon ? '; event on ' + event : ''),
      facts: { rfq_subject: cueStr_(w.subject, 200), rfq_sent: w.rfq_day, rfq_snippet: w.snippet, event_date: event, reply_by: cueRfqBy_(ctx.today) } });
  });
  // 4. A supplier who answered with a new email (not in the thread) since Kiko's last message is not chased.
  const replied = many(out.map(it => CUE_GMAIL_ + '/messages?maxResults=1&q=' + encodeURIComponent('from:' + it.to + ' after:' + Math.floor(it.after_ms / 1000))));
  return out.filter((it, i) => !(replied[i] && (replied[i].messages || []).length)).map(it => { delete it.after_ms; return it; });
}
/** Two working days after today, written out for the email ("Friday 23 October"). */
function cueRfqBy_(today) {
  let d = today, n = 0;
  while (n < 2) { d = cueAddDays_(d, 1); const w = new Date(d + 'T00:00:00Z').getUTCDay(); if (w > 0 && w < 6) n++; }
  const dt = new Date(d + 'T00:00:00Z');
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dt.getUTCDay()] + ' ' + dt.getUTCDate() + ' '
    + ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][dt.getUTCMonth()];
}

cueKind_({ kind: 'rfq', label: 'RFQ chasers', every: 3, max: 2, unit: 'working', sendAllowed: true,
  draftBrief: 'A supplier has not answered Kiko\'s request for quotation (RFQ). Write 2 to 3 short lines as a reply in the RFQ thread: '
    + 'a friendly nudge that names the item or project from rfq_subject, asks for the quotation by reply_by, and offers to clarify '
    + 'anything. No attachments, no prices, no other suppliers. If the event is soon, say the date is close.',
  template: it => ({ subject: 'Re: ' + (it.thread_subject || 'RFQ'),
    body: 'Hi ' + (it.who && it.who !== it.to ? it.who : 'there') + ',\n\nJust following up on our RFQ for ' + it.project
      + (it.facts && it.facts.rfq_sent ? ', sent on ' + it.facts.rfq_sent : '') + '. Could you send your quotation by '
      + ((it.facts && it.facts.reply_by) || 'the end of the week') + '? Happy to clarify anything.\n\nThank you,\nKiko\nBlank Space Events' }),
  find: cueRfqFind_ });
