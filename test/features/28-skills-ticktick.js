// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: skills-ticktick.
/* ---------- skills and TickTick (Kiko 17:26Z, specs/cue-skills-connectors.md) ---------- */
test('SK1 the Data, Superpowers and Product design skills are seeded once as Chat processes; they shape the chat reply only, never intake or costing calls', () => {
  const t = sandbox({ props: { CUE_SKILLS_SEEDED: '' } });
  t.ctx.cueTeachLoad_();
  deq(t.tabs.Workflows.rows.slice(1).map(r => [r[1], r[3], r[12]]), [['Analyze data', 'Chat', true], ['Brainstorm an idea', 'Chat', true], ['Write a plan', 'Chat', true], ['Review a design', 'Chat', true]]);
  assert.ok(/^1\. Code: Read the sheet/.test(t.tabs.Workflows.rows[1][6]));
  t.ctx.cueTeachReset_(); t.ctx.cueTeachLoad_(); deq(t.tabs.Workflows.rows.length, 5, 'written once');
  assert.ok(/approved process "Brainstorm an idea"/.test(t.ctx.cueTeachFor_('brainstorm some ideas for a launch concept', 'chat')));
  deq(t.ctx.cueTeachFor_('brainstorm some ideas for a launch concept', 'cost'), '', 'not on other calls');
  t.ctx.cueSend('can you brainstorm ideas for the Acme launch concept?', [], '');
  assert.ok(/Brainstorm an idea/.test(t.log.gpt[0].instructions), 'the chat call carries it');
  const u = sandbox({ props: { CUE_SKILLS_SEEDED: '' }, before: null }); u.tabs.Workflows = sheetMock(); u.tabs.Workflows.appendRow(['h']); u.tabs.Workflows.appendRow(['', 'Write a plan', 3]);
  u.ctx.cueTeachLoad_(); deq(u.tabs.Workflows.rows.filter(r => r[1] === 'Write a plan').length, 1, 'Kiko\'s own version is never doubled');
});

const TTALK = todo => ({ reply: 'Sure.', looks_like_inquiry: false, todo: Object.assign({ job: 'add', title: 'Call Ana about the Acme brief', due: '2026-10-23', note: 'ask for pax' }, todo) });
test('TT1 a to-do from the same chat call (no extra AI call): Add or Skip; nothing reaches TickTick before Add; Add creates it once, as shown', () => {
  const t = sandbox({ talk: TTALK(), props: { CUE_TICKTICK_TOKEN: 'tt-token-not-real' } });
  t.ctx.cueSend('add to my ticktick: call Ana about the Acme brief on Friday, ask for pax', [], '');
  deq([t.log.gpt.length, t.log.claude.length, (t.log.tt || []).length], [1, 0, 0]);
  const q = askLine(t); assert.ok(/^Add to TickTick: "Call Ana about the Acme brief", due 2026-10-23\?$/.test(q[2]) && /:add,skip$/.test(q[3]));
  t.ctx.cueAskPick(askId(q), 'add');
  deq(t.log.tt.map(x => [x.method, x.url.replace(/^.*open\/v1/, ''), x.auth]), [['post', '/task', 'Bearer tt-token-not-real']]);
  deq(t.log.tt[0].body, { title: 'Call Ana about the Acme brief', content: 'ask for pax', timeZone: 'Asia/Manila', dueDate: '2026-10-23T00:00:00+0800', startDate: '2026-10-23T00:00:00+0800', isAllDay: true });
  assert.ok(/^Added to TickTick/.test(t.tabs.Chat.rows.pop()[2]));
  assert.throws(() => t.ctx.cueAskPick(askId(q), 'add'), /already answered/); deq(t.log.tt.length, 1, 'never twice');
  const k = sandbox({ talk: TTALK(), props: { CUE_TICKTICK_TOKEN: 'x' } }); k.ctx.cueSend('add call Ana to ticktick', [], ''); k.ctx.cueAskPick(askId(askLine(k)), 'skip');
  deq((k.log.tt || []).length, 0); assert.ok(/not added/.test(k.tabs.Chat.rows.pop()[2]));
  const e = sandbox({ talk: TTALK(), props: { CUE_TICKTICK_TOKEN: 'old' }, tt: () => resp(401, {}) }); e.ctx.cueSend('add call Ana to ticktick', [], ''); e.ctx.cueAskPick(askId(askLine(e)), 'add');
  assert.ok(/sign-in expired/.test(e.tabs.Chat.rows.pop()[2]), 'a TickTick error is said plainly');
});

