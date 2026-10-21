// Local tests for Cue (Cue.gs, CueAi.gs, CueBridge.gs, CueIntake.gs). Apps Script services, GPT, Claude, the Canvas bridge
// and Gmail are mocked; synthetic data only, no network. The submit_intake proposal is checked against the real bridge
// schema in fixtures/ZapBridge.gs (copied from Canvas V185). Run: node test/cue.test.js
const fs = require('fs'), vm = require('vm'), path = require('path'), crypto = require('crypto'), assert = require('assert');
const CODE = ['Cue.gs', 'CueAi.gs', 'CueBridge.gs', 'CueFiles.gs', 'CueIntake.gs', 'CueChange.gs'].map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n');
const BRIDGE = vm.createContext({ console, JSON, Math, Date, Number, String, Object, Array, Error, RegExp });
vm.runInContext(fs.readFileSync(path.join(__dirname, 'fixtures', 'ZapBridge.gs'), 'utf8'), BRIDGE);
const bridgeCheck = (action, args) => { BRIDGE.__a = args; BRIDGE.__n = action; return vm.runInContext('zbValidate_(__a, ZB_ACTIONS_[__n].schema, "")', BRIDGE); };
const URL = 'https://script.google.com/macros/s/AKfycbTEST_bridge-1/exec', SECRET = 'test-secret-not-real';

function sheetMock() {
  const rows = [];
  return { rows, getLastRow: () => rows.length, appendRow: v => rows.push(v.slice()), setFrozenRows: () => {},
    getRange: (r, c, nr = 1, nc = 1) => ({
      getValues: () => rows.slice(r - 1, r - 1 + nr).map(x => { const y = x.slice(c - 1, c - 1 + nc); while (y.length < nc) y.push(''); return y; }),
      setValues: v => v.forEach((vals, i) => { while (rows.length < r + i) rows.push([]); vals.forEach((x, j) => { rows[r - 1 + i][c - 1 + j] = x; }); }) }) };
}
const resp = (code, obj) => ({ getResponseCode: () => code, getContentText: () => (typeof obj === 'string' ? obj : JSON.stringify(obj)) });
const gptOk = data => resp(200, { status: 'completed', model: 'gpt-5-mini', usage: { input_tokens: 900, output_tokens: 300 },
  output: [{ type: 'web_search_call' }, { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(data) }] }] });
const claudeOk = data => resp(200, { model: 'claude-sonnet-5-5', stop_reason: 'end_turn', usage: { input_tokens: 4000, output_tokens: 1500 },
  content: [{ type: 'text', text: JSON.stringify(data) }] });

const READ = { client: { company: 'Acme Corp', contact: 'Ana Reyes', email: 'ana@acme.example', phone: '0917 000 0000' },
  event: { name: 'Acme Year-End Party', type: 'Party', date: '2026-12-12', venue: 'SMX Aura', city: 'Taguig', pax: 300, budget: '' },
  requirements: [{ category: 'Lights and sound', description: 'LED wall 4m x 3m', quantity: 1, occurrence: 1, search_terms: 'led wall' },
    { category: 'Activities', description: 'Photo booth with prints', quantity: 1, occurrence: 1, search_terms: 'photo booth' },
    { category: 'Show', description: 'Drone light show, 100 drones', quantity: 1, occurrence: 1, search_terms: 'drone show' }],
  questions: [] };
const EVIDENCE = {
  R1: { owned: [], ran: { in_house: 0, outsourced: 3 }, quotes: [{ entry_id: 'E1', project: 'S-1', date: '2026-05-01', supplier: 'Sonic Pro', description: 'LED wall 4x3', amount: 50000, qty: 1, occ: 1, unit: 50000, awarded: true }],
    stats: { count: 1, low: 50000, median: 50000, high: 50000, awarded_median: 50000, latest: { unit: 50000, date: '2026-05-01', supplier: 'Sonic Pro' } },
    bse: { packages: [], items: [] }, suppliers: [{ name: 'Sonic Pro', email: 'sales@sonicpro.example', accredited: true, preferred: true, quoted_before: true, new: false, why: 'preferred, accredited' }] },
  R2: { owned: [], ran: {}, quotes: [], stats: { count: 0 }, bse: { packages: [{ id: 'PKG-7', name: 'Photo booth package', desc: '', price: 25000 }], items: [] }, suppliers: [] },
  R3: { owned: [], ran: {}, quotes: [], stats: { count: 0 }, bse: { packages: [], items: [] }, suppliers: [] } };
const COST = { lines: [
  { key: 'R1', execution: 'Outsourced', why: 'Rented before from Sonic Pro.', price_source: '', unit_cost: 48000, cost_basis: 'past quotes', sources: ['E1', 'E999'], suppliers: ['Sonic Pro', 'Invented Co'], note: '' },
  { key: 'R2', execution: 'Outsourced', why: 'BSE package covers it.', price_source: 'PKG-7', unit_cost: 0, cost_basis: 'none', sources: [], suppliers: [], note: '' },
  { key: 'R3', execution: 'Outsourced', why: 'No history.', price_source: 'FAKE-1', unit_cost: 0, cost_basis: 'none', sources: [], suppliers: [], note: '' }],
  study: 'Three outsourced scopes.', risks: ['Drone permits'], questions: ['Indoor or outdoor drone show?'] };
const RESEARCH = { prices: [{ key: 'R3', unit_cost: 150000, what: '100-drone show', links: ['https://drones.example/ph-prices', 'http://insecure.example'] },
  { key: 'R2', unit_cost: 9999, what: 'not asked', links: ['https://x.example/a'] }],
  suppliers: [{ key: 'R3', name: 'SkyLights PH', email: 'hello@skylights.example', website: 'https://skylights.example', why: 'drone shows' },
    { key: 'R1', name: 'Sonic Pro', email: '', website: '', why: 'dup' }, { key: 'R3', name: 'Guess Co', email: 'not an email', website: '', why: 'x' }] };
const RFQS = { rfqs: [{ supplier: 'Sonic Pro', subject: 'RFQ: LED wall', body: 'Dear Sonic Pro,\nPlease quote...\nBlank Space Events' },
  { supplier: 'SkyLights PH', subject: 'RFQ: Drone show\nBcc: x@y.z', body: 'Dear SkyLights,\nPlease quote... and send your company profile.\nBlank Space Events' },
  { supplier: 'Guess Co', subject: 'RFQ', body: 'Dear Guess Co, ...' }, { supplier: 'Stranger Ltd', subject: 'x', body: 'not asked for' }] };

