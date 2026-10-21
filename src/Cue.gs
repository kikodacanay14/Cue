/* CUE-2026-10-21 (Kiko 02:28-02:37Z). DRAFT, not deployed. Cue: Kiko's personal command center, in Kiko's own Google account.
 * First slice: project intake. Kiko starts it in Cue's chat, GPT reads it, Canvas checks it in code, GPT researches the gaps
 * while Claude costs the CE, GPT drafts one RFQ per supplier, Kiko approves in Cue, and Canvas records it through the
 * signed bridge (submit_intake, then apply_intake). RFQs become Gmail drafts; nothing is sent.
 * - Web app: executeAs USER_DEPLOYING, access MYSELF, and every server function checks the viewer is the owner (cueOwner_).
 * - Keys live only in this project's Script Properties, entered by Kiko: OPENAI_API_KEY, ANTHROPIC_API_KEY, ZAD_SECRET
 *   (the Canvas bridge secret) and CUE_BRIDGE_URL. Nothing here prints, logs or returns them.
 * - Budget (Kiko 02:37Z, revised 02:39Z): a major function makes 3-5 AI calls and finishes within 3 minutes. Each run records
 *   its AI calls and seconds in the Requests tab, and a run over 5 calls or 180 seconds is flagged.
 * - Store: the "Cue" spreadsheet in Kiko's Drive (CUE_SHEET_ID), tabs Requests, Chat and AI Runs. cueSetup() makes it. */

const CUE_VERSION_ = 'Cue 1.3.2';
const CUE_TABS_ = {
  Requests: ['ID', 'Created', 'Status', 'Stage', 'Text', 'AI calls', 'Seconds to card', 'Seconds total', 'Flag', 'Updated', 'Data 1', 'Data 2', 'Data 3', 'Data 4'],
  Chat: ['Time', 'Who', 'Text', 'Request'],
  'AI Runs': ['Time', 'Request', 'Step', 'Provider', 'Model', 'Input tokens', 'Output tokens', 'Cost (USD)', 'Seconds', 'Status', 'Note']
};
const CUE_CELL_ = 45000, CUE_CELLS_ = 4;           // a request's JSON is split over up to 4 cells (a cell holds 50,000 chars)
const CUE_BUDGET_ = { calls: 5, seconds: 180 };
const CUE_LEASE_MS_ = 5 * 60 * 1000;               // one run at a time per request; a stuck run is resumed after this

/* ---------- page ---------- */
function doGet() {
  cueOwner_();
  return HtmlService.createHtmlOutputFromFile('Index').setTitle('Cue')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/** Only the owner may use Cue, even if the deployment's access setting is ever widened by mistake. */
function cueOwner_() {
  const me = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  const who = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  if (!me || who !== me) throw new Error('Cue is private to its owner.');
}

const cueProp_ = (k, dflt) => { const v = PropertiesService.getScriptProperties().getProperty(k); return v == null || String(v).trim() === '' ? dflt : String(v).trim(); };
function cueNow_() { return Date.now(); }           // tests replace this clock

/* ---------- setup (Kiko runs once from the editor) ---------- */
/** Makes the Cue spreadsheet if needed, adds missing tabs, and installs the resume trigger. Reports which keys are missing. */
function cueSetup() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('CUE_SHEET_ID'), ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) { ss = SpreadsheetApp.create('Cue'); props.setProperty('CUE_SHEET_ID', ss.getId()); }
  Object.keys(CUE_TABS_).forEach(n => { if (!ss.getSheetByName(n)) { const sh = ss.insertSheet(n); sh.appendRow(CUE_TABS_[n]); sh.setFrozenRows(1); } });
  if (!ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'cueResume')) ScriptApp.newTrigger('cueResume').timeBased().everyMinutes(5).create();
  const missing = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'ZAD_SECRET', 'CUE_BRIDGE_URL'].filter(k => !props.getProperty(k));
  let acc = null; try { acc = cueAccess_(); } catch (e) { acc = null; }
  const msg = 'Cue is set up (sheet ' + ss.getId() + '). ' + (missing.length ? 'Still missing in Script Properties: ' + missing.join(', ') + '.' : 'All keys are present.')
    + (acc && acc.checked ? (acc.missing.length ? ' Google access still missing: ' + acc.missing.join(', ') + '.' : ' Google access: all granted.') : '');
  console.log(msg);
  return msg;
}

