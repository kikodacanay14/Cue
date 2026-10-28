// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: supplier-registration.
// CUE-SUPPLIER-2026-10-21: Register a supplier (CueSupplier.gs)
const SUP_READ = { supplier: { name: 'Bright Stage Rentals OPC', display_name: 'Bright Stage', address: '12 Jupiter St', city: 'Makati', province: 'Metro Manila', owner: 'Rita Santos',
    website: '', main_service: 'lights and sounds', secondary_service: '', supplier_types: ['rentals'], business_type: 'One Person Corporation', tin: '444-555-666-000',
    vat_status: 'VAT Not Registered', company_email: 'hello@brightstage.example', bank: 'BDO', account_name: 'Bright Stage Rentals OPC', account_number: '001234567890', bank_from: '2303.pdf' },
  contacts: [{ person: 'Rita Santos', number: '+63 918 000 0000', email: 'rita@brightstage.example', position: 'Owner' }, { person: 'Rita Santos', number: '', email: '', position: '' },
    { person: 'Mark Cruz', number: '0917 111 2222', email: 'not-an-email', position: 'Sales' }],
  files: [{ name: '2303.pdf', doc: 'BIR 2303' }], notes: '' };
const SUP_CHECK = { duplicates: [], lists: { 'Main Service': ['Lights and Sounds', 'Catering'], 'Supplier Type': ['Rentals', 'Equipment'], 'TIN Status': ['VAT Registered', 'VAT Not Registered'],
    'Business Type': ['Corporation', 'Sole Proprietorship', 'Individual'] },
  fields: ['Supplier', 'Common / Display Name', 'Address', 'City', 'Province', 'Owner/Manager', 'Main Service', 'Supplier Type', 'Business Type', 'TIN', 'TIN Status', 'Company Email', 'Bank', 'Account Name', 'AccountNumber'],
  kind: 'Corporation', docs: [{ key: 'sec', label: 'SEC certificate' }, { key: 'permit', label: 'Business Permit' }, { key: 'invoice', label: 'Sample invoice' }],
  details_needed: ['TIN', 'Bank details', 'VAT status'], form_url: 'https://forms.gle/synthetic',
  history: { payments: [{ name: 'Bright Stage Rentals', count: 3, total: 45000, last: '2026-03-02', projects: ['Acme Gala'], person: 'Rita' }], quotes: { count: 2, projects: ['S-1AA'] } }, warnings: [] };
const HITS = [{ id: 'OLD2303FILE00001', name: 'Bright Stage - SEC registration.pdf', mimeType: 'application/pdf', modifiedTime: '2025-11-02T00:00:00Z', webViewLink: 'https://drive.google.com/file/d/OLD2303FILE00001/view', size: '2000', parents: ['p1'] },
  { id: 'OLDQUOTE00000002', name: 'Bright Stage quotation Acme Gala', mimeType: 'application/vnd.google-apps.document', modifiedTime: '2026-03-01T00:00:00Z', webViewLink: 'javascript:alert(1)', parents: ['p2'] },
  { id: 'f1', name: 'my own upload', mimeType: 'application/pdf', parents: ['folder-1'] }];
const SUP_FIT = { fields: [{ header: 'Business Type', value: 'Corporation', why: 'An OPC is a corporation' }, { header: 'Main Service', value: 'Lights and Sounds', why: 'list' },
    { header: 'Bank', value: 'BPI', why: 'never' }, { header: 'Address', value: 'Somewhere else', why: 'would overwrite' }, { header: 'Website/Social Media', value: 'https://brightstage.example', why: 'from the old quote' }],
  contacts: [{ person: 'Jo Lim', number: '0919', email: 'jo@brightstage.example', position: 'Accounts' }, { person: 'rita santos', number: '', email: '', position: '' }],
  found_docs: [{ id: 'OLD2303FILE00001', doc: 'SEC certificate' }, { id: 'NOT-LISTED', doc: 'Business Permit' }], notes: ['The old quote shows the same TIN.'] };
const SUP_MAIL = { subject: 'Accreditation documents for Blank Space Events', body: 'Hi Rita,\nWe still need: Business Permit, Sample invoice.\nhttps://forms.gle/synthetic\nKiko\nBlank Space Events' };
const SUP_PDF = Buffer.from('%PDF 2303 for Bright Stage').toString('base64');
function supToCard(o, text) { const t = sandbox(Object.assign({ scopes: ['spreadsheets', 'gmail.compose', 'gmail.readonly', 'drive.file', 'drive.readonly'] }, o || {}));
  const id = t.ctx.cueSend(text || 'Register this supplier please', [{ name: '2303.pdf', type: 'application/pdf', data: SUP_PDF }]).request_id; const v = t.ctx.cueRun(id); return Object.assign(t, { id, v }); }

