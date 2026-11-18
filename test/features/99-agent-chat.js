// Part of test/cue.test.js. Feature: AGENT-CHAT-2026-11-16 (src/IndexThreads.html agentSays, agentReplies, agentEcho, agentBubble,
// renderThread). Kiko 16 Nov 2026 15:55:49Z "A CONVERSATI0N - I SAID MESSAGES RIGHT?": an agent's thread reads as a conversation.
const AGC_SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexThreads.html'), 'utf8');
const AGC = (() => {
  const a = AGC_SRC.indexOf('  var agdOpen = {};'), b = AGC_SRC.indexOf("  $('tmsgs').addEventListener('click', function (e) {\n    var b = e.target.closest && e.target.closest('[data-agd-open]')");
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ctx = { esc, noTok: t => String(t || ''), msgWhen: () => '16:00', agdLabel: v => String(v).replace(/\bECII\b/g, 'Procurement Specialist'), cardOf: r => '<div class="card">CARD ' + r.id + '</div>', flagBtn: () => '', moreBtn: () => '', isDismissed: () => false };
  const CARDS = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexCards.html'), 'utf8'), k = CARDS.indexOf('  function agKv(');   // AGENT-CARD-LABELS-2026-11-18
  const n = CARDS.indexOf('  function agdNextLines(');   // AGENT-NEXT-LINES-2026-11-18
  vm.runInNewContext(CARDS.slice(k, CARDS.indexOf('\n  }\n', k) + 4) + CARDS.slice(n, CARDS.indexOf('\n  }\n', n) + 4) + AGC_SRC.slice(a, b) + '\nthis.f = { agentSays, agentReplies, agentEcho, agentBubble, agdOpen };', ctx); return ctx.f;
})();
test('AGC1 an update reads as the agent talking: summary, open items, next step; a rows update says how many need Kiko', () => {
  const u = { id: 'u', agd: { agent: 'Account Specialist', type: 'update', item: 'Likha', project: 'Pandamart', handover: { summary: 'All 11 reviewed.', gaps: 'Entrance size', next_action: 'MM adds sizes', next_owner: 'MM', state: 'Delivered' } } };
  deq(AGC.agentSays(u).split('\n'), ['All 11 reviewed.', 'Still open: Entrance size', 'Next: MM adds sizes (MM)']);
  const rws = { id: 'r', agd: { agent: 'AS', type: 'update', item: 'Likha', handover: { rows: [{ needs_kiko: true }, {}, { needs_kiko: true }], state: 'Delivered' } } };
  assert.strictEqual(AGC.agentSays(rws), 'Likha: 3 requirements, 2 need you.');
  const blk = { id: 'b', agd: { agent: 'AS', type: 'update', item: 'x', body: 'Body', handover: { state: 'Blocked', why: 'no PO' } } };
  deq(AGC.agentSays(blk).split('\n'), ['Body', 'Handover blocked: no PO']);
  const d = { id: 'd', agd: { agent: 'ECII', type: 'rfp', type_label: 'RFQ', item: 'Stage', project: 'P1', subject: 'Quote please', status: 'Waiting for Kiko' } };
  deq(AGC.agentSays(d).split('\n'), ['Draft RFQ: Stage (P1).', 'Subject: Quote please', 'It waits for you.']);
});
test('AGC2 the bubble names the agent, a waiting draft opens with its card, an update keeps it behind Details, and the toggle is remembered', () => {
  const d = { id: 'd', created: '2026-11-16T07:00:00Z', agd: { agent: 'ECII', type: 'rfp', type_label: 'RFQ', item: 'Stage', status: 'Waiting for Kiko' } };
  const h = AGC.agentBubble(d);
  assert.ok(h.includes('<div class="msg cue agmsg"') && h.includes('<span class="who">Procurement Specialist</span>'), h);
  assert.ok(h.includes('<span class="tag warn">Needs you</span>') && h.includes('CARD d') && h.includes('Hide details'));
  const u = { id: 'u', created: '2026-11-16T07:00:00Z', agd: { agent: 'AS', type: 'update', item: '<i>x</i>', status: 'Unread' } };
  const hu = AGC.agentBubble(u);
  assert.ok(!hu.includes('CARD u') && hu.includes('>Details</button>') && hu.includes('Unread') && hu.includes('&lt;i&gt;x&lt;/i&gt;'));
  AGC.agdOpen.u = true; assert.ok(AGC.agentBubble(u).includes('CARD u'));
});
test('AGC3 Kiko replies become his bubbles; Cue announcement lines are left out; renderThread uses the bubbles only in agent threads', () => {
  deq(AGC.agentReplies({ agd: { replies: [{ at: 'a', text: 'skip LightWorks' }] } }), [{ at: 'a', text: 'skip LightWorks' }]);
  deq(AGC.agentReplies({ agd: { status: 'Replied', note: 'ok', decided: 't' } }), [{ at: 't', text: 'ok' }]);
  deq([AGC.agentEcho({ who: 'Cue', text: 'Account Specialist posted a handover update: Likha · Delivered.' }), AGC.agentEcho({ who: 'Cue', text: 'Procurement Specialist drafted an rfq: x. It waits for you.' }),
    AGC.agentEcho({ who: 'Cue', text: 'You replied: "ok". AS reads it on its next run.' }), AGC.agentEcho({ who: 'Cue', text: 'Sent to supplier@x.com.' }), AGC.agentEcho({ who: 'Kiko', text: 'You replied' })],
    [true, true, true, false, false]);
  assert.ok(/var cards = \[\], agT = !!\(x0 && x0\.agd\);/.test(AGC_SRC));
  assert.ok(/if \(agT && r\.agd\) \{\n        cards\.push\(\{ at: Date\.parse\(r\.created\) \|\| 0, html: agentBubble\(r\) \}\);/.test(AGC_SRC));
  assert.ok(/t\.lines\.forEach\(function \(m\) \{ if \(agT && agentEcho\(m\)\) return;/.test(AGC_SRC));
  assert.ok(/var min = !agT && !!cardMin\[t\.root\]/.test(AGC_SRC), 'bubbles are never folded away');
});
