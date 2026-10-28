// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: draft-email.
/* ---------- Draft an email (write-like-me step 2) ---------- */
const MAIL_DRAFT = { subject: 'Floor mats delivery', body: 'Hi Mats Co!\n\nCan you deliver the mats a day early?\n\nThanks po,\nKiko', note: '' };
const mailAsk = e => ({ reply: 'Drafting it now.', looks_like_inquiry: false, start_intake: '', task: '', email: Object.assign({ job: 'reply', to: 'Mats Co', about: 'Ask if they can deliver the mats a day early', audience: 'supplier', project: 'JBL' }, e) });
function mailRun(o) { const t = sandbox(Object.assign({ talk: mailAsk((o && o.e) || {}) }, o)); const out = t.ctx.cueSend((o && o.say) || 'email Mats Co asking if they can deliver a day early', [], ''); const v = t.ctx.cueRun(out.request_id); return Object.assign(t, { id: out.request_id, v }); }

test('M1 "email Mats Co ...": the chat call picks it, Cue finds the thread, 1 GPT draft call in Kiko\'s style; Approve and send replies in the thread', () => {
  const t = mailRun();
  assert.strictEqual(t.v.kind, 'email'); assert.strictEqual(t.v.status, 'Needs you', t.v.error); assert.strictEqual(t.v.metrics.ai_calls, 1);
  assert.ok(/"mats co"/.test(t.log.gmailQ), t.log.gmailQ);
  const M = t.v.mail; assert.strictEqual(M.thread.subject, 'RFQ: JBL launch floor mats'); deq(M.draft.to, 'sales@matsco.example'); assert.strictEqual(M.draft.subject, 'Re: RFQ: JBL launch floor mats');
  const call = t.log.gpt.filter(b => b.text.format.name === 'email_draft')[0], ask = JSON.parse(call.input);
  assert.strictEqual(ask.thread.subject, 'RFQ: JBL launch floor mats'); assert.strictEqual(ask.sign_off, 'Blank Space Events'); assert.ok(!/own style/.test(call.instructions), 'no guide yet');
  assert.ok(t.tabs.Chat.rows.some(r => r[3] === '>' + t.id), 'main chat points to the thread');
  assert.ok(!t.log.replies, 'nothing made before approval');
  const d = t.ctx.cueApprove(t.id, { to: 'sales@matsco.example', body: 'Hi Mats Co, edited by Kiko', send: true });
  assert.strictEqual(d.status, 'Done'); deq(t.log.sent, ['reply-1']);
  const mime = t.log.replies[0].payload; assert.ok(/"threadId":"th1"/.test(mime) && /In-Reply-To: <m1@mail>/.test(mime), 'reply in the original thread');
  assert.ok(Buffer.from(mime.split('base64\r\n\r\n')[1].split('\r\n--')[0].replace(/\r\n/g, ''), 'base64').toString().indexOf('edited by Kiko') >= 0);
  assert.throws(() => t.ctx.cueApprove(t.id, { send: true }), /not waiting/);
});
test('M2 with a style guide: the draft call carries the supplier guide and its sign-off', () => {
  const t = sandbox({ talk: mailAsk({}) }); t.tabs.Style = sheetMock();
  [['On', 'Audience', 'Kind', 'Text'], [true, 'supplier', 'sign-off', 'Thanks po,\nKiko'], [true, 'client', 'tone', 'Formal']].forEach(r => t.tabs.Style.appendRow(r));
  t.ctx.cueRun(t.ctx.cueSend('email Mats Co asking if they can deliver a day early', [], '').request_id);
  const call = t.log.gpt.filter(b => b.text.format.name === 'email_draft')[0];
  assert.ok(/own style/.test(call.instructions) && !/Formal/.test(call.instructions)); assert.strictEqual(JSON.parse(call.input).sign_off, 'Thanks po,\nKiko');
});
test('M3 no thread and no address: a new email with To blank; send needs an address, Save to drafts works; Close saves nothing', () => {
  const t = mailRun({ e: { to: 'Nobody Here', job: 'reply' } }), M = t.v.mail;
  assert.strictEqual(t.v.status, 'Needs you'); assert.strictEqual(M.thread, null); assert.strictEqual(M.draft.to, '');
  assert.ok(t.v.notes.some(n => /no email thread/.test(n)) && t.v.notes.some(n => /email address/.test(n)));
  assert.throws(() => t.ctx.cueApprove(t.id, { send: true }), /email address in To/);
  const d = t.ctx.cueApprove(t.id, { to: '', subject: 'Hello\nBcc: x@y.z', body: 'Hi', send: false }); assert.strictEqual(d.status, 'Done');
  assert.strictEqual(t.log.gmail.length, 1); assert.ok(!/^Bcc:/m.test(t.log.gmail[0]) && !t.log.sent, 'no header injection, nothing sent');
  const c = mailRun({ e: { to: 'Nobody Here' } }); assert.strictEqual(c.ctx.cueReject(c.id, '').status, 'Rejected'); assert.strictEqual(c.log.gmail.length, 0);
});
test('M4 an address goes straight to To; own domain is team; "new" never replies in an old thread; GPT failing stops clearly', () => {
  const t = mailRun({ e: { job: 'new', to: 'ops@example.com', audience: 'client' } });
  assert.strictEqual(t.v.mail.audience, 'team'); assert.strictEqual(t.v.mail.thread, null); assert.strictEqual(t.v.mail.draft.to, 'ops@example.com');
  const f = mailRun({ fail: { mail: () => resp(500, { error: { message: 'busy' } }) } }); assert.strictEqual(f.v.status, 'Failed'); assert.ok(/Drafting the email stopped/.test(f.tabs.Chat.rows.map(r => r[2]).join('|')));
  const n = sandbox({ talk: mailAsk({ job: '' }) }); const r = n.ctx.cueSend('hello there', [], ''); assert.ok(r.chat && !r.request_id, 'job "" stays a chat');
});
