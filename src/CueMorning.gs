/* CUE-K0-2026-10-31: the 8 AM update (K0). Kiko 31 Oct 2026 approved the spec cue-message-redesign-spec.md ("yes", with its rules R1
 * to R4) and the mockup ("ok", after "if we can break it down further with the levels i gave earlier"). His format, 31 Oct:
 * "8AM: Yesterday's Summary * Personal Tasks Completed and Moved * Project tasks Worked On * New Opportunities and Clients worked on
 * * Company related tasks ... / Today's work * Personal tasks for today * Items that are assigned to me * Items that require my review
 * and approval * Items that is time for a follow up * Items that are blocked waiting for other person's action and response".
 *
 * One message a day in the main chat replaces the 07:00 job posts (morning batch, bid check, sales funnel, Friday status) and the new
 * contacts card. Kiko answers in plain words ("send all", "send 1, 3", "add 4", "start 6", "no 5"); Cue does it and says so in one
 * line. Rule R1 (approved): empty sections are left out. Rule R2 (approved): with the 8 AM update on, the scheduled jobs post nothing
 * to the main chat; a job that fails still says so.
 *
 * No AI call: everything comes from what the morning runs and Cue's tasks already hold, plus the Shared Task Tracker and the ongoing
 * projects' timelines (CUE-K0-WORK-2026-11-01, below). The 8 AM update is the Schedule row sys-k0: turning it off
 * in Cue Admin brings back the old posts. */

const CUE_K0_ = { look: 160, max_ok: 60, retry_until: 15 };   // retry until 15:00 for the 2 PM update   // requests read; numbered lines at most; retry while the batch drafts, until 10:00
const CUE_K0_JOB_KINDS_ = { sweep: 1, bids: 1, status: 1, funnel: 1, gtask: 1, relnotes: 1, k0: 1 };

/** True when the 8 AM update is on (its Schedule row exists and is on). Then the scheduled jobs keep out of the main chat (R2). */
function cueK0On_() {
  if (globalThis.CUE_K0_ON_ != null) return globalThis.CUE_K0_ON_;
  let on = false;
  try { const sh = cueSheet_(CUE_SCHED_TAB_); on = !!sh && cueSchedRead_(sh).some(x => x.id === 'sys-k0' && x.on); } catch (e) { on = false; }
  globalThis.CUE_K0_ON_ = on;   // one read per run
  return on;
}

const cueK0Day_ = (day, n) => new Date(Date.parse(day + 'T12:00:00+08:00') + n * 864e5).toISOString().slice(0, 10);
const cueK0Time_ = ms => { const p = cuePh_(ms), h = p.hour % 12 || 12; return h + ':' + String(p.minute).padStart(2, '0') + ' ' + (p.hour < 12 ? 'AM' : 'PM'); };
const cueK0Title_ = (day, mode) => { const d = new Date(Date.parse(day + 'T12:00:00+08:00')); return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getUTCDay()]
  + ', ' + d.getUTCDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()] + (mode === 'pm' ? ' · your 2 PM update' : ' · your 8 AM update'); };

/** The saved requests Cue reads for the update: [{ s, updated }] (updated = the row's Updated cell, ms). */
function cueK0Rows_() {
  return cueRows_(cueSheet_('Requests')).slice(-CUE_K0_.look).map(r => { let s = null; try { s = JSON.parse(r.slice(10, 10 + CUE_CELLS_).join('')); } catch (e) { s = null; }
    return s ? { s, updated: r[9] instanceof Date ? r[9].getTime() : Date.parse(r[9]) || 0 } : null; }).filter(Boolean);
}

