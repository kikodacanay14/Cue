// Part of test/cue.test.js. Feature: AGENT-CARD-LABELS-2026-11-18 (Kiko 18 Nov 2026 02:14:31Z: "The titles though need to be in bold
// and line breaks after the values"; 02:14:49Z: "Make it a default design in all cards"). A "Label: value" line in any agent message or
// card shows the label in bold and ends with a line break; other lines and links stay as written; text is escaped.
function aclGrab() {
  const page = cuePage(), grab = name => { const a = page.indexOf('  function ' + name + '('); return page.slice(a, page.indexOf('\n  }\n', a) + 4); };
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(grab('esc') + '\n' + grab('agKv'), ctx);
  return { page, ctx };
}
test('ACL1 a "Label: value" line gets a bold label and its own line; plain lines, links and HTML stay safe', () => {
  const { ctx } = aclGrab();
  const h = ctx.agKv('Project: Pandamart Likha\nRevision: f2b20e17\nhttps://drive.google.com/file/d/x/view\nplain text line\nNotes for Kiko: <b>x</b>');
  assert.ok(h.includes('<span class="agkv"><b>Project:</b> Pandamart Likha</span>'), h);
  assert.ok(h.includes('<span class="agkv"><b>Revision:</b> f2b20e17</span>'), h);
  assert.ok(h.includes('https://drive.google.com/file/d/x/view\nplain text line'), 'a link is not a label: ' + h);
  assert.ok(h.includes('<b>Notes for Kiko:</b> &lt;b&gt;x&lt;/b&gt;'), 'values are escaped: ' + h);
  assert.ok(!/<\/span>\n/.test(h), 'no double break after a labelled line');
  assert.strictEqual(ctx.agKv('Status:'), '<span class="agkv"><b>Status:</b></span>');
  assert.strictEqual(ctx.agKv(null), '');
});
test('ACL2 every agent bubble and update card uses it, and the style gives each pair its own line', () => {
  const { page } = aclGrab();
  assert.ok(page.includes("'<span class=\"agtx\">' + agKv(noTok(agentSays(r))) + '</span>'"), 'agent bubble');
  assert.ok(page.includes("agKv(H.summary || A.body)") && page.includes('agKv(H.gaps)'), 'update card summary and gaps');
  assert.ok(/\.agkv \{ display:block;/.test(page), 'agkv block style');
});
