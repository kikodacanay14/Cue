// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: LEAD-RETRY-2026-11-06 (Cue 1.28.35).
/* ---------- bid leads: waves, a busy answer is sent again, what still fails is recovered by the next bid check ---------- */
const lrRun = t => { const id = t.ctx.cueSend('run bid opportunity check', [], '').request_id; t.ctx.cueRun(id); return t.ctx.cueLoad_(id).s; };
const lrLeads = t => t.log.bridge.filter(b => b.action === 'crm_lead');
test('LR1 a busy Canvas answer is sent again with the same command_id, so every lead is added and no note is left', () => {
  const t = bidBox({ leadBusy: 2 }); const v = lrRun(t);
  deq([v.bids.leads.added, v.bids.leads.failed], [3, 0]);
  assert.ok(!v.bids.leads.open, 'nothing left open');
  assert.ok(!(v.notes || []).some(n => /Canvas CRM/.test(n)), JSON.stringify(v.notes));
  const c = lrLeads(t).map(b => b.command_id);
  assert.strictEqual(c.length, 5, '3 leads, 2 sent again'); assert.strictEqual(new Set(c).size, 3, 'a retry reuses its command_id');
  assert.strictEqual(Object.keys(t.log.crmDeals).length, 3, 'one deal per bid');
});
test('LR2 leads go at most 3 at a time, never all at once', () => {
  const t = bidBox(); const s = { id: 'cue-x', notes: [], bids: { items: [1, 2, 3, 4, 5, 6, 7].map(n => ({ key: 'c:1000' + n, project: 'P' + n, agency: 'A' })) } };
  const b0 = t.log.batches.length; t.ctx.cueBidsLeads_(s);
  const waves = t.log.batches.slice(b0).filter(w => w.length > 0);
  deq([s.bids.leads.added, s.bids.leads.failed, s.notes], [7, 0, []]);
  assert.ok(waves.every(w => w.length <= 3), JSON.stringify(waves.map(w => w.length)));
  assert.strictEqual(lrLeads(t).length, 7);
});
test('LR3 still busy after 3 tries: the lead stays open on the run, and the next bid check sends it as a recovery task with no second deal', () => {
  const t = bidBox({ leadBusy: 99 }); const v = lrRun(t);
  deq([v.bids.leads.added, v.bids.leads.failed], [0, 3]);
  assert.strictEqual(v.bids.leads.open.length, 3); assert.ok(/^bidlead-/.test(v.bids.leads.task));
  assert.ok((v.notes || []).some(n => /^Not added to Canvas CRM: .*Another save is in progress.*The next bid check sends it again\.$/.test(n)), JSON.stringify(v.notes));
  assert.strictEqual(lrLeads(t).length, 9, '3 leads x 3 tries');
  t.opts.leadBusy = 0; t.ctx.__wait(864e5);
  const w = lrRun(t);
  deq(t.log.recoveries, [{ task: v.bids.leads.task + '-recovery-1', recovers: v.bids.leads.task, n: 3 }], 'one recovery task that supersedes the old plan');
  assert.ok((w.notes || []).some(n => /^Added to Canvas CRM: 3 leads the \d{4}-\d{2}-\d{2} bid check could not save \(Canvas was busy\)\.$/.test(n)), JSON.stringify(w.notes));
  const old = t.ctx.cueLoad_(v.id).s.bids.leads;
  assert.ok(!old.open, 'nothing open now'); deq([old.recovered, old.tries, old.task], [3, 1, v.bids.leads.task + '-recovery-1']);
  assert.strictEqual(Object.keys(t.log.crmDeals).length, 3, 'no duplicate deals');
  t.ctx.__wait(864e5); lrRun(t);
  assert.strictEqual(t.log.recoveries.length, 1, 'a recovered run is not sent again');
});
test('LR4 a recovery that Canvas answers "nothing to recover" closes the open list; a run is recovered at most 3 times', () => {
  let t = bidBox({ leadBusy: 99 }); let v = lrRun(t);
  t.opts.nothingToRecover = true; t.ctx.__wait(864e5); lrRun(t);
  assert.ok(!t.ctx.cueLoad_(v.id).s.bids.leads.open, 'Canvas says every command completed');
  t = bidBox({ leadBusy: 999 }); v = lrRun(t);
  for (let d = 0; d < 5; d++) { t.ctx.__wait(864e5); lrRun(t); }
  const L = t.ctx.cueLoad_(v.id).s.bids.leads, rec = t.log.recoveries.filter(r => r.recovers.indexOf(v.bids.leads.task) === 0);
  deq([L.tries, rec.length, L.open.length], [3, 3, 3]);
  deq(rec.map(r => r.task), [v.bids.leads.task + '-recovery-1', v.bids.leads.task + '-recovery-1-recovery-1', v.bids.leads.task + '-recovery-1-recovery-1-recovery-1'], 'each recovery recovers the last claimed task');
});
test('LR5 once after 1.28.35 ships: the 5 Nov run that lost leads before the fix is recovered under its ledger task, every lead sent again', () => {
  const t = bidBox({ leadBusy: 99 }); const v = lrRun(t);
  t.ctx.cueLocked_(() => { const x = t.ctx.cueLoad_(v.id); x.s.id = 'cue-20261105063345-6770'; delete x.s.bids.leads.open; delete x.s.bids.leads.task;
    x.s.bids.leads = { added: 1, failed: 2 }; t.ctx.cueSave_(x.sh, x.row, x.s); });   // the old run, as 1.28.32 left it
  t.log.crmDeals = { ['bid:' + t.ctx.cueLoad_('cue-20261105063345-6770').s.bids.items[0].key.replace(/[^A-Za-z0-9:_-]/g, '')]: { id: 'D-1', created: '2026-10-01T08:00:00' } };   // the 1 lead that was added
  delete t.props.CUE_BIDS_LEAD_BACKLOG;   // the run above already passed the one-time step, before this old run was in the sheet
  t.opts.leadBusy = 0; t.ctx.__wait(864e5); const w = lrRun(t);
  assert.ok((w.notes || []).some(n => /^Added to Canvas CRM: 2 leads the /.test(n)), 'the lead already in the CRM is not counted: ' + JSON.stringify(w.notes));
  const r = t.log.recoveries.filter(x => x.recovers === 'bidlead-mw2q0m92');
  deq(r, [{ task: 'bidlead-mw2q0m92-recovery-1', recovers: 'bidlead-mw2q0m92', n: 3 }], 'all 3 leads of the old run, under the ledger task');
  assert.strictEqual(Object.keys(t.log.crmDeals).length, 3, 'the lead already in the CRM is not made twice');
  assert.strictEqual(t.props.CUE_BIDS_LEAD_BACKLOG, '1');
  const L = t.ctx.cueLoad_('cue-20261105063345-6770').s.bids.leads; assert.ok(!L.open); deq([L.recovered, L.checked], [2, 3]);
});
test('LR6 the hourly client email log uses the same waves: a busy Canvas answer is sent again, so the email is Logged, not Failed', () => {
  const t = sandbox({ waiting: WAIT, logBusy: 1 });
  const r = t.ctx.cueCrmLogRun_();
  deq([r.logged, r.failed, t.log.logCalls], [2, 0, 3]);
  deq(crmTabRows(t).map(x => x[7]), ['Logged', 'Logged']);
});
test('LR7 the first resume after 1.28.35 ships recovers every old run at once (Kiko 6 Nov 01:07Z), says so in each run\'s thread, and never again', () => {
  const t = bidBox({ leadBusy: 99, batchStep: 4000 }); const a = lrRun(t); t.ctx.__wait(864e5); const b = lrRun(t);   // a Canvas call takes seconds
  [[a.id, 'cue-20261105063345-6770'], [b.id, 'cue-20261106063350-36e7']].forEach(([from, to]) => t.ctx.cueLocked_(() => {
    const x = t.ctx.cueLoad_(from); x.s.id = to; x.s.ref = ''; x.s.bids.items = from === b.id ? a.bids.items.map(it => Object.assign({}, it, { key: it.key + '-6nov' })) : x.s.bids.items;   // the second day found 3 other notices
    x.s.bids.leads = { added: 0, failed: 3 }; t.ctx.cueSave_(x.sh, x.row, x.s); }));
  delete t.props.CUE_BIDS_LEAD_BACKLOG; t.opts.leadBusy = 0; t.log.recoveries = [];
  t.ctx.cueBidsLeadsBacklogNow_();
  deq(t.log.recoveries.map(r => r.recovers), ['bidlead-mw2q0m92', 'bidlead-mw453v1z'], 'both old runs, oldest first');
  deq(['cue-20261105063345-6770', 'cue-20261106063350-36e7'].map(id => { const L = t.ctx.cueLoad_(id).s.bids.leads; return [!L.open, L.recovered]; }), [[true, 3], [true, 3]]);
  assert.strictEqual(t.tabs.Chat.rows.filter(r => /^Added to Canvas CRM: 3 leads the /.test(r[2])).length, 2, 'one line in each run\'s thread');
  assert.strictEqual(Object.keys(t.log.crmDeals).length, 6, 'one deal per notice');
  t.ctx.cueBidsLeadsBacklogNow_(); assert.strictEqual(t.log.recoveries.length, 2, 'never again');
  delete t.props.CUE_BIDS_LEAD_BACKLOG; t.ctx.cueBidsLeadsBacklogNow_(); assert.strictEqual(t.log.recoveries.length, 2, 'a second trigger within 30 minutes sends nothing');
});