/** Builds the update for one Manila day. Pure apart from reads: the tests call it directly. Returns { title, text, items, lines }. */
function cueK0Build_(day, contacts, mode, work) {
  // CUE-THREE-TOUCH-2026-11-01 (Kiko 1 Nov: "8AM Yesterday's Summary, Today's focus, New Opportunities, New Clients / 2PM Funnel,
  // Chasers"): mode 'am' is the 8:00 update, 'pm' the 2:00 update. Each numbers its own lines for Kiko's reply.
  mode = mode === 'pm' ? 'pm' : 'am';
  const rows = cueK0Rows_(), yday = cueK0Day_(day, -1), dayOf = ms => ms ? cuePh_(ms).day : '';
  const made = x => dayOf(Date.parse(x.s.created) || 0);
  const latest = (kind, d) => rows.filter(x => x.s.kind === kind && made(x) === d && !x.s.check).map(x => x.s).pop() || null;
  const sweep = latest('sweep', day), bids = latest('bids', day), funnel = latest('funnel', day);
  const items = [], add = (o, line) => { if (items.length >= CUE_K0_.max_ok) return null; items.push(o); return items.length + '. ' + line; };
  const by = {}; rows.forEach(x => { by[x.s.id] = x.s; });
  const root = id => { for (let i = 0; i < 8 && by[id] && by[id].ref; i++) id = by[id].ref; return id; };
  const out = [], sec = (h, list) => { list = list.filter(Boolean); if (list.length) { out.push('', h); list.forEach(l => out.push(l)); } };
  const lvl = (h, list) => list.length ? ['- ' + h].concat(list.map(l => '  - ' + l)) : [];
  const title = cueK0Title_(day, mode);

  if (mode === 'am') {
    // Today's focus: anything with a clock today, then Cue's own open tasks by due date and state.
    const crit = [], focus = { assigned: [], review: [], follow: [] };
    rows.forEach(x => { const r = Number(x.s.remind_at) || 0; if (r && dayOf(r) === day && !x.s.archived) crit.push([r, cueK0Time_(r) + ': ' + cueTaskName_(x.s)]); });
    try { const sh = cueSheet_(CUE_SCHED_TAB_); if (sh) cueSchedRead_(sh).filter(x => x.run === 'remind' && x.on && x.next && dayOf(x.next) === day)
      .forEach(x => crit.push([x.next, cueK0Time_(x.next) + ': ' + x.command.replace(/^remind\s+me\s+(?:to\s+|about\s+|that\s+)?/i, '')])); } catch (e) { console.warn('K0 reminders: ' + e); }
    crit.sort((a, b) => a[0] - b[0]);
    const seen = {};
    rows.forEach(x => {
      const s = x.s; if (CUE_K0_JOB_KINDS_[s.kind] || s.archived || s.check) return;
      const r = root(s.id), R = by[r] || s; if (seen[r] || R.archived) return;
      if (!rows.some(y => root(y.s.id) === r && ['Done', 'Rejected', 'Closed'].indexOf(y.s.status) < 0)) return; seen[r] = 1;
      const name = cueTaskName_(R), due = String(R.due || ''), waiting = rows.some(y => root(y.s.id) === r && y.s.status === 'Needs you');
      if (waiting) focus.review.push(name + (due ? ' (due ' + due + ')' : ''));
      else if (due && due < day) focus.follow.push(name + ': overdue since ' + due);
      else if (due === day) focus.assigned.push(name + ': due today');
    });
    // Yesterday's summary: what Cue's threads, chasers, bids and contacts show for that day (Friday's on a Monday).
    const yd = cuePh_(Date.parse(day + 'T12:00:00+08:00')).day && new Date(Date.parse(day + 'T12:00:00+08:00')).getUTCDay() === 1 ? cueK0Day_(day, -3) : yday;
    const ydone = { projects: [], opps: [], company: [] }, proj = {};
    rows.forEach(x => { const s = x.s; if (CUE_K0_JOB_KINDS_[s.kind] || s.check || dayOf(x.updated) < yd || dayOf(x.updated) >= day) return; const n = cueTaskName_(by[root(s.id)] || s); proj[n] = 1; });
    Object.keys(proj).forEach(n => ydone.projects.push(n));
    const sent = {}; rows.filter(x => x.s.kind === 'sweep' && x.s.batch).forEach(x => (x.s.batch.items || []).forEach(it => { const d = it.sent_at ? dayOf(Date.parse(it.sent_at)) : ''; if (d && d >= yd && d < day) sent[it.label || 'chasers'] = (sent[it.label || 'chasers'] || 0) + 1; }));
    if (Object.keys(sent).length) ydone.projects.push('Chasers sent: ' + Object.keys(sent).map(k => sent[k] + ' ' + k).join(', '));
    const ybids = latest('bids', yday);
    if (ybids && ybids.bids && (ybids.bids.items || []).length) ydone.opps.push('Bids found: ' + ybids.bids.items.slice(0, 4).map(it => it.project || it.reference).filter(Boolean).join(', ') + (ybids.bids.items.length > 4 ? ' and ' + (ybids.bids.items.length - 4) + ' more' : ''));
    if (contacts && contacts.added_yday) ydone.opps.push('Contacts added to Canvas: ' + contacts.added_yday);
    const WL = work ? cueK0WorkLines_(work, day, yd, work.moved) : null;
    const rn = latest('relnotes', yday);
    if (rn && rn.rn && (rn.rn.lines || rn.rn.items || []).length) ydone.company.push('Canvas and Cue: ' + (rn.rn.lines || rn.rn.items).slice(0, 4).map(l => typeof l === 'string' ? l : l.text || l.title || '').filter(Boolean).join('; '));
    // New opportunities (bids to start an intake) and new clients (contacts to add), numbered for Kiko's reply.
    // CUE-K0-BIDS-CARD-2026-11-01 (Kiko 1 Nov: "New Opportunities / Bids need to be a card. Coz they need to show more details, links
    // inside it and buttons"): today's new bids show as one card right under this message (cueK0Run_ posts it), not as numbered lines.
    const nb = bids && bids.bids && bids.status === 'Needs you' ? (bids.bids.items || []).filter(it => it.key && !it.decision).length : 0;
    const opps = nb ? ['- ' + nb + ' new bid' + (nb === 1 ? '' : 's') + ', in the card below'] : [];
    // CUE-COWORK-1030-2026-11-01: Cowork now runs at 10:00, after this update; its 10:30 check says so itself when it did not run.
    const people = (contacts && contacts.people || []).map((p, i) => add({ t: 'contact', e: p.email, i: i + 1 }, [p.name || p.email.split('@')[0], p.title, p.company].filter(Boolean).join(', ') + ' (' + p.email + ')'));
    const W = WL || { crit: [], over: [], mine: [], blocked: [], nudge: [], soon: [], personal: [], done: [], moved: [] };
    sec('Yesterday\'s summary', [].concat(lvl('Completed', W.done), lvl('Moved', W.moved), lvl('Project tasks worked on', ydone.projects), lvl('New opportunities and clients', ydone.opps), lvl('Company', ydone.company)));
    sec('Today\'s focus', [].concat(lvl('Critical today', crit.map(c => c[1]).concat(W.crit)), lvl('Overdue', focus.follow.concat(W.over)), lvl('Assigned to you', focus.assigned.concat(W.mine)),
      lvl('Needs your review or approval', focus.review), lvl('Nudge your team', W.nudge), lvl('Blocked, waiting on someone', W.blocked), lvl('Key milestones in the next 3 days', W.soon),
      lvl('Personal', W.personal)));
    if (work && (work.missed || []).length) out.push('', 'Could not read ' + work.missed.join('; ') + '. Those lines are left out today.');
    sec('New opportunities', opps);
    sec('New clients (reply "add 2" to add them to Canvas)', people);
    if (!out.length) out.push('', 'Nothing needs you this morning.');
    return { title, text: title + '\n' + out.join('\n'), items, mode, bids: bids ? bids.id : '', bids_new: nb };
  }

  // 2 PM: the funnel's follow-ups, then every chaser due, numbered. A pick drafts; nothing sends until Kiko presses Send on a card.
  // CUE-PM-NO-FLOOD-2026-11-03 (Kiko 3 Nov: "Goal is not to make it confusing. Remove the duplicates, Do not Flood details that are not
  // necessary."): chasers that cannot be emailed (no address, client replied, chased 3 times) no longer pile up under Funnel one by one;
  // the update gives one count line per chaser type and the details stay in the chaser batch's own thread. A chaser listed twice (same
  // type, person and project) is numbered once. Chased-the-max lines become one count line.
  const funnelLines = [], chasers = [], noMail = {}, noMailOrder = [], seenChase = {};
  if (funnel && funnel.fn && (funnel.fn.lines || []).length) funnel.fn.lines.forEach(l => funnelLines.push(String(l)));
  let stopped = 0;
  if (sweep && sweep.batch) {
    (sweep.batch.items || []).filter(it => !it.removed && it.kind !== 'tasks').forEach(it => {
      const lab = it.label ? it.label.replace(/s$/, '') : 'Chaser';
      const what = [lab, it.who ? 'to ' + it.who : '', it.project ? '(' + it.project + ')' : ''].filter(Boolean).join(' ');
      if (it.no_email) { if (!noMail[lab]) { noMail[lab] = 0; noMailOrder.push(lab); } noMail[lab]++; return; }
      if (it.sent_id || it.picked) return;
      const dup = (lab + '|' + (it.who || it.to || '') + '|' + (it.project || '')).toLowerCase();
      if (seenChase[dup]) return; seenChase[dup] = 1;
      chasers.push(add({ t: 'chase', k: it.key }, what + (it.why ? ': ' + it.why : '')));
    });
    stopped = (sweep.batch.stopped || []).length;
  }
  sec('Funnel', funnelLines.map(l => '- ' + l));
  sec('Chasers for your OK (reply "1, 3" or "all": Cue drafts them for you to check; nothing is sent until you press Send)', chasers);
  const held = noMailOrder.map(lab => '- ' + noMail[lab] + ' ' + lab.replace(/ chaser$/i, '') + (noMail[lab] === 1 ? ' chaser' : ' chasers'));
  if (stopped) held.push('- ' + stopped + (stopped === 1 ? ' chaser' : ' chasers') + ' chased the max times with no reply');
  sec('Not emailed: need you in Canvas (details in the chasers thread)', held);
  if (!out.length) out.push('', 'No follow-ups or chasers due this afternoon.');
  return { title, text: title + '\n' + out.join('\n'), items, mode, sweep: sweep ? sweep.id : '' };
}

