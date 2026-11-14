// Part of test/cue.test.js. Feature: AGENT-REPLIES-2026-11-14 (CueAgentDrafts.gs cueAgdSay_). Kiko 14 Nov 2026 08:44Z "Yes. How do we
// go about agents cant read replies"; card 15:36:53Z "No, all goes to the agent"; mockup approved 16:46:11Z. Everything typed in an
// agent's thread is saved for that agent in Canvas (bridge agent_message) and Cue never acts on it.
function agrBox(o = {}) {
  const st = { msgs: [] };
  const t = sandbox({ bridgeFn: b => {
    if (b.action === 'agent_drafts') return { drafts: [agdUpd(40)] };
    if (b.action === 'agent_message') { st.msgs.push(b.args); if (o.fail) return { ok: false, error: 'Canvas is busy.' }; return { ok: true, message: { message_id: 'DRF-0041', at: '2026-11-14 09:41', text: b.args.text } }; }
  } });
  delete t.props.CUE_AGD_STATE; t.ctx.cueAgdTick_();
  const id = t.tabs.Requests.rows.slice(1).map(r => { try { return JSON.parse(r.slice(10).join('')); } catch (e) { return null; } }).filter(s => s && s.kind === 'agentdraft')[0].id;
  const chat = () => t.tabs.Chat.rows.filter(r => r[3] === id).map(r => r[1] + ': ' + r[2]);
  return { t, st, id, chat };
}
test('AGR1 a line in an agent\'s thread is saved for that agent once; no GPT call, no intake, no other task starts', () => {
  const b = agrBox(), n0 = b.t.tabs.Requests.rows.length, g0 = b.t.log.gpt.length;
  const r = b.t.ctx.cueSend('Add project intake for the Globe party, call time 5 AM', [], '', b.id, '');
  assert.strictEqual(r.agent_message, true);
  assert.strictEqual(b.st.msgs.length, 1); assert.strictEqual(b.st.msgs[0].agent, 'ECII agent'); assert.strictEqual(b.st.msgs[0].text, 'Add project intake for the Globe party, call time 5 AM');
  assert.ok(/^agm:[A-Za-z0-9]{8,}$/.test(b.st.msgs[0].request_id)); assert.strictEqual(bridgeCheck('agent_message', b.st.msgs[0]), '');
  assert.strictEqual(b.t.log.gpt.length, g0, 'no GPT call'); assert.strictEqual(b.t.tabs.Requests.rows.length, n0, 'no new task');
  assert.deepStrictEqual(b.chat().slice(-2), ['Kiko: Add project intake for the Globe party, call time 5 AM', 'Cue: Saved for ECII agent · it reads it on its next run']);
  b.t.ctx.cueAgdSay(b.id, 'Add project intake for the Globe party, call time 5 AM');
  assert.strictEqual(b.st.msgs[1].request_id, b.st.msgs[0].request_id, 'the same line within 10 minutes keeps its request id, so Canvas saves it once');
});
test('AGR2 files are not sent to an agent, a refused save says Not saved, and a Reply on a Cue bubble about the agent goes to the agent too', () => {
  const b = agrBox();
  assert.strictEqual(b.t.ctx.cueSend('here is the floor plan', [{ name: 'plan.pdf', type: 'application/pdf', data: 'eA==' }], '', b.id, '').agent_message, false);
  assert.strictEqual(b.st.msgs.length, 0); assert.ok(/Cue: Agents can't open files\. Send files in the main chat\. Nothing was saved\./.test(b.chat().join('|')));
  b.t.ctx.cueSend('Skip LightWorks', [], '', '', b.id);
  assert.strictEqual(b.st.msgs.length, 1); assert.strictEqual(b.st.msgs[0].text, 'Skip LightWorks');
  assert.ok(b.t.tabs.Chat.rows.some(r => r[3] === '↩' + b.id && r[2] === 'Skip LightWorks'), 'the main chat keeps the quoted line');
  assert.ok(!b.chat().some(l => l === 'Kiko: Skip LightWorks'), 'not logged twice');
  const f = agrBox({ fail: true }), r = f.t.ctx.cueAgdSay(f.id, 'Use the new call time');
  assert.strictEqual(r.agent_message, false); assert.ok(/^Cue: Not saved: Canvas is busy\.$/.test(f.chat().slice(-1)[0]), f.chat().join('|'));
  assert.ok(/'cueAgdSay'/.test(fs.readFileSync(path.join(__dirname, '..', 'src', 'CueCheck.gs'), 'utf8')), 'a check never messages an agent');
});
test('AGR3 the page: an agent thread sends with cueAgdSay, the save status is a small line, Not saved has Try again, and the box names the agent', () => {
  const page = cuePage();
  assert.ok(/if \(ref && \(byId\(\)\[ref\] \|\| \{\}\)\.agd\) return agentSay\(t, !!withFiles, ref, box\);/.test(page));
  assert.ok(/call\('cueAgdSay', \[ref, t\]/.test(page) && /data-agm-retry/.test(page) && /'Message ' \+ ag/.test(page) && /Cue does not act on them\. Ask Cue in the main chat\./.test(page));
  const box = tcBox(false); box.ACT_RE = /^(Saved)\b/;
  const h1 = box.msgHtml({ who: 'Cue', text: 'Saved for ECII agent · it reads it on its next run', request_id: 'cue-1' }, '', true);
  assert.strictEqual(h1, '<div class="small muted agm">Saved for ECII agent · it reads it on its next run</div>');
  const h2 = box.msgHtml({ who: 'Cue', text: 'Not saved: Canvas is busy.', request_id: 'cue-1' }, '', true);
  assert.ok(/^<div class="err agm">Not saved: Canvas is busy\. <button class="linkbtn" data-agm-retry="cue-1">Try again<\/button><\/div>$/.test(h2), h2);
  assert.ok(/id="tagnote" hidden/.test(fs.readFileSync(path.join(__dirname, '..', 'src', 'Index.html'), 'utf8')));
});
