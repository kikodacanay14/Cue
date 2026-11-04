/* CUE-STATUS-FRIDAY-2026-10-29 (Kiko 29 Oct 12:57Z: "lets reopen status updates - sent every Friday / provide an update on the
 * progress of each requirement / show progress based on timeline / Project Readiness score - run first Project Readiness scan
 * before sending / Open Risks and Issues / Task Update / If they want to see more details. about the project > Go to Canvas").
 * Friday status updates: one email per active event to the client's main contact, from Kiko's Gmail.
 * Starts Fridays 07:00 (Scheduled tasks row "Friday status updates"), or when Kiko types "status updates" or "status of <event>".
 *   1 Canvas lists the events (client_status ids_only): For Production Start or later, event no more than 7 days ago, or the ones asked for.
 *   2 Canvas runs a fresh readiness scan on each (get_readiness gate 'pre', max 1 minute old), a few at a time; a long list goes
 *     on at the next cueResume tick.
 *   3 Canvas builds each email (client_status email: true) from what the client site shows: each requirement's stage, the
 *     Project timeline, the readiness score the scan just made, open risks and issues, open tasks, and a Go to Canvas button.
 *     Supplier names and peso amounts are cut the way the client site cuts them.
 *   - The card shows each email; Kiko picks To from the event's contacts (or types another), Preview, then Send (one confirm) or Skip.
 *     Nothing goes out before that tap.
 * No AI call. Canvas text is data. */