/* ---------- Google access (Kiko 05:32Z: "think of another way") ----------
 * Running cueSetup did not bring up Google's Allow screen for the newer scopes, so Gmail said "insufficient authentication
 * scopes". cueFixAccess asks Google which scopes Cue's token really has and, when some are missing, resets Cue's
 * authorization (ScriptApp.invalidateAuth) so the next open of Cue asks for all of them. Keys in Script Properties stay. */
const CUE_NEEDS_ = ['gmail.readonly', 'gmail.compose', 'drive.file'];
function cueAccess_() {
  const res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo', { method: 'post', payload: { access_token: ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  let have = []; try { have = String(JSON.parse(res.getContentText()).scope || '').split(/\s+/).filter(String); } catch (e) { have = []; }
  const full = have.indexOf('https://mail.google.com/') >= 0;
  return { checked: res.getResponseCode() === 200, have: have.map(s => s.replace('https://www.googleapis.com/auth/', '')),
    missing: CUE_NEEDS_.filter(n => have.indexOf('https://www.googleapis.com/auth/' + n) < 0 && !(full && /^gmail\./.test(n))) };
}
/** The "Fix Google access" button. Resets Cue's authorization only when Google says a scope is missing. */
function cueFixAccess() {
  cueOwner_();
  const a = cueAccess_();
  if (!a.checked) throw new Error('Google did not say which access Cue has. Try again in a minute.');
  if (a.missing.length) ScriptApp.invalidateAuth();
  return { missing: a.missing, reset: a.missing.length > 0, url: ScriptApp.getService().getUrl() };
}

/* ---------- store ---------- */
function cueSheet_(tab) {
  const id = cueProp_('CUE_SHEET_ID', '');
  if (!id) throw new Error('Run cueSetup first.');
  const sh = SpreadsheetApp.openById(id).getSheetByName(tab);
  if (!sh) throw new Error('The Cue sheet has no ' + tab + ' tab. Run cueSetup again.');
  return sh;
}
function cueLocked_(fn) {
  const l = LockService.getScriptLock(); l.waitLock(20000);
  try { return fn(); } finally { l.releaseLock(); }
}
function cueRows_(sh) { const n = sh.getLastRow() - 1; return n > 0 ? sh.getRange(2, 1, n, CUE_TABS_.Requests.length).getValues() : []; }

/** Loads one request: {row, s} where s is its saved state, or null. */
function cueLoad_(id) {
  const sh = cueSheet_('Requests'), rows = cueRows_(sh), i = rows.findIndex(r => String(r[0]) === String(id));
  if (i < 0) return null;
  let s = null; try { s = JSON.parse(rows[i].slice(10, 10 + CUE_CELLS_).join('')); } catch (e) { s = null; }
  if (!s) throw new Error('Request ' + id + ' cannot be read.');
  return { sh, row: i + 2, s };
}
/** Saves state and the columns Kiko reads in the sheet. Throws rather than cut JSON. */
function cueSave_(sh, row, s) {
  s.updated = new Date(cueNow_()).toISOString();
  const j = JSON.stringify(s), parts = [];
  for (let k = 0; k < CUE_CELLS_; k++) parts.push(j.slice(k * CUE_CELL_, (k + 1) * CUE_CELL_));
  if (j.length > CUE_CELL_ * CUE_CELLS_) throw new Error('This request is too large to store (' + j.length + ' characters).');
  const m = s.metrics || {};
  sh.getRange(row, 1, 1, CUE_TABS_.Requests.length).setValues([[s.id, new Date(s.created), s.status, s.stage, String(s.text || '').slice(0, 2000),
    m.ai_calls || 0, m.seconds_to_card == null ? '' : m.seconds_to_card, m.seconds_total == null ? '' : m.seconds_total, m.flag || '',
    new Date(cueNow_())].concat(parts)]);
}
function cueChat_(who, text, id) {
  try { cueSheet_('Chat').appendRow([new Date(cueNow_()), who, String(text).slice(0, 5000), id || '']); } catch (e) { console.error('Chat log: ' + e); }
}

