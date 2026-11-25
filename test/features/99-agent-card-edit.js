// Part of test/cue.test.js. Feature: AGENT-CARD-EDIT-2026-11-18 (Kiko 18 Nov 2026 14:53:25Z, Dot audit finding 7: "The structured card
// displays execution type, quantity and occurrence as text. Kiko requested that he be able to edit them. Add and verify editing and the
// approved values' return to the agent"). Line format agreed with the AS and step 12A threads (18 Nov 2026 14:56Z):
// "REQ-ID: Execution=Outsourced; Qty=2; Occurrence=3", one per ticked line, after the APPROVE line; a value the line has none of is left out.
const edRows = [
  { req_id: 'REQ26-11087-01', name: 'Registration setup', sourcing: 'Outsourced', spec_by: 'AS', needs_kiko: false, open_items: [], qty: 2, occurrence: 1 },
  { req_id: 'REQ26-11087-02', name: 'Stage', sourcing: '', spec_by: 'MM', needs_kiko: false, open_items: [], qty: 0, occurrence: 0 },
  { req_id: 'REQ26-11087-03', name: 'Chairs', sourcing: 'In House', spec_by: 'AS', needs_kiko: true, open_items: ['Q1: How many chairs?'], qty: 100, occurrence: 1 }];
function edGrab() {
  const page = cuePage(), grab = name => { const a = page.indexOf('  function ' + name + '('); return page.slice(a, page.indexOf('\n  }\n', a) + 4); };
  const ctx = { editing: {}, agdRows: {}, agdRowOpen: {}, agdTick: {} }; vm.createContext(ctx);
  vm.runInContext(['esc', 'agKv', 'agdQs', 'agdEditVal', 'agdTickNote', 'agdQsHtml', 'agdTallyText', 'agdTxt', 'agdWhole', 'agdAdded', 'agdAddLine', 'agdSplitLines', 'agdRowsHtml', 'agdCheck', 'agdCkSum', 'agdUpdHtml'].map(grab).join('\n'), ctx);
  return { page, ctx };
}
const edView = (agd) => { const b = agdBox({ drafts: [agdUpd(70, { project: 'Canvas', project_id: 'S-31753672CA', agent: 'AS agent',
  handover: { handover_ref: 'REQ-APPROVAL', summary: 'Approve the list.', state: 'Waiting for approval', rows: edRows } })] });
  b.t.ctx.cueAgdTick_(); const v = JSON.parse(JSON.stringify(b.t.ctx.cueView_(b.reqs()[0]))); Object.assign(v.agd, agd || {}); return v; };

