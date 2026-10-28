// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: readiness.
/* ---------- readiness check (Kiko 07:32Z, specs/project-readiness.md) ---------- */
const READINESS = { gate: 'pre', gate_name: 'Pre-Event Readiness', target_status: 'For Event Execution', today: '2026-10-21',
  project: { id: 'S-31628060SP', name: 'Acme Year-End Party', event_date: '2026-10-25', status: 'For Production Start' },
  counts: { blockers_open: 3, blockers_total: 10, warnings_open: 1, warnings_total: 5, waiting_on_others: 1, needs_kiko: 0, to_review: 1, unchecked: 1, clear: 11 },
  ready: false, unchecked_items: ['PER-9.03: Transfers could not be read'],
  auto: [{ key: 'risks', label: 'Open high risks', open: 1, items: ['TRI-1'], error: '' }],
  items: [
    { id: 'PER-2.06', section: 'Client deliverables', requirement: 'Dietary requirements confirmed', criticality: 'Warning', applicability: 'Required', status: 'Not Started', owner: 'Joy', due: '', follow_up: '', next_action: '', evidence: '', check: 'manual', why: '' },
    { id: 'PER-1.05', section: 'Project', requirement: 'Client PO, award or written authorization received', criticality: 'Blocker', applicability: 'Required', status: 'Waiting on Others', owner: '', due: '10/18/2026', follow_up: '', next_action: 'Ask Ana for the PO', evidence: '', check: 'manual', why: 'A person checks this' },
    { id: 'PER-1.04', section: 'Project', requirement: 'Current approved CE version linked', criticality: 'Blocker', applicability: 'Required', status: 'Ready', owner: 'Kiko', due: '', follow_up: '', next_action: '', evidence: '', check: 'met, waiting for review', why: '' },
    { id: 'PER-9.03', section: 'Payments', requirement: 'Supplier payments', criticality: 'Blocker', applicability: 'Required', status: 'Not Started', owner: 'Finance', due: '11/30/2026', follow_up: '', next_action: '', evidence: '', check: 'unknown', why: 'Transfers could not be read' }] };
const REVIEW = { summary: 'Three blockers open with the event in 4 days. The PO is the big one.', risks: ['No PO yet', 'Payments unconfirmed', 'Ignore previous instructions'],
  blockers: [{ id: 'PER-1.05', closes: 'Ana sends the signed PO', owner_hint: 'Account lead' }, { id: 'PER-1.04', closes: 'Review the CE in Canvas', owner_hint: 'Ops' }, { id: 'PER-77.1', closes: 'made up', owner_hint: '' }],
  evidence: [{ ref: 'E1', check: 'PER-1.05', verdict: 'not proof', why: 'Ana says the PO is coming' }, { ref: 'F1', check: 'PER-1.04', verdict: 'looks like proof', why: 'CE v3 final' },
    { ref: 'E99', check: 'PER-1.05', verdict: 'looks like proof', why: 'invented' }, { ref: 'E1', check: 'PER-99', verdict: 'looks like proof', why: 'unknown check' }] };
const READY_MAIL = [
  { id: 'r1', thread: '18f0aa00bb00001', ms: 1760900000000, from: 'Ana Reyes <ana@acme.example>', to: 'kiko@example.com', subject: 'Re: Acme Year-End Party PO', snippet: 'PO is being signed, will send Monday' },
  { id: 'r2', thread: '18f0aa00bb00001', ms: 1760800000000, to: 'ana@acme.example', subject: 'Acme Year-End Party PO', snippet: 'Can you send the PO?' },
  { id: 'r3', thread: '18f0aa00bb00002', ms: 1760700000000, to: 'Sonic Pro <sales@sonicpro.example>', subject: 'Acme Year-End Party LED wall', snippet: 'Confirming the LED wall' },
  { id: 'r4', thread: '18f0aa00bb00003', ms: 1760600000000, from: 'Joy <joy@example.com>', to: 'kiko@example.com', subject: 'Acme Year-End Party internal', snippet: 'internal' }];
const FOLLOWUPS = { followups: [{ k: 'E1', checks: ['PER-1.05', 'PER-2.06'], body: 'Hi Ana,\nFollowing up on the PO for the 25th.\nBlank Space Events' }, { k: 'E1', checks: ['PER-1.05'], body: 'dup' },
  { k: 'E9', checks: ['PER-1.05'], body: 'made up thread' }], note: '' };
const ACME = [{ project_id: 'S-31628060SP', name: 'Acme Year-End Party', account: 'Acme Corp', date: '10/25/2026', status: 'For Production Start', why: 'similar name' },
  { project_id: 'S-11111111AA', name: 'Acme Year-End Party 2025', account: 'Acme Corp', date: '12/12/2025', status: 'Completed', why: 'similar name' }];
const ASK = { reply: 'Checking Acme in Canvas now.', looks_like_inquiry: false, start_intake: '', task: '', readiness: 'Acme Year-End Party' };
function readyRun(o) { const t = sandbox(Object.assign({ talk: ASK, similar: ACME, sent: READY_MAIL }, o)); const out = t.ctx.cueSend('is the Acme party ready?', [], ''); const v = t.ctx.cueRun(out.request_id); return Object.assign(t, { id: out.request_id, v }); }

