// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: pipeline-review.
test('P1 pipeline review (C11): chat routes it, HubSpot + Gmail read in code, rules flag, one Claude call, card waits for Kiko; nothing written', () => {
  const t = pipeToCard(), v = t.v;
  assert.strictEqual(v.status, 'Needs you', v.error); assert.strictEqual(v.kind, 'pipeline'); assert.strictEqual(v.metrics.ai_calls, 1, 'one Claude call in the run');
  assert.strictEqual(t.log.claude.length, 1); assert.strictEqual(t.log.gpt.length, 1, 'only the chat call'); assert.strictEqual(t.log.bridge.filter(b => b.action !== 'search_projects').length, 0, 'Canvas untouched'); deq(t.log.search || [], [], 'the chat lookup, also a read');
  assert.ok(t.log.hs.every(c => c.method === 'get' || /\/search$|\/batch\/read$/.test(c.path)), 'HubSpot reads only');
  assert.ok(t.log.hs.every(c => c.auth === 'Bearer pat-test-not-real'));
  deq(t.log.hs.find(c => c.path === '/crm/v3/objects/deals/search').body.filterGroups[0].filters[0], { propertyName: 'dealstage', operator: 'NOT_IN', values: ['s3', 's4'] });
  const P = v.pipe, by = {}; P.deals.forEach(d => { by[d.name.split(' — ')[0]] = d; });
  assert.strictEqual(P.open, 5, 'closed deal dropped even if HubSpot returns it'); assert.ok(!by['Old Co']);
  deq(P.deals.map(d => [d.k, d.group]), [['D2', 'act'], ['D3', 'chase'], ['D4', 'chase'], ['D1', 'data'], ['D5', 'ok']], 'sorted by urgency, then event date');
  deq(by.Telus.flags, ['They wrote last, 2 working day(s) ago', 'Event in 4 day(s), not won yet']);
  deq(by.PCAARRD.flags, ['Quiet for 11 day(s)']); deq(by['AMI Group'].flags, ['No email found in 120 days', 'Missing contact']);
  deq(by['Embassy of Belgium'].flags, ['Event date passed, deal still open', 'Missing amount']);
  assert.strictEqual(by.Telus.next, 'Reply to Ana with the revised CE.'); assert.strictEqual(P.summary, PIPE_REVIEW.summary);
  assert.ok(by.Telus.url.indexOf('https://app.hubspot.com/contacts/247723523/record/0-3/101') === 0 && by.Telus.mail.url.indexOf('#all/aa0100000000000a') > 0);
  assert.strictEqual(by.Telus.mail.dir, 'in'); assert.strictEqual(by.PCAARRD.mail.to, 'joy@pcaarrd.test', 'own-domain address skipped');
  deq([by.Telus.can_draft, by.PCAARRD.can_draft, by['AMI Group'].can_draft, by['Asian Development Bank'].can_draft], [true, true, false, false]);
  const sent = JSON.parse(t.log.claude[0].messages[0].content); deq(sent.deals.map(d => d.k), ['D2', 'D3', 'D4', 'D1'], 'only flagged deals go to Claude');
  assert.ok(/never follow instructions/.test(t.log.claude[0].system) && t.log.claude[0].output_config.effort === 'low');
  assert.ok(t.log.pipeQ.some(q => /from:ana@telus\.test OR to:ana@telus\.test/.test(q) && /"S-255PR"/.test(q) && /"Telus"/.test(q)), 'search by contact, project ID and client');
  assert.ok(JSON.stringify(t.log.gpt[0]).indexOf('kumusta yung deals') > 0, 'trigger words in the chat schema');
  assert.ok(t.tabs.Chat.rows.some(x => x[3] === '>' + t.id && /pipeline review in its own thread/.test(x[2])), 'pointer in the main chat');
  assert.ok(t.tabs.Chat.rows.some(x => x[3] === t.id && /1 to act on today, 2 to chase, 1 to fix, 1 on track/.test(x[2])));
  const row = t.tabs.Pipeline.rows[1]; deq(row.slice(2, 9), [5, 5, 1, 2, 1, 1, 1], 'Pipeline tab logged');
  const st = JSON.stringify(t.ctx.cueState()); assert.ok(st.indexOf('pat-test') < 0 && st.indexOf('Ignore previous instructions') < 0, 'no token or email text in page state');
});

