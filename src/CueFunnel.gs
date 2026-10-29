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
 * task is on; their stage and amount are not used. */

const CUE_FUNNEL_MAX_ = { pages: 5, tasks: 100 };   // 500 deals, 100 open tasks: BSE has 73 deals and 22 tasks (24 Oct)
const CUE_FUNNEL_ASK_RE_ = /\b(?:sales\s+)?funnel\b(?![\s\S]{0,20}\breview\b)|\bhub\s?spot\s+(?:tasks?|action\s+items?|to-?dos?)\b|\b(?:tasks?|action\s+items?|to-?dos?)\s+(?:in|from)\s+hub\s?spot\b/i;
const CUE_FUNNEL_STEPS_ = 'Reading HubSpot';

function cueFunnelAsked_(t) { t = String(t || ''); return CUE_FUNNEL_ASK_RE_.test(t) && !/\breview\s+(?:the\s+|my\s+)?(?:sales\s+)?funnel\b/i.test(t); }   // "review the funnel" is the Thursday ChatGPT task

/** Starts a funnel run in its own thread. how = 'chat' | 'daily'. */
function cueFunnelStart_(text, how) {
  const now = cueNow_(), d = new Date(now);
  const id = 'cue-' + Utilities.formatDate(d, 'Asia/Manila', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 65536).toString(16).padStart(4, '0');
  const s = { id, version: CUE_VERSION_, kind: 'funnel', how: how || 'chat', created: d.toISOString(), started: now, text: cueStr_(text || 'Sales funnel', 2000), files: [],
    status: 'Working', stage: CUE_FUNNEL_STEPS_, ref: '', fn: { title: 'Sales funnel and HubSpot tasks' }, metrics: { ai_calls: 0, calls: [] }, notes: [] };
  cueLocked_(() => { const sh = cueSheet_('Requests'); sh.appendRow([id]); cueSave_(sh, sh.getLastRow(), s); });
  if (how !== 'daily') cueChat_('Kiko', s.text, '');
  cueChat_('Cue', (how === 'daily' ? 'Daily sales funnel: ' : '') + 'Reading Canvas\'s sales funnel and your HubSpot tasks in its own thread. Nothing is changed by the read.', '>' + id);
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
  const open = (F.tasks || []).filter(t => !t.done).length;
  s.status = F.wait.n || open ? 'Needs you' : 'Done'; s.stage = s.status; s.card_at = cueNow_();
  if (s.status === 'Done') s.ready_at = cueNow_();
  cueMetrics_(s);
  // Each run is a full snapshot, so an older one still waiting is closed (nothing in it was written).
  cueCloseSuperseded_(x => x.kind === 'funnel' && x.id !== s.id, 'Replaced by a newer funnel. Nothing was changed.');
  cueChat_('Cue', 'Funnel ready: ' + cueFunnelLine_(F) + '.' + (F.task_error ? ' ' + F.task_error : ' ' + open + ' open HubSpot task' + (open === 1 ? '' : 's') + '.'), s.id);
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
  if (F.src === 'canvas') return (F.stages || []).filter(x => x.n).map(x => x.n + ' ' + x.label + (x.stuck ? ' (' + x.stuck + ' stuck)' : '')).join(' · ') || 'no deals in Canvas\'s sales funnel';
  const parts = (F.stages || []).filter(x => x.n).map(x => x.n + ' ' + (x.kind === 'won' ? 'won' : x.kind === 'lost' ? 'lost' : x.label) + (x.amount && x.kind !== 'lost' ? ' ' + cueFunnelPeso_(x.amount) : ''));
  if ((F.none || []).length) parts.push(F.none.length + ' with no stage');
  return parts.join(' · ') || 'no deals in HubSpot';
}

/** What the page needs. */
function cueFunnelView_(s) {
  const F = s.fn || {}, P = F.portal || '';
  const link = id => P ? 'https://app.hubspot.com/contacts/' + P + '/record/0-3/' + id : '';
  const today = cueMnlDay_(cueNow_());
  return { src: F.src || 'hubspot', title: F.title || 'Sales funnel and HubSpot tasks', read: F.read_at ? new Date(Date.parse(F.read_at) + CUE_MNL_).toISOString().slice(11, 16) : '', line: F.stages ? cueFunnelLine_(F) : '', wait: F.wait || null,
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
  const out = [row({ eyebrow: 'Sales funnel · from ' + (F.src === 'canvas' ? 'Canvas' : 'HubSpot'), title: w.amount ? cueFunnelPeso_(w.amount) + ' waiting for award' : (w.n || 0) + ' deal' + (w.n === 1 ? '' : 's') + ' waiting for award',
    detail: F.line || '', button: 'Open funnel', thread: at('fn') })];
  if (F.task_error) out.push(row({ eyebrow: 'HubSpot tasks', title: 'HubSpot tasks need a key change', detail: F.task_error, button: 'Open', thread: tasksTab }));
  else if (open.length) out.push(row({ eyebrow: 'HubSpot tasks · yours', title: late.length ? late.length + ' task' + (late.length === 1 ? '' : 's') + ' overdue' : open.length + ' open task' + (open.length === 1 ? '' : 's'),
    detail: open.slice(0, 2).map(t => t.subject.replace(/^Follow up on pending decision\s*[—–-]\s*/i, 'Follow up: ')).join(' · ') + (open.length > 2 ? ' and ' + (open.length - 2) + ' more' : ''), button: 'Review tasks', thread: tasksTab }));
  return out;
}
