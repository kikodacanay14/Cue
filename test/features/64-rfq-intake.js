// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: RFQ-RFP-INTAKE.
/* RFQ-RFP-INTAKE (Kiko 29 Oct 2026 15:13Z: "i dont think it sensed that its for intake - keywords - Request for Quotation, Request for
 * Proposal and variations of it"): a subject with those words is a new inquiry in New mail, and Canvas's Emails waiting card offers
 * Start intake (rfq on the alert row), which Cue's page answers by starting intake on that Gmail thread. */
test('RI1 RFQ and RFP words in a subject, with their variations; other subjects are not', () => {
  const r = t => sandbox().ctx.cueRfqSubject_(t);
  ['Request for Quotation - Booth', 'Request Quotation • GVT Outdoor Booth Setup ( Parking Slot 17 )', 'REQUEST FOR PROPOSAL: Year-end party',
    'Request for a quote', 'Requesting for quotation', 'Quotation request: LED wall', 'Proposal Request for Q1 activation', 'RFQ 2026-114', 'RFP: Sales conference',
    'Fwd: RFQs for the launch'].forEach(t => assert.ok(r(t), t));
  ['Payment sent · Trick or Treat - Manila', 'Your quotation is attached', 'Proposal for your event', 'Thanks for the quote', '', null].forEach(t => assert.ok(!r(t), String(t)));
});
test('RI2 New mail: an email whose subject asks for a quotation is a new inquiry even when the sort calls it FYI or skip', () => {
  const box = NM_BOX.concat([{ id: '66ff000000000006', msgs: [{ id: 'n6', ms: MS('2026-10-21T02:58:30Z'), h: H('Ruth Andres <ruth@moldex.example>', 'Request Quotation • GVT Outdoor Booth Setup'),
    body: 'We would like to request a quotation for the proposed outdoor booth setup.' }] }]);
  const t = nmSandbox({ inbox: box }); t.setAdded(['11aa000000000001', '22bb000000000002', '33cc000000000003', '66ff000000000006']);
  const id = nmRun(t), it = t.state(id).nm.items.find(x => x.sender === 'ruth@moldex.example');
  deq([it.group, it.why, !!it.removed], ['inquiry', 'the subject asks for a quotation or proposal', false]);
  assert.ok(it.chat_id, 'the RFQ opens its own email chat (Ask Cue changes part 2b)');
});
test('RI3 the Emails waiting file marks RFQ and RFP emails, so Canvas can offer Start intake; others are not marked', () => {
  const hd = (s, from) => ({ headers: [{ name: 'From', value: from || 'Ruth <ruth@moldex.example>' }, { name: 'Subject', value: s }] });
  const th = (id, s) => ({ id, messages: [{ internalDate: String(Date.parse('2026-10-21T02:00:00Z')), labelIds: ['INBOX'], payload: hd(s), snippet: 'Hi' }] });
  const out = sandbox().ctx.cueMaPick_([th('a1', 'Request Quotation • GVT Booth'), th('a2', 'Payment sent')], 'kiko@blankspaceevent.com', Date.parse('2026-10-21T03:00:00Z'));
  deq(out.map(x => [x.id, x.rfq]), [['a1', true], ['a2', false]]);
});
test('RI4 Cue\'s page answers Canvas\'s Start intake: only from Canvas, only a Gmail thread id, then it opens the task and runs it', () => {
  const src = cuePage();
  assert.ok(/d\.canvasWs === 'cueIntake' && e\.source === CUE_HOST\.canvas && \/\^\[0-9a-f\]\{6,32\}\$\/i\.test/.test(src), 'only Canvas, only a thread id');
  assert.ok(/function cueIntakeFrom\(tid\) \{\s*call\('cueTriageIntake', \[tid\]/.test(src) && /goThread\(r\.request_id\);\s*call\('cueRun', \[r\.request_id\]/.test(src));
});
test('RI5 a known supplier\'s reply to an RFQ stays as the sort put it (Kiko 15:20Z "No, skip supplier replies")', () => {
  const box = NM_BOX.concat([{ id: '77aa000000000007', msgs: [{ id: 'n7', ms: MS('2026-10-21T02:58:40Z'), h: H('Oasis <oasis@sup.example>', 'Re: Request for Quotation - LED wall'),
    body: 'Please see our quote attached.' }] }]);
  const t = nmSandbox({ inbox: box, waiting: { on: true, stale: false, checked: 1, items: [{ id: '77aa000000000007', from: 'Oasis', email: 'oasis@sup.example',
    subject: 'Re: Request for Quotation - LED wall', at: 1, unread: true, who: 'Supplier', name: 'Oasis', pid: '', project: '' }] } });
  t.setAdded(['11aa000000000001', '77aa000000000007']);
  const it = t.state(nmRun(t)).nm.items.find(x => x.sender === 'oasis@sup.example');
  deq([it.group, it.known.who], ['fyi', 'Supplier']);
});
