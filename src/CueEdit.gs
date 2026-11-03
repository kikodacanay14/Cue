/* CUE-EDIT-2026-10-27 (Kiko 27 Oct 10:10Z "Yes, build it"; specs/generic-bridge.md). Cue edits a Canvas record it is allowed to
 * edit, through Canvas's generic bridge (allow_list, read_rows, write_rows, allow_list_set). Kiko 10:06Z: "Cue received it - should
 * passed to Claude - Claude should have updated the file". The chat call routes it (canvas_edit), then:
 *   1. code reads the allow-list and the columns of every allowed tab (read_rows, one row each, in parallel);
 *   2. one Claude call picks the tab, the filter that finds the row, and the new values (replace, or add before or after the old text);
 *   3. code reads the matching rows; exactly one must match, or Cue asks which;
 *   4. an Approve card shows each column's old and new value. Nothing is written before Approve;
 *   5. Approve writes once, as the one command of a claimed plan (write_rows), and says what Canvas read back.
 * "allow cue to read|edit ..." asks for a new allow-list row on an Approve card (allow_list_set), with no AI call.
 * Canvas keeps its own never-lists (bank, signature and password columns, status, award and payment columns, Users and Settings). */
const CUE_EDIT_MAX_ = { tabs: 12, rows: 5, value: 2000 };
const CUE_EDIT_SCHEMA_ = { type: 'object', additionalProperties: false, required: ['ok', 'question', 'book', 'tab', 'where', 'set', 'add', 'key'],
  properties: {
    ok: { type: 'boolean', description: 'true when one allowed tab and its columns can do what Kiko asked' },
    question: { type: 'string', description: 'When ok is false: one short sentence to Kiko saying what is missing or that no allowed tab fits. Else ""' },
    book: { type: 'string' }, tab: { type: 'string' },
    where: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['column', 'equals', 'contains'],
      properties: { column: { type: 'string' }, equals: { type: 'string', description: 'exact value, or ""' }, contains: { type: 'string', description: 'part of the value, or ""' } } },
      description: 'Filters on readable columns that find the one row to change (for example the key column equals "0014"). Empty when adding a row.' },
    set: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['column', 'value', 'how'],
      properties: { column: { type: 'string', description: 'a writable column' }, value: { type: 'string' },
        how: { type: 'string', enum: ['replace', 'before', 'after'], description: 'before or after: add the value to the start or end of the old text' } } } },
    add: { type: 'boolean', description: 'true only when Kiko asks to add a new row and the tab takes new rows (mode append)' },
    key: { type: 'string', description: 'For a new row: its key column value. Else ""' } } };
const CUE_EDIT_SYSTEM_ = 'You turn Kiko\'s request into one change to a Canvas sheet row. Kiko runs Blank Space Events. You get the tabs Cue may '
  + 'touch, each with its book, key column, mode, readable columns and writable columns. Use only those names, spelled as given. '
  + 'Pick the tab and the filters that find exactly the row Kiko means, and the new values for writable columns only. Never invent '
  + 'a value Kiko did not give or clearly imply. Keep Kiko\'s text exactly (numbers, codes such as REC-10307792). When Kiko asks to add a line '
  + 'to existing text, use how "before" unless Kiko says to put it at the end. If no allowed tab or writable column fits, set ok to false '
  + 'and say which tabs Cue can edit now.';

const cueEditId_ = p => p + cueNow_().toString(36) + Math.floor(Math.random() * 4096).toString(36);
/** The allowed tabs with their columns: [{book, tab, key, mode, columns, writable}]. */
function cueEditTabs_(s) {
  const al = cueBridge_(s, 'allow_list', {}) || {}, tabs = (al.tabs || []).slice(0, CUE_EDIT_MAX_.tabs);
  if (!tabs.length) return [];
  const res = UrlFetchApp.fetchAll(tabs.map(x => cueBridgeReq_(s, 'read_rows', { book: x.book, tab: x.tab, limit: 1 })));
  return tabs.map((x, i) => { let r = null; try { r = cueBridgeParse_('read_rows', res[i]); } catch (e) { r = null; }
    return r ? { book: x.book, tab: x.tab, key: r.key, mode: r.mode, columns: r.columns || [], writable: r.writable || [] } : null; }).filter(Boolean);
}
const cueEditNew_ = (old, v, how) => { const o = String(old == null ? '' : old).trim(), n = String(v == null ? '' : v).trim();
  if (how === 'replace' || !o) return n; if (o.indexOf(n) >= 0) return o;
  return how === 'after' ? o.replace(/[.;,:\s]+$/, '') + '. ' + n : n.replace(/[.;,:\s]+$/, '') + '. ' + o; };

