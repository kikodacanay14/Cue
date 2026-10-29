// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: status-reports.
// Friday status updates (CueStatus.gs, Kiko 29 Oct 12:57Z). Synthetic Canvas client_status and get_readiness answers.
const ST_HTML = '<div><img src="cid:canvaslogo" alt="Canvas"><p>Hi Ana,</p><p>Here\'s your Friday update on Acme Gala.</p><a href="https://canvas.blankspaceevent.com/client?v=project&amp;p=S-10000001AA">Go to Canvas</a></div>';
const ST_CS = { today: '2026-10-23', from: '2026-10-16', more: 0, missing: [], logo: 'iVBORw0KGgoAAAANSUhEUg==', projects: [
  { id: 'S-10000001AA', name: 'Acme Gala', account: 'Acme Corp', status: 'For Production Start', date: '2026-10-30',
    contact: { name: 'Ana Reyes', email: 'ana@acme.example', source: 'project contacts' },
    contacts: [{ name: 'Ana Reyes', email: 'ana@acme.example', role: 'Main contact' }, { name: 'Carl Lim', email: 'carl@acme.example', role: 'Finance' }, { name: 'Ana Reyes', email: 'ANA@acme.example' }], link: 'https://canvas.blankspaceevent.com/client?v=project&p=S-10000001AA',
    requirements: [{ name: 'LED wall', detail: '', stage: 'In production' }], progress: { done: 3, total: 5 },
    timeline: { total: 4, done: 1, due: 2, late: [{ task: 'Design sign-off', end: '2026-10-20' }], next: [], pct: 25 }, readiness: { ready: 18, total: 25, pct: 72 },
    risks: [{ item: 'Rain on the open-air stage', plan: 'Tent on standby' }], issues: [], tasks: [{ item: 'Send the guest list' }], tasks_done: 2,
    subject: 'Acme Gala · Friday update, 23 Oct', text: 'Hi Ana,\n\nHere\'s your Friday update on Acme Gala.\n\nThank you,\nBlank Space Events', html: ST_HTML },
  { id: 'S-20000002BB', name: 'Beta Launch', account: 'Beta Inc', status: 'For Event Execution', date: '2026-11-15', contact: null, link: 'https://canvas.blankspaceevent.com/client?v=project&p=S-20000002BB',
    requirements: [], progress: { done: 0, total: 0 }, timeline: null, readiness: null, risks: [], issues: [], tasks: [], tasks_done: 0,
    subject: 'Beta Launch · Friday update, 23 Oct', text: 'Hi,\n\nThank you,\nBlank Space Events', html: '<div>Hi,</div>' }] };
const ST_SCORE = { gate: 'pre', items: [], score: { ready: 18, total: 25, pct: 72 } };
function stRun(o, text) { const t = sandbox(Object.assign({ readiness: ST_SCORE }, o || {})); const out = t.ctx.cueSend(text || 'status updates', [], ''); const v = t.ctx.cueRun(out.request_id); return Object.assign(t, { id: out.request_id, v }); }

