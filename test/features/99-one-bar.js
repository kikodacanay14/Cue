// Part of test/cue.test.js. Feature: CUE-ONE-BAR-2026-11-25 (Kiko 25 Nov 2026, screenshots of the Account Specialist channel inside
// Canvas: "make the header like Cue > Channels > Account Specialist - like a breadcrumb and should be clickable to navigate"; "There
// are 2 x for Close? Retain 1 only"; "remove the Archive button already"; "Please change the hover effect - font cant be read";
// "Remove the 'Messges here go to...."; "Yes, all Cue" to the Canvas font. Mockup approved "Approve all", build approved "Yes, build it").
const OB = { page: require(path.join(__dirname, 'page.js')).cuePage(), src: f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8') };
test('OB1 breadcrumb: the list, General and a channel each show Cue › Channels › name; Cue opens General and Channels opens the list', () => {
  const index = OB.src('Index.html'), th = OB.src('IndexThreads.html'), viewer = OB.src('IndexViewer.html');
  assert.ok(/<div class="lhead" id="lhead"><span class="crumb"><button type="button" id="l-home">Cue<\/button><span class="sep" aria-hidden="true">›<\/span><span class="t" aria-current="page">Channels<\/span><\/span>/.test(index), 'list header');
  assert.ok(/<span class="crumb"><button type="button" id="gen-home">Cue<\/button><span class="sep" aria-hidden="true">›<\/span><button type="button" id="gen-back">Channels<\/button><span class="sep" aria-hidden="true">›<\/span><span class="t" aria-current="page">General<\/span><\/span>/.test(index), 'General header');
  assert.ok(th.includes(`'<span class="sep" aria-hidden="true">›</span><span class="t" aria-current="page" title="' + esc(name) + '">' + esc(name) + '</span></span>'`), 'the channel name is the last part and is not a button');
  assert.ok(viewer.includes("$('gen-home').onclick = $('l-home').onclick = goGeneral;") && viewer.includes("if (p === 'close') return goGeneral();") && viewer.includes("if (p === 'pane') return showList();"), 'Cue goes to General, Channels to the list');
});
test('OB2 one close only and no Archive button: the channel header draws neither the ✕ nor the three dots', () => {
  const th = OB.src('IndexThreads.html'), head = th.slice(th.indexOf('function renderPaneTabs'), th.indexOf("setHtml($('ptabs'), h)"));
  assert.ok(head.length > 200, 'found the header builder');
  assert.ok(!/pane-x/.test(head) && !/Back to General/.test(head), 'no second close');
  assert.ok(!/data-p="task"/.test(head) && !/'Archive'/.test(head), 'no three-dot Archive button');
  assert.ok(/'check', 'Close this thread'/.test(head), 'the close-thread tick stays');
});
test('OB3 hover on a coloured channel bar is a tint that keeps the text readable, never the white panel colour', () => {
  const css = OB.src('IndexStyle.html');
  assert.ok(/#ptabs\.cat-crm button:hover, #ptabs\.cat-gen button:hover,[^{]*\{ background:rgba\(255,255,255,\.16\); color:#fff; \}/.test(css), 'white text on a light tint');
  assert.ok(/#ptabs\.cat-proj button:hover,[^{]*\{ background:rgba\(22,21,27,\.1\); color:#16151B; \}/.test(css), 'ink text on the blue bar');
});
test('OB4 the "Messages here go to ... only" line is never shown', () => {
  assert.ok(/\$\('tagnote'\)\.hidden = true;/.test(OB.page) && !/'Messages here go to /.test(OB.page), 'the sentence is no longer built');
});
test('OB5 all of Cue uses the Canvas font: DM Sans is loaded and named, Quicksand is not', () => {
  assert.ok(/fonts\.googleapis\.com\/css2\?family=DM\+Sans:/.test(OB.src('Index.html')) && /--font:'DM Sans', system-ui/.test(OB.src('IndexStyle.html')));
  assert.ok(!/family=Quicksand/.test(OB.page) && !/'Quicksand'/.test(OB.page) && !/Quicksand/.test(OB.src('CueTemplates.gs')), 'no Quicksand in the page or the email templates');
});
