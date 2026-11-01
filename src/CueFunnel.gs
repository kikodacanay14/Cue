/* CUE-FUNNEL (Kiko 24 Oct 13:50Z "How can we place the funnel in Cue? Or the hubspot action items"; Kiko chose "Yes, build both"
 * 13:56Z; spec canvas-integration/specs/sales-funnel-tasks.md). Two Today rows from one run, no AI call:
 *   - Code reads every deal in HubSpot (stage, amount) and counts them per stage: the sales funnel, "₱X waiting for award".
 *   - Code reads Kiko's open HubSpot tasks and the deal each one is on: the HubSpot action items, overdue first.
 *   - Mark done: one tap closes one task in HubSpot (hs_task_status COMPLETED), then Cue reads it back. Nothing closes in bulk.
 * Deal stage and amount are never changed here: Canvas owns them and its hourly sync writes them. Tasks are HubSpot's own records,
 * so the sync never overwrites a task Kiko marked done. Runs daily at 7:00 (Schedule row sys-funnel) and on "show the funnel".
 * CRM-FUNNEL-CANVAS-2026-10-29 (bug): Canvas stopped syncing HubSpot on 29 Oct (V328, Kiko 02:00:59Z "Turn off hubspot"), so the
 * HubSpot deal stages and amounts froze and this card kept showing them as today's funnel. The counts now come from Canvas's own
 * Sales funnel (bridge read crm_funnel: Inquiry, CE sent, Won, Delivered, Paid, with stuck counts; no amounts, which stay Kiko's in
 * Canvas). "Waiting for award" is the CE sent step. HubSpot deals are still read, but only for the name of the deal each HubSpot
 * task is on; their stage and amount are not used.
 * CRM-P-STAGES-2026-10-29 (Kiko 29 Oct 15:59Z "can you align the Sales Funnel in Ask Cue with the latest that we did"): the card now
 * leads with Canvas's Accounts dashboard (design Kiko approved 29 Oct 11:39Z): the companies per P0 to P9 stage from the P0 tab (contacts
 * for P1 to P3, as the dashboard counts them), and its cards: contacts in outreach (P1 and P2), follow-up emails due (P1 and P2, 3 business
 * days since the last email and no reply, Kiko's CRM rule), accreditations open (P4), projects at risk (P8 and P9) and Canvas follow-ups due
 * by tomorrow. The deal track (Inquiry to Paid) stays under P6 and P7, as on the dashboard. HubSpot tasks are kept as they were.
 * CRM-UPDATES-2026-10-29 (Kiko 29 Oct 16:13Z "it has to be able to give updates not a dashboard. you cant fit a dashboard in a chat
 * window"; 16:14Z "yes." to: what moved since yesterday, what is due today, and a link to Accounts in Canvas): the run keeps each
 * company's P stage and compares it with the last funnel run's, then writes a few plain update lines. The counts and bars stay on
 * Canvas's Accounts dashboard; the thread shows the lines and an Open Accounts in Canvas link. */

const CUE_FUNNEL_MAX_ = { pages: 5, tasks: 100 };   // 500 deals, 100 open tasks: BSE has 73 deals and 22 tasks (24 Oct)
const CUE_FUNNEL_ASK_RE_ = /\b(?:sales\s+)?funnel\b(?![\s\S]{0,20}\breview\b)|\bhub\s?spot\s+(?:tasks?|action\s+items?|to-?dos?)\b|\b(?:tasks?|action\s+items?|to-?dos?)\s+(?:in|from)\s+hub\s?spot\b/i;
const CUE_FUNNEL_STEPS_ = 'Reading HubSpot';   // the stage name older runs saved; the page shows it as reading Canvas
// CRM-P-STAGES-2026-10-29: the P stages and their meanings, as Canvas's Accounts dashboard names them (ClientDesk.html STAGES).
const CUE_FUNNEL_P_ = [['P0', 'Prospecting / validation'], ['P1', 'Intro email sent'], ['P2', 'Following up every 3 business days'], ['P3', 'Parking lot'],
  ['P4', 'Accreditation in progress'], ['P5', 'Accredited, waiting for RFPs'], ['P6', 'RFPs received'], ['P7', 'Active project won'], ['P8', 'Project at risk'],
  ['P9', 'Escalated or has issues']];