test('TT2 not connected: no question, says how; "connect ticktick" (no AI call) gives setup steps, then a sign-in link; the callback checks state and keeps the token out of chat', () => {
  const t = sandbox({ talk: TTALK() });
  t.ctx.cueSend('add review Unilever quote to my TickTick', [], '');
  const q0 = askLine(t); assert.ok(/^TickTick is not connected yet, so Add keeps this to-do/.test(q0[2]) && /:add,skip$/.test(q0[3]), 'the card shows, and says it first');
  t.ctx.cueAskPick(askId(q0), 'add'); deq((t.log.tt || []).length, 0); assert.ok(/^Kept: /.test(t.tabs.Chat.rows.pop()[2]));
  t.ctx.cueSend('connect ticktick', [], ''); deq(t.log.gpt.length, 1, 'no AI call');
  assert.ok(/developer\.ticktick\.com/.test(t.tabs.Chat.rows.pop()[2]));
  t.ctx.PropertiesService.getScriptProperties().setProperty('CUE_TICKTICK_CLIENT_ID', 'cid'); t.ctx.PropertiesService.getScriptProperties().setProperty('CUE_TICKTICK_CLIENT_SECRET', 'csecret');
  t.ctx.cueSend('Connect TickTick', [], '');
  const link = t.tabs.Chat.rows.pop()[2]; assert.ok(/https:\/\/ticktick\.com\/oauth\/authorize\?scope=tasks%3Awrite%20tasks%3Aread&client_id=cid&state=1234abcd000040008000/.test(link) && /redirect_uri=https%3A%2F%2Fscript\.google\.com/.test(link));
  assert.ok(/old/.test(t.ctx.doGet({ parameter: { code: 'c1', state: 'wrong' } }).html)); deq((t.log.tt || []).length, 0, 'a wrong state never trades the code');
  const ok = t.ctx.doGet({ parameter: { code: 'c1', state: '1234abcd00004000800000000000beef' } });
  assert.ok(/connected/.test(ok.html)); deq(t.log.tt[0].auth, 'Basic ' + Buffer.from('cid:csecret').toString('base64'));
  deq(t.ctx.PropertiesService.getScriptProperties().getProperty('CUE_TICKTICK_TOKEN'), 'tt-token-not-real');
  deq(t.log.tt.map(x => x.url.replace(/^.*ticktick\.com/, '')), ['/oauth/token', '/open/v1/task'], 'the kept to-do is added after sign-in');
  deq(t.log.tt[1].body.title, 'Call Ana about the Acme brief'); deq(t.ctx.PropertiesService.getScriptProperties().getProperty('CUE_TICKTICK_PENDING'), '[]');
  assert.ok(/Added the to-do you kept/.test(t.tabs.Chat.rows.filter(r => /connected/.test(r[2])).pop()[2]));
  assert.ok(!t.tabs.Chat.rows.some(r => /tt-token-not-real/.test(r[2])), 'the token never shows in chat');
  assert.ok(/old/.test(t.ctx.doGet({ parameter: { code: 'c1', state: '1234abcd00004000800000000000beef' } }).html), 'one use per link');
});

test('TT3 "what\'s on my TickTick": open tasks only, soonest due first; read only', () => {
  const t = sandbox({ talk: TTALK({ job: 'list', title: '', due: '', note: '' }), props: { CUE_TICKTICK_TOKEN: 'x' } });
  t.ctx.cueSend('what\'s on my ticktick?', [], '');
  const out = t.tabs.Chat.rows.pop()[2];
  assert.ok(/^On your TickTick \(2 open\):\n- Pay Sonic Pro \(due 2026-10-2\d\)\n- Call Ana$/.test(out), out);
  deq(t.log.tt.map(x => x.method), ['get']); assert.ok(!askLine(t));
});

