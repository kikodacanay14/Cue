// Part of test/cue.test.js. Feature: AGENT-TAG-2026-11-15 (CueAgentDrafts.gs cueAgdTag_, Cue.gs cueSendWith_, IndexThreads.html). Kiko
// 15 Nov 2026 08:30:07Z "is it possible for me to type in the new Cue and tag the agent name like @ Account Specialist and Cue sends the
// message to the Account Specialist agent"; scope and mockup approved 09:24:50Z ("Approve, one agent per message"); "build" 11:26:04Z.
function tagBox(o = {}) {
  const st = { msgs: [] };
  const t = sandbox({ bridgeFn: b => {
    if (b.action === 'agent_drafts') return { drafts: [agdUpd(40), agdUpd(41, { agent: 'Account Specialist' }), agdUpd(42, { agent: 'Account Specialist' })] };
    if (b.action === 'agent_message') { st.msgs.push(b.args); if (o.fail) return { ok: false, error: 'Canvas is busy.' }; return { ok: true, message: { message_id: 'DRF-0043', at: '2026-11-15 11:41', text: b.args.text } }; }
  } });
  delete t.props.CUE_AGD_STATE; t.ctx.cueAgdTick_();
  const reqs = () => t.tabs.Requests.rows.slice(1).map(r => { try { return JSON.parse(r.slice(10).join('')); } catch (e) { return null; } }).filter(s => s && s.kind === 'agentdraft');
  const root = a => reqs().filter(s => s.agd.agent === a && !s.ref)[0].id;
  const rows = id => t.tabs.Chat.rows.filter(r => r[3] === id).map(r => r[1] + ': ' + r[2]);
  return { t, st, root, rows };
}
test('TAG1 "@Account Specialist ..." in the main chat is saved once for that agent, shows in its thread and in the main chat, and nothing else runs', () => {
  const b = tagBox(), as = b.root('Account Specialist'), n0 = b.t.tabs.Requests.rows.length, g0 = b.t.log.gpt.length;
  const r = b.t.ctx.cueSend('@account  specialist, Skip LightWorks, they are on hold', [], '', '', '', 'tagmsg00001');
  assert.strictEqual(r.agent_message, true); assert.strictEqual(r.agent, 'Account Specialist'); assert.strictEqual(r.thread, as);
  assert.strictEqual(b.st.msgs.length, 1); assert.deepStrictEqual([b.st.msgs[0].agent, b.st.msgs[0].text, b.st.msgs[0].request_id], ['Account Specialist', 'Skip LightWorks, they are on hold', 'agm:tagmsg00001']);
  assert.strictEqual(bridgeCheck('agent_message', b.st.msgs[0]), '');
  assert.strictEqual(b.t.log.gpt.length, g0, 'no GPT call'); assert.strictEqual(b.t.tabs.Requests.rows.length, n0, 'no new task');
  assert.deepStrictEqual(b.rows('@' + as), ['Kiko: @Account Specialist Skip LightWorks, they are on hold', 'Cue: Saved for Account Specialist · it reads it on its next run']);
  assert.deepStrictEqual(b.rows(as).slice(-2), ['Kiko: Skip LightWorks, they are on hold', 'Cue: Saved for Account Specialist · it reads it on its next run']);
  assert.ok(!b.t.tabs.Chat.rows.some(r => r[3] === '' && /LightWorks/.test(r[2])), 'never a plain main-chat row, so Cue\'s assistant never reads it');
});
test('TAG2 only a leading @ with a known name counts: unknown names send nothing, mid-line @ and untagged text reach Cue as before, one agent per message', () => {
  const b = tagBox();
  assert.throws(() => b.t.ctx.cueSend('@Acount Specialist chase LightWorks today', [], '', '', ''), /No agent is called "Acount Specialist"\. Pick one from the list, or delete the @ to ask Cue\. Nothing was sent\./);
  assert.throws(() => b.t.ctx.cueSend('@Account Specialist', [], '', '', ''), /Type your message after Account Specialist\./);
  assert.throws(() => b.t.ctx.cueSend('@Account Specialistx hi', [], '', '', ''), /No agent is called/, 'a name must end at a word break');
  assert.strictEqual(b.st.msgs.length, 0);
  const tag = b.t.ctx.cueAgdTag_, ag = [{ agent: 'ECII agent', ref: 'cue-a' }, { agent: 'ECII agent Two', ref: 'cue-b' }];
  assert.strictEqual(tag('Email john@acme.com the plan', ag), null); assert.strictEqual(tag('Call at @ 5 PM', ag), null);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(tag('@ecii agent two: ask for the LED quote', ag))), { agent: 'ECII agent Two', ref: 'cue-b', rest: 'ask for the LED quote' }, 'the longest name wins');
  const r = b.t.ctx.cueSend('@ECII agent tell @Account Specialist the call time is 5 AM', [], '', '', '');
  assert.strictEqual(r.agent, 'ECII agent'); assert.strictEqual(b.st.msgs.length, 1); assert.strictEqual(b.st.msgs[0].text, 'tell @Account Specialist the call time is 5 AM', 'a second @ is plain text');
  const agents = JSON.parse(JSON.stringify(b.t.ctx.cueAgdAgents_().map(a => a.agent))); assert.deepStrictEqual(agents.sort(), ['Account Specialist', 'ECII agent']);
});
test('TAG3 files with a tag are refused, a failed save says Not saved in both places and Try again resends it, a tag wins over a Reply', () => {
  const b = tagBox(), as = b.root('Account Specialist');
  const f = b.t.ctx.cueSend('@Account Specialist here is the plan', [{ name: 'plan.pdf', type: 'application/pdf', data: 'eA==' }], '', '', '');
  assert.strictEqual(f.agent_message, false); assert.strictEqual(b.st.msgs.length, 0);
  assert.ok(/Cue: Agents can't open files\./.test(b.rows('@' + as).join('|')));
  const st = { fail: true }, c = tagBox(st), cs = c.root('Account Specialist');
  const r = c.t.ctx.cueSend('@Account Specialist Hold the payouts', [], '', '', '', 'failmsg0001');
  assert.strictEqual(r.agent_message, false);
  assert.ok(/^Cue: Not saved: Canvas is busy\. \[agm:failmsg0001\]$/.test(c.rows('@' + cs).slice(-1)[0]), c.rows('@' + cs).join('|'));
  assert.ok(/^Cue: Not saved: Canvas is busy\. \[agm:failmsg0001\]$/.test(c.rows(cs).slice(-1)[0]));
  st.fail = false; assert.strictEqual(c.t.ctx.cueAgdRetry(cs, 'failmsg0001').agent_message, true);
  assert.strictEqual(c.rows('@' + cs).slice(-1)[0], 'Cue: Saved for Account Specialist · it reads it on its next run', 'Try again answers in the main chat too');
  const ecii = c.root('ECII agent'), n = c.st.msgs.length;
  c.t.ctx.cueSend('@Account Specialist Use the 5 AM call time', [], '', '', ecii);
  assert.strictEqual(c.st.msgs[n].agent, 'Account Specialist');
});
test('TAG4 the page: @ opens the agent list, Enter picks, unknown names stay in the box with a red note, and the main chat draws the tag', () => {
  const page = cuePage();
  assert.ok(/function tagAgents\(\)/.test(page) && /function tagOpen\(\)/.test(page) && /data-tag-pick/.test(page));
  assert.ok(/if \(tagState\.open && \(e\.key === 'Enter'/.test(page), 'Enter picks while the list is open');
  assert.ok(/No agent is called "/.test(page) && /delete the @ to ask Cue\. Nothing was sent\./.test(page));
  assert.ok(/m\.request_id\.charAt\(0\) === '@'/.test(page), 'the main chat draws "@<thread>" rows');
  assert.ok(/Type @ to send a message to one agent\. Without @, Cue answers as today\./.test(page));
  const idx = fs.readFileSync(path.join(__dirname, '..', 'src', 'Index.html'), 'utf8');
  assert.ok(/<ul class="taglist" id="taglist" role="listbox" aria-label="Agents" hidden><\/ul>/.test(idx) && /id="tagerr" role="alert" hidden/.test(idx) && /placeholder="Ask Cue, or type @ for an agent\./.test(idx));
  assert.ok(/!\/\[\\p\{L\}\\p\{N\}\]\/u\.test\(low\.charAt\(n\.length\)\)/.test(page), 'the page ends a name at a word break, like the server');
});
