// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: Scheduled tasks grouped.
/* CUE-SCHED-GROUPS-2026-11-01 (Kiko 1 Nov 2026: "Arrange them if they are in the Morning, Afternoon or Evening"; "separate it first
 * Sched Reports and Task"; mockup v2, "You build it"): Cue Admin › Scheduled tasks shows Reports, then Tasks, each by time of day,
 * earliest first, and the rows the card review turned off as replaced last, with the reason. */

test('SG1 every scheduled row has a place: Reports or Tasks, a time-of-day period, a time and its days', () => {
  const t = sandbox(), v = t.ctx.cueSchedules(), at = id => v.filter(x => x.id === id)[0].place;
  deq(['sys-k0', 'sys-k0pm', 'sys-relnotes', 'sys-status'].map(id => at(id).group), ['Reports', 'Reports', 'Reports', 'Reports']);
  deq(['sys-bids', 'sys-sweep', 'sys-funnel', 'sys-cowork', 'sys-newmail', 'sys-rfps'].map(id => at(id).group), ['Tasks', 'Tasks', 'Tasks', 'Tasks', 'Tasks', 'Tasks']);
  deq([at('sys-bids'), at('sys-k0pm'), at('sys-relnotes'), at('sys-newmail')].map(p => [p.period, p.time, p.days]),
    [['Morning', '6:30 AM', 'Weekdays'], ['Afternoon', '2:00 PM', 'Weekdays'], ['Evening', '7:45 PM', 'Weekdays'], ['All day', 'Every 5 min', 'All day']]);
  deq([at('sys-status').days, at('sys-gt-repeat_events').days], ['Fri', '15th monthly']);
  v.forEach(x => assert.ok(x.place && x.place.group && x.place.period && x.place.time, x.id + ' has a place'));
});

test('SG2 the replaced rows go to Off with the reason while off, and back to their place when Kiko ticks On', () => {
  const t = sandbox(), at = id => t.ctx.cueSchedules().filter(x => x.id === id)[0].place;
  deq([at('sys-gt-daily_plan').group, at('sys-gt-daily_plan').why], ['Off', 'Replaced by the 8 AM update.']);
  deq(['sys-funnelreview', 'sys-unsched', 'sys-gt-admin_funnel'].map(id => at(id).group), ['Off', 'Off', 'Off']);
  deq(at('sys-gt-followups').group, 'Tasks', 'an optional task that is off stays in its time slot');
  t.ctx.cueSchedSet('sys-gt-daily_plan', { on: true });
  deq([at('sys-gt-daily_plan').group, at('sys-gt-daily_plan').why], ['Tasks', '']);
});

test('SG3 sorting by place puts the morning first, earliest first, and the background last', () => {
  const t = sandbox(), v = t.ctx.cueSchedules().filter(x => x.place.group === 'Tasks').sort((a, b) => a.place.sort - b.place.sort).map(x => x.id);
  assert.ok(v.indexOf('sys-bids') < v.indexOf('sys-cowork') && v.indexOf('sys-cowork') < v.indexOf('sys-sweep') && v.indexOf('sys-sweep') < v.indexOf('sys-funnel'));
  assert.ok(v.indexOf('sys-funnel') < v.indexOf('sys-rfps') && v.indexOf('sys-rfps') < v.indexOf('sys-newmail') && v.indexOf('sys-newmail') < v.indexOf('sys-accred'));
});

test('SG4 the page draws Reports, Tasks and Off as tables by period, with the row opening below itself', () => {
  const pg = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexPages.html'), 'utf8');
  ['SCHED_GROUPS', "'Morning'", "'Afternoon'", "'Evening'", "'All day'", 'Off in the new structure', 'tr class="schd', 'schxr', 'data-sc-on', 'data-sc-act="run"'].forEach(k => assert.ok(pg.includes(k), k));
});