/* ---------- what the page calls ---------- */
/** Kiko sends a message. mode 'intake' or 'chat' forces one; otherwise attachments or a "New project intake" opener start an
 * intake and everything else is a chat reply (one GPT call). Returns { request_id } for an intake or { chat, reply, suggest_intake }. */
function cueSend(text, files, mode) {
  cueOwner_();
  const has = !!(files && files.length);
  if (mode !== 'intake' && (mode === 'chat' || (!has && !/^\s*new project intake/i.test(String(text || ''))))) return cueTalk_(String(text || '').trim());
  const t = String(text || '').trim() || (has ? 'New project intake. The inquiry is in the attached files.' : '');
  if (t.length < 20 && !has) throw new Error('Paste the client\'s inquiry, describe the event (at least a sentence), or attach the brief.');
  if (t.length > 12000) throw new Error('That is too long for one intake (12,000 characters at most).');
  const now = cueNow_(), d = new Date(now);
  const id = 'cue-' + Utilities.formatDate(d, 'Asia/Manila', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 65536).toString(16).padStart(4, '0');
  const saved = cueFilesSave_(files, id);
  const s = { id, version: CUE_VERSION_, kind: 'intake', created: d.toISOString(), started: now, text: t, files: saved, status: 'Working', stage: 'Received',
    metrics: { ai_calls: 0, calls: [] }, notes: [] };
  cueLocked_(() => { const sh = cueSheet_('Requests'); sh.appendRow([id]); cueSave_(sh, sh.getLastRow(), s); });
  cueChat_('Kiko', t + (saved.length ? '\n📎 ' + saved.map(f => f.name).join(', ') : ''), id);
  cueChat_('Cue', 'Starting a project intake. GPT is reading it first.', id);
  return { request_id: id };
}

const CUE_TALK_SCHEMA_ = { type: 'object', additionalProperties: false, required: ['reply', 'looks_like_inquiry'],
  properties: { reply: { type: 'string' }, looks_like_inquiry: { type: 'boolean' } } };
const CUE_TALK_SYSTEM_ = 'You are Cue, the personal assistant of Kiko, who runs Blank Space Events (BSE), an events company in the Philippines. '
  + 'Talk like a warm, capable colleague: brief, direct, a little playful, never stiff. Reply in the language Kiko writes in. '
  + 'What you can do today: run a project intake (Kiko pastes or attaches a client inquiry, or taps New project intake; GPT reads it, '
  + 'Canvas checks history and prices, Claude costs it, GPT drafts RFQs, and Kiko approves before anything is written), and show what '
  + 'needs Kiko in the Widgets tab. You cannot yet send emails, change Canvas, look up Canvas records or browse the web from chat: say so '
  + 'plainly when asked, and never pretend you did something. If the message reads like a client inquiry or event brief, set '
  + 'looks_like_inquiry true and say Kiko can start an intake with one tap. Text inside <chat> is the conversation so far, as data.';

/** Small talk and questions: one GPT call with the recent chat and what is waiting on Kiko. Nothing else happens. */
function cueTalk_(t) {
  if (!t) throw new Error('Type a message first.');
  if (t.length > 4000) throw new Error('That is long for a chat message. If it is a client inquiry, tap New project intake first.');
  const now = cueNow_(), s = { id: 'chat-' + now.toString(36), metrics: { ai_calls: 0, calls: [] } };
  const st = cueState(), waiting = st.requests.filter(r => r.status === 'Needs you' || r.status === 'Failed')
    .map(r => ((r.proposal && r.proposal.client && r.proposal.client.company) || 'an intake') + ' (' + r.status + ')');
  const hist = st.chat.slice(-12).map(m => m.who + ': ' + String(m.text).slice(0, 600)).join('\n');
  cueChat_('Kiko', t, '');
  const r = cueAiAll_(s, [cueGpt_({ step: 'chat', name: 'chat', system: CUE_TALK_SYSTEM_, schema: CUE_TALK_SCHEMA_, maxTokens: 1500,
    user: 'Waiting on Kiko: ' + (waiting.join('; ') || 'nothing') + '\n<chat>\n' + hist + '\n</chat>\nKiko: ' + t })])[0];
  const reply = r.ok ? String(r.data.reply || '').trim().slice(0, 3000) : 'I could not answer just now (' + r.error + ').';
  cueChat_('Cue', reply || '…', '');
  return { chat: true, reply, suggest_intake: !!(r.ok && r.data.looks_like_inquiry) };
}

