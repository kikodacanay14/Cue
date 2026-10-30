// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: pc-checks-1.26.
/* ---------- 1.26.3: PC check of 1.26.2 on /dev (22 Oct 04:45Z) ---------- */
test('CC8 a lump-sum quote is shown as a lot: never ticked onto one line, whether ChatGPT calls it a lot or puts it on one line anyway', () => {
  const lot = cecRun({ gpt: { cecost: { changes: [], lots: [{ keys: ['L1', 'L2', 'L3'], total: 616000, quoted: 'Booth, all in, 616,000 VAT inclusive' }], unmatched: [], note: '' } } });
  deq([lot.v.status, lot.v.cec.rows.filter(r => r.tick).length, lot.v.cec.rows.every(r => r.lot)], ['Needs you', 0, true]);
  deq([lot.v.cec.lots[0].total, lot.v.cec.lots[0].req_ids, lot.v.cec.lots[0].was], [616000, ['REQ-1', 'REQ-2', 'REQ-3'], 90000]);
  assert.ok(lot.tabs.Chat.rows.some(r => /gives one price for 3 CE lines \(₱616,000\), not a price per line/.test(r[2])));
  const one = cecRun({ gpt: { cecost: { changes: [{ key: 'L1', unit_cost: 616000, basis: 'unit', quoted: 'Booth fabrication lot - 616,000 VAT inclusive', why: 'booth' }], lots: [], unmatched: [], note: '' } } });
  deq([one.v.cec.rows.filter(r => r.tick).length, one.v.cec.rows[0].cost, one.v.cec.lots.length], [0, null, 1], 'the lot on one line is taken off it');
  assert.throws(() => one.ctx.cueApprove(one.id, {}), /Tick at least one/);
  const html = cuePage();
  const grab = name => { const a = html.indexOf('function ' + name + '('); return html.slice(a, html.indexOf('\n  }\n', a) + 4); };
  const ctx = { esc: x => String(x).replace(/[<>&"]/g, c => '&#' + c.charCodeAt(0) + ';'), NEED: { 'Needs you': 1 }, metricLine: () => '', cvLink: l => '<a>' + l.title + '</a>' };
  vm.createContext(ctx); vm.runInContext(grab('pesoC') + '\n' + grab('cecCardHtml'), ctx);
  assert.ok(/One price for 3 CE lines: ₱616,000 \(those lines add up to ₱90,000 now\)/.test(ctx.cecCardHtml(JSON.parse(JSON.stringify(lot.v)))));
});

test('CC9 "redo bid check" in a Bid check thread runs a fresh bid check (no plan card, no intake); a photo in the Morning batch thread starts its intake in its own thread', () => {
  const t = sandbox({ tutor: true, plan: PLAN() });
  const sh = t.tabs.Requests, put = s => { sh.appendRow([s.id]); t.ctx.cueSave_(sh, sh.getLastRow(), s); };
  put({ id: 'cue-20261022104400-b1d5', kind: 'bids', created: '2026-10-21T02:44:00.000Z', status: 'Done', bids: { title: 'Bid check 10/22 10:44', items: [] }, text: 'check bids' });
  put({ id: 'cue-20261022070000-5eee', kind: 'sweep', created: '2026-10-21T02:50:00.000Z', status: 'Needs you', day: '2026-10-22', batch: { items: [] }, text: 'Morning batch' });
  const out = t.ctx.cueSend('redo bid check', [], '', 'cue-20261022104400-b1d5');
  const b = t.ctx.cueLoad_(out.request_id).s;
  deq([b.kind, b.ref, t.log.plans || 0], ['bids', 'cue-20261022104400-b1d5', 0], 'same Manila day: the run joins that day\'s Bid check thread (1.27.2)');
  assert.ok(t.tabs.Chat.rows.some(r => r[3] === '>cue-20261022104400-b1d5' && /Running the bid check again in today's Bid check thread/.test(r[2])));
  const up = t.ctx.cueSend('', [{ name: 'brief.txt', type: 'text/plain', data: TXT }], '', 'cue-20261022070000-5eee');
  const i = t.ctx.cueLoad_(up.request_id).s;
  deq([i.kind, i.ref], ['intake', ''], 'its own thread, never the batch');
  assert.strictEqual(t.ctx.cueLoad_('cue-20261022070000-5eee').s.kind, 'sweep');
  assert.ok(t.tabs.Chat.rows.some(r => r[3] === 'cue-20261022070000-5eee' && /started its intake in its own thread/.test(r[2])));
});

test('CC10 learned patterns and routing examples that sent CE cost or bid check asks to Project intake are ignored and not shown', () => {
  const t = sandbox({ tutor: true, plan: PLAN() });
  t.ctx.cuePatApprove_('Project intake: update CE cost for <project> from <person>\'s email', 'intake', 'update ce cost', null);
  t.ctx.cuePatApprove_('Project intake: redo bid check', 'intake', 'redo bid check', null);
  t.ctx.cuePatApprove_('Supplier search: find suppliers for <item>', 'vendor', 'find x', null);
  deq(t.ctx.cuePatRows_().map(x => x.key), ['Supplier search: find suppliers for <item>']);
  t.ctx.cueRouteSave_('Can you update CE Cost for JBL Booth? get cost from Zaina Yu\'s email', 'intake'); t.ctx.cueRouteSave_('quote this for me', 'intake');
  deq(t.ctx.cueRouteRows_().map(x => x.phrase), ['quote this for me']);
});

test('CC11 a readiness check started from the main chat into an earlier thread says so in the main chat', () => {
  const t = readyRun();
  const u = sandbox({ talk: Object.assign({}, ASK, { task: t.id }), similar: ACME, sent: READY_MAIL });
  const sh = u.tabs.Requests; sh.appendRow([t.id]); u.ctx.cueSave_(sh, sh.getLastRow(), t.ctx.cueLoad_(t.id).s);
  u.ctx.cueSend('is the Acme party ready?', [], '');
  assert.ok(u.tabs.Chat.rows.some(r => /^>/.test(r[3]) && /^On it\. Continuing in the .+ thread\.$/.test(r[2])), JSON.stringify(u.tabs.Chat.rows.slice(-3)));
});

/* ---------- 1.26.4: PC recheck of 1.26.3 on /dev (22 Oct 05:00Z) ---------- */
test('CC12 "redo bid check" in a Bid check thread that already holds a phase 1 intake card runs a fresh bid check; the stray card closes; Kiko\'s line shows in the thread', () => {
  const t = sandbox({ tutor: true, plan: PLAN() });
  const sh = t.tabs.Requests, put = s => { sh.appendRow([s.id]); t.ctx.cueSave_(sh, sh.getLastRow(), s); };
  put({ id: 'cue-20261022104400-b1d5', kind: 'bids', created: '2026-10-21T02:44:00.000Z', status: 'Done', bids: { title: 'Bid check 10/22 10:44', items: [] }, text: 'check bids' });
  put({ id: 'cue-20261022104900-a1a1', kind: 'intake', phased: true, phase: 1, ref: 'cue-20261022104400-b1d5', created: '2026-10-21T02:49:00.000Z', status: 'Needs you', stage: 'Phase 1', text: 'redo bid check', notes: [] });
  const out = t.ctx.cueSend('redo bid check', [], '', 'cue-20261022104900-a1a1');
  const b = t.ctx.cueLoad_(out.request_id).s;
  deq([b.kind, b.ref, t.log.plans || 0, chatCalls(t)], ['bids', 'cue-20261022104400-b1d5', 0, 0], 'a bid check in that day\'s thread, no plan card, no chat call');
  deq(t.ctx.cueLoad_('cue-20261022104900-a1a1').s.status, 'Closed');
  assert.ok(t.tabs.Chat.rows.some(r => r[1] === 'Kiko' && r[2] === 'redo bid check' && r[3] === 'cue-20261022104900-a1a1'), 'Kiko\'s line shows in the thread');
  assert.ok(t.tabs.Chat.rows.some(r => r[3] === 'cue-20261022104900-a1a1' && /bid check, not a project intake\. Nothing was written to Canvas/.test(r[2])));
  const w = sandbox({ tutor: true, plan: PLAN() }), ws = w.tabs.Requests;
  [{ id: 'cue-20261022104400-b1d5', kind: 'bids', status: 'Done', bids: { title: 'Bid check', items: [] }, text: 'x' },
   { id: 'cue-20261022104900-a1a2', kind: 'intake', phased: true, phase: 2, ref: 'cue-20261022104400-b1d5', status: 'Needs you', canvas: { project_id: 'S-31628060SP' }, text: 'x', notes: [] }]
    .forEach(s => { ws.appendRow([s.id]); w.ctx.cueSave_(ws, ws.getLastRow(), s); });
  w.ctx.cueSend('run it again', [], '', 'cue-20261022104900-a1a2');
  deq(w.ctx.cueLoad_('cue-20261022104900-a1a2').s.status, 'Needs you', 'a card that already saved to Canvas stays open');
});

test('CC13 Go on a readiness plan card that joins an earlier thread: one "On it. Continuing in …" line in the main chat, and the page shows it', () => {
  const t = readyRun();
  const plan = Object.assign({}, ASK, { task: t.id, sure: true, choices: [], plan: { reading: 'Readiness check for Acme', pattern: 'is <project> ready?', steps: [{ do: 'Read Canvas', who: 'Canvas' }] } });
  const u = sandbox({ tutor: true, plan, similar: ACME, sent: READY_MAIL });
  const sh = u.tabs.Requests; sh.appendRow([t.id]); u.ctx.cueSave_(sh, sh.getLastRow(), t.ctx.cueLoad_(t.id).s);
  u.ctx.cueSend('is the Acme party ready?', [], '');
  const go = u.ctx.cueAskPick(askId(askLine(u)), 'go');
  deq(u.ctx.cueLoad_(go.request_id).s.kind, 'readiness');
  const ptr = u.tabs.Chat.rows.filter(r => /^>/.test(r[3]));
  deq(ptr.map(r => r[2]), ['On it. Continuing in the Acme Year-End Party thread.'], 'one pointer, never also "Answered in"');
  const html = cuePage();
  const a = html.indexOf('function renderMain('), body = html.slice(a, html.indexOf('\n  }\n', a) + 4);
  assert.ok(/pq && !pq\.open && !pq\.where/.test(body), 'a pointer right after a main-chat Go tap shows even when the thread showed before');
});

test('CC14 a new CE costs check for the same project closes the older card that was never approved; an approved one stays', () => {
  const t = cecRun();
  const old = t.v; deq(old.status, 'Needs you');
  const out = t.ctx.cueSend(CEC_ASK, [], '');
  t.ctx.cueRun(out.request_id);
  deq([t.ctx.cueLoad_(old.id).s.status, t.ctx.cueLoad_(out.request_id).s.status], ['Closed', 'Needs you']);
  assert.ok(t.tabs.Chat.rows.some(r => r[3] === old.id && /A newer CE costs check for JBL Booth Fabrication replaced this one\. Nothing was written to Canvas/.test(r[2])));
  t.ctx.cueApprove(out.request_id, {});
  const again = t.ctx.cueSend(CEC_ASK, [], ''); t.ctx.cueRun(again.request_id);
  assert.notStrictEqual(t.ctx.cueLoad_(out.request_id).s.status, 'Closed', 'an approved card is never closed');
});

/* ---------- 1.26.5: PC recheck of 1.26.4 on /dev (22 Oct 05:13Z) ---------- */
test('CC15 the leftover intake in a Bid check thread closes on "redo bid check" even when it had failed (Canvas did not answer)', () => {
  const t = sandbox({ tutor: true, plan: PLAN() });
  const sh = t.tabs.Requests, put = s => { sh.appendRow([s.id]); t.ctx.cueSave_(sh, sh.getLastRow(), s); };
  put({ id: 'cue-20261022104400-b1d5', kind: 'bids', created: '2026-10-21T02:44:00.000Z', status: 'Done', bids: { title: 'Bid check 10/22 10:44', items: [] }, text: 'check bids' });
  put({ id: 'cue-20261022104900-a1a1', kind: 'intake', phased: true, ref: 'cue-20261022104400-b1d5', created: '2026-10-21T02:49:00.000Z', status: 'Failed', stage: 'Checking Canvas',
    error: 'Canvas did not answer find_similar_projects (HTTP 200)', text: 'redo bid check', notes: [] });
  const out = t.ctx.cueSend('redo bid check', [], '', 'cue-20261022104400-b1d5');
  deq([t.ctx.cueLoad_(out.request_id).s.kind, t.ctx.cueLoad_('cue-20261022104900-a1a1').s.status], ['bids', 'Closed']);
});

const TOT = (id, pid, name, ref, created) => ({ id, kind: 'readiness', ref: ref || '', created, status: 'Done', stage: 'Done', text: 'Readiness check: ' + name, notes: [],
  ready: { ask: name, match: { project_id: pid, name, date: '10/31/2026', status: 'For Production Start' } } });
function totBox(plan) {
  const t = sandbox({ tutor: true, plan, similar: ACME, sent: READY_MAIL });
  const sh = t.tabs.Requests, put = s => { sh.appendRow([s.id]); t.ctx.cueSave_(sh, sh.getLastRow(), s); };
  put(TOT('cue-20261021090000-aaaa', 'S-25506500TR', 'Trick or Treat – Manila', '', '2026-10-21T01:00:00.000Z'));
  put(TOT('cue-20261021100000-bbbb', 'S-25506511IL', 'Trick or Treat – Iloilo', '', '2026-10-21T02:00:00.000Z'));
  put(TOT('cue-20261022040000-cccc', 'S-25506500TR', 'Trick or Treat – Manila', 'cue-20261021100000-bbbb', '2026-10-21T20:00:00.000Z'));   // the 1.26.3 run that went to Iloilo
  return t;
}
test('CC16 readiness Go for Trick or Treat Manila (by id or name) joins the Manila thread, never Iloilo or a new thread, and skips Finding project', () => {
  for (const ask of ['S-25506500TR', 'Trick or Treat Manila']) {
    const plan = Object.assign({}, ASK, { readiness: ask, task: 'cue-20261021100000-bbbb', sure: true, choices: [], plan: { reading: 'Readiness check', pattern: 'is <project> ready?', steps: [{ do: 'Read Canvas', who: 'Canvas' }] } });
    const t = totBox(plan);
    t.ctx.cueSend('is ' + ask + ' ready?', [], '');
    const go = t.ctx.cueAskPick(askId(askLine(t)), 'go'), r = t.ctx.cueLoad_(go.request_id).s;
    deq([r.ref, r.stage, r.ready.match.project_id], ['cue-20261021090000-aaaa', 'Reading Canvas', 'S-25506500TR'], ask);
    deq(t.tabs.Chat.rows.filter(x => /^>/.test(x[3])).map(x => x[2]), ['On it. Continuing in the ' + t.ctx.cueTaskName_(t.ctx.cueLoad_('cue-20261021090000-aaaa').s) + ' thread.'], ask);
    assert.ok(!t.tabs.Chat.rows.some(x => /Iloilo/.test(x[2])), ask);
  }
  const u = totBox(Object.assign({}, ASK, { readiness: 'S-25506500TR', task: '' }));
  const out = u.ctx.cueRouteStart_('is S-25506500TR ready?', 'readiness', u.ctx.cueRouteTalk_('readiness', 'S-25506500TR', ''));
  deq(u.ctx.cueLoad_(out.request_id).s.ref, 'cue-20261021090000-aaaa', 'a Not that / route pick also finds the thread');
  const fits = u.ctx.cueAskFits_;
  deq([fits('Trick or Treat Manila', { project_id: 'S-1', name: 'Trick or Treat – Iloilo' }), fits('Acme party', { project_id: 'S-1', name: 'Acme Year-End Party' }),
    fits('JBL Booth', { project_id: 'S-1', name: 'JBL Booth Fabrication', account: 'JBL' })], [false, true, true]);
});

test('IC1 the tab icon loads as the owner\'s Google account (authuser), stays private, and is saved to Drive only once', () => {
  const t = sandbox(), u1 = t.ctx.cueIconUrl_(), u2 = t.ctx.cueIconUrl_();
  assert.strictEqual(u1, 'https://drive.google.com/uc?export=view&id=f1&authuser=kiko%40example.com&format=png'); assert.strictEqual(u2, u1);
  deq(t.log.drive.filter(d => /upload/.test(d)).length, 1, 'one upload'); assert.ok(!t.log.drive.some(d => /permissions/.test(d)), 'never shared');
  const ext = path.join(__dirname, '..', 'extension', 'icons');
  deq(['16', '48', '128'].map(n => fs.readFileSync(path.join(ext, 'cue-' + n + '.png')).readUInt32BE(16)), [16, 48, 128], 'bubble icons at their sizes');
});

test('SC8 unscheduled alarm (Kiko 05:20Z, Both): one card lists jobs that will not run and waiting tasks with no date; silent when all is fine; Mute these hides them', () => {
  const t = sandbox(); t.ctx.cueState(); t.ctx.cueSchedules();
  const card = () => t.tabs.Chat.rows.filter(r => /^\?ask-/.test(String(r[3])) && /Unscheduled check/.test(r[2])).pop();
  // Day one: the rows that ship off (HubSpot sales review, the ChatGPT tasks) are listed; nothing waits on Kiko.
  t.ctx.cueSchedRunNow('sys-unsched'); let c = card();
  assert.ok(/\d+ to look at/.test(c[2]) && /HubSpot sales review \(Thu 08:00\): switched off/.test(c[2]) && /Monthly engagement email \(15th monthly 16:00\): switched off/.test(c[2]) && /:ok,mute$/.test(c[3]));
  assert.ok(!/Tasks waiting on you/.test(c[2]));
  t.ctx.cueAskPick(String(c[3]).match(/^\?(ask-[0-9a-z]+)/)[1], 'mute');
  const n = t.tabs.Chat.rows.length; t.ctx.cueSchedRunNow('sys-unsched');
  assert.strictEqual(t.tabs.Chat.rows.slice(n).filter(r => /^\?ask-/.test(String(r[3]))).length, 0, 'muted: no card'); assert.ok(/everything is scheduled/.test(t.tabs.Chat.rows.slice(-1)[0][2]));
  // A waiting task with no date shows; one with a reminder does not. A missed run shows.
  const add = (id, st, extra) => { t.tabs.Requests.appendRow([id]); t.tabs.Requests.rows[t.tabs.Requests.rows.length - 1] = [id, '', st, '', '', 0, '', '', '', '', JSON.stringify(Object.assign({ id, kind: 'pipeline', status: st, ref: '', created: '2026-10-21T01:00:00Z', pipe: { title: 'Pipeline: ' + id } }, extra || {}))]; };
  add('cue-a', 'Needs you'); add('cue-b', 'Needs you', { remind_at: Date.parse('2026-10-23T01:00:00Z') }); add('cue-c', 'Working');
  const rows = t.tabs.Schedule.rows, i = rows.findIndex(r => r[0] === 'sys-status'); rows[i][11] = new Date(Date.parse('2026-10-21T01:00:00Z'));
  const m = t.tabs.Chat.rows.length; t.ctx.cueSchedRunNow('sys-unsched'); c = card();
  assert.ok(t.tabs.Chat.rows.slice(m).indexOf(c) >= 0, 'a new card');
  assert.ok(/Friday status updates \(Fri 07:00\): missed its/.test(c[2]) && /Pipeline: cue-a: waiting on you \(Needs you\), no due date or reminder/.test(c[2]));
  assert.ok(!/cue-b|cue-c/.test(c[2]) && !/HubSpot sales review/.test(c[2]), 'reminder set, still working, muted: left out');
  assert.strictEqual(t.log.gpt.length + t.log.claude.length, 0, 'no AI call');
  // The daily row runs from the tick at 07:00 and finds nothing when all is fine: no card.
  const u = sandbox(); u.ctx.cueState(); u.ctx.cueSchedules().filter(x => !x.on).forEach(x => u.ctx.cueSchedSet(x.id, { on: true }));
  u.ctx.__wait(phMs('2026-10-22', '07:01') - Date.parse('2026-10-21T03:00:00Z')); u.ctx.cueResume(); u.ctx.__wait(5 * 60000); u.ctx.cueResume();   // Wednesday 19:00 was missed too: 3 rows per tick
  assert.strictEqual(u.ctx.cueSchedules().filter(x => x.id === 'sys-unsched')[0].result, 'All scheduled'); assert.ok(!u.tabs.Chat.rows.some(r => /Unscheduled check/.test(r[2])));
});

/* CUE-IN-CANVAS (Kiko 23 Oct 07:39Z, 08:48Z, 08:52Z; specs/cue-in-canvas.md) */
test('CIC1 Cue may show inside Canvas: doGet allows framing, and the page guards itself instead', () => {
  assert.ok(/setXFrameOptionsMode\(HtmlService\.XFrameOptionsMode\.ALLOWALL\)/.test(CODE), 'ALLOWALL');
  const html = cuePage();
  assert.ok(/var CUE_HOST = cueFrameCheck\(window\);/.test(html) && html.indexOf('#cue-cover {') > 0, 'guard runs on load and has a cover');
});
test('CIC2 frame guard: own tab is free; inside Canvas waits for cueHost; any non-Google ancestor or a deep frame without ancestorOrigins is covered', () => {
  const html = cuePage();
  const src = html.slice(html.indexOf('function cueFrameCheck('), html.indexOf('function cueAncestor('));
  const ctx = vm.createContext({}); vm.runInContext(src, ctx);
  const chain = (depth, anc) => { let top = {}; top.parent = top; let w = top; for (let i = 0; i < depth; i++) { const c = { parent: w }; w = c; } w.location = { ancestorOrigins: anc }; return w; };
  const G = 'https://script.google.com', S = 'https://n-abc123-0lu-script.googleusercontent.com';
  const own = ctx.cueFrameCheck(chain(2, [S, G]));
  deq([own.foreign, own.nested], ['', false]);
  const canvas = ctx.cueFrameCheck(chain(5, [S, G, S, S, G]));
  deq([canvas.foreign, canvas.nested, canvas.canvas], ['', true, null], 'inside Canvas: covered until cueHost');
  deq(!!ctx.cueFrameCheck(chain(3, [S, G, 'https://evil.example'])).foreign, true, 'a foreign page is covered for good');
  deq(ctx.cueFrameCheck(chain(3, [S, G, 'https://evil.example'])).foreign, 'https://evil.example', 'the cover names the host');
  deq(!!ctx.cueFrameCheck(chain(3, [S, G, 'https://script.google.com.evil.example'])).foreign, true, 'look-alike host');
  const short = ctx.cueFrameCheck(chain(6, [S, G, S, S, G, 'https://canvas.blankspaceevent.com']));
  deq([short.foreign, short.nested], ['', true], 'Canvas opened from its short link: waits for cueHost like Canvas');
  deq(!!ctx.cueFrameCheck(chain(6, [S, G, S, S, G, 'https://canvas.blankspaceevent.com.evil.example'])).foreign, true, 'short-link look-alike');
  deq(ctx.cueFrameCheck(chain(5, undefined)).nested, true, 'no ancestorOrigins and deep: covered');
  deq(ctx.cueFrameCheck(chain(2, undefined)).nested, false, 'no ancestorOrigins in its own tab: free');
});
test('CIC3 inside Canvas: Open in Canvas goes to Canvas itself; only the host that sent cueHost may open a thread', () => {
  const html = cuePage();
  assert.ok(/if \(CUE_HOST\.canvas\) return void CUE_HOST\.canvas\.postMessage\(\{ canvasWs: 'cueOpen', url: l\.url \}, '\*'\);/.test(html));
  assert.ok(/d\.canvasWs === 'cueThread' && e\.source === CUE_HOST\.canvas/.test(html), 'thread only from the host');
  assert.ok(/!cueAncestor\(e\.source\)/.test(html), 'messages only from windows above Cue');
});
test('CIC4 Cue wears Canvas: Workspace tokens (cream, ink, purple action, magenta need), no graphite left', () => {
  const html = cuePage();
  ['--bg:#F7F3EA', '--text:#16151B', '--act:#23006F', '--need:#F000AA', '--line:#E2DCCF', '--muted:#5B5766'].forEach(t => assert.ok(html.indexOf(t) > 0, t));
  ['#141518', '#17181c', '#0e0f11', '#262930', '#22344d', '#1f2b3d', '#0b1320'].forEach(c => assert.ok(html.indexOf(c) < 0, c + ' left'));
  assert.ok(!/<b [^>]*color:#fff/.test(html), 'card titles use the ink token, not white');
});

// CUE-TODAY (spec specs/daily-digest.md): one Today card from the scheduled jobs' runs; Canvas Home draws it.
const TD = (o) => Object.assign({ created: '2026-10-21T00:05:00Z', status: 'Needs you', metrics: { calls: [] } }, o);
const GPTC = { calls: [{ provider: 'GPT', status: 'OK' }] }, CLC = { calls: [{ provider: 'Claude', status: 'OK' }] };
test('TD1 Today card: one row per run that needs Kiko, chasers first, who did it from the real calls', () => {
  const { ctx } = sandbox();
  const v = [
    TD({ id: 'b1', kind: 'bids', metrics: GPTC, bids: { items: [{ project: 'DepEd Batangas', abc: 420000 }, { project: 'Laguna LGU', abc: 610000 }], updated: [{}] } }),
    TD({ id: 's1', kind: 'sweep', metrics: GPTC, batch: { items: [{ label: 'RFQ' }, { label: 'RFQ' }, { label: 'Payment' }, { label: 'Inbox', no_email: true }, { label: 'RFQ', removed: 'skip' }] } }),
    TD({ id: 'h1', kind: 'hubspot', metrics: CLC, hs: { title: 'Monday HubSpot check', items: [{ key: 'm1', group: 'dup', title: 'Merge Acme', fix: { op: 'archive' }, recs: [] }, { key: 'm2', group: 'dup', title: 'Done one', fix: { op: 'archive' }, recs: [], result: { ok: true } }] } }),
    TD({ id: 'g1', kind: 'gtask', status: 'Done', metrics: GPTC, gt: { title: 'Repeat-event accounts', items: [] } }),
    TD({ id: 'g2', kind: 'gtask', status: 'Done', metrics: { calls: [] }, gt: { title: 'Moved contacts', items: [] } }),
    TD({ id: 'old', kind: 'bids', created: '2026-10-19T23:00:00Z', bids: { items: [{ project: 'X' }] } }),
    TD({ id: 'i1', kind: 'intake' }),
    TD({ id: 'w1', kind: 'gtask', status: 'Working', gt: { title: 'Still running', items: [] } })];
  const T = ctx.cueTodayFrom_(v.map(x => ctx.cueView_(x)), '2026-10-21');   // the page's views, as cueToday() and cueState() pass them
  deq(T.count, 3);
  deq(T.rows.map(r => r.thread), ['s1', 'b1', 'h1'], 'the morning batch first; old days, other kinds and running jobs left out');
  deq([T.rows[0].title, T.rows[0].detail, T.rows[0].primary, T.rows[0].button], ['Send 3 emails', '2 RFQ, 1 Payment, 1 Inbox.', true, 'Review and send']);
  deq([T.rows[1].title, T.rows[1].detail, T.rows[1].by], ['2 new bids worth a look', 'DepEd Batangas ₱420k · Laguna LGU ₱610k', 'Done by ChatGPT · checked by Cue']);
  deq([T.rows[2].title, T.rows[2].by], ['1 HubSpot fix to review', 'Done by Claude · checked by Cue']);
  deq(T.done, 'repeat-event accounts (nothing new) (by ChatGPT); moved contacts (nothing new) (by Cue)');
});
test('TD2 Today card: a failed run is a Try again row; a thread joined by a redo points at its root; no AI call ran', () => {
  const t = sandbox(), before = JSON.stringify(t.log);
  const T = t.ctx.cueTodayFrom_([TD({ id: 'r0', kind: 'status' }), TD({ id: 'r1', kind: 'bids', ref: 'r0', status: 'Failed', error: 'ChatGPT timed out', metrics: { calls: [{ provider: 'GPT', status: 'Failed' }] } })], '2026-10-21');
  const f = T.rows.find(r => r.thread === 'r0' && r.button === 'Try again');
  assert.ok(f, 'failed row points at the thread root');
  deq([f.title, f.detail, f.by], ['Bid check didn\'t finish', 'ChatGPT timed out', 'Stopped · nothing was sent or changed']);
  deq(JSON.stringify(t.log), before, 'building the card makes no fetch');
});
test('TD5 Today card: only the day\'s latest bid run counts; a row names its run (PC checks 24 Oct 10:41Z and 12:39Z)', () => {
  const { ctx } = sandbox();
  const run = (id, at, items, still) => TD({ id, kind: 'bids', ref: id === 'd0' ? '' : 'd0', created: '2026-10-21T' + at + ':00Z', metrics: GPTC,
    status: id === 'd0' ? 'Closed' : 'Needs you', bids: { base: 'Bid opportunities · Wed 21 Oct, ' + at, title: 'Bid opportunities · Wed 21 Oct, ' + at + ' · ' + items.length + ' new, ' + still.length + ' still open', items, still } });
  const two = [{ project: 'PCC catering' }, { project: 'PCC IEC printing' }];
  let T = ctx.cueTodayFrom_([run('d0', '01:00', [], []), run('d1', '09:17', [], [{}]), run('d2', '09:58', two, [{}])].map(x => ctx.cueView_(x)), '2026-10-21');
  assert.ok(!('base' in ctx.cueView_(run('d2', '09:58', two, [])).bids), 'the page view carries the title, not base: the row must work from the view');
  deq(T.count, 1);
  deq([T.rows[0].eyebrow, T.rows[0].title, T.rows[0].thread], ['Bid opportunities · Wed 21 Oct, 09:58', '2 new bids worth a look', 'd0'], 'the row says which run holds the new bids; the tap opens the day\'s Bid check thread');
  assert.ok(!/bid check/.test(T.done), 'older bid runs that day are not listed again: ' + T.done);
  T = ctx.cueTodayFrom_([run('d0', '01:00', [], []), run('d2', '09:58', two, [{}]), run('d3', '10:30', [], two)].map(x => ctx.cueView_(x)), '2026-10-21');
  deq(T.count, 0, 'a later redo with 0 new supersedes the older card\'s 2 new (they are in its Still open now)');
  assert.ok(/bid check \(no new bids\)/.test(T.done), T.done);
});
test('TD3 Today frame: silent until cueHost from a Google window above it; doGet serves it framable; owner-only call', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'Today.html'), 'utf8'), gs = fs.readFileSync(path.join(__dirname, '..', 'src', 'Cue.gs'), 'utf8');
  assert.ok(/if \(!anc\) return;/.test(html) && /if \(!ok\.test\(anc\[i\]\)\) return;/.test(html), 'stays silent without, or with a foreign, ancestor');
  assert.ok(/d\.canvasWs !== 'cueHost' \|\| host \|\| !above\(e\.source\)/.test(html), 'only the first cueHost from a window above');
  assert.ok(/done: d\.done, version: d\.version \}/.test(html) && /version: CUE_VERSION_/.test(fs.readFileSync(path.join(__dirname, '..', 'src', 'CueToday.gs'), 'utf8')), 'the payload says which build answered');
  assert.ok(/host\.postMessage\(\{ canvasWs: 'cue-today'/.test(html) && !/parent\.postMessage\(\{ canvasWs: 'cue-today'/.test(html), 'rows go to the host only');
  assert.ok(/q\.view === 'today'\) return HtmlService\.createHtmlOutputFromFile\('Today'\)/.test(gs));
  const t = sandbox({ viewer: 'someone@example.com' });
  assert.throws(() => t.ctx.cueToday(), /owner|Kiko|only/i);
});
test('TD4 Cue chat: a day\'s scheduled-job pointer lines fold into one Today line', () => {
  const page = cuePage();
  assert.ok(/var jd = jobDay\(pt\); if \(jd && !answers\) \{ if \(!dayShown\[jd\]\) \{ dayShown\[jd\] = 1; h \+= todayHtml\(jd, th\); \} return; \}/.test(page));
  const src = page.slice(page.indexOf('var TODAY_K = '), page.indexOf('  // The chat: Kiko\'s general messages'));
  const ctx = vm.createContext({ esc: x => String(x), state: { today: { day: '2026-10-21', rows: [{ title: 'Send 3 emails', detail: '3 RFQ.', by: 'Done by ChatGPT · checked by Cue', thread: 's1' }], done: 'bid check (no new bids) (by ChatGPT)' } } });
  vm.runInContext(src, ctx);
  const h = ctx.todayHtml('2026-10-21', {});
  assert.ok(/Today: 1 thing needs you/.test(h) && /data-thread="s1"/.test(h) && /Done by ChatGPT · checked by Cue/.test(h) && /Done for you: bid check/.test(h), h);
});
