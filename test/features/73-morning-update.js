// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: the 8 AM update (K0), part 1 of the spec
// cue-message-redesign-spec.md (Kiko 31 Oct 2026: spec "yes", rules R1 to R4; mockup "ok" after the levels were broken down).
function k0Box(o, kind) {
  const t = sweepBox(o || {}, kind); t.ctx.cueSchedules();   // seeds the Schedule tab, the 8 AM update row on
  t.ctx.CUE_K0_ON_ = null; return t;
}
const k0Main = t => t.tabs.Chat.rows.filter(r => /^>/.test(String(r[3])) || r[3] === '');

test('K1 8 AM (weekdays): Yesterday, Today\'s focus, New opportunities and New clients; no chasers in the morning; the batch posts nothing to the main chat', () => {
  const t = k0Box(); t.ctx.cueSweep();
  assert.ok(!k0Main(t).some(r => /Morning batch is ready/.test(r[2])), 'R2: the batch line stays in its thread');
  const ai = t.log.gpt.length; t.at('2026-10-21', 8, 0);
  const o = t.ctx.cueK0Run_(false, 'am'); assert.ok(o.request_id); assert.strictEqual(t.log.gpt.length, ai, 'no AI call');
  const x = t.tabs.Chat.rows.filter(r => r[3] === o.request_id)[0][2];
  assert.ok(/^Wednesday, 21 Oct · your 8 AM update/.test(x));
  assert.ok(!/RFQ chaser to/.test(x) && !/For your OK|Chasers for your OK/.test(x), 'chasers wait for 2 PM (Kiko 1 Nov)');
  assert.strictEqual(t.ctx.cueK0Run_(false, 'am').skip, 'Already sent today');
});

test('K2 2 PM: chasers numbered; "1" drafts that one (tailored, nothing sent); Send on its card sends it; the one not picked stays unsent', () => {
  const t = k0Box({ gpt: { chasers_tailor: { drafts: [] } } }); t.at('2026-10-21', 13, 0); t.ctx.cueSweep(); t.at('2026-10-21', 14, 0);
  const o = t.ctx.cueK0Run_(false, 'pm'); const x = t.tabs.Chat.rows.filter(r => r[3] === o.request_id)[0][2];
  assert.ok(/· your 2 PM chasers/.test(x) && /Chasers for your OK \(reply "1, 3" or "all": Cue drafts them/.test(x), x);
  assert.ok(/\n1\. RFQ chaser to Mats Co \(Acme Party\): No quote after 4 days/.test(x) && /\n2\. RFQ chaser to Sonic Pro/.test(x));
  t.ctx.cueSend('1', [], '');
  const id = batchOf(t).id; let b = t.state(id).batch.items, mats = b.filter(i => i.who === 'Mats Co')[0], sonic = b.filter(i => i.who === 'Sonic Pro')[0];
  assert.ok(mats.picked && mats.tap && !mats.sent_at, 'picked and drafted, not sent'); assert.ok(!sonic.picked && !sonic.sent_at);
  assert.ok(!t.log.sent, 'nothing sent by the pick'); assert.ok(/Done: 1 chaser drafted for you to check/.test(t.tabs.Chat.rows.slice(-1)[0][2]));
  t.ctx.cueSweepSendOne(id, mats.key, '');
  b = t.state(id).batch.items; assert.ok(b.filter(i => i.who === 'Mats Co')[0].sent_at, 'sent on its own Send'); assert.ok(!b.filter(i => i.who === 'Sonic Pro')[0].sent_at);
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

test('K5 the 2 PM update waits while the 13:00 chasers are still drafting, then goes out from the 5-minute job', () => {
  const t = k0Box(); t.at('2026-10-21', 13, 0); t.ctx.cueSweep(); const id = batchOf(t).id;
  const L = t.ctx.cueLoad_(id); L.s.status = 'Working'; t.ctx.cueSave_(L.sh, L.row, L.s);
  t.at('2026-10-21', 14, 0); assert.strictEqual(t.ctx.cueK0Run_(false, 'pm').skip, 'Waiting for the chasers');
  assert.strictEqual(t.props.CUE_K0_RETRY, '2026-10-21');
  const L2 = t.ctx.cueLoad_(id); L2.s.status = 'Needs you'; t.ctx.cueSave_(L2.sh, L2.row, L2.s);
  t.at('2026-10-21', 14, 5); t.ctx.cueK0Retry_();
  assert.ok(t.tabs.Chat.rows.some(r => /your 2 PM chasers/.test(r[2]))); assert.ok(!t.props.CUE_K0_RETRY);
});

test('K6 Tell Cue rewrites one draft within the template (greeting and sign-off kept); a rewrite that breaks the template is refused', () => {
  let box = null;   // a chaser kind built on Kiko's S2 template, as the real ones are
  const t = box = k0Box({ gpt: { chasers_tailor: { drafts: [] } } }, { draftBrief: '', template: it => box.ctx.cueTplS2_(it) }); t.at('2026-10-21', 13, 0); t.ctx.cueSweep(); t.at('2026-10-21', 14, 0); t.ctx.cueK0Run_(false, 'pm'); t.ctx.cueSend('1', [], '');
  const id = batchOf(t).id, it = t.state(id).batch.items.filter(i => i.picked)[0];
  const firm = it.body.replace(/Checking in on our request[^\n]*/, 'Following up again on our request: we need your quote by Friday to lock the supplier list.');
  t.opts.gpt.chasers_tailor = { drafts: [{ key: it.key, body: firm }] };
  t.ctx.cueSweepRewrite(id, it.key, 'make it firmer');
  const after = t.state(id).batch.items.filter(i => i.key === it.key)[0];
  assert.ok(/we need your quote by Friday/.test(after.body) && /Thanks!\nKiko Dacanay\nBlank Space Events$/.test(after.body) && after.html, after.body);
  t.opts.gpt.chasers_tailor = { drafts: [{ key: it.key, body: 'Yo. Send the quote.' }] };
  assert.throws(() => t.ctx.cueSweepRewrite(id, it.key, 'shorter'), /within your template/);
});
