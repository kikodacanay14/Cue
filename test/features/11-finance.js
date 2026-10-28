// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: finance.
test('F1 CFO quick question (Kiko 07:38Z): one Claude call, no GPT, Canvas read once, answered in its own money thread', () => {
  const t = sandbox(), r = t.ctx.cueSend('How much did we make on Acme Gala?');
  assert.strictEqual(r.chat, true); assert.ok(/₱59,500/.test(r.reply), r.reply);
  assert.strictEqual(t.log.claude.length, 1); assert.strictEqual(t.log.gpt.length, 0);
  deq(t.log.bridge.map(b => b.action), ['finance_snapshot']); deq(t.log.snapArgs, {});
  const st = t.state(r.task); assert.strictEqual(st.kind, 'finance'); assert.strictEqual(st.status, 'Done'); assert.strictEqual(st.metrics.ai_calls, 1);
  assert.strictEqual(st.fin.checked, 'ok'); assert.strictEqual(st.fin.title, 'Money: Acme Gala');
  const p = st.fin.tables.projects[0]; deq([p.name, p.billed, p.cost, p.contribution, p.margin, p.on], ['Acme Gala', 112000, 52500, 59500, 53.1, 'billed']);
  const facts = JSON.parse(t.log.claude[0].messages[0].content.split('FACTS:\n')[1].split('\n<question>')[0]);
  assert.strictEqual(facts.projects.length, 1, 'only the project asked about'); assert.strictEqual(facts.totals.contribution, '₱59,500');
  assert.ok(/not VAT-registered/.test(t.log.claude[0].system) && /never state a rate/.test(t.log.claude[0].system));
  const chat = t.tabs.Chat.rows.slice(1).map(x => [x[1], x[3]]);
  deq(chat, [['Kiko', ''], ['Cue', '>' + r.task], ['Kiko', r.task], ['Cue', r.task]]);
  const v = t.ctx.cueState().requests[0]; assert.strictEqual(v.fin.answer, FIN_ANSWER.answer); assert.strictEqual(v.kind, 'finance');
});

test('F2 number check: an amount Claude made up drops its text; the tables still show', () => {
  const t = sandbox({ fin: Object.assign({}, FIN_ANSWER, { answer: 'You made ₱1,000,000 on Acme Gala, about 60%.' }) }), r = t.ctx.cueSend('profit on Acme Gala?');
  const st = t.state(r.task); assert.strictEqual(st.fin.answer, ''); assert.ok(/^failed: /.test(st.fin.checked) && /1,000,000/.test(st.fin.checked) && /60%/.test(st.fin.checked), st.fin.checked);
  assert.ok(/failed the number check/.test(r.reply)); assert.strictEqual(st.fin.tables.projects.length, 1);
  const ok = t.ctx.cueFinCheck_({ answer: '3 projects, 45 days late, in 2026: ₱62,000 open and 53.1% margin', points: [] }, { a: '₱62,000', b: '53.1%' }, []);
  assert.strictEqual(ok.ok, true, JSON.stringify(ok.bad));
  assert.strictEqual(t.ctx.cueFinCheck_({ answer: 'about ₱62k', points: [] }, { a: '₱62,000' }, []).ok, true, 'shorthand within 1%');
  assert.strictEqual(t.ctx.cueFinCheck_({ answer: 'about ₱70k', points: [] }, { a: '₱62,000' }, []).ok, false);
});

test('F3 settings by chat: no AI call and no Canvas read; the next answer uses them', () => {
  const t = sandbox(), r = t.ctx.cueSend('cash on hand is 1.25M');
  assert.ok(/₱1,250,000/.test(r.reply)); assert.strictEqual(t.props.CUE_FIN_CASH, '1250000'); assert.strictEqual(t.props.CUE_FIN_CASH_DATE, '2026-10-21');
  t.ctx.cueSend('overhead is 300k a month'); t.ctx.cueSend('minimum margin 25%'); t.ctx.cueSend('set cash buffer to 500,000');
  deq([t.props.CUE_FIN_OVERHEAD, t.props.CUE_FIN_MIN_MARGIN, t.props.CUE_FIN_BUFFER], ['300000', '25', '500000']);
  assert.strictEqual(t.log.claude.length + t.log.gpt.length + t.log.bridge.length, 0);
  assert.strictEqual(t.tabs.Requests.rows.length, 1, 'no task made');
  assert.throws(() => t.ctx.cueFinSave({ min_margin: 140 }), /0 to 100/);
});