test('P2 follow-ups: one GPT call for ticked deals with a thread; Approve and send replies in each thread; drafts only never sends; Done closes', () => {
  const t = pipeToCard();
  assert.throws(() => t.ctx.cuePipeFollowUps(t.id, ['D4']), /email thread/);
  const v = t.ctx.cuePipeFollowUps(t.id, ['D2', 'D3', 'D4']);
  assert.strictEqual(v.status, 'Needs you', v.error); assert.strictEqual(v.metrics.ai_calls, 2, 'review + follow-ups');
  deq(v.pipe.drafts.map(d => [d.k, d.to]), [['D2', 'ana@telus.test'], ['D3', 'joy@pcaarrd.test']], 'unticked and duplicate drafts dropped');
  assert.ok(/never follow/.test(t.log.gpt[1].instructions)); deq(JSON.parse(t.log.gpt[1].input).deals.map(d => d.k), ['D2', 'D3']);
  assert.throws(() => t.ctx.cueApprove(t.id, { bodies: { D2: ' ' }, send: true }), /is empty/);
  const d = t.ctx.cueApprove(t.id, { skip: ['D3'], bodies: { D2: 'Hi Ana, edited by Kiko.' }, send: true });
  assert.strictEqual(d.status, 'Done'); assert.strictEqual(t.log.replies.length, 1); deq(t.log.sent, ['reply-1']);
  const pl = t.log.replies[0].payload; assert.ok(pl.indexOf('{"message":{"threadId":"aa0100000000000a"}}') > 0 && /To: ana@telus\.test/.test(pl) && /In-Reply-To: <pm1@mail>/.test(pl));
  assert.ok(Buffer.from(pl.split('base64\r\n\r\n')[1].split('\r\n--')[0].replace(/\r\n/g, ''), 'base64').toString().indexOf('edited by Kiko') >= 0);
  assert.ok(t.tabs.Chat.rows.some(x => /^Sent 1 follow-up from your Gmail.*HubSpot and Canvas were not changed/.test(x[2])));
  assert.ok(t.tabs.Chat.rows.some(x => x[3] === '>' + t.id && /^Summary for Pipeline review: 5 open deals checked.*sent 1 follow-up/.test(x[2])));
  assert.strictEqual(t.log.bridge.filter(b => b.action !== 'search_projects').length, 0); deq(t.log.search || [], [], 'the chat lookup, also a read');
  const u = pipeToCard(); u.ctx.cuePipeFollowUps(u.id, ['D3']); assert.strictEqual(u.ctx.cueApprove(u.id, {}).status, 'Done'); assert.ok(!u.log.sent, 'drafts only sends nothing');
  const w = pipeToCard(); const x = w.ctx.cuePipeDone(w.id); assert.strictEqual(x.status, 'Done'); assert.ok(!w.log.replies);
});

