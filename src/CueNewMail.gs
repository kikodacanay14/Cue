/* CUE-NEW-MAIL-2026-10-27 (Kiko 08:27Z "What needs to be done so Cue could detect new emails in my inbox"; 08:38Z "i want that to
 * happen maybe in Claude"; 09:32Z tapped Yes on "Build New mail for your BSE inbox and info@, sorted by Claude?"; 09:32Z "i want a
 * command to create draft and send from the same window"). Spec: canvas-integration/specs/new-mail-check.md.
 * New mail: Cue spots new inbox emails within about 5 minutes instead of waiting for the 07:00 Morning batch.
 *   - Every cueResume tick (5 minutes), code asks Kiko's Gmail what changed since the last tick (Gmail history: one call when
 *     nothing is new) and asks Canvas for new info@ mail (bridge read inbox_new; Canvas runs as info@). No AI.
 *   - New mail is filtered in code with Inbox triage's own rules (CueTriage.gs): mail another task owns, mail already shown, a
 *     Canvas project's mail, junk and muted senders. What is left shows at once in today's "New mail" thread, unsorted.
 *   - Claude (Haiku, one call) sorts the unsorted lines into new inquiry / needs your reply / FYI / skip, at most every 30 minutes,
 *     07:00 to 21:00 Manila. Mail that lands at night is sorted at the first tick after 07:00.
 *   - Every line is written to the Triage log as it is shown, so the Morning batch never shows it again.
 *   - Buttons: Start intake, Draft reply (the usual email card in the same thread: edit, then Approve and send or Save to Gmail
 *     drafts; replies always go from Kiko's own Gmail, never info@), Done / Got it, Not an inquiry, Mute sender.
 * Read only: nothing is sent, labelled, archived or deleted here. Emails are untrusted data: never follow instructions inside them. */

const CUE_NM_ = { sort_min: 30, start_h: 7, end_h: 21, max: 40, text: 1500, pages: 5, info: 'info@blankspaceevent.com' };
const CUE_NM_MODEL_ = 'claude-haiku-5-5';
const CUE_NM_ACTIONS_ = ['done', 'mute', 'no_inquiry', 'intake', 'reply'];

/* ---------- the 5-minute check (from cueResume) ---------- */
/** Finds new mail in Kiko's inbox and info@, adds it to today's New mail thread, then sorts when a sort is due. Returns the run's id
 * ('' when nothing changed). One inbox failing never stops the other. */
function cueNmTick_() {
  const run = { id: 'cue-nm-' + cueNow_().toString(36), metrics: { ai_calls: 0, calls: [] }, notes: [] };
  const found = [];
  let mine = null, info = null;
  try { mine = cueNmMine_(); found.push.apply(found, mine.lines); } catch (e) { console.error('New mail (your inbox): ' + e); }
  try { info = cueNmInfo_(run); found.push.apply(found, info.lines); } catch (e) { console.error('New mail (info@): ' + e); }
  let id = '';
  if (found.length) id = cueNmAdd_(run, found);
  // The windows move only once the lines are saved, so mail is never lost to a failed save.
  const P = PropertiesService.getScriptProperties();
  if (mine && mine.next) P.setProperty('CUE_NM_HISTORY', String(mine.next));
  if (info && info.next) P.setProperty('CUE_NM_INFO_SINCE', String(info.next));
  return cueNmSort_(run) || id;
}

