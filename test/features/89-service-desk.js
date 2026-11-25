// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: SERVICE-DESK-2026-11-07 (CueServiceDesk.gs).
// Kiko 7 Nov 2026 11:59Z, answer 3 ("can be thru Cue"): Cue tells Kiko in its chat about each new Canvas bug report, once.
const SD_LINK = 'https://script.google.com/macros/s/AKfycbCANVAS/exec?page=servicedesk&bug=';
const sdItem = (n, o = {}) => Object.assign({ id: 'BUG-' + String(n).padStart(4, '0'), n, status: 'New', at: '2026-11-07 15:00', by: 'mariana.ocumas@blankspaceevent.com',
  page: 'Projects', project: 'S-6133716KI', text: 'Save on the Scope tab spins for ever.', picture: true, link: SD_LINK + 'BUG-' + String(n).padStart(4, '0') }, o);
const sdBox = items => { const calls = []; const t = sandbox({ bridgeFn: b => { calls.push(b.action); if (b.action === 'service_desk_new') return { items: items() }; } });
  delete t.props.CUE_SD_STATE; return { t, calls, lines: () => (t.tabs.Chat ? t.tabs.Chat.rows : []).filter(r => /^New bug report/.test(String(r[2]))).map(r => r[2]) }; };
test('SD1 new reports: one chat line each, oldest first, with who, page, project, text, picture note and an Open button', () => {
  let items = [sdItem(2, { picture: false, project: '', page: 'Freelancers', text: 'Freelancers list is empty.' }), sdItem(1)];
  const b = sdBox(() => items);
  assert.strictEqual(b.t.ctx.cueSdTick_(), 2);
  const L = b.lines();
  assert.strictEqual(L.length, 2);
  assert.ok(/^New bug report BUG-0001 from mariana\.ocumas@blankspaceevent\.com \(Projects, S-6133716KI\): Save on the Scope tab spins for ever\. A picture came with it\. \[\[canvas\|Open BUG-0001 in Service Desk\|https:\/\/script\.google\.com\/.*bug=BUG-0001\]\]$/.test(L[0]), L[0]);
  assert.ok(/BUG-0002 .*\(Freelancers\): Freelancers list is empty\. \[\[canvas/.test(L[1]) && !/picture/.test(L[1]), L[1]);
  assert.strictEqual(bridgeCheck('service_desk_new', {}), '');
});
test('SD2 told once: the next run (15 min later) posts only reports above the highest one already told; not due before that', () => {
  let items = [sdItem(1)];
  const b = sdBox(() => items);
  b.t.ctx.cueSdTick_();
  assert.strictEqual(b.t.ctx.cueSdTick_(), null, 'not due within 15 minutes');
  const st = JSON.parse(b.t.props.CUE_SD_STATE); st.at -= 15 * 60000; b.t.props.CUE_SD_STATE = JSON.stringify(st);
  items = [sdItem(1), sdItem(3, { text: 'x'.repeat(400) })];
  assert.strictEqual(b.t.ctx.cueSdTick_(), 1);
  const L = b.lines();
  assert.strictEqual(L.length, 2);
  assert.ok(/BUG-0003 .*: x{299}… A picture/.test(L[1]), 'text cut at 300 characters');
  assert.strictEqual(JSON.parse(b.t.props.CUE_SD_STATE).n, 3);
});
test('SD3 nothing new: no chat line; the job is listed and the read is allowed in the cloud check', () => {
  const b = sdBox(() => []);
  assert.strictEqual(b.t.ctx.cueSdTick_(), 0);
  assert.strictEqual(b.lines().length, 0);
  assert.ok(b.t.ctx.cueJobs_().some(j => j.fn === 'cueSdTick_'), 'listed in the background jobs');
  assert.ok(/CUE_CHECK_READS_ = \[[^\]]*'service_desk_new'/.test(fs.readFileSync(path.join(__dirname, '..', 'src', 'CueCheck.gs'), 'utf8')), 'a read the cloud check may run');
});
test('SD4 the line names the Application first when Canvas sends one (BUG-FORM-APP-2026-11-25)', () => {
  const b = sdBox(() => [sdItem(5, { app: 'Charter', expected: 'It saves.' })]);
  assert.strictEqual(b.t.ctx.cueSdTick_(), 1);
  const L = b.lines();
  assert.ok(/^New bug report BUG-0005 from \S+ \(Charter, Projects, S-6133716KI\): Save on the Scope tab/.test(L[0]), L[0]);
});
