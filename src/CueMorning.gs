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
 * No AI call: everything comes from what the 07:00 runs and Cue's tasks already hold. The personal-task levels fill from the Shared
 * Task Tracker in part 4 of the spec; until then they are left out (R1). The 8 AM update is the Schedule row sys-k0: turning it off
 * in Cue Admin brings back the old posts. */

const CUE_K0_ = { look: 160, max_ok: 60, retry_until: 10 };   // requests read; numbered lines at most; retry while the batch drafts, until 10:00
const CUE_K0_JOB_KINDS_ = { sweep: 1, bids: 1, hubspot: 1, status: 1, pipeline: 1, funnel: 1, gtask: 1, relnotes: 1, k0: 1 };

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
const cueK0Title_ = day => { const d = new Date(Date.parse(day + 'T12:00:00+08:00')); return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getUTCDay()]
  + ', ' + d.getUTCDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()] + ' · your 8 AM update'; };

/** The saved requests Cue reads for the update: [{ s, updated }] (updated = the row's Updated cell, ms). */
function cueK0Rows_() {
  return cueRows_(cueSheet_('Requests')).slice(-CUE_K0_.look).map(r => { let s = null; try { s = JSON.parse(r.slice(10, 10 + CUE_CELLS_).join('')); } catch (e) { s = null; }
    return s ? { s, updated: r[9] instanceof Date ? r[9].getTime() : Date.parse(r[9]) || 0 } : null; }).filter(Boolean);
}

