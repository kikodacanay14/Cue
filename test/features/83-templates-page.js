// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: Cue Admin › Templates.
/* CUE-MT-2026-11-03 (spec message-templates-from-doc.md, CanvasWorkspace #391, approved by Kiko 1 Nov 2026; his design). The page reads
 * every template from the doc through Canvas (message_templates), shows each one built by Canvas (message_render, draft mode) and sends
 * Kiko a test from his own Gmail. fixtures/message-templates.json is Canvas's message_templates answer for the real doc (its parser on
 * CanvasWorkspace tools/test/fixtures/message-templates-doc.json, read 1 Nov 2026), so the keys below are the doc's own. */
const MT_LIST = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'message-templates.json'), 'utf8'));
const MT_RENDER = { key: 'C6 Cost estimate ready', code: 'C6', who: 'C', channel: 'Email', subject: 'Your event starts taking shape | {{event}}',
  text: 'Hi {{first_name}},\n\nTake a look at your estimate: {{ce_url}}', html: '<div><img src="cid:mtbanner" width="600"><p>Hi {{first_name}},</p><p><a href="{{ce_url}}">Take a look</a></p></div>',
  banner: 'iVBORw0KGgo=', rev: '1762150000000', missing: ['first_name', 'ce_url', 'event'] };
const mtBox = (o = {}) => sandbox({ web: req => o.fail && req.url.indexOf('script.google.com') >= 0 ? resp(200, { ok: false, status: 'Blocked', error: o.fail }) : null, bridgeFn: b => {
  if (b.action === 'message_templates') return JSON.parse(JSON.stringify(o.list || MT_LIST));
  if (b.action === 'message_render') return Object.assign({}, MT_RENDER, { key: b.args.key }, o.render || {});
} });

test('MT1 every template in the doc is listed with its journey step, sender and status from the approved mockup; the team drafts show as not in the doc yet', () => {
  const t = mtBox(), R = JSON.parse(JSON.stringify(t.ctx.cueAdminTemplates()));
  assert.strictEqual(R.error, undefined);
  assert.strictEqual(R.list.length, 54, 'the 48 doc templates and the 6 T drafts');
  assert.strictEqual(R.list.filter(x => x.indoc).length, 48);
  assert.ok(R.list.filter(x => x.indoc).every(x => x.stage && x.sentBy && x.from), 'every doc template is in the map, by its exact key');
  deq(R.list.filter(x => !x.indoc).map(x => [x.key, x.status, x.stage]), ['Approval needed', 'Approved or rejected', 'Status changed', 'Supplier awarded', 'Your day', 'Announcement'].map((n, i) => ['T' + (i + 1) + ' ' + n, 'New draft', 'Team']));
  const c6 = R.list.find(x => x.key === 'C6 Cost estimate ready');
  deq([c6.whoName, c6.stage, c6.sentBy, c6.status, c6.from, c6.attachments.map(a => a.name)], ['Clients', '3 Propose', 'Cue', 'Old wording', "Kiko's Gmail (kikodacanay@)", ['Cost estimate PDF']]);
  deq([R.list.find(x => x.key === 'C2 First follow-up').status, R.list.find(x => x.key === 'C2 Introduction').status], ['In use', 'Sent by hand']);
  deq(R.list.filter(x => x.channel === 'SMS').map(x => x.key), ['R1 SMS', 'R2 SMS', 'R5 SMS', 'R6 SMS', 'R7 SMS', 'R8 SMS']);
  const s1 = R.list.find(x => x.key === 'S1 Supplier accreditation request');
  assert.strictEqual(s1.button, '{{accreditation_form_url}}');
  assert.ok(s1.vars.indexOf('first_name') >= 0 && s1.vars.indexOf('accreditation_form_url') >= 0, 'the fill-ins it uses');
  deq(R.statuses, ['In use', 'Old wording', 'Not built', 'New draft', 'Sent by hand']);
  deq(t.log.bridge.map(b => b.action), ['message_templates'], 'one read, nothing written');
});

test('MT2 a send in Canvas\'s Template Sends log makes a template In use and shows as Last sent; Canvas\'s own sender and inbox win over the map', () => {
  const list = JSON.parse(JSON.stringify(MT_LIST));
  const s4 = list.templates.find(x => x.key === 'S4 Single payment notice');
  s4.last = { at: '2026-11-04 09:12', to: 'supplier@example.com', rev: '1762150000000' }; s4.from = 'ap@blankspaceevent.com'; s4.cc = ''; s4.attachments = [{ name: 'AR.pdf', id: 'drive-id-1' }];
  const R = JSON.parse(JSON.stringify(mtBox({ list }).ctx.cueAdminTemplates())), x = R.list.find(y => y.key === 'S4 Single payment notice');
  deq([x.status, x.last, x.from, x.attachments], ['In use', { at: '2026-11-04 09:12', to: 'supplier@example.com', rev: '1762150000000' }, 'ap@blankspaceevent.com', [{ name: 'AR.pdf', id: 'drive-id-1', url: '' }]]);
});

