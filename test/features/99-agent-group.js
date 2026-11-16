// Part of test/cue.test.js. Feature: AGENT-GROUP-2026-11-16 (src/IndexThreads.html listGroup, renderThreadList). Kiko 16 Nov 2026
// 14:34:51Z "in Cue theres that area on top with the CRM - i want the agent chats to have a place there"; design approved 14:36:42Z.
const AGG_SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexThreads.html'), 'utf8');
const AGG_FN = (() => {
  const a = AGG_SRC.indexOf('  var MAIL_ONLY = '), b = AGG_SRC.indexOf('  function threadState(th) {');
  const ctx = {}; vm.runInNewContext(AGG_SRC.slice(a, b) + '\nthis.listGroup = typeof listGroup === "function" ? listGroup : null;', ctx); return ctx.listGroup;
})();
test('AGG1 an agent\'s thread goes to the Agents group whatever its state; other threads keep Waiting on you, Working on and Recent', () => {
  assert.ok(AGG_FN, 'listGroup exists between listShows and threadState');
  const ag = { reqs: [{ id: 'a', kind: 'agentdraft', agd: { agent: 'Account Specialist' } }] }, job = { reqs: [{ id: 'b', kind: 'bids' }] };
  deq([AGG_FN(ag, { need: 1, text: 'Needs you' }, false), AGG_FN(ag, { text: 'Closed' }, false), AGG_FN(ag, { text: 'Working' }, false)], ['agent', 'agent', 'agent']);
  deq([AGG_FN(job, { need: 1, text: 'Needs you' }, false), AGG_FN(job, { text: 'Working' }, false), AGG_FN(job, { text: 'Closed' }, false)], ['need', 'work', 'rest']);
  deq([AGG_FN(ag, { need: 1, text: 'Needs you' }, true), AGG_FN(ag, { text: 'Closed' }, true)], ['need', 'rest'], 'the Archived view keeps the old groups');
});
test('AGG2 the Agents group sits under From Canvas, before Waiting on you, needs-you first, counts only waiting agents, and the welcome count still counts them', () => {
  const cvs = AGG_SRC.indexOf('<span>From Canvas</span>'), grp = AGG_SRC.indexOf("[['agent', 'Agents'], ['need', 'Waiting on you']");
  assert.ok(cvs > 0 && grp > cvs, 'Agents comes after From Canvas and before Waiting on you');
  assert.ok(/G\[listGroup\(t, st, showArchived\)\]\.push\(/.test(AGG_SRC));
  assert.ok(/var title = threadTitle\(t\), st = threadState\(t\); if \(st\.need\) waiting\+\+;/.test(AGG_SRC), 'Welcome back count unchanged: every waiting thread, agents included');
  assert.ok(/g\[0\] === 'agent' && !a\.st\.need !== !b\.st\.need \? \(a\.st\.need \? -1 : 1\)/.test(AGG_SRC), 'agents waiting on Kiko first');
  assert.ok(/var gn = g\[0\] === 'agent' \? l\.filter\(function \(x\) \{ return x\.st\.need; \}\)\.length : l\.length;/.test(AGG_SRC));
  assert.ok(/data-thread="' \+ esc\(x\.k\)/.test(AGG_SRC), 'a row opens its thread, the same row as the other groups');
});
