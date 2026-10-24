/* CUE-CANVAS-2026-10-21 (Kiko 18:57Z and 18:59Z, spec specs/open-in-canvas.md, Kiko OK 19:20Z: "no bank account like you said").
 * Open in Canvas: when the data lives in Canvas or Canvas already has the process, Cue opens that Canvas page with the fields
 * filled and shows it (the viewer pane on a PC, a new tab on a phone). Kiko checks and saves in Canvas.
 * Who does what: code spots the command (no AI call), Canvas finds the project (search_projects, then find_similar_projects;
 * both reads), code builds the link. Canvas's own pages read the link: they are the same links Canvas's quick-command bar uses
 * (?page=…&project=…&tab=…&action=pay|newscope, qc / qcadd = URL-safe base64 JSON, qctask, q). No Canvas release is needed.
 * Bank details never go in a link (Kiko 19:20Z): a link stays in browser history, Chrome sync and Google's logs. Cue's card
 * shows them to copy instead.
 * A link travels in a chat line as the token [[canvas|title|url]]; the page draws it as an "Open in Canvas" button. */

// Canvas Workspace's main web app (CanvasWorkspace releases/v197-main release.json deploymentId). CUE_CANVAS_URL overrides it.
const CUE_CANVAS_DEFAULT_ = 'https://script.google.com/a/macros/blankspaceevent.com/s/AKfycbxZuZDGY0AkT87oYsTR3Yj151O2fa1x0BuALO7z1kQFpxi11SRceNKpIA_AWT9Z6mW6Rw/exec';
const CUE_CANVAS_URL_RE_ = /^https:\/\/script\.google\.com\/(a\/macros\/[A-Za-z0-9.-]+|macros)\/s\/[A-Za-z0-9_-]+\/exec$/;
const CUE_CANVAS_TABS_ = ['Main', 'Scope', 'Expenses', 'RM', 'Timeline', 'Food Count', 'Inrush', 'History', 'Checklist'];
// Pages Kiko can name ("open finance"): Cue's word -> [Canvas page key, extra query, title]. Same keys as Canvas's PAGES_ and Workspace menu.
const CUE_CANVAS_PAGES_ = {
  home: ['dashboard', '', 'Home'], dashboard: ['dashboard', '', 'Home'], workspace: ['workspace', '', 'Canvas'], canvas: ['workspace', '', 'Canvas'],
  projects: ['canvas', '', 'Projects'], finance: ['playbook', '', 'Finance'], 'finance desk': ['financedesk', '', 'Finance Desk'],
  'cost estimates': ['cedesk', '', 'Cost Estimates'], 'ce desk': ['cedesk', '', 'Cost Estimates'], ces: ['cedesk', '', 'Cost Estimates'],
  accounts: ['clientdesk', '', 'Accounts'], clients: ['clientdesk', '', 'Accounts'], 'client desk': ['clientdesk', '', 'Accounts'],
  'price list': ['pricelist', '', 'Price List'], 'price watch': ['pricewatch', '', 'Price Watch'], inventory: ['inventory', '', 'Inventory'],
  'record health': ['recordhealth', '', 'Record Health'], 'support desk': ['support', '', 'Support Desk'],
  suppliers: ['support', 'tab=suppliers', 'Suppliers'], 'supplier database': ['support', 'tab=suppliers', 'Suppliers'], freelancers: ['support', 'tab=freelancers', 'Freelancers'],
  'fsa generator': ['support', 'tool=FSA', 'FSA Generator'], 'ar generator': ['support', 'tool=AR', 'AR Generator']
};
// Supplier Database columns a Cue link may fill (the bridge's ZB_SUP_FIELDS_ less the bank three: those go by one-time code).
const CUE_CANVAS_SUPCOLS_ = ['Common / Display Name', 'Address', 'City', 'Province', 'Owner/Manager', 'Website/Social Media', 'Main Service',
  'Secondary Service', 'Supplier Type', 'Business Type', 'TIN', 'TIN Status', 'Company Email'];
