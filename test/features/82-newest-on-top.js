// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: newest message on top.
// Kiko 3 Nov 2026 06:29Z, after hearing the newest chat line sits at the bottom: "whyich is wrong and its so hard coz i have to
// scroll all the way... please change that". The main chat and each thread show the newest message first and stay at the top.

test('NT1 the main chat builds one block per message (thread row under it) and shows the blocks newest first', () => {
  const html = cuePage();
  const a = html.indexOf('function renderMain('), body = html.slice(a, html.indexOf('\n  }\n', a) + 4);
  assert.ok(/allLines\(\)\.forEach\(function \(m\) \{ h = ''; one\(m\); if \(h\) out\.push\(h\)/.test(body), 'one block per message');
  assert.ok(/h = out\.reverse\(\)\.join\(''\)/.test(body), 'blocks newest first');
});

test('NT2 a thread shows its card on top, then its messages newest first, then the request at the bottom', () => {
  const html = cuePage();
  const a = html.indexOf('function renderThread('), body = html.slice(a, html.indexOf('\n  }\n', a) + 4);
  assert.ok(/t\.lines\.slice\(\)\.reverse\(\)\.map\(msgHtml\)/.test(body), 'messages newest first');
  assert.ok(/'<\/div>' \+ cards : ''\) \+ older/.test(body), 'cards before the messages');
});

test('NT3 Cue never scrolls the chat or a thread down to the end; it keeps them at the top', () => {
  const html = cuePage();
  assert.ok(!/scrollTop\s*=\s*[^;]*scrollHeight/.test(html), 'no scroll to the bottom anywhere on the page');
  const a = html.indexOf('function renderChat('), body = html.slice(a, html.indexOf('\n  }\n', a) + 4);
  assert.ok(/sc\.scrollTop = 0/.test(body) && /ps\.scrollTop = 0/.test(body));
});
