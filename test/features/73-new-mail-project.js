// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: New mail leaves project emails to Team Cue.
// Kiko 30 Oct 2026 10:12Z: "the New email thread is still not filtering project emails" (a Telus PO invoice filed under Trick or Treat -
// Manila, and an embassy email about King's Day).
test('NMP1 a line Canvas puts under a project leaves New mail, even when its match was saved earlier or has no project id', () => {
  const t = sandbox();
  const items = [
    { key: 'a', inbox: 'mine', known: { who: 'Client', name: 'Procurement TIP', project: 'Trick or Treat - Manila', pid: '' } },   // saved earlier, no id
    { key: 'b', inbox: 'mine', thread_id: 't2' },
    { key: 'c', inbox: 'mine', known: { who: 'Client', name: 'X', project: '', pid: '' } },
    { key: 'd', inbox: 'mine', known: { project: 'P' }, task_id: 'T1' }];
  t.ctx.cueNmKnown_({ t2: { id: 't2', who: 'Supplier', name: 'S', project: 'Gala', pid: 'P-0042' } }, items);
  assert.strictEqual(items[0].removed, 'project');
  assert.strictEqual(items[1].removed, 'project'); assert.strictEqual(items[1].known.pid, 'P-0042');
  assert.ok(!items[2].removed, 'a client with no project stays'); assert.ok(!items[3].removed, 'a line with a task keeps its task');
  t.ctx.cueNmKnown_(null, [items[2]]);   // Canvas unreadable: nothing breaks
});
test('NMP2 a subject naming a Canvas project is a project email; short names never match', () => {
  const t = sandbox();
  const names = t.ctx.cueNmProjectNames_({ projects: [{ id: 'P-1', name: "King's Day 2026" }, { id: 'P-2', name: 'Gala' }, { id: 'P-3', name: 'Puratos King\'s Day' }] });
  assert.deepStrictEqual(names, ["King's Day 2026", "Puratos King's Day"]);
  const page = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'IndexPages.html'), 'utf8');
  assert.ok(/function nmProj\(it\)/.test(page) && /removed: 'project'/.test(page), 'the page treats a Canvas project match as a project email at once');
});