test('MT3 when Canvas or the doc cannot be read the page lists nothing and says why (no copy of old wording)', () => {
  const R = mtBox({ fail: 'The BSE Message Templates doc could not be read: no access' }).ctx.cueAdminTemplates();
  assert.strictEqual(R.list.length, 0);
  assert.ok(/refused message_templates \(Blocked\): The BSE Message Templates doc could not be read: no access/.test(R.error), R.error);
  assert.ok(!/CUE_TPL|Thanks!/.test(fs.readFileSync(path.join(__dirname, '..', 'src', 'CueMsgTemplates.gs'), 'utf8')), 'the page file holds no wording');
});

test('MT4 the preview is Canvas\'s own render in draft mode, with the doc\'s banner put in as a picture', () => {
  const t = mtBox(), P = t.ctx.cueAdminTemplatePreview('C6 Cost estimate ready');
  deq(t.log.bridge.map(b => [b.action, b.args]), [['message_render', { key: 'C6 Cost estimate ready', data: {}, mode: 'draft' }]]);
  assert.ok(P.html.includes('src="data:image/png;base64,iVBORw0KGgo="') && !P.html.includes('cid:'), P.html);
  deq([P.subject, P.missing], ['Your event starts taking shape | {{event}}', ['first_name', 'ce_url', 'event']]);
  const none = mtBox({ render: { banner: '' } }).ctx.cueAdminTemplatePreview('C6 Cost estimate ready');
  assert.ok(!none.html.includes('cid:mtbanner'), 'no banner: no broken picture');
});

test('MT5 Send me a test goes from Kiko\'s Gmail to Kiko only, marked [Test], with the banner inline; nothing is logged as a send', () => {
  const t = mtBox(), r = t.ctx.cueAdminTemplateTest('C6 Cost estimate ready');
  deq(JSON.parse(JSON.stringify(r)), { to: 'kiko@example.com', subject: '[Test] Your event starts taking shape | {{event}}' });
  assert.strictEqual(t.log.gmail.length, 1); deq(t.log.sent, ['draft-1']);
  const mime = t.log.gmail[0];
  assert.ok(/^To: kiko@example\.com\r\n/.test(mime), 'to Kiko only');
  assert.ok(mime.includes('multipart/related') && mime.includes('Content-ID: <mtbanner>') && mime.includes('multipart/alternative'), 'text, html and the inline banner');
  deq(t.log.bridge.map(b => b.action), ['message_render'], 'no message_log: a test is not a send');
  const sms = mtBox({ render: { channel: 'SMS' } });
  assert.throws(() => sms.ctx.cueAdminTemplateTest('R1 SMS'), /Only emails/);
  assert.strictEqual(sms.log.gmail.length, 0);
});

test('MT6 Cue Admin has Templates under Rules, its calls are owner-only and never run by a cloud check, and the page reads only', () => {
  const page = cuePage();
  assert.ok(page.includes('<button data-s="templates">Templates</button>') && page.includes('<section data-sec="templates" hidden>'));
  assert.ok(page.includes("if (sec === 'templates' && (!MT.d || MT.d.error)) mtLoad();"), 'loads when opened, and again after a failed read');
  assert.ok(page.includes('sandbox=""'), 'the email preview runs no script');
  assert.ok(!/conic-gradient/.test(page));
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'CueMsgTemplates.gs'), 'utf8'), chk = fs.readFileSync(path.join(__dirname, '..', 'src', 'CueCheck.gs'), 'utf8');
  ['cueAdminTemplates', 'cueAdminTemplatePreview', 'cueAdminTemplateTest'].forEach(f => {
    assert.ok(new RegExp('function ' + f + '\\([^)]*\\) \\{\\n  cueOwner_\\(\\);').test(src), f + ' is owner-only');
    assert.ok(chk.includes("'" + f + "'"), f + ' is listed for the cloud check');
  });
  assert.ok(chk.includes("'message_templates', 'message_render'"), 'both bridge calls are reads');
  assert.ok(!/message_template_save|message_log/.test(src), 'this build writes nothing to Canvas');
});
