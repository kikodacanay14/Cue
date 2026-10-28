// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: ars.
test('AR1 ARs (Kiko 07:42Z): the chat call picks the command, Canvas lists, the card ticks only what is ready; no extra AI call, no Claude', () => {
  const t = sandbox({ similar: [{ project_id: 'S-31628060SP', name: 'Globe Year-End Party', account: 'Globe', date: '2026-12-12', status: 'Completed', why: 'similar name' }],
    talk: { reply: 'On it.', looks_like_inquiry: false, start_intake: '', task: '', start_ar: 'Globe year-end party' } });
  const r = t.ctx.cueSend('can you sort out the receipts for the Globe year-end party', [], '');
  assert.ok(r.request_id); const v = t.ctx.cueRun(r.request_id);
  assert.strictEqual(v.kind, 'ar'); assert.strictEqual(v.ar.doc, 'ar'); assert.strictEqual(v.status, 'Needs you'); assert.strictEqual(v.ar.project_id, 'S-31628060SP');
  deq(t.log.bridge.map(b => b.action).filter(a => a !== 'search_projects'), ['find_similar_projects', 'crew_docs']); assert.ok((t.log.search || []).indexOf('globe') >= 0, 'the chat lookup, also a read'); assert.strictEqual(t.log.arList, 'S-31628060SP'); assert.strictEqual(t.log.docKind, 'ar');
  assert.strictEqual(v.metrics.ai_calls, 0, 'the run itself makes no AI call'); assert.strictEqual(t.log.gpt.length, 1, 'only the chat call'); assert.strictEqual(t.log.claude.length, 0);
  deq(v.ar.items.filter(x => x.tick).map(x => x.key), [], 'PC check 27 Oct: the card opens with nothing ticked');
  deq(v.ar.items.filter(x => !x.why && !x.doc && !x.off).map(x => x.key), ['Q|PR-001', 'Q|PR-003', 'R|ben cruz|usher'], 'blocked, already-made and no-email crew cannot be made');
  assert.ok(v.ar.items.find(x => x.key === 'R|carla lim|host').off, 'Kiko 12:58Z: a resource with no email is turned off');
  assert.ok(t.tabs.Chat.rows.some(x => x[2] === 'Started a thread for it.' && x[3] === '>' + r.request_id), 'main chat points at the new thread');
  assert.ok(/acknowledgement receipts/i.test(JSON.stringify(t.log.gpt[0].instructions)) && /FSAs/.test(JSON.stringify(t.log.gpt[0].instructions)), 'the chat model knows the command, FSAs too');
  deq(Object.keys(JSON.parse(JSON.stringify(t.log.gpt[0].text.format.schema.properties))).sort(), CHAT_FIELDS);
  deq(JSON.parse(JSON.stringify(t.log.gpt[0].text.format.schema.required)).sort(), CHAT_FIELDS, 'strict schema needs every field required');
});
test('AR2 ARs: a Canvas id is used as given; an unknown name stops with a plain reason and Try again', () => {
  const t = sandbox({ talk: { reply: 'On it.', looks_like_inquiry: false, start_intake: '', task: '', start_ar: 'S-31628060SP' } });
  const v = t.ctx.cueRun(t.ctx.cueSend('ARs for S-31628060SP please', [], '').request_id);
  assert.strictEqual(v.status, 'Needs you'); deq(t.log.bridge.map(b => b.action).filter(a => a !== 'search_projects'), ['crew_docs']); deq(t.log.search || [], ['S-31628060SP'], 'the chat lookup, also a read');
  const u = sandbox({ talk: { reply: 'On it.', looks_like_inquiry: false, start_intake: '', task: '', start_ar: 'Nowhere Fest' } });
  const w = u.ctx.cueRun(u.ctx.cueSend('make the ARs for Nowhere Fest', [], '').request_id);
  assert.strictEqual(w.status, 'Failed'); assert.ok(/no project called "Nowhere Fest"/.test(w.error), w.error);
});
function arCard(o, text) {
  const t = sandbox(Object.assign({ talk: { reply: 'On it.', looks_like_inquiry: false, start_intake: '', task: '', start_ar: 'S-31628060SP' } }, o || {}));
  const id = t.ctx.cueSend(text || 'prepare ARs S-31628060SP', [], '').request_id; t.ctx.cueRun(id); return Object.assign(t, { id });
}
test('AR3 Make (Kiko 13:22Z): one background job for the ticked names; refuses blocked, no-email crew, over 60 and nothing; nothing emailed', () => {
  const t = arCard();
  assert.throws(() => t.ctx.cueApprove(t.id, { make: ['Q|PR-002'] }), /VAT registered/);
  assert.throws(() => t.ctx.cueApprove(t.id, { make: ['R|carla lim|host'] }), /no email on file/);
  assert.throws(() => t.ctx.cueApprove(t.id, { make: ['Q|PR-004'] }), /already has one/);
  assert.throws(() => t.ctx.cueApprove(t.id, { make: [] }), /Tick at least one/);
  const big = arCard({ arItems: Array.from({ length: 61 }, (_, i) => ({ key: 'Q|PR-1' + i, kind: 'Supplier', name: 'S' + i, role: 'x', amount: 1, has_email: true, why: '', ar: null })) });
  assert.throws(() => big.ctx.cueApprove(big.id, { make: Array.from({ length: 61 }, (_, i) => 'Q|PR-1' + i) }), /60 at most/);
  const v = t.ctx.cueApprove(t.id, { make: ['Q|PR-001', 'R|ben cruz|usher'] });
  const mk = t.log.bridge.filter(b => b.action === 'crew_docs_make'); assert.strictEqual(mk.length, 1, 'one call for the whole batch');
  assert.strictEqual(mk[0].project_id, 'S-31628060SP'); assert.strictEqual(mk[0].args.request_id, t.id + '-m1'); deq(mk[0].args.keys, ['Q|PR-001', 'R|ben cruz|usher']);
  assert.strictEqual(v.status, 'Working'); assert.strictEqual(v.stage, 'Canvas is making'); deq(v.ar.progress, { made: 0, failed: 0, total: 2 });
  assert.ok(!t.log.arMailed, 'nothing emailed on make');
  assert.ok(t.tabs.Chat.rows.some(x => /Canvas is making 2 ARs for S-31628060SP/.test(x[2])));
});
test('AR4 progress (Kiko 13:30Z "Generating 15 of 50"), then "2 files done. Send them?"; Send with Kiko\'s edit, one call per person; done with one summary line', () => {
  const t = arCard({ jobStep: 1 }); t.ctx.cueApprove(t.id, { make: ['Q|PR-001', 'R|ben cruz|usher'] });
  let v = t.ctx.cueRun(t.id); assert.strictEqual(v.status, 'Working'); deq(v.ar.progress, { made: 1, failed: 0, total: 2 }, 'Generating 1 of 2');
  deq(v.ar.items.filter(x => x.state).map(x => x.state), ['made', 'waiting']);
  v = t.ctx.cueRun(t.id); assert.strictEqual(v.status, 'Needs you'); assert.strictEqual(v.stage, 'Ready to send');
  assert.ok(t.tabs.Chat.rows.some(x => /^2 files done for S-31628060SP\. Do you want me to send these files\?/.test(x[2])), 'Kiko 13:31Z');
  assert.ok(v.ar.draft.subject && /Open Canvas/.test(v.ar.draft.intro), 'the draft for the card');
  deq(v.ar.items.filter(x => x.tick).map(x => x.key), ['Q|PR-001', 'R|ben cruz|usher']);
  assert.throws(() => t.ctx.cueApprove(t.id, { send: ['Q|PR-004'] }), /already sent or not made/);
  v = t.ctx.cueApprove(t.id, { send: ['Q|PR-001', 'R|ben cruz|usher'], intro: 'Please sign today. Thank you!' });
  deq(t.log.arMailed, ['Q|PR-001', 'R|ben cruz|usher']); assert.strictEqual(t.log.intro, 'Please sign today. Thank you!'); assert.strictEqual(v.status, 'Done');
  const sum = t.tabs.Chat.rows.filter(x => /^Summary for ARs for S-31628060SP: made 2 ARs; emailed 2; 2 could not be made yet/.test(x[2]));
  assert.strictEqual(sum.length, 2, 'main chat and thread');
  assert.ok(!t.log.gmail.length && !(t.log.sent || []).length, 'nothing from Kiko\'s Gmail');
});
test('AR5 Send later at Kiko\'s time, Send now, Cancel; a file not made is shown with why; a send that fails stays to retry', () => {
  const t = arCard({ arFail: ['R|ben cruz|usher'] }); t.ctx.cueApprove(t.id, { make: ['Q|PR-001', 'R|ben cruz|usher'] });
  let v = t.ctx.cueRun(t.id); assert.strictEqual(v.stage, 'Ready to send'); assert.strictEqual(v.ar.items.find(x => x.key === 'R|ben cruz|usher').error, 'Drive busy');
  assert.ok(t.tabs.Chat.rows.some(x => /1 file done.*1 not made: Ben Cruz \(Drive busy\)/.test(x[2])));
  assert.throws(() => t.ctx.cueApprove(t.id, { send: ['Q|PR-001'], later: t.ctx.cueNow_() - 1000 }), /later than now/);
  v = t.ctx.cueApprove(t.id, { send: ['Q|PR-001'], later: t.ctx.cueNow_() + 3600e3 }); assert.strictEqual(v.stage, 'Send later'); assert.ok(!t.log.arMailed);
  v = t.ctx.cueApprove(t.id, { cancel: true }); assert.strictEqual(v.stage, 'Ready to send');
  t.ctx.cueApprove(t.id, { send: ['Q|PR-001'], later: t.ctx.cueNow_() + 3600e3 });
  t.ctx.cueArDue_(); assert.ok(!t.log.arMailed, 'not before its time');
  t.ctx.__wait(3601e3); t.ctx.cueResume(); deq(t.log.arMailed, ['Q|PR-001'], 'the 5-minute resume sends it at the time Kiko picked');
  assert.strictEqual(t.state(t.id).status, 'Done');
  const n = arCard({ apNotSetUp: true }); n.ctx.cueApprove(n.id, { make: ['Q|PR-001'] }); n.ctx.cueRun(n.id);
  const e = n.ctx.cueApprove(n.id, { send: ['Q|PR-001'] });
  assert.strictEqual(e.stage, 'Ready to send'); assert.ok(/AccountsPayables@ is not set up/.test(e.ar.items.find(i => i.key === 'Q|PR-001').error));
  const f = n.ctx.cueApprove(n.id, { finish: true }); assert.strictEqual(f.status, 'Done');
  assert.throws(() => n.ctx.cueApprove(n.id, { make: ['Q|PR-003'] }), /not waiting for you/);
});
test('AR6 the bridge fixture accepts exactly what Cue sends (crew_docs, crew_docs_make, crew_docs_job, crew_docs_send)', () => {
  assert.strictEqual(bridgeCheck('crew_docs', { kind: 'fsa' }), ''); assert.ok(bridgeCheck('crew_docs', { kind: 'pdf' }));
  assert.strictEqual(bridgeCheck('crew_docs_make', { request_id: 'cue-20261021080000-ab12-m1', kind: 'ar', keys: ['R|ben cruz|usher'] }), '');
  assert.strictEqual(bridgeCheck('crew_docs_job', { request_id: 'cue-20261021080000-ab12-m1' }), '');
  assert.strictEqual(bridgeCheck('crew_docs_send', { request_id: 'cue-20261021080000-ab12', kind: 'fsa', key: 'juan cruz', intro: 'Hi' }), '');
  assert.ok(bridgeCheck('crew_docs_send', { request_id: 'cue-20261021080000-ab12', kind: 'fsa', key: 'juan cruz', remake: true }));
});