/* ---------- CUE-K0-WORK-2026-11-01: the Shared Task Tracker and the ongoing projects' timelines ----------
 * Kiko 1 Nov 2026: "it should also reference the project timeline of any ongoing project", and on the proposal: "1. add. anything
 * assigned to internal that i need to nudge / 2. They should [Personal in its own group] / 3. yes [key milestones in the next 3
 * days] / 4. Yes [ongoing = the Friday status list] / 5. yes [Completed and Moved in Yesterday's summary]".
 * Two reads, no AI call: the Shared Task Tracker's Tasks tab (Task ID, Task, Category, Priority, Status, Due Date, Notes, Updated At)
 * and Canvas's client_status read (each ongoing project's Project timeline and its open TRI tasks with who they are assigned to).
 * A read that fails leaves its lines out and the update says what it could not read. */
const CUE_K0_WORK_ = { per: 8, soon: 3 };   // lines per group before "and N more"; key milestones within this many days
/** A sheet or bridge date as yyyy-MM-dd (Manila), or ''. */
function cueK0Iso_(v) {
  if (v instanceof Date && !isNaN(v)) return cuePh_(v.getTime()).day;
  const t = String(v == null ? '' : v).trim(); if (!t) return '';
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return m[3] + '-' + ('0' + m[1]).slice(-2) + '-' + ('0' + m[2]).slice(-2);
  return '';
}
/** "Mon 2 Nov" for a yyyy-MM-dd day. */
function cueK0Short_(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!m) return '';
  const D = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][D.getUTCDay()] + ' ' + (+m[3]) + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m[2] - 1];
}
/** Reads the Tracker and the ongoing projects for the 8 AM update: { tasks, projects, missed }. */
function cueK0Work_(s) {
  const out = { tasks: [], projects: [], missed: [] };
  try {
    const T = cueGtTab_('tasks', s), g = (o, k) => o[k] == null ? '' : o[k];
    out.tasks = T.rows.map(o => ({ id: String(g(o, 'Task ID')).trim(), task: cueStr_(String(g(o, 'Task')).trim(), 160), cat: String(g(o, 'Category')).trim(),
      status: String(g(o, 'Status')).trim(), due: cueK0Iso_(g(o, 'Due Date')), updated: cueK0Iso_(g(o, 'Updated At')) })).filter(t => t.task);
  } catch (e) { out.missed.push('the Shared Task Tracker (' + cueStr_((e && e.message) || e, 120) + ')'); }
  try {
    const r = cueBridge_(s, 'client_status', {}) || {};
    out.projects = r.projects || [];
    (r.missing || []).filter(m => /timeline|TRI Tracker/.test(m)).slice(0, 3).forEach(m => out.missed.push(cueStr_(m, 160)));
  } catch (e) { out.missed.push('the project timelines in Canvas (' + cueStr_((e && e.message) || e, 120) + ')'); }
  return out;
}
/** Is this TRI "assigned to" Kiko? Names from Script Property CUE_ME_NAMES (default "Kiko"). */
function cueK0Me_(who) {
  const names = String(cueProp_('CUE_ME_NAMES', 'Kiko')).split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  const w = String(who || '').toLowerCase(); return !!w && names.some(n => w.indexOf(n) >= 0);
}
/** The Tracker's and the projects' lines for Today's focus and Yesterday's summary. moved: Task ID -> due date at the last 8 AM. */
function cueK0WorkLines_(W, day, yd, moved) {
  const L = { crit: [], over: [], mine: [], blocked: [], nudge: [], soon: [], personal: [], done: [], moved: [] };
  const open = t => !/^(complete|completed|done|cancel)/i.test(t.status);
  const lateBy = d => { const n = Math.round((Date.parse(day + 'T00:00:00Z') - Date.parse(d + 'T00:00:00Z')) / 864e5); return n === 1 ? '1 day late' : n + ' days late'; };
  const soonTo = cueK0Day_(day, CUE_K0_WORK_.soon), tomorrow = cueK0Day_(day, 1);
  (W.tasks || []).forEach(t => {
    const name = t.task + (t.id ? ' (' + t.id + ')' : '');
    if (!open(t)) { if (t.updated && t.updated >= yd && t.updated < day) L.done.push(name); return; }
    if (moved && t.id && moved[t.id] !== undefined && moved[t.id] !== t.due) L.moved.push(name + ': ' + (moved[t.id] ? cueK0Short_(moved[t.id]) : 'no date') + ' to ' + (t.due ? cueK0Short_(t.due) : 'no date'));
    const blocked = /^blocked/i.test(t.status), going = /progress/i.test(t.status);
    const line = t.due && t.due < day ? name + ': ' + lateBy(t.due) : t.due === day ? name + ': due today' : blocked ? name + (t.due ? ' (due ' + cueK0Short_(t.due) + ')' : '') : going && !t.due ? name : '';
    if (!line) return;
    if (/^personal/i.test(t.cat)) { L.personal.push(line); return; }
    if (t.due && t.due < day) L.over.push(line); else if (t.due === day) L.crit.push(line); else if (blocked) L.blocked.push(line); else L.mine.push(line);
  });
  (W.projects || []).forEach(p => {
    const pn = String(p.name || p.id || 'Project'), tl = p.timeline;
    if (tl) {
      (tl.late || []).forEach(x => { const d = x.end || x.start || ''; if (d === day) L.crit.push(pn + ': ' + x.task + ' ends today (timeline)'); else L.over.push(pn + ': ' + x.task + (d ? ', ' + lateBy(d) : '') + ' (timeline)'); });
      (tl.next || []).filter(x => x.milestone && (x.end || x.start) >= day && (x.end || x.start) <= soonTo).forEach(x => L.soon.push(pn + ': ' + x.task + ', ' + cueK0Short_(x.end || x.start)));
    }
    (p.tasks || []).forEach(x => {
      const d = x.deadline || '', when = d && d < day ? lateBy(d) : d === day ? 'due today' : d === tomorrow ? 'due tomorrow' : '';
      if (!when) return;
      if (cueK0Me_(x.assigned)) (d < day ? L.over : L.crit).push(pn + ': ' + x.item + ' (' + when + ')');
      else L.nudge.push(pn + ': ' + x.item + ' (' + (x.assigned || 'no one assigned') + ', ' + when + ')');
    });
  });
  const cap = a => a.length > CUE_K0_WORK_.per ? a.slice(0, CUE_K0_WORK_.per).concat(['and ' + (a.length - CUE_K0_WORK_.per) + ' more']) : a;
  Object.keys(L).forEach(k => { L[k] = cap(L[k]); });
  return L;
}