function cueFunnelAsked_(t) { t = String(t || ''); return CUE_FUNNEL_ASK_RE_.test(t) && !/\breview\s+(?:the\s+|my\s+)?(?:sales\s+)?funnel\b/i.test(t); }   // "review the funnel" is the Thursday ChatGPT task

/** Starts a funnel run in its own thread. how = 'chat' | 'daily'. */
function cueFunnelStart_(text, how) {
  const now = cueNow_(), d = new Date(now);
  const id = 'cue-' + Utilities.formatDate(d, 'Asia/Manila', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 65536).toString(16).padStart(4, '0');
  const s = { id, version: CUE_VERSION_, kind: 'funnel', how: how || 'chat', created: d.toISOString(), started: now, text: cueStr_(text || 'Sales funnel', 2000), files: [],
    status: 'Working', stage: CUE_FUNNEL_STEPS_, ref: '', fn: { title: 'Sales funnel' }, metrics: { ai_calls: 0, calls: [] }, notes: [] };
  cueLocked_(() => { const sh = cueSheet_('Requests'); sh.appendRow([id]); cueSave_(sh, sh.getLastRow(), s); });
  if (how !== 'daily') cueChat_('Kiko', s.text, '');
  cueChat_('Cue', (how === 'daily' ? 'Daily sales funnel: ' : '') + 'Reading Canvas\'s P0 to P9 accounts, its deals and your HubSpot tasks in its own thread. Nothing is changed by the read.', how === 'daily' && cueK0On_() ? id : '>' + id);   // CUE-K0-2026-10-31 (R2)
  return { request_id: id, task: '' };
}

/** Advances a funnel run: one step, code only. */
function cueFunnelRun_(s, save) {
  if (s.stage === CUE_FUNNEL_STEPS_) { cueFunnelRead_(s); save(); }
}

/* ---------- HubSpot reads (code only) ---------- */
function cueFunnelRead_(s) {
  const F = s.fn;
  // CRM-FUNNEL-CANVAS-2026-10-29: the steps and counts are Canvas's Sales funnel, not HubSpot's frozen stages.
  const cf = cueBridge_(s, 'crm_funnel', {}) || {};
  F.src = 'canvas';
  F.stages = (cf.steps || []).map(x => ({ id: cueStr_(x.step, 80), label: cueStr_(x.step, 80), kind: /^(inquiry|ce sent)$/i.test(String(x.step)) ? 'open' : 'won',
    n: Number(x.count) || 0, amount: 0, no_amount: 0, stuck: Number(x.stuck) || 0 }));
  F.fu_due = (cf.due || []).length;   // Canvas follow-ups due by tomorrow (the morning batch lists them one by one)
  // CRM-P-STAGES-2026-10-29: the P0 tab (through Canvas's read_rows when it is allow-listed, else direct), counted as the dashboard does.
  let p0 = null;
  try { p0 = cueGtTab_('p0', s); } catch (e) { s.notes.push('Could not read the P0 to P9 accounts (' + cueStr_(e.message, 120) + ').'); }
  F.p = p0 ? cueFunnelP_(p0.rows, cueMnlDay_(cueNow_())) : null;
  // CRM-UPDATES-2026-10-29: each company's stage now, against the last funnel run that read one, gives what moved.
  if (p0) {
    F.pmap = cueFunnelPmap_(p0.rows);
    const prev = cueFunnelPrevMap_(s.id);
    F.moves = prev ? cueFunnelMoves_(prev.map, F.pmap) : null;
    F.since = prev ? prev.at : '';
  }
  F.stuck = (cf.stuck || []).slice(0, 40).map(x => ({ step: cueStr_(x.step, 40), client: cueStr_(x.client || x.name, 120), quiet: Number(x.quiet) || 0 }));
  F.due_list = (cf.due || []).slice(0, 40).map(x => ({ client: cueStr_(x.client, 120), what: cueStr_(x.what, 200), due: cueStr_(x.due, 10) }));
  try { F.accounts_url = cueCanvasBase_() + '?page=clientdesk'; } catch (e) { F.accounts_url = ''; }
  const w = F.stages.filter(x => x.id === 'CE sent')[0];
  F.wait = w ? { id: w.id, label: w.label, n: w.n, amount: 0 } : { id: '', label: '', n: 0, amount: 0 };
  F.none = [];
  // HubSpot deals: only to name the deal a HubSpot task is on (a name does not go stale). Stage and amount are left out.
  let deals = [], after = '';
  try {
    for (let page = 0; page < CUE_FUNNEL_MAX_.pages; page++) {
      const o = cueHs_('post', '/crm/v3/objects/deals/search', { limit: 100, after: after || undefined, properties: ['dealname'], sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }] });
      deals = deals.concat(o.results || []);
      after = o.paging && o.paging.next && o.paging.next.after;
      if (!after) break;
    }
  } catch (e) { s.notes.push('Could not read the HubSpot deal names for the tasks (' + cueStr_(e.message, 120) + ').'); }
  F.deals = deals.map(d => ({ id: String(d.id), name: cueStr_((d.properties || {}).dealname, 300), stage: '', amount: 0 }));
  F.portal = cuePortal_();
  cueFunnelTasks_(s);
  F.read_at = new Date(cueNow_()).toISOString();
  F.lines = cueFunnelUpdate_(F);   // CRM-UPDATES-2026-10-29
  const open = (F.tasks || []).filter(t => !t.done).length;
  s.status = F.wait.n || open || (F.p && F.p.due) || F.fu_due || (F.moves && F.moves.length) ? 'Needs you' : 'Done'; s.stage = s.status; s.card_at = cueNow_();
  if (s.status === 'Done') s.ready_at = cueNow_();
  cueMetrics_(s);
  // Each run is a full snapshot, so an older one still waiting is closed (nothing in it was written).
  cueCloseSuperseded_(x => x.kind === 'funnel' && x.id !== s.id, 'Replaced by a newer funnel. Nothing was changed.');
  // CRM-UPDATES-2026-10-29: the update itself, in plain lines (Kiko 16:13Z: updates, not a dashboard).
  // The card below shows every line, so the thread's message carries only the first (Kiko 15:39Z: everything appears once).
  cueChat_('Cue', 'Sales update: ' + F.lines[0] + (F.lines.length > 1 ? ' ' + (F.lines.length - 1) + ' more below.' : ''), s.id);
}

