// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: contact-find (CueContacts.gs, CueText.gs).
/* ---------- How Cue finds a contact's email address (Kiko 30 Oct 2026 03:33Z) ---------- */
const CT_P0 = { book: 'priority', tab: 'P0 Contacts', key: '', mode: 'read', columns: ['Company', 'Contact Name', 'Email Address', 'Position / Title'], writable: [],
  rows: [{ _row: 5, Company: 'AMI Group', 'Contact Name': 'Rommel Siena', 'Email Address': ' Rommel Siena <Rommel.Siena@amigroup.com.ph>', 'Position / Title': 'HR Head' },
    { _row: 6, Company: 'Moldex', 'Contact Name': 'Ruth Andres', 'Email Address': 'ruth.andres@moldex.example', 'Position / Title': '' },
    { _row: 7, Company: 'Solo Corp', 'Contact Name': 'Bea Lim', 'Email Address': 'bea@solo.example', 'Position / Title': '' }] };
const CT_MAIL = [
  { id: 'ct1', date: '2026-10-01T02:00:00Z', h: { From: '"Archie Cruz" <archie.cruz@amigroup.com.ph>', To: 'Kiko <kiko@example.com>', Subject: 'AMI Christmas party brief' }, body: 'Hi Kiko' },
  { id: 'ct2', date: '2026-09-01T02:00:00Z', h: { From: 'Archie Tan <archie@other.example>', To: 'kiko@example.com', Subject: 'Hello' }, body: 'Hi' },
  { id: 'ct3', date: '2026-08-01T02:00:00Z', h: { From: 'Lea Go <lea@amigroup.com.ph>', To: 'kiko@example.com', Subject: 'Team list' },
    body: 'Hi Kiko,\n\nFor the venue, please coordinate with\nCarlo Mendoza\nAdmin Officer\nmailto:carlo.mendoza@amigroup.com.ph\n\nThanks,\nLea' }];
const ctSandbox = o => sandbox(Object.assign({ allow: [CT_P0], ctMail: CT_MAIL }, o));

