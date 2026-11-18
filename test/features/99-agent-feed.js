// Part of test/cue.test.js. Feature: AGENT-FEED-2026-11-16 (src/IndexThreads.html agentFeed, agentFeedHtml). Kiko 16 Nov 2026
// 15:48:10Z "BUILD IT NOW": agent updates and messages under the Agents group, with a last-hour status. Display only.
const AGF_SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexThreads.html'), 'utf8');
const AGF = (() => {
  const a = AGF_SRC.indexOf('  function agentFeed(reqs, now, by) {'), b = AGF_SRC.indexOf('  function threadState(th) {');
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ctx = { esc, noTok: t => String(t || ''), ago: () => '2h ago', rootOf: (id, by) => { for (let i = 0; i < 8 && by[id] && by[id].ref; i++) id = by[id].ref; return id; },
    agdLabel: v => String(v).replace(/\bECII\b/g, 'Procurement Specialist').replace(/\bECI\b/g, 'Event Specialist') };
  vm.runInNewContext(AGF_SRC.slice(a, b) + '\nthis.agentFeed = agentFeed; this.agentFeedHtml = agentFeedHtml;', ctx); return ctx;
})();
const AGF_NOW = Date.parse('2026-11-16T15:00:00Z');
const agfReq = (id, min, agd, ref) => ({ id, ref: ref || '', created: new Date(AGF_NOW - min * 60000).toISOString(), agd });
test('AGF1 the feed lists the five newest agent drafts and updates, newest first, opens the agent thread, and counts the last hour', () => {
  const reqs = [
    agfReq('r1', 10, { agent: 'Account Specialist', type: 'update', item: 'Likha review', project: 'S-31753672PA', status: 'Unread' }),
    agfReq('r2', 30, { agent: 'ECII', type: 'rfp', type_label: 'RFQ', item: 'Stage rental', status: 'Waiting for Kiko' }, 'r9'),
    agfReq('r3', 50, { agent: 'Account Specialist', type: 'update', item: 'Old', status: 'Read' }),
    agfReq('r4', 90, { agent: 'Admin', type: 'update', item: 'Crew list', status: 'Failed' }),
    agfReq('r5', 200, { agent: 'Admin', type: 'update', item: 'x', status: 'Sent' }),
    agfReq('r6', 300, { agent: 'Admin', type: 'update', item: 'y', status: 'Saved' }),
    { id: 'n1', created: new Date(AGF_NOW).toISOString(), kind: 'bids' },
    agfReq('r9', 400, { agent: 'ECII', type: 'rfp', type_label: 'RFQ', item: 'root', status: 'Sent' }) ];
  const by = {}; reqs.forEach(r => { by[r.id] = r; });
  const f = AGF.agentFeed(reqs, AGF_NOW, by);
  deq([f.n, f.agents], [3, 2], 'three in the last hour from two agents; non-agent tasks ignored');
  deq(f.items.map(x => x.item), ['Likha review (S-31753672PA)', 'Stage rental', 'Old', 'Crew list', 'x']);
  deq(f.items.map(x => x.tag[0]), ['Unread', 'Needs you', 'Read', 'Failed', 'Sent']);
  deq(f.items.map(x => x.tag[1]), ['warn', 'warn', 'good', 'crit', 'good'], 'labels use the standard tag colours');
  deq([f.items[1].k, f.items[1].agent, f.items[1].kind, f.items[0].kind], ['r9', 'Procurement Specialist', 'RFQ', 'Update'], 'a row opens the root of its agent thread and shows the new role name');
});
test('AGF2 the status line says nothing new when the last hour is quiet, the feed escapes text, and an empty feed renders nothing', () => {
  const f = AGF.agentFeed([agfReq('q', 120, { agent: 'Admin', type: 'update', item: '<b>hi</b>', status: 'Read' })], AGF_NOW, {});
  const h = AGF.agentFeedHtml(f);
  assert.ok(h.includes('Last hour: nothing new from the agents. Last one 2h ago.'), h);
  assert.ok(h.includes('&lt;b&gt;hi&lt;/b&gt;') && !h.includes('<b>hi</b>'), 'item text is escaped');
  assert.ok(/<button class="trow agf" data-thread="q">/.test(h), 'a row is a button that opens the thread');
  assert.ok(AGF.agentFeedHtml(AGF.agentFeed([], AGF_NOW, {})).length === 0);
  assert.ok(AGF.agentFeedHtml(AGF.agentFeed([agfReq('a', 5, { agent: 'Admin', type: 'update', item: 'z', status: 'Unread' })], AGF_NOW, {})).includes('Last hour: 1 update from 1 agent.'));
});
test('AGF3 CUE-CHANNELS-2026-11-18 replaces the feed above the main chat (Kiko 18 Nov 2026 04:22:53Z "Agent Updates - list down agent channels"): the group lists one channel per agent and keeps the last-hour line', () => {
  assert.ok(!/h \+= agentFeedHtml/.test(AGF_SRC) && !/function renderAgentUpd\(/.test(AGF_SRC), 'no separate feed panel');
  const page = fs.readFileSync(path.join(__dirname, '..', 'src', 'Index.html'), 'utf8');
  assert.ok(!/id="agupd"/.test(page), '#agupd is gone');
  assert.ok(/if \(g\[0\] === 'agent' && !tshut\.agent\) \{ var f = agentFeed\(state\.requests, Date\.now\(\), by\); if \(f\.items\.length\) h \+= '<p class="agstat">' \+ esc\(agStat\(f\)\) \+ '<\/p>'; \}/.test(AGF_SRC), 'the last-hour line under Agent Updates');
});
