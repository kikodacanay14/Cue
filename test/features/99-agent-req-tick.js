// Part of test/cue.test.js. Feature: AGENT-REQ-TICK-2026-11-18 (Kiko 18 Nov 2026 12:09:30Z "We can approve it by requirement so that
// other items are already started to be worked on"; 12:10:28Z "maybe do check boxes for each requirement"; mockup approved 12:14:32Z
// "approved. this still expands to show description and image", https://claude.ai/artifact/EtosX5ZVgNR4TVY8mQ7PZS). On an approval
// request each requirement gets a tick box; a row with an open question ("Q1: ...") waits for Kiko's answer. Send decision passes one
// reply: "APPROVE: REQ-ID, REQ-ID", then "Q1: answer" per answer (format agreed with the reply-checks thread, 18 Nov 12:11Z).
const tickRows = [
  { req_id: 'REQ26-31753-01', name: 'Registration setup', sourcing: 'Outsourced', spec_by: 'AS', needs_kiko: false, open_items: [], description: 'Two tables', images: [] },
  { req_id: 'REQ26-31753-04', name: 'Chairs', sourcing: 'In House', spec_by: 'AS', needs_kiko: true, open_items: ['Q1: How many chairs?'] },
  { req_id: 'REQ26-31753-02', name: 'Stage', sourcing: 'Outsourced', spec_by: 'MM', needs_kiko: false, open_items: ['Final colour'] },
  { req_id: 'REQ26-31753-07', name: 'Photo wall', sourcing: 'Outsourced', spec_by: 'MM', needs_kiko: true, open_items: ['Q2: Final size of the photo wall?'] }];
const tickUpd = (n, state, extra) => agdUpd(n, Object.assign({ project: 'Canvas test event', project_id: 'S-31753672CA', agent: 'AS agent',
  handover: { handover_ref: 'REQ-APPROVAL', summary: 'Approve the list.', state, rows: tickRows } }, extra || {}));
function tickGrab() {
  const page = cuePage(), grab = name => { const a = page.indexOf('  function ' + name + '('); return page.slice(a, page.indexOf('\n  }\n', a) + 4); };
  const ctx = { editing: {}, agdRows: {}, agdRowOpen: {}, agdTick: {} }; vm.createContext(ctx);
  vm.runInContext(grab('esc') + '\n' + grab('agKv') + '\n' + grab('agdQs') + '\n' + grab('agdEditVal') + '\n' + grab('agdTickNote') + '\n' + grab('agdQsHtml') + '\n' + grab('agdTallyText') + '\n' + grab('agdRowsHtml') + '\n' + grab('agdUpdHtml'), ctx);
  return { page, ctx };
}
const tickView = (state, agd) => { const b = agdBox({ drafts: [tickUpd(60, state)] }); b.t.ctx.cueAgdTick_(); const v = JSON.parse(JSON.stringify(b.t.ctx.cueView_(b.reqs()[0]))); Object.assign(v.agd, agd || {}); return v; };

