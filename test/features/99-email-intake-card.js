// Part of test/cue.test.js. Feature: EMAIL-INTAKE-CARD-2026-11-18 (Kiko 18 Nov 2026 04:34:50Z "the Email intake review list - please
// apply the filter"; 05:27:45Z "Email intake routes the emails right away right? can it just send me where it routed the email to and i
// will correct it"; card 2 approved 05:32:00Z, mockup https://claude.ai/artifact/Xb3X3eXTnSnS2AB3GB2wyk). One card per Email Intake run:
// noise is skipped and listed, every other message shows where it was routed and why. Headers only, never a body or attachment.
// Field names agreed with the Build the BSE automation thread, 18 Nov 05:40Z. Re-route has no command yet, so its buttons are off.
const eicRun = { run_id: 'EI-2026-11-18T05', read_at: '18 Nov, 1:20 PM', mailbox: 'kikodacanay@blankspaceevent.com', total_read: 4 };
const eicSkipped = [{ msg_id: 'g1', from: 'alerts@fing.example', subject: 'Fing Alert on WOOFY', received_at: '2026-11-18T05:01:00Z', noise_kind: 'Alert' }];
const eicRouted = [
  { msg_id: 'g2', from: 'buyer@client.example', subject: 'RFQ: stage <b>build</b>', received_at: '2026-11-18T05:02:00Z', routed_to: 'AS agent', why: 'RFQ in subject', project_id: 'S-31753672PA' },
  { msg_id: 'g3', from: 'someone@x.example', subject: 'Question about invoice', received_at: '2026-11-18T05:03:00Z', routed_to: 'Finance agent', why: 'best fit', project_id: '' }];
function eicView(h) {
  const b = agdBox({ drafts: [agdUpd(70, { agent: 'Email Intake agent', handover: Object.assign({ handover_ref: 'EI-RUN', summary: 'Run', state: 'Delivered' }, h) })] });
  b.t.ctx.cueAgdTick_(); return JSON.parse(JSON.stringify(b.t.ctx.cueView_(b.reqs()[0])));
}
function eicGrab() {
  const page = cuePage(), grab = name => { const a = page.indexOf('  function ' + name + '('); return a < 0 ? '' : page.slice(a, page.indexOf('\n  }\n', a) + 4); };
  const ctx = { editing: {}, agdRows: {}, agdRowOpen: {} }; vm.createContext(ctx);
  vm.runInContext(['esc', 'agKv', 'agdLabel', 'agdRowsHtml', 'agdIntakeHtml', 'agdUpdHtml'].map(grab).join('\n'), ctx);
  return ctx;
}
test('EIC1 a run from Canvas is kept clean: headers only, at most 200 per list, no run means no Email Intake card', () => {
  const t = sandbox({});
  const h = t.ctx.cueAgdHand_({ summary: 'y', run: Object.assign({}, eicRun, { total_read: -2 }), skipped: [Object.assign({ body: 'secret' }, eicSkipped[0]), null, 'x'],
    routed: Array.from({ length: 205 }, (_, i) => ({ msg_id: 'm' + i, subject: 's', routed_to: 'AS agent', why: 'w', attachments: ['a.pdf'] })) });
  assert.strictEqual(h.intake.total_read, null, 'a count below 0 is dropped'); assert.strictEqual(h.intake.mailbox, eicRun.mailbox);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(h.intake.skipped)), [{ msg_id: 'g1', from: 'alerts@fing.example', subject: 'Fing Alert on WOOFY', received_at: '2026-11-18T05:01:00Z', noise_kind: 'Alert' }]);
  assert.strictEqual(h.intake.routed.length, 200); assert.ok(!('attachments' in h.intake.routed[0]) && !('body' in h.intake.skipped[0]));
  assert.strictEqual(t.ctx.cueAgdHand_({ summary: 'y', routed: eicRouted }).intake, null, 'routed without a run is not an Email Intake card');
});
test('EIC2 the card: run facts, routed table with where and why, a row opens to sender, time and project; skipped list folded; re-route buttons off', () => {
  const v = eicView({ run: eicRun, skipped: eicSkipped, routed: eicRouted }), ctx = eicGrab(), html = ctx.agdUpdHtml(v);
  assert.ok(/Agent update · Email Intake/.test(html) && /Email Intake · routed/.test(html) && /class="tag good">Nothing needs you/.test(html));
  assert.ok(/Email Intake read 4 messages \(18 Nov, 1:20 PM\)\. 1 was noise and skipped\. It routed 2 messages right away\./.test(html), html);
  const heads = (html.match(/<th[^>]*>[^<]*<\/th>/g) || []).map(x => x.replace(/<[^>]+>/g, ''));
  assert.deepStrictEqual(heads, ['#', 'Message', 'Routed to', 'Why', '#', 'Message', 'Noise type']);
  assert.ok(/RFQ: stage &lt;b&gt;build&lt;\/b&gt;/.test(html) && /<td class="c">Account Specialist agent<\/td><td class="c">RFQ in subject<\/td>/.test(html), 'escaped; full role name');
  assert.ok(/<td class="c">Finance agent<\/td><td class="c">best fit<\/td>/.test(html));
  assert.ok(!/class="agdet"/.test(html) && /<details class="agnz"><summary>Show the 1 skipped message<\/summary>/.test(html));
  assert.ok(/<button class="btn ghost" disabled[^>]*>Not noise\? Move<\/button>/.test(html) && /<button class="btn ghost" disabled[^>]*>Save corrections<\/button>/.test(html), 'no re-route command yet');
  assert.ok(/data-act="agd-read"/.test(html) && /data-act="agd-reply"/.test(html));
  ctx.agdRowOpen[v.id] = 'g2'; const open = ctx.agdUpdHtml(v);
  assert.strictEqual((open.match(/class="agdet"/g) || []).length, 1);
  assert.ok(/buyer@client\.example/.test(open) && /2026-11-18T05:02:00Z/.test(open) && /S-31753672PA/.test(open));
});
test('EIC3 a run that routed nothing is the quiet summary: no routed table, no Save corrections', () => {
  const v = eicView({ run: Object.assign({}, eicRun, { total_read: 1 }), skipped: eicSkipped, routed: [] }), html = eicGrab().agdUpdHtml(v);
  assert.ok(/Email Intake · run summary/.test(html) && /Nothing was routed\. Nothing waits for you\./.test(html));
  assert.ok(!/Routed to/.test(html) && !/Save corrections/.test(html) && /Not noise\? Move/.test(html));
  const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexStyle.html'), 'utf8');
  assert.ok(/\.agit th \{[^}]*text-align:center/.test(css) && /\.agit td\.c \{ text-align:center/.test(css), 'headers and short columns centred');
});
