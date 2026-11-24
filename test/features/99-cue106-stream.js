test('C106S1: local stream labels accept only known swatches and filters', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexThreads.html'), 'utf8');
  const start = src.indexOf('  var STREAM_LABELS ='); const end = src.indexOf('  function renderStreamTools(');
  assert.ok(start >= 0 && end > start, 'stream preferences exist');
  const ctx = { localStorage: { getItem: () => '{"filter":"intake","colors":{"intake":"teal","email":"bogus","unknown":"slate"}}' } };
  const p = vm.runInNewContext(src.slice(start, end) + '\nstreamPrefs', ctx);
  assert.strictEqual(p.filter, 'intake');
  assert.strictEqual(p.colors.intake, 'teal');
  assert.strictEqual(p.colors.email, undefined);
  assert.strictEqual(p.colors.unknown, undefined);
});
test('C106S2: a missing thumbnail retains a direct Drive link', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexViewer.html'), 'utf8');
  const start = src.indexOf('  function thumbUnavailable('), end = src.indexOf('  function viewFrame(');
  assert.ok(start >= 0 && end > start, 'thumbnail fallback exists');
  const link = { hidden: true }, holder = { querySelector: () => link, classList: { add: () => {} } };
  const im = { closest: () => holder };
  const ctx = { window: {}, im, imgData: (id, ok, fail) => fail() };
  vm.runInNewContext(src.slice(start, end) + '\nwindow.cueThumb(im,"test-abcdef")', ctx);
  assert.strictEqual(link.hidden, false);
  assert.strictEqual(im.hidden, true);
});
test('C106S3: an unavailable Requirements image remains openable directly in Drive', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexViewer.html'), 'utf8');
  const at = src.indexOf('  function thumbUnavailable('), end = src.indexOf('  function viewFrame(');
  const attrs = { 'data-agpic': '', href: 'https://drive.google.com/file/d/synthetic1/view' };
  const a = { removeAttribute: k => { delete attrs[k]; }, setAttribute: (k,v) => { attrs[k] = v; } };
  const ctx = { window: {}, im: { closest: sel => sel === 'a[data-agpic]' ? a : null }, imgData: (id, ok, fail) => fail() };
  vm.runInNewContext(src.slice(at, end) + '\nwindow.cueThumb(im,"synthetic1")', ctx);
  assert.strictEqual(a.textContent, 'Open in Drive');
  assert.strictEqual(attrs.href, 'https://drive.google.com/file/d/synthetic1/view');
  assert.strictEqual(attrs['data-drive-direct'], '');
  assert.strictEqual(attrs['data-agpic'], undefined);
});
test('C106S4: filtering hides other stream entries together with their adjacent action strip', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexThreads.html'), 'utf8');
  // CUE-LABELS-2026-11-25: the tool now also lists own labels, so the run includes the label settings and helpers declared before it.
  const at = src.indexOf('  var STREAM_LABELS ='), end = src.indexOf('  function streamReqKey(');
  const elt = (category, cls) => ({ seen: false, getAttribute: k => k === 'data-stream-category' ? category : null,
    classList: { contains: k => k === cls, toggle(k, v) { this.filtered = k === 'stream-filtered' && v; } } });
  const rows = [elt('email'), elt(null, 'actions'), elt('intake'), elt(null, 'actions'), elt(null, 'k0bids')];
  const tools = { firstElementChild: {}, querySelectorAll: () => [] }, sel = {};
  const ctx = { localStorage: { getItem: () => '{"filter":"intake"}' }, esc: x => String(x), setHtml: () => {}, $: k => ({ 'stream-tools': tools, 'stream-filter': sel, msgs: { children: rows } }[k]) };
  vm.runInNewContext(src.slice(at, end) + '\nrenderStreamTools()', ctx);
  assert.deepStrictEqual(rows.map(r => r.classList.filtered), [true, true, false, false, true]);
  assert.strictEqual(sel.value, 'intake');
});
test('C106S5: a persisted request label can override its inferred category without relabeling another request', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexThreads.html'), 'utf8');
  const prefsStart = src.indexOf('  var STREAM_LABELS ='), prefsEnd = src.indexOf('  function renderStreamTools(');
  const at = src.indexOf('  function streamReqKey('), end = src.indexOf('  function fileCardHtml(');
  const ctx = { state: { requests: [{ id:'cue-20261120000142-abcd', kind:'mail' }, { id:'cue-20261120000143-cdef',kind:'intake' }] },
    localStorage: { getItem: () => '{"labels":{"cue-20261120000142-abcd":"bids","cue-20261120000143-cdef":"bogus","__proto__":"email"}}' } };
  const result = vm.runInNewContext(src.slice(prefsStart,prefsEnd) + src.slice(at,end) + '\n[streamCategory({request_id:">cue-20261120000142-abcd"}), streamCategory({request_id:">cue-20261120000143-cdef"}), Object.keys(streamPrefs.labels).length]', ctx);
  assert.deepStrictEqual(Array.from(result), ['bids','intake',1]);
});
