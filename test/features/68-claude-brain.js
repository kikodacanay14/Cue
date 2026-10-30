// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: Claude as Cue's chat brain (CueAgent.gs, Cue.gs cueTalk_).
/* ---------- Claude answers Ask Cue chat and looks things up first (Kiko 30 Oct 2026 03:53Z picked "Claude inside Ask Cue") ---------- */
const agUse = (name, input, id) => ({ type: 'tool_use', id: id || 'tu_' + name, name, input });
const agMsg = (blocks, stop) => resp(200, { model: 'claude-sonnet-5-5', stop_reason: stop || 'tool_use', usage: { input_tokens: 3000, output_tokens: 200, cache_read_input_tokens: 2000 }, content: blocks });
/** Claude's rounds in order: each entry is the content of one reply. Round bodies are kept in t.log.agent. */
const agScript = rounds => (body, n) => agMsg(rounds[Math.min(n, rounds.length) - 1]);
const agResults = body => body.messages.filter(m => m.role === 'user' && Array.isArray(m.content)).map(m => m.content.map(c => c.content || c.text).join('\n')).join('\n');

test('CB1 the AMI Group ask (30 Oct 11:30 Manila): Claude looks Rommel Siena and Archie up, then the email card has both addresses; no GPT chat call, nothing sent', () => {
  const answer = mailAsk({ job: 'new', to: 'rommel.siena@amigroup.com.ph, archie.cruz@amigroup.com.ph', audience: 'client', about: 'Follow up the AMI Group projects', project: '' });
  const t = ctSandbox({ talk: answer, agent: agScript([[{ type: 'text', text: 'Looking them up.' }, agUse('find_contact', { names: ['Rommel Siena', 'Archie'], company: 'AMI Group' })],
    [agUse('answer', answer)]]) });
  const out = t.ctx.cueSend('email Rommel Siena and Archie about the AMI projects', [], '');
  assert.strictEqual(t.log.agent.length, 2, 'two rounds: the lookup, then the answer');
  const seen = agResults(t.log.agent[1]);
  assert.ok(/Rommel Siena: rommel\.siena@amigroup\.com\.ph \(from Canvas P0 Contacts/.test(seen) && /Archie: archie\.cruz@amigroup\.com\.ph \(from your Gmail/.test(seen), seen);
  assert.ok(!t.log.gpt.some(g => g.text.format.name === 'chat'), 'Claude answered; the GPT form call did not run');
  const v = t.ctx.cueRun(out.request_id);
  assert.strictEqual(v.mail.draft.to, 'rommel.siena@amigroup.com.ph, archie.cruz@amigroup.com.ph');
  assert.ok(!(t.log.sent || []).length && !t.log.gmail.length, 'nothing sent or drafted before Kiko taps');
});

test('CB2 "find Ruth at Moldex\'s email": one lookup, the address from Canvas reaches Claude, Claude\'s reply is the chat answer', () => {
  const t = ctSandbox({ agent: agScript([[agUse('find_contact', { names: ['Ruth'], company: 'Moldex' })],
    [agUse('answer', { reply: 'Ruth Andres at Moldex: ruth.andres@moldex.example (from Canvas P0 Contacts).', sure: true })]]) });
  const r = t.ctx.cueSend("find Ruth at Moldex's email", [], 'chat');
  assert.ok(/Ruth: ruth\.andres@moldex\.example \(from Canvas P0 Contacts \(Moldex\)\)/.test(agResults(t.log.agent[1])), agResults(t.log.agent[1]));
  assert.strictEqual(r.reply, 'Ruth Andres at Moldex: ruth.andres@moldex.example (from Canvas P0 Contacts).');
  assert.strictEqual(t.tabs.Requests.rows.length, 1, 'a question starts no task');
  deq(t.tabs['AI Runs'].rows.slice(1).map(x => [x[2], x[3], x[9], x[10]]), [['chat', 'Claude', 'OK', 'tools: find_contact'], ['chat', 'Claude', 'OK', 'tools: answer']]);
});

test('CB3 the request: Sonnet 5.5, low effort, Cue\'s rules and voice cached, the chat form as the answer tool; the tools only read', () => {
  const t = ctSandbox({ agent: agScript([[agUse('answer', { reply: 'Hi Kiko.', sure: true })]]) });
  t.ctx.cueSend('hello there Cue', [], 'chat');
  const b = t.log.agent[0];
  assert.strictEqual(b.model, 'claude-sonnet-5-5'); deq(b.output_config, { effort: 'low' }); assert.ok(!b.tool_choice, 'auto: Sonnet 5.5 refuses forced tool use');
  assert.ok(/^You are Cue, the personal assistant/.test(b.system[0].text) && /You are Claude, working as Cue/.test(b.system[0].text)); deq(b.system[0].cache_control, { type: 'ephemeral' });
  deq(b.tools.map(x => x.name), ['find_contact', 'search_gmail', 'read_email', 'find_project', 'canvas_tabs', 'canvas_read', 'add_work_days', 'answer']);
  deq(b.tools[7].cache_control, { type: 'ephemeral' }); deq(Object.keys(b.tools[7].input_schema.properties).sort(), CHAT_FIELDS);
  assert.ok(/Hello there Cue|hello there Cue/.test(b.messages[0].content) && /Today is /.test(b.messages[0].content));
  assert.ok(/The tools only read: you send and write nothing yourself/.test(b.system[0].text));
});

test('CB4 every tool reads only: Gmail search and one email, Canvas tabs and rows, projects, working days; no draft, send or Canvas write', () => {
  const MAIL = CT_MAIL.concat([{ id: 'att0001', date: '2026-10-28T02:00:00Z', h: { From: 'Lea Go <lea@amigroup.com.ph>', To: 'kiko@example.com', Subject: 'Floor plan' }, body: 'See the floor plan.' }]);
  const t = ctSandbox({ ctMail: MAIL }), s = { id: 'chat-x', metrics: { ai_calls: 0, calls: [] } }, run = (n, a) => t.ctx.cueAgentTool_(s, n, a);
  const g = run('search_gmail', { query: '"AMI Christmas"' });
  assert.ok(/^id ct1 \| 2026-10-01 \| from "Archie Cruz" <archie\.cruz@amigroup\.com\.ph> \| to Kiko <kiko@example\.com> \| AMI Christmas party brief \| snip$/.test(g), g);
  assert.ok(/-in:chats -in:drafts$/.test(t.log.ctQ.pop()));
  const e = run('read_email', { id: 'ct3' });
  assert.ok(/^From: Lea Go <lea@amigroup\.com\.ph>\nTo: kiko@example\.com\nDate: 2026-08-01\nSubject: Team list\nThread: ct3\nAttachments: none\n/.test(e) && /carlo\.mendoza@amigroup\.com\.ph/.test(e), e);
  assert.strictEqual(run('read_email', { id: 'x' }), 'That is not an email id from search_gmail.');
  assert.strictEqual(run('read_email', { id: 'nosuch1' }), 'Gmail has no email with id nosuch1.');
  assert.strictEqual(run('canvas_tabs', {}), 'priority / P0 Contacts');
  const rows = JSON.parse(run('canvas_read', { book: 'priority', tab: 'P0 Contacts', column: 'Company', contains: 'Moldex' }));
  assert.ok(rows.length >= 1 && rows.every(x => !('_row' in x)) && rows.some(x => x['Contact Name'] === 'Ruth Andres'), JSON.stringify(rows));
  assert.strictEqual(run('add_work_days', { from: '2026-10-30', days: 1 }), '2026-11-02 (Monday to Friday; Philippine holidays are not counted)');
  assert.strictEqual(run('add_work_days', { from: '30 Oct', days: 1 }), 'Give from as YYYY-MM-DD and days from 0 to 365.');
  assert.strictEqual(run('nope', {}), 'No such tool.');
  assert.ok(!t.log.gmail.length && !(t.log.sent || []).length, 'no draft, no send');
  assert.ok(t.log.bridge.every(b => ['allow_list', 'read_rows', 'search_projects'].indexOf(b.action) >= 0), t.log.bridge.map(b => b.action).join());
});

test('CB5 Claude unreachable, refusing or never answering: the GPT form call answers, so Kiko always gets a reply; a text-only round gets one nudge', () => {
  const down = ctSandbox({ agent: () => resp(529, { type: 'error', error: { type: 'overloaded_error', message: 'busy' } }) });
  assert.strictEqual(down.ctx.cueSend('hello there Cue', [], 'chat').reply, 'Doing well! Ready when you are.');
  assert.strictEqual(down.log.agent.length, 2, 'one retry on 529'); assert.strictEqual(down.log.gpt.filter(g => g.text.format.name === 'chat').length, 1);
  const no = ctSandbox({ agent: () => agMsg([], 'refusal') }); no.ctx.cueSend('hello there Cue', [], 'chat');
  assert.strictEqual(no.log.agent.length, 1); assert.strictEqual(no.log.gpt.filter(g => g.text.format.name === 'chat').length, 1);
  const loop = ctSandbox({ agent: () => agMsg([agUse('find_project', { text: 'Acme' })]) }); loop.ctx.cueSend('hello there Cue', [], 'chat');
  assert.strictEqual(loop.log.agent.length, 6, 'six rounds at most'); assert.strictEqual(loop.log.gpt.filter(g => g.text.format.name === 'chat').length, 1);
  const talk = ctSandbox({ agent: agScript([[{ type: 'text', text: 'Hi!' }], [agUse('answer', { reply: 'Hi Kiko.', sure: true })]]) });
  assert.strictEqual(talk.ctx.cueSend('hello there Cue', [], 'chat').reply, 'Hi Kiko.');
  deq(talk.log.agent[1].messages.slice(-1)[0].content, [{ type: 'text', text: 'Call the answer tool now.' }]);
});

test('CB6 a field Claude leaves out of the answer gets its empty value, so the code after it reads one shape', () => {
  const t = sandbox({}), d = t.ctx.cueAgentFill_({ reply: 'Hi.' }, vm.runInContext('CUE_TALK_SCHEMA_', t.ctx));
  deq([d.reply, d.start_intake, d.sure, d.looks_like_inquiry, d.choices, d.email, d.vendor], ['Hi.', '', true, false, [], null, null]);
  deq(Object.keys(d).sort(), CHAT_FIELDS);
});
