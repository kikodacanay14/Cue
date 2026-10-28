// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: hubspot-cleanup.
test('C40 HubSpot clean-up: the ask starts its own thread with no chat call; Canvas scans; Claude checks the unsure ones in 1 call', () => {
  const t = hsToCard(), H = t.v.hs;
  assert.strictEqual(t.log.gpt.length, 0, 'recognised without a GPT call'); assert.strictEqual(t.log.claude.length, 1); assert.strictEqual(t.v.metrics.ai_calls, 1);
  deq(t.log.bridge.map(b => b.action), ['hubspot_scan']); assert.strictEqual(t.log.bridge[0].args.old_days, 365);
  assert.strictEqual(t.v.status, 'Needs you'); assert.strictEqual(t.v.kind, 'hubspot');
  const all = [].concat.apply([], H.groups.map(g => g.items)), it = k => all.filter(x => x.key === k)[0];
  assert.ok(!it('X9'), 'unknown groups dropped');
  assert.strictEqual(it('H2').tick, true, 'Claude said same'); assert.strictEqual(it('H2').keep, '2', 'the Canvas company is kept whatever Claude says');
  assert.strictEqual(it('H2').recs[1].url, '', 'only HubSpot links'); assert.strictEqual(it('H1').keep, '1'); assert.ok(!/ignored/.test(it('H1').claude), 'Claude cannot touch sure ones');
  assert.strictEqual(it('H3').value, 'Juan Dela Cruz'); assert.strictEqual(it('H3').tick, true);
  assert.ok(/cannot be undone/.test(it('H1').fix_text)); assert.strictEqual(H.summary, 'Mostly tidy. A few duplicates from the October import.');
  const claudeIn = t.log.claude[0].messages[0].content; assert.ok(/<records>/.test(claudeIn) && !/H4/.test(claudeIn), 'only the unsure groups and names go to Claude');
  assert.ok(t.tabs.Chat.rows.some(r => /Started a HubSpot clean-up/.test(r[2]) && r[3] === '>' + t.id));
});
test('C41 HubSpot approve: only ticked fixes go to Canvas, with Kiko\'s keep and edits; 50-change cap; log tab; Done when all fixed', () => {
  const t = hsToCard();
  const v = t.ctx.cueApprove(t.id, { tick: ['H1', 'H2', 'H3', 'H4', 'H6'], keep: { H2: '2', H1: '3' }, values: { H4: { domain: 'Delta.example' }, H3: { name: 'Juan D. Cruz' } } });
  const f = t.log.hsFix[0], by = k => f.filter(x => x.key === k)[0];
  deq(f.map(x => x.key), ['H1', 'H2', 'H3', 'H4'], 'H6 (48 owners) would pass 50 changes, so it waits');
  deq([by('H1').keep, by('H1').merge], ['3', ['1']], 'Kiko picked which to keep; Canvas re-checks it');
  assert.strictEqual(by('H3').to, 'Juan D. Cruz'); deq(by('H4').props, { domain: 'delta.example' });
  assert.strictEqual(v.status, 'Needs you', 'the rest wait'); assert.ok(v.notes.some(n => /over the 50-change limit/.test(n)));
  assert.strictEqual(t.tabs['HubSpot Cleanup'].rows.length, 5, 'header + 4 changes');
  const v2 = t.ctx.cueApprove(t.id, { tick: ['H6'] });
  deq(t.log.hsFix[1].map(x => x.key), ['H6']); assert.strictEqual(v2.status, 'Done'); assert.strictEqual(v2.hs.fixed, 5);
  assert.ok(t.tabs.Chat.rows.some(r => /Summary for HubSpot clean-up: 7 findings, 5 fixed/.test(r[2])));
});
test('C42 HubSpot: a refused fix shows on the card and keeps it open; empty values are not sent; Done for now closes; nothing ticked is refused', () => {
  const t = hsToCard({ hsFail: ['H4'] });
  assert.throws(() => t.ctx.cueApprove(t.id, { tick: [] }), /Tick at least one/);
  assert.strictEqual(t.state(t.id).status, 'Needs you', 'a refused approve leaves the card waiting');
  const v = t.ctx.cueApprove(t.id, { tick: ['H4', 'H5'] });
  deq(t.log.hsFix[0].map(x => x.key), ['H4'], 'H5 has no website typed, so it is not sent');
  const all = [].concat.apply([], v.hs.groups.map(g => g.items));
  assert.ok(/refused/.test(all.filter(x => x.key === 'H4')[0].result.error)); assert.ok(/Type the value/.test(all.filter(x => x.key === 'H5')[0].result.error));
  assert.strictEqual(v.status, 'Needs you');
  assert.strictEqual(t.ctx.cueHsClose(t.id).status, 'Done');
});
test('C43 HubSpot lookup: one ChatGPT web call on Kiko\'s tap; found websites are proposed unticked with an https source; once only', () => {
  const t = hsToCard({ lookup: { found: [{ key: 'H5', domain: 'https://www.acme-inc.example/about', industry: 'Retail', source: 'https://acme-inc.example/about' }, { key: 'H4', domain: 'evil.example', industry: '', source: '' }] } });
  const v = t.ctx.cueHsLookup(t.id), all = [].concat.apply([], v.hs.groups.map(g => g.items)), h5 = all.filter(x => x.key === 'H5')[0], h4 = all.filter(x => x.key === 'H4')[0];
  assert.strictEqual(t.log.gpt.length, 1); assert.ok(t.log.gpt[0].tools && t.log.gpt[0].tools[0].type === 'web_search');
  assert.strictEqual(h5.value, 'acme-inc.example'); assert.strictEqual(h5.tick, false); assert.strictEqual(h5.source, 'https://acme-inc.example/about');
  assert.strictEqual(h4.value, 'delta.example', 'only items flagged for lookup change'); assert.strictEqual(v.status, 'Needs you'); assert.strictEqual(v.metrics.ai_calls, 2);
  assert.throws(() => t.ctx.cueHsLookup(t.id), /already looked/);
});
test('C44 HubSpot: a clean scan needs no AI call; Claude failing leaves the unsure ones unticked; the Monday run happens once a day', () => {
  const clean = hsToCard({ hsScan: { scanned: { companies: 1, contacts: 1, deals: 0 }, items: [], lookups: [], notes: [] } });
  assert.strictEqual(clean.log.claude.length, 0); assert.strictEqual(clean.v.status, 'Needs you'); assert.ok(clean.tabs.Chat.rows.some(r => /looks clean/.test(r[2])));
  const t = hsToCard({ fail: { cost: () => resp(500, {}) } }), all = [].concat.apply([], t.v.hs.groups.map(g => g.items));
  assert.strictEqual(all.filter(x => x.key === 'H2')[0].tick, false); assert.ok(t.v.notes.some(n => /Claude could not check/.test(n)));
  const w = sandbox({ cost: HS_CHECK }); const a = w.ctx.cueHsWeekly(); assert.strictEqual(a.status, 'Needs you'); assert.strictEqual(a.hs.title, 'Monday HubSpot check');
  assert.strictEqual(w.ctx.cueHsWeekly(), null, 'second run the same day does nothing'); assert.ok(!w.log.weekly, 'no Monday trigger: the scheduler\'s row starts it'); assert.ok(!w.log.hsFix, 'the weekly run never fixes');
});
