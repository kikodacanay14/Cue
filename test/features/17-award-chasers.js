// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: award-chasers.
/* ---------- CE award chasers (spec specs/ce-award-chasers.md, Kiko approved 08:11Z) ---------- */
const AW = (o = {}) => Object.assign({ id: 'S-1', name: 'Acme Party', account: 'Acme Corp', status: 'For Client Awarding', date: '12/12/2026',
  awaiting: { since: '2026-10-15', ce_total: 1250000, ce_no: 'CE-26-047' } }, o);
const agm = (id, sent, phIso, extra) => ({ id, labelIds: sent ? ['SENT'] : ['INBOX'], internalDate: String(Date.parse(phIso + '+08:00')),
  payload: { headers: [{ name: 'From', value: sent ? 'Kiko <kiko@example.com>' : 'Ana Reyes <ana@acme.example>' },
    { name: 'To', value: sent ? 'Joy <joy@example.com>, "Ana Reyes" <ana@acme.example>' : 'kiko@example.com' },
    { name: 'Subject', value: 'BSE cost estimate: Acme Party' }, { name: 'Message-ID', value: '<' + id + '@mail>' }].concat(extra || []) } });
function awardBox(o = {}) {
  const th = o.thread === undefined ? [agm('m1', true, '2026-10-15T10:00:00')] : o.thread;
  return sweepBox(Object.assign({ award: true, projects: o.projects || [AW()], search: q => (th && /Acme Party/.test(q) ? [{ id: 'm1', threadId: 'T1' }] : []),
    threads: th ? { T1: { messages: th } } : {} }, o), null);
}
const awItems = t => t.state(batchOf(t).id).batch.items.filter(i => i.kind === 'award');   // stored lines (the view leaves out thread ids and facts)

test('A1 due after 3 business days: one item replying in the CE thread to the client (not Kiko\'s own domain), drafted in the one ChatGPT call; no price sent to ChatGPT', () => {
  const t = awardBox(); t.ctx.cueSweep(); const [it] = awItems(t);
  deq([it.key, it.who, it.to, it.thread_id, it.message_id, it.thread_subject], ['award:S-1', 'Ana Reyes', 'ana@acme.example', 'T1', '<m1@mail>', 'BSE cost estimate: Acme Party']);
  assert.ok(/CE sent 2026-10-15 \(CE-26-047, PHP 1,250,000\), 4 business days with no award decision\. Event 2026-12-12\. Chaser 1 of 3/.test(it.why), it.why);
  assert.strictEqual(t.log.gpt.length, 0, 'no AI call: Kiko\'s C6 template (31 Oct)'); assert.strictEqual(t.log.board, 1);
  assert.ok(/in:sent newer_than:180d \("Acme Party" OR "S-1"\).*-RFQ/.test(t.log.queries[0]));
  t.at('2026-10-21', 10, 0); t.ctx.cueApprove(batchOf(t).id, { send: true });
  assert.strictEqual(t.log.replies.length, 1); assert.ok(/"threadId":"T1"/.test(t.log.replies[0].payload) && /In-Reply-To: <m1@mail>/.test(t.log.replies[0].payload));
  assert.strictEqual(t.log.sent.length, 1, 'approved after 9: sent at once');
});
test('A2 not due yet (2 business days) and the weekend does not count: nothing to chase', () => {
  const t = awardBox({ projects: [AW({ awaiting: { since: '2026-10-19' } })] }); t.ctx.cueSweep();
  assert.ok(t.tabs.Chat.rows.some(r => /nothing to chase today/.test(r[2]))); assert.strictEqual(t.log.gpt.length, 0);
  assert.strictEqual(t.ctx.cueBizDays_('2026-10-16', '2026-10-19'), 1, 'Fri to Mon is one business day');
});
test('A3 the client replied after the CE: a flag to look, no draft and no AI call', () => {
  const t = awardBox({ thread: [agm('m1', true, '2026-10-15T10:00:00'), agm('m2', false, '2026-10-20T09:00:00')] }); t.ctx.cueSweep(); const [it] = awItems(t);
  assert.ok(/client replied on 2026-10-20/i.test(it.why)); assert.strictEqual(it.no_email, true); assert.strictEqual(t.log.gpt.length, 0);
});
test('A4 a chaser Kiko sent by hand counts: the next one waits 5 business days and is chaser 2', () => {
  const thread = [agm('m1', true, '2026-10-12T10:00:00'), agm('m2', true, '2026-10-16T10:00:00')];
  const t = awardBox({ thread, projects: [AW({ awaiting: { since: '2026-10-12' } })] }); t.ctx.cueSweep();
  assert.ok(t.tabs.Chat.rows.some(r => /nothing to chase today/.test(r[2])), '3 business days since the hand chaser');
  t.at('2026-10-23', 7, 0); t.ctx.cueSweep(); const [it] = awItems(t);
  assert.ok(/Chaser 2 of 3/.test(it.why)); assert.strictEqual(it.facts.chaser_number, 2); assert.strictEqual(it.message_id, '<m2@mail>', 'replies under the newest message');
});
test('A5 chased 3 times: no more drafts; "call the client or mark Not Awarded" once the next chaser would be due', () => {
  const thread = [agm('m1', true, '2026-09-20T10:00:00'), agm('m2', true, '2026-09-25T10:00:00'), agm('m3', true, '2026-10-02T10:00:00'), agm('m4', true, '2026-10-14T10:00:00')];
  const t = awardBox({ thread, projects: [AW({ awaiting: { since: '2026-09-20' } })] }); t.ctx.cueSweep(); const [it] = awItems(t);
  assert.ok(/Chased 3 times with no decision\. Call the client, or mark it Not Awarded/.test(it.why)); assert.strictEqual(it.no_email, true);
});
/* AWARD-TAP-2026-10-30 (Kiko 30 Oct 2026 03:21Z "how come there is no send follow up button?", card "Yes, build all" 03:54Z):
 * an event within 7 days whose CE thread waits on the client gets an urgent draft and Send follow-up; a past event gets Open in Canvas. */