/** CRM-P-STAGES-2026-10-29: companies per P stage from the P0 tab's rows ({ Priority, Company, 'Contact Count', 'Last Outreach Date',
 * 'Reply Status' }), the way Canvas's Accounts dashboard counts them (Code.gs buildFunnel_, ClientDesk.html drawFunnel). Pure: the tests
 * call it directly. A row with no company or no P0 to P9 stage is left out. */
function cueFunnelP_(rows, today) {
  const by = {}; CUE_FUNNEL_P_.forEach(x => { by[x[0]] = { p: x[0], label: x[1], n: 0, contacts: 0 }; });
  const get = (o, k) => { const v = o[k]; return v == null ? '' : v; };
  let due = 0;
  (rows || []).forEach(o => {
    const co = String(get(o, 'Company')).trim(), p = String(get(o, 'Priority')).trim().toUpperCase(), x = by[p];
    if (!co || !x) return;
    x.n++;
    const k = Number(String(get(o, 'Contact Count')).replace(/[^0-9.]/g, '')); if (k > 0) x.contacts += Math.round(k);
    // Kiko's P1 and P2 rule: a follow-up email 3 business days after the last one when there is no reply.
    const lo = cueGtDay_(get(o, 'Last Outreach Date')), rs = String(get(o, 'Reply Status'));
    const replied = /repl|respon/i.test(rs) && !/no repl|no respon|not repl/i.test(rs);
    if ((p === 'P1' || p === 'P2') && lo && lo <= today && !replied && cuePipeWorkDays_(Date.parse(lo + 'T04:00:00Z'), Date.parse(today + 'T04:00:00Z')) >= 3) due++;
  });
  const stages = CUE_FUNNEL_P_.map(x => by[x[0]]);
  const risk_names = (rows || []).filter(o => /^P[89]$/i.test(String(o.Priority || '').trim()) && String(o.Company || '').trim()).map(o => cueStr_(String(o.Company).trim(), 120) + ' (' + String(o.Priority).trim().toUpperCase() + ')');
  return { stages, outreach: by.P1.contacts + by.P2.contacts, due, p4: by.P4.n, risk: by.P8.n + by.P9.n, risk_names, p6: by.P6.n, p7: by.P7.n,
    total: stages.reduce((t, x) => t + x.n, 0) };
}