/** The new contacts waiting in the New contacts tab, as one card in the update's thread (one Canvas check, no AI). */
function cueK0Contacts_(s) {
  const out = { people: [], ask: '', added_yday: 0 };
  if (typeof cueCnRead_ !== 'function') return out;
  const P = PropertiesService.getScriptProperties(), T = cueCnRead_(), yday = cueK0Day_(cuePh_(cueNow_()).day, -1);
  out.added_yday = T.rows.filter(r => r[6] === 'Added' && r[10] && cuePh_(r[10] instanceof Date ? r[10].getTime() : Date.parse(r[10]) || 0).day === yday).length;
  let id = P.getProperty('CUE_CN_CARD');
  if (!(id && P.getProperty('CUE_ASK_' + id))) {
    const st = cueCnState_();
    if (!st || !st.done || T.rows.some(r => r[6] === 'Waiting')) return out;
    id = cueCnCard_(s, T, st, s.id) || '';
    if (id) P.setProperty('CUE_CN_CARD', id); else { P.deleteProperty('CUE_CN_CARD'); return out; }
  }
  let o = null; try { o = JSON.parse(P.getProperty('CUE_ASK_' + id) || 'null'); } catch (e) { o = null; }
  if (!o || o.type !== 'contactnew') return out;
  const T2 = cueCnRead_();
  out.ask = id;
  out.people = (o.emails || []).map(e => { const r = T2.rows[T2.at[e]] || []; return { email: e, name: String(r[1] || ''), title: String(r[8] || ''), company: String(r[7] || '') }; });
  return out;
}

