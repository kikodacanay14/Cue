// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: bid-opportunities.
/* ---------- Find and Screen Bid Opportunities (CueBids.gs, Kiko 19:04Z-19:10Z) ---------- */
const BID = (o) => Object.assign({ source: 'CITEM', agency: 'CITEM', reference: '2026-0999', project: 'Trade fair booth fabrication', location: 'World Trade Center, Pasay', abc: 500000, budget_note: '',
  deadline: '2026-10-29T17:00+08:00', event_date: '5 Nov 2026', scope: '9 sqm booth build and styling', eligibility: 'PhilGEPS, Mayor permit', url: 'https://citem.gov.ph/procurement/x.pdf',
  documents: [{ name: 'RFQ', url: 'https://citem.gov.ph/procurement/x.pdf', status: 'read' }, { name: 'Drawings', url: 'https://citem.gov.ph/d.zip', status: 'not opened' }],
  amendments: 'none seen', limitations: '', next_action: 'Check booth drawings', relevant: true }, o);
const SRC = names => names.map(n => ({ source: n, status: n === 'New PhilGEPS' ? 'Blocked' : 'Checked', checked: 'list page', gap: n === 'New PhilGEPS' ? 'needs sign-in' : '' }));
const BIDS_A = { sources: SRC(['New PhilGEPS', 'Other PhilGEPS', 'CITEM', 'TPB']), items: [BID(),
  BID({ reference: '2026-0412', project: 'General Assembly catering', abc: 120000 }),                        // below the ₱150k minimum
  BID({ reference: 'PG-1', agency: 'Pilar', project: 'Town fiesta stage', location: 'Pilar, Bataan', abc: 300000 }),   // Bataan
  BID({ reference: 'PG-2', agency: 'QC', project: 'Year-end party sound', location: 'Quezon City', abc: 650000, deadline: '2026-10-20T13:00+08:00' }),   // closed
  BID({ reference: 'PG-3', agency: 'DOT', project: 'Tourism forum production', location: '', abc: 0, budget_note: 'not stated' }),   // For verification
  BID({ source: 'Other PhilGEPS', project: 'Trade fair booth fabrication (copy)' }),                         // same reference: duplicate
  BID({ reference: 'GS-9', project: 'Expo booth', location: 'General Santos', abc: 400000 }),                 // outside the area
  BID({ reference: 'OLD-1', agency: 'TPB', project: 'Travel fair booth', location: 'Makati', abc: 600000, deadline: '2026-10-30T17:00+08:00' })] };   // earlier, deadline moved