const CUE_ST_MAX_ = { projects: 25, scan_batch: 5, scan_ms: 200000 };
const CUE_ST_ASK_RE_ = /^\s*(?:please\s+)?(?:run\s+|do\s+|make\s+|give\s+me\s+|show\s+me\s+|send\s+me\s+|send\s+)?(?:the\s+|a\s+|my\s+|this\s+week'?s\s+)?(?:weekly\s+|monday\s+|friday\s+|client\s+)?(?:status\s+(?:reports?|digest|updates?)|monday\s+digest|friday\s+updates?)(?:\s+please)?\s*[.!]?\s*$/i;
const CUE_ST_OF_RE_ = /^\s*(?:give\s+me\s+(?:the\s+|a\s+)?|show\s+me\s+(?:the\s+)?)?status\s+(?:report\s+|update\s+)?(?:of|for|on)\s+(.{2,120}?)\s*\??\s*$/i;
const CUE_ST_PID_RE_ = /^S-[0-9A-Z]{6,14}$/;

/** "status updates" (every active event) or "status of <event>"; null when the message is something else. No AI call. */
function cueStAsked_(t) {
  const s = String(t || '').trim();
  if (!s || s.length > 140) return null;
  if (CUE_ST_ASK_RE_.test(s)) return { project: '' };
  const m = CUE_ST_OF_RE_.exec(s);
  if (m && !/^(the\s+)?(rfq|rfqs|ce|bid|bids|intake|email|batch|sweep|payment|task)s?\b/i.test(m[1])) return { project: m[1].replace(/[.?!]+$/, '').trim() };
  return null;
}

/** Starts Friday status updates in their own thread. how = 'weekly' (the Friday row) | 'chat'. project = '' for every active event. */
function cueStStart_(text, how, project) {
  const now = cueNow_(), d = new Date(now), day = cuePh_(now).day;
  const id = 'cue-' + Utilities.formatDate(d, 'Asia/Manila', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 65536).toString(16).padStart(4, '0');
  const ask = cueStr_(project, 120).trim(), md = day.slice(5).replace('-', '/');
  const st = { title: how === 'weekly' ? 'Friday status updates ' + md : ask ? 'Status update for ' + ask : 'Status updates ' + md, ask, today: day, events: [], mails: [] };
  const s = { id, version: CUE_VERSION_, kind: 'status', how: how === 'weekly' ? 'weekly' : 'chat', created: d.toISOString(), started: now, text: cueStr_(text || st.title, 400), files: [],
    status: 'Working', stage: ask ? 'Finding project' : 'Listing events', ref: '', st, metrics: { ai_calls: 0, calls: [], canvas: [] }, notes: [] };
  cueLocked_(() => { const sh = cueSheet_('Requests'); sh.appendRow([id]); cueSave_(sh, sh.getLastRow(), s); });
  if (how !== 'weekly') cueChat_('Kiko', s.text, '');
  cueChat_('Cue', (how === 'weekly' ? 'Friday status updates: ' : '') + 'Started ' + (ask ? 'a status update for ' + ask : 'the client status updates') + ' in its own thread. Nothing is sent until you tap Send on each email.', '>' + id);   // CUE-THREE-TOUCH-2026-11-01: the Friday client updates are the 5 PM Friday message (Kiko 1 Nov), so they say so in the chat
  cueChat_('Cue', 'Canvas first: a fresh readiness scan for ' + (ask ? ask : 'every active event') + ', then one client email each.', id);
  return { request_id: id, task: '' };
}

/** Advances the run from wherever it stopped. The readiness scan can stop part way (time); the next run goes on from there. */
function cueStRun_(s, save) {
  if (s.stage === 'Finding project') { cueStFind_(s); save(); }
  if (s.stage === 'Listing events') { cueStList_(s); save(); }
  if (s.stage === 'Readiness scan') { if (!cueStScan_(s, save)) return; save(); }
  if (s.stage === 'Building emails') cueStBuild_(s);
}

/** Stage "Finding project": a project id is used as given; a name goes through Canvas's own match (up to 5 open projects). */
function cueStFind_(s) {
  const T = s.st, pid = (String(T.ask).toUpperCase().match(/\bS-[0-9A-Z]{6,14}\b/) || [])[0];
  if (pid) { T.project_ids = [pid]; s.stage = 'Listing events'; return; }
  const all = cueReadyTimed_(s, ['search_projects', 'find_similar_projects'], () => cueCanvasFind_(s, T.ask)) || [];   // STRUCTURE-PHASE-3: the one project finder (CueCanvas.gs)
  const live = all.filter(x => !CUE_DONE_RE_.test(String(x.status || '').trim())), list = (live.length ? live : all).slice(0, 5);
  if (!list.length) throw new Error('Canvas has no event matching "' + T.ask + '". Say the name as it is in Canvas, or its project ID (S-...).');
  T.project_ids = list.map(x => cueStr_(x.project_id, 20)).filter(x => CUE_ST_PID_RE_.test(x));
  s.stage = 'Listing events';
}

/** A done run with nothing to send: says why once, in the thread. */
function cueStEmpty_(s, why) {
  s.st.empty = why; s.status = 'Done'; s.stage = 'Done'; s.card_at = s.ready_at = cueNow_();
  cueChat_('Cue', why, s.id);
}
const cueStNoAction_ = e => /unknown action/.test(String(e && e.message));
const CUE_ST_NOT_YET_ = 'Canvas does not have the client status read yet (client_status). It comes with the next Canvas release.';

/* ---------- step 1: the events (Canvas, ids only) ---------- */
function cueStList_(s) {
  const T = s.st, ids = T.project_ids || [];
  let r;
  try { r = cueReadyTimed_(s, ['client_status'], () => cueBridge_(s, 'client_status', Object.assign({ ids_only: true }, ids.length ? { project_ids: ids } : {}))) || {}; }
  catch (e) {
    if (!cueStNoAction_(e)) throw e;
    // Cue can reach /dev before Canvas has its release: the Friday run then says so once and stops quietly (not a failed task).
    if (s.how === 'weekly') return cueStEmpty_(s, 'Skipped: ' + CUE_ST_NOT_YET_);
    throw new Error(CUE_ST_NOT_YET_);
  }
  T.today = cueStr_(r.today, 10) || T.today; T.more = Number(r.more) || 0;
  T.events = (r.projects || []).filter(p => p && CUE_ST_PID_RE_.test(String(p.id || ''))).slice(0, CUE_ST_MAX_.projects)
    .map(p => ({ id: p.id, name: cueStr_(p.name, 200), date: cueStr_(p.date, 10), scanned: false, scan_error: '' }));
  if (!T.events.length) return cueStEmpty_(s, ids.length ? 'Canvas returned nothing for that event.' : 'No active events: nothing is For Production Start or later with an event in the last 7 days or ahead.');
  s.stage = 'Readiness scan';
}

/* ---------- step 2: a fresh readiness scan per event (Canvas getChecklist, gate 'pre') ---------- */
/** Scans a few events at a time. Returns true when every event is scanned, false when time ran out (the next run goes on). */
function cueStScan_(s, save) {
  const T = s.st, t0 = cueNow_();
  for (;;) {
    const left = T.events.filter(e => !e.scanned);
    if (!left.length) break;
    if (cueNow_() - t0 > CUE_ST_MAX_.scan_ms) return false;
    // A run that died during its fetch (Apps Script's 6-minute cap) left these marked tried: say so, never fetch them again.
    const dead = left.filter(e => e.tried);
    if (dead.length) { dead.forEach(e => { e.scanned = true; e.scan_error = 'Canvas took longer than a Cue run allows'; }); save(); continue; }
    const batch = left.slice(0, CUE_ST_MAX_.scan_batch);
    batch.forEach(e => { e.tried = true; }); save();
    let res = null, why = '';
    try { res = cueReadyTimed_(s, ['get_readiness x' + batch.length], () => UrlFetchApp.fetchAll(batch.map(e => cueBridgeReq_(s, 'get_readiness', { gate: 'pre', max_age_minutes: 1 }, e.id)))); }
    catch (e) { why = cueStr_((e && e.message) || e, 200); }
    batch.forEach((e, i) => {
      e.scanned = true;
      if (!res) { e.scan_error = why; return; }
      try { const c = cueBridgeParse_('get_readiness', res[i]) || {}; e.score = c.score && c.score.total ? { ready: Number(c.score.ready) || 0, total: Number(c.score.total) || 0, pct: Number(c.score.pct) || 0 } : null; }
      catch (x) { e.scan_error = cueStr_((x && x.message) || x, 200); }
    });
    save();
  }
  const bad = T.events.filter(e => e.scan_error);
  if (bad.length) s.notes.push('The readiness scan did not run for ' + bad.map(e => e.name || e.id).join(', ') + ' (' + bad[0].scan_error + '). Their emails show the last score Canvas has.');
  s.stage = 'Building emails';
  return true;
}

/* ---------- step 3: the emails (Canvas builds them; Cue keeps each one zipped) ---------- */
const cueStZip_ = o => Utilities.base64Encode(Utilities.gzip(Utilities.newBlob(JSON.stringify(o), 'application/json')).getBytes());
const cueStUnzip_ = z => JSON.parse(Utilities.ungzip(Utilities.newBlob(Utilities.base64Decode(z), 'application/x-gzip')).getDataAsString());

function cueStBuild_(s) {
  const T = s.st;
  let r;
  try { r = cueReadyTimed_(s, ['client_status'], () => cueBridge_(s, 'client_status', { project_ids: T.events.map(e => e.id), email: true })) || {}; }
  catch (e) { if (cueStNoAction_(e)) throw new Error(CUE_ST_NOT_YET_); throw e; }
  (r.missing || []).slice(0, 6).forEach(m => s.notes.push('Canvas could not read ' + cueStr_(m, 200) + '.'));
  T.logo = String(r.logo || '').replace(/[^A-Za-z0-9+/=]/g, '').slice(0, 60000);
  const scan = {}; T.events.forEach(e => { scan[e.id] = e; });
  T.mails = (r.projects || []).filter(p => p && scan[p.id] && p.html && p.subject).slice(0, CUE_ST_MAX_.projects).map((p, i) => {
    const c = p.contact && cueEmail_(p.contact.email) ? p.contact : null, R = p.readiness, G = p.progress || {}, L = p.timeline;
    const seen = {}, key = x => cueEmail_(x && x.email).toLowerCase(), people = (c ? [c] : []).concat(p.contacts || []).filter(x => key(x) && !seen[key(x)] && (seen[key(x)] = 1)).slice(0, 12)
      .map(x => ({ name: cueStr_(x.name, 120), email: cueEmail_(x.email), role: cueStr_(x.role, 120) }));   // Kiko 13:42Z: To is a dropdown of the event's contacts
    return { k: 'M' + (i + 1), id: p.id, name: cueStr_(p.name, 200), date: cueStr_(p.date, 10), to: c ? cueEmail_(c.email) : '', to_name: c ? cueStr_(c.name, 120) : '', people,
      subject: cueStr_(p.subject, 200).replace(/[\r\n]+/g, ' '), link: cueStr_(p.link, 300),
      readiness: R && R.total ? { ready: Number(R.ready) || 0, total: Number(R.total) || 0, pct: Number(R.pct) || 0 } : null, scanned: !scan[p.id].scan_error,
      reqs: { done: Number(G.done) || 0, total: Number(G.total) || 0 }, timeline: L ? { done: Number(L.done) || 0, total: Number(L.total) || 0, late: (L.late || []).length } : null,
      risks: (p.risks || []).length, issues: (p.issues || []).length, tasks: (p.tasks || []).length,
      z: cueStZip_({ html: cueStr_(p.html, 60000), text: cueStr_(p.text, 20000) }), sent_id: '', skipped: false, error: '' };
  });
  if (!T.mails.length) return cueStEmpty_(s, 'Canvas did not build any email. ' + (s.notes[0] || ''));
  s.status = 'Needs you'; s.stage = 'Needs you'; s.card_at = cueNow_();
  const none = T.mails.filter(m => !m.to).length, scanned = T.events.filter(e => !e.scan_error).length;
  cueChat_('Cue', T.mails.length + ' client email' + (T.mails.length === 1 ? '' : 's') + ' ready' + (T.more ? ' (and ' + T.more + ' more events not shown)' : '')
    + '. Readiness scanned for ' + scanned + ' of ' + T.events.length + ' event' + (T.events.length === 1 ? '' : 's') + '.'
    + (none ? ' ' + none + ' ha' + (none === 1 ? 's' : 've') + ' no main client contact in Canvas: type the email in To.' : '')
    + ' Check each one and tap Send. Nothing goes out before that.', s.id);
}

/* ---------- Kiko's taps ---------- */
/** One email's Send or Skip (cueApprove routes here): edits = { send: 'M1', to: 'a@x.com, b@y.com' } or { skip: 'M1' }. */
function cueStApprove_(id, edits) {
  const k = String((edits && (edits.send || edits.skip)) || ''), send = !!(edits && edits.send);
  const L = cueLocked_(() => {
    const L = cueLoad_(id);
    if (!L || L.s.kind !== 'status') throw new Error('No such status update.');
    const s = L.s, m = (s.st.mails || []).filter(x => x.k === k)[0];
    if (s.status !== 'Needs you') throw new Error('These status updates are ' + s.status + ', not waiting for you.');
    if (!m) throw new Error('No such email on this card.');
    if (m.sent_id) return { s, m, already: true };
    if (!send) { m.skipped = true; m.error = ''; cueStSettle_(s); cueSave_(L.sh, L.row, s); return { s, m, skipped: true }; }
    if (m.sending && m.sending > cueNow_() - 120000) return { s, m, already: true };   // the first tap is still sending
    const raw = edits.to != null ? String(edits.to) : m.to, to = raw.split(/[,;\s]+/).filter(Boolean);
    if (!to.length) throw new Error('Type the client\'s email in To first.');
    const bad = to.filter(a => !cueEmail_(a))[0];
    if (bad) throw new Error('"' + cueStr_(bad, 80) + '" is not an email address.');
    m.to = to.map(cueEmail_).join(', '); m.sending = cueNow_(); m.skipped = false;
    s.approved_at = s.approved_at || new Date(cueNow_()).toISOString();
    cueSave_(L.sh, L.row, s);
    return { s, m, sh: L.sh, row: L.row };
  });
  const s = L.s, m = L.m;
  if (L.already || L.skipped) {
    if (L.skipped) { cueChat_('Cue', 'Skipped the update for ' + m.name + '. Nothing was sent.', s.id); if (s.status === 'Done') cueSummary_(s); }
    return s;
  }
  try {
    const x = cueStUnzip_(m.z), out = cueRfpSendOne_({ to: m.to.split(', '), subject: m.subject, body: x.text, html: x.html }, s.st.logo);
    m.sent_id = out.message_id; m.thread_id = out.thread_id; m.sent_at = new Date(cueNow_()).toISOString(); m.error = '';
  } catch (e) { m.error = cueStr_((e && e.message) || e, 200); }
  delete m.sending;
  cueLocked_(() => { const N = cueLoad_(id), cur = (N.s.st.mails || []).filter(x => x.k === k)[0];
    if (cur) { Object.assign(cur, { to: m.to, sent_id: m.sent_id || '', thread_id: m.thread_id || '', sent_at: m.sent_at || '', error: m.error }); delete cur.sending; }
    cueStSettle_(N.s); cueMetrics_(N.s); cueSave_(N.sh, N.row, N.s); Object.assign(s, N.s); });
  const kept = m.sent_id ? cueStCopy_(s, m) : '';
  cueChat_('Cue', m.sent_id ? 'Sent the Friday update for ' + m.name + ' to ' + m.to + ' from your Gmail.' + kept : 'The update for ' + m.name + ' did not go out: ' + m.error + ' Tap Send again to retry.', s.id);
  if (s.status === 'Done') cueSummary_(s);
  return s;
}

/* WEEKLY-REPORTS-2026-11-04 (Kiko 4 Nov 2026 16:22Z, Canvas Projects page: "Reports > Weekly Reports - to see copies of it";
 * approved 16:28Z with assumption A14: Cue saves a copy of each Friday email to Canvas through the bridge when it is sent, and
 * earlier emails are not back-filled). After Gmail sends one, Canvas gets exactly what went out (bridge action status_copy, keyed by
 * the Gmail message id). The email has already gone, so a failed copy never undoes or blocks it: the sent line says the copy was
 * not saved, and says nothing while Canvas does not have status_copy yet. Returns the words to add to the sent line. */
function cueStCopy_(s, m) {
  if (globalThis.CUE_CHECK_ON_) return '';
  try {
    const x = cueStUnzip_(m.z);
    cueBridge_(s, 'status_copy', { request_id: 'stcopy:' + m.sent_id, project_id: m.id, message_id: m.sent_id, subject: m.subject,
      to: cueStr_(m.to, 500), sent_at: m.sent_at, html: cueStr_(x.html, 60000), text: cueStr_(x.text, 20000) });
    return ' A copy is in Canvas under Reports › Weekly Reports.';
  } catch (e) {
    const why = cueStr_((e && e.message) || e, 160);
    return /unknown action/.test(why) ? '' : ' Canvas did not keep a copy (' + why + ').';
  }
}

/** Done once every email is sent or skipped. */
function cueStSettle_(s) {
  if ((s.st.mails || []).some(m => !m.sent_id && !m.skipped)) { s.status = 'Needs you'; s.stage = 'Needs you'; return; }
  s.status = 'Done'; s.stage = 'Done'; s.ready_at = s.ready_at || cueNow_();
}

/** One email as the client sees it, for the card's Preview: the html with the Canvas logo inline. Read only. */
function cueStatusPreview(id, k) {
  cueOwner_();
  const L = cueLoad_(id);
  if (!L || L.s.kind !== 'status') throw new Error('No such status update.');
  const m = (L.s.st.mails || []).filter(x => x.k === String(k || ''))[0];
  if (!m) throw new Error('No such email on this card.');
  const x = cueStUnzip_(m.z), logo = L.s.st.logo ? 'data:image/png;base64,' + L.s.st.logo : '';
  return { subject: m.subject, html: logo ? String(x.html).split('cid:canvaslogo').join(logo) : x.html, text: x.text };
}

/** Kiko is done: the emails not sent are dropped. Nothing is sent. */
function cueStatusDone(id) {
  cueOwner_();
  const s = cueLocked_(() => {
    const L = cueLoad_(id);
    if (!L || L.s.kind !== 'status') throw new Error('No such status update.');
    if (L.s.status !== 'Needs you') return L.s;
    (L.s.st.mails || []).forEach(m => { if (!m.sent_id) m.skipped = true; });
    Object.assign(L.s, { status: 'Done', stage: 'Done', ready_at: L.s.ready_at || cueNow_() });
    cueMetrics_(L.s); cueSave_(L.sh, L.row, L.s); return L.s;
  });
  cueSummary_(s);
  return cueView_(s);
}
const cueStClose_ = id => { cueStatusDone(id); return cueLoad_(id).s; };

/** The summary line for the main chat (cueSummary_ calls this for status updates). */
function cueStSummaryLine_(s) {
  const T = s.st || {}, M = T.mails || [], sent = M.filter(m => m.sent_id).length, skip = M.filter(m => !m.sent_id && m.skipped).length;
  return 'Summary for ' + (T.title || 'the status updates') + ': ' + (sent ? 'sent ' + sent + ' client update' + (sent === 1 ? '' : 's') + ' from your Gmail' : 'nothing sent')
    + (skip ? '; ' + skip + ' skipped' : '') + '.';
}

/** What the page needs for the card (the emails themselves come one at a time through cueStatusPreview). */
function cueStView_(s) {
  const T = s.st || {};
  return { title: T.title || 'Status updates', ask: T.ask || '', today: T.today || '', empty: T.empty || '', more: T.more || 0,
    stage: s.stage, scanned: (T.events || []).filter(e => e.scanned).length, events: (T.events || []).length,
    mails: (T.mails || []).map(m => ({ k: m.k, id: m.id, name: m.name, date: m.date, to: m.to, to_name: m.to_name, people: m.people || [], subject: m.subject, link: m.link,
      readiness: m.readiness, scanned: !!m.scanned, reqs: m.reqs, timeline: m.timeline, risks: m.risks, issues: m.issues, tasks: m.tasks,
      sent: !!m.sent_id, sent_at: m.sent_at || '', skipped: !!m.skipped, sending: !!m.sending, error: m.error || '' })) };
}
