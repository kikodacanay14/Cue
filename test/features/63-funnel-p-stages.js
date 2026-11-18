// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: funnel-p-stages.
// CRM-P-STAGES-2026-10-29 (Kiko 29 Oct 15:59Z "can you align the Sales Funnel in Ask Cue with the latest that we did"): the Sales
// funnel card, its Today row and the Monday review read the P0 to P9 stages and count them as Canvas's Accounts dashboard does.
const FP_COLS = ['Priority', 'Company', 'Contact Count', 'Last Outreach Date', 'Reply Status'];
const FP_ROWS = [
  { _row: 5, Priority: 'P0', Company: 'Carelon', 'Contact Count': '0', 'Last Outreach Date': '', 'Reply Status': '' },
  { _row: 6, Priority: 'P0', Company: 'Dexcom', 'Contact Count': '2', 'Last Outreach Date': '', 'Reply Status': '' },
  // P1 and P2: 3 business days since the last email and no reply = a follow-up email due (Mon 26 Oct to Thu 29 Oct = 3). The sandbox day is Wed 21 Oct.
  { _row: 7, Priority: 'P1', Company: 'VXI', 'Contact Count': '4', 'Last Outreach Date': '10/26/2026', 'Reply Status': 'No reply' },
  { _row: 8, Priority: 'P1', Company: 'ResultsCX', 'Contact Count': '3', 'Last Outreach Date': '2026-10-27', 'Reply Status': '' },
  { _row: 9, Priority: 'P2', Company: 'EMAPTA', 'Contact Count': '5', 'Last Outreach Date': '2026-10-20', 'Reply Status': 'Replied' },
  { _row: 10, Priority: 'P2', Company: 'QBE', 'Contact Count': '2', 'Last Outreach Date': '2026-10-12', 'Reply Status': '' },
  { _row: 11, Priority: 'P3', Company: 'SVEN Group', 'Contact Count': '1', 'Last Outreach Date': '2026-10-01', 'Reply Status': '' },
  { _row: 12, Priority: 'P4', Company: 'Concentrix', 'Contact Count': '2', 'Last Outreach Date': '', 'Reply Status': '' },
  { _row: 13, Priority: 'P6', Company: 'Probe Group', 'Contact Count': '3', 'Last Outreach Date': '', 'Reply Status': '' },
  { _row: 14, Priority: 'P7', Company: 'DKT Health', 'Contact Count': '1', 'Last Outreach Date': '', 'Reply Status': '' },
  { _row: 15, Priority: 'P9', Company: 'Account F', 'Contact Count': '1', 'Last Outreach Date': '', 'Reply Status': '' },
  { _row: 16, Priority: 'P-1', Company: 'Old row', 'Contact Count': '1', 'Last Outreach Date': '', 'Reply Status': '' },
  { _row: 17, Priority: 'P5', Company: '', 'Contact Count': '1', 'Last Outreach Date': '', 'Reply Status': '' }];
const FP_ALLOW = [{ book: 'priority', tab: 'P0', key: '', mode: 'read', columns: FP_COLS, writable: [], rows: FP_ROWS }];

test('FP1 P stages counted as the dashboard does: companies per P0 to P9, contacts for P1 to P3, follow-up emails due, P4, P8 and P9', () => {
  const { ctx } = sandbox();
  const P = ctx.cueFunnelP_(FP_ROWS, '2026-10-29');
  deq(P.stages.map(x => [x.p, x.n]), [['P0', 2], ['P1', 2], ['P2', 2], ['P3', 1], ['P4', 1], ['P5', 0], ['P6', 1], ['P7', 1], ['P8', 0], ['P9', 1]], 'no company or no P0 to P9 stage: left out');
  deq(P.stages.slice(0, 4).map(x => x.label), ['Prospecting / validation', 'Intro email sent', 'Following up every 3 business days', 'Parking lot'], 'Canvas\'s own stage names');
  deq([P.outreach, P.due, P.p4, P.risk, P.total], [14, 2, 1, 1, 11]);
  assert.strictEqual(ctx.cueFunnelP_(FP_ROWS, '2026-10-28').due, 1, 'VXI is only 2 business days old on Wed; QBE is due');
  assert.strictEqual(ctx.cueFunnelP_([], '2026-10-29').total, 0);
});

