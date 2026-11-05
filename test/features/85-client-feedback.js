// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: client feedback form, the Cue half.
/* CUE-FEEDBACK-2026-11-05 (spec canvas-integration/specs/client-feedback-cue/spec.md, approved by Kiko 5 Nov 2026 04:10Z with A on
 * both questions). Canvas lists the projects (client_feedback) and builds the C9 emails from the doc (message_render); Cue shows one tap
 * line per project from Event Day + 1, sends only on Kiko's tap from his Gmail as Blank Space Events, reminds at 3 and 6 days (Kiko 5 Nov 04:27Z) in the
 * same thread, and stops when Canvas says the client submitted. The client_feedback shape is the one the spec proposes to Canvas. */
const FB_PH = (day, hh) => Date.parse(day + 'T' + String(hh).padStart(2, '0') + ':00:00+08:00');
const FB_ROW = { id: 'S-25110301SH', name: 'Smart Home Office Opening', lastDay: '2026-11-08', formUrl: 'https://canvas.example/feedback?t=abc',
  client: { name: 'Adi Salvatierra', first: 'Adi', email: 'adi@smarthome.example' }, submitted: false, submittedAt: '' };
function fbBox(o = {}) {
  const st = { rows: o.rows || [Object.assign({}, FB_ROW)] }, t0 = {};
  const t = sandbox({ feedback: true, props: o.props, threads: { thr1abcdef: [{ id: 'sent1abcdef', payload: { headers: [{ name: 'Message-ID', value: '<first-feedback@mail>' }] } }] }, bridgeFn: b => {
    if (b.action === 'client_feedback') return { projects: JSON.parse(JSON.stringify(st.rows)) };
    if (b.action === 'message_render') {
      const d = b.args.data || {}, chaser = /Chaser$/.test(b.args.key), miss = ['first_name', 'event', 'form_url'].concat(chaser ? ['original_subject'] : []).filter(k => !d[k]);
      (t0.renders = t0.renders || []).push(b.args);   // the doc's chaser subject is "Re: {{original_subject}}" (added 5 Nov 2026)
      return { key: b.args.key, code: 'C9', who: 'C', channel: 'Email', subject: chaser ? 'Re: ' + d.original_subject : 'Thank you for ' + d.event,
        text: 'Hi ' + d.first_name + ',\n\n' + (chaser ? 'A quick reminder' : 'Thank you') + '\n\nGive feedback: ' + d.form_url,
        html: '<div><img src="cid:mtbanner" width="600"><p>Hi ' + d.first_name + ',</p><p><a href="' + d.form_url + '">Give feedback</a></p></div>',
        banner: 'iVBORw0KGgo=', rev: '1762300000000', missing: o.missing || miss };
    }
  } });
  let T = FB_PH(o.day || '2026-11-09', 14); t.at = (d, h) => { T = FB_PH(d, h || 14); }; t.ctx.cueNow_ = () => T;
  t.st = st; t.renders = () => t0.renders || [];
  t.run = day => { if (day) t.at(day); t.ctx.PropertiesService.getScriptProperties().deleteProperty('CUE_SWEEP_DAY'); t.ctx.cueSweepNow(); return t.last(); };
  t.last = () => t.ctx.cueState().requests.filter(r => r.kind === 'sweep').sort((a, b) => String(a.id).localeCompare(String(b.id))).pop();
  t.mime = () => t.log.gmail[t.log.gmail.length - 1];
  return t;
}
const fbLines = b => ((b && b.batch && b.batch.items) || []).filter(i => i.kind === 'feedback');

