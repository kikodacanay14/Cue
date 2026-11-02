// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: Ask Cue changes part 2a, email types
// (CueMailTypes.gs; CanvasWorkspace docs/specs/ask-cue-changes-spec.md, stories AC-3, AC-4, AC-7, AC-8, AC-10). Kiko 2 Nov 2026:
// "identify what kind of email it is ... In triage, have a list of common email senders of type then i will indicate what to do";
// "each email will get 1 line"; "Mark as read"; project emails "should appear in Team Chat. Have Cue notify me instead".
// Uses NM_BOX, NM_INFO, nmAdded and nmRun from 55-new-mail.js.
const TY_SORT = body => ({ items: (body.messages[0].content.match(/\[M\d+\] From: [^\n]*/g) || []).map(l => {
  const k = l.match(/\[(M\d+)\]/)[1];
  return /maria@/.test(l) ? { k, group: 'fyi', summary: 'BDO: statement for October is ready', urgent: false, type: 'Bank' }
    : /leo@/.test(l) ? { k, group: 'fyi', summary: 'Gym promo', urgent: false, type: 'gym memberships' }
    : { k, group: 'reply', summary: 'Ana asks for 2 more booths', urgent: false, type: 'Client' }; }) });
const tySandbox = o => {
  let cur = nmAdded(['11aa000000000001', '22bb000000000002', '55ee000000000005']);
  return sandbox(Object.assign({ inbox: NM_BOX, info: [NM_INFO], history: () => cur, nmSort: TY_SORT, historyId: '500' }, o || {}));
};

test('ACC3 email types: Bank (One line) gets its own line in Ask Cue and is marked read; Client stays a New mail line; a new kind is added as One line and Cue says so once', () => {
  const t = tySandbox(); const id = nmRun(t), s = t.state(id), by = k => s.nm.items.filter(x => x.sender === k)[0];
  deq([by('maria@acme.example').type, by('maria@acme.example').removed], ['Bank', 'oneline']);
  deq([by('ana@client.example').type, by('ana@client.example').removed || ''], ['Client', ''], 'Own chat: still waiting for Kiko');
  deq([by('leo@brightlights.example').type, by('leo@brightlights.example').removed], ['Gym memberships', 'oneline']);
  assert.ok(t.tabs.Chat.rows.some(r => r[3] === '' && /^\[Bank\] Maria Santos: BDO: statement for October is ready$/.test(r[2])), 'one line in the main chat');
  deq(t.log.markRead.map(x => [x.ids, x.remove, x.add || 'none']), [[['n1'], ['UNREAD'], 'none']], 'only Kiko\'s own One line email is marked read; info@ waits for Canvas; nothing else changes');
  const types = t.tabs['Triage types'].rows.slice(1).map(r => [r[0], r[1]]);
  assert.ok(types.some(r => r[0] === 'Gym memberships' && r[1] === 'One line') && types.some(r => r[0] === 'Bank' && r[1] === 'One line'));
  assert.strictEqual(t.tabs.Chat.rows.filter(r => /^New kind of email: "Gym memberships"/.test(r[2])).length, 1);
  const learned = t.tabs['Triage rules'].rows.slice(1).filter(r => /^type:/.test(r[1])).map(r => [r[0], r[1]]);
  deq(learned.sort(), [['ana@client.example', 'type:Client'], ['leo@brightlights.example', 'type:Gym memberships'], ['maria@acme.example', 'type:Bank']]);
  assert.ok(by('ana@client.example').chat_id, 'Ana\'s email has its own chat (ACC-6)'); assert.strictEqual(t.state(by('ana@client.example').chat_id).status, 'Needs you');
});

