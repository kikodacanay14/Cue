// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: the chat and an open thread stay at the bottom.
// Kiko 3 Nov 2026: "its so hard coz i have to scroll all the way... please change that", then "should be at the boottom!!".
// The newest line stays at the bottom; Cue keeps the view pinned there even when the page gets its size or content late.

test('SB1 the chat and the open thread are pinned to the bottom; Kiko scrolling up unpins, scrolling to the end pins again', () => {
  const html = cuePage();
  assert.ok(/function pinBottom\(el, inner, page\)/.test(html));
  assert.ok(/pinBottom\(\$\('scroller'\), \[\$\('msgs'\)\], 'page-chat'\); pinBottom\(\$\('pscroll'\), \[\$\('tmsgs'\)\], 'page-thread'\)/.test(html));
  assert.ok(/el\._pin = el\.scrollHeight - el\.scrollTop - el\.clientHeight < 80/.test(html), 'a scroll by Kiko sets the pin');
  assert.ok(/new ResizeObserver\(go\)/.test(html), 'a late size or content change scrolls a pinned view to the end');
});

test('SB2 newest stays at the bottom: no reversed chat, and a link to a spot in a thread unpins it', () => {
  const html = cuePage();
  assert.ok(!/out\.reverse\(\)/.test(html) && !/t\.lines\.slice\(\)\.reverse\(\)/.test(html));
  const a = html.indexOf('function renderChat('), body = html.slice(a, html.indexOf('\n  }\n', a) + 4);
  assert.ok(/if \(toSpot\(\)\) ps\._pin = false/.test(body));
});