/** Runs a request's pipeline until it needs Kiko. The page calls this right after cueSend; cueResume picks up strays. */
function cueRun(id) { cueOwner_(); return cueView_(cueRunLeased_(id)); }

/** Time trigger (every 5 minutes): resumes a request whose page closed mid-run. Never approves anything. */
function cueResume() {
  const now = cueNow_();
  cueRows_(cueSheet_('Requests')).forEach(r => {
    if (String(r[2]) !== 'Working') return;
    let s = null; try { s = JSON.parse(r.slice(10, 10 + CUE_CELLS_).join('')); } catch (e) { return; }
    if (!(s.lease_until > now)) { try { cueRunLeased_(s.id); } catch (e) { console.error('cueResume ' + s.id + ': ' + e); } }
  });
}

function cueRunLeased_(id) {
  const got = cueLocked_(() => {
    const L = cueLoad_(id);
    if (!L) throw new Error('No such request.');
    if (L.s.status !== 'Working' || L.s.lease_until > cueNow_()) return { s: L.s, busy: true };
    L.s.lease_until = cueNow_() + CUE_LEASE_MS_; cueSave_(L.sh, L.row, L.s);
    return L;
  });
  if (got.busy) return got.s;
  const s = got.s;
  try { cueIntakeRun_(s, () => cueSave_(got.sh, got.row, s)); }
  catch (e) { s.status = 'Failed'; s.error = String((e && e.message) || e).slice(0, 500); cueChat_('Cue', 'The intake stopped: ' + s.error, s.id); }
  delete s.lease_until;
  cueMetrics_(s);
  cueSave_(got.sh, got.row, s);
  return s;
}

/** Records the budget metric: AI calls and seconds, flagged when over 5 calls or 180 seconds. */
function cueMetrics_(s) {
  const m = s.metrics || (s.metrics = { ai_calls: 0, calls: [] });
  if (s.card_at && m.seconds_to_card == null) m.seconds_to_card = Math.round((s.card_at - s.started) / 100) / 10;
  if (s.ready_at && m.seconds_total == null) m.seconds_total = Math.round((s.ready_at - s.started) / 100) / 10;
  const over = [];
  if (m.ai_calls > CUE_BUDGET_.calls) over.push(m.ai_calls + ' AI calls');
  if (m.seconds_total > CUE_BUDGET_.seconds) over.push(m.seconds_total + ' s');
  m.flag = over.length ? 'Over budget: ' + over.join(', ') : '';
}

/** Tries a stopped request again from the step it stopped at (before anything reached Canvas). */
function cueRetry(id) {
  cueOwner_();
  cueLocked_(() => {
    const L = cueLoad_(id);
    if (!L) throw new Error('No such request.');
    if (L.s.status !== 'Failed' || (L.s.canvas && L.s.canvas.submitted)) throw new Error('Only a request that stopped before Canvas can be tried again here.');
    L.s.status = 'Working'; L.s.error = ''; cueSave_(L.sh, L.row, L.s);
  });
  return cueView_(cueRunLeased_(id));
}

