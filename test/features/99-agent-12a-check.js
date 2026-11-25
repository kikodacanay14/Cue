// Part of test/cue.test.js. Feature: REQ-APPROVAL-12A-2026-11-18 (Kiko 18 Nov 2026 14:44Z: at step 12A he approves requirement by
// requirement; approved lines save; a check confirms Canvas matches what he approved. His answer A 15:01Z: a difference is listed and
// nothing is fixed on its own. Mockup https://claude.ai/artifact/8NauUhVVuTghwKzZu3ktHM approved with "Build" 16:16Z).
// Canvas sends the check per requirement on agent_drafts (approval_check) and on the decide answer (approval).
const ckRows = [
  { req_id: 'REQ26-11087-01', name: 'Stage', sourcing: 'Outsourced', spec_by: 'AS', needs_kiko: false, open_items: [], qty: 2, occurrence: 3 },
  { req_id: 'REQ26-11087-02', name: 'Backdrop', sourcing: '', spec_by: 'AS', needs_kiko: false, open_items: [], qty: 2, occurrence: 1 },
  { req_id: 'REQ26-11087-03', name: 'Lights', sourcing: '', spec_by: 'AS', needs_kiko: false, open_items: [], qty: 4, occurrence: 2 },
  { req_id: 'REQ26-11087-04', name: 'LED wall', sourcing: '', spec_by: 'AS', needs_kiko: true, open_items: ['Q1: Venue size?'], qty: 1, occurrence: 1 }];
const CK_NOTE = 'APPROVE: REQ26-11087-01, REQ26-11087-02, REQ26-11087-03\nREQ26-11087-01: Execution=Outsourced; Qty=2; Occurrence=3\n'
  + 'REQ26-11087-02: Execution=In House; Qty=2; Occurrence=1\nREQ26-11087-03: Execution=Outsourced; Qty=4; Occurrence=2';
const CK = { checked_at: '2026-11-18 23:10', lines: [{ req_id: 'REQ26-11087-01', verdict: 'match', diffs: [] }, { req_id: 'REQ26-11087-02', verdict: 'match', diffs: [] },
  { req_id: 'REQ26-11087-03', verdict: 'differs', diffs: [{ field: 'execution', approved: 'Outsourced', saved: '' }] }, { req_id: 'REQ26-11087-04', verdict: 'held', diffs: [] }] };
const ckUpd = (o) => agdUpd(80, Object.assign({ project: 'Canvas', project_id: 'S-31753672CA', agent: 'AS agent',
  handover: { handover_ref: 'PI-12A', summary: 'Approve the list.', state: 'Waiting for approval', rows: ckRows } }, o || {}));
function ckGrab() {
  const page = cuePage(), grab = name => { const a = page.indexOf('  function ' + name + '('); return page.slice(a, page.indexOf('\n  }\n', a) + 4); };
  const a = page.indexOf('  // REQ-APPROVAL-12A-2026-11-18'), blk = page.slice(a, page.indexOf('  // AGENT-CARD-EDIT-2026-11-18 (Kiko 18 Nov 2026 14:53:25Z', a));
  const ctx = { editing: {}, agdRows: {}, agdRowOpen: {}, agdTick: {} }; vm.createContext(ctx);
  vm.runInContext(['esc', 'agKv', 'agdQs', 'agdApproved', 'agdEditVal', 'agdTickNote', 'agdQsHtml', 'agdTallyText', 'agdTxt', 'agdWhole', 'agdAdded', 'agdAddLine', 'agdSplitLines', 'agdRowsHtml', 'agdUpdHtml'].map(grab).join('\n') + '\n' + blk, ctx);
  return { page, ctx };
}
const ckView = (b) => JSON.parse(JSON.stringify(b.t.ctx.cueView_(b.reqs()[0])));

