// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: cloud-check.
// Cloud check (CueCheck.gs, Kiko 27 Oct 2026 08:28Z ok): the sandbox runs the copy tools/check.mjs pushes for a check run.
const CHECK_KEY = 'test-check-key-0123456789abcdefghijkl', CHECK_PID = 'S-31628060SP';
const checkCode = (o = {}) => CODE
  .replace("const CUE_CHECK_FP_ = '';", () => "const CUE_CHECK_FP_ = '" + (o.fp != null ? o.fp : crypto.createHash('sha256').update(CHECK_KEY).digest('hex')) + "';")
  .replace('const CUE_CHECK_UNTIL_ = 0;', () => 'const CUE_CHECK_UNTIL_ = ' + (o.until || Date.parse('2026-10-21T04:00:00Z')) + ';')
  .replace("const CUE_CHECK_PID_ = '';", () => "const CUE_CHECK_PID_ = '" + (o.pid || CHECK_PID) + "';")
  .replace("const CUE_CHECK_MAIL_ = '';", () => "const CUE_CHECK_MAIL_ = '^kiko\\\\+[a-z0-9-]+@example\\\\.com$';")
  .replace("const CUE_CHECK_SEND_ = '';", () => "const CUE_CHECK_SEND_ = '" + (o.send || 'no') + "';");
