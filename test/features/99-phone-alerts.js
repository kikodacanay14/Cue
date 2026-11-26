// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: Cue alerts on Kiko's Android phone
// (CUE-ALERTS-2026-11-16, src/CueAlerts.gs and alerts/alerts-worker.js; ADR-0198). Kiko 16 Nov 2026: "A. Cue's own push"
// 15:14:25Z, mockups approved 15:18:24Z, "Yes, group within 5 min" 15:20:47Z, "Yes, build it" 17:22:27Z.

const PA_URL = 'https://cue-alerts.example.workers.dev';
function paBox(o = {}) {
  const sent = [];
  const t = sandbox(Object.assign({}, o, { props: Object.assign({ CUE_ALERTS_URL: PA_URL, CUE_ALERTS_KEY: 'ca-key-not-real' }, o.props || {}),
    web: req => {
      if (String(req.url).indexOf(PA_URL) !== 0) return null;
      const p = String(req.url).slice(PA_URL.length);
      sent.push({ path: p, auth: (req.headers || {}).Authorization, body: req.payload ? JSON.parse(req.payload) : null });
      if (o.down) return resp(503, { error: 'down' });
      if (p === '/send') return resp(200, { phones: 1, sent: 1, results: ['sent'] });
      if (p === '/status') return resp(200, { phones: 1 });
      if (p === '/pair') return o.pairClosed ? resp(403, { error: 'Pairing is closed.' }) : resp(200, { paired: true });
      if (p === '/code') return resp(200, { code: 'ab'.repeat(16), url: PA_URL + '/setup?code=' + 'ab'.repeat(16), minutes: 10 });
      return resp(404, {});
    } }));
  t.sent = sent;
  return t;
}

test('PA1 without CUE_ALERTS_URL and CUE_ALERTS_KEY nothing is sent and nothing fails', () => {
  const t = sandbox();
  assert.strictEqual(t.ctx.cueAlert_('agent', 'cue-1', 'Account Specialist', 'x', 'Account Specialist', { thread: 'cue-1' }), 'not set up');
  assert.strictEqual(t.ctx.cueAlertJobRun_('New mail', 'boom'), 'not set up');
});

test('PA2 grouping (ADR-0198): the first line alerts with sound, more lines within 5 minutes count up silently, 5 minutes of quiet alerts again', () => {
  const t = paBox(), A = (line) => t.ctx.cueAlert_('agent', 'cue-root', 'Account Specialist', line, 'Account Specialist', { thread: 'cue-card' });
  assert.strictEqual(A('Handover update: venue'), 'sent');
  t.ctx.__wait(2 * 60e3); assert.strictEqual(A('Quote waits for you: CE'), 'grouped');
  t.ctx.__wait(4 * 60e3); assert.strictEqual(A('Third line'), 'grouped', 'the window counts from the last line');
  const b = t.sent.map(x => x.body);
  deq(b.map(x => [x.title, x.renotify, x.tag]), [['Account Specialist', true, 'cue-root'], ['Account Specialist · 2 updates', false, 'cue-root'], ['Account Specialist · 3 updates', false, 'cue-root']]);
  assert.strictEqual(b[2].body, 'Third line');
  assert.strictEqual(b[0].url, 'https://script.google.com/macros/s/CUE/exec?thread=cue-card');
  assert.ok(t.sent.every(x => x.path === '/send' && x.auth === 'Bearer ca-key-not-real'));
  t.ctx.__wait(5 * 60e3 + 1000); assert.strictEqual(A('After quiet'), 'sent');
  deq([t.sent[3].body.title, t.sent[3].body.renotify], ['Account Specialist', true]);
  assert.strictEqual(t.ctx.cueAlert_('agent', 'cue-other', 'Event Specialist', 'y', 'Event Specialist'), 'sent', 'another thread has its own window');
});

test('PA3 each type has an On switch, all start On; Off sends nothing; the table shows the last sent time and the phones', () => {
  const t = paBox();
  const L = t.ctx.cueAlerts();
  deq(L.types.map(x => [x.name, x.on, x.last]), [['8 AM update', true, ''], ['New item for your OK', true, ''], ['Agent update', true, ''], ['Messenger message for you', true, ''], ['Failed job', true, '']]);
  deq([L.ready, L.phones], [true, 1]);
  t.ctx.cueAlertsSet('msgr', false);
  assert.strictEqual(t.ctx.cueAlertMsgr_('cue-m1', 'Jayson Campo', 'hello'), 'off');
  assert.ok(!t.sent.some(x => x.path === '/send'));
  t.ctx.cueAlertsSet('msgr', true);
  assert.strictEqual(t.ctx.cueAlertMsgr_('cue-m1', 'Jayson Campo', 'hello'), 'sent');
  const M = t.ctx.cueAlerts().types.filter(x => x.id === 'msgr')[0]; assert.ok(M.on && /^2026-10-21T/.test(M.last), JSON.stringify(M));
  assert.throws(() => t.ctx.cueAlertsSet('nope', true), /Unknown alert/);
});

