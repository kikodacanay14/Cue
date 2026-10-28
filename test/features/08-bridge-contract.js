// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: bridge-contract.
test('AR8 PC check 27 Oct 01:53Z: the card keeps Kiko\'s ticks across a warning, and each "Can\'t make yet" row says why', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'Index.html'), 'utf8');
  const on = eval('(' + /function arOn\(attr, id, x, def\) \{[^\n]+\}/.exec(html)[0].replace(/^function arOn/, 'function') + ')');
  global.arTick = {}; arTick['data-amk|r1|juan'] = false; arTick['data-amk|r1|ana'] = true;
  deq([on('data-amk', 'r1', { key: 'juan' }, true), on('data-amk', 'r1', { key: 'ana' }, false), on('data-amk', 'r1', { key: 'carla' }, false), on('data-amk', 'r2', { key: 'ana' }, false)],
    [false, true, false, false], 'a kept tick wins over the default, per card'); delete global.arTick;
  assert.ok(/var ck = function \(x, attr, on, off\) \{ on = arOn\(attr, r\.id, x, on\);/.test(html), 'every crew docs box reads the kept tick');
  assert.ok(/arTick\[attr \+ '\|' \+ x\.getAttribute\(attr\) \+ '\|' \+ x\.value\] = x\.checked/.test(html), 'a tap, Tick all and Untick all are kept');
  assert.ok(/blocked\.map\(function \(x\) \{ return row\(x, '', x\.why\); \}\)/.test(html), 'the reason shows under each blocked name');
  assert.ok(/ticked of ' \+ \(of == null \? rows\.length : of\)/.test(html) && /x\.tick\) && !x\.off; \}\)\.length, n\)/.test(html), 'the count is of the names that can be ticked, as in the chat');
  assert.ok(/input\[' \+ attr \+ '\]:not\(\[disabled\]\)'/.test(html), 'the live count leaves out the turned-off rows too');
});
test('AR7 FSAs (Kiko 13:24Z "generate FSAs for ..."): the same command lists crew from Canvas, makes and sends FSAs', () => {
  const t = arCard({}, 'generate FSAs for S-31628060SP');
  assert.strictEqual(t.log.gpt.length, 0, 'typed command: no AI call at all');
  let v = t.ctx.cueView_(t.state(t.id)); assert.strictEqual(v.ar.doc, 'fsa'); assert.strictEqual(t.log.docKind, 'fsa');
  deq(v.ar.items.filter(x => x.tick).map(x => x.key), [], 'nothing ticked at first'); deq(v.ar.items.filter(x => !x.why && !x.doc && !x.off).map(x => x.key), ['juan cruz', 'ana reyes']); assert.ok(v.ar.items.find(x => x.key === 'carla lim').off);
  assert.ok(t.tabs.Chat.rows.some(x => /2 FSAs ready to make for S-31628060SP/.test(x[2])));
  t.ctx.cueApprove(t.id, { make: ['juan cruz', 'ana reyes'] }); v = t.ctx.cueRun(t.id);
  assert.strictEqual(v.stage, 'Ready to send'); assert.strictEqual(t.log.bridge.filter(b => b.action === 'crew_docs_make')[0].args.kind, 'fsa');
  t.ctx.cueApprove(t.id, { send: ['juan cruz'] }); deq(t.log.arMailed, ['juan cruz']);
  assert.ok(t.log.bridge.filter(b => b.action === 'crew_docs_send').every(b => b.args.kind === 'fsa' && !('intro' in b.args)), 'no edit: Canvas uses its own message');
});

test('Q5 timing comes from Kiko\'s Chaser rules card: first chase after 2 shows the Monday RFQ; paused shows none', () => {
  const t = rfqBox(); t.ctx.cueRulesSave({ 'rfq.first': 2 }); t.ctx.cueSweep();
  assert.ok(rfqBatch(t).batch.items.some(i => i.key === 'rfq:aaaa0000000000a2' && /No reply 2 working days after your RFQ/.test(i.why)));
  const u = rfqBox(); u.ctx.cueRulesSave({ 'rfq.on': false }); u.ctx.cueSweep();
  assert.ok(!u.log.threads, 'paused: Gmail is not even read'); assert.ok(u.tabs.Chat.rows.some(r => /nothing to chase today/.test(r[2])));
});
test('Q6 event soon: after a nudge the next one is due in soon_every (1 working day), not every (3)', () => {
  const t = rfqBox(); t.at('2026-10-21', 10, 0); t.ctx.cueSweep(); t.ctx.cueApprove(rfqBatch(t).id, { send: true });
  deq(chase(t).filter(r => /a6|a1/.test(r[0])).map(r => [r[0], r[6]]).sort(), [['rfq:aaaa0000000000a1', '2026-10-26'], ['rfq:aaaa0000000000a6', '2026-10-22']]);
});
