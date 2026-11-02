// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: Messenger sign links (CueMessenger.gs).
// CUE-MSGR-2026-11-02. Canvas bridge actions msgr_due and msgr_mark are not in fixtures/ZapBridge.gs until the Canvas release
// ships (handoffs/messenger-crew-canvas in CanvasWorkspace); their argument shapes are checked here by hand.
const MSGR_SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'CueMessenger.gs'), 'utf8');
const MSGR_NOW = Date.parse('2026-11-02T08:00:00Z');
const MSGR_DUE = [
  { doc: 'FSA', id: 'FSA-0101', project: 'Synthetic Year-End Party', name: 'Ana Cruz', email: 'ana@example.test',
    sign_link: 'https://canvas.blankspaceevent.com/crew?v=sign&t=aaa.bbb', messenger_id: '1001', last_message: '2026-11-02T06:06:00Z', sent: false },
  { doc: 'AR', id: 'AR-0202', project: 'Synthetic Year-End Party', name: 'Ben Lim', email: 'ben@example.test',
    sign_link: 'https://canvas.blankspaceevent.com/crew?v=sign&t=ccc.ddd', messenger_id: '1002', last_message: '2026-10-30T06:00:00Z', sent: false },
  { doc: 'AR', id: 'AR-0303', project: 'Synthetic Year-End Party', name: 'Ana Cruz', email: 'ana@example.test',
    sign_link: 'https://canvas.blankspaceevent.com/crew?v=sign&t=eee.fff', messenger_id: '1001', last_message: '2026-11-02T06:06:00Z', sent: true },
  { doc: 'FSA', id: 'FSA-0404', project: 'Synthetic Year-End Party', name: 'Cy Go', email: 'cy@example.test',
    sign_link: 'https://canvas.blankspaceevent.com/crew?v=sign&t=ggg.hhh', messenger_id: '1003', last_message: '', sent: false }];
