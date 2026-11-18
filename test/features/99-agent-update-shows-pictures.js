// Part of test/cue.test.js. Feature: AGENT-ROW-PICTURES-2026-11-18 (Kiko 18 Nov 2026 02:46:35Z "Can you propose a card also where
// i can view the image and not a link?"; 02:58:28Z "I prefer the table earlier that we have. Why not when a table row is clicked it
// expands and shows the images. When another row is clicked previous row closes and another one expands"; 03:03:36Z "The cue card 1
// that showed the images is approved"). Mockup: https://claude.ai/artifact/XCUNnJjumLDtuApXXmhK68 (card 1). The requirements panel
// keeps its table; tapping a row opens it and shows that requirement's MM pictures with their brief page; one row open at a time;
// a picture or the client brief opens in Cue's viewer over the panel. Files stay private: Drive thumbnails as Kiko, cueFileData fallback.
const aupId = 'a1b2c3d4e5f6g7h8i9j0';
const aupRows = [
  { req_id: 'REQ26-11083-04', name: 'Entrance arch', sourcing: 'Outsourced', spec_by: 'MM', needs_kiko: false, open_items: [],
    images: [{ file_id: aupId + '41', name: 'S-31753672PA-REQ26-11083-04-1.jpg', page: 4 }, { file_id: aupId + '42', name: 'S-31753672PA-REQ26-11083-04-2.jpg', page: 5 }] },
  { req_id: 'REQ26-11083-05', name: 'Directional signage', sourcing: 'Outsourced', spec_by: 'MM', needs_kiko: false, open_items: [] }];
const aupUpd = (n, rows, brief) => agdUpd(n, { project: 'Pandamart Likha', project_id: 'S-31753672PA', agent: 'AS agent',
  handover: { handover_ref: 'REQ-REVIEW-02', summary: '2 requirements.', state: 'Waiting for approval', rows, brief } });