function sandbox(o = {}) {
  const props = { CUE_SHEET_ID: 'cue', OPENAI_API_KEY: 'sk-test', ANTHROPIC_API_KEY: 'sk-ant-test', ZAD_SECRET: SECRET, CUE_BRIDGE_URL: URL, ...(o.props || {}) };
  const tabs = { Requests: sheetMock(), Chat: sheetMock(), 'AI Runs': sheetMock() }; Object.keys(tabs).forEach(k => tabs[k].appendRow(['header']));
  const log = { gpt: [], claude: [], bridge: [], gmail: [], batches: [] }, drive = { n: 0, files: {}, meta: {}, parent: {}, type: {} };
  let now = Date.parse('2026-10-21T03:00:00Z');
  const step = o.step == null ? 5000 : o.step;
  const route = req => {
    const u = req.url, body = typeof req.payload === 'string' && /^[{\[]/.test(req.payload) ? JSON.parse(req.payload) : null;
    if (u.indexOf('api.openai.com') >= 0) {
      const n = body.text.format.name; log.gpt.push(body);
      if ((o.fail || {})[n]) return o.fail[n]();
      if (n === 'requotes') return gptOk(o.requotes || REQUOTES);
      if (n === 'chat') return gptOk(o.talk || { reply: 'Doing well! Ready when you are.', looks_like_inquiry: false });
      return gptOk(n === 'intake' ? (o.read || READ) : n === 'research' ? (o.research || RESEARCH) : o.rfqs || RFQS);
    }
    if (u.indexOf('api.anthropic.com') >= 0) { log.claude.push(body); return (o.fail || {}).cost ? o.fail.cost() : claudeOk(o.cost || COST); }
    if (u.indexOf('script.google.com') >= 0) {
      const sig = u.split('?sig=')[1], want = crypto.createHmac('sha256', SECRET).update(String(body.ts) + '.' + req.payload).digest('hex');
      assert.strictEqual(sig, want, 'bridge signature'); log.bridge.push(body);
      const bad = bridgeCheck(body.action, body.args);
      if (bad) return resp(200, { ok: false, status: 'Rejected', error: bad });
      if (body.action === 'find_similar_projects') return resp(200, { ok: true, status: 'Completed', result: o.similar || [] });
      if (body.action === 'list_project_files') {
        if (o.filesFail) return resp(200, { ok: false, status: 'Blocked', error: 'Google Drive could not list the project folder (HTTP 403).' });
        log.filesFor = body.project_id;
        return resp(200, { ok: true, status: 'Completed', result: { folder_url: 'https://drive.google.com/drive/folders/PF1', own: true, more: false,
          files: [{ name: 'JBL mats v2.pdf', url: 'https://drive.google.com/file/d/x1/view', mime: 'application/pdf', size: 5, modified: '2026-10-20T01:00:00Z', folder: 'Project folder › Visual Materials' },
            { name: 'evil.pdf', url: 'javascript:alert(1)', mime: 'application/pdf', size: 5, modified: '2026-10-19', folder: 'Project folder' }] } });
      }
      if (body.action === 'intake_evidence') return resp(200, { ok: true, status: 'Completed', result: o.evidence || EVIDENCE });
      if (body.action === 'submit_intake') {
        const L = body.args.proposal.lines, price = { 'PKG-7': 25000 };
        const t = { known_cost: L.reduce((s, l) => s + (l.cost_basis === 'none' ? 0 : l.unit_cost * l.quantity * l.occurrence), 0),
          known_price: L.reduce((s, l) => s + (price[l.price_source] || 0) * l.quantity * l.occurrence, 0) };
        if (o.canvasCost != null) t.known_cost = o.canvasCost;
        log.submitted = body.args.proposal;
        return resp(200, { ok: true, status: 'Completed', result: { ok: true, request_id: body.args.request_id, status: 'Waiting for Kiko', summary: 'summary',
          proposal: { totals: t, lines: L.map(l => Object.assign({}, l, o.canvasCost != null ? { unit_cost: o.canvasCost } : {})) } } });
      }
      if (body.action === 'apply_intake') {
        if (o.applyFails) return resp(200, { ok: false, status: 'Blocked', error: 'Apply failed after project S-99900001ZZ was made: boom' });
        return resp(200, { ok: true, status: 'Completed', result: { ok: true, project_id: 'S-99900001ZZ', project_number: '052', req_ids: ['REQ-1'], rfqs: log.submitted.rfqs } });
      }
      if (body.action === 'save_project_file') {
        log.saved = log.saved || []; log.saved.push({ pid: body.project_id, name: body.args.name, type: body.args.type, mime: body.args.mime, bytes: Buffer.from(body.args.data, 'base64').length });
        if (o.saveFail && log.saved.length === 1) return resp(200, { ok: false, status: 'Blocked', error: 'Drive busy' });
        return resp(200, { ok: true, status: 'Completed', result: { ok: true, url: 'https://drive.google.com/file/d/p' + log.saved.length, name: body.project_id + ' · ' + body.args.name, type: body.args.type, existed: false } });
      }
      if (body.action === 'make_rfq_drafts') {
        log.canvasDrafts = (log.canvasDrafts || 0) + 1;
        if (o.canvasDraftsFail && log.canvasDrafts === 1) return resp(200, { ok: false, status: 'Blocked', error: 'Gmail busy' });
        return resp(200, { ok: true, status: 'Completed', result: { ok: true, drafts: log.submitted.rfqs.map((q, i) => ({ k: i + ':0', supplier: q.suppliers[0].name,
          to: q.suppliers[0].email, subject: q.subject, new: q.suppliers[0].new, id: 'info-draft-' + i, error: '' })) } });
      }
    }
    if (u.indexOf('www.googleapis.com') >= 0) {
      log.drive = log.drive || []; log.drive.push((req.method || 'get') + ' ' + u.split('?')[0].replace(/^.*googleapis\.com/, ''));
      const m = (req.method || 'get').toLowerCase(), fileId = (u.split('?')[0].match(/files\/([^/]+)$/) || [])[1];
      if (m === 'post' && u.indexOf('/upload/') >= 0) { const id = 'f' + (++drive.n); drive.files[id] = Buffer.from(req.payload); drive.type[id] = req.contentType; return resp(200, { id }); }
      if (m === 'post') return resp(200, { id: 'folder-1' });
      if (m === 'patch') { drive.meta[fileId] = JSON.parse(req.payload); drive.parent[fileId] = u.split('addParents=')[1]; return resp(200, { id: fileId }); }
      if (u.indexOf('alt=media') >= 0) { const b = drive.files[fileId]; return b ? { getResponseCode: () => 200, getContent: () => Array.from(b), getContentText: () => b.toString('utf8') } : resp(404, {}); }
      if (drive.files[fileId]) return resp(200, { id: fileId, name: (drive.meta[fileId] || {}).name, mimeType: drive.type[fileId], size: String(drive.files[fileId].length), parents: [drive.parent[fileId]] });
      if (/^f\d+$/.test(fileId || '') || fileId === 'not-ours') return resp(404, {});
      return resp(200, { id: fileId, trashed: !!(o.folderTrashed) });
    }
    if (u.indexOf('oauth2.googleapis.com/tokeninfo') >= 0) { log.tokeninfo = req.payload; return resp(200, { scope: (o.scopes || ['spreadsheets', 'gmail.compose', 'gmail.readonly', 'drive.file']).map(x => /^https/.test(x) ? x : 'https://www.googleapis.com/auth/' + x).join(' ') }); }
    if (u.indexOf('gmail.googleapis.com/gmail/v1/users/me/messages') >= 0) {
      if (o.gmailScope) return resp(403, { error: { code: 403, message: 'Request had insufficient authentication scopes.', status: 'PERMISSION_DENIED' } });
      if (u.indexOf('/messages?') >= 0) { log.gmailQ = decodeURIComponent(u.split('q=')[1]); return resp(200, { messages: (o.sent || SENT).map(m => ({ id: m.id, threadId: m.thread })) }); }
      const m = (o.sent || SENT).find(x => u.indexOf('/messages/' + x.id + '?') >= 0);
      return resp(200, { id: m.id, threadId: m.thread, internalDate: String(m.ms), snippet: m.snippet,
        payload: { headers: [{ name: 'To', value: m.to }, { name: 'Subject', value: m.subject }, { name: 'Message-ID', value: '<' + m.id + '@mail>' }] } });
    }
    if (u.indexOf('upload/gmail/v1/users/me/drafts') >= 0) {
      log.replies = log.replies || []; log.replies.push({ type: req.contentType, payload: req.payload });
      return (o.replyFail && log.replies.length === 1) ? resp(500, {}) : resp(200, { id: 'reply-' + log.replies.length });
    }
    if (u.indexOf('/drafts/send') >= 0) {
      log.sent = log.sent || []; log.sent.push(JSON.parse(req.payload).id);
      return (o.sendFail && log.sent.length === 1) ? resp(500, {}) : resp(200, { id: 'sent-' + log.sent.length });
    }
    if (u.indexOf('gmail.googleapis.com') >= 0) {
      log.gmail.push(Buffer.from(JSON.parse(req.payload).message.raw, 'base64url').toString('utf8'));
      return (o.gmailFail && log.gmail.length === 1) ? resp(500, {}) : resp(200, { id: 'draft-' + log.gmail.length });
    }
    throw new Error('unexpected fetch ' + u);
  };
  const ctx = {
    console, JSON, Math, Date, Number, String, Object, Array, Error, RegExp, isFinite,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = v; } }) },
    SpreadsheetApp: { openById: () => ({ getId: () => 'cue', getSheetByName: n => tabs[n] || null, insertSheet: n => (tabs[n] = sheetMock()) }), create: () => ({ getId: () => 'new' }) },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'kiko@example.com' }), getActiveUser: () => ({ getEmail: () => o.viewer || 'kiko@example.com' }) },
    ScriptApp: { getOAuthToken: () => 'oauth-token', getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ everyMinutes: () => ({ create: () => ({}) }) }) }), invalidateAuth: () => { log.invalidated = (log.invalidated || 0) + 1; },
      getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/CUE/exec' }) },
    Utilities: { sleep: () => {}, formatDate: (d) => d.toISOString().slice(0, 10),
      computeHmacSha256Signature: (v, k) => Array.from(crypto.createHmac('sha256', k).update(v).digest()).map(b => (b > 127 ? b - 256 : b)),
      newBlob: (s, type, name) => { const b = Array.isArray(s) ? Buffer.from(s.map(x => x & 255)) : Buffer.from(String(s), 'utf8');
        return { getBytes: () => Array.from(b), getContentType: () => type, getName: () => name }; },
      base64Decode: t => Array.from(Buffer.from(String(t), 'base64')).map(b => (b > 127 ? b - 256 : b)),
      base64Encode: b => Buffer.from(b.map(x => x & 255)).toString('base64'), base64EncodeWebSafe: b => Buffer.from(b).toString('base64url') },
    UrlFetchApp: {
      fetch: (u, req) => { now += step; return route(typeof u === 'string' ? Object.assign({ url: u }, req) : u); },
      fetchAll: reqs => { now += (o.batchStep || step); log.batches.push(reqs.map(r => r.url.split('/')[2])); return reqs.map(route); } },
    HtmlService: {}
  };
  vm.createContext(ctx); vm.runInContext(CODE, ctx);
  ctx.cueNow_ = () => now;
  return { ctx, opts: o, props, tabs, log, drive, state: id => JSON.parse(tabs.Requests.rows.find(r => r[0] === id).slice(10, 14).join('')) };
}
const INQ = 'Hi BSE, Acme Corp here. We need an LED wall, a photo booth and a drone show for our year-end party on 12 December at SMX Aura, 300 pax.';
function startToCard(o) { const t = sandbox(o); const id = t.ctx.cueSend(INQ, [], 'intake').request_id; const v = t.ctx.cueRun(id); return Object.assign(t, { id, v }); }

