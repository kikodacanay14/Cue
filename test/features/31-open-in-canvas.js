// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: open-in-canvas.
// CUE-CANVAS-2026-10-21 (Kiko 18:57Z / 18:59Z, specs/open-in-canvas.md; Kiko OK 19:20Z "no bank account"): Open in Canvas, filled.
const CV_BASE = 'https://script.google.com/a/macros/blankspaceevent.com/s/AKfycbxZuZDGY0AkT87oYsTR3Yj151O2fa1x0BuALO7z1kQFpxi11SRceNKpIA_AWT9Z6mW6Rw/exec';
const cvQ = u => Object.fromEntries(new (require('url').URL)(u).searchParams);
const cvDec = s => JSON.parse(Buffer.from(String(s), 'base64url').toString('utf8'));
const GLOBE = { project_id: 'S-31628060SP', name: 'Globe Year-End Party', account: 'Globe', date: '2026-12-12', status: 'Ongoing' };

test('CV1 Canvas commands are read in code: the right page, project words, tab and fill; other talk is left to the chat call', () => {
  const t = sandbox({}), P = x => JSON.parse(JSON.stringify(t.ctx.cueCanvasParse_(x)));
  deq(P('open Globe year-end party'), { what: 'project', project: 'Globe year-end party', tab: 'Main' });
  deq(P('Please open the Globe party expenses in Canvas.'), { what: 'project', project: 'Globe party', tab: 'Expenses' });
  deq(P('pull up checklist for S-31628060SP'), { what: 'project', project: 'S-31628060SP', tab: 'Checklist' });
  deq(P('request payment for Globe party'), { what: 'pay', project: 'Globe party' });
  deq(P('add scope LED wall 4m x 3m to Globe party'), { what: 'newscope', desc: 'LED wall 4m x 3m', project: 'Globe party' });
  deq(P('close task send floor plan in Globe party as done'), { what: 'task', q: 'send floor plan', project: 'Globe party' });
  deq(P('past prices of LED wall'), { what: 'pricewatch', q: 'LED wall' });
  deq(P('open supplier Sonic Pro'), { what: 'supplier', q: 'Sonic Pro' });
  deq(P('open finance'), { what: 'page', key: 'finance' });
  deq(P('make FSAs for Globe party'), { what: 'crewdocs', project: 'Globe party', doc: 'fsa' }, 'CREW-DOCS (Kiko 13:24Z): Cue\'s own command now');
  deq(P('generate ARs for Globe party'), { what: 'crewdocs', project: 'Globe party', doc: 'ar' });
  deq(P('make FSAs'), { what: 'page', key: 'fsa generator' });
  deq(P('show Globe party in canvas'), { what: 'project', project: 'Globe party', tab: 'Main' });
  ['show me the pipeline', 'find suppliers for LED wall in Cebu', 'how are we doing on Globe?', 'open supplier for LED walls', 'record expense 450 duct tape']
    .forEach(x => assert.strictEqual(t.ctx.cueCanvasParse_(x), null, x));
});
test('CV2 "open <project>": Canvas finds it (search_projects, read only), Cue answers with the link and opens it; no AI call', () => {
  const t = sandbox({ search: { 'globe year-end party': { projects: [GLOBE], total: 1 } } });
  const r = t.ctx.cueSend('open Globe year-end party', [], '');
  assert.ok(r.chat && r.canvas); deq(cvQ(r.canvas.url), { page: 'canvas', project: 'S-31628060SP', tab: 'Main' }); assert.ok(r.canvas.url.indexOf(CV_BASE + '?') === 0);
  assert.strictEqual(r.canvas.title, 'Globe Year-End Party');
  assert.strictEqual(t.log.gpt.length, 0, 'no chat call'); deq(t.log.bridge.map(b => b.action), ['search_projects']);
  const last = t.tabs.Chat.rows[t.tabs.Chat.rows.length - 1];
  assert.strictEqual(last[1], 'Cue'); assert.ok(last[2].indexOf('[[canvas|Globe Year-End Party|' + r.canvas.url + ']]') >= 0, 'the chat line carries the button');
  assert.strictEqual(t.tabs.Chat.rows[t.tabs.Chat.rows.length - 2][2], 'open Globe year-end party');
});
test('CV3 pre-filled forms: New scope (qc), close a task (qctask), Request payment, Price Watch, a supplier, a page, all in Canvas\'s own link format', () => {
  const t = sandbox({ search: { 'globe party': { projects: [GLOBE], total: 1 } } });
  const sc = t.ctx.cueSend('add scope LED wall 4m x 3m to Globe party', [], '').canvas, q = cvQ(sc.url);
  deq([q.page, q.project, q.action], ['canvas', 'S-31628060SP', 'newscope']); deq(cvDec(q.qc), { req: 'LED wall 4m x 3m', scope: 'LED wall 4m x 3m', desc: 'LED wall 4m x 3m', qty: '' }, 'Requirement or Scope, and Description');
  deq(cvQ(t.ctx.cueSend('close task send floor plan in Globe party', [], '').canvas.url), { page: 'canvas', project: 'S-31628060SP', tab: 'Main', qctask: 'send floor plan' });
  deq(cvQ(t.ctx.cueSend('request payment for Globe party', [], '').canvas.url), { page: 'canvas', project: 'S-31628060SP', tab: 'Scope', action: 'pay' });
  deq(cvQ(t.ctx.cueSend('price watch: LED wall', [], '').canvas.url), { page: 'pricewatch', q: 'LED wall' });
  deq(cvQ(t.ctx.cueSend('open supplier Sonic Pro', [], '').canvas.url), { page: 'support', tab: 'suppliers', q: 'Sonic Pro' });
  deq(cvQ(t.ctx.cueSend('open suppliers', [], '').canvas.url), { page: 'support', tab: 'suppliers' });
  assert.strictEqual(t.ctx.cueSend('open canvas', [], '').canvas.url, CV_BASE, 'the Workspace itself');
  assert.strictEqual(t.log.gpt.length, 0);
  const u = sandbox({ props: { CUE_CANVAS_URL: 'https://script.google.com/macros/s/AKfycbOTHER/exec' } });
  assert.ok(u.ctx.cueSend('open finance', [], '').canvas.url.indexOf('https://script.google.com/macros/s/AKfycbOTHER/exec?page=playbook') === 0, 'CUE_CANVAS_URL wins');
  const w = sandbox({ props: { CUE_CANVAS_URL: 'https://evil.example/exec' } });
  assert.throws(() => w.ctx.cueSend('open finance', [], ''), /Canvas Workspace/);
});
test('CV4 several projects match: Cue asks which, one button each; a name Canvas doesn\'t know goes to the chat call instead', () => {
  const two = [GLOBE, Object.assign({}, GLOBE, { project_id: 'S-31628061SP', name: 'Globe Year-End Party Cebu', date: '2026-12-14' })];
  const t = sandbox({ search: { 'globe': { projects: two, total: 2 } } });
  const r = t.ctx.cueSend('open globe', [], ''); assert.ok(r.chat && !r.canvas, 'nothing opens until Kiko picks');
  const last = t.tabs.Chat.rows[t.tabs.Chat.rows.length - 1][2];
  assert.ok(/Which one\?/.test(last) && (last.match(/\[\[canvas\|/g) || []).length === 2 && last.indexOf('S-31628061SP') > 0);
  const u = sandbox({ talk: { reply: 'Opening what?', looks_like_inquiry: false, start_intake: '', task: '' } });
  const v = u.ctx.cueSend('open the brief', [], '');
  assert.ok(!v.canvas); deq(u.log.bridge.map(b => b.action).slice(0, 2), ['search_projects', 'find_similar_projects'], 'Canvas asked first');
  assert.strictEqual(u.log.gpt.length, 1, 'then the normal chat call');
});
test('CV5 supplier card: Open in Canvas fills Add supplier from the card; never a bank detail in the link (Kiko 19:20Z)', () => {
  const t = supToCard(), o = t.v.open, q = cvQ(o.url), d = cvDec(q.qcadd);
  deq([q.page, q.tab], ['support', 'suppliers']); assert.strictEqual(d.name, 'Bright Stage Rentals OPC');
  deq(d.details, { person: 'Rita Santos', phone: '+63 918 000 0000', email: 'rita@brightstage.example', location: 'Makati', service: 'Lights and Sounds', tin: '444-555-666-000', types: ['Rentals'] });
  assert.strictEqual(t.v.supplier.record.AccountNumber, '001234567890', 'the card still shows it, to copy');
  ['001234567890', 'BDO', 'acctNo', 'bank'].forEach(k => assert.ok(o.url.indexOf(k) < 0 && JSON.stringify(d).indexOf(k) < 0, k + ' kept out of the link'));
  const dup = supToCard({ supCheck: Object.assign({}, SUP_CHECK, { duplicates: [{ id: 'SUP-0042', name: 'Bright Stage Rentals', why: ['same TIN'], accreditation: 'Accredited', folder: '' }] }) });
  deq(cvQ(dup.v.open.url), { page: 'support', tab: 'suppliers', q: 'Bright Stage Rentals' }, 'a duplicate opens the one Canvas has');
});
test('CV6 Saved in Canvas: Cue finds the supplier Canvas saved, files the documents and drafts the request; it never adds it again', () => {
  const found = { duplicates: [{ id: 'SUP-0777', name: 'Bright Stage Rentals OPC', why: ['same name'], accreditation: '', folder: 'https://drive.google.com/drive/folders/SF7' }] };
  const t = supToCard({ supCheck: n => (n === 1 ? SUP_CHECK : found), sup: SUP_FIT, mail: SUP_MAIL });
  const v = t.ctx.cueSupplierSaved(t.id, {});
  assert.strictEqual(v.status, 'Done'); assert.strictEqual(v.supplier.canvas.supplier_id, 'SUP-0777');
  assert.ok(!(t.log.registered || []).length, 'no register_supplier'); assert.ok((t.log.supFiles || []).length >= 1, 'documents filed');
  deq(t.log.supCheck, { name: 'Bright Stage Rentals OPC' });
  assert.ok(t.tabs.Chat.rows.some(x => /Found Bright Stage Rentals OPC in the Supplier Database as SUP-0777/.test(x[2])));
  assert.strictEqual(cvQ(v.open.url).q, 'Bright Stage Rentals OPC', 'afterwards the card opens the saved supplier');
  const u = supToCard({ supCheck: () => SUP_CHECK }); const w = u.ctx.cueSupplierSaved(u.id, {});
  assert.strictEqual(w.status, 'Needs you'); assert.ok(/no supplier called Bright Stage Rentals OPC yet/.test(w.error)); assert.ok(!(u.log.supFiles || []).length);
});
test('CV7 cards open their Canvas page: ARs on the project, readiness on Checklist, an expense on Request payment', () => {
  const t = sandbox({ similar: [GLOBE], talk: { reply: 'On it.', looks_like_inquiry: false, start_intake: '', task: '', start_ar: 'Globe year-end party' } });
  const v = t.ctx.cueRun(t.ctx.cueSend('prepare ARs for the Globe year-end party', [], '').request_id);
  deq(cvQ(v.open.url), { page: 'canvas', project: 'S-31628060SP', tab: 'Main', action: 'ar' }, 'Canvas 194 opens the AR generator');
  const s = { id: 'x', kind: 'readiness', ready: { match: { project_id: 'S-31628060SP', name: 'Globe' } } };
  deq(cvQ(t.ctx.cueCanvasFor_(s).url), { page: 'canvas', project: 'S-31628060SP', tab: 'Checklist' });
  deq(cvQ(t.ctx.cueCanvasFor_({ kind: 'expense', expense: { project: { id: 'S-25506500TR', name: 'Trick or Treat' } } }).url), { page: 'canvas', project: 'S-25506500TR', tab: 'Scope', action: 'pay' });
  deq(cvQ(t.ctx.cueCanvasFor_({ kind: 'finance' }).url), { page: 'playbook' });
  deq(cvQ(t.ctx.cueCanvasFor_({ kind: 'payment' }).url), { page: 'financedesk', view: 'ar' }, 'Sales is on Finance Desk (PC test 20:33Z)');
  assert.strictEqual(t.ctx.cueCanvasFor_({ kind: 'ar', ar: { project_id: 'not-an-id' } }), null, 'a bad id never makes a link');
});
test('CV9 qcadd never carries bank, account, IBAN or SWIFT, whatever the supplier has (Kiko 19:20Z)', () => {
  const t = sandbox(), BANK = { bank: 'BDO', bank_name: 'BDO Unibank', acctName: 'Bright Stage Rentals OPC', acctNo: '001234567890', account: '001234567890',
    account_name: 'Bright Stage', account_number: '009988776655', bank_account: '001234567890', iban: 'PH12BDO0001234567890', swift: 'BNORPHMM', swift_code: 'BNORPHMM', bic: 'BNORPHMM' };
  const dec = l => cvDec(cvQ(l.url).qcadd);
  const a = t.ctx.cueCanvasLink_({ what: 'addsupplier', name: 'Bright Stage Rentals OPC', details: Object.assign({ person: 'Rita Santos', tin: '444-555-666-000' }, BANK) });
  deq(dec(a).details, { person: 'Rita Santos', tin: '444-555-666-000' }, 'only the allowed fields');
  const rec = { 'Supplier': 'Bright Stage Rentals OPC', 'City': 'Makati', 'TIN': '444-555-666-000', 'Bank': 'BDO', 'Account Name': 'Bright Stage Rentals OPC', 'AccountNumber': '001234567890',
    'IBAN': 'PH12BDO0001234567890', 'SWIFT': 'BNORPHMM', 'SWIFT Code': 'BNORPHMM', 'Bank Account': '001234567890' };
  const b = t.ctx.cueSupCanvas_({ sup: { record: rec, duplicates: [], contacts: [Object.assign({ person: 'Rita Santos', number: '+63 918 000 0000', email: 'rita@brightstage.example' }, BANK)] } });
  [a, b].forEach(l => {
    const raw = l.url + JSON.stringify(dec(l));
    ['001234567890', '009988776655', 'PH12BDO', 'BNORPHMM', 'BDO', 'bank', 'Bank', 'acct', 'account', 'Account', 'iban', 'IBAN', 'swift', 'SWIFT', 'bic'].forEach(k => assert.ok(raw.indexOf(k) < 0, k + ' kept out of the link'));
  });
});
test('CV10 PC test 19:40Z: an Open in Canvas link on a card keeps a readable label; the pane says Loading Canvas until the project can show', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'Index.html'), 'utf8');
  assert.ok(/\.card a \{ color:var\(--act\); \}/.test(html) && /\.card a\.btn \{ color:#0b1320; \} \.card a\.btn\.ghost \{ color:var\(--text\); \}/.test(html), 'label not the button colour');
  assert.ok(html.indexOf('class="cvnote cvload"') > 0 && /cvGone = setTimeout\(cvUnload, 30000\)/.test(html), 'loading line, gone by 30 s');
  assert.ok(/querySelector\('\.cvnote:not\(\.cvload\)'\)/.test(html), '"ready" removes only the sign-in note');
});
test('CV11 Canvas 194 links (Kiko "Go" 19:46Z): FSA generator, Request payment filled, Finance by client, Accounts, Cost Estimates', () => {
  const t = sandbox({ search: { 'globe party': { projects: [GLOBE], total: 1 } } });
  assert.ok(t.ctx.cueSend('make FSAs for Globe party', [], '').request_id, 'CREW-DOCS: Cue makes and sends them now; the card still opens the generator');
  deq(cvQ(t.ctx.cueSend('open receivables for Telus', [], '').canvas.url), { page: 'financedesk', view: 'ar', client: 'Telus' });
  deq(cvQ(t.ctx.cueSend('open payables for Sonic Pro', [], '').canvas.url), { page: 'financedesk', view: 'pay', client: 'Sonic Pro' });
  deq(cvQ(t.ctx.cueSend('open account Unilever', [], '').canvas.url), { page: 'clientdesk', q: 'Unilever' });
  deq(cvQ(t.ctx.cueSend('open CE for Globe party', [], '').canvas.url), { page: 'cedesk', q: 'Globe party' });
  assert.strictEqual(t.log.gpt.length, 0, 'no AI call');
  const ex = { kind: 'expense', expense: { project: { id: 'S-25506500TR', name: 'Trick or Treat' }, plan: { scope_id: 'SC-0004', amount: 1250.5, item: 'Duct tape', payee: 'Ace Hardware' } }, read: { supplier: 'Ace Hardware' } };
  const q = cvQ(t.ctx.cueCanvasFor_(ex).url);
  deq([q.action, q.tab], ['pay', 'Scope']); deq(cvDec(q.qc), { scope: 'SC-0004', amount: 1250.5, supplier: 'Ace Hardware', cost: 'Duct tape' });
  const l = t.ctx.cueCanvasLink_({ what: 'addsupplier', name: 'Bright Stage', details: {}, h: 'a'.repeat(40),
    fields: { 'Address': '12 Ayala Ave', 'Business Type': 'Corporation', 'Bank': 'BDO', 'AccountNumber': '001234567890', 'Nope': 'x' } });
  const a = cvQ(l.url); assert.strictEqual(a.h, 'a'.repeat(40), 'bank details go by one-time code');
  deq(cvDec(a.qcadd).fields, { 'Address': '12 Ayala Ave', 'Business Type': 'Corporation' }, 'only allowed columns, never bank');
  assert.ok(!cvQ(t.ctx.cueCanvasLink_({ what: 'addsupplier', name: 'X', details: {}, h: 'not-a-code' }).url).h, 'a bad code is dropped');
});
test('CV12 supplier card Open in Canvas (Canvas 194): every column filled, bank details by one-time code only, never in the link', () => {
  const t = supToCard(), u = t.ctx.cueSupplierCanvas(t.id), q = cvQ(u.url), d = cvDec(q.qcadd);
  assert.strictEqual(q.h, 'c0ffee'.repeat(6) + 'beef', 'the code rides in the link');
  deq(t.log.handoff, [{ bank: 'BDO', acctName: t.v.supplier.record['Account Name'], acctNo: '001234567890' }], 'bank details go by bridge, once');
  deq([d.fields['Address'], d.fields['Province'], d.fields['Business Type'], d.fields['TIN Status']], ['12 Jupiter St', 'Metro Manila', 'Corporation', 'VAT Not Registered'], 'other columns filled');
  ['001234567890', 'BDO', 'Account Name', 'AccountNumber', '"Bank"'].forEach(k => assert.ok(u.url.indexOf(encodeURIComponent(k)) < 0 && JSON.stringify(d).indexOf(k) < 0, k + ' kept out of the link'));
  const f = supToCard({ handoffFail: true }), v = f.ctx.cueSupplierCanvas(f.id);
  assert.ok(!cvQ(v.url).h && /Copy them from the card/.test(v.note), 'Canvas without handoff: the plain link and a note');
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'Index.html'), 'utf8');
  assert.ok(/call\('cueSupplierCanvas', \[hand\]/.test(html) && /d\.canvasWs !== 'saved'/.test(html), 'page asks for the code on tap and hears "saved"');
});
test('CV13 PC test 20:33Z: "Record project expense 979 ... for <project>" with no file: Kiko\'s amount counts, and Canvas\'s project search finds the project', () => {
  const read = Object.assign({}, XREAD, { amount: 0, project_hint: '', files: [] });
  const t = sandbox({ xread: read, search: { "trick or treat manila": { projects: [{ project_id: 'S-25506500TR', name: 'Trick or Treat – Manila', account: 'Telus', date: '2026-10-31' }], total: 1 } },
    xev: a => (a.project_id === 'S-25506500TR' ? XPROJ : { project: null, candidates: [] }) });
  const v = t.ctx.cueExpense("Record project expense 979 Fresh N' Famous snack packs for Trick or Treat Manila", [], '');
  assert.strictEqual(v.expense.read.amount, 979, 'the typed amount');
  assert.ok(v.expense.project, 'project found by search_projects'); assert.strictEqual(t.log.xev[t.log.xev.length - 1].project_id, 'S-25506500TR');
  assert.ok(v.expense.plan, 'Claude planned it, so the card has Request payment and Approve');
});
test('CV14 1.25.2 (PC test 20:41Z): only an amount means quantity 1; Request payment carries the expense type and says when the scope is not For Payment Request', () => {
  const q = (read, plan) => { const t = sandbox({ xread: Object.assign({}, XREAD, read), xev: () => XPROJ, xplan: plan ? Object.assign({}, XPLAN, plan) : XPLAN });
    return t.ctx.cueExpense("Record project expense 979 Fresh N' Famous snack packs for Trick or Treat Manila", [], '').expense; };
  assert.strictEqual(q({ amount: 979, quantity: 979, unit: '' }).read.quantity, 1, 'the amount copied into quantity');
  assert.strictEqual(q({ amount: 979, quantity: 0 }).read.quantity, 1, 'no quantity shown');
  assert.strictEqual(q({ amount: 450, quantity: 3 }).read.quantity, 3, 'a real quantity stays');
  assert.strictEqual(q({ amount: 979, quantity: 979 }, { new_scope: Object.assign({}, XPLAN.new_scope, { quantity: 979 }) }).plan.new_scope.quantity, 1, 'new scope too');
  const t = sandbox(), ex = st => ({ kind: 'expense', read: { amount: 979, item: 'Snack packs' }, expense: { project: { id: 'S-25506500TR', name: 'Trick or Treat' },
    scopes: [{ id: 'SCP26-017-09', status: st }], plan: { route: 'existing_scope', scope_id: 'SCP26-017-09', expense_type: 'Supplies and Materials', amount: 979 } } });
  const l = t.ctx.cueCanvasFor_(ex('Awarded')), qc = cvDec(cvQ(l.url).qc);
  assert.strictEqual(qc.scope, 'SCP26-017-09'); assert.strictEqual(qc.etype, 'Supplies and Materials'); assert.strictEqual(qc.amount, 979);
  assert.ok(/SCP26-017-09 is "Awarded".*For Payment Request/.test(l.note), l.note);
  assert.strictEqual(t.ctx.cueCanvasFor_(ex('For Payment Request')).note, undefined, 'no note when Canvas lists it');
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'Index.html'), 'utf8');
  assert.ok(/r\.open\.note \? '<div class="small muted"/.test(html), 'the card shows the note under Open in Canvas');
});
test('CV8 the page sends every Canvas command to the server, never to the expense shortcut (CV_SAY mirrors cueCanvasParse_)', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'Index.html'), 'utf8'), m = /var CV_SAY = (\/.+\/i);/.exec(html);
  assert.ok(m); const re = eval(m[1]), t = sandbox({});
  ['open Globe party expenses', 'Please open the Globe party expenses in Canvas', 'request payment for Globe party', 'add scope duct tape to Globe party',
    'close task send floor plan in Globe party', 'past prices of LED wall', 'show Globe expenses in canvas', 'go to Globe party']
    .forEach(x => { assert.ok(t.ctx.cueCanvasParse_(x), 'server: ' + x); assert.ok(re.test(x), 'page: ' + x); });
  ['record expense 450 duct tape for Globe', 'paid to Ace Hardware 450', 'show me the expenses'].forEach(x => assert.ok(!re.test(x), 'stays an expense: ' + x));
});

test('BD8 PC test 19:32Z: blank sheet rows are not notices to recheck; plain wording for the intake check; run names carry the time', () => {
  const blank = ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];
  const t = bidBox({}, [blank, ['2026-10-20', 'TPB', 'OLD-1', 'Travel fair booth', 'Open', 'Makati', 600000, 'PHP', '2026-10-27T17:00+08:00', '', '', '', 'https://tpb.gov.ph/x', '', '', '', ''], blank]);
  const v = t.ctx.cueRun(t.ctx.cueSend('run bid opportunity check', [], '').request_id), ck = n => v.bids.checks.filter(c => c.id === n)[0];
  assert.strictEqual(ck(7).ok, true); assert.strictEqual(ck(7).detail, '', 'no empty "Not rechecked: ," line');
  assert.strictEqual(ck(9).label, 'You pick which ones go to intake (Cue never marks them)');
  assert.ok(/'MM\/dd HH:mm'/.test(fs.readFileSync(path.join(__dirname, '..', 'src', 'CueBids.gs'), 'utf8')), 'title has the time');
});