test('ACE1 a line Kiko can tick shows Execution as a list and Qty and Occurrence as number boxes; a waiting line stays plain text', () => {
  const { ctx } = edGrab(), v = edView(); ctx.agdRows[v.id] = 'all'; const h = ctx.agdUpdHtml(v);
  assert.ok(/<td class="c" onclick="event\.stopPropagation\(\)"><select class="aged" data-agedit="[^"]+" data-req="REQ26-11087-01" data-k="sourcing" aria-label="Execution for Registration setup"><option>In House<\/option><option selected>Outsourced<\/option><\/select><\/td>/.test(h), h);
  assert.ok(/data-req="REQ26-11087-01" data-k="qty" aria-label="Qty for Registration setup" value="2"/.test(h) && /data-req="REQ26-11087-01" data-k="occurrence" aria-label="Occurrence \(days\) for Registration setup" value="1"/.test(h));
  assert.ok(/data-req="REQ26-11087-02" data-k="sourcing"[^>]*><option value="" selected>—<\/option>/.test(h), 'no Execution yet: the list starts blank');
  assert.ok(/data-req="REQ26-11087-02" data-k="qty" aria-label="Qty for Stage" value=""/.test(h), 'no quantity yet: the box is empty');
  assert.ok(!/data-req="REQ26-11087-03"/.test(h), 'a line waiting for an answer is not editable');
  assert.ok(/type="number" min="1" step="1" inputmode="numeric"/.test(h));
});
test('ACE2 Send decision returns the approved values of each ticked line, with Kiko\'s edits; an unticked edit is not sent', () => {
  const { ctx } = edGrab();
  const T = { t: { 'REQ26-11087-01': 1, 'REQ26-11087-02': 1 }, a: { Q1: '120' },
    e: { 'REQ26-11087-01': { sourcing: 'In House', qty: '4', occurrence: '2' }, 'REQ26-11087-02': { qty: '1' }, 'REQ26-11087-03': { qty: '999' } } };
  const n = JSON.parse(JSON.stringify(ctx.agdTickNote(edRows, T)));
  assert.deepStrictEqual(n, { note: 'APPROVE: REQ26-11087-01, REQ26-11087-02\nREQ26-11087-01: Execution=In House; Qty=4; Occurrence=2\nREQ26-11087-02: Qty=1\nQ1: 120', ticked: 2, answered: 1, bad: [] });
  assert.strictEqual(ctx.agdTickNote(edRows, { t: { 'REQ26-11087-01': 1 }, a: {} }).note, 'APPROVE: REQ26-11087-01\nREQ26-11087-01: Execution=Outsourced; Qty=2; Occurrence=1', 'unchanged values are sent as the approved copy');
});
test('ACE3 a Qty or Occurrence that is not a whole number of 1 or more is named and blocks Send decision', () => {
  const { ctx, page } = edGrab();
  ['0', '2.5', '-1', 'two'].forEach(q => assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.agdTickNote(edRows, { t: { 'REQ26-11087-01': 1 }, a: {}, e: { 'REQ26-11087-01': { qty: q } } }).bad)), ['REQ26-11087-01'], q));
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.agdTickNote(edRows, { t: { 'REQ26-11087-01': 1 }, a: {}, e: { 'REQ26-11087-01': { qty: '12' } } }).bad)), []);
  assert.ok(/if \(tb\.length\) return alertErr\(new Error\('Qty and Occurrence must be whole numbers of 1 or more\. Check ' \+ tb\.join/.test(page));
});
test('ACE4 an approved line shows the values Kiko approved, read back from his reply', () => {
  const { ctx } = edGrab(), txt = 'APPROVE: REQ26-11087-01\nREQ26-11087-01: Execution=In House; Qty=4; Occurrence=2';
  const v = edView({ status: 'Replied', replies: [{ at: '2026-11-18 23:10', text: txt }] }); ctx.agdRows[v.id] = 'all'; const h = ctx.agdUpdHtml(v);
  assert.ok(/<span class="tag good">Approved<\/span><\/td><td class="c">01<\/td><td><span class="rn">Registration setup<\/span><span class="rid">REQ26-11087-01<\/span><\/td><td class="c">In House<\/td><td class="c">4<\/td><td class="c">2<\/td>/.test(h), h);
});
test('ACE5 the page keeps edits across redraws, sends them through the same Canvas reply, and the boxes are 44 px tall', () => {
  const { page } = edGrab(), css = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexStyle.html'), 'utf8');
  assert.ok(/querySelectorAll\('\[data-agedit\]'\)/.test(page) && /T\.e = T\.e \|\| \{\}/.test(page) && /agdSync\(rid\); \}; \}\);/.test(page));
  assert.ok(/\.agdp \.aged \{ min-height:44px/.test(css));
  const b = agdBox({ drafts: [agdUpd(71, { project_id: 'S-31753672CA', agent: 'AS agent', handover: { handover_ref: 'R', summary: 's', state: 'Waiting for approval', rows: edRows } })],
    answer: (a, st) => { const x = st.drafts[0]; Object.assign(x, { status: 'Replied', note: a.note }); return { ok: true, draft: Object.assign({}, x) }; } });
  b.t.ctx.cueAgdTick_(); const id = b.reqs()[0].id, note = 'APPROVE: REQ26-11087-01\nREQ26-11087-01: Execution=In House; Qty=4; Occurrence=2\n' + 'Q1: ' + 'x'.repeat(3000);
  b.t.ctx.cueAgdDecide(id, { decision: 'reply', note });
  assert.strictEqual(b.st.decide[0].note, note, 'a decision over 2,000 characters reaches Canvas whole'); assert.strictEqual(bridgeCheck('agent_draft_decide', b.st.decide[0]), '');
});
