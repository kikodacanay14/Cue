// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: sales-funnel.
// CUE-CRM-FUNNEL-2026-10-28 (spec canvas-crm-funnel.md F6): the morning batch's "Sales: do these today" lines, from Canvas's crm_funnel read.
const FUNNEL = { today: '2026-10-21', limits: { Inquiry: 3, 'CE sent': 10, Delivered: 30 }, steps: [],
  stuck: [
    { kind: 'project', id: 'S-1', name: 'Acme Gala', client: 'Acme', step: 'Inquiry', status: 'For Admin Completion', date: '2026-12-05', days: 8, quiet: 8, limit: 3 },
    { kind: 'project', id: 'S-2', name: 'Beta Launch', client: 'Beta', step: 'CE sent', status: 'For Client Awarding', date: '2026-11-20', days: 12, quiet: 12, limit: 10 },
    { kind: 'project', id: 'S-4', name: 'Delta Summit', client: 'Delta', step: 'Delivered', status: 'For Invoice Billing', date: '2026-09-10', days: 36, quiet: 36, limit: 30 },
    { kind: 'deal', id: 'D-1', name: 'Theta inquiry', client: 'Theta', step: 'Inquiry', status: 'Deal: Inquiry', date: '', days: 5, quiet: 5, limit: 3 }],
  due: [
    { id: 'F-1', due: '2026-10-20', what: 'Call Ana about the venue', client: 'Acme', owner: 'kiko@blankspaceevent.com', pid: 'S-1' },
    { id: 'F-2', due: '2026-10-22', what: 'Send the mood board', client: 'Beta', owner: '', pid: '' },
    { id: 'F-3', due: '2026-10-25', what: 'Later', client: 'Gamma', owner: '', pid: '' }] };
const lines = t => (batchOf(t) ? batchOf(t).batch.items.filter(i => i.kind === 'funnel') : []);

test('SF1 one crm_funnel read gives the sales lines: follow-ups due by tomorrow (overdue urgent), quiet Inquiries and Delivered; CE sent is left to the award chasers', () => {
  const t = sweepBox({ funnel: FUNNEL }, null); t.ctx.cueSweep();
  assert.strictEqual(t.log.funnel, 1, 'one Canvas read per batch');
  deq(lines(t).map(i => [i.key, i.priority, i.why]), [
    ['crmfu:F-1', 'urgent', 'Overdue since 2026-10-20: Call Ana about the venue (kiko)'],
    ['crmfu:F-2', 'normal', 'Due tomorrow: Send the mood board'],
    ['funnel:S-1', 'normal', 'Inquiry, quiet 8 days (limit 3): reply or send the CE'],
    ['funnel:S-4', 'normal', 'Delivered, quiet 36 days (limit 30): send the billing'],
    ['funnel:D-1', 'normal', 'Inquiry, quiet 5 days (limit 3): reply or send the CE']]);
  assert.ok(lines(t).every(i => i.no_email && !i.selected && i.label === 'Sales: do these today'), 'no email, nothing to send');
  assert.strictEqual(t.log.gpt.length + t.log.claude.length, 0, 'no AI call');
});
test('SF2 Skip today hides a line until tomorrow; Stop chasing hides it for good; Canvas busy is one note, the other kinds still run', () => {
  const t = sweepBox({ funnel: FUNNEL }, null); t.ctx.cueSweep(); const id = batchOf(t).id;
  t.ctx.cueSweepItem(id, 'funnel:S-1', 'skip'); t.ctx.cueSweepItem(id, 'funnel:S-4', 'mute');
  t.at('2026-10-22', 7, 0); t.ctx.cueSweep();
  const keys = lines(t).map(i => i.key); assert.ok(keys.includes('funnel:S-1') && !keys.includes('funnel:S-4'), keys.join());
  const u = sweepBox({ funnel: FUNNEL, funnelFail: true }); u.ctx.cueSweep(); const b = batchOf(u);
  assert.ok(b.notes.some(n => /^Sales: do these today: could not check/.test(n)), b.notes.join('|'));
  assert.ok(b.batch.items.some(i => i.kind === 'nudge'), 'RFQ lines still listed');
});
test('SF3 crm_funnel is a read the cloud check may call, and the fixture bridge has it with no amounts in its reply', () => {
  const t = sandbox(); assert.ok(vm.runInContext('CUE_CHECK_READS_', t.ctx).includes('crm_funnel'));
  const src = fs.readFileSync(path.join(__dirname, 'fixtures', 'ZapBridge.gs'), 'utf8');
  assert.ok(/ZB_ACTIONS_\.crm_funnel = \{\s*kind: 'read'/.test(src));
  // CRM-13-2026-10-29: the open list sends only a true/false "priced" flag made from the amount, never the amount itself.
  const reply = src.split('ZB_ACTIONS_.crm_funnel')[1].split('function zbCrmWinback_')[0].replace(/\/\/[^\n]*/g, '');
  assert.ok(/priced: x\.amount != null && x\.amount > 0 \}/.test(reply), 'priced is a boolean');
  assert.ok(!/amount|ce_no|lost_reason/i.test(reply.replace('priced: x.amount != null && x.amount > 0', '')));
});
test('SF4 the cloud check door runs one read-only funnel read and returns the lines; outside a check it refuses', () => {
  const t = checkBox({ funnel: FUNNEL });
  const r = t.call('cueFunnelCheck'); assert.ok(r.ok, r.error);
  deq(r.result.map(i => i.key), ['crmfu:F-1', 'crmfu:F-2', 'funnel:S-1', 'funnel:S-4', 'funnel:D-1']);
  deq(t.log.bridge.map(b => b.action), ['crm_funnel']);
  assert.throws(() => sandbox({ funnel: FUNNEL }).ctx.cueFunnelCheck(), /Only a cloud check/);
});