const doorOf = (t, key) => (action, x) => JSON.parse(t.ctx.doPost({ postData: { contents: JSON.stringify(Object.assign({ action, key: key || CHECK_KEY }, x || {})) } }).text);
function checkBox(o = {}) { const t = sandbox(Object.assign({ code: checkCode(o) }, o)); t.door = doorOf(t); t.call = (fn, ...args) => t.door('check_call', { fn, args }); return t; }
function checkToReady(t) {
  const id = t.call('cueSend', 'generate FSAs for ' + CHECK_PID, [], '').result.request_id; t.call('cueRun', id);
  assert.ok(t.call('cueApprove', id, { make: ['juan cruz'] }).ok); const v = t.call('cueRun', id).result; assert.strictEqual(v.stage, 'Ready to send');
  return id;
}
test('CK1 the check door is shut everywhere but a check version: live, /dev and the relay refuse it; the off version refuses everything', () => {
  const live = sandbox(); deq(doorOf(live)('check_ping'), { ok: false, error: 'Not allowed.' });
  const off = checkBox({ fp: 'off' }); deq(off.door('check_ping'), { ok: false, error: 'Not allowed.' }); assert.strictEqual(off.door('relay_list').ok, false);
  const t = checkBox(); assert.strictEqual(t.door('relay_list').ok, false, 'the check version answers no relay call');
  assert.strictEqual(live.ctx.CUE_CHECK_ON_, undefined); assert.ok(!live.ctx.UrlFetchApp.__cueCheck, 'nothing wrapped outside a check');
});
test('CK2 only this run\'s key, only until the run ends (finish 30 minutes more); ping names the test project', () => {
  const t = checkBox(); deq(doorOf(t, 'wrong-key-wrong-key-wrong-key-wrong')('check_ping'), { ok: false, error: 'Not allowed.' });
  assert.strictEqual(doorOf(t, 'short')('check_ping').ok, false);
  const p = t.door('check_ping'); deq([p.ok, p.project_id], [true, CHECK_PID]);
  t.ctx.__wait(3600e3); deq(t.door('check_ping'), { ok: false, error: 'This check run has ended.' }); assert.ok(t.door('check_finish').ok, 'finish still cleans up for 30 minutes');
  t.ctx.__wait(1800e3); deq(t.door('check_finish'), { ok: false, error: 'This check run has ended.' });
});
test('CK3 only the page\'s task functions run; settings, keys and schedules never; the check sees only its own tasks and Kiko never sees them', () => {
  const t = checkBox(); const mine = t.ctx.cueSend('generate FSAs for ' + CHECK_PID, [], '').request_id;   // Kiko's own task, before the check
  ['cueSettings', 'cueFixAccess', 'cueRelayKeys', 'cueSetup', 'cueResume', 'eval'].forEach(fn => assert.ok(/is not part of a check/.test(t.call(fn).error), fn));
  const id = t.call('cueSend', 'generate FSAs for ' + CHECK_PID, [], '').result.request_id;
  let st = t.call('cueState').result; deq(st.requests.map(r => r.id), [id]); assert.ok(st.chat.length && st.chat.every(c => c.request_id.replace('>', '') === id || c.request_id === ''), JSON.stringify(st.chat));
  assert.ok(t.tabs.Chat.rows.filter(r => r[3] === id).every(r => r[4] === vm.runInContext('cueCheckTag_()', t.ctx)), 'check lines are tagged');
  t.ctx.CUE_CHECK_ON_ = false; st = t.ctx.cueState();
  deq(st.requests.map(r => r.id), [mine]); assert.ok(!st.chat.some(c => c.request_id === id), 'Kiko\'s page never shows the check');
});
test('CK4 write lock: Make writes only to the test project; any other project is stopped and fails the run', () => {
  const t = checkBox(); checkToReady(t);
  deq(t.log.bridge.filter(b => b.action === 'crew_docs_make').map(b => b.project_id), [CHECK_PID]); deq(t.door('check_finish').stopped, []);
  const x = checkBox({ pid: 'S-99999999ZZ' }); const id = x.call('cueSend', 'generate FSAs for ' + CHECK_PID, [], '').result.request_id; x.call('cueRun', id);
  const r = x.call('cueApprove', id, { make: ['juan cruz'] });
  assert.ok(!r.ok && /Check mode stopped Canvas crew_docs_make on S-31628060SP \(only S-99999999ZZ may be written\)/.test(r.error), r.error);
  assert.strictEqual(x.log.bridge.filter(b => b.action === 'crew_docs_make').length, 0, 'nothing reached Canvas');
  assert.ok(/crew_docs_make on S-31628060SP/.test(x.door('check_finish').stopped[0]));
  assert.throws(() => x.ctx.cueCheckPlan_([{ action: 'crm_log', pid: '' }], 'h'), /crm_log on no project/);
  x.ctx.cueCheckPlan_([{ action: 'crm_log', pid: 'S-99999999ZZ' }], 'h1'); assert.doesNotThrow(() => x.ctx.cueCheckAllow_({ url: URL + '?sig=1', method: 'post', payload: JSON.stringify({ action: 'claim_plan', args: { plan_hash: 'h1' } }) }));
  assert.throws(() => x.ctx.cueCheckAllow_({ url: URL + '?sig=1', method: 'post', payload: JSON.stringify({ action: 'claim_plan', args: { plan_hash: 'other' } }) }), /plan outside the test project/);
});
test('CK5 mail lock and other writes: a draft goes only to test addresses; HubSpot, other sheets and triggers are stopped; reads and AI pass', () => {
  const t = checkBox(); t.door('check_ping');
  const draft = heads => { t.ctx.CUE_CHECK_WEB_ = { fetch: () => resp(200, { message: { payload: { headers: heads } } }) };
    return () => t.ctx.cueCheckAllow_({ url: 'https://gmail.googleapis.com/gmail/v1/users/me/drafts/send', method: 'post', payload: JSON.stringify({ id: 'd1' }) }); };
  assert.doesNotThrow(draft([{ name: 'To', value: 'Kiko Crew <kiko+crew1@example.com>' }, { name: 'Cc', value: 'kiko+crew2@example.com' }]));
  assert.throws(draft([{ name: 'To', value: 'kiko+crew1@example.com' }, { name: 'Bcc', value: 'ana@acme.example' }]), /an email to ana@acme\.example/);
  assert.throws(draft([]), /an email to nobody/);
  assert.throws(() => t.ctx.UrlFetchApp.fetch('https://api.hubapi.com/crm/v3/objects/deals/1', { method: 'patch' }), /Check mode stopped a write to https:\/\/api\.hubapi\.com/);
  assert.throws(() => t.ctx.SpreadsheetApp.openById('personal-sheet'), /other than the Cue sheet/); assert.ok(t.ctx.SpreadsheetApp.openById('cue'));
  assert.throws(() => t.ctx.ScriptApp.newTrigger('cueResume'), /triggers/);
  ['https://api.anthropic.com/v1/messages', 'https://api.openai.com/v1/responses', 'https://gmail.googleapis.com/gmail/v1/users/me/drafts'].forEach(u => assert.doesNotThrow(() => t.ctx.cueCheckAllow_({ url: u, method: 'post' }), u));
  assert.doesNotThrow(() => t.ctx.cueCheckAllow_({ url: 'https://api.hubapi.com/crm/v3/objects/deals/1' }), 'a read');
  const st = t.door('check_finish').stopped; assert.ok(st.some(x => /hubapi/.test(x)) && st.some(x => /ana@acme/.test(x)) && !st.some(x => /triggers|Cue sheet/.test(x)), JSON.stringify(st));
});
test('CK6 no leftovers: a check\'s Send later never sends from the trigger, cueResume never runs a check task, and finish cancels and closes', () => {
  const t = checkBox({ until: Date.parse('2026-10-21T06:00:00Z') }); const id = checkToReady(t);
  assert.strictEqual(t.call('cueApprove', id, { send: ['juan cruz'], later: t.ctx.cueNow_() + 3600e3 }).result.stage, 'Send later');
  t.ctx.CUE_CHECK_ON_ = false; t.ctx.__wait(3601e3); t.ctx.cueResume(); t.ctx.cueArDue_();
  assert.ok(!t.log.arMailed, 'the 5-minute trigger never sends a check item'); assert.strictEqual(t.state(id).stage, 'Send later');
  const f = t.door('check_finish'); assert.ok(f.ok, JSON.stringify(f)); deq([f.later_cancelled, f.closed, f.stopped], [1, 1, []]);
  const s = t.state(id); deq([s.status, s.stage, !!s.ar.send_at, s.check], ['Done', 'Closed by the check', false, vm.runInContext('cueCheckTag_()', t.ctx)]);
  deq(t.door('check_finish').closed, 0, 'once');
});
test('CK8 send lock (Kiko 27 Oct 09:16Z): on a real stand-in project Send is stopped before Canvas emails anyone; only send "on" lets it through', () => {
  const t = checkBox(); const id = checkToReady(t); assert.strictEqual(t.door('check_ping').send, false);
  const r = t.call('cueApprove', id, { send: ['juan cruz'], now: true });
  const shown = r.ok ? JSON.stringify(t.state(id)) : r.error;
  assert.ok(/Check mode stopped Canvas crew_docs_send \(this check may not email anyone\)/.test(shown), shown);
  assert.strictEqual(t.log.bridge.filter(b => b.action === 'crew_docs_send').length, 0, 'nothing reached Canvas');
  assert.ok(/crew_docs_send/.test(t.door('check_finish').stopped.join(' ')), 'and the run fails');
  ['ar_email', 'send_payment_chasers', 'send_doc_reminder'].forEach(a => assert.throws(() => t.ctx.cueCheckBridgeOk_(JSON.stringify({ action: a, project_id: CHECK_PID })), /may not email anyone/, a));
  assert.throws(() => t.ctx.cueCheckPlan_([{ action: 'ar_email', pid: CHECK_PID }], 'h'), /may not email anyone/);
  const ok = checkBox({ send: 'on' }); const id2 = checkToReady(ok); assert.strictEqual(ok.door('check_ping').send, true);
  ok.call('cueApprove', id2, { send: ['juan cruz'], now: true });
  deq(ok.log.bridge.filter(b => b.action === 'crew_docs_send').map(b => b.project_id), [CHECK_PID]); deq(ok.door('check_finish').stopped, []);
});
test('CK9 check mode reads BSE Scopes and Transfers through a read-only view: the transfer lookup answers, any change stops the run; bi_list is a read', () => {
  const t = txBox({ code: checkCode({ until: Date.parse('2030-01-01T00:00:00Z') }) }); t.door = doorOf(t); t.call = (fn, ...args) => t.door('check_call', { fn, args });
  t.call('cueSend', 'any transfer for AP-CUP-TRI-1', [], '');
  const st = t.call('cueState').result; assert.ok(st.chat.some(c => /transfer of ₱1,200\.00/.test(c.text)), JSON.stringify(st.chat.map(c => c.text)));
  const ss = t.ctx.SpreadsheetApp.openById('1Z9n6mrG_0kjzafkTxE_F9GzqU3IlQ0P388wV3wwny74'), tab = ss.getSheetByName('Transfers');
  assert.ok(tab.getLastRow() > 1, 'reads pass');
  assert.throws(() => tab.insertRowsAfter(1, 1), /Check mode stopped changing spreadsheet 1Z9n6mrG \(insertRowsAfter\)/);
  assert.throws(() => tab.getRange(1, 1).setValue('x'), /\(setValue\)/); assert.ok(Array.isArray(tab.getRange(1, 1, 2, 2).getValues()), 'a range read passes');
  assert.ok(t.door('check_finish').stopped.some(x => /insertRowsAfter/.test(x)), 'and the run fails');
  assert.doesNotThrow(() => t.ctx.cueCheckBridgeOk_(JSON.stringify({ action: 'bi_list', args: { query: 'telus' } })));
  assert.throws(() => t.ctx.cueCheckBridgeOk_(JSON.stringify({ action: 'invoice_line', project_id: 'S-25506500TR' })), /invoice_line on S-25506500TR/);
});
// Cloud check 1.27.40 chasers (test/checks/1.27.40-chasers.check.mjs): RFQ and accreditation chasers in a check run, with BSE's own
// supplier applications in Kiko's sent mail and a supplier whose only other address is an invoicing app's no-reply sender.
const CHASE_APPS = { bbbb0000000000b1: [gm('b1', PH('2026-10-12', 10), KIKO, 'karen@results.example', 'Request for Supplier Accreditation — Events Management & Technical Production | Blank Space Events OPC')],
  bbbb0000000000b2: [gm('b2', PH('2026-10-12', 10), KIKO, 'manila@state.example', 'Vendor Registration / Procurement Process Inquiry — Events & Technical Production')] };