const CUE_CANVAS_TABWORDS_ = { main: 'Main', scope: 'Scope', scopes: 'Scope', expenses: 'Expenses', expense: 'Expenses', rm: 'RM', resources: 'RM', timeline: 'Timeline',
  'food count': 'Food Count', inrush: 'Inrush', history: 'History', checklist: 'Checklist', readiness: 'Checklist',
  tasks: 'Main', 'task list': 'Main' };   // Kiko 24 Oct: tasks, issues and risks are on Main, where Canvas's "Open tasks" goes

function cueCanvasBase_() {
  const u = cueProp_('CUE_CANVAS_URL', CUE_CANVAS_DEFAULT_);
  if (!CUE_CANVAS_URL_RE_.test(u)) throw new Error('CUE_CANVAS_URL must be Canvas Workspace\'s /exec address.');
  return u;
}
/** The same encoding Canvas's quick bar sends and its pages read back (qcDec): JSON, UTF-8, URL-safe base64 without padding. */
function cueCanvasB64_(o) { return Utilities.base64EncodeWebSafe(Utilities.newBlob(JSON.stringify(o)).getBytes()).replace(/=+$/, ''); }
const cueCanvasQ_ = o => Object.keys(o).filter(k => o[k] !== '' && o[k] != null).map(k => k + '=' + encodeURIComponent(String(o[k]))).join('&');

/** One Canvas link. o.what: project | newscope | task | pay | supplier | addsupplier | pricewatch | finance | accounts | cedesk | page.
 * Returns { title, url }. Canvas 194 (CUE-LINKS) reads: project action=ar|fsa (+payee), pay qc (etype from 1.25.2 needs Canvas CUE-LINKS etype), addsupplier fields + h (bank code),
 * finance view/client, accounts q, cedesk project. An older Canvas ignores what it doesn't know and opens the page unfilled. */