/** Builds the update for one Manila day. Pure apart from reads: the tests call it directly. Returns { title, text, items, lines }. */
function cueK0Build_(day, contacts) {
  const rows = cueK0Rows_(), yday = cueK0Day_(day, -1), dayOf = ms => ms ? cuePh_(ms).day : '';
  const made = x => dayOf(Date.parse(x.s.created) || 0);
  const latest = (kind, d) => rows.filter(x => x.s.kind === kind && made(x) === d && !x.s.check).map(x => x.s).pop() || null;
  const sweep = latest('sweep', day), bids = latest('bids', day), status = latest('status', day), funnel = latest('funnel', day);
  const items = [], ok = [], add = (o, line) => { if (items.length >= CUE_K0_.max_ok) return; items.push(o); ok.push(line); };
  const crit = [], ydone = { projects: [], opps: [], company: [] }, today = { assigned: [], review: [], follow: [], blocked: [] };

  // Critical today: anything with a clock today (task reminders and Kiko's own scheduled reminders).
  rows.forEach(x => { const r = Number(x.s.remind_at) || 0; if (r && dayOf(r) === day && !x.s.archived) crit.push([r, cueK0Time_(r) + ': ' + cueTaskName_(x.s)]); });
  try { const sh = cueSheet_(CUE_SCHED_TAB_); if (sh) cueSchedRead_(sh).filter(x => x.run === 'remind' && x.on && x.next && dayOf(x.next) === day)
    .forEach(x => crit.push([x.next, cueK0Time_(x.next) + ': ' + x.command.replace(/^remind\s+me\s+(?:to\s+|about\s+|that\s+)?/i, '')])); } catch (e) { console.warn('K0 reminders: ' + e); }
  crit.sort((a, b) => a[0] - b[0]);

  // Today's work: Cue's own open tasks (one per thread), by due date and state.
  const by = {}; rows.forEach(x => { by[x.s.id] = x.s; });
  const root = id => { for (let i = 0; i < 8 && by[id] && by[id].ref; i++) id = by[id].ref; return id; };
  const seen = {};
  rows.forEach(x => {
    const s = x.s; if (CUE_K0_JOB_KINDS_[s.kind] || s.archived || s.check) return;
    const r = root(s.id), R = by[r] || s; if (seen[r] || R.archived) return;
    const open = rows.some(y => root(y.s.id) === r && ['Done', 'Rejected', 'Closed'].indexOf(y.s.status) < 0);
    if (!open) return; seen[r] = 1;
    const name = cueTaskName_(R), due = String(R.due || ''), waiting = rows.some(y => root(y.s.id) === r && y.s.status === 'Needs you');
    if (waiting) today.review.push(name + (due ? ' (due ' + due + ')' : ''));
    else if (due && due < day) today.follow.push(name + ': overdue since ' + due);
    else if (due === day) today.assigned.push(name + ': due today');
  });

  // The 07:00 morning batch: chaser drafts for Kiko's OK, the rest as follow-ups, the ones chased the max times as blocked.
  if (sweep && sweep.batch) {
    const b = sweep.batch, settled = !!b.approved_at || sweep.status !== 'Needs you';
    (b.items || []).filter(it => !it.removed).forEach(it => {
      const what = [it.label ? it.label.replace(/s$/, '') : 'Chaser', it.who ? 'to ' + it.who : '', it.project ? '(' + it.project + ')' : ''].filter(Boolean).join(' ');
      if (it.kind === 'tasks') return;   // Cue's own tasks are listed above, from the tasks themselves
      if (!it.no_email && !it.tap && it.send_ok && !settled) add({ t: 'chase', k: it.key }, what + (it.why ? ': ' + it.why : ''));
      else if (!it.no_email && it.send_ok && settled) return;   // already handled from the batch
      else today.follow.push(what + (it.why ? ': ' + it.why : ''));
    });
    (b.stopped || []).forEach(it => today.blocked.push((it.who || it.project || 'Someone') + (it.project && it.who ? ' (' + it.project + ')' : '') + ': chased ' + (it.times || 0) + ' times, no reply'));
  }
  // The sales funnel's lines are follow-ups.
  if (funnel && funnel.fn && (funnel.fn.lines || []).length) funnel.fn.lines.forEach(l => today.follow.push(String(l)));
  // New contacts on the open card (made by cueK0Run_ inside the update's thread).
  (contacts && contacts.people || []).forEach((p, i) => add({ t: 'contact', e: p.email, i: i + 1 }, 'Add contact: ' + [p.name || p.email.split('@')[0], p.title, p.company].filter(Boolean).join(', ') + ' (' + p.email + ')'));
  // The bid check's new notices: start an intake or not.
  if (bids && bids.bids && bids.status === 'Needs you') (bids.bids.items || []).forEach(it => add({ t: 'bid', k: it.key },
    'Bid: ' + [it.project || it.reference, it.agency].filter(Boolean).join(', ') + (it.deadline ? ', closes ' + it.deadline : '') + ': start intake?'));
  // Friday: one client update per event.
  if (status && status.st && status.status === 'Needs you') (status.st.mails || []).filter(m => !m.sent_id && !m.skipped).forEach(m => add({ t: 'status', k: m.k },
    'Friday update: ' + (m.name || 'event') + (m.to ? ' to ' + m.to : ' (no client email in Canvas: reply "to <email>" in its thread)')));

  // Yesterday's summary: what Cue's threads, chasers, bids and contacts show for that day.
  const proj = {};
  rows.forEach(x => { const s = x.s; if (CUE_K0_JOB_KINDS_[s.kind] || s.check || dayOf(x.updated) !== yday) return; const n = cueTaskName_(by[root(s.id)] || s); proj[n] = (proj[n] || 0) + 1; });
  Object.keys(proj).forEach(n => ydone.projects.push(n));
  const sent = {}; rows.filter(x => x.s.kind === 'sweep' && x.s.batch).forEach(x => (x.s.batch.items || []).forEach(it => { if (it.sent_at && dayOf(Date.parse(it.sent_at)) === yday) sent[it.label || 'chasers'] = (sent[it.label || 'chasers'] || 0) + 1; }));
  if (Object.keys(sent).length) ydone.projects.push('Chasers sent: ' + Object.keys(sent).map(k => sent[k] + ' ' + k).join(', '));
  const ybids = latest('bids', yday);
  if (ybids && ybids.bids && (ybids.bids.items || []).length) ydone.opps.push('Bids found: ' + ybids.bids.items.slice(0, 4).map(it => it.project || it.reference).filter(Boolean).join(', ') + (ybids.bids.items.length > 4 ? ' and ' + (ybids.bids.items.length - 4) + ' more' : ''));
  if (contacts && contacts.added_yday) ydone.opps.push('Contacts added to Canvas: ' + contacts.added_yday);
  const rn = latest('relnotes', yday);
  if (rn && rn.rn && (rn.rn.lines || rn.rn.items || []).length) ydone.company.push('Canvas and Cue: ' + (rn.rn.lines || rn.rn.items).slice(0, 4).map(l => typeof l === 'string' ? l : l.text || l.title || '').filter(Boolean).join('; '));

  // The message (R1: a level with nothing in it is left out).
  const out = [], sec = (h, list) => { if (list.length) { out.push('', h); list.forEach(l => out.push(l)); } };
  const lvl = (h, list) => list.length ? ['- ' + h].concat(list.map(l => '  - ' + l)) : [];
  sec('Critical today', crit.map(c => '- ' + c[1]));
  sec('Yesterday\'s summary', [].concat(lvl('Project tasks worked on', ydone.projects), lvl('New opportunities and clients', ydone.opps), lvl('Company', ydone.company)));
  sec('Today\'s work', [].concat(lvl('Assigned to you', today.assigned), lvl('Needs your review or approval', today.review), lvl('Time to follow up', today.follow),
    lvl('Blocked, waiting on someone', today.blocked)));
  if (ok.length) sec('For your OK (reply "send all", "send 1, 3", "add 4", "start 6" or "no 2")', ok.map((l, i) => (i + 1) + '. ' + l));
  const title = cueK0Title_(day);
  if (!out.length) out.push('', 'Nothing needs you this morning.');
  return { title, text: title + '\n' + out.join('\n'), items, sweep: sweep && !sweep.batch.approved_at ? sweep.id : '', bids: bids ? bids.id : '', status: status ? status.id : '' };
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

/** The Schedule row sys-k0 (08:00 daily). Posts the update once a day; while the 07:00 batch is still drafting it waits (cueK0Retry_). */
function cueK0Run_(manual) {
  const P = PropertiesService.getScriptProperties(), now = cueNow_(), day = cuePh_(now).day;
  if (!manual && P.getProperty('CUE_K0_DAY') === day) return { skip: 'Already sent today' };
  const sw = cueK0Rows_().filter(x => x.s.kind === 'sweep' && cuePh_(Date.parse(x.s.created) || 0).day === day).map(x => x.s).pop();
  if (!manual && sw && ['Working', 'Making drafts'].indexOf(sw.status) >= 0 && cuePh_(now).hour < CUE_K0_.retry_until) { P.setProperty('CUE_K0_RETRY', day); return { skip: 'Waiting for the morning batch' }; }
  P.deleteProperty('CUE_K0_RETRY'); P.setProperty('CUE_K0_DAY', day);
  const d = new Date(now), id = 'cue-' + Utilities.formatDate(d, 'Asia/Manila', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 65536).toString(16).padStart(4, '0');
  const s = { id, version: CUE_VERSION_, kind: 'k0', created: d.toISOString(), started: now, text: cueK0Title_(day), files: [], status: 'Done', stage: 'Done', ref: '', day,
    metrics: { ai_calls: 0, calls: [], canvas: [] }, notes: [] };
  cueLocked_(() => { const sh = cueSheet_('Requests'); sh.appendRow([id]); cueSave_(sh, sh.getLastRow(), s); });
  let contacts = { people: [] };
  try { contacts = cueK0Contacts_(s); } catch (e) { s.notes.push('New contacts: ' + cueStr_((e && e.message) || e, 200)); }
  const K = cueK0Build_(day, contacts);
  s.k0 = { title: K.title, day, items: K.items, sweep: K.sweep, bids: K.bids, status: K.status, ask: contacts.ask || '', done: {} };
  cueLocked_(() => { const L = cueLoad_(id); L.s.k0 = s.k0; L.s.notes = s.notes; cueSave_(L.sh, L.row, L.s); });
  cueChat_('Cue', K.text, '>' + id);
  return { request_id: id, items: K.items.length };
}
/** From cueResume: the update that waited for the morning batch goes out as soon as the batch is ready (or at 10:00 at the latest). */
function cueK0Retry_() {
  const P = PropertiesService.getScriptProperties(), day = cuePh_(cueNow_()).day;
  if (P.getProperty('CUE_K0_RETRY') !== day) return;
  globalThis.CUE_SCHED_RUNNING_ = true;
  try { cueK0Run_(false); } finally { globalThis.CUE_SCHED_RUNNING_ = false; }
}

/** Today's update (the newest kind k0 request of the day), or null. */
function cueK0Today_() {
  const day = cuePh_(cueNow_()).day;
  const x = cueRows_(cueSheet_('Requests')).slice(-60).map(r => { try { return JSON.parse(r.slice(10, 10 + CUE_CELLS_).join('')); } catch (e) { return null; } })
    .filter(s => s && s.kind === 'k0' && s.day === day && s.k0).pop();
  return x || null;
}

/* ---------- Kiko's reply ---------- */
const CUE_K0_VERB_ = { send: 'do', add: 'do', start: 'do', yes: 'do', ok: 'do', okay: 'do', approve: 'do', go: 'do', no: 'no', skip: 'no', dont: 'no', "don't": 'no' };
/** "send 1, 2, 3 · add 4 · no 5" as [{ verb, all, nums }], or null when the words are not a reply to the update. */
function cueK0Parse_(text) {
  const t = String(text || '').toLowerCase().replace(/[.!]+\s*$/, '').trim();
  if (!t || t.length > 200) return null;
  const parts = t.split(/\s*(?:·|;|\n|\band\b(?=\s+(?:send|add|start|yes|ok|okay|approve|go|no|skip|dont|don't)\b)|,(?=\s*(?:send|add|start|yes|ok|okay|approve|go|no|skip|dont|don't)\b))\s*/).filter(Boolean);
  const out = [];
  for (const p of parts) {
    const m = p.match(/^(send|add|start|yes|ok|okay|approve|go|no|skip|dont|don't)\s+(?:to\s+)?(all|everything|(?:#?\d{1,2}(?:\s*(?:,|and|&|\s)\s*#?\d{1,2})*))$/);
    if (!m) return null;
    const all = /^(all|everything)$/.test(m[2]), nums = all ? [] : (m[2].match(/\d{1,2}/g) || []).map(Number);
    out.push({ verb: CUE_K0_VERB_[m[1]], word: m[1], all, nums });
  }
  return out.length ? out : null;
}

/** Route (CueCommands.gs cueRoutes_): Kiko's reply to today's update, in the main chat or the update's thread. */
function cueK0Said_(text, ref) {
  const P = cueK0Parse_(text); if (!P) return null;
  const K = cueK0Today_(); if (!K || (ref && ref !== K.id)) return null;
  const k0 = K.k0, items = k0.items || [], home = ref || '';
  const pick = {};   // item index (0-based) -> 'do' | 'no'
  P.forEach(p => {
    const idx = p.all ? items.map((x, i) => i).filter(i => p.word !== 'send' || items[i].t === 'chase') : p.nums.map(n => n - 1).filter(i => i >= 0 && i < items.length);
    idx.forEach(i => { pick[i] = p.verb; });
  });
  if (!Object.keys(pick).length) return null;
  cueChat_('Kiko', String(text).trim(), home);
  const said = [], bad = [];
  const want = (t, verb) => Object.keys(pick).map(Number).filter(i => items[i].t === t && pick[i] === verb && !k0.done[i]);
  // Chasers: one approval for the whole batch, sent now. The ones Kiko did not pick are skipped today and come back on their next day.
  const chase = want('chase', 'do');
  if (chase.length && k0.sweep) {
    const keys = chase.map(i => items[i].k), skip = items.filter(x => x.t === 'chase' && keys.indexOf(x.k) < 0).map(x => x.k);
    try {
      const s = cueSweepApprove_(k0.sweep, { send: true, skip, only: keys, now: true }), b = s.batch, mine = b.items.filter(it => keys.indexOf(it.key) >= 0);
      const ok = mine.filter(it => it.sent_id).length, err = mine.filter(it => it.error);
      if (ok) said.push(ok + ' chaser' + (ok === 1 ? '' : 's') + ' sent');
      err.forEach(it => bad.push((it.who || it.key) + ': ' + it.error));
      chase.forEach(i => { k0.done[i] = 'sent'; });
      items.forEach((x, i) => { if (x.t === 'chase' && !k0.done[i]) k0.done[i] = 'skipped'; });
    } catch (e) { bad.push('Chasers: ' + cueStr_((e && e.message) || e, 200)); }
  }
  // New contacts: Approve with the ones Kiko did not name left out.
  const cAdd = want('contact', 'do');
  if (cAdd.length && k0.ask) {
    const Pp = PropertiesService.getScriptProperties(), raw = cueLocked_(() => { const v = Pp.getProperty('CUE_ASK_' + k0.ask); if (v) Pp.deleteProperty('CUE_ASK_' + k0.ask); return v; });
    if (!raw) bad.push('Contacts: that list was already answered.');
    else {
      const o = JSON.parse(raw), nums = cAdd.map(i => items[i].i), skip = (o.emails || []).map((e, i) => i + 1).filter(n => nums.indexOf(n) < 0);
      try { cueCnPick_(o, 'approve', '!' + k0.ask + '@' + K.id, 'skip:' + skip.join(',')); said.push(cAdd.length + ' contact' + (cAdd.length === 1 ? '' : 's') + ' sent to Canvas (see the update\'s thread)'); }
      catch (e) { bad.push('Contacts: ' + cueStr_((e && e.message) || e, 200)); }
      items.forEach((x, i) => { if (x.t === 'contact') k0.done[i] = cAdd.indexOf(i) >= 0 ? 'added' : 'skipped'; });
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
  cueChat_('Cue', (said.length ? 'Done: ' + said.join(', ') + '.' : 'Nothing sent.') + (skipped ? ' Left ' + skipped + ' as you said.' : '')
    + (bad.length ? ' Not done: ' + bad.join('; ') + '.' : ''), home);
  return { chat: true, task: home };
}
