// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: Canvas chasers and Send a notice in Cue Admin.
/* CUE-ADMIN-MOVE-2026-10-29 (Kiko 29 Oct 03:43Z "lets move the AR, Incoice, Payment sent, Final Reminder Admin configs to Cue Admin"; Epic
 * Cue #193): Canvas Admin's Run now (Chasers) and Send a notice now live on Cue Admin. Canvas sends; Kiko's press is the approval. */

const RNW_LIST = { ar: [{ kind: 'ar', item: 'AR-7', pid: 'P-1', project: 'Gala', supplier: 'Supplier A', reqs: ['REQ-1'], amount: 4500, last: '', on: true }],
  invoice: [], paid: [], final: [{ kind: 'final', item: '', pid: 'P-2', project: 'Launch', supplier: '2026-11-02', reqs: [], amount: 0, last: '', on: false }] };

test('AM1 Canvas chasers: the lists come from Canvas run_now_list; Send passes the ticked lines once, 50 a call, and nothing else', () => {
  const t = sandbox({ runNow: RNW_LIST });
  deq(JSON.parse(JSON.stringify(t.ctx.cueAdminCanvasChasers())), RNW_LIST);
  const lines = [{ kind: 'ar', pid: 'P-1', item: 'AR-7' }, { kind: 'final', pid: 'P-2', item: '' }];
  for (let i = 0; i < 50; i++) lines.push({ kind: 'paid', pid: 'P-3', item: 'REQ-' + i });
  const r = JSON.parse(JSON.stringify(t.ctx.cueAdminCanvasChaseSend(lines)));
  deq(t.log.rnwSent.map(a => a.lines.length), [50, 2], 'two calls, in order, each line once');
  deq(t.log.rnwSent[0].lines.slice(0, 2), [{ kind: 'ar', pid: 'P-1', item: 'AR-7' }, { kind: 'final', pid: 'P-2' }], 'an empty item is left out');
  assert.strictEqual(r.results.length, 52); assert.ok(r.results.every(x => x.ok) && r.list);
  assert.throws(() => t.ctx.cueAdminCanvasChaseSend([]), /Tick at least one line/);
  deq(t.log.sent || [], [], 'Cue sends no email of its own');
});

test('AM2 a refused Canvas send marks its lines not sent with Canvas\'s words, and is never retried', () => {
  const t = sandbox({ rnwFail: 1 });
  const r = JSON.parse(JSON.stringify(t.ctx.cueAdminCanvasChaseSend([{ kind: 'ar', pid: 'P-1', item: 'AR-7' }])));
  deq(t.log.rnwSent.length, 1, 'one call only');
  assert.ok(!r.results[0].ok && /Canvas busy/.test(r.results[0].error));
});

test('AM3 Send a notice: board, items and prepare are bridge reads; Send goes to Canvas sn_send with only the fields the bridge takes', () => {
  const t = sandbox();
  const b = JSON.parse(JSON.stringify(t.ctx.cueAdminSnBoard()));
  deq([b.kinds[0].k, b.projects[0].id], ['paid', 'P-1']); assert.ok(/^https:\/\//.test(b.canvas));
  deq(JSON.parse(JSON.stringify(t.ctx.cueAdminSnItems('paid', 'P-1'))), [{ id: 'REQ-1', label: 'REQ-1 · ₱4,500' }]);
  const d = JSON.parse(JSON.stringify(t.ctx.cueAdminSnPrepare('paid', 'P-1', 'REQ-1')));
  deq(t.log.snPrep[0], { kind: 'paid', pid: 'P-1', item: 'REQ-1' });
  const people = d.people.map(p => Object.assign({}, p, { extra: 'x' }));
  const r = t.ctx.cueAdminSnSend({ kind: 'paid', pid: 'P-1', item: 'REQ-1', people, email: true, text: true, subject: 'S', body: 'B', sms: 'T', edited: false, test: false });
  deq(JSON.parse(JSON.stringify(r)).sent, ['Supplier A']);
  const a = t.log.snSent[0];
  deq(Object.keys(a).sort(), ['body', 'edited', 'email', 'item', 'kind', 'people', 'pid', 'sms', 'subject', 'text']);
  deq(a.people[0], { name: 'Supplier A', kind: 'supplier', email: 'a@example.com', mobile: '639171234567', key: 'k1', on: true });
});

test('AM4 Send a test to me goes from Kiko\'s own Gmail to Kiko, never through Canvas', () => {
  const t = sandbox();
  const r = JSON.parse(JSON.stringify(t.ctx.cueAdminSnSend({ kind: 'paid', pid: 'P-1', people: [], email: true, text: true, subject: 'Payment sent', body: 'Hi', sms: 'Paid', test: true })));
  deq([r.test, r.sent], [true, ['kiko@example.com']]);
  deq(t.log.snSent || [], [], 'no Canvas send');
  assert.ok(/^To: kiko@example\.com/m.test(t.log.gmail[0]) && t.log.sent.length === 1, 'one draft to Kiko, sent');
});

test('AM5 the calls are owner-only and never run by a cloud check; the page has one Chasers list for all chasers (Kiko 04:33Z) and Send a notice', () => {
  const t = sandbox({ viewer: 'someone@example.com' });
  assert.throws(() => t.ctx.cueAdminCanvasChaseSend([{ kind: 'ar', pid: 'P-1', item: 'A' }]), /private to its owner/);
  deq(t.log.rnwSent || [], []);
  const never = fs.readFileSync(path.join(__dirname, '..', 'src', 'CueCheck.gs'), 'utf8');
  ['cueAdminCanvasChasers', 'cueAdminCanvasChaseSend', 'cueAdminSnBoard', 'cueAdminSnItems', 'cueAdminSnPrepare', 'cueAdminSnSend'].forEach(f => assert.ok(never.includes("'" + f + "'"), f));
  const page = cuePage();
  ['id="w-rnw"', "data-rnw-kind=\"cue:'", 'function jcHtml', '<section data-sec="sendnotice" hidden>', 'Send ticked', 'Send a test to me', "call('cueAdminCanvasChaseSend'", "call('cueAdminSnSend'"].forEach(w => assert.ok(page.includes(w), w));
});

test('AM6 Kiko 04:33Z "just put it all there": Chasers has no Canvas / Cue tabs', () => {
  const page = cuePage();
  assert.ok(!page.includes('data-jct=') && !page.includes('id="w-jobchasers"') && !/Canvas chasers|Cue chasers/.test(page));
});