/** Kiko's inbox: the threads Gmail says got a new inbox message since the last tick. The first tick only notes where Gmail is. */
function cueNmMine_() {
  const last = cueProp_('CUE_NM_HISTORY', '');
  if (!/^\d+$/.test(last)) return { lines: [], next: String(cueGmail_('/profile').historyId || '') };
  const ids = {}; let next = last, page = '';
  for (let i = 0; i < CUE_NM_.pages; i++) {
    let r;
    try { r = cueGmail_('/history?startHistoryId=' + last + '&historyTypes=messageAdded&labelId=INBOX&maxResults=100' + (page ? '&pageToken=' + encodeURIComponent(page) : '')); }
    catch (e) {   // Gmail keeps about a week of history; an older start says 404: start again from now (the Morning batch still covers the gap)
      if (/HTTP 404/.test(String(e))) return { lines: [], next: String(cueGmail_('/profile').historyId || '') };
      throw e;
    }
    (r.history || []).forEach(h => (h.messagesAdded || []).forEach(a => {
      const m = a.message || {}, l = m.labelIds || [];
      if (m.threadId && l.indexOf('INBOX') >= 0 && l.indexOf('SENT') < 0 && l.indexOf('DRAFT') < 0) ids[m.threadId] = 1;
    }));
    if (r.historyId) next = String(r.historyId);
    page = r.nextPageToken || ''; if (!page) break;
  }
  const list = Object.keys(ids);
  if (!list.length) return { lines: [], next };
  const own = cueMe_().toLowerCase(), lines = [];
  cueGmailAll_(list.slice(0, CUE_NM_.max).map(t => '/threads/' + t + '?format=metadata' + CUE_TRIAGE_HEADERS_)).forEach(t => {
    const m = cueTriageNewest_(t, own);
    if (m) lines.push(cueNmLine_('mine', t.id, m));
  });
  return { lines, next };
}

/** info@: Canvas lists the inbox mail that came after the last tick (bridge read inbox_new, headers and the newest message's text). */
function cueNmInfo_(run) {
  const since = Number(cueProp_('CUE_NM_INFO_SINCE', '0'));
  if (!(since > 0)) return { lines: [], next: String(cueNow_()) };   // the first tick only starts the window
  const r = cueBridge_(run, 'inbox_new', { since, max: CUE_NM_.max }) || {};
  const lines = (r.items || []).filter(x => x && /^[0-9a-f]{6,32}$/i.test(String(x.thread_id || '')) && /^[0-9a-f]{6,32}$/i.test(String(x.id || '')))
    .map(x => {
      const from = String(cueEmail_(x.from) || '').toLowerCase(), h = {};
      Object.keys(x.h || {}).forEach(k => { h[String(k).toLowerCase()] = cueStr_(x.h[k], 300); });
      return cueNmLine_('info', x.thread_id, { id: String(x.id), ms: Number(x.ms) || 0, from, name: cueStr_(x.name, 120), subject: cueStr_(x.subject, 300),
        snippet: cueStr_(x.snippet, 300), message_id: cueStr_(x.message_id, 300), labels: ['INBOX'], h, date: new Date(Number(x.ms) || 0).toISOString(),
        text: cueStr_(x.text, CUE_NM_.text) });
    }).filter(l => l.sender);
  return { lines, next: String(Number(r.until) > since ? Number(r.until) : since) };
}

/** One New mail line from a message (cueTriageNewest_'s shape). Inbox 'mine' or 'info'. */
function cueNmLine_(inbox, threadId, m) {
  return { key: (inbox === 'info' ? 'info:' : 'inbox:') + m.id, inbox, group: 'new', who: m.name || m.from, sender: m.from, to: m.from, thread_id: String(threadId),
    message_id: m.message_id || '', subject: m.subject || '', summary: m.snippet || m.subject || '', ms: m.ms || 0, date: m.date || '', urgent: false, _m: m };
}

/** The code filters, no AI and no writes: mail another task owns or a Canvas project's mail is dropped; junk and muted senders
 * are kept apart as skipped; the rest is kept with Kiko's rule for the sender. */