// CRM-FUNNEL-REST-2026-10-28: Inquiry chasers and win-back drafts (Kiko's Gmail Drafts only) and the Monday funnel review.
const FUNNEL2 = Object.assign({}, FUNNEL, {
  stuck: FUNNEL.stuck.concat([{ kind: 'deal', id: 'D-9', name: 'Kappa year-end party', client: 'Kappa', step: 'Inquiry', status: 'Deal: Inquiry', date: '2026-12-12', days: 6, quiet: 6, limit: 3, email: 'kim@kappa.example', contact: 'Kim Santos' }]),
  winback: [{ client: 'Lambda Corp', last: '2026-02-10', what: 'Lambda Town Hall', email: 'lia@lambda.example', contact: 'Lia' }, { client: 'No Mail Inc', last: '2026-01-05', what: '', email: '', contact: '' }] });
test('SF5 quiet Inquiries and win-back clients with an email get chaser drafts in one ChatGPT call; Approve makes Gmail drafts, never sends', () => {
  const t = sweepBox({ funnel: FUNNEL2 }, null); t.ctx.cueSweep(); const b = batchOf(t);
  assert.strictEqual(t.log.funnel, 1, 'one Canvas read shared by the three kinds'); assert.strictEqual(t.log.funnelArgs[0].winback, true);
  const inq = b.batch.items.filter(i => i.kind === 'inquiry'), wb = b.batch.items.filter(i => i.kind === 'winback');
  deq(inq.map(i => [i.key, i.to, i.send_ok]), [['inq:D-9', 'kim@kappa.example', false]]);
  deq(wb.map(i => [i.key, i.to, i.send_ok]), [['winback:lambdacorp', 'lia@lambda.example', false]]);
  assert.ok(!lines(t).some(i => i.key === 'funnel:D-9'), 'with an email the Inquiry is a draft, not a plain line');
  assert.strictEqual(t.log.gpt.filter(g => g.text.format.name === 'chasers').length, 1, 'one shared ChatGPT call');
  assert.ok(/GPT nudge for Kim Santos about Kappa/.test(inq[0].body) && /GPT nudge for Lia about Lambda Corp/.test(wb[0].body), inq[0].body + ' | ' + wb[0].body);
  t.at('2026-10-21', 9, 30); t.ctx.cueApprove(b.id, { send: true });
  assert.ok(!t.log.sent, 'nothing sent'); assert.ok(t.log.gmail.length >= 2, 'drafts made in Kiko\'s Gmail');
});
test('SF6 without ChatGPT the drafts use the templates: warm, no prices', () => {
  const t = sweepBox({ funnel: FUNNEL2, fail: { chasers: () => ({ getResponseCode: () => 500, getContentText: () => '{}' }) } }, null); t.ctx.cueSweep();
  const it = batchOf(t).batch.items.find(i => i.key === 'inq:D-9'), w = batchOf(t).batch.items.find(i => i.key === 'winback:lambdacorp');
  assert.ok(/^Hi Kim,/.test(it.body) && /Kappa year-end party on 2026-12-12/.test(it.body) && !/₱|price/i.test(it.body), it.body);
  assert.ok(/^Hi Lia,/.test(w.body) && /Lambda Town Hall/.test(w.body), w.body);
});
test('SF7 Monday sales funnel review: one row at Mon 07:00, one funnel + report read, one ChatGPT call, 3 to 5 lines in Cue\'s chat; nothing sent', () => {
  const t = sandbox({ funnel: FUNNEL2, report: { won: 9, lost: 4, rate: 69, months: [], sources: [{ name: 'Referral', won: 5, lost: 1, open: 2, rate: 83 }], clients: [], reasons: [{ name: 'Price', n: 3 }], award: { n: 7, median: 12, avg: 14 } },
    gpt: { funnel_review: { lines: ['Inquiries leak most: 2 are stuck past 3 days.', 'Referral wins 83% of decided deals.', 'Price lost 3 deals; check CE pricing.', 'This week: chase Kappa and Acme.'] } } });
  const o = t.ctx.cueFunnelReview_(false);
  assert.strictEqual(o.lines, 4); assert.strictEqual(t.log.funnel, 1); assert.strictEqual(t.log.report, 1);
  assert.strictEqual(t.log.gpt.filter(g => g.text.format.name === 'funnel_review').length, 1);
  assert.ok(/"Referral"/.test(t.log.gpt[0].input) && !/kim@kappa/.test(t.log.gpt[0].input), 'numbers go to ChatGPT, client emails do not');
  assert.ok(t.tabs.Chat.rows.some(r => /^Monday sales funnel review \(\d{4}-\d{2}-\d{2}\):\n• Inquiries leak most/.test(r[2])));
  assert.ok(!t.log.sent && !(t.log.gmail || []).length);
});