function cueCanvasLink_(o) {
  const base = cueCanvasBase_(), t = (s, n) => cueStr_(s, n || 120).replace(/[|\]\r\n]+/g, ' ').trim();
  const pid = String(o.project_id || '');
  if (['project', 'newscope', 'task', 'pay'].indexOf(o.what) >= 0 && !CUE_PID_RE_.test(pid)) throw new Error('No Canvas project id to open.');
  const nm = t(o.name || pid);
  switch (o.what) {
    case 'project': { const tab = CUE_CANVAS_TABS_.indexOf(o.tab) >= 0 ? o.tab : 'Main', act = ['ar', 'fsa'].indexOf(o.action) >= 0 ? o.action : '';
      // PC check 24 Oct 07:28Z: Canvas has no Tasks tab; &focus=tasks | issues | risks scrolls Main to that block (Canvas release with CUE-TASKS-FOCUS).
      const focus = tab === 'Main' && ['tasks', 'issues', 'risks'].indexOf(o.focus) >= 0 ? o.focus : '';
      return { title: (act ? (act === 'ar' ? 'ARs' : 'FSAs') + ' · ' : '') + nm + (tab === 'Main' ? (focus ? ' · ' + focus[0].toUpperCase() + focus.slice(1) : '') : ' · ' + tab),
        url: base + '?' + cueCanvasQ_({ page: 'canvas', project: pid, tab, action: act, payee: act ? cueStr_(o.payee, 120) : '', focus }) }; }
    case 'pay': { const f = o.fill || {}, qc = {};
      if (f.scope) qc.scope = cueStr_(f.scope, 60); if (Number(f.amount) > 0) qc.amount = Math.round(Number(f.amount) * 100) / 100;
      if (f.supplier) qc.supplier = cueStr_(f.supplier, 200); if (f.cost) qc.cost = cueStr_(f.cost, 200); if (f.etype) qc.etype = cueStr_(f.etype, 120);
      if (/^https:\/\//.test(f.quote || '')) qc.quote = cueStr_(f.quote, 300); if (/^\d{4}-\d{2}-\d{2}$/.test(f.due || '')) qc.due = f.due;
      return { title: 'Request payment · ' + nm, url: base + '?' + cueCanvasQ_({ page: 'canvas', project: pid, tab: 'Scope', action: 'pay', qc: Object.keys(qc).length ? cueCanvasB64_(qc) : '' }) }; }
    case 'finance': { const view = ['ar', 'pay', 'proj', 'att'].indexOf(o.view) >= 0 ? o.view : '';
      return { title: 'Finance' + (view ? ' · ' + { ar: 'Sales', pay: 'Payables', proj: 'Projects', att: 'Needs attention' }[view] : '') + (o.client ? ' · ' + t(o.client) : ''),
        // 1.25.1 (PC test 20:33Z): page=playbook is Finance (Requests first); Sales, Payables and Projects with a client filter are Finance Desk.
        url: base + '?' + cueCanvasQ_({ page: view || o.client || o.q ? 'financedesk' : 'playbook', view, client: cueStr_(o.client, 120), q: cueStr_(o.q, 120) }) }; }
    case 'accounts': return { title: 'Accounts · ' + t(o.q), url: base + '?' + cueCanvasQ_({ page: 'clientdesk', q: cueStr_(o.q, 120) }) };
    case 'cedesk': return { title: 'Cost Estimates · ' + t(o.q), url: base + '?' + cueCanvasQ_({ page: 'cedesk', q: cueStr_(o.q, 120) }) };
    // New scope: Canvas picks the Requirement whose name matches req, else puts req in Scope; desc fills Description.
    // scope is for the Canvas release (Scope filled even when a Requirement matched); today's Canvas ignores it.
    case 'newscope': return { title: 'New scope · ' + nm, url: base + '?' + cueCanvasQ_({ page: 'canvas', project: pid, action: 'newscope',
      qc: cueCanvasB64_({ req: cueStr_(o.req || o.desc, 120), scope: cueStr_(o.scope || o.desc, 120), desc: cueStr_(o.desc, 300), qty: o.qty ? Number(o.qty) || '' : '' }) }) };
    case 'task': return { title: 'Close task · ' + nm, url: base + '?' + cueCanvasQ_({ page: 'canvas', project: pid, tab: 'Main', qctask: cueStr_(o.q, 200) }) };
    case 'supplier': return { title: 'Supplier · ' + t(o.q), url: base + '?' + cueCanvasQ_({ page: 'support', tab: 'suppliers', q: cueStr_(o.q, 120) }) };
    case 'addsupplier': {   // never bank details (Kiko 19:20Z)
      const d = o.details || {}, details = {};
      ['person', 'phone', 'email', 'location', 'service', 'tin'].forEach(k => { if (d[k]) details[k] = cueStr_(d[k], 200); });
      if ((d.types || []).length) details.types = d.types.slice(0, 5).map(x => cueStr_(x, 80));
      const fields = {};   // other Supplier Database columns, by header; never a bank column (Canvas skips them too)
      Object.keys(o.fields || {}).forEach(h => { if (CUE_CANVAS_SUPCOLS_.indexOf(h) >= 0 && String(o.fields[h] || '').trim()) fields[h] = cueStr_(o.fields[h], h === 'Address' ? 500 : 200); });
      const qc = { name: cueStr_(o.name, 200), details }; if (Object.keys(fields).length) qc.fields = fields;
      return { title: 'Add supplier · ' + t(o.name), url: base + '?' + cueCanvasQ_({ page: 'support', tab: 'suppliers', qcadd: cueCanvasB64_(qc), h: /^[0-9a-f]{40}$/.test(o.h || '') ? o.h : '' }) }; }
    case 'pricewatch': return { title: 'Price Watch · ' + t(o.q), url: base + '?' + cueCanvasQ_({ page: 'pricewatch', q: cueStr_(o.q, 120) }) };
    case 'page': { const p = CUE_CANVAS_PAGES_[o.key]; if (!p) throw new Error('No such Canvas page.');
      return { title: p[2], url: base + (p[0] === 'workspace' ? '' : '?page=' + p[0] + (p[1] ? '&' + p[1] : '')) }; }
  }
  throw new Error('Cue can\'t open that in Canvas.');
}
const cueCanvasTok_ = l => '[[canvas|' + String(l.title).replace(/[|\]]+/g, ' ') + '|' + l.url + ']]';