test('ACC4 a sender already typed is typed by code; Ignore marks read and shows nothing; Cue Admin saves types and moves a sender', () => {
  const t = tySandbox();
  t.tabs['Triage rules'].appendRow(['ana@client.example', 'type:Newsletters and promos', new Date(), 'set in Cue Admin']);
  const id = nmRun(t), ana = t.state(id).nm.items.filter(x => x.sender === 'ana@client.example')[0];
  deq([ana.type, ana.removed], ['Newsletters and promos', 'ignore'], 'the sender rule wins over Claude\'s "Client"');
  assert.ok(!t.tabs.Chat.rows.some(r => /Ana asks for 2 more booths/.test(r[2]) && r[3] === ''), 'Ignore shows nothing');
  assert.ok(t.log.markRead.some(x => x.ids.indexOf('n5') >= 0));
  const a = t.ctx.cueAdminTypes(); assert.ok(a.types.some(x => x.type === 'Newsletters and promos' && x.senders.indexOf('ana@client.example') >= 0));
  const saved = t.ctx.cueAdminTypesSave([{ type: 'client', setting: 'Own chat' }, { type: 'Bank', setting: 'Ignore' }, { type: 'Client', setting: 'One line' }]);
  deq(saved.types.map(x => [x.type, x.setting]), [['Client', 'Own chat'], ['Bank', 'Ignore']], 'names trimmed and capitalised, no type twice');
  assert.throws(() => t.ctx.cueAdminTypesSave([]), /at least one type/);
  t.ctx.cueAdminTypeSender('@bdo.example', 'Bank'); assert.ok(t.ctx.cueAdminTypes().types.filter(x => x.type === 'Bank')[0].senders.indexOf('@bdo.example') >= 0);
  assert.throws(() => t.ctx.cueAdminTypeSender('not an email', 'Bank'), /not an email/);
  assert.throws(() => sandbox({ viewer: 'someone@example.com' }).ctx.cueAdminTypes(), /owner|Kiko|only/i);
});