/** CRM-UPDATES-2026-10-29: { company: 'P4' } from the P0 tab's rows (companies with a P0 to P9 stage only). Pure. */
function cueFunnelPmap_(rows) {
  const m = {}, ok = {}; CUE_FUNNEL_P_.forEach(x => { ok[x[0]] = 1; });
  (rows || []).forEach(o => { const co = cueStr_(String(o.Company == null ? '' : o.Company).trim(), 120), p = String(o.Priority == null ? '' : o.Priority).trim().toUpperCase(); if (co && ok[p]) m[co] = p; });
  return m;
}
/** The newest earlier funnel run that kept a P map: { map, at } or null (the first run has nothing to compare). */
function cueFunnelPrevMap_(id) {
  let best = null;
  cueRows_(cueSheet_('Requests')).forEach(r => {
    if (String(r[0]) === String(id)) return;
    let x = null; try { x = JSON.parse(r.slice(10, 10 + CUE_CELLS_).join('')); } catch (e) { return; }
    if (!x || x.kind !== 'funnel' || x.check || !x.fn || !x.fn.pmap || !x.fn.read_at) return;
    if (!best || x.fn.read_at > best.at) best = { map: x.fn.pmap, at: x.fn.read_at };
  });
  return best;
}
/** What moved between two P maps: [{ company, from, to }], new companies with from ''. Removed companies are left out. Pure. */
function cueFunnelMoves_(before, now) {
  return Object.keys(now).filter(c => before[c] !== now[c]).map(c => ({ company: c, from: before[c] || '', to: now[c] }))
    .sort((a, b) => b.to.localeCompare(a.to) || a.company.localeCompare(b.company));
}
/** CRM-UPDATES-2026-10-29: the update lines Ask Cue shows and posts (a few plain sentences, never a table). Pure: the tests call it. */
function cueFunnelUpdate_(F) {
  const out = [], P = F.p, pl = (n, w, many) => n + ' ' + (n === 1 ? w : many || w + 's');
  const names = (l, k) => l.slice(0, k).join(', ') + (l.length > k ? ' and ' + (l.length - k) + ' more' : '');
  const mv = F.moves;
  if (mv) {
    const real = mv.filter(x => x.from), fresh = mv.filter(x => !x.from);
    out.push(real.length ? pl(real.length, 'company', 'companies') + ' moved: ' + names(real.map(x => x.company + ' ' + x.from + ' to ' + x.to), 4) + '.' : 'No P stage changes since the last update.');
    if (fresh.length) out.push(pl(fresh.length, 'new company', 'new companies') + ' on the list: ' + names(fresh.map(x => x.company + ' (' + x.to + ')'), 3) + '.');
  }
  if (P && P.due) out.push(pl(P.due, 'follow-up email') + ' due (P1 and P2, 3 business days with no reply).');
  const du = F.due_list || [];
  if (du.length) out.push(pl(du.length, 'follow-up') + ' due by tomorrow: ' + names(du.map(x => x.client || x.what), 3) + '.');
  const w = F.wait || {}, st = F.stuck || [];
  if (w.n || st.length) out.push([w.n ? pl(w.n, 'deal') + ' waiting for award' : '', st.length ? pl(st.length, 'deal') + ' gone quiet: ' + names(st.map(x => x.client + ' (' + x.step + ', ' + x.quiet + ' days)'), 3) : ''].filter(Boolean).join('; ') + '.');
  if (P && P.risk) out.push(pl(P.risk, 'project') + ' at risk or escalated: ' + names(P.risk_names || [], 3) + '.');
  if (!out.length) out.push('Nothing new in Accounts today.');
  return out;
}

/** Counts and totals per stage, in pipeline order. Pure: the tests call it directly. Empty open stages stay in the list (n 0) so the
 * page can say "none right now"; deals with no stage are listed by name, since the funnel cannot place them. */
