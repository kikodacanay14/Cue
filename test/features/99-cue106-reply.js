// CUE-106 exact reply routing. Synthetic only; no remote services.
function cue106ReplyBox() {
  const t = sandbox(), c = t.ctx, id = 'cue-20261120000000-aaaa';
  const state = { id, kind: 'intake', files: [] }, calls = [];
  c.cueOwner_ = () => {}; c.cueLoad_ = x => x === id ? { s: state, sh: {}, row: 2 } : null;
  c.cueChat_ = (...x) => calls.push(x); c.cueLocked_ = f => f(); c.cueSave_ = () => {};
  c.cueFilesSave_ = f => f.map(x => ({ id: x.id, name: 'receipt.png' }));
  c.cueRoutes_ = () => []; c.cueTalk_ = () => ({ chat: true, start_intake: 'bad guess' });
  return { c, id, state, calls };
}
test('CUE106 reply invalid/stale target fails before any generic routing', () => {
  const t = cue106ReplyBox();
  for (const id of ['bad', 'cue-20261120000000-bbbb']) assert.throws(() => t.c.cueSend('/intake anything', [], '', '', id), /reply target/);
  assert.strictEqual(t.calls.length, 0);
});
test('CUE106 reply files stay on exact task and never create intake', () => {
  const t = cue106ReplyBox(), r = t.c.cueSend('receipt', [{ id: 'file01' }], '', '', t.id);
  assert.strictEqual(r.request_id, t.id); assert.strictEqual(r.chat, true);
  assert.strictEqual(t.state.files[0].id, 'file01');
  assert.ok(t.calls.some(x => x[2] === t.id && /receipt/.test(x[1])));
});
test('CUE106 reply slash is literal, not a command; AI cannot start another intake', () => {
  const t = cue106ReplyBox();
  t.c.cueRoutes_ = () => { throw Error('slash must not route'); };
  assert.strictEqual(t.c.cueSend('/intake another project', [], '', '', t.id).request_id, t.id);
  t.c.cueRoutes_ = () => [];
  assert.strictEqual(t.c.cueSend('normal reply', [], '', '', t.id).start_intake, '');
});
test('CUE106 reply preserves agent target and rejects unsupported k0 attachments', () => {
  const t = cue106ReplyBox(); t.state.kind = 'agentdraft';
  t.c.cueAgdSay_ = (ref, text, has) => ({ ref, text, has });
  assert.strictEqual(t.c.cueSend('hi', [], '', '', t.id).ref, t.id);
  t.state.kind = 'k0'; assert.throws(() => t.c.cueSend('hi', [{id:'f'}], '', '', t.id), /text replies only/);
});
test('CUE106 browser snapshots reply for attachments and restores failed drafts', () => {
  const page = cuePage();
  assert.ok(!page.includes("box === $('box') && !files.length ? replyTo"));
  assert.ok(page.includes('reply: rp, retryFiles: files.slice()'));
  assert.ok(page.includes('back(mine, t); restoreReply(mine); agmMid'));
  assert.ok(page.includes('back(mine, t); restoreReply(mine); alertErr({ message: files[i].name'));
  const fn = page.match(/  function restoreReply\(mine\) \{[\s\S]*?\n  \}/)[0];
  const b = { replyTo: '', pending: [], fileHost: '', renderFiles: () => {}, setReply: id => { b.replyTo = id; } };
  vm.runInNewContext(fn + '; restoreReply({reply:"cue-target",retryFiles:[{id:"f"}]});', b);
  assert.strictEqual(b.replyTo, 'cue-target'); assert.strictEqual(b.pending[0].id, 'f');
});
test('CUE106 slash plus attachment remains a reply, and conflicting target fails closed', () => {
  const t = cue106ReplyBox();
  const r = t.c.cueSend('/intake do not reroute', [{id:'file02'}], '', '', t.id);
  assert.strictEqual(r.request_id, t.id); assert.strictEqual(t.state.files[0].id, 'file02');
  assert.throws(() => t.c.cueSend('hello', [], '', 'cue-20261120000000-bbbb', t.id), /reply target/);
});
test('CUE106 failed attachment save throws without starting intake or changing reply target', () => {
  const t = cue106ReplyBox(); t.c.cueFilesSave_ = () => { throw Error('Drive unavailable'); };
  assert.throws(() => t.c.cueSend('attached', [{id:'f'}], '', '', t.id), /Drive unavailable/);
  assert.strictEqual(t.state.files.length, 0);
  assert.ok(t.calls.every(x => x[2] === '↩' + t.id));
});
