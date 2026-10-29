// Part of test/cue.test.js: CUE-RFP-SEND-2026-10-28 (Kiko 28 Oct 2026 07:35Z "i want it to send it when i click send", 07:45Z
// "from me"): RFPs and RFP follow-ups Kiko pressed Send on in Canvas go out from his own Gmail through his Cue (CueRfpSend.gs).

const RFP_ITEM = (o) => Object.assign({ key: 'rfp:RFP26-048-08-01:sonicpro:mabc1230', kind: 'rfp', rfp_id: 'RFP26-048-08-01', supplier: 'Sonic Pro',
  to: ['sales@sonicpro.example'], cc: ['accountspayables@blankspaceevent.com', 'es@blankspaceevent.com'],
  subject: 'Request for proposal · Sound system · Acme Gala · RFP26-048-08-01', body: 'Hi Sonic Pro,\n\nPlease send your quote.\n\nKiko',
  thread_id: '', queued_by: 'kiko@example.com', queued_at: '2026-10-28T08:00:00Z' }, o || {});
const rfpMime = t => t.log.gmail.map(m => m.replace(/Subject: =\?UTF-8\?B\?([^?]+)\?=/, (x, b) => 'Subject: ' + Buffer.from(b, 'base64').toString('utf8')));

test('RS1 Kiko\'s queued RFP goes out from his Gmail once (To, CC with AccountsPayables@, the RFP ID in the subject) and Canvas is told Sent with his thread', () => {
  const t = sandbox({ rfpBox: [RFP_ITEM()] });
  const r = t.ctx.cueRfpSendTick_();
  deq([r.sent, r.failed, r.reported], [1, 0, 1]);
  const m = rfpMime(t)[0];
  assert.ok(/^To: sales@sonicpro\.example\r\nCc: accountspayables@blankspaceevent\.com, es@blankspaceevent\.com\r\n/.test(m), m);
  assert.ok(/Subject: Request for proposal · Sound system · Acme Gala · RFP26-048-08-01\r\n/.test(m));
  assert.ok(!/In-Reply-To/.test(m), 'a new RFP starts its own thread');
  deq(t.log.sent, ['draft-1']);
  deq(JSON.parse(JSON.stringify(t.log.rfpSent)), [{ key: RFP_ITEM().key, status: 'Sent', thread_id: 'thr1abcdef', message_id: 'sent1abcdef' }]);
  const again = t.ctx.cueRfpSendTick_();   // Canvas no longer lists it
  deq([again.sent, t.log.sent.length], [0, 1]);
});

test('RS2 a follow-up is a reply in the RFP\'s own Gmail thread (threadId and In-Reply-To the last email)', () => {
  const t = sandbox({ rfpBox: [RFP_ITEM({ key: 'followup:RFP26-048-08-01:sonicpro:mabc1240', kind: 'followup', thread_id: '19a2b3c4d5e6f708',
    subject: 'Re: Request for proposal · Sound system · Acme Gala · RFP26-048-08-01' })],
    threads: { '19a2b3c4d5e6f708': [{ id: 'm1', payload: { headers: [{ name: 'Message-ID', value: '<first@mail.gmail.com>' }] } }, { id: 'm2', payload: { headers: [{ name: 'Message-Id', value: '<second@mail.gmail.com>' }] } }] } });
  const r = t.ctx.cueRfpSendTick_();
  deq([r.sent, r.reported], [1, 1]);
  deq(t.log.draftThreads, ['19a2b3c4d5e6f708']);
  assert.ok(/In-Reply-To: <second@mail\.gmail\.com>\r\nReferences: <second@mail\.gmail\.com>\r\n/.test(rfpMime(t)[0]));
  assert.strictEqual(t.log.rfpSent[0].status, 'Sent');
});

