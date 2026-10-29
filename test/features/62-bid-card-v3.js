// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: bid card v3 (Kiko 29 Oct 2026 10:47Z-10:52Z).
/* ---------- Scoped projects, For clarification, Opportunities closing; source on each notice; Decline, Decide later, Approve and send ---------- */
const bidV3 = (rows) => { const t = bidBox({}, rows); const v = t.ctx.cueRun(t.ctx.cueSend('run bid opportunity check', [], '').request_id); return { t, v }; };
test('BV1 the card sorts new notices into Scoped (documents read, nothing missing) and For clarification, earlier ones into Closing, each with its source', () => {
  const { v } = bidV3();
  deq(v.bids.items.map(x => [x.reference, x.group, x.source]), [['2026-0999', 'scoped', 'CITEM'], ['PG-3', 'clarify', 'CITEM'], ['NP-77', 'clarify', 'NPDC']]);
  deq(v.bids.still.map(x => [x.reference, x.group, x.source, x.added]), [['OLD-1', 'closing', 'TPB', false]], 'source from the notice link when the sheet has none');
  deq(v.bids.items[2].ask, ['budget', 'bid start date', 'bid documents (terms of reference and specifications)'], 'no documents read: the documents are asked for too');
  assert.strictEqual(v.bids.title, 'Bid opportunities · 2026-10-21 · 1 scoped, 2 for clarification, 1 closing');
});
test('BV2 Decline writes No in Intake?? and the notice never comes back; Decide later leaves it blank so tomorrow rechecks it; Closing has no Decide later', () => {
  const { t, v } = bidV3();
  const d = t.ctx.cueBidsDecide(v.id, 'r:pg3', 'declined');
  assert.strictEqual(d.bids.items.filter(x => x.reference === 'PG-3')[0].decision, 'declined');
  const rows = t.tabs['Web bid findings'].rows; assert.ok(rows.some(r => r[2] === 'PG-3' && r[16] === 'No'), 'No in the sheet');
  t.ctx.cueBidsDecide(v.id, 'r:np77', 'later');
  assert.ok(rows.some(r => r[2] === 'NP-77' && r[16] === ''), 'Decide later writes nothing');
  assert.throws(() => t.ctx.cueBidsDecide(v.id, 'r:old1', 'later'), /no Decide later/);
  assert.throws(() => t.ctx.cueBidsDecide(v.id, 'r:np77', 'maybe'), /Unknown choice/);
  const open = t.ctx.cueBidsOpenRows_(null).map(r => r.ref);
  assert.ok(open.indexOf('NP-77') >= 0 && open.indexOf('PG-3') < 0, 'declined leaves, later stays for tomorrow');
});
test('BV3 Send email clarification shows the draft on the card; Approve and send sends Kiko\'s edits from his Gmail once; Cancel removes an unsent draft', () => {
  const { t, v } = bidV3();
  const a = t.ctx.cueBidsAskAgency(v.id, 'r:np77'), d = a.bids.items.filter(x => x.reference === 'NP-77')[0].more.draft;
  deq([d.subject, d.body, d.to, d.sent], ['Clarification: NP-77', 'Good day. May we ask the ABC?', '', '']);
  assert.ok(/fun yet formal/.test(t.log.gpt.filter(b => b.text.format.name === 'bid_question')[0].instructions), 'BSE voice');
  assert.ok(!(t.log.sent || []).length, 'nothing sent yet');
  assert.throws(() => t.ctx.cueBidsClarifySend(v.id, 'r:np77', '', 'S', 'B'), /email in To/);
  const s = t.ctx.cueBidsClarifySend(v.id, 'r:np77', 'bac@npdc.gov.ph', 'Clarification: NP-77', 'Good day. May we ask the ABC and the event date?');
  assert.strictEqual(t.log.draftPut.length, 1); assert.ok(/To: bac@npdc\.gov\.ph/.test(t.log.draftPut[0].mime), 'the edited draft');
  deq(t.log.sent, ['draft-1'], 'sent once from Kiko\'s Gmail');
  const sd = s.bids.items.filter(x => x.reference === 'NP-77')[0].more.draft; assert.ok(sd.sent && sd.to === 'bac@npdc.gov.ph');
  assert.throws(() => t.ctx.cueBidsClarifySend(v.id, 'r:np77', 'bac@npdc.gov.ph', 'x', 'y'), /already sent/);
  assert.ok(t.tabs['Web bid findings'].rows.some(r => r[2] === 'NP-77' && /Clarification emailed .* to bac@npdc\.gov\.ph/.test(r[14])), 'noted in the sheet');
  t.ctx.cueBidsAskAgency(v.id, 'r:pg3');
  const c = t.ctx.cueBidsClarifyCancel(v.id, 'r:pg3');
  deq(t.log.draftDel, ['draft-2']); assert.strictEqual(c.bids.items.filter(x => x.reference === 'PG-3')[0].more.draft, null);
  assert.throws(() => t.ctx.cueBidsClarifyCancel(v.id, 'r:pg3'), /No unsent/);
});
test('BV4 Closing keeps accepted notices (Intake?? Yes) with Create CE into Canvas Cost Estimates; Accept marks the notice accepted', () => {
  const rows = [['2026-10-20', 'TPB', 'OLD-1', 'Travel fair booth', 'Open', 'Makati', 600000, 'PHP', '2026-10-27T17:00+08:00', '', '', '', 'https://tpb.gov.ph/x', '', '', '', ''],
    ['2026-10-20', 'NCCA', '114505', 'Tokens for delegates', 'Open', 'Metro Manila', 356000, 'PHP', '2026-11-04T17:00+08:00', '', '', '', 'https://philgeps.gov.ph/tenders/viewBidNotice/114505', '', '', '', 'Yes'],
    ['2026-10-20', 'QC', 'NO-1', 'Declined party', 'Open', 'Quezon City', 300000, 'PHP', '2026-11-04T17:00+08:00', '', '', '', 'https://qc.gov.ph/x', '', '', '', 'No']];
  const { t, v } = bidV3(rows);
  const added = v.bids.still.filter(x => x.reference === '114505')[0];
  assert.ok(added && added.added && added.source === 'PhilGEPS Bulletin Board' && /page=cedesk/.test(added.ce_url) && /q=114505/.test(added.ce_url));
  assert.ok(!v.bids.still.some(x => x.reference === 'NO-1'), 'declined stays off');
  t.ctx.cueBidsStartIntake(v.id, 'c:2026-0999');
  assert.strictEqual(t.ctx.cueView_(t.state(v.id)).bids.items.filter(x => x.reference === '2026-0999')[0].decision, 'accepted');
});
test('BV5 page: three parts with their buttons, the source on each notice, the draft with Approve and send, Edit and Cancel; Create CE on an accepted closing notice', () => {
  const page = cuePage(), fn = page.match(/function bidsCardHtml\(r\) \{[\s\S]*?\n  \}\n/)[0];
  const rows = [['2026-10-20', 'NCCA', '114505', 'Tokens for delegates', 'Open', 'Metro Manila', 356000, 'PHP', '2026-11-04T17:00+08:00', '', '', '', 'https://philgeps.gov.ph/tenders/viewBidNotice/114505', '', '', '', 'Yes']];
  const { t, v } = bidV3(rows); t.ctx.cueBidsAskAgency(v.id, 'r:np77');
  const r = JSON.parse(JSON.stringify(t.ctx.cueView_(t.state(v.id))));
  const box = { esc: x => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]), metricLine: () => '', r };
  const h = vm.runInNewContext(fn + 'bidsCardHtml(r)', box);
  assert.ok(/New: Scoped projects \(1\)[\s\S]*New: For clarification \(3\)[\s\S]*Opportunities closing \(1\)/.test(h));
  assert.ok(/>CITEM<\/span>/.test(h) && />NPDC<\/span>/.test(h) && />PhilGEPS Bulletin Board<\/span>/.test(h), 'source chips');
  assert.ok(/data-act="bids-intake"[^>]*data-f="c:2026-0999">Accept \(start intake\)/.test(h) && /data-act="bids-later"/.test(h) && /data-act="bids-decline"/.test(h));
  assert.ok(/data-act="bids-ask"[^>]*data-f="r:pg3">Send email clarification/.test(h), 'clarification button where no draft yet');
  assert.ok(/data-act="bids-send"[^>]*data-f="r:np77">Approve and send/.test(h) && /data-act="bids-edit"/.test(h) && /data-act="bids-cancel"/.test(h) && /May we ask the ABC/.test(h));
  assert.ok(/href="https:\/\/script\.google\.com[^"]*page=cedesk[^"]*"[^>]*>Create CE<\/a>/.test(h), 'Create CE on the accepted notice');
  ['bids-later', 'bids-decline', 'bids-send', 'bids-edit', 'bids-cancel'].forEach(a => assert.ok(page.indexOf("act === '" + a + "'") >= 0, a + ' is wired'));
});