function msgrBox(o = {}) {
  const props = Object.assign({ MSGR_PAGE_TOKEN: 'page-token' }, o.props || {}), log = { bridge: [], fetch: [] };
  const ctx = { console, JSON, Date, Number, String, Math, Object, Array, isNaN,
    cueNow_: () => o.now || MSGR_NOW,
    cueBridge_: (s, action, args) => { log.bridge.push([action, args, s && s.id]); return action === 'msgr_due' ? { docs: o.docs || MSGR_DUE } : { ok: true, existed: false }; },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] == null ? null : props[k], setProperty: (k, v) => { props[k] = v; } }) },
    UrlFetchApp: { fetch: (url, req) => { log.fetch.push([url, req]); const code = o.code ? o.code(req) : 200;
      return { getResponseCode: () => code, getContentText: () => code === 200 ? '{"message_id":"m1"}' : '{"error":{"message":"(#10) This message is sent outside of allowed window."}}' }; } } };
  vm.createContext(ctx); vm.runInContext(MSGR_SRC, ctx);
  return { ctx, log, props };
}
test('M1 window: readable and under 24 hours only; blank or bad time is outside', () => {
  const { ctx } = msgrBox();
  assert.strictEqual(ctx.cueMsgrInWindow_('2026-11-02T06:06:00Z', MSGR_NOW), true);
  assert.strictEqual(ctx.cueMsgrInWindow_('2026-11-01T08:00:00Z', MSGR_NOW), false, 'exactly 24 hours is closed');
  assert.strictEqual(ctx.cueMsgrInWindow_('', MSGR_NOW), false);
  assert.strictEqual(ctx.cueMsgrInWindow_('not a date', MSGR_NOW), false);
  assert.strictEqual(ctx.cueMsgrInWindow_('2026-11-03T08:00:00Z', MSGR_NOW), false, 'a future time is not trusted');
});
test('M2 one pass: sends only inside the window, skips sent docs, marks each send once in Canvas', () => {
  const { ctx, log } = msgrBox(), r = ctx.cueMsgrRun_(MSGR_NOW);
  assert.strictEqual(r.sent, 1);
  deq(r.skipped.map(x => [x.id, x.why]), [['AR-0202', 'last message over 24 hours ago'], ['FSA-0404', 'last message over 24 hours ago']]);
  assert.strictEqual(log.fetch.length, 1);
  const [url, req] = log.fetch[0], body = JSON.parse(req.payload);
  assert.strictEqual(url, 'https://graph.facebook.com/v21.0/me/messages');
  assert.strictEqual(req.headers.Authorization, 'Bearer page-token'); assert.ok(url.indexOf('page-token') < 0, 'the token is never in the URL');
  deq(body.recipient, { id: '1001' }); assert.strictEqual(body.messaging_type, 'RESPONSE'); assert.ok(!body.tag, 'no message tag');
  assert.strictEqual(body.message.text, 'Ana, your Freelancer Service Agreement for Synthetic Year-End Party is ready to sign: '
    + 'https://canvas.blankspaceevent.com/crew?v=sign&t=aaa.bbb\nThe link works for 30 days. It\'s also in your email.');
  const marks = log.bridge.filter(b => b[0] === 'msgr_mark');
  deq(marks.map(b => b[1]), [{ request_id: 'msgr:FSA:FSA-0101', doc: 'FSA', id: 'FSA-0101', email: 'ana@example.test', psid: '1001' }]);
  const m = marks[0][1];
  assert.strictEqual(bridgeCheck('msgr_mark', m), ''); assert.strictEqual(bridgeCheck('msgr_due', {}), '');
});
test('M3 a document skipped today goes out when the crew member messages again while it is unsigned', () => {
  const later = MSGR_DUE.map(d => d.id === 'AR-0202' ? Object.assign({}, d, { last_message: '2026-11-04T01:00:00Z' }) : Object.assign({}, d, { sent: true }));
  const { ctx, log } = msgrBox({ docs: later }); const r = ctx.cueMsgrRun_(Date.parse('2026-11-04T02:00:00Z'));
  assert.strictEqual(r.sent, 1); assert.strictEqual(JSON.parse(log.fetch[0][1].payload).recipient.id, '1002');
  assert.ok(/Acknowledgement Receipt/.test(JSON.parse(log.fetch[0][1].payload).message.text));
});
test('M4 the text carries only the sign link: no account numbers or other people', () => {
  const { ctx } = msgrBox(), t = ctx.cueMsgrText_(MSGR_DUE[0]);
  assert.ok(!/\d{6,}/.test(t.replace(MSGR_DUE[0].sign_link, '')), t); assert.ok(t.indexOf('Ben') < 0);
});
test('M5 a Meta refusal is not marked, so it is tried again; the job reports it as Failed in Job Runs', () => {
  const { ctx, log } = msgrBox({ code: () => 400 });
  assert.throws(() => ctx.cueMsgrRun_(MSGR_NOW), /Messenger: 1 not sent \(FSA-0101: Meta 400: \(#10\) This message is sent outside of allowed window\.\)/);
  assert.ok(!log.bridge.some(b => b[0] === 'msgr_mark'));
});
test('M6 the job runs every 15 minutes at most, and does nothing without the page token', () => {
  const a = msgrBox(); assert.strictEqual(a.ctx.cueMsgrTick_(), 1);
  assert.strictEqual(a.ctx.cueMsgrTick_(), 0, 'same tick window'); assert.strictEqual(a.log.bridge.filter(b => b[0] === 'msgr_due').length, 1);
  const b = msgrBox({ props: { MSGR_PAGE_TOKEN: null } }); assert.strictEqual(b.ctx.cueMsgrTick_(), 0);
  assert.strictEqual(b.log.bridge.length, 0, 'no Canvas read without the token'); assert.strictEqual(b.log.fetch.length, 0);
});
test('M7 the job is on the Job Runs list', () => {
  const jobs = fs.readFileSync(path.join(__dirname, '..', 'src', 'CueJobs.gs'), 'utf8');
  assert.ok(/\{ job: 'Messenger sign links', fn: 'cueMsgrTick_' \}/.test(jobs));
});