test('RS3 Canvas not answering the report: the next tick tells Canvas again and never sends the email twice', () => {
  const t = sandbox({ rfpBox: [RFP_ITEM()], rfpSentFail: 1 });
  const r1 = t.ctx.cueRfpSendTick_();
  deq([r1.sent, r1.reported], [1, 0]); assert.ok(/tries again in a minute/.test(r1.note));
  const r2 = t.ctx.cueRfpSendTick_();
  deq([r2.sent, r2.reported, t.log.sent.length, t.log.rfpSent.length], [0, 1, 1, 2]);
  deq([t.log.rfpSent[1].status, t.log.rfpSent[1].thread_id], ['Sent', 'thr1abcdef']);
  assert.ok(!Object.keys(t.props).some(k => /^CUE_RFPS_/.test(k)), 'the sent mark is cleared once Canvas has it');
});

test('RS4 Gmail can\'t send, or there is no supplier email: Canvas is told Failed with the reason, so the scope card says Not sent', () => {
  const t = sandbox({ rfpBox: [RFP_ITEM(), RFP_ITEM({ key: 'rfp:RFP26-048-08-01:lights:mabc1231', supplier: 'Lights', to: ['not an email'] })], sendFail: true });
  const r = t.ctx.cueRfpSendTick_();
  deq([r.sent, r.failed, r.reported], [0, 2, 2]);
  deq(t.log.rfpSent.map(a => a.status), ['Failed', 'Failed']);
  assert.ok(/still in your Drafts/.test(t.log.rfpSent[0].note));
  assert.ok(/No supplier email/.test(t.log.rfpSent[1].note));
  const u = sandbox({ rfpBoxFail: true }), q = u.ctx.cueRfpSendTick_();
  assert.ok(/Could not read the RFP Outbox/.test(q.note)); assert.ok(!u.log.gmail.length);
});

test('RS5 Kiko 08:33Z "i need the rfp sending faster": it runs from its own 1-minute trigger, not the 5-minute resume; a cloud check only reads', () => {
  const t = sandbox({ rfpBox: [RFP_ITEM()] });
  assert.ok(!t.ctx.cueJobs_().some(j => j.fn === 'cueRfpSendTick_'), 'not in the 5-minute list');
  t.ctx.cueResume();
  assert.ok((t.log.triggers || []).includes('cueRfpKick') && t.log.triggers.includes('cueResume'));
  deq([(t.log.sent || []).length, (t.log.rfpSent || []).length], [0, 0]);
  t.ctx.cueRfpKick();
  deq([t.log.sent.length, t.log.rfpSent.length], [1, 1]);
  assert.ok(t.tabs['Job Runs'].rows.some(r => r[2] === 'RFPs from your Gmail' && r[3] === 'OK' && r[5] === 1), 'a minute that sent writes its Job Runs row');
  const rowsBefore = t.tabs['Job Runs'].rows.length; t.ctx.cueRfpKick();
  assert.strictEqual(t.tabs['Job Runs'].rows.length, rowsBefore, 'a quiet minute writes no row');
  const u = sandbox({ rfpBoxFail: true }); u.ctx.cueRfpKick();
  assert.ok(!((u.tabs['Job Runs'] || { rows: [] }).rows.some(r => r[2] === 'RFPs from your Gmail')), 'no row every minute while Canvas lacks the outbox');
  const c = sandbox({ rfpBox: [RFP_ITEM()] }); c.ctx.CUE_CHECK_ON_ = true;
  assert.strictEqual(c.ctx.cueRfpKick(), null);
  const r = c.ctx.cueRfpSendTick_();
  deq([r.sent, r.would.length, c.log.gmail.length, (c.log.rfpSent || []).length], [0, 1, 0, 0]);
});

