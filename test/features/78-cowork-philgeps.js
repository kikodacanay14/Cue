// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: the new PhilGEPS site read by Claude Cowork on
// KKD (Kiko 1 Nov 2026: "cant you use Clause Cowork. I wil leave it on ... if its not, let me know"; "cowork. yes").
function cwBox(rows) {
  const t = bidBox({ gpt: { bids: [{ sources: SRC(['New PhilGEPS']), items: [] }, { sources: [], items: [] }, { sources: [], items: [] }], bid_docs: BID_DOCS } });
  let T = PH('2026-10-21', 7, 0); t.at = (d, h, m) => { T = PH(d, h, m); }; t.ctx.cueNow_ = () => T;
  if (rows) { const c = sheetMock(); c.appendRow(['Date (PHT)', 'Agency', 'Reference', 'Title', 'Location', 'Budget (ABC)', 'Posted', 'Closes', 'Summary', 'Notice link', 'Documents', 'Notes']);
    rows.forEach(r => c.appendRow(r)); t.tabs['Cowork PhilGEPS findings'] = c; }
  return t;
}
test('CW1 Cowork\'s rows for today join the bid check as New PhilGEPS notices, through the same screen; other days and goods with no event are left out', () => {
  const day = '2026-10-21', t = cwBox([
    [day, 'CITY OF PASIG', '13400001', 'Events Management for the Pasig Christmas Celebration', 'Pasig City', '450,000.00', '2026-10-20', '2026-10-30T10:00+08:00', 'Stage, lights and sounds, hosts', 'https://philgeps.gov.ph/tenders/viewBidNotice/13400001', 'https://philgeps.gov.ph/doc/1.pdf', ''],
    [day, 'CITY OF PASIG', '13400002', 'Procurement of Office Supplies', 'Pasig City', '120,000.00', '2026-10-20', '2026-10-30T10:00+08:00', '', 'https://philgeps.gov.ph/tenders/viewBidNotice/13400002', '', ''],
    ['2026-10-20', 'CITY OF TAGUIG', '13400003', 'Lights and Sounds for the Fiesta', 'Taguig City', '300,000.00', '2026-10-19', '2026-10-29T10:00+08:00', '', 'https://philgeps.gov.ph/tenders/viewBidNotice/13400003', '', ''],
    [day, '', 'RUN', 'Checked 14 notices', '', '', '', '', '', '', '', '']]);
  t.at(day, 10, 30); const v = t.ctx.cueRun(t.ctx.cueBidsStart_('New PhilGEPS notices from Cowork', 'cowork').request_id);
  const refs = v.bids.items.map(x => x.reference);
  assert.ok(refs.indexOf('13400001') >= 0, 'the event notice is on the card: ' + refs); assert.ok(refs.indexOf('13400002') < 0, 'office supplies left out');
  assert.ok(refs.indexOf('13400003') < 0, 'yesterday\'s row is not read again');
  assert.strictEqual(v.bids.items.filter(x => x.reference === '13400001')[0].source, 'PhilGEPS Bulletin Board');
  deq(JSON.parse(JSON.stringify(t.state(v.id).bids.cowork)), { ran: true, n: 2 });
});
test('CW2 the 10:30 run (Kiko 1 Nov: "move the job at 10a"): no RUN row today means one main-chat line; new notices come as the card; no ChatGPT call; off stops it', () => {
  const t = cwBox(null); t.at('2026-10-21', 10, 30); const ai = t.log.gpt.length;
  const v = t.ctx.cueRun(t.ctx.cueBidsStart_('New PhilGEPS notices from Cowork', 'cowork').request_id);
  assert.strictEqual(t.log.gpt.length, ai, 'no ChatGPT search for the 10:30 run');
  assert.strictEqual(t.state(v.id).bids.cowork.ran, false);
  assert.ok(t.tabs.Chat.rows.some(r => r[3] === '' && /^New PhilGEPS was not checked today: Cowork on KKD did not run\./.test(r[2])), 'one line in the main chat');
  const t1 = cwBox([['2026-10-21', 'CITY OF PASIG', '13400001', 'Events Management for the Pasig Christmas Celebration', 'Pasig City', '450,000.00', '2026-10-20', '2026-10-30T10:00+08:00', '', 'https://philgeps.gov.ph/tenders/viewBidNotice/13400001', '', ''],
    ['2026-10-21', '', 'RUN', 'Checked 3 notices, kept 1', '', '', '', '', '', '', '', '']]); t1.at('2026-10-21', 10, 30);
  const v1 = t1.ctx.cueRun(t1.ctx.cueBidsStart_('New PhilGEPS notices from Cowork', 'cowork').request_id);
  assert.ok(t1.tabs.Chat.rows.some(r => r[3] === '%' + v1.id), 'the New opportunities card in the main chat');
  assert.ok(!t1.tabs.Chat.rows.some(r => /not checked today/.test(r[2])), 'no warning when Cowork ran');
  const t2 = cwBox(null); t2.props.CUE_COWORK_PHILGEPS = 'off'; t2.at('2026-10-21', 10, 30);
  const v2 = t2.ctx.cueRun(t2.ctx.cueBidsStart_('New PhilGEPS notices from Cowork', 'cowork').request_id); assert.ok(!t2.state(v2.id).bids.cowork, 'off: not checked, no warning');
  const page = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'CueMorning.gs'), 'utf8');
  assert.ok(!/opps\.push\('- New PhilGEPS was not checked/.test(page), 'the 8 AM update no longer warns (Cowork runs after it)');
});
test('CW3 Cowork\'s documents are Drive links (Kiko 1 Nov: "download all the files"): shown as saved by Cowork, never fetched by Cue', () => {
  const day = '2026-10-21', t = cwBox([[day, 'CITY OF PASIG', '13400001', 'Events Management for the Pasig Christmas Celebration', 'Pasig City', '450,000.00', '2026-10-20', '2026-10-30T10:00+08:00',
    'Stage, lights and sounds', 'https://philgeps.gov.ph/tenders/viewBidNotice/13400001', 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view, https://drive.google.com/file/d/1QrStUvWxYz012345/view', 'PhilGEPS Platinum'],
    [day, '', 'RUN', 'Checked 9 notices, kept 1', '', '', '', '', '', '', '', '']]);
  t.at(day, 10, 30); const web = () => (t.log.web || []).filter(u => /drive\.google\.com/.test(String(u.url || u))).length, w0 = web();
  const v = t.ctx.cueRun(t.ctx.cueBidsStart_('New PhilGEPS notices from Cowork', 'cowork').request_id), it = v.bids.items.filter(x => x.reference === '13400001')[0];
  assert.ok(it, 'on the card'); const DD = JSON.stringify(it.documents); deq(it.documents.map(d => [d.state, d.drive]), [['saved', 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view'], ['saved', 'https://drive.google.com/file/d/1QrStUvWxYz012345/view']], DD);
  assert.strictEqual(web(), w0, 'Cue does not fetch the Drive files');
  assert.ok(/Cowork notes: PhilGEPS Platinum/.test(it.limitations), 'Cowork\'s Notes reach the notice');
  assert.ok(t.tabs['Bid documents'].rows.some(r => r[3] === 'Opened · saved by Cowork'), 'recorded as saved by Cowork');
});

test('BP1 Cue opens CITEM, TPB, NPDC, PCC and City of Manila itself and gives their listing text, links kept, to the same 3 search calls (Kiko 1 Nov: "Yes, thats why we listed them down")', () => {
  const html = '<html><head><script>x()</script></head><body><h1>Invitation to Bid</h1><table><tr><td><a href="/files/itb-041.pdf">ITB 2026-041 Gala dinner styling</a></td><td>ABC 450,000</td></tr></table></body></html>';
  const t = bidBox({ livePages: true, web: req => /tpb\.gov\.ph\/invitation-to-bid\/?$/.test(req.url) ? resp(200, html) : /manila\.gov\.ph/.test(req.url) ? resp(503, '') : null });
  const ai = () => t.log.gpt.filter(b => b.text.format.name === 'bids').length;
  const v = t.ctx.cueRun(t.ctx.cueSend('run bid opportunity check', [], '').request_id);
  assert.strictEqual(ai(), 3, 'still 3 search calls, no extra AI call');
  const inputs = t.log.gpt.filter(b => b.text.format.name === 'bids').map(b => b.input).join('\n');
  const PI = inputs.slice(inputs.indexOf('<pages>'), inputs.indexOf('<pages>') + 900); assert.ok(/<page source="TPB" url="https:\/\/tpb\.gov\.ph\/invitation-to-bid\/">\nInvitation to Bid\s+ITB 2026-041 Gala dinner styling \[https:\/\/tpb\.gov\.ph\/files\/itb-041\.pdf\]/.test(inputs), PI);
  assert.ok(!/x\(\)/.test(inputs), 'scripts are left out');
  assert.ok(/<page source="City of Manila">Cue could not open it \(HTTP 503\)\. Use web search for this source\.<\/page>/.test(inputs));
  assert.ok(/7b\. When a <page> is given for a source, Cue opened that site itself/.test(t.log.gpt.filter(b => b.text.format.name === 'bids')[0].instructions));
  assert.ok(t.state(v.id).bids.pages.some(p => p.source === 'TPB' && p.read) && t.state(v.id).bids.pages.some(p => p.source === 'City of Manila' && !p.read && p.why === 'HTTP 503'));
});
