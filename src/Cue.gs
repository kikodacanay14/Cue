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

const CUE_VERSION_ = 'Cue 1.0';
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
  const msg = 'Cue is set up (sheet ' + ss.getId() + '). ' + (missing.length ? 'Still missing in Script Properties: ' + missing.join(', ') + '.' : 'All keys are present.');
  console.log(msg);
  return msg;
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
/** Kiko sends a message. In this first slice every message starts an intake. Returns the new request id. */
function cueSend(text) {
  cueOwner_();
  const t = String(text || '').trim();
  if (t.length < 20) throw new Error('Paste the client\'s inquiry or describe the event (at least a sentence).');
  if (t.length > 12000) throw new Error('That is too long for one intake (12,000 characters at most).');
  const now = cueNow_(), d = new Date(now);
  const id = 'cue-' + Utilities.formatDate(d, 'Asia/Manila', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 65536).toString(16).padStart(4, '0');
  const s = { id, version: CUE_VERSION_, kind: 'intake', created: d.toISOString(), started: now, text: t, status: 'Working', stage: 'Received',
    metrics: { ai_calls: 0, calls: [] }, notes: [] };
  cueLocked_(() => { const sh = cueSheet_('Requests'); sh.appendRow([id]); cueSave_(sh, sh.getLastRow(), s); });
  cueChat_('Kiko', t, id);
  cueChat_('Cue', 'Starting a project intake. GPT is reading it first.', id);
  return { request_id: id };
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
function cueApprove(id, edits) { cueOwner_(); return cueView_(cueIntakeApprove_(id, edits || {})); }
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
  return { id: s.id, created: s.created, status: s.status, stage: s.stage, text: String(s.text || '').slice(0, 600), error: s.error || '',
    notes: s.notes || [], similar: s.similar || [], proposal: s.proposal || null, canvas: s.canvas || null, drafts: s.drafts || [],
    metrics: { ai_calls: m.ai_calls || 0, seconds_to_card: m.seconds_to_card == null ? null : m.seconds_to_card,
      seconds_total: m.seconds_total == null ? null : m.seconds_total, flag: m.flag || '', calls: m.calls || [] } };
}
