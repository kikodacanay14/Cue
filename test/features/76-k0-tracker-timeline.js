// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: the 8 AM update reads the Shared Task Tracker
// and each ongoing project's timeline (Kiko 1 Nov 2026: "it should also reference the project timeline of any ongoing project";
// "1. add. anything assigned to internal that i need to nudge / 2. They should / 3. yes / 4. Yes / 5. yes").
const K0W_CS_ = { today: '2026-10-21', from: '2026-10-14', more: 0, missing: [], projects: [
  { id: 'S-10000001AA', name: 'Hiraya', date: '2026-11-20',
    timeline: { total: 5, done: 1, due: 2, pct: 20, late: [{ task: 'Stage masking artwork', end: '2026-10-21', milestone: false }, { task: 'Venue ocular', end: '2026-10-18', milestone: false }],
      next: [{ task: 'Old milestone Canvas still lists', end: '2026-10-19', milestone: true }, { task: 'Client design sign-off', end: '2026-10-23', milestone: true }, { task: 'Final run of show', end: '2026-10-30', milestone: true }, { task: 'Tarp print', end: '2026-10-22', milestone: false }] },
    tasks: [{ item: 'Book the LED wall', assigned: 'Marco', deadline: '2026-10-20', late: true }, { item: 'Confirm caterer headcount', assigned: 'Kiko', deadline: '2026-10-21', late: false },
      { item: 'Send rooming list', assigned: 'Joy', deadline: '2026-10-22', late: false }, { item: 'Plan the dry run', assigned: 'Joy', deadline: '2026-11-10', late: false }] }] };
function k0wBox(o) {
  const t = k0Box(Object.assign({ cs: K0W_CS_ }, o || {}));
  const sh = sheetMock(); t.tabs.Tasks = sh;
  [['Shared Task Tracker'], ['Use this as the shared source of truth.'], [], ['Task ID', 'Task', 'Category', 'Priority', 'Status', 'Due Date', 'Notes', 'Updated At'],
    ['T-101', 'Send the Ayala presentation deck', 'Work', 'High', 'In Progress', '10/21/2026', '', '10/20/2026'],
    ['T-102', 'Globe CE', 'Work', 'High', 'Not Started', '10/19/2026', '', '10/19/2026'],
    ['T-103', 'Converge accreditation', 'Work', 'Medium', 'Blocked', '', 'Waiting on Converge', '10/15/2026'],
    ['T-104', 'Canvas frontend UX', 'Work', 'Medium', 'In Progress', '', '', '10/10/2026'],
    ['T-105', 'Renew passport', 'Personal', 'Medium', 'Not Started', '10/21/2026', '', '10/01/2026'],
    ['T-106', 'Send Hiraya invoice', 'Work', 'High', 'Complete', '10/20/2026', '', '10/20/2026'],
    ['T-107', 'Shared Drive clean-up', 'Work', 'Low', 'Not Started', '', '', '10/01/2026']].forEach(r => sh.appendRow(r.concat(Array(8 - r.length).fill(''))));
  return t;
}
const k0wText = (t, o) => t.tabs.Chat.rows.filter(r => r[3] === '>' + o.request_id)[0][2];

