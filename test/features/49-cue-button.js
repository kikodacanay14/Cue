// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: cue-button.
/* ---------- CUE-BUTTON (Kiko 28 Oct 2026 04:25Z "it kinda looks like a loading image"; chose B, chat bubble, 04:29Z) ---------- */
test('CB1 the Cue button is the chat bubble on the BSE gradient everywhere, not the colour wheel', () => {
  const root = path.join(__dirname, '..'), read = f => fs.readFileSync(path.join(root, f), 'utf8');
  const GR = 'linear-gradient(135deg,#23006F 2%,#56009C 34%,#F000AA 62%,#F06A25 84%,#F4F12C 100%)';
  ['extension/content.js', 'src/Index.html'].forEach(f => {
    const t = read(f);
    assert.ok(!/conic-gradient/.test(t), f + ' still draws the colour wheel');
    assert.ok(t.includes(GR), f + ' uses the BSE gradient');
    assert.ok(t.includes('M16 5C9.4 5 4 9.6 4 15.3'), f + ' draws the speech bubble');
  });
  assert.ok(/aria-label="Open Cue"/.test(read('extension/content.js')), 'the bubble keeps its name for screen readers');
  const gs = read('src/Cue.gs');
  assert.ok(gs.includes("v = 'bubble-1'"), 'a new icon version makes Cue upload the new favicon once');
  const png = Buffer.from(/const CUE_ICON_PNG_ = '([^']+)'/.exec(gs)[1], 'base64');
  assert.strictEqual(png.readUInt32BE(16), 48); assert.strictEqual(png.readUInt32BE(20), 48);
  [16, 48, 128].forEach(n => {
    const b = fs.readFileSync(path.join(root, 'extension', 'icons', 'cue-' + n + '.png'));
    assert.strictEqual(b.readUInt32BE(16), n, 'cue-' + n + '.png is ' + n + ' px');
  });
});
