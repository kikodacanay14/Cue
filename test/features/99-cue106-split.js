// REQ-ADD-SPLIT-2026-11-26: the local preview (number of scopes and a comment, "Preview only · Not connected to AS") is replaced by the
// approved design (Kiko 25 Nov 2026 "A. Boxes, as drawn"; build approved 26 Nov): one row of boxes per scope, sent with the ticked line.
test('SPLIT1 only the expanded line Kiko can tick offers Split into scopes; the old preview is gone', () => {
  const { ctx } = edGrab(), v = edView();
  ctx.agdRows[v.id] = 'all';
  assert.ok(!/>Split into scopes</.test(ctx.agdUpdHtml(v)));
  ctx.agdRowOpen[v.id] = 'REQ26-11087-02';
  const h = ctx.agdUpdHtml(v);
  assert.strictEqual((h.match(/>Split into scopes</g) || []).length, 1);
  assert.ok(/data-act="agd-sc-add"[^>]*data-req="REQ26-11087-02">Split into scopes</.test(h));
  assert.ok(!/Preview only|data-agsplit/.test(h));
});
