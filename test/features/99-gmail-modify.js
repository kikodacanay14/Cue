// Part of test/cue.test.js. Feature: ACC-8-SCOPE-2026-11-18 (card acc-8-read). Kiko 18 Nov 2026 02:31:01Z chose "Yes, add Gmail
// permission" on the card "Let Cue mark ignored and daily-list emails as read in Gmail?". The mark-read code shipped in 1.28.3
// switched off (PR #292 took the scope back out); this release adds gmail.modify to the manifest and to the scopes the
// "Fix Google access" button checks. Cue still only removes UNREAD: no archive, label or delete.
test('GMOD1 the manifest asks for gmail.modify and keeps every scope Cue already had', () => {
  const m = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'appsscript.json'), 'utf8'));
  const s = m.oauthScopes.map(x => x.replace('https://www.googleapis.com/auth/', ''));
  ['script.external_request', 'spreadsheets', 'drive.file', 'script.scriptapp', 'gmail.compose', 'gmail.readonly', 'gmail.modify', 'userinfo.email']
    .forEach(x => assert.ok(s.indexOf(x) >= 0, x));
  assert.ok(s.indexOf('https://mail.google.com/') < 0, 'never the full Gmail scope');
  assert.strictEqual(new Set(s).size, s.length, 'no scope listed twice');
});
test('GMOD2 Fix Google access treats a missing gmail.modify as missing and resets, and leaves a token that has it alone', () => {
  const t = sandbox({ scopes: ['spreadsheets', 'gmail.compose', 'gmail.readonly', 'drive.file'] });
  const a = t.ctx.cueFixAccess(); deq(a.missing, ['gmail.modify']); assert.strictEqual(a.reset, true); assert.strictEqual(t.log.invalidated, 1);
  const ok = sandbox({ scopes: ['spreadsheets', 'gmail.compose', 'gmail.readonly', 'gmail.modify', 'drive.file'] }).ctx.cueFixAccess();
  deq(ok.missing, []); assert.strictEqual(ok.reset, false);
});
test('GMOD3 marking read only removes UNREAD, through one batchModify call', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'CueMailTypes.gs'), 'utf8');
  const fn = src.slice(src.indexOf('function cueMtMarkRead_'), src.indexOf('\n}\n', src.indexOf('function cueMtMarkRead_')));
  assert.ok(/removeLabelIds: \['UNREAD'\]/.test(fn)); assert.ok(!/addLabelIds|\/trash|\/delete|INBOX/.test(fn), 'no archive, label or delete');
});
