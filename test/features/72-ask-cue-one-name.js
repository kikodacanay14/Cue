// Part of test/cue.test.js, loaded in file-name order into one shared scope. Bug fix: Ask Cue did nothing (Kiko, 30 Oct 2026 09:36Z:
// "Ask Cue is not working", 09:38Z: "nothing. it doesnt do anything"). Cue 1.27.89 added a second function named todayHtml to the
// page script. Both parts share one scope, so the new one replaced the main chat's one-line-a-day todayHtml(day, th), the chat render
// threw on its first job day, and the page stopped drawing and answering.
test('AK1 the page script declares each function once, so a new card cannot replace one the chat render uses', () => {
  const fs = require('fs'), path = require('path');
  const js = ['IndexChat', 'IndexViewer', 'IndexThreads', 'IndexPages', 'IndexCards'].map(n => fs.readFileSync(path.join(__dirname, '..', 'src', n + '.html'), 'utf8')).join('\n');
  const seen = {}, dup = [];
  (js.match(/^  function [A-Za-z0-9_$]+/gm) || []).forEach(m => { const n = m.slice(11); if (seen[n]) dup.push(n); seen[n] = 1; });
  assert.deepStrictEqual(dup, []);
  assert.ok(/function todayHtml\(day, th\)/.test(js) && /function todayTasksHtml\(t\)/.test(js));
});
