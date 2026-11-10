// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: intake-real-check.
/* INTAKE-REAL-CHECK (backlog card intake-real-check, 29 Oct 2026): the cloud check test/checks/intake-real.check.mjs runs intake on real
 * inquiries through the check door. These tests prove the door functions it uses (CueIntakeCheck.gs) and the two check fixes it needed. */
const irBox = () => { const t = checkBox({ phased: true, inbox: INBOX, until: Date.parse('2030-01-01T00:00:00Z') });
  const at = d => new Date(Date.parse('2026-10-21T00:00:00Z') - d * 864e5);
  t.tabs['Triage log'].rows.push([at(3), 'm0', 'a1a1a1a1a1a1a1a1', 'ana@acme.example', 'Quote for our launch', 'inquiry', 'older line, same thread', 'cue-sweep-0'],
    [at(2), 'm9', 'b2b2b2b2b2b2b2b2', 'news@events.example', 'Digest', 'fyi', 'newsletter', 'cue-sweep-0'],
    [at(1), 'm1', 'a1a1a1a1a1a1a1a1', 'ana@acme.example', 'Quote for our launch', 'inquiry', 'launch quote', 'cue-sweep-1'],
    [at(40), 'm2', 'c3c3c3c3c3c3c3c3', 'old@x.example', 'Old', 'inquiry', 'too old', 'cue-sweep-0']);
  return t; };