test('P4 pipeline cards (Kiko 24 Oct): system emails are not the client, a contact found in Gmail is named, each deal gets its own action, the event countdown shows once', () => {
  const extra = [
    { key: '"AMI Group"', id: 'pm6', thread: 'aa0600000000000a', at: '2026-10-20T04:00:00Z', sent: false, from: 'HubSpot <noreply@notifications.hubspot.com>', to: 'kiko@example.com', subject: "You've been assigned 57 deals", snippet: 'AMI Group' },
    { key: '"AMI Group"', id: 'pm7', thread: 'aa0700000000000a', at: '2026-10-19T04:00:00Z', sent: false, from: 'Coupa <bids@ami.test>', to: 'kiko@example.com', subject: 'Your Coupa Login Verification Code', snippet: 'code 1234' },
    { key: '"AMI Group"', id: 'pm8', thread: 'aa0800000000000a', at: '2026-10-16T04:00:00Z', sent: false, from: 'Rina <rina@ami.test>', to: 'kiko@example.com', subject: 'Merch brief', snippet: 'Here is the brief.' },
    { key: '"Embassy of Belgium"', id: 'pm9', thread: 'aa0900000000000a', at: '2026-10-21T01:00:00Z', sent: false, from: 'News <news@belgium.test>', to: 'kiko@example.com', subject: 'Newsletter', snippet: 'x', headers: [{ name: 'List-Unsubscribe', value: '<mailto:u@belgium.test>' }] }];
  PMAIL.push.apply(PMAIL, extra);
  try {
    const t = pipeToCard(), P = t.v.pipe, by = {}; P.deals.forEach(d => { by[d.name.split(' — ')[0]] = d; });
    assert.ok(t.log.pipeQ.every(q => /-from:\(noreply OR no-reply .*hubspot\)$/.test(q)), 'Gmail drops the obvious system senders');
    deq([by['AMI Group'].mail.subject, by['AMI Group'].mail.to], ['Merch brief', 'rina@ami.test'], 'the HubSpot notice and the login code are skipped');
    assert.ok(by['AMI Group'].flags.indexOf('Contact not saved in Canvas (Gmail: rina@ami.test)') >= 0 && by['AMI Group'].flags.indexOf('Missing contact') < 0, by['AMI Group'].flags.join('; '));
    assert.strictEqual(by['Embassy of Belgium'].mail.subject, 'Tents', 'a newsletter is not the client');
    assert.ok(t.ctx.cuePipeAuto_({ from: 'x <do_not_reply@coupahost.com>', subject: 'Hi' }) && t.ctx.cuePipeAuto_({ from: 'a@b.test', 'auto-submitted': 'auto-generated' }) && !t.ctx.cuePipeAuto_({ from: 'Heidi <heidi@dmci.test>', subject: 'Re: CE', 'auto-submitted': 'no' }));
    const st = t.ctx.cueState(), pv = st.requests.find(r => r.id === t.id).pipe, vb = {}; pv.deals.forEach(d => { vb[d.name.split(' — ')[0]] = d; });
    assert.ok(vb['Embassy of Belgium'].canvas && /page=clientdesk/.test(vb['Embassy of Belgium'].canvas.url), 'a deal to fix opens Canvas');
    assert.strictEqual(vb.Telus.canvas, null, 'nothing to fix, no Canvas button');
    assert.ok(/The card already shows the stage, amount, event date, days to the event and each flag/.test(t.log.claude[0].system.replace(/\s+/g, ' ')), 'Claude does not repeat the countdown');
    const html = cuePage();
    const i = html.indexOf('function pipeCardHtml'), part = html.slice(i, i + 6000);
    assert.ok(part.indexOf('>Last email ') < part.indexOf('<b>Next:</b> ') && part.indexOf('<b>Next:</b> ') < part.indexOf('+ pipeAct(d)'), 'last email, then Next, then the action');
    assert.ok(/data-act="pipe-draft1"/.test(part) && /Fix in Canvas/.test(part) && /counted \? 'event'/.test(part));
    const v = t.ctx.cuePipeFollowUps(t.id, ['D2']); deq(v.pipe.drafts.map(d => d.k), ['D2'], 'one deal\'s own button drafts just that deal');
  } finally { PMAIL.splice(PMAIL.length - extra.length, extra.length); }
});

