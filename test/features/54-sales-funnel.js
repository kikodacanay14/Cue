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
  assert.ok(!/amount|ce_no|lost_reason/i.test(src.split('ZB_ACTIONS_.crm_funnel')[1].split('ZB_ACTIONS_.crm_followup')[0]));
});
test('SF4 the cloud check door runs one read-only funnel read and returns the lines; outside a check it refuses', () => {
  const t = checkBox({ funnel: FUNNEL });
  const r = t.call('cueFunnelCheck'); assert.ok(r.ok, r.error);
  deq(r.result.map(i => i.key), ['crmfu:F-1', 'crmfu:F-2', 'funnel:S-1', 'funnel:S-4', 'funnel:D-1']);
  deq(t.log.bridge.map(b => b.action), ['crm_funnel']);
  assert.throws(() => sandbox({ funnel: FUNNEL }).ctx.cueFunnelCheck(), /Only a cloud check/);
});