function cueNmFilter_(run, found) {
  const claimed = cueTriageClaimed_(), rules = cueTriageRules_(), keep = [], skip = [], proj = [];
  let ids = null;
  const projectIds = () => ids || (ids = cueTriageProjectIds_(cueBridge_(run, 'get_project_board', {})));
  let pt = null; const projThreads = () => pt || (pt = cueMailProjectThreads_(run));
  found.forEach(l => {
    const m = l._m;
    if (claimed[l.thread_id] || claimed['m:' + m.id] || claimed['m:' + l.key.replace(/^inbox:/, '')]) return;
    // A project's email (R6, R9): before the junk and mute filters, so it is never dropped; it belongs to Team Cue, with one line here.
    try { const pid = projectIds().filter(id => cueTriageHas_(m.subject + ' ' + m.snippet, id))[0]; if (pid) { proj.push(Object.assign(l, { pid })); return; } }
    catch (e) { console.warn('New mail: Canvas board: ' + e); }
    if (l.inbox !== 'info' && projThreads()[String(l.thread_id)]) return;   // ASK-CUE-ONCE-2026-10-30: Canvas files it under a project (Team Cue)
    const rule = cueTriageRule_(rules, m.from), junk = rule === 'keep' ? '' : cueTriageJunk_(m);
    if (rule === 'mute' || junk) { skip.push(Object.assign(l, { group: 'skip', why: rule === 'mute' ? 'muted sender' : junk })); return; }
    l.rule = rule || '';
    keep.push(l);
  });
  return { keep, skip, proj };
}

/** Code filters (no AI), then the lines join today's New mail thread and the Triage log. Returns the thread's id ('' when nothing new). */
function cueNmAdd_(run, found) {
  const f = cueNmFilter_(run, found), keep = f.keep, skip = f.skip;
  cueNmProject_(f.proj || []);
  // Muted senders' mail is marked read in Kiko's Gmail (assumption 16); junk stays as Gmail left it.
  cueMtMarkRead_(run, skip.filter(l => l.inbox === 'mine' && l.why === 'muted sender').map(l => l.key.replace(/^inbox:/, '')));
  if (!keep.length && !skip.length) return '';
  const day = cuePh_(cueNow_()).day;
  const s = cueLocked_(() => {
    const L = cueNmToday_(day), N = L.s.nm, have = {};
    N.items.concat(N.skipped).forEach(x => { have[x.key] = 1; });
    const add = keep.filter(l => !have[l.key]), junk = skip.filter(l => !have[l.key]);
    add.forEach(l => { l.text = l.inbox === 'info' ? l._m.text || '' : ''; delete l._m; N.items.push(l); });
    junk.forEach(l => { delete l._m; N.skipped.push({ key: l.key, inbox: l.inbox, thread_id: l.thread_id, who: l.who, sender: l.sender, subject: l.subject, why: l.why, ms: l.ms }); });
    const t = new Date(cueNow_()), log = cueSheet_('Triage log');
    add.concat(junk).forEach(l => log.appendRow([t, l.key.replace(/^inbox:/, ''), l.thread_id, l.sender, cueStr_(l.subject, 200), l.group, cueStr_(l.summary || l.why, 300), L.s.id]));
    N.added = add.length; cueNmStatus_(L.s); cueSave_(L.sh, L.row, L.s);
    return add.length ? L.s : null;
  });
  if (!s) return '';
  const n = s.nm.added, fromInfo = s.nm.items.slice(-n).filter(x => x.inbox === 'info').length;
  cueChat_('Cue', n + ' new email' + (n === 1 ? '' : 's') + (fromInfo ? ' (' + fromInfo + ' to info@)' : '') + '. '
    + (cueNmSortOpen_(cueNow_()) ? 'Claude sorts them within 30 minutes.' : 'Claude sorts them after 7:00.'), s.id);
  return s.id;
}

