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
  assert.strictEqual(t.log.gpt.length, 1); assert.strictEqual(t.log.board, 1);
  const sentToGpt = t.log.gpt[0].input; assert.ok(/chaser_number":1/.test(sentToGpt)); assert.ok(!/1250000|1,250,000|ce_total/.test(sentToGpt.replace(/"why":"[^"]*"/g, '')), 'no total in facts');
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
test('A6 event within 7 days (or past) is urgent with no draft', () => {
  const t = awardBox({ projects: [AW({ date: '10/25/2026' }), AW({ id: 'S-2', name: 'Old Gala', date: '2026-10-01', awaiting: {} })] }); t.ctx.cueSweep();
  const [a, b] = awItems(t).sort((x, y) => x.key.localeCompare(y.key));
  deq([a.priority, a.no_email, b.priority], ['urgent', true, 'urgent']);
  assert.ok(/Event on 2026-10-25 and still no award/.test(a.why)); assert.ok(/has passed/.test(b.why)); assert.strictEqual(t.log.gpt.length, 0);
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
  const page = fs.readFileSync(path.join(__dirname, '..', 'src', 'Index.html'), 'utf8');
  const h = page.slice(page.indexOf('// Snapshots (spec screen-snapshot.md'), page.indexOf("$('snap').onclick"));
  assert.ok(h.length > 200 && /e\.source !== window/.test(h), 'listens to its own window only');
  assert.ok(!/\bsend\(|call\(/.test(h), 'a snapshot never sends or calls the server by itself');
  assert.ok(/data-cue-app="1"/.test(page));
});
