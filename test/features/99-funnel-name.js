// Part of test/cue.test.js. Feature: FUNNEL-NAME-2026-11-18 (src/IndexThreads.html kindOf). The 2 PM funnel follow-ups run (kind
// k0fn, CueMorning.gs) had no name of its own and fell back to "Project intake", so its error card read "Project intake stopped".
// Kiko approved the rename on 18 Nov 2026 (09:00:43Z, "why are we making this complicated?", relayed with the rename as decided).
test('FN1 the 2 PM funnel follow-ups have their own name; a client intake is still "Project intake"', () => {
  deq(pageKindName({ kind: 'k0fn' }), '2 PM funnel follow-ups');
  deq(pageKindName({ kind: 'intake' }), 'Project intake');
  deq(pageKindName({ kind: 'k0' }), '8 AM update');
});
