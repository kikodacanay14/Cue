// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: phased-intake.
/* ---------- CUE-PHASED (Kiko 14:53Z, specs/phased-intake.md): four approved phases, one card per task ---------- */
function phStart(o = {}) { const t = sandbox(Object.assign({ phased: true }, o)); const id = t.ctx.cueSend(INQ, [], 'intake').request_id; const v = t.ctx.cueRun(id); return Object.assign(t, { id, v }); }
const phPick = (t, v) => t.ctx.cueRfqPick(t.id, { mode: 'line', lines: v.ph.pick.lines.filter(l => l.on).map(l => ({ key: l.key, names: l.suppliers.map(x => x.name) })) });
const writes = t => t.log.bridge.filter(b => /^intake_(add|save|log)/.test(b.action) || b.action === 'submit_intake' || b.action === 'apply_intake').map(b => b.action);
test('PH1 phase 1: GPT reads the details only; nothing goes to Canvas until Approve, which adds the project alone', () => {
  const t = phStart();
  deq([t.v.status, t.v.ph.phase, t.v.stage, t.v.metrics.ai_calls, writes(t)], ['Needs you', 1, 'Project details', 1, []]);
  assert.ok(t.log.claude.length === 0, 'no Claude call before Kiko approves the details');
  const v = t.ctx.cueApprove(t.id, { event: { venue: 'SMX Convention Center' }, client: {} });
  deq([t.log.phProject.length, t.log.phProject[0].project.event.venue, writes(t)], [1, 'SMX Convention Center', ['intake_add_project']]);
  deq([v.ph.phase, v.status, v.canvas.project_id, v.canvas.project_number], [2, 'Needs you', 'S-99900001ZZ', '052']);
  assert.ok(/Added to Canvas as project 052/.test(JSON.stringify(t.tabs.Chat.rows)));
});
test('PH2 phase 2: Claude\'s rows are short (item at most 6 words, spec at most 12); Rescan reads again with Kiko\'s note and writes nothing', () => {
  const t = phStart(); const v = t.ctx.cueApprove(t.id, {});
  const r = v.ph.rows[0];
  deq([r.item, r.spec], ['LED wall with high quality processor', '4m x 3m, P3.9 pitch, with processor, operator and backup power for']);
  assert.ok(v.ph.rows.every(x => x.item.split(' ').length <= 6 && x.spec.split(' ').filter(Boolean).length <= 12));
  deq([v.ph.excluded, v.ph.rows.map(x => x.status)], [['Catering, client supplies it'], ['included', 'optional', 'included']]);
  const w = t.ctx.cueRescan(t.id, 'You missed the stage');
  deq([t.log.breaks, w.ph.phase, w.status, writes(t)], [2, 2, 'Needs you', ['intake_add_project']]);
  assert.ok(/<kiko_note>\nYou missed the stage/.test(t.log.claude[1].messages[0].content[0].text || t.log.claude[1].messages[0].content));
});
test('PH3 phase 2 Approve: Kiko\'s row edits go to Canvas as lines with no costs, then costing runs to the phase 3 card', () => {
  const t = phStart(); t.ctx.cueApprove(t.id, {});
  const v = t.ctx.cueApprove(t.id, { rows: { R1: { quantity: 2 }, R2: { remove: true } }, add: [{ item: 'Stage', spec: '24 x 16 ft', quantity: 1, days: 1 }] });
  const L = t.log.phLines[0];
  deq(L.map(l => [l.key, l.description, l.quantity]), [['R1', 'LED wall with high quality processor, 4m x 3m, P3.9 pitch, with processor, operator and backup power for', 2],
    ['R2', 'Drone light show, 100 drones, 10 minutes', 1], ['R3', 'Stage, 24 x 16 ft', 1]]);
  assert.ok(L.every(l => !('unit_cost' in l) && !('unit_price' in l)), 'no costs in phase 2');
  deq([v.ph.phase, v.status, v.canvas.req_ids.R3, v.ph.lines.length], [3, 'Needs you', 'REQ-3', 3]);
  assert.ok(v.ph.lines.every(l => l.why.split(' ').length <= 25));
});
test('PH4 phase 3 Save prices: Canvas re-checks; changed numbers write nothing and show Canvas\'s; saving again writes and drafts RFQs', () => {
  const t = phStart({ canvasCost: 47000 }); t.ctx.cueApprove(t.id, {}); t.ctx.cueApprove(t.id, {});
  let v = t.ctx.cueApprove(t.id, { lines: { R3: { unit_price: 280000 } } });
  deq([v.ph.phase, v.ph.lines[0].unit_cost, t.log.phCosts.length], [3, 47000, 1]);
  assert.ok(v.notes.some(n => /numbers and they changed/.test(n)));
  v = t.ctx.cueApprove(t.id, {});
  deq([t.log.phCosts.length, v.ph.phase, v.status, v.ph.prices_saved !== '', v.ph.rfqs.length, !!v.ph.pick], [2, 4, 'Needs you', true, 0, true]);
  v = phPick(t, v);
  assert.ok(v.ph.rfqs.length >= 1 && v.ph.rfqs.every(q => q.state === 'open'));
  assert.ok(!/Intake ready for you/.test(JSON.stringify(t.tabs.Chat.rows)), 'no one-card summary line');
});
test('PH5 phase 4: each RFQ is sent, drafted or cancelled on its own; Canvas records each; Done when none is open; 5 AI calls in all', () => {
  const t = phStart(); t.ctx.cueApprove(t.id, {}); t.ctx.cueApprove(t.id, {}); let v = phPick(t, t.ctx.cueApprove(t.id, {}));
  const q = v.ph.rfqs; assert.ok(q.length >= 2, 'two or more RFQs');
  assert.throws(() => t.ctx.cueRfq(t.id, q.findIndex(x => !x.email), 'send', null), /email first/);
  const a = q.findIndex(x => x.email);
  v = t.ctx.cueRfq(t.id, a, 'send', { body: 'Edited by Kiko.\nBlank Space Events' });
  deq([v.ph.rfqs[a].state, t.log.sent.length, t.log.phRfqs[0].state], ['sent', 1, 'sent']);
  assert.ok(/Edited by Kiko/.test(Buffer.from(t.log.gmail[0].split('\r\n\r\n')[1], 'base64').toString()));
  assert.throws(() => t.ctx.cueRfq(t.id, a, 'send', null), /already sent/);
  v.ph.rfqs.forEach((x, i) => { if (x.state === 'open') v = t.ctx.cueRfq(t.id, i, i === q.length - 1 ? 'cancel' : 'draft', null); });
  deq([v.status, v.ph.rfqs.filter(x => x.state === 'open').length, t.log.phRfqs.length], ['Done', 0, q.length]);
  assert.ok(t.tabs.Chat.rows.some(x => x[3] === '>' + t.id && /^Summary for .*project 052 in Canvas; 3 lines; prices saved; 1 RFQ sent/.test(x[2])));
  assert.ok(v.metrics.ai_calls <= 5, 'budget: ' + v.metrics.ai_calls + ' AI calls');
});
test('PH6 one card per task: a reply in the thread while a card waits changes that task in place, never a new run', () => {
  const t = phStart(); t.ctx.cueApprove(t.id, {});
  const before = t.tabs.Requests.rows.length;
  const r = t.ctx.cueSend('you missed the stage, 24x16 ft', [], '', t.id);
  deq([r.request_id, r.in_place, t.tabs.Requests.rows.length], [t.id, true, before]);
  const v = t.ctx.cueRun(t.id);
  deq([t.log.breaks, v.ph.phase, v.status], [2, 2, 'Needs you']);
  assert.ok(/you missed the stage/.test(JSON.stringify(t.log.claude[1])));
  t.ctx.cueApprove(t.id, {});
  t.ctx.cueSend('cost them by item please', [], '', t.id); const w = t.ctx.cueRun(t.id);
  deq([w.ph.phase, t.tabs.Requests.rows.length, t.log.claude.filter(b => /item-level costing/.test(JSON.stringify(b))).length], [3, before, 1]);
});
test('PH7 Reject is one tap with no reason: phase 1 writes nothing; phase 2 leaves the project in Canvas and says so', () => {
  const t = phStart(); let v = t.ctx.cueReject(t.id);
  deq([v.status, writes(t), v.ph.rejected.why], ['Rejected', [], 'Rejected by Kiko at Project details']);
  assert.ok(/Nothing was written to Canvas/.test(JSON.stringify(t.tabs.Chat.rows)));
  const u = phStart(); u.ctx.cueApprove(u.id, {}); v = u.ctx.cueReject(u.id);
  deq([v.status, writes(u)], ['Rejected', ['intake_add_project']]);
  assert.ok(/Project 052 stays in Canvas with no lines/.test(JSON.stringify(u.tabs.Chat.rows)));
  deq(u.ctx.cueReject(u.id).status, 'Rejected', 'a second tap changes nothing');
});
test('PH8 the same-project question still comes first; the switch CUE_PHASED=off keeps the one-card intake', () => {
  const t = phStart({ similar: [{ project_id: 'S-1', name: 'Acme Year-End Party', account: 'Acme Corp', date: '2026-12-12', status: 'For Proposal', why: 'same name' }] });
  deq([t.v.stage, t.v.ph.phase], ['Same project?', 0]);
  const v = t.ctx.cueSameAnswer(t.id, 'new'); deq([v.ph.phase, v.stage], [1, 'Project details']);
  const off = startToCard({}); deq([off.v.phased, !!off.v.proposal], [false, true]);
});

