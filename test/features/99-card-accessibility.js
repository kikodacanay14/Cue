test('ACC4611 phased intake rendered edit controls link unique row labels without changing field selectors', () => {
  const page = cuePage(), fn = name => page.slice(page.indexOf('  function ' + name + '('), page.indexOf('\n  }\n', page.indexOf('  function ' + name + '(')) + 4);
  const helpers = ['cardEditLabel', 'cardEditInput', 'cardEditSelect', 'inp'].filter(name => page.includes('  function ' + name + '(')).map(name => {
    if (name === 'inp' && !page.includes('  function cardEditInput(')) return page.match(/  function inp\([^\n]+/)[0];
    return fn(name);
  }).join('\n');
  const line = (key, item) => ({ key, item, spec: 'Flex', sourcing: '', quantity: 2, days: 3, execution: 'Outsourced',
    unit_cost: 1, unit_price: 2, cost_basis: 'fixture' });
  const rows = [line('R1', 'Stage'), line('R2', 'Wall')];
  const base = { running: {}, editing: { 'q1': 1 }, phAdd: { 'q1': 2 }, pickMode: {}, rqEdit: {}, WORK: {}, CLOSED: {}, PHN: ['', 'Details', 'Requirements', 'Costing', 'RFQs'],
    srcHtml: () => '', peso: x => String(x), secHtml: () => '', metricLine: () => '', foldersHtml: () => '', pickCount: () => 0 };
  const card = (phase, ext, key = 'q1') => vm.runInNewContext(fn('esc') + '\n' + helpers + '\n' + fn('phCardHtml') + '\nphCardHtml(r)', {
    ...base, editing: { [key]: 1 }, r: { id: key, status: 'Needs you', ph: { phase, x: { client: {}, event: {} },
      rows, lines: rows, rfqs: [], totals: {}, ...ext } }
  });
  const review = card(2) + card(3, {}, 'q2') + card(4, { pick: { mode: 'line', lines: rows.map(l => ({ key: l.key, suppliers: [] })) } }, 'q3') + card(1, {}, 'q4');
  const controls = [...review.matchAll(/<(?:input|select)\b(?=[^>]*\b(?:data-field|data-f|data-pick-add|data-ph-note)(?:=|\s))[^>]*>/g)]
    .filter(m => !/data-f="(?:remove|blank)"/.test(m[0]));
  assert.ok(controls.length >= 30);
  const ids = controls.map(m => (m[0].match(/\bid="([^"]+)"/) || [])[1]);
  assert.equal(new Set(ids).size, ids.length, 'actual form control IDs are unique');
  ids.forEach(id => assert.ok(id && review.includes('for="' + id + '"'), 'physical label for ' + id));
  assert.match(review, />Quantity for requirement R2<\/label>/);
});

test('ACC4612 Requirements and Project Update emit true or false for active and inactive controls', () => {
  const { ctx } = edGrab(), r = edView();
  const closed = ctx.agdUpdHtml(r);
  assert.match(closed, /aria-expanded="false">Open requirements/);
  ctx.agdRows[r.id] = 'all';
  ctx.agdRowOpen[r.id] = 'REQ26-11087-01';
  const open = ctx.agdUpdHtml(r);
  assert.match(open, /aria-expanded="true">Open requirements/);
  assert.match(open, /data-row="REQ26-11087-01" tabindex="0" aria-expanded="true"/);
  assert.match(open, /data-row="REQ26-11087-02" tabindex="0" aria-expanded="false"/);
  assert.match(open, /data-agf="all"[^>]*aria-pressed="true"/);
  assert.match(open, /data-agf="need"[^>]*aria-pressed="false"/);
  const page = cuePage(), a = page.indexOf('  function agdProjectUpdateHtml(');
  const box = { esc: x => String(x == null ? '' : x), agdUpdateView: {}, agdUpdateSelected: {}, r };
  const code = page.slice(a, page.indexOf('\n  }\n', a) + 4) + '\nagdProjectUpdateHtml(r, false)';
  const all = vm.runInNewContext(code, box);
  assert.match(all, /data-view="all" aria-pressed="true"/);
  box.agdUpdateView[r.id] = 'selected';
  const selected = vm.runInNewContext(code, box);
  assert.match(selected, /data-view="all" aria-pressed="false"/);
  assert.match(selected, /data-view="selected" aria-pressed="true"/);
});

test('ACC4613 legacy proposal facts have row headers and cost controls retain attached labels', () => {
  const page = cuePage(), take = name => {
    const a = page.indexOf('  function ' + name + '(');
    return page.slice(a, page.indexOf('\n  }\n', a) + 4);
  };
  const code = page.match(/  function esc\([^\n]+/)[0] + '\n'
    + ['cardEditLabel', 'cardEditInput', 'cardEditSelect', 'inp', 'cardBody'].map(take).join('\n') + '\ncardBody(r)';
  const r = { id: 'legacy', kind: 'intake', status: 'Needs you', proposal: { client: {}, event: {}, rfqs: [], lines: [
    { key: 'R01', description: 'Stage', status: 'included', quantity: 2, occurrence: 1, execution: 'Outsourced', unit_cost: 400, unit_price: 480 }
  ] } };
  const html = vm.runInNewContext(code, {
    r, editing: { legacy: 1 }, secOpen: {}, NEED: { 'Needs you': 1 }, peso: n => String(n), metricLine: () => '', srcHtml: () => '',
    secHtml: (k, t, b) => b
  });
  assert.match(html, /<table class="facts"><tr><th scope="row">Contacts<\/th><td>/);
  assert.match(html, /<th scope="row">Event name<\/th>/);
  assert.match(html, /<label[^>]*for="legacy-line-0-unit_cost">Unit cost for proposal line R01<\/label><input id="legacy-line-0-unit_cost" data-f="unit_cost"/);
});