test('FB1 the day after the last event day: one tap line to the Direct Client with Canvas\'s own email; nothing sent, no AI call, the release day stored', () => {
  const t = fbBox(), b = t.run();
  const L = fbLines(b);
  deq(L.map(i => [i.key, i.to, i.tap, i.short, i.subject]), [['feedback:S-25110301SH', 'adi@smarthome.example', true, 'Send feedback form', 'Thank you for Smart Home Office Opening']]);
  assert.ok(/Hi Adi,/.test(L[0].body) && /canvas\.example\/feedback/.test(L[0].body), L[0].body);
  const reads = t.log.bridge.filter(x => x.action === 'client_feedback');
  deq(reads[0].args, { since: '2026-11-09' }, 'only events ending on or after the release day (Kiko, question 2: A)');
  deq(t.log.bridge.filter(x => x.action === 'message_render').map(x => [x.args.key, x.args.mode]), [['C9 Client Feedback Request', 'send']]);
  assert.strictEqual(t.ctx.PropertiesService.getScriptProperties().getProperty('CUE_FB_SINCE'), '2026-11-09');
  assert.ok(!t.log.sent && !t.log.gmail.length, 'nothing sent before Kiko taps'); assert.strictEqual(t.log.gpt.length, 0);
  assert.ok(!t.log.bridge.some(x => x.action === 'claim_plan' || x.action === 'message_log'), 'reads only, nothing written to Canvas');
});

test('FB2 the event\'s last day itself (or later) gives no line; a project with no Direct Client email or no form link says what to do and has no Send', () => {
  const t = fbBox({ rows: [Object.assign({}, FB_ROW, { lastDay: '2026-11-09' }), Object.assign({}, FB_ROW, { id: 'S-2', name: 'Gala', client: { name: '', email: '' } }),
    Object.assign({}, FB_ROW, { id: 'S-3', name: 'Launch', formUrl: '' })] });
  const b = t.run(), L = fbLines(b);
  deq(L.map(i => i.key).sort(), ['feedback:S-2', 'feedback:S-3']);
  assert.ok(L.every(i => !i.tap && i.no_email), 'no Send without an address or a form');
  assert.ok(/Mark the Direct Client in Resources > Client tab/.test(L.find(i => i.key === 'feedback:S-2').why));
  assert.ok(/no feedback form link/.test(L.find(i => i.key === 'feedback:S-3').why));
});

test('FB3 Kiko\'s tap sends once from his Gmail as Blank Space Events, in the client design with the banner inline; a second tap sends nothing', () => {
  const t = fbBox(), b = t.run();
  t.ctx.cueSweepSendOne(b.id, 'feedback:S-25110301SH', fbLines(b)[0].body);
  deq(t.log.sent.length, 1);
  const m = t.mime();
  assert.ok(m.startsWith('From: =?UTF-8?B?' + Buffer.from('Blank Space Events').toString('base64') + '?= <kiko@example.com>\r\nTo: adi@smarthome.example\r\n'), m.slice(0, 200));
  assert.ok(m.includes('Content-ID: <mtbanner>') && m.includes('multipart/related') && m.includes('text/html'), 'banner inline with the html');
  assert.ok(!/In-Reply-To/.test(m) && t.log.draftThreads[0] === '', 'the first email starts its own thread');
  assert.ok(t.log.bridge.filter(x => x.action === 'client_feedback').length === 2, 'Canvas is asked again just before the send');
  deq(JSON.parse(t.ctx.PropertiesService.getScriptProperties().getProperty('CUE_FB_THREADS'))['S-25110301SH'], { t: 'thr1abcdef', s: 'Thank you for Smart Home Office Opening' });
  const row = chase(t).find(r => r[0] === 'feedback:S-25110301SH'); deq([row[5], row[6]], [1, '2026-11-12'], 'reminder 1 due 3 days after');
  t.ctx.cueSweepSendOne(b.id, 'feedback:S-25110301SH', ''); deq(t.log.sent.length, 1, 'a second tap sends nothing');
});

