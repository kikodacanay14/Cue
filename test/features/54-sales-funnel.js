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
test('SF5 C2 They went quiet (31 Oct): a quiet Inquiry with an email gets Kiko\'s C2 follow-up from his Gmail, no AI call; win-back is gone', () => {
  const t = sweepBox({ funnel: FUNNEL2 }, null); t.ctx.cueSweep(); const b = batchOf(t);
  assert.strictEqual(t.log.funnel, 1, 'one Canvas read shared by the kinds'); assert.strictEqual(t.log.funnelArgs[0].winback, true);
  const inq = b.batch.items.filter(i => i.kind === 'inquiry');
  deq(inq.map(i => [i.key, i.to, i.send_ok, i.label]), [['inq:D-9', 'kim@kappa.example', true, 'C2 They went quiet']]);
  assert.ok(!b.batch.items.some(i => i.kind === 'winback'), 'win-back dropped from the message map');
  assert.ok(!lines(t).some(i => i.key === 'funnel:D-9'), 'with an email the Inquiry is a follow-up, not a plain line');
  assert.strictEqual(t.log.gpt.filter(g => g.text.format.name === 'chasers').length, 0, 'no AI call');
  t.at('2026-10-21', 9, 30); t.ctx.cueApprove(b.id, { send: true });
  assert.ok(t.log.gmail.length >= 1, 'goes from Kiko\'s Gmail once approved');
});
test('SF6 the C2 wording: first follow-up, then the final one; client banner, Kiko\'s sign-off, no prices', () => {
  const t = sweepBox({ funnel: FUNNEL2 }, null); t.ctx.cueSweep();
  const it = t.state(batchOf(t).id).batch.items.find(i => i.key === 'inq:D-9');
  assert.ok(/^Hi Kim,\n\nPicking up my note—I’d love to hear what Kappa is planning\./.test(it.body) && !/₱|price/i.test(it.body), it.body);
  assert.ok(/\nThanks!\nKiko Dacanay\nBlank Space Events$/.test(it.body) && /background:#559FEF/.test(it.html));
  const fin = t.ctx.cueTplC2_(Object.assign({}, it, { times: 1 }));
  assert.ok(/I’ll leave the door open for now\. When the next event idea comes along at Kappa/.test(fin.body), fin.body);
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

// CUE-FUNNEL (Kiko 24 Oct 13:56Z, spec sales-funnel-tasks.md), moved here from 06-pipeline-review.js when the pipeline review and HubSpot
// were removed (HUBSPOT-REMOVAL-2026-11-01, Kiko 1 Nov 2026: "Delete the Hubspot code"). The funnel reads Canvas only, with no AI call.
const FN_CANVAS = { today: '2026-10-21', limits: {}, steps: [{ step: 'Inquiry', count: 4, stuck: 1, limit: 3 }, { step: 'CE sent', count: 1, stuck: 0, limit: 10 },
  { step: 'Won', count: 1, stuck: 0 }, { step: 'Delivered', count: 0, stuck: 0, limit: 30 }, { step: 'Paid', count: 2, stuck: 0 }], stuck: [], due: [] };
const fnRun = (o = {}) => { const t = sandbox(Object.assign({ funnel: FN_CANVAS }, o)); const id = t.ctx.cueSend(o.say || 'show the sales funnel').request_id; return { t, id, v: t.ctx.cueRun(id) }; };
test('FN1 funnel: chat words start it with no AI call; Canvas\'s steps counted, the award step named; Canvas reads only', () => {
  const { t, id, v } = fnRun();
  assert.strictEqual(v.kind, 'funnel'); assert.strictEqual(v.status, 'Needs you', v.error);
  assert.strictEqual(t.log.gpt.length + t.log.claude.length, 0, 'no AI call'); assert.strictEqual(v.metrics.ai_calls, 0);
  deq(v.fn.stages.map(x => [x.label, x.kind, x.n, x.stuck]), [['Inquiry', 'open', 4, 1], ['CE sent', 'open', 1, 0], ['Won', 'won', 1, 0], ['Delivered', 'won', 0, 0], ['Paid', 'won', 2, 0]]);
  deq([v.fn.src, v.fn.title, v.fn.wait.label, v.fn.wait.n], ['canvas', 'Sales funnel', 'CE sent', 1]);
  assert.strictEqual(v.fn.line, '4 Inquiry (1 stuck) · 1 CE sent · 1 Won · 2 Paid');
  assert.strictEqual(t.log.funnel, 1, 'one crm_funnel read');
  assert.ok(!('tasks' in v.fn) && !('deals' in v.fn) && !('task_error' in v.fn), 'no task list');
  assert.ok(t.tabs.Chat.rows.some(x => x[3] === '>' + id && /^Reading Canvas's P0 to P9 accounts and its deals in its own thread\./.test(x[2])), 'pointer in the main chat');
  ['funnel', 'show the sales funnel'].forEach(w => assert.ok(t.ctx.cueFunnelAsked_(w), w));
  ['funnel review', 'review the funnel', 'my hubspot tasks', 'clean up hubspot', 'how is the pipeline'].forEach(w => assert.ok(!t.ctx.cueFunnelAsked_(w), w));
});
test('FN3 Today card: one funnel run gives one row pointing at its thread; a newer run closes the older one; the Done line lists it once', () => {
  const { t, id, v } = fnRun();
  const T = t.ctx.cueTodayFrom_([v], '2026-10-21');
  deq(T.rows.map(r => [r.eyebrow, r.title, r.button, r.thread]), [['Sales update · from Canvas Accounts', '1 deal waiting for award', 'Open update', id + '#fn-' + id]]);
  t.ctx.__wait(60000); const id2 = t.ctx.cueSend('show the funnel').request_id; t.ctx.cueRun(id2);
  assert.strictEqual(t.state(id).status, 'Closed', 'the older snapshot closes'); assert.strictEqual(t.state(id2).status, 'Needs you');
  const done = n => Object.assign({}, v, { id: 'f' + n, status: 'Done', created: '2026-10-21T0' + n + ':00:00Z' });
  const D = t.ctx.cueTodayFrom_([done(1), done(2), done(3)], '2026-10-21');
  assert.strictEqual((D.done.match(/sales funnel/g) || []).length, 1, D.done);
  assert.strictEqual(t.ctx.cueFunnelDone(id2).status, 'Done', 'Done closes it; nothing is written');
});
test('FN5 the daily row starts one funnel a day; the page draws it with no task list and no Mark done', () => {
  const t = sandbox(); t.ctx.cueSchedules();   // seeds the rows, as opening Settings does
  t.ctx.__wait(phMs('2026-10-22', '13:16') - Date.parse('2026-10-21T03:00:00Z')); for (let i = 0; i < 6; i++) t.ctx.cueResume();
  const f = t.tabs.Requests.rows.slice(1).map(r => t.state(r[0])).filter(s => s.kind === 'funnel');
  assert.strictEqual(f.length, 1); assert.strictEqual(f[0].how, 'daily'); assert.strictEqual(t.props.CUE_FUNNEL_DAY, '2026-10-22');
  const html = cuePage(), card = html.slice(html.indexOf('function funnelCardHtml(r)'), html.indexOf('// CUE-AR (Kiko 07:42Z)'));
  assert.ok(card.length > 100 && /id="fn-' \+ esc\(r\.id\)/.test(card), 'the card carries the spot the Today row names');
  assert.ok(!/fn-task|cueFunnelTaskDone|hst:|Mark done/.test(html), 'no task list, tasks tab or Mark done on the page');
});
