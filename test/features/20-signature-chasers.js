// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: signature-chasers.
// FSA / AR signature chasers (CueSweepSignature.gs, spec 06-freelancer-signatures.md)
const SIGN_SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'CueSweepSignature.gs'), 'utf8');
const UNSIGNED = [
  { doc: 'FSA', id: 'FSA-1', project_id: 'S-31628060SP', project: 'Synthetic Expo', name: 'Ana Cruz', email: 'ana@example.test', role: 'Usher', generated: '2026-11-01 10:00', event_date: '2026-11-13', event_days: 2, event_end: '2026-11-14', project_status: 'For Event Proper', admin_status: 'Open' },
  { doc: 'AR', id: 'AR-1', project_id: 'S-31628060SP', project: 'Synthetic Expo', name: 'Ana Cruz', email: 'ana@example.test', role: 'Usher', generated: '2026-11-05 09:00', event_date: '2026-11-13', event_days: 2, event_end: '2026-11-14', project_status: 'For Event Proper', admin_status: 'Open' },
  { doc: 'AR', id: 'AR-2', project_id: 'S-31628060SP', project: 'Synthetic Expo', name: 'Ben Lim', email: 'ben@example.test', role: 'Host', generated: '2026-11-20 09:00', event_date: '2026-11-13', event_days: 2, event_end: '2026-11-14', project_status: 'For Event Proper', admin_status: 'Open' },
  { doc: 'FSA', id: 'FSA-9', project_id: 'S-40000000XX', project: 'Cancelled Gala', name: 'Cy Go', email: 'cy@example.test', role: 'Host', generated: '2026-11-01 10:00', event_date: '2026-11-10', event_days: 1, event_end: '2026-11-10', project_status: 'Cancelled', admin_status: '' },
  { doc: 'FSA', id: 'FSA-7', project_id: 'S-31628060SP', project: 'Synthetic Expo', name: 'Dee Paz', email: '', role: 'Crew', generated: '2026-11-01 10:00', event_date: '2026-11-13', event_days: 2, event_end: '2026-11-14', project_status: 'For Event Proper', admin_status: 'Open' }];