test('ST1 "status updates": its own thread, Canvas lists the events, a fresh readiness scan of each, then one email each; no AI call, nothing sent', () => {
  const t = stRun();
  assert.strictEqual(t.v.kind, 'status'); assert.strictEqual(t.v.status, 'Needs you');
  assert.ok(!t.log.gpt.some(b => b.text.format.name === 'chat'), 'no chat call routes it');
  assert.strictEqual(t.v.metrics.ai_calls, 0); assert.strictEqual(t.log.claude.length, 0);
  deq(t.log.csArgs, [{ ids_only: true }, { project_ids: ['S-10000001AA', 'S-20000002BB'], email: true }], 'list first, then the emails for exactly those');
  t.log.csArgs.forEach(a => assert.strictEqual(bridgeCheck('client_status', a), '', 'real bridge schema'));
  deq(t.log.readyArgs, [{ pid: 'S-10000001AA', args: { gate: 'pre', max_age_minutes: 1 } }, { pid: 'S-20000002BB', args: { gate: 'pre', max_age_minutes: 1 } }], 'a fresh scan each');
  t.log.readyArgs.forEach(a => assert.strictEqual(bridgeCheck('get_readiness', a.args), ''));
  const S = t.v.st; deq(S.mails.map(m => [m.k, m.name, m.to, m.sent, m.skipped]), [['M1', 'Acme Gala', 'ana@acme.example', false, false], ['M2', 'Beta Launch', '', false, false]]);
  const A = S.mails[0]; deq(A.readiness, { ready: 18, total: 25, pct: 72 }); deq(A.reqs, { done: 3, total: 5 }); deq(A.timeline, { done: 1, total: 4, late: 1 });
  assert.strictEqual(A.risks, 1); assert.strictEqual(A.tasks, 1); assert.strictEqual(A.subject, 'Acme Gala · Friday update, 23 Oct'); assert.ok(A.scanned);
  assert.ok(!('z' in A) && !('html' in A), 'the card gets no email bodies');
  deq(A.people.map(p => p.email), ['ana@acme.example', 'carl@acme.example'], 'To dropdown: the event contacts, main first, no duplicates'); deq(S.mails[1].people, []);
  assert.ok(!t.log.sent && !t.log.gmail.length, 'nothing sent or drafted');
  assert.ok(t.tabs.Chat.rows.some(r => r[3] === '>' + t.id && /Started the client status updates in its own thread\. Nothing is sent until you tap Send/.test(r[2])));
  assert.ok(t.tabs.Chat.rows.some(r => r[3] === t.id && /2 client emails ready\. Readiness scanned for 2 of 2 events\. 1 has no main client contact/.test(r[2])));
});

test('ST2 Send: one confirm on the card, then the styled email with the Canvas logo from Kiko\'s Gmail; a second tap never sends again; Skip; then Done', () => {
  const t = stRun();
  let v = t.ctx.cueApprove(t.id, { send: 'M1', to: 'ana@acme.example, ben@acme.example' });
  assert.strictEqual(t.log.sent.length, 1); assert.strictEqual(t.log.gmail.length, 1);
  const mime = t.log.gmail[0];
  assert.ok(/^To: ana@acme\.example, ben@acme\.example\r\n/.test(mime)); assert.ok(/multipart\/related/.test(mime) && /Content-ID: <canvaslogo>/.test(mime) && /text\/html/.test(mime) && /text\/plain/.test(mime));
  assert.ok(mime.indexOf(Buffer.from('Acme Gala · Friday update, 23 Oct').toString('base64')) > 0, 'subject');
  assert.ok(v.st.mails[0].sent); assert.strictEqual(v.status, 'Needs you', 'Beta still waits');
  t.ctx.cueApprove(t.id, { send: 'M1', to: 'ana@acme.example' }); assert.strictEqual(t.log.sent.length, 1, 'sent once');
  v = t.ctx.cueApprove(t.id, { skip: 'M2' });
  assert.strictEqual(v.status, 'Done'); assert.ok(v.st.mails[1].skipped); assert.strictEqual(t.log.sent.length, 1);
  assert.ok(t.tabs.Chat.rows.some(r => r[3] === '>' + t.id && /Summary for Status updates .*: sent 1 client update from your Gmail; 1 skipped\./.test(r[2])));
});

