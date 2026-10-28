// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: write-like-me.
/* ---------- Write Like Me (specs/write-like-me.md) ---------- */
const MINE = [
  { id: 's1', to: 'Sonic Pro <sales@sonicpro.example>', subject: 'RFQ: LED wall', body: 'Hi Sonic Pro team!\n\nCan you send us a quote for a 4x3m LED wall on Dec 12? Call me at 0917 123 4567.\n\nThanks po,\nKiko\n\nOn Mon, 20 Oct 2026 at 9:00, Sonic <sales@sonicpro.example> wrote:\n> old quoted text' },
  { id: 's2', to: 'ana@acme.example', subject: 'Re: Year-end party', body: 'Hi Ana!\n\nGot it, we will send the proposal by Friday. Write to me at kiko@example.com.\n\nCheers,\nKiko' },
  { id: 's3', to: 'ops@example.com', subject: 'Crew call', body: 'Team, call time is 6am sharp tomorrow. Please confirm. Salamat!\n\nK' },
  { id: 's4', to: 'tents@tentco.example', subject: 'Fwd: tent specs', body: 'See below, this is a forward that is long enough to count.' },
  { id: 's5', to: 'x@y.example', subject: 'Out of office', body: 'I am away until Monday and will reply when I am back, thank you.', headers: [{ name: 'Auto-Submitted', value: 'auto-replied' }] },
  { id: 's6', to: 'long@y.example', subject: 'Long one', body: 'word '.repeat(600) },
  { id: 's7', to: 'print@hub.example', subject: 'Artwork', html: '<p>Hi Print Hub!</p><p>Attached the final artwork, please print by Thursday.</p><p>Thanks po,<br>Kiko</p>' },
  { id: 's8', thread: 's1', to: 'sales@sonicpro.example', subject: 'Re: RFQ: LED wall', body: 'Same thread, older, should be skipped as a duplicate.' },
  { id: 's9', to: 'lights@lightco.example', subject: 'RFQ: lights', body: 'Hi Lightco!\n\nPlease quote 12 moving heads for Dec 12.\n\nThanks po,\nKiko' },
  { id: 's10', to: 'sound@soundco.example', subject: 'RFQ: sound', body: 'Hi Soundco!\n\nPlease quote a PA for 300 pax.\n\nThanks po,\nKiko' }];
const STYLE = { summary: 'Warm and short, Taglish touches with suppliers.', rules: [
  { audience: 'all', kind: 'tone', text: 'Warm, short and direct; first names.' },
  { audience: 'supplier', kind: 'greeting', text: 'Hi [supplier]!' },
  { audience: 'supplier', kind: 'sign-off', text: 'Thanks po,\nKiko' },
  { audience: 'client', kind: 'sign-off', text: 'Cheers,\nKiko' },
  { audience: 'team', kind: 'phrase', text: 'Ends crew notes with "Salamat!"' },
  { audience: 'supplier', kind: 'example', text: 'Hi [supplier]!\n\nCan you quote [item] for [date]?\n\nThanks po,\nKiko' },
  { audience: 'nobody', kind: 'tone', text: 'bad audience' }, { audience: 'all', kind: 'secret', text: 'bad kind' }, { audience: 'all', kind: 'avoid', text: '   ' }] };
function styleRun(o) { const t = sandbox(Object.assign({ mine: MINE }, o)); const out = t.ctx.cueSend((o && o.say) || 'learn my style', [], ''); const v = t.ctx.cueRun(out.request_id); return Object.assign(t, { id: out.request_id, v }); }
const styleRows = t => t.tabs.Style.rows.slice(1).filter(r => r[3]);

