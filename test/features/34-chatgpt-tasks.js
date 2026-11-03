// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: chatgpt-tasks.
/* ---------- ChatGPT scheduled tasks (CueGptTasks.gs, Kiko "Go" 22 Oct 00:55Z) ---------- */
function p0Tab(rows) {   // the funnel P0 tab: title rows, headers on row 4, data from row 5
  const f = sheetMock(); f.appendRow(['P0 company master']); f.appendRow(['']); f.appendRow(['note']);
  f.appendRow(['Priority', 'Company', 'Outreach Status', 'First Outreach Date', 'Last Outreach Date', 'Reply Status', 'Next Follow-up Date', 'Known Email Addresses']);
  rows.forEach(r => f.appendRow(r)); return f;
}
const GT_P0 = [['P1', 'Acme Corp', 'Sent', '2026-09-20', '2026-10-01', 'No Reply', '', 'ana@acme.example'],
  ['P1', 'Beta Inc', 'Sent', '2026-10-15', '2026-10-15', 'No Reply', '', ''],
  ['P2', 'Gamma Co', 'Sent', '2026-09-10', '2026-09-10', 'No Reply', '', ''],
  ['P4', 'Delta Ltd', 'Sent', '2026-10-18', '2026-10-18', 'No Reply', '', ''],
  ['P1', 'Accenture', 'Sent', '2026-09-01', '2026-09-01', 'No Reply', '', 'x@accenture.example'],
  ['P1', 'Echo PH', 'Sent', '2026-09-01', '2026-09-01', 'Replied', '', ''],
  ['P3', 'Foxtrot', 'Paused', '', '', '', '', ''],
  ['P3', 'Golf Group', 'Sent', '', '', 'No Reply', '2026-10-21', '']];
const GT_F = (o) => Object.assign({ key: 'acme-followup', group: 'Follow-up', title: 'Follow up Acme proposal', company: 'Acme Corp', person: 'Ana', detail: 'No reply since 1 Oct.',
  evidence: [{ label: 'P0 row 5', url: '' }], next_action: 'Send the follow-up', due: '2026-10-22', email: { to: 'ana@acme.example', subject: 'Following up', body: 'Hi Ana,\nJust checking in.\nKiko' },
  canvas: 'client', project_id: '', confidence: 'high' }, o);
const GT_ANS = { summary: 'Three prospects are due.', coverage: { checked: 'P0 due list and Gmail', not_checked: 'LinkedIn' },
  steps: [1, 2, 3].map(n => ({ step: n, done: true, note: '' })),
  findings: [GT_F(), GT_F({ key: 'gamma', title: 'Second outreach Gamma', company: 'Gamma Co', email: { to: 'guess@gamma.example', subject: 'Hello again', body: 'Hi,\nKiko' } }),
    GT_F({ key: 'delta', title: 'Delta requirements', company: 'Delta Ltd', evidence: [], detail: 'I sent the reminder yesterday.', email: { to: '', subject: '', body: '' }, canvas: 'none' })] };
