// Part of test/cue.test.js. Feature: AGENT-NEXT-LINES-2026-11-18 (Kiko 18 Nov 2026 14:47Z, screenshot of the AS approval bubble:
// "please format this properly a line break after each item"). An agent's "Next:" text that holds several items joined by ". Note:"
// shows one item per line, in the bubble and in the Details card. Cue keeps up to 4000 characters of it (was 1000), the same as
// the summary and gaps, so Cue never cuts an item. Display and storage only; the text itself is unchanged.
const ANL_NEXT = 'Waiting for client, not covered by approve: REQ26-05 (quantity). Note: REQ26-04 count: Kiko decided: one requirement. '
  + 'Note: REQ26-04 for Kiko to check: Dressed footprints; not in the brief. Note: REQ26-06 count: two scopes (pages 8 and 9)';
test('ANL1 the bubble puts each Note on its own line, keeps the owner on the last line, and leaves a one-item Next alone', () => {
  const u = { id: 'u', agd: { agent: 'Account Specialist', type: 'update', item: 'Canvas', handover: { summary: 'Reply approve to approve.', next_action: ANL_NEXT, next_owner: 'Kiko', state: 'Waiting for approval' } } };
  deq(AGC.agentSays(u).split('\n'), ['Reply approve to approve.',
    'Next: Waiting for client, not covered by approve: REQ26-05 (quantity).',
    'Note: REQ26-04 count: Kiko decided: one requirement.',
    'Note: REQ26-04 for Kiko to check: Dressed footprints; not in the brief.',
    'Note: REQ26-06 count: two scopes (pages 8 and 9) (Kiko)',
    'It waits for your approval.']);
  const one = { id: 'o', agd: { agent: 'AS', type: 'update', item: 'x', handover: { summary: 's', next_action: 'MM adds sizes. Notes go to MM', next_owner: 'MM', state: 'Delivered' } } };
  deq(AGC.agentSays(one).split('\n'), ['s', 'Next: MM adds sizes. Notes go to MM (MM)'], 'only a word "Note:" starts a new line');
  const lead = { id: 'l', agd: { agent: 'AS', type: 'update', item: 'x', handover: { summary: 's', next_action: 'Do A. Waiting for client: B', state: 'Delivered' } } };
  deq(AGC.agentSays(lead).split('\n'), ['s', 'Next: Do A.', 'Waiting for client: B'], '"Waiting for client" starts its own line when it is not first');
});
test('ANL2 the Details card shows the same lines, and Cue keeps up to 4000 characters of the next step', () => {
  const page = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexCards.html'), 'utf8');
  assert.ok(page.includes("['Next action', H.next_action ? '<span style=\"white-space:pre-wrap\">' + agKv(agdNextLines(H.next_action)) + '</span>' : 'Not given']"), 'Details card');
  const t = sandbox({}), long = 'Note: x. '.repeat(400).trim();
  assert.strictEqual(t.ctx.cueAgdHand_({ summary: 'y', next_action: long }).next_action, long.slice(0, 4000));
  assert.strictEqual(t.ctx.cueAgdHand_({ summary: 'y', next_action: long }).next_action.length, 3599, 'a 3599-character next step is kept whole');
});