test('TC12 PC test 17:30Z: a short item-and-name message GPT would act on asks intake or supplier search through cueSend, even when GPT is sure; greetings and clear asks do not; replies are English unless Kiko writes Tagalog', () => {
  const sure = Object.assign(VTALK(), { sure: true, choices: [] });
  const t = sandbox({ talk: sure }); const out = t.ctx.cueSend('LED wall for AMI Group', [], '');
  deq([out.chat, !!out.ask, t.tabs.Requests.rows.length, t.log.gpt.length], [true, true, 1, 1]);
  const q = askLine(t); assert.ok(/:intake,vendor,chat$/.test(q[3]) && /Did you mean Project intake or Supplier search\?/.test(q[2]), q[2]);
  const go = t.ctx.cueAskPick(askId(q), 'vendor'); deq(t.ctx.cueLoad_(go.request_id).s.kind, 'vendor');
  const b = sandbox({ talk: sure }); b.ctx.cueSend('LED wall', [], ''); assert.ok(/:intake,vendor,chat$/.test(askLine(b)[3]));
  const c = sandbox({ talk: sure }); const o2 = c.ctx.cueSend('find suppliers for an LED wall in Cebu', [], ''); assert.ok(!askLine(c) && o2.request_id, 'a clear ask starts at once');
  const d = sandbox(); d.ctx.cueSend('good morning', [], ''); assert.ok(!askLine(d), 'a plain chat reply asks nothing');
  assert.ok(/Reply in English unless Kiko's own message is in Tagalog or Taglish/.test(t.log.gpt[0].instructions));
});

test('TC13 "remember:" for a rule that was switched off turns it back on and asks Keep or Undo; one already on says where to find it', () => {
  const t = sandbox();
  t.ctx.cueSend('remember: RFQs never go out from info@', [], ''); t.ctx.cueAskPick(askId(askLine(t)), 'undo');
  deq(t.tabs.Memory.rows[1][0], false);
  t.ctx.cueSend('remember: RFQs never go out from info@', [], '');
  deq([t.tabs.Memory.rows.length, t.tabs.Memory.rows[1][0]], [2, true]); assert.ok(/^Learned: /.test(askLine(t)[2]) && !/^!/.test(String(t.tabs.Chat.rows.pop()[3])));
  t.ctx.cueSend('remember: RFQs never go out from info@', [], '');
  assert.ok(/already have that rule, and it is on\. See it under My rules/.test(t.tabs.Chat.rows.pop()[2]));
});

test('SK2 "write a plan for …" is answered in chat with the Write a plan process, never a workflow map; "map the workflow" still maps', () => {
  const talk = { reply: 'Here is the plan.', looks_like_inquiry: false, workflow: { job: 'map', name: 'Onboarding a new freelancer' } };
  const t = sandbox({ talk });
  const out = t.ctx.cueSend('write a plan for onboarding a new freelancer', [], '');
  assert.ok(!out.workflow && !out.request_id, 'no map started'); deq(t.log.claude.length, 0);
  assert.ok(!t.tabs.Requests.rows.slice(1).length, 'no task');
  deq(t.ctx.cuePlanAsk_('map the freelancer onboarding workflow'), false);
  deq(t.ctx.cuePlanAsk_('write a plan', 'workflow'), false, 'Kiko picking Workflow map still maps');
  deq(t.ctx.cuePlanAsk_('brainstorm launch ideas'), true);
});

test('TC14 PC test 17:42Z + Personality: a vague message that GPT only answered still asks; the picked voice goes in the chat call only and can be edited or switched off; Settings shows processes and connections, never tokens', () => {
  const t = sandbox({ talk: { reply: 'No Canvas project matched AMI Group, say the name or S-ID.', looks_like_inquiry: false, sure: true, choices: [] } });
  t.ctx.cueSend('LED wall for AMI Group', [], '');
  const q = askLine(t); assert.ok(q && /:intake,vendor,chat$/.test(q[3]) && !/No Canvas project/.test(q[2]), q && q[2]);
  assert.ok(/Your voice in the reply field only.*Warm and witty/.test(t.log.gpt[0].instructions), 'default voice is the one Kiko picked');
  let v = t.ctx.cueMyRules(); deq([v.voice.row, v.voice.on, /^Warm and witty/.test(v.voice.text)], [0, true, true]);
  assert.ok(!v.rows.some(x => x.topic === 'personality'));
  v = t.ctx.cueMyRuleSave({ voice: 'Crisp chief of staff: numbered, no small talk.', on: true });
  deq([v.voice.on, v.voice.text, v.rows.length], [true, 'Crisp chief of staff: numbered, no small talk.', 0]);
  t.ctx.cueSend('hello there', [], ''); assert.ok(/Crisp chief of staff/.test(t.log.gpt[1].instructions) && !/Warm and witty/.test(t.log.gpt[1].instructions));
  assert.ok(!/Crisp chief/.test(t.ctx.cueTeachFor_('chief of staff numbered')), 'the voice is not a memory fact for other calls');
  t.ctx.cueMyRuleSave({ voice: 'Crisp chief of staff: numbered, no small talk.', on: false });
  t.ctx.cueSend('hello again', [], ''); assert.ok(!/Your voice in the reply field/.test(t.log.gpt[2].instructions), 'switched off: no voice');
  deq(t.tabs.Memory.rows.filter(r => r[1] === 'personality').length, 1, 'one row, updated in place');
  const st = sandbox({ props: { CUE_TICKTICK_TOKEN: 'secret-tt', CUE_HUBSPOT_TOKEN: '' } }).ctx.cueSettings();
  deq([st.ticktick, st.hubspot, JSON.stringify(st).indexOf('secret-tt')], [true, false, -1]);
  assert.throws(() => t.ctx.cueFileData('../x'), /No such file/);
});

test('SK3 a long written plan reaches the chat whole (no cut at 3,000), with room to finish (4,000 output tokens on plan asks only)', () => {
  const plan = 'Plan for onboarding a new freelancer.\n' + Array.from({ length: 60 }, (_, i) => (i + 1) + '. Step ' + (i + 1) + ': I\'ll make Gmail drafts and a checklist for this part.').join('\n');
  const t = sandbox({ talk: { reply: plan, looks_like_inquiry: false } });
  t.ctx.cueSend('write a plan for onboarding a new freelancer', [], '');
  assert.ok(plan.length > 3000); deq(t.tabs.Chat.rows.pop()[2], plan);
  deq(t.log.gpt[0].max_output_tokens, 4000);
  t.ctx.cueSend('how are you?', [], ''); deq(t.log.gpt[1].max_output_tokens, 1500, 'small talk keeps the small limit');
  const cut = t.ctx.cueReplyCut_('One. Two. ' + 'x'.repeat(50), 14); deq(cut, 'One. Two.\n(cut short)');
});

test('SK4 a plan ask about another topic never joins an open task thread (main chat answers); one naming the task\'s client does; no "the that" line', () => {
  const t = startToCard();
  t.opts.talk = { reply: 'Here is the plan.', looks_like_inquiry: false, task: t.id };
  const n = t.tabs.Chat.rows.length;
  const out = t.ctx.cueSend('Write a plan for a client thank-you campaign', [], '');
  deq(out.task, ''); deq(t.tabs.Chat.rows.slice(n).map(r => [r[1], r[3]]), [['Kiko', ''], ['Cue', '']], 'answered in the main chat');
  const back = t.ctx.cueSend('write a plan for the Acme party setup', [], '');
  deq(back.task, t.id); const line = t.tabs.Chat.rows.filter(r => r[3] === '>' + t.id).pop()[2];
  assert.ok(/^Answered in the Acme Corp/.test(line) && !/the that/.test(line), line);
});

test('TC15 Kiko 18:00Z: a pasted phrasebook or memory list starts Learn my memory through cueSend (no chat call, no expense), with or without the prefix; the page skips expense() for it; a client brief and a one-line expense do not', () => {
  const book = 'What you say\nWhat it means\n“Record project expense”\nSave the transaction to the correct project, scope and supplier entry.\n“Under…”\nUse the category or scope you specify.\n“Approved” / “Go ahead”\nExecute the specific proposal already presented.\n“How much?” / “So many words”\nLead with the amount.';
  const list = 'Kiko prefers short answers.\nKiko uses BDO and GCash.\nKiko wants receipts kept separate.\nBSE handles events.\nKiko works in Manila time.';
  const brief = 'Hi BSE,\nWe need a 3-day booth at SMX.\nLED wall 4x3m\nSound system\nIngress Nov 5, event Nov 6-8.\nPlease send a quote.';
  [book, list, 'Please read this and learn my memory\n' + list].forEach((say, i) => {
    const t = sandbox(), out = t.ctx.cueSend(say, [], '');
    deq([t.log.gpt.length, t.state(out.request_id).kind, t.state(out.request_id).text], [0, 'memory', 'Learn my memory'], 'paste ' + i);
  });
  const c = sandbox().ctx; deq([c.cueMemPaste_(brief), c.cueMemPaste_('Record project expense 500 for AMI tarp'), c.cueMemPaste_('learn my memory')], [false, false, true]);
  const page = fs.readFileSync(path.join(__dirname, '..', 'src', 'Index.html'), 'utf8');
  assert.ok(/EXP_RE\.test\(t\) && !memPaste\(t\)/.test(page), 'the page does not send a pasted list to expense()');
  const fn = page.match(/function memPaste\(t\) \{[\s\S]*?\n  \}\n/)[0], box = {}; vm.runInNewContext(fn + 'out = [memPaste(a), memPaste(b), memPaste(c), memPaste(d)];', Object.assign(box, { a: book, b: list, c: brief, d: 'Record project expense 500 for AMI tarp' }));
  deq(box.out, [true, true, false, false], 'page and server agree');
});