/* ---------- commands Kiko types (code, no AI call) ---------- */
/** Kiko's words as a Canvas command, or null. Mirrors the page's CV_RE so the expense shortcut leaves these alone. */
function cueCanvasParse_(text) {
  let t = String(text || '').replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, '').replace(/^(?:please|pls|cue|hey cue)[,\s]+/i, '').replace(/\s+(?:please|pls)$/i, '');
  const inCanvas = /\s+(?:in|on) canvas$/i.test(t); t = t.replace(/\s+(?:in|on) canvas$/i, '').trim();
  // "show" and "view" also mean other things, so they count only with "in Canvas"; "open" always does.
  const open = new RegExp('^(?:open|pull up|go to|bring up' + (inCanvas ? '|show me|show|view' : '') + ')\\s+(?:the\\s+)?', 'i');
  let m;
  if ((m = /^(?:request|make|create|file|raise|prepare|do)\s+(?:a\s+)?payment(?:\s+request)?\s+(?:for|in|on|under)\s+(?:project\s+)?(.+)$/i.exec(t))) return { what: 'pay', project: m[1] };
  if ((m = /^(?:add|new|create)\s+(?:a\s+)?scope\s*[:,-]?\s*(.+)\s+(?:to|in|for|on|under)\s+(?:project\s+)?(.+)$/i.exec(t))) return { what: 'newscope', desc: m[1].trim(), project: m[2] };
  if ((m = /^(?:close|complete|finish|tick off|mark)\s+(?:the\s+)?task\s+(.+)\s+(?:in|on|for|under)\s+(?:project\s+)?(.+?)(?:\s+as\s+(?:done|complete|completed|closed))?$/i.exec(t))) return { what: 'task', q: m[1].trim(), project: m[2] };
  if ((m = /^(?:price ?watch|past prices?|price history|check (?:the\s+)?(?:past\s+)?prices?)\s*(?:of|for|on)?\s*[:,-]?\s*(.{2,})$/i.exec(t))) return { what: 'pricewatch', q: m[1].trim() };
  if ((m = /^(?:make|generate|prepare|create|do)\s+(?:the\s+)?fsas?(?:\s+(?:for|in|on)\s+(?:project\s+)?(.+))?$/i.exec(t))) return m[1] ? { what: 'project', project: m[1], tab: 'Main', why: 'fsa', action: 'fsa' } : { what: 'page', key: 'fsa generator' };
  // Kiko 24 Oct (specs/cue-add-tasks.md): "tasks of Selecta" / "Selecta tasks" open Main, like Canvas's "Open tasks" button.
  if ((m = /^(?:tasks|task list)\s+(?:of|for|in)\s+(?:project\s+)?(.{2,})$/i.exec(t))) return { what: 'project', project: m[1], tab: 'Main', focus: 'tasks' };
  if (!/^(?:show|list|what|whats|what's|my|all|open|any|how|which|the|today|todays|today's|tomorrow|pending|overdue|due)\b/i.test(t)
    && (m = /^(?:project\s+)?(.{2,}?)(?:'s)?\s+(?:tasks|task list)$/i.exec(t))) return { what: 'project', project: m[1], tab: 'Main', focus: 'tasks' };
  if (!(m = open.exec(t))) return null;
  const rest = t.slice(m[0].length).trim(), low = rest.toLowerCase().replace(/\s+page$/, '').replace(/\s+tab$/, '');
  if ((m = /^(?:supplier|vendor)\s+(?!for\b)(.{2,})$/i.exec(rest))) return { what: 'supplier', q: m[1].trim() };
  if (CUE_CANVAS_PAGES_[low]) return { what: 'page', key: low };
  if ((m = /^(?:finance|receivables|sales|billings?|invoices|payables)\s+(?:for|of)\s+(.{2,})$/i.exec(rest)))
    return { what: 'finance', view: /^payables/i.test(rest) ? 'pay' : 'ar', client: m[1].trim() };
  if ((m = /^(?:account|client|company|contact)\s+(?!for\b)(.{2,})$/i.exec(rest))) return { what: 'accounts', q: m[1].trim() };
  if ((m = /^(?:ces?|cost estimates?|ce desk)\s+(?:for|of)\s+(?:project\s+)?(.{2,})$/i.exec(rest))) return { what: 'cedesk', q: m[1].trim() };
  if (/^(?:suppliers?|vendors?)\b/i.test(rest)) return null;   // "open suppliers for LED walls" is a supplier search, not a page
  if ((m = /^(main|scopes?|expenses?|rm|resources|timeline|food count|inrush|history|checklist|readiness|tasks|task list)(?:\s+tab)?\s+(?:of|for|in)\s+(?:project\s+)?(.+)$/i.exec(rest)))
    return Object.assign({ what: 'project', project: m[2], tab: CUE_CANVAS_TABWORDS_[m[1].toLowerCase()] }, /^task/i.test(m[1]) ? { focus: 'tasks' } : {});
  if ((m = /^(?:project\s+)?(.+?)(?:'s)?\s+(main|scopes?|expenses?|rm|resources|timeline|food count|inrush|history|checklist|readiness|tasks|task list)(?:\s+tab)?$/i.exec(rest)))
    return Object.assign({ what: 'project', project: m[1], tab: CUE_CANVAS_TABWORDS_[m[2].toLowerCase()] }, /^task/i.test(m[2]) ? { focus: 'tasks' } : {});
  return rest.length >= 3 ? { what: 'project', project: rest.replace(/^project\s+/i, ''), tab: 'Main' } : null;
}

/** Canvas's matches for a project Kiko named: an S- id as is; else every word must match (search_projects); else a similar name. */
function cueCanvasFind_(s, name) {
  const n = cueStr_(name, 200).trim(), id = (n.toUpperCase().match(CUE_PID_RE_) || [])[0];
  if (id) return [{ project_id: id, name: id }];
  let hits = ((cueBridge_(s, 'search_projects', { query: n, limit: 10 }) || {}).projects || []);
  if (!hits.length) hits = cueBridge_(s, 'find_similar_projects', { name: n }) || [];
  const exact = hits.filter(p => cueName_(p.name) === cueName_(n));
  return (exact.length === 1 ? exact : hits).slice(0, 5).map(p => ({ project_id: String(p.project_id || ''), name: String(p.name || ''), account: String(p.account || ''), date: String(p.date || '') }))
    .filter(p => CUE_PID_RE_.test(p.project_id));
}

/** A Canvas command in Kiko's words: answers in the chat with the link (the page opens it at once). null = not a Canvas command,
 * or a project word Canvas doesn't know, so the normal chat call answers instead. */
function cueCanvasSaid_(text, ref) {
  const c = cueCanvasParse_(text);
  if (!c) return null;
  const t = String(text || '').trim(), s = { id: 'cue-canvas-' + cueNow_().toString(36) };
  let link = null, picks = [];
  if (c.project) {
    let hits; try { hits = cueCanvasFind_(s, c.project); } catch (e) { hits = null; c.error = cueStr_((e && e.message) || e, 200); }
    if (hits && !hits.length) return null;   // not a project Canvas knows: let the chat call answer
    const mk = p => cueCanvasLink_(Object.assign({}, c, { project_id: p.project_id, name: p.name }));
    if (hits && hits.length === 1) link = mk(hits[0]); else if (hits) picks = hits.map(p => Object.assign(mk(p), { title: p.name + (p.account ? ' · ' + p.account : '') + (p.date ? ' · ' + p.date : '') }));
    if (!hits) { cueChat_('Kiko', t, ref || ''); cueChat_('Cue', 'Canvas didn\'t answer just now (' + c.error + '). Try again in a moment.', ref || ''); return { chat: true, task: ref || '' }; }
  } else link = cueCanvasLink_(c);
  cueChat_('Kiko', t, ref || '');
  if (picks.length) { cueChat_('Cue', 'Canvas has ' + picks.length + ' projects like that. Which one?\n' + picks.map(cueCanvasTok_).join('\n'), ref || ''); return { chat: true, task: ref || '' }; }
  const say = { pay: 'Request payment is open in Canvas. Pick the scope and fill in the payment there.', newscope: 'New scope is open in Canvas with "' + cueStr_(c.desc, 120) + '" filled in. Canvas picks the requirement when one matches; check Requirement and Scope, then save.',
    task: 'Canvas found the task and set it to Closed. Check it and save.', pricewatch: 'Price Watch is open in Canvas.', supplier: 'Opened the supplier in Canvas.',
    page: 'Opened in Canvas.', project: c.why === 'fsa' ? 'The FSA generator is open in Canvas on the project. Tick who gets one and tap Generate.' : 'Opened in Canvas.',
    finance: 'Finance is open in Canvas' + (c.client ? ', filtered to ' + cueStr_(c.client, 80) : '') + '.', accounts: 'Accounts is open in Canvas, searched for "' + cueStr_(c.q, 80) + '".',
    cedesk: 'Cost Estimates is open in Canvas, searched for "' + cueStr_(c.q, 80) + '".' }[c.what] || 'Opened in Canvas.';
  cueChat_('Cue', say + '\n' + cueCanvasTok_(link), ref || '');
  return { chat: true, task: ref || '', canvas: link };
}

/** The Canvas page that fits a task's card, or null. Shown as "Open in Canvas" on the card (Index.html cvBtn). */
function cueCanvasFor_(s) {
  try {
    const k = s.kind || 'intake';
    if (k === 'ar' && s.ar && s.ar.project_id) return cueCanvasLink_({ what: 'project', project_id: s.ar.project_id, name: s.ar.project, tab: 'Main', action: 'ar' });
    if (k === 'readiness' && s.ready && s.ready.match && CUE_PID_RE_.test(s.ready.match.project_id || '')) return cueCanvasLink_({ what: 'project', project_id: s.ready.match.project_id, name: s.ready.match.name, tab: 'Checklist' });
    if (k === 'expense' && s.expense && s.expense.project && CUE_PID_RE_.test(s.expense.project.id || '')) { const p = s.expense.plan || {}, r = s.read || {};
      const l = cueCanvasLink_({ what: 'pay', project_id: s.expense.project.id, name: s.expense.project.name,
        fill: { scope: p.scope_id, amount: p.amount || r.amount, supplier: (p.new_entry && p.new_entry.supplier) || r.supplier || p.payee, cost: p.item || r.item,
          etype: p.expense_type || (p.new_scope && p.new_scope.expense_type) } });
      // Canvas's Request payment lists only scope cards marked For Payment Request, so say so before Kiko opens it.
      const sc = p.scope_id && (s.expense.scopes || []).find(x => x.id === p.scope_id), st = sc ? String(sc.status || '').trim() : '';
      if (l && st && st.toLowerCase() !== 'for payment request')
        l.note = p.scope_id + ' is "' + st + '" in Canvas. Request payment lists only scope cards marked For Payment Request, so set that on Scope first.';
      return l; }
    // CE costs: CE Desk on that project's CE, the other way to change its costs.
    if (k === 'cecost' && s.cec && s.cec.project) return cueCanvasLink_({ what: 'cedesk', q: s.cec.project.name || s.cec.project.id });
    if (k === 'finance') return cueCanvasLink_({ what: 'finance' });
    if (k === 'payment') return cueCanvasLink_({ what: 'finance', view: 'ar' });
    if (k === 'change' && s.change && s.change.match && CUE_PID_RE_.test(s.change.match.project_id || '')) return cueCanvasLink_({ what: 'project', project_id: s.change.match.project_id, name: s.change.match.name, tab: 'Scope' });
    if (k === 'vendor' && s.vendor && s.vendor.item) return cueCanvasLink_({ what: 'pricewatch', q: s.vendor.item });
    if (k === 'supplier' && s.sup) return cueSupCanvas_(s);
    if (k === 'tri' && s.tri && CUE_PID_RE_.test(s.tri.project_id || '')) return cueCanvasLink_({ what: 'project', project_id: s.tri.project_id, name: s.tri.project, tab: 'Main', focus: ({ Issue: 'issues', Risk: 'risks' })[s.tri.type] || 'tasks' });
    if (k === 'intake' && s.canvas && CUE_PID_RE_.test(s.canvas.project_id || '')) return cueCanvasLink_({ what: 'project', project_id: s.canvas.project_id, name: s.canvas.name, tab: 'Main' });
  } catch (e) { console.warn('Canvas link: ' + e); }
  return null;
}
