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
test('AGG2 CUE-CHANNELS-2026-11-18: the groups are Agent Updates, Jobs, Systems and Threads; needs-you first; a group number sums its channels; the welcome count still counts every waiting thread', () => {
  assert.ok(AGG_SRC.includes("[['proc', 'Process Updates'], ['agent', 'Agent Updates'], ['job', 'Jobs'], ['sys', 'Systems'], ['rest', 'Threads']]"));
  assert.ok(/grp = chanGroup\(t, st\)/.test(AGG_SRC) && /G\[grp\]\.push\(/.test(AGG_SRC));
  assert.ok(/if \(st\.need\) waiting\+\+;/.test(AGG_SRC), 'waiting threads still counted');
  assert.ok(/!a\.st\.need !== !b\.st\.need \? \(a\.st\.need \? -1 : 1\)/.test(AGG_SRC), 'waiting on Kiko first');
  assert.ok(/var gn = sum\(l\) \+ extra\.reduce\(/.test(AGG_SRC), 'the group number is the sum of its channels');
  assert.ok(/data-thread="' \+ esc\(x\.k\)/.test(AGG_SRC), 'a row opens its channel');
});
