// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: Cue structure phase 4 (Kiko 28 Oct 2026 07:42Z).
/* ---------- CUE-STRUCTURE-4.1 / 4.3 / 4.4 (specs/cue-structure-review.md) ---------- */
test('P4a 4.3 each new bid becomes one Canvas CRM lead (source Bid finder, request_id bid:<key>); updated bids do not; a refused batch is one note and the sheet rows stay', () => {
  let t = bidBox(); let v = t.ctx.cueRun(t.ctx.cueSend('run bid opportunity check', [], '').request_id);
  const L = t.log.crmLeads || [];
  deq(L.map(a => a.company), ['CITEM', 'DOT', 'NPDC'], 'the 3 new bids, not OLD-1 (updated)');
  assert.ok(L.every(a => a.source === 'Bid finder' && /^bid:[A-Za-z0-9:_-]+$/.test(a.request_id)), JSON.stringify(L));
  assert.strictEqual(L[0].name, 'Trade fair booth fabrication'); assert.ok(/Ref 2026-0999 · deadline 2026-10-29T17:00\+08:00 · ABC PHP \d+/.test(L[0].notes), L[0].notes);
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
test('P4e 4.6 one AI cost view: Canvas AI Runs rows join Cue\'s months, priced by the same table, under "Canvas: <job>"; not listed or unreadable is a note', () => {
  const runs = [{ _row: 2, Time: '10/28/2026 09:15:00', Job: 'Doc check', Model: 'claude-sonnet-4-6', 'Input tokens': '1,000,000', 'Output tokens': '0', 'Cost (USD)': '3', Status: 'OK', Note: '' },
    { _row: 3, Time: '10/28/2026 09:20:00', Job: 'Doc check', Model: 'claude-sonnet-4-6', 'Input tokens': '0', 'Output tokens': '0', 'Cost (USD)': '', Status: 'Failed', Note: 'timeout' }];
  const allow = [{ book: 'ledger', tab: 'AI Runs', key: '', mode: 'read', columns: Object.keys(runs[0]).slice(1), writable: [], rows: runs }];
  let t = sandbox({ allow }); t.ctx.cueNow_ = () => Date.parse('2026-10-28T03:00:00Z');
  const P = t.ctx.cueUsagePrices_(), p = P.models['claude-sonnet-4-6'];
  let u = t.ctx.cueUsage(); const m = u.months.filter(x => x.month === '2026-10')[0];
  assert.ok(m, JSON.stringify(u.months.map(x => x.month)));
  const c = m.by_cmd.filter(x => x.name === 'Canvas: Doc check')[0];
  assert.ok(c && c.calls === 2, JSON.stringify(m.by_cmd)); if (p) assert.strictEqual(c.usd, Math.round(p[0] * 10000) / 10000, 'priced by Cue\'s table, not Canvas\'s cost column');
  assert.strictEqual(u.canvas.rows, 2); assert.strictEqual(u.canvas.note, '');
  t = sandbox({ allow: [] }); u = t.ctx.cueUsage(); assert.strictEqual(u.canvas.rows, 0); assert.ok(/not on Canvas's allow-list/.test(u.canvas.note));
  assert.strictEqual(t.ctx.cueUsageCmd_({}, 'cue-ed-abc', ''), 'Other (canvas edit)');
  assert.strictEqual(t.ctx.cueUsageMnl_('10/28/2026 09:15:00'), Date.parse('2026-10-28T01:15:00Z'), 'Manila time');
});
test('P4f 4.4 a GPT task reads the P0 funnel tab through read_rows once Canvas lists it; not listed, it opens the sheet as before', () => {
  const p0 = [{ _row: 5, Company: 'Acme', Priority: 'P0', Industry: 'Tech' }];
  let t = sandbox({ allow: [{ book: 'priority', tab: 'P0', key: '', mode: 'read', columns: ['Company', 'Priority', 'Industry'], writable: [], rows: p0 }] });
  t.ctx.SpreadsheetApp = Object.assign({}, t.ctx.SpreadsheetApp, { openById: () => { throw new Error('opened the sheet'); } });
  const T = t.ctx.cueGtTab_('p0', { id: 'gt-1' });
  deq(Array.from(T.head), ['Company', 'Priority', 'Industry']); deq(T.rows.map(r => [r._row, r.Company]), [[5, 'Acme']]);
  t = sandbox({ allow: [] }); t.ctx.SpreadsheetApp = Object.assign({}, t.ctx.SpreadsheetApp, { openById: () => { throw new Error('opened the sheet'); } });
  assert.throws(() => t.ctx.cueGtTab_('p0', { id: 'gt-2' }), /opened the sheet/);
});
