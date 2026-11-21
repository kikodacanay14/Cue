test('RRNI exact JS click handlers and Cue server emit approved-row and fresh reject envelopes', () => {
  const page = cuePage();
  const a = page.indexOf("          if (act === 'agd-req-reject')");
  const z = page.indexOf("          if (act === 'agd-reply'", a);
  assert.ok(a >= 0 && z > a);
  const f = page.slice(a, z);
  const rows = [
    { req_id: 'REQ26-90001-01', name: 'Synthetic stage', sourcing: 'Outsourced', qty: 1, occurrence: 1, open_items: [] },
    { req_id: 'REQ26-90001-02', name: 'Synthetic backdrop', sourcing: 'Outsourced', qty: 7, occurrence: 1, open_items: [] }
  ];
  const payloads = {};
  for (const [name, n, act] of [
    ['selected_row', 9001, 'agd-tick-send'], ['fresh_reject', 9002, 'agd-req-reject']
  ]) {
    const card = ckUpd({ draft_id: 'DRF-'+n, project_id: 'S-99999999ZZ', handover: {
      handover_ref: 'AS requirements review rev synthetic-'+n, summary: 'Synthetic test only', state: 'Waiting for approval', rows
    }});
    const box = agdBox({ drafts: [card], answer: (args, st) => ({ ok: true,
      draft: { ...st.drafts[0], status: 'Replied', note: args.note } }) });
    box.t.ctx.cueAgdTick_();
    const stored = box.reqs()[0], id = stored.id;
    const { ctx } = edGrab();
    Object.assign(ctx, {
      act, id, b: {}, running: {}, agdOf: () => stored.agd,
      schedule: () => {}, done: () => {}, fail: e => { throw e; }, alertErr: e => { throw e; },
      ask: (title, copy, _, label, yes) => { assert.strictEqual(label, 'Reject'); return yes(); },
      call: (name, args, ok) => { assert.strictEqual(name, 'cueAgdDecide'); return ok(box.t.ctx[name](...args)); }
    });
    // Keep unsent edits in the rejection run too; its wire payload must still carry none.
    ctx.agdTick[id] = { t: { 'REQ26-90001-01': 1 }, a: {},
      e: { 'REQ26-90001-01': { qty: '2', note: 'Client wants satin finish' } } };
    vm.runInContext('(function () {\n' + f + '\n}())', ctx);
    assert.strictEqual(box.st.decide.length, 1);
    const bridge_args = box.st.decide[0];
    assert.strictEqual(bridge_args.draft_id, card.draft_id);
    assert.strictEqual(bridge_args.decision, 'reply');
    assert.ok(!('lines' in bridge_args));
    if (n === 9001) assert.strictEqual(bridge_args.note,
      'APPROVE: REQ26-90001-01\nREQ26-90001-01: Execution=Outsourced; Qty=2; Occurrence=1; Note=Client wants satin finish');
    else assert.strictEqual(bridge_args.note, 'reject');
    payloads[name] = { bridge_args, agent_message_input: { about: card.draft_id, project_id: card.project_id, text: bridge_args.note },
      card: { draft_id: card.draft_id, project_id: card.project_id, type: card.type, status: card.status, handover: card.handover } };
  }
  console.log(JSON.stringify(payloads, null, 2));
});