function signBox(o = {}) { const t = sweepBox(Object.assign({ unsigned: UNSIGNED }, o), null); return t; }
test('G1 nothing before the day after the event; then one line per freelancer, no AI call, no board read, fixed template', () => {
  const t = signBox(); t.at('2026-11-14', 7, 0); t.ctx.cueSweep();
  assert.ok(t.tabs.Chat.rows.some(r => /nothing to chase today/.test(r[2])), 'event still on (its last day)'); assert.strictEqual(t.log.unsigned, 1);
  t.at('2026-11-15', 7, 0); t.ctx.cueSweep(); const b = batchOf(t);
  assert.strictEqual(t.log.gpt.length, 0, 'no AI call'); assert.ok(!t.log.board, 'no project board read'); assert.strictEqual(b.metrics.ai_calls, 0);
  deq(b.batch.items.map(i => [i.who, i.selected, i.no_email]), [['Ana Cruz', true, false], ['Dee Paz', false, true]]);
  const ana = b.batch.items[0];
  assert.ok(/FSA for Synthetic Expo/.test(ana.why) && /AR for Synthetic Expo/.test(ana.why), ana.why);
  assert.strictEqual(ana.subject, 'Please sign your FSA and AR · Synthetic Expo');
  assert.ok(/^Hi Ana,/.test(ana.body) && /FSA for Synthetic Expo \(Usher\) and AR for Synthetic Expo \(Usher\) are still waiting/.test(ana.body) && /https:\/\/canvas\.blankspaceevent\.com\/crew/.test(ana.body), ana.body);
  assert.ok(/No email on file/.test(b.batch.items[1].why)); assert.ok(!b.batch.items.some(i => /Cy Go|Ben Lim/.test(i.who)), 'cancelled project skipped; late AR waits');
});
test('G2 an AR made after the event (late payment) is chased from the day after it was made', () => {
  const t = signBox({ unsigned: UNSIGNED.filter(d => d.id === 'AR-2') });
  t.at('2026-11-20', 7, 0); t.ctx.cueSweep(); assert.ok(!batchOf(t) || batchOf(t).status === 'Done');
  t.at('2026-11-21', 7, 0); t.ctx.cueSweep(); deq(batchOf(t).batch.items.map(i => i.who), ['Ben Lim']);
});
test('G3 Approve and send at 10:00: Canvas sends from freelancers@ (real bridge schema), no Gmail draft, chased again 2 days later', () => {
  const t = signBox({ unsigned: UNSIGNED.slice(0, 1) }); t.at('2026-11-15', 10, 0); t.ctx.cueSweep(); const id = batchOf(t).id;
  t.ctx.cueApprove(id, { send: true, bodies: { [batchOf(t).batch.items[0].key]: 'Hi Ana, edited by Kiko. https://canvas.blankspaceevent.com/crew' } });
  assert.strictEqual(t.log.reminders.length, 1); const r = t.log.reminders[0];
  assert.strictEqual(bridgeCheck('send_doc_reminder', r), ''); deq(r.docs, [{ doc: 'FSA', id: 'FSA-1' }]); assert.strictEqual(r.email, 'ana@example.test');
  assert.ok(/edited by Kiko/.test(r.body)); assert.ok(/^sig:cue-/.test(r.reminder_id)); assert.strictEqual(t.log.gmail.length, 0, 'no draft in Kiko\'s Gmail');
  assert.strictEqual(batchOf(t).status, 'Done');
  deq(chase(t).map(x => [x[0], x[5], x[6], x[8]]), [['signature:ana@example.test:S-31628060SP', 1, '2026-11-17', 'sent']]);
  t.at('2026-11-16', 7, 0); t.ctx.cueSweep(); assert.ok(t.tabs.Chat.rows.some(x => /nothing to chase today/.test(x[2])));
  t.at('2026-11-17', 10, 0); t.ctx.cueSweep(); const n = batchOf(t).batch.items[0];
  assert.strictEqual(n.times, 1); assert.ok(/^Reminder: /.test(n.subject) && /Following up on our earlier reminder/.test(n.body), n.body);
});
test('G4 after 3 reminders Cue stops and flags it; signed papers drop out; signed between approve and send is not an error', () => {
  const t = signBox({ unsigned: UNSIGNED.slice(0, 1) });
  for (const d of ['2026-11-15', '2026-11-17', '2026-11-19']) { t.at(d, 10, 0); t.ctx.cueSweep(); t.ctx.cueApprove(batchOf(t).id, { send: true }); }
  assert.strictEqual(t.log.reminders.length, 3); t.at('2026-11-21', 7, 0); t.ctx.cueSweep();
  const b = batchOf(t); assert.strictEqual(b.batch.items.length, 0); deq(b.batch.stopped.map(i => i.who), ['Ana Cruz']);
  const u = signBox({ unsigned: UNSIGNED.slice(0, 1) }); u.at('2026-11-15', 7, 0); u.ctx.cueSweep(); const id = batchOf(u).id;
  u.ctx.cueApprove(id, { send: true }); u.log.signed = ['FSA-1']; u.at('2026-11-15', 9, 0); u.ctx.cueResume();
  const v = batchOf(u); assert.strictEqual(v.status, 'Done'); assert.ok(!v.batch.items[0].error);
  u.at('2026-11-17', 7, 0); u.ctx.cueSweep(); assert.ok(u.tabs.Chat.rows.some(x => /nothing to chase today/.test(x[2])), 'signed: no longer listed');
});
test('G5 Drafts only: the reminder goes to Kiko\'s own Gmail Drafts and Canvas sends nothing', () => {
  const t = signBox({ unsigned: UNSIGNED.slice(0, 1) }); t.at('2026-11-15', 10, 0); t.ctx.cueSweep();
  t.ctx.cueApprove(batchOf(t).id, { send: false });
  assert.strictEqual(t.log.gmail.length, 1); assert.ok(/ana@example\.test/.test(t.log.gmail[0])); assert.ok(!t.log.reminders);
});
