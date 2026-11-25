// Part of test/cue.test.js. EMAIL-ROUTE-HELD-2026-11-25 (Kiko 25 Nov 2026, n8n2 chat: "shouldnt i be able to reroute?", "and it should
// learn why"; rules R-ER1 to R-ER8 "Approve all"; scope and design "Approve, ECII in"; Canvas V582) and CUE-EMAIL-SLIM-2026-11-25
// ("can we make the card slimmer? like 75% of the size"). Uses eicView / eicGrab from 99-email-intake-card.js.
const erHeld = [{ number: 2, msg_id: '19ac44de0b7f2a61', from: 'BDO <notifications@bdo.test>', subject: 'Payment received', why: 'Payment notice',
  decision_needed: true, eligible_roles: ['FINANCE', 'AS'], suggestions: [{ agent: 'FINANCE', rule: 'Bank payment notices go to Finance.', lesson_id: 'LSN-0001', learned_at: '25 Nov, 10:14 AM' },
    { agent: 'KIKO', rule: 'x' }] },
  { number: 3, msg_id: '19ac44de0b7f2a62', from: 'Paolo <paolo@lakbay.test>', subject: 'Booth sizes' }];
test('ER1 a held row keeps its suggestions (known agents only, at most five); a route receipt with revision 0 and no handoff key is exact', () => {
  const t = sandbox({}), h = t.ctx.cueAgdHand_({ summary: 'y', run: eicRun, not_routed: erHeld });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(h.intake.not_routed[0].suggestions)), [{ agent: 'FINANCE', rule: 'Bank payment notices go to Finance.', lesson_id: 'LSN-0001', learned_at: '25 Nov, 10:14 AM' }]);
  const route = { card_id: 'DRF-0070', reply_id: 'DRF-0071', number: 2, msg_id: 'm', handoff_key: '', revision: 0, action: 'route', to_role: 'FINANCE' };
  const rec = Object.assign({ status: 'received_by_email_intake', received_at: '2026-11-25T12:40:00Z' }, route);
  assert.ok(t.ctx.cueEmailExactReceipt_(route, rec));
  assert.ok(!t.ctx.cueEmailExactReceipt_(Object.assign({}, route, { revision: 1 }), Object.assign({}, rec, { revision: 1 })), 'a route is revision 0');
  assert.ok(!t.ctx.cueEmailExactReceipt_(Object.assign({}, route, { handoff_key: 'EI:x' }), Object.assign({}, rec, { handoff_key: 'EI:x' })), 'a route has no handoff key');
});
const erOpen = html => (html.split('<tr class="cue-email-detail-row"').slice(1).find(x => !/^ hidden/.test(x)) || '');
test('ER2 R-ER1, R-ER4: a held row opens to its suggestion and Route to its eligible agents; a row with none lists all six, ECII included', () => {
  const v = eicView({ run: eicRun, not_routed: erHeld }), ctx = eicGrab();
  ctx.agdRowOpen[v.id] = '19ac44de0b7f2a61'; let html = erOpen(ctx.agdUpdHtml(v));
  assert.ok(/Suggested: Finance<\/b><button class="btn" type="button" data-act="agd-email-route"[^>]*data-to="FINANCE">Route to Finance/.test(html), html);
  assert.ok(/Lesson: "Bank payment notices go to Finance\."/.test(html));
  const opts = r => (r.match(/<option value="([A-Z]+)"/g) || []).map(x => x.slice(15, -1));
  assert.deepStrictEqual(opts(html), ['FINANCE', 'AS']);
  assert.ok(/data-act="agd-email-route" data-id="[^"]+" data-row="19ac44de0b7f2a61">Save route<\/button>/.test(html) && /Reason \(optional\)/.test(html));
  ctx.agdRowOpen[v.id] = '19ac44de0b7f2a62'; html = erOpen(ctx.agdUpdHtml(v));
  assert.deepStrictEqual(opts(html), ['AS', 'ECII', 'FINANCE', 'ADMIN', 'ECI', 'MULTIMEDIA']);
});
test('ER3 a saved route shows "Saved in Cue, waiting for Email Intake", then the receipt; the editor is gone', () => {
  const v = eicView({ run: eicRun, not_routed: erHeld }), ctx = eicGrab(); ctx.agdRowOpen[v.id] = '19ac44de0b7f2a61';
  const rc = { card_id: v.agd.draft_id, reply_id: 'DRF-0071', number: 2, msg_id: '19ac44de0b7f2a61', handoff_key: '', revision: 0, action: 'route', to_role: 'FINANCE' };
  v.agd.replies = [{ at: 'x', text: 'Email route', route_correction: rc }];
  let html = erOpen(ctx.agdUpdHtml(v));
  assert.ok(/Saved in Cue, waiting for Email Intake/.test(html) && !/Save route/.test(html));
  v.agd.replies[0].correction_receipt = Object.assign({ status: 'received_by_email_intake', received_at: '2026-11-25T12:40:00Z' }, rc);
  html = ctx.agdUpdHtml(v); assert.ok(/Received by Email Intake<\/strong><br>Finance · 2026-11-25T12:40:00Z/.test(html), html);
});
test('ER4 R-ER7: Lessons opens the list with Remove; the Needs Verification card gets Route to beside Approve and Reject', () => {
  const v = eicView({ run: eicRun, not_routed: erHeld }), ctx = eicGrab();
  assert.ok(/data-act="agd-lessons"[^>]*>Lessons<\/button>/.test(ctx.agdUpdHtml(v)));
  ctx.agdLessonsOpen[v.id] = true; ctx.agdLessonList = [{ lesson_id: 'LSN-0002', created: '2026-11-25 20:30', sender: 'paolo@lakbay.test', subject: 'Booth sizes', agent: 'AS', reason: '', rule: 'Emails from paolo@lakbay.test go to Account Specialist.' }];
  const html = ctx.agdUpdHtml(v);
  assert.ok(/Emails from paolo@lakbay\.test go to Account Specialist\.<\/td>/.test(html) && /data-act="agd-lesson-remove"[^>]*data-lesson="LSN-0002">Remove/.test(html));
  assert.ok(/Hide lessons/.test(html));
  const nv = eicView({ route_decision: { message_id: '19ac44de0b7f2a63', number: 4, status: 'needs_verification', sender: 'X', subject: 'Y' } });
  const nctx = eicGrab(); nctx.agdAsk = {}; const nh = nctx.agdUpdHtml(nv);
  assert.ok(/Needs Verification/.test(nh) && /data-act="agd-email-route"[^>]*data-row="19ac44de0b7f2a63">Save route/.test(nh) && /<option value="ECII">/.test(nh), nh);
});
test('ER5 the page wiring: a route goes to Canvas as email_route; lessons are read and removed through Cue; the card is slimmer', () => {
  const page = cuePage();
  assert.ok(/email_route:\{number:hrow\.number,msg_id:msgId,to_role:to/.test(page) && /call\('cueEmailLessons'/.test(page) && /call\('cueEmailLessonRemove'/.test(page));
  assert.ok(/if \(dec === 'reply' && o\.email_route\) args\.email_route = o\.email_route;/.test(CODE));
  assert.ok(/'email_lessons'/.test(CODE) && /'email_lesson_remove'/.test(CODE));
  assert.ok(/\.cue-email-report \.cue-email-hero h2\{font-size:24px\}/.test(page) && /\.cue-email-report th,\.cue-email-report td\{padding:6px 8px\}/.test(page));
  assert.strictEqual(bridgeCheck('agent_draft_decide', { request_id: 'agd:cue-x:1', draft_id: 'DRF-0070', decision: 'reply', note: 'Email route',
    email_route: { number: 2, msg_id: 'm', to_role: 'ECII', note: '' } }), '');
  assert.strictEqual(bridgeCheck('email_lesson_remove', { request_id: 'lsn:LSN-0001:1', lesson_id: 'LSN-0001' }), '');
});
