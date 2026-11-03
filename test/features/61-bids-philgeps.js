// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: Cue reads the public PhilGEPS lists itself.
/* CUE-BIDS-PHILGEPS-2026-10-29 (bug, Cue issue #221): the daily bid check logged "Other PhilGEPS" as Checked while ChatGPT only saw its
 * category index. HTML below follows the live pages as read in Kiko's Chrome on 29 Oct (list rows, the nextLB postback, span ids). */

const PG_ROW = (n, ref, posted, closes, title) => '<tr class="GridItem"><td align="center">' + n + '</td><td class="GridItemTD">' + posted + '</td><td class="GridItemTD">' + closes
  + '</td><td class="GridItemTD"><a id="dgSearchResult_ctl0' + (n + 1) + '_hyLinkTitle" href="SplashBidNoticeAbstractUI.aspx?menuIndex=3&amp;refID=' + ref + '&amp;DirectFrom=OpenOpp&amp;Type=category&amp;BusCatID=156">'
  + title + '</a><span id="x"></span></td></tr>';
const PG_LIST = (rows, next, vs) => '<html><form method="post" action="./SplashOpportunitiesSearchUI.aspx?menuIndex=3&amp;BusCatID=156&amp;type=category&amp;ClickFrom=OpenOpp">'
  + '<input type="hidden" name="__EVENTTARGET" id="__EVENTTARGET" value="" /><input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="' + vs + '" />'
  + '<input type="hidden" name="__EVENTVALIDATION" value="ev&amp;1" /><table id="dgSearchResult" class="GridTable"><tr><td></td><td>Publish</td><td>Closing</td><td>Title</td></tr>'
  + rows.join('') + '</table>' + (next ? '<a href="javascript:__doPostBack(&#39;pgCtrlDetailedSearch$nextLB&#39;,&#39;&#39;)">Next</a>' : '') + '</form></html>';
const PG_ABS = (ref, agency, title, abc, area, closes) => '<html><span id="lblDisplayReferenceNo" class="DisplayText5">' + ref + '</span><span id="lblDisplayProcuringEntity" class="DisplayText5">' + agency
  + '</span><span id="lblDisplayTitle" class="DisplayText5">' + title + '</span><span id="Label34" class="DisplayText5">PHP</span>&nbsp;<span id="lblDisplayBudget" class="DisplayText5">' + abc
  + '</span><span id="lblDisplayAOD" class="DisplayText5">' + area + '</span><span id="lblDisplayCloseDateTime" class="DisplayText5">' + closes
  + '</span><span id="lblDisplayDatePublish" class="DisplayText5">20/10/2026</span><span id="lblDisplayProcureMode" class="DisplayText5">Negotiated Procurement - Small Value Procurement (SVP)</span></html>';
const PG_SITE = (log) => req => {
  const u = req.url;
  if (/BusCatID=156/.test(u)) {
    if ((req.method || 'get') === 'post') { (log.pgPosts = log.pgPosts || []).push(req.payload);
      return PG_LIST([PG_ROW(1, '13300003', '20/10/2026', '30/10/2026 10:00 AM', 'TOWN FIESTA STAGE, Events Management, MUN. PILAR')], false, 'vs2'); }
    return PG_LIST([PG_ROW(1, '13310846', '20/10/2026', '06/11/2026 02:00 PM', 'YEAR END CHRISTMAS PARTY, Events Management, BARANGAY CATMON - MALABON CITY'),
      PG_ROW(2, '13300002', '20/10/2026', '04/11/2026 05:00 PM', 'GALA, Events Management, CITY OF MAKATI')], true, 'vs1/+=');
  }
  const m = u.match(/refID=(\d+)/);
  if (m && m[1] === '13310846') return PG_ABS('13310846', 'BARANGAY CATMON - MALABON CITY', 'Year-end Christmas party celebration 2026', '500,000.00', 'Metro Manila', '06/11/2026 2:00 PM');
  if (m && m[1] === '13300002') return PG_ABS('13300002', 'CITY OF MAKATI', 'Diplomatic Corps gala', '11,996,000.00', 'Metro Manila', '04/11/2026 5:00 PM');
  if (m && m[1] === '13300003') return PG_ABS('13300003', 'MUNICIPALITY OF PILAR', 'Town fiesta stage', '300,000.00', 'Bataan', '30/10/2026 10:00 AM');
  return PG_LIST([], false, 'empty');
};

test('PH1 the PhilGEPS page parts: list rows, the postback form, day-first dates in Manila time, and an abstract by span id', () => {
  const t = sandbox(), c = t.ctx;
  const html = PG_SITE({})({ url: 'https://notices.philgeps.gov.ph/GEPSNONPILOT/Tender/SplashOpportunitiesSearchUI.aspx?menuIndex=3&BusCatID=156&type=category&ClickFrom=OpenOpp' });
  deq(JSON.parse(JSON.stringify(c.cueBidsPgRows_(html))), [{ ref: '13310846', posted: '20/10/2026', closes: '06/11/2026 02:00 PM' }, { ref: '13300002', posted: '20/10/2026', closes: '04/11/2026 05:00 PM' }]);
  const f = c.cueBidsPgForm_(html); deq([f.__VIEWSTATE, f.__EVENTVALIDATION, f.__EVENTTARGET], ['vs1/+=', 'ev&1', '']);
  assert.ok(vm.runInContext('cueBidsPgHasNext_', c)(html)); assert.ok(!vm.runInContext('cueBidsPgHasNext_', c)(PG_LIST([], false, 'x')));
  deq([c.cueBidsPgWhen_('06/11/2026 2:00 PM'), c.cueBidsPgWhen_('30/10/2026 12:15 AM'), c.cueBidsPgWhen_('01/11/2026 12:00 PM'), c.cueBidsPgWhen_('20/10/2026'), c.cueBidsPgWhen_('')],
    ['2026-11-06T14:00+08:00', '2026-10-30T00:15+08:00', '2026-11-01T12:00+08:00', '2026-10-20', '']);
  const row = c.cueBidsPgAbstract_(PG_ABS('13310846', 'BARANGAY CATMON - MALABON CITY', 'Year-end Christmas party', '500,000.00', 'Metro Manila', '06/11/2026 2:00 PM'), '13310846', 'Events Management');
  deq(Array.from(row).slice(0, 9), ['13310846', 'Events Management', 'BARANGAY CATMON - MALABON CITY', 'Year-end Christmas party', 500000, 'Metro Manila', '2026-11-06T14:00+08:00', '2026-10-20',
    'Negotiated Procurement - Small Value Procurement (SVP)']);
  assert.strictEqual(c.cueBidsPgAbstract_('<html>Not found</html>', '1', 'x'), null, 'a page without a title is not a notice');
});