function cueFunnelCount_(stages, deals) {
  const rows = stages.map(st => ({ id: st.id, label: st.label, kind: st.kind, n: 0, amount: 0, no_amount: 0 })), by = {};
  rows.forEach(r => { by[r.id] = r; });
  const none = [];
  deals.forEach(d => { const r = by[d.stage]; if (!r) { none.push({ id: d.id, name: d.name, amount: d.amount }); return; } r.n++; r.amount = cueR2_(r.amount + d.amount); if (!d.amount) r.no_amount++; });
  // "Waiting for award": the open stage that names award or PO, else the last open stage.
  const open = rows.filter(r => r.kind === 'open'), w = open.filter(r => /award|\bpo\b/i.test(r.label)).pop() || open[open.length - 1] || null;
  return { stages: rows, none, wait: w ? { id: w.id, label: w.label, n: w.n, amount: w.amount } : { id: '', label: '', n: 0, amount: 0 } };
}

/** Kiko's open HubSpot tasks with the deal each one is on. A key without the tasks scope leaves the funnel working and says so. */
function cueFunnelTasks_(s) {
  const F = s.fn;
  const res = UrlFetchApp.fetch(CUE_HS_ + '/crm/v3/objects/tasks/search', cueHsReq_('post', { limit: CUE_FUNNEL_MAX_.tasks, properties: ['hs_task_subject', 'hs_task_status', 'hs_timestamp', 'hs_task_priority'],
    filterGroups: [{ filters: [{ propertyName: 'hs_task_status', operator: 'NEQ', value: 'COMPLETED' }] }], sorts: [{ propertyName: 'hs_timestamp', direction: 'ASCENDING' }] }));
  const code = res.getResponseCode();
  if (code === 401 || code === 403) { F.tasks = []; F.task_error = 'The HubSpot key "Cue" cannot read tasks yet. Add the tasks read and write scopes to it in HubSpot (Development > Keys).'; return; }
  const list = cueHsParse_(res).results || [];
  const ids = list.map(t => String(t.id)), deal = {};
  if (ids.length) {
    try {
      (cueHs_('post', '/crm/v4/associations/tasks/deals/batch/read', { inputs: ids.map(id => ({ id })) }).results || [])
        .forEach(r => { const to = (r.to || [])[0]; if (to) deal[String(r.from && r.from.id)] = String(to.toObjectId); });
    } catch (e) { s.notes.push('Could not read which deal each task is on (' + cueStr_(e.message, 120) + ').'); }
  }
  const dBy = {}, sBy = {}; (F.deals || []).forEach(d => { dBy[d.id] = d; }); (F.stages || []).forEach(x => { sBy[x.id] = x; });
  F.task_error = '';
  F.tasks = list.map(t => {
    const p = t.properties || {}, d = dBy[deal[String(t.id)]] || null, subj = cueStr_(p.hs_task_subject, 300) || '(no subject)';
    return { id: String(t.id), subject: subj, due: Date.parse(p.hs_timestamp || '') || 0, priority: cueStr_(p.hs_task_priority, 20),
      deal_id: d ? d.id : '', deal: d ? d.name : '', amount: d ? d.amount : 0, stage: d && sBy[d.stage] ? sBy[d.stage].label : '',
      group: d || /^follow\s*up\b/i.test(subj) ? 'deal' : /company category/i.test(subj) ? 'category' : 'other', done: false, error: '' };
  }).sort((a, b) => (a.due || 9e15) - (b.due || 9e15));
}