test('IR1 intake-real check: picks real inquiries (one per thread, newest first, last 30 days) with their text, starts intake from the Gmail thread, stops at the phase 1 card', () => {
  const t = irBox(), pick = t.call('cueIcPick_', 30, 6).result;
  deq(pick.map(p => [p.key, p.inbox, p.thread_id]), [['inbox:m1', 'mine', 'a1a1a1a1a1a1a1a1']]);
  assert.ok(/product launch on 5 December/.test(pick[0].text) && pick[0].files >= 1 && !pick[0].error, JSON.stringify(pick[0]));
  const id = t.call('cueIcStart_', pick[0]).result.request_id; t.call('cueRun', id);
  const s = t.state(id); deq([s.kind, s.phase, s.status, s.source.thread_id, !!s.check], ['intake', 1, 'Needs you', 'a1a1a1a1a1a1a1a1', true]);
  deq(writes(t), []); deq(t.door('check_finish').stopped, [], 'client_check is a read: the phase 1 card asks it without tripping the lock');
});
test('IR2 intake-real check: phases 2 to 4 run in memory from the phase 1 card; nothing is saved, written to Canvas or drafted in Gmail', () => {
  const t = irBox(), id = t.call('cueIcStart_', t.call('cueIcPick_', 30, 6).result[0]).result.request_id; t.call('cueRun', id);
  const before = JSON.stringify(t.state(id)), drafts = t.log.gmail.length, d = n => t.call('cueIcDeep_', id, n);
  assert.ok(/Run phase 2 of this check first/.test(d(3).error), 'phases run in order');
  const p2 = d(2).result; assert.ok(p2.rows.length && p2.rows.every(r => r.item.split(/\s+/).length <= 6) && p2.phase === 2, JSON.stringify(p2));
  const p3 = d(3).result; assert.ok(p3.totals && p3.lines.length === p2.rows.length && p3.phase === 3, JSON.stringify(p3));
  const p4 = d(4).result; assert.ok(Array.isArray(p4.rfqs), JSON.stringify(p4));
  deq(writes(t), []); assert.strictEqual(JSON.stringify(t.state(id)), before, 'the task is unchanged'); assert.strictEqual(t.log.gmail.length, drafts);
  assert.ok(/No such request/.test(t.call('cueIcDeep_', 'cue-nope', 2).error || ''), 'an unknown task is an error');
  deq(t.door('check_finish').stopped, []);
});
test('IR3 a check\'s intake never joins or reopens one of Kiko\'s threads; outside a check the same message still joins his card', () => {
  const t = irBox(), mine = t.ctx.cueSend(INQ, [], 'intake').request_id; t.ctx.cueRun(mine);
  const kiko = JSON.stringify(t.state(mine)), out = t.call('cueSend', INQ + ' Please add a second LED wall.', [], 'intake').result;
  assert.notStrictEqual(out.request_id, mine); assert.strictEqual(JSON.stringify(t.state(mine)), kiko, 'Kiko\'s card is untouched');
  t.ctx.CUE_CHECK_ON_ = false; assert.strictEqual(t.ctx.cueSend(INQ + ' Please add a second LED wall.', [], 'intake').request_id, mine, 'live behaviour unchanged');
});
test('IR4 intake-real check: inquiries come from New mail\'s sort (its log lines say "new"), newest first, skipped and check tasks left out', () => {
  const t = irBox(), day = Date.parse('2026-10-20T08:00:00Z');
  const it = (k, th, g, ms, extra) => Object.assign({ key: 'inbox:' + k, inbox: 'mine', group: g, sender: 'ruth@moldex.example', subject: 'Request Quotation ' + k, thread_id: th, ms }, extra || {});
  const nm = (id, items, extra) => Object.assign({ id, kind: 'newmail', day: '2026-10-20', status: 'Needs you', nm: { items } }, extra || {});
  [nm('cue-nm-1', [it('n1', 'd4d4d4d4d4d4d4d4', 'inquiry', day), it('n2', 'e5e5e5e5e5e5e5e5', 'fyi', day), it('n3', 'f6f6f6f6f6f6f6f6', 'inquiry', day, { removed: 'skip' })]),
    nm('cue-nm-2', [it('n4', 'a7a7a7a7a7a7a7a7', 'inquiry', day)], { check: 'x' })]
    .forEach(s => t.tabs.Requests.rows.push([s.id, '', '', '', '', '', '', '', '', '', JSON.stringify(s)]));
  t.tabs['Triage log'].rows.push([new Date(day), 'n1', 'd4d4d4d4d4d4d4d4', 'ruth@moldex.example', 'Request Quotation n1', 'new', '', 'cue-nm-1']);
  const pick = t.call('cueIcPick_', 30, 6).result;
  deq(pick.map(p => [p.key, p.thread_id, p.run]), [['inbox:n1', 'd4d4d4d4d4d4d4d4', 'cue-nm-1'], ['inbox:m1', 'a1a1a1a1a1a1a1a1', 'cue-sweep-1']]);
});
test('IR5 RFQ drafts get TBC for blank event details, never an empty line or 0 pax', () => {
  const t = irBox(), id = t.call('cueIcStart_', t.call('cueIcPick_', 30, 6).result[0]).result.request_id; t.call('cueRun', id);
  const L = t.ctx.cueLoad_(id); L.s.x.event = Object.assign(L.s.x.event || {}, { venue: '', city: '', pax: 0, date: '' }); t.ctx.cueSave_(L.sh, L.row, L.s);
  [2, 3, 4].forEach(n => t.call('cueIcDeep_', id, n));
  const call = t.log.gpt.filter(b => b.text.format.name === 'rfqs').pop(), ev = call && JSON.parse(String(call.input).slice(String(call.input).indexOf('{'))).event;
  assert.ok(ev, 'the RFQ call carries the event'); deq([ev.venue, ev.city, ev.pax, ev.date], ['TBC', 'TBC', 'TBC', 'TBC']);
});
test('IR6 intake-real check on one named project: only inquiries with those words; none sorted falls back to a Gmail search', () => {
  const t = irBox();
  deq(t.call('cueIcPick_', 30, 6, 'launch acme').result.map(p => p.thread_id), ['a1a1a1a1a1a1a1a1']);
  const fb = t.call('cueIcPick_', 30, 6, 'launch nobody').result; assert.strictEqual(fb.length, 1, JSON.stringify(fb)); assert.ok(fb[0].text && !fb[0].error, JSON.stringify(fb[0]));
  assert.ok(/launch nobody newer_than:30d/.test(t.log.inboxQ), t.log.inboxQ);
});
/* CUE-048 (Kiko 7 Nov 2026 13:37Z/13:38Z R1 and R2, 13:59Z R3) and spec intake-real-check AC2/AC4: the check's own rules, in
 * test/checks/intake-rules.cjs. They only report; nothing in Cue is blocked by them. */