const deq = (a, b, m) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), b, m); // values from the sandbox's realm
const tests = [];
const test = (n, f) => tests.push([n, f]);

test('C1 bridge requests are signed like every other bridge caller and use only Cue\'s four actions', () => {
  const t = startToCard();
  deq(t.log.bridge.map(b => b.action), ['find_similar_projects', 'intake_evidence']);
  t.log.bridge.forEach(b => { assert.ok(/^[A-Za-z0-9:_-]{8,120}$/.test(b.command_id)); assert.strictEqual(b.task_id, t.id); assert.ok(b.ts > 0); });
});
test('C2 full run: 4 AI calls (GPT read, Claude cost + GPT research in parallel, GPT RFQs), card waiting for Kiko', () => {
  const t = startToCard();
  assert.strictEqual(t.v.status, 'Needs you'); assert.strictEqual(t.v.metrics.ai_calls, 4);
  assert.strictEqual(t.log.gpt.length, 3); assert.strictEqual(t.log.claude.length, 1);
  deq(t.log.batches.map(b => b.slice().sort()), [['api.openai.com'], ['script.google.com', 'script.google.com'], ['api.anthropic.com', 'api.openai.com'], ['api.openai.com']]);
  assert.ok(t.log.gpt[1].tools && t.log.gpt[1].tools[0].type === 'web_search', 'research uses web search');
  assert.ok(!t.log.gpt[0].tools && !t.log.gpt[2].tools, 'read and RFQ calls do not search the web');
  const rs = JSON.parse(t.log.gpt[1].input);
  deq(rs.price_needed.map(x => x.key), ['R3'], 'only the line with no BSE price, quote or stock is researched');
  deq(rs.known_suppliers, ['Sonic Pro']);
});
test('C3 Canvas rules applied before Kiko sees it: cited quotes, BSE price from the list, research labelled', () => {
  const p = startToCard().v.proposal, [r1, r2, r3] = p.lines;
  deq(r1.sources, ['E1']); assert.strictEqual(r1.cost_basis, 'past quotes'); assert.strictEqual(r1.unit_cost, 48000);
  assert.strictEqual(r2.unit_price, 25000); assert.strictEqual(r2.price_basis, 'BSE package'); assert.strictEqual(r2.cost_basis, 'none', 'unasked research is ignored');
  assert.strictEqual(r3.price_source, ''); assert.ok(r3.flags.some(f => /not shown/.test(f)));
  assert.strictEqual(r3.cost_basis, 'market research'); assert.strictEqual(r3.unit_cost, 150000);
  deq(r3.sources, ['https://drones.example/ph-prices']); assert.ok(r3.flags.indexOf('Research, not history: confirm with an RFQ') >= 0);
  deq(p.totals, { known_cost: 198000, known_price: 25000, lines_with_bse_price: 1, lines_without_cost: 1, outsourced: 3, in_house: 0 });
});
test('C4 suppliers: Claude picks only from the Supplier DB; research adds new, unaccredited ones; no guessed emails', () => {
  const p = startToCard().v.proposal;
  deq(p.lines[0].suppliers.map(s => s.name), ['Sonic Pro']);
  deq(p.lines[2].suppliers.map(s => [s.name, s.new, s.email]), [['SkyLights PH', true, 'hello@skylights.example'], ['Guess Co', true, '']]);
  assert.ok(p.lines[1].flags.some(f => /No supplier/.test(f)));
});
test('C5 GPT drafts one RFQ per supplier from Claude\'s names plus research\'s; strangers dropped; subject cannot inject headers', () => {
  const t = startToCard(), p = t.v.proposal, ask = JSON.parse(t.log.gpt[2].input);
  deq(ask.suppliers.map(s => [s.supplier, s.keys.join(','), s.new]), [['Sonic Pro', 'R1', false], ['SkyLights PH', 'R3', true], ['Guess Co', 'R3', true]]);
  assert.ok(!/Acme/.test(t.log.gpt[2].input), 'the client name is not given to the RFQ writer');
  deq(p.rfqs.map(q => q.suppliers[0].name), ['Sonic Pro', 'SkyLights PH', 'Guess Co']);
  assert.ok(!/[\r\n]/.test(p.rfqs[1].subject));
});
test('C6 no gaps and enough suppliers: research is skipped, 3 AI calls', () => {
  const ev = JSON.parse(JSON.stringify(EVIDENCE)), sup = ['A', 'B', 'C'].map(n => ({ name: 'Sup ' + n, email: '', accredited: true, preferred: false }));
  ev.R1.suppliers = sup; ev.R2.suppliers = sup; ev.R3 = JSON.parse(JSON.stringify(ev.R1));
  const t = startToCard({ evidence: ev, cost: Object.assign({}, COST, { lines: COST.lines.map(l => Object.assign({}, l, { suppliers: ['Sup A'] })) }) });
  assert.strictEqual(t.v.metrics.ai_calls, 3); assert.strictEqual(t.log.gpt.length, 2);
});
test('C7 metric: calls and seconds recorded; a run over 3 minutes is flagged', () => {
  const fast = startToCard();
  assert.ok(fast.v.metrics.seconds_total > 0 && fast.v.metrics.seconds_total <= 180); assert.strictEqual(fast.v.metrics.flag, '');
  const row = fast.tabs.Requests.rows.find(r => r[0] === fast.id); assert.strictEqual(row[5], 4); assert.strictEqual(row[7], fast.v.metrics.seconds_total);
  const slow = startToCard({ batchStep: 70000 });
  assert.ok(/Over budget: .*s/.test(slow.v.metrics.flag), slow.v.metrics.flag);
  assert.strictEqual(slow.tabs['AI Runs'].rows.length - 1, 4);
});
test('C8 CUE_DRAFTS_IN=canvas: Canvas re-checks (submit_intake, real bridge schema), writes once, then makes the RFQ drafts in info@', () => {
  const t = startToCard({ props: { CUE_DRAFTS_IN: 'canvas' } }), v = t.ctx.cueApprove(t.id, {});
  assert.strictEqual(v.status, 'Done'); assert.strictEqual(v.canvas.project_number, '052');
  deq(t.log.bridge.map(b => b.action).slice(2), ['submit_intake', 'apply_intake', 'make_rfq_drafts']);
  assert.strictEqual(t.log.gmail.length, 0, 'Cue makes no drafts in the personal Gmail');
  deq(v.drafts.map(d => [d.supplier, d.mailbox]), [['Sonic Pro', 'info@'], ['SkyLights PH', 'info@'], ['Guess Co', 'info@']]);
  assert.throws(() => t.ctx.cueApprove(t.id, {}), /not waiting for you/);
});
test('C8b default (Kiko 03:25Z): one draft per supplier in Kiko\'s Gmail, To blank without an email, no header injection', () => {
  const t = startToCard(), v = t.ctx.cueApprove(t.id, {});
  assert.strictEqual(v.status, 'Done'); assert.strictEqual(t.log.gmail.length, 3); assert.ok(!t.log.bridge.some(b => b.action === 'make_rfq_drafts'));
  assert.ok(/^To: sales@sonicpro\.example\r\n/.test(t.log.gmail[0])); assert.ok(!/^To:/.test(t.log.gmail[2]), 'no email on file: To left blank');
  assert.ok(/Subject: =\?UTF-8\?B\?/.test(t.log.gmail[1]) && !/Bcc/i.test(t.log.gmail[1].split('\r\n\r\n')[0]));
});
test('C9 edit first: Kiko\'s cost becomes "set by Kiko", removed line and skipped RFQ never reach Canvas', () => {
  const t = startToCard();
  const v = t.ctx.cueApprove(t.id, { event: { venue: 'SMX Aura Hall 2' }, lines: { R1: { unit_cost: 45000 }, R2: { remove: true } }, skip_rfqs: [2] });
  const sp = t.log.submitted;
  assert.strictEqual(v.status, 'Done'); deq(sp.lines.map(l => l.key), ['R1', 'R3']);
  assert.strictEqual(sp.lines[0].cost_basis, 'set by Kiko'); deq(sp.lines[0].sources, []);
  assert.strictEqual(sp.event.venue, 'SMX Aura Hall 2'); assert.strictEqual(sp.rfqs.length, 2);
  assert.throws(() => { const u = startToCard(); u.ctx.cueApprove(u.id, { event: { date: '12/12/2026' } }); }, /2026-11-13/);
});
test('C10 Canvas changes a number on re-check: nothing written, card returns with Canvas\'s numbers', () => {
  const t = startToCard({ canvasCost: 1 }), v = t.ctx.cueApprove(t.id, {});
  assert.strictEqual(v.status, 'Needs you'); assert.ok(!t.log.bridge.some(b => b.action === 'apply_intake'));
  assert.ok(v.notes.some(n => /nothing was written/.test(n)));
});
test('C11 apply fails: stops "Failed", never retried by the trigger; "Check Canvas and finish" calls apply only', () => {
  const t = startToCard({ applyFails: true }), v = t.ctx.cueApprove(t.id, {});
  assert.strictEqual(v.status, 'Failed'); assert.ok(/trying again never writes twice/.test(v.error));
  const before = t.log.bridge.length; t.ctx.cueResume(); assert.strictEqual(t.log.bridge.length, before);
  t.ctx.cueApprove(t.id, {}); deq(t.log.bridge.slice(before).map(b => b.action), ['apply_intake']);
});
test('C12 reject: nothing goes to Canvas', () => {
  const t = startToCard(), v = t.ctx.cueReject(t.id, 'Duplicate');
  assert.strictEqual(v.status, 'Rejected'); assert.strictEqual(t.log.bridge.length, 2);
});
test('C13 only the owner can use Cue', () => {
  const t = sandbox({ viewer: 'someone@example.com' });
  assert.throws(() => t.ctx.cueSend(INQ), /private/); assert.throws(() => t.ctx.cueState(), /private/);
});
test('C14 GPT read fails: Failed before Canvas; Try again resumes and counts the extra call', () => {
  let n = 0; const t = sandbox({ fail: { intake: () => (n++ === 0 ? resp(400, { error: { message: 'bad request' } }) : gptOk(READ)) } });
  const id = t.ctx.cueSend(INQ, [], 'intake').request_id, v = t.ctx.cueRun(id);
  assert.strictEqual(v.status, 'Failed'); assert.strictEqual(t.log.bridge.length, 0); assert.ok(/GPT \(read\): HTTP 400/.test(v.error));
  const w = t.ctx.cueRetry(id); assert.strictEqual(w.status, 'Needs you'); assert.strictEqual(w.metrics.ai_calls, 5);
});
test('C15 research fails: the CE still comes back, gaps stay unknown, and Kiko is told', () => {
  const t = startToCard({ fail: { research: () => resp(500, {}) } });
  assert.strictEqual(t.v.status, 'Needs you'); assert.strictEqual(t.v.proposal.lines[2].cost_basis, 'none');
  assert.ok(t.v.notes.some(n => /Web research did not come back/.test(n))); assert.strictEqual(t.v.metrics.ai_calls, 5, 'one retry of the 500 is counted');
});
test('C16 a Gmail draft that fails is retried alone, never doubled', () => {
  const t = startToCard({ gmailFail: true }), v = t.ctx.cueApprove(t.id, {});
  assert.strictEqual(v.status, 'Done, drafts incomplete');
  const w = t.ctx.cueDrafts(t.id); assert.strictEqual(w.status, 'Done'); assert.strictEqual(t.log.gmail.length, 4);
  deq(w.drafts.map(d => !!d.id), [true, true, true]);
});
test('C16b Canvas drafts fail once: "Make drafts again" asks Canvas again, and the project is not written twice', () => {
  const t = startToCard({ canvasDraftsFail: true, props: { CUE_DRAFTS_IN: 'canvas' } }), v = t.ctx.cueApprove(t.id, {});
  assert.strictEqual(v.status, 'Done, drafts incomplete'); assert.strictEqual(v.canvas.project_id, 'S-99900001ZZ');
  const w = t.ctx.cueDrafts(t.id); assert.strictEqual(w.status, 'Done'); assert.strictEqual(w.drafts.length, 3);
  assert.strictEqual(t.log.bridge.filter(b => b.action === 'apply_intake').length, 1);
});
test('C17 an inquiry with no requirements stops with a clear message', () => {
  const t = startToCard({ read: Object.assign({}, READ, { requirements: [] }) });
  assert.strictEqual(t.v.status, 'Failed'); assert.ok(/no requirements/.test(t.v.error));
});
test('C18 page state hides keys and raw evidence', () => {
  const t = startToCard(), s = JSON.stringify(t.ctx.cueState());
  ['sk-test', 'sk-ant-test', SECRET, 'past_quotes'].forEach(x => assert.ok(s.indexOf(x) < 0, x));
});