test('FP2 the funnel run reads the P0 tab once through Canvas\'s read_rows: the update lines, its Today row and its chat post; nothing is written', () => {
  const { t, id, v } = fnRun({ allow: FP_ALLOW });
  assert.strictEqual(v.status, 'Needs you', v.error); deq(v.notes || [], []);
  deq(t.log.readRows.filter(a => a.tab === 'P0').length, 1, 'one P0 read: ' + JSON.stringify(t.log.readRows)); assert.strictEqual(t.log.funnel, 1);
  assert.ok(t.log.bridge.every(b => ['allow_list', 'read_rows', 'crm_funnel'].includes(b.action)), 'Canvas reads only');
  // On the sandbox day (Wed 21 Oct) only QBE (P2, last email Mon 12 Oct) is due; VXI's and ResultsCX's emails are later.
  deq([v.fn.p.due, v.fn.p.outreach, v.fn.p.p4, v.fn.p.risk], [1, 14, 1, 1]);
  assert.strictEqual(v.fn.line, 'P0 2 · P1 2 · P2 2 · P3 1 · P4 1 · P6 1 · P7 1 · P9 1 · deals: 4 Inquiry (1 stuck) · 1 CE sent · 1 Won · 2 Paid');
  assert.strictEqual(v.fn.title, 'Sales funnel');
  // CRM-UPDATES-2026-10-29: the first run has nothing to compare, so it gives the due and award lines.
  deq(v.fn.lines, ['1 follow-up email due (P1 and P2, 3 business days with no reply).', '1 deal waiting for award.', '1 project at risk or escalated: Account F (P9).']);
  const T = t.ctx.cueTodayFrom_([v], '2026-10-21');
  deq([T.rows[0].eyebrow, T.rows[0].title, T.rows[0].detail, T.rows[0].button, T.rows[0].thread], ['Sales update · from Canvas Accounts', '1 follow-up email due (P1 and P2, 3 business days with no reply)',
    '1 deal waiting for award. 1 project at risk or escalated: Account F (P9).', 'Open update', id + '#fn-' + id]);
  assert.ok(/\/exec\?page=clientdesk$/.test(v.fn.accounts_url), v.fn.accounts_url);
  assert.ok(t.tabs.Chat.rows.some(x => x[3] === id && /^The sales funnel check of Canvas's P0 to P9 accounts found 1 follow-up email due \(P1 and P2, 3 business days with no reply\), plus 2 more points on the card below\.$/.test(x[2])), 'the update is posted in its thread');
  assert.strictEqual(T.rows.length, 1, 'one row: the update (HUBSPOT-REMOVAL-2026-11-01: no task row)');
  assert.ok(t.tabs.Chat.rows.some(x => x[3] === '>' + id && /P0 to P9 accounts/.test(x[2])));
});

test('FP3 an unreadable P0 tab is a note; the deal track still shows as before', () => {
  const { t, v } = fnRun({ allow: [{ book: 'priority', tab: 'P0', key: '', mode: 'read', columns: FP_COLS, writable: [], rows: [] }] });
  assert.strictEqual(v.fn.p.total, 0, 'an empty tab reads as zero');
  const r = fnRun({ allow: [] });
  assert.ok((r.v.notes || []).some(n => /Could not read the P0 to P9 accounts/.test(n)), JSON.stringify(r.v.notes));
  assert.strictEqual(r.v.fn.p, null); assert.strictEqual(r.v.fn.line, '4 Inquiry (1 stuck) · 1 CE sent · 1 Won · 2 Paid');
  deq(r.t.ctx.cueTodayFrom_([r.v], '2026-10-21').rows[0].title, '1 deal waiting for award');
  assert.ok(t.log.readRows.some(a => a.tab === 'P0'));
});

test('FP4 the page draws an update: plain lines and Open Accounts in Canvas, never the dashboard', () => {
  const html = cuePage(), card = html.slice(html.indexOf('function funnelCardHtml(r)'), html.indexOf('// CUE-AR (Kiko 07:42Z)'));
  // CRM-UPDATES-2026-10-29 (Kiko 16:13Z): updates, not a dashboard: plain lines and a link to Accounts, no cards, bars or tables.
  ['Sales update · from Canvas Accounts', 'Open Accounts in Canvas', 'F.lines'].forEach(w => assert.ok(card.indexOf(w) >= 0, w));
  ['In outreach', 'Accounts by P stage', 'Deals · P6 and P7', '<table'].forEach(w => assert.ok(card.indexOf(w) < 0, w));
});

test('FP5 the Monday review gives ChatGPT the P stages and the dashboard counts, never a client email', () => {
  const t = sandbox({ allow: FP_ALLOW, funnel: FN_CANVAS, report: { won: 1, lost: 0, months: [], sources: [], clients: [], reasons: [] },
    gpt: { funnel_review: { lines: ['P1 and P2 have 2 follow-up emails due.', 'Inquiries leak most.', 'This week: chase QBE and VXI.'] } } });
  const o = t.ctx.cueFunnelReview_(false);
  assert.strictEqual(o.lines, 3);
  const data = JSON.parse(t.log.gpt[0].input.match(/\{[\s\S]*\}/)[0]);
  deq(data.p_stages.map(x => [x.stage, x.companies]).slice(0, 3), [['P0', 2], ['P1', 2], ['P2', 2]]);
  deq(data.dashboard, { contacts_in_outreach: 14, follow_up_emails_due: 1, accreditations_open: 1, projects_at_risk: 1 });
  assert.ok(/P0 to P9 stage/.test(t.log.gpt[0].instructions || JSON.stringify(t.log.gpt[0])));
});

test('FP6 the next run says what moved since the last one, and new companies on the list', () => {
  const { t, v } = fnRun({ allow: FP_ALLOW });
  const rows = FP_ROWS.map(r => Object.assign({}, r));
  rows.find(r => r.Company === 'VXI').Priority = 'P4'; rows.find(r => r.Company === 'QBE').Priority = 'P3';
  rows.push({ _row: 18, Priority: 'P0', Company: 'Grab', 'Contact Count': '0', 'Last Outreach Date': '', 'Reply Status': '' });
  FP_ALLOW[0].rows = rows;
  try {
    t.ctx.__wait(864e5); const id2 = t.ctx.cueSend('show the funnel').request_id, v2 = t.ctx.cueRun(id2);
    deq(v2.fn.lines.slice(0, 2), ['2 companies moved: VXI P1 to P4, QBE P2 to P3.', '1 new company on the list: Grab (P0).']);
    assert.ok(v.fn.lines.every(x => !/moved/.test(x)), 'the first run has nothing to compare');
  } finally { FP_ALLOW[0].rows = FP_ROWS; }
  const { ctx } = sandbox();
  deq(ctx.cueFunnelUpdate_({ moves: [], wait: {} }), ['No P stage changes since the last update.']);
  deq(ctx.cueFunnelUpdate_({ wait: {} }), ['Nothing new in Accounts today.']);
});
