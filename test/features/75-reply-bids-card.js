// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: Reply on chat bubbles and the New opportunities
// card under the 8 AM message (Kiko 1 Nov 2026: "a reply in the chat bubble function"; "New Opportunities / Bids need to be a card";
// "we can remove Decide Later"; mockup cue-8am-bids-card.png, "okay to build").
function k0BidRun(t, items) {
  const id = 'cue-20261021061500-b1d5', s = { id, version: 'test', kind: 'bids', created: new Date(t.ctx.cueNow_()).toISOString(), status: 'Needs you', stage: 'Done', text: 'Bid check', files: [], ref: '',
    metrics: { ai_calls: 0, calls: [] }, notes: [], bids: { title: 'Bid check', checks: [], sources: [], still: [], updated: [], items } };
  const sh = t.ctx.cueSheet_('Requests'); sh.appendRow([id]); t.ctx.cueSave_(sh, sh.getLastRow(), s); return id;
}
const K0_BIDS_ = [
  { key: 'c:PB-1188', group: 'scoped', source: 'PhilGEPS', project: 'Teachers\' Day Celebration 2026', agency: 'DepEd NCR', reference: 'PB-2026-1188', abc: 1850000, deadline: '2026-11-07T10:00+08:00',
    summary: 'Event management for 1,200 teachers', documents: [{ name: 'Invitation to Bid (PDF)', url: 'https://example.gov.ph/itb.pdf' }], opp: 'https://example.gov.ph/bid/1188' },
  { key: 'r:pag', group: 'clarify', source: 'PAGCOR site', project: 'Christmas Party for Employees', agency: 'PAGCOR', reference: 'PG-77', abc: 950000, deadline: '2026-11-12', ask: ['Venue', 'headcount'], documents: [] }];

test('RB1 8 AM: new bids are one line "N new bids, in the card below" and a card line right under the update; no numbers for bids', () => {
  const t = k0Box(); t.at('2026-10-21', 6, 30); const bid = k0BidRun(t, K0_BIDS_); t.at('2026-10-21', 8, 0);
  const o = t.ctx.cueK0Run_(false, 'am'), rows = t.tabs.Chat.rows, i = rows.findIndex(r => r[3] === '>' + o.request_id);
  assert.ok(/\nNew opportunities\n- 2 new bids, in the card below/.test(rows[i][2]), rows[i][2]);
  assert.ok(!/reply "start/.test(rows[i][2]) && !t.state(o.request_id).k0.items.some(x => x.t === 'bid'), 'bids are not numbered');
  assert.strictEqual(rows[i + 1][3], '%' + bid, 'the card line follows the update');
});

test('RB2 page: the New opportunities card has no subtitle and no Decide later; View opportunity, Ask the agency, Decline, Start intake', () => {
  const page = cuePage(), fn = page.match(/function k0BidsHtml\(r\) \{[\s\S]*?\n  \}\n/)[0];
  const box = { esc: x => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]), r: { id: 'cue-b', bids: { items: K0_BIDS_ } } };
  const h = vm.runInNewContext(fn + 'k0BidsHtml(r)', box);
  assert.ok(/<div class="k0bh">New opportunities<\/div><div class="k0b">/.test(h), 'header only, no subtitle');
  assert.ok(!/Decide later|bids-later/.test(h), 'no Decide later');
  assert.ok(/>Scoped</.test(h) && />For clarification</.test(h) && />PhilGEPS</.test(h), 'source and status labels');
  assert.ok(/Budget \(ABC\)[\s\S]*₱1,850,000\.00/.test(h) && /Closes<\/span><span>Sat, 7 Nov · 10:00 AM/.test(h) && /What it needs/.test(h) && /Missing<\/span><span>Venue, headcount/.test(h));
  assert.ok(/href="https:\/\/example\.gov\.ph\/itb\.pdf"[^>]*>Invitation to Bid \(PDF\)/.test(h), 'document links');
  const acts = a => ((a.match(/<div class="actions">[\s\S]*?<\/div>/g) || []).map(x => (x.match(/>(View opportunity|Ask the agency|Decline|Start intake)</g) || []).map(m => m.slice(1, -1))));
  deq(acts(h), [['View opportunity', 'Decline', 'Start intake'], ['Ask the agency', 'Decline', 'Start intake']]);
  assert.ok(/renderMain[\s\S]*charAt\(0\) === '%'[\s\S]*k0BidsHtml\(br\)/.test(page), 'the main chat draws "%" lines as the card');
});