const BIDS_B = { sources: SRC(['EU / EEAS', 'UNGM', 'ADB', 'GIZ']), items: [] };
const BIDS_C = { sources: SRC(['NPDC', 'PCC']), items: [BID({ source: 'NPDC', agency: 'NPDC', reference: 'NP-77', project: 'Christmas lights styling', location: 'Rizal Park, Manila', abc: 0, documents: [], limitations: '' })] };
function bidBox(o = {}, rows) {
  const t = sandbox(Object.assign({ gpt: { bids: [BIDS_A, BIDS_B, BIDS_C] } }, o));
  const f = sheetMock(); f.appendRow(['Reviewed on (PHT)']); (rows || [['2026-10-20', 'TPB', 'OLD-1', 'Travel fair booth', 'Open', 'Makati', 600000, 'PHP', '2026-10-27T17:00+08:00', '', '', '', 'https://tpb.gov.ph/x', '', '', '', '']]).forEach(r => f.appendRow(r));
  const l = sheetMock(); l.appendRow(['Check date (PHT)']);
  t.tabs['Web bid findings'] = f; t.tabs['Web source scan log'] = l;
  return t;
}
test('BD1 bid check: chat starts it with no chat call; 3 ChatGPT web calls; Kiko\'s screen, dedupe, only new on the card; sheet rows; Needs you', () => {
  const t = bidBox(); const r = t.ctx.cueSend('run bid opportunity check', [], '');
  assert.strictEqual(t.log.gpt.length, 0, 'plain words, no chat call'); const v = t.ctx.cueRun(r.request_id);
  assert.strictEqual(t.log.gpt.length, 3); assert.ok(t.log.gpt.every(b => b.tools && b.tools[0].type === 'web_search'), 'web search on');
  assert.ok(/New PhilGEPS: https:\/\/philgeps\.gov\.ph/.test(t.log.gpt[0].input) && /OLD-1/.test(t.log.gpt[0].input), 'sources and the earlier notice to recheck go to ChatGPT');
  assert.ok(/Never register, pay, submit/.test(t.log.gpt[0].instructions));
  assert.strictEqual(v.kind, 'bids'); assert.strictEqual(v.status, 'Needs you');
  deq(v.bids.items.map(x => x.reference), ['2026-0999', 'PG-3', 'NP-77'], 'below minimum, Bataan, closed, outside area and the duplicate are left out');
  assert.strictEqual(v.bids.items[0].status, 'Within cap and area'); assert.ok(/^For verification \(budget, location\)/.test(v.bids.items[1].status));
  deq(v.bids.updated.map(x => [x.reference, x.was]), [['OLD-1', '2026-10-27T17:00+08:00']], 'an earlier notice shows only as Updated');
  const ck = n => v.bids.checks.filter(c => c.id === n)[0];
  assert.strictEqual(ck(1).ok, false); assert.ok(/NCCA/.test(ck(1).detail), 'NCCA was not reported');
  assert.strictEqual(ck(7).ok, true, 'OLD-1 was rechecked'); assert.strictEqual(ck(8).ok, false); assert.ok(/NP-77/.test(ck(8).detail));
  assert.ok(/1 duplicates merged/.test(ck(6).detail)); assert.ok(/1 closed/.test(ck(5).detail)); assert.ok(/2 outside the area/.test(ck(4).detail));
  const f = t.tabs['Web bid findings'].rows; assert.strictEqual(f.length, 5, 'header + earlier + 3 new');
  assert.strictEqual(f[2][2], '2026-0999'); assert.strictEqual(f[2][16], '', 'Intake?? left for Kiko'); assert.strictEqual(f[1][8], '2026-10-30T17:00+08:00', 'deadline updated in place');
  assert.strictEqual(t.tabs['Web source scan log'].rows.length, 12, 'one row per source');
  deq(v.bids.sources.filter(x => x.source === 'NCCA').map(x => x.status), ['Not reported']);
  assert.ok(/3 new, 1 updated\. 9 of 11 sources fully checked, 2 partial or blocked\. Process check: 7 of 9 passed\./.test(v.bids.summary), v.bids.summary);
  assert.ok(t.tabs.Chat.rows.some(r => /Started a bid opportunity check/.test(r[2]) && r[3] === '>' + r[3].slice(1)));
  assert.ok(!t.log.bridge.length && !(t.log.gmail || []).length, 'no Canvas, no Gmail');
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
  assert.ok(/Reference: 2026-0999/.test(s.text) && /Approved budget \(ABC\): ₱500000/.test(s.text), 'the notice is the opener');
  assert.strictEqual(t.tabs['Web bid findings'].rows[2][16], 'Yes');
  assert.strictEqual(t.ctx.cueBidsClose(v.id).status, 'Done'); assert.throws(() => t.ctx.cueBidsClose(v.id), /waiting for you/);
});
test('BD5 daily 08:00 run happens once a Manila day and posts in its own thread', () => {
  const t = bidBox(); const a = t.ctx.cueBidsDaily(); assert.strictEqual(a.kind, 'bids'); assert.ok(/^Bid opportunities/.test(a.bids.title));
  assert.strictEqual(t.ctx.cueBidsDaily(), null); assert.ok(t.tabs.Chat.rows.some(r => /^7:00 bid check/.test(r[2])));
  assert.ok(!t.tabs.Chat.rows.some(r => r[1] === 'Kiko'), 'no fake Kiko line for the daily run');
});