test('A12C1 Canvas\'s check on agent_drafts reaches the card; a newer check (a hand change in Canvas) replaces it; bad verdicts are dropped', () => {
  const d = ckUpd({ approval_check: CK });
  const b = agdBox({ drafts: [d] }); b.t.ctx.cueAgdTick_();
  assert.deepStrictEqual(ckView(b).agd.approval_check, CK);
  d.approval_check = { checked_at: '2026-11-18 23:40', lines: CK.lines.slice(0, 1).concat([{ req_id: 'REQ26-11087-02', verdict: 'differs', diffs: [{ field: 'occurrence', approved: 1, saved: '7' }] },
    { req_id: 'X', verdict: 'maybe', diffs: [] }]) };
  Object.assign(d, { status: 'Replied', replies: [{ at: '2026-11-18 23:10', text: CK_NOTE }] }); b.due(); b.t.ctx.cueAgdTick_();
  const k = ckView(b).agd.approval_check;
  assert.deepStrictEqual(k.lines.map(l => l.req_id + ' ' + l.verdict), ['REQ26-11087-01 match', 'REQ26-11087-02 differs']);
  assert.deepStrictEqual(k.lines[1].diffs, [{ field: 'occurrence', approved: '1', saved: '7' }]);
  assert.strictEqual(bridgeCheck('agent_drafts', { days: 3 }), '');
});
test('A12C2 after Send decision the chat says what Canvas holds, lists each difference and says nothing was changed automatically', () => {
  const b = agdBox({ drafts: [ckUpd()], answer: (a, st) => { const x = st.drafts[0]; Object.assign(x, { status: 'Replied', note: a.note });
    return { ok: true, draft: Object.assign({}, x), message: { message_id: 'DRF-0081', at: '2026-11-18 23:10' },
      approval: { checked_at: '2026-11-18 23:10', lines: CK.lines.slice(0, 3).map(l => Object.assign({ approved: {}, saved: {} }, l)), summary: '12A check', error: '' } }; } });
  b.t.ctx.cueAgdTick_(); const id = b.reqs()[0].id;
  b.t.ctx.cueAgdDecide(id, { decision: 'reply', note: CK_NOTE });
  assert.ok(b.chat(id).some(l => l === 'Approved 3 lines. Canvas check: 2 match, 1 differs (REQ26-11087-03: Execution approved Outsourced, Canvas has blank). Nothing was changed automatically.'), b.chat(id).join('|'));
  assert.deepStrictEqual(ckView(b).agd.approval_check.lines.map(l => l.verdict), ['match', 'match', 'differs']);
});
test('A12C3 the card shows a Canvas check column: Matches Canvas, Differs with the field, Waiting; a totals line above the table', () => {
  const { ctx } = ckGrab(), v = { id: 'cue-x', agd: Object.assign(ckUpd(), { status: 'Replied', replies: [{ at: '2026-11-18 23:10', text: CK_NOTE }], approval_check: CK }), status: 'Done' };
  ctx.agdRows[v.id] = 'all'; const h = ctx.agdRowsHtml(v, true, false);
  assert.ok(/<th>Occurrence \(days\)<\/th><th>Canvas check<\/th><\/tr>/.test(h), 'new column header, centred by the panel rule');
  assert.ok(/<div class="agcks" role="status"><b>Canvas check: 2 match, 1 differs, 1 waiting<\/b><span class="small muted">Checked 2026-11-18 23:10<\/span><\/div>/.test(h), h);
  assert.ok(/REQ26-11087-01<\/span><\/td><td class="c">Outsourced<\/td><td class="c">2<\/td><td class="c">3<\/td><td class="c"><span class="tag good">Matches Canvas<\/span><\/td>/.test(h), 'a matching line stays approved');
  assert.ok(/<span class="tag crit">Differs<\/span><span class="agck">Execution: you approved Outsourced, Canvas has blank<\/span>/.test(h));
  assert.ok(/REQ26-11087-04[\s\S]*<span class="tag warn">Waiting<\/span>/.test(h));
});
test('A12C4 a line that differs opens again with the values Kiko approved, so ticking it sends them again; a matching line cannot be ticked', () => {
  const { ctx } = ckGrab(), v = { id: 'cue-y', agd: Object.assign(ckUpd(), { status: 'Replied', replies: [{ at: '2026-11-18 23:10', text: CK_NOTE }], approval_check: CK }), status: 'Done' };
  ctx.agdRows[v.id] = 'all'; const h = ctx.agdRowsHtml(v, true, false);
  assert.ok(/value="REQ26-11087-03" aria-label="Approve Lights"/.test(h), 'the differing line has a tick box again');
  assert.ok(!/value="REQ26-11087-01"/.test(h), 'the matching line shows Approved, no tick box');
  assert.ok(/data-req="REQ26-11087-03" data-k="sourcing"[^>]*><option>In House<\/option><option selected>Outsourced<\/option>/.test(h), 'Execution starts at the approved Outsourced');
  ctx.agdTick['cue-y'].t = { 'REQ26-11087-03': 1 };
  assert.strictEqual(ctx.agdTickNote(ckRows, ctx.agdTick['cue-y']).note, 'APPROVE: REQ26-11087-03\nREQ26-11087-03: Execution=Outsourced; Qty=4; Occurrence=2');
});
test('A12C5 a card with no check looks as before; the check styles exist', () => {
  const { ctx } = ckGrab(), v = { id: 'cue-z', agd: ckUpd(), status: 'Needs you' }; ctx.agdRows[v.id] = 'all'; const h = ctx.agdRowsHtml(v, true, false);
  assert.ok(!/Canvas check/.test(h) && !/agcks/.test(h));
  const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexStyle.html'), 'utf8');
  assert.ok(/\.agdp \.agck \{[^}]*text-align:center/.test(css) && /\.agdp \.agcks \{/.test(css));
});
