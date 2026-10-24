/* CUE-TRI-2026-10-24 (Kiko 06:47Z "add the tasks", "go" 06:50Z; spec specs/cue-add-tasks.md).
 * Kiko types "add task call venue to Selecta, due Friday, for Ana" (or "add issue …", "add risk …"). Code reads it (no AI call),
 * Canvas finds the project (search_projects, a read), and Cue shows a card with Project, Type, Description, Due and Assigned to.
 * Nothing is written until Kiko taps Approve; then the bridge's add_tri_items adds the row once, the way Canvas's own page adds
 * one, and reads it back. A row with the same description already in that project is left as it is and reported.
 * Canvas's Quick actions "Add task, issue or risk" and "Open tasks" only open the project's Main tab; "<project> tasks" does that
 * here too (CueCanvas.gs). */

const CUE_TRI_TYPES_ = ['Task', 'Issue', 'Risk'];
const CUE_TRI_RE_ = /^(?:add|new|create|log|raise|put)\s+(?:an?\s+)?(?:new\s+)?(task|issue|risk)\s*[:,-]?\s*(.+)\s+(?:to|in|for|on|under)\s+(?:the\s+)?(?:project\s+)?(.+)$/i;
const CUE_TRI_DAYS_ = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const CUE_TRI_MONTHS_ = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Kiko's words as { type, description, project, due, due_raw, assigned }, or null. today = 'yyyy-MM-dd' (Manila). */
function cueTriParse_(text, today) {
  let t = String(text || '').replace(/\s+/g, ' ').trim().replace(/[.!]+$/, '').replace(/^(?:please|pls|cue|hey cue)[,\s]+/i, '').replace(/\s+(?:please|pls)$/i, '');
  if (!/^(?:add|new|create|log|raise|put)\s+(?:an?\s+)?(?:new\s+)?(?:task|issue|risk)\b/i.test(t)) return null;
  let due = '', who = '', m;
  // Options at the end, after a comma: ", due Friday", ", for Ana", ", assigned to Ana". "due …" also works without a comma.
  for (let i = 0; i < 3; i++) {
    if (!due && (m = /(?:[,;]\s*|\s+)(?:due|deadline)\s*:?\s*(?:on\s+|by\s+)?([^,;]+)$/i.exec(t))) { due = m[1].trim(); t = t.slice(0, m.index).trim(); continue; }
    if (!who && (m = /[,;]\s*(?:for|assign(?:ed)?\s+to|owner\s*:?)\s+([^,;]+)$/i.exec(t))) { who = m[1].trim(); t = t.slice(0, m.index).trim(); continue; }
    break;
  }
  if (!(m = CUE_TRI_RE_.exec(t))) return null;
  const description = m[2].trim().replace(/^["“']|["”']$/g, ''), project = m[3].trim();
  if (description.length < 2 || project.length < 2) return null;
  const iso = due ? cueTriDue_(due, today) : '';
  return { type: m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase(), description: cueStr_(description, 1000), project: cueStr_(project, 200),
    due: iso, due_raw: due && !iso ? cueStr_(due, 60) : '', assigned: cueStr_(who, 200) };
}

/** "today", "tomorrow", "Friday", "next Friday", "Oct 30", "30 October", "10/30", "2026-10-30" -> 'yyyy-MM-dd', else ''. */
function cueTriDue_(word, today) {
  const w = String(word || '').toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim(), base = Date.parse(today + 'T00:00:00Z');
  if (!w || isNaN(base)) return '';
  const iso = ms => new Date(ms).toISOString().slice(0, 10), day = 864e5;
  let m;
  if (/^\d{4}-\d{2}-\d{2}$/.test(w)) return isNaN(Date.parse(w + 'T00:00:00Z')) ? '' : w;
  if (w === 'today' || w === 'tonight') return today;
  if (w === 'tomorrow' || w === 'tmr' || w === 'tom') return iso(base + day);
  if ((m = /^(next\s+|this\s+)?(sun|mon|tue|wed|thu|fri|sat)[a-z]*$/.exec(w))) {
    const want = CUE_TRI_DAYS_.indexOf(m[2]), now = new Date(base).getUTCDay();
    let add = (want - now + 7) % 7;   // today counts as "Friday" on a Friday
    if (m[1] && /next/.test(m[1]) && add === 0) add = 7;   // "next Friday" on a Friday is a week out
    return iso(base + add * day);
  }
  const yr = Number(today.slice(0, 4)), mk = (y, mo, d) => { const ms = Date.UTC(y, mo, d), x = new Date(ms);
    return x.getUTCMonth() === mo && x.getUTCDate() === d ? ms : NaN; };
  let mo = -1, d = 0, y = 0;
  if ((m = /^([a-z]{3})[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?$/.exec(w))) { mo = CUE_TRI_MONTHS_.indexOf(m[1]); d = +m[2]; y = +(m[3] || 0); }
  else if ((m = /^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3})[a-z]*(?:\s+(\d{4}))?$/.exec(w))) { mo = CUE_TRI_MONTHS_.indexOf(m[2]); d = +m[1]; y = +(m[3] || 0); }
  else if ((m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/.exec(w))) { mo = +m[1] - 1; d = +m[2]; y = +(m[3] || 0); }   // Canvas writes m/d/yyyy
  if (mo < 0 || !d) return '';
  let ms = mk(y || yr, mo, d);
  if (!y && !isNaN(ms) && ms < base - 7 * day) ms = mk(yr + 1, mo, d);   // "Jan 5" in October means next January
  return isNaN(ms) ? '' : iso(ms);
}

/** "add task … to <project>": the card, or null when the words are not a task command. No AI call. */
function cueTriSaid_(text, ref) {
  const today = Utilities.formatDate(new Date(cueNow_()), 'Asia/Manila', 'yyyy-MM-dd');
  const c = cueTriParse_(text, today);
  if (!c) return null;
  const t = String(text || '').trim(), now = cueNow_(), d = new Date(now);
  const id = 'cue-' + Utilities.formatDate(d, 'Asia/Manila', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 65536).toString(16).padStart(4, '0');
  const s = { id, version: CUE_VERSION_, kind: 'tri', created: d.toISOString(), started: now, text: t, files: [], status: 'Needs you', stage: 'Needs you', ref: '',
    tri: { type: c.type, description: c.description, asked_project: c.project, due: c.due, due_raw: c.due_raw, assigned: c.assigned, choices: [], project_id: '', project: '' },
    metrics: { ai_calls: 0, calls: [] }, notes: [] };
  let hits;
  try { hits = cueCanvasFind_(s, c.project); } catch (e) { hits = null; s.error = 'Canvas didn\'t answer the project search (' + cueStr_((e && e.message) || e, 200) + '). Pick the project again to retry.'; }
  if (hits && hits.length === 1) { s.tri.project_id = hits[0].project_id; s.tri.project = hits[0].name || hits[0].project_id; }
  else if (hits && hits.length) s.tri.choices = hits.map(p => ({ project_id: p.project_id, name: p.name, account: p.account || '', date: p.date || '' }));
  else if (hits) s.error = 'Canvas has no project called "' + c.project + '". Type the project\'s name or S- id on the card.';
  s.card_at = now;
  cueLocked_(() => { const sh = cueSheet_('Requests'); sh.appendRow([id]); cueSave_(sh, sh.getLastRow(), s); });
  const what = c.type.toLowerCase(), line = s.tri.project_id
    ? 'Here is the ' + what + ' for ' + s.tri.project + '. Check it and tap Approve; nothing is added to Canvas before that.'
    : s.tri.choices.length ? 'Canvas has ' + s.tri.choices.length + ' projects like "' + c.project + '". Pick one on the card, then Approve.' : s.error;
  if (!ref) { cueChat_('Kiko', t, ''); cueChat_('Cue', 'Started a thread for the ' + what + '.', '>' + id); }
  cueChat_('Kiko', t, id);
  cueChat_('Cue', line + (c.due_raw ? ' I couldn\'t read the date "' + c.due_raw + '", so set it on the card.' : ''), id);
  return { request_id: id, task: ref || '' };
}

/** Approve with Kiko's edits from the card: { project_id | project, type, description, due, assigned }. Adds the row once. */
function cueTriApprove_(id, e) {
  e = e || {};
  const L = cueLocked_(() => {
    const L = cueLoad_(id);
    if (!L || L.s.kind !== 'tri') throw new Error('No such task card.');
    const s = L.s, T = s.tri;
    if (s.status !== 'Needs you') throw new Error('This card is ' + s.status + ', not waiting for you.');
    if (e.type != null) { if (CUE_TRI_TYPES_.indexOf(e.type) < 0) throw new Error('Pick Task, Issue or Risk.'); T.type = e.type; }
    if (e.description != null) T.description = cueStr_(String(e.description).trim(), 1000);
    if (e.assigned != null) T.assigned = cueStr_(String(e.assigned).trim(), 200);
    if (e.due != null) { const v = String(e.due).trim(); if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error('Pick the due date on the calendar.'); T.due = v; T.due_raw = ''; }
    if (e.project_id) {
      const pick = (T.choices || []).find(p => p.project_id === e.project_id);
      if (!pick && e.project_id !== T.project_id) throw new Error(e.project_id + ' is not one of the projects Canvas found.');
      if (pick) { T.project_id = pick.project_id; T.project = pick.name || pick.project_id; }
    }
    if (!T.description) throw new Error('Type what the ' + T.type.toLowerCase() + ' is.');
    s.status = 'Writing to Canvas'; s.stage = 'Writing to Canvas'; s.error = '';
    cueSave_(L.sh, L.row, s);
    return L;
  });
  const s = L.s, T = s.tri, save = () => cueSave_(L.sh, L.row, s);
  // A project typed on the card (none matched before): Canvas looks it up now; one match is used, more go back to the card.
  if (!T.project_id && e.project) {
    let hits = []; try { hits = cueCanvasFind_(s, e.project); } catch (x) { hits = []; }
    if (hits.length === 1) { T.project_id = hits[0].project_id; T.project = hits[0].name || hits[0].project_id; T.choices = []; }
    else { T.choices = hits.map(p => ({ project_id: p.project_id, name: p.name, account: p.account || '', date: p.date || '' })); T.asked_project = cueStr_(e.project, 200); }
  }
  if (!T.project_id) {
    s.status = 'Needs you'; s.stage = 'Needs you';
    s.error = T.choices && T.choices.length ? 'Pick which project, then Approve.' : 'Canvas has no project called "' + T.asked_project + '". Type the project\'s name or S- id.';
    save(); return s;
  }
  const item = { key: 't1', type: T.type, description: T.description };
  if (T.assigned) item.assigned_to = T.assigned;
  if (T.due) item.deadline = T.due;
  let res;
  try { res = cueBridge_(s, 'add_tri_items', { request_id: s.id, items: [item] }, T.project_id); }
  catch (x) {
    s.status = 'Needs you'; s.stage = 'Needs you'; s.error = 'Canvas did not add it: ' + cueStr_((x && x.message) || x, 300) + '. Approving again never adds it twice.';
    save(); return s;
  }
  const r = ((res && res.items) || [])[0] || {};
  if (!r.ok) {
    s.status = 'Needs you'; s.stage = 'Needs you'; s.error = 'Canvas did not keep the ' + T.type.toLowerCase() + (r.why ? ': ' + cueStr_(r.why, 300) : '') + '. Approve again to retry.';
    cueChat_('Cue', s.error, s.id); save(); return s;
  }
  T.saved = { id: String(r.id || ''), dup: r.why === 'already in Canvas', at: new Date(cueNow_()).toISOString() };
  s.status = 'Done'; s.stage = 'Done'; s.approved_at = T.saved.at; s.ready_at = cueNow_();
  cueMetrics_(s); save();
  cueSummary_(s);
  return s;
}

function cueTriClose_(id) {
  const s = cueLocked_(() => {
    const L = cueLoad_(id);
    if (!L || L.s.kind !== 'tri') throw new Error('No such task card.');
    if (L.s.status !== 'Needs you') throw new Error('This card is ' + L.s.status + ', not waiting for you.');
    L.s.status = 'Rejected'; L.s.stage = 'Rejected'; L.s.error = ''; cueSave_(L.sh, L.row, L.s); return L.s;
  });
  cueSummary_(s);
  return s;
}

function cueTriSummaryLine_(s) {
  const T = s.tri || {}, what = (T.type || 'Task').toLowerCase();
  if (s.status === 'Rejected') return 'Closed the ' + what + ' "' + cueStr_(T.description, 120) + '". Nothing was added to Canvas.';
  if (T.saved) return T.saved.dup ? cueStr_(T.description, 120) + ' was already in ' + T.project + ' as ' + (T.saved.id || 'a ' + what) + ', so nothing was added twice.'
    : 'Added ' + what + ' ' + T.saved.id + ' "' + cueStr_(T.description, 120) + '" to ' + T.project + (T.due ? ', due ' + T.due : '') + (T.assigned ? ', for ' + T.assigned : '') + '. Canvas read it back.';
  return 'The ' + what + ' "' + cueStr_(T.description, 120) + '" is ' + String(s.status || '').toLowerCase() + '.';
}
function cueTriView_(s) {
  const T = s.tri; if (!T) return null;
  return { type: T.type, description: T.description, project_id: T.project_id || '', project: T.project || '', asked_project: T.asked_project || '', due: T.due || '', due_raw: T.due_raw || '',
    assigned: T.assigned || '', choices: T.choices || [], saved: T.saved || null, types: CUE_TRI_TYPES_ };
}
