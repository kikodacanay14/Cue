// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: the 8 AM update (K0), part 1 of the spec
// cue-message-redesign-spec.md (Kiko 31 Oct 2026: spec "yes", rules R1 to R4; mockup "ok" after the levels were broken down).
function k0Box(o) {
  const t = sweepBox(o || {}); t.ctx.cueSchedules();   // seeds the Schedule tab, the 8 AM update row on
  t.ctx.CUE_K0_ON_ = null; return t;
}
const k0Main = t => t.tabs.Chat.rows.filter(r => /^>/.test(String(r[3])) || r[3] === '');

test('K1 one 8 AM message in Kiko\'s levels: chasers numbered for his OK, empty levels left out, no AI call; the 07:00 batch posts nothing to the main chat', () => {
  const t = k0Box(); t.ctx.cueSweep();
  assert.ok(!k0Main(t).some(r => /Morning batch is ready/.test(r[2])), 'R2: the batch line stays in its thread');
  assert.ok(t.tabs.Chat.rows.some(r => /Morning batch is ready/.test(r[2])), 'still in the thread');
  const ai = t.log.gpt.length; t.at('2026-10-21', 8, 0);
  const o = t.ctx.cueK0Run_(false); assert.ok(o.request_id); assert.strictEqual(t.log.gpt.length, ai, 'no AI call');
  const m = t.tabs.Chat.rows.filter(r => r[3] === '>' + o.request_id); assert.strictEqual(m.length, 1, 'one message');
  const x = m[0][2];
  assert.ok(/^Wednesday, 21 Oct · your 8 AM update/.test(x));
  assert.ok(/For your OK \(reply "send all", "send 1, 3"/.test(x));
  assert.ok(/\n1\. RFQ chaser to Mats Co \(Acme Party\): No quote after 4 days/.test(x) && /\n2\. RFQ chaser to Sonic Pro/.test(x));
  assert.ok(/Today's work\n- Time to follow up\n  - RFQ chaser to No Mail Co/.test(x), 'a line with no email is a follow-up, not an OK');
  assert.ok(!/Critical today|Yesterday's summary|Blocked/.test(x), 'R1: empty levels are left out');
  assert.strictEqual(t.ctx.cueK0Run_(false).skip, 'Already sent today');
});

test('K2 "send 1" sends that chaser now (not at 9:00); the one not named is skipped and comes back on its next day; one line back', () => {
  const t = k0Box(); t.ctx.cueSweep(); t.at('2026-10-21', 8, 0); t.ctx.cueK0Run_(false);
  const out = t.ctx.cueSend('send 1', [], '');
  assert.ok(out.chat);
  const b = t.state(batchOf(t).id).batch.items, mats = b.filter(i => i.who === 'Mats Co')[0], sonic = b.filter(i => i.who === 'Sonic Pro')[0];
  assert.ok(mats.sent_at, 'sent now, before 9:00'); assert.ok(!sonic.selected && !sonic.sent_at, 'not named: not sent');
  assert.ok(!chase(t).some(r => String(r[0]) === sonic.key), 'skipped today, not logged as chased');
  const nomail = b.filter(i => i.who === 'No Mail Co')[0]; assert.ok(!nomail.selected && !nomail.draft_id, 'nothing else is drafted');
  assert.strictEqual(t.tabs.Chat.rows.slice(-1)[0][2], 'Done: 1 chaser sent.');
  assert.ok(!k0Main(t).some(r => /^Morning batch: sent/.test(r[2])), 'R2: no extra batch line when nothing failed');
});

test('K3 only a real reply is taken: other messages still reach the chat as before', () => {
  const t = k0Box(); t.ctx.cueSweep(); t.at('2026-10-21', 8, 0); t.ctx.cueK0Run_(false);
  deq(t.ctx.cueK0Parse_('send 1, 2, 3 · add 4 · no 5').map(p => [p.verb, p.nums]), [['do', [1, 2, 3]], ['do', [4]], ['no', [5]]]);
  deq(t.ctx.cueK0Parse_('send all').map(p => p.all), [true]);
  ['send the quote to Globe', 'no problem', 'add task call Ana to Hiraya', 'ok', 'start intake for DepEd'].forEach(w => assert.strictEqual(t.ctx.cueK0Parse_(w), null, w));
  assert.strictEqual(t.ctx.cueK0Said_('send 9', ''), null, 'a number not on the list is not a reply');
});

test('K4 the 8 AM update off in Cue Admin brings the old posts back; on, the background jobs each have a switch and Admin marks the silent ones', () => {
  const t = k0Box();
  const rows = t.ctx.cueSchedules(), get = id => rows.filter(x => x.id === id)[0];
  assert.ok(get('sys-sweep').about.silent && get('sys-bids').about.silent && get('sys-newmail').about.silent && !get('sys-k0').about.silent);
  deq(['sys-newmail', 'sys-contacts', 'sys-accred', 'sys-crm'].map(id => get(id).when), ['In the background', 'In the background', 'In the background', 'In the background']);
  t.ctx.cueSchedSet('sys-newmail', { on: false }); t.ctx.CUE_JOB_ROWS_ = null;
  assert.strictEqual(t.ctx.cueJobOn_('sys-newmail'), false); assert.strictEqual(t.ctx.cueJobOn_('sys-crm'), true);
  t.ctx.cueSchedSet('sys-k0', { on: false }); t.ctx.CUE_K0_ON_ = null;
  t.ctx.cueSweep();
  assert.ok(k0Main(t).some(r => /Morning batch is ready/.test(r[2])), 'old pointer back');
  const page = cuePage(); assert.ok(/data-sc-on|class="tag" title="Posts nothing to the chat/.test(page));
});

test('K5 the update waits while the 07:00 batch is still drafting, then goes out from the 5-minute job', () => {
  const t = k0Box(); t.ctx.cueSweep(); const id = batchOf(t).id;
  const L = t.ctx.cueLoad_(id); L.s.status = 'Working'; t.ctx.cueSave_(L.sh, L.row, L.s);
  t.at('2026-10-21', 8, 0); assert.strictEqual(t.ctx.cueK0Run_(false).skip, 'Waiting for the morning batch');
  assert.strictEqual(t.props.CUE_K0_RETRY, '2026-10-21');
  const L2 = t.ctx.cueLoad_(id); L2.s.status = 'Needs you'; t.ctx.cueSave_(L2.sh, L2.row, L2.s);
  t.at('2026-10-21', 8, 5); t.ctx.cueK0Retry_();
  assert.ok(t.tabs.Chat.rows.some(r => /your 8 AM update/.test(r[2]))); assert.ok(!t.props.CUE_K0_RETRY);
});
