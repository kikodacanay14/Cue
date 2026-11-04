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
  if (b.action === 'message_template_save') return o.save || { ok: true, rev: '1762160000000', readBack: '' };
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

test('MT6 Cue Admin has Templates under Rules, its calls are owner-only and never run by a cloud check, and it never logs a send', () => {
  const page = cuePage();
  assert.ok(page.includes('<button data-s="templates">Templates</button>') && page.includes('<section data-sec="templates" hidden>'));
  assert.ok(page.includes("if (sec === 'templates' && (!MT.d || MT.d.error)) mtLoad();"), 'loads when opened, and again after a failed read');
  assert.ok(page.includes('sandbox=""'), 'the email preview runs no script');
  assert.ok(!/conic-gradient/.test(page));
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'CueMsgTemplates.gs'), 'utf8'), chk = fs.readFileSync(path.join(__dirname, '..', 'src', 'CueCheck.gs'), 'utf8');
  ['cueAdminTemplates', 'cueAdminTemplatePreview', 'cueAdminTemplateSave', 'cueAdminTemplateTest'].forEach(f => {
    assert.ok(new RegExp('function ' + f + '\\([^)]*\\) \\{\\n  cueOwner_\\(\\);').test(src), f + ' is owner-only');
    assert.ok(chk.includes("'" + f + "'"), f + ' is listed for the cloud check');
  });
  assert.ok(chk.includes("'message_templates', 'message_render'"), 'both bridge calls are reads');
  assert.ok(!/message_log/.test(src), 'a test or a save is never logged as a send');
  assert.ok(page.includes('Save to doc') && page.includes("google.script.run.withSuccessHandler"), 'the editor saves through the server call');
  assert.ok(/if \(k === 'edit'\) \{[^\n]*\n\s*call\('cueAdminTemplates'/.test(page), 'Edit re-reads the doc before the editor opens (CUE-042 item 4)');
});

test('MT7 Save to doc sends Canvas one claimed write with the subject and the message as paragraphs and buttons, then lists again; a bad read-back or an empty message is refused', () => {
  const crypto = require('crypto');
  const t = mtBox(), body = 'Hi {{first_name}},\r\n\r\nYour estimate is ready.\nSee you soon.\n\n\n[Take a look]({{ce_url}})\n\n';
  const R = t.ctx.cueAdminTemplateSave('C6 Cost estimate ready', { subject: 'Your event | {{event}}\n', body });
  assert.strictEqual(R.list.length, 54, 'returns the page list again');
  deq(t.log.bridge.map(b => b.action), ['claim_plan', 'message_template_save', 'message_templates']);
  const w = t.log.bridge[1], plan = t.log.bridge[0];
  deq(JSON.parse(JSON.stringify(w.args)), { key: 'C6 Cost estimate ready', subject: 'Your event | {{event}}', blocks: [
    { t: 'p', text: 'Hi {{first_name}},' }, { t: 'p', text: 'Your estimate is ready.\nSee you soon.' }, { t: 'btn', text: 'Take a look', url: '{{ce_url}}' }] });
  assert.ok(!('from' in w.args) && !('cc' in w.args) && !('attachments' in w.args), 'inbox, CC and attachments are not sent');
  const c = plan.args.commands.find(x => x.command_id === w.command_id);
  assert.ok(c, 'the write is a command of the claimed plan');
  assert.strictEqual(c.payload_hash, crypto.createHash('sha256').update(JSON.stringify(['message_template_save', w.project_id || '', w.expected_project_number || '', w.args])).digest('hex'));
  assert.strictEqual(t.ctx.cueMtText_(w.args.blocks), 'Hi {{first_name}},\n\nYour estimate is ready.\nSee you soon.\n\n[Take a look]({{ce_url}})', 'the editor box reads back the same');
  const bad = mtBox({ save: { ok: false, rev: '1', readBack: 'Subject: old' } });
  assert.throws(() => bad.ctx.cueAdminTemplateSave('C6 Cost estimate ready', { subject: 'x', body: 'y' }), /reads differently from what you saved: Subject: old/);
  const unsure = mtBox(), fa = unsure.ctx.UrlFetchApp.fetchAll;
  unsure.ctx.UrlFetchApp.fetchAll = reqs => /message_template_save/.test(String(reqs[0].payload)) && !/claim_plan/.test(String(reqs[0].payload))
    ? [resp(200, { ok: false, status: 'Uncertain', error: 'The template reads back differently from what was saved. Saved: [...]' })] : fa(reqs);
  assert.throws(() => unsure.ctx.cueAdminTemplateSave('C6 Cost estimate ready', { subject: 'x', body: 'y' }), /^Error: Canvas wrote to the doc but could not confirm it reads back the same\. Open Edit again.*reads back differently/);
  const empty = mtBox();
  assert.throws(() => empty.ctx.cueAdminTemplateSave('C6 Cost estimate ready', { subject: 'x', body: ' \n\n ' }), /message is empty/);
  deq(empty.log.bridge, [], 'nothing reaches Canvas');
  assert.throws(() => empty.ctx.cueAdminTemplateSave('C6 Cost estimate ready', { subject: 'x', body: 'a'.repeat(5001) }), /over 5,000/);
});