/** Today's New mail request, made on first use. Lines Kiko has not handled yet move from the day before, which then closes. Call locked. */
function cueNmToday_(day) {
  const sh = cueSheet_('Requests'), rows = cueRows_(sh);
  // ACC-1 / ACC-2 (Kiko 2 Nov 2026, Q1 "A"): open lines move from every older New mail thread still waiting, not only the latest one;
  // each of those threads closes and is archived (assumption 11).
  const older = [];
  for (let i = rows.length - 1; i >= 0; i--) {
    let x = null; try { x = JSON.parse(rows[i].slice(10, 10 + CUE_CELLS_).join('')); } catch (e) { continue; }
    if (!x || x.kind !== 'newmail') continue;
    if (x.day === day) return { sh, row: i + 2, s: x };
    if (!older.length || (x.status !== 'Closed' && !x.archived)) older.push({ row: i + 2, s: x });
  }
  const now = cueNow_();
  const id = 'cue-' + Utilities.formatDate(new Date(now), 'Asia/Manila', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 65536).toString(16).padStart(4, '0');
  const s = { id, version: CUE_VERSION_, kind: 'newmail', created: new Date(now).toISOString(), started: now, day, text: 'New mail for ' + day,
    status: 'Done', stage: 'Done', ref: '', nm: { items: [], skipped: [], sorted_at: 0 }, metrics: { ai_calls: 0, calls: [] }, notes: [],
    archived: true, archived_by: 'email chats' };   // ACC-6 (Q3 "A"): the daily list is no longer shown; each email has its own chat
  const seen = {};
  older.forEach(o => {
    (o.s.nm ? o.s.nm.items : []).filter(x => !x.removed && !x.task_id).forEach(x => { if (!seen[x.key]) { seen[x.key] = 1; s.nm.items.push(x); } });
    if (o.s.status !== 'Closed') { o.s.closed_from = o.s.status; o.s.status = 'Closed'; o.s.superseded = id; }
    o.s.archived = true; o.s.archived_by = 'carry'; cueSave_(sh, o.row, o.s);
  });
  cueNmStatus_(s);
  sh.appendRow([id]); cueSave_(sh, sh.getLastRow(), s);
  return { sh, row: sh.getLastRow(), s };
}

/** Needs you while any line waits for Kiko; Done once every line is handled. */
function cueNmStatus_(s) {
  const open = s.nm.items.filter(x => !x.removed && !x.task_id && !x.chat_id).length;   // ACC-6: a line with its own chat waits there
  if (s.status === 'Closed' && !open) return;
  s.status = open ? 'Needs you' : 'Done'; s.stage = s.status;
  if (open) s.card_at = s.card_at || cueNow_();
}

/* ---------- the sort: Claude, at most every 30 minutes, 07:00 to 21:00 ---------- */
function cueNmSortOpen_(now) { const h = cuePh_(now).hour; return h >= CUE_NM_.start_h && h < CUE_NM_.end_h; }

/* RFQ-RFP-INTAKE (Kiko 29 Oct 2026 15:13Z, on an Emails waiting card for Moldex's "Request Quotation" email: "i dont think it sensed
 * that its for intake - keywords - Request for Quotation, Request for Proposal and variations of it"). A subject with one of these words
 * is a new inquiry, whatever the sort said (unless a known supplier sent it: Kiko 15:20Z "No, skip supplier replies"), and Canvas's Emails waiting card for it offers Start intake (CueMailAlerts.gs writes rfq). */
const CUE_RFQ_RE_ = /\b(rf[qp]s?|request(?:ing|s)?\s+(?:for\s+)?(?:an?\s+)?(?:quotations?|quotes?|proposals?)|(?:quotations?|quotes?|proposals?)\s+requests?)\b/i;
function cueRfqSubject_(subject) { return CUE_RFQ_RE_.test(String(subject || '')); }

