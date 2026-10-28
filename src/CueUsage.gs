/* CUE-2026-10-21. AI usage and cost (Kiko 19:25Z, spec specs/usage-cost.md, OK 19:47Z): Settings > AI usage and cost.
 * Read only, plain code, no AI call. Reads the Cue sheet's AI Runs tab (tokens are logged on every row since the first call) and
 * prices each row from one editable table: US$ per million tokens in/out per model, US$ per 1,000 GPT web searches, ₱ per US$.
 * The table is Script Property CUE_AI_PRICES (JSON); the defaults below fill anything not saved. It is an estimate: the real
 * bill is on platform.openai.com and console.anthropic.com. Months and days are Manila time (UTC+8, no daylight saving). */

// A function, not a top-level const: Apps Script may load CueAi.gs after this file.
const cueUsageDefaults_ = () => ({ models: Object.assign({ 'gpt-5-mini': [0.25, 2] }, CUE_CLAUDE_PRICE_), web: 10, fx: 58 });
const CUE_USAGE_MANILA_ = 8 * 3600000;
const CUE_USAGE_KINDS_ = { intake: 'Project intake', supplier: 'Supplier registration', email: 'Email', style: 'Writing style', memory: 'Teach Cue',
  process: 'Teach Cue', personal: 'Personal expense', workflow: 'Workflow map', vendor: 'Supplier search', hubspot: 'HubSpot clean-up',
  bids: 'Bid check', gtask: 'ChatGPT task', finance: 'Money', expense: 'Expense', ar: 'Receipts', sweep: 'Morning batch', pipeline: 'Pipeline review',
  readiness: 'Readiness check', change: 'Change request', status: 'Status report' };
const CUE_USAGE_TOP_ = 8;

/** A dated model id ("gpt-5-mini-2025-08-07", "claude-x-20251001") prices as its plain name. */
const cueUsageModel_ = m => String(m || '').trim().toLowerCase().replace(/-(\d{4}-\d{2}-\d{2}|\d{8})$/, '');

/** The price table: saved values over the defaults. OPENAI_PRICE (the old "input,output" property) still prices the GPT model in use. */
function cueUsagePrices_() {
  const P = cueUsageDefaults_();
  const old = cueProp_('OPENAI_PRICE', '').split(',').map(Number);
  if (old.length === 2 && old.every(x => isFinite(x) && x >= 0)) P.models[cueUsageModel_(cueProp_('OPENAI_MODEL', 'gpt-5-mini'))] = old;
  let saved = null; try { saved = JSON.parse(cueProp_('CUE_AI_PRICES', 'null')); } catch (e) { saved = null; }
  if (saved && typeof saved === 'object') {
    Object.keys(saved.models || {}).forEach(k => { const v = saved.models[k]; if (Array.isArray(v) && v.length === 2 && v.every(x => isFinite(x) && x >= 0)) P.models[cueUsageModel_(k)] = v.map(Number); });
    if (isFinite(saved.web) && saved.web >= 0) P.web = Number(saved.web);
    if (isFinite(saved.fx) && saved.fx > 0) P.fx = Number(saved.fx);
  }
  return P;
}
/** US$ for one call, or null when the model has no price. Web searches only count on GPT rows. */
function cueUsageCost_(P, provider, model, inTok, outTok, web) {
  const p = P.models[cueUsageModel_(model)];
  if (!p) return null;
  return ((Number(inTok) || 0) * p[0] + (Number(outTok) || 0) * p[1]) / 1e6 + (provider === 'GPT' ? (Number(web) || 0) * P.web / 1000 : 0);
}
const cueUsageWeb_ = note => Number((/(\d+) web searches?/.exec(String(note || '')) || [])[1]) || 0;
const cueUsageMonth_ = ms => new Date(ms + CUE_USAGE_MANILA_).toISOString().slice(0, 7);
const cueUsageR_ = n => Math.round(n * 10000) / 10000;

