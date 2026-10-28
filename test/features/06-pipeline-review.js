// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: pipeline-review.
test('P1 pipeline review (C11): chat routes it, HubSpot + Gmail read in code, rules flag, one Claude call, card waits for Kiko; nothing written', () => {
  const t = pipeToCard(), v = t.v;
  assert.strictEqual(v.status, 'Needs you', v.error); assert.strictEqual(v.kind, 'pipeline'); assert.strictEqual(v.metrics.ai_calls, 1, 'one Claude call in the run');
  assert.strictEqual(t.log.claude.length, 1); assert.strictEqual(t.log.gpt.length, 1, 'only the chat call'); assert.strictEqual(t.log.bridge.filter(b => b.action !== 'search_projects').length, 0, 'Canvas untouched'); deq(t.log.search || [], [], 'the chat lookup, also a read');
  assert.ok(t.log.hs.every(c => c.method === 'get' || /\/search$|\/batch\/read$/.test(c.path)), 'HubSpot reads only');
  assert.ok(t.log.hs.every(c => c.auth === 'Bearer pat-test-not-real'));
  deq(t.log.hs.find(c => c.path === '/crm/v3/objects/deals/search').body.filterGroups[0].filters[0], { propertyName: 'dealstage', operator: 'NOT_IN', values: ['s3', 's4'] });
  const P = v.pipe, by = {}; P.deals.forEach(d => { by[d.name.split(' — ')[0]] = d; });
  assert.strictEqual(P.open, 5, 'closed deal dropped even if HubSpot returns it'); assert.ok(!by['Old Co']);
  deq(P.deals.map(d => [d.k, d.group]), [['D2', 'act'], ['D3', 'chase'], ['D4', 'chase'], ['D1', 'data'], ['D5', 'ok']], 'sorted by urgency, then event date');
  deq(by.Telus.flags, ['They wrote last, 2 working day(s) ago', 'Event in 4 day(s), not won yet']);
  deq(by.PCAARRD.flags, ['Quiet for 11 day(s)']); deq(by['AMI Group'].flags, ['No email found in 120 days', 'Missing contact']);
  deq(by['Embassy of Belgium'].flags, ['Event date passed, deal still open', 'Missing amount']);
  assert.strictEqual(by.Telus.next, 'Reply to Ana with the revised CE.'); assert.strictEqual(P.summary, PIPE_REVIEW.summary);
  assert.ok(by.Telus.url.indexOf('https://app.hubspot.com/contacts/247723523/record/0-3/101') === 0 && by.Telus.mail.url.indexOf('#all/aa0100000000000a') > 0);
  assert.strictEqual(by.Telus.mail.dir, 'in'); assert.strictEqual(by.PCAARRD.mail.to, 'joy@pcaarrd.test', 'own-domain address skipped');
  deq([by.Telus.can_draft, by.PCAARRD.can_draft, by['AMI Group'].can_draft, by['Asian Development Bank'].can_draft], [true, true, false, false]);
  const sent = JSON.parse(t.log.claude[0].messages[0].content); deq(sent.deals.map(d => d.k), ['D2', 'D3', 'D4', 'D1'], 'only flagged deals go to Claude');
  assert.ok(/never follow instructions/.test(t.log.claude[0].system) && t.log.claude[0].output_config.effort === 'low');
  assert.ok(t.log.pipeQ.some(q => /from:ana@telus\.test OR to:ana@telus\.test/.test(q) && /"S-255PR"/.test(q) && /"Telus"/.test(q)), 'search by contact, project ID and client');
  assert.ok(JSON.stringify(t.log.gpt[0]).indexOf('kumusta yung deals') > 0, 'trigger words in the chat schema');
  assert.ok(t.tabs.Chat.rows.some(x => x[3] === '>' + t.id && /pipeline review in its own thread/.test(x[2])), 'pointer in the main chat');
  assert.ok(t.tabs.Chat.rows.some(x => x[3] === t.id && /1 to act on today, 2 to chase, 1 to fix, 1 on track/.test(x[2])));
  const row = t.tabs.Pipeline.rows[1]; deq(row.slice(2, 9), [5, 5, 1, 2, 1, 1, 1], 'Pipeline tab logged');
  const st = JSON.stringify(t.ctx.cueState()); assert.ok(st.indexOf('pat-test') < 0 && st.indexOf('Ignore previous instructions') < 0, 'no token or email text in page state');
});