/** Sorts today's unsorted lines in ONE Claude call when a sort is due. Returns the thread's id, or ''. */
function cueNmSort_(run) {
  const now = cueNow_();
  if (!cueNmSortOpen_(now)) return '';
  const L0 = cueNmFind_(cuePh_(now).day);
  if (!L0) return '';
  const N0 = L0.s.nm, todo = N0.items.filter(x => x.group === 'new' && !x.removed);
  if (!todo.length || now - (Number(N0.sorted_at) || 0) < CUE_NM_.sort_min * 60e3) return '';
  // Claim the sort first, so a second tick that starts while this one runs does not pay for the same call.
  cueLocked_(() => { const L = cueLoad_(L0.s.id); L.s.nm.sorted_at = now; cueSave_(L.sh, L.row, L.s); });
  const ask = todo.map(x => Object.assign({}, x, { _m: { id: x.key.replace(/^(inbox|info):/, ''), from: x.sender, snippet: x.summary, text: x.text || '' } }));
  cueTriageSort_(run, ask, { claude: true, model: CUE_NM_MODEL_, label: 'Claude', fetch: l => l.inbox !== 'info' });
  const by = {}; ask.forEach(l => { by[l.key] = l; });
  const known = N0.items.some(x => x.inbox === 'mine' && !x.known) ? cueNmWaiting_(run) : null;
  const types = cueMtTypes_(), senders = cueMtSenders_();
  let typed = null;
  const s = cueLocked_(() => {
    const L = cueLoad_(L0.s.id);
    L.s.nm.items.forEach(x => {
      const l = by[x.key]; if (!l || x.group !== 'new') return;
      x.group = l.group; x.summary = l.summary; x.urgent = !!l.urgent; x.why = l.why || ''; x.sorted = true;
      if (l.group === 'skip') { x.removed = 'skip'; }
    });
    typed = cueMtApply_(L.s.nm.items, by, types, senders);   // ACC-3, ACC-7, ACC-8: type each line and apply its type's setting
    cueNmKnown_(known, L.s.nm.items);
    // RFQ-RFP-INTAKE: a sorted line whose subject asks for a quotation or proposal is a new inquiry, unless a known supplier sent it (Kiko's
    // card answer 29 Oct 15:20Z: "No, skip supplier replies", since suppliers answering his RFQs keep the subject).
    L.s.nm.items.forEach(x => { if (by[x.key] && x.sorted && x.group !== 'inquiry' && cueRfqSubject_(x.subject) && !(x.known && x.known.who === 'Supplier')) {
      x.group = 'inquiry'; x.why = 'the subject asks for a quotation or proposal'; if (x.removed === 'skip') delete x.removed; } });
    (run.notes || []).forEach(n => { if (L.s.notes.indexOf(n) < 0) L.s.notes.push(n); });
    const m = L.s.metrics || (L.s.metrics = { ai_calls: 0, calls: [] }); m.ai_calls = (m.ai_calls || 0) + (run.metrics.ai_calls || 0);
    cueNmStatus_(L.s); cueSave_(L.sh, L.row, L.s); return L.s;
  });
  cueNmTyped_(run, typed, types);
  const c = {}; s.nm.items.forEach(x => { if (by[x.key]) c[x.group] = (c[x.group] || 0) + 1; });
  const parts = [c.inquiry && c.inquiry + ' new inquir' + (c.inquiry === 1 ? 'y' : 'ies'), c.reply && c.reply + ' need' + (c.reply === 1 ? 's' : '') + ' your reply',
    c.fyi && c.fyi + ' FYI', c.skip && c.skip + ' skipped'].filter(Boolean);
  if (parts.length) cueChat_('Cue', 'Sorted: ' + parts.join(', ') + '.', s.id);
  cueMcFromSort_(run, s.id);   // ACC-6: one chat per Own chat email, with Cue's read (one Haiku call each)
  return s.id;
}

/* Canvas's Emails waiting list (bridge read mail_waiting: Kiko's inbox threads from known clients and suppliers, the file Cue writes
 * every 10 minutes) names the sender and the project. A line on that list says so, so Kiko sees it is the same email in both
 * places. Read only; when Canvas cannot be read the lines stay as they are. */
function cueNmWaiting_(run) {
  let w = null;
  try { w = cueBridge_(run, 'mail_waiting', {}) || {}; } catch (e) { console.warn('New mail: Emails waiting: ' + e); return null; }
  const by = {}; (w.items || []).forEach(i => { if (i && i.id) by[String(i.id)] = i; });
  return by;
}
function cueNmKnown_(by, items) {
  if (!by) return;
  items.forEach(x => {
    const i = x.inbox === 'mine' && !x.known && by[String(x.thread_id)];
    if (i) x.known = { who: cueStr_(i.who, 20), name: cueStr_(i.name, 120), project: cueStr_(i.project, 160), pid: cueStr_(i.pid, 40) };
    // ASK-CUE-ONCE-2026-10-30 (Kiko 30 Oct 2026 05:50Z "project emails stay in Team Cue others are in Ask Cue"): an email Canvas files
    // under a project shows in that project's thread in Team Cue, so it leaves today's New mail list (kept, marked, never deleted).
    if (i && i.pid && !x.removed && !x.task_id) x.removed = 'project';
  });
}