test('PH2 the bid check reads the four category lists and each notice page itself; next pages by postback; the notices go through Kiko\'s screen; the source line says what code saw', () => {
  const t = bidBox({ gpt: { bids: [{ sources: SRC(['New PhilGEPS', 'Other PhilGEPS']), items: [] }, { sources: [], items: [] }, { sources: [], items: [] }], bid_docs: BID_DOCS }, philgeps: req => PG_SITE(t.log)(req) });
  const v = t.ctx.cueRun(t.ctx.cueSend('run bid opportunity check', [], '').request_id);
  assert.strictEqual(v.status, 'Needs you', v.error);
  const lists = t.log.philgeps.filter(x => /SplashOpportunitiesSearchUI/.test(x.url));
  deq(lists.filter(x => x.method === 'get').map(x => x.url.match(/BusCatID=(\d+)/)[1]), ['156', '60', '117', '29'], 'the four event categories, by id');
  assert.strictEqual(t.log.pgPosts.length, 1, 'one next page'); deq([t.log.pgPosts[0].__EVENTTARGET, t.log.pgPosts[0].__VIEWSTATE], ['pgCtrlDetailedSearch$nextLB', 'vs1/+=']);
  const B = v.bids.items.filter(x => /^133/.test(x.reference));
  deq(B.map(x => [x.reference, x.agency, x.abc, x.location, x.deadline, x.status]), [['13310846', 'BARANGAY CATMON - MALABON CITY', 500000, 'Metro Manila', '2026-11-06T14:00+08:00', 'Within cap and area']],
    'the ₱11.996M gala and the Bataan notice are screened out');
  assert.ok(/SplashBidNoticeAbstractUI\.aspx\?menuIndex=3&refID=13310846$/.test(B[0].url));
  const src = v.bids.sources.filter(x => x.source === 'Other PhilGEPS')[0];
  assert.strictEqual(src.status, 'Checked'); assert.ok(/Events Management \(3\)/.test(src.checked) && /3 open notices/.test(src.checked), src.checked);
  assert.strictEqual(t.tabs['PhilGEPS notices'].rows.length, 4, 'three notices kept, plus the header');
  assert.strictEqual(t.log.gpt.filter(b => b.text.format.name !== 'bids' && b.text.format.name !== 'bid_docs').length, 0, 'no other AI call');
  // The next day: each notice page is read once only, and a notice already on the sheet is not new again.
  const pages = t.log.philgeps.filter(x => /refID=/.test(x.url)).length;
  t.ctx.__wait(864e5); t.log.gptN = {};
  const w = t.ctx.cueRun(t.ctx.cueSend('run bid opportunity check', [], '').request_id);
  assert.strictEqual(t.log.philgeps.filter(x => /refID=/.test(x.url)).length, pages, 'no notice page read again');
  deq(w.bids.items.map(x => x.reference), [], 'not new again'); assert.ok(w.bids.still.some(x => x.reference === '13310846'), 'it is Still open');
});

test('PH3 the site down is a Blocked source line and the check still finishes; a check version reads page 1 only (a postback is a POST)', () => {
  const t = bidBox({ gpt: { bids: [{ sources: SRC(['Other PhilGEPS']), items: [] }, { sources: [], items: [] }, { sources: [], items: [] }], bid_docs: BID_DOCS }, philgeps: () => 503 });
  const v = t.ctx.cueRun(t.ctx.cueSend('run bid opportunity check', [], '').request_id);
  assert.strictEqual(v.status, 'Done', v.error);
  const src = v.bids.sources.filter(x => x.source === 'Other PhilGEPS')[0];
  assert.strictEqual(src.status, 'Blocked'); assert.ok(/HTTP 503/.test(src.gap), src.gap);
  const c = bidBox({ gpt: { bids: [{ sources: [], items: [] }, { sources: [], items: [] }, { sources: [], items: [] }], bid_docs: BID_DOCS }, philgeps: req => PG_SITE(c.log)(req) });
  c.ctx.UrlFetchApp.__cueCheck = true;
  const cv = c.ctx.cueRun(c.ctx.cueSend('run bid opportunity check', [], '').request_id);
  assert.ok(!c.log.pgPosts, 'no postback in a check version');
  const cs = cv.bids.sources.filter(x => x.source === 'Other PhilGEPS')[0]; assert.strictEqual(cs.status, 'Partial'); assert.ok(/stopped at page 1/.test(cs.gap), cs.gap);
});
