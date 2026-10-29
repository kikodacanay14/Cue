// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: chaser templates and AI drafts in the BSE voice.
/* VOICE-2026-10-29 (Kiko 29 Oct 08:14Z "rewrite templates make sure that they follow" the brand voice guide; his picks 08:24Z: everything
 * that goes out, BSE guide first, the Style tab only sets the greeting and the sign-off). Guide: project files .claude/brand-voice-guidelines.md. */

const BV_BANG = s => (String(s).match(/!/g) || []).length;
const BV_EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const BV_BANNED = /\bkindly\b|please be advised|\brevert\b|do the needful/i;

test('BV1 every chaser template opens with "Hi", closes with "Thank you,", has at most one "!" and no emoji or banned words', () => {
  const t = sandbox({ rfq: true, award: true }), c = t.ctx;
  const rfq = c.cueKinds_().filter(k => k.kind === 'rfq')[0].template;
  const samples = [
    rfq({ who: 'Mark', to: 'mark@x.com', thread_subject: 'RFQ: Chairs', project: 'Tech Summit', facts: { rfq_sent: '20 Oct', reply_by: 'Monday 3 Nov' } }),
    c.cueAwardTemplate_({ who: 'Ana Cruz', project: 'Tech Summit', facts: { chaser_number: 1 } }),
    c.cueAwardTemplate_({ who: 'Ana Cruz', project: 'Tech Summit', facts: { chaser_number: 2 } }),
    c.cuePayTemplate_({ project: 'Tech Summit', times: 0, facts: { contact: 'Fe', bis: [{ no: '12', project: 'Tech Summit', balance_text: '₱45,000.00', due: '25 Oct' }] } }),
    c.cuePayTemplate_({ project: 'Tech Summit', times: 2, facts: { bis: [{ no: '12', project: 'Tech Summit', balance_text: '₱45,000.00', due: '25 Oct' }] } }),
    c.cueAccrTemplate_({ who: 'Mark', facts: { contact_name: 'Mark', project: 'Tech Summit', missing: ['Bank details'], form_url: 'https://f' } }),
    c.cueSignTemplate_({ who: 'Juan Dela Cruz', project: 'Tech Summit', times: 0, docs: [{ doc: 'FSA', project: 'Tech Summit', role: 'Usher' }] }),
    c.cueSignTemplate_({ who: 'Juan Dela Cruz', project: 'Tech Summit', times: 1, docs: [{ doc: 'FSA', project: 'Tech Summit', role: 'Usher' }] }),
    c.cueInquiryTemplate_({ project: 'Gala', facts: { contact: 'Ana Cruz', inquiry: 'Year-end gala' } }),
    c.cueWinbackTemplate_({ facts: { contact: 'Ana Cruz', last_event_name: 'Family Day' } })];
  samples.forEach(m => {
    assert.ok(/^Hi [^,\n]+,\n\n/.test(m.body), m.body);
    assert.ok(/\n\nThank you,\n/.test(m.body), m.body);
    assert.ok(BV_BANG(m.body) <= 1 && !BV_EMOJI.test(m.body) && !BV_BANNED.test(m.body), m.body);
  });
});
test('BV2 payment chasers have no "!" at all, no "Dear" and no "Good day"', () => {
  const t = sandbox();
  [0, 1, 2].forEach(n => {
    const m = t.ctx.cuePayTemplate_({ project: 'Tech Summit', times: n, facts: { contact: 'Fe', bis: [{ no: '12', project: 'Tech Summit', balance_text: '₱45,000.00', due: '25 Oct' }] } });
    assert.strictEqual(BV_BANG(m.body + m.subject), 0, m.body); assert.ok(!/Dear|Good day/.test(m.body), m.body);
    assert.ok(/^Hi Fe,/.test(m.body) && /BI 12, Tech Summit: ₱45,000\.00 balance, due 25 Oct/.test(m.body));
  });
});
test('BV3 the signature reminder says event language and signs off "Blank Space Events · Freelancers"', () => {
  const m = sandbox().ctx.cueSignTemplate_({ who: 'Juan', project: 'Tech Summit', times: 1, docs: [{ doc: 'AR', project: 'Tech Summit', role: 'Usher' }] });
  assert.ok(/close our records for Tech Summit\./.test(m.body) && !/project/i.test(m.body), m.body);
  assert.ok(/Thank you,\nBlank Space Events · Freelancers$/.test(m.body), m.body);
  assert.strictEqual(m.subject, 'Reminder: Please sign your AR · Tech Summit');
});
test('BV4 every drafting call carries the BSE voice before Kiko\'s Style lines; Style adds only greeting and sign-off', () => {
  const t = sandbox(); t.tabs.Style = sheetMock();
  [['On', 'Audience', 'Kind', 'Text'], [true, 'all', 'tone', 'Polite and straight'], [true, 'supplier', 'greeting', 'Hi [name],'],
    [true, 'supplier', 'sign-off', 'Thank you,\nKiko'], [true, 'supplier', 'example', 'Hi,\nSample']].forEach(r => t.tabs.Style.appendRow(r));
  const p = t.ctx.cueStyleFor_('supplier');
  assert.ok(p.indexOf('Blank Space Events brand voice') >= 0 && p.indexOf('Blank Space Events brand voice') < p.indexOf('own style'));
  assert.ok(/English only/.test(p) && /No emoji/.test(p) && /never "project"/.test(p) && /none in payment/.test(p));
  assert.ok(/greeting: Hi \[name\],/.test(p) && /sign-off: Thank you,\nKiko/.test(p));
  assert.ok(!/Polite and straight/.test(p) && !/Sample/.test(p), 'tone and example lines stay out');
});
