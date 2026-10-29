// Part of test/cue.test.js: CUE-RUN-NOW-2026-10-28 (Kiko 28 Oct 2026 11:46Z "a screen where we can manually trigger"; 12:01Z "i am
// allowing all notifications except for client sends. also allowed are the chasers"): Canvas > Admin > Run now > Cue chasers
// (CueRunNow.gs). Cue sends Canvas the RFQ, accreditation and signature lines of today's waiting batch and runs Kiko's presses.

const rncBox = (o) => { const t = sweepBox(o || {}, { kind: 'rfq' }); t.at('2026-10-21', 10, 0); return t; };
const rncLines = t => (t.log.cueCh || []).filter(a => a.lines).map(a => a.lines).pop() || [];

test('RC1 the lines Canvas shows: today\'s waiting batch, RFQ / accreditation / signature lines that can be sent; sent again only when they change', () => {
  const t = rncBox(); t.ctx.cueSweep();
  t.ctx.cueRunNowTick_();
  deq(rncLines(t).map(x => [x.kind, x.key, x.who, x.batch === batchOf(t).id]), [['rfq', 'rfq:bbbbbbbbbbbbbbbb', 'Mats Co', true], ['rfq', 'rfq:aaaaaaaaaaaaaaaa', 'Sonic Pro', true]]);
  t.ctx.cueRunNowTick_();
  deq(t.log.cueCh.map(a => !!a.lines), [true, false], 'an unchanged list is not sent again');
  const u = sweepBox({}, { kind: 'award' }); u.at('2026-10-21', 10, 0); u.ctx.cueSweep(); u.ctx.cueRunNowTick_();
  deq(rncLines(u), [], 'a client chaser (CE award) never goes to Run now');
});

test('RC2 Send ticked: those lines go from Kiko\'s Gmail now, are logged as chased and leave the batch; the rest still waits for Kiko; Canvas gets the result', () => {
  const presses = [], t = rncBox({ cuePresses: presses }); t.ctx.cueSweep(); const id = batchOf(t).id;
  t.ctx.cueRunNowTick_();
  presses.push({ press: 'cp-abc123', what: 'send', batch: id, keys: ['rfq:aaaaaaaaaaaaaaaa'] });
  deq(JSON.parse(JSON.stringify(t.ctx.cueRunNowTick_())), { ran: 1 });
  assert.strictEqual(t.log.replies.length, 1, 'a reply in the RFQ thread'); assert.strictEqual(t.log.sent.length, 1);
  const b = batchOf(t), it = b.batch.items.find(i => i.key === 'rfq:aaaaaaaaaaaaaaaa');
  deq([b.status, it.removed, it.selected, it.sent], ['Needs you', 'sent', false, true]);
  deq(chase(t).map(r => [r[0], r[5], r[8]]), [['rfq:aaaaaaaaaaaaaaaa', 1, 'sent']]);
  const last = t.log.cueCh[t.log.cueCh.length - 1];
  deq(last.done, [{ press: 'cp-abc123', ok: true, result: 'Sent 1 of 1' }]);
  deq(last.lines.map(x => x.key), ['rfq:bbbbbbbbbbbbbbbb'], 'the new list goes with the result');
  assert.ok(t.tabs['Job Runs'].rows.some(r => r[2] === 'Run now: Cue chasers' && r[3] === 'OK'));
  assert.ok(t.tabs.Chat.rows.some(r => r[3] === id && /Sent 1 chaser from Canvas Chasers. The rest of the batch still waits for you./.test(r[2])));
  t.ctx.cueApprove(id, { send: true });
  assert.strictEqual(t.log.sent.length, 2, 'Approve later sends the rest, never the Run now line again');
});

test('RC3 a press for a line already gone, or a batch no longer waiting, sends nothing and says why; Find chasers now builds today\'s batch once', () => {
  const t = rncBox(); t.ctx.cueSweep(); const id = batchOf(t).id;
  const r = t.ctx.cueSweepSendNow_(id, ['rfq:zzzz']); deq([r.sent, r.failed], [0, ['rfq:zzzz: not in this batch any more']]);
  t.ctx.cueApprove(id, { send: true });
  assert.throws(() => t.ctx.cueSweepSendNow_(id, ['rfq:bbbbbbbbbbbbbbbb']), /This batch is done/);
  const f = rncBox(); deq(JSON.parse(JSON.stringify(f.ctx.cueRncRun_({ what: 'find' }))), { ok: true, result: 'Found 2 to send' });
  assert.strictEqual(batchOf(f).status, 'Needs you');
  deq(JSON.parse(JSON.stringify(f.ctx.cueRncRun_({ what: 'find' }))), { ok: true, result: 'Today\'s batch is already waiting: 2 to send here' });
});

test('RC4 it runs from the 1-minute trigger even with the RFP row off; Canvas not answering is quiet; a cloud check never calls it', () => {
  const t = rncBox(); t.ctx.cueSweep(); t.ctx.cueRfpKick(); assert.ok(t.log.cueCh.length >= 1);
  const u = rncBox({ cueChFail: true }); u.ctx.cueSweep(); u.ctx.cueRfpKick();
  assert.ok(!((u.tabs['Job Runs'] || { rows: [] }).rows.some(r => r[2] === 'Run now: Cue chasers')), 'no row while Canvas lacks the action');
  const c = rncBox(); c.ctx.CUE_CHECK_ON_ = true; assert.strictEqual(c.ctx.cueRunNowTick_(), null); assert.ok(!c.log.cueCh);
});
