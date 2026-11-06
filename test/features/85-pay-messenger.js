// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: payment notices by Messenger (CueMessenger.gs).
// PAY-MSGR-2026-11-06 (Kiko 6 Nov 2026: payment notices by Messenger, SMS backup R-PMN-1). Canvas holds the texts
// (CanvasWorkspace src/PayMessenger.gs, bridge msgr_pay_due and msgr_pay_mark); Cue sends them and reports each one back.
const PAY_HELD = [
  { id: 'PM-MH6A1B2C-1A', psid: '1001', name: 'Ana Cruz', text: 'Blank Space Events: Payment sent: P5,000.00 (Synthetic Year-End Party). Details: canvas.blankspaceevent.com/crew' },
  { id: 'PM-MH6A1B2D-2B', psid: '1002', name: 'Ben Lim', text: 'Blank Space Events: Payment received: P1,200.00' }];
const payMarks = log => log.bridge.filter(b => b[0] === 'msgr_pay_mark').map(b => b[1]);
test('PM1 each held payment text goes on Messenger as a normal reply and is reported sent', () => {
  const { ctx, log } = msgrBox({ pay: PAY_HELD });
  assert.strictEqual(ctx.cueMsgrPayRun_(), 2);
  assert.strictEqual(log.fetch.length, 2);
  const body = JSON.parse(log.fetch[0][1].payload);
  deq(body.recipient, { id: '1001' }); assert.strictEqual(body.messaging_type, 'RESPONSE');
  deq(body.message.attachment.payload, { template_type: 'button', text: 'Blank Space Events: Payment sent: P5,000.00 (Synthetic Year-End Party).',
    buttons: [{ type: 'web_url', url: 'https://canvas.blankspaceevent.com/crew', title: 'View details' }] });
  assert.strictEqual(JSON.parse(log.fetch[1][1].payload).message.text, PAY_HELD[1].text, 'no link: plain text');
  deq(payMarks(log), [{ request_id: 'msgrpay:PM-MH6A1B2C-1A', id: 'PM-MH6A1B2C-1A', ok: true }, { request_id: 'msgrpay:PM-MH6A1B2D-2B', id: 'PM-MH6A1B2D-2B', ok: true }]);
  payMarks(log).forEach(m => assert.strictEqual(bridgeCheck('msgr_pay_mark', m), ''));
  assert.strictEqual(bridgeCheck('msgr_pay_due', {}), '');
});
test('PM2 Meta refuses: reported not ok with the reason, so Canvas texts it (R-PMN-1)', () => {
  const { ctx, log } = msgrBox({ pay: PAY_HELD.slice(0, 1), code: () => 400 });
  assert.strictEqual(ctx.cueMsgrPayRun_(), 0);
  deq(payMarks(log), [{ request_id: 'msgrpay:PM-MH6A1B2C-1A', id: 'PM-MH6A1B2C-1A', ok: false,
    why: 'Meta 400: (#10) This message is sent outside of allowed window.' }]);
  assert.strictEqual(bridgeCheck('msgr_pay_mark', payMarks(log)[0]), '');
});
test('PM3 no Page token: Cue never asks Canvas, so Canvas holds nothing and texts as before', () => {
  const b = msgrBox({ pay: PAY_HELD, props: { MSGR_PAGE_TOKEN: null } });
  assert.strictEqual(b.ctx.cueMsgrTick_(), 0); assert.strictEqual(b.log.fetch.length, 0); assert.strictEqual(b.log.bridge.length, 0);
});
test('PM3b with the token, a tick sends the held payment texts and the sign links', () => {
  const b = msgrBox({ pay: PAY_HELD.slice(0, 1) });
  assert.strictEqual(b.ctx.cueMsgrTick_(), 2);
  deq(b.log.bridge.map(x => x[0]).slice(0, 2), ['msgr_pay_due', 'msgr_pay_mark']);
});
test('PM4 with MSGR_PAY_TEMPLATE the text goes as a Meta utility message, without the "Blank Space Events:" lead', () => {
  const { ctx, log } = msgrBox({ pay: PAY_HELD.slice(0, 1), props: { MSGR_PAY_TEMPLATE: 'bse_payment_update' } });
  assert.strictEqual(ctx.cueMsgrPayRun_(), 1);
  const [url, req] = log.fetch[0], body = JSON.parse(req.payload);
  assert.strictEqual(url, 'https://graph.facebook.com/v21.0/me/messages'); assert.strictEqual(req.headers.Authorization, 'Bearer page-token');
  assert.strictEqual(body.messaging_type, 'UTILITY'); assert.ok(!body.message.text);
  deq(body.message.template, { name: 'bse_payment_update', language: { code: 'en' }, components: [{ type: 'body', parameters: [{ type: 'text',
    text: 'Payment sent: P5,000.00 (Synthetic Year-End Party). Details: canvas.blankspaceevent.com/crew' }] }] });
});
test('PM5 Meta took it but Canvas did not record it: the next run retries only the report, never a second message', () => {
  let fail = true; const b = msgrBox({ pay: PAY_HELD.slice(0, 1), markFail: () => fail });
  assert.strictEqual(b.ctx.cueMsgrPayRun_(), 1); assert.strictEqual(b.log.fetch.length, 1);
  assert.ok(b.props['CUE_MSGR_PAY_PM-MH6A1B2C-1A'], 'remembered locally');
  fail = false; assert.strictEqual(b.ctx.cueMsgrPayRun_(), 0);
  assert.strictEqual(b.log.fetch.length, 1, 'no second message'); assert.ok(!b.props['CUE_MSGR_PAY_PM-MH6A1B2C-1A'], 'cleared once Canvas recorded it');
  deq(payMarks(b.log).pop(), { request_id: 'msgrpay:PM-MH6A1B2C-1A', id: 'PM-MH6A1B2C-1A', ok: true });
});
test('PM6 a Canvas that cannot be read sends nothing and does not stop the sign links', () => {
  const b = msgrBox(); b.ctx.cueBridge_ = (s, a) => { if (a === 'msgr_pay_due') throw new Error('Canvas busy'); return a === 'msgr_due' ? { docs: [] } : { ok: true }; };
  assert.strictEqual(b.ctx.cueMsgrPayRun_(), 0);
  assert.strictEqual(b.ctx.cueMsgrTick_(), 0);
});
test('PM7 MSGR-BUTTONS (Kiko 6 Nov 08:33Z "that kind of button all the time"): a trailing link becomes the button; the words keep their own ending', () => {
  const { ctx } = msgrBox();
  const s = x => JSON.parse(JSON.stringify(ctx.cueMsgrLinkSplit_(x)));
  deq(s('Payment sent: P500.00. Details: canvas.blankspaceevent.com/crew'), { text: 'Payment sent: P500.00.', url: 'https://canvas.blankspaceevent.com/crew' });
  deq(s('Proof is in: https://canvas.blankspaceevent.com/x?id=1'), { text: 'Proof is in.', url: 'https://canvas.blankspaceevent.com/x?id=1' });
  assert.strictEqual(ctx.cueMsgrLinkSplit_('Payment received: P1,200.00'), null, 'no link: plain text');
  assert.strictEqual(ctx.cueMsgrLinkSplit_('canvas.blankspaceevent.com/crew'), null, 'a link alone has no words for the card');
  assert.strictEqual(ctx.cueMsgrLinkSplit_('Pay P1,200.00 today'), null, 'an amount is not a link');
});