/** The chat route (Cue.gs, talk.canvas_edit): the ask as the chat call restated it. Ends with an Approve card or a plain answer. */
function cueEditStart_(ask, where, text, posted, quiet) {   // posted: the chat call already put Kiko's line in the chat; quiet: a Cue proposal (ACC-14) that says nothing unless a value differs
  const t = String(text || ask || '').trim(), home = where || '';
  if (!posted) cueChat_('Kiko', t, home);
  const say = m => { if (!quiet) cueChat_('Cue', m, home); return { chat: true, task: home }; };
  const s = { id: cueEditId_('cue-ed-'), metrics: { ai_calls: 0, calls: [] } };
  let tabs;
  try { tabs = cueEditTabs_(s); } catch (e) { return say('Canvas did not answer (' + cueStr_((e && e.message) || e, 200) + '). Nothing was changed.'); }
  if (!tabs.length) return say('Cue is not allowed to edit any Canvas tab yet. Say "allow cue to edit <columns> in <tab> in <book>, key <column>" and approve it.');
  const list = tabs.map(x => x.book + ' › ' + x.tab + ' (key ' + x.key + ', mode ' + x.mode + ')\n  readable: ' + x.columns.join(', ') + '\n  writable: ' + (x.writable.join(', ') || 'none')).join('\n');
  const r = cueAiAll_(s, [cueClaude_({ step: 'canvas edit', system: CUE_EDIT_SYSTEM_, schema: CUE_EDIT_SCHEMA_, maxTokens: 1500, effort: 'low',
    user: 'Tabs Cue may touch:\n' + list + '\n\nKiko: ' + cueStr_(ask || t, 2000) + (ask && t && ask !== t ? '\n(Kiko\'s own words: ' + cueStr_(t, 2000) + ')' : '') })])[0];
  if (!r.ok) return say('I could not work out the change just now (' + cueStr_(r.error, 200) + '). Nothing was changed.');
  const d = r.data;
  if (!d.ok) return say(cueStr_(d.question, 400) || 'I could not tell which record to change. Nothing was changed.');
  const tab = tabs.filter(x => x.book === String(d.book).toLowerCase() && x.tab.toLowerCase() === String(d.tab).toLowerCase())[0];
  if (!tab) return say(d.book + ' › ' + d.tab + ' is not a tab Cue may edit. Nothing was changed.');
  const named = c => tab.writable.filter(h => h.toUpperCase() === String(c || '').trim().toUpperCase())[0] || String(c || '').trim();   // Claude's spelling, the tab's name
  const set = (d.set || []).filter(x => x && String(x.column || '').trim()).map(x => Object.assign({}, x, { column: named(x.column) }));
  const locked = set.filter(x => cueEdLocked_(tab.book, tab.tab, x.column)).map(x => x.column);   // ACC-12, R2: Kiko's lock list, checked in Cue too
  if (locked.length) return say('I can\'t edit ' + locked.join(', ') + '. ' + CUE_ED_LOCK_SAY_ + ' Nothing was changed.');
  const bad = set.filter(x => tab.writable.indexOf(x.column) < 0).map(x => x.column);
  if (bad.length || !set.length) return say((bad.length ? bad.join(', ') + ' can\'t be changed by Cue in ' + tab.tab : 'Nothing to change was named') + '. Cue can change: ' + (tab.writable.join(', ') || 'nothing there') + '. Nothing was changed.');
  if (d.add) {
    if (tab.mode !== 'append' || !String(d.key || '').trim()) return say(tab.tab + ' does not take new rows from Cue. Nothing was changed.');
    const vals = {}; set.forEach(x => { vals[x.column] = cueStr_(x.value, CUE_EDIT_MAX_.value); });
    return cueEditCard_({ book: tab.book, tab: tab.tab, key: cueStr_(d.key, 120), add: true, set: vals, was: {} }, home);
  }
  const filters = (d.where || []).map(w => Object.assign({ column: w.column }, w.equals ? { equals: cueStr_(w.equals, 500) } : {}, w.contains ? { contains: cueStr_(w.contains, 500) } : {}))
    .filter(w => w.equals || w.contains).slice(0, 6);
  if (!filters.length) return say('Which ' + tab.tab + ' row? Name its ' + tab.key + '. Nothing was changed.');
  let rows;
  try { rows = cueBridge_(s, 'read_rows', { book: tab.book, tab: tab.tab, where: filters, limit: CUE_EDIT_MAX_.rows }) || {}; }
  catch (e) { return say('Canvas did not find it (' + cueStr_((e && e.message) || e, 200) + '). Nothing was changed.'); }
  if (!rows.total) return say('No ' + tab.tab + ' row matches (' + filters.map(w => w.column + (w.equals ? ' = ' + w.equals : ' has ' + w.contains)).join(', ') + '). Nothing was changed.');
  if (rows.total > 1) return say(rows.total + ' ' + tab.tab + ' rows match. Which one? ' + rows.rows.map(x => tab.key + ' ' + x[tab.key]).join(', ') + (rows.total > rows.rows.length ? ', …' : '') + '. Nothing was changed.');
  const row = rows.rows[0], vals = {}, was = {};
  set.forEach(x => { was[x.column] = String(row[x.column] == null ? '' : row[x.column]); vals[x.column] = cueStr_(cueEditNew_(row[x.column], x.value, x.how), CUE_EDIT_MAX_.value); });
  if (Object.keys(vals).every(c => vals[c] === was[c])) return say('Already there: ' + tab.tab + ' ' + tab.key + ' ' + row[tab.key] + ' has it. Nothing was changed.');
  if (quiet) Object.keys(vals).forEach(c => { if (vals[c] === was[c]) { delete vals[c]; delete was[c]; } });   // a proposal shows only what differs
  if (quiet) cueChat_('Cue', 'Cue noticed new details in this email\'s signature.', home);
  return cueEditCard_({ book: tab.book, tab: tab.tab, key: String(row[tab.key]), keycol: tab.key, add: false, set: vals, was }, home);
}
function cueEditCard_(o, home) {
  const lines = Object.keys(o.set).map(c => c + ': ' + (o.add ? '' : cueStr_(o.was[c] || '(blank)', 160) + '\n  becomes: ') + cueStr_(o.set[c], 300));
  const q = (o.add ? 'Add this row to ' + o.tab + ' in Canvas?\n' + (o.keycol || 'Key') + ': ' + o.key : 'Change this in Canvas?\n' + o.tab + ', ' + (o.keycol || 'key') + ' ' + o.key)
    + '\n' + lines.join('\n') + (cueEdBankCols_(o).length ? '\nConfirm by calling the supplier on a number you already have.' : '')   // ACC-13, R3: a warning only
    + '\nNothing is saved until you approve.';
  cueAskOpen_({ type: 'canvasedit', book: o.book, tab: o.tab, key: o.key, keycol: o.keycol || '', add: !!o.add, set: o.set, was: o.was || {}, undo: o.undo || '' }, q, ['approve', 'not'], home);
  return { chat: true, task: home };
}
/** Approve or Not on the edit card (CueRoute.gs cueAskPick). Approve writes once, as the one command of a claimed plan. */
function cueEditPick_(o, pick, done) {
  cueChat_('Kiko', pick === 'approve' ? 'Approve' : 'Not that', done);
  if (pick !== 'approve') { cueChat_('Cue', 'OK, not changed. Nothing was written to Canvas.', done); return { chat: true }; }
  const s = { id: cueEditId_('cue-ed-') };
  const args = Object.assign({ book: o.book, tab: o.tab, key: o.key, set: o.set }, o.add ? { add: true } : {});
  const cmd = { command_id: 'cue:' + s.id + ':write_rows:0', action: 'write_rows', args, pid: '' };
  let r;
  try { cueBridgePlan_(s, [cmd]); r = cueBridgeParse_('write_rows', UrlFetchApp.fetchAll([cueBridgeReq_(s, 'write_rows', args, '', cmd.command_id)])[0]) || {}; }
  catch (e) { cueChat_('Cue', 'Canvas did not save it: ' + cueStr_((e && e.message) || e, 300), done); return { chat: true }; }
  if (r.refused) { cueChat_('Cue', 'Canvas refused: ' + cueStr_(r.refused, 300), done); return { chat: true }; }
  const now = r.now || {};
  if (!r.already) cueEdLog_(o, now);   // ACC-15: every edit Cue saved, for the Edit log and Undo
  cueChat_('Cue', (r.already ? 'Already there, nothing new written. ' : 'Saved. ') + o.tab + ' ' + o.key + ' now reads:\n'
    + Object.keys(now).map(c => c + ': ' + cueStr_(now[c], 300)).join('\n'), done);
  return { chat: true };
}

