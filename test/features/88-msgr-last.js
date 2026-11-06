// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: BUGFIX-MSGR-LAST-2026-11-06 (CueMessenger.gs).
// Kiko 6 Nov 2026 03:30Z: linked by "I'm crew" and the code, yet their waiting FSA never came on Messenger, because Canvas had no
// "Last Messenger message" for anyone linked by code or by staff Link. 03:31Z: "Please check if this would happen to others too".
test('ML1 code link: the code they typed is saved in Canvas as their last message, right away', () => {
  const b = crewBox({ crew_match: { status: 'code_sent', channel: 'mobile', hint: '12', project: 'Kings Day', first: 'Ana', person: 'Ana Cruz' },
    crew_code_check: () => ({ status: 'linked', first: 'Ana', project: 'Kings Day', key: 'ana@example.test' }) });
  b.crew('Ana Cruz / Kings Day');
  b.door(msgrIn('2002', { text: '482913', ts: Date.parse('2026-11-02T06:30:00Z') }));
  const s = b.calls.filter(c => c[0] === 'fl_social_save');
  assert.strictEqual(s.length, 1, 'one save, at the link');
  deq([s[0][1].email, s[0][1].last_message], ['ana@example.test', '2026-11-02T06:30:00.000Z']);
  assert.strictEqual(bridgeCheck('fl_social_save', s[0][1]), '');
});
test('ML2 staff Link: Canvas and Messenger People get the time of their own last message, not our "you\'re linked" message', () => {
  const b = crewBox({ crew_match: { status: 'no_contact', project: 'Kings Day', first: 'Juan', person: 'Juan Reyes' }, msgr_told: { ok: true, marked: 1 } });
  b.crew('Juan Reyes / Kings Day');
  const last = JSON.parse(b.t.props.MSGR_TRI_2002).last;
  b.t.ctx.cueBridge_ = ((orig) => (s, action, args) => action === 'msgr_due'
    ? { docs: [], tell: [{ psid: '2002', status: 'linked', first: 'Juan', project: 'Kings Day', key: 'juan@example.test' }] } : orig(s, action, args))(b.t.ctx.cueBridge_);
  b.t.ctx.cueMsgrRun_(Date.parse('2026-11-02T06:45:00Z'));
  const s = b.calls.filter(c => c[0] === 'fl_social_save');
  deq(s.map(c => [c[1].email, c[1].last_message]), [['juan@example.test', last]]);
  assert.strictEqual(b.t.tabs['Messenger People'].rows.find(r => r[0] === '2002')[3], last);
});
const ML_DOC = { doc: 'FSA', id: 'FSA-9901', project: 'Kings Day', name: 'Kiko Dacanay', email: 'kiko@example.test',
  sign_link: 'https://canvas.blankspaceevent.com/crew?v=sign&t=k.k', messenger_id: '7001', last_message: '', sent: false };
test('ML3 Canvas has no time: Cue uses its own Messenger People time, sends inside the window, and copies the time to Canvas once', () => {
  const docs = [ML_DOC, Object.assign({}, ML_DOC, { doc: 'AR', id: 'AR-9902' })];
  const b = msgrBox({ docs });
  b.ctx.cueMsgrPeople_ = () => ({ 7001: { psid: '7001', email: 'kiko@example.test', last: '2026-11-02T01:00:00.000Z' } });
  const r = b.ctx.cueMsgrRun_(MSGR_NOW);
  assert.strictEqual(r.sent, 2);
  const copies = b.log.bridge.filter(x => x[0] === 'fl_social_save').map(x => x[1]);
  deq(copies.map(c => [c.email, c.last_message]), [['kiko@example.test', '2026-11-02T01:00:00.000Z']]);
  assert.strictEqual(bridgeCheck('fl_social_save', copies[0]), '');
});
test('ML4 a Cue time Meta says is outside its window: skipped, not failed, and not tried again until the time changes', () => {
  const b = msgrBox({ docs: [ML_DOC], code: () => 400 });
  let last = '2026-11-02T01:00:00.000Z';
  b.ctx.cueMsgrPeople_ = () => ({ 7001: { psid: '7001', email: 'kiko@example.test', last } });
  const r = b.ctx.cueMsgrRun_(MSGR_NOW);
  deq([r.sent, r.failed.length, r.skipped.map(x => x.why)], [0, 0, ['outside Meta\'s window']]);
  assert.ok(!b.log.bridge.some(x => x[0] === 'fl_social_save'), 'a time Meta refused is not copied to Canvas');
  b.ctx.cueMsgrRun_(MSGR_NOW + 15 * 60 * 1000);
  assert.strictEqual(b.log.fetch.length, 1, 'no second try with the same time');
  last = '2026-11-02T07:50:00.000Z'; b.ctx.cueMsgrRun_(MSGR_NOW + 30 * 60 * 1000);
  assert.strictEqual(b.log.fetch.length, 2, 'a newer message: tried again');
});
test('ML5 Canvas has a time: it wins, and Cue copies nothing', () => {
  const b = msgrBox({ docs: [Object.assign({}, ML_DOC, { last_message: '2026-11-02T06:00:00Z' })] });
  b.ctx.cueMsgrPeople_ = () => { throw new Error('not read'); };
  assert.strictEqual(b.ctx.cueMsgrRun_(MSGR_NOW).sent, 1);
  assert.ok(!b.log.bridge.some(x => x[0] === 'fl_social_save'));
});
