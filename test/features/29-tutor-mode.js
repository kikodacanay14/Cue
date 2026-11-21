// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: tutor-mode.
/* ---------- tutor mode (CueTutor.gs, specs/tutor-mode.md option C, Kiko 17:46Z) ---------- */
const PLAN = (v, pattern) => Object.assign(VTALK(v), { sure: true, choices: [], plan: { reading: 'Supplier search for an LED wall in Cebu', pattern: pattern || 'find suppliers for <item>',
  steps: [{ do: 'List BSE suppliers for LED walls', who: 'Canvas' }, { do: 'Compare them', who: 'Claude' }] } });
const chatCalls = t => t.log.gpt.filter(b => b.text.format.name === 'chat').length;
const tieWins = cmd => body => ({ pick: /Plan 1: (.*)/.exec(body.input)[1] === cmd ? 'plan1' : 'plan2', why: 'fits' });

test('TU1 tutor mode: Claude plans, nothing starts, one plan card with Go / Change / Not that; Go runs the same plan with no new AI call', () => {
  const t = sandbox({ tutor: true, plan: PLAN() });
  const out = t.ctx.cueSend('Find LED wall suppliers in Cebu for 14 Nov', [], '');
  deq([!!out.ask, t.tabs.Requests.rows.length, t.log.plans, chatCalls(t)], [true, 1, 1, 0], 'planned by Claude, nothing started, no GPT chat call');
  const q = askLine(t); assert.ok(/:go,change,not$/.test(q[3]));
  assert.ok(/^Here's what I'll do\nI think you want: Supplier search for an LED wall in Cebu\n1\. List BSE suppliers for LED walls \(Canvas\)\n2\. Compare them \(Claude\)\nLearning: approved 0 of 3/.test(q[2]), q[2]);
  deq(t.tabs.Chat.rows.slice(-2).map(r => r[1]), ['Kiko', 'Cue']);
  const go = t.ctx.cueAskPick(askId(q), 'go');
  deq([t.ctx.cueLoad_(go.request_id).s.kind, t.log.plans], ['vendor', 1]);
  deq(t.tabs.Patterns.rows.slice(1).map(r => r.slice(0, 4)), [['Supplier search: find suppliers for <item>', 'vendor', 1, false]]);
  deq(t.tabs['Routing examples'].rows.slice(1).map(r => r.slice(1)), [['Find LED wall suppliers in Cebu for 14 Nov', 'vendor']]);
  deq(t.tabs.Chat.rows.filter(r => r[1] === 'Kiko' && r[2] === 'Find LED wall suppliers in Cebu for 14 Nov').length, 1, 'Kiko\'s line shows once');
  assert.throws(() => t.ctx.cueAskPick(askId(q), 'go'), /already answered/);
  const u = sandbox({ tutor: true, talk: { reply: 'Doing well!', looks_like_inquiry: false, sure: true, choices: [], plan: { reading: '', steps: [], pattern: '' } } });
  const c = u.ctx.cueSend('how are you', [], '');
  deq([c.chat, !!c.ask, u.tabs.Chat.rows.pop()[2]], [true, false, 'Doing well!'], 'plain chat is answered, no card');
});

test('TU2 three Go taps in a row graduate a pattern: it runs on its own with "Ask me again next time"; the same words need no AI call; demote brings the card back', () => {
  const t = sandbox({ tutor: true, plan: PLAN() });
  const msgs = ['Find LED wall suppliers in Cebu for 14 Nov', 'find LED wall suppliers in Manila', 'find stage suppliers in Cebu'];
  msgs.forEach(m => { t.ctx.cueSend(m, [], ''); t.ctx.cueAskPick(askId(askLine(t)), 'go'); });
  deq(t.tabs.Patterns.rows[1].slice(2, 4), [3, true]);
  assert.ok(t.tabs.Chat.rows.some(r => /now runs without asking/.test(r[2])));
  const n = t.tabs.Requests.rows.length;
  const out = t.ctx.cueSend('find sound suppliers for the gala', [], '');
  deq([!!out.request_id, t.tabs.Requests.rows.length, t.log.plans], [true, n + 1, 4], 'ran on its own after one plan call');
  const q = askLine(t); assert.ok(/^Ran on its own: Supplier search: find suppliers for <item>/.test(q[2]) && /:again$/.test(q[3]));
  t.ctx.cueSend('find LED wall suppliers in Manila', [], '');
  deq([t.log.plans, t.tabs.Requests.rows.length], [4, n + 2], 'an approved phrasing of a graduated pattern runs from the saved plan, no AI call');
  t.ctx.cueAskPick(askId(askLine(t)), 'again');
  deq(t.tabs.Patterns.rows[1].slice(2, 4), [0, false]);
  t.ctx.cueSend('find tent suppliers in Davao', [], '');
  assert.ok(/:go,change,not$/.test(askLine(t)[3]), 'the card shows again');
});

