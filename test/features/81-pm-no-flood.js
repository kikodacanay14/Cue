// Part of test/cue.test.js. Feature: the 2 PM update does not flood (Kiko 3 Nov 2026: "Goal is not to make it confusing. Remove the
// duplicates, Do not Flood details that are not necessary.").
test('K81 2 PM: chasers that cannot be emailed show as one count line per type, not under Funnel; a chaser listed twice is numbered once', () => {
  const t = k0Box(); t.at('2026-10-21', 13, 0); t.ctx.cueSweep(); t.at('2026-10-21', 14, 0);
  const id = batchOf(t).id; const s = t.state(id), items = s.batch.items;
  const live = items.filter(i => !i.no_email && i.kind !== 'tasks')[0];
  items.push(Object.assign({}, live, { key: live.key + ':dup' }));
  ['A', 'B', 'C'].forEach(w => items.push({ key: 'accr:' + w, kind: 'accreditation', label: 'S1 Accreditation chasers', who: w, project: 'Kings Day', no_email: true, why: 'No email address on file. Add one in Canvas to chase. Missing: TIN.' }));
  items.push({ key: 'award:x', kind: 'award', label: 'C6 CE award chasers', who: 'Rom', project: 'Ayala', no_email: true, why: 'Chased 3 times with no decision.' });
  t.ctx.cueSave_(t.ctx.cueLoad_(id).sh, t.ctx.cueLoad_(id).row, s);
  const o = t.ctx.cueK0Run_(false, 'pm'); const x = t.tabs.Chat.rows.filter(r => r[3] === '>' + o.request_id)[0][2];
  assert.ok(!/No email address on file|Chased 3 times/.test(x), 'details stay in the chasers thread: ' + x);
  assert.ok(/Not emailed: need you in Canvas[^\n]*\n- 3 S1 Accreditation chasers\n- 1 C6 CE award chaser/.test(x), x);
  const who = live.who; assert.strictEqual(x.split('to ' + who + ' ').length - 1, 1, 'the duplicate is numbered once');
});
