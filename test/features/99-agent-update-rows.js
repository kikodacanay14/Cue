// Part of test/cue.test.js. Feature: AGENT-UPDATE-ROWS-2026-11-16 (Kiko 16 Nov 2026 11:58:14Z "maybe something like a card then can
// be clicked opens that opens a window on the left"; columns trimmed 12:19:11Z "remove Status and Handed to - the Kind no need as well";
// mockup v2 approved 12:23:52Z; panel on the left, AS sets Needs you per row, view only: "ok" 12:25:28Z). An agent update that carries
// requirement rows shows as one short card; tapping it opens a panel on the left with one row per requirement.
const aurRows = [
  { req_id: 'REQ26-11083-01', name: 'Registration setup', sourcing: 'Outsourced', spec_by: 'AS', needs_kiko: false, open_items: [] },
  { req_id: 'REQ26-11083-04', name: 'Entrance', sourcing: 'Outsourced', spec_by: 'MM', dimensions: '', needs_kiko: true,
    open_items: ['Variants or separate builds', 'Endpoints', 'Dressed footprints'] },
  { req_id: 'REQ26-11083-05', name: 'Photo wall <b>', sourcing: 'Outsourced', spec_by: 'MM', dimensions: '3.0 m W × 2.4 m H', needs_kiko: true, open_items: ['Final size'] }];
const aurUpd = (n, rows) => agdUpd(n, { project: 'Pandamart Likha', project_id: 'S-31753672PA', agent: 'AS agent',
  handover: { handover_ref: 'REQ-REVIEW-01', summary: '3 requirements reviewed.', gaps: 'Entrance specs open.', state: 'Delivered', rows } });
