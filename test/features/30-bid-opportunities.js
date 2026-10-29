// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: bid-opportunities.
/* ---------- Find and Screen Bid Opportunities (CueBids.gs, Kiko 19:04Z-19:10Z) ---------- */
const BID = (o) => Object.assign({ source: 'CITEM', agency: 'CITEM', reference: '2026-0999', project: 'Trade fair booth fabrication', location: 'World Trade Center, Pasay', abc: 500000, budget_note: '',
  deadline: '2026-10-29T17:00+08:00', event_date: '5 Nov 2026', scope: '9 sqm booth build and styling', eligibility: 'PhilGEPS, Mayor permit', url: 'https://citem.gov.ph/procurement/x.pdf',
  documents: [{ name: 'RFQ', url: 'https://citem.gov.ph/procurement/x.pdf', status: 'read' }, { name: 'Drawings', url: 'https://citem.gov.ph/d.zip', status: 'not opened' }],
  amendments: 'none seen', limitations: '', next_action: 'Check booth drawings', relevant: true }, o);
const SRC = names => names.map(n => ({ source: n, status: n === 'New PhilGEPS' ? 'Blocked' : 'Checked', checked: 'list page', gap: n === 'New PhilGEPS' ? 'needs sign-in' : '' }));
const BIDS_A = { sources: SRC(['New PhilGEPS', 'Other PhilGEPS', 'CITEM', 'TPB']), items: [BID(),
  BID({ reference: '2026-0412', project: 'General Assembly catering', abc: 40000 }),                         // below the ₱50k minimum
  BID({ reference: 'PG-1', agency: 'Pilar', project: 'Town fiesta stage', location: 'Pilar, Bataan', abc: 300000 }),   // Bataan
  BID({ reference: 'PG-2', agency: 'QC', project: 'Year-end party sound', location: 'Quezon City', abc: 650000, deadline: '2026-10-20T13:00+08:00' }),   // closed
  BID({ reference: 'PG-3', agency: 'DOT', project: 'Tourism forum production', location: '', abc: 0, budget_note: 'not stated', documents: [{ name: 'TOR', url: 'https://dot.gov.ph/tor.pdf' }] }),   // For verification; its TOR needs sign-in
  BID({ reference: 'CITEM 2026-0999 (listing)', project: 'Multiple CITEM procurement notices shown on page' }),   // a listing page, not a notice (24 Oct card)
  BID({ source: 'New PhilGEPS', agency: 'PhilGEPS', reference: 'PS-PhilGEPS', project: 'PS-PhilGEPS Bulletin Board, login required' }),   // a sign-in page
  BID({ reference: 'NOA 2026-0300', project: 'Notice of Award: Gala dinner' }),   // an award
  BID({ source: 'Other PhilGEPS', project: 'Trade fair booth fabrication (copy)' }),                         // same reference: duplicate
  BID({ reference: 'GS-9', project: 'Expo booth', location: 'General Santos', abc: 400000 }),                 // outside the area
  BID({ reference: 'OLD-1', agency: 'TPB', project: 'Travel fair booth', location: 'Makati', abc: 600000, deadline: '2026-10-30T17:00+08:00' })] };   // earlier, deadline moved
const BIDS_B = { sources: SRC(['EU / EEAS', 'UNGM', 'ADB', 'GIZ']), items: [] };
const BIDS_C = { sources: SRC(['NPDC', 'City of Manila']), items: [BID({ source: 'NPDC', agency: 'NPDC', reference: 'NP-77', project: 'Christmas lights styling', location: 'Rizal Park, Manila', abc: 0, documents: [], limitations: '' })] };
// What ChatGPT reads in a saved PDF (1.27.10), and the agency sites: CITEM's RFQ is a PDF, its drawings are blocked, DOT's TOR asks for a sign-in.
const BID_DOCS = { abc: 480000, posted: '2026-10-18', deadline: '2026-10-29T17:00+08:00', event_date: '5 Nov 2026', summary: 'Build and style a 9 sqm booth; PhilGEPS Platinum',
  eligibility: 'PhilGEPS Platinum, Mayor permit', bac_email: 'bac@citem.example', pages: 'ABC p.2; deadline p.1', unread: [] };
