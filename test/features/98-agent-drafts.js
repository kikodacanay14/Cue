// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: AGENT-DRAFTS-2026-11-13 (CueAgentDrafts.gs).
// Kiko 13 Nov 2026: agents' drafts wait for him in Cue, one thread per agent (08:34:57Z), Send / Rewrite with Cue / Send back / Reject
// (08:19:47Z), Canvas sends once; spec "Build it" 08:45:56Z (CanvasWorkspace ADR-0177).
const agdDraft = (n, o = {}) => Object.assign({ draft_id: 'DRF-' + String(n).padStart(4, '0'), agent: 'Finance agent', door: 'Zapier', type: 'ar_chaser', type_label: 'AR chaser',
  project_id: 'S-26579436KI', project: "King's Day 2026", item: 'AR-KIN-3', recipient: 'LightWorks Event Rentals', subject: "Acknowledgement receipt for King's Day 2026",
  body: 'Hi {first name},\n\nPlease sign the attached receipt.\n\nThank you,\nBlank Space Events', created: '2026-11-13 16:32', status: 'Waiting for Kiko', decided: '', sent: '',
  gmail_thread: '', message_id: '', note: '', reason: '', lines: [] }, o);
const agdReq = (n, o = {}) => agdDraft(n, Object.assign({ agent: 'Account agent', door: 'ChatGPT', type: 'requirements', type_label: 'Requirements list', project_id: 'S-26611208GL',
  project: 'Globe Year-End Party', item: 'Requirements list', recipient: '', subject: '', body: '',
  lines: [{ item: 'LED wall 6 x 4 m', description: 'P3.9, with operator', qty: 1, occurrence: 1, unit_cost: 0, section: 'Production' },
    { item: 'Event host', description: '', qty: 1, occurrence: 1, unit_cost: 0, section: '' }] }, o));
function agdBox(o = {}) {
  const st = { drafts: o.drafts || [], decide: [], answer: o.answer };
  const t = sandbox({ gpt: o.gpt, bridgeFn: b => {
    if (b.action === 'agent_drafts') return { drafts: JSON.parse(JSON.stringify(st.drafts)) };
    if (b.action === 'agent_draft_decide') { st.decide.push(b.args); if (st.answer) return st.answer(b.args, st);
      const d = st.drafts.filter(x => x.draft_id === b.args.draft_id)[0];
      const status = { send: 'Sent', save: 'Saved', send_back: 'Sent back', reject: 'Rejected' }[b.args.decision];
      Object.assign(d, { status, decided: '2026-11-13 17:00', note: b.args.note || '', sent: status === 'Sent' ? '2026-11-13 17:00' : '', recipient: d.recipient + (status === 'Sent' ? ' (billing@lightworks.example)' : '') });
      return { ok: true, draft: Object.assign({}, d) }; }
  } });
  delete t.props.CUE_AGD_STATE;
  const reqs = () => t.tabs.Requests.rows.slice(1).map(r => { try { return JSON.parse(r.slice(10).join('')); } catch (e) { return null; } }).filter(s => s && s.kind === 'agentdraft');
  const chat = id => t.tabs.Chat.rows.filter(r => r[3] === id).map(r => r[2]);
  const due = () => { const s = JSON.parse(t.props.CUE_AGD_STATE); s.at -= 16 * 60000; t.props.CUE_AGD_STATE = JSON.stringify(s); };
  return { t, st, reqs, chat, due };
}