function chaseBox(o = {}) {
  const threads = Object.assign({}, RFQ_THREADS, CHASE_APPS), sent = Object.keys(threads).map(t => ({ id: threads[t][0].id, thread: t, ms: Number(threads[t][0].internalDate), to: '', subject: '', snippet: '' }));
  const rows = ACCR.rows.map(r => r.supplier === 'Build Co' ? Object.assign({}, r, { sent_to: ['message-service@sender.zohoinvoice.com', 'Heidi@Build.example'] }) : r);
  const sentSearch = sent.filter(m => m.id !== 'cue-sent-1');
  return rfqBox(Object.assign({ threads, sent, sentSearch, accr: Object.assign({}, ACCR, { rows }), msgs: ACCR_MSGS,
    gmailList: q => (/Supplier accreditation/.test(q) ? (/sonic/.test(q) ? ACCR_MSGS : []) : sentSearch),
    talk: { reply: 'Running the sweep now.', looks_like_inquiry: false, start_intake: '', task: '', run_sweep: true } }, o));
}
test('CK10 the chasing sweep in a check run reads only: its own batch, no sweep day, no Chase log, no Canvas posted-hook; applications and no-reply To left out', () => {
  const t = chaseBox({ code: checkCode({ until: Date.parse('2030-01-01T00:00:00Z') }) }); t.door = doorOf(t); t.call = (fn, ...args) => t.door('check_call', { fn, args });
  t.ctx.CUE_CHECK_ON_ = false; const kiko = t.ctx.cueSweepNow().id; t.ctx.CUE_CHECK_ON_ = true;   // Kiko's own batch for today, open
  const day = t.ctx.PropertiesService.getScriptProperties().getProperty('CUE_SWEEP_DAY'), chased = (t.tabs['Chase log'] || { rows: [] }).rows.length;
  t.ctx.PropertiesService.getScriptProperties().deleteProperty('CUE_SWEEP_DAY');
  t.call('cueSend', 'run the chasing sweep now', [], '');
  const st = t.call('cueState').result, b = st.requests.filter(r => r.kind === 'sweep');
  deq(b.length, 1); assert.notStrictEqual(b[0].id, kiko, 'the check opened its own batch, not Kiko\'s');
  assert.ok(st.chat.some(c => /^Morning batch is ready: /.test(c.text)), JSON.stringify(st.chat.map(c => c.text)));
  const items = b[0].batch.items, rfq = items.filter(i => i.kind === 'rfq'), accr = items.filter(i => i.kind === 'accreditation');
  assert.ok(rfq.length && accr.length, 'both kinds found something');
  assert.ok(!rfq.some(i => /accredit|registration|procurement/i.test(i.project + ' ' + i.subject + ' ' + i.body)), JSON.stringify(rfq.map(i => i.project)));
  assert.ok(!items.some(i => t.ctx.cueNoReply_(i.to) || /zohoinvoice/.test(i.to)), JSON.stringify(items.map(i => i.to)));
  assert.ok(!accr.some(i => t.ctx.cueAccrAsksAccount_(i.body)), 'no account number asked');
  assert.strictEqual(t.ctx.PropertiesService.getScriptProperties().getProperty('CUE_SWEEP_DAY'), null, 'no sweep day set');
  assert.strictEqual((t.tabs['Chase log'] || { rows: [] }).rows.length, chased, 'no Chase log row');
  assert.ok(day, 'Kiko\'s own run still sets the sweep day');
  assert.ok(t.call('cueCloseTask', b[0].id).ok); assert.ok(!t.log.replies && !t.log.sent, 'nothing drafted or sent');
  t.ctx.CUE_CHECK_ON_ = false; assert.strictEqual(t.ctx.cueState().requests.filter(r => r.kind === 'sweep')[0].id, kiko, 'Kiko still sees only his batch');
  deq(t.door('check_finish').stopped, []);
});
test('CK7 every server function the page calls is either a check function or listed as never; nothing in Cue sends mail around the mail lock', () => {
  const html = cuePage(), ctx = sandbox().ctx;
  const page = [...new Set((html.match(/call\('(\w+)'/g) || []).map(x => x.slice(6, -1)))];
  const FNS = vm.runInContext('CUE_CHECK_FNS_', ctx), NEVER = vm.runInContext('CUE_CHECK_NEVER_', ctx), listed = FNS.concat(NEVER); deq(page.filter(f => listed.indexOf(f) < 0), [], 'new page call: add it to CUE_CHECK_FNS_ or CUE_CHECK_NEVER_');
  deq(FNS.filter(f => NEVER.indexOf(f) >= 0 || (page.indexOf(f) >= 0 && typeof ctx[f] !== 'function')), []);   // a release line may lack some listed functions; the door refuses a missing one
  assert.ok(!/\bMailApp\.|GmailApp\.(send|createDraft)|Gmail\.Users\.(Messages|Drafts)\.send|messages\/send/.test(CODE), 'mail leaves only through drafts/send, which the lock reads');
});