/** The Schedule rows sys-k0 (weekdays 08:00, mode 'am') and sys-k0pm (weekdays 14:00, mode 'pm'). Each posts once a day. The 2 PM
 * update waits while the 13:00 chaser batch is still drafting (cueK0Retry_), until 15:00 at the latest. */
function cueK0Run_(manual, mode) {
  mode = mode === 'pm' ? 'pm' : 'am';
  const P = PropertiesService.getScriptProperties(), now = cueNow_(), day = cuePh_(now).day, guard = mode === 'pm' ? 'CUE_K0PM_DAY' : 'CUE_K0_DAY';
  if (!manual && P.getProperty(guard) === day) return { skip: 'Already sent today' };
  if (mode === 'pm') {
    const sw = cueK0Rows_().filter(x => x.s.kind === 'sweep' && cuePh_(Date.parse(x.s.created) || 0).day === day).map(x => x.s).pop();
    if (!manual && sw && ['Working', 'Making drafts'].indexOf(sw.status) >= 0 && cuePh_(now).hour < CUE_K0_.retry_until) { P.setProperty('CUE_K0_RETRY', day); return { skip: 'Waiting for the chasers' }; }
    P.deleteProperty('CUE_K0_RETRY');
  }
  P.setProperty(guard, day);
  const d = new Date(now), id = 'cue-' + Utilities.formatDate(d, 'Asia/Manila', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 65536).toString(16).padStart(4, '0');
  const s = { id, version: CUE_VERSION_, kind: 'k0', created: d.toISOString(), started: now, text: cueK0Title_(day, mode), files: [], status: 'Done', stage: 'Done', ref: '', day,
    metrics: { ai_calls: 0, calls: [], canvas: [] }, notes: [] };
  cueLocked_(() => { const sh = cueSheet_('Requests'); sh.appendRow([id]); cueSave_(sh, sh.getLastRow(), s); });
  let contacts = { people: [] };
  if (mode === 'am') try { contacts = cueK0Contacts_(s); } catch (e) { s.notes.push('New contacts: ' + cueStr_((e && e.message) || e, 200)); }
  // CUE-K0-WORK-2026-11-01: the Tracker and the ongoing projects' timelines. "Moved" compares with the due dates kept at the last 8 AM.
  let work = null;
  if (mode === 'am') {
    work = cueK0Work_(s);
    try { work.moved = JSON.parse(P.getProperty('CUE_K0_TT_DUE') || 'null'); } catch (e) { work.moved = null; }
    if (work.tasks.length) { const keep = {}; work.tasks.forEach(t => { if (t.id) keep[t.id] = t.due; }); P.setProperty('CUE_K0_TT_DUE', JSON.stringify(keep)); }
  }
  const K = cueK0Build_(day, contacts, mode, work);
  s.k0 = { title: K.title, day, mode, items: K.items, sweep: K.sweep || '', bids: K.bids || '', ask: contacts.ask || '', done: {} };
  cueLocked_(() => { const L = cueLoad_(id); L.s.k0 = s.k0; L.s.notes = s.notes; cueSave_(L.sh, L.row, L.s); });
  cueChat_('Cue', K.text, '>' + id);
  // The bids card under the 8 AM message: a main-chat line "%<bid run id>" that the page draws as the New opportunities card.
  if (mode === 'am' && K.bids && K.bids_new) cueChat_('Cue', 'New opportunities: ' + K.bids_new + ' new bid' + (K.bids_new === 1 ? '' : 's') + '.', '%' + K.bids);
  return { request_id: id, items: K.items.length };
}
/** From cueResume: the 2 PM update that waited for the chaser batch goes out as soon as the batch is ready. */
function cueK0Retry_() {
  const P = PropertiesService.getScriptProperties(), day = cuePh_(cueNow_()).day;
  if (P.getProperty('CUE_K0_RETRY') !== day) return;
  globalThis.CUE_SCHED_RUNNING_ = true;
  try { cueK0Run_(false, 'pm'); } finally { globalThis.CUE_SCHED_RUNNING_ = false; }
}

