// Part of test/cue.test.js. Feature: EMAIL-INTAKE-CARD-2026-11-18 (Kiko 18 Nov 2026 04:34:50Z "the Email intake review list - please
// apply the filter"; 05:27:45Z "Email intake routes the emails right away right? can it just send me where it routed the email to and i
// will correct it"; card 2 approved 05:32:00Z, mockup https://claude.ai/artifact/Xb3X3eXTnSnS2AB3GB2wyk). One card per Email Intake run:
// noise is skipped and listed, every other message shows where it was routed and why. Headers only, never a body or attachment.
// Field names agreed with the Build the BSE automation thread, 18 Nov 05:40Z. Re-route has no receiver handoff, so corrections are unavailable.
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
  const ctx = { editing: {}, agdRows: {}, agdRowOpen: {}, agdTick: {} }; vm.createContext(ctx);
  vm.runInContext(['esc', 'agKv', 'agdLabel', 'agdRowsHtml', 'agdCheck', 'agdCkSum', 'agdIntakeHtml', 'agdUpdHtml'].map(grab).join('\n'), ctx);
  return ctx;
}
// LIVE-SYNC-2026-11-25: the card was redesigned on live Cue (Apps Script versions 280 to 284, 24 Nov 2026) as one table of every email
// in the run with a status and a destination, and a row that opens to the original message. Kiko, shown that card on 25 Nov 2026:
// "Yes, keep it" to keeping the email text on the card. So the email text (up to 2,000 characters) is kept; attachments still are not.
// The four tests below describe the live card. The older checks for the summary sentence, the separate noise list and the
// "Reroute is not connected" note described the 18 Nov card and were removed with it.
test('EIC1 a run from Canvas is kept clean: no attachments, the email text capped at 2,000 characters, at most 200 per list, no run means no Email Intake card', () => {
  const t = sandbox({});
  const h = t.ctx.cueAgdHand_({ summary: 'y', run: Object.assign({}, eicRun, { total_read: -2 }), skipped: [Object.assign({ body: 'secret' }, eicSkipped[0]), null, 'x'],
    routed: Array.from({ length: 205 }, (_, i) => ({ msg_id: 'm' + i, subject: 's', routed_to: 'AS agent', why: 'w', attachments: ['a.pdf'], source_body: i ? '' : 'x'.repeat(2500) })) });
  assert.strictEqual(h.intake.total_read, null, 'a count below 0 is dropped'); assert.strictEqual(h.intake.mailbox, eicRun.mailbox);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(h.intake.skipped)), [{ number: null, msg_id: 'g1', from: 'alerts@fing.example', subject: 'Fing Alert on WOOFY', received_at: '2026-11-18T05:01:00Z', source_body: '', noise_kind: 'Alert' }]);
  assert.strictEqual(h.intake.routed.length, 200); assert.ok(!('attachments' in h.intake.routed[0]) && !('body' in h.intake.skipped[0]), 'attachments and unknown fields are dropped');
  assert.strictEqual(h.intake.routed[0].source_body.length, 2000, 'the email text is kept, cut at 2,000 characters');
  assert.strictEqual(t.ctx.cueAgdHand_({ summary: 'y', routed: eicRouted }).intake, null, 'routed without a run is not an Email Intake card');
});
test('EIC2 the card: one table of every email with its status and destination; a row opens to the original message', () => {
  const v = eicView({ run: eicRun, skipped: eicSkipped, routed: eicRouted }), ctx = eicGrab(), html = ctx.agdUpdHtml(v);
  assert.ok(/<header class="cue-email-hero"><h2>Email Intake<\/h2>/.test(html) && /<strong>18 Nov, 1:20 PM<\/strong><span>4 emails · 0 need attention<\/span>/.test(html), html.slice(0, 400));
  const heads = (html.match(/<th[^>]*>[^<]*<\/th>/g) || []).map(x => x.replace(/<[^>]+>/g, ''));
  assert.deepStrictEqual(heads, ['', 'Email', 'Status', 'Destination']);
  assert.ok(/<strong>RFQ: stage &lt;b&gt;build&lt;\/b&gt;<\/strong><span class="cue-email-from">buyer@client\.example<\/span><\/td><td><span class="cue-email-pill good">Routed<\/span><\/td><td>Account Specialist agent<\/td>/.test(html), 'escaped; full role name');
  assert.ok(/<span class="cue-email-pill good">Routed<\/span><\/td><td>Finance agent<\/td>/.test(html));
  assert.ok(/<strong>Fing Alert on WOOFY<\/strong>[\s\S]{0,120}<span class="cue-email-pill quiet">Skipped<\/span><\/td><td>Not routed<\/td>/.test(html), 'noise is a row of the same table');
  assert.strictEqual((html.match(/<tr class="cue-email-detail-row" hidden>/g) || []).length, 3, 'every row starts closed');
  assert.ok(/data-act="agd-read"/.test(html));
  ctx.agdRowOpen[v.id] = 'g2'; const open = ctx.agdUpdHtml(v);
  assert.strictEqual((open.match(/<tr class="cue-email-detail-row">/g) || []).length, 1, 'one row open');
  assert.ok(/<strong>Original message<\/strong><p class="cue-email-from">kikodacanay@blankspaceevent\.com · 2026-11-18T05:02:00Z<\/p><p><strong>Project<\/strong> S-31753672PA<\/p><p><strong>Why this status<\/strong> RFQ in subject<\/p>/.test(open));
});
test('EIC3 a run that routed nothing shows only its skipped mail: no Routed row', () => {
  const v = eicView({ run: Object.assign({}, eicRun, { total_read: 1 }), skipped: eicSkipped, routed: [] }), html = eicGrab().agdUpdHtml(v);
  assert.ok(/<span>1 emails · 0 need attention<\/span>/.test(html) && /<span class="cue-email-pill quiet">Skipped<\/span>/.test(html));
  assert.ok(!/cue-email-pill good/.test(html) && (html.match(/<tr class="agrow">/g) || []).length === 1);
  const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexStyle.html'), 'utf8');
  assert.ok(/\.agit th \{[^}]*text-align:center/.test(css) && /\.agit td\.c \{ text-align:center/.test(css), 'headers and short columns centred');
});
test('EIC4 mail no role fits is not routed and shown as its own row with a warning status (Kiko 05:47Z); the Build thread sample from 17 Nov renders', () => {
  const v = eicView({ run: { run_id: 'scan-1763362271', read_at: '2026-11-17T07:11:41Z', mailbox: 'kikodacanay@blankspaceevent.com', total_read: 7 },
    skipped: [{ msg_id: 'n1', from: 'Fing Alert', subject: 'Fing Alert on WOOFY_892D_2.4G', received_at: '2026-11-17T01:00:00Z', noise_kind: 'no-reply' }],
    routed: [{ msg_id: 'c1', from: 'Ana Reyes', subject: 'Gate pass S-00000001', received_at: '2026-11-17T01:00:00Z', routed_to: 'ECI', why: 'project code S-00000001; best fit: event operations words ("gate pass")', project_id: 'S-00000001' }],
    not_routed: [{ msg_id: 'u1', from: 'Lito Cruz', subject: 'Hello', received_at: '2026-11-17T02:00:00Z', why: 'no role fits', attachments: ['x'] }] });
  assert.deepStrictEqual(Object.keys(v.agd.handover.intake.not_routed[0]).sort((a, b) => a.localeCompare(b)),
    ['decision_needed', 'dispatch', 'eligible_roles', 'from', 'msg_id', 'number', 'receipt', 'received_at', 'source_body', 'subject', 'wake', 'why'], 'no attachments');
  const ctx = eicGrab(), html = ctx.agdUpdHtml(v);
  assert.ok(/<strong>Hello<\/strong><span class="cue-email-from">Lito Cruz<\/span><\/td><td><span class="cue-email-pill warn">Not routed<\/span><\/td><td>Not routed<\/td>/.test(html), 'not routed mail has its own row and a warning status');
  assert.ok(/<span class="cue-email-pill good">Routed<\/span><\/td><td>Event Specialist<\/td>/.test(html), 'ECI shows as Event Specialist');
  ctx.agdRowOpen[v.id] = 'u1';
  assert.ok(/<strong>Why this status<\/strong> no role fits/.test(ctx.agdUpdHtml(v)), 'the open row says why');
});
