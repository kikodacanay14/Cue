// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: the whole old PhilGEPS Description on the bid card
// (Kiko 30 Oct 2026 10:49Z "make sure to read the Desciption because it has so much more details about the post"; yes 3 Nov 10:16Z).
// Real notice 13319417 (City of Imus), read on 30 Oct: a list of inclusions, one per line.
const PG_DESC_LIST = '100 PAX 2 DAYS TRAINING<br><br>INCLUSIONS:<br>VENUE<br>ONE UNIT OF LCD PROJECTOR WITH BUILT-IN SCREEN<br>COMPLIMENTARY WIRELESS INTERNET ACCESS<br>AV TECH SPECIALIST ON SITE'
  + '<br>BASIC SOUND SYSTEM WITH TWO WIRELESS MICROPHONE<br>CONFERENCE MEETING PADS AND PENS<br>WHITE BOARD, FLIPCHARTS, MARKERS, AND ERASERS<br>WITH AM SNACK, BUFFET SERVICE OF LUNCH, PM SNACKS AND DINNER'
  + '<br>FREE FLOW OF COFFE, TEA AND INFUSED WATER<br>TOKEN OF APPRECIATION FOR PARTICIPANTS<br>' + 'NOTE: '.repeat(120);
test('PD1 the card keeps the whole Description with its own line breaks, not one run-on line cut at 600 characters', () => {
  const abs = PG_ABS_FULL.replace(/(<span id="lblAbstractText" class="DisplayText5">)[\s\S]*?(<\/span>)/, '$1' + PG_DESC_LIST + '$2');
  const site = log => req => { const m = req.url.match(/refID=(\d+)/); if (m && m[1] === '13310846') return abs.replace(/13318074/g, '13310846').replace('251,100.00', '500,000.00').replace(/Procurement of Office Supplies/g, '2-day learning session'); return PG_SITE(log)(req); };
  const t = bidBox({ gpt: { bids: [{ sources: SRC(['New PhilGEPS', 'Other PhilGEPS']), items: [] }, { sources: [], items: [] }, { sources: [], items: [] }], bid_docs: BID_DOCS }, philgeps: req => site(t.log)(req) });
  const v = t.ctx.cueRun(t.ctx.cueSend('run bid opportunity check', [], '').request_id);
  const x = v.bids.items.filter(i => i.reference === '13310846')[0];
  assert.ok(x, 'the notice is on the card');
  assert.ok(x.summary.length > 600, 'not cut at 600: ' + x.summary.length);
  assert.ok(/^100 PAX 2 DAYS TRAINING\n\nINCLUSIONS:\nVENUE\nONE UNIT OF LCD PROJECTOR/.test(x.summary), 'line breaks kept: ' + x.summary.slice(0, 80));
  assert.ok(/\nTOKEN OF APPRECIATION FOR PARTICIPANTS\n/.test(x.summary), 'the last inclusion is there');
  const page = cuePage(), fn = page.match(/function bidsCardHtml\(r\) \{[\s\S]*?\n  \}\n/)[0];
  const r = JSON.parse(JSON.stringify(v)), box = { esc: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]), metricLine: () => '', r };
  const h = vm.runInNewContext(fn + 'bidsCardHtml(r)', box);
  assert.ok(/Summary of requirements<\/span><span style="white-space:pre-line;text-align:left">100 PAX 2 DAYS TRAINING\n\nINCLUSIONS:\nVENUE\n/.test(h), 'shown line by line, left aligned');
});
test('PD2 a Description over 2,000 characters ends with an ellipsis; a one-line summary keeps the justified look', () => {
  const t = sandbox(), long = 'A'.repeat(2500);
  const f = t.ctx.cueBidsPgDetails_('<span id="lblAbstractText" class="DisplayText5">' + long + '</span>');
  assert.strictEqual(f.description.length, 2000); assert.ok(/…$/.test(f.description));
  const page = cuePage(), fn = page.match(/function bidsCardHtml\(r\) \{[\s\S]*?\n  \}\n/)[0];
  assert.ok(/\/\\n\/\.test\(x\.summary \|\| ''\) \? 'lines' : true/.test(fn), 'only a summary with line breaks changes alignment');
});