/* "allow cue to read <tab> in <book>" / "allow cue to edit <col>, <col> in <tab> in <book>, key <col>" / "... add rows to <tab> in <book>, key <col>":
 * an Approve card for one allow-list row (allow_list_set). No AI call. Canvas refuses anything on its never-lists. */
const CUE_ALLOW_RE_ = /^\s*allow\s+cue\s+to\s+(read|edit|change|update|add\s+rows\s+to)\s+(.+?)\s+in\s+(tracker|admin|tri|scopes|suppliers|priority)\b\s*(?:[,;]?\s*key\s*(?:column)?\s*[:=]?\s*(.+?))?\s*\.?\s*$/i;
function cueAllowSaid_(text, ref) {
  const m = CUE_ALLOW_RE_.exec(String(text || ''));
  if (!m) return null;
  const how = m[1].toLowerCase(), book = m[3].toLowerCase(), key = String(m[4] || '').trim(), home = ref || '';
  let cols = '', tab = m[2].trim();
  if (/^(edit|change|update)$/.test(how)) { const x = /^(.+?)\s+in\s+(.+)$/i.exec(tab); if (!x) { cueChat_('Kiko', text, home); cueChat_('Cue', 'Say it as "allow cue to edit <columns> in <tab> in <book>, key <column>".', home); return { chat: true, task: home }; } cols = x[1].trim(); tab = x[2].trim(); }
  const mode = how === 'read' ? 'read' : /^add/.test(how) ? 'append' : 'update';
  cueChat_('Kiko', String(text).trim(), home);
  if (mode !== 'read' && !key) { cueChat_('Cue', 'Which column finds the row? Add ", key <column>". Nothing was changed.', home); return { chat: true, task: home }; }
  const o = { type: 'allowset', row: Object.assign({ type: 'tab', book, name: cueStr_(tab, 100), mode, read: 'all' }, cols ? { write: cueStr_(cols, 1000) } : {}, key ? { key: cueStr_(key, 120) } : {}) };
  cueAskOpen_(o, 'Let Cue ' + (mode === 'read' ? 'read ' : mode === 'append' ? 'add rows to ' : 'change ' + cols + ' in ') + tab + ' (' + book + ')' + (key ? ', finding rows by ' + key : '')
    + '?\nCanvas still never lets Cue touch bank, signature or password columns, status, award or payment columns, or Users and Settings. Each edit still needs your Approve.', ['approve', 'not'], home);
  return { chat: true, task: home };
}
function cueAllowPick_(o, pick, done) {
  cueChat_('Kiko', pick === 'approve' ? 'Approve' : 'Not that', done);
  if (pick !== 'approve') { cueChat_('Cue', 'OK, the allow-list stays as it is.', done); return { chat: true }; }
  const s = { id: cueEditId_('cue-al-') }, cmd = { command_id: 'cue:' + s.id + ':allow_list_set:0', action: 'allow_list_set', args: o.row, pid: '' };
  let r;
  try { cueBridgePlan_(s, [cmd]); r = cueBridgeParse_('allow_list_set', UrlFetchApp.fetchAll([cueBridgeReq_(s, 'allow_list_set', o.row, '', cmd.command_id)])[0]) || {}; }
  catch (e) { cueChat_('Cue', 'Canvas did not change the allow-list: ' + cueStr_((e && e.message) || e, 300), done); return { chat: true }; }
  if (r.refused) { cueChat_('Cue', 'Canvas refused: ' + cueStr_(r.refused, 300), done); return { chat: true }; }
  cueChat_('Cue', 'Done. Cue can now ' + (o.row.mode === 'read' ? 'read ' : o.row.mode === 'append' ? 'add rows to ' : 'change ' + o.row.write + ' in ') + o.row.name + '.', done);
  return { chat: true };
}