const SENT = [
  { id: 'm1', thread: 'th1', ms: 1760000000000, to: 'Mats Co <sales@matsco.example>', subject: 'RFQ: JBL launch floor mats', snippet: 'Please quote 40 mats' },
  { id: 'm2', thread: 'th1', ms: 1760100000000, to: 'sales@matsco.example', subject: 'Re: RFQ: JBL launch floor mats', snippet: 'Following up' },
  { id: 'm3', thread: 'th2', ms: 1760050000000, to: 'Print Hub <hello@printhub.example>, kiko@example.com', subject: 'RFQ - JBL mats printing', snippet: 'Quote for printing' },
  { id: 'm4', thread: 'th3', ms: 1760060000000, to: 'kiko@example.com', subject: 'RFQ internal JBL', snippet: 'internal only' },
  { id: 'm5', thread: 'th4', ms: 1760070000000, to: 'tents@tentco.example', subject: 'RFQ: JBL tent', snippet: 'tent quote' }];
const REQUOTES = { requotes: [{ k: 'T1', supplier: 'Mats Co', body: 'Hi Mats Co,\nThe JBL mat designs changed; updated files attached. Please requote by Friday.\nBlank Space Events' },
  { k: 'T3', supplier: 'Print Hub', body: 'Hi Print Hub,\nUpdated JBL mat artwork attached. Please send a revised quote.\nBlank Space Events' },
  { k: 'T3', supplier: 'Print Hub again', body: 'duplicate' }, { k: 'T99', supplier: 'Made up', body: 'x' }], note: 'Skipped the tent thread.' };