test('ST3 To is checked before a send; a Gmail failure says why and Send can be tapped again', () => {
  const t = stRun({ sendFail: true });
  assert.throws(() => t.ctx.cueApprove(t.id, { send: 'M2' }), /Type the client's email in To first/);
  assert.throws(() => t.ctx.cueApprove(t.id, { send: 'M2', to: 'not an email' }), /is not an email address/);
  assert.throws(() => t.ctx.cueApprove(t.id, { send: 'M9', to: 'a@b.example' }), /No such email/);
  let v = t.ctx.cueApprove(t.id, { send: 'M1', to: 'ana@acme.example' });
  assert.ok(!v.st.mails[0].sent && /Gmail did not send it/.test(v.st.mails[0].error)); assert.strictEqual(v.status, 'Needs you');
  v = t.ctx.cueApprove(t.id, { send: 'M1', to: 'ana@acme.example' }); assert.ok(v.st.mails[0].sent && !v.st.mails[0].error);
});

test('ST4 Preview: the email as the client sees it, with the Canvas logo inline; read only', () => {
  const t = stRun(), p = t.ctx.cueStatusPreview(t.id, 'M1');
  assert.ok(p.html.indexOf('src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=="') > 0 && p.html.indexOf('cid:canvaslogo') < 0);
  assert.ok(/Go to Canvas/.test(p.html) && /Thank you,\nBlank Space Events/.test(p.text));
  assert.ok(!t.log.sent && !t.log.gmail.length);
  assert.throws(() => t.ctx.cueStatusPreview(t.id, 'M7'), /No such email/);
});

test('ST5 the readiness scan goes a few at a time and on at the next run when time is up; a refused scan is said, the email still comes', () => {
  const many = JSON.parse(JSON.stringify(ST_CS));
  for (let i = 3; i <= 8; i++) many.projects.push(Object.assign(JSON.parse(JSON.stringify(ST_CS.projects[1])), { id: 'S-' + i + '000000' + i + 'CC', name: 'Event ' + i }));
  const t = stRun({ cs: many, batchStep: 250000, readyRefuse: ['S-20000002BB'] });
  assert.strictEqual(t.v.status, 'Working'); assert.strictEqual(t.v.stage, 'Readiness scan');
  assert.strictEqual(t.log.readyArgs.length, 5, 'one batch of 5, then time was up'); assert.strictEqual(t.v.st.mails.length, 0);
  const v = t.ctx.cueRun(t.id);
  assert.strictEqual(v.status, 'Needs you'); assert.strictEqual(t.log.readyArgs.length, 8, 'the last 3 on the next run, none twice');
  assert.strictEqual(v.st.mails.length, 8); assert.ok(!v.st.mails[1].scanned && v.st.mails[0].scanned);
  assert.ok(v.notes.some(n => /readiness scan did not run for Beta Launch \(.*Canvas busy\)\. Their emails show the last score Canvas has\./.test(n)), v.notes.join(' | '));
});

test('ST6 "status of Acme" scans and builds only the matching events; what is not a status ask is left alone; old Canvas without client_status', () => {
  const t = stRun({ similar: [{ project_id: 'S-10000001AA', name: 'Acme Gala', date: '2026-10-30', status: 'For Production Start' }, { project_id: 'S-30000003CC', name: 'Acme Old', date: '2025-01-01', status: 'Completed' }] }, 'status of Acme');
  deq(t.log.csArgs, [{ ids_only: true, project_ids: ['S-10000001AA'] }, { project_ids: ['S-10000001AA'], email: true }]); assert.strictEqual(t.v.st.title, 'Status update for Acme');
  deq(t.log.readyArgs.map(a => a.pid), ['S-10000001AA']); assert.strictEqual(t.v.st.mails.length, 1);
  const ask = x => JSON.parse(JSON.stringify(t.ctx.cueStAsked_(x)));
  deq(ask('Status report'), { project: '' }); deq(ask('status updates'), { project: '' }); deq(ask('send the Friday updates'), { project: '' }); deq(ask('run the client status updates please'), { project: '' });
  deq(ask('status of S-10000001AA?'), { project: 'S-10000001AA' });
  assert.strictEqual(ask('status of the RFQ'), null); assert.strictEqual(ask('what is the status of Selecta'), null); assert.strictEqual(ask('the status report looks wrong, why?'), null);
  const u = stRun({ noClientStatus: true }); assert.strictEqual(u.v.status, 'Failed'); assert.ok(/client_status\)\. It comes with the next Canvas release/.test(u.v.error));
  const m = sandbox({ noClientStatus: true }), mv = m.ctx.cueRun(m.ctx.cueStStart_('Friday status updates', 'weekly', '').request_id);
  assert.strictEqual(mv.status, 'Done', 'the Friday run before the Canvas release is not a failure'); assert.ok(/^Skipped: .*next Canvas release/.test(mv.st.empty));
});

