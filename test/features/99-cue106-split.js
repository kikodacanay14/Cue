test('SPLIT1 only the expanded identifiable row offers a local scope drawer', () => {
  const { ctx } = edGrab(), v = edView();
  ctx.agdRows[v.id] = 'all';
  assert.ok(!/Split into scopes/.test(ctx.agdUpdHtml(v)));
  ctx.agdRowOpen[v.id] = 'REQ26-11087-02';
  const h = ctx.agdUpdHtml(v);
  assert.strictEqual((h.match(/Split into scopes/g) || []).length, 1);
  assert.match(h, /Preview only · Not connected to AS/);
  assert.match(h, /type="number" min="2" step="1" required/);
  assert.match(h, /<textarea[^>]+data-agsplit-comment/);
  assert.ok(h.includes('data-agsplit="REQ26-11087-02"'));
});
test('SPLIT2 split form is local, rejects fractional or fewer than two scopes, and does not submit an approval', () => {
  const page = cuePage(), a = page.indexOf('  function agdBindSplit('), b = page.indexOf('\n  }\n', a);
  assert.ok(a >= 0 && b > a, 'local handler exists');
  let focused = 0, shown = 0, prevented = 0, result = {};
  const panel = { hidden: true }, count = { value: '', setCustomValidity(s) { this.error = s; }, reportValidity() { shown++; }, focus() { focused++; } },
    comment = { value: '' }, toggle = { setAttribute(k, v) { this[k] = v; }, focus() { focused++; } }, form = {};
  const refs = { '[data-agsplit-toggle]': toggle, '[data-agsplit-panel]': panel, '[data-agsplit-count]': count,
    '[data-agsplit-comment]': comment, '[data-agsplit-result]': result, form };
  const root = { querySelector(s) { return refs[s]; }, getAttribute() { return 'REQ26-11087-02'; } };
  const ctx = vm.createContext({});
  vm.runInContext(page.slice(a, b + 4), ctx);
  ctx.agdBindSplit(root);
  toggle.onclick();
  assert.strictEqual(panel.hidden, false);
  assert.strictEqual(toggle['aria-expanded'], 'true');
  assert.strictEqual(focused, 1);
  for (const value of ['1', '2.5', '2e1', '999999999999999999999']) {
    count.value = value;
    form.onsubmit({ preventDefault() { prevented++; } });
    assert.match(count.error, /whole number/);
    assert.strictEqual(result.textContent, '');
  }
  assert.strictEqual(shown, 4);
  count.value = '3';
  comment.value = '  Hang sign separately.  ';
  form.onsubmit({ preventDefault() { prevented++; } });
  assert.strictEqual(prevented, 5);
  assert.match(result.textContent, /REQ26-11087-02.*3 scopes.*Hang sign separately/);
  assert.match(result.textContent, /Nothing was sent or saved/);
  toggle.onclick();
  assert.strictEqual(panel.hidden, true);
  assert.strictEqual(toggle['aria-expanded'], 'false');
});
