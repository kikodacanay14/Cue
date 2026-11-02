// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: Ask Cue changes F1, old daily threads clear
// themselves (CanvasWorkspace docs/specs/ask-cue-changes-spec.md, stories AC-1 and AC-2). Kiko 2 Nov 2026: "move the and add the
// unresponded items from previous thread to today's thread so that old thread's can be archived"; Q1 "A" (daily threads only, from
// every older day); assumption 11 (Cue archives the old thread). "Now" in the sandbox is 21 Oct 2026, 11:00 in Manila.
const accPut = (t, s) => { const sh = t.tabs.Requests; sh.appendRow([s.id]); t.ctx.cueSave_(sh, sh.getLastRow(), s); };

test('ACC1 New mail: open lines from every older New mail thread move to today\'s, once each; the older threads close and archive', () => {
  const t = sandbox();
  accPut(t, { id: 'cue-20261019080000-0001', kind: 'newmail', day: '2026-10-19', status: 'Needs you', text: 'New mail for 2026-10-19',
    nm: { items: [{ key: 'inbox:k1', sender: 'a@x.example' }, { key: 'inbox:k2', sender: 'b@x.example', task_id: 'cue-t' }, { key: 'inbox:k5', removed: true }], skipped: [] } });
  accPut(t, { id: 'cue-20261020080000-0002', kind: 'newmail', day: '2026-10-20', status: 'Needs you', text: 'New mail for 2026-10-20',
    nm: { items: [{ key: 'inbox:k3', sender: 'c@x.example' }, { key: 'inbox:k1', sender: 'a@x.example' }], skipped: [] } });
  const L = t.ctx.cueLocked_(() => t.ctx.cueNmToday_('2026-10-21'));
  deq(L.s.nm.items.map(x => x.key), ['inbox:k3', 'inbox:k1'], 'open lines only, no line twice; handed-to-task and removed lines stay behind');
  assert.strictEqual(L.s.status, 'Needs you');
  ['cue-20261019080000-0001', 'cue-20261020080000-0002'].forEach(id => {
    const s = t.ctx.cueLoad_(id).s;
    deq([s.status, s.archived, s.superseded], ['Closed', true, L.s.id], id);
  });
  const again = t.ctx.cueLocked_(() => t.ctx.cueNmToday_('2026-10-21'));
  assert.strictEqual(again.s.id, L.s.id, 'the same day reuses today\'s thread');
});

test('ACC2 Bid check: notices still open on older days move into today\'s thread with the day they came from; the older thread closes and archives', () => {
  const t = sandbox();
  accPut(t, { id: 'cue-20261019190000-aaaa', kind: 'bids', created: '2026-10-19T11:00:00.000Z', status: 'Needs you', ref: '', text: 'x',
    bids: { title: 'Bid check', day: '2026-10-19', items: [{ key: 'a', reference: '119200' }, { key: 'c', reference: '119100' }], updated: [] } });
  accPut(t, { id: 'cue-20261020190000-bbbb', kind: 'bids', created: '2026-10-20T11:00:00.000Z', status: 'Done', ref: '', text: 'x',
    bids: { title: 'Bid check', day: '2026-10-20', items: [], updated: [] } });
  const s = { id: 'cue-20261021110000-cccc', bids: { day: '2026-10-21', items: [{ key: 'b', reference: '119300' }], updated: [], open: [{ key: 'a' }, { key: 'b' }] } };
  assert.strictEqual(t.ctx.cueBidsCarry_(s), 1, 'only a notice still open (no intake, deadline not passed) moves');
  deq(s.bids.items.map(x => [x.key, x.carried_from || '']), [['b', ''], ['a', '2026-10-19']]);
  const old = t.ctx.cueLoad_('cue-20261019190000-aaaa').s;
  deq([old.status, old.archived, old.superseded], ['Closed', true, s.id]);
  assert.strictEqual(t.ctx.cueLoad_('cue-20261020190000-bbbb').s.status, 'Done', 'a finished older thread is left as it is');
  assert.strictEqual(t.ctx.cueBidsCarry_(s), 0, 'a second run moves nothing');
});
