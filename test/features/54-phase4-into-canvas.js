// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: Cue structure phase 4 (Kiko 28 Oct 2026 07:42Z).
/* ---------- CUE-STRUCTURE-4.1 / 4.3 / 4.4 (specs/cue-structure-review.md) ---------- */
test('P4a 4.3 each new bid becomes one Canvas CRM lead (source Bid finder, request_id bid:<key>); updated bids do not; a refused batch is one note and the sheet rows stay', () => {
  let t = bidBox(); let v = t.ctx.cueRun(t.ctx.cueSend('run bid opportunity check', [], '').request_id);
  const L = t.log.crmLeads || [];
  deq(L.map(a => a.company), ['CITEM', 'DOT', 'NPDC'], 'the 3 new bids, not OLD-1 (updated)');
  assert.ok(L.every(a => a.source === 'Bid finder' && /^bid:[A-Za-z0-9:_-]+$/.test(a.request_id)), JSON.stringify(L));
  assert.strictEqual(L[0].name, 'Trade fair booth fabrication'); assert.ok(/Ref 2026-0999 · deadline 2026-10-29T17:00\+08:00 · ABC PHP 500000/.test(L[0].notes), L[0].notes);
  assert.ok(!('event_date' in L[0]), '"5 Nov 2026" is not a yyyy-mm-dd day, so it is left out');
  assert.ok(!(v.notes || []).some(n => /Canvas CRM/.test(n)), 'no note when all were added');
  t = bidBox({ leadFail: true }); v = t.ctx.cueRun(t.ctx.cueSend('run bid opportunity check', [], '').request_id);
  assert.strictEqual((v.notes || []).filter(n => /^Not added to Canvas CRM: /.test(n)).length, 1, JSON.stringify(v.notes));
  assert.strictEqual(t.tabs['Web bid findings'].rows.length, 5, 'the bid sheet rows are written as before'); assert.strictEqual(v.status, 'Needs you');
});
test('P4b 4.3 a cloud check run sends no lead', () => {
  const t = bidBox(); t.ctx.CUE_CHECK_ON_ = true;
  const s = { id: 'x', notes: [], bids: { items: [{ key: 'k1', project: 'P', agency: 'A' }] } }; t.ctx.cueBidsLeads_(s);
  assert.ok(!(t.log.crmLeads || []).length && !t.log.bridge.length); deq([s.bids.leads.added, s.bids.leads.failed], [0, 0]);
});
test('P4c 4.1 a chaser line in the project log says how many times this person has been chased', () => {
  const t = sandbox(); t.ctx.cueNow_ = () => Date.parse('2026-10-28T01:00:00Z');
  const q = []; t.ctx.cuePlogQ_ = l => q.push(l);
  t.ctx.cuePlogChaser_({ key: 'award:S-12345678AB', project_id: 'S-12345678AB', who: 'Ana Reyes', to: 'ana@acme.example', subject: 'Following up', times: 2 }, {});
  t.ctx.cuePlogChaser_({ key: 'award:S-12345678AC', project_id: 'S-12345678AC', who: 'Bo', subject: 'First nudge' }, {});
  deq(q.map(l => l.details), ['Ana Reyes · ana@acme.example · chase 3', 'Bo · chase 1']);
});
test('P4d 4.4 the transfer lookup reads Transfers and Payment Request through read_rows when Canvas allows them; account numbers never arrive', () => {
  const obj = g => g.slice(1).map((r, i) => { const o = { _row: i + 2 }; g[0].forEach((h, j) => { if (!/Account Number/.test(h)) o[h] = String(r[j]); }); return o; });
  const cols = g => g[0].filter(h => !/Account Number/.test(h));
  const allow = [{ book: 'scopes', tab: 'Transfers', key: 'Request ID', mode: 'read', columns: cols(TX_TR), writable: [], rows: obj(TX_TR) },
    { book: 'scopes', tab: 'Payment Request', key: 'Request ID', mode: 'read', columns: cols(TX_PR), writable: [], rows: obj(TX_PR) }];
  const t = txBox({ allow, bseFails: true });   // the direct sheet would throw, so the answer can only come from the bridge
  t.ctx.cueSend('i did pay cash is there a gcash transfer for that day with the same amount for Cups');
  deq(t.log.bridge.map(b => b.action), ['allow_list', 'read_rows', 'read_rows']);
  const a = lastCue(t);
  assert.ok(/^No GCash transfer of ₱1,200\.00 from 9 Oct to 15 Oct\. Cash stands\./.test(a), a);
  assert.ok(/AP-SU-TRI-1 · GCash SU••••E M\. · 12 Oct · 7046033873147 · ₱3,120\.00/.test(a), a);
  assert.ok(!/0917|000111222/.test(a), 'no account numbers');
});
