// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: supplier-search.
test('V1 supplier search: the chat call starts it; Canvas lookup, no web search when the DB has 3+; 1 AI call in the run; Preferred first', () => {
  const t = vendorRun(), v = t.v;
  assert.strictEqual(v.kind, 'vendor'); assert.strictEqual(v.status, 'Done'); assert.strictEqual(v.metrics.ai_calls, 1, 'Claude only');
  deq(t.log.lookup, { item: 'LED wall', city: 'Cebu' }); assert.strictEqual(t.log.gpt.length, 1, 'only the chat call'); assert.ok(!t.log.gpt.some(g => g.tools));
  deq(v.vendor.cands.map(c => c.name), ['Sonic Pro', 'Brightwave', 'Glow Rentals', 'Lumen Co'], 'Preferred first even though Claude ranked Glow Rentals first');
  assert.strictEqual(v.vendor.cands[1].strengths, undefined, 'Claude did not rank it: no invented lines'); assert.strictEqual(v.vendor.cands[2].strengths, 'cheap');
  assert.ok(t.tabs.Chat.rows.some(x => /^4 suppliers for LED wall suppliers in Cebu\. Claude's pick: Sonic Pro \(Preferred\)/.test(x[2])));
  assert.ok(t.tabs['Vendor runs'] && t.tabs['Vendor runs'].rows.length === 2, 'Vendor runs logged');
});
test('V2 the pick is a Preferred supplier unless Claude gives a reason; with a reason it stands, and the reason is shown', () => {
  const a = vendorRun().v.vendor; assert.strictEqual(a.pick.k, 'K1'); assert.strictEqual(a.pick.switched, 'Glow Rentals');
  const b = vendorRun({ compare: Object.assign({}, VCOMPARE, { non_preferred_reason: 'Both Preferred suppliers are in Manila; Glow has a Cebu crew.' }) }).v.vendor;
  assert.strictEqual(b.pick.k, 'K3'); assert.ok(/Cebu crew/.test(b.pick.reason));
});
test('V3 thin DB: GPT searches the web (call 2), finds are New and not accredited, ranked after accredited DB suppliers, saved to Prospects; no guessed emails', () => {
  const lk = Object.assign({}, LOOKUP, { candidates: [LOOKUP.candidates[0]] });
  const t = vendorRun({ lookup: lk, compare: { summary: '', ranking: [{ key: 'K2', strengths: 's', risks: 'r' }, { key: 'K1', strengths: 's', risks: 'r' }], pick: { key: 'K1', why: 'history' }, non_preferred_reason: '' } });
  const v = t.v, rs = JSON.parse(t.log.gpt[1].input);
  assert.strictEqual(v.metrics.ai_calls, 2); assert.strictEqual(t.log.gpt[1].tools[0].type, 'web_search'); deq(rs.known_suppliers, ['Sonic Pro']); assert.strictEqual(rs.find.how_many, 2);
  deq(v.vendor.cands.map(c => [c.name, c.source, c.email, c.accredited]), [['Sonic Pro', 'db', 'sonicpro@example.test', true], ['Cebu Screens', 'new', 'hi@cebuscreens.example', false], ['Guessy', 'new', '', false]]);
  deq(v.vendor.cands[1].links, ['https://cebuscreens.example/led']); assert.strictEqual(v.vendor.cands[2].website, '', 'http sites dropped');
  assert.strictEqual(t.tabs.Prospects.rows.length, 3, 'two finds remembered');
  // A second search for the same item sees them and skips the web.
  const before = t.log.gpt.length; t.ctx.cueSend('Find LED wall suppliers in Cebu again', [], 'chat'); const id2 = t.tabs.Requests.rows.slice(-1)[0][0]; const v2 = t.ctx.cueRun(id2);
  assert.strictEqual(t.log.gpt.length - before, 1, 'only the chat call'); deq(v2.vendor.cands.filter(c => c.source === 'prospect').map(c => c.name), ['Guessy', 'Cebu Screens']);
});
test('V4 Kiko asks for new options: always searched; compare with an unknown name: GPT looks it up; Kiko\'s own picks are not pushed down', () => {
  const t = vendorRun({ v: { new_options: true } }); assert.strictEqual(JSON.parse(t.log.gpt[1].input).find.how_many, 3);
  const lk = Object.assign({}, LOOKUP, { stats: null, candidates: [dbSup('Sonic Pro', { offers: false, why: ['named by Kiko'], history: { quotes: 2, awarded: 1, projects: 2, latest: [] } })], not_found: [{ name: 'Nobody Inc', history: null }] });
  const u = vendorRun({ lookup: lk, v: { job: 'compare', item: '', suppliers: ['Sonic Pro', 'Nobody Inc'] },
    compare: { summary: 'Nobody Inc is unknown.', ranking: [{ key: 'K2', strengths: 'local', risks: 'no history' }, { key: 'K1', strengths: 'history', risks: '' }], pick: { key: 'K2', why: 'local' }, non_preferred_reason: '' } }, 'Compare Sonic Pro and Nobody Inc');
  const rs = JSON.parse(u.log.gpt[1].input); assert.strictEqual(rs.find, null); deq(rs.about, ['Nobody Inc']); deq(u.log.lookup, { city: 'Cebu', names: ['Sonic Pro', 'Nobody Inc'] });
  deq(u.v.vendor.cands.map(c => c.name), ['Nobody Inc', 'Sonic Pro'], 'compare keeps Claude\'s order (neither is Preferred)'); assert.ok(/small Cebu rental/.test(u.v.vendor.cands[0].about));
  deq(u.v.vendor.not_found, [], 'found on the web, so not listed as not found'); assert.strictEqual(u.v.vendor.pick.k, 'K2');
});
test('V5 Draft RFQs: GPT call 4 for the ticked suppliers only; edit, Approve and send; no email stays a draft; Canvas untouched', () => {
  const t = vendorRun(), bridge = t.log.bridge.length;
  assert.throws(() => t.ctx.cueVendorRfqs(t.id, []), /Tick at least one/);
  const v = t.ctx.cueVendorRfqs(t.id, ['K1', 'K2', 'K77']); const ask = JSON.parse(t.log.gpt.slice(-1)[0].input);
  deq(ask.suppliers.map(x => x.k), ['K1', 'K2']); assert.strictEqual(ask.details, '4m x 3m LED wall, 14 Nov, Cebu');
  assert.strictEqual(v.status, 'Needs you'); deq(v.vendor.rfqs.map(q => [q.k, q.to]), [['K1', 'sonicpro@example.test'], ['K2', '']]); assert.ok(!/[\r\n]/.test(v.vendor.rfqs[1].subject));
  const d = t.ctx.cueApprove(t.id, { skip: [], bodies: { K1: 'Edited by Kiko' }, send: true });
  assert.strictEqual(d.status, 'Done'); assert.strictEqual(t.log.gmail.length, 2); assert.ok(/RWRpdGVkIGJ5IEtpa28/.test(t.log.gmail[0]), 'edited text');
  deq(t.log.sent, ['draft-1'], 'only the one with an email is sent'); deq(d.vendor.rfqs.map(q => [q.sent, q.made]), [[true, true], [false, true]]);
  assert.strictEqual(t.log.bridge.length, bridge, 'no Canvas call after the lookup'); assert.strictEqual(d.metrics.ai_calls, 2);
  assert.ok(t.tabs.Chat.rows.some(x => /^Supplier search for LED wall suppliers in Cebu: 4 suppliers; Claude's pick Sonic Pro; sent 1 RFQ; 1 RFQ in your Gmail Drafts/.test(x[2])));
  assert.throws(() => t.ctx.cueVendorRfqs(t.id, ['K1']), /already made/);
});
test('V6 Close RFQs drops them and keeps the search; nothing drafted or sent', () => {
  const t = vendorRun(); t.ctx.cueVendorRfqs(t.id, ['K1']);
  const v = t.ctx.cueReject(t.id, ''); assert.strictEqual(v.status, 'Done'); deq(v.vendor.rfqs, []); assert.strictEqual(t.log.gmail.length, 0);
});
test('V7 a project\'s quotes: the name goes through Canvas\'s project match, then the lookup gets its ID', () => {
  const lk = Object.assign({}, LOOKUP, { candidates: [], project: { project_id: 'S-1001AB', quotes: [{ category: 'Lights', item: 'LED wall', supplier: 'Sonic Pro', in_db: true, amount: 50000, unit: null, awarded: false, quote: 'javascript:x' }] } });
  const t = vendorRun({ lookup: lk, similar: [{ project_id: 'S-1001AB', name: 'JBL Booth', date: '2026-11-14', status: 'For Client Awarding' }], v: { job: 'compare', item: '', city: '', project: 'JBL Booth' } }, 'Compare the quotes on JBL Booth');
  deq(t.log.lookup, { project_id: 'S-1001AB' }); assert.strictEqual(t.v.vendor.project.name, 'JBL Booth'); assert.strictEqual(t.v.vendor.project.quotes[0].quote, '');
  assert.strictEqual(t.v.status, 'Done'); assert.strictEqual(t.log.claude.length, 0, 'no candidates: nothing for Claude to compare');
});
test('V8 Canvas without supplier_lookup: the run stops with a plain reason; an empty ask is refused; small talk is untouched', () => {
  const t = vendorRun({ noLookup: true }); assert.strictEqual(t.v.status, 'Failed'); assert.ok(/next Canvas release/.test(t.v.error));
  const u = sandbox({ talk: VTALK({ item: '', suppliers: [], project: '' }) }); const r = u.ctx.cueSend('find me a supplier', [], 'chat');
  assert.ok(r.chat && !r.vendor, 'nothing to look up: stays a chat reply');
  const w = sandbox({ talk: VTALK({ job: '' }) }); assert.ok(w.ctx.cueSend('hi', [], 'chat').chat);
});