const irRules = require(path.join(__dirname, 'checks', 'intake-rules.cjs'));
test('IR7 RFQ rules R1 to R3: client by full name or first distinctive word, peso amounts and budget, other suppliers; no false flags', () => {
  const c = { client: 'Moldex Realty Inc', suppliers: ['Lights PH', 'Sound Co', 'ABC'] };
  const bad = irRules.rfqBreaks({ supplier: 'Lights PH', subject: 'RFQ', body: 'For Moldex we have a budget. Sound Co is also quoting.' }, c);
  deq(bad.map(x => x.slice(0, 2)), ['R1', 'R2', 'R3']);
  ['PHP 5,000', '₱5000', 'P50,000', 'P 120000', 'Php1.2', '50k pesos', '5,000 pesos'].forEach(m =>
    assert.ok(irRules.rfqBreaks({ supplier: 'x', body: 'Total ' + m + ' only.' }, {}).some(x => /^R2/.test(x)), m));
  deq(irRules.rfqBreaks({ supplier: 'ABC', body: 'For ABC Events' }, { client: 'ABC', suppliers: ['ABC'] }).map(x => x.slice(0, 2)), ['R1'], 'a short client name still counts as a whole word');
  // Negative cases: none of these is a price, the client or another supplier.
  deq(irRules.rfqBreaks({ supplier: 'Lights PH', body: 'Please quote P1 lighting, a sound system, Day 2 PM setup, model X300, 2 units, '
    + 'ABCs of staging, realty-grade risers. Event date TBC. Kindly include unit prices and VAT.' }, c), []);
  deq(irRules.rfqBreaks({ supplier: 'Lights PH', body: 'Lights PH, please send your rates.' }, c), [], 'the draft may name its own supplier');
});
test('IR8 RFQ drafts: blank event details must read TBC, never "0 pax"; filled details need no TBC', () => {
  deq(irRules.tbcBreaks({ body: 'Date: 5 December. Venue: SMX. City: Pasay. Pax: 300.' }, { date: '2026-12-05', venue: 'SMX', city: 'Pasay', pax: 300 }), []);
  assert.ok(/does not say TBC for: date, pax/.test(irRules.tbcBreaks({ body: 'Venue: SMX. Expected pax: 0' }, { date: '', venue: 'SMX', city: 'Pasay', pax: 0 })[0]));
  assert.ok(irRules.tbcBreaks({ body: 'Date TBC. Expected pax: 0' }, { date: '', venue: 'SMX', city: 'Pasay', pax: 0 }).some(x => /pax \("0"\)/.test(x)));
  deq(irRules.tbcBreaks({ body: 'Date TBC. Pax TBC.' }, { date: '', venue: 'SMX', city: 'Pasay', pax: 0 }), []);
});
test('IR9 AC4 and AC2: an RFQ supplier must be one phase 3 named for its lines (Canvas evidence or found and marked new); phase 1 client and event must come from the inquiry', () => {
  const lines = [{ key: 'K1', suppliers: [{ name: 'Lights PH', new: false }, { name: 'Glow Rentals', new: true }] }, { key: 'K2', suppliers: [{ name: 'Sound Co' }] }];
  deq(irRules.supplierBreaks({ supplier: 'Glow Rentals', keys: ['K1'] }, lines), []);
  assert.strictEqual(irRules.supplierBreaks({ supplier: 'Sound Co', keys: ['K1'] }, lines).length, 1, 'named for another line only');
  assert.strictEqual(irRules.supplierBreaks({ supplier: 'Made Up Inc', keys: ['K2'] }, lines).length, 1);
  const src = { from: 'Ana Reyes <ana@moldex.example>', subject: 'Quote for our year-end party', text: 'Moldex Realty is holding its Year-End Party on 5 December.' };
  deq(irRules.readBack({ client: 'Moldex Realty Inc', event: { name: 'Year-End Party' } }, src), { client: 'Moldex Realty Inc', client_in_inquiry: true, event: 'Year-End Party', event_in_inquiry: true });
  assert.strictEqual(irRules.readBack({ client: 'Ayala Land', event: { name: '' } }, src).client_in_inquiry, false, 'a client the inquiry never names fails');
});