const CHANGE_READ = Object.assign({}, READ, { kind: 'change_request', requirements: [],
  change: { project: 'JBL', what_changed: 'New floor mat designs (8 files).', search_terms: ['mats'], suppliers: [] } });
const PNG = Buffer.from('89504e470d0a1a0a-fake-floor-plan').toString('base64'), PDF = Buffer.from('%PDF-1.7 fake brief').toString('base64');
const TXT = Buffer.from('Need 2 LED walls and a stage, 8x4m.').toString('base64');
test('C19 attachments: saved in Cue uploads, sent to GPT in the read call only, still 4 AI calls, no file data in page state', () => {
  const t = sandbox(), files = [{ name: 'floor plan.png', type: 'image/png', data: PNG }, { name: 'brief.pdf', type: 'application/pdf', data: PDF },
    { name: 'notes.txt', type: 'text/plain', data: TXT }];
  const id = t.ctx.cueSend('', files).request_id, v = t.ctx.cueRun(id);
  assert.strictEqual(v.status, 'Needs you'); assert.strictEqual(v.metrics.ai_calls, 4);
  deq(v.files.map(f => f.name), ['floor plan.png', 'brief.pdf', 'notes.txt']);
  assert.strictEqual(t.props.CUE_UPLOADS_FOLDER, 'folder-1');
  deq(Object.values(t.drive.parent), ['folder-1', 'folder-1', 'folder-1']);
  assert.strictEqual(t.drive.files.f2.toString(), '%PDF-1.7 fake brief', 'bytes round-trip');
  const c = t.log.gpt[0].input[0].content;
  deq(c.map(p => p.type), ['input_text', 'input_image', 'input_file', 'input_text']);
  assert.ok(/attached files/.test(c[0].text) && /Attached: floor plan\.png, brief\.pdf, notes\.txt/.test(c[0].text));
  assert.strictEqual(c[1].image_url, 'data:image/png;base64,' + PNG);
  assert.strictEqual(c[2].file_data, 'data:application/pdf;base64,' + PDF); assert.strictEqual(c[2].filename, 'brief.pdf');
  assert.ok(c[3].text.indexOf('<attachment name="notes.txt">\nNeed 2 LED walls') === 0);
  assert.ok(typeof t.log.gpt[1].input === 'string' && typeof t.log.gpt[2].input === 'string', 'research and RFQ calls get no files');
  assert.ok(/attached/i.test(t.log.gpt[0].instructions));
  const st = JSON.stringify(t.ctx.cueState()); [PNG, PDF, TXT].forEach(x => assert.ok(st.indexOf(x) < 0, 'no file data in state'));
  assert.ok(/📎 floor plan\.png, brief\.pdf, notes\.txt/.test(st), 'chat line names the files');
});
test('C20 attachment limits: type, size, count, empty; a short message with no file is still refused; a trashed folder is remade', () => {
  const t = sandbox(), send = (txt, f) => () => t.ctx.cueSend(txt, f, 'intake');
  assert.throws(send(INQ, [{ name: 'x.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', data: PDF }]), /Save it as a PDF/);
  assert.throws(send(INQ, [{ name: 'big.pdf', type: 'application/pdf', data: Buffer.alloc(10 * 1024 * 1024 + 1).toString('base64') }]), /over 10 MB/);
  assert.throws(send(INQ, Array(11).fill({ name: 'a.txt', type: 'text/plain', data: TXT })), /10 files at most/);
  assert.throws(send(INQ, [{ name: 'e.txt', type: 'text/plain', data: '' }]), /empty/);
  assert.throws(send('hi', []), /at least a sentence/);
  assert.strictEqual(t.tabs.Requests.rows.length, 1, 'nothing saved for refused sends');
  const u = sandbox({ props: { CUE_UPLOADS_FOLDER: 'old' }, folderTrashed: true }); u.ctx.cueSend('', [{ name: 'a.txt', type: 'text/plain', data: TXT }]);
  assert.strictEqual(u.props.CUE_UPLOADS_FOLDER, 'folder-1');
  const w = sandbox({ props: { CUE_UPLOADS_FOLDER: 'kept' } }); w.ctx.cueSend('', [{ name: 'a.txt', type: 'text/plain', data: TXT }]);
  assert.strictEqual(w.drive.parent.f1, 'kept');
});

test('C21 small talk: one GPT call, no intake, both lines in the chat; an inquiry-looking message offers the intake; the opener still starts one', () => {
  const t = sandbox(), r = t.ctx.cueSend('hey GPT / Claude, how are you');
  assert.strictEqual(r.chat, true); assert.strictEqual(r.reply, 'Doing well! Ready when you are.'); assert.strictEqual(r.suggest_intake, false);
  assert.strictEqual(t.log.gpt.length, 1); assert.strictEqual(t.log.claude.length + t.log.bridge.length, 0);
  assert.strictEqual(t.tabs.Requests.rows.length, 1, 'no request made');
  deq(t.tabs.Chat.rows.slice(1).map(x => x[1]), ['Kiko', 'Cue']);
  assert.ok(/how are you/.test(t.log.gpt[0].input) && /never pretend/.test(t.log.gpt[0].instructions));
  const AI = t.tabs['AI Runs'].rows.slice(1); assert.strictEqual(AI.length, 1); assert.strictEqual(AI[0][2], 'chat');
  const u = sandbox({ talk: { reply: 'That looks like an inquiry.', looks_like_inquiry: true } });
  assert.strictEqual(u.ctx.cueSend(INQ).suggest_intake, true);
  assert.ok(u.ctx.cueSend('New project intake. ' + INQ).request_id, 'opener starts an intake');
  assert.throws(() => u.ctx.cueSend('   '), /Type a message/);
  const w = sandbox({ fail: { chat: () => resp(500, {}) } }); assert.ok(/could not answer/.test(w.ctx.cueSend('hello').reply));
});

