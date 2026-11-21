// Part of test/cue.test.js. Feature: restore General channel ownership alongside inline cards.
test('PL1: General keeps an eligible inline card once; listed and moved copies stay out', () => {
  const html = cuePage();
  const main = html.slice(html.indexOf('  function listed('), html.indexOf('  /* CUE-DRAG-TO-CHANNEL-2026-11-18 (approved mockup /mnt/project-files/cue-drag-to-channel'));
  const requests = [
    { id: 'free', kind: 'misc', status: 'Needs you' },
    { id: 'listed', kind: 'bids', status: 'Needs you' },
    { id: 'inbox', kind: 'mail', status: 'Needs you' }
  ];
  const by = Object.fromEntries(requests.map(r => [r.id, r]));
  const channels = Object.fromEntries(requests.map(r => [r.id, { root: r.id, reqs: [r] }]));
  const lines = [
    { request_id: 'free', text: 'free task' }, { request_id: 'free', text: 'free followup' },
    { request_id: 'listed', text: 'listed task' }, { request_id: '%listed', text: 'bid card pointer' },
    { request_id: '@listed', text: 'agent copy' },
    { request_id: '>inbox', text: 'email pointer', where: 'job:inbox' },
    { request_id: 'inbox', text: 'email thread detail' },
    { request_id: '', text: 'moved note', where: 'job:inbox' }
  ];
  let output = '';
  const ctx = vm.createContext({
    byId: () => by, thOf: (th, id) => th[id], listShows: t => t.root === 'listed',
    allLines: () => lines, isMailLog: () => false, askOf: () => null, lineChan: m => m.where || '',
    chanAt: (_, id) => id === 'job:inbox', movedHtml: m => '[moved:' + m.text + ']',
    msgHtml: m => '[msg:' + m.text + ']', mvAttr: s => s, ALERT_RE: /^Alert:/, MAIL_ONLY: { mail: true },
    k0BidsHtml: () => '[bid card]', rootOf: id => id, jobDay: () => '', mailAskHtml: () => '',
    isDismissed: () => false, WORK: {}, CLOSED: {}, isNeed: () => false,
    cardOf: r => '[card:' + r.id + ']', tagHtml: m => '[tag:' + m.text + ']',
    $: () => ({}), setHtml: (_, s) => { output = s; }, bind: () => {}
  });
  vm.runInContext(main, ctx);
  ctx.renderMain(channels);
  assert.strictEqual(output, '[msg:free task][card:free][msg:free followup][moved:email pointer][moved:moved note]');
});
