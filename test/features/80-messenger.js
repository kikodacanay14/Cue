// Part of test/cue.test.js (live line 1.28.x port), loaded in file-name order into one shared scope. Feature: Messenger sign links (CueMessenger.gs).
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
    cueBridge_: (s, action, args) => { log.bridge.push([action, args, s && s.id]); if (action === 'msgr_due') return { docs: o.docs || MSGR_DUE };
      if (action === 'msgr_pay_due') return { items: o.pay || [] };   // PAY-MSGR-2026-11-06 (85-pay-messenger.js)
      if (o.markFail && o.markFail()) throw new Error('Canvas busy'); return { ok: true, existed: false }; },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] == null ? null : props[k], setProperty: (k, v) => { props[k] = v; }, deleteProperty: k => { delete props[k]; } }) },
    UrlFetchApp: { fetch: (url, req) => { log.fetch.push([url, req]); const code = o.code ? o.code(req) : 200;
      return { getResponseCode: () => code, getContentText: () => code === 200 ? '{"message_id":"m1"}' : '{"error":{"message":"(#10) This message is sent outside of allowed window."}}' }; } } };
  vm.createContext(ctx); vm.runInContext(MSGR_SRC, ctx);
  return { ctx, log, props };
}
test('MS1 window: readable and under 24 hours only; blank or bad time is outside', () => {
  const { ctx } = msgrBox();
  assert.strictEqual(ctx.cueMsgrInWindow_('2026-11-02T06:06:00Z', MSGR_NOW), true);
  assert.strictEqual(ctx.cueMsgrInWindow_('2026-11-01T08:00:00Z', MSGR_NOW), false, 'exactly 24 hours is closed');
  assert.strictEqual(ctx.cueMsgrInWindow_('', MSGR_NOW), false);
  assert.strictEqual(ctx.cueMsgrInWindow_('not a date', MSGR_NOW), false);
  assert.strictEqual(ctx.cueMsgrInWindow_('2026-11-03T08:00:00Z', MSGR_NOW), false, 'a future time is not trusted');
});
test('MS2 one pass: sends only inside the window, skips sent docs, marks each send once in Canvas', () => {
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
test('MS3 a document skipped today goes out when the crew member messages again while it is unsigned', () => {
  const later = MSGR_DUE.map(d => d.id === 'AR-0202' ? Object.assign({}, d, { last_message: '2026-11-04T01:00:00Z' }) : Object.assign({}, d, { sent: true }));
  const { ctx, log } = msgrBox({ docs: later }); const r = ctx.cueMsgrRun_(Date.parse('2026-11-04T02:00:00Z'));
  assert.strictEqual(r.sent, 1); assert.strictEqual(JSON.parse(log.fetch[0][1].payload).recipient.id, '1002');
  assert.ok(/Acknowledgement Receipt/.test(JSON.parse(log.fetch[0][1].payload).message.text));
});
test('MS3b Meta accepted but Canvas did not record it: the next tick retries only the record, never a second message (Codex review)', () => {
  let fail = true; const b = msgrBox({ markFail: () => fail });
  assert.strictEqual(b.ctx.cueMsgrRun_(MSGR_NOW).sent, 1); assert.strictEqual(b.log.fetch.length, 1);
  assert.ok(b.props['CUE_MSGR_SENT_FSA:FSA-0101'], 'remembered locally');
  fail = false; b.ctx.cueMsgrRun_(MSGR_NOW + 15 * 60 * 1000);
  assert.strictEqual(b.log.fetch.length, 1, 'no second Messenger send');
  assert.strictEqual(b.log.bridge.filter(x => x[0] === 'msgr_mark').length, 2); assert.ok(!b.props['CUE_MSGR_SENT_FSA:FSA-0101'], 'dropped once Canvas has it');
});
test('MS4 the text carries only the sign link: no account numbers or other people', () => {
  const { ctx } = msgrBox(), t = ctx.cueMsgrText_(MSGR_DUE[0]);
  assert.ok(!/\d{6,}/.test(t.replace(MSGR_DUE[0].sign_link, '')), t); assert.ok(t.indexOf('Ben') < 0);
});
test('MS5 a Meta refusal is not marked, so it is tried again; the job reports it as Failed in Job Runs', () => {
  const { ctx, log } = msgrBox({ code: () => 400 });
  assert.throws(() => ctx.cueMsgrRun_(MSGR_NOW), /Messenger: 1 not sent \(FSA-0101: Meta 400: \(#10\) This message is sent outside of allowed window\.\)/);
  assert.ok(!log.bridge.some(b => b[0] === 'msgr_mark'));
});
test('MS6 the job runs every 15 minutes at most, and does nothing without the page token', () => {
  const a = msgrBox(); assert.strictEqual(a.ctx.cueMsgrTick_(), 1);
  assert.strictEqual(a.ctx.cueMsgrTick_(), 0, 'same tick window'); assert.strictEqual(a.log.bridge.filter(b => b[0] === 'msgr_due').length, 1);
  const b = msgrBox({ props: { MSGR_PAGE_TOKEN: null } }); assert.strictEqual(b.ctx.cueMsgrTick_(), 0);
  assert.strictEqual(b.log.bridge.length, 0, 'no Canvas read without the token'); assert.strictEqual(b.log.fetch.length, 0);
});
test('MS7 the job is on the Job Runs list', () => {
  const jobs = fs.readFileSync(path.join(__dirname, '..', 'src', 'CueJobs.gs'), 'utf8');
  assert.ok(/\{ job: 'Messenger sign links', fn: 'cueMsgrTick_' \}/.test(jobs));
});

// ---------- the receiving half (relay door msgr_event, Messenger chats) ----------
const MSGR_KEY = 'mr_relay-key-not-real-0123456789abcdef';
const msgrIn = (psid, o = {}) => ({ object: 'page', entry: [{ id: '110499580567237', messaging: [Object.assign({ sender: { id: psid }, recipient: { id: '110499580567237' },
  timestamp: o.ts || Date.parse('2026-11-02T06:06:00Z') }, o.ref ? { referral: { ref: o.ref, source: 'SHORTLINK', type: 'OPEN_THREAD' } } : {},
  o.text != null ? { message: Object.assign({ mid: 'mid.' + psid, text: o.text }, o.echo ? { is_echo: true } : {}, o.qr ? { quick_reply: { payload: o.qr } } : {}) } : {}, o.pb ? { postback: { title: o.pb[0], payload: o.pb[1], mid: 'mid.pb.' + psid } } : {})] }] });
function msgrSandbox(o = {}) {
  const saves = [], held = [], box = {};
  const t = sandbox(Object.assign({
    bridgeFn: b => {
      if (b.action !== 'fl_social_save') return undefined;
      saves.push(b.args);
      if (b.args.ref === 'bad.ref') return { ok: false, error: 'This Messenger link is not valid.' };
      return { ok: true, email: b.args.email || 'ana@example.test', raketeer: 'FR-ANCR5001', written: [] };
    },
    fb: (u, req) => /\?fields=name,gender$/.test(u) ? { getResponseCode: () => 200, getContentText: () => '{"name":"Ana Cruz","gender":"female","id":"1001"}' }
      : { getResponseCode: () => 200, getContentText: () => '{"message_id":"m1"}' },
    relay: (u, req, body) => {
      if ((req.headers || {}).Authorization !== 'Bearer ' + MSGR_KEY) return { getResponseCode: () => 403, getContentText: () => '{}' };
      if (/\/events$/.test(u)) return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ events: held.splice(0) }) };
      if (/\/sync$/.test(u)) { (box.synced = box.synced || []).push(body); return { getResponseCode: () => 200, getContentText: () => '{"ok":true}' }; }
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ dropped: body.ids.length }) };
    }
  }, o));
  t.props.MSGR_PAGE_TOKEN = 'page-token'; t.props.MSGR_RELAY_KEY = MSGR_KEY; t.props.MSGR_RELAY_URL = 'https://relay.example.workers.dev';
  let T = Date.parse('2026-11-02T06:40:00Z'); t.ctx.cueNow_ = () => T; t.at = iso => { T = Date.parse(iso); };
  let n = 0;
  const door = event => { held.push({ id: 'e:' + String(1e12 + (++n)) + ':0000000' + n, event }); const h = t.ctx.cueMsgrPull_(); return { ok: true, handled: h }; };
  return { t, saves, door, held, box, sent: () => (t.log.fb || []).filter(x => /\/me\/messages$/.test(x.url)).map(x => [x.body.recipient.id, x.body.message.text || ((x.body.message.attachment || {}).payload || {}).text]) };
}
test('MS8 a sealed m.me ref links the crew member in Canvas with Facebook name and gender, says so, and opens their Cue chat', () => {
  const { t, saves, door, sent } = msgrSandbox();
  deq(door(msgrIn('1001', { ref: 'sealed.ref', text: 'Hi! Ana here' })), { ok: true, handled: 1 });
  assert.strictEqual(saves.length, 1); const a = saves[0];
  deq([a.ref, a.messenger_id, a.messenger_name, a.gender, a.linked_at, a.last_message], ['sealed.ref', '1001', 'Ana Cruz', 'female', '2026-11-02T06:06:00.000Z', '2026-11-02T06:06:00.000Z']);
  assert.ok(/^msgrlink:1001:/.test(a.request_id));
  deq(sent(), [['1001', 'Hi Ana! You\'re linked to Blank Space Events. Your papers to sign will come here too. Reply anytime if you have a question.']]);
  const ppl = t.tabs['Messenger People'].rows; deq(ppl[1].slice(0, 3), ['1001', 'ana@example.test', 'Ana Cruz']);
  const chat = ppl[1][4], s = t.state(chat);
  deq([s.kind, s.text, s.status, s.msgr.psid], ['msgr', 'Messenger · Ana Cruz', 'Needs you', '1001']);
  assert.ok(t.tabs.Chat.rows.some(r => r[3] === chat && r[1] === 'Ana Cruz · Messenger' && r[2] === 'Hi! Ana here'));
  assert.strictEqual(t.log.claude.length, 0, 'no AI call on crew messages');
});
test('MS9 a linked crew member\'s message updates the last-message time in Canvas and lands in the same chat; echoes are ignored', () => {
  const { t, saves, door } = msgrSandbox(); door(msgrIn('1001', { ref: 'sealed.ref' }));
  const chat = t.tabs['Messenger People'].rows[1][4];
  door(msgrIn('1001', { text: 'Signed na po. Anong oras call time sa Friday?', ts: Date.parse('2026-11-02T06:31:00Z') }));
  deq(saves[1], { request_id: saves[1].request_id, email: 'ana@example.test', last_message: '2026-11-02T06:31:00.000Z' });
  assert.ok(t.bridgeOk !== false && bridgeCheck('fl_social_save', saves[1]) === '');
  assert.ok(t.tabs.Chat.rows.some(r => r[3] === chat && /Anong oras call time/.test(r[2])));
  deq(door(msgrIn('1001', { text: 'our own reply', echo: true })), { ok: true, handled: 0 });
});
test('MS10 changed links save nothing and get a polite reply; a stranger gets the triage once and leaves one Ask Cue line (no flood)', () => {
  const { t, saves, door, sent } = msgrSandbox();
  door(msgrIn('2002', { text: 'magkano po package?' }));
  door(msgrIn('3003', { ref: 'bad.ref', text: 'hi' }));
  assert.strictEqual(saves.filter(x => x.messenger_id === '2002').length, 0);
  deq(sent().map(x => x[0]), ['2002', '3003']); assert.ok(/did not work/.test(sent()[1][1]));
  assert.ok(!t.tabs['Messenger People'] || t.tabs['Messenger People'].rows.length <= 1);
  const line = () => t.tabs.Chat.rows.filter(r => r[3] === '' && /not linked as crew/.test(r[2]));
  assert.strictEqual(line().length, 1); assert.ok(/magkano po package\?/.test(line()[0][2]), 'first words shown so an inquiry is not missed');
  door(msgrIn('2002', { text: 'hello po?' })); door(msgrIn('2002', { text: 'up' }));
  assert.strictEqual(sent().filter(x => x[0] === '2002').length, 3, 'each typed message before a tap gets the greeting and buttons again (5 Nov 04:51Z)');
  assert.ok(sent().filter(x => x[0] === '2002').every(x => /^Hi! Thank you for reaching out/.test(x[1])));
  assert.strictEqual(line().length, 1, 'one Ask Cue line per person');
  door(msgrIn('4004', { text: 'event inquiry po' })); assert.strictEqual(line().length, 2, 'a new person gets their own line');
});
test('MS10b triage (Kiko 4 Nov 15:14Z, 15:50Z; 5 Nov 04:09Z): the first reply is the greeting with two buttons, in Kiko\'s words', () => {
  const { t, door } = msgrSandbox();
  door(msgrIn('2002', { text: 'Hello' }));
  const body = t.log.fb.filter(x => /\/me\/messages$/.test(x.url))[0].body, pl = body.message.attachment.payload;
  assert.strictEqual(pl.text, 'Hi! Thank you for reaching out to Blank Space Events. Para ma-assist ka namin agad, pili ka lang po sa baba.');
  assert.strictEqual(pl.template_type, 'button', 'buttons stay on the message (5 Nov 04:54Z "There are no buttons showing")');
  deq(pl.buttons, [{ type: 'postback', title: 'I\'m crew', payload: 'TRI_CREW' }, { type: 'postback', title: 'Client or inquiry', payload: 'TRI_CLIENT' }]);
  assert.strictEqual(body.messaging_type, 'RESPONSE');
  assert.ok(!t.tabs.Chat.rows.some(r => /This chat is for our crew/.test(r[2])));
});
test('MS10c "Client or inquiry": asks how to help, thanks them after their details, and keeps one Cue chat for the person', () => {
  const { t, door, sent } = msgrSandbox();
  door(msgrIn('2002', { text: 'Hello' }));
  door(msgrIn('2002', { text: 'Client or inquiry', qr: 'TRI_CLIENT' }));
  assert.strictEqual(sent()[1][1], 'Happy to help po. Ano pong maitutulong namin? Share mo lang kung para saan ang message mo.');
  door(msgrIn('2002', { text: '18th birthday, Dec 12, 150 guests sa Tagaytay' }));
  assert.strictEqual(sent()[2][1], 'Salamat po sa pag-message. I have passed the details to Kiko and he will get back to you. You may also contact Kiko Dacanay at kikodacanay@blankspaceevent.com or 0976 494 2398.');
  door(msgrIn('2002', { text: 'budget po around 300k' }));
  assert.strictEqual(sent().length, 3, 'no auto reply after the thanks');
  const chat = JSON.parse(t.props.MSGR_TRI_2002).chat, s = t.state(chat);
  deq([s.kind, s.text, s.status, s.msgr.psid], ['msgr', 'Messenger · Ana Cruz · Client or inquiry', 'Needs you', '2002']);
  const rows = t.tabs.Chat.rows.filter(r => r[3] === chat).map(r => r[2]);
  assert.ok(rows.some(x => /tapped "Client or inquiry"/.test(x) && /First message: "Hello"/.test(x)));
  assert.ok(rows.includes('18th birthday, Dec 12, 150 guests sa Tagaytay') && rows.includes('budget po around 300k'));
  const chats = new Set(t.tabs.Requests.rows.slice(1).map(r => r[0]).filter(id => { const x = t.state(id); return x && x.kind === 'msgr'; }));
  assert.strictEqual(chats.size, 1, 'one chat per person');
});
test('MS10d "I\'m crew": the crew reply and a "Crew, not linked yet" chat; Kiko\'s typed answer goes back inside the window', () => {
  const { t, door, sent } = msgrSandbox();
  door(msgrIn('2002', { text: 'Hi' }));
  door(msgrIn('2002', { text: 'I\'m crew', qr: 'TRI_CREW' }));
  assert.strictEqual(sent()[1][1], 'Welcome to the crew po. Reply ka lang dito with your full name and event, and our team will help you.', 'no email note (Kiko 5 Nov 05:49Z)');
  const chat = JSON.parse(t.props.MSGR_TRI_2002).chat;
  assert.strictEqual(t.state(chat).text, 'Messenger · Ana Cruz · Crew, not linked yet');
  t.ctx.cueSend('Hi Ana, sending your link now.', [], 'chat', chat);
  assert.ok(sent().some(x => x[0] === '2002' && x[1] === 'Hi Ana, sending your link now.'), 'Kiko answers from the chat');
});
test('MS10l crew details get one reply and one main-chat line, then quiet until the team answers (Kiko 5 Nov 07:22Z)', () => {
  const { t, door, sent } = msgrSandbox();
  door(msgrIn('2002', { text: 'Hi' })); door(msgrIn('2002', { pb: ['I\'m crew', 'TRI_CREW'] }));
  door(msgrIn('2002', { text: 'Kiko Dacanay\nKings Day' }));
  assert.strictEqual(sent().pop()[1], 'Salamat po! Natanggap na namin ang details mo. Babalikan ka ng team namin dito sa Messenger as soon as possible.');
  const chat0 = JSON.parse(t.props.MSGR_TRI_2002).chat;   // CUE-MSGR-ONE-LINE (Kiko 5 Nov 13:07Z): the step posts in their chat, not as a new main line
  assert.strictEqual(t.tabs.Chat.rows.filter(r => r[3] === chat0 && /sent their details on Messenger/.test(r[2])).length, 1, 'one line in their chat');
  assert.strictEqual(t.tabs.Chat.rows.filter(r => !r[3] && /sent their details/.test(r[2])).length, 0, 'no main-chat line');
  const n = sent().length; door(msgrIn('2002', { text: 'Hello?' }));
  assert.strictEqual(sent().length, n, 'no second reply');
  assert.strictEqual(t.tabs.Chat.rows.filter(r => /sent their details/.test(r[2])).length, 1, 'no second line');
  const chat = JSON.parse(t.props.MSGR_TRI_2002).chat;
  t.ctx.cueSend('Hi, which role po?', [], 'chat', chat);
  door(msgrIn('2002', { text: 'Marshal po' }));
  assert.strictEqual(sent().pop()[1].slice(0, 9), 'Salamat p', 'after the team answers, new details get the reply again');
});
test('MS11 Cue collects from the relay only with its key, acks what it handled, and does nothing until set up', () => {
  const { t, door, saves } = msgrSandbox();
  door(msgrIn('1001', { ref: 'sealed.ref' }));
  const calls = t.log.relay.map(x => [x.url.replace('https://relay.example.workers.dev', ''), x.req.headers.Authorization === 'Bearer ' + MSGR_KEY]);
  deq(calls, [['/sync', true], ['/events', true], ['/ack', true]]); deq(t.log.relay[2].body.ids, ['e:1000000000001:00000001']);
  assert.strictEqual(saves.length, 1);
  const u = msgrSandbox(); delete u.t.props.MSGR_RELAY_URL; assert.strictEqual(u.t.ctx.cueMsgrPull_(), 0); assert.ok(!u.t.log.relay, 'no call without the relay address');
});
test('MS12 Kiko answers in the chat: sent inside the window; outside it Cue says Messenger is closed; "done" closes', () => {
  const { t, door, sent } = msgrSandbox(); door(msgrIn('1001', { ref: 'sealed.ref', ts: Date.parse('2026-11-02T06:06:00Z') }));
  const chat = t.tabs['Messenger People'].rows[1][4];
  t.ctx.cueSend('Thanks Ana! Call time is 2:00 PM at Ayala Triangle Gardens. See you!', [], 'chat', chat);
  assert.ok(sent().some(x => x[0] === '1001' && /Call time is 2:00 PM/.test(x[1])), 'sent on Messenger');
  assert.ok(t.tabs.Chat.rows.some(r => r[3] === chat && r[2] === 'Sent on Messenger.'));
  t.at('2026-11-04T01:00:00Z');
  const n = sent().length; t.ctx.cueSend('Are you free on the 20th?', [], 'chat', chat);
  assert.strictEqual(sent().length, n, 'nothing sent outside the window');
  assert.ok(t.tabs.Chat.rows.some(r => r[3] === chat && /^Messenger is closed for Ana Cruz/.test(r[2])));
  t.ctx.cueSend('done', [], 'chat', chat); assert.strictEqual(t.state(chat).status, 'Done');
});
test('MS13 the Messenger relay (relay/messenger-worker.js): Meta webhook check, signature check, forward to Cue', () => {
  require('child_process').execFileSync(process.execPath, [path.join(__dirname, '..', 'relay', 'messenger-worker.test.mjs')], { stdio: 'pipe' });
});
test('MS14 Settings › Connections › Messenger: owner makes the relay key and saves the address and Page token; the token never comes back', () => {
  const t = sandbox();
  let S = t.ctx.cueMsgrKey(); assert.ok(/^mr_[0-9a-f]{64}$/.test(S.msgr.key)); assert.strictEqual(S.msgr.token, false);
  S = t.ctx.cueMsgrSave('https://bse-messenger-relay.kiko.workers.dev/', 'EAAG' + 'x'.repeat(120));
  deq([S.msgr.url, S.msgr.token], ['https://bse-messenger-relay.kiko.workers.dev', true]);
  assert.ok(JSON.stringify(S).indexOf('EAAG') < 0, 'the token is not in the settings answer');
  assert.throws(() => t.ctx.cueMsgrSave('', 'short'), /does not look like a Page access token/);
  assert.throws(() => t.ctx.cueMsgrSave('http://bad', ''), /relay address/);
  assert.throws(() => sandbox({ viewer: 'someone@example.com' }).ctx.cueMsgrKey(), /owner|Kiko|only/i);
});
test('MS15 Connect Facebook (CUE-MSGR-CONNECT-2026-11-04): only the proof\'s hash leaves as state; Finish saves key + token once, shows neither', () => {
  const t = sandbox();
  assert.throws(() => t.ctx.cueMsgrConnect(), /Save the relay address first/);
  t.ctx.cueMsgrSave('https://bse-messenger-relay.kiko.workers.dev', '');
  const c = t.ctx.cueMsgrConnect(), proof = t.props.MSGR_CONNECT_PROOF;
  assert.ok(/^[0-9a-f]{64}$/.test(proof));
  assert.strictEqual(c.url, 'https://bse-messenger-relay.kiko.workers.dev/connect?state=' + require('crypto').createHash('sha256').update(proof).digest('hex'));
  assert.ok(c.url.indexOf(proof) < 0, 'the proof is not in the sign-in address');
  const calls = [], key = 'mr_' + 'b'.repeat(64), token = 'EAAG' + 'y'.repeat(120);
  let answer = { code: 404, body: '{"error":"Nothing to collect."}' };
  t.ctx.UrlFetchApp = { fetch: (u, req) => { calls.push(u); return { getResponseCode: () => answer.code, getContentText: () => answer.body }; } };
  assert.throws(() => t.ctx.cueMsgrFinish(), /not finished yet/);
  assert.strictEqual(calls[0], 'https://bse-messenger-relay.kiko.workers.dev/claim?proof=' + proof);
  answer = { code: 200, body: JSON.stringify({ key: 'nope', token }) };
  assert.throws(() => t.ctx.cueMsgrFinish(), /unexpected. Nothing was saved/); assert.ok(!t.props.MSGR_PAGE_TOKEN);
  answer = { code: 200, body: JSON.stringify({ key, token }) };
  const S = t.ctx.cueMsgrFinish();
  assert.strictEqual(t.props.MSGR_RELAY_KEY, key); assert.strictEqual(t.props.MSGR_PAGE_TOKEN, token); assert.ok(!('MSGR_CONNECT_PROOF' in t.props));
  assert.strictEqual(S.msgr.token, true); assert.ok(JSON.stringify(S).indexOf('EAAG') < 0, 'the token is not in the settings answer');
  assert.throws(() => t.ctx.cueMsgrFinish(), /Press Connect Facebook first/, 'the proof works once');
  assert.throws(() => sandbox({ viewer: 'someone@example.com' }).ctx.cueMsgrConnect(), /owner|Kiko|only/i);
});
test('MS10e a greeting Facebook refuses saves nothing, so the next message tries again (5 Nov 04:29Z "nothing happens")', () => {
  let refuse = true;
  const { t, door, sent } = msgrSandbox({ fb: (u) => /\/me\/messages$/.test(u) && refuse
    ? { getResponseCode: () => 400, getContentText: () => '{"error":{"message":"(#100) No matching user found"}}' }
    : { getResponseCode: () => 200, getContentText: () => '{"message_id":"m1"}' } });
  door(msgrIn('2002', { text: 'Hello' }));
  const line = t.tabs.Chat.rows.filter(r => r[3] === '' && /not linked as crew/.test(r[2]));
  assert.strictEqual(line.length, 1); assert.ok(/greeting was not sent \(Meta 400: \(#100\) No matching user found\)/.test(line[0][2]));
  assert.ok(!('MSGR_TRI_2002' in t.props), 'no triage state, so Cue does not go quiet for this person');
  refuse = false; door(msgrIn('2002', { text: 'Hello again' }));
  assert.ok(/^Hi! Thank you for reaching out/.test(sent().filter(x => x[0] === '2002').pop()[1]), 'the next message gets the greeting');
  assert.strictEqual(JSON.parse(t.props.MSGR_TRI_2002).st, 'asked');
});
test('MS10f CUE-MSGR-FAST-2026-11-05 (Kiko 04:30Z "5 minuites is not good"): the 1-minute trigger collects Messenger too, once', () => {
  const { t, held, sent } = msgrSandbox();
  held.push({ id: 'e:1', event: msgrIn('2002', { text: 'Hello' }) });
  const runs = () => (t.tabs['Job Runs'] ? t.tabs['Job Runs'].rows : []).filter(r => r[2] === 'Messenger inbox');
  t.ctx.cueRfpKick();
  deq(sent().map(x => x[0]), ['2002'], 'the minute run sent the greeting');
  assert.strictEqual(runs().length, 1); assert.strictEqual(runs()[0][3], 'OK'); assert.strictEqual(runs()[0][5], 1);
  t.ctx.cueRfpKick(); assert.strictEqual(runs().length, 1, 'a quiet minute writes no row');
  held.push({ id: 'e:2', event: msgrIn('4004', { text: 'Hi' }) });
  t.props.CUE_MSGR_PULL_RUN = String(t.ctx.cueNow_() + 60000);
  assert.strictEqual(t.ctx.cueMsgrPull_(), 0, 'while another run holds the lease, nothing is collected twice');
  assert.strictEqual(sent().length, 1); assert.strictEqual(held.length, 1);
  delete t.props.CUE_MSGR_PULL_RUN; assert.strictEqual(t.ctx.cueMsgrPull_(), 1); assert.ok(!('CUE_MSGR_PULL_RUN' in t.props), 'the lease is let go');
});
test('MS10g one Ask Cue line per person in total (Kiko 5 Nov 04:33Z "its still sending 1 notif per message"), across versions and retries', () => {
  const { t, door, sent } = msgrSandbox();
  t.props.MSGR_TOLD_2002 = '2026-11-05T04:08:00.000Z';   // noted by 1.28.19.1 before the triage shipped
  door(msgrIn('2002', { text: 'Luh' }));
  assert.ok(/^Hi! Thank you for reaching out/.test(sent()[0][1]), 'the person still gets the triage greeting');
  assert.strictEqual(t.tabs.Chat.rows.filter(r => r[3] === '' && /not linked as crew/.test(r[2])).length, 0, 'no second line for someone already noted');
  const u = msgrSandbox({ fb: (x) => /\/me\/messages$/.test(x) ? { getResponseCode: () => 400, getContentText: () => '{}' } : { getResponseCode: () => 200, getContentText: () => '{}' } });
  u.door(msgrIn('5005', { text: 'a' })); u.door(msgrIn('5005', { text: 'b' })); u.door(msgrIn('5005', { text: 'c' }));
  assert.strictEqual(u.t.tabs.Chat.rows.filter(r => r[3] === '' && /not linked as crew/.test(r[2])).length, 1, 'refused greetings retry without a line each time');
});
test('MS10h CUE-MSGR-WELCOME-2026-11-05 (Kiko 04:56Z "Yes"): welcome screen, ice breakers, Get Started and menu set once; taps come as postbacks', () => {
  const { t, door, sent } = msgrSandbox();
  door(msgrIn('2002', { text: 'Hello' }));
  const prof = t.log.fb.filter(x => /\/me\/messenger_profile$/.test(x.url)), sub = t.log.fb.filter(x => /\/me\/subscribed_apps$/.test(x.url));
  assert.strictEqual(prof.length, 1); assert.strictEqual(sub.length, 1);
  deq(sub[0].body.subscribed_fields, ['messages', 'messaging_postbacks', 'messaging_referrals']);
  const b = prof[0].body;
  deq(b.greeting, [{ locale: 'default', text: 'Hi! Thank you for reaching out to Blank Space Events. Para ma-assist ka namin agad, pili ka lang po sa baba.' }]);
  deq(b.ice_breakers[0].call_to_actions, [{ question: 'I\'m crew', payload: 'TRI_CREW' }, { question: 'Client or inquiry', payload: 'TRI_CLIENT' }]);
  deq(b.get_started, { payload: 'TRI_START' }); assert.strictEqual(b.persistent_menu[0].call_to_actions.length, 2);
  door(msgrIn('2002', { text: 'again' })); assert.strictEqual(t.log.fb.filter(x => /messenger_profile$/.test(x.url)).length, 1, 'set once per version');
  door(msgrIn('2002', { pb: ['Client or inquiry', 'TRI_CLIENT'] }));
  assert.ok(/^Happy to help po/.test(sent().pop()[1]), 'an ice breaker or button tap (postback) starts the client path');
  door(msgrIn('6006', { pb: ['Get Started', 'TRI_START'] })); assert.ok(/^Hi! Thank you for reaching out/.test(sent().pop()[1]), 'Get Started gets the triage');
  door(msgrIn('7007', { text: "I\u2019m crew" })); assert.ok(/^Welcome to the crew po/.test(sent().pop()[1]), 'typing the button words counts as the tap');
});
test('MS10i a welcome screen Meta refuses leaves one Ask Cue line and retries hourly, not every minute', () => {
  const { t, door } = msgrSandbox({ fb: (u) => /messenger_profile$/.test(u) ? { getResponseCode: () => 400, getContentText: () => '{"error":{"message":"bad"}}' } : { getResponseCode: () => 200, getContentText: () => '{}' } });
  door(msgrIn('2002', { text: 'a' })); door(msgrIn('2002', { text: 'b' }));
  assert.strictEqual(t.log.fb.filter(x => /messenger_profile$/.test(x.url)).length, 1, 'no retry inside the hour');
  assert.strictEqual(t.tabs.Chat.rows.filter(r => /welcome screen not set/.test(r[2])).length, 1);
  t.at('2026-11-02T08:00:00Z'); door(msgrIn('2002', { text: 'c' }));
  assert.strictEqual(t.log.fb.filter(x => /messenger_profile$/.test(x.url)).length, 2);
  assert.strictEqual(t.tabs.Chat.rows.filter(r => /welcome screen not set/.test(r[2])).length, 1, 'still one line');
});
test('MS10j "start over" in a triage chat (Kiko 5 Nov 05:15Z) makes the person new: the next message gets the greeting and one Ask Cue line', () => {
  const { t, door, sent } = msgrSandbox();
  door(msgrIn('2002', { text: 'Hi' })); door(msgrIn('2002', { pb: ['I\'m crew', 'TRI_CREW'] }));
  const chat = JSON.parse(t.props.MSGR_TRI_2002).chat, n = sent().length;
  door(msgrIn('2002', { text: 'Hello' })); assert.strictEqual(sent().length, n + 1, 'after the tap, one reply to their details (MS10l), then Cue waits for a person');
  t.ctx.cueSend('start over', [], 'chat', chat);
  assert.ok(!('MSGR_TRI_2002' in t.props) && !('MSGR_TOLD_2002' in t.props));
  assert.ok(t.tabs.Chat.rows.some(r => r[3] === chat && /^Started over\./.test(r[2])));
  assert.ok(!sent().some(x => x[1] === 'start over'), '"start over" is not sent to the person');
  door(msgrIn('2002', { text: 'Hello again' }));
  assert.ok(/^Hi! Thank you for reaching out/.test(sent().pop()[1]));
  assert.strictEqual(t.tabs.Chat.rows.filter(r => (r[3] === '' || r[3] === '>' + chat) && /not linked as crew/.test(r[2])).length, 2, 'one new Ask Cue line after the reset (the first one now points at their chat)');
});
test('MS10k "start over" typed in Messenger by someone not linked resets them and gets the greeting (Kiko 5 Nov 05:21Z)', () => {
  const { t, door, sent } = msgrSandbox();
  door(msgrIn('2002', { text: 'Hi' })); door(msgrIn('2002', { pb: ['I\'m crew', 'TRI_CREW'] }));
  door(msgrIn('2002', { text: 'Huy' })); const n = sent().length; door(msgrIn('2002', { text: 'Huy ulit' })); assert.strictEqual(sent().length, n);
  door(msgrIn('2002', { text: 'Start over daw' }));
  assert.ok(/^Hi! Thank you for reaching out/.test(sent().pop()[1]), 'the greeting with buttons again');
  assert.strictEqual(JSON.parse(t.props.MSGR_TRI_2002).st, 'asked');
});

/* CUE-CREW-MATCH-2026-11-05 (Kiko 5 Nov 11:49Z "Ok deploy" on crew-match-flow.png): Canvas matches the name and event and sends a
 * 6-digit code; Cue sends Kiko's approved replies. The bridge answers are faked here; every call is checked against the schema. */
function crewBox(answers) {
  const calls = [];
  const box = msgrSandbox({ bridgeFn: b => {
    if (b.action === 'fl_social_save') { calls.push([b.action, b.args]); return { ok: true, email: b.args.email, written: [] }; }
    if (!/^(crew_match|crew_code_check|msgr_told)$/.test(b.action)) return undefined;
    assert.strictEqual(bridgeCheck(b.action, b.args), '', b.action + ' args fit the Canvas schema');
    calls.push([b.action, b.args]);
    const a = answers[b.action]; return typeof a === 'function' ? a(b.args) : a;
  } });
  box.calls = calls;
  box.crew = text => { box.door(msgrIn('2002', { text: 'Hi' })); box.door(msgrIn('2002', { pb: ['I\'m crew', 'TRI_CREW'] })); box.door(msgrIn('2002', { text })); };
  return box;
}
const MAIN = t => t.tabs.Chat.rows.filter(r => !r[3]).map(r => r[2]);
const PCHAT = t => { const c = (JSON.parse(t.props.MSGR_TRI_2002 || '{}') || {}).chat; return t.tabs.Chat.rows.filter(r => c && r[3] === c).map(r => r[2]); };   // CUE-MSGR-ONE-LINE: the person's own chat
test('MS16 match with a mobile: the code reply with the last 2 digits; the right code links them with the approved message', () => {
  let codes = 0;
  const b = crewBox({ crew_match: { status: 'code_sent', channel: 'mobile', hint: '12', project: 'Kings Day – Embassy of Belgium', first: 'Ana', person: 'Ana Cruz' },
    crew_code_check: a => (codes++, a.code === '482913' ? { status: 'linked', first: 'Ana', project: 'Kings Day – Embassy of Belgium', key: 'ana@example.test' } : { status: 'wrong', left: 2 }) });
  b.crew('Ana Cruz / Kings Day');
  deq(b.calls[0][1].text, 'Ana Cruz / Kings Day'); assert.strictEqual(b.calls[0][1].psid, '2002');
  assert.strictEqual(b.sent().pop()[1], 'Salamat po! Nakita ka namin sa team ng Kings Day – Embassy of Belgium. Nag-send kami ng 6-digit code sa mobile mo na nagtatapos sa 12. I-type mo lang dito ang code para ma-connect ka.');
  b.door(msgrIn('2002', { text: 'ok po wait' })); assert.strictEqual(codes, 0, 'words while a code waits are not a code');
  b.door(msgrIn('2002', { text: '111 111' }));
  assert.strictEqual(b.sent().pop()[1], 'Mali po ang code. May 2 tries ka pa.');
  b.door(msgrIn('2002', { text: '482913' }));
  assert.strictEqual(b.sent().pop()[1], 'Hi Ana! Naka-connect ka na sa Blank Space Events dito sa Messenger. Dito na rin namin ipapadala ang papers mo to sign (FSA and AR) at updates for your events. Reply ka lang anytime kung may tanong ka.');
  const ppl = b.t.tabs['Messenger People'].rows; deq(ppl[1].slice(0, 2), ['2002', 'ana@example.test']);
  assert.ok(!b.t.props.MSGR_TRI_2002, 'now linked crew, out of the triage');
  assert.ok(!MAIN(b.t).some(x => /sent their details/.test(x)), 'a match needs no main-chat line');
  b.door(msgrIn('2002', { text: 'Salamat!' }));
  assert.ok(b.calls.some(c => c[0] === 'fl_social_save' && c[1].email === 'ana@example.test' && c[1].last_message), 'their last message is kept in Canvas from now on');
});
test('MS17 match with email only says "sa email mo"; 1 try left; 3rd wrong locks with Kiko\'s note', () => {
  let n = 0;
  const b = crewBox({ crew_match: { status: 'code_sent', channel: 'email', hint: '', project: 'Globe Product Launch', first: 'Lito' },
    crew_code_check: () => (++n < 3 ? { status: 'wrong', left: 3 - n } : { status: 'locked', name: 'Carlito Santos' }) });
  b.crew('Lito Santos usher globe launch');
  assert.strictEqual(b.sent().pop()[1], 'Salamat po! Nakita ka namin sa team ng Globe Product Launch. Nag-send kami ng 6-digit code sa email mo. I-type mo lang dito ang code para ma-connect ka.');
  b.door(msgrIn('2002', { text: '000001' })); b.door(msgrIn('2002', { text: '000002' }));
  assert.strictEqual(b.sent().pop()[1], 'Mali po ang code. May 1 try ka pa.');
  b.door(msgrIn('2002', { text: '000003' }));
  assert.strictEqual(b.sent().pop()[1], 'Hindi pa namin ma-connect ang Messenger mo. Babalikan ka ng team namin dito.');
  assert.ok(PCHAT(b.t).includes('Carlito Santos typed 3 wrong codes on Messenger. Nothing was linked.')); assert.ok(!MAIN(b.t).some(x => /wrong codes/.test(x)));
  const k = b.sent().length; b.door(msgrIn('2002', { text: '000004' }));
  assert.strictEqual(b.sent().length, k, 'locked: quiet'); assert.strictEqual(b.calls.filter(c => c[0] === 'crew_code_check').length, 3);
});
test('MS18 matched but no mobile and no email: the confirm reply and one main-chat line pointing to Link in Canvas', () => {
  const b = crewBox({ crew_match: { status: 'no_contact', project: 'Kings Day – Embassy of Belgium', first: 'Juan', person: 'Juan Reyes' } });
  b.crew('Juan Reyes / Kings Day');
  assert.strictEqual(b.sent().pop()[1], 'Salamat po! Kailangan lang namin i-confirm ang details mo. Babalikan ka ng team namin dito.');
  assert.ok(!MAIN(b.t).some(x => /no mobile or email/.test(x)));
  assert.ok(PCHAT(b.t).includes('Juan Reyes (crew, Kings Day – Embassy of Belgium) messaged on Messenger but has no mobile or email on file, so Cue could not send a code. Check who they are, then tap Link in the project\'s Communication Config or on the Freelancers page.'));
  const k = b.sent().length; b.door(msgrIn('2002', { text: 'Hello po?' })); assert.strictEqual(b.sent().length, k, 'then quiet');
});
test('MS19 not sure: the live crewAck reply and main line; later details are matched again quietly', () => {
  let ask = 0;
  const b = crewBox({ crew_match: () => (++ask === 1 ? { status: 'unsure' } : { status: 'code_sent', channel: 'mobile', hint: '77', project: 'AMI Group\'s Christmas Party', first: 'Mark' }) });
  b.crew('Mark po');
  assert.strictEqual(b.sent().pop()[1], 'Salamat po! Natanggap na namin ang details mo. Babalikan ka ng team namin dito sa Messenger as soon as possible.');
  assert.ok(PCHAT(b.t).some(x => /sent their details on Messenger/.test(x)) && !MAIN(b.t).some(x => /sent their details/.test(x)));
  b.door(msgrIn('2002', { text: 'Mark Lim, AMI christmas party' }));
  assert.ok(/nagtatapos sa 77/.test(b.sent().pop()[1]), 'second try matched: code sent');
});
test('MS20 staff Link or Not mine in Canvas: msgr_due tells Cue, the person gets the approved message once, Canvas is told', () => {
  const b = crewBox({ crew_match: { status: 'no_contact', project: 'Kings Day', first: 'Juan', person: 'Juan Reyes' }, msgr_told: { ok: true, marked: 1 } });
  b.crew('Juan Reyes / Kings Day');
  b.t.ctx.cueBridge_ = ((orig) => (s, action, args) => action === 'msgr_due'
    ? { docs: [], tell: [{ psid: '2002', status: 'linked', first: 'Juan', project: 'Kings Day', key: '' }, { psid: '3003', status: 'not_mine', first: 'Lito', project: 'Globe', key: '' }] }
    : orig(s, action, args))(b.t.ctx.cueBridge_);
  b.t.ctx.cueMsgrRun_(Date.parse('2026-11-02T06:45:00Z'));
  const out = b.sent().slice(-2);
  deq(out[0], ['2002', 'Hi Juan! Naka-connect ka na sa Blank Space Events dito sa Messenger. Dito na rin namin ipapadala ang papers mo to sign (FSA and AR) at updates for your events. Reply ka lang anytime kung may tanong ka.']);
  deq(out[1], ['3003', 'Hindi pa namin ma-connect ang Messenger mo. Babalikan ka ng team namin dito.']);
  deq(b.calls.filter(c => c[0] === 'msgr_told').map(c => [c[1].psid, c[1].status]), [['2002', 'linked'], ['3003', 'not_mine']]);
  assert.ok(b.t.tabs['Messenger People'].rows.some(r => r[0] === '2002'), 'Juan is linked crew now');
  b.door(msgrIn('2002', { text: 'Thanks po' }));
  assert.ok(!b.calls.some(c => c[0] === 'fl_social_save'), 'no Freelancers key: no last-message save (and no error)');
});
test('MS21 Canvas down: the crew still get the "not sure" reply, as before', () => {
  const b = crewBox({ crew_match: () => { throw new Error('Canvas busy'); } });
  b.crew('Ana Cruz / Kings Day');
  assert.strictEqual(b.sent().pop()[1].slice(0, 40), 'Salamat po! Natanggap na namin ang detai');
});

test('MS22 instant taps (Kiko 5 Nov 12:00Z "Yes, ship it"): the relay keeps Cue\'s exact words, gets the token and linked crew when they change, and Cue does not answer a tap twice', () => {
  const R = fs.readFileSync(path.join(__dirname, '..', 'relay', 'messenger-worker.js'), 'utf8');
  const SAY = vm.runInContext('CUE_MSGR_SAY_', msgrBox().ctx);
  assert.ok(R.includes("TRI_CREW: '" + SAY.crew.replace(/'/g, "\\'") + "'"), 'crew words match');
  assert.ok(R.includes("TRI_CLIENT: '" + SAY.help.replace(/'/g, "\\'") + "'"), 'client words match');
  const { t, door, sent, box } = msgrSandbox();
  door(msgrIn('1001', { ref: 'sealed.ref' }));
  deq(box.synced[0], { token: 'page-token', linked: [] });
  door(msgrIn('2002', { text: 'Hi' }));
  deq(box.synced.length, 2); deq(box.synced[1].linked, ['1001']);
  door(msgrIn('2003', { text: 'Hello' })); deq(box.synced.length, 2, 'nothing changed: no second sync');
  const n = sent().length, ev = msgrIn('2002', { pb: ['I\'m crew', 'TRI_CREW'] }); ev.entry[0].messaging[0].relay_replied = true;
  door(ev);
  assert.strictEqual(sent().length, n, 'the relay already answered the tap');
  assert.strictEqual(JSON.parse(t.props.MSGR_TRI_2002).st, 'crew', 'Cue still records the tap and opens the chat');
});

test('MS23 a Messenger chat is named by its text and never shows the Project intake card (Kiko 5 Nov 13:08Z "why are these in intake?")', () => {
  const page = cuePage();
  assert.ok(/\n {6}msgr: \{ name: function \(r\) \{ return r\.text \|\| 'Messenger'; \}, family: 'info', steps: null, card: null \}/.test(page), 'msgr has its own kind line');
  assert.ok(/function cardOf\(r\) \{\n\s+if \(r\.kind === 'msgr'\) return '';/.test(page), 'thread card skips msgr');
  assert.ok(/function cardBody\(r\) \{\n\s+if \(r\.kind === 'msgr'\) return '';/.test(page), 'card body skips msgr');
});

test('MS21 one person on Messenger is one line in the main chat (Kiko 5 Nov 13:07Z "why am i still getting 1 notif per message"): the first line points at their chat after the tap', () => {
  const { t, door } = msgrSandbox(), n0 = t.tabs.Chat.rows.length;
  door(msgrIn('2002', { text: 'Hi' })); door(msgrIn('2002', { pb: ['I\'m crew', 'TRI_CREW'] }));
  door(msgrIn('2002', { text: 'Kiko Dacanay\nKings Day' })); door(msgrIn('2002', { text: 'Hello?' }));
  const chat = JSON.parse(t.props.MSGR_TRI_2002).chat, rows = t.tabs.Chat.rows.slice(n0);
  deq(rows.filter(r => !r[3]).map(r => r[2]), [], 'no plain main-chat line left');
  const ptr = rows.filter(r => /^>/.test(String(r[3])));
  assert.strictEqual(ptr.length, 1, 'one pointer: ' + JSON.stringify(ptr)); assert.strictEqual(ptr[0][3], '>' + chat);
  assert.ok(/^Messenger: new message from someone not linked as crew: "Hi"/.test(ptr[0][2]));
  assert.ok(!('told' in JSON.parse(t.props.MSGR_TRI_2002)), 'pointed once');
});