test('RS6 Settings > Scheduled tasks has "RFPs from your Gmail" (every minute): Run now sends at once; off stops the minutes; a run in progress is never doubled', () => {
  const t = sandbox({ rfpBox: [RFP_ITEM()] });
  t.ctx.cueSchedSeed_();
  const row = t.ctx.cueSchedRead_(t.ctx.cueSchedSheet_()).find(x => x.id === 'sys-rfps');
  deq([row.on, t.ctx.cueSchedWhen_(row), row.next], [true, 'Every minute', 0]);
  deq(JSON.parse(JSON.stringify(t.ctx.cueSchedRun_(row, true))), { result: 'Sent 1', task: '' });
  deq(JSON.parse(JSON.stringify(t.ctx.cueSchedRun_(row, true))), { result: 'Nothing waiting', task: '' });
  const u = sandbox({ rfpBox: [RFP_ITEM()] }); u.ctx.cueSchedSeed_();
  u.props.CUE_RFPS_RUN = String(u.ctx.cueNow_() + 60e3);
  deq(JSON.parse(JSON.stringify(u.ctx.cueSchedRun_({ run: 'rfps' }, true))), { result: 'Already sending', task: '' });
  assert.ok(!(u.log.sent || []).length);
  const sh = u.ctx.cueSchedSheet_(), x = u.ctx.cueSchedRead_(sh).find(y => y.id === 'sys-rfps'); x.on = false; u.ctx.cueSchedWrite_(sh, x);
  delete u.props.CUE_RFPS_RUN; u.ctx.cueRfpKick();
  assert.ok(!(u.log.sent || []).length, 'off: the minute trigger sends nothing');
});

// CUE-WELCOME-FROM-KIKO-2026-10-29 (Kiko 29 Oct 07:50Z "the client welcome make the email come from my inbox"): Canvas queues the
// client welcome with its styled body; Cue sends it from Kiko's Gmail with the Canvas logo inline.
const WELCOME_ITEM = (o) => RFP_ITEM(Object.assign({ key: 'welcome:CLIENT:annaacmeexample:mabc1250', kind: 'welcome', rfp_id: 'CLIENT', supplier: 'anna@acme.example',
  to: ['anna@acme.example'], cc: [], subject: 'Welcome to Canvas · Acme projects', body: 'Hi Anna,\n\nYou can now follow your Acme projects.\n\nBlank Space Events',
  html: '<img src="cid:canvaslogo" alt="Canvas"><p>Hi Anna,</p><p>You can now follow your Acme projects.</p>' }, o || {}));
const mimePart = (m, type) => { const i = m.indexOf('Content-Type: ' + type); if (i < 0) return null;
  const body = m.slice(m.indexOf('\r\n\r\n', i) + 4).split('\r\n--')[0]; return Buffer.from(body.replace(/\r\n/g, ''), 'base64'); };

test('RS7 the client welcome goes from Kiko\'s Gmail as the styled email (text and html) with the Canvas logo inline, and Canvas is told Sent', () => {
  const logo = Buffer.from('PNGLOGO'.repeat(40)).toString('base64');
  const t = sandbox({ rfpBox: [WELCOME_ITEM()], rfpLogo: logo });
  const r = t.ctx.cueRfpSendTick_();
  deq([r.sent, r.failed, r.reported], [1, 0, 1]);
  const m = rfpMime(t)[0];
  assert.ok(/^To: anna@acme\.example\r\nSubject: Welcome to Canvas · Acme projects\r\n/.test(m), m.slice(0, 200));
  assert.ok(/Content-Type: multipart\/related; boundary="r/.test(m) && /Content-Type: multipart\/alternative; boundary="a/.test(m));
  assert.strictEqual(mimePart(m, 'text/plain').toString('utf8'), WELCOME_ITEM().body);
  assert.strictEqual(mimePart(m, 'text/html').toString('utf8'), WELCOME_ITEM().html);
  assert.ok(/Content-ID: <canvaslogo>\r\n/.test(m)); assert.strictEqual(mimePart(m, 'image/png').toString('base64'), logo);
  assert.ok(m.split('\r\n').every(l => l.length <= 998), 'no line over the mail limit');
  deq(JSON.parse(JSON.stringify(t.log.rfpSent)), [{ key: WELCOME_ITEM().key, status: 'Sent', thread_id: 'thr1abcdef', message_id: 'sent1abcdef' }]);
});

test('RS8 a styled email without the logo still goes as text and html; a plain RFP stays plain text', () => {
  const t = sandbox({ rfpBox: [WELCOME_ITEM(), RFP_ITEM()] });
  t.ctx.cueRfpSendTick_();
  const [w, p] = rfpMime(t);
  assert.ok(/multipart\/alternative/.test(w) && !/multipart\/related/.test(w) && !/canvaslogo>/.test(w));
  assert.ok(/Content-Type: text\/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n/.test(p) && !/multipart/.test(p));
});
