// Part of test/cue.test.js. Feature: AGENT-ACTIONS-2026-11-19 (Kiko 19 Nov 2026 "Approve, Modify, Reject - the cards already has a
// ....that shoes Reply"; mockup approved 05:55:12Z, story CUE-AGENT-ACTIONS-1). A handover waiting for Kiko's approval gets Approve,
// Modify and Reject. Each one is a reply through the same Canvas call as Reply: "approve"; his change lines then "approve"; "reject" or
// "reject: <why>". The Reply box stays.
const actUpd = (n, state, extra) => agdUpd(n, Object.assign({ project: 'Kawayan', project_id: 'S-26632112KA', agent: 'AS agent',
  handover: { handover_ref: 'AS inquiry reqs S-26632112KA', summary: 'Approve the requirements.', state } }, extra || {}));
function actGrab() {
  const page = cuePage(), grab = name => { const a = page.indexOf('  function ' + name + '('); return page.slice(a, page.indexOf('\n  }\n', a) + 4); };
  const ctx = { editing: {}, agdRows: {}, agdRowOpen: {}, agdTick: {}, agdAsk: {}, agdLabel: x => x === 'AS agent' ? 'Account Specialist' : x }; vm.createContext(ctx);
  vm.runInContext(['esc', 'agKv', 'agdNextLines', 'agdWaitDecided', 'agdActsNote', 'agdActsHtml', 'agdUpdHtml'].map(grab).join('\n'), ctx);
  return { page, ctx };
}
const actView = (state, agd) => { const b = agdBox({ drafts: [actUpd(70, state)] }); b.t.ctx.cueAgdTick_(); const v = JSON.parse(JSON.stringify(b.t.ctx.cueView_(b.reqs()[0]))); Object.assign(v.agd, agd || {}); return v; };