test('BD6 page: the bid card shows new and updated notices, links only https, the process check and sources; no Pursue button', () => {
  const page = fs.readFileSync(path.join(__dirname, '..', 'src', 'Index.html'), 'utf8');
  const fn = page.match(/function bidsCardHtml\(r\) \{[\s\S]*?\n  \}\n/)[0];
  const t = bidBox(); const v = JSON.parse(JSON.stringify(t.ctx.cueRun(t.ctx.cueSend('run bid opportunity check', [], '').request_id)));
  v.bids.items[0].documents.push({ name: 'evil', url: 'javascript:alert(1)', status: 'read' });
  const box = { esc: x => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]), metricLine: () => 'M', r: v };
  const h = vm.runInNewContext(fn + 'bidsCardHtml(r)', box);
  assert.ok(/Trade fair booth fabrication/.test(h) && /Travel fair booth/.test(h) && /Updated \(1\)/.test(h) && /New \(3\)/.test(h));
  assert.ok(/Process check: 7 of 9 passed/.test(h) && /✗ All 11 sources reported/.test(h)); assert.ok(/data-act="bids-close"/.test(h) && !/Pursue/.test(h));
  assert.ok(!/href="javascript/.test(h), 'only https links'); assert.ok(/₱500,000/.test(h) && /For verification/.test(h) && /\(not opened\)/.test(h));
});

test('TC18 Kiko 19:20Z: the first named task names a thread; a later expense filed into it does not rename it', () => {
  const page = fs.readFileSync(path.join(__dirname, '..', 'src', 'Index.html'), 'utf8');
  const fn = page.match(/function threadTitle\(th\) \{[\s\S]*?\n  \}\n/)[0], box = { personalName: () => '', kindName: r => r.kind };
  vm.runInNewContext(fn + 'out = threadTitle({ reqs: [{ kind: "sweep", day: "2026-10-22" }, { kind: "intake", proposal: { client: { company: "AMI Group" } } }, { kind: "expense", expense: { project: { name: "AMI Group" } } }] });', box);
  deq(box.out, 'AMI Group');
});

test('BD7 PC test 19:23Z: a bid check never shows as an intake: its own name while working, its own stopped card with Try again, which runs it again', () => {
  const page = fs.readFileSync(path.join(__dirname, '..', 'src', 'Index.html'), 'utf8');
  const kn = page.match(/function kindName\(r\) \{[^\n]*\n/)[0], fn = page.match(/function bidsCardHtml\(r\) \{[\s\S]*?\n  \}\n/)[0];
  assert.strictEqual(vm.runInNewContext(kn + 'kindName({ kind: "bids" })', {}), 'Bid check');
  const f = bidBox({ fail: { bids: () => resp(500, {}) } }); const id = f.ctx.cueSend('check bids', [], '').request_id; const w = JSON.parse(JSON.stringify(f.ctx.cueRun(id)));
  assert.strictEqual(w.status, 'Failed'); assert.ok(w.bids, 'the page still gets the bid view');
  const esc = x => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const h = vm.runInNewContext(fn + 'bidsCardHtml(r)', { esc, metricLine: () => 'M', r: w });
  assert.ok(/Bid check stopped/.test(h) && /data-act="retry"/.test(h) && !/Project intake/.test(h) && !/data-act="reject"/.test(h));
  assert.ok(/if \(r\.kind === 'bids'\) return bidsCardHtml\(r\);/.test(page), 'cardHtml sends every bid check to its own card');
  f.opts.fail = {}; f.opts.gpt = { bids: [BIDS_A, BIDS_B, BIDS_C] };
  const again = f.ctx.cueRetry(id); assert.strictEqual(again.kind, 'bids'); assert.strictEqual(again.status, 'Needs you', 'Try again runs the bid check, not an intake');
});
