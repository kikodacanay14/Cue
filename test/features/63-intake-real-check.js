// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: intake-real-check.
/* INTAKE-REAL-CHECK (backlog card intake-real-check, 29 Oct 2026): the cloud check test/checks/intake-real.check.mjs runs intake on real
 * inquiries through the check door. These tests prove the door functions it uses (CueIntakeCheck.gs) and the two check fixes it needed. */
const irBox = () => { const t = checkBox({ phased: true, inbox: INBOX, until: Date.parse('2030-01-01T00:00:00Z') });
  const at = d => new Date(Date.parse('2026-10-21T00:00:00Z') - d * 864e5);
  t.tabs['Triage log'].rows.push([at(3), 'm0', 'a1a1a1a1a1a1a1a1', 'ana@acme.example', 'Quote for our launch', 'inquiry', 'older line, same thread', 'cue-sweep-0'],
    [at(2), 'm9', 'b2b2b2b2b2b2b2b2', 'news@events.example', 'Digest', 'fyi', 'newsletter', 'cue-sweep-0'],
    [at(1), 'm1', 'a1a1a1a1a1a1a1a1', 'ana@acme.example', 'Quote for our launch', 'inquiry', 'launch quote', 'cue-sweep-1'],
    [at(40), 'm2', 'c3c3c3c3c3c3c3c3', 'old@x.example', 'Old', 'inquiry', 'too old', 'cue-sweep-0']);
  return t; };
test('IR1 intake-real check: picks real inquiries (one per thread, newest first, last 30 days) with their text, starts intake from the Gmail thread, stops at the phase 1 card', () => {
  const t = irBox(), pick = t.call('cueIcPick_', 30, 6).result;
  deq(pick.map(p => [p.key, p.inbox, p.thread_id]), [['inbox:m1', 'mine', 'a1a1a1a1a1a1a1a1']]);
  assert.ok(/product launch on 5 December/.test(pick[0].text) && pick[0].files >= 1 && !pick[0].error, JSON.stringify(pick[0]));
  const id = t.call('cueIcStart_', pick[0]).result.request_id; t.call('cueRun', id);
  const s = t.state(id); deq([s.kind, s.phase, s.status, s.source.thread_id, !!s.check], ['intake', 1, 'Needs you', 'a1a1a1a1a1a1a1a1', true]);
  deq(writes(t), []); deq(t.door('check_finish').stopped, [], 'client_check is a read: the phase 1 card asks it without tripping the lock');
});
test('IR2 intake-real check: phases 2 to 4 run in memory from the phase 1 card; nothing is saved, written to Canvas or drafted in Gmail', () => {
  const t = irBox(), id = t.call('cueIcStart_', t.call('cueIcPick_', 30, 6).result[0]).result.request_id; t.call('cueRun', id);
  const before = JSON.stringify(t.state(id)), drafts = t.log.gmail.length, d = n => t.call('cueIcDeep_', id, n);
  assert.ok(/Run phase 2 of this check first/.test(d(3).error), 'phases run in order');
  const p2 = d(2).result; assert.ok(p2.rows.length && p2.rows.every(r => r.item.split(/\s+/).length <= 6) && p2.phase === 2, JSON.stringify(p2));
  const p3 = d(3).result; assert.ok(p3.totals && p3.lines.length === p2.rows.length && p3.phase === 3, JSON.stringify(p3));
  const p4 = d(4).result; assert.ok(Array.isArray(p4.rfqs), JSON.stringify(p4));
  deq(writes(t), []); assert.strictEqual(JSON.stringify(t.state(id)), before, 'the task is unchanged'); assert.strictEqual(t.log.gmail.length, drafts);
  assert.ok(/No such request/.test(t.call('cueIcDeep_', 'cue-nope', 2).error || ''), 'an unknown task is an error');
  deq(t.door('check_finish').stopped, []);
});
test('IR3 a check\'s intake never joins or reopens one of Kiko\'s threads; outside a check the same message still joins his card', () => {
  const t = irBox(), mine = t.ctx.cueSend(INQ, [], 'intake').request_id; t.ctx.cueRun(mine);
  const kiko = JSON.stringify(t.state(mine)), out = t.call('cueSend', INQ + ' Please add a second LED wall.', [], 'intake').result;
  assert.notStrictEqual(out.request_id, mine); assert.strictEqual(JSON.stringify(t.state(mine)), kiko, 'Kiko\'s card is untouched');
  t.ctx.CUE_CHECK_ON_ = false; assert.strictEqual(t.ctx.cueSend(INQ + ' Please add a second LED wall.', [], 'intake').request_id, mine, 'live behaviour unchanged');
});
test('IR4 intake-real check: inquiries come from New mail\'s sort (its log lines say "new"), newest first, skipped and check tasks left out', () => {
  const t = irBox(), day = Date.parse('2026-10-20T08:00:00Z');
  const it = (k, th, g, ms, extra) => Object.assign({ key: 'inbox:' + k, inbox: 'mine', group: g, sender: 'ruth@moldex.example', subject: 'Request Quotation ' + k, thread_id: th, ms }, extra || {});
  const nm = (id, items, extra) => Object.assign({ id, kind: 'newmail', day: '2026-10-20', status: 'Needs you', nm: { items } }, extra || {});
  [nm('cue-nm-1', [it('n1', 'd4d4d4d4d4d4d4d4', 'inquiry', day), it('n2', 'e5e5e5e5e5e5e5e5', 'fyi', day), it('n3', 'f6f6f6f6f6f6f6f6', 'inquiry', day, { removed: 'skip' })]),
    nm('cue-nm-2', [it('n4', 'a7a7a7a7a7a7a7a7', 'inquiry', day)], { check: 'x' })]
    .forEach(s => t.tabs.Requests.rows.push([s.id, '', '', '', '', '', '', '', '', '', JSON.stringify(s)]));
  t.tabs['Triage log'].rows.push([new Date(day), 'n1', 'd4d4d4d4d4d4d4d4', 'ruth@moldex.example', 'Request Quotation n1', 'new', '', 'cue-nm-1']);
  const pick = t.call('cueIcPick_', 30, 6).result;
  deq(pick.map(p => [p.key, p.thread_id, p.run]), [['inbox:n1', 'd4d4d4d4d4d4d4d4', 'cue-nm-1'], ['inbox:m1', 'a1a1a1a1a1a1a1a1', 'cue-sweep-1']]);
});
test('IR5 RFQ drafts get TBC for blank event details, never an empty line or 0 pax', () => {
  const t = irBox(), id = t.call('cueIcStart_', t.call('cueIcPick_', 30, 6).result[0]).result.request_id; t.call('cueRun', id);
  const L = t.ctx.cueLoad_(id); L.s.x.event = Object.assign(L.s.x.event || {}, { venue: '', city: '', pax: 0, date: '' }); t.ctx.cueSave_(L.sh, L.row, L.s);
  [2, 3, 4].forEach(n => t.call('cueIcDeep_', id, n));
  const call = t.log.gpt.filter(b => b.text.format.name === 'rfqs').pop(), ev = call && JSON.parse(String(call.input).slice(String(call.input).indexOf('{'))).event;
  assert.ok(ev, 'the RFQ call carries the event'); deq([ev.venue, ev.city, ev.pax, ev.date], ['TBC', 'TBC', 'TBC', 'TBC']);
});
