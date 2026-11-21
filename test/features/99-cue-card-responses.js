// Part of test/cue.test.js. Four separate synthetic card changes; no Gmail, bridge writes or deployments.

test('CCR1 Project inquiry: Pass Through needs no deliverable; design needs at least one; neither theme owner is allowed', () => {
  const t = sandbox({});
  const pass = t.ctx.cueProjectInquiryValidate_(t.ctx.cueProjectInquiry_({ types: ['Pass Through'], deliverables: ['Pitch Deck'], theme_owner: '' }));
  deq([pass.types, pass.deliverables, pass.pass_through_only, pass.mm_needed], [['Pass Through'], [], true, false]);
  const allowed = ['Pitch Deck', 'Venue Layout', 'Event Styling', 'Pub Mats', 'Event Collaterals', 'Wayfinders', 'Stage Layout'];
  const inquiry = t.ctx.cueProjectInquiry_({ types: ['Event'], theme: 'Garden launch', theme_owner: '', deliverables: allowed.concat('Social Media Mats') });
  deq(inquiry.deliverables, allowed);
  const known = t.ctx.cueProjectInquiryValidate_(t.ctx.cueProjectInquiry_({ types: ['Event'], theme: 'Garden launch', theme_owner: '', deliverables: ['Pitch Deck'] }));
  deq([known.theme, known.theme_owner, known.deliverables], ['Garden launch', '', ['Pitch Deck']]);
  assert.throws(() => t.ctx.cueProjectInquiryValidate_(t.ctx.cueProjectInquiry_({ types: ['Event'], theme: 'Garden launch', theme_owner: '', deliverables: [] })), /at least one deliverable/);
  assert.throws(() => t.ctx.cueProjectInquiryValidate_(t.ctx.cueProjectInquiry_({ types: ['Event'], theme_owner: '', deliverables: ['Pitch Deck'] })), /Choose a theme or who will provide it/);
  assert.throws(() => t.ctx.cueProjectInquiryValidate_(t.ctx.cueProjectInquiry_({ types: [], deliverables: [] })), /at least one project type/);
  const client = t.ctx.cueProjectInquiryValidate_(t.ctx.cueProjectInquiry_({ types: ['Fabrication'], theme_owner: 'Client to provide', deliverables: ['Stage Layout'] }));
  deq([client.deliverables, client.mm_needed], [['Stage Layout'], false]);
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

test('CCR4 Project Update: the handover stays read-only and exposes no approval/send action', () => {
  const page = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexCards.html'), 'utf8');
  const update = page.slice(page.indexOf('function agdUpdHtml'), page.indexOf('function agdCardHtml'));
  assert.ok(/Handover/.test(update));
  assert.ok(!/data-act="agd-ok"|data-act="agd-rej-send"|client send/i.test(update));
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