test('C22 change request: 2 AI calls, finds the sent RFQ threads, one reply per supplier, drafts in the original threads with the files, Canvas untouched', () => {
  const t = sandbox({ read: CHANGE_READ });
  const up = t.ctx.cueUpload({ name: 'mat 1.png', type: 'image/png', data: PNG });
  const id = t.ctx.cueSend('this for JBL new mats that needs to resent to suppliers. find the emails sent before and ask for a requote', [{ id: up.id }]).request_id;
  const v = t.ctx.cueRun(id);
  assert.strictEqual(v.status, "Needs you", v.error); assert.strictEqual(v.kind, "change"); assert.strictEqual(v.metrics.ai_calls, 2);
  deq(t.log.bridge.map(b => b.action), ['find_similar_projects'], 'only the duplicate check (no requirements to look up)'); assert.strictEqual(t.log.claude.length, 0, 'no Claude');
  assert.ok(/^in:sent newer_than:1y .*"JBL" OR "mats"/.test(t.log.gmailQ), t.log.gmailQ);
  deq(v.change.drafts.map(d => [d.k, d.to]), [['T1', 'sales@matsco.example'], ['T3', 'hello@printhub.example']], 'own address dropped, dup and unknown keys dropped');
  assert.strictEqual(v.change.found, 3, 'internal-only thread dropped; th1 kept once');
  const cands = JSON.parse(t.log.gpt[1].input).candidates; assert.strictEqual(cands[0].subject, 'Re: RFQ: JBL launch floor mats', 'latest message of th1');
  assert.ok(/data/.test(t.log.gpt[1].instructions));
  const d = t.ctx.cueApprove(id, { skip: ['T3'] });
  assert.strictEqual(d.status, 'Done'); assert.strictEqual(t.log.replies.length, 1, 'only the ticked supplier');
  const pl = t.log.replies[0].payload;
  assert.ok(/^multipart\/related; boundary=/.test(t.log.replies[0].type));
  assert.ok(pl.indexOf('{"message":{"threadId":"th1"}}') > 0, 'in the original thread');
  assert.ok(/In-Reply-To: <m2@mail>/.test(pl) && /To: sales@matsco\.example/.test(pl));
  assert.ok(pl.indexOf('filename="mat 1.png"') > 0 && pl.indexOf(PNG.slice(0, 20)) > 0, 'file attached');
  assert.ok(t.tabs.Chat.rows.some(r => /Nothing was sent and nothing changed in Canvas/.test(r[2])));
  assert.throws(() => t.ctx.cueApprove(id, {}), /not waiting/);
});
test('C23 change request edge cases: nothing found, nothing matched, all unticked, a failed draft retries only the missing one, upload ids are checked', () => {
  const a = sandbox({ read: CHANGE_READ, sent: [] }), ia = a.ctx.cueSend('New project intake. JBL mats changed, requote please', [], 'intake').request_id;
  const va = a.ctx.cueRun(ia); assert.strictEqual(va.status, 'Needs you', JSON.stringify(va.error)); assert.ok(/found no RFQ emails/.test(va.change.note));
  const b = sandbox({ read: CHANGE_READ, requotes: { requotes: [], note: 'none match' } }), ib = b.ctx.cueSend('New project intake. JBL mats changed, requote please').request_id;
  assert.ok(/matched this change/.test(b.ctx.cueRun(ib).change.note));
  const c = sandbox({ read: CHANGE_READ, replyFail: true }), ic = c.ctx.cueSend('New project intake. JBL mats changed, requote please').request_id; c.ctx.cueRun(ic);
  assert.throws(() => c.ctx.cueApprove(ic, { skip: ['T1', 'T3'] }), /Tick at least one/);
  const v1 = c.ctx.cueApprove(ic, {}); assert.strictEqual(v1.status, 'Done, drafts incomplete'); assert.strictEqual(c.log.replies.length, 2);
  const v2 = c.ctx.cueApprove(ic, {}); assert.strictEqual(v2.status, 'Done'); assert.strictEqual(c.log.replies.length, 3, 'only the failed one again');
  assert.throws(() => c.ctx.cueSend('x', [{ id: 'not-ours' }]), /did not finish uploading|not one Cue uploaded/);
});

const JBL = [{ project_id: 'S-31628060SP', name: 'JBL Launch', account: 'JBL', date: '2026-11-05', status: 'For Client Awarding', why: 'similar name' },
  { project_id: 'S-31628061SP', name: 'JBL Roadshow', account: 'JBL', date: '2026-11-20', status: 'Lead', why: 'similar name' }];
test('C24 intake steps first: a Canvas duplicate switches a "new project" read to the change function, with the project folder files', () => {
  const t = sandbox({ similar: JBL });   // GPT read it as new_project (READ); Canvas says it already exists
  const id = t.ctx.cueSend('New project intake. JBL wants new mats, 3m x 2m, please get quotes').request_id;
  const v = t.ctx.cueRun(id);
  assert.strictEqual(v.status, 'Needs you', v.error); assert.strictEqual(v.kind, 'change'); assert.strictEqual(v.metrics.ai_calls, 2, 'read + requotes, no costing');
  deq(t.log.bridge.map(b => b.action), ['find_similar_projects', 'intake_evidence', 'list_project_files']);
  assert.strictEqual(t.log.filesFor, 'S-31628060SP'); assert.strictEqual(t.log.claude.length, 0, 'no Claude costing');
  assert.strictEqual(v.change.project, 'JBL Launch'); assert.strictEqual(v.change.match.why, 'similar name'); deq(v.change.others, ['JBL Roadshow (similar name)']);
  assert.strictEqual(v.change.project_files.length, 2); assert.strictEqual(v.change.project_files[1].url, '', 'non-Drive link dropped');
  assert.strictEqual(v.change.folder_url, 'https://drive.google.com/drive/folders/PF1');
  assert.ok(/"JBL Launch"/.test(t.log.gmailQ), t.log.gmailQ);
  assert.ok(JSON.parse(t.log.gpt[1].input).project_folder_files[0].indexOf('JBL mats v2.pdf') > 0, 'GPT sees the folder file names');
  assert.ok(t.tabs.Chat.rows.some(r => /Canvas already has this project: JBL Launch/.test(r[2])));
  assert.strictEqual(v.change.can_run_new, true);
  // Kiko: not this project. It runs as a new intake: costing, RFQs, no second duplicate switch.
  const n = t.ctx.cueAsNew(id);
  assert.strictEqual(n.kind, 'intake'); assert.strictEqual(n.status, 'Needs you', n.error); assert.ok(n.proposal, 'costed proposal'); assert.strictEqual(n.change, null);
  assert.strictEqual(t.log.claude.length, 1); assert.throws(() => t.ctx.cueAsNew(id), /Only a change request/);
});
test('C25 change without a Canvas match or past emails still shows a card; a folder error is a note', () => {
  const a = sandbox({ read: CHANGE_READ, sent: [] }), ia = a.ctx.cueSend('JBL mats changed, requote please', [], 'intake').request_id;
  const va = a.ctx.cueRun(ia);
  assert.strictEqual(va.status, 'Needs you', va.error); assert.strictEqual(va.metrics.ai_calls, 1, 'no requote call when nothing was found');
  assert.strictEqual(va.change.match, null); assert.ok(/found no RFQ emails/.test(va.change.note)); deq(va.change.drafts, []);
  assert.strictEqual(va.change.can_run_new, false, 'nothing to cost');
  assert.throws(() => a.ctx.cueAsNew(ia), /no requirements/);
  assert.strictEqual(a.ctx.cueReject(ia, '').status, 'Rejected');
  const b = sandbox({ similar: JBL, filesFail: true }), ib = b.ctx.cueSend('New project intake. JBL wants new mats').request_id;
  const vb = b.ctx.cueRun(ib);
  assert.strictEqual(vb.status, 'Needs you', vb.error); deq(vb.change.project_files, []); assert.ok(vb.notes.some(x => /could not list the project folder/.test(x)));
});