/** ACC part 2a, after the sort: One line emails each get their own line in Main chat; One line and Ignore emails are marked read;
 * senders Claude typed are kept in Triage; a new type is added (setting One line) and Cue says so once in Main chat. */
function cueNmTyped_(run, typed, types) {
  if (!typed) return;
  typed.oneLine.forEach(x => cueChat_('Cue', cueMtLine_(x), ''));
  cueMtMarkRead_(run, typed.read);
  if (typed.learn.length) { const sh = cueSheet_('Triage rules'), t = new Date(cueNow_()); typed.learn.forEach(p => sh.appendRow([String(p[0]).toLowerCase(), 'type:' + p[1], t, 'typed by Claude'])); }
  if (typed.newTypes.length) {
    cueMtSave_(Object.keys(types).map(k => ({ type: k, setting: types[k], why: typed.newTypes.indexOf(k) >= 0 ? 'new kind of email' : 'Cue Admin' })));
    typed.newTypes.forEach(t => cueMcAskType_(t, typed.firstOf[t]));   // ACC-5: asked once, in its own short chat
  }
}
/** R9: one Main chat line per email with a Canvas Project ID. The email stays unread and gets no type. No AI. */
function cueNmProject_(proj) {
  if (!proj.length) return;
  const t = new Date(cueNow_()), log = cueSheet_('Triage log');
  proj.forEach(l => {
    cueChat_('Cue', cueMtProjectLine_(l, l.pid), '');
    log.appendRow([t, l.key.replace(/^inbox:/, ''), l.thread_id, l.sender, cueStr_(l.subject, 200), 'project', l.pid, '']);
  });
}

/** Today's New mail request, or null. Read only. */
function cueNmFind_(day) {
  const sh = cueSheet_('Requests'), rows = cueRows_(sh);
  for (let i = rows.length - 1; i >= 0; i--) {
    let x = null; try { x = JSON.parse(rows[i].slice(10, 10 + CUE_CELLS_).join('')); } catch (e) { continue; }
    if (x && x.kind === 'newmail') return x.day === day ? { sh, row: i + 2, s: x } : null;
  }
  return null;
}

/* ---------- Kiko's buttons ---------- */
/** what: done (Done / Got it), mute (Mute sender), no_inquiry (Not an inquiry), intake (Start intake), reply (Draft reply).
 * intake and reply return { request_id } so the page runs the new task at once; the others return the thread's view. */
function cueNmItem(id, key, what) {
  cueOwner_();
  if (CUE_NM_ACTIONS_.indexOf(what) < 0) throw new Error('Unknown action.');
  const L0 = cueLoad_(id);
  if (!L0 || L0.s.kind !== 'newmail') throw new Error('No such New mail thread.');
  const it0 = L0.s.nm.items.filter(x => x.key === key)[0];
  if (!it0) throw new Error('That email is not in this thread.');
  if (it0.removed || it0.task_id) throw new Error('That email was already handled.');
  if (what === 'mute' || what === 'no_inquiry') cueTriageTeach(it0.sender, what, (what === 'mute' ? 'muted' : 'not an inquiry') + ' from New mail ' + L0.s.day);
  let out = null;
  if (what === 'intake') out = it0.inbox === 'info' ? cueNmInfoIntake_(it0) : cueTriageIntake(it0.thread_id);
  if (what === 'reply') out = cueNmReply_(L0.s, it0);
  const s = cueLocked_(() => {
    const L = cueLoad_(id), it = L.s.nm.items.filter(x => x.key === key)[0];
    if (what === 'done' || what === 'mute') it.removed = what;
    if (what === 'no_inquiry') { it.group = 'fyi'; it.why = 'you said this sender is not an inquiry'; }
    if (out && out.request_id) { it.task_id = out.request_id; it.acted = what; }
    cueNmStatus_(L.s); cueSave_(L.sh, L.row, L.s); return L.s;
  });
  return out && out.request_id ? out : cueView_(s);
}