test('AA1 a handover waiting for Kiko shows Approve, Modify and Reject, and keeps the Reply box; any other handover has none', () => {
  const { ctx } = actGrab(), h = ctx.agdUpdHtml(actView('Waiting for approval'));
  assert.ok(/<div class="actions"><button class="btn" data-act="agd-ok" data-id="[^"]+">Approve<\/button><button class="btn ghost" data-act="agd-ask" data-mode="modify" data-id="[^"]+">Modify<\/button><button class="btn bad" data-act="agd-ask" data-mode="reject" data-id="[^"]+">Reject<\/button><\/div>/.test(h), h);
  assert.ok(/class="tag warn">Waiting for you/.test(h) && /data-act="agd-reply"/.test(h), 'Reply stays');
  [actView('Delivered'), actView('Waiting for approval', { status: 'Closed' })].forEach(v => { const x = ctx.agdUpdHtml(v);
    assert.ok(!/agd-ok|agd-ask/.test(x), x); });
});
test('AA2 Modify opens a change box with Send and approve; Reject opens an optional reason with Reject; both have Cancel; typed text survives a redraw', () => {
  const { ctx } = actGrab(), v = actView('Waiting for approval');
  ctx.agdAsk[v.id] = { m: 'modify', v: 'N1: Qty=1\nN2: Qty=2' }; const m = ctx.agdUpdHtml(v);
  assert.ok(/<label for="agm-[^"]+">What should change\?<\/label>/.test(m) && /data-agd-mod="[^"]+"[^>]*>N1: Qty=1\nN2: Qty=2<\/textarea>/.test(m), m);
  assert.ok(/One line per change, e\.g\. “N1: Qty=50”\. Account Specialist(?: agent)? saves what you approve and reads it back\./.test(m));
  assert.ok(/data-act="agd-mod-send" data-id="[^"]+">Send and approve<\/button><button class="btn ghost" data-act="agd-ask" data-id="[^"]+">Cancel/.test(m) && !/data-act="agd-ok"/.test(m));
  ctx.agdAsk[v.id] = { m: 'reject', v: 'client "cancelled"' }; const r = ctx.agdUpdHtml(v);
  assert.ok(/<label for="agj-[^"]+">Why\?<\/label> <span class="muted" style="font-weight:400">· optional<\/span>/.test(r) && /data-agd-rej="[^"]+"[^>]*value="client &quot;cancelled&quot;"/.test(r), r);
  assert.ok(/Account Specialist(?: agent)? stops this item\. Nothing is saved in Canvas and nothing is sent\./.test(r) && /class="btn bad" data-act="agd-rej-send" data-id="[^"]+">Reject<\/button><button class="btn ghost" data-act="agd-ask"/.test(r));
});
test('AA3 the reply text: approve; change lines then approve; reject, or reject with the reason; an empty change sends nothing', () => {
  const { ctx } = actGrab();
  assert.strictEqual(ctx.agdActsNote('approve', 'ignored'), 'approve');
  assert.strictEqual(ctx.agdActsNote('modify', ' N1: Qty=50\nN2: Qty=2 '), 'N1: Qty=50\nN2: Qty=2\napprove');
  assert.strictEqual(ctx.agdActsNote('modify', '  '), '');
  assert.strictEqual(ctx.agdActsNote('reject', ''), 'reject');
  assert.strictEqual(ctx.agdActsNote('reject', ' client cancelled '), 'reject: client cancelled');
});
test('AA4 after a tap the card shows Approved or Rejected with the time, and the three buttons go; a plain reply leaves them', () => {
  const { ctx } = actGrab();
  const a = ctx.agdUpdHtml(actView('Waiting for approval', { status: 'Replied', replies: [{ at: '2026-11-19 06:20', text: 'N1: Qty=1\napprove' }] }));
  assert.ok(/class="tag good">Approved 06:20/.test(a) && !/Waiting for you/.test(a) && !/agd-ok|agd-ask/.test(a), a);
  const j = ctx.agdUpdHtml(actView('Waiting for approval', { status: 'Replied', replies: [{ at: '2026-11-19 06:21', text: 'reject: client cancelled' }] }));
  assert.ok(/class="tag">Rejected 06:21/.test(j) && !/agd-ok/.test(j), j);
  const p = ctx.agdUpdHtml(actView('Waiting for approval', { status: 'Replied', replies: [{ at: '2026-11-19 06:22', text: 'skip LightWorks, approve later' }] }));
  assert.ok(/Waiting for you/.test(p) && /data-act="agd-ok"/.test(p), 'a reply that is not a decision keeps the buttons');
});
test('AA5 the page: each button sends one reply through the same Canvas call as Reply, keeps typed text on failure, and Canvas takes it', () => {
  const { page } = actGrab(), chat = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexChat.html'), 'utf8');
  const s = page.indexOf("if (act === 'agd-ok' || act === 'agd-mod-send' || act === 'agd-rej-send')"), d = page.indexOf('if (/^agd-/.test(act))');
  assert.ok(s > d, 'handled inside the agent-draft taps');
  assert.ok(/call\('cueAgdDecide', \[id, \{ decision: 'reply', note: anote \}\], function \(\) \{ delete agdAsk\[id\]; done\(\); \}, fail\)/.test(page));
  assert.ok(/anote\.length > 6000/.test(page) && /agdAsk = \{\}/.test(chat) && /\[data-agd-mod\],\[data-agd-rej\]/.test(page));
  ['approve', 'N1: Qty=1\napprove', 'reject: client cancelled'].forEach((note, i) => {
    const b = agdBox({ drafts: [actUpd(71 + i, 'Waiting for approval')], answer: (a, st) => { const x = st.drafts[0]; Object.assign(x, { status: 'Replied', note: a.note }); return { ok: true, draft: Object.assign({}, x) }; } });
    b.t.ctx.cueAgdTick_(); b.t.ctx.cueAgdDecide(b.reqs()[0].id, { decision: 'reply', note });
    assert.strictEqual(b.st.decide[0].decision, 'reply'); assert.strictEqual(b.st.decide[0].note, note); assert.strictEqual(bridgeCheck('agent_draft_decide', b.st.decide[0]), '');
  });
});