/* ---------- Kiko: mark one task done ---------- */
/** Closes one HubSpot task (Kiko tapped Mark done on it), then reads it back. Only that task changes. */
function cueFunnelTaskDone(id, taskId) {
  cueOwner_();
  const L = cueLocked_(() => {
    const L = cueLoad_(id);
    if (!L || L.s.kind !== 'funnel') throw new Error('No such funnel.');
    const t = ((L.s.fn || {}).tasks || []).filter(x => x.id === String(taskId))[0];
    if (!t) throw new Error('That task is not on this list.');
    return L;
  });
  const t = L.s.fn.tasks.filter(x => x.id === String(taskId))[0];
  if (!t.done) {
    const path = '/crm/v3/objects/tasks/' + encodeURIComponent(t.id);
    const res = UrlFetchApp.fetch(CUE_HS_ + path, cueHsReq_('patch', { properties: { hs_task_status: 'COMPLETED' } })), code = res.getResponseCode();
    if (code === 401 || code === 403) t.error = 'The HubSpot key "Cue" cannot change tasks. Add the tasks write scope to it in HubSpot (Development > Keys).';
    else if (code !== 200) t.error = 'HubSpot said HTTP ' + code + '. The task was not changed.';
    else {
      let back = ''; try { back = String(((cueHs_('get', path + '?properties=hs_task_status').properties) || {}).hs_task_status || ''); } catch (e) { back = ''; }
      if (back === 'COMPLETED') { t.done = true; t.error = ''; t.done_at = new Date(cueNow_()).toISOString(); }
      else t.error = 'HubSpot took the change but reads back "' + (back || 'nothing') + '". Check the task in HubSpot.';
    }
  }
  const s = cueLocked_(() => {
    const M = cueLoad_(id), x = M.s.fn.tasks.filter(y => y.id === t.id)[0];
    Object.assign(x, { done: t.done, error: t.error, done_at: t.done_at || '' });
    if (M.s.status === 'Needs you' && !M.s.fn.wait.n && M.s.fn.tasks.every(y => y.done)) Object.assign(M.s, { status: 'Done', stage: 'Done', ready_at: cueNow_() });
    cueSave_(M.sh, M.row, M.s); return M.s;
  });
  if (t.done) cueChat_('Cue', 'Marked done in HubSpot: ' + t.subject + '. Nothing else changed.', id);
  return cueView_(s);
}

/** Kiko is done looking. Nothing is written. */
function cueFunnelDone(id) {
  cueOwner_();
  const s = cueLocked_(() => {
    const L = cueLoad_(id);
    if (!L || L.s.kind !== 'funnel') throw new Error('No such funnel.');
    if (L.s.status === 'Needs you') { Object.assign(L.s, { status: 'Done', stage: 'Done', ready_at: L.s.ready_at || cueNow_() }); cueMetrics_(L.s); cueSave_(L.sh, L.row, L.s); }
    return L.s;
  });
  return cueView_(s);
}

/* ---------- words and the page ---------- */
/** ₱10.2M, ₱420k, ₱5,000. */
function cueFunnelPeso_(v) {
  v = Number(v) || 0;
  if (v >= 1e6) return '₱' + (Math.round(v / 1e5) / 10) + 'M';
  if (v >= 1e4) return '₱' + Math.round(v / 1e3) + 'k';
  return '₱' + Math.round(v).toLocaleString('en-US');
}
/** One line per stage that has deals: "2 Inquiry / RFP received · 20 Awaiting award / PO ₱10.2M · 20 won ₱4.2M · 28 lost". */
function cueFunnelLine_(F) {
  // CRM-FUNNEL-CANVAS-2026-10-29: Canvas's steps keep their own names ("2 Inquiry (1 stuck) · 12 CE sent · 5 Won").
  if (F.src === 'canvas') {
    const deals = (F.stages || []).filter(x => x.n).map(x => x.n + ' ' + x.label + (x.stuck ? ' (' + x.stuck + ' stuck)' : '')).join(' · ') || 'no open deals';
    // CRM-P-STAGES-2026-10-29: the P stages first, then the deal track ("P0 212 · P1 96 ... · deals: 4 Inquiry · 1 CE sent").
    return F.p ? F.p.stages.filter(x => x.n).map(x => x.p + ' ' + x.n).join(' · ') + ' · deals: ' + deals : deals;
  }
  const parts = (F.stages || []).filter(x => x.n).map(x => x.n + ' ' + (x.kind === 'won' ? 'won' : x.kind === 'lost' ? 'lost' : x.label) + (x.amount && x.kind !== 'lost' ? ' ' + cueFunnelPeso_(x.amount) : ''));
  if ((F.none || []).length) parts.push(F.none.length + ' with no stage');
  return parts.join(' · ') || 'no deals in HubSpot';
}