test('PH9 live 15:34Z: a second message about the same project goes into its waiting card, never a second card; both reads merge', () => {
  const r1 = JSON.parse(JSON.stringify(READ)); r1.event.venue = '';
  const r2 = JSON.parse(JSON.stringify(READ)); Object.assign(r2.client, { contact: '', email: '', phone: '' }); r2.event.venue = 'Shangri-La The Fort, Grand Ballroom';
  const t = phStart({ gpt: { intake: [r1, r2] } }), before = t.tabs.Requests.rows.length;
  const r = t.ctx.cueSend('Acme Year-End Party brief again, venue is Shangri-La The Fort Grand Ballroom', [], 'intake');
  deq([r.request_id, r.in_place, t.tabs.Requests.rows.length], [t.id, true, before]);
  const v = t.ctx.cueRun(t.id);
  deq([v.ph.phase, v.ph.x.client.contact, v.ph.x.event.venue], [1, 'Ana Reyes', 'Shangri-La The Fort, Grand Ballroom']);
  assert.ok(t.tabs.Chat.rows.some(x => x[3] === '>' + t.id && /added it to its card/.test(x[2])));
});

test('PH10 live 15:43Z: a tap while the phase is saving is not an error; Canvas still saving shows on the card, not the main chat, and the next tap goes on', () => {
  const t = phStart({ projectStill: 1 }), chat0 = t.tabs.Chat.rows.length;
  const v = t.ctx.cueApprove(t.id, {});
  deq([v.ph.phase, v.status, /still saving this from your earlier tap/.test(v.error)], [1, 'Needs you', true]);
  deq(t.tabs.Chat.rows.length, chat0);
  const L = t.ctx.cueLoad_(t.id); L.s.busy_until = Date.now() + 60000; t.ctx.cueSave_(L.sh, L.row, L.s);
  const n = t.log.phProject.length, w = t.ctx.cueApprove(t.id, {});
  deq([t.log.phProject.length, w.ph.phase], [n, 1]);
  const M = t.ctx.cueLoad_(t.id); delete M.s.busy_until; t.ctx.cueSave_(M.sh, M.row, M.s);
  const x = t.ctx.cueApprove(t.id, {});
  deq([x.ph.phase, x.canvas.project_id, x.error || ''], [2, 'S-99900001ZZ', '']);
});