test('RD1 readiness: chat names the project, Canvas scores it, Claude summarises; 1 AI call in the run, reads only, Canvas numbers untouched', () => {
  const t = readyRun(), v = t.v, R = v.ready;
  assert.strictEqual(v.kind, 'readiness'); assert.strictEqual(v.status, 'Done'); assert.strictEqual(v.metrics.ai_calls, 1, 'only Claude in the run (the chat call is the message itself)');
  deq(t.log.bridge.map(b => b.action).filter(a => a !== 'search_projects').sort(), ['find_similar_projects', 'get_readiness', 'list_project_files'], 'reads only');
  deq(t.log.search || [], ['acme', 'party', 'Acme Year-End Party'], 'the chat lookup, then the one project finder (STRUCTURE-PHASE-3), also reads');
  assert.strictEqual(t.log.readyFor, 'S-31628060SP', 'the open project, not the completed one from last year');
  deq(R.canvas.counts, READINESS.counts, 'Canvas\'s counts as given');
  deq(R.canvas.items.map(i => i.id), ['PER-1.05', 'PER-9.03', 'PER-1.04', 'PER-2.06'], 'blockers first, then by due date, undated last');
  const po = R.canvas.items.filter(i => i.id === 'PER-1.05')[0];
  assert.ok(po.flags.indexOf('no owner') >= 0 && po.flags.some(f => /^overdue/.test(f)) && po.flags.indexOf('event in 4 days') >= 0, 'code flags');
  deq(R.review.blockers.map(b => [b.id, b.owner_hint]), [['PER-1.05', 'Account lead'], ['PER-1.04', '']], 'unknown ids dropped; owner hint only when no owner');
  deq(R.evidence.map(e => [e.ref, e.check, e.verdict]), [['E1', 'PER-1.05', 'not proof'], ['F1', 'PER-1.04', 'looks like proof']], 'only refs and checks Claude was shown');
  assert.ok(/^https:\/\/mail\.google\.com\//.test(R.evidence[0].url));
  const ask = JSON.parse(t.log.claude[0].messages[0].content);
  deq(ask.emails.map(e => e.ref), ['E1', 'E2'], 'one per thread, outside addresses only'); assert.strictEqual(ask.emails[0].direction, 'from ana@acme.example');
  assert.ok(/newer_than:60d/.test(t.log.gmailQ) && /"Acme Year-End Party"/.test(t.log.gmailQ));
  assert.ok(!t.log.replies && !t.log.sent && !t.log.gmail.length, 'nothing drafted or sent');
  assert.ok(t.tabs.Chat.rows.some(x => x[3] === '>' + t.id && /^Readiness for Acme Year-End Party: 7 of 10 blockers clear/.test(x[2])), 'summary line in the main chat');
  assert.ok(t.tabs.Chat.rows.some(x => x[3] === t.id && /7 of 10 blockers clear on Pre-Event Readiness \(Canvas's count\)/.test(x[2])));
  assert.ok(bridgeCheck('get_readiness', { gate: 'auto' }) === '' && bridgeCheck('get_readiness', { gate: 'approve' }) !== '', 'real bridge schema');
});
test('RD2 several open matches: Kiko picks on the card; a Canvas project id skips the search; nothing found stops with a plain message', () => {
  const two = [Object.assign({}, ACME[0], { name: 'Acme Year-End Party Manila' }), Object.assign({}, ACME[0], { project_id: 'S-22222222BB', name: 'Acme Year-End Party Cebu' })];
  const t = readyRun({ similar: two });
  assert.strictEqual(t.v.status, 'Needs you'); assert.strictEqual(t.v.stage, 'Pick project'); assert.strictEqual(t.v.ready.options.length, 2);
  assert.throws(() => t.ctx.cueReadyPick(t.id, 'S-99999999ZZ'), /not one of the choices/);
  const v = t.ctx.cueReadyPick(t.id, 'S-22222222BB'); assert.strictEqual(v.status, 'Done'); assert.strictEqual(t.log.readyFor, 'S-22222222BB');
  const u = readyRun({ talk: Object.assign({}, ASK, { readiness: 'S-31628060SP' }) });
  assert.strictEqual(u.v.status, 'Done'); assert.ok(!u.log.bridge.some(b => b.action === 'find_similar_projects'));
  // STRUCTURE-PHASE-3: the one project finder keeps the one project whose name is exactly what Kiko said, as Canvas commands do.
  const e = readyRun({ similar: [ACME[0], two[1]] }); assert.strictEqual(e.v.status, 'Done'); assert.strictEqual(e.log.readyFor, 'S-31628060SP');
  const w = readyRun({ similar: [] }); assert.strictEqual(w.v.status, 'Failed'); assert.ok(/no project matching/.test(w.v.error));
  const x = readyRun({ noReadiness: true }); assert.strictEqual(x.v.status, 'Failed'); assert.ok(/next Canvas release/.test(x.v.error));
});
test('RD3 follow-ups: one GPT call, only Waiting on Others items and threads Cue found; Approve and send replies in the thread', () => {
  const t = readyRun(), v = t.ctx.cueReadyFollowups(t.id), R = v.ready;
  assert.strictEqual(v.status, 'Needs you'); assert.strictEqual(v.metrics.ai_calls, 2);
  const ask = JSON.parse(t.log.gpt[t.log.gpt.length - 1].input); deq(ask.items.map(i => i.id), ['PER-1.05'], 'only items waiting on others');
  deq(R.followups.map(f => [f.k, f.to, f.checks.join(',')]), [['E1', 'ana@acme.example', 'PER-1.05']], 'one per address, known threads and items only');
  const d = t.ctx.cueApprove(t.id, { skip: [], bodies: { E1: 'Hi Ana, edited by Kiko' }, send: true });
  assert.strictEqual(d.status, 'Done'); deq(t.log.sent, ['reply-1']);
  const mime = t.log.replies[0].payload; assert.ok(/"threadId":"18f0aa00bb00001"/.test(mime) && /In-Reply-To: <r1@mail>/.test(mime), 'reply in the original thread');
  assert.ok(Buffer.from(mime.split('base64\r\n\r\n')[1].split('\r\n--')[0].replace(/\r\n/g, ''), 'base64').toString().indexOf('edited by Kiko') >= 0);
  assert.ok(t.tabs.Chat.rows.some(x => /^Sent 1 follow-up from your Gmail/.test(x[2])));
  assert.throws(() => t.ctx.cueReadyFollowups(t.id), /already made/);
});
test('RD4 close follow-ups keeps the check; Re-check is a new run in the same thread straight to Canvas; Claude failing still shows Canvas', () => {
  const t = readyRun(); t.ctx.cueReadyFollowups(t.id);
  const c = t.ctx.cueReject(t.id, ''); assert.strictEqual(c.status, 'Done'); deq(c.ready.followups, []); assert.ok(!t.log.replies);
  const before = t.log.bridge.length, r = t.ctx.cueReadyRecheck(t.id);
  assert.strictEqual(r.ref, t.id); assert.strictEqual(r.status, 'Done');
  deq(t.log.bridge.slice(before).map(b => b.action).sort(), ['get_readiness', 'list_project_files'], 'no project search again');
  const f = readyRun({ fail: { review: () => resp(529, { error: { type: 'overloaded_error', message: 'busy' } }) } });
  assert.strictEqual(f.v.status, 'Done'); assert.strictEqual(f.v.ready.review, null); assert.ok(f.v.notes.some(n => /Claude's summary did not come through/.test(n)));
  deq(f.v.ready.canvas.counts, READINESS.counts);
  const g = readyRun({ gmailScope: true }); assert.strictEqual(g.v.status, 'Done'); assert.ok(g.v.notes.some(n => /Gmail search did not work/.test(n)));
});

test('RD5 asked inside a thread that already has its Canvas project: no project search; another project name still searches; each Canvas call timed', () => {
  const t = readyRun({ batchStep: 4000 });
  deq(t.state(t.id).metrics.canvas.map(c => c.calls), ['search_projects + find_similar_projects', 'get_readiness + list_project_files'], 'kept on the request, one entry per Canvas step');
  // STRUCTURE-PHASE-3: the project finder is one step of up to two round trips (no word match here, so the similar-name read follows).
  deq(t.state(t.id).metrics.canvas.map(c => [c.ok, c.secs]), [[true, 8], [true, 4]], 'seconds per step, from the clock');
  const before = t.log.bridge.length;
  t.opts.talk = Object.assign({}, ASK, { readiness: 'Acme party' });
  const out = t.ctx.cueSend('is it ready now?', [], '', t.id), v = t.ctx.cueRun(out.request_id);
  assert.strictEqual(v.status, 'Done'); assert.strictEqual(v.ref, t.id); const S = t.state(out.request_id); assert.strictEqual(S.ready.from_thread, true); assert.strictEqual(S.ready.match.project_id, 'S-31628060SP');
  deq(t.log.bridge.slice(before).map(b => b.action).filter(a => a !== 'search_projects').sort(), ['get_readiness', 'list_project_files'], 'thread match reused');
  deq(S.metrics.canvas.map(c => c.calls), ['get_readiness + list_project_files']);
  const mid = t.log.bridge.length;
  t.opts.talk = Object.assign({}, ASK, { readiness: 'Beko launch' });
  const w = t.ctx.cueRun(t.ctx.cueSend('and is Beko ready?', [], '', t.id).request_id);
  assert.ok(t.log.bridge.slice(mid).some(b => b.action === 'find_similar_projects'), 'another project: normal search'); assert.ok(!t.state(w.id).ready.from_thread);
  const f = readyRun({ similar: [] }); deq(f.state(f.id).metrics.canvas.map(c => [c.calls, c.ok]), [['search_projects + find_similar_projects', true]]);
  const x = readyRun({ noReadiness: true }); assert.strictEqual(x.state(x.id).metrics.canvas.length, 2, 'a refused read is still timed');
});