test('ST7 no active events: Done with one line; Fridays 07:00 start it from its own row once; the old Monday row moves to Friday, on', () => {
  const t = stRun({ cs: { today: '2026-10-23', projects: [], more: 0, missing: [] } });
  assert.strictEqual(t.v.status, 'Done'); assert.ok(/No active events/.test(t.v.st.empty)); assert.ok(!t.log.readyArgs);
  const u = sandbox({ readiness: ST_SCORE }); u.ctx.cueState();
  deq(u.ctx.cueSchedules().filter(x => x.id === 'sys-status').map(x => [x.name, x.when, x.on]), [['Friday status updates', 'Fri 07:00', true]]);
  u.ctx.__wait(phMs('2026-10-23', '07:01') - Date.parse('2026-10-21T03:00:00Z'));
  for (let i = 0; i < 4; i++) { u.ctx.cueResume(); u.ctx.__wait(5 * 60000); }
  const runs = () => u.tabs.Requests.rows.slice(1).map(r => u.state(r[0])).filter(x => x.kind === 'status');
  assert.strictEqual(runs().length, 1); assert.strictEqual(runs()[0].how, 'weekly'); assert.ok(/^Friday status updates 10\/23/.test(runs()[0].st.title));
  assert.strictEqual(runs()[0].status, 'Needs you', 'cueResume ran it to the card'); assert.ok(!u.log.sent, 'the Friday run never sends');
  assert.strictEqual(u.ctx.cueSchedRun_({ run: 'status', name: 'Friday status updates', time: '07:00', command: 'Status updates' }, false).result, 'Already ran today'); assert.strictEqual(runs().length, 1, 'once a day');
  // A tab seeded by an older Cue still has the Monday row, turned off: v7 moves it to Friday and turns it on.
  const w = sandbox(); w.ctx.cueSchedules();
  const sh = w.tabs.Schedule, row = sh.rows.find(r => r[0] === 'sys-status');
  row[1] = 'Monday status report'; row[4] = 'Mon'; row[10] = false; w.props.CUE_SCHED_SEED = 'v6:';
  deq(w.ctx.cueSchedules().filter(x => x.id === 'sys-status').map(x => [x.name, x.when, x.on]), [['Friday status updates', 'Fri 07:00', true]]);
});

test('ST8 Done skips what is not sent; the card shows Preview, Send and Skip per email and sends only after one confirm', () => {
  const t = stRun();
  const v = t.ctx.cueStatusDone(t.id); assert.strictEqual(v.status, 'Done'); assert.ok(v.st.mails.every(m => m.skipped)); assert.ok(!t.log.sent);
  assert.throws(() => t.ctx.cueApprove(t.id, { send: 'M1', to: 'ana@acme.example' }), /not waiting for you/);
  const page = cuePage();
  assert.ok(/data-act="st-preview"/.test(page) && /data-act="st-send"/.test(page) && /data-act="st-skip"/.test(page));
  assert.ok(/data-stsel=/.test(page) && /Someone else…/.test(page), 'To is a dropdown of the event contacts');
  assert.ok(/ask\('Send the Friday update for ' \+/.test(page) && /'Sent emails cannot be called back\.'/.test(page) && /<iframe sandbox title="Preview of /.test(page));
});

test('ST9 a run that dies in the middle of a slow readiness scan does not scan those events again: the next run says so and the emails still come', () => {
  const many = JSON.parse(JSON.stringify(ST_CS));
  for (let i = 3; i <= 8; i++) many.projects.push(Object.assign(JSON.parse(JSON.stringify(ST_CS.projects[1])), { id: 'S-' + i + '000000' + i + 'CC', name: 'Event ' + i }));
  const t = stRun({ cs: many, batchStep: 250000 });
  assert.strictEqual(t.log.readyArgs.length, 5);
  const L = t.ctx.cueLoad_(t.id);
  assert.ok(L.s.st.events.slice(0, 5).every(e => e.tried && e.scanned), 'each event is marked tried before its fetch');
  L.s.st.events.slice(5).forEach(e => { e.tried = true; });   // as if the run died during the last batch's fetch
  t.ctx.cueSave_(L.sh, L.row, L.s);
  const v = t.ctx.cueRun(t.id);
  assert.strictEqual(t.log.readyArgs.length, 5, 'never fetched again'); assert.strictEqual(v.status, 'Needs you'); assert.strictEqual(v.st.mails.length, 8);
  assert.ok(v.notes.some(n => /readiness scan did not run for Event 6, Event 7, Event 8 \(Canvas took longer than a Cue run allows\)\. Their emails show the last score Canvas has\./.test(n)), v.notes.join(' | '));
});
