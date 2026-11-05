// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: Cue Admin › For Approval, and single sections for Canvas.
/* ADMIN-GROUPS-2026-11-05 (Kiko 5 Nov 16:40Z "Reorganize Admin Page ... The For Approval move the to Cue"; his card pick 16:43Z "Show Canvas's
 * list in Cue"; "AI Usage and Cost to Admin > System Config, Connections to API Keys"). Cue Admin shows Canvas's own For Approval page in a frame
 * (Canvas checks Kiko's sign-in and does the Approve / Reject; Cue reads and writes nothing). Connections and AI usage and cost stay in Cue and
 * open alone with ?view=admin&sec=conn|usage&bare=1, which Canvas Admin shows; their group is hidden from Cue Admin's own list. */
const AG_PAGE = cuePage();
test('AG1 cueSettings gives the address of Canvas For Approval page alone, built from CUE_CANVAS_URL', () => {
  const u = 'https://script.google.com/a/macros/blankspaceevent.com/s/AKfyc_test/exec';
  const r = sandbox({ props: { CUE_CANVAS_URL: u } }).ctx.cueSettings();
  assert.strictEqual(r.canvas_approvals_url, u + '?open=approvals&bare=1');
  const bad = sandbox({ props: { CUE_CANVAS_URL: 'https://evil.example/exec' } }).ctx.cueSettings();
  assert.strictEqual(bad.canvas_approvals_url, '', 'a wrong address gives no frame');
});
test('AG2 Cue Admin lists For Approval first; Connections and AI usage stay as sections but leave the list', () => {
  assert.match(AG_PAGE, /<div class="sgrp">Approvals<\/div><button data-s="approvals">For Approval<\/button>\s*<div class="sgrp">How Cue thinks/);
  assert.match(AG_PAGE, /<button data-s="conn" hidden>Connections<\/button><button data-s="usage" hidden>AI usage and cost<\/button>/);
  ['approvals', 'conn', 'usage'].forEach(s => assert.match(AG_PAGE, new RegExp('<section data-sec="' + s + '" hidden>')));
});
test('AG3 ?sec= opens only a section that exists, and bare=1 hides the title and list only with a section', () => {
  assert.match(AG_PAGE, /var s = String\(l\.parameter\.sec \|\| ''\); if \(s && document\.querySelector\('#settings \[data-sec="' \+ s\.replace\(\/\[\^a-z\]\/g, ''\)/);
  assert.match(AG_PAGE, /adminBare = !!adminSec && l\.parameter\.bare === '1'/);
  assert.match(AG_PAGE, /body\.admin-bare #settings \.shead, body\.admin-bare #settings \.snav \{ display:none; \}/);
});
test('AG4 the For Approval frame is Canvas\'s address, escaped, with an Open in Canvas link; no address says so', () => {
  assert.match(AG_PAGE, /<iframe class="apfr" title="For Approval \(Canvas\)" src="' \+ esc\(u\) \+ '"><\/iframe>/);
  assert.match(AG_PAGE, /Canvas\\'s address is not set \(CUE_CANVAS_URL\)/);
});