/** Request id -> command name, from the kind saved in each request (Requests tab, Data 1). Chat calls have chat- ids. */
function cueUsageKinds_() {
  const out = {};
  try {
    const sh = cueSheet_('Requests'), n = sh.getLastRow() - 1;
    if (n > 0) sh.getRange(2, 1, n, 11).getValues().forEach(r => {
      const k = (/"kind":"([a-z_]+)"/.exec(String(r[10] || '').slice(0, 600)) || [])[1] || 'intake';
      out[String(r[0])] = CUE_USAGE_KINDS_[k] || k;
    });
  } catch (e) { console.warn('Usage kinds: ' + e); }
  return out;
}
function cueUsageCmd_(kinds, req, step) {
  req = String(req || '');
  if (/^chat-/.test(req)) return 'Chat';
  if (req === 'canvas') return 'Canvas: ' + (String(step || '').trim() || 'AI');   // CUE-STRUCTURE-4.6: a Canvas AI Runs row, by its job
  if (/^cue-ed-/.test(req)) return 'Other (canvas edit)';   // Canvas edits (CueEdit.gs) are not in the Requests tab
  if (/^cue-nm-/.test(req)) return 'New mail';   // CueNewMail.gs: the sort runs under its tick's own id, not a request's
  return kinds[req] || (String(step || '').trim() ? 'Other (' + String(step).trim().replace(/\s+\d+( of \d+)?$/, '') + ')' : 'Other');
}

/** The Settings section: this month, the likely month-end, and every month since Cue started, newest first. */
function cueUsage() {
  cueOwner_();
  return cueUsage_();
}
function cueUsage_() {
  const P = cueUsagePrices_(), now = cueNow_(), kinds = cueUsageKinds_(), months = {}, unpriced = {};
  let rows = [];
  try { const sh = cueSheet_('AI Runs'), n = sh.getLastRow() - 1; rows = n > 0 ? sh.getRange(2, 1, n, CUE_TABS_['AI Runs'].length).getValues() : []; }
  catch (e) { return { prices: P, months: [], unpriced: [], error: String((e && e.message) || e) }; }
  const cv = cueUsageCanvas_(); rows = rows.concat(cv.rows);
  let first = 0;
  const daily = [];   // [ms, usd] for the projection
  rows.forEach(r => {
    const t = r[0] instanceof Date ? r[0].getTime() : new Date(r[0]).getTime();
    if (!isFinite(t)) return;
    const provider = String(r[3] || ''), model = cueUsageModel_(r[4]), inTok = Number(r[5]) || 0, outTok = Number(r[6]) || 0;
    const failed = String(r[9] || '') !== 'OK', web = cueUsageWeb_(r[10]), cost = cueUsageCost_(P, provider, model, inTok, outTok, web);
    if (cost === null && (inTok || outTok)) unpriced[model || '(no model)'] = 1;
    const usd = cost || 0, key = cueUsageMonth_(t), cmd = cueUsageCmd_(kinds, r[1], r[2]);
    const m = months[key] || (months[key] = { month: key, calls: 0, claude: 0, gpt: 0, failed: 0, usd: 0, ai: {}, cmd: {} });
    m.calls++; m.usd += usd; if (failed) m.failed++;
    if (provider === 'Claude') m.claude++; else if (provider === 'GPT') m.gpt++;
    const a = m.ai[provider + '|' + model] || (m.ai[provider + '|' + model] = { provider, model, calls: 0, failed: 0, in: 0, out: 0, web: 0, usd: 0, priced: cost !== null || !(inTok || outTok) });
    a.calls++; if (failed) a.failed++; a.in += inTok; a.out += outTok; a.web += web; a.usd += usd;
    const c = m.cmd[cmd] || (m.cmd[cmd] = { name: cmd, calls: 0, usd: 0 });
    c.calls++; c.usd += usd;
    if (!first || t < first) first = t;
    daily.push([t, usd]);
  });
  const cur = cueUsageMonth_(now), list = Object.keys(months).sort().reverse().map(k => {
    const m = months[k], cmds = Object.keys(m.cmd).map(x => m.cmd[x]).sort((a, b) => b.usd - a.usd || b.calls - a.calls);
    const top = cmds.slice(0, CUE_USAGE_TOP_), rest = cmds.slice(CUE_USAGE_TOP_);
    if (rest.length) top.push({ name: 'Other', calls: rest.reduce((s, x) => s + x.calls, 0), usd: rest.reduce((s, x) => s + x.usd, 0) });
    const [y, mo] = k.split('-').map(Number);
    return { month: k, label: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][mo - 1] + ' ' + y, current: k === cur,
      calls: m.calls, claude: m.claude, gpt: m.gpt, failed: m.failed, usd: cueUsageR_(m.usd),
      by_ai: Object.keys(m.ai).map(x => Object.assign({}, m.ai[x], { usd: cueUsageR_(m.ai[x].usd) })).sort((a, b) => b.usd - a.usd),
      by_cmd: top.map(x => ({ name: x.name, calls: x.calls, usd: cueUsageR_(x.usd), share: m.usd > 0 ? Math.round(x.usd / m.usd * 100) : 0 })) };
  });
  // Likely month-end: cost so far + the average day of the last 7 days (or since Cue's first call, if newer) x days left.
  if (list.length && list[0].current) {
    const [y, mo] = cur.split('-').map(Number);
    const monthStart = Date.UTC(y, mo - 1, 1) - CUE_USAGE_MANILA_, monthEnd = Date.UTC(y, mo, 1) - CUE_USAGE_MANILA_;
    const from = Math.max(now - 7 * 86400000, first || now), span = Math.max(1, (now - from) / 86400000);
    const rate = daily.filter(d => d[0] >= from && d[0] <= now).reduce((s, d) => s + d[1], 0) / span;
    list[0].likely_usd = cueUsageR_(list[0].usd + rate * Math.max(0, (monthEnd - now) / 86400000));
    list[0].rough = !first || now - first < 7 * 86400000;
    list[0].days = Math.ceil((now - monthStart) / 86400000);
  }
  return { prices: P, months: list, unpriced: Object.keys(unpriced), first: first ? new Date(first).toISOString() : '', canvas: { rows: cv.rows.length, note: cv.note } };
}