const bidWeb = (log, o = {}) => req => {
  const u = req.url; if (!/(citem|dot|tpb|npdc)\.gov\.ph/.test(u)) return null;
  (log.web = log.web || []).push(u);
  const pg = Object.keys(o.pages || {}).filter(k => u === k)[0];
  if (pg) { (log.pages = log.pages || []).push(u); const t = o.pages[pg]; return { getResponseCode: () => 200, getContent: () => Array.from(Buffer.from(t)), getContentText: () => t }; }
  if ((o.pdf || []).some(x => u.indexOf(x) >= 0) || /x\.pdf$/.test(u)) { const b = Buffer.from('%PDF-1.7 fake bid ' + u); return { getResponseCode: () => 200, getContent: () => Array.from(b), getContentText: () => b.toString('utf8') }; }
  const page = (code, t) => { const b = Buffer.from(t); return { getResponseCode: () => code, getContent: () => Array.from(b), getContentText: () => t }; };
  if (/tor\.pdf$/.test(u)) return page(200, '<html><form>Log in to download</form><input type="password"></html>');
  return page(403, 'Forbidden');
};
function bidBox(o = {}, rows) {
  const box = {}, t = sandbox(Object.assign({ gpt: { bids: [BIDS_A, BIDS_B, BIDS_C], bid_docs: BID_DOCS, bid_question: { subject: 'Clarification: NP-77', body: 'Good day. May we ask the ABC?' } }, web: req => box.web(req) }, o));
  box.web = bidWeb(t.log, t.opts);
  const f = sheetMock(); f.appendRow(['Reviewed on (PHT)']); (rows || [['2026-10-20', 'TPB', 'OLD-1', 'Travel fair booth', 'Open', 'Makati', 600000, 'PHP', '2026-10-27T17:00+08:00', '', '', '', 'https://tpb.gov.ph/x', '', '', '', '']]).forEach(r => f.appendRow(r));
  const l = sheetMock(); l.appendRow(['Check date (PHT)']);
  t.tabs['Web bid findings'] = f; t.tabs['Web source scan log'] = l;
  return t;
}
test('BD1 bid check: chat starts it with no chat call; 3 ChatGPT web calls; Kiko\'s screen, single notices only, dedupe; Cue opens the documents; New and Still open; sheet rows; Needs you', () => {
  const t = bidBox(); const r = t.ctx.cueSend('run bid opportunity check', [], '');
  assert.strictEqual(t.log.gpt.length, 0, 'plain words, no chat call'); const v = t.ctx.cueRun(r.request_id);
  const search = t.log.gpt.filter(b => b.text.format.name === 'bids'), read = t.log.gpt.filter(b => b.text.format.name === 'bid_docs');
  assert.strictEqual(search.length, 3); assert.ok(search.every(b => b.tools && b.tools[0].type === 'web_search'), 'web search on');
  assert.ok(/New PhilGEPS: https:\/\/philgeps\.gov\.ph/.test(search[0].input) && /OLD-1/.test(search[0].input), 'sources and the earlier notice to recheck go to ChatGPT');
  assert.ok(/Never register, pay, submit/.test(search[0].instructions) && /Never send a listing page/.test(search[0].instructions));
  assert.strictEqual(read.length, 1, 'one reading call: only the CITEM notice had a PDF Cue could open'); assert.ok(!read[0].tools, 'reading has no web search');
  const file = read[0].input[0].content.filter(c => c.type === 'input_file'); assert.strictEqual(file.length, 1);
  assert.ok(Buffer.from(file[0].file_data.split(',')[1], 'base64').toString().indexOf('%PDF-1.7 fake bid https://citem.gov.ph/procurement/x.pdf') === 0, 'ChatGPT gets the file Cue fetched');
  assert.strictEqual(v.kind, 'bids'); assert.strictEqual(v.status, 'Needs you');
  deq(v.bids.items.map(x => x.reference), ['2026-0999', 'PG-3', 'NP-77'], 'below minimum, Bataan, closed, outside area, listing, sign-in, award and the duplicate are left out');
  const c = v.bids.items[0]; assert.strictEqual(c.status, 'Within cap and area'); assert.ok(/^For verification \(budget, location\)/.test(v.bids.items[1].status));
  deq([c.abc, c.posted, c.summary, c.pages, c.from_docs], [480000, '2026-10-18', 'Build and style a 9 sqm booth; PhilGEPS Platinum', 'ABC p.2; deadline p.1', true], 'values from the document');
  deq(c.documents.map(d => [d.name, d.state, d.why, d.read]), [['RFQ', 'saved', '', true], ['Drawings', 'failed', 'HTTP 403 (blocked or needs sign-in)', false]]);
  assert.ok(/^https:\/\/drive\.google\.com\/file\/d\/f\d+\/view$/.test(c.documents[0].drive), 'Cue\'s own copy');
  deq(v.bids.items[1].documents.map(d => [d.state, d.why]), [['failed', 'needs sign-in']]);
  deq(v.bids.still.map(x => [x.reference, x.tag]), [['OLD-1', 'Deadline moved to 2026-10-30T17:00+08:00 (was 2026-10-27T17:00+08:00)']], 'the earlier notice is Still open, with what changed');
  deq(v.bids.updated, [], 'no separate Updated list any more');
  const ck = n => v.bids.checks.filter(x => x.id === n)[0];
  assert.strictEqual(v.bids.checks.length, 10); assert.strictEqual(ck(1).ok, false); assert.ok(/PCC/.test(ck(1).detail), 'PCC was not reported');
  assert.ok(/3 listing, sign-in, award or incomplete items left out: Multiple CITEM procurement notices shown on page \(listing page\); PS-PhilGEPS Bulletin Board, login required \(sign-in page\); Notice of Award: Gala dinner \(award notice\)$/.test(ck(2).detail), ck(2).detail);
  assert.ok(!c.bac_email, 'bac@citem.example is not on the notice\'s domain (citem.gov.ph) and not .gov.ph, so To stays blank');
  assert.strictEqual(ck(7).ok, true, 'OLD-1 was rechecked'); assert.strictEqual(ck(8).ok, false); assert.ok(/NP-77/.test(ck(8).detail));
  assert.strictEqual(ck(10).ok, true); assert.ok(/^2 of 5 opened$/.test(ck(10).detail), ck(10).detail);
  assert.ok(/1 duplicates merged/.test(ck(6).detail)); assert.ok(/1 closed/.test(ck(5).detail)); assert.ok(/2 outside the area/.test(ck(4).detail));
  const f = t.tabs['Web bid findings'].rows; assert.strictEqual(f.length, 5, 'header + earlier + 3 new');
  assert.strictEqual(f[0][17], 'Bid start date (PHT)', 'new column R');
  assert.strictEqual(f[2][2], '2026-0999'); assert.strictEqual(f[2][16], '', 'Intake?? left for Kiko'); assert.strictEqual(f[2][17], '2026-10-18'); assert.strictEqual(f[2][6], 480000);
  assert.ok(/^RFQ \(Opened · saved · read\) https:\/\/citem\.gov\.ph\/procurement\/x\.pdf; Drawings \(Could not open: HTTP 403/.test(f[2][13]), f[2][13]);
  assert.strictEqual(f[1][8], '2026-10-30T17:00+08:00', 'deadline updated in place');
  assert.strictEqual(t.tabs['Web source scan log'].rows.length, 12, 'one row per source');
  const docs = t.tabs['Bid documents'].rows; deq(docs.slice(1).map(x => [x[0], x[3]]), [['https://citem.gov.ph/procurement/x.pdf', 'Opened · saved (pdf)'],
    ['https://citem.gov.ph/d.zip', 'Could not open: HTTP 403 (blocked or needs sign-in)'], ['https://dot.gov.ph/tor.pdf', 'Could not open: needs sign-in']], 'every document in the read-once record');
  assert.ok(docs[1][7] && JSON.parse(docs[1][8]).abc === 480000, 'read time and what was found are kept');
  deq(v.bids.sources.filter(x => x.source === 'PCC').map(x => x.status), ['Not reported']);
  assert.strictEqual(v.bids.title, 'Bid opportunities · 2026-10-21 · 1 scoped, 2 for clarification, 1 closing');
  assert.ok(/^1 scoped, 2 for clarification, 1 closing\. 11 sources checked, 2 partial or blocked\. 2 of 5 documents opened by Cue\. Process check: 8 of 10 passed\.$/.test(v.bids.summary), v.bids.summary);
  assert.ok(t.tabs.Chat.rows.some(r => /Started a bid opportunity check/.test(r[2]) && r[3] === '>' + r[3].slice(1)));
  deq(t.log.bridge.map(b => b.action), ['claim_plan', 'crm_lead', 'crm_lead', 'crm_lead'], 'only the 3 new bids go to Canvas CRM (CUE-STRUCTURE-4.3)');
  assert.ok(!(t.log.gmail || []).length, 'no Gmail');
});
test('BD13 read once (Kiko 24 Oct 06:52Z): the next day nothing already opened is fetched or read again; a new document link on a still open notice is', () => {
  const t = bidBox(); t.ctx.cueRun(t.ctx.cueSend('run bid opportunity check', [], '').request_id);
  const web = t.log.web.length, reads = t.log.gpt.filter(b => b.text.format.name === 'bid_docs').length;
  t.ctx.__wait(864e5); t.log.gptN = {};
  const v = t.ctx.cueRun(t.ctx.cueSend('run bid opportunity check', [], '').request_id);
  assert.strictEqual(t.log.web.length, web, 'no document fetched again'); assert.strictEqual(t.log.gpt.filter(b => b.text.format.name === 'bid_docs').length, reads, 'no document read again');
  deq(v.bids.items.map(x => x.reference), [], 'the same notices are not new again');
  deq(v.bids.still.map(x => x.reference).sort(), ['2026-0999', 'NP-77', 'OLD-1', 'PG-3'], 'they are Still open, from the sheet');
  const c = v.bids.still.filter(x => x.reference === '2026-0999')[0];
  deq([c.abc, c.posted, c.documents.map(d => d.state)], [480000, '2026-10-18', ['saved', 'failed']], 'stored values and document states');
  assert.strictEqual(t.tabs['Web bid findings'].rows.length, 5, 'no second row for a notice');
  const A2 = Object.assign({}, BIDS_A, { items: [BID({ amendments: 'Bulletin 1', documents: [{ name: 'RFQ', url: 'https://citem.gov.ph/procurement/x.pdf' }, { name: 'Bulletin 1', url: 'https://citem.gov.ph/b1.pdf' }] })] });
  t.ctx.__wait(864e5); t.opts.gpt.bids = [A2, BIDS_B, BIDS_C]; t.log.gptN = {}; t.log.web = [];
  const w = t.ctx.cueRun(t.ctx.cueSend('run bid opportunity check', [], '').request_id);
  deq(t.log.web, ['https://citem.gov.ph/b1.pdf'], 'only the new amendment is opened');
  deq(w.bids.still.filter(x => x.reference === '2026-0999').map(x => x.tag), ['Amended']);
});
test('BD14 one notice per item, one key per reference number; Still open = unanswered, open, real notices from the sheet, one per notice (spec bid-card-v2 rules 1-3)', () => {
  const t = sandbox(), J = x => t.ctx.cueBidsJunk_(Object.assign({ agency: 'CITEM', reference: '2026-0404', project: 'Booth', url: 'https://citem.gov.ph/n/1.pdf' }, x));
  deq([J({}), J({ project: 'Multiple TPB procurement notices shown on page' }), J({ project: 'PS-PhilGEPS Bulletin Board, login required' }), J({ reference: 'NOA 2026-0404' }),
    J({ project: 'RECHECK: Booth' }), J({ url: 'https://tpb.gov.ph/invitation-to-bid/' }), J({ reference: '' })],
    ['', 'listing page', 'sign-in page', 'award notice', 'recheck line', 'listing page', 'incomplete']);
  const K = (r, a, p) => vm.runInContext('cueBidsKey_', t.ctx)(r, a, p);
  assert.strictEqual(K('CITEM 2026-0404 (listing)'), K('2026-0404')); assert.strictEqual(K('ITB No. 2026.10.290'), K('2026-10-290')); assert.strictEqual(K('ITB 2026-041'), 'c:2026-041');
  assert.notStrictEqual(K('2026-0404'), K('2026-0405'));
  const M = (a, b) => t.ctx.cueBidsMatch_([{ key: 'c:2026-041', agency: a }], { key: 'c:2026-041', agency: b });
  assert.ok(M('CITEM', 'Center for International Trade Expositions and Missions (CITEM)') && M('Tourism Promotions Board', 'TPB') && M('', 'NPDC'), 'one agency, two names');
  assert.ok(!M('CITEM', 'Tourism Promotions Board'), 'one number at two agencies: two notices');
  const F = (url, em) => { const it = { url }; t.ctx.cueBidsFacts_(it, { bac_email: em }); return it.bac_email || ''; };
  deq([F('https://citem.gov.ph/n.pdf', 'bac@citem.gov.ph'), F('https://www.ungm.org/x', 'proc@ungm.org'), F('https://citem.gov.ph/n.pdf', 'agent@evil.example')], ['bac@citem.gov.ph', 'proc@ungm.org', ''], 'a document cannot aim the draft elsewhere'); assert.strictEqual(K('PG-1', 'X', 'Y'), 'r:pg1', 'no number: the old key');
  const row = (ref, project, o) => Object.assign(['2026-10-20', 'CITEM', ref, project, 'Open', 'Pasay', 300000, 'PHP', '2026-10-30T17:00+08:00', '', '', '', 'https://citem.gov.ph/n.pdf', '', '', '', ''], o || {});
  const b = bidBox({}, [row('2026-0404', 'Booth A'), row('CITEM 2026-0404 (listing)', 'Booth A listing'), row('2026-0500', 'Gala', { 16: 'No' }), row('2026-0501', 'Expo', { 8: '2026-10-01T17:00+08:00' }),
    row('2026-0502', 'Multiple CITEM procurement notices shown on page'), row('2026-0503', 'Fair', { 14: 'Updated: Cancelled' }), row('2026-0504', 'Old one', { 0: '2026-10-01', 8: '' }), row('2026-0505', 'New one', { 8: '' })]);
  deq(b.ctx.cueBidsOpenRows_({ notes: [] }).map(r => r.ref), ['2026-0404', '2026-0505'], 'one per notice; answered, closed, junk, cancelled and >14-day-old undated rows left out');
});
test('BD15 Request more details opens what Cue has not opened and ChatGPT reads it, never re-reading; still missing offers a Gmail draft to the agency, never sent', () => {
  const t = bidBox(); const v = t.ctx.cueRun(t.ctx.cueSend('run bid opportunity check', [], '').request_id), id = v.id;
  const reads = () => t.log.gpt.filter(b => b.text.format.name === 'bid_docs').length, r0 = reads();
  t.opts.pdf = ['tor.pdf'];   // DOT's TOR opens now (the sign-in page is gone)
  const w = t.ctx.cueBidsMore(id, 'r:pg3'), p = w.bids.items.filter(x => x.reference === 'PG-3')[0];
  deq(p.documents.map(d => [d.state, d.read]), [['saved', true]]); assert.strictEqual(reads(), r0 + 1, 'one call for the tap');
  assert.strictEqual(p.abc, 480000); deq(p.more.missing, []);
  assert.ok(t.tabs['Web bid findings'].rows.some(r => r[2] === 'PG-3' && r[6] === 480000 && r[17] === '2026-10-18'), 'the sheet row updates');
  const web = t.log.web.length; t.ctx.cueBidsMore(id, 'r:pg3');
  assert.strictEqual(t.log.web.length, web, 'an opened document is never fetched again'); assert.strictEqual(reads(), r0 + 1, 'nor read again');
  const c = t.ctx.cueBidsMore(id, 'c:2026-0999');
  assert.strictEqual(reads(), r0 + 1, 'the read RFQ is not read again; the blocked drawings are retried only');
  const n = t.ctx.cueBidsMore(id, 'r:np77').bids.items.filter(x => x.reference === 'NP-77')[0];
  deq(n.more.missing, ['budget', 'bid start date']); assert.strictEqual(reads(), r0 + 1, 'no document, no call');
  assert.ok(t.tabs.Chat.rows.some(r => /^More details for NP-77: no new document to open\. Still missing: budget, bid start date\. Tap Send email clarification/.test(r[2])));
  const a = t.ctx.cueBidsAskAgency(id, 'r:np77');
  assert.strictEqual(t.log.gmail.length, 1); assert.ok(/Subject: =\?UTF-8\?B\?/.test(t.log.gmail[0]) && !/^To:/m.test(t.log.gmail[0]), 'a draft, To blank with no BAC email');
  assert.ok(!(t.log.sent || []).length, 'never sent'); assert.ok(a.bids.items.filter(x => x.reference === 'NP-77')[0].more.draft);
  assert.throws(() => t.ctx.cueBidsAskAgency(id, 'r:np77'), /already in your Gmail Drafts/);
  assert.throws(() => t.ctx.cueBidsMore(id, 'nope'), /no longer on this card/);
  assert.ok(c.bids.items[0].documents[1].state === 'failed');
});
test('BD16 Start intake on a notice is "do intake for <reference>": an intake with the notice, Intake?? = Yes on its row', () => {
  const t = bidBox(); const v = t.ctx.cueRun(t.ctx.cueSend('run bid opportunity check', [], '').request_id);
  const out = t.ctx.cueBidsStartIntake(v.id, 'c:2026-0999'); assert.ok(out.request_id && out.request_id !== v.id);
  assert.ok(/do intake for 2026-0999/.test(t.state(out.request_id).text)); assert.strictEqual(t.tabs['Web bid findings'].rows[2][16], 'Yes');
  const o = t.ctx.cueBidsStartIntake(v.id, 'r:old1'); assert.ok(/Reference: OLD-1/.test(t.state(o.request_id).text), 'a Still open notice too');
});
test('BD17 PC check 24 Oct 07:28Z: Still open notices get their documents opened (once) and read; listing and award rows and award documents stay off the card', () => {
  const row = (ref, project, docs, o) => Object.assign(['2026-10-20', 'TPB', ref, project, 'Open', 'Pasay', 300000, 'PHP', '2026-10-30T17:00+08:00', '', '', '', 'https://tpb.gov.ph/n.pdf', docs || '', '', '', ''], o || {});
  const rows = [row('2026.10.290', 'Travel expo booth', 'RFQ (read) https://tpb.gov.ph/rfq-290.pdf; PR No. 2026.-0.030 TPB Website and Premises Award Posting (not opened) https://tpb.gov.ph/award.pdf'),
    row('ITB 2026-041', 'Gala dinner styling', 'Annex A https://tpb.gov.ph/annex-a.pdf, PBD https://tpb.gov.ph/PBD_Redacted.pdf'),
    row('BAC RESO 2026.09.030', 'MICE events (page shows \'BAC RESO pr no. 2026.09.030\' award/posting entries)'),
    row('CITEM-PO', 'Procurement / Opportunities (last-updated page)'), row('CITEM-ADV', 'CITEM procurement opportunities (page lists advisories)'),
    row('PCC-EV', 'Event Production / Event-related procurement entries listed on PCC procurement page'),
    row('2026-0777', 'Provision of Catering Services (list contains 2025 and 2026 catering RFP entries)')];
  const t = bidBox({ gpt: { bids: [{ sources: SRC(['New PhilGEPS']), items: [] }, { sources: [], items: [] }, { sources: [], items: [] }], bid_docs: BID_DOCS }, pdf: ['rfq-290.pdf', 'annex-a.pdf', 'PBD_Redacted.pdf'] }, rows);
  const v = t.ctx.cueRun(t.ctx.cueSend('run bid opportunity check', [], '').request_id);
  deq(v.bids.still.map(x => x.reference), ['2026.10.290', 'ITB 2026-041'], 'only the two real notices');
  deq(v.bids.still[0].documents.map(d => [d.name, d.state, d.read]), [['RFQ', 'saved', true]], 'the award posting is not a document of the notice; the RFQ is opened and read');
  deq(v.bids.still[1].documents.map(d => [d.name, d.state]), [['annex-a.pdf', 'saved'], ['PBD_Redacted.pdf', 'saved']], 'links in Kiko\'s own cells are documents too');
  assert.strictEqual(t.log.gpt.filter(b => b.text.format.name === 'bid_docs').length, 2, 'one reading call per notice');
  const f = t.tabs['Web bid findings'].rows; assert.strictEqual(f[1][17], '2026-10-18'); assert.strictEqual(f[1][6], 480000, 'the sheet row gets what the document says');
  assert.ok(/^RFQ \(Opened · saved · read\)/.test(f[1][13]), f[1][13]);
  const web = t.log.web.length, reads = t.log.gpt.filter(b => b.text.format.name === 'bid_docs').length; t.ctx.__wait(864e5); t.log.gptN = {};
  const w = t.ctx.cueRun(t.ctx.cueSend('run bid opportunity check', [], '').request_id);
  assert.strictEqual(t.log.web.length, web, 'next day: nothing fetched again'); assert.strictEqual(t.log.gpt.filter(b => b.text.format.name === 'bid_docs').length, reads, 'nothing read again');
  deq(w.bids.still[0].documents.map(d => d.state), ['saved']);
});
test('BD18 PC recheck 24 Oct 08:26Z: every document of every notice is attempted, across resumes when time runs out, each with a status; a site that never answers says so', () => {
  const row = (ref, docs) => ['2026-10-20', 'TPB', ref, 'Event ' + ref, 'Open', 'Pasay', 300000, 'PHP', '2026-11-20T17:00+08:00', '', '', '', 'https://tpb.gov.ph/n-' + ref + '.pdf', docs, '', '', ''];
  const rows = [];
  for (let n = 1; n <= 12; n++) rows.push(row('2026.11.' + (100 + n), [1, 2, 3, 4, 5].map(k => 'Annex ' + k + ' https://tpb.gov.ph/d' + n + '-' + k + '.pdf').join(', ')));
  rows.push(row('2026.11.200', 'TOR https://tpb.gov.ph/hang.pdf'));
  const t = bidBox({ gpt: { bids: [{ sources: SRC(['New PhilGEPS']), items: [] }, { sources: [], items: [] }, { sources: [], items: [] }], bid_docs: BID_DOCS }, pdf: ['tpb.gov.ph/d'], batchStep: 40000 }, rows);
  // A site that never answers: Apps Script ends the run while Cue waits, so the fetch never comes back.
  const open = t.ctx.cueBidsOpen_; t.ctx.cueBidsOpen_ = (it, docs, store) => docs.some(d => /hang\.pdf$/.test(d.url)) ? [] : open(it, docs, store);
  const id = t.ctx.cueSend('run bid opportunity check', [], '').request_id; let v = t.ctx.cueRun(id), passes = 1;
  assert.strictEqual(v.status, 'Working', 'time ran out: the check carries on at the next resume'); assert.strictEqual(v.stage, 'Reading');
  v = t.state(id); assert.ok(v.bids.reading.done > 0 && v.bids.reading.done < v.bids.reading.total, JSON.stringify(v.bids.reading));
  while (t.state(id).status === 'Working' && passes < 12) { t.ctx.__wait(6 * 60000); t.ctx.cueResume(); passes++; }
  v = t.state(id); assert.ok(passes > 2, 'took more than one resume: ' + passes); assert.strictEqual(v.status, 'Done', v.error);
  deq([v.bids.reading.done, v.bids.reading.total], [61, 61]);
  const docs = [].concat.apply([], v.bids.still.map(x => x.documents));
  assert.strictEqual(docs.length, 61, 'no cap: 12 notices x 5 documents, plus the TOR');
  assert.ok(docs.filter(d => !/hang/.test(d.url)).every(d => d.state === 'saved'), 'every document opened');
  const hung = docs.filter(d => /hang/.test(d.url))[0]; assert.strictEqual(hung.state, 'failed'); assert.ok(/no answer in time/.test(hung.why), hung.why);
  assert.strictEqual(t.log.web.length, 60, 'each link fetched once across all the resumes');
  const ck = v.bids.checks.filter(x => x.id === 10)[0]; assert.ok(ck.ok && /^60 of 61 opened$/.test(ck.detail), ck.detail);
  const f = t.tabs['Web bid findings'].rows; assert.ok(/\(Could not open: no answer in time/.test(f[13][13]), f[13][13]);
  t.ctx.__wait(864e5); t.log.gptN = {}; const web = t.log.web.length;
  const w = t.ctx.cueRun(t.ctx.cueSend('run bid opportunity check', [], '').request_id);
  assert.strictEqual(t.log.web.length, web, 'next day: nothing fetched again, the hung one included (Request more details retries it)');
  assert.strictEqual(w.status, 'Done');
});
test('BD19 read once (Kiko 08:44Z): a file sent to ChatGPT is never sent again on a later day, even when that read failed or ChatGPT skipped it', () => {
  const row = (ref, docs) => ['2026-10-20', 'TPB', ref, 'Event ' + ref, 'Open', 'Pasay', 300000, 'PHP', '2026-11-20T17:00+08:00', '', '', '', 'https://tpb.gov.ph/n-' + ref + '.pdf', docs, '', '', ''];
  const t = bidBox({ gpt: { bids: [{ sources: SRC(['New PhilGEPS']), items: [] }, { sources: [], items: [] }, { sources: [], items: [] }], bid_docs: BID_DOCS }, pdf: ['tpb.gov.ph/d'],
    fail: { bid_docs: () => resp(500, {}) } }, [row('2026.11.301', 'TOR https://tpb.gov.ph/d1.pdf')]);
  const reads = () => t.log.gpt.filter(b => b.text.format.name === 'bid_docs').length;
  const v = t.ctx.cueRun(t.ctx.cueSend('run bid opportunity check', [], '').request_id);
  assert.strictEqual(v.status, 'Done', v.error); deq(v.bids.still[0].documents.map(d => [d.state, d.read]), [['saved', false]], 'opened and saved; the reading call failed');
  const sent = t.tabs['Bid documents'].rows[1]; assert.ok(sent[9], 'the record says when the file went to ChatGPT');
  const web = t.log.web.length, n = reads();
  delete t.opts.fail;
  for (let day = 1; day <= 3; day++) {
    t.ctx.__wait(864e5); t.log.gptN = {};
    const w = t.ctx.cueRun(t.ctx.cueSend('run bid opportunity check', [], '').request_id);
    assert.strictEqual(w.status, 'Done', w.error);
    assert.strictEqual(t.log.web.length, web, 'day ' + day + ': the file is not fetched again');
    assert.strictEqual(reads(), n, 'day ' + day + ': the file is not sent to ChatGPT again');
  }
});
test('BD20 PC recheck 24 Oct 09:01Z: the sheet\'s own document cells are opened: a link after a note bracket is kept, a listing-page link or no link is followed to the file the page links, once', () => {
  const row = (ref, project, docs, url) => ['2026-10-20', 'TPB', ref, project, 'For verification (budget, location, deadline)', '', '', '', '', '', '', '', url || 'https://tpb.gov.ph/invitation-to-bid/', docs, '', '', ''];
  const rows = [
    row('TPB-ITB NO. 2026-040', 'Services of an Event Management Company for the Annual TPB Members’ Meeting', 'PBD_Redacted.pdf (Project Brief / Bidding Documents link shown on page) (not opened) https://tpb.gov.ph/wp-content/uploads/2026/10/PBD_Redacted.pdf'),
    row('RFQ# 2026.10.290', 'Supply and Delivery of Tangkulo Scarves and Table Decor', 'RFQ2026-10-290_compressed (Supply and Delivery of Tangkulo Scarves & Table Decor) (not opened) https://tpb.gov.ph/invitation-to-bid/'),
    row('RFQ# 2026.10.284', 'Design, Printing and Production of Sticker Pack for TPB', 'RFQ2026-10-284_compressed (not opened)'),
    row('RFQ No. 2026.10.291', 'Service Provider for International Air Tickets', '01 RFQ No. 2026.10.291 (Airtickets WTM 2026) and Annexes (not opened) https://tpb.gov.ph/invitation-to-bid/'),
    row('CITEM 2026-0404', 'Fabrication and installation services for the Likhang Filipino Gallery 4', 'CITEM 2026-0404 (list entry) — procurement details not opened (not opened)', 'https://citem.gov.ph/procurement/opportunities/last-updated'),
    row('RFQ# 2026.10.299', 'Event styling for a TPB roadshow', 'RFQ2026-10-299 (not opened) https://tpb.gov.ph/invitation-to-bid/')];
  const tpb = '<html><ul><li><a href="/wp-content/uploads/2026/10/PBD_ipd_Redacted.pdf">PBD ipd</a></li><li><a href="https://tpb.gov.ph/wp-content/uploads/2026/10/RFQ2026-10-290_compressed.pdf">RFQ 2026.10.290</a></li>'
    + '<li><a href="/wp-content/uploads/2026/10/RFQ2026-10-284_compressed.pdf">Sticker pack</a></li><li><a href="/wp-content/uploads/2026/10/RFQ-No.-2026-10-291.pdf">RFQ airtickets</a></li><li><a href="/invitation-to-bid/page/2/">Next</a></li></ul></html>';
  const citem = '<html><a href="/procurement/798e8a556a3a34b41607e966fbed86db.pdf">CITEM 2026-0404 Fabrication and Installation Services</a> <a href="/procurement/aa.pdf">CITEM 2026-0377 Conference bags</a></html>';
  const t = bidBox({ gpt: { bids: [{ sources: SRC(['New PhilGEPS']), items: [] }, { sources: [], items: [] }, { sources: [], items: [] }], bid_docs: BID_DOCS },
    pdf: ['tpb.gov.ph/wp-content/uploads/2026/10/', 'citem.gov.ph/procurement/798e8a'], pages: { 'https://tpb.gov.ph/invitation-to-bid/': tpb, 'https://citem.gov.ph/procurement/opportunities/last-updated': citem } }, rows);
  const v = t.ctx.cueRun(t.ctx.cueSend('run bid opportunity check', [], '').request_id);
  assert.strictEqual(v.status, 'Done', v.error);
  const by = {}; v.bids.still.forEach(x => { by[x.reference] = x.documents; });
  deq(by['TPB-ITB NO. 2026-040'].map(d => [d.name, d.state, d.url]), [['PBD_Redacted.pdf', 'saved', 'https://tpb.gov.ph/wp-content/uploads/2026/10/PBD_Redacted.pdf']], 'the link after the note bracket is kept and opened');
  deq(by['RFQ# 2026.10.290'].map(d => [d.state, d.url, d.page]), [['saved', 'https://tpb.gov.ph/wp-content/uploads/2026/10/RFQ2026-10-290_compressed.pdf', 'https://tpb.gov.ph/invitation-to-bid/']], 'found on the listing page by its file name');
  deq(by['RFQ# 2026.10.284'].map(d => [d.state, d.url]), [['saved', 'https://tpb.gov.ph/wp-content/uploads/2026/10/RFQ2026-10-284_compressed.pdf']], 'no link: the notice\'s page is searched');
  deq(by['RFQ No. 2026.10.291'].map(d => [d.state, d.url]), [['saved', 'https://tpb.gov.ph/wp-content/uploads/2026/10/RFQ-No.-2026-10-291.pdf']], 'by the reference number');
  deq(by['CITEM 2026-0404'].map(d => [d.state, d.url]), [['saved', 'https://citem.gov.ph/procurement/798e8a556a3a34b41607e966fbed86db.pdf']], 'by the reference in the link text');
  deq(by['RFQ# 2026.10.299'].map(d => [d.state, d.why, d.url, d.page]), [['failed', 'no file for it on the page (web page only)', '', 'https://tpb.gov.ph/invitation-to-bid/']], 'a status, never "not opened yet"');
  assert.ok(v.bids.still.every(x => x.documents.every(d => d.state === 'saved' || d.state === 'failed')), 'every document has a status');
  deq(t.log.pages, ['https://tpb.gov.ph/invitation-to-bid/', 'https://citem.gov.ph/procurement/opportunities/last-updated'], 'each page opened once in the run');
  const ck = v.bids.checks.filter(x => x.id === 10)[0]; assert.ok(ck.ok && /^5 of 6 opened$/.test(ck.detail), ck.detail);
  const f = t.tabs['Web bid findings'].rows; assert.ok(/^RFQ2026-10-290_compressed \(Opened · saved · read\) https:\/\/tpb\.gov\.ph\/wp-content\/uploads\/2026\/10\/RFQ2026-10-290_compressed\.pdf$/.test(f[2][13]), f[2][13]);
  assert.ok(/^RFQ2026-10-299 \(Could not open: no file for it on the page \(web page only\)\) https:\/\/tpb\.gov\.ph\/invitation-to-bid\/$/.test(f[6][13]), f[6][13]);
  const web = t.log.web.length, pages = t.log.pages.length, reads = t.log.gpt.filter(b => b.text.format.name === 'bid_docs').length;
  t.ctx.__wait(864e5); t.log.gptN = {};
  const w = t.ctx.cueRun(t.ctx.cueSend('run bid opportunity check', [], '').request_id);
  assert.strictEqual(w.status, 'Done', w.error);
  deq([t.log.web.length, t.log.pages.length, t.log.gpt.filter(b => b.text.format.name === 'bid_docs').length], [web, pages, reads], 'next day: no page, file or reading again');
  const by2 = {}; w.bids.still.forEach(x => { by2[x.reference] = x.documents.map(d => d.state); });
  deq(by2['RFQ# 2026.10.290'], ['saved']); deq(by2['RFQ# 2026.10.299'], ['failed']);
});
test('BD21 PC check 24 Oct 09:41Z: a Still open notice whose document shows a past deadline or a budget outside the range leaves the list, and its row keeps what the document said', () => {
  const row = (ref, docs) => ['2026-10-20', 'TPB', ref, 'Event ' + ref, 'For verification (budget, location, deadline)', '', '', '', '', '', '', '', 'https://tpb.gov.ph/invitation-to-bid/', docs, '', '', ''];
  const rows = [row('RFQ# 2026.10.284', 'RFQ (not opened) https://tpb.gov.ph/d284.pdf'), row('RFQ# 2026.10.292', 'RFQ (not opened) https://tpb.gov.ph/d292.pdf'), row('RFQ# 2026.10.295', 'RFQ (not opened) https://tpb.gov.ph/d295.pdf')];
  const doc = (abc, deadline) => Object.assign({}, BID_DOCS, { abc, deadline });
  const t = bidBox({ gpt: { bids: [{ sources: SRC(['New PhilGEPS']), items: [] }, { sources: [], items: [] }, { sources: [], items: [] }],
    bid_docs: [doc(300000, '2026-10-16T17:00+08:00'), doc(20000, '2026-10-30T17:00+08:00'), doc(300000, '2026-10-30T17:00+08:00')] }, pdf: ['tpb.gov.ph/d'] }, rows);
  const v = t.ctx.cueRun(t.ctx.cueSend('run bid opportunity check', [], '').request_id);
  assert.strictEqual(v.status, 'Done', v.error);
  deq(v.bids.still.map(x => x.reference), ['RFQ# 2026.10.295'], 'closed 16 Oct and ₱20,000 leave Still open');
  assert.ok(/1 closed notices left out/.test(v.bids.checks.filter(x => x.id === 5)[0].detail) && /1 outside the range left out/.test(v.bids.checks.filter(x => x.id === 3)[0].detail));
  const f = t.tabs['Web bid findings'].rows; deq([f[1][8], f[2][6]], ['2026-10-16T17:00+08:00', 20000], 'the rows keep the document\'s deadline and budget');
  t.ctx.__wait(864e5); t.log.gptN = {};
  const w = t.ctx.cueRun(t.ctx.cueSend('run bid opportunity check', [], '').request_id);
  deq(w.bids.still.map(x => x.reference), ['RFQ# 2026.10.295'], 'next day too');
});
test('BD23 contacts (Kiko 24 Oct 13:36Z): the document read gives the BAC contacts; the card shows them, an outside email is left out, and Start intake hands them to intake as client contacts', () => {
  const people = [{ name: 'Ana Cruz', role: 'BAC Secretariat', email: 'bac@citem.gov.ph', phone: '(02) 0000 0000' }, { name: 'Ben Reyes', role: 'Procurement', email: 'ben.reyes@gmail.com', phone: '' },
    { name: '', role: '', email: '', phone: '' }];
  const t = bidBox({ gpt: { bids: [BIDS_A, BIDS_B, BIDS_C], bid_docs: Object.assign({}, BID_DOCS, { contacts: people }) } });
  const v = t.ctx.cueRun(t.ctx.cueSend('run bid opportunity check', [], '').request_id), c = v.bids.items[0];
  deq(c.contacts, [{ name: 'Ana Cruz', role: 'BAC Secretariat', email: 'bac@citem.gov.ph', phone: '(02) 0000 0000' }, { name: 'Ben Reyes', role: 'Procurement', email: '', phone: '' }], 'gmail address dropped; blank row dropped');
  assert.ok(/contacts: up to 3 BAC/.test(t.log.gpt.filter(b => b.text.format.name === 'bid_docs')[0].instructions), 'the same reading call asks for them');
  assert.strictEqual(t.log.gpt.filter(b => b.text.format.name === 'bid_docs').length, 1, 'no extra AI call');
  const out = t.ctx.cueBidsStartIntake(v.id, c.key), s = t.state(out.request_id);
  assert.ok(/Client: CITEM/.test(s.text) && /Client contact: Ana Cruz, BAC Secretariat, bac@citem\.gov\.ph, \(02\) 0000 0000/.test(s.text) && /Client contact: Ben Reyes, Procurement$/m.test(s.text), s.text);
  // Read before 1.27.21: only the BAC email was kept; it still shows as a contact.
  const old = {}; t.ctx.cueBidsFacts_(Object.assign(old, { url: 'https://citem.gov.ph/n' }), { bac_email: 'bac@citem.gov.ph' });
  deq(old.contacts, [{ name: '', role: 'BAC', email: 'bac@citem.gov.ph', phone: '' }]);
});
test('BD24 PC check 25 Oct 01:51Z: a reading with several BAC addresses in one string shows each as a contact, and Start intake on a bid never reopens another project\'s thread by a shared year', () => {
  const t = bidBox({ gpt: { bids: [BIDS_A, BIDS_B, BIDS_C], bid_docs: Object.assign({}, BID_DOCS, { bac_email: 'bac@citem.gov.ph; sec@citem.gov.ph', contacts: [] }) } });
  // The stored TPB 291 reading, as it is in the Bid documents tab.
  const it = { url: 'https://tpb.gov.ph/invitation-to-bid/' }; t.ctx.cueBidsFacts_(it, { bac_email: 'geril_andres@tpb.gov.ph; bac_sec@tpb.gov.ph' });
  assert.strictEqual(it.bac_email, 'geril_andres@tpb.gov.ph');
  deq(it.contacts, [{ name: '', role: 'BAC', email: 'geril_andres@tpb.gov.ph', phone: '' }, { name: '', role: 'BAC', email: 'bac_sec@tpb.gov.ph', phone: '' }]);
  const it2 = { url: 'https://tpb.gov.ph/n' }; t.ctx.cueBidsFacts_(it2, { bac_email: 'mailto:a@tpb.gov.ph, agent@evil.example, a@tpb.gov.ph.' });
  deq([it2.bac_email, (it2.contacts || []).map(c => c.email)], ['a@tpb.gov.ph', ['a@tpb.gov.ph']], 'outside address dropped, one address once');
  // A rejected intake from this week named "AMI Group, UNILEVER YEAR END PARTY 2026" (the thread the TPB intake landed in).
  const u = { id: 'cue-20261022132639-b1f0', kind: 'intake', created: new Date(t.ctx.cueNow_() - 864e5).toISOString(), text: 'send this CE to Sir Rommel', status: 'Rejected', stage: 'Rejected', ref: '',
    files: [], metrics: { ai_calls: 0, calls: [] }, notes: [], x: { client: { company: 'AMI Group' }, event: { name: 'UNILEVER YEAR END PARTY 2026' } } };
  t.ctx.cueLocked_(() => { const sh = t.ctx.cueSheet_('Requests'); sh.appendRow([u.id]); t.ctx.cueSave_(sh, sh.getLastRow(), u); });
  assert.strictEqual(t.ctx.cueRelated_('Year-end party 2026 for Unilever', '', ''), u.id, 'a name word still reopens');
  assert.strictEqual(t.ctx.cueRelated_('Delegates WTM 2026, bid start 2026-10-21', '', ''), '', 'a year alone never does');
  const v = t.ctx.cueRun(t.ctx.cueSend('run bid opportunity check', [], '').request_id), c = v.bids.items[0];
  deq(c.contacts.map(x => x.email), ['bac@citem.gov.ph', 'sec@citem.gov.ph']);
  // A card made before the contacts fix has no contacts on its notices: Start intake takes them from the stored reading.
  t.ctx.cueLocked_(() => { const L = t.ctx.cueLoad_(v.id); delete L.s.bids.items[0].contacts; delete L.s.bids.items[0].bac_email; t.ctx.cueSave_(L.sh, L.row, L.s); });
  const gpt0 = t.log.gpt.length, out = t.ctx.cueBidsStartIntake(v.id, c.key), s = t.state(out.request_id);
  assert.strictEqual(t.log.gpt.length, gpt0, 'no new read');
  // Phase 1's read named the nameless BAC contact "BAC" with role "BAC": the card showed "BAC, BAC, email".
  const k = t.ctx.cueClient_({ company: 'TPB', contact: 'BAC', email: '', contacts: [{ name: 'BAC', role: 'BAC', email: 'geril_andres@tpb.gov.ph' },
    { name: 'BAC', role: 'BAC', email: 'bac_sec@tpb.gov.ph' }, { name: 'Ana Cruz', role: 'BAC', email: 'ana@tpb.gov.ph' }] });
  deq(k.contacts.map(x => [x.name, x.role, x.email].filter(Boolean).join(', ')), ['BAC, geril_andres@tpb.gov.ph', 'BAC, bac_sec@tpb.gov.ph', 'Ana Cruz, BAC, ana@tpb.gov.ph']);
  assert.strictEqual(k.contact, '', 'no bare "BAC" line or main contact'); assert.strictEqual(k.email, 'geril_andres@tpb.gov.ph');
  assert.ok(!s.ref && !s.ref_by, 'its own thread: ' + s.ref);
  // A bid intake an earlier build filed into another thread by name shows in its own thread, so it no longer renames that thread.
  deq([t.ctx.cueView_({ id: 'x', ref: u.id, ref_by: 'name', text: 'New project intake from a bid notice (Kiko asked: "do intake for RFQ No. 2026.10.291").' }).ref,
    t.ctx.cueView_({ id: 'y', ref: u.id, ref_by: 'name', text: 'add the LED wall to Unilever' }).ref], ['', u.id]);
  assert.ok(!t.tabs.Chat.rows.some(r => /reopened its thread/.test(r[2])));
  assert.ok(/Client contact: BAC, sec@citem\.gov\.ph/.test(s.text), s.text);
  assert.strictEqual(t.state(u.id).status, 'Rejected', 'the Unilever thread is untouched');
  // Phase 1's read writes contacts its own way ("BAC, BAC (bid contact), …"); a bid intake shows the notice's own list instead.
  t.opts.read = Object.assign({}, READ, { client: { company: 'CITEM', contact: 'BAC', email: '', phone: '', contacts: [{ name: 'BAC', role: 'BAC (bid contact)', email: 'bac@citem.gov.ph', phone: '' }] } });
  t.ctx.cueRun(out.request_id); const r = t.state(out.request_id);
  deq(r.x.client.contacts, [{ name: '', role: 'BAC', email: 'bac@citem.gov.ph', phone: '' }, { name: '', role: 'BAC', email: 'sec@citem.gov.ph', phone: '' }]);
  assert.strictEqual(r.x.client.company, 'CITEM'); assert.ok(r.status === 'Needs you' && !r.ref, JSON.stringify([r.status, r.stage, r.phase, r.error]));
});
test('BD2 bid words: asks route to the check; an intake ask or plain words do not', () => {
  const t = sandbox();
  ['any new bids today?', 'check philgeps', 'Find bid opportunities', 'look for tenders'].forEach(x => assert.ok(t.ctx.cueBidsAsked_(x), x));
  ['do intake for 2026-0999', 'LED wall for AMI Group', 'can you clean up hubspot?', 'new RFP from Acme'].forEach(x => assert.ok(!t.ctx.cueBidsAsked_(x), x));
});
test('BD10 a question about the PhilGEPS sign-in or a "did not ask" complaint never starts a bid check, in the main chat or a Bid check thread (/dev 22 Oct 05:27Z)', () => {
  const t = sandbox();
  const sh = t.tabs.Requests, put = s => { sh.appendRow([s.id]); t.ctx.cueSave_(sh, sh.getLastRow(), s); };
  put({ id: 'cue-20261022131046-66cc', kind: 'bids', created: '2026-10-22T05:10:46.000Z', status: 'Needs you', bids: { title: 'Bid check 10/22 13:10', items: [] }, text: 'check bids' });
  const bids = () => sh.rows.filter(r => { try { return JSON.parse(r.slice(10).join('')).kind === 'bids'; } catch (e) { return false; } }).length;
  const n = bids();
  [['can i give my philgeps username and password so that opportunities can be accessed from the philgeps website', ''],
   ['can i give my username and password so that the philgeps site can be accessed properly', 'cue-20261022131046-66cc'],
   ['i did not ask this chat to run the bid opportunities again', 'cue-20261022131046-66cc'],
   ['i did not ask this chat to run the bid opportunities again', '']].forEach(([x, ref]) => {
    assert.ok(!t.ctx.cueBidsAsked_(x), x);
    try { t.ctx.cueSend(x, [], '', ref); } catch (e) { /* the chat call has no mock here; only the bid check count matters */ }
    assert.strictEqual(bids(), n, 'no new bid check for: ' + x);
  });
  assert.ok(t.ctx.cueBidsAsked_('refresh bid opportunities based on new rules') && t.ctx.cueBidsAsked_('check philgeps'));
});
test('BD11 one Bid check thread per day: a later run that day joins the first thread and leaves earlier cards as they are; the one-time tidy groups older runs (Kiko 22 Oct 05:52Z)', () => {
  const t = sandbox();
  const a = t.ctx.cueBidsStart_('check bids', 'chat').request_id;
  const L = t.ctx.cueLoad_(a); L.s.status = 'Needs you'; t.ctx.cueSave_(L.sh, L.row, L.s);
  const b = t.ctx.cueBidsStart_('check bids again', 'chat').request_id, c = t.ctx.cueBidsStart_('Daily bid opportunity check', 'daily').request_id;
  deq([t.ctx.cueLoad_(b).s.ref, t.ctx.cueLoad_(c).s.ref], [a, a], 'later runs live in the first run\'s thread');
  assert.strictEqual(t.ctx.cueLoad_(a).s.status, 'Needs you', 'an earlier card keeps its own notices (a later run lists only new ones)');
  assert.strictEqual(t.tabs.Chat.rows.filter(r => /Started a bid opportunity check in its own thread/.test(r[2])).length, 1, 'one new thread only');
  assert.ok(t.tabs.Chat.rows.some(r => r[3] === '>' + a && /^7:00 bid check: Running the bid check again in today's Bid check thread/.test(r[2])));
  const w = sandbox(), ws = w.tabs.Requests, put = s => { ws.appendRow([s.id]); w.ctx.cueSave_(ws, ws.getLastRow(), s); };
  [['cue-20261022131046-66cc', '05:10', 'Done'], ['cue-20261022131900-1919', '05:19', 'Needs you'], ['cue-20261022132725-ad32', '05:27', 'Done']].forEach(([id, hm, st]) =>
    put({ id, kind: 'bids', created: '2026-10-22T' + hm + ':00.000Z', status: st, ref: '', bids: { title: 'Bid check', day: '2026-10-22', items: [] }, text: 'x' }));
  put({ id: 'cue-20261021190000-aaaa', kind: 'bids', created: '2026-10-21T11:00:00.000Z', status: 'Needs you', ref: '', bids: { title: 'Bid check', day: '2026-10-21', items: [] }, text: 'x' });
  assert.strictEqual(w.ctx.cueBidsTidyAll_(), 1);
  const st = id => w.ctx.cueLoad_(id).s;
  deq(['cue-20261022131900-1919', 'cue-20261022132725-ad32'].map(id => st(id).ref), ['cue-20261022131046-66cc', 'cue-20261022131046-66cc']);
  deq(['cue-20261022131046-66cc', 'cue-20261022131900-1919', 'cue-20261022132725-ad32'].map(id => st(id).status), ['Done', 'Needs you', 'Done'], 'nothing closed or reopened');
  deq([st('cue-20261021190000-aaaa').status, st('cue-20261021190000-aaaa').ref], ['Needs you', ''], 'a day with one run is left alone');
  assert.ok(w.tabs.Chat.rows.some(r => r[3] === 'cue-20261022131046-66cc' && /3 bid checks in this one thread\. Nothing was closed or changed/.test(r[2])));
  assert.strictEqual(w.ctx.cueBidsTidyAll_(), 0, 'once only');
});
test('BD12 in a Bid check thread only an explicit redo runs again; questions and other replies are answered there (PC 22 Oct 05:58Z)', () => {
  ['redo bid check', 'refresh bid opportunities based on new rules', 'run it again', 'check again', 'Re-run the bid check'].forEach(x => assert.ok(t0.ctx.cueBidsRedo_(x), x));
  ['check the RFPs if they are still valid. see months when they were sent if not current month then those are probably done',
   'the inland transporation is invalid file says its March 2026', 'can you check bids again?', 'why are there so many bid checks',
   'i did not ask this chat to run the bid opportunities again', 'do intake for 2026-0404', 'thanks'].forEach(x => assert.ok(!t0.ctx.cueBidsRedo_(x), x));
  const t = sandbox();
  const sh = t.tabs.Requests, put = s => { sh.appendRow([s.id]); t.ctx.cueSave_(sh, sh.getLastRow(), s); };
  put({ id: 'cue-20261022131046-66cc', kind: 'bids', created: '2026-10-22T05:10:46.000Z', status: 'Needs you', bids: { title: 'Bid check 10/22 13:10', items: [] }, text: 'check bids' });
  const n = () => sh.rows.filter(r => { try { return JSON.parse(r.slice(10).join('')).kind === 'bids'; } catch (e) { return false; } }).length, was = n();
  try { t.ctx.cueSend('check the RFPs if they are still valid', [], '', 'cue-20261022131046-66cc'); } catch (e) { /* the chat answer has no mock here */ }
  assert.strictEqual(n(), was, 'a question in the thread starts no check');
  t.ctx.cueSend('redo bid check', [], '', 'cue-20261022131046-66cc');
  assert.strictEqual(n(), was + 1, 'an explicit redo does');
});
test('BD3 nothing new: Done with one line; every ChatGPT call failing stops the check; a missing sheet is a note', () => {
  const t = bidBox({ gpt: { bids: [{ sources: SRC(['New PhilGEPS']), items: [] }, { sources: [], items: [] }, { sources: [], items: [] }] } });
  const v = t.ctx.cueRun(t.ctx.cueSend('any new bids today?', [], '').request_id);
  assert.strictEqual(v.status, 'Done'); assert.ok(/^No new bid opportunities/.test(v.bids.summary));
  const f = bidBox({ fail: { bids: () => resp(500, {}) } }); const w = f.ctx.cueRun(f.ctx.cueSend('check bids', [], '').request_id);
  assert.strictEqual(w.status, 'Failed'); assert.ok(/ChatGPT could not run the search/.test(w.error));
  const n = sandbox({ gpt: { bids: [BIDS_A, BIDS_B, BIDS_C] } }); const x = n.ctx.cueRun(n.ctx.cueSend('check bids', [], '').request_id);
  assert.ok(x.notes.some(m => /Not saved to your bid sheet/.test(m))); assert.strictEqual(x.bids.items.length, 4, 'with no sheet, OLD-1 counts as new');
});
test('BD4 "do intake for <reference>": the notice becomes an intake and Intake?? = Yes; Done for now closes the list', () => {
  const t = bidBox(); const v = t.ctx.cueRun(t.ctx.cueSend('run bid opportunity check', [], '').request_id);
  const out = t.ctx.cueSend('do intake for CITEM 2026-0999', [], '');
  assert.ok(out.request_id && out.request_id !== v.id); const s = t.state(out.request_id);
  assert.ok(/Reference: 2026-0999/.test(s.text) && /Approved budget \(ABC\): ₱480000/.test(s.text) && /Bid start date: 2026-10-18/.test(s.text), 'the notice is the opener');
  assert.ok(/Document: RFQ https:\/\/citem\.gov\.ph\/procurement\/x\.pdf \(opened by Cue, copy https:\/\/drive\.google\.com\/file\/d\//.test(s.text), 'with Cue\'s copy of the document');
  assert.strictEqual(t.tabs['Web bid findings'].rows[2][16], 'Yes');
  assert.strictEqual(t.ctx.cueBidsClose(v.id).status, 'Done'); assert.throws(() => t.ctx.cueBidsClose(v.id), /waiting for you/);
});
test('BD5 daily 08:00 run happens once a Manila day and posts in its own thread', () => {
  const t = bidBox(); const a = t.ctx.cueBidsDaily(); assert.strictEqual(a.kind, 'bids'); assert.ok(/^Bid opportunities/.test(a.bids.title));
  assert.strictEqual(t.ctx.cueBidsDaily(), null); assert.ok(t.tabs.Chat.rows.some(r => /^7:00 bid check/.test(r[2])));
  assert.ok(!t.tabs.Chat.rows.some(r => r[1] === 'Kiko'), 'no fake Kiko line for the daily run');
});

test('BD6 page: the bid card has the new title, New and Still open, the 7 fields, each document\'s real state, the buttons on each notice; https links only; no Pursue button', () => {
  const page = cuePage();
  const fn = page.match(/function bidsCardHtml\(r\) \{[\s\S]*?\n  \}\n/)[0];
  const t = bidBox(); const v = JSON.parse(JSON.stringify(t.ctx.cueRun(t.ctx.cueSend('run bid opportunity check', [], '').request_id)));
  v.bids.items[0].documents.push({ name: 'evil', url: 'javascript:alert(1)', state: 'saved', drive: 'javascript:x' });
  const box = { esc: x => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]), metricLine: () => 'M', r: v };
  const h = vm.runInNewContext(fn + 'bidsCardHtml(r)', box);
  assert.ok(/Bid opportunities · 2026-10-21 · 1 scoped, 2 for clarification, 1 closing/.test(h) && /11 sources checked, 2 partial or blocked/.test(h));
  assert.ok(/New: Scoped projects \(1\)[\s\S]*New: For clarification \(2\)[\s\S]*Opportunities closing \(1\)/.test(h) && /Trade fair booth fabrication/.test(h) && /Travel fair booth/.test(h) && /Deadline moved to/.test(h));
  ['Organization:', 'Bid start date:', 'Bid end date:', 'Budget:', 'Summary of requirements:', 'Bid documents available:'].forEach(k => assert.ok(h.indexOf(k) >= 0, k));
  assert.ok(/Opened · saved · read/.test(h) && /Cue&#39;s copy/.test(h) && /Could not open: HTTP 403/.test(h) && /Could not open: needs sign-in/.test(h));
  assert.ok(/data-act="bids-ask"[^>]*data-f="r:np77"/.test(h) && /data-act="bids-intake"/.test(h) && /Official notice/.test(h));
  assert.ok(/process check 8 of 10 passed/.test(h) && /✗ All 11 sources reported/.test(h)); assert.ok(/data-act="bids-close"/.test(h) && !/Pursue/.test(h));
  assert.ok(!/href="javascript/.test(h), 'only https links'); assert.ok(/₱480,000/.test(h) && /For verification/.test(h));
  ['bids-more', 'bids-ask', 'bids-intake'].forEach(a => assert.ok(page.indexOf("act === '" + a + "'") >= 0, a + ' is wired'));
  assert.ok(/Contact:<\/span> <span class="muted">No contact in the documents/.test(h), 'read, no contact named');
  v.bids.items[1].contacts = [{ name: '<b>x</b>', role: 'BAC', email: 'bac@x.gov.ph', phone: '' }];
  const h2 = vm.runInNewContext(fn + 'bidsCardHtml(r)', box);
  assert.ok(/Contact:<\/span> &lt;b&gt;x&lt;\/b&gt;, BAC, bac@x\.gov\.ph/.test(h2));
});

test('TC18 Kiko 19:20Z: the first named task names a thread; a later expense filed into it does not rename it', () => {
  const page = cuePage();
  const fn = page.match(/function threadTitle\(th\) \{[\s\S]*?\n  \}\n/)[0], box = { personalName: () => '', kindName: r => r.kind };
  vm.runInNewContext(fn + 'out = threadTitle({ reqs: [{ kind: "sweep", day: "2026-10-22" }, { kind: "intake", proposal: { client: { company: "AMI Group" } } }, { kind: "expense", expense: { project: { name: "AMI Group" } } }] });', box);
  deq(box.out, 'AMI Group');
});

test('BD7 PC test 19:23Z: a bid check never shows as an intake: its own name while working, its own stopped card with Try again, which runs it again', () => {
  const page = cuePage();
  const kn = page.match(/function kindName\(r\) \{[^\n]*\n/)[0], fn = page.match(/function bidsCardHtml\(r\) \{[\s\S]*?\n  \}\n/)[0];
  assert.strictEqual(pageKindName({ kind: 'bids' }), 'Bid check');
  const f = bidBox({ fail: { bids: () => resp(500, {}) } }); const id = f.ctx.cueSend('check bids', [], '').request_id; const w = JSON.parse(JSON.stringify(f.ctx.cueRun(id)));
  assert.strictEqual(w.status, 'Failed'); assert.ok(w.bids, 'the page still gets the bid view');
  const esc = x => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const h = vm.runInNewContext(fn + 'bidsCardHtml(r)', { esc, metricLine: () => 'M', r: w });
  assert.ok(/Bid check stopped/.test(h) && /data-act="retry"/.test(h) && !/Project intake/.test(h) && !/data-act="reject"/.test(h));
  assert.ok(/if \(r\.kind === 'bids'\) return bidsCardHtml\(r\);/.test(page), 'cardHtml sends every bid check to its own card');
  f.opts.fail = {}; f.opts.gpt = { bids: [BIDS_A, BIDS_B, BIDS_C] };
  const again = f.ctx.cueRetry(id); assert.strictEqual(again.kind, 'bids'); assert.strictEqual(again.status, 'Needs you', 'Try again runs the bid check, not an intake');
});