/** Start intake on an info@ email: Cue cannot open info@'s mailbox, so the intake starts from the text Canvas passed (no files). */
function cueNmInfoIntake_(it) {
  const text = ('New project intake from email to info@.\nFrom: ' + (it.who && it.who !== it.sender ? it.who + ' <' + it.sender + '>' : it.sender)
    + '\nSubject: ' + cueStr_(it.subject, 300) + '\n\n' + (it.text || it.summary || '')).slice(0, 11500)
    + '\n\n(Any files on this email are in info@\'s Gmail; Cue cannot open them.)';
  const out = cueSend(text, [], 'intake');
  const L = cueLoad_(out.request_id);
  if (L) { L.s.source = { inbox: 'info', thread_id: it.thread_id, message_id: it.message_id, from: it.sender }; cueLocked_(() => cueSave_(L.sh, L.row, L.s)); }
  return out;
}

const CUE_NM_ABOUT_ = 'Reply to this email for Kiko. Answer what they asked only where the email gives the facts. Never promise or state a price, '
  + 'a date, a payment or bank details: say Kiko will confirm, and write [like this] for anything Kiko must fill.';

/** Draft reply: the usual "Draft an email" card (CueMail.gs), filed in the New mail thread, so Kiko edits and sends in the same window.
 * Kiko's inbox: a reply in its Gmail thread. info@: a new email from Kiko's own Gmail to the sender ("Re: <subject>"), never from info@. */
function cueNmReply_(nm, it, ask, ready) {   // ask: Kiko's own words from an email chat (ACC-6), used as the brief; ready: a reply already written (CUE-ASSISTANT-2026-11-03)
  const now = cueNow_(), d = new Date(now);
  const id = 'cue-' + Utilities.formatDate(d, 'Asia/Manila', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 65536).toString(16).padStart(4, '0');
  let T = null;
  if (it.inbox !== 'info') {
    const t = cueGmail_('/threads/' + it.thread_id + '?format=full');
    const msgs = (t.messages || []).filter(m => (m.labelIds || []).indexOf('DRAFT') < 0).sort((a, b) => Number(a.internalDate) - Number(b.internalDate));
    const m = msgs.filter(x => (x.labelIds || []).indexOf('SENT') < 0).slice(-1)[0];
    if (!m) throw new Error('That thread has no email from them any more.');
    const h = {}; ((m.payload && m.payload.headers) || []).forEach(x => { h[String(x.name).toLowerCase()] = String(x.value || ''); });
    T = { thread_id: it.thread_id, message_id: cueStr_(h['message-id'], 300) || it.message_id, to: it.sender, subject: cueStr_(h.subject, 300) || it.subject,
      date: new Date(Number(m.internalDate) || 0).toISOString().slice(0, 10), inbound: true, last: cueStr_(cueTriageText_(m.payload) || m.snippet, 2000) };
  }
  const subject = /^re:/i.test(it.subject || '') ? it.subject : 'Re: ' + (it.subject || '');
  const M = { job: 'reply', to: cueStr_(it.who || it.sender, 200), to_addr: it.sender, audience: 'other', project: '', canvas: '', thread: T,
    about: CUE_NM_ABOUT_ + (ask ? '\n\nKiko\'s instruction for this reply: ' + cueStr_(ask, 1000) : '') + (T ? '' : '\n\nTheir email (to info@' + (it.subject ? ', subject "' + it.subject + '"' : '') + '):\n' + (it.text || it.summary || '')),
    reply_subject: T ? '' : cueStr_(subject, 200), from_inbox: it.inbox };
  const s = { id, version: CUE_VERSION_, kind: 'email', created: d.toISOString(), started: now,
    text: 'Reply to ' + (it.who || it.sender) + '\'s email "' + (it.subject || '') + '"' + (it.inbox === 'info' ? ' (to info@, sent from your Gmail)' : ''),
    files: [], status: 'Working', stage: 'GPT drafting', ref: nm.id, mail: M, metrics: { ai_calls: 0, calls: [] }, notes: [] };
  const body = cueStr_(ready, 6000).trim();
  if (body) {   // the proposed reply goes on the card as written: no GPT call, and nothing is sent before Kiko taps Send
    M.draft = { to: M.to_addr || '', subject: T ? (/^re:/i.test(T.subject) ? T.subject : 'Re: ' + T.subject) : M.reply_subject || cueStr_(subject, 200), body };
    s.status = 'Needs you'; s.stage = 'Needs you'; s.card_at = now;
  }
  cueLocked_(() => { const sh = cueSheet_('Requests'); sh.appendRow([id]); cueSave_(sh, sh.getLastRow(), s); });
  cueChat_('Cue', body ? 'Your reply to ' + (it.who || it.sender) + ' is on the card' + (it.inbox === 'info' ? ' and goes from your Gmail, not info@' : '') + '. Edit it if you like, then Send or Save to Drafts. Nothing is sent before you tap.'
    : 'Drafting a reply to ' + (it.who || it.sender) + (it.inbox === 'info' ? '. It goes from your Gmail, not info@' : '') + '. Nothing is sent before you tap.', id);
  return { request_id: id, task: nm.id };
}