test('F4 the maths: aging, payables past due, 13 weeks from cash on hand, the buffer, break-even and the missing list', () => {
  const t = sandbox({ props: { CUE_FIN_CASH: '100000', CUE_FIN_CASH_DATE: '2026-10-21', CUE_FIN_OVERHEAD: '130000', CUE_FIN_BUFFER: '50000' } });
  const m = JSON.parse(JSON.stringify(t.ctx.cueFinMath_(SNAP.projects, t.ctx.cueFinSettings_(), '2026-10-21')));
  deq(m.ar.map(x => [x.bi, x.open, x.due, x.days_late]), [['101', 62000, '2026-10-25', 0]]);
  deq(m.buckets, { current: 62000, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 });
  deq(m.ap.map(x => [x.supplier, x.open, x.due]), [['Sonic Pro', 25000, '2026-10-01'], ['Stage Co', 40000, '2026-11-10']]);
  assert.strictEqual(m.weeks[0].week, '2026-10-19'); assert.strictEqual(m.weeks[0].suppliers, 25000, 'past-due payable lands this week');
  assert.strictEqual(m.weeks[0].collections, 62000); assert.strictEqual(m.weeks[0].overhead, 30000);
  assert.strictEqual(m.weeks[0].closing, 100000 + 62000 - 25000 - 30000);
  assert.ok(m.weeks.some(w => w.expected_billings === 200000), 'Beta Launch billed after the event, paid on assumed terms');
  assert.ok(m.flags.some(f => /under the ₱50,000 buffer/.test(f)), m.flags.join(' | ')); assert.ok(m.flags.some(f => /past their date/.test(f)));
  deq(m.company, { overhead_month: 130000, break_even_billings_month: m.company.break_even_billings_month });
  assert.ok(m.company.break_even_billings_month > 130000);
  assert.ok(m.missing.some(x => /no payment terms/.test(x)) === false, 'Beta has no billings yet, so its terms are not counted as assumed');
  assert.ok(m.missing.some(x => /not billed yet are an estimate/.test(x)));
  const none = JSON.parse(JSON.stringify(t.ctx.cueFinMath_([], { min_margin: 20, cash: null, overhead: null, buffer: null }, '2026-10-21')));
  assert.ok(none.missing.some(x => /Cash on hand is not set/.test(x)) && none.missing.some(x => /No Canvas projects/.test(x)));
});

test('F5 a decision that needs outside prices: Claude asks, GPT researches, Claude answers (3 calls); outside numbers pass the check', () => {
  const ask = Object.assign({}, FIN_ANSWER, { answer: '', points: [], needs_outside_facts: 'Daily rental price of a 10 kVA generator in Metro Manila' });
  const fin = Object.assign({}, FIN_ANSWER, { answer: 'Renting at ₱6,500 a day beats buying for now; Acme Gala made ₱59,500.' });
  const t = sandbox({ fin: [ask, fin] }), r = t.ctx.cueSend('Should we buy a generator or keep renting? Look at our cash.');
  const st = t.state(r.task); assert.strictEqual(st.metrics.ai_calls, 3); assert.strictEqual(t.log.gpt.length, 1);
  assert.ok(t.log.gpt[0].tools && /generator/.test(t.log.gpt[0].input)); assert.strictEqual(st.fin.checked, 'ok'); assert.strictEqual(st.fin.outside.length, 1);
  assert.ok(/needs_outside_facts must be empty/.test(t.log.claude[1].messages[0].content));
});

test('F6 a wrong guess costs nothing extra: not a money question = a chat reply, no thread; Canvas threads keep their own chat', () => {
  const t = sandbox({ fin: { answer: '', points: [], needs_outside_facts: '', not_money: true, chat_reply: 'Ha, no cash talk needed. What do you need?' } });
  const r = t.ctx.cueSend('my cash register app is weird lol');
  assert.strictEqual(r.reply, 'Ha, no cash talk needed. What do you need?'); assert.strictEqual(t.tabs.Requests.rows.length, 1, 'no task');
  assert.strictEqual(t.log.claude.length, 1); assert.strictEqual(t.log.gpt.length, 0);
  deq(t.tabs.Chat.rows.slice(1).map(x => [x[1], x[3]]), [['Kiko', ''], ['Cue', '']]);
  const u = startToCard(), before = u.log.claude.length; u.ctx.cueSend('what is the margin on this one?', [], '', u.id);
  assert.strictEqual(u.log.claude.length, before, 'a reply in an intake thread is chat, not a money run');
});