test('C26 missing Gmail access: a plain message, and Fix Google access resets only when Google says a scope is missing', () => {
  const t = sandbox({ read: CHANGE_READ, gmailScope: true, scopes: ['spreadsheets', 'gmail.compose', 'drive.file'] });
  const v = t.ctx.cueRun(t.ctx.cueSend('JBL mats changed, requote please', [], 'intake').request_id);
  assert.strictEqual(v.status, 'Failed'); assert.ok(/does not have Gmail access yet/.test(v.error), v.error);
  const a = t.ctx.cueFixAccess(); deq(a.missing, ['gmail.readonly']); assert.strictEqual(a.reset, true); assert.strictEqual(t.log.invalidated, 1);
  assert.strictEqual(a.url, 'https://script.google.com/macros/s/CUE/exec'); assert.ok(/access_token/.test(JSON.stringify(t.log.tokeninfo)));
  const ok = sandbox({ scopes: ['spreadsheets', 'https://mail.google.com/', 'drive.file'] }).ctx.cueFixAccess();
  assert.strictEqual(ok.reset, false, 'full Gmail scope covers readonly and compose'); deq(ok.missing, []);
  assert.ok(/Google access still missing: gmail.readonly/.test(sandbox({ scopes: ['gmail.compose', 'drive.file'] }).ctx.cueSetup()));
});

test('C27 requotes carry every file Kiko sent for the project in the last day; a reply to a task can start the run from chat', () => {
  const t = sandbox({ similar: JBL, read: CHANGE_READ,
    talk: { reply: 'On it.', looks_like_inquiry: false, start_intake: 'JBL Booth Fabrication: the designs changed; requote with all the new files attached' } });
  const up = n => ({ id: t.ctx.cueUpload({ name: n, type: 'image/png', data: PNG }).id });
  const id1 = t.ctx.cueSend('JBL new mats, requote please', [up('a.png'), up('b.png')]).request_id;
  assert.strictEqual(t.ctx.cueRun(id1).status, 'Needs you'); t.ctx.cueReject(id1, 'load again with new files');
  const id2 = t.ctx.cueSend('more images for JBL', [up('b.png'), up('c.png')]).request_id;
  const v2 = t.ctx.cueRun(id2);
  deq(v2.change.attach.map(f => [f.name, f.from === 'this message', f.selected]), [['b.png', true, true], ['c.png', true, true], ['a.png', false, false]], 'newest copy of b wins; old a.png listed, not ticked');
  // Kiko replies to the JBL task in chat: "load again with new files". Cue starts the run itself, tied to that task.
  const r = t.ctx.cueSend('load again with new files', [], '', id2);
  assert.ok(r.request_id, 'started a run, no extra tap'); assert.ok(t.log.gpt.some(g => /replying about this task: change request for JBL Launch/.test(JSON.stringify(g))), 'the chat call saw the task');
  const v3 = t.ctx.cueRun(r.request_id);
  assert.strictEqual(v3.kind, 'change'); deq(v3.change.attach.map(f => f.name).sort(), ['a.png', 'b.png', 'c.png']);
  deq(v3.change.attach.filter(f => f.selected).map(f => f.name).sort(), ['b.png', 'c.png'], 'no new files: the newest batch (the task replied to) is ticked, older ones are not');
  assert.ok(t.tabs.Chat.rows.some(x => x[1] === 'Kiko' && x[3] === id2), 'Kiko\'s reply is filed under the task');
  const aId = v3.change.attach.filter(f => f.name === 'a.png')[0].id, before = (t.log.replies || []).length;
  const d = t.ctx.cueApprove(r.request_id, { files_skip: [aId] });
  assert.strictEqual(d.status, 'Done');
  const pl = t.log.replies[before].payload;
  assert.ok(pl.indexOf('filename="b.png"') > 0 && pl.indexOf('filename="c.png"') > 0 && pl.indexOf('filename="a.png"') < 0, 'unticked file left out');
});