test('PA4 alert text never carries bank details, amounts or files', () => {
  const t = sandbox(), c = s => t.ctx.cueAlertClean_(s);
  assert.strictEqual(c('Please pay ₱15,500 to BDO account no. 0123 4567 8901 today'), 'Please pay an amount to BDO account … today');
  assert.strictEqual(c('GCash 09171234567 for PHP 1,500.50 and P 300'), 'GCash … for an amount and an amount');
  assert.strictEqual(c('See Quotation_KLM.pdf at https://drive.google.com/file/d/abc'), 'See a file at');
  assert.strictEqual(c('Project S-26579436KL venue handover'), 'Project S-26579436KL venue handover', 'a project code stays');
  assert.strictEqual(c('x'.repeat(300)).length, 160);
  const p = paBox(); p.ctx.cueAlertMsgr_('cue-m2', 'Ana', 'Paid ₱6,000 to card 4111-1111-1111-1111');
  assert.strictEqual(p.sent[0].body.body, 'Paid an amount to card …');
});

test('PA4b an HTTP status code is not a peso amount (alerts read "HTTan amount", 25 Nov 2026)', () => {
  const t = sandbox(), c = s => t.ctx.cueAlertClean_(s);
  assert.strictEqual(c('Canvas did not answer msgr_due (HTTP 500)'), 'Canvas did not answer msgr_due (HTTP 500)');
  assert.strictEqual(c('Canvas did not answer read_rows (HTTP 500)'), 'Canvas did not answer read_rows (HTTP 500)');
  assert.strictEqual(c('Pay P500 now, or P 1,200 later'), 'Pay an amount now, or an amount later', 'a peso amount still comes out');
});

test('PA5 a failed send never stops the caller; a failing job alerts once until it runs OK again', () => {
  const d = paBox({ down: true });
  assert.strictEqual(d.ctx.cueAlert_('am', 'cue-1', '8 AM update', 'x'), 'failed');
  const t = paBox(), rows = [];
  t.ctx.boomJob = () => { throw new Error('Gmail did not answer\nstack'); }; t.ctx.okJob = () => 3;
  const J = { job: 'New mail', fn: 'boomJob' };
  t.ctx.cueJobRun_(J, rows); t.ctx.cueJobRun_(J, rows);
  deq(rows.map(r => r[3]), ['Failed', 'Failed'], 'the job rows are written as before');
  deq(t.sent.map(x => [x.body.title, x.body.body, x.body.url]), [['Job failed: New mail', 'Gmail did not answer', 'https://script.google.com/macros/s/CUE/exec?view=admin&sec=sched']]);
  t.ctx.cueJobRun_({ job: 'New mail', fn: 'okJob' }, rows); t.ctx.__wait(10 * 60e3); t.ctx.cueJobRun_(J, rows);
  assert.strictEqual(t.sent.length, 2, 'alerts again after an OK run');
  t.ctx.cueJobRun_({ job: 'Other', fn: 'okJob' }, rows); assert.strictEqual(t.sent.length, 2, 'an OK job sends nothing');
});

test('PA6 the 8 AM update and the 2 PM chasers alert with their thread; the hooks sit where the lines are posted', () => {
  const t = paBox();
  t.ctx.cueAlertK0_('am', 'cue-k0', { items: [1, 2, 3], text: 'Good morning, your 8 AM update\n1. Critical today: King\'s Day crew call time unconfirmed\n2. x' });
  t.ctx.cueAlertK0_('pm', 'cue-k1', { chasers: 0 });
  t.ctx.cueAlertK0_('pm', 'cue-k2', { chasers: 2 });
  deq(t.sent.map(x => [x.body.title, x.body.body, x.body.tag]), [['8 AM update: 3 items for your OK', 'Critical today: King\'s Day crew call time unconfirmed', 'cue-k0'],
    ['2 PM chasers: 2 for your OK', 'Reply in Cue with the numbers to draft them.', 'cue-k2']]);
  const src = f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
  assert.ok(/'Your 8 AM update for today is ready\.', '>' \+ id\);   \/\/ CUE-PLAIN-STATUS-2026-11-18\n  cueAlertK0_\(mode, id, K\);/.test(src('CueMorning.gs')));
  assert.strictEqual((src('CueMessenger.gs').match(/cueAlertMsgr_\(/g) || []).length, 2, 'linked crew and not-yet-linked people');
  assert.ok(/alerts\.forEach\(\(\[root, id, agent, line\]\) => \{ cueAlertAgent_\(root, id, agent, line\); \}\)/.test(src('CueAgentDrafts.gs')));
  assert.ok(/cueAlertJobRun_\(j\.job, err\)/.test(src('CueJobs.gs')));
});