test('RB3 Reply on the 8 AM bubble answers that update, any day, and Kiko\'s line keeps its quote in the main chat', () => {
  const t = k0Box(); t.at('2026-10-21', 13, 0); t.ctx.cueSweep(); t.at('2026-10-21', 14, 0);
  const o = t.ctx.cueK0Run_(false, 'pm'); t.at('2026-10-22', 9, 0);   // the next day: today's newest update is not this one
  assert.strictEqual(t.ctx.cueK0Said_('1', ''), null, 'without Reply, yesterday\'s update is not answered');
  t.ctx.cueSend('1', [], '', '', o.request_id);
  const rows = t.tabs.Chat.rows;
  assert.ok(rows.some(r => r[1] === 'Kiko' && r[3] === '↩' + o.request_id && r[2] === '1'), 'quoted line in the main chat');
  assert.ok(/Done: 1 chaser drafted/.test(rows.slice(-1)[0][2]) && rows.slice(-1)[0][3] === '', 'answer in the main chat');
});

test('RB4 Reply on another task\'s bubble puts the message in that thread and keeps the quoted line in the main chat; the page has the strip', () => {
  const t = k0Box(); t.at('2026-10-21', 13, 0); t.ctx.cueSweep(); const id = batchOf(t).id;
  t.ctx.cueSend('skip the second one please', [], '', '', id);
  const rows = t.tabs.Chat.rows;
  assert.ok(rows.some(r => r[1] === 'Kiko' && r[3] === '↩' + id), 'quote in the main chat');
  assert.ok(rows.some(r => r[1] === 'Kiko' && r[3] === id), 'the message went into the thread');
  const page = cuePage();
  assert.ok(/id="replybar"[\s\S]*Replying to[\s\S]*id="replyx"/.test(page) && /data-reply=/.test(page) && /touchstart/.test(page), 'reply strip, ↩ button, long press');
  assert.ok(/call\('cueSend', \[t, files, mode, ref, \(mine && mine\.reply\) \|\| ''\]/.test(page), 'the reply goes with the send');
});

test('RB5 new clients from the 8 AM update (Kiko 1 Nov: "B - until i decline or add"): "add" adds, "no" drops for good, the rest come back', () => {
  const t = cnBox(); t.ctx.cueCnTick_();
  const c = cnCard(t), o = JSON.parse(t.props['CUE_ASK_' + c.id]);
  const ana = 'ana.reyes@northwind.test', mark = o.emails.filter(e => /mark/.test(e))[0], joy = o.emails.filter(e => /joy/.test(e))[0];
  t.ctx.cueCnPick_(o, 'approve', '!' + c.id, 'skip:2,3', [mark]);   // add 1, no 3, nothing said about 2
  const st = e => cnRows(t).filter(r => r[0] === e)[0][1];
  assert.strictEqual(st(ana), 'Added'); assert.strictEqual(st(mark), 'New', 'not named: back on the list'); assert.strictEqual(st(joy), 'Not added', 'declined: gone');
  assert.strictEqual(bridgeCheck('contact_add', t.log.cnAdd[0]), ''); deq(t.log.cnAdd[0].people.map(p => p.email), [ana]);
  const t2 = cnBox(); t2.ctx.cueCnTick_(); const c2 = cnCard(t2), o2 = JSON.parse(t2.props['CUE_ASK_' + c2.id]);
  t2.ctx.cueCnPick_(o2, 'approve', '!' + c2.id, 'skip:1,2,3', o2.emails.slice(0, 2));   // only "no 3"
  assert.ok(!(t2.log.cnAdd || []).length, 'nothing written');
  deq(o2.emails.map(e => cnRows(t2).filter(r => r[0] === e)[0][1]), ['New', 'New', 'Skipped']);
});