test('KW1 Today\'s focus reads the Tracker and the timelines: due today, overdue, assigned, blocked, nudge your team, key milestones, personal', () => {
  const t = k0wBox(); t.at('2026-10-21', 8, 0); const ai = t.log.gpt.length;
  const o = t.ctx.cueK0Run_(false, 'am'), x = k0wText(t, o);
  assert.strictEqual(t.log.gpt.length, ai, 'no AI call');
  assert.ok(/- Critical today\n(  - .*\n)*  - Send the Ayala presentation deck \(T-101\): due today/.test(x), x);
  assert.ok(/  - Hiraya: Stage masking artwork ends today \(timeline\)/.test(x) && /  - Hiraya: Confirm caterer headcount \(due today\)/.test(x), 'timeline row and Kiko\'s TRI task due today');
  assert.ok(/- Overdue\n(  - .*\n)*  - Globe CE \(T-102\): 2 days late/.test(x) && /  - Hiraya: Venue ocular, 3 days late \(timeline\)/.test(x));
  assert.ok(/- Assigned to you\n  - Canvas frontend UX \(T-104\)/.test(x));
  assert.ok(/- Nudge your team\n  - Hiraya: Book the LED wall \(Marco, 1 day late\)\n  - Hiraya: Send rooming list \(Joy, due tomorrow\)\n/.test(x), x);
  assert.ok(!/Plan the dry run/.test(x), 'a team task due later is not a nudge yet');
  assert.ok(/- Blocked, waiting on someone\n  - Converge accreditation \(T-103\)/.test(x));
  assert.ok(/- Key milestones in the next 3 days\n  - Hiraya: Client design sign-off, Fri 23 Oct\n/.test(x) && !/Final run of show/.test(x) && !/Tarp print/.test(x) && !/Old milestone/.test(x), 'milestones from today to 3 days ahead only');
  assert.ok(/- Personal\n  - Renew passport \(T-105\): due today/.test(x) && !/Shared Drive clean-up/.test(x), 'Personal in its own group; Not Started with no date left out');
  t.log.csArgs.forEach(a => assert.strictEqual(bridgeCheck('client_status', a), '', 'real bridge schema'));
});

test('KW2 Yesterday\'s summary: Completed (Tracker rows done yesterday) and Moved (due date changed since the last 8 AM)', () => {
  const t = k0wBox(); t.at('2026-10-21', 8, 0);
  t.props.CUE_K0_TT_DUE = JSON.stringify({ 'T-101': '2026-10-20', 'T-104': '' , 'T-102': '2026-10-19' });
  const x = k0wText(t, t.ctx.cueK0Run_(false, 'am'));
  assert.ok(/- Completed\n  - Send Hiraya invoice \(T-106\)/.test(x), x);
  assert.ok(/- Moved\n  - Send the Ayala presentation deck \(T-101\): Tue 20 Oct to Wed 21 Oct\n/.test(x) && !/Globe CE \(T-102\): Mon/.test(x), x);
  assert.strictEqual(JSON.parse(t.props.CUE_K0_TT_DUE)['T-101'], '2026-10-21', 'today\'s dates kept for tomorrow');
});

test('KW3 a Tracker or Canvas that cannot be read leaves its lines out and the update says so; it still goes out', () => {
  const t = k0Box({ noClientStatus: true }); t.at('2026-10-21', 8, 0);
  const o = t.ctx.cueK0Run_(false, 'am'), x = k0wText(t, o);
  assert.ok(/Could not read the Shared Task Tracker \(.+\); the project timelines in Canvas \(.+\)\. Those lines are left out today\./.test(x), x);
});

test('KW4 bids (Kiko 1 Nov: "add events management, lights and sounds", "on top of what you use now"): goods with no event are out', () => {
  const t = k0Box(), keep = x => t.ctx.cueBidsEventy_(x);
  ['Procurement of Office Supplies', 'Supply and Delivery of Business Plate Stickers for 2027.', 'Supply and Delivery of Speaker for the use of Local School Board',
    'LEDIPO-27-PS2-0063 PRINTING OF THE QUEZON CITY INVESTOR\'S GUIDE BOOK AND OTHERS FOR THE YEAR 2027'].forEach(x => assert.strictEqual(keep(x), false, x));
  ['PROCUREMENT OF EVENTS MANAGEMENT FOR THE CELEBRATION OF CAVITE CITY CULTURAL HERITAGE', 'Delivery of Mobile Sound System',
    'SUPPLY AND DELIVERY OF FOOD PACKS AND KIDDIE TOYS FOR THE 2026 NATIONAL CHILDREN\'S MONTH CELEBRATION', 'Procurement of Lights and Sounds',
    'Fabrication of Stage and Backdrop', 'Year-end Christmas party'].forEach(x => assert.strictEqual(keep(x), true, x));
  const prompt = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'CueBids.gs'), 'utf8');
  assert.ok(/Keep notices BSE could do: events, events management, conferences, launches, exhibits and booths, production, fabrication, stage and set, '\n\s*\+ 'audiovisual \(LED, sound, lights\), lights and sounds, styling and decor, event catering, souvenirs and event printing/.test(prompt), 'the list Kiko uses, plus events management and lights and sounds');
});