test('TU3 Not that: the other commands as buttons plus Just chat; the pick is saved as a routing example and the count starts again', () => {
  const t = sandbox({ tutor: true, plan: PLAN() });
  t.ctx.cueSend('Find LED wall suppliers in Cebu for 14 Nov', [], ''); t.ctx.cueAskPick(askId(askLine(t)), 'go');
  t.ctx.cueSend('LED wall suppliers for AMI Group', [], '');
  t.ctx.cueAskPick(askId(askLine(t)), 'not');
  const q = askLine(t); deq([q[2], q[3].split(':')[1]], ['What did you want instead?', 'intake,readiness,email,chat']);
  t.ctx.cueAskPick(askId(q), 'chat');
  deq(t.tabs['Routing examples'].rows.slice(-1).map(r => r.slice(1)), [['LED wall suppliers for AMI Group', 'chat']]);
  deq(t.tabs.Patterns.rows[1].slice(2, 4), [0, false]);
  assert.throws(() => { t.ctx.cueSend('LED wall again please', [], ''); t.ctx.cueAskPick(askId(askLine(t)), 'maybe'); }, /not one of the choices/);
  assert.ok(/:go,change,not$/.test(askLine(t)[3]), 'a wrong button keeps the card open');
});

test('TU4 Change: Kiko says what to do instead, Claude plans again with that correction, and a new card shows', () => {
  const ready = { reply: 'Checking it in Canvas.', looks_like_inquiry: false, start_intake: '', task: '', readiness: 'AMI Group', sure: true, choices: [],
    plan: { reading: 'Readiness check for AMI Group', pattern: 'is <project> ready?', steps: [{ do: 'Score the checklist', who: 'Canvas' }] } };
  const t = sandbox({ tutor: true, plan: [PLAN(), ready] });
  t.ctx.cueSend('LED wall for AMI Group', [], '');
  const q = askLine(t);
  assert.throws(() => t.ctx.cueAskPick(askId(q), 'change', ''), /Say what I should do instead/);
  t.ctx.cueAskPick(askId(q), 'change', 'no, check if the AMI project is ready');
  deq(t.log.plans, 2);
  assert.ok(/Kiko corrected your plan for the message above: no, check if the AMI project is ready/.test(t.log.claude[1].messages[0].content));
  const q2 = askLine(t); assert.ok(/I think you want: Readiness check for AMI Group/.test(q2[2]) && askId(q2) !== askId(q));
  deq(t.tabs.Chat.rows.filter(r => r[1] === 'Kiko').map(r => r[2]), ['LED wall for AMI Group', 'Change: no, check if the AMI project is ready']);
  const go = t.ctx.cueAskPick(askId(q2), 'go');
  deq(t.ctx.cueLoad_(go.request_id).s.kind, 'readiness');
});

test('TU5 Claude and the code disagree: ChatGPT breaks the tie (2 of 3); still split, Kiko picks; two of three say chat, nothing starts', () => {
  const seed = t => { t.ctx.cueRouteSave_('LED wall for AMI Group', 'intake'); };
  const t = sandbox({ tutor: true, plan: PLAN(), tie: tieWins('Project intake') }); seed(t);
  t.ctx.cueSend('LED wall for AMI Group', [], '');
  const q = askLine(t);
  assert.ok(/I think you want: Project intake/.test(q[2]) && /Checks: Claude says Supplier search, your past examples say Project intake\. ChatGPT broke the tie: Project intake \(2 of 3\)/.test(q[2]), q[2]);
  deq(t.log.gpt.filter(b => b.text.format.name === 'tiebreak').length, 1);
  assert.ok(!/Supplier search|Project intake/.test(t.log.gpt[0].instructions.split('What the commands do')[0]) && /Plan 1: .*\nPlan 2: /.test(t.log.gpt[0].input), 'no names on the plans');
  const go = t.ctx.cueAskPick(askId(q), 'go');
  deq(t.ctx.cueLoad_(go.request_id).s.kind, 'intake');
  const u = sandbox({ tutor: true, plan: PLAN() }); seed(u);
  u.ctx.cueSend('LED wall for AMI Group', [], '');
  const s = askLine(u); assert.ok(/^Cue is split\. Claude says Supplier search, your past examples say Project intake, and ChatGPT could not pick/.test(s[2]) && /:vendor,intake,chat$/.test(s[3]));
  const v = u.ctx.cueAskPick(askId(s), 'vendor'); deq([u.ctx.cueLoad_(v.request_id).s.kind, u.log.plans], ['vendor', 1], 'the button starts it from the same plan');
  deq(u.tabs['Routing examples'].rows.slice(-1).map(r => r.slice(1)), [['LED wall for AMI Group', 'vendor']]);
  const w = sandbox({ tutor: true, plan: PLAN(), tie: tieWins('Just chat') }); w.ctx.cueRouteSave_('LED wall for AMI Group', 'chat');
  const c = w.ctx.cueSend('LED wall for AMI Group', [], '');
  deq([!!c.request_id, w.tabs.Requests.rows.length], [false, 1], 'nothing starts');
});