test('C28 threads: the redo run points at its task, and a reply in a thread sees only that thread, not the main chat', () => {
  const t = sandbox({ similar: JBL, read: CHANGE_READ, talk: { reply: 'Noted.', looks_like_inquiry: false, start_intake: '' } });
test('C29 approve and send (Kiko 06:17Z): edited text goes out, only after send:true; drafts only never sends; a failed send retries alone', () => {
  const t = sandbox({ read: CHANGE_READ, sendFail: true });

test('C30 a main-chat message about an existing task: Kiko\'s line stays with a pointer, the answer goes in that task\'s thread', () => {
  const t = sandbox({ read: CHANGE_READ });

test('C31 project folder (Kiko 06:45Z): approved files go into the Canvas project folder; photos to Designs & Visuals; a failure is a note and retries once', () => {
  const t = sandbox({ similar: JBL, read: CHANGE_READ, saveFail: true });

test('C32 a task started from the main chat: Kiko\'s line and Cue\'s acknowledgement stay in the chat, pointing at the new thread', () => {
  const t = sandbox(), id = t.ctx.cueSend(INQ, [], 'intake').request_id;
  deq(t.tabs.Chat.rows.slice(-4).map(x => [x[1], x[3]]), [['Kiko', ''], ['Cue', '>' + id], ['Kiko', id], ['Cue', id]]);
  assert.ok(/started a thread/.test(t.tabs.Chat.rows.slice(-3)[0][2]));
  const r = t.ctx.cueSend('also add a photo booth', [], 'intake', id).request_id;
  assert.ok(!t.tabs.Chat.rows.some(x => x[3] === '>' + r), 'a run started inside a thread needs no pointer');
});

test('C34 task rules (Kiko 06:57Z): a new message about a task from the last 7 days reopens its thread, by name or by Canvas project', () => {
  const t = sandbox({ similar: JBL, read: CHANGE_READ });
  const id = t.ctx.cueSend('New project intake. JBL mats changed, requote please', [], 'intake').request_id; t.ctx.cueRun(id);
  t.ctx.cueApprove(id, { skip: ['T3'] });
  // By name, before any AI call: files plus "JBL" in the text join the JBL thread, and the main chat says so.
  const r = t.ctx.cueSend('add these to JBL as well and send again', [{ name: 'S9.png', type: 'image/png', data: PNG }]).request_id;
  assert.strictEqual(t.ctx.cueLoad_(r).s.ref, id);
  assert.ok(t.tabs.Chat.rows.some(x => x[3] === '>' + r && /reopened its thread/.test(x[2])), 'main chat names the reopened thread');
  // By Canvas project: no name in the text, but Canvas matches the same project, so the run moves into the thread.
  const q = t.ctx.cueSend('New project intake. the floor mats changed again, requote please', [], 'intake').request_id;
  assert.strictEqual(t.ctx.cueLoad_(q).s.ref, '');
  t.ctx.cueRun(q);
  const s = t.ctx.cueLoad_(q).s; assert.ok(s.ref === r || s.ref === id, 'joined the JBL thread: ' + s.ref);
  assert.ok(t.tabs.Chat.rows.some(x => x[3] === '>' + q && /continues in its thread/.test(x[2])));
  // Unrelated work still gets its own thread.
  const n = t.ctx.cueSend(INQ, [], 'intake').request_id;
  assert.strictEqual(t.ctx.cueLoad_(n).s.ref, '');
});

test('C35 Reopen (Kiko 07:15Z): a finished task can be reopened into Needs you, closed again, and a new run in its thread settles it', () => {
  const t = sandbox({ similar: JBL, read: CHANGE_READ });
  const id = t.ctx.cueSend('New project intake. JBL mats changed, requote please', [], 'intake').request_id; t.ctx.cueRun(id);
  t.ctx.cueApprove(id, { skip: ['T3'] });
  assert.throws(() => t.ctx.cueCloseTask('cue-made-up-0000'), /No such request/);
  let v = t.ctx.cueReopen(id); assert.strictEqual(v.status, 'Reopened');
  assert.ok(t.tabs.Chat.rows.some(x => x[3] === id && /^Reopened\./.test(x[2])));
  assert.throws(() => t.ctx.cueReopen(id), /Only a finished task/);
  v = t.ctx.cueCloseTask(id); assert.strictEqual(v.status, 'Done');
  t.ctx.cueReopen(id);
  const r = t.ctx.cueSend('also add a photo booth for JBL', [], 'intake', id).request_id;
  assert.strictEqual(t.ctx.cueLoad_(id).s.status, 'Done', 'the new run carries the work; the reopened one is settled');
  assert.strictEqual(t.ctx.cueLoad_(r).s.ref, id);
});

test('C33 summary (Kiko 06:55Z): a finished task posts one line in the main chat and its thread, from what happened', () => {
  const t = sandbox({ similar: JBL, read: CHANGE_READ });
  const id = t.ctx.cueSend('New project intake. JBL mats changed, requote please', [], 'intake').request_id; t.ctx.cueRun(id);
  t.ctx.cueApprove(id, { skip: ['T3'], send: true });
  const main = t.tabs.Chat.rows.filter(x => x[3] === '>' + id && /^Summary for/.test(x[2]));
  assert.strictEqual(main.length, 1); assert.ok(/sent 1 requote \(/.test(main[0][2]), main[0][2]);
  assert.ok(t.tabs.Chat.rows.some(x => x[3] === id && /^Summary for/.test(x[2])), 'also in the thread');
  const w = startToCard(); w.ctx.cueReject(w.id, 'client cancelled');
  assert.ok(w.tabs.Chat.rows.some(x => x[3] === '>' + w.id && /rejected; nothing was written or sent/.test(x[2])));
});
  const up = n => ({ id: t.ctx.cueUpload({ name: n, type: n.endsWith('.pdf') ? 'application/pdf' : 'image/png', data: n.endsWith('.pdf') ? PDF : PNG }).id });
  const id = t.ctx.cueSend('JBL new mats, requote please', [up('S1.png'), up('brief.pdf')]).request_id; t.ctx.cueRun(id);
  assert.ok(!t.log.saved, 'nothing saved before Kiko approves');
  const d = t.ctx.cueApprove(id, {});
  deq(t.log.saved.map(x => [x.pid, x.name, x.type]), [['S-31628060SP', 'S1.png', 'Designs & Visuals'], ['S-31628060SP', 'brief.pdf', 'Client Documents']]);
  assert.ok(t.log.saved[1].bytes > 0);
  deq(d.project_saved.map(x => [x.name, !!x.url]), [['S1.png', false], ['brief.pdf', true]]);
  assert.ok(d.notes.some(n => /Not saved to the project folder yet: S1\.png/.test(n)));
  // An intake: after Canvas makes the project, the brief goes to Brief & Planning.
  const w = sandbox(), iw = w.ctx.cueSend('', [{ name: 'brief.pdf', type: 'application/pdf', data: PDF }]).request_id; w.ctx.cueRun(iw);
  const v = w.ctx.cueApprove(iw, {});
  deq(w.log.saved.map(x => [x.pid, x.name, x.type]), [['S-99900001ZZ', 'brief.pdf', 'Brief & Planning']]);
  assert.ok(w.tabs.Chat.rows.some(x => /Saved 1 file to the Canvas project folder: brief\.pdf/.test(x[2])));
  assert.strictEqual(v.status, 'Done');
});
  const id = t.ctx.cueSend('New project intake. JBL mats changed, requote please', [], 'intake').request_id; t.ctx.cueRun(id);
  t.opts.talk = { reply: 'The JBL requotes are waiting for you.', looks_like_inquiry: false, start_intake: '', task: id };
  const r = t.ctx.cueSend('whats happening with jbl?');
  assert.strictEqual(r.task, id);
  deq(t.tabs.Chat.rows.slice(-4).map(x => [x[1], x[3]]), [['Kiko', ''], ['Cue', '>' + id], ['Kiko', id], ['Cue', id]]);
  assert.ok(t.tabs.Chat.rows.some(x => x[1] === 'Cue' && x[3] === '>' + id && /Answered in the (?!that task).+ thread/.test(x[2])), 'pointer in the main chat');
  assert.ok(t.tabs.Chat.rows.some(x => x[1] === 'Cue' && x[3] === id && /requotes are waiting/.test(x[2])), 'answer in the thread');
  assert.ok(JSON.stringify(t.log.gpt[t.log.gpt.length - 1]).indexOf(id + ': change request for') >= 0, 'GPT saw the task list');
  t.opts.talk = { reply: 'Hi!', looks_like_inquiry: false, start_intake: '', task: 'cue-made-up-0000' };
  assert.strictEqual(t.ctx.cueSend('hello').task, '', 'an unknown task id is ignored');
});
  const id = t.ctx.cueSend('New project intake. JBL mats changed, requote please', [], 'intake').request_id; t.ctx.cueRun(id);
  assert.throws(() => t.ctx.cueApprove(id, { bodies: { T1: '   ' }, send: true }), /is empty/);
  const v = t.ctx.cueApprove(id, { bodies: { T1: 'Hi Mats Co, edited by Kiko.' }, send: true });
  assert.ok(Buffer.from(t.log.replies[0].payload.split('base64\r\n\r\n')[1].split('\r\n--')[0].replace(/\r\n/g, ''), 'base64').toString().indexOf('edited by Kiko') >= 0, 'edited body in the email');
  deq(t.log.sent, ['reply-1', 'reply-2'], 'both drafts sent'); assert.strictEqual(v.status, 'Done, drafts incomplete', 'first send failed');
  assert.deepStrictEqual(v.change.drafts.map(d => d.sent), [false, true]);
  const v2 = t.ctx.cueApprove(id, {}); assert.strictEqual(v2.status, 'Done'); deq(t.log.sent, ['reply-1', 'reply-2', 'reply-1'], 'only the failed one again, no new draft');
  assert.strictEqual(t.log.replies.length, 2);
  assert.ok(t.tabs.Chat.rows.some(x => /^Sent 2 requotes from your Gmail/.test(x[2])));
  const u = sandbox({ read: CHANGE_READ }), iu = u.ctx.cueSend('New project intake. JBL mats changed, requote please', [], 'intake').request_id; u.ctx.cueRun(iu);
  assert.strictEqual(u.ctx.cueApprove(iu, {}).status, 'Done'); assert.ok(!u.log.sent, 'drafts only sends nothing');
  // Intake: edited RFQ goes out; the supplier with no email stays a draft.
  const w = startToCard(), card = w.v, i0 = card.proposal.rfqs[0];
  const d = w.ctx.cueApprove(w.id, { rfqs: { 0: { subject: 'RFQ edited', body: 'Edited RFQ text' } }, send: true });
  assert.strictEqual(d.status, 'Done'); assert.ok(/Edited RFQ text|RWRpdGVkIFJGUSB0ZXh0/.test(w.log.gmail[0]), 'edited text');
  assert.strictEqual(w.log.sent.length, 2, 'two with emails sent, the one without stays a draft');
  assert.ok(w.tabs.Chat.rows.some(x => /2 RFQ\(s\) sent from your Gmail\. 1 had no email address/.test(x[2])));
  assert.ok(i0);
});

  t.ctx.cueSend('main chat secret line about lunch', [], 'chat');
  const id = t.ctx.cueSend('New project intake. JBL mats changed, requote please', [], 'intake').request_id; t.ctx.cueRun(id);
  const v = t.ctx.cueState().requests.filter(r => r.id === id)[0]; assert.strictEqual(v.ref, '', 'a new task starts its own thread');
  const before = t.log.gpt.length; t.ctx.cueSend('also cc Joy please', [], '', id);
  const seen = JSON.stringify(t.log.gpt.slice(before));
  assert.ok(/JBL mats changed/.test(seen), 'thread history included'); assert.ok(!/secret line about lunch/.test(seen), 'main chat left out');
  assert.ok(t.tabs.Chat.rows.filter(x => x[3] === id).length >= 3, 'reply and answer filed under the task');
});

let pass = 0;
for (const [n, f] of tests) { try { f(); pass++; console.log('ok   ' + n); } catch (e) { console.log('FAIL ' + n + '\n     ' + (e.stack || e).toString().split('\n').slice(0, 3).join('\n     ')); } }
console.log(pass + '/' + tests.length + ' passed');
process.exit(pass === tests.length ? 0 : 1);