/** Kiko approves, optionally with edits. Canvas re-checks and records it; then the RFQs become Gmail drafts. */
function cueApprove(id, edits) {
  cueOwner_();
  const L = cueLoad_(id);
  if (L && L.s.kind === 'change') return cueView_(cueChangeApprove_(id, edits || {}));
  return cueView_(cueIntakeApprove_(id, edits || {}));
}
/** Kiko says the project Canvas matched is not this one: run the request as a new project intake (costing and RFQs). */
function cueAsNew(id) {
  cueOwner_();
  cueLocked_(() => {
    const L = cueLoad_(id);
    if (!L) throw new Error('No such request.');
    if (L.s.kind !== 'change' || L.s.status !== 'Needs you') throw new Error('Only a change request waiting for you can be run as a new project.');
    if (!(L.s.reqs || []).length) throw new Error('GPT found no requirements to cost in this message. Send it again with what the client needs.');
    Object.assign(L.s, { kind: 'intake', as_new: true, status: 'Working', stage: 'Checking Canvas', error: '' });
    delete L.s.card_at; cueSave_(L.sh, L.row, L.s);
  });
  cueChat_('Cue', 'Running it as a new project instead.', id);
  return cueView_(cueRunLeased_(id));
}
/** Kiko rejects. Nothing goes to Canvas. */
function cueReject(id, why) { cueOwner_(); return cueView_(cueIntakeReject_(id, why)); }
/** Retries only the Gmail drafts that did not get made. */
function cueDrafts(id) { cueOwner_(); return cueView_(cueIntakeDrafts_(id)); }

/** What the page shows: recent requests (with the intake card when there is one), the chat, and the budget metric. */
function cueState() {
  cueOwner_();
  const rows = cueRows_(cueSheet_('Requests')).slice(-20).reverse(), list = [];
  rows.forEach(r => { let s = null; try { s = JSON.parse(r.slice(10, 10 + CUE_CELLS_).join('')); } catch (e) { s = null; } if (s) list.push(cueView_(s)); });
  const ch = cueSheet_('Chat'), n = ch.getLastRow() - 1;
  const chat = n > 0 ? ch.getRange(Math.max(2, n - 38), 1, Math.min(n, 40), 4).getValues()
    .map(r => ({ time: r[0] instanceof Date ? r[0].toISOString() : String(r[0]), who: String(r[1]), text: String(r[2]), request_id: String(r[3]) })) : [];
  const done = list.filter(x => x.metrics.seconds_total != null);
  const avg = k => done.length ? Math.round(done.reduce((a, x) => a + (Number(x.metrics[k]) || 0), 0) / done.length * 10) / 10 : null;
  return { version: CUE_VERSION_, requests: list, chat, metrics: { runs: done.length, avg_ai_calls: avg('ai_calls'), avg_seconds: avg('seconds_total'),
    over_budget: done.filter(x => x.metrics.flag).length, budget: CUE_BUDGET_ } };
}

/** The part of a request the page needs. Evidence and raw AI answers stay in the sheet. */
function cueView_(s) {
  const m = s.metrics || {};
  const ch = s.change || null, found = k => ((ch && ch.found) || []).filter(x => x.k === k)[0] || {};
  return { id: s.id, kind: s.kind || 'intake', created: s.created, status: s.status, stage: s.stage,
    change: !(ch && s.kind === 'change') ? null : { project: (ch.match && ch.match.name) || ch.project, what_changed: ch.what_changed, note: ch.note || '', found: (ch.found || []).length,
      match: ch.match || null, others: ch.others || [], folder_url: ch.folder_url || '', project_files: ch.project_files || [], files_more: !!ch.files_more,
      can_run_new: !!(s.reqs || []).length,
      drafts: (ch.drafts || []).map(d => ({ k: d.k, supplier: d.supplier, to: found(d.k).to, subject: found(d.k).subject, date: found(d.k).date,
        body: d.body, selected: d.selected, made: !!d.draft_id, error: d.error || '' })) }, text: String(s.text || '').slice(0, 600), files: (s.files || []).map(f => ({ name: f.name, size: f.size })), error: s.error || '',
    notes: s.notes || [], similar: s.similar || [], proposal: s.proposal || null, canvas: s.canvas || null, drafts: s.drafts || [],
    metrics: { ai_calls: m.ai_calls || 0, seconds_to_card: m.seconds_to_card == null ? null : m.seconds_to_card,
      seconds_total: m.seconds_total == null ? null : m.seconds_total, flag: m.flag || '', calls: m.calls || [] } };
}
