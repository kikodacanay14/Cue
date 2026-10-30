// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: View opportunity on bid cards (Kiko 30 Oct 2026 05:37Z).
/* ---------- each notice gets a button that opens the bid's own page on the source website, by its reference number ---------- */
test('BO1 View opportunity links PhilGEPS notices by reference number (old site public page, Bulletin Board notice) and other notices by their own link', () => {
  const rows = [['2026-10-30', 'AMANG RODRIGUEZ MEMORIAL MEDICAL CENTER', '13318074', 'Procurement of Office Supplies', 'Within cap and area', 'Metro Manila', 251100, 'PHP', '2026-11-04T10:00+08:00', '', '', '',
      'https://notices.philgeps.gov.ph/GEPSNONPILOT/Tender/SplashBidNoticeAbstractUI.aspx?menuIndex=3&refID=13318074', '', '', '', ''],
    ['2026-10-20', 'NCCA', '114505', 'Tokens for delegates', 'Open', 'Metro Manila', 356000, 'PHP', '2026-11-04T17:00+08:00', '', '', '', 'https://philgeps.gov.ph/tenders/viewBidNotice/114505', '', '', '', ''],
    ['2026-10-20', 'TPB', 'OLD-1', 'Travel fair booth', 'Open', 'Makati', 600000, 'PHP', '2026-11-27T17:00+08:00', '', '', '', 'https://tpb.gov.ph/x', '', '', '', '']];
  const { t, v } = bidV3(rows);
  const opp = ref => v.bids.still.concat(v.bids.items).filter(x => x.reference === ref)[0].opp;
  assert.strictEqual(opp('13318074'), 'https://notices.philgeps.gov.ph/GEPSNONPILOT/Tender/SplashBidNoticeAbstractUI.aspx?refID=13318074', 'old site: refID alone opens the notice');
  assert.strictEqual(opp('114505'), 'https://philgeps.gov.ph/tenders/viewBidNotice/114505', 'Bulletin Board notice by reference');
  assert.strictEqual(opp('OLD-1'), 'https://tpb.gov.ph/x', 'other sources: the notice link the scan found');
  const page = cuePage(), fn = page.match(/function bidsCardHtml\(r\) \{[\s\S]*?\n  \}\n/)[0];
  const r = JSON.parse(JSON.stringify(t.ctx.cueView_(t.state(v.id))));
  const box = { esc: x => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]), metricLine: () => '', r };
  const h = vm.runInNewContext(fn + 'bidsCardHtml(r)', box);
  assert.ok(/<a class="btn ghost"[^>]*href="https:\/\/notices\.philgeps\.gov\.ph\/GEPSNONPILOT\/Tender\/SplashBidNoticeAbstractUI\.aspx\?refID=13318074" target="_blank" rel="noopener">View opportunity<\/a>/.test(h), 'button opens the bid in a new tab');
  assert.ok(/data-act="bids-view"[^>]*>View details<\/button><a class="btn ghost"[^>]*>View opportunity</.test(h), 'right after View details');
  assert.ok(/>Official notice</.test(h), 'Official notice stays');
});