test('IR10 check run 2 (7 Nov): a client written "Name (SHORT)" and an event made of short words read back from the inquiry; a price in a spec stays an R2 break', () => {
  // Real run 2: "Asian Development Bank (ADB)" from mail sent by adb.org, and "IRT YEP" from the subject "Request for Quote | IRT YEP".
  const adb = { from: 'Procurement <procurement@adb.org>', subject: 'Reminder: RFP for the Provision of Large Format Printing', text: 'Please submit by Friday.' };
  assert.strictEqual(irRules.readBack({ client: 'Asian Development Bank (ADB)', event: { name: '' } }, adb).client_in_inquiry, true, 'short name in brackets');
  assert.strictEqual(irRules.readBack({ client: 'Inter-American Bank (IDB)', event: { name: '' } }, adb).client_in_inquiry, false, 'neither form named still fails');
  const yep = { from: 'Joy <joy@foundever.example>', subject: 'Request for Quote | IRT YEP', text: 'See the attached PDF.' };
  assert.strictEqual(irRules.readBack({ client: 'Foundever', event: { name: 'IRT YEP' } }, yep).event_in_inquiry, true, 'short-word event name');
  assert.strictEqual(irRules.readBack({ client: 'Foundever', event: { name: 'XYZ ABC' } }, yep).event_in_inquiry, false, 'short words not in the inquiry fail');
  // Real run 2: the Landlite RFQ copied the drawing's price into the item. R2 must still catch it.
  const rfq = { supplier: 'Landlite Philippines Corporation', subject: 'RFQ: lights', body: '- R10: Ground light GUWL-0101 12V, per drawing at P4,800 each; qty 1.' };
  assert.ok(irRules.rfqBreaks(rfq, { client: 'Moldex Land, Inc.', suppliers: [rfq.supplier] }).some(b => /^R2/.test(b)));
  // The RFQ prompts say outright that a price inside a spec, the inquiry or a drawing is left out.
  const fs = require('fs');
  assert.ok(/not even a price or rate written in a spec/.test(fs.readFileSync(path.join(__dirname, '..', 'src', 'CueIntake.gs'), 'utf8')));
  assert.ok(/not even a price or rate in Kiko\\'s specs/.test(fs.readFileSync(path.join(__dirname, '..', 'src', 'CueVendor.gs'), 'utf8')));
});

test('IR11 PR #347 review: each blank event detail needs its own TBC; a name only an attachment could hold is unverified, not a fail', () => {
  // One TBC must not cover a made-up date (the 29 Oct regression).
  assert.ok(/date \("5 December 2026"\)/.test(irRules.tbcBreaks({ body: 'Date: 5 December 2026. Venue: TBC.' }, { date: '', venue: '', city: 'Pasay', pax: 300 })[0]));
  deq(irRules.tbcBreaks({ body: 'Date: TBC. Venue: TBC. Quote deadline: 10 November 2026.' }, { date: '', venue: '', city: 'Pasay', pax: 300 }), []);
  deq(irRules.tbcBreaks({ body: 'Due date: 10 November. Event date: TBC.' }, { date: '', venue: 'SMX', city: 'Pasay', pax: 300 }), []);
  // Email text without the name, but the inquiry had a file: unverified. No file: false.
  const src = { from: 'Joy <joy@x.example>', subject: 'Request for Quote', text: 'See attached brief.' };
  assert.strictEqual(irRules.readBack({ client: 'Foundever', event: { name: 'Gala Night' } }, Object.assign({ files: 1 }, src)).client_in_inquiry, 'unverified');
  assert.strictEqual(irRules.readBack({ client: 'Foundever', event: { name: 'Gala Night' } }, Object.assign({ files: 1 }, src)).event_in_inquiry, 'unverified');
  assert.strictEqual(irRules.readBack({ client: 'Foundever', event: { name: 'Gala Night' } }, src).client_in_inquiry, false);
});

test('IR12 CUE-049 (not approved, awaiting Kiko): research that names a kind of business gets no RFQ; the card says what was left out', () => {
  const research = { prices: RESEARCH.prices, suppliers: [
    { key: 'R3', name: 'SkyLights PH', email: 'hello@skylights.example', website: 'https://skylights.example', why: 'drone shows' },
    { key: 'R3', name: 'Licensed electrical contractors (Metro Manila)', email: '', website: '', why: 'category' },
    { key: 'R3', name: 'Event contractors / booth builders (e.g., local event fabrication houses)', email: '', website: '', why: 'category' },
    { key: 'R3', name: 'LightAndSoundRental (rates blog)', email: '', website: '', why: 'blog' }] };
  const t = startToCard({ research });
  deq(t.v.proposal.lines[2].suppliers.map(s => s.name), ['SkyLights PH']);
  assert.ok(t.v.notes.some(n => /named 3 kind\(s\) of business instead of a supplier/.test(n) && /Licensed electrical contractors/.test(n)));
  assert.ok(!(t.v.proposal.rfqs || []).some(q => /contractors|blog/i.test(((q.suppliers || [])[0] || {}).name || '')), 'no RFQ goes to a category');
  // Real names from check runs 2 and 3 stay, including slashes and brackets.
  ['Floor Center / Tile Center', 'Landlite Philippines Corporation (distributor/retailer)', 'MCAV (alternate contact / Cebu branch reference)',
    '8th Beat / 8th Beat Professional Lights and Sounds', 'ABC Builders', 'R2Z2 TABLES AND CHAIRS RENTALS'].forEach(n => assert.strictEqual(t.ctx.cueIsCategory_(n), false, n));
  ['Pasay City LGU / Grand View Tower building admin', 'Major electrical suppliers (e.g., Ace Hardware / Handyman)', 'Local signage fabricators (examples: sign shops)',
    'Nursery / event-prop rental companies', 'Kwyzer – assorted acts (market listings)', 'Local government RFQ examples (pricing reference)'].forEach(n => assert.strictEqual(t.ctx.cueIsCategory_(n), true, n));
  // The research prompt asks for real companies only.
  assert.ok(/never a kind of business/.test(t.ctx.CUE_RS_SYSTEM_ || require('fs').readFileSync(path.join(__dirname, '..', 'src', 'CueIntake.gs'), 'utf8')));
});

test('IR13 check run 3 (7 Nov): research that finds no suppliers at all is said on the card', () => {
  const t = startToCard({ research: { prices: RESEARCH.prices, suppliers: [] } });
  assert.ok(t.v.proposal.lines.some(l => l.flags.some(f => /No supplier on file or found/.test(f))));
  assert.ok(t.v.notes.some(n => /Web research found no new suppliers this time/.test(n)));
  const u = startToCard();
  assert.ok(!u.v.notes.some(n => /Web research found no new suppliers/.test(n)), 'not said when research found some');
});