function aurGrab() {
  const page = cuePage(), grab = name => { const a = page.indexOf('  function ' + name + '('); return page.slice(a, page.indexOf('\n  }\n', a) + 4); };
  const ctx = { editing: {}, agdRows: {}, agdRowOpen: {}, agdTick: {} }; vm.createContext(ctx);
  vm.runInContext(grab('esc') + '\n' + grab('agKv') + '\n' + grab('agdQs') + '\n' + grab('agdEditVal') + '\n' + grab('agdTickNote') + '\n' + grab('agdQsHtml') + '\n' + grab('agdTallyText') + '\n' + ['agdTxt', 'agdWhole', 'agdAdded', 'agdAddLine', 'agdSplitLines'].map(grab).join('\n') + '\n' + grab('agdRowsHtml') + '\n' + grab('agdCheck') + '\n' + grab('agdCkSum') + '\n' + grab('agdUpdHtml'), ctx);
  return { page, ctx };
}
test('AUR1 rows from Canvas are kept clean: only the approved fields, In House or Outsourced, AS or MM, Needs you only when true, at most 100', () => {
  const t = sandbox({});
  const h = t.ctx.cueAgdHand_({ handover_ref: 'X', summary: 'y', state: 'Delivered', rows: [
    { req_id: 'REQ26-1', name: 'Stage', sourcing: 'Outsourced', spec_by: 'MM', dimensions: '6 m W', needs_kiko: true, open_items: ['a', 2, ''], status: 'Spec open', kind: 'Fabrication', handed_to: ['ECII'] },
    { req_id: 'REQ26-2', name: 'Host', sourcing: 'Freelance', spec_by: 'ECII', needs_kiko: 'yes' },
    { req_id: 'REQ26-3', name: ' ' }, null, 'text'] });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(h.rows)), [
    { req_id: 'REQ26-1', name: 'Stage', sourcing: 'Outsourced', spec_by: 'MM', dimensions: '6 m W', needs_kiko: true, open_items: ['a', '2'], images: [], description: '', qty: 0, occurrence: 0 },
    { req_id: 'REQ26-2', name: 'Host', sourcing: '', spec_by: '', dimensions: '', needs_kiko: false, open_items: [], images: [], description: '', qty: 0, occurrence: 0 }]);   // AGENT-ROW-PICTURES-2026-11-18 adds images; AGENT-CARD1-LAYOUT-2026-11-18 adds description, qty, occurrence
  assert.deepStrictEqual(JSON.parse(JSON.stringify(t.ctx.cueAgdHand_({ summary: 'y' }).rows)), [], 'an update without rows has none');
  const many = t.ctx.cueAgdHand_({ rows: Array.from({ length: 130 }, (_, i) => ({ name: 'R' + i, open_items: Array(30).fill('x') })) });
  assert.strictEqual(many.rows.length, 100); assert.strictEqual(many.rows[0].open_items.length, 20);
});
test('AUR2 an update with rows is one short card; the panel is shut until tapped and lists every row, the ones that need Kiko first', () => {
  const b = agdBox({ drafts: [aurUpd(50, aurRows)] }); b.t.ctx.cueAgdTick_();
  const v = JSON.parse(JSON.stringify(b.t.ctx.cueView_(b.reqs()[0]))), { ctx } = aurGrab(), shut = ctx.agdUpdHtml(v);
  assert.ok(/Account Specialist agent · Pandamart Likha · 3 requirements · 2 need you/.test(shut), shut);   // AGENT-FULL-NAMES-2026-11-18
  assert.ok(/class="tag crit">2 need you/.test(shut) && /class="tag warn">Unread/.test(shut) && /data-act="agd-rows"/.test(shut) && /Open requirements/.test(shut));
  assert.ok(!/class="facts"/.test(shut) && !/class="agdp"/.test(shut) && !/data-act="agd-read"/.test(shut), 'short card: no facts table, no panel, no buttons');
  ctx.agdRows[v.id] = 1; const open = ctx.agdUpdHtml(v);
  assert.ok(/<aside class="agdp"/.test(open) && /aria-label="Pandamart Likha · 3 requirements"/.test(open));
  const heads = (open.match(/<th[^>]*>[^<]*<\/th>/g) || []).map(x => x.replace(/<[^>]+>/g, ''));
  assert.deepStrictEqual(heads, ['#', 'Requirement', 'Execution', 'Qty', 'Occurrence (days)']);   // AGENT-CARD1-LAYOUT-2026-11-18
  assert.ok(!/Status|Handed to|Kind|Fabrication/.test(open), 'Kiko removed Status, Handed to and Kind');
  const order = (open.match(/class="rid">REQ26-11083-\d\d/g) || []).map(x => x.slice(12));   // AGENT-ROW-PICTURES-2026-11-18: rows also carry the ID in data-row
  assert.deepStrictEqual(order, ['REQ26-11083-04', 'REQ26-11083-05', 'REQ26-11083-01']);
  assert.ok(/Photo wall &lt;b&gt;/.test(open) && !/MM to add|3\.0 m W/.test(open), 'dimensions live in the open row, not the table');
  ctx.agdRowOpen = { [v.id]: 'REQ26-11083-05' }; const r5 = ctx.agdUpdHtml(v);
  assert.ok(/3\.0 m W × 2\.4 m H<span class="rid">by MM/.test(r5) && /<li>Final size<\/li>/.test(r5), 'the open row shows dimensions and open items');
  ctx.agdRowOpen = { [v.id]: 'REQ26-11083-04' }; assert.ok(/MM to add/.test(ctx.agdUpdHtml(v))); ctx.agdRowOpen = {};
  assert.ok(/data-agf="need"/.test(open) && /All 3/.test(open) && /Needs you 2/.test(open));
  assert.ok(/data-act="agd-read"/.test(open) && /data-act="agd-reply"/.test(open) && /data-agd-note=/.test(open), 'Mark read and Reply live in the panel footer');
  assert.ok(!/<input[^>]*data-f=|<select|contenteditable/.test(open), 'view only');
  const nv = JSON.parse(JSON.stringify(v)); nv.agd.handover.rows = []; const old = ctx.agdUpdHtml(nv);
  assert.ok(/Agent update · Handover/.test(old) && /class="facts"/.test(old) && !/agd-rows/.test(old), 'without rows the card stays as it is');
});
test('AUR3 the page: Open requirements and ✕ toggle the panel before any Canvas decision; Esc closes it; it sits on the left over the chat', () => {
  const { page } = aurGrab(), css = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexStyle.html'), 'utf8');
  const a = page.indexOf("if (act === 'agd-rows')"), d = page.indexOf('if (/^agd-/.test(act))');
  assert.ok(a > 0 && a < d, 'the toggle runs before the Canvas decision branch');
  assert.ok(/agdRows = \{\}/.test(page) && /e\.key === 'Escape'/.test(page) && /data-agf/.test(page));
  assert.ok(/\.agdp \{[^}]*position:fixed[^}]*left:0/.test(css) && /\.agdp th \{[^}]*text-align:center/.test(css));
});
test('AUR4 rows go by requirement number (01, 02, 03 ...) within each group; the ones that need Kiko stay first', () => {
  // AGENT-ROWS-BY-NUMBER-2026-11-18 (Kiko 18 Nov 2026 08:02:18Z "can this be sorted by number?"; his panel showed 06, 08, 09, 01, 02).
  const mk = (n, need) => ({ req_id: 'REQ26-11087-' + n, name: 'R' + n, sourcing: 'Outsourced', spec_by: 'AS', needs_kiko: need, open_items: [] });
  const ids = rows => { const b = agdBox({ drafts: [aurUpd(51, rows)] }); b.t.ctx.cueAgdTick_();
    const v = JSON.parse(JSON.stringify(b.t.ctx.cueView_(b.reqs()[0]))), { ctx } = aurGrab(); ctx.agdRows[v.id] = 1;
    return (ctx.agdUpdHtml(v).match(/class="rid">REQ26-11087-\d+/g) || []).map(x => x.slice(24)); };
  assert.deepStrictEqual(ids(['06', '08', '09', '01', '02', '10', '03'].map(n => mk(n, false))), ['01', '02', '03', '06', '08', '09', '10']);
  assert.deepStrictEqual(ids([mk('06', false), mk('09', true), mk('01', false), mk('04', true)]), ['04', '09', '01', '06']);
});