test('TU6 an email never graduates; My rules lists the learned patterns and Demote sends one back to asking; CUE_TUTOR=off keeps the GPT chat call', () => {
  const t = sandbox({ tutor: true, plan: PLAN() });
  for (let i = 0; i < 4; i++) t.ctx.cuePatApprove_('Email: reply to <supplier>', 'email', 'reply to mats co ' + i, null);
  deq(t.tabs.Patterns.rows[1].slice(2, 4), [4, false]);
  ['a', 'b', 'c'].forEach(x => t.ctx.cuePatApprove_('Supplier search: find suppliers for <item>', 'vendor', 'find ' + x, null));
  let v = t.ctx.cueMyRules();
  deq(v.patterns.map(x => [x.key, x.graduated, x.never]), [['Supplier search: find suppliers for <item>', true, false], ['Email: reply to <supplier>', false, true]]);
  v = t.ctx.cueMyPatternDemote('Supplier search: find suppliers for <item>');
  deq(v.patterns.map(x => x.graduated), [false, false]);
  assert.throws(() => t.ctx.cueMyPatternDemote('nope'), /not in the Patterns tab/);
  deq([t.ctx.cueSettings().tutor, t.ctx.cueTutorSet(false).tutor, t.props.CUE_TUTOR], [true, false, 'off'], 'the Settings switch');
  const u = sandbox({ talk: VTALK() }); const out = u.ctx.cueSend('Find LED wall suppliers in Cebu for 14 Nov', [], '');
  deq([!!out.request_id, chatCalls(u), u.log.plans || 0], [true, 1, 0], 'switch off: GPT routes and it starts at once, as before');
});

test('TC16 PC test 18:17Z: a table pasted as "phrase<TAB>meaning" rows (3 rows or 1) starts Learn my memory through cueSend, and the page skips expense(); a tabbed receipt with amounts does not', () => {
  const three = 'Record project expense\tLog a supplier cost to the project, scope and supplier entry, then verify it.\nSame rate as others\tCheck the existing rate for that exact assignment and apply it.\nApproved / Go ahead\tExecute the specific proposal already presented.';
  const one = 'Record project expense\tLog a supplier cost to the project, scope and supplier entry, then verify it.';
  const receipt = 'Record project expense\nDate\tAmount\n10/21\tPHP 1,500.00 tarp for AMI';
  [three, one, '\t' + three + '\n'].forEach((say, i) => {
    const t = sandbox(), out = t.ctx.cueSend(say, [], '');
    deq([t.log.gpt.length, t.state(out.request_id).kind], [0, 'memory'], 'tabbed paste ' + i);
  });
  const c = sandbox().ctx; deq([c.cueMemPaste_(receipt), c.cueMemPaste_('Top 3\tpick the best three suppliers for it')], [false, true]);
  const page = cuePage();
  const fn = page.match(/function memPaste\(t\) \{[\s\S]*?\n  \}\n/)[0], box = {}, expRe = new RegExp(page.match(/EXP_RE = \/(.+?)\/i;/)[1], 'i');
  vm.runInNewContext(fn + 'out = [memPaste(a), memPaste(b), memPaste(c)];', Object.assign(box, { a: three, b: one, c: receipt }));
  deq([box.out, expRe.test(three), expRe.test(one)], [[true, true, false], true, true], 'EXP_RE matches these, so memPaste is what keeps them from expense()');
});