function aupView(brief) {
  const b = agdBox({ drafts: [aupUpd(60, aupRows, brief)] }); b.t.ctx.cueAgdTick_();
  return JSON.parse(JSON.stringify(b.t.ctx.cueView_(b.reqs()[0])));
}
function aupGrab() {
  const page = cuePage(), grab = name => { const a = page.indexOf('  function ' + name + '('); return page.slice(a, page.indexOf('\n  }\n', a) + 4); };
  const ctx = { editing: {}, agdRows: {}, agdRowOpen: {} }; vm.createContext(ctx);
  vm.runInContext(grab('esc') + '\n' + grab('agKv') + '\n' + grab('agdRowsHtml') + '\n' + grab('agdUpdHtml'), ctx);
  return { page, ctx };
}
test('AUP1 pictures and the brief from Canvas are kept clean: Drive file IDs only, page a whole number, at most 20 per row', () => {
  const t = sandbox({});
  const h = t.ctx.cueAgdHand_({ summary: 'y', brief: { file_id: aupId + 'BR', name: 'Client brief.pdf', pages: 14, url: 'javascript:x' }, rows: [
    { req_id: 'R1', name: 'Arch', images: [{ file_id: aupId + '01', name: 'a.jpg', page: 4 }, { file_id: 'bad id"><', name: 'x' }, { file_id: aupId + '02', page: 'five' }, null] },
    { req_id: 'R2', name: 'Stage', images: Array.from({ length: 25 }, (_, i) => ({ file_id: aupId + 'z' + i, page: i + 1 })) },
    { req_id: 'R3', name: 'Mic' }] });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(h.brief)), { file_id: aupId + 'BR', name: 'Client brief.pdf', pages: 14 });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(h.rows[0].images)), [{ file_id: aupId + '01', name: 'a.jpg', page: 4 }, { file_id: aupId + '02', name: '', page: 0 }]);
  assert.strictEqual(h.rows[1].images.length, 20); assert.deepStrictEqual(JSON.parse(JSON.stringify(h.rows[2].images)), []);
  assert.strictEqual(t.ctx.cueAgdHand_({ summary: 'y' }).brief, null, 'no brief sent, none shown');
  assert.strictEqual(t.ctx.cueAgdHand_({ summary: 'y', brief: { file_id: 'nope' } }).brief, null, 'a brief without a Drive file ID is dropped');
});
test('AUP2 the panel keeps the table; a row opens to show its pictures with the brief page; one row open at a time; the brief opens in the viewer', () => {
  const v = aupView({ file_id: aupId + 'BR', name: 'S-31753672PA client brief.pdf', pages: 14 }), { ctx } = aupGrab();
  ctx.agdRows[v.id] = 'all'; const shut = ctx.agdUpdHtml(v);
  const heads = (shut.match(/<th[^>]*>[^<]*<\/th>/g) || []).map(x => x.replace(/<[^>]+>/g, ''));
  assert.deepStrictEqual(heads, ['#', 'Requirement', 'Sourcing', 'Specs by', 'Dimensions', 'Open items', 'Images'], 'same table as before');
  assert.ok(/<tr[^>]*data-act="agd-row"[^>]*data-row="REQ26-11083-04"[^>]*tabindex="0"[^>]*aria-expanded="false"/.test(shut), shut);
  assert.ok(!/class="agdet"/.test(shut), 'no row is open until tapped');
  assert.ok(/<td class="c">2 pictures<\/td>/.test(shut) && /<span class="ph">Later<\/span>/.test(shut), 'the Images cell counts the pictures; MM rows with none still say Later');
  assert.ok(/<a[^>]*data-agpic[^>]*href="https:\/\/drive\.google\.com\/file\/d\/a1b2c3d4e5f6g7h8i9j0BR\/view"[^>]*data-name="S-31753672PA client brief\.pdf"/.test(shut) && /14 pages/.test(shut), 'the client brief link sits at the top');
  ctx.agdRowOpen[v.id] = 'REQ26-11083-04'; const open = ctx.agdUpdHtml(v);
  assert.ok(/data-row="REQ26-11083-04"[^>]*aria-expanded="true"/.test(open) && /data-row="REQ26-11083-05"[^>]*aria-expanded="false"/.test(open));
  assert.strictEqual((open.match(/class="agdet"/g) || []).length, 1, 'one row open');
  assert.ok(/src="https:\/\/drive\.google\.com\/thumbnail\?id=a1b2c3d4e5f6g7h8i9j041&amp;sz=w320"/.test(open) && /onerror="cueThumb\(this,'a1b2c3d4e5f6g7h8i9j041'\)"/.test(open));
  assert.ok(/<span class="pg">Page 4<\/span>/.test(open) && /<span class="pg">Page 5<\/span>/.test(open));
  assert.ok(/data-agpic[^>]*href="https:\/\/drive\.google\.com\/file\/d\/a1b2c3d4e5f6g7h8i9j042\/view"[^>]*data-name="REQ26-11083-04 · brief page 5"/.test(open));
  ctx.agdRowOpen[v.id] = 'REQ26-11083-05'; const none = ctx.agdUpdHtml(v);
  assert.ok(/No pictures from MM yet/.test(none) && !/thumbnail\?id=a1b2c3d4e5f6g7h8i9j041/.test(none), 'the first row closed when the next opened');
  const nb = aupView(undefined); nb.agd.handover.brief = null; ctx.agdRowOpen = {}; assert.ok(!/14 pages|data-agpic/.test(ctx.agdUpdHtml(Object.assign(nb, { id: v.id }))), 'no brief, no link');
});
test('AUP3 the page: a row toggles before any Canvas decision; Enter or Space opens it; a picture opens in the viewer above the panel; Esc closes the viewer first', () => {
  const { page } = aupGrab(), css = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexStyle.html'), 'utf8');
  const a = page.indexOf("if (act === 'agd-row')"), d = page.indexOf('if (/^agd-/.test(act))');
  assert.ok(a > 0 && a < d, 'the row toggle runs before the Canvas decision branch');
  assert.ok(/agdRowOpen\[id\] === k\) delete agdRowOpen\[id\]; else agdRowOpen\[id\] = k/.test(page), 'tapping the open row closes it; another row replaces it');
  assert.ok(/closest\('a\[data-agpic\]'\)/.test(page) && /classList\.add\('agd-pic'\)/.test(page) && /viewOpen\(/.test(page));
  assert.ok(/classList\.remove\('agd-pic'\)/.test(page), 'closing the viewer drops it back behind the panel');
  assert.ok(/body\.agd-pic \.viewer \{[^}]*position:fixed[^}]*z-index:46/.test(css), 'the viewer sits above the panel (45)');
  assert.ok(/\.agdp tr\.agrow \{[^}]*cursor:pointer/.test(css) && /\.agdp \.agpics/.test(css));
  assert.ok(/contains\('agd-pic'\)\) return; agdRows = \{\}/.test(page), 'Esc with a picture open closes only the viewer');
});
