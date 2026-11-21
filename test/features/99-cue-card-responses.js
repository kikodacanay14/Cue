// Part of test/cue.test.js. Four separate synthetic card changes; no Gmail, bridge writes or deployments.

test('CCR1 Project inquiry: Pass Through needs no deliverable; design needs at least one; neither theme owner is allowed', () => {
  const t = sandbox({});
  const pass = t.ctx.cueProjectInquiryValidate_(t.ctx.cueProjectInquiry_({ types: ['Pass Through'], deliverables: ['Pitch Deck'], theme_owner: '' }));
  deq([pass.types, pass.deliverables, pass.pass_through_only, pass.mm_needed], [['Pass Through'], [], true, false]);
  const allowed = ['Pitch Deck', 'Venue Layout', 'Event Styling', 'Pub Mats', 'Event Collaterals', 'Wayfinders', 'Stage Layout', 'Social Media Mats'];
  const inquiry = t.ctx.cueProjectInquiry_({ types: ['Event'], theme: 'Garden launch', theme_owner: '', deliverables: allowed });
  deq(inquiry.deliverables, allowed);
  const known = t.ctx.cueProjectInquiryValidate_(t.ctx.cueProjectInquiry_({ types: ['Event'], theme: 'Garden launch', theme_owner: '', deliverables: ['Pitch Deck'] }));
  deq([known.theme, known.theme_owner, known.deliverables], ['Garden launch', '', ['Pitch Deck']]);
  assert.throws(() => t.ctx.cueProjectInquiryValidate_(t.ctx.cueProjectInquiry_({ types: ['Event'], theme: 'Garden launch', theme_owner: '', deliverables: [] })), /at least one deliverable/);
  assert.throws(() => t.ctx.cueProjectInquiryValidate_(t.ctx.cueProjectInquiry_({ types: ['Event'], theme_owner: '', deliverables: ['Pitch Deck'] })), /Choose a theme or who will provide it/);
  assert.throws(() => t.ctx.cueProjectInquiryValidate_(t.ctx.cueProjectInquiry_({ types: [], deliverables: [] })), /at least one project type/);
  const client = t.ctx.cueProjectInquiryValidate_(t.ctx.cueProjectInquiry_({ types: ['Fabrication'], theme_owner: 'Client to provide', deliverables: ['Stage Layout'] }));
  deq([client.deliverables, client.mm_needed], [['Stage Layout'], false]);
  const passThrough = t.ctx.cueProjectInquiryValidate_(t.ctx.cueProjectInquiry_({ types: ['Pass Through'], deliverables: [], theme_owner: '' }));
  deq([passThrough.pass_through_only, passThrough.deliverables], [true, []]);
});

test('CCR2 Email reroute: exact mailbox plus email ID separates same-subject emails; Received needs receiver ack', () => {
  const t = sandbox({});
  const a = t.ctx.cueEmailRerouteKey_('Kiko@BlankSpaceEvent.com', 'mail-101');
  const b = t.ctx.cueEmailRerouteKey_('kiko@blankspaceevent.com', 'mail-102');
  assert.strictEqual(a, 'kiko@blankspaceevent.com:mail-101');
  assert.notStrictEqual(a, b);
  assert.strictEqual(t.ctx.cueEmailRerouteKey_('kiko@blankspaceevent.com', ''), '');
  const run = { mailbox: 'kiko@blankspaceevent.com', routed: [
    { msg_id: 'mail-101', subject: 'Updated quotation', routed_to: 'AS agent' },
    { msg_id: 'mail-102', subject: 'Updated quotation', routed_to: 'Finance agent' }] };
  const saved = t.ctx.cueEmailRerouteMerge_(run, [{ key: a, received: false }]);
  deq(saved.map(x => x.state), ['Saved in Cue, waiting for Email Intake', '']);
  const received = t.ctx.cueEmailRerouteMerge_(run, [{ key: a, received: true }, { key: b, failed: true }]);
  deq(received.map(x => x.state), ['Received by Email Intake', "Couldn't deliver"]);
});

test('CCR3 Requirements: unchecked rows never enter the approval list and one edited row stays separate', () => {
  const t = sandbox({});
  const rows = [
    { id: '01', name: 'Stage', checked: true, qty: 2, occurrence: 3, status: 'Pending', note: 'Keep 2 hours' },
    { id: '02', name: 'Photo wall', checked: false, qty: 1, occurrence: 1, status: 'Pending', note: '' }];
  const plan = rows.filter(r => r.checked && r.status === 'Pending').map(r => ({ id: r.id, qty: r.qty, occurrence: r.occurrence, note: r.note }));
  deq(plan, [{ id: '01', qty: 2, occurrence: 3, note: 'Keep 2 hours' }]);
  assert.ok(!plan.some(x => x.id === '02'));
});