test('TU7 PC test 18:15Z: Claude unsure, or a short "LED wall for AMI Group" it only answered, shows the plan card with the best guess; Not that lists the other guesses first', () => {
  const unsure = Object.assign(PLAN(), { sure: false, choices: ['vendor', 'intake'], reply: 'Earlier we looked at AMI Group suppliers.' });
  const t = sandbox({ tutor: true, plan: unsure });
  const out = t.ctx.cueSend('LED wall for AMI Group', [], '');
  const q = askLine(t);
  deq([!!out.ask, /:go,change,not$/.test(q[3]), t.tabs.Requests.rows.length], [true, true, 1]);
  assert.ok(/^Here's what I'll do\nI think you want: Supplier search for an LED wall in Cebu/.test(q[2]) && /Not sure: it could also be Project intake\. Tap Not that/.test(q[2]) && !/I am not sure|Earlier we looked/.test(q[2]), q[2]);
  const go = t.ctx.cueAskPick(askId(q), 'go');
  deq([t.ctx.cueLoad_(go.request_id).s.kind, t.log.plans], ['vendor', 1], 'Go runs the filled plan, no second call and no old buttons');
  const u = sandbox({ tutor: true, plan: unsure }); u.ctx.cueSend('LED wall for AMI Group', [], ''); u.ctx.cueAskPick(askId(askLine(u)), 'not');
  deq(askLine(u)[3].split(':')[1], 'intake,readiness,email,chat');
  const w = sandbox({ tutor: true, plan: { reply: 'No Canvas project matched AMI Group.', looks_like_inquiry: false, sure: true, choices: [], plan: { reading: '', steps: [], pattern: '' } } });
  w.ctx.cueSend('LED wall for AMI Group', [], '');
  const p = askLine(w);
  assert.ok(/:go,change,not$/.test(p[3]) && /I think you want: Project intake for "LED wall for AMI Group"/.test(p[2]) && /could also be Supplier search/.test(p[2]), p[2]);
  const gi = w.ctx.cueAskPick(askId(p), 'go'); deq(w.ctx.cueLoad_(gi.request_id).s.kind, 'intake');
});

test('TU8 PC test 18:15Z: a rejected expense\'s summary names the expense, not "Project intake"; a phased intake carries its client name for the thread title', () => {
  const t = sandbox();
  t.ctx.cueSummary_({ id: 'cue-x1', kind: 'expense', status: 'Rejected', expense: { plan: { amount: 500, item: 'tarp' }, project: { name: 'AMI Group' } } });
  const line = t.tabs.Chat.rows.pop()[2];
  assert.ok(/^Summary for ₱500\.00 tarp for AMI Group: rejected/.test(line), line);
  deq(t.ctx.cueView_({ id: 'cue-x2', kind: 'intake', phased: true, x: { client: { company: 'Unilever' }, event: { name: 'Launch' } }, metrics: {} }).name, 'Unilever, Launch');
});

test('TC17 PC test 18:30Z (page): a map thread shows its card, not "undefined"; ✕ forgets earlier threads; Kiko\'s line shows once when a poll beats the send; learn summaries name facts by words', () => {
  const page = cuePage();
  const wf = page.match(/function workflowCardHtml\(r\) \{[\s\S]*?\n  \}\n/)[0];
  assert.ok(/\n    return h;[^\n]*\n  \}\n$/.test(wf), 'workflowCardHtml returns its card');
  const close = page.match(/function paneClose\(\) \{[\s\S]*?\n  \}\n/)[0];
  assert.ok(/ptabs = \[\]; pactive = 'list'/.test(close) && /paneOpen\(false\)/.test(close));
  // CUE-CHANNELS-2026-11-18: ✕ goes back to General, which closes the channel through paneClose; the phone's back button shows the list.
  assert.ok(/data-p'\);[\s\S]{0,80}if \(p === 'pane'\) return showList\(\);/.test(page) && /if \(p === 'close'\) return goGeneral\(\);/.test(page) && /function goGeneral\(\) \{ paneClose\(\); showConv\(\); \}/.test(page));
  const fn = page.match(/function allLines\(\) \{[\s\S]*?\n  \}\n/)[0], now = Date.parse('2026-10-21T18:30:00Z'), box = {};
  vm.runInNewContext(fn + 'out = allLines().length;', Object.assign(box, { state: { chat: [{ who: 'Kiko', text: 'hi', request_id: '', time: '2026-10-21T18:30:01Z' }] },
    outbox: [{ who: 'Kiko', text: 'hi', request_id: '', time: '', sent: now }, { who: 'Kiko', text: 'other', request_id: '', time: '', sent: now }] }));
  deq(box.out, 2, 'the echoed line once, the other pending line kept');
  assert.ok(/never by their number n/.test(fs.readFileSync(path.join(__dirname, '..', 'src', 'CueTeach.gs'), 'utf8')));
});