test('SR1 register a supplier: GPT read, Canvas check, shared-drive search, Claude fit, GPT request draft: 3 AI calls, one card', () => {
  const t = supToCard(), v = t.v, x = v.supplier, r = x.record;
  assert.strictEqual(v.kind, 'supplier'); assert.strictEqual(v.status, 'Needs you'); assert.strictEqual(v.metrics.ai_calls, 3);
  deq(t.log.gpt.map(g => g.text.format.name), ['supplier', 'supplier_request'], 'no chat call, no intake read'); assert.strictEqual(t.log.claude.length, 1);
  deq(t.log.bridge.map(b => b.action), ['supplier_check'], 'nothing written before approval');
  deq(t.log.supCheck, { name: 'Bright Stage Rentals OPC', display_name: 'Bright Stage', tin: '444-555-666-000', emails: [{ email: 'hello@brightstage.example' }, { email: 'rita@brightstage.example' }], business_type: 'One Person Corporation' });
  assert.ok(/corpora=allDrives/.test(t.log.driveUrl) && /supportsAllDrives=true/.test(t.log.driveUrl));
  ['Bright Stage Rentals', '444-555-666', 'brightstage.example', 'Rita Santos'].forEach(k => assert.ok(t.log.driveQ.indexOf(k) >= 0, k));
  deq([r['Main Service'], r['Supplier Type'], r['Business Type'], r['Website/Social Media'], r['Address'], r['Bank'], r['AccountNumber']],
    ['Lights and Sounds', 'Rentals', 'Corporation', 'https://brightstage.example', '12 Jupiter St', 'BDO', '001234567890'], 'snapped to lists, gaps filled, nothing overwritten, bank only from the 2303');
  deq(x.contacts.map(c => [c.person, c.email]), [['Rita Santos', 'rita@brightstage.example'], ['Mark Cruz', ''], ['Jo Lim', 'jo@brightstage.example']], 'every contact once; a bad email dropped; Claude adds one');
  deq(x.found.map(f => [f.id, f.doc, f.tick, f.url]), [['OLD2303FILE00001', 'SEC certificate', true, 'https://drive.google.com/file/d/OLD2303FILE00001/view'], ['OLDQUOTE00000002', '', false, '']], 'own uploads left out; unsafe link dropped');
  deq(t.log.oldRead, ['OLD2303FILE00001', 'OLDQUOTE00000002/export'], 'Claude reads the top old files');
  assert.strictEqual(t.log.claude[0].messages[0].content[2].type, 'document');
  deq(x.missing, ['Business Permit', 'Sample invoice'], 'the 2303 gave TIN and VAT; the ticked SEC file counts');
  assert.ok(x.email && x.email.to === 'hello@brightstage.example' && /forms\.gle/.test(x.email.body));
  assert.ok(x.notes.some(n => /Bank details are from 2303\.pdf/.test(n)) && x.notes.some(n => /Claude: The old quote/.test(n)));
  assert.ok(x.history.payments.length === 1);
});
test('SR2 fewer calls when nothing needs them: no Drive access = search skipped and said; no gaps = no Claude; nothing missing = no draft', () => {
  const read = JSON.parse(JSON.stringify(SUP_READ)); read.supplier.main_service = 'Lights and Sounds'; read.supplier.supplier_types = ['Rentals']; read.supplier.business_type = 'Corporation';
  const check = Object.assign({}, SUP_CHECK, { history: { payments: [], quotes: { count: 0 } }, docs: [] });
  const t = supToCard({ scopes: ['spreadsheets', 'gmail.compose', 'gmail.readonly', 'drive.file'], supRead: read, supCheck: check });
  assert.strictEqual(t.v.metrics.ai_calls, 1); assert.strictEqual(t.log.claude.length, 0); assert.strictEqual(t.v.supplier.email, null);
  assert.ok(/Skipped the shared-drive search/.test(t.v.supplier.search)); assert.strictEqual(t.log.driveQ, undefined);
  const t2 = supToCard({ supRead: Object.assign({}, read, { supplier: Object.assign({}, read.supplier, { bank_from: '' }) }), supCheck: check, hits: [] });
  assert.strictEqual(t2.v.supplier.record.Bank, '', 'bank details typed or guessed are left out');
  assert.ok(t2.v.supplier.notes.some(n => /Bank details were left out/.test(n)));
  assert.strictEqual(t2.v.metrics.ai_calls, 2, 'bank details missing: the request is drafted');
});
test('SR3 approve and send: Canvas adds it with every contact and the ticked documents, files go to its folder, the request goes from Kiko\'s Gmail with suppliers@ in CC', () => {
  const t = supToCard(), x = t.v.supplier;
  const v = t.ctx.cueApprove(t.id, { record: Object.assign({}, x.record, { City: 'Taguig' }), contacts: x.contacts.concat([{ person: 'Ana', number: '', email: '', position: '' }]),
    docs: { [t.v.files[0].id]: '' }, found: { OLD2303FILE00001: { tick: true, doc: 'SEC certificate' } }, email: { subject: x.email.subject, body: x.email.body + '\nThanks!' }, send: 'send' });
  assert.strictEqual(v.status, 'Done'); const reg = t.log.registered[0];
  assert.strictEqual(reg.request_id, t.id); assert.strictEqual(reg.record.City, 'Taguig'); assert.strictEqual(reg.record['Supplier ID #'], undefined);
  deq(reg.contacts.map(c => c.person), ['Rita Santos', 'Mark Cruz', 'Jo Lim', 'Ana']); deq(reg.docs, [{ label: 'SEC certificate' }]);
  deq(t.log.supFiles, ['2303.pdf:%PDF 2303 for Bright Stage', 'shortcut:OLD2303FILE00001']);
  const mail = t.log.gmail[0]; assert.ok(/To: hello@brightstage\.example/.test(mail) && /Cc: suppliers@blankspaceevent\.com/.test(mail)); assert.strictEqual(t.log.sent.length, 1);
  assert.ok(Buffer.from(mail.split('\r\n\r\n')[1], 'base64').toString().endsWith('\nThanks!'));
  assert.strictEqual(v.supplier.canvas.supplier_id, 'SUP-0999');
  const chat = t.tabs.Chat.rows.map(r => r[2]).join('\n');
  assert.ok(/Summary for supplier Bright Stage Rentals OPC: added to the Supplier Database as SUP-0999 with 4 contacts; every cell read back correctly; 2 documents filed in the supplier folder; still missing for accreditation: Bank details, Sample invoice; documents request sent/.test(chat), chat);
  assert.ok(v.metrics.seconds_work != null && !v.metrics.flag);
});
test('SR4 a duplicate blocks Approve until Kiko ticks "Not the same supplier"; dropdown columns only take the sheet\'s values; approve as a draft never sends', () => {
  const t = supToCard({ supCheck: Object.assign({}, SUP_CHECK, { duplicates: [{ id: 'SUP-0001', name: 'Bright Stage Rentals', row: 5, why: ['same TIN'], accreditation: 'Unaccredited', folder: '' }] }) });
  assert.throws(() => t.ctx.cueApprove(t.id, { send: 'draft' }), /already has Bright Stage Rentals \(SUP-0001\)/);
  assert.throws(() => t.ctx.cueApprove(t.id, { record: { 'Main Service': 'Fireworks' }, not_duplicate: true }), /Pick Main Service from the list/);
  assert.throws(() => t.ctx.cueApprove(t.id, { record: { 'Accreditation Status': 'Accredited' }, not_duplicate: true }), /not a column Cue fills/);
  assert.strictEqual(t.log.registered, undefined);
  const v = t.ctx.cueApprove(t.id, { not_duplicate: true, send: 'draft' });
  assert.strictEqual(v.status, 'Done'); assert.strictEqual(t.log.gmail.length, 1); assert.strictEqual(t.log.sent, undefined);
});
test('SR5 Canvas stopping at a contact comes back to the card; approving again resumes with the same request id', () => {
  const t = supToCard({ supReg: n => n === 1 ? { registered: false, stopped_at: 'contact_1', error: 'Sheet busy', supplier_id: 'SUP-0999' } : null });
  const v1 = t.ctx.cueApprove(t.id, { send: 'none' });
  assert.strictEqual(v1.status, 'Needs you'); assert.ok(/a contact person: Sheet busy.*already in as SUP-0999/.test(v1.error));
  const v2 = t.ctx.cueApprove(t.id, { send: 'none' });
  assert.strictEqual(v2.status, 'Done'); deq(t.log.registered.map(a => a.request_id), [t.id, t.id]); assert.strictEqual(t.log.gmail.length, 0, 'send none: no request');
});
test('SR6 routing: Kiko\'s words decide; supplier talk never reaches the chat call or the intake; GPT\'s request draft failing falls back to the template', () => {
  ['Register this supplier', 'pls register a new supplier: Bright Stage', 'Supplier registration for Juan\'s Lights', 'Add this supplier', 'accredit this vendor']
    .forEach(x => assert.ok(t0.ctx.cueIsSupplier_(x), x));
  ['Requote and add a new supplier for the tent', 'Hi BSE, we need a supplier for chairs at our gala', 'What suppliers did we use for Acme?']
    .forEach(x => assert.ok(!t0.ctx.cueIsSupplier_(x), x));
  const t = sandbox(); assert.throws(() => t.ctx.cueSend('register supplier', []), /Name the supplier/);
  const t2 = supToCard({ fail: { supMail: () => resp(500, {}) } });
  assert.ok(/To finish your accreditation, we still need:\n- Business Permit\n- Sample invoice/.test(t2.v.supplier.email.body)); assert.ok(t2.v.supplier.notes.some(n => /plain template/.test(n)));
});
const t0 = sandbox();