/** What the page needs. */
function cueFunnelView_(s) {
  const F = s.fn || {}, P = F.portal || '';
  const link = id => P ? 'https://app.hubspot.com/contacts/' + P + '/record/0-3/' + id : '';
  const today = cueMnlDay_(cueNow_());
  return { src: F.src || 'hubspot', title: F.title || 'Sales funnel and HubSpot tasks', lines: F.lines || null, accounts_url: F.accounts_url || '', p: F.p || null, read: F.read_at ? new Date(Date.parse(F.read_at) + CUE_MNL_).toISOString().slice(11, 16) : '', line: F.stages ? cueFunnelLine_(F) : '', wait: F.wait || null,
    stages: (F.stages || []).map(x => ({ id: x.id, label: x.label, kind: x.kind, n: x.n, amount: x.amount, no_amount: x.no_amount, stuck: x.stuck || 0 })),
    none: (F.none || []).map(d => ({ name: d.name, amount: d.amount, url: link(d.id) })),
    deals: (F.deals || []).filter(d => d.stage).slice().sort((a, b) => b.amount - a.amount).map(d => ({ id: d.id, name: d.name, stage: d.stage, amount: d.amount, url: link(d.id),
      tasks: (F.tasks || []).filter(t => t.deal_id === d.id && !t.done).map(t => t.id) })),
    tasks: (F.tasks || []).map(t => { const day = t.due ? cueMnlDay_(t.due) : ''; return { id: t.id, subject: t.subject, due: day,
      late: day && day < today ? Math.round((Date.parse(today + 'T00:00:00Z') - Date.parse(day + 'T00:00:00Z')) / CUE_DAY_) : 0,
      deal: t.deal, deal_url: t.deal_id ? link(t.deal_id) : '', amount: t.amount, stage: t.stage, group: t.group, done: !!t.done, error: t.error || '',
      url: P ? 'https://app.hubspot.com/tasks/' + P + '/view/all/task/' + t.id : '' }; }),
    task_error: F.task_error || '' };
}

/** The Today rows (CueToday.gs): the funnel, and the tasks when any are open. From the page's view of the run. */
function cueFunnelToday_(r, row) {
  const F = r.fn || {}, w = F.wait || {}, open = (F.tasks || []).filter(t => !t.done), late = open.filter(t => t.late > 0);
  // PC check 24 Oct 14:29Z: "#fn-" opens the thread at this run's funnel card. PC recheck 15:00Z: the tasks open in their own pane
  // tab, "hst:<run>" (Index.html thOf), instead of a jump inside the funnel thread.
  const at = spot => (r.root || r.id) + '#' + spot + '-' + r.id, tasksTab = 'hst:' + r.id;
  // CRM-P-STAGES-2026-10-29: with the P stages read, the row leads with the dashboard's first job: follow-up emails due, else contacts in outreach.
  // CRM-UPDATES-2026-10-29: with update lines, the row is the update: its first line as the title, the next two as the detail.
  const L = F.lines || [];
  const out = [row(L.length ? { eyebrow: 'Sales update · from Canvas Accounts', title: L[0].replace(/\.$/, ''), detail: L.slice(1, 3).join(' '), button: 'Open update', thread: at('fn') }
    : { eyebrow: 'Sales funnel · from ' + (F.src === 'canvas' ? 'Canvas' : 'HubSpot'), title: w.amount ? cueFunnelPeso_(w.amount) + ' waiting for award' : (w.n || 0) + ' deal' + (w.n === 1 ? '' : 's') + ' waiting for award',
    detail: F.line || '', button: 'Open funnel', thread: at('fn') })];
  if (F.task_error) out.push(row({ eyebrow: 'HubSpot tasks', title: 'HubSpot tasks need a key change', detail: F.task_error, button: 'Open', thread: tasksTab }));
  else if (open.length) out.push(row({ eyebrow: 'HubSpot tasks · yours', title: late.length ? late.length + ' task' + (late.length === 1 ? '' : 's') + ' overdue' : open.length + ' open task' + (open.length === 1 ? '' : 's'),
    detail: open.slice(0, 2).map(t => t.subject.replace(/^Follow up on pending decision\s*[—–-]\s*/i, 'Follow up: ')).join(' · ') + (open.length > 2 ? ' and ' + (open.length - 2) + ' more' : ''), button: 'Review tasks', thread: tasksTab }));
  return out;
}
