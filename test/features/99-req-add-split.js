// Part of test/cue.test.js. Feature: REQ-ADD-SPLIT-2026-11-26 (Kiko, n8n2 chat 26 Nov 2026: "Approve" to building Add a requirement,
// Split into scopes as boxes and blank Qty from the approved mockup, BSE-Dev-Agents/reg-cards-mockup-1125 card (c)). Reply formats agreed
// with the Requirements Gathering chat, 25 Nov 2026. Uses edGrab / edView / edRows from 99-agent-card-edit.js.
test('RAS1 a ticked line with scopes sends one SPLIT line per scope after its values; a cleared Qty is sent blank, never 1', () => {
  const { ctx } = edGrab();
  const T = { t: { 'REQ26-11087-01': 1 }, a: {}, e: { 'REQ26-11087-01': { qty: '' } },
    s: { 'REQ26-11087-01': [{ item: 'Back wall frame', execution: 'Outsourced', qty: '1', occurrence: '1' }, { item: 'Logo; print', execution: 'In House', qty: '', occurrence: '2' }] } };
  const d = ctx.agdTickNote(edRows, T);
  assert.deepStrictEqual(d.note.split('\n'), ['APPROVE: REQ26-11087-01', 'REQ26-11087-01: Execution=Outsourced; Qty=; Occurrence=1',
    'SPLIT REQ26-11087-01 #1: Item=Back wall frame; Execution=Outsourced; Qty=1; Occurrence=1',
    'SPLIT REQ26-11087-01 #2: Item=Logo, print; Execution=In House; Qty=; Occurrence=2']);
  assert.strictEqual(d.badSplits, undefined);
  const untouched = ctx.agdTickNote(edRows, { t: { 'REQ26-11087-01': 1 }, a: {} });
  assert.ok(/Qty=2/.test(untouched.note) && !/SPLIT/.test(untouched.note), 'an untouched line keeps its Qty and has no scopes');
});
test('RAS2 a scope with no Item, a wrong Execution, or a Qty or Occurrence that is not a whole number of 1 or more is refused before sending', () => {
  const { ctx } = edGrab(), bad = s => ctx.agdTickNote(edRows, { t: { 'REQ26-11087-01': 1 }, a: {}, s: { 'REQ26-11087-01': [s] } }).badSplits;
  assert.deepStrictEqual(Array.from(bad({ item: '', execution: 'In House', occurrence: '1' })), ['REQ26-11087-01']);
  assert.deepStrictEqual(Array.from(bad({ item: 'Wall', execution: 'Freelance', occurrence: '1' })), ['REQ26-11087-01']);
  assert.deepStrictEqual(Array.from(bad({ item: 'Wall', execution: 'In House', occurrence: '' })), ['REQ26-11087-01']);
  assert.deepStrictEqual(Array.from(bad({ item: 'Wall', execution: 'In House', qty: '1.5', occurrence: '1' })), ['REQ26-11087-01']);
  assert.strictEqual(bad({ item: 'Wall', execution: 'In House', qty: '', occurrence: '1' }), undefined, 'a blank Qty is fine');
});
test('RAS3 an added line is one ADD reply; Add stays inactive until a name or description, Execution and Occurrence are filled', () => {
  const { ctx } = edGrab();
  assert.strictEqual(ctx.agdAddLine({ name: 'Menu board', description: '60 x 90 cm;\nfoam board', sourcing: 'Outsourced', qty: '', occurrence: '1' }, 1),
    'ADD #1: Item=Menu board; Description=60 x 90 cm, foam board; Execution=Outsourced; Qty=; Occurrence=1');
  assert.strictEqual(ctx.agdAddLine({ name: 'Menu board', sourcing: 'Outsourced', occurrence: '' }, 1), '');
  assert.strictEqual(ctx.agdAddLine({ name: '', description: '', sourcing: 'Outsourced', occurrence: '1' }, 1), '');
  assert.strictEqual(ctx.agdAddLine({ name: 'X', sourcing: 'Freelance', occurrence: '1' }, 1), '');
  assert.strictEqual(ctx.agdAddLine({ name: 'X', sourcing: 'In House', qty: '0', occurrence: '1' }, 1), '');
  assert.ok(/^ADD #2: Item=; Description=Signage/.test(ctx.agdAddLine({ description: 'Signage', sourcing: 'In House', occurrence: '3' }, 2)), 'a description alone is enough');
});
test('RAS4 the card: Split into scopes opens boxes; Add a requirement shows a New line, then an added line shows Approved and Added by you', () => {
  const { ctx } = edGrab(), v = edView(); ctx.agdRows[v.id] = 'all'; ctx.agdRowOpen[v.id] = 'REQ26-11087-01';
  let h = ctx.agdUpdHtml(v);
  assert.ok(/data-act="agd-add-new"[^>]*>Add a requirement</.test(h));
  ctx.agdTick[v.id] = { t: {}, a: {}, s: { 'REQ26-11087-01': [{}, {}] }, add: [{ name: 'Menu board' }] };
  h = ctx.agdUpdHtml(v);
  assert.strictEqual((h.match(/data-agsc="[^"]+" data-req="REQ26-11087-01" data-i="1"/g) || []).length, 5, 'four boxes and Remove on the second scope');
  assert.ok(/>Add a scope</.test(h) && /<span class="tag warn">New<\/span>/.test(h));
  assert.ok(/data-act="agd-add-send"[^>]*disabled>Add</.test(h), 'Add is inactive until Execution and Occurrence are filled');
  ctx.agdTick[v.id].add = [{ name: 'Menu board', sourcing: 'Outsourced', occurrence: '1' }];
  assert.ok(!/data-act="agd-add-send"[^>]*disabled/.test(ctx.agdUpdHtml(v)));
  v.agd.replies = [{ at: 'x', text: 'ADD #1: Item=Menu board; Description=; Execution=Outsourced; Qty=; Occurrence=1' }];
  ctx.agdTick[v.id].add = [];
  h = ctx.agdUpdHtml(v);
  assert.ok(/<tr class="agrow agadded"><td class="c agtk"><span class="tag good">Approved<\/span><\/td><td class="c">04<\/td><td><span class="rn">Menu board<\/span><span class="rid">Added by you<\/span>/.test(h), h);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.agdAdded(v.agd))), [{ n: 1, name: 'Menu board', description: '', sourcing: 'Outsourced', qty: '', occurrence: '1' }]);
});
test('RAS5 the page wiring: Add asks "Are you sure you want to add?" and sends one reply; Send decision refuses broken scopes', () => {
  const page = cuePage();
  assert.ok(/agdSure\('Are you sure you want to add\?', 'The requirement is approved and sent to Account Specialist\.'/.test(page));
  assert.ok(/call\('cueAgdDecide', \[id, \{ decision: 'reply', note: aLine \}\]/.test(page));
  assert.ok(/Check the scopes on ' \+ splitCheck\.join/.test(page));
  assert.ok(!/Preview only · Not connected to AS/.test(page));
});