test('PA7 a new agent card alerts once, grouped per agent thread; a status change does not alert', () => {
  const t = paBox({ props: { CUE_AGD_STATE: JSON.stringify({ at: Date.parse('2026-10-21T03:00:00Z') }) } });
  const d = n => ({ draft_id: 'DRF-' + n, agent: 'Account Specialist', type: 'email', type_label: 'Email', item: 'Venue handover ' + n, project: '', status: 'Waiting for Kiko',
    subject: 's', body: 'b', lines: [], to: 'a@example.com', reason: '' });
  t.ctx.cueAgdSync_([d('0001')]); t.ctx.cueAgdSync_([d('0001'), d('0002')]);
  const B = t.sent.map(x => x.body);
  deq(B.map(x => [x.title, x.renotify]), [['Account Specialist', true], ['Account Specialist · 2 updates', false]]);
  assert.strictEqual(B[0].tag, B[1].tag, 'one agent thread');
  t.ctx.cueAgdSync_([Object.assign(d('0001'), { status: 'Sent' })]); assert.strictEqual(t.sent.length, 2);
});

test('PA8 Open setup page gets a one-time link and keeps Cue\'s address for the tap; the page opens ?thread= at its root', () => {
  const t = paBox();
  deq(t.ctx.cueAlertsSetup(), { url: PA_URL + '/setup?code=' + 'ab'.repeat(16), minutes: 10 });
  assert.strictEqual(t.props.CUE_ALERTS_OPEN || t.ctx.PropertiesService.getScriptProperties().getProperty('CUE_ALERTS_OPEN'), 'https://script.google.com/macros/s/CUE/exec');
  deq(t.ctx.cueAlertsTest(), { phones: 1, sent: 1 });
  assert.throws(() => sandbox().ctx.cueAlertsSetup(), /not connected yet/);
  const page = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexCards.html'), 'utf8');
  assert.ok(/\/\^cue-\[0-9A-Za-z-\]\{6,60\}\$\/\.test\(t\)\) refresh\(function \(\) \{ var by = byId\(\); if \(by\[t\]\) goThread\(rootOf\(t, by\)\); \}\)/.test(page));
  const pages = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexPages.html'), 'utf8');
  assert.ok(pages.includes('<th>Alert</th><th>On</th><th>Last sent</th>') && pages.includes('>Open setup page</button>') && pages.includes('>Send a test alert</button>'));
});

test('PA9 the cue-alerts Worker passes its own tests (keys, one-time code, VAPID push, next once, setup page)', () => {
  require('child_process').execFileSync(process.execPath, [path.join(__dirname, '..', 'alerts', 'alerts-worker.test.mjs')], { stdio: 'pipe' });
});

test('PA10 Connect alerts: Cue makes its own key and keeps it only when the alerts service took it (no paste)', () => {
  const t = paBox({ props: { CUE_ALERTS_KEY: '', CUE_ALERTS_URL: '' } });
  assert.strictEqual(t.ctx.cueAlerts().ready, false);
  assert.ok(fs.readFileSync(path.join(__dirname, '..', 'src', 'CueAlerts.gs'), 'utf8').includes("const CUE_ALERTS_DEFAULT_ = 'https://cue-alerts.kikodacanay14-17a.workers.dev';"));
  const c = paBox({ pairClosed: true, props: { CUE_ALERTS_KEY: '' } });
  assert.throws(() => c.ctx.cueAlertsConnect(), /not open for connecting/);
  assert.ok(!c.ctx.PropertiesService.getScriptProperties().getProperty('CUE_ALERTS_KEY'));
  const o = paBox({ props: { CUE_ALERTS_KEY: '' } });
  assert.strictEqual(o.ctx.cueAlertsConnect().ready, true);
  const key = o.ctx.PropertiesService.getScriptProperties().getProperty('CUE_ALERTS_KEY');
  assert.ok(/^[0-9a-f]{64}$/.test(key)); deq([o.sent[0].path, o.sent[0].body], ['/pair', { key }]);
  const page = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexPages.html'), 'utf8');
  assert.ok(page.includes('data-al-act="connect">Connect alerts</button>') && page.includes("call('cueAlertsConnect'"));
});