test('ART1 an approval request shows a tick box per line; a line with an open question is greyed out and says it waits for Kiko', () => {
  const { ctx } = tickGrab(), v = tickView('Waiting for approval'); ctx.agdRows[v.id] = 'all'; const h = ctx.agdUpdHtml(v);
  assert.ok(/<input type="checkbox" data-agtick="[^"]+" value="REQ26-31753-01" aria-label="Approve Registration setup">/.test(h), h);
  assert.ok(/value="REQ26-31753-02" aria-label="Approve Stage">/.test(h), 'an open item that is not a question does not hold the line');
  assert.ok(/value="REQ26-31753-04" disabled aria-label="Approve Chairs \(waits for your answer\)"/.test(h) && /value="REQ26-31753-07" disabled/.test(h));
  assert.strictEqual((h.match(/class="agwq">Waits for your answer/g) || []).length, 2);
  assert.ok(/data-agtick-all=/.test(h) && /aria-label="Approve every line that is ready"/.test(h), 'one box ticks every ready line');
  assert.ok(/<td class="c agtk" onclick="event\.stopPropagation\(\)">/.test(h), 'a tap on the box does not open or close the row');
  assert.ok(/data-act="agd-tick-send"[^>]*disabled>Send decision/.test(h), 'nothing ticked or answered: Send decision is off');
  assert.ok(/0 of 2 ready lines ticked · 0 answers/.test(h));
  assert.ok(/<b>Questions for you<\/b>/.test(h) && /<b>Q1\. How many chairs\?<\/b><span class="small muted">Chairs · REQ26-31753-04/.test(h) && /data-q="Q2"/.test(h));
  assert.ok(h.indexOf('Q1. How') < h.indexOf('Q2. Final'), 'questions go by number');
  ctx.agdRowOpen[v.id] = 'REQ26-31753-01'; const o = ctx.agdUpdHtml(v);
  assert.ok(/<tr class="agdet"><td colspan="6">.*Description.*Two tables/.test(o), 'the row still opens to show its description (Kiko 12:14:32Z)');
  ctx.agdTick[v.id] = { t: { 'REQ26-31753-01': 1 }, a: { Q2: '3 m by 2.4 m' } }; ctx.agdRowOpen = {}; const t = ctx.agdUpdHtml(v);
  assert.ok(/value="REQ26-31753-01" checked/.test(t) && /data-act="agd-tick-send" data-id="[^"]+">Send decision/.test(t) && /1 of 2 ready lines ticked · 1 answer</.test(t));
  assert.ok(/data-q="Q2" rows="2" placeholder="Type your answer">3 m by 2\.4 m<\/textarea>/.test(t), 'a typed answer survives a redraw');
});
test('ART2 a handover that is not an approval request, or one Kiko can no longer answer, has no tick boxes', () => {
  const { ctx } = tickGrab();
  [tickView('Delivered'), tickView('Waiting for approval', { status: 'Closed' })].forEach(v => { ctx.agdRows[v.id] = 'all'; const h = ctx.agdUpdHtml(v);
    assert.ok(!/data-agtick|agd-tick-send|Questions for you|Waits for your answer/.test(h), h); });
});
test('ART3 the decision text: APPROVE line with the ticked ready lines in row order, then one line per answer; no APPROVE line when none ticked', () => {
  const { ctx } = tickGrab(), rows = tickRows;
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.agdTickNote(rows, { t: { 'REQ26-31753-02': 1, 'REQ26-31753-01': 1, 'REQ26-31753-04': 1 }, a: { Q2: ' 3 m wide\n2.4 m high ', Q1: '120' } }))),
    { note: 'APPROVE: REQ26-31753-01, REQ26-31753-02\nREQ26-31753-01: Execution=Outsourced\nREQ26-31753-02: Execution=Outsourced\nQ1: 120\nQ2: 3 m wide\n2.4 m high', ticked: 2, answered: 2, bad: [] }, 'a waiting line is never approved, even if marked');
  assert.strictEqual(ctx.agdTickNote(rows, { t: {}, a: { Q1: '120', Q2: ' ' } }).note, 'Q1: 120');
  assert.strictEqual(ctx.agdTickNote(rows, { t: { 'REQ26-31753-01': 1 }, a: {} }).note, 'APPROVE: REQ26-31753-01\nREQ26-31753-01: Execution=Outsourced');
  assert.strictEqual(ctx.agdTickNote(rows, undefined).note, '');
});
test('ART4 a line approved in an earlier reply shows Approved and cannot be ticked again; a plain "approve" approves every line', () => {
  const { ctx } = tickGrab();
  const v = tickView('Waiting for approval', { status: 'Replied', note: 'APPROVE: REQ26-31753-01\nQ1: 120', replies: [{ at: '2026-11-18 20:30', text: 'APPROVE: REQ26-31753-01\nQ1: 120' }] });
  ctx.agdRows[v.id] = 'all'; const h = ctx.agdUpdHtml(v);
  assert.ok(/<td class="c agtk"><span class="tag good">Approved<\/span><\/td><td class="c">01/.test(h), h);
  assert.ok(!/value="REQ26-31753-01"/.test(h) && /value="REQ26-31753-02"/.test(h) && /0 of 1 ready line ticked/.test(h));
  const all = tickView('Waiting for approval', { status: 'Replied', replies: [{ at: '2026-11-18 20:31', text: 'Approve' }] }); ctx.agdRows[all.id] = 'all';
  const ha = ctx.agdUpdHtml(all); assert.strictEqual((ha.match(/class="tag good">Approved/g) || []).length, 4); assert.ok(!/data-agtick-all/.test(ha));
});
test('ART5 the page: Send decision passes one reply to Canvas with the decision text, checks it fits, and clears the ticks after', () => {
  const { page } = tickGrab(), css = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexStyle.html'), 'utf8'), chat = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexChat.html'), 'utf8');
  const s = page.indexOf("if (act === 'agd-tick-send')"), d = page.indexOf('if (/^agd-/.test(act))');
  assert.ok(s > d && /call\('cueAgdDecide', \[id, \{ decision: 'reply', note: tn \}\], function \(\) \{ delete agdTick\[id\]; done\(\); \}, fail\)/.test(page));
  assert.ok(/tn\.length > 6000/.test(page), 'Canvas takes a note of up to 6,000 characters (AGENT-CARD-EDIT-2026-11-18)');
  assert.ok(/agdTick = \{\}/.test(chat) && /data-agtick-all/.test(page) && /data-agans/.test(page));
  assert.ok(/\.agdp \.agtick \{[^}]*min-width:44px[^}]*min-height:44px/.test(css), '44 px tap target');
  // The reply goes through the same Canvas call as any reply, and the bridge accepts it.
  const b = agdBox({ drafts: [tickUpd(61, 'Waiting for approval')], answer: (a, st) => { const x = st.drafts[0]; Object.assign(x, { status: 'Replied', note: a.note }); return { ok: true, draft: Object.assign({}, x) }; } });
  b.t.ctx.cueAgdTick_(); const id = b.reqs()[0].id, note = 'APPROVE: REQ26-31753-01, REQ26-31753-02\nQ1: 120';
  b.t.ctx.cueAgdDecide(id, { decision: 'reply', note });
  assert.strictEqual(b.st.decide[0].decision, 'reply'); assert.strictEqual(b.st.decide[0].note, note); assert.strictEqual(bridgeCheck('agent_draft_decide', b.st.decide[0]), '');
});