/* ---------- cloud check (test/checks/1.27.56-new-mail.check.mjs, through the check door) ---------- */
/** Read only, no AI: what New mail would show now from the last day of Kiko's inbox and info@. Nothing is saved: no thread, no
 * Triage log row, no property. info@ reports Canvas's answer (an error until the inbox_new release is live). */
function cueNmCheck() {
  cueOwner_();
  const run = { id: 'cue-nm-check', metrics: { ai_calls: 0, calls: [] }, notes: [] }, own = cueMe_().toLowerCase(), found = [];
  const history = String(cueGmail_('/profile').historyId || '');
  const list = cueGmail_('/threads?labelIds=INBOX&q=' + encodeURIComponent('newer_than:1d') + '&maxResults=20').threads || [];
  cueGmailAll_(list.map(t => '/threads/' + t.id + '?format=metadata' + CUE_TRIAGE_HEADERS_)).forEach(t => {
    const m = cueTriageNewest_(t, own); if (m) found.push(cueNmLine_('mine', t.id, m));
  });
  let info = '';
  try {
    const r = cueBridge_(run, 'inbox_new', { since: cueNow_() - 864e5, max: CUE_NM_.max }) || {};
    (r.items || []).forEach(x => { if (x && x.id && x.thread_id) found.push(cueNmLine_('info', x.thread_id, { id: String(x.id), from: String(cueEmail_(x.from) || '').toLowerCase(),
      name: cueStr_(x.name, 120), subject: cueStr_(x.subject, 300), snippet: cueStr_(x.snippet, 300), h: x.h || {}, labels: ['INBOX'] })); });
  } catch (e) { info = String((e && e.message) || e).slice(0, 300); }
  const f = cueNmFilter_(run, found), out = l => ({ inbox: l.inbox, thread_id: String(l.thread_id || ''), who: cueStr_(l.who, 120), subject: cueStr_(l.subject, 160), why: l.why || '' });
  return { history, info_error: info, threads: list.length, keep: f.keep.map(out), skip: f.skip.map(out) };
}

/* ---------- the page ---------- */
function cueNmView_(s) {
  const N = s.nm || { items: [], skipped: [] };
  return { day: s.day, sorted_at: N.sorted_at ? new Date(N.sorted_at).toISOString() : '',
    items: N.items.map(x => ({ key: x.key, inbox: x.inbox, group: x.group, who: x.who, sender: x.sender, subject: x.subject, summary: x.summary, why: x.why || '',
      urgent: !!x.urgent, date: x.date, known: x.known || null, removed: x.removed || '', task_id: x.task_id || '', acted: x.acted || '',
      url: x.inbox === 'mine' && /^[0-9a-f]{8,24}$/.test(String(x.thread_id || '')) ? 'https://mail.google.com/mail/?authuser=' + encodeURIComponent(cueMe_()) + '#all/' + x.thread_id : '' })),
    skipped: N.skipped.map(x => ({ who: x.who || x.sender, subject: x.subject, why: x.why, inbox: x.inbox })) };
}
