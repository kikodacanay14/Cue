// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: DOC-MENU-2026-11-07 (CueMessenger.gs).
// Kiko 7 Nov 2026: Canvas Resources › FSA / AR get a ⋯ menu with "Message on FB" ("build" 15:23Z). Canvas lists the paper in msgr_due
// with now_at when staff ask; Cue sends it on the next tick even when it went on Messenger before, and marks it with its own request id.
const MN_DOC = { doc: 'FSA', id: 'FSA-9911', project: 'Kings Day', name: 'Ana Cruz', email: 'ana@example.test',
  sign_link: 'https://canvas.blankspaceevent.com/crew?v=sign&t=k.k', messenger_id: '7011', last_message: '2026-11-02T06:00:00Z', sent: true };
test('MN1 sent before and not asked again: nothing goes out', () => {
  const b = msgrBox({ docs: [MN_DOC] });
  assert.strictEqual(b.ctx.cueMsgrRun_(MSGR_NOW).sent, 0);
  assert.strictEqual(b.log.fetch.length, 0);
});
test('MN2 Message on FB (now_at): sent again, and the mark carries its own request id so Canvas clears the ask', () => {
  const b = msgrBox({ docs: [Object.assign({}, MN_DOC, { now_at: 1794065349843 })] });
  assert.strictEqual(b.ctx.cueMsgrRun_(MSGR_NOW).sent, 1);
  const m = b.log.bridge.filter(x => x[0] === 'msgr_mark').map(x => x[1]);
  deq(m.map(x => x.request_id), ['msgr:FSA:FSA-9911:1794065349843']);
  assert.strictEqual(bridgeCheck('msgr_mark', m[0]), '');
});
test('MN3 Message on FB outside the 24-hour window: skipped like any other paper', () => {
  const b = msgrBox({ docs: [Object.assign({}, MN_DOC, { now_at: 1794065349843, last_message: '2026-10-30T06:00:00Z' })] });
  const r = b.ctx.cueMsgrRun_(MSGR_NOW);
  deq([r.sent, r.skipped.map(x => x.why)], [0, ['last message over 24 hours ago']]);
});
