// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: GitHub Actions cost on the AI usage and cost page.
// GH-ACTIONS-COST (Kiko 4 Nov 2026 13:05Z): GitHub Pro (13:10Z) includes US$18 of Actions a month and costs US$4; Kiko's budget caps the billed part at US$10.
test('GA1 GitHub Actions: 4 Nov defaults (Pro), nothing billed under the included US$18, likely month end with the plan fee, cap day', () => {
  const t = usageBox(); t.ctx.cueNow_ = () => Date.parse('2026-11-04T05:00:00Z');   // 4 Nov 13:00 Manila
  const g = t.ctx.cueUsage().github;
  assert.deepStrictEqual([g.used, g.asof, g.free, g.cap, g.plan, g.stale], [15.81, '2026-11-04', 18, 10, 4, false]);
  assert.strictEqual(g.billed, 0, 'still inside the included US$18');
  near(g.likely, 15.81 / 4 * 30, 'likely use at the same daily rate');
  assert.strictEqual(g.likely_billed, 10, 'never above the cap'); assert.strictEqual(g.likely_total, 14, 'cap + plan fee');
  assert.strictEqual(g.stop_day, 8, 'included 18 + cap 10 = 28 at 3.95 a day runs out on day 8');
});
test('GA2 GitHub Actions figures save with the prices; bad values keep the old ones; a low rate never hits the cap', () => {
  const t = usageBox(); t.ctx.cueNow_ = () => Date.parse('2026-11-20T05:00:00Z');
  const u = t.ctx.cueUsagePrices({ ghused: '6', ghasof: '2026-11-20', ghfree: 'x', ghcap: '-5', ghplan: '0' });
  assert.deepStrictEqual(JSON.parse(t.props.CUE_AI_PRICES).gh, { used: 6, asof: '2026-11-20', free: 18, cap: 10, plan: 0 });
  const g = u.github; assert.strictEqual(g.billed, 0); near(g.likely, 9); assert.strictEqual(g.likely_billed, 0); assert.strictEqual(g.likely_total, 0); assert.strictEqual(g.stop_day, 0);
  t.ctx.cueUsagePrices({ ghasof: '20 Nov' });
  assert.strictEqual(JSON.parse(t.props.CUE_AI_PRICES).gh.asof, '2026-11-20', 'a bad date keeps the old one');
});
test('GA3 figures from an earlier month are flagged, not projected', () => {
  const t = usageBox(); t.ctx.cueNow_ = () => Date.parse('2026-12-02T05:00:00Z');
  const g = t.ctx.cueUsage().github;
  assert.strictEqual(g.stale, true); assert.strictEqual(g.month, '2026-11'); assert.strictEqual(g.likely, undefined);
});
test('GA4 Settings page shows the GitHub Actions card and its five editable figures', () => {
  const html = cuePage();
  ['GitHub Actions (as of ', 'Included each month', 'Plan fee', 'Budget cap', 'Billed so far', 'cap reached about day ', 'github.com/settings/billing/usage',
    "n('ghused'", 'data-up="ghasof"', "n('ghfree'", "n('ghcap'", "n('ghplan'"].forEach(x => assert.ok(html.indexOf(x) > 0, x));
});