test('FB4 reminders: none before day 3; at 3 and 6 days a tap line that replies in the first thread with the Chaser template; then no third reminder', () => {
  const t = fbBox(); let b = t.run();
  t.ctx.cueSweepSendOne(b.id, 'feedback:S-25110301SH', '');
  assert.strictEqual(fbLines(t.run('2026-11-11')).length, 0, 'day 2: nothing');
  b = t.run('2026-11-12'); let L = fbLines(b);
  deq(L.map(i => [i.short, i.in_thread, i.tap]), [['Reminder 1 of 2', true, true]]);
  deq(t.renders().pop(), { key: 'C9 Client Feedback Chaser', data: { first_name: 'Adi', event: 'Smart Home Office Opening', form_url: 'https://canvas.example/feedback?t=abc', original_subject: 'Thank you for Smart Home Office Opening' }, mode: 'send' });
  t.ctx.cueSweepSendOne(b.id, 'feedback:S-25110301SH', '');
  const m = t.mime();
  assert.ok(m.includes('In-Reply-To: <first-feedback@mail>') && t.log.draftThreads.pop() === 'thr1abcdef', 'a reply in the first email\'s thread');
  assert.ok(m.includes('Subject: =?UTF-8?B?' + Buffer.from('Re: Thank you for Smart Home Office Opening').toString('base64')), 'Re: the first subject');
  b = t.run('2026-11-15'); L = fbLines(b); deq(L.map(i => i.short), ['Reminder 2 of 2']);
  t.ctx.cueSweepSendOne(b.id, 'feedback:S-25110301SH', ''); deq(t.log.sent.length, 3);
  assert.strictEqual(fbLines(t.run('2026-11-18')).length, 0, 'three emails: no third reminder');
});

test('FB5 Canvas says submitted: no line, one "Feedback received" in the chat, and a tap made after the client submitted sends nothing', () => {
  const t = fbBox(); let b = t.run();
  t.ctx.cueSweepSendOne(b.id, 'feedback:S-25110301SH', '');
  b = t.run('2026-11-12');
  t.st.rows[0].submitted = true; t.st.rows[0].submittedAt = '2026-11-12 10:42';
  t.ctx.cueSweepSendOne(b.id, 'feedback:S-25110301SH', '');
  deq(t.log.sent.length, 1, 'the reminder did not go');
  assert.ok(/already sent the feedback form, so nothing was sent/.test(t.last().batch.items.find(i => i.kind === 'feedback').error));
  assert.strictEqual(fbLines(t.run('2026-11-15')).length, 0);
  t.run('2026-11-16');
  assert.strictEqual(t.tabs.Chat.rows.filter(r => /^Feedback received: Smart Home Office Opening \(Adi Salvatierra\)/.test(r[2])).length, 1, 'said once');
});

test('FB6 a template the doc cannot fill sends nothing and says what is missing; Kiko\'s own words go as he typed them', () => {
  const t = fbBox({ missing: ['form_url'] }), b = t.run();
  t.ctx.cueSweepSendOne(b.id, 'feedback:S-25110301SH', '');
  assert.ok(!t.log.sent);
  assert.ok(/missing form_url, so nothing was sent/.test(t.last().batch.items.find(i => i.kind === 'feedback').error));
  const u = fbBox(), c = u.run();
  u.ctx.cueSweepSendOne(c.id, 'feedback:S-25110301SH', 'Hi Adi,\n\nMy own words.\n\nThanks!');
  const m = u.mime(); assert.ok(m.includes(Buffer.from('Hi Adi,\n\nMy own words.\n\nThanks!').toString('base64').slice(0, 20)) && !m.includes('text/html'), 'plain, as typed');
});

test('FB7 the kind is on the Chaser rules card (1 day, every 3, 3 emails), Jobs › Chasers and the cloud-check reads; the rule can pause it', () => {
  const t = fbBox();
  deq(Object.assign({}, t.ctx.cueRules().kinds.feedback), { label: 'C9 Client feedback', on: true, first: 1, every: 3, max: 3, unit: 'days' });
  assert.ok(fs.readFileSync(path.join(__dirname, '..', 'src', 'CueCheck.gs'), 'utf8').includes("'client_feedback'"));
  t.ctx.cueRulesSave({ 'feedback.on': false });
  assert.strictEqual(fbLines(t.run()).length, 0, 'paused: no line');
});
