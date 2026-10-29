// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: Cue Admin.
/* CUE-ADMIN-2026-10-29 (Kiko 29 Oct 02:13Z-02:42Z; Epic Cue #193, stories #194-#197): ?view=admin shows the Settings sections as one
 * full page in Canvas's look, with two new sections (Triage rules, Release notes); the chat's Settings button opens it in a new tab. */

test('AD1 Triage rules lists the tab newest first, and Remove takes off only the row it names', () => {
  const t = sandbox(), sh = t.tabs['Triage rules'];
  sh.appendRow(['promo@shop.example', 'mute', new Date('2026-10-22T02:00:00Z'), 'promos']);
  sh.appendRow(['@bank.example', 'keep', new Date('2026-10-24T02:00:00Z'), 'bills']);
  sh.appendRow(['promo@shop.example', 'no_inquiry', new Date('2026-10-26T02:00:00Z'), '']);
  const L = t.ctx.cueAdminTriage();
  deq(L.map(x => [x.sender, x.rule, x.set, x.why]), [['promo@shop.example', 'no_inquiry', '26 Oct', ''], ['@bank.example', 'keep', '24 Oct', 'bills'], ['promo@shop.example', 'mute', '22 Oct', 'promos']]);
  const after = t.ctx.cueAdminTriageDel(L[2].key);
  deq(after.map(x => x.rule), ['no_inquiry', 'keep']);
  deq(sh.rows.slice(1).map(r => r[1]), ['keep', 'no_inquiry'], 'the same sender\'s other rule stays');
  deq(t.ctx.cueAdminTriageDel('nobody@x|1').length, 2, 'an unknown row removes nothing');
});

test('AD2 Release notes lists the Release Notes tab newest first, read only', () => {
  const t = sandbox();
  deq(t.ctx.cueAdminRelnotes(), [], 'no tab yet: an empty list, and the tab is made');
  const sh = t.tabs['Release Notes'];
  sh.appendRow(['a', 'Canvas', 'Supplier pages', '2026-10-21 05:10Z', '2026-10-21', 'T1', 'Posted', 'ANN-0011', '']);
  sh.appendRow(['b', 'Cue', 'Cue 1.27.62', '2026-10-28 09:00Z', '2026-10-28', 'T2', 'Skipped', '', '']);
  deq(t.ctx.cueAdminRelnotes().map(x => [x.day, x.app, x.release, x.outcome, x.ann]), [['28 Oct', 'Cue', 'Cue 1.27.62', 'Skipped', ''], ['21 Oct', 'Canvas', 'Supplier pages', 'Posted', 'ANN-0011']]);
});

test('AD3 the admin calls are owner-only, never run by a cloud check, and the page state carries the app address', () => {
  const t = sandbox();
  const never = fs.readFileSync(path.join(__dirname, '..', 'src', 'CueCheck.gs'), 'utf8').match(/const CUE_CHECK_NEVER_ = \[([\s\S]*?)\];/)[1];
  ['cueAdminTriage', 'cueAdminTriageDel', 'cueAdminRelnotes'].forEach(f => assert.ok(never.includes("'" + f + "'"), f));
  assert.ok('app_url' in t.ctx.cueState());
});

test('AD4 the page groups the sections as in the approved mockup and has the two new ones', () => {
  const page = cuePage(), nav = page.slice(page.indexOf('id="snav"'), page.indexOf('<div class="smain">'));
  deq([...nav.matchAll(/class="sgrp">([^<]+)</g)].map(m => m[1]), ['How Cue thinks', 'Rules', 'Jobs', 'System']);
  deq([...nav.matchAll(/data-s="([a-z]+)"/g)].map(m => m[1]), ['rules', 'procs', 'tutor', 'chasers', 'triage', 'auto', 'sched', 'rn', 'conn', 'usage']);   // release line: AI relay is not live yet, so it has no button here
  ['triage', 'rn'].forEach(s => assert.ok(page.includes('<section data-sec="' + s + '" hidden>'), s));
  assert.ok(/view === 'admin'/.test(page) && /'\?view=admin'/.test(page), 'admin view and the Settings button link');
});