/* CUE-STRUCTURE-4.6 (Kiko 28 Oct 2026 07:42Z, Phase 4 "yes"; specs/cue-structure-review.md): one AI cost view. Canvas logs its own
 * Claude calls in the Ledger's AI Runs tab (AiCore.gs aiLog_: Time, Job, Model, Input tokens, Output tokens, Cost (USD), Status, Note).
 * When Canvas's allow-list has that tab, its rows join Cue's in the same months, priced by the same table, under "Canvas: <job>".
 * Not listed or unreadable: Cue's own rows only, with a note. Values come as display text; times are Manila. */
function cueUsageCanvas_() {
  const s = { id: 'usage-' + cueNow_().toString(36) };
  let T;
  try { if (!cueGtListed_(s, 'airuns')) return { rows: [], note: 'Canvas AI calls not included yet (AI Runs is not on Canvas\'s allow-list).' };
    T = cueGtBridgeTab_(s, 'airuns'); }
  catch (e) { return { rows: [], note: 'Canvas AI calls could not be read: ' + cueStr_((e && e.message) || e, 160) }; }
  const get = (o, h) => { const k = Object.keys(o).filter(x => x.toLowerCase() === h.toLowerCase())[0]; return k ? o[k] : ''; };
  const num = v => Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')) || 0;
  const rows = [];
  T.rows.forEach(o => {
    const t = cueUsageMnl_(get(o, 'Time')); if (!isFinite(t)) return;
    rows.push([new Date(t), 'canvas', String(get(o, 'Job') || ''), 'Claude', String(get(o, 'Model') || ''), num(get(o, 'Input tokens')), num(get(o, 'Output tokens')),
      '', '', String(get(o, 'Status') || ''), String(get(o, 'Note') || '')]);
  });
  return { rows, note: '' };
}
/** A sheet time as display text ("10/28/2026 14:03:22", "2026-10-28 14:03") in Manila time, as ms; NaN when unclear. */
function cueUsageMnl_(v) {
  if (v instanceof Date) return v.getTime();
  const t = String(v || '').trim(); let m;
  if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(t))) return Date.UTC(+m[3], +m[1] - 1, +m[2], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)) - CUE_USAGE_MANILA_;
  if ((m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(t))) return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)) - CUE_USAGE_MANILA_;
  return Date.parse(t);
}

/** Save prices from the Settings form: { models: { name: [in, out] }, web, fx }. Blank or bad values keep the old ones. */
function cueUsagePrices(p) {
  cueOwner_();
  p = p || {};
  const cur = cueUsagePrices_(), out = { models: {}, web: cur.web, fx: cur.fx }, num = (v, lo, hi) => { const n = Number(v); return v !== '' && v != null && isFinite(n) && n >= lo && n <= hi ? n : null; };
  let saved = null; try { saved = JSON.parse(cueProp_('CUE_AI_PRICES', 'null')); } catch (e) { saved = null; }
  Object.assign(out.models, (saved && saved.models) || {});
  Object.keys(p.models || {}).forEach(k => {
    const name = cueUsageModel_(k), v = p.models[k];
    if (!/^[a-z0-9][a-z0-9.\-_]{1,60}$/.test(name) || !Array.isArray(v)) return;
    const a = num(v[0], 0, 1000), b = num(v[1], 0, 1000);
    if (a !== null && b !== null) out.models[name] = [a, b];
  });
  const w = num(p.web, 0, 1000), f = num(p.fx, 1, 500);
  if (w !== null) out.web = w;
  if (f !== null) out.fx = f;
  PropertiesService.getScriptProperties().setProperty('CUE_AI_PRICES', JSON.stringify(out));
  return cueUsage_();
}