test('PH12 live 18:40Z: a tap that lands after its phase moved on (Working, or the next card) does nothing and is never an error', () => {
  const t = phStart(); t.ctx.cueApprove(t.id, {});
  const L = t.ctx.cueLoad_(t.id); L.s.status = 'Working'; t.ctx.cueSave_(L.sh, L.row, L.s);
  const chat0 = t.tabs.Chat.rows.length, n = (t.log.phLines || []).length, w = t.ctx.cueApprove(t.id, {});
  deq([(t.log.phLines || []).length, w.status, w.error || '', t.tabs.Chat.rows.length], [n, 'Working', '', chat0]);
});

test('PH14 Kiko 18:47Z: RFQs for which? Per line sends only the picked lines and suppliers; one RFQ for everything covers every line; an added supplier counts', () => {
  const toCard = () => { const t = phStart(); t.ctx.cueApprove(t.id, {}); t.ctx.cueApprove(t.id, {}); return Object.assign(t, { p: t.ctx.cueApprove(t.id, {}) }); };
  const rfqReq = t => { const b = t.log.gpt.filter(x => x.text.format.name === 'rfqs').pop(); return b && JSON.parse(JSON.stringify(b.input).match(/\{\\"event[\s\S]*?\}\]\}(?=")/)[0].replace(/\\"/g, '"')); };
  const a = toCard(), P = a.p.ph.pick;
  deq([a.p.stage, a.p.status, a.p.ph.rfqs.length, P.mode, a.log.gpt.filter(x => x.text.format.name === 'rfqs').length], ['RFQs', 'Needs you', 0, 'line', 0]);
  assert.ok(P.lines.every(l => l.suppliers.length <= 5) && P.all.length <= 5, 'up to 5 suppliers');
  const on = P.lines.filter(l => l.on); assert.ok(on.length >= 1);
  const one = on[0], who = one.suppliers[0].name;
  let v = a.ctx.cueRfqPick(a.id, { mode: 'line', lines: [{ key: one.key, names: [who] }], add: { [one.key]: { name: 'Kiko Pick Co', email: 'quotes@kikopick.example' } } });
  const r = rfqReq(a);
  deq([r.lines.map(l => l.key), r.suppliers.map(x => [x.supplier, x.keys])], [[one.key], [[who, [one.key]], ['Kiko Pick Co', [one.key]]]]);
  deq([v.ph.pick, v.status], [null, 'Needs you']);
  const b = toCard(), names = b.p.ph.pick.all.slice(0, 1).map(x => x.name);
  b.ctx.cueRfqPick(b.id, { mode: 'all', names });
  const r2 = rfqReq(b);
  deq([r2.suppliers.length, r2.suppliers[0].keys, r2.lines.length], [1, b.p.ph.lines.map(l => l.key), b.p.ph.lines.length]);
});
test('PH15 Kiko 18:48Z: picking none (or Skip RFQs) ends the intake with no RFQs and no GPT call; a late tap or a reply on the card changes nothing', () => {
  const t = phStart(); t.ctx.cueApprove(t.id, {}); t.ctx.cueApprove(t.id, {}); t.ctx.cueApprove(t.id, {});
  const g = t.log.gpt.length, chat0 = t.tabs.Chat.rows.length;
  assert.strictEqual(t.ctx.cuePhReply_(t.id, 'only Sonic Pro please', []), null, 'a reply on the picking card is not a redraft');
  deq([t.ctx.cueLoad_(t.id).s.status, t.ctx.cueLoad_(t.id).s.stage], ['Needs you', 'RFQs']);
  let v = t.ctx.cueRfqPick(t.id, { mode: 'line', lines: [] });
  deq([v.status, v.ph.rfqs.length, t.log.gpt.filter(x => x.text.format.name === 'rfqs').length], ['Done', 0, 0]);
  assert.ok(t.tabs.Chat.rows.slice(chat0).some(x => /No RFQs sent: you picked none/.test(x[2])));
  const w = t.ctx.cueRfqPick(t.id, { mode: 'all', names: ['Sonic Pro'] });
  deq([w.status, t.log.gpt.filter(x => x.text.format.name === 'rfqs').length], ['Done', 0]);
});
test('PH16 Kiko 18:47Z: research looks for suppliers until each line has 5, and Claude may name up to 5', () => {
  const t = phStart(); t.ctx.cueApprove(t.id, {}); t.ctx.cueApprove(t.id, {});
  const b = t.log.gpt.filter(x => x.text.format.name === 'research').pop(), j = JSON.stringify(b);
  assert.ok(/\\"need\\":4/.test(j) && /\\"need\\":5/.test(j), 'need = 5 minus the DB suppliers');
  assert.ok(/up to need \(at most 5\)/.test(j));
});

test('PH11 Kiko 15:48Z: Leave blank per line saves no cost and no price, over any suggested or typed number; phase 3 has a one-tap Reject', () => {
  const t = phStart(); t.ctx.cueApprove(t.id, {}); const v3 = t.ctx.cueApprove(t.id, {});
  assert.strictEqual(v3.ph.phase, 3);
  const k = v3.ph.lines[0].key;
  t.ctx.cueApprove(t.id, { lines: { [k]: { blank: true, unit_cost: 999, unit_price: 1500 } } });
  const sent = t.log.phCosts[0].lines.find(l => l.key === k);
  deq([sent.unit_cost, sent.cost_basis, sent.unit_price, sent.price_basis, sent.price_source, sent.sources.length], [0, 'none', 0, 'none', '', 0]);
  const u = phStart(); u.ctx.cueApprove(u.id, {}); u.ctx.cueApprove(u.id, {});
  const r = u.ctx.cueReject(u.id, '');
  deq([r.status, u.log.phCosts || []], ['Rejected', []]);
  assert.ok(u.tabs.Chat.rows.some(x => /stays in Canvas with its lines and no costs/.test(x[2])));
});