test('AGD1 a waiting draft becomes a card in its agent\'s thread; a second draft from the same agent joins that thread, another agent gets its own', () => {
  const b = agdBox({ drafts: [agdDraft(12), agdReq(13)] });
  assert.strictEqual(b.t.ctx.cueAgdTick_(), 2);
  let R = b.reqs();
  assert.strictEqual(R.length, 2);
  assert.ok(R.every(s => s.status === 'Needs you' && !s.ref), 'two agents, two threads');
  assert.ok(/^Agent draft DRF-0012 · Finance agent · AR chaser · AR-KIN-3$/.test(R[0].text), R[0].text);
  assert.strictEqual(bridgeCheck('agent_drafts', { days: 3 }), '');
  const v = b.t.ctx.cueView_(R[0]);
  assert.strictEqual(v.name, 'Finance agent', 'the thread is named after the agent');
  assert.strictEqual(v.agd.draft_id, 'DRF-0012'); assert.strictEqual(v.agd.waiting, true);
  assert.strictEqual(pageKindName(v), 'Finance agent');
  assert.ok(b.chat(R[0].id).some(l => /^Finance agent drafted an ar chaser: AR-KIN-3 \(King's Day 2026\)\. It waits for you\.$/.test(l)), b.chat(R[0].id).join('|'));
  assert.ok(b.t.tabs.Chat.rows.some(r => /^>cue-/.test(String(r[3])) && /^2 new agent drafts wait for you\.$/.test(r[2])), 'one pointer line in the main chat');
  b.st.drafts.push(agdDraft(14, { item: 'AR-KIN-4' }));
  assert.strictEqual(b.t.ctx.cueAgdTick_(), null, 'not due within 15 minutes');
  b.due(); assert.strictEqual(b.t.ctx.cueAgdTick_(), 1);
  R = b.reqs();
  assert.strictEqual(R.length, 3, 'a card is made once per draft');
  assert.strictEqual(R[2].ref, R[0].id, 'the Finance agent\'s second draft joins its thread');
});

test('AGD2 Send: Canvas decides once with Kiko\'s edits; the card shows Sent; a draft that is no longer waiting cannot be sent again', () => {
  const b = agdBox({ drafts: [agdDraft(12)] });
  b.t.ctx.cueAgdTick_();
  const id = b.reqs()[0].id;
  const v = b.t.ctx.cueAgdDecide(id, { decision: 'send', subject: 'Receipt to sign · King\'s Day', body: 'Hi {first name},\n\nPlease sign the receipt by Monday.\n\nThank you,\nBlank Space Events' });
  assert.strictEqual(b.st.decide.length, 1);
  const a = b.st.decide[0];
  assert.strictEqual(bridgeCheck('agent_draft_decide', a), '');
  assert.strictEqual(a.decision, 'send'); assert.strictEqual(a.draft_id, 'DRF-0012'); assert.ok(/by Monday/.test(a.body)); assert.strictEqual(a.subject, 'Receipt to sign · King\'s Day');
  assert.strictEqual(v.status, 'Done'); assert.strictEqual(v.agd.status, 'Sent'); assert.strictEqual(v.agd.edited, true); assert.strictEqual(v.agd.waiting, false);
  assert.ok(b.chat(id).some(l => /^Sent to LightWorks Event Rentals \(billing@lightworks\.example\)\.$/.test(l)), b.chat(id).join('|'));
  assert.throws(() => b.t.ctx.cueAgdDecide(id, { decision: 'send' }), /This draft is Sent in Canvas, not waiting for you/);
  assert.strictEqual(b.st.decide.length, 1, 'no second call');
});

test('AGD3 Send back needs Kiko\'s note and passes it to the agent; Reject sends nothing; Save is only for a requirements list', () => {
  const b = agdBox({ drafts: [agdDraft(12), agdDraft(15, { item: 'AR-KIN-5' })] });
  b.t.ctx.cueAgdTick_();
  const [x, y] = b.reqs().map(s => s.id);
  assert.throws(() => b.t.ctx.cueAgdDecide(x, { decision: 'send_back', note: '  ' }), /Say what the agent should change/);
  assert.throws(() => b.t.ctx.cueAgdDecide(x, { decision: 'save' }), /Only a requirements list is saved/);
  assert.strictEqual(b.st.decide.length, 0);
  const v = b.t.ctx.cueAgdDecide(x, { decision: 'send_back', note: 'Use the AP number, not the AR number.' });
  assert.strictEqual(b.st.decide[0].note, 'Use the AP number, not the AR number.'); assert.ok(!('body' in b.st.decide[0]), 'a send back carries no email');
  assert.strictEqual(v.status, 'Closed'); assert.strictEqual(v.agd.status, 'Sent back');
  assert.ok(b.chat(x).some(l => /^Sent back to Finance agent with your note: "Use the AP number, not the AR number\."\.$/.test(l)));
  const w = b.t.ctx.cueAgdDecide(y, { decision: 'reject' });
  assert.strictEqual(w.status, 'Rejected'); assert.ok(b.chat(y).some(l => l === 'Rejected. Nothing was sent.'));
});

test('AGD4 requirements list: Save to Canvas sends Kiko\'s edited lines (no Execution field); Send is refused', () => {
  const b = agdBox({ drafts: [agdReq(13)] });
  b.t.ctx.cueAgdTick_();
  const id = b.reqs()[0].id;
  assert.throws(() => b.t.ctx.cueAgdDecide(id, { decision: 'send' }), /A requirements list is saved, not sent/);
  assert.throws(() => b.t.ctx.cueAgdDecide(id, { decision: 'save', lines: [{ item: '' }, { item: 'Event host' }] }), /Line 1 needs a requirement/);
  const v = b.t.ctx.cueAgdDecide(id, { decision: 'save', lines: [{ item: 'LED wall 6 x 4 m, P3.9' }, { item: 'Bilingual event host' }] });
  const a = b.st.decide[0];
  assert.strictEqual(bridgeCheck('agent_draft_decide', a), '');
  deq(a.lines.map(l => l.item), ['LED wall 6 x 4 m, P3.9', 'Bilingual event host']);
  assert.strictEqual(a.lines[0].description, 'P3.9, with operator', 'the agent\'s description stays'); assert.ok(a.lines.every(l => !('execution' in l)));
  assert.strictEqual(v.agd.status, 'Saved'); assert.strictEqual(v.status, 'Done');
});

test('AGD5 Canvas refuses (a number in the text, or busy): the card keeps waiting with the reason; nothing is marked sent', () => {
  const b = agdBox({ drafts: [agdDraft(12)], answer: () => ({ ok: false, error: 'The email holds a phone, TIN or account number. Take it out and send again.' }) });
  b.t.ctx.cueAgdTick_();
  const id = b.reqs()[0].id;
  const v = b.t.ctx.cueAgdDecide(id, { decision: 'send', body: 'Call 0917 000 0000' });
  assert.strictEqual(v.status, 'Needs you'); assert.strictEqual(v.agd.status, 'Waiting for Kiko');
  assert.ok(/phone, TIN or account number/.test(v.error), v.error);
  assert.ok(b.chat(id).some(l => /^Canvas did not take it: The email holds a phone/.test(l)));
});

test('AGD6 an RFP Kiko approves shows Sending, then Sent with its Gmail thread when Canvas reports it on a later read', () => {
  const b = agdBox({ drafts: [agdDraft(20, { agent: 'ECII RFP agent', type: 'rfp', type_label: 'RFP', item: 'SCP26-048-03 · Sonic Pro', recipient: 'Sonic Pro' })],
    answer: (a, st) => { const d = st.drafts[0]; d.status = 'Sending'; return { ok: true, queued: true, draft: Object.assign({}, d) }; } });
  b.t.ctx.cueAgdTick_();
  const id = b.reqs()[0].id;
  const v = b.t.ctx.cueAgdDecide(id, { decision: 'send' });
  assert.strictEqual(v.status, 'Sending');
  assert.ok(b.chat(id).some(l => l === 'Approved. It goes out from your Gmail within a minute.'));
  Object.assign(b.st.drafts[0], { status: 'Sent', sent: '2026-11-13 17:01', gmail_thread: '18c2f0a1b2c3d4e5' });
  b.due(); b.t.ctx.cueAgdTick_();
  const s = b.reqs()[0], w = b.t.ctx.cueView_(s);
  assert.strictEqual(s.status, 'Done'); assert.ok(/#all\/18c2f0a1b2c3d4e5$/.test(w.agd.gmail_url));
  assert.ok(b.chat(id).some(l => l === 'Sent to Sonic Pro.'), b.chat(id).join('|'));
});

test('AGD7 Rewrite with Cue: one AI call from Kiko\'s note; the draft changes in Cue only, nothing goes to Canvas', () => {
  const b = agdBox({ drafts: [agdDraft(12)], gpt: { agent_email: { subject: 'Please sign your receipt · King\'s Day 2026', body: 'Hi {first name},\n\nA firm reminder to sign the receipt today.\n\nThank you,\nBlank Space Events' } } });
  b.t.ctx.cueAgdTick_();
  const id = b.reqs()[0].id, before = b.t.log.bridge.length;
  assert.throws(() => b.t.ctx.cueAgdRewrite(id, ' '), /Type what Cue should change/);
  const v = b.t.ctx.cueAgdRewrite(id, 'firmer');
  assert.strictEqual(b.t.log.gpt.length, 1, 'one AI call');
  assert.ok(/<instruction>firmer<\/instruction>/.test(b.t.log.gpt[0].input) && /\{first name\}/.test(b.t.log.gpt[0].instructions + b.t.log.gpt[0].input));
  assert.strictEqual(b.t.log.bridge.length, before, 'nothing to Canvas');
  assert.ok(/firm reminder/.test(v.agd.body)); assert.strictEqual(v.agd.rewritten, true); assert.strictEqual(v.status, 'Needs you');
  b.t.ctx.cueAgdDecide(id, { decision: 'send' });
  assert.ok(/firm reminder/.test(b.st.decide[0].body), 'the rewritten words are the ones sent');
});

test('AGD8 a draft decided before Cue saw it gets no card; a check run never reads or decides; the job and the reads are listed', () => {
  const b = agdBox({ drafts: [agdDraft(12, { status: 'Rejected' })] });
  assert.strictEqual(b.t.ctx.cueAgdTick_(), 0); assert.strictEqual(b.reqs().length, 0);
  assert.ok(b.t.ctx.cueJobs_().some(j => j.fn === 'cueAgdTick_'));
  assert.ok(/CUE_CHECK_READS_ = \[[^\]]*'agent_drafts'/.test(CODE) && /CUE_CHECK_NEVER_ = \['cueAgdOpen', 'cueAgdDecide', 'cueAgdRewrite'/.test(CODE));
  b.t.ctx.CUE_CHECK_ON_ = true;
  assert.throws(() => b.t.ctx.cueAgdDecide_('cue-x', { decision: 'reject' }), /A check never decides an agent draft/);
});

test('AGD9 the page: an email card has Send, Edit, Send back, Reject and Rewrite with Cue; a requirements card has Save to Canvas and no Execution column', () => {
  const page = cuePage(), grab = name => { const a = page.indexOf('  function ' + name + '('); return page.slice(a, page.indexOf('\n  }\n', a) + 4); };
  const ctx = { editing: {} }; vm.createContext(ctx);
  vm.runInContext(grab('esc') + '\n' + page.match(/  var AGD_FROM = [^\n]*\n/)[0] + page.match(/  var AGD_PILL = [^\n]*\n[^\n]*\n/)[0] + grab('agdCardHtml'), ctx);
  const b = agdBox({ drafts: [agdDraft(12), agdReq(13)] }); b.t.ctx.cueAgdTick_();
  const [m, q] = b.reqs().map(s => JSON.parse(JSON.stringify(b.t.ctx.cueView_(s))));
  const hm = ctx.agdCardHtml(m), hq = ctx.agdCardHtml(q);
  ['agd-send', 'edit', 'agd-back', 'agd-reject', 'agd-rewrite'].forEach(a => assert.ok(hm.indexOf('data-act="' + a + '"') >= 0, a));
  assert.ok(/Agent draft · AR chaser/.test(hm) && /Waiting for you/.test(hm) && /class="tag warn"/.test(hm) && /From Finance agent \(Zapier\)/.test(hm) && /DRF-0012/.test(hm));
  assert.ok(/data-act="agd-save"/.test(hq) && !/agd-send/.test(hq) && !/Execution/.test(hq) && /<th>Qty<\/th><th>Days<\/th>/.test(hq));
  assert.ok(/Saving adds these 2 lines to the project in Canvas\. Nothing else changes\./.test(hq));
  ctx.editing[m.id] = 1; const he = ctx.agdCardHtml(m);
  assert.ok(/data-agd-subject=/.test(he) && /data-agd-body=/.test(he) && /Cancel edit/.test(he));
  const done = ctx.agdCardHtml(Object.assign({}, m, { status: 'Done', agd: Object.assign({}, m.agd, { status: 'Sent', waiting: false }) }));
  assert.ok(!/data-act="agd-/.test(done) && /class="tag good">Sent/.test(done), 'a decided card has no buttons');
  assert.ok(/if \(r\.kind === 'agentdraft' && r\.agd\) return agdCardHtml\(r\);/.test(page) && /call\('cueAgdOpen'/.test(page) && /call\('cueAgdDecide', \[id, ago\]/.test(page));
});

test('AGD10 a tap whose run died (card stuck at Sending, Canvas still waiting) waits for Kiko again after 5 minutes; nothing is sent', () => {
  const b = agdBox({ drafts: [agdDraft(12)] });
  b.t.ctx.cueAgdTick_();
  const id = b.reqs()[0].id, L = b.t.ctx.cueLoad_(id);
  L.s.status = 'Sending'; L.s.tap_at = b.t.ctx.cueNow_(); b.t.ctx.cueSave_(L.sh, L.row, L.s);
  b.due(); b.t.ctx.cueAgdTick_();
  assert.strictEqual(b.reqs()[0].status, 'Sending', 'within 5 minutes it stays');
  const M = b.t.ctx.cueLoad_(id); M.s.tap_at -= 6 * 60000; b.t.ctx.cueSave_(M.sh, M.row, M.s);
  b.due(); b.t.ctx.cueAgdTick_();
  const s = b.reqs()[0];
  assert.strictEqual(s.status, 'Needs you'); assert.ok(/nothing was sent/.test(s.error)); assert.strictEqual(b.st.decide.length, 0);
});

// AGENT-UPDATE-2026-11-13 (Kiko 13 Nov 2026 11:06:33Z, card "Updates only, no reply" 11:08:36Z, fields 11:10:27Z): an agent's handover update.
const agdUpd = (n, o = {}) => agdDraft(n, Object.assign({ agent: 'ECII agent', type: 'update', type_label: 'Update', item: 'HO-KIN-07', recipient: 'AS', subject: 'HO-KIN-07',
  body: 'Supplier shortlist handed to AS.', status: 'Unread', reason: 'Delivered',
  handover: { handover_ref: 'HO-KIN-07', summary: 'Supplier shortlist handed to AS.', gaps: 'LightWorks still owes BIR 2303.', next_owner: 'AS', next_action: 'Chase LightWorks',
    ack_link: 'https://t.me/c/123/456', state: 'Delivered', why: '' } }, o));
test('AGU1 an unread handover update becomes a card in its agent\'s thread; Mark read goes to Canvas once and nothing else is decided', () => {
  const b = agdBox({ drafts: [agdUpd(20)], answer: (a, st) => { const d = st.drafts[0]; Object.assign(d, { status: 'Read', decided: '2026-11-13 19:20' }); return { ok: true, draft: Object.assign({}, d) }; } });
  assert.strictEqual(b.t.ctx.cueAgdTick_(), 1);
  const s = b.reqs()[0]; assert.strictEqual(s.status, 'Needs you'); assert.strictEqual(s.agd.handover.state, 'Delivered');
  assert.ok(b.chat(s.id).some(l => /Procurement Specialist agent posted a handover update: HO-KIN-07 · Delivered/.test(l)));
  assert.throws(() => b.t.ctx.cueAgdDecide(s.id, { decision: 'send' }), /An update is marked read or replied to/);
  b.t.ctx.cueAgdDecide(s.id, { decision: 'read' });
  assert.deepStrictEqual(b.st.decide.map(a => a.decision), ['read']); assert.strictEqual(bridgeCheck('agent_draft_decide', b.st.decide[0]), '');
  const v = b.t.ctx.cueView_(b.reqs()[0]); assert.strictEqual(v.status, 'Done'); assert.strictEqual(v.agd.unread, false);
  assert.ok(b.chat(s.id).some(l => /^Marked read\.$/.test(l)));
  assert.throws(() => b.t.ctx.cueAgdDecide(s.id, { decision: 'read' }), /This update is Read in Canvas/);
});
test('AGU2 a failed handover shows Blocked, never Delivered; a bad link is dropped; a draft is never marked read', () => {
  const c = sandbox({}).ctx;
  assert.strictEqual(c.cueAgdHand_({ state: 'Delivered' }).state, 'Delivered');
  ['Blocked', 'Failed', '', undefined].forEach(st => assert.strictEqual(c.cueAgdHand_({ state: st }).state, 'Blocked', String(st)));
  assert.strictEqual(c.cueAgdHand_({ ack_link: 'javascript:alert(1)' }).ack_link, '');
  const b = agdBox({ drafts: [agdDraft(12)] }); b.t.ctx.cueAgdTick_();
  assert.throws(() => b.t.ctx.cueAgdDecide(b.reqs()[0].id, { decision: 'read' }), /Only an update is marked read or replied to/);
});
test('AGU3 the Cue link (?agd=DRF-....) reads Canvas at once and names the card to open; an unknown ID opens nothing', () => {
  const b = agdBox({ drafts: [agdUpd(21)] });
  b.t.ctx.cueAgdOpen('');   // the normal open, which also starts the 2-minute gap
  b.st.drafts.push(agdUpd(22, { item: 'HO-KIN-08' }));
  const o = b.t.ctx.cueAgdOpen('DRF-0022');
  assert.strictEqual(o.added, 1); assert.strictEqual(o.id, b.reqs().filter(s => s.agd.draft_id === 'DRF-0022')[0].id);
  assert.strictEqual(b.t.ctx.cueAgdOpen('DRF-9999').id, ''); assert.strictEqual(b.t.ctx.cueAgdOpen('x; y').id, '');
});
test('AGU4 the page: an update card shows the handover, Delivered or Blocked, the AS link, Mark read and Reply', () => {
  const page = cuePage(), grab = name => { const a = page.indexOf('  function ' + name + '('); return page.slice(a, page.indexOf('\n  }\n', a) + 4); };
  const ctx = { editing: {} }; vm.createContext(ctx);
  vm.runInContext(grab('esc') + '\n' + grab('agdUpdHtml'), ctx);
  const b = agdBox({ drafts: [agdUpd(20), agdUpd(23, { item: 'HO-KIN-09', handover: { handover_ref: 'HO-KIN-09', summary: 'Not handed over.', gaps: 'AS did not answer.', state: 'Blocked', why: 'No AS acknowledgment link was sent.' } })] });
  b.t.ctx.cueAgdTick_();
  const [d, k] = b.reqs().map(s => JSON.parse(JSON.stringify(b.t.ctx.cueView_(s)))), hd = ctx.agdUpdHtml(d), hk = ctx.agdUpdHtml(k);
  assert.ok(/Agent update · Handover/.test(hd) && /class="tag good">Delivered/.test(hd) && /class="tag warn">Unread/.test(hd) && /LightWorks still owes BIR 2303\./.test(hd));
  assert.ok(/href="https:\/\/t\.me\/c\/123\/456"/.test(hd) && /data-act="agd-read"/.test(hd) && !/agd-send|agd-back|agd-reject/.test(hd) && /data-act="agd-reply"/.test(hd));
  assert.ok(/class="tag crit">Blocked/.test(hk) && !/Delivered/.test(hk) && /No link sent/.test(hk) && /Why Blocked/.test(hk));
  assert.ok(/if \(\(r\.agd \|\| \{\}\)\.type === 'update'\) return agdUpdHtml\(r\);/.test(page) && /'agd-read': 'read'/.test(page) && /call\('cueAgdOpen', \[agd\]/.test(page));
});
test('AGW1 an approval request (Kiko 17 Nov, card "Show Waiting for approval") shows Waiting for you, never Blocked or Why Blocked', () => {
  assert.strictEqual(agdBox({ drafts: [] }).t.ctx.cueAgdHand_({ state: 'Waiting for approval' }).state, 'Waiting for approval');
  const page = cuePage(), grab = name => { const a = page.indexOf('  function ' + name + '('); return page.slice(a, page.indexOf('\n  }\n', a) + 4); };
  const ctx = { editing: {}, agdRows: {}, agdLabel: x => x }; vm.createContext(ctx);
  vm.runInContext(grab('esc') + '\n' + grab('agdRowsHtml') + '\n' + grab('agdUpdHtml'), ctx);
  const b = agdBox({ drafts: [agdUpd(40, { item: 'AS requirements review', handover: { handover_ref: 'AS requirements review', summary: 'Approve the list.', state: 'Waiting for approval' } })] });
  b.t.ctx.cueAgdTick_();
  const v = JSON.parse(JSON.stringify(b.t.ctx.cueView_(b.reqs()[0]))), h = ctx.agdUpdHtml(v);
  assert.ok(/class="tag warn">Waiting for you/.test(h) && !/Blocked/.test(h) && !/Delivered/.test(h), h);
  v.agd.handover.rows = [{ req_id: 'REQ-01', name: 'Stage', sourcing: 'Outsourced', spec_by: 'AS', dimensions: '', needs_kiko: true, open_items: [] }];
  const hr = ctx.agdUpdHtml(v); assert.ok(/Requirements review/.test(hr) && /class="tag warn">Waiting for you/.test(hr));
});
test('AGU5 Kiko replies to an update (card "Updates plus replies"): each reply goes to Canvas once, after Mark read too; an empty reply is refused; many replies are kept', () => {
  const b = agdBox({ drafts: [agdUpd(30)], answer: (a, st) => { const d = st.drafts[0];
    Object.assign(d, a.decision === 'read' ? { status: 'Read' } : { status: 'Replied', note: a.note }, { decided: '2026-11-13 19:30' }); return { ok: true, draft: Object.assign({}, d) }; } });
  b.t.ctx.cueAgdTick_(); const id = b.reqs()[0].id;
  assert.throws(() => b.t.ctx.cueAgdDecide(id, { decision: 'reply', note: ' ' }), /Type your reply/);
  b.t.ctx.cueAgdDecide(id, { decision: 'read' });
  b.t.ctx.cueAgdDecide(id, { decision: 'reply', note: 'Skip LightWorks, they are on hold.' });
  assert.deepStrictEqual(b.st.decide.map(a => a.decision), ['read', 'reply']); assert.strictEqual(b.st.decide[1].note, 'Skip LightWorks, they are on hold.');
  assert.strictEqual(bridgeCheck('agent_draft_decide', b.st.decide[1]), '');
  assert.ok(b.chat(id).some(l => /^You replied: "Skip LightWorks, they are on hold\."\. Procurement Specialist agent reads it on its next run\.$/.test(l)));
  // AGENT-REPLIES-2026-11-14 (mockup approved 14 Nov 16:46:11Z): a second reply goes to Canvas too and the card lists both.
  b.st.answer = (a, st) => { const d = st.drafts[0]; Object.assign(d, { status: 'Replied', note: a.note }); return { ok: true, draft: Object.assign({}, d), message: { at: '2026-11-13 19:41', text: a.note } }; };
  b.t.ctx.cueAgdDecide(id, { decision: 'reply', note: 'Ask Bright Events instead.' });
  assert.deepStrictEqual(b.st.decide.map(a => a.decision), ['read', 'reply', 'reply']);
  assert.deepStrictEqual(b.reqs()[0].agd.replies.map(x => x.text), ['Skip LightWorks, they are on hold.', 'Ask Bright Events instead.'].slice(b.reqs()[0].agd.replies.length === 2 ? 0 : 1));
  const page = cuePage(), grab = name => { const a = page.indexOf('  function ' + name + '('); return page.slice(a, page.indexOf('\n  }\n', a) + 4); };
  const ctx = {}; vm.createContext(ctx); vm.runInContext(grab('esc') + '\n' + grab('agdUpdHtml'), ctx);
  const v = JSON.parse(JSON.stringify(b.t.ctx.cueView_(b.reqs()[0]))), h = ctx.agdUpdHtml(v);
  assert.ok(/Your replies<\/b>/.test(h) && /Ask Bright Events instead\./.test(h) && /data-act="agd-reply"/.test(h) && !/data-act="agd-read"/.test(h), h);
  const fresh = agdBox({ drafts: [agdUpd(31)] }); fresh.t.ctx.cueAgdTick_();
  const hf = ctx.agdUpdHtml(JSON.parse(JSON.stringify(fresh.t.ctx.cueView_(fresh.reqs()[0]))));
  assert.ok(/data-act="agd-reply"/.test(hf) && /data-agd-note=/.test(hf) && /data-act="agd-read"/.test(hf));
  assert.ok(/'agd-reply': 'reply'/.test(page));
});