test('ACC5 an email with a Canvas Project ID passes the mute filter, gets one line pointing to Team Cue, no type, and stays unread; muted senders\' mail is marked read', () => {
  const box = NM_BOX.map(t => t.id !== '55ee000000000005' ? t : { id: t.id, msgs: [{ id: 'n5', ms: t.msgs[0].ms, h: H('Ana Reyes <ana@client.example>', 'S-25506500TR booth count'), body: 'Can we add 2 booths?' }] })
    .concat([{ id: '66ff000000000006', msgs: [{ id: 'n6', ms: MS('2026-10-21T03:21:00Z'), h: H('Promo <deals@shop.example>', 'Sale'), body: 'sale' }] }]);
  let cur = nmAdded(['11aa000000000001', '55ee000000000005', '66ff000000000006']);
  const t = sandbox({ inbox: box, info: [], history: () => cur, nmSort: TY_SORT, historyId: '500', projects: [{ id: 'S-25506500TR', name: 'Shell Gala Night' }] });
  t.tabs['Triage rules'].appendRow(['ana@client.example', 'mute', new Date(), 'muted']);
  t.tabs['Triage rules'].appendRow(['deals@shop.example', 'mute', new Date(), 'muted']);
  const id = nmRun(t);
  assert.ok(t.tabs.Chat.rows.some(r => r[3] === '' && /^Project email: Ana Reyes wrote about S-25506500TR: S-25506500TR booth count\. It goes to that project's thread in Team Cue\.$/.test(r[2])));
  assert.ok(!t.state(id).nm.items.concat(t.state(id).nm.skipped).some(x => x.sender === 'ana@client.example'), 'not a New mail line, not skipped');
  const read = [].concat.apply([], (t.log.markRead || []).map(x => x.ids));
  assert.ok(read.indexOf('n6') >= 0, 'a muted sender\'s mail is marked read');
  assert.ok(read.indexOf('n5') < 0, 'the project email stays unread');
  assert.ok(t.tabs['Triage log'].rows.some(r => r[5] === 'project' && r[6] === 'S-25506500TR'));
});

test('ACC6 no Gmail modify permission yet: nothing fails, the emails stay unread and the run carries one note', () => {
  const t = tySandbox({ noModify: true }); const id = nmRun(t);
  assert.strictEqual(t.state(id).nm.items.filter(x => x.sender === 'maria@acme.example')[0].removed, 'oneline');
  assert.ok(!t.log.markRead, 'nothing marked');
});

test('ACC7 one chat per email: Cue\'s read is the first message (one Haiku call each, thread text as data), no buttons; "done" closes it', () => {
  const t = tySandbox(); const id = nmRun(t), ana = t.state(id).nm.items.filter(x => x.sender === 'ana@client.example')[0];
  const ch = t.state(ana.chat_id); deq([ch.kind, ch.status, ch.mc.thread_id, ch.mc.type], ['mail', 'Needs you', '55ee000000000005', 'Client']);
  assert.strictEqual(t.log.mcReads, 1, 'one read: only the Own chat email (Bank and the new kind are One line)');
  const read = t.log.claude.filter(b => /^You read one email for Kiko/.test(b.system))[0];
  assert.strictEqual(read.model, 'claude-haiku-5-5'); assert.ok(/Can we add 2 booths\?/.test(read.messages[0].content));
  const msg = t.tabs.Chat.rows.filter(r => r[3] === ana.chat_id).map(r => r[2]).join('\n');
  assert.ok(/What they want: They want a quote\./.test(msg) && /Suggested next step: Reply with a quote date\./.test(msg) && /Reply here: "draft a reply saying …", "start intake" or "done"\./.test(msg));
  assert.ok(t.tabs.Chat.rows.some(r => r[3] === '>' + ana.chat_id && /^Ana Reyes: Booth count$/.test(r[2])), 'one line in Ask Cue points to the chat');
  const v = t.ctx.cueSend('done', [], 'chat', ana.chat_id);
  assert.strictEqual(v.status, 'Done'); assert.strictEqual(t.state(id).nm.items.filter(x => x.key === ana.key)[0].removed, 'done');
  assert.ok(!t.log.markRead.some(x => x.ids.indexOf('n5') >= 0), 'done changes nothing in Gmail');
});

test('ACC8 "draft a reply saying …" in an email chat makes the email card in that chat with Kiko\'s words as the brief; "start intake" starts one', () => {
  const t = tySandbox(); const id = nmRun(t), ana = t.state(id).nm.items.filter(x => x.sender === 'ana@client.example')[0];
  const out = t.ctx.cueSend('draft a reply saying 2 more booths are fine, Kiko will confirm the cost', [], 'chat', ana.chat_id);
  const e = t.state(out.request_id); deq([e.kind, e.ref], ['email', ana.chat_id]);
  assert.ok(/Kiko's instruction for this reply: draft a reply saying 2 more booths are fine/.test(e.mail.about));
  assert.strictEqual(e.mail.thread.thread_id, '55ee000000000005', 'a reply in its Gmail thread');
  assert.ok(!t.log.sent, 'nothing sent before Kiko taps');
  const u = tySandbox(); const uid = nmRun(u), ua = u.state(uid).nm.items.filter(x => x.sender === 'ana@client.example')[0];
  const iout = u.ctx.cueSend('start intake', [], 'chat', ua.chat_id); assert.ok(iout.request_id);
  assert.strictEqual(u.state(ua.chat_id).status, 'Done'); assert.strictEqual(u.state(uid).nm.items.filter(x => x.key === ua.key)[0].acted, 'intake');
});

test('ACC9 a later email in the same Gmail conversation joins its chat and reopens it; a new kind of email asks once in its own chat and the typed answer sets it', () => {
  const box = JSON.parse(JSON.stringify(NM_BOX)); let cur = nmAdded(['11aa000000000001', '22bb000000000002', '55ee000000000005']);
  const t = sandbox({ inbox: box, info: [NM_INFO], history: () => cur, nmSort: TY_SORT, historyId: '500' });
  const id = nmRun(t), ana = t.state(id).nm.items.filter(x => x.sender === 'ana@client.example')[0];
  t.ctx.cueSend('done', [], 'chat', ana.chat_id);
  box.filter(x => x.id === '55ee000000000005')[0].msgs.push({ id: 'n7', ms: MS('2026-10-21T03:40:00Z'), h: H('Ana Reyes <ana@client.example>', 'Re: Booth count'), body: 'Also 1 more table please.' });
  cur = nmAdded(['55ee000000000005']); t.ctx.__wait(35 * 60e3); t.ctx.cueNmTick_();
  const ch = t.state(ana.chat_id); assert.strictEqual(ch.status, 'Needs you', 'reopened'); assert.strictEqual(ch.mc.message_ids.length, 2);
  assert.ok(t.tabs.Chat.rows.some(r => r[3] === '>' + ana.chat_id && /^New in this conversation: Ana Reyes: Re: Booth count$/.test(r[2])));
  const gym = t.tabs.Requests.rows.slice(1).map(r => { try { return JSON.parse(r.slice(10).join('')); } catch (e) { return null; } }).filter(x => x && x.kind === 'mailtype');
  assert.strictEqual(gym.length, 1, 'asked once'); assert.strictEqual(gym[0].mt.type, 'Gym memberships');
  assert.ok(t.tabs.Chat.rows.some(r => r[3] === gym[0].id && /Reply here: own chat, one line or ignore\./.test(r[2])));
  const v = t.ctx.cueSend('ignore', [], 'chat', gym[0].id); assert.strictEqual(v.status, 'Done');
  assert.ok(t.tabs['Triage types'].rows.slice(1).some(r => r[0] === 'Gym memberships' && r[1] === 'Ignore'));
});

test('ACC10 edits: Kiko\'s lock list holds in Cue (supplier bank details editable, freelancer bank and TIN not); supplier bank edits carry the call-to-confirm warning', () => {
  const t = sandbox();
  deq(['TIN', 'Accreditation Status', 'Copy of Government ID', 'PROJECT STATUS', 'Account Number', 'Preferred Bank', 'Role', 'Approved by'].map(c => t.ctx.cueEdLocked_('admin', 'QRY', c)), [true, true, true, true, true, true, true, true]);
  deq(['Bank', 'Account Name', 'AccountNumber', 'City'].map(c => t.ctx.cueEdLocked_('suppliers', 'Main', c)), [false, false, false, false]);
  assert.strictEqual(t.ctx.cueEdLocked_('suppliers', 'Main', 'TIN'), true);
  deq(t.ctx.cueEdBankCols_({ book: 'suppliers', tab: 'Main', set: { AccountNumber: '0123', City: 'Pasig' } }), ['AccountNumber']);
  t.ctx.cueEditCard_({ book: 'suppliers', tab: 'Main', key: 'SUP-0412', keycol: 'Supplier ID #', set: { AccountNumber: '0123' }, was: { AccountNumber: '2290' } }, '');
  assert.ok(t.tabs.Chat.rows.some(r => /Confirm by calling the supplier on a number you already have\./.test(r[2])));
});

test('ACC11 typing "approve" answers the Approve question waiting in that chat, writes once and logs it; "not" writes nothing; Undo opens a new question', () => {
  const t = sandbox({ talk: TALK_ED, edit: ED_PLAN });
  t.ctx.cueSend('change the BI 0014 description', [], '');
  const before = (t.log.bridge || []).filter(b => b.action === 'write_rows').length;
  t.ctx.cueSend('approve', [], '');
  assert.strictEqual((t.log.bridge || []).filter(b => b.action === 'write_rows').length, before + 1, 'one write');
  const log = t.tabs['Canvas edits'].rows.slice(1); assert.ok(log.length >= 1 && log[0][8] === 'approved by Kiko');
  const e = t.ctx.cueAdminEdits(); assert.ok(e.length >= 1);
  t.ctx.cueAdminEditUndo(e[0].n); assert.ok(t.tabs.Chat.rows.some(r => /^Undo asked from Cue Admin/.test(r[2])));
  const n = (t.log.bridge || []).filter(b => b.action === 'write_rows').length;
  t.ctx.cueSend('not', [], ''); assert.strictEqual((t.log.bridge || []).filter(b => b.action === 'write_rows').length, n, '"not" writes nothing');
});

test('ACC12 a known contact\'s email whose signature has new details gets an edit question in its chat; Undo keeps a long old value whole', () => {
  let cur = nmAdded(['11aa000000000001']);
  const t = sandbox({ inbox: NM_BOX, info: [], history: () => cur, nmSort: TY_SORT, historyId: '500', edit: ED_PLAN,
    mcRead: { want: 'A quote.', history: 'Nothing earlier.', next: 'Reply.', phone: '0918 222 7781', position: '', company: '' },
    waiting: { on: true, stale: false, checked: 1, items: [{ id: '11aa000000000001', from: 'Maria Santos', email: 'maria@acme.example', who: 'Client', name: 'Acme', project: 'Acme Party', pid: 'S-1' }] } });
  t.tabs['Triage rules'].appendRow(['maria@acme.example', 'type:Client', new Date(), 'set']);
  const id = nmRun(t), m = t.state(id).nm.items.filter(x => x.sender === 'maria@acme.example')[0];
  assert.ok(m.chat_id, 'Maria has a chat');
  assert.ok(t.tabs.Chat.rows.some(r => r[3] === m.chat_id && /^Cue noticed new details in this email's signature\.$/.test(r[2])), 'the proposal reaches the chat');
  const long = 'x'.repeat(900);
  t.ctx.cueEdLog_({ book: 'tracker', tab: 'BI', keycol: 'BI NUMBER', key: '0014', set: { DESCRIPTION: 'new' }, was: { DESCRIPTION: long } }, { DESCRIPTION: 'new' });
  const row = t.tabs['Canvas edits'].rows.slice(-1)[0]; assert.strictEqual(String(row[6]).length, 900, 'the whole old value is kept for Undo');
});
