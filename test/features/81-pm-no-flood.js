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
  const o = t.ctx.cueK0Run_(false, 'pm'); const x = t.tabs.Chat.rows.filter(r => r[3] === o.request_id)[0][2];
  assert.ok(!/No email address on file|Chased 3 times/.test(x), 'details stay in the chasers thread: ' + x);
  assert.ok(/Not emailed: need you in Canvas[^\n]*\n- 3 S1 Accreditation chasers\n- 1 C6 CE award chaser/.test(x), x);
  const who = live.who; assert.strictEqual(x.split('to ' + who + ' ').length - 1, 1, 'the duplicate is numbered once');
});

test('K82 job threads (Kiko 3 Nov "Own thread in Team Cue", mockup ok): each update sits in its own thread, the main chat gets one line each, the funnel has its own thread, chasers with a project go to Team Cue', () => {
  const t = k0Box(); t.at('2026-10-21', 13, 0); t.ctx.cueSweep(); t.at('2026-10-21', 14, 0);
  const id = batchOf(t).id; const s = t.state(id), items = s.batch.items;
  const live = items.filter(i => !i.no_email && i.kind !== 'tasks')[0]; live.project_id = 'S-25506500TR';
  t.ctx.cueSave_(t.ctx.cueLoad_(id).sh, t.ctx.cueLoad_(id).row, s);
  const F = t.ctx.cueLoad_(id);   // a funnel run with one follow-up, made today
  const fn = { id: 'cue-20261021131500-f00d', kind: 'funnel', created: new Date(Date.parse('2026-10-21T13:15:00+08:00')).toISOString(), status: 'Done', fn: { lines: ['Call Ana at Acme: P3 quote due Friday'] } };
  const sh = t.ctx.cueSheet_('Requests'); sh.appendRow([fn.id]); t.ctx.cueSave_(sh, sh.getLastRow(), fn);
  const o = t.ctx.cueK0Run_(false, 'pm'), rows = t.tabs.Chat.rows;
  const main = rows.filter(r => /^>/.test(String(r[3])) && /2 PM/.test(r[2]));
  const nOk = t.state(o.request_id).k0.items.length;
  deq(main.map(r => r[2]), ['Your 2 PM sales funnel check found 1 follow-up due.', nOk + ' chaser' + (nOk === 1 ? ' is' : 's are') + ' ready for your OK at 2 PM. Reply with their numbers, like "1, 3", or "all", and Cue drafts them.']);
  assert.ok(!rows.some(r => /^>/.test(String(r[3])) && /Chasers for your OK|Call Ana/.test(r[2])), 'the lists stay in their threads');
  const fid = o.request_id + '-fn'; assert.strictEqual(t.state(fid).kind, 'k0fn');
  assert.ok(rows.some(r => r[3] === fid && /your 2 PM funnel follow-ups\n\n- Call Ana at Acme/.test(r[2])));
  assert.ok(!rows.some(r => r[3] === o.request_id && /Call Ana/.test(r[2])), 'funnel is not in the chasers thread');
  const q = JSON.parse(t.props.CUE_PLOG_Q || '[]').filter(l => /^due:/.test(l.key));
  deq(q.map(l => [l.kind, l.project_id, l.from]), [['Chaser', 'S-25506500TR', '2 PM chasers']]);
  assert.ok(t.ctx.cueK0Said_('1', '') , 'a "1" in the main chat still answers the chasers');
});