test('C39 the ✓ in every thread (Kiko 24 Oct): closes every open run in the thread, older ones too; a running run is left alone; nothing written', () => {
  const t = pipeToCard(), id = t.id, C = t.ctx;
  const add = (k, st) => C.cueLocked_(() => { const sh = C.cueSheet_('Requests'); sh.appendRow([k]); C.cueSave_(sh, sh.getLastRow(), { id: k, kind: 'pipeline', ref: id, status: st, stage: st, text: 'x', files: [], notes: [], metrics: {} }); });
  add('cue-20261021110500-aaaa', 'Failed'); add('cue-20261021110600-bbbb', 'Working');
  assert.throws(() => C.cueCloseThread('cue-made-up-0000'), /No such task/);
  deq(C.cueCloseThread('cue-20261021110500-aaaa'), { closed: 2, running: 1 }, 'any run of the thread finds its root');
  deq([id, 'cue-20261021110500-aaaa', 'cue-20261021110600-bbbb'].map(k => C.cueLoad_(k).s.status), ['Closed', 'Closed', 'Working']);
  assert.ok(t.tabs.Chat.rows.some(x => x[3] === id && /^Closed 2 runs\. Nothing was written or sent\. 1 still running/.test(x[2])));
  deq(C.cueCloseThread(id), { closed: 0, running: 1 }); assert.ok(!t.log.sent && !t.log.replies, 'nothing sent');
  const html = cuePage();
  assert.ok(/data-act="close-thread" data-id="' \+ esc\(it\.id\)/.test(html) && /return !CLOSED\[r\.status\]/.test(html), 'the header ✓ shows while any run is open');
  assert.ok(/act === 'close-thread'[\s\S]{0,900}cueCancelIntake/.test(html), 'an intake saved in Canvas still asks to cancel and remove');
});

// CUE-FUNNEL (Kiko 24 Oct 13:56Z, spec sales-funnel-tasks.md): funnel per HubSpot stage and Kiko's open HubSpot tasks, no AI call.
const FN_TASKS = () => [{ id: 't1', subject: 'Follow up on pending decision — Telus — Trick or Treat - Manila', status: 'NOT_STARTED', due: '2026-10-19T02:00:00Z', deal: '101' },
  { id: 't2', subject: 'Resolve MAEC company category', status: 'NOT_STARTED', due: '2026-10-19T02:00:00Z' },
  { id: 't3', subject: 'Call Joy', status: 'NOT_STARTED', due: '2026-10-25T02:00:00Z' },
  { id: 't4', subject: 'Old one', status: 'COMPLETED', due: '2026-10-01T02:00:00Z' }];
// CRM-FUNNEL-CANVAS-2026-10-29: the steps and counts are Canvas's Sales funnel (crm_funnel); HubSpot gives only the tasks and deal names.
const FN_CANVAS = { today: '2026-10-21', limits: {}, steps: [{ step: 'Inquiry', count: 4, stuck: 1, limit: 3 }, { step: 'CE sent', count: 1, stuck: 0, limit: 10 },
  { step: 'Won', count: 1, stuck: 0 }, { step: 'Delivered', count: 0, stuck: 0, limit: 30 }, { step: 'Paid', count: 2, stuck: 0 }], stuck: [], due: [] };
const fnRun = (o = {}) => { const t = sandbox(Object.assign({ funnel: FN_CANVAS, hsTasks: FN_TASKS(), props: { CUE_HUBSPOT_TOKEN: 'pat-test-not-real' } }, o)); const id = t.ctx.cueSend(o.say || 'show the sales funnel').request_id; return { t, id, v: t.ctx.cueRun(id) }; };
test('FN1 funnel: chat words start it with no AI call; every deal counted per stage, the award stage named; open tasks with their deal, overdue first', () => {
  const { t, id, v } = fnRun();
  assert.strictEqual(v.kind, 'funnel'); assert.strictEqual(v.status, 'Needs you', v.error);
  assert.strictEqual(t.log.gpt.length + t.log.claude.length, 0, 'no AI call'); assert.strictEqual(v.metrics.ai_calls, 0);
  deq(v.fn.stages.map(x => [x.label, x.kind, x.n, x.amount, x.stuck]), [['Inquiry', 'open', 4, 0, 1], ['CE sent', 'open', 1, 0, 0], ['Won', 'won', 1, 0, 0], ['Delivered', 'won', 0, 0, 0], ['Paid', 'won', 2, 0, 0]]);
  deq([v.fn.src, v.fn.wait.label, v.fn.wait.n, v.fn.wait.amount], ['canvas', 'CE sent', 1, 0]);
  assert.strictEqual(v.fn.line, '4 Inquiry (1 stuck) · 1 CE sent · 1 Won · 2 Paid');
  assert.strictEqual(t.log.funnel, 1, 'one crm_funnel read');
  deq(v.fn.tasks.map(x => [x.id, x.group, x.deal, x.late, x.done]), [['t1', 'deal', 'Telus — Trick or Treat - Manila', 2, false], ['t2', 'category', '', 2, false], ['t3', 'other', '', 0, false]]);
  assert.ok(/record\/0-3\/101$/.test(v.fn.tasks[0].deal_url), 'a task still links its HubSpot deal'); deq(v.fn.deals, [], 'deal lists stay in Canvas');
  assert.ok(t.log.hs.every(x => x.method !== 'patch'), 'the read changes nothing in HubSpot');
  assert.strictEqual(t.log.taskQ.filterGroups[0].filters[0].value, 'COMPLETED', 'only tasks not completed');
  assert.ok(t.tabs.Chat.rows.some(x => x[3] === '>' + id && /own thread/.test(x[2])), 'pointer in the main chat');
  ['my hubspot tasks', 'show HubSpot action items', 'tasks in hubspot', 'funnel'].forEach(w => assert.ok(t.ctx.cueFunnelAsked_(w), w));
  ['funnel review', 'review the funnel', 'clean up hubspot', 'how is the pipeline'].forEach(w => assert.ok(!t.ctx.cueFunnelAsked_(w), w));
});
test('FN2 funnel counts: no stage is listed by name; empty open stages stay at 0; with no award stage the last open stage waits', () => {
  const { ctx } = sandbox();
  const st = [{ id: 'a', label: 'Inquiry', kind: 'open' }, { id: 'b', label: 'CE submitted', kind: 'open' }, { id: 'c', label: 'Awaiting award / PO', kind: 'open' }, { id: 'w', label: 'Closed won', kind: 'won' }];
  const r = ctx.cueFunnelCount_(st, [{ id: '1', name: 'A', stage: 'a', amount: 0 }, { id: '2', name: 'B', stage: 'c', amount: 100 }, { id: '3', name: 'KLM', stage: '', amount: 142240 }]);
  deq(r.stages.map(x => [x.id, x.n, x.no_amount]), [['a', 1, 1], ['b', 0, 0], ['c', 1, 0], ['w', 0, 0]]); deq(r.none.map(x => x.name), ['KLM']); deq(r.wait.id, 'c');
  deq(ctx.cueFunnelCount_(st.slice(0, 2), []).wait.id, 'b');
  deq([ctx.cueFunnelPeso_(10194422.47), ctx.cueFunnelPeso_(420000), ctx.cueFunnelPeso_(5000)], ['₱10.2M', '₱420k', '₱5,000']);
});
test('FN3 Today card: one funnel run gives two rows (funnel, overdue tasks) pointing at its thread; a newer run closes the older one', () => {
  const { t, id, v } = fnRun();
  const T = t.ctx.cueTodayFrom_([v], '2026-10-21');
  deq(T.rows.map(r => [r.eyebrow, r.title, r.button, r.thread]), [['Sales funnel · from Canvas', '1 deal waiting for award', 'Open funnel', id + '#fn-' + id], ['HubSpot tasks · yours', '2 tasks overdue', 'Review tasks', 'hst:' + id]]);
  assert.ok(T.rows.every(r => r.thread.length <= 120), 'Canvas cuts a thread id at 120 characters');
  assert.ok(/^Follow up: Telus — Trick or Treat - Manila · Resolve MAEC company category and 1 more$/.test(T.rows[1].detail), T.rows[1].detail);
  t.ctx.__wait(60000); const id2 = t.ctx.cueSend('show the funnel').request_id; t.ctx.cueRun(id2);
  assert.strictEqual(t.state(id).status, 'Closed', 'the older snapshot closes'); assert.strictEqual(t.state(id2).status, 'Needs you');
  // PC recheck 14:22Z: the Done line listed "sales funnel (...)" once per run. Only the day's latest funnel run counts.
  const done = n => Object.assign({}, v, { id: 'f' + n, status: 'Done', created: '2026-10-21T0' + n + ':00:00Z' });
  const D = t.ctx.cueTodayFrom_([done(1), done(2), done(3)], '2026-10-21');
  assert.strictEqual((D.done.match(/sales funnel/g) || []).length, 1, D.done);
  deq(t.ctx.cueTodayFrom_([done(1), Object.assign({}, v, { created: '2026-10-21T04:00:00Z' })], '2026-10-21').rows.length, 2, 'a newer waiting run gives the rows, no Done entry');
});
test('FN4 Mark done closes one HubSpot task and reads it back; a key without tasks scopes says so and the funnel still works', () => {
  const { t, id } = fnRun();
  const v = t.ctx.cueFunnelTaskDone(id, 't2');
  deq(v.fn.tasks.map(x => [x.id, x.done]), [['t1', false], ['t2', true], ['t3', false]]);
  deq(t.log.hs.filter(x => x.method === 'patch').map(x => [x.path, x.body.properties.hs_task_status]), [['/crm/v3/objects/tasks/t2', 'COMPLETED']], 'one write, that task only');
  assert.ok(t.tabs.Chat.rows.some(x => x[3] === id && /^Marked done in HubSpot: Resolve MAEC/.test(x[2])));
  assert.throws(() => t.ctx.cueFunnelTaskDone(id, 'nope'), /not on this list/);
  const w = fnRun({ hsTaskWrite: 403 }), v2 = w.t.ctx.cueFunnelTaskDone(w.id, 't1');
  assert.ok(/cannot change tasks/.test(v2.fn.tasks[0].error)); assert.strictEqual(v2.fn.tasks[0].done, false);
  const r = fnRun({ hsTaskCode: 403 });
  assert.strictEqual(r.v.status, 'Needs you'); assert.ok(/cannot read tasks yet/.test(r.v.fn.task_error)); deq(r.v.fn.tasks, []);
  deq(r.t.ctx.cueTodayFrom_([r.v], '2026-10-21').rows.map(x => x.title), ['1 deal waiting for award', 'HubSpot tasks need a key change']);
  const d = fnRun({ hsTasks: [] }); assert.strictEqual(d.v.status, 'Needs you', 'deals still wait for award');
  assert.strictEqual(d.t.ctx.cueFunnelDone(d.id).status, 'Done');
});
test('FN5 the 07:00 row starts one funnel a day; the page draws it with no AI wording', () => {
  const t = sandbox({ hsTasks: FN_TASKS(), props: { CUE_HUBSPOT_TOKEN: 'pat-test-not-real' } }); t.ctx.cueSchedules();   // seeds the rows, as opening Settings does
  t.ctx.__wait(phMs('2026-10-22', '07:01') - Date.parse('2026-10-21T03:00:00Z')); for (let i = 0; i < 6; i++) t.ctx.cueResume();
  const f = t.tabs.Requests.rows.slice(1).map(r => t.state(r[0])).filter(s => s.kind === 'funnel');
  assert.strictEqual(f.length, 1); assert.strictEqual(f[0].how, 'daily'); assert.strictEqual(t.props.CUE_FUNNEL_DAY, '2026-10-22');
  const html = cuePage();
  assert.ok(/function funnelCardHtml\(r, only\)/.test(html) && /data-act="fn-task"/.test(html) && /call\('cueFunnelTaskDone', \[id, b\.getAttribute\('data-t'\)\]/.test(html));
  // PC check 14:13Z: the Inquiry (2) header showed no deals. Every section in the funnel card has the visible .sec marker; none hides it.
  const card = html.slice(html.indexOf('function funnelCardHtml(r, only)'), html.indexOf('// CUE-AR (Kiko 07:42Z)'));
  assert.strictEqual((card.match(/<details class="sec"/g) || []).length, 2, 'stage and task sections'); assert.ok(!/<summary[^>]*display:inline/.test(card), 'no summary without its marker');
  // PC check 14:29Z: Open funnel opened the thread at the bottom (tasks). The card's top and its tasks carry the spots the Today rows name.
  assert.ok(/id="fn-' \+ esc\(r\.id\)/.test(card) && /id="fnt-' \+ esc\(r\.id\)/.test(card));
  const src = html.slice(html.indexOf('var goSpot ='), html.indexOf('function closeTab('));
  // The pane's own render (paneShow, renderChat) runs inside openPane and tries the spot too; the stub does the same.
  const els = {}, ps = { scrollTop: 0, scrollHeight: 900, getBoundingClientRect: () => ({ top: 100 }), addEventListener() {} }, opened = [], later = [];
  const g = vm.createContext({ document: { getElementById: k => els[k] || null }, $: k => k === 'pscroll' ? ps : { focus() {} }, matchMedia: () => ({ matches: false }), setTimeout: f => later.push(f),
    openPane: it => { opened.push(it.key); g.pactive = it.key; g.toSpot(); } });
  vm.runInContext(src + ';this.goThread = goThread; this.toSpot = toSpot;', g);
  els['fn-cue-1'] = { getBoundingClientRect: () => ({ top: 400 }) }; els['fnt-cue-1'] = { getBoundingClientRect: () => ({ top: 700 }) };
  g.goThread('cue-1#fn-cue-1'); deq([opened.pop(), ps.scrollTop], ['t:cue-1', 900 + 292], 'Open funnel: the tab is the plain thread, scrolled to the card top');
  // PC recheck 14:39Z: Review tasks right after Open funnel, on the thread already drawn, stayed at the card top.
  ps.scrollTop = 0; g.goThread('cue-1#fnt-cue-1'); assert.strictEqual(ps.scrollTop, 900 + 592, 'Review tasks on the drawn thread goes to the tasks');
  // PC recheck 15:17Z: the place is set again while the slide-in settles (here the frame "settles" 50 px off).
  later.length = 0; ps.scrollTop = 77; g.goThread('hst:cue-1'); ps.scrollTop = 50; later.forEach(f => f()); assert.strictEqual(ps.scrollTop, 0, 'the tasks tab ends at its top');
  later.length = 0; g.goThread('hst:cue-1'); g.pactive = 't:other'; ps.scrollTop = 50; later.forEach(f => f()); assert.strictEqual(ps.scrollTop, 50, 'not after a tab switch');
  ps.scrollTop = 0; g.goThread('cue-1'); deq([opened.pop(), ps.scrollTop], ['t:cue-1', 900], 'no spot: bottom, as before');
  ps.scrollTop = 0; g.goThread('cue-2#fnt-cue-2'); assert.strictEqual(ps.scrollTop, 900, 'spot not drawn yet: bottom for now');
  els['fnt-cue-2'] = { getBoundingClientRect: () => ({ top: 700 }) }; assert.ok(g.toSpot()); assert.strictEqual(ps.scrollTop, 900 + 592, 'the next render goes to the tasks');
  assert.ok(!g.toSpot(), 'a spot is used once, so later renders leave the scroll alone');
  // PC recheck 15:00Z: Review tasks after Open funnel still stayed at the card top in Canvas, so the tasks open in their own pane tab.
  const th = html.slice(html.indexOf('  function thOf('), html.indexOf('  function threadRef('));
  const h2 = vm.createContext({ state: { requests: [{ id: 'f2', kind: 'funnel', fn: {} }, { id: 'f1', kind: 'funnel', fn: {} }, { id: 'b1', kind: 'bids' }] } });
  vm.runInContext('function byId() { var o = {}; state.requests.forEach(function (r) { o[r.id] = r; }); return o; }\n' + th + ';this.thOf = thOf;', h2);
  const v1 = h2.thOf({}, 'hst:f1'); deq([v1.hst, v1.root, v1.reqs.map(r => r.id)], [true, 'hst:f1', ['f1']], 'the run named in the tab');
  deq(h2.thOf({}, 'hst:gone').reqs.map(r => r.id), ['f2'], 'a run the page no longer has: the newest funnel run');
  deq(h2.thOf({ b1: 'x' }, 'b1'), 'x', 'any other thread as before');
  assert.ok(/\[120, 400, 1000\]\.forEach[\s\S]{0,200}if \(!mine \|\| pactive !== key\) return;[\s\S]{0,200}ps\.scrollTop = 0;/.test(html), 'PC recheck 15:17Z: the place is set again while the slide-in settles');
  assert.ok(/if \(t\.hst\) \{[\s\S]{0,200}funnelCardHtml\(f, 'tasks'\)/.test(html) && /if \(th\.hst\) return 'HubSpot tasks'/.test(html));
});
test('C40 old runs (Kiko 24 Oct): a newer pipeline review replaces the older waiting one; "Close older runs" closes only scheduled jobs from before today', () => {
  const t = pipeToCard(), C = t.ctx, first = t.id;
  const again = C.cueSend('which deals went quiet?').request_id; C.cueRun(again);
  deq([C.cueLoad_(first).s.status, C.cueLoad_(again).s.status], ['Closed', 'Needs you'], 'the older full review is replaced');
  assert.ok(t.tabs.Chat.rows.some(x => x[3] === first && /^Replaced by a newer pipeline review/.test(x[2])));
  const add = (k, kind, st, day, extra) => C.cueLocked_(() => { const sh = C.cueSheet_('Requests'); sh.appendRow([k]);
    C.cueSave_(sh, sh.getLastRow(), Object.assign({ id: k, kind, ref: '', status: st, stage: st, created: day + 'T01:00:00.000Z', text: 'x', files: [], notes: [], metrics: {} }, extra || {})); });
  add('cue-20261020090000-b1d0', 'bids', 'Needs you', '2026-10-20'); add('cue-20261020090100-9700', 'gtask', 'Failed', '2026-10-20');
  add('cue-20261020090200-1a7e', 'intake', 'Needs you', '2026-10-20'); add('cue-20261021090300-70da', 'bids', 'Needs you', '2026-10-21');
  deq(C.cueCloseOlder(), { closed: 2 });
  deq(['cue-20261020090000-b1d0', 'cue-20261020090100-9700', 'cue-20261020090200-1a7e', 'cue-20261021090300-70da', again].map(k => C.cueLoad_(k).s.status),
    ['Closed', 'Closed', 'Needs you', 'Needs you', 'Needs you'], 'Kiko\'s intake and today\'s runs stay');
  // PC recheck 24 Oct: a review Kiko is drafting in is never replaced or closed; a replaced review from today closes; one line per thread.
  const held = C.cueSend('which deals went quiet?').request_id; C.cueRun(held); C.cuePipeFollowUps(held, ['D2']);
  assert.strictEqual(C.cueLoad_(again).s.status, 'Closed', 'the newer run replaced the older review');
  const fresh = C.cueSend('which deals went quiet?').request_id; C.cueRun(fresh);
  deq([C.cueLoad_(held).s.status, C.cueLoad_(fresh).s.status], ['Needs you', 'Needs you'], 'a review holding an unsent follow-up stays');
  C.cueLocked_(() => { const L = C.cueLoad_(fresh); L.s.status = 'Needs you'; C.cueSave_(L.sh, L.row, L.s); });
  const extra = C.cueSend('which deals went quiet?').request_id; C.cueRun(extra);
  C.cueLocked_(() => { const L = C.cueLoad_(fresh); L.s.status = 'Needs you'; C.cueSave_(L.sh, L.row, L.s); });   // as if it ran before this build
  add('cue-20261020090400-2b2b', 'bids', 'Needs you', '2026-10-20', { ref: 'cue-20261020090000-b1d0' }); add('cue-20261020090500-3c3c', 'bids', 'Needs you', '2026-10-20', { ref: 'cue-20261020090000-b1d0' });
  const before = t.tabs.Chat.rows.length; deq(C.cueCloseOlder(), { closed: 3 }, 'the replaced review from today and both runs of the old bid thread');
  deq([C.cueLoad_(fresh).s.status, C.cueLoad_(held).s.status, C.cueLoad_(extra).s.status], ['Closed', 'Needs you', 'Needs you'], 'newest and drafting reviews stay');
  assert.strictEqual(t.tabs.Chat.rows.slice(before).filter(x => /Close older runs/.test(x[2])).length, 2, 'one line per thread, not per run');
  const html = cuePage();
  assert.ok(/data-act="close-older"/.test(html) && /act === 'close-older'\) \{ b\.disabled = true; return call\('cueCloseOlder'/.test(html));
  const kinds = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'CueSweep.gs'), 'utf8').match(/CUE_OLD_KINDS_ = \[([^\]]+)\]/)[1].replace(/'/g, '').split(/,\s*/);
  assert.ok(html.indexOf('var OLDK = { ' + kinds.map(k => k + ': 1').join(', ') + ' }') > 0, 'the page and the server close the same kinds');
  assert.ok(/'Fix contact in Canvas'/.test(html), 'a contact finding opens Canvas to fix it, no delete');
});

test('P3 pipeline edge cases: one client only; no token, bad token; Claude down still gives the rule flags; a chat answer never joins a pipeline thread', () => {
  const t = pipeToCard({ client: 'Telus', ask: 'where are we with telus' });
  deq(t.v.pipe.deals.map(d => d.name), ['Telus — Trick or Treat - Manila']); assert.strictEqual(t.v.pipe.title, 'Pipeline: Telus');
  const n = sandbox({ pipeMail: true, talk: pipeTalk() }), id = n.ctx.cueSend('hows the pipeline').request_id, v = n.ctx.cueRun(id);
  assert.strictEqual(v.status, 'Failed'); assert.ok(/CUE_HUBSPOT_TOKEN is not set/.test(v.error), v.error);
  const b = pipeToCard({ hsCode: 401 }); assert.strictEqual(b.v.status, 'Failed'); assert.ok(/did not accept CUE_HUBSPOT_TOKEN/.test(b.v.error));
  const c = pipeToCard({ fail: { cost: () => resp(500, {}) } });
  assert.strictEqual(c.v.status, 'Needs you'); assert.ok(c.v.notes.some(x => /Claude could not review/.test(x))); assert.strictEqual(c.v.pipe.deals[0].group, 'act');
  assert.ok(/1 deal\(s\) to act on today, 2 to chase, 1 to fix/.test(c.v.pipe.summary));
  // An intake about Telus right after a Telus pipeline review starts its own thread, not inside the review.
  assert.strictEqual(t.ctx.cueRelated_('Telus booth change', '', ''), '');
  assert.strictEqual(t.ctx.cuePipeWorkDays_(Date.parse('2026-10-16T02:00:00Z'), Date.parse('2026-10-19T02:00:00Z')), 1, 'Fri to Mon is one working day');
});