test('CF1 the format of an email address: display names, angle brackets and mailto: come off; spaces, double dots and bad domains are not addresses', () => {
  const t = sandbox({}), c = t.ctx.cueEmailClean_;
  deq(['Ana Reyes <Ana.Reyes@Acme.com.ph>', 'mailto:ana@acme.ph?subject=Hi', '<ana@acme.ph>,', '"ana@acme.ph"', "o'neil+events@x-y.co"].map(c),
    ['ana.reyes@acme.com.ph', 'ana@acme.ph', 'ana@acme.ph', 'ana@acme.ph', "o'neil+events@x-y.co"]);
  deq(['ana reyes@acme.ph', 'ana@@acme.ph', 'ana..reyes@acme.ph', '.ana@acme.ph', 'ana.@acme.ph', 'ana@acme', 'ana@-acme.ph', 'ana@acme.p', 'ana@acme.ph2', '', 'Rommel Siena', 'ana@acme..ph'].map(c),
    ['', '', '', '', '', '', '', '', '', '', '', '']);
  assert.strictEqual(t.ctx.cueEmailList_('A <a@x.com>; b@y.ph, a@x.com'), 'a@x.com, b@y.ph');
  assert.strictEqual(t.ctx.cueEmailList_('a@x.com, Archie'), '', 'one name in the list is not an address');
  deq(t.ctx.cueEmailsIn_('Email me at Ana@Acme.ph or <ben@b.example>. Not: x@y'), ['ana@acme.ph', 'ben@b.example']);
});
test('CF2 names: "Rommel Siena and Archie" is two people; "Sienna" matches "Siena", "Rom" matches "Rommel", other names do not', () => {
  const t = sandbox({});
  deq(t.ctx.cueContactNames_('Rommel Siena and Archie'), ['Rommel Siena', 'Archie']);
  deq(t.ctx.cueContactNames_('Ana, Ben & ops@x.com'), ['Ana', 'Ben', 'ops@x.com']);
  assert.ok(t.ctx.cueCtNameHit_('Rommel Sienna', 'Siena, Rommel') && t.ctx.cueCtNameHit_('Rom Siena', 'Rommel Siena') && t.ctx.cueCtNameHit_('Ms. Ruth', 'Ruth Andres'));
  assert.ok(!t.ctx.cueCtNameHit_('Rommel Siena', 'Rommel Santos') && !t.ctx.cueCtNameHit_('Ar', 'Archie') && !t.ctx.cueCtNameHit_('Bea', 'Ben'));
  deq(t.ctx.cueChatNames_('look for Rommel Sienna and Archie'), ['Rommel Sienna', 'Archie']);
  deq(t.ctx.cueChatNames_('ITS NOT PROJECT! ITS CLIENT NAME!!!!'), []);
});
test('CF3 search order: Canvas P0 Contacts first, then Gmail headers (company domain first), then email text; nothing guessed', () => {
  const t = ctSandbox(), r = t.ctx.cueContactFind_({ id: 'x' }, ['Rommel Sienna', 'Archie', 'Carlo Mendoza', 'Zed Unknown'], '');
  const by = n => r.found.find(f => f.name === n);
  assert.strictEqual(by('Rommel Sienna').email, 'rommel.siena@amigroup.com.ph'); assert.ok(/Canvas P0 Contacts \(AMI Group\)/.test(by('Rommel Sienna').source));
  assert.ok(!(t.log.ctQ || []).some(q => /rommel/.test(q)), 'Gmail is not searched for a person Canvas has');
  assert.strictEqual(by('Archie').email, 'archie.cruz@amigroup.com.ph'); deq(by('Archie').also, ['archie@other.example']);
  assert.strictEqual(by('Carlo Mendoza').email, 'carlo.mendoza@amigroup.com.ph'); assert.ok(/names them/.test(by('Carlo Mendoza').source));
  deq(r.missing, ['Zed Unknown']);
  assert.ok(t.ctx.cueContactLines_(r).some(l => /^Zed Unknown: no email address found in Canvas P0 Contacts, your Gmail \(last 3 years\)\. Cue does not guess addresses\.$/.test(l)));
  deq(t.log.readRows.map(a => a.tab), ['P0 Contacts', 'P0 Contacts', 'P0 Contacts', 'P0 Contacts']);
});
test('CF4 a refused Canvas read or Gmail failing is said, never thrown; a company alone lists its contacts', () => {
  const t = sandbox({ allow: [], ctMail: CT_MAIL, ctGmailFail: true }), r = t.ctx.cueContactFind_({ id: 'x' }, ['Archie'], '');
  deq(r.missing, ['Archie']); assert.ok(/^Canvas P0 Contacts \(.*allow-list/.test(r.tried[0]), r.tried[0]);
  const c = ctSandbox().ctx.cueContactFind_({ id: 'x' }, [], 'AMI Group'); deq(c.company.map(x => x.email), ['rommel.siena@amigroup.com.ph']);
});
test('CF5 the AMI Group miss (30 Oct 11:30 Manila): "email Rommel Siena and Archie" puts both addresses in To, with where each came from', () => {
  const t = ctSandbox({ talk: mailAsk({ job: 'new', to: 'Rommel Siena and Archie', audience: 'client', about: 'Follow up the eight AMI Group projects', project: '' }) });
  const v = t.ctx.cueRun(t.ctx.cueSend('email Rommel Siena and Archie about the AMI projects', [], '').request_id);
  assert.strictEqual(v.status, 'Needs you', v.error);
  assert.strictEqual(v.mail.draft.to, 'rommel.siena@amigroup.com.ph, archie.cruz@amigroup.com.ph');
  assert.ok(v.notes.some(n => /Rommel Siena: rommel\.siena@amigroup\.com\.ph \(from Canvas P0 Contacts/.test(n) && /Archie: archie\.cruz@amigroup\.com\.ph \(from your Gmail/.test(n)), v.notes.join('|'));
  const d = t.ctx.cueApprove(v.id, { send: false }); assert.strictEqual(d.status, 'Done');
  assert.ok(/^To: rommel\.siena@amigroup\.com\.ph, archie\.cruz@amigroup\.com\.ph\r$/m.test(t.log.gmail[0]), 'both in the draft\'s To');
  assert.throws(() => { const x = ctSandbox({ talk: mailAsk({ job: 'new', to: 'Zed Unknown' }) }); const w = x.ctx.cueRun(x.ctx.cueSend('email Zed Unknown', [], '').request_id);
    assert.ok(w.notes.some(n => /Zed Unknown: no email address found/.test(n)), w.notes.join('|')); assert.strictEqual(w.mail.draft.to, ''); x.ctx.cueApprove(w.id, { to: 'zed at x.com', send: true }); }, /not an email address\. An address looks like name@company\.com/);
});
test('CF6 a company alone: its only contact on file goes in To; several are listed for Kiko to pick', () => {
  const one = ctSandbox({ talk: mailAsk({ job: 'new', to: 'Solo Corp' }) }), v1 = one.ctx.cueRun(one.ctx.cueSend('email Solo Corp', [], '').request_id);
  assert.strictEqual(v1.mail.draft.to, 'bea@solo.example'); assert.ok(v1.notes.some(n => /only Solo Corp contact on file \(Bea Lim\)/.test(n)), v1.notes.join('|'));
  const P = Object.assign({}, CT_P0, { rows: CT_P0.rows.concat([{ _row: 8, Company: 'AMI Group', 'Contact Name': 'Lea Go', 'Email Address': 'lea@amigroup.com.ph' }]) });
  const two = sandbox({ allow: [P], ctMail: [], talk: mailAsk({ job: 'new', to: 'AMI Group' }) }), v2 = two.ctx.cueRun(two.ctx.cueSend('email AMI Group', [], '').request_id);
  assert.strictEqual(v2.mail.draft.to, ''); assert.ok(v2.notes.some(n => /^Which AMI Group contact\? .*Rommel Siena <rommel\.siena@amigroup\.com\.ph>, Lea Go <lea@amigroup\.com\.ph>/.test(n)), v2.notes.join('|'));
});
test('CF7 chat: in an email thread, "look for Rommel Sienna and Archie" gives the chat call their addresses and the rule that names are people', () => {
  const t = ctSandbox({ talk: mailAsk({ job: 'new', to: 'AMI Group' }) }), id = t.ctx.cueSend('email AMI Group', [], '').request_id; t.ctx.cueRun(id);
  t.ctx.cueSend('look for Rommel Sienna and Archie', [], id);
  const call = t.log.gpt.filter(b => b.text.format.name === 'chat').pop();
  assert.ok(/Contacts \(email addresses Cue found[^\n]*\nRommel Sienna: rommel\.siena@amigroup\.com\.ph[\s\S]*Archie: archie\.cruz@amigroup\.com\.ph/.test(call.input), call.input.slice(0, 600));
  assert.ok(/Cue CAN look up people's email addresses/.test(call.instructions) && /never guesses an address/.test(call.instructions));
  const n = ctSandbox({ talk: { reply: 'Hi.', looks_like_inquiry: false, start_intake: '', task: '' } }); n.ctx.cueSend('Hello Kiko here, how is Canvas today', [], '');
  assert.ok(!(n.log.ctQ || []).length && !(n.log.readRows || []).length, 'no lookup for a message that is not about an email or a contact');
});
