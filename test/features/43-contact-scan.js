// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: contact-scan.
// CUE-CONTACT-SCAN-2026-10-27: "fill contact details from old emails" (specs/crm-email-scanner.md, Kiko's Yes 27 Oct 15:54Z).
const CS_GAPS = [{ row: 12, name: 'Ana Cruz', email: 'ana@acme.test', company: 'Acme Corp', blanks: ['title', 'phone'] },
  { row: 15, name: 'Ben Lim', email: 'Ben@Brite.test', company: '', blanks: ['company'] }];
const CS_MAIL = {
  'ana@acme.test': [{ id: 'csa1', date: '2026-05-04T02:00:00Z', body: 'Hi Kiko,\nPlease see the brief.\n\nThanks,\nAna Cruz\nEvents Manager\nAcme Corp\n+63 917 123 4567\nwww.acme.test\n\nOn Mon, 3 May 2026 at 9:00 Kiko Dacanay <kiko@example.com> wrote:\n> Hi Ana\n> Kiko Dacanay\n> Blank Space Events\n> 0918 000 0000' },
    { id: 'csa2', body: 'Older mail.\n\nRegards,\nAna\nIntern' }],
  'ben@brite.test': [{ id: 'csb1', date: '2026-03-02T02:00:00Z', body: 'Noted.\n\nBest regards,\nBen Lim\nBrite Stage Inc.\nThis email is confidential.' }] };
const CS_AI = { people: [
  { k: 'P1', title: 'Events Manager', title_line: 'Events Manager', company: 'Acme Corp', company_line: 'Acme Corp', phone: '0917 123 4567', phone_line: '+63 917 123 4567' },
  { k: 'P2', title: 'CEO', title_line: '', company: 'Brite Stage Inc.', company_line: 'Brite Stage Inc.', phone: '', phone_line: '' }] };
