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
  deq([r1.sent, r1.reported], [1, 0]); assert.ok(/tries again in 5 minutes/.test(r1.note));
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

test('RS5 it runs every 5 minutes from cueResume; a cloud check only reads the outbox and sends nothing', () => {
  assert.ok(sandbox().ctx.cueJobs_().some(j => j.fn === 'cueRfpSendTick_'));
  const t = sandbox({ rfpBox: [RFP_ITEM()] }); t.ctx.cueResume();
  deq([t.log.sent.length, t.log.rfpSent.length], [1, 1]);
  const c = sandbox({ rfpBox: [RFP_ITEM()] }); c.ctx.CUE_CHECK_ON_ = true;
  const r = c.ctx.cueRfpSendTick_();
  deq([r.sent, r.would.length, c.log.gmail.length, (c.log.rfpSent || []).length], [0, 1, 0, 0]);
});