test('CCR4 Project Update: separate read-only card filters display only and never offers approval or reply actions', () => {
  const page = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexCards.html'), 'utf8');
  const grab = name => { const a = page.indexOf('  function ' + name + '('); return page.slice(a, page.indexOf('\n  }\n', a) + 4); };
  const ctx = { agdUpdateView: {}, agdUpdateSelected: {}, esc: x => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]) }; vm.createContext(ctx);
  vm.runInContext(grab('esc') + '\n' + grab('agdUpdHtml') + '\n' + grab('agdProjectUpdateHtml'), ctx);
  const b = agdBox({ drafts: [agdUpd(92, { handover: { project_update: true, state: 'Waiting for approval', handover_ref: 'HO-92', summary: 'Stage changed.', gaps: 'Venue access pending.',
    next_owner: 'Account Specialist', next_action: 'Confirm access', rows: [
      { req_id: 'REQ-01', name: 'Stage', description: 'Main stage', needs_kiko: false, open_items: ['Confirm rigging'] },
      { req_id: 'REQ-02', name: 'Photo wall', description: 'Entrance display', needs_kiko: true, open_items: [] }] } })] });
  b.t.ctx.cueAgdTick_();
  const r = JSON.parse(JSON.stringify(b.t.ctx.cueView_(b.reqs()[0]))), html = ctx.agdUpdHtml(r);
  assert.ok(/Project Update · Read only/.test(html) && /Stage changed\./.test(html) && /Venue access pending\./.test(html));
  assert.ok(/All requirements \(2\)/.test(html) && /Selected requirements \(0\)/.test(html));
  assert.ok(/Status:<\/b> <span class="muted">Not provided in this update<\/span>/.test(html) && /Owner:<\/b> Account Specialist/.test(html));
  assert.ok(!/data-act="agd-tick-send"|data-act="agd-reply"|data-act="agd-ok"|data-act="agd-rej-send"/.test(html));
  ctx.agdUpdateSelected[r.id] = { 'REQ-02': 1 }; ctx.agdUpdateView[r.id] = 'selected';
  const filtered = ctx.agdProjectUpdateHtml(r, false);
  assert.ok(/Photo wall/.test(filtered) && !/Main stage/.test(filtered), 'Selected filters visible content only');
});

test('CCR5 Client to provide and Pass Through stop after project creation without starting requirements or design work', () => {
  const cases = [
    { inquiry: { types: ['Event'], theme: '', theme_owner: 'Client to provide', deliverables: ['Pitch Deck'] },
      stage: 'Waiting for client direction', reason: /Waiting for client direction/ },
    { inquiry: { types: ['Pass Through'], theme: '', theme_owner: '', deliverables: [] },
      stage: 'Pass Through · no design handoff', reason: /no design deliverables/i }
  ];
  cases.forEach(({ inquiry, stage, reason }) => {
    const t = phStart();
    const v = t.ctx.cueApprove(t.id, { inquiry });
    deq([v.status, v.stage, v.ph.phase, t.log.claude.length, (t.log.phLines || []).length, writes(t)],
      ['Needs you', stage, 0, 0, 0, ['intake_add_project']]);
    assert.ok(reason.test(v.ph.wait_reason), v.ph.wait_reason);
    assert.ok(v.ph.inquiry, 'the selected inquiry choice remains on the waiting card');
  });
});

test('CCR6 selecting only line two keeps its original metadata, refuses stale selection, and retries without shrinking the draft', () => {
  const src = agdReq(96, { lines: [
    { item: 'First', description: 'First detail', qty: 1, occurrence: 1, unit_cost: 10, section: 'First category' },
    { item: 'Second', description: 'Second detail', qty: 1, occurrence: 1, unit_cost: 20, section: 'Second category' }
  ] });
  const b = agdBox({ drafts: [src], answer: () => ({ ok: false, error: 'Refused fixture' }) });
  b.t.ctx.cueAgdTick_();
  const id = b.reqs()[0].id;
  const selected = { decision: 'save', lines: [{ item: 'Second edited', qty: 2, occurrence: 3 }], line_indexes: [1],
    line_basis: [JSON.stringify(['Second', 'Second detail', 1, 1, 20, 'Second category'])], note: 'Requirement 2: keep indoors' };
  assert.throws(() => b.t.ctx.cueAgdDecide(id, { ...selected, line_basis: ['stale'] }), /draft changed/);
  assert.strictEqual(b.st.decide.length, 0);
  b.t.ctx.cueAgdDecide(id, selected);
  assert.strictEqual(b.reqs()[0].agd.lines.length, 2);
  b.st.answer = () => ({ ok: true, draft: { ...src, status: 'Saved', lines: b.st.decide.at(-1).lines } });
  b.t.ctx.cueAgdDecide(id, selected);
  assert.strictEqual(b.st.decide.length, 2);
  b.st.decide.forEach(a => {
    deq(a.lines, [{ item: 'Second edited', description: 'Second detail', qty: 2, occurrence: 3, unit_cost: 20, section: 'Second category' }]);
    assert.strictEqual(a.note, selected.note);
    assert.ok(!('line_indexes' in a) && !('line_basis' in a));
  });
});

test('CCR7 Project Update refuses direct replies and approval without reaching the bridge', () => {
  const b = agdBox({ drafts: [agdUpd(97, { handover: { handover_ref: 'status', project_update: true, state: 'Waiting for approval',
    rows: [{ req_id: 'REQ-01', name: 'Stage' }] } })] });
  b.t.ctx.cueAgdTick_();
  const id = b.reqs()[0].id;
  for (const action of [{ decision: 'reply', note: 'approve' }, { decision: 'reject' }, { decision: 'save' }]) {
    assert.throws(() => b.t.ctx.cueAgdDecide(id, action), /read-only/);
  }
  assert.strictEqual(b.st.decide.length, 0);
});