const csCard = t => { const r = t.tabs.Chat.rows.filter(x => /^\?ask-/.test(String(x[3]))).pop(); return r ? { text: String(r[2]), id: String(r[3]).slice(1).split(':')[0] } : null; };
const csLast = t => String(t.tabs.Chat.rows[t.tabs.Chat.rows.length - 1][2]);
test('CS1 "fill contact details from old emails": blank cells from Canvas, signatures from Kiko\'s Gmail, one Claude call, one Approve card; Approve sends one contact_fill', () => {
  const t = sandbox({ csMail: CS_MAIL });
  t.ctx.cueSend('fill contact details from old emails', [], '');
  deq(t.log.bridge.map(b => b.action), ['contact_gaps'], 'one read, nothing written before Approve'); assert.strictEqual(t.log.gpt.length, 0);
  deq(t.log.csQ, ['from:ana@acme.test newer_than:3y -in:chats', 'from:ben@brite.test newer_than:3y -in:chats']);
  assert.strictEqual(t.log.claude.length, 1, 'one Claude call');
  const u = JSON.stringify(t.log.claude[0].messages);
  assert.ok(/Events Manager/.test(u) && /Brite Stage Inc\./.test(u) && /blank: title, phone/.test(u), u);
  assert.ok(!/Blank Space Events|0918 000 0000|Please see the brief|Intern|www\.acme|confidential/.test(u), 'signature lines only: no body, no quoted reply, no BSE details, no older mail');
  const c = csCard(t); assert.ok(c, 'an Approve card');
  assert.ok(/^Fill these blank P0 Contacts cells in Canvas\?/.test(c.text) && /Ana Cruz \(ana@acme\.test\): Position Events Manager; Phone \+63 917 123 4567 \(email 2026-05-04\)/.test(c.text)
    && /Ben Lim \(ben@brite\.test\): Company Brite Stage Inc\./.test(c.text) && !/CEO/.test(c.text), c.text);
  assert.ok(!/Company Acme/.test(c.text), 'Ana\'s Company is not blank, so it is not proposed');
  deq(t.tabs['Contact scan'].rows.slice(1).map(r => [r[0], r[2]]), [['ana@acme.test', 'title, phone'], ['ben@brite.test', 'company']]);
  t.ctx.cueAskPick(c.id, 'approve');
  deq(t.log.fills.map(a => a.fills), [[{ row: 12, email: 'ana@acme.test', title: 'Events Manager', phone: '+63 917 123 4567', date: '2026-05-04' }, { row: 15, email: 'ben@brite.test', company: 'Brite Stage Inc.', date: '2026-03-02' }]]);
  assert.strictEqual(bridgeCheck('contact_fill', t.log.fills[0]), ''); assert.strictEqual(bridgeCheck('contact_gaps', t.log.gaps[0]), '');
  assert.ok(/^Filled 3 cells for 2 contacts\. Undo any of it in Canvas › Accounts › Auto add\.$/.test(csLast(t)), csLast(t));
  assert.strictEqual(t.log.gmail.length + (t.log.sent || []).length, 0, 'no email drafted or sent');
});
test('CS2 people scanned in the last 90 days are skipped; Not writes nothing; a Canvas refusal and a skipped row are said plainly', () => {
  let t = sandbox({ csMail: CS_MAIL });
  t.ctx.cueSend('fill contact details from old emails', [], ''); t.log.csQ = [];
  t.ctx.cueSend('fill contact details from old emails', [], '');
  assert.ok(/was checked in the last 90 days\. Nothing to do\./.test(csLast(t)), csLast(t)); deq(t.log.csQ, [], 'no Gmail read'); assert.strictEqual(t.log.claude.length, 1);
  t.ctx.cueAskPick(csCard(t).id, 'not'); assert.ok(/Nothing was written to Canvas/.test(csLast(t))); assert.ok(!(t.log.fills || []).length);
  t = sandbox({ csMail: CS_MAIL, fillRefused: 'P0 Contacts is busy. Nothing was saved.' }); t.ctx.cueSend('please fill in contact details from my old emails', [], '');
  t.ctx.cueAskPick(csCard(t).id, 'approve'); assert.ok(/^Canvas refused: P0 Contacts is busy/.test(csLast(t)), csLast(t));
  t = sandbox({ csMail: CS_MAIL, fillSkip: ['ben@brite.test'] }); t.ctx.cueSend('fill contact details from old emails', [], '');
  t.ctx.cueAskPick(csCard(t).id, 'approve'); assert.ok(/^Filled 2 cells for 1 contact\. Skipped 1: ben@brite\.test \(cell no longer blank\)\./.test(csLast(t)), csLast(t));
});
test('CS3 code keeps only values in the signature line Claude quotes; a phone must match by digits; nothing clear means no card', () => {
  const ai = { people: [{ k: 'P1', title: 'Events Director', title_line: 'Events Manager', company: '', company_line: '', phone: '0917 999 4567', phone_line: '+63 917 123 4567' },
    { k: 'P2', title: '', title_line: '', company: 'Brite Stage Inc.', company_line: 'Brite Stage Inc. (made up line)', phone: '', phone_line: '' }, { k: 'P9', title: 'x', title_line: 'x', company: '', company_line: '', phone: '', phone_line: '' }] };
  const t = sandbox({ csMail: CS_MAIL, csAi: ai }); t.ctx.cueSend('fill contact details from old emails', [], '');
  assert.ok(!csCard(t), 'no card'); assert.ok(/None states a blank cell clearly enough to fill\. Nothing to fill\./.test(csLast(t)), csLast(t));
  assert.strictEqual(t.tabs['Contact scan'].rows.length, 3, 'both people still marked as scanned');
});
test('CS4 one Gmail search failing keeps the others on their own rows; no signature anywhere means no Claude call', () => {
  let t = sandbox({ csMail: CS_MAIL, csGmailFail: 'ana@', csAi: { people: [{ k: 'P1', title: '', title_line: '', company: 'Brite Stage Inc.', company_line: 'Brite Stage Inc.', phone: '', phone_line: '' }] } });
  t.ctx.cueSend('fill contact details from old emails', [], ''); t.ctx.cueAskPick(csCard(t).id, 'approve');
  deq(t.log.fills[0].fills, [{ row: 15, email: 'ben@brite.test', company: 'Brite Stage Inc.', date: '2026-03-02' }]);
  t = sandbox({ csMail: { 'ana@acme.test': [{ id: 'x1', body: 'ok see you' }] } }); t.ctx.cueSend('fill contact details from old emails', [], '');
  assert.strictEqual(t.log.claude.length, 0); assert.ok(/has a signature to read\. Nothing to fill\./.test(csLast(t)), csLast(t));
  t = sandbox({ gaps: [] }); t.ctx.cueSend('fill contact details from old emails', [], '');
  assert.ok(/Nothing to do\./.test(csLast(t))); assert.strictEqual(t.log.claude.length, 0);
});
test('CS5 the signature reader: after the last short sign-off, before the quoted reply, no BSE or web lines, at most 12', () => {
  const t = sandbox(), sig = (b, own) => JSON.parse(JSON.stringify(t.ctx.cueCsSig_(b, own)));
  deq(sig('Thanks for this.\n\nBest regards,\nMia Tan\nBlank Space Events\nHead of Ops\nhttps://x.test\n-----Original Message-----\nFrom: y\nCEO', 'blankspaceevent.com'), ['Mia Tan', 'Head of Ops']);
  deq(sig('No sign-off here\nJust text'), []);
  assert.strictEqual(sig('Salamat,\n' + Array.from({ length: 20 }, (_, i) => 'L' + i).join('\n')).length, 12);
  const re = vm.runInContext('CUE_CS_RE_', t.ctx); assert.ok(re.test('Fill contact details from old emails.') && !re.test('fill contact details from old emails for Acme'));
});

test('CS6 history (Kiko 28 Oct 04:43Z): cells Canvas holds back are named on the card with the reason; nothing to fill says them too', () => {
  const held = [{ row: 20, name: 'Eve Sy', email: 'eve@sy.test', cells: [{ key: 'phone', why: 'undone in Auto add (2026-10-27)' }] },
    { row: 12, name: 'Ana Cruz', email: 'ana@acme.test', cells: [{ key: 'title', why: 'changed in Canvas by mariana@blankspaceevent.com (2026-10-20)' }] }];
  let t = sandbox({ csMail: CS_MAIL, held });
  t.ctx.cueSend('fill contact details from old emails', [], '');
  const c = csCard(t);
  assert.ok(/\nLeft alone, changed before: Eve Sy Phone \(undone in Auto add \(2026-10-27\)\); Ana Cruz Position \(changed in Canvas by mariana@blankspaceevent\.com \(2026-10-20\)\)\./.test(c.text), c.text);
  t = sandbox({ gaps: [], held });
  t.ctx.cueSend('fill contact details from old emails', [], '');
  assert.ok(/Nothing to do\. Left alone, changed before: Eve Sy Phone/.test(csLast(t)), csLast(t)); assert.strictEqual(t.log.claude.length, 0);
});
