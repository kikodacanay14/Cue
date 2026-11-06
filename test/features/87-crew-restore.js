// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: CREW-RESTORE-2026-11-06 (Cue 1.28.39).
/* Kiko 6 Nov 02:05Z picked "Add to Canvas list, you tap Link": people who wrote to the Page but never tapped "I'm crew" go to Canvas's
 * crew_wait once, with their first message. Canvas lists them for Link and sends no code; Cue sends nothing on Messenger. */
function restoreBox(answer) {
  const calls = [];
  const box = msgrSandbox({ bridgeFn: b => {
    if (b.action !== 'crew_wait') return undefined;
    assert.strictEqual(bridgeCheck(b.action, b.args), '', 'crew_wait args fit the Canvas schema');
    calls.push(b.args); return typeof answer === 'function' ? answer(b.args) : answer;
  } });
  box.calls = calls; return box;
}
const triSet = (b, psid, T) => { b.t.props['MSGR_TRI_' + psid] = JSON.stringify(T); };
test('CRW1 untapped people go to crew_wait once with their first message; tapped-and-coded, client and linked people do not; nothing is sent on Messenger', () => {
  const b = restoreBox(a => a.psid === '3003' ? { ok: true, status: 'skipped' } : { ok: true, status: 'to_link', person: a.psid === '3001' ? 'Jeffrey Tupal' : 'Albert Coronel', project: 'Kings Day – Embassy of Belgium' });
  triSet(b, '3001', { st: 'asked', first: 'Jeffrey Tupal\nKings Day-Embassy of Belgium', last: 'x' });
  triSet(b, '3002', { st: 'asked', first: 'Albert coronel\nKings Day - Embassy of Belgium', last: 'x' });
  triSet(b, '3003', { st: 'asked', first: 'oks', last: 'x' });
  triSet(b, '3004', { st: 'crew', m: 'code', first: 'Hi', details: 'Ana Cruz kings day' });   // a code is waiting: left alone
  triSet(b, '3005', { st: 'client', first: 'Booth quote please' });
  const sent0 = b.sent().length;
  const r = b.t.ctx.cueMsgrCrewRestore_();
  deq(b.calls.map(a => [a.psid, a.text, a.request_id]), [['3001', 'Jeffrey Tupal\nKings Day-Embassy of Belgium', 'crewwait:3001'], ['3002', 'Albert coronel\nKings Day - Embassy of Belgium', 'crewwait:3002'], ['3003', 'oks', 'crewwait:3003']]);
  deq([r.listed, r.skipped, r.failed], [['Jeffrey Tupal', 'Albert Coronel'], 1, 0]);
  assert.strictEqual(b.t.props.CUE_CREW_RESTORE_DONE, '1');
  assert.ok(MAIN(b.t).some(l => /^Put 2 Messenger crew on Canvas's Link list .*Jeffrey Tupal, Albert Coronel\. Link them on the Freelancers page .*Nobody was messaged\.$/.test(l)), JSON.stringify(MAIN(b.t)));
  assert.strictEqual(b.sent().length, sent0, 'no Messenger send');
  assert.strictEqual(b.t.ctx.cueMsgrCrewRestore_(), null, 'never again'); assert.strictEqual(b.calls.length, 3);
});
test('CRW2 a Canvas refusal (V483 not live yet, or busy) leaves the run open; the next resume sends only the ones still missing', () => {
  let down = true;
  const b = restoreBox(a => { if (down && a.psid === '3002') throw new Error('Canvas refused crew_wait (Blocked): unknown action'); return { ok: true, status: 'no_match' }; });
  triSet(b, '3001', { st: 'asked', first: 'Jerry Palo\nKings Day-Embassy of Belgium' });
  triSet(b, '3002', { st: 'asked', first: 'Adrian marasigan\nKings day: embassy of Belgium' });
  const r = b.t.ctx.cueMsgrCrewRestore_(); deq([r.listed.length, r.failed], [1, 1]); assert.ok(!b.t.props.CUE_CREW_RESTORE_DONE);
  down = false; const r2 = b.t.ctx.cueMsgrCrewRestore_();
  deq(b.calls.map(a => a.psid), ['3001', '3002', '3002']); deq([r2.listed, r2.failed], [['Adrian marasigan'], 0]);
  assert.strictEqual(b.t.props.CUE_CREW_RESTORE_DONE, '1');
});