test('F7 follow-up in a money thread keeps the projects (Canvas gets their ids); a period narrows by event date; intakes never join money threads', () => {
  const t = sandbox(), r = t.ctx.cueSend('How much did we make on Acme Gala?'), r2 = t.ctx.cueSend('and what do they still owe?', [], '', r.task);
  deq(t.log.snapArgs, { project_ids: ['S-10000001AA'] }); assert.strictEqual(t.state(r2.task).ref, r.task);
  assert.ok(t.ctx.cueState().chat.filter(m => m.request_id === r2.task).length === 2);
  const p = t.ctx.cueFinPick_(SNAP.projects, t.ctx.cueFinScope_('profit for events in November 2026', null));
  deq(p.projects.map(x => x.id), ['S-20000002BB']); assert.ok(/November 2026/.test(p.label));
  const two = SNAP.projects.concat([Object.assign({}, SNAP.projects[0], { id: 'S-30000003CC', name: 'Acme Summit', date: '2026-12-01' })]);
  const a = t.ctx.cueFinPick_(two, t.ctx.cueFinScope_('how much does Acme owe us?', null)); deq([a.projects.length, a.label], [2, 'Acme Corp']);
  const g = t.ctx.cueFinPick_(two, t.ctx.cueFinScope_('margin on the Acme Gala', null)); deq([g.projects.map(x => x.id), g.label], [['S-10000001AA'], 'Acme Gala']);
  deq(t.ctx.cueFinPick_(two, t.ctx.cueFinScope_('cash flow for the next 13 weeks', null)).projects.length, 3);
  deq(JSON.parse(JSON.stringify(t.ctx.cueFinPeriod_('Q4', '2026-10-21'))), { from: '2026-10-01', to: '2026-12-31', label: 'Q4 2026' });
  deq(JSON.parse(JSON.stringify(t.ctx.cueFinPeriod_('last month', '2026-01-10'))), { from: '2025-12-01', to: '2025-12-31', label: 'last month' });
  assert.strictEqual(t.ctx.cueRelated_('Acme Gala new inquiry for an LED wall', '', ''), '', 'the money thread does not capture an intake');
  assert.strictEqual(t.ctx.cueFinAsk_(INQ), false); assert.strictEqual(t.ctx.cueFinAsk_('who owes us money?'), true);
});

test('F8 Canvas down: the thread says so plainly, nothing made up, no AI call', () => {
  const t = sandbox({ snap: null }); t.opts.snap = undefined;
  const u = sandbox(); u.ctx.cueBridge_ = () => { throw new Error('Canvas refused finance_snapshot (Blocked): unknown action'); };
  const r = u.ctx.cueSend('cash flow next 13 weeks?');
  assert.ok(/could not get the numbers: Canvas refused/.test(r.reply)); assert.strictEqual(u.state(r.task).status, 'Failed');
  assert.strictEqual(u.log.claude.length, 0); assert.throws(() => u.ctx.cueRetry(r.task), /Ask the money question again/);
});

test('F9 Save as Sheet: four tabs, contribution, margin and closing cash as formulas, link kept on the answer', () => {
  const t = sandbox(), r = t.ctx.cueSend('profit on Acme Gala?'), made = {};
  t.ctx.SpreadsheetApp.create = name => { made.name = name; const tabs = [{ getName: () => 'Sheet1' }];
    return { getUrl: () => 'https://docs.google.com/spreadsheets/d/X', getSheets: () => tabs, deleteSheet: () => { made.deleted = 1; },
      insertSheet: n => { const sh = { n, rows: {}, getName: () => n, setFrozenRows: () => {}, getRange: (r0, c, nr, nc) => ({ setValues: v => { v.forEach((row, i) => { sh.rows[r0 + i] = row; }); } }) };
        made[n] = sh; tabs.push(sh); return sh; } }; };
  const o = t.ctx.cueFinSheet(r.task);
  assert.strictEqual(o.url, 'https://docs.google.com/spreadsheets/d/X'); assert.ok(/^Cue · Money: Acme Gala · /.test(made.name)); assert.strictEqual(made.deleted, 1);
  assert.strictEqual(made.Projects.rows[2][7], '=IF(E2>0,E2,D2)-G2'); assert.strictEqual(made['Cash 13 weeks'].rows[3][6], '=G2+F3');
  assert.strictEqual(t.state(r.task).fin.sheet_url, o.url);
});