function gtBox(o = {}) {
  const t = sandbox(Object.assign({ gpt: { gtask: GT_ANS },
    gmailList: q => (/from:acme\.example/.test(q) ? [{ id: 'g1', thread: 't1' }] : []),
    msgs: [{ id: 'g1', thread: 't1', ms: Date.parse('2026-10-02T02:00:00Z'), from: 'Ana <ana@acme.example>', to: 'kiko@example.com', subject: 'Re: proposal', snippet: 'Thanks, will review' }] }, o));
  t.tabs.P0 = p0Tab(o.p0 || GT_P0);
  return t;
}
test('GT1 prospect follow-ups: chat words, no chat call; code picks who is due (P1 15 days, P2 one month, P4 2 days, recorded date; holds, replied, paused out); one ChatGPT call; the process check catches a skipped step, a guessed address, no evidence and a claimed send', () => {
  const t = gtBox(); const r = t.ctx.cueSend('run prospect follow-ups', [], '');
  assert.strictEqual(t.log.gpt.length, 0, 'plain words, no chat call');
  const v = t.ctx.cueRun(r.request_id);
  assert.strictEqual(t.log.gpt.length, 1); assert.ok(!t.log.gpt[0].tools, 'no web search for follow-ups');
  const inp = t.log.gpt[0].input;
  ['Gamma Co', 'Acme Corp', 'Delta Ltd', 'Golf Group'].forEach(c => assert.ok(inp.indexOf(c) >= 0, c + ' is due'));
  ['Beta Inc', 'Accenture', 'Echo PH', 'Foxtrot'].forEach(c => assert.ok(inp.indexOf(c) < 0, c + ' is not due'));
  assert.ok(/P2, one month after first outreach \(2026-10-10\)/.test(inp) && /P4, 2 days after requirements were sent \(2026-10-20\)/.test(inp) && /recorded review date \(2026-10-21\)/.test(inp));
  assert.ok(/Re: proposal/.test(inp), 'the latest email with the company goes to ChatGPT');
  assert.ok(/1\. Take the prospects Cue found due/.test(t.log.gpt[0].instructions), 'the skill steps are the instructions');
  assert.strictEqual(v.kind, 'gtask'); assert.strictEqual(v.status, 'Needs you');
  deq(v.gt.checks.map(c => c.ok), [false, true, false, false, false, true, true], "check 8: P0 and Gmail read");
  assert.ok(/step 4/.test(v.gt.checks[0].detail) && /guess@gamma\.example/.test(v.gt.checks[3].detail));
  const g = v.gt.items.find(f => f.company === 'Gamma Co'); assert.strictEqual(g.email.to, '', 'a guessed address is removed');
  assert.strictEqual(v.gt.items.find(f => f.company === 'Acme Corp').email.to, 'ana@acme.example', 'an address in the records stays');
  assert.ok(/^3 new findings\. Process check: 3 of 7 passed\.$/.test(v.gt.summary), v.gt.summary);
  assert.strictEqual(t.tabs['ChatGPT findings'].rows.length, 4, 'header and three shown findings');
});
test('GT2 only new findings: the same answer next time shows nothing new and the task is Done', () => {
  const t = gtBox(); t.ctx.cueRun(t.ctx.cueSend('run prospect follow-ups', [], '').request_id);
  const v = t.ctx.cueRun(t.ctx.cueSend('prospect follow-ups', [], '').request_id);
  assert.strictEqual(v.status, 'Done'); assert.strictEqual(v.gt.items.length, 0); assert.ok(/^Nothing new \(3 already shown\)/.test(v.gt.summary), v.gt.summary);
});
test('GT3 Kiko\'s taps: Draft email makes a Gmail draft (never sent); the removed HubSpot action is refused and calls nothing', () => {
  const t = gtBox(); const v = t.ctx.cueRun(t.ctx.cueSend('run prospect follow-ups', [], '').request_id);
  const acme = v.gt.items.find(f => f.company === 'Acme Corp');
  const d = t.ctx.cueGtAct(v.id, acme.id, 'draft'); assert.ok(/To: ana@acme\.example/.test(t.log.gmail[0])); assert.ok(d.gt.items.find(f => f.id === acme.id).drafted);
  assert.ok(!(t.log.sent || []).length, 'nothing sent');
  assert.throws(() => t.ctx.cueGtAct(v.id, acme.id, 'hubspot'), /Unknown action/);
  assert.ok(!('hubspot' in acme) && !('in_hubspot' in acme), 'no HubSpot field on a finding');
  assert.ok(acme.canvas && /page=clientdesk/.test(acme.canvas.url), 'company changes open Canvas Accounts');
});
test('GT4 Draft all: one separate draft per email on the card; findings without a body are skipped', () => {
  const t = gtBox(); const v = t.ctx.cueRun(t.ctx.cueSend('run prospect follow-ups', [], '').request_id);
  t.ctx.cueGtDraftAll(v.id); assert.strictEqual(t.log.gmail.length, 2); t.ctx.cueGtDraftAll(v.id); assert.strictEqual(t.log.gmail.length, 2, 'not drafted twice');
});
test('GT5 the scheduler entry runs a task once per Manila day; the rows match Kiko\'s times', () => {
  const t = gtBox(); const a = t.ctx.cueGtScheduled('followups'); assert.ok(a && a.request_id); assert.strictEqual(t.ctx.cueGtScheduled('followups'), null);
  t.ctx.__wait(864e5); assert.ok(t.ctx.cueGtScheduled('followups'));
  const rows = {}; t.ctx.cueGtSchedules_().forEach(x => { rows[x.key] = [x.repeat, x.day_of_month || (x.days || []).join(','), x.time]; });
  deq(rows, { followups: ['weekdays', '', '08:00'], repeat_events: ['monthly', 15, '07:00'], moved_contacts: ['monthly', 16, '09:00'], account_research: ['weekly', 'Tue', '09:00'],
    monthly_email: ['monthly', 15, '16:00'], daily_plan: ['daily', '', '08:00'], admin_suppliers: ['weekly', 'Mon', '09:00'], admin_payments: ['weekly', 'Tue', '09:00'],
    admin_projects: ['weekly', 'Wed', '09:00'], admin_funnel: ['weekly', 'Thu', '09:00'], production_readiness: ['weekly', 'Fri', '09:00'], personal_spending: ['daily', '', '19:00'] });
  assert.throws(() => t.ctx.cueGtScheduled('nope'), /No ChatGPT task/);
});
test('GT6 chat words start the right task and leave other commands alone', () => {
  const t = gtBox(); const k = x => t.ctx.cueGtAsked_(x);
  deq(['plan my day', 'run the repeat event review', 'moved contacts', 'account research', 'monthly engagement email', 'prospecting for BPO companies', 'find contacts at Concentrix',
    'supplier files review', 'reconcile payments', 'project records review', 'funnel review', 'friday readiness', 'personal spending report'].map(k),
    ['daily_plan', 'repeat_events', 'moved_contacts', 'account_research', 'monthly_email', 'prospecting', 'contact_research', 'admin_suppliers', 'admin_payments', 'admin_projects', 'admin_funnel', 'production_readiness', 'personal_spending']);
  ['how\'s the pipeline?', 'is JBL booth ready?', 'check bids', 'record personal expense 500 Jollibee', 'LED wall for AMI Group', 'who do I need to chase'].forEach(x => assert.strictEqual(k(x), '', x));
});
test('GT7 Friday readiness: only For Production Start and For Event Execution projects, Canvas checklist for each; an unrated project fails the check', () => {
  const t = gtBox({ projects: [{ id: 'S-10000001AA', name: 'Acme Gala', status: 'For Production Start', eventDate: '2026-10-30' }, { id: 'S-10000002BB', name: 'Beta Launch', status: 'For Event Execution', eventDate: '2026-10-24' },
    { id: 'S-10000003CC', name: 'Gamma Party', status: 'For Client Awarding' }],
    gpt: { gtask: { summary: 'One at risk.', coverage: { checked: 'Canvas checklists', not_checked: 'none' }, steps: [1, 2, 3, 4, 5].map(n => ({ step: n, done: true, note: '' })),
      findings: [GT_F({ key: 'acme-gala', group: 'At Risk', title: 'Acme Gala: supplier not confirmed', company: 'Acme Corp', project_id: 'S-10000001AA', canvas: 'project', email: { to: '', subject: '', body: '' } })] } } });
  const v = t.ctx.cueRun(t.ctx.cueSend('friday readiness', [], '').request_id);
  deq(t.log.bridge.filter(b => b.action === 'get_readiness').map(b => b.project_id), ['S-10000001AA', 'S-10000002BB']);
  assert.ok(t.log.gpt[0].input.indexOf('Gamma Party') < 0);
  const c7 = v.gt.checks.find(c => c.id === 7); assert.ok(!c7.ok && /S-10000002BB Beta Launch/.test(c7.detail), JSON.stringify(c7));
  assert.ok(/page=canvas&project=S-10000001AA/.test(v.gt.items[0].canvas.url));
});
test('GT8 web search is on for research tasks; an unreadable records tab is a note, not a stop; ChatGPT failing stops the task with Try again', () => {
  const t = gtBox(); const v = t.ctx.cueRun(t.ctx.cueSend('account research', [], '').request_id);
  assert.ok(t.log.gpt[0].tools && t.log.gpt[0].tools[0].type === 'web_search'); assert.ok(v.notes.some(x => /P0 Contacts/.test(x)), 'P0 Contacts tab missing is a note');
  const c8 = v.gt.checks.find(c => c.id === 8); assert.ok(!c8.ok && /P0 Contacts/.test(c8.detail), 'a failed read fails the check: ' + JSON.stringify(c8));
  assert.ok(/^Incomplete: 1 record could not be read\./.test(v.gt.summary), v.gt.summary); assert.strictEqual(v.status, 'Needs you', 'an incomplete run is never Done');
  const f = gtBox({ fail: { gtask: () => resp(500, {}) } }); const w = f.ctx.cueRun(f.ctx.cueSend('account research', [], '').request_id);
  assert.strictEqual(w.status, 'Failed'); assert.ok(/ChatGPT could not run it/.test(w.error));
});
test('GT12 bug 27 Oct: no bank, account number, TIN or signature cell from a records tab reaches ChatGPT; account and owner columns stay', () => {
  const t = gtBox();
  const line = t.ctx.cueGtLine_('Supplier Database', { _row: 2, 'Supplier': 'Z&Z Events', 'Main Service': 'Mobile Bar', 'Bank': 'BPI', 'Account Name': 'Ma Ocampo',
    'AccountNumber': '4059494908', 'TIN': '345-232-386-00000', 'TIN Status': 'Non-Vat Registered', 'Bank Account No.': '123', 'IBAN': 'X1', 'E-signature': 'sig.png', 'Password': 'p' });
  assert.ok(/Supplier: Z&Z Events/.test(line) && /Main Service: Mobile Bar/.test(line), line);
  ['BPI', 'Ma Ocampo', '4059494908', '345-232-386', 'Non-Vat', '123', 'X1', 'sig.png', 'Password'].forEach(x => assert.ok(line.indexOf(x) < 0, x + ' must not reach ChatGPT: ' + line));
  const p = t.ctx.cueGtLine_('Admin Directory', { _row: 3, 'ACCOUNT': 'ING', 'ACCOUNT OWNER': 'Kiko Dacanay', 'Account Status': 'Active' });
  assert.ok(/ACCOUNT: ING/.test(p) && /ACCOUNT OWNER: Kiko Dacanay/.test(p) && /Account Status: Active/.test(p), p);
});
