// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: rfq-chasers.
/* ---------- RFQ chasers (CueSweepRfq.gs, spec specs/rfq-chasers.md) ---------- */
const KIKO = 'Kiko <kiko@example.com>';
const gm = (id, at, from, to, subject, x = {}) => ({ id, internalDate: String(at), labelIds: x.draft ? ['DRAFT'] : ['SENT'], snippet: x.snippet || 'Please quote',
  payload: { headers: [{ name: 'From', value: from }, { name: 'To', value: to }, { name: 'Subject', value: subject }, { name: 'Message-ID', value: '<' + id + '@mail>' }] } });
const RFQ_THREADS = {
  aaaa0000000000a1: [gm('r1', PH('2026-10-16', 10), KIKO, 'Sonic Pro <sales@sonicpro.example>', 'RFQ: LED wall 4x3')],                       // Fri: 3 working days, due
  aaaa0000000000a2: [gm('r2', PH('2026-10-19', 10), KIKO, 'sales@stage.example', 'RFQ: Stage')],                                              // Mon: 2 days, not yet
  aaaa0000000000a3: [gm('r3', PH('2026-10-15', 10), KIKO, 'q@tents.example', 'RFQ: Tent'), gm('r3b', PH('2026-10-17', 9), 'q@tents.example', KIKO, 'Re: RFQ: Tent')], // replied
  aaaa0000000000a4: [gm('r4', PH('2026-10-14', 10), KIKO, 'hi@print.example', 'RFQ: Prints'), gm('r4d', PH('2026-10-20', 9), KIKO, 'hi@print.example', 'Re: RFQ: Prints', { draft: true })], // draft waiting
  aaaa0000000000a5: [gm('r5', PH('2026-10-15', 10), KIKO, 'Mats Co <sales@matsco.example>', 'RFQ: Mats')],                                   // answered by a new email
  aaaa0000000000a6: [gm('cue-sent-1', PH('2026-10-20', 10), KIKO, 'SkyLights PH <hello@skylights.example>', 'Quotation request: drone show')], // Cue's own RFQ, event soon
  aaaa0000000000a7: [gm('r7', PH('2026-10-12', 10), KIKO, 'av@beta.example', 'RFQ: Beta AV')],                                               // project lost
  aaaa0000000000a8: [gm('r8', PH('2026-10-12', 10), KIKO, 'partner@longtime.example', 'RFQ: Chairs')],                                       // never chase
  aaaa0000000000a9: [gm('r9', PH('2026-10-12', 10), KIKO, 'Ana <ana@example.com>', 'RFQ internal')] };                                          // BSE only
const RFQ_SENT = Object.keys(RFQ_THREADS).map(t => ({ id: RFQ_THREADS[t][0].id, thread: t, ms: Number(RFQ_THREADS[t][0].internalDate), to: '', subject: '', snippet: '' }));
function rfqBox(o = {}) {
  const t = sandbox(Object.assign({ rfq: true, threads: RFQ_THREADS, sent: RFQ_SENT, sentSearch: RFQ_SENT.filter(m => m.id !== 'cue-sent-1'),
    inbound: [{ id: 'in1', from: 'sales@matsco.example', ms: PH('2026-10-18', 9) }], props: { CUE_RFQ_NEVER: 'longtime.example' },
    projects: [{ id: 'S-1', name: 'Acme Party', status: 'For Production Start', date: '2026-10-25' }, { id: 'S-2', name: 'Beta Expo', status: 'Closed Lost', date: '2026-11-20' }] }, o));
  let T = PH('2026-10-21', 7, 0); t.at = (d, h, m) => { T = PH(d, h, m); }; t.ctx.cueNow_ = () => T;
  const add = x => { const sh = t.tabs.Requests; sh.appendRow([x.id]); t.ctx.cueSave_(sh, sh.rows.length, Object.assign({ created: new Date(PH('2026-10-20', 9)).toISOString(), status: 'Done', text: '', metrics: {} }, x)); };
  add({ id: 'cue-intake-1', kind: 'intake', canvas: { project_id: 'S-1' }, read: { event: { name: 'Acme Party' } }, drafts: [{ k: '0:0', supplier: 'SkyLights PH', to: 'hello@skylights.example', id: 'd1', sent_id: 'cue-sent-1' }] });
  add({ id: 'cue-change-1', kind: 'change', change: { match: { project_id: 'S-2', name: 'Beta Expo' }, found: [{ k: 'T1', thread_id: 'aaaa0000000000a7' }], drafts: [] } });
  return t;
}
const rfqBatch = t => t.ctx.cueState().requests.filter(r => r.kind === 'sweep')[0];