test('P2 follow-ups: one GPT call for ticked deals with a thread; Approve and send replies in each thread; drafts only never sends; Done closes', () => {
  const t = pipeToCard();
  assert.throws(() => t.ctx.cuePipeFollowUps(t.id, ['D4']), /email thread/);
  const v = t.ctx.cuePipeFollowUps(t.id, ['D2', 'D3', 'D4']);
  assert.strictEqual(v.status, 'Needs you', v.error); assert.strictEqual(v.metrics.ai_calls, 2, 'review + follow-ups');
  deq(v.pipe.drafts.map(d => [d.k, d.to]), [['D2', 'ana@telus.test'], ['D3', 'joy@pcaarrd.test']], 'unticked and duplicate drafts dropped');
  assert.ok(/never follow/.test(t.log.gpt[1].instructions)); deq(JSON.parse(t.log.gpt[1].input).deals.map(d => d.k), ['D2', 'D3']);
  assert.throws(() => t.ctx.cueApprove(t.id, { bodies: { D2: ' ' }, send: true }), /is empty/);
  const d = t.ctx.cueApprove(t.id, { skip: ['D3'], bodies: { D2: 'Hi Ana, edited by Kiko.' }, send: true });
  assert.strictEqual(d.status, 'Done'); assert.strictEqual(t.log.replies.length, 1); deq(t.log.sent, ['reply-1']);
  const pl = t.log.replies[0].payload; assert.ok(pl.indexOf('{"message":{"threadId":"aa0100000000000a"}}') > 0 && /To: ana@telus\.test/.test(pl) && /In-Reply-To: <pm1@mail>/.test(pl));
  assert.ok(Buffer.from(pl.split('base64\r\n\r\n')[1].split('\r\n--')[0].replace(/\r\n/g, ''), 'base64').toString().indexOf('edited by Kiko') >= 0);
  assert.ok(t.tabs.Chat.rows.some(x => /^Sent 1 follow-up from your Gmail.*HubSpot and Canvas were not changed/.test(x[2])));
  assert.ok(t.tabs.Chat.rows.some(x => x[3] === '>' + t.id && /^Summary for Pipeline review: 5 open deals checked.*sent 1 follow-up/.test(x[2])));
  assert.strictEqual(t.log.bridge.filter(b => b.action !== 'search_projects').length, 0); deq(t.log.search || [], [], 'the chat lookup, also a read');
  const u = pipeToCard(); u.ctx.cuePipeFollowUps(u.id, ['D3']); assert.strictEqual(u.ctx.cueApprove(u.id, {}).status, 'Done'); assert.ok(!u.log.sent, 'drafts only sends nothing');
  const w = pipeToCard(); const x = w.ctx.cuePipeDone(w.id); assert.strictEqual(x.status, 'Done'); assert.ok(!w.log.replies);
});

test('P3 pipeline edge cases: one client only; no token, bad token; Claude down still gives the rule flags; a chat answer never joins a pipeline thread', () => {
  const t = pipeToCard({ client: 'Telus', ask: 'where are we with telus' });
  deq(t.v.pipe.deals.map(d => d.name), ['Telus — Trick or Treat - Manila']); assert.strictEqual(t.v.pipe.title, 'Pipeline: Telus');
  const n = sandbox({ pipeMail: true, talk: pipeTalk() }), id = n.ctx.cueSend('hows the pipeline').request_id, v = n.ctx.cueRun(id);
  assert.strictEqual(v.status, 'Failed'); assert.ok(/CUE_HUBSPOT_TOKEN is not set/.test(v.error), v.error);
  const b = pipeToCard({ hsCode: 401 }); assert.strictEqual(b.v.status, 'Failed'); assert.ok(/did not accept CUE_HUBSPOT_TOKEN/.test(b.v.error));
  const c = pipeToCard({ fail: { cost: () => resp(500, {}) } });
  assert.strictEqual(c.v.status, 'Needs you'); assert.ok(c.v.notes.some(x => /Claude could not review/.test(x))); assert.strictEqual(c.v.pipe.deals[0].group, 'act');
  assert.ok(/1 deal\(s\) to act on today, 2 to chase, 1 to fix/.test(c.v.pipe.summary));
  // An intake about Telus right after a Telus pipeline review starts its own thread, not inside the review.
  assert.strictEqual(t.ctx.cueRelated_('Telus booth change', '', ''), '');
  assert.strictEqual(t.ctx.cuePipeWorkDays_(Date.parse('2026-10-16T02:00:00Z'), Date.parse('2026-10-19T02:00:00Z')), 1, 'Fri to Mon is one working day');
});
