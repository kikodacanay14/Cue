tests.push(['106 slash help and unknown commands stay in chat without intake', () => {
  const t = sandbox();
  assert.match(t.ctx.cueSend('/commands', [], '').reply, /\/intake/);
  assert.match(t.ctx.cueSend('/deploy this is a long unknown command', [], '').reply, /Unknown.*\/commands/i);
  assert.match(t.ctx.cueSend('/generate proposal', [], '').reply, /not available/i);
  assert.match(t.ctx.cueSend('/intakeplease this is not an intake command', [], '').reply, /Unknown/);
}]);
tests.push(['106 explicit intake uses the existing intake path and requires a brief', () => {
  const t = sandbox();
  assert.match(t.ctx.cueSend('/intake', [], '').reply, /brief/i);
  const x = t.ctx.cueSend('/intake Stage rehearsal in Manila on November 27', [], '');
  assert.equal(t.state(x.request_id).kind, 'intake');
  assert.match(t.state(x.request_id).text, /Stage rehearsal/);
}]);
tests.push(['106 multiword slash commands dispatch through the correct existing workflow', () => {
  const t = sandbox(), seen = [];
  t.ctx.cueFinance_ = (text) => { seen.push(text); return { chat: true }; };
  t.ctx.cueTriSaid_ = (text) => { seen.push(text); return { request_id: 'cue-123456' }; };
  t.ctx.cueSend('/FiNaNcE DeTaIl KLM', [], '');
  t.ctx.cueSend('/finance req KLM', [], '');
  t.ctx.cueSend('/add task confirm access to KLM', [], '');
  assert.deepEqual(seen, ['finance detail for KLM', 'finance payment requests for KLM', 'add task confirm access to KLM']);
}]);
tests.push(['106 slash email opens a draft request, never an email send', () => {
  const t = sandbox();
  assert.match(t.ctx.cueSend('/email Alex', [], '').reply, /about/i);
  const x = t.ctx.cueSend('/email Alex about the artwork deadline', [], '');
  const st = t.state(x.request_id);
  assert.equal(st.kind, 'email');
  assert.equal(st.mail.to, 'Alex');
  assert.equal(st.mail.about, 'the artwork deadline');
  assert.equal(st.status, 'Working');
}]);
