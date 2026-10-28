// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: project-log.
/* ---------- CUE-PROJECT-LOG-2026-10-27: emails, task summaries and chasers go to the projects' logs (CueProjectLog.gs) ---------- */
test('PL1 the email check queues each changed inbox thread as one log line (in or out, headers only); no-reply senders are left out', () => {
  const now = Date.parse('2026-10-27T02:00:00Z');
  const t = maBox([
    { id: 'b1', h: '1', msgs: [maMsg('Ana Reyes <ana@acme.example>', now - 3e6, ['INBOX', 'UNREAD'])] },
    { id: 'b2', h: '2', msgs: [maMsg('Ana Reyes <ana@acme.example>', now - 5e6), maMsg('Kiko <kikodacanay@blankspaceevent.com>', now - 4e6)] },
    { id: 'b3', h: '3', msgs: [maMsg('noreply+workspace@google.com', now - 2e6)] }]);
  t.ctx.cueNow_ = () => now; t.ctx.cueMaTick_();
  const q = JSON.parse(t.props.CUE_PLOG_Q);
  deq(q.map(l => [l.key, l.kind, l.email, l.from]), [['mail:b1:' + (now - 3e6), 'Email in', 'ana@acme.example', 'Emails waiting'], ['mail:b2:' + (now - 4e6), 'Email out', 'ana@acme.example', 'Gmail']]);
  assert.ok(/^From Ana Reyes <ana@acme\.example>$/.test(q[0].details) && /^You replied to Ana Reyes$/.test(q[1].details));
  assert.ok(q.every(l => /^https:\/\/mail\.google\.com\/mail\/\?authuser=kikodacanay%40blankspaceevent\.com#all\//.test(l.link)), 'Open in Gmail picks the account');
  assert.ok(q.every(l => !('project_id' in l)), 'Canvas decides the project, not Cue');
  t.ctx.cueNow_ = () => now + 10 * 60e3; t.ctx.cueMaTick_();
  assert.strictEqual(JSON.parse(t.props.CUE_PLOG_Q).length, 2, 'an unchanged thread is not logged again');
});

test('PL2 the queue goes to Canvas in one project_log call per tick that matches the bridge schema; a refusal keeps the lines', () => {
  const lines = [{ key: 'mail:b1:1793000000000', kind: 'Email in', title: 'Re: RFQ', email: 'ana@acme.example', subject: 'Re: RFQ', at: '2026-10-27T01:00:00.000Z', from: 'Emails waiting' },
    { key: 'task:cue-abc123:x1', kind: 'Ask Cue', title: 'Summary for Acme Gala: recorded in Canvas', project_id: 'S-12345678AB', from: 'Ask Cue' }];
  const bad = sandbox({ plogFail: true }); bad.props.CUE_PLOG_Q = JSON.stringify(lines);
  assert.throws(() => bad.ctx.cuePlogFlush_(), /Canvas busy/); assert.strictEqual(JSON.parse(bad.props.CUE_PLOG_Q).length, 2, 'kept for the next tick');
  const t = sandbox(); t.props.CUE_PLOG_Q = JSON.stringify(lines);
  t.ctx.cueResume();
  deq([t.log.plog.length, t.log.plog[0].lines.length, JSON.parse(t.props.CUE_PLOG_Q).length], [1, 2, 0]);
  assert.strictEqual(bridgeCheck('project_log', t.log.plog[0]), '', 'real bridge schema');
  assert.ok(bridgeCheck('project_log', { request_id: 'cue-plog-1', lines: [{ key: 'k1', kind: 'Email in', title: 'x' }] }) !== '', 'a short key is refused');
  assert.strictEqual(t.ctx.cuePlogFlush_(), null, 'nothing queued: no call');
});

test('PL3 a finished task about a project logs its summary line; chasers log under their project; no project or a cloud check logs nothing', () => {
  const t = sandbox();
  t.ctx.cueLoad_ = id => ({ s: id === 'cue-p1aaaa' ? { canvas: { project_id: 'S-12345678AB' } } : { kind: 'bids' } });
  t.ctx.cueChat_('Cue', 'Summary for Acme Gala: recorded in Canvas as 2610-001.', '>cue-p1aaaa');
  t.ctx.cueChat_('Cue', 'Bid check: 3 new.', '>cue-nopid1');
  t.ctx.cueChat_('Cue', 'Summary for Acme Gala: recorded in Canvas as 2610-001.', 'cue-p1aaaa');   // the thread copy is not logged twice
  t.ctx.cuePlogChaser_({ key: 'award:S-12345678AB', project_id: 'S-12345678AB', who: 'Ana Reyes', to: 'ana@acme.example', subject: 'Following up on our CE' }, {});
  const q = JSON.parse(t.props.CUE_PLOG_Q);
  deq(q.map(l => [l.kind, l.project_id, l.from]), [['Ask Cue', 'S-12345678AB', 'Ask Cue'], ['Chaser', 'S-12345678AB', 'Morning batch']]);
  assert.ok(q.every(l => bridgeCheck('project_log', { request_id: 'cue-plog-1', lines: [l] }) === ''), 'each line fits the schema');
  t.ctx.CUE_CHECK_ON_ = true; t.ctx.cueChat_('Cue', 'Another summary.', '>cue-p1aaaa');
  assert.strictEqual(JSON.parse(t.props.CUE_PLOG_Q).length, 2, 'the cloud check never logs');
});
