/* Apps Script loads files alphabetically, so this registration lives in a file that sorts after CueSweep.gs (where cueKind_ is defined). */
/* The morning batch (sweep engine, when it is installed): on Mondays, a waiting clean-up shows as one line that opens its thread. */
if (typeof cueKind_ === 'function') {
  try {
    cueKind_({ kind: 'hubspot', label: 'HubSpot clean-up', every: 7, max: 0, sendAllowed: false, noEmail: true, chase: false,
      find: ctx => cueRecent_(7).filter(x => x.kind === 'hubspot' && x.status === 'Needs you').slice(0, 1).map(x => ({ key: 'hubspot:' + x.id, task_id: x.id, project: 'HubSpot',
        priority: 'normal', why: ((x.hs && x.hs.items) || []).length + ' thing(s) to look at, nothing changed yet' })) });
  } catch (e) { console.warn('HubSpot sweep line: ' + e); }
}