test('PH13 Kiko 18:42Z (page): intake cards have no explaining text under the buttons; all buttons on one row with Cancel intake last; the text is a tooltip', () => {
  const page = cuePage();
  const fn = page.match(/function phCardHtml\(r\) \{[\s\S]*?\n  \}\n/)[0];
  const labelHelpers = ['cardEditLabel', 'cardEditAttributes', 'cardEditInput', 'cardEditSelect', 'inp'].map(name => {
    const a = page.indexOf('  function ' + name + '(');
    return page.slice(a, page.indexOf('\n  }\n', a) + 4);
  }).join('\n');
  const box = { pickMode: {}, pickCount: (pk, pm) => pm === 'all' ? pk.all.length : new Set([].concat(...pk.lines.filter(l => l.on).map(l => l.suppliers.map(x => x.name)))).size, PHN: ['', 'Project details', 'Requirements', 'Costing', 'RFQs'], WORK: { Working: 1 }, CLOSED: { Done: 1, Rejected: 1 }, running: {}, editing: {}, phAdd: {}, rqEdit: {},
    esc: v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]),
    peso: n => 'PHP ' + n, secHtml: (k, t) => '<sec>' + t + '</sec>', srcHtml: () => '',
    metricLine: () => 'M', foldersHtml: () => '' };
  const lines = [{ key: 'R1', item: 'LED wall', spec: 'P3.9', why: 'w', quantity: 1, days: 1, execution: 'Outsourced', unit_cost: 1, cost_basis: 'history', unit_price: 2, price_basis: 'p' }];
  const card = (phase, extra) => vm.runInNewContext(labelHelpers + '\n' + fn + 'phCardHtml(r)', Object.assign({}, box, { r: Object.assign({ id: 'q1', status: 'Needs you', stage: 'Needs you', canvas: { project_id: 'S-1ZZ', project_number: '073' },
    ph: { phase, x: { client: {}, event: {} }, rows: [{ key: 'R1', item: 'LED', spec: 'P3', quantity: 1, days: 1 }], lines, totals: {}, rfqs: [] } }, extra || {}) }));
  [1, 2, 3].forEach(ph => {
    const h = card(ph), rows = h.match(/<div class="actions">[\s\S]*?<\/div>/g);
    deq(rows.length, 1, 'phase ' + ph + ': one button row');
    assert.ok(/data-act="reject"[\s\S]*data-act="ph-cancel"[^>]*margin-left:auto/.test(rows[0]), 'phase ' + ph + ': Cancel intake last, set apart');
    assert.ok(!/Save prices writes|Approve adds|Reject keeps|Tap an item/.test(h.replace(/title="[^"]*"/g, '')), 'phase ' + ph + ': no explaining text');
    assert.ok(/data-act="approve"[^>]*title="/.test(h), 'phase ' + ph + ': tooltip on the main button');
  });
  const project = card(1, { text: 'Original inquiry source', files: [{ id: 'abcdefghijk', name: 'stage.png' }],
    ph: { phase: 1, x: { client: { contact: 'Ana', company: 'ACME' }, event: { name: 'Launch', date: '2027-01-02' } }, rows: [], lines: [], totals: {}, rfqs: [] } });
  assert.ok(/Original inquiry source/.test(project) && /Original files and images \(1\)/.test(project) && /stage\.png/.test(project));
  assert.ok(/https:\/\/drive\.google\.com\/thumbnail\?id=abcdefghijk/.test(project), 'image attachment preview');
  box.editing.q1 = 1;
  const editable = card(1, { ph: { phase: 1, x: { client: { contact: 'Ana', company: 'ACME' }, event: { name: 'Launch', date: '2027-01-02' } }, rows: [], lines: [], totals: {}, rfqs: [] } });
  assert.ok(/data-field="client\.contact"/.test(editable) && /data-field="client\.company"/.test(editable), 'Client and Account use existing editable intake fields');
  assert.ok(!/ph-cancel/.test(card(3, { canvas: {} })), 'no Canvas project: no Cancel intake');
  const pk = card(4, { ph: { phase: 4, x: { client: {}, event: {} }, rfqs: [], lines, pick: { mode: 'line', lines: [{ key: 'R1', on: true, suppliers: [{ name: 'A' }, { name: 'B', new: true }] }], all: [{ name: 'A' }] } } });
  const pr = pk.match(/<div class="actions"[^>]*>[\s\S]*?<\/div>/g);
  deq(pr.length, 2, 'picking card: mode switch, then one button row');
  assert.ok(/data-act="pick-save"[^>]*>Draft 2 RFQs<[\s\S]*data-act="pick-skip"[\s\S]*data-act="ph-cancel"/.test(pr[1]));
  assert.ok(/<div class="actions"><button[^>]*ph-cancel/.test(card(4, { status: 'Done', ph: { phase: 4, x: { client: {}, event: {} }, rfqs: [] } })), 'after phase 3 Cancel intake keeps its own row');
});