test('WL1 "learn my style": no AI call to route it; Cue reads sent emails (own words only), 1 Claude call, a card, nothing saved yet', () => {
  const t = styleRun();
  assert.strictEqual(t.log.gpt.length, 0, 'no chat call'); assert.strictEqual(t.v.kind, 'style'); assert.strictEqual(t.v.status, 'Needs you');
  assert.strictEqual(t.v.metrics.ai_calls, 1); assert.ok(/in:sent/.test(t.log.gmailQ));
  const ask = JSON.parse(t.log.claude[0].messages[0].content), mails = ask.emails;
  deq(mails.map(m => m.subject), ['RFQ: LED wall', 'Re: Year-end party', 'Crew call', 'Artwork', 'RFQ: lights', 'RFQ: sound'], 'forwards, auto-replies, long ones and repeat threads dropped');
  deq(mails.map(m => m.to), ['outside', 'outside', 'team', 'outside', 'outside', 'outside'], 'own domain is team');
  assert.ok(!/old quoted text|wrote:/.test(mails[0].body), 'quoted reply cut'); assert.ok(/\[number\]/.test(mails[0].body) && !/0917/.test(mails[0].body), 'phone masked');
  assert.ok(/\[email\]/.test(mails[1].body) && !/kiko@example\.com/.test(mails[1].body), 'address masked');
  assert.ok(/^Hi Print Hub!\nAttached the final artwork/.test(mails[3].body), 'html becomes text');
  deq(t.v.style.rules.map(r => r.k + ' ' + r.audience + ' ' + r.kind), ['S1 all tone', 'S2 supplier greeting', 'S3 supplier sign-off', 'S4 client sign-off', 'S5 team phrase', 'S6 supplier example'], 'bad lines dropped');
  assert.strictEqual(t.v.style.mails, 6); assert.ok(!t.tabs.Style, 'nothing written before approval');
  assert.ok(!JSON.stringify(t.state(t.id)).includes('Got it, we will send'), 'the emails are not kept in the sheet');
  assert.ok(t.tabs.Chat.rows.some(r => r[3] === '>' + t.id), 'main chat points to the thread');
});
test('WL2 approve: ticked lines, as edited, become the Style tab; RFQs and requotes then use the supplier guide and its sign-off', () => {
  const t = styleRun(), d = t.ctx.cueApprove(t.id, { skip: ['S5'], bodies: { S1: 'Warm and brief.' } });
  assert.strictEqual(d.status, 'Done');
  deq(styleRows(t), [[true, 'all', 'tone', 'Warm and brief.'], [true, 'supplier', 'greeting', 'Hi [supplier]!'], [true, 'supplier', 'sign-off', 'Thanks po,\nKiko'],
    [true, 'client', 'sign-off', 'Cheers,\nKiko'], [true, 'supplier', 'example', 'Hi [supplier]!\n\nCan you quote [item] for [date]?\n\nThanks po,\nKiko']]);
  assert.throws(() => t.ctx.cueApprove(t.id, {}), /not waiting/);
  const rq = t.ctx.cueRun(t.ctx.cueSend(INQ, [], 'intake').request_id); assert.strictEqual(rq.status, 'Needs you');
  const call = t.log.gpt.filter(b => b.text.format.name === 'rfqs')[0];
  assert.ok(/^You write requests for quotation/.test(call.instructions), 'the RFQ rules stay first');
  assert.ok(/Kiko's own style/.test(call.instructions) && /Warm and brief\./.test(call.instructions) && /Example: Hi \[supplier\]/.test(call.instructions));
  assert.ok(!/Cheers/.test(call.instructions), 'client lines stay out of supplier emails');
  assert.strictEqual(JSON.parse(call.input).sign_off, 'Thanks po,\nKiko');
});
test('WL3 no guide: drafting prompts and sign-off are exactly as before; Off lines and an unreadable tab are ignored', () => {
  const t = startToCard(), call = t.log.gpt.filter(b => b.text.format.name === 'rfqs')[0];
  assert.ok(/^You write requests for quotation/.test(call.instructions) && !/own style/.test(call.instructions)); assert.strictEqual(JSON.parse(call.input).sign_off, 'Blank Space Events');
  const u = sandbox(); u.tabs.Style = sheetMock(); u.tabs.Style.appendRow(['On', 'Audience', 'Kind', 'Text']);
  u.tabs.Style.appendRow([false, 'supplier', 'sign-off', 'Off line']); u.tabs.Style.appendRow(['yes', 'Supplier', 'tone', 'On line']);
  assert.ok(/On line/.test(u.ctx.cueStyleFor_('supplier')) && !/Off line/.test(u.ctx.cueStyleFor_('supplier')));
  assert.strictEqual(u.ctx.cueStyleSignOff_('supplier'), 'Blank Space Events');
  u.tabs.Style.getRange = () => { throw new Error('sheet busy'); };
  assert.strictEqual(u.ctx.cueStyleFor_('supplier'), ''); assert.strictEqual(u.ctx.cueStyleSignOff_('client'), 'Blank Space Events');
});
test('WL4 pasted old notes reach Claude; too few emails without notes stops clearly; Close saves nothing; re-learning replaces the tab', () => {
  const p = styleRun({ say: 'Learn my style: always say "po" to suppliers' });
  assert.strictEqual(JSON.parse(p.log.claude[0].messages[0].content).old_style_notes, 'always say "po" to suppliers'); assert.ok(p.v.style.notes);
  const f = styleRun({ mine: MINE.slice(0, 3) }); assert.strictEqual(f.v.status, 'Failed'); assert.ok(/only 3 sent emails/.test(f.v.error)); assert.strictEqual(f.log.claude.length, 0);
  const g = styleRun({ mine: MINE.slice(0, 1), say: 'learn my style. Short and warm.' }); assert.strictEqual(g.v.status, 'Needs you');
  const c = styleRun(); assert.strictEqual(c.ctx.cueReject(c.id, '').status, 'Rejected'); assert.ok(!c.tabs.Style);
  const t = styleRun(); t.ctx.cueApprove(t.id, { skip: [] }); assert.strictEqual(styleRows(t).length, 6);
  const again = t.ctx.cueRun(t.ctx.cueSend('relearn my style', [], '').request_id);
  t.ctx.cueApprove(again.id, { skip: ['S2', 'S3', 'S4', 'S5', 'S6'] });
  deq(styleRows(t), [[true, 'all', 'tone', 'Warm, short and direct; first names.']], 'old rows blanked');
  assert.strictEqual(t.state(again.id).style.previous.length, 6, 'the replaced guide is kept in the request');
});
test('WL5 readiness follow-ups use every audience, labelled, and the general sign-off', () => {
  const t = sandbox(); t.tabs.Style = sheetMock(); [['On', 'Audience', 'Kind', 'Text'], [true, 'all', 'sign-off', 'Best,\nKiko'], [true, 'client', 'tone', 'Formal with clients'], [true, 'supplier', 'sign-off', 'Thanks po,\nKiko']].forEach(r => t.tabs.Style.appendRow(r));
  const any = t.ctx.cueStyleFor_('any'); assert.ok(/tone \(for clients\): Formal/.test(any) && /sign-off \(for suppliers\)/.test(any));
  assert.strictEqual(t.ctx.cueStyleSignOff_('all'), 'Best,\nKiko'); assert.strictEqual(t.ctx.cueStyleSignOff_('supplier'), 'Thanks po,\nKiko');
  assert.strictEqual(t.ctx.cueStyleSignOff_('team'), 'Best,\nKiko');
});
