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
  assert.strictEqual(s.status, 'Needs you', 'Ana\'s line still waits');
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
