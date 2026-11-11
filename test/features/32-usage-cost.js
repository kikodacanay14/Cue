// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: usage-cost.
// AI usage and cost (Kiko 19:25Z, spec usage-cost.md): Settings section priced from the AI Runs log. "Now" is 21 Oct 2026, 11:00 Manila.
function usageBox(o = {}) {
  const t = sandbox(o), R = t.tabs['AI Runs'], Q = t.tabs.Requests;
  const run = (iso, req, step, prov, model, i, out, status, note) => R.appendRow([new Date(iso), req, step, prov, model, i, out, '', 5, status || 'OK', note || '']);
  Q.appendRow(['cue-1', '', 'Done', '', 'intake', 4, 0, 0, '', '', '{"id":"cue-1","version":"Cue 1.23","kind":"intake","text":"x"}']);
  Q.appendRow(['cue-2', '', 'Done', '', 'bids', 3, 0, 0, '', '', '{"id":"cue-2","version":"Cue 1.23","kind":"bids"}']);
  run('2026-09-30T15:00:00Z', 'cue-1', 'read', 'GPT', 'gpt-5-mini-2025-08-07', 1000000, 0);                      // 30 Sep 23:00 Manila
  run('2026-09-30T17:00:00Z', 'cue-1', 'read', 'GPT', 'gpt-5-mini-2025-08-07', 1000000, 100000, 'OK', '2 web searches'); // 1 Oct 01:00 Manila
  run('2026-10-19T03:00:00Z', 'cue-1', 'cost', 'Claude', 'claude-sonnet-5-5', 100000, 10000);
  run('2026-10-20T03:00:00Z', 'cue-1', 'cost', 'Claude', 'claude-sonnet-5-5', 0, 0, 'Failed', 'HTTP 400');
  run('2026-10-20T04:00:00Z', 'chat-abc', 'chat', 'GPT', 'gpt-5-mini-2025-08-07', 400000, 0);
  run('2026-10-20T05:00:00Z', 'cue-2', 'Bid search 1 of 3', 'GPT', 'gpt-5-mini-2025-08-07', 0, 0, 'OK', '1 web searches');
  run('2026-10-20T06:00:00Z', 'cue-9', 'tiebreak', 'GPT', 'gpt-9', 1000, 1000);
  return t;
}
const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-4, (m || '') + ': ' + a + ' vs ' + b);
test('UG1 usage: months in Manila time, Claude and ChatGPT apart, dated model ids priced, web searches counted, failed calls cost nothing', () => {
  const t = usageBox(), u = t.ctx.cueUsage(), [oct, sep] = u.months;
  assert.deepStrictEqual(u.months.map(m => m.month), ['2026-10', '2026-09']);
  assert.strictEqual(oct.current, true); assert.strictEqual(sep.current, false); assert.strictEqual(oct.label, 'Oct 2026');
  assert.strictEqual(sep.calls, 1); near(sep.usd, 0.25, 'Sep: 1M tokens in');
  assert.deepStrictEqual([oct.calls, oct.claude, oct.gpt, oct.failed], [6, 2, 4, 1]);
  near(oct.usd, 0.47 + 0.3 + 0.1 + 0.01, 'Oct total');   // GPT 0.25+0.2+2 searches, Claude 0.2+0.1, chat 0.1, bid search 1 search; gpt-9 unpriced
  const gpt = oct.by_ai.find(a => a.model === 'gpt-5-mini');
  assert.deepStrictEqual([gpt.calls, gpt.in, gpt.out, gpt.web], [3, 1400000, 100000, 3]);
  assert.strictEqual(oct.by_ai.find(a => a.provider === 'Claude').failed, 1);
  assert.deepStrictEqual(u.unpriced, ['gpt-9']); assert.strictEqual(oct.by_ai.find(a => a.model === 'gpt-9').priced, false);
  const cmd = n => oct.by_cmd.find(c => c.name === n);
  assert.strictEqual(cmd('Project intake').calls, 3); near(cmd('Project intake').usd, 0.77);
  assert.strictEqual(cmd('Chat').calls, 1); assert.strictEqual(cmd('Bid check').calls, 1); assert.strictEqual(cmd('Other (tiebreak)').calls, 1);
  assert.strictEqual(cmd('Project intake').share, 88);
});
test('UG2 likely month-end = cost so far + the average day since the first call (under 7 days) x days left, marked rough', () => {
  const u = usageBox().ctx.cueUsage(), oct = u.months[0];
  // First call 30 Sep 15:00Z (20.5 days before now), so the window is the last 7 days: 19 Oct Claude 0.3 + 20 Oct 0.1 + 0.01 = 0.41.
  const left = (Date.parse('2026-10-31T16:00:00Z') - Date.parse('2026-10-21T03:00:00Z')) / 86400000;
  near(oct.likely_usd, oct.usd + 0.41 / 7 * left, 'projection'); assert.strictEqual(oct.rough, false); assert.strictEqual(oct.days, 21);
  const t = sandbox({}); t.tabs['AI Runs'].appendRow([new Date('2026-10-20T03:00:00Z'), 'chat-x', 'chat', 'GPT', 'gpt-5-mini', 1000000, 0, '', 1, 'OK', '']);
  const v = t.ctx.cueUsage().months[0];
  near(v.likely_usd, 0.25 + 0.25 * left, 'one day of data, one-day minimum'); assert.strictEqual(v.rough, true);
});
test('UG3 prices: saved in CUE_AI_PRICES, bad values ignored, every month recalculated; ₱ rate saved; owner only; no AI call', () => {
  const t = usageBox(), u = t.ctx.cueUsagePrices({ models: { 'gpt-5-mini': ['0.5', '4'], 'gpt-9': ['1', '1'], 'bad name!': ['1', '1'], 'claude-sonnet-5-5': ['', '9'] }, web: '-1', fx: '60' });
  const P = JSON.parse(t.props.CUE_AI_PRICES);
  assert.deepStrictEqual(P.models, { 'gpt-5-mini': [0.5, 4], 'gpt-9': [1, 1] }); assert.strictEqual(P.web, 10); assert.strictEqual(P.fx, 60);
  near(u.months[1].usd, 0.5, 'Sep repriced'); assert.deepStrictEqual(u.unpriced, []); assert.strictEqual(u.prices.models['claude-sonnet-5-5'][1], 10, 'half-filled row kept');
  near(t.ctx.cueAiCost_('GPT', 'gpt-5-mini-2025-08-07', 1e6, 0, 1), 0.51, 'the log uses the same table');
  assert.strictEqual(t.ctx.cueAiCost_('GPT', 'gpt-unknown', 1e6, 0, 0), '');
  assert.strictEqual(t.log.gpt.length + t.log.claude.length, 0, 'no AI call');
  assert.ok(t.log.bridge.every(b => b.action === 'allow_list' || b.action === 'read_rows'), 'Canvas reads only (CUE-STRUCTURE-4.6)');
  const s = usageBox({ viewer: 'someone@example.com' });
  assert.throws(() => s.ctx.cueUsage(), /private/); assert.throws(() => s.ctx.cueUsagePrices({ fx: 1 }), /private/);
});
test('UG4 the AI Runs Cost column now fills for ChatGPT, web searches included', () => {
  const t = sandbox({}); assert.strictEqual(t.ctx.cueAiCost_('GPT', 'gpt-5-mini-2025-08-07', 900, 300, 1), 0.0108);
  assert.strictEqual(t.ctx.cueAiCost_('Claude', 'claude-sonnet-5-5', 4000, 1500, 9), 0.023, 'web searches only on GPT rows');
});
test('UG5 Settings page: AI usage and cost section loads only when opened, shows ESTIMATE, ₱ and US$, and the bill links', () => {
  const html = cuePage();
  assert.ok(html.indexOf('<button data-s="usage" hidden>AI usage and cost</button>') > 0 && html.indexOf('data-sec="usage"') > 0);
  assert.ok(/if \(sec === 'usage'\) loadUsage\(\);/.test(html) && /call\('cueUsage', \[\]/.test(html) && /call\('cueUsagePrices', \[p\]/.test(html));
  ['ESTIMATE', 'Likely by month end', 'platform.openai.com', 'console.anthropic.com', 'rough: under 7 days of data'].forEach(x => assert.ok(html.indexOf(x) > 0, x));
});

test('BD9 Kiko 19:50Z: the bid check runs at 06:30 (07:00 until the 8 AM update, 31 Oct); since the scheduler its trigger, the sweep\'s and the Monday HubSpot one are removed once', () => {
  const t = sandbox({ props: { CUE_TRIGGERS_V: '4' } }); t.log.triggers = ['cueResume', 'cueSweep', 'cueBidsDaily', 'cueHsWeekly']; t.ctx.cueState();
  deq(t.log.triggers.slice(), ['cueResume', 'cueRfpKick']); assert.strictEqual(t.props.CUE_TRIGGERS_V, '8');
  assert.strictEqual(t.ctx.cueSchedules().filter(x => x.id === 'sys-bids')[0].when, 'Weekdays 06:30');
});