/** Today's newest update (8 AM or 2 PM), or null. A reply answers the newest one. */
function cueK0Today_() {
  const day = cuePh_(cueNow_()).day;
  const x = cueRows_(cueSheet_('Requests')).slice(-60).map(r => { try { return JSON.parse(r.slice(10, 10 + CUE_CELLS_).join('')); } catch (e) { return null; } })
    .filter(s => s && s.kind === 'k0' && s.day === day && s.k0).pop();
  return x || null;
}

/* ---------- Kiko's reply ---------- */
const CUE_K0_VERB_ = { draft: 'do', pick: 'do', send: 'do', add: 'do', start: 'do', yes: 'do', ok: 'do', okay: 'do', approve: 'do', go: 'do', no: 'no', skip: 'no', dont: 'no', "don't": 'no' };
/** "send 1, 2, 3 · add 4 · no 5" as [{ verb, all, nums }], or null when the words are not a reply to the update. */
function cueK0Parse_(text) {
  let t = String(text || '').toLowerCase().replace(/[.!]+\s*$/, '').trim();
  if (!t || t.length > 200) return null;
  if (/^(all|everything|#?\d{1,2}(\s*(,|and|&|\s)\s*#?\d{1,2})*)$/.test(t)) t = 'pick ' + t;   // 2 PM: "1, 3" or "all" picks chasers to draft
  const parts = t.split(/\s*(?:·|;|\n|\band\b(?=\s+(?:draft|pick|send|add|start|yes|ok|okay|approve|go|no|skip|dont|don't)\b)|,(?=\s*(?:draft|pick|send|add|start|yes|ok|okay|approve|go|no|skip|dont|don't)\b))\s*/).filter(Boolean);
  const out = [];
  for (const p of parts) {
    const m = p.match(/^(draft|pick|send|add|start|yes|ok|okay|approve|go|no|skip|dont|don't)\s+(?:to\s+)?(all|everything|(?:#?\d{1,2}(?:\s*(?:,|and|&|\s)\s*#?\d{1,2})*))$/);
    if (!m) return null;
    const all = /^(all|everything)$/.test(m[2]), nums = all ? [] : (m[2].match(/\d{1,2}/g) || []).map(Number);
    out.push({ verb: CUE_K0_VERB_[m[1]], word: m[1], all, nums });
  }
  return out.length ? out : null;
}

/** Route (CueCommands.gs cueRoutes_): Kiko's reply to today's update, in the main chat or the update's thread. reply: the update
 * Kiko quoted with Reply on its bubble (CUE-REPLY-BUBBLE-2026-11-01); that update is answered, whatever its day. */
function cueK0Said_(text, ref, reply) {
  const P = cueK0Parse_(text); if (!P) return null;
  let K = null;
  if (reply) { const L = cueLoad_(reply); K = L && L.s.kind === 'k0' && L.s.k0 ? L.s : null; if (!K) return null; }
  else K = cueK0Today_();
  if (!K || (ref && ref !== K.id)) return null;
  const k0 = K.k0, items = k0.items || [], home = ref || '';
  const pick = {};   // item index (0-based) -> 'do' | 'no'
  P.forEach(p => {
    const idx = p.all ? items.map((x, i) => i).filter(i => (p.word !== 'send' && p.word !== 'pick') || items[i].t === 'chase') : p.nums.map(n => n - 1).filter(i => i >= 0 && i < items.length);
    idx.forEach(i => { pick[i] = p.verb; });
  });
  if (!Object.keys(pick).length) return null;
  cueChat_('Kiko', String(text).trim(), reply && !home ? '↩' + K.id : home);   // a quoted reply shows its quote in the main chat
  const said = [], bad = [];
  const want = (t, verb) => Object.keys(pick).map(Number).filter(i => items[i].t === t && pick[i] === verb && !k0.done[i]);
  // Chasers (2 PM): a pick drafts them; nothing is sent. Cue tailors each picked draft to the client's latest email (one AI call) and
  // shows it as a card in the chasers thread with Edit, Tell Cue, Skip and Send (Kiko 1 Nov: "draft it and show it to me for approval").
  const chase = want('chase', 'do');
  if (chase.length && k0.sweep) {
    const keys = chase.map(i => items[i].k);
    try {
      const n = cueK0Pick_(k0.sweep, keys);
      said.push(n + ' chaser' + (n === 1 ? '' : 's') + ' drafted for you to check in the chasers thread (nothing sent yet; each goes when you press Send)');
      chase.forEach(i => { k0.done[i] = 'drafted'; });
    } catch (e) { bad.push('Chasers: ' + cueStr_((e && e.message) || e, 200)); }
  }
  // New contacts: Approve the ones Kiko named with "add"; "no N" drops that person for good; anyone he did not name goes back to the
  // list and comes again in the next 8 AM update (Kiko 1 Nov: "B - until i decline or add").
  const cAdd = want('contact', 'do'), cNo = want('contact', 'no');
  if ((cAdd.length || cNo.length) && k0.ask) {
    const Pp = PropertiesService.getScriptProperties(), raw = cueLocked_(() => { const v = Pp.getProperty('CUE_ASK_' + k0.ask); if (v) Pp.deleteProperty('CUE_ASK_' + k0.ask); return v; });
    if (!raw) bad.push('Contacts: that list was already answered.');
    else {
      const o = JSON.parse(raw), nums = cAdd.map(i => items[i].i), noN = cNo.map(i => items[i].i), skip = (o.emails || []).map((e, i) => i + 1).filter(n => nums.indexOf(n) < 0);
      const keep = (o.emails || []).filter((e, i) => nums.indexOf(i + 1) < 0 && noN.indexOf(i + 1) < 0);
      try { cueCnPick_(o, 'approve', '!' + k0.ask + '@' + K.id, 'skip:' + skip.join(','), keep); if (cAdd.length) said.push(cAdd.length + ' contact' + (cAdd.length === 1 ? '' : 's') + ' sent to Canvas (see the update\'s thread)'); }
      catch (e) { bad.push('Contacts: ' + cueStr_((e && e.message) || e, 200)); }
      if (keep.length) said.push(keep.length + ' new client' + (keep.length === 1 ? '' : 's') + ' left on the list for the next 8 AM update');
      items.forEach((x, i) => { if (x.t === 'contact') k0.done[i] = cAdd.indexOf(i) >= 0 ? 'added' : cNo.indexOf(i) >= 0 ? 'skipped' : 'later'; });
    }
  }
  // Bids: start the intake for each one named.
  want('bid', 'do').forEach(i => {
    try { cueBidsStartIntake(k0.bids, items[i].k); said.push('intake started for bid ' + (i + 1)); k0.done[i] = 'intake'; }
    catch (e) { bad.push('Bid ' + (i + 1) + ': ' + cueStr_((e && e.message) || e, 200)); }
  });
  // Friday updates: send or skip each one named.
  ['do', 'no'].forEach(v => want('status', v).forEach(i => {
    try { cueStApprove_(k0.status, v === 'do' ? { send: items[i].k } : { skip: items[i].k }); if (v === 'do') said.push('Friday update ' + (i + 1) + ' sent'); k0.done[i] = v === 'do' ? 'sent' : 'skipped'; }
    catch (e) { bad.push('Friday update ' + (i + 1) + ': ' + cueStr_((e && e.message) || e, 200)); }
  }));
  // "no N": nothing is done for those; a chaser left out comes back on its next day.
  Object.keys(pick).map(Number).filter(i => pick[i] === 'no' && !k0.done[i]).forEach(i => { k0.done[i] = 'skipped'; });
  const skipped = Object.keys(pick).filter(i => pick[i] === 'no').length;
  cueLocked_(() => { const L = cueLoad_(K.id); if (L) { L.s.k0.done = k0.done; cueSave_(L.sh, L.row, L.s); } });
  cueChat_('Cue', (said.length ? 'Done: ' + said.join(', ') + '.' : 'Nothing done.') + (skipped ? ' Left ' + skipped + ' as you said.' : '')
    + (bad.length ? ' Not done: ' + bad.join('; ') + '.' : ''), home);
  return { chat: true, task: home };
}

/** The chasers Kiko picked in the 2 PM update: marked for one-by-one sending (Send on each card), tailored in one AI call. */
function cueK0Pick_(sweepId, keys) {
  const L = cueLoad_(sweepId); if (!L || L.s.kind !== 'sweep') throw new Error('The chasers are no longer there.');
  const picked = (L.s.batch.items || []).filter(it => keys.indexOf(it.key) >= 0 && !it.sent_id && !it.no_email);
  picked.forEach(it => { it.tap = true; it.picked = true; });
  try { cueSweepTailor_(L.s, picked); } catch (e) { L.s.notes.push('Tailoring: ' + cueStr_((e && e.message) || e, 200)); }
  cueLocked_(() => { const M = cueLoad_(sweepId); M.s.batch = L.s.batch; M.s.notes = L.s.notes; M.s.metrics = L.s.metrics; cueSave_(M.sh, M.row, M.s); });
  if (picked.length) cueChat_('Cue', picked.length + ' chaser' + (picked.length === 1 ? '' : 's') + ' ready for you to check. Edit or Tell Cue what to change, then press Send on each.', sweepId);
  return picked.length;
}