test('A6 event within 7 days: urgent draft, not ticked for 9:00; a past event is a flag with Open in Canvas; no CE thread stays a flag', () => {
  const t = awardBox({ projects: [AW({ date: '10/25/2026' }), AW({ id: 'S-26001AB', name: 'Old Gala', date: '2026-10-01', awaiting: {} }),
    AW({ id: 'S-3', name: 'Lost Expo', date: '2026-10-24', awaiting: {} })] }); t.ctx.cueSweep();
  const by = {}; awItems(t).forEach(i => { by[i.key] = i; });
  const a = by['award:S-1'], b = by['award:S-26001AB'], c = by['award:S-3'];
  deq([a.priority, a.no_email, a.tap, a.selected, a.short, a.to, a.thread_id], ['urgent', false, true, false, 'Event 2026-10-25', 'ana@acme.example', 'T1']);
  assert.ok(/Event on 2026-10-25 and still no award\. Send an urgent follow-up/.test(a.why), a.why);
  assert.strictEqual(t.log.gpt.length, 0, 'no AI call: Kiko\'s C6 urgent template (31 Oct)');
  deq([b.priority, b.no_email, b.short], ['urgent', true, 'Event passed 2026-10-01']); assert.ok(/has passed/.test(b.why));
  assert.ok(/\?page=canvas&project=S-26001AB&tab=Main$/.test(b.canvas_url), b.canvas_url);
  deq([c.priority, c.no_email, !!c.tap], ['urgent', true, false]); assert.ok(/Call the client today/.test(c.why), 'no CE email found: still a flag');
  const v = t.ctx.cueState().requests.filter(r => r.kind === 'sweep')[0].batch.items.filter(i => i.kind === 'award');
  deq(v.map(i => [i.key, i.tap, i.short, !!i.canvas_url]).sort(), [['award:S-1', true, 'Event 2026-10-25', false], ['award:S-26001AB', false, 'Event passed 2026-10-01', true], ['award:S-3', false, 'Event 2026-10-24', false]]);
});
test('A6b the C6 urgent template asks for a decision as soon as they can, names the event date and never quotes the CE total', () => {
  const tpl = t0 => t0.ctx.cueKinds_().filter(k => k.kind === 'award')[0].template;
  const t = awardBox(); const d = tpl(t)({ who: 'Ana Reyes', project: 'Acme Party', facts: { urgent: true, event_date: '2026-10-25' } });
  assert.ok(/^Hi Ana,\n\nAcme Party is coming up on 25 October 2026\. Could you review the cost estimate and let us know your decision as soon as you can\?/.test(d.body), d.body);
  assert.ok(!/PHP|1,250,000/.test(d.body)); assert.strictEqual((d.body.match(/!/g) || []).length, 1, 'one "!": Thanks!');
});
test('A6c Send follow-up: Approve and send leaves the urgent line out; its own tap sends it once, in the CE thread, with Kiko\'s edit', () => {
  const t = awardBox({ projects: [AW({ date: '10/25/2026' })] }); t.ctx.cueSweep();
  const id = batchOf(t).id;
  t.at('2026-10-21', 10, 0); t.ctx.cueApprove(id, { send: true });
  assert.ok(!t.log.sent, 'not in the batch send');
  t.ctx.cueSweepSendOne(id, 'award:S-1', 'Hi Ana,\n\nEdited by Kiko.\n\nThank you,\nKiko');
  assert.strictEqual(t.log.replies.length, 1); assert.ok(/"threadId":"T1"/.test(t.log.replies[0].payload) && /In-Reply-To: <m1@mail>/.test(t.log.replies[0].payload));
  assert.strictEqual(t.log.sent.length, 1);
  const [it] = awItems(t); assert.ok(it.sent_id && /Edited by Kiko/.test(it.body)); assert.strictEqual(it.error, '');
  t.ctx.cueSweepSendOne(id, 'award:S-1', 'again'); assert.strictEqual(t.log.sent.length, 1, 'a second tap sends nothing');
  assert.ok(t.tabs.Chat.rows.some(r => /Sent the follow-up for Acme Party from your Gmail/.test(r[2])));
  assert.throws(() => t.ctx.cueSweepSendOne(id, 'award:nope', ''), /no Send follow-up/);
});
test('A6d Morning batch page: kinds and lines fold (first kind open), the urgent line shows Send follow-up, a past one Open in Canvas', () => {
  const page = cuePage();
  const src = page.slice(page.indexOf('  var swOpen = {};'), page.indexOf('  // ---- Settings page'));
  const ctx = vm.createContext({ document: { addEventListener() {} }, String, Number, Date, JSON });
  vm.runInContext('var SWEEP_GROUP = {}; function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); } function metricLine() { return ""; }\n'
    + src + '\nthis.card = sweepCardHtml;', ctx);
  const it = (o) => Object.assign({ kind: 'award', label: 'CE award chasers', priority: 'urgent', times: 0, removed: '', task_id: '', action: '' }, o);
  const r = { id: 'R1', status: 'Needs you', day: '2026-10-30', notes: [], batch: { over: 0, stopped: [], items: [
    it({ key: 'award:a', project: 'Gala', who: 'Ana', to: 'ana@x.ph', tap: true, no_email: false, send_ok: true, body: 'Hi Ana', short: 'Event 2026-11-01' }),
    it({ key: 'award:b', project: 'Old Gala', no_email: true, canvas_url: 'https://script.google.com/macros/s/X/exec?page=canvas&project=S-1', short: 'Event passed 2026-10-15' }),
    it({ key: 'rfq:c', kind: 'rfq', label: 'RFQ reminders', project: 'Expo', who: 'Supp', to: 's@x.ph', priority: 'normal', no_email: false, send_ok: true, selected: true, body: 'Hi' })] } };
  const h = ctx.card(r);
  assert.ok(/<details class="sec" data-swfold="R1\|CE award chasers" open><summary>CE award chasers \(2\)<\/summary>/.test(h), 'first kind open');
  assert.ok(/<details class="sec" data-swfold="R1\|RFQ reminders"><summary>RFQ reminders \(1\)/.test(h), 'other kinds folded');
  assert.ok(/<details class="card swl"[^>]*data-swfold="R1\|award:a"><summary><b>Gala<\/b> <span class="tag flag">urgent<\/span><span class="small muted swn">Event 2026-11-01<\/span><\/summary>/.test(h), 'line folds to one row');
  assert.ok(/data-act="sweep-one" data-id="R1" data-key="award:a">Send follow-up<\/button><button class="btn ghost" data-act="sweep-skip"/.test(h));
  assert.ok(/<textarea class="mail" data-sb="R1" data-k="award:a"/.test(h) && /only when you tap Send follow-up/.test(h));
  assert.ok(/<a class="btn" data-canvas="1" data-name="Old Gala" href="https:\/\/script\.google\.com\/macros\/s\/X\/exec\?page=canvas&amp;project=S-1"[^>]*>Open in Canvas<\/a><button class="btn ghost" data-act="sweep-skip"/.test(h));
  assert.ok(/<input type="checkbox" data-sk="R1" value="rfq:c" checked/.test(h) && !/data-sk="R1" value="award:a"/.test(h), 'the urgent line has no tick');
  assert.strictEqual((h.match(/data-act="sweep-send"/g) || []).length, 1, 'the RFQ line still counts as mail');
  const sent = ctx.card(Object.assign({}, r, { status: 'Done', batch: Object.assign({}, r.batch, { items: [Object.assign({}, r.batch.items[0], { sent: true })] }) }));
  assert.ok(!/Send follow-up<\/button>/.test(sent) && /<span class="tag pref">sent<\/span>/.test(sent), 'sent: no button, a sent tag');
  const after = ctx.card(Object.assign({}, r, { status: 'Scheduled' }));
  assert.ok(/Send follow-up<\/button>/.test(after) && !/sweep-skip/.test(after), 'after Approve and send the tap still works');
  assert.ok(page.indexOf("call('cueSweepSendOne', [id, b.getAttribute('data-key'), ta ? ta.value : ''], done, fail)") > 0, 'tap sends that box\'s words');
});
test('A7 no CE email in Sent: chase by hand (only once it is due); projects in other statuses are ignored', () => {
  const t = awardBox({ thread: null, projects: [AW(), AW({ id: 'S-3', name: 'Done Expo', status: 'For Production Start' })] }); t.ctx.cueSweep();
  const items = awItems(t); assert.strictEqual(items.length, 1); assert.ok(/No CE email found/.test(items[0].why)); assert.strictEqual(t.log.queries.length, 1);
  const u = awardBox({ thread: null, projects: [AW({ awaiting: { since: '2026-10-20' } })] }); u.ctx.cueSweep();
  assert.ok(u.tabs.Chat.rows.some(r => /nothing to chase today/.test(r[2])));
});
test('A8 Canvas without awaiting (before the next release): waiting since falls back to the CE email date; Drafts only counts as a chaser in the log', () => {
  const t = awardBox({ projects: [AW({ awaiting: undefined })] }); t.ctx.cueSweep(); const [it] = awItems(t);
  assert.strictEqual(it.due_since, '2026-10-15'); assert.ok(/CE sent 2026-10-15, 4 business days/.test(it.why));
  t.ctx.cueApprove(batchOf(t).id, { send: false }); assert.ok(!t.log.sent);
  t.at('2026-10-22', 7, 0); t.ctx.cueSweep(); assert.ok(t.tabs.Chat.rows.some(r => /nothing to chase today/.test(r[2])), 'the draft counts: next one in 5 business days');
});
test('A9 Gmail access missing is a note on the batch, not a crash; the kind file loads after CueSweep.gs (Apps Script file order)', () => {
  const t = awardBox({ gmailScope: true }); t.ctx.cueSweep();
  assert.ok(batchOf(t).notes.some(n => /CE award chasers: could not check \(Cue does not have Gmail access/.test(n)));
  const files = fs.readdirSync(path.join(__dirname, '..', 'src')).filter(f => /\.gs$/.test(f)).sort();
  assert.ok(files.indexOf('CueSweepAward.gs') > files.indexOf('CueSweep.gs'));
});
test('SN1 snapshots (Kiko 08:17Z): a Cue bubble screen snapshot goes with the brief, not Designs & Visuals; a photo still goes to Designs & Visuals', () => {
  const w = sandbox(), snap = 'Cue snapshot 21 Oct 08-20-01.jpg';
  const iw = w.ctx.cueSend('New project intake.\nSnapshot of Inbox (https://mail.google.com/mail/u/0/#inbox).',
    [{ name: snap, type: 'image/jpeg', data: PNG }, { name: 'venue.png', type: 'image/png', data: PNG }]).request_id;
  w.ctx.cueRun(iw); assert.ok(!w.log.saved, 'nothing saved before Kiko approves');
  w.ctx.cueApprove(iw, {});
  deq(w.log.saved.map(x => [x.name, x.type]), [[snap, 'Brief & Planning'], ['venue.png', 'Designs & Visuals']]);
});

test('SN2 Cue bubble 1.2: manifest asks only for what snapshots need; scripts parse; the page only fills the box', () => {
  const ext = path.join(__dirname, '..', 'extension'), m = JSON.parse(fs.readFileSync(path.join(ext, 'manifest.json'), 'utf8'));
  assert.strictEqual(m.version, '1.4.2');
  deq(m.permissions.slice().sort(), ['activeTab', 'contextMenus', 'storage']); deq(m.host_permissions, ['<all_urls>']);
  assert.strictEqual(m.commands['cue-snap'].suggested_key.default, 'Alt+Shift+S');
  const drop = m.content_scripts.find(c => c.js.indexOf('cue-drop.js') >= 0);
  deq(drop.matches, ['https://*.googleusercontent.com/*']); assert.ok(drop.all_frames);
  ['background.js', 'content.js', 'cue-drop.js', 'options.js'].forEach(f => new vm.Script(fs.readFileSync(path.join(ext, f), 'utf8'), { filename: f }));
  const bg = fs.readFileSync(path.join(ext, 'background.js'), 'utf8');
  assert.ok(/isCueTab\(sender\.tab\)\.then\(ok => \{ if \(ok\) snap/.test(bg), 'only Cue\'s own page can ask for a snapshot');
  const page = cuePage();
  const h = page.slice(page.indexOf('// Snapshots (spec screen-snapshot.md'), page.indexOf("$('snap').onclick"));
  assert.ok(h.length > 200 && /e\.source !== window/.test(h), 'listens to its own window only');
  assert.ok(!/\bsend\(|call\(/.test(h), 'a snapshot never sends or calls the server by itself');
  assert.ok(/data-cue-app="1"/.test(page));
});
