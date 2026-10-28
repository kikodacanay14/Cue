// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: help-answers.
/* ---------- Cue 1.27.36: Help answers from Canvas's Help Q&A list (CueHelp.gs, Kiko 27 Oct 02:34Z) ---------- */
const helpAsk = (q, o) => { const t = sandbox(o || {}); const r = t.ctx.cueSend(q, [], ''); return Object.assign(t, { id: r.request_id, v: t.ctx.cueView_(t.state(r.request_id)) }); };

test('HQ1 "help crew: …" matches the list in code: one Canvas read, no AI call, best row first, read cached for the next question', () => {
  const t = helpAsk('help crew: boss pano po ba pirmahan yung AR? di ko makita');
  deq([t.v.kind, t.v.status, t.v.help.audience, t.v.help.hits[0].id, t.v.metrics.ai_calls, t.log.helpReads], ['help', 'Done', 'Crew', 'CRW-H-04', 0, 1]);
  assert.ok(t.v.help.hits.length <= 3 && t.v.help.hits.every(h => /^(CRW|ALL)-/.test(h.id)), 'only crew and All rows');
  assert.ok(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/1m7k42MYTSi3rJh3lMV1GuiGIJ2NQ6jBrTz7--WGR3OU\/edit#gid=1989325205$/.test(t.v.help.sheet_url));
  assert.ok(t.tabs.Chat.rows.some(c => c[3] === t.id && /^Best match: .*\(CRW-H-04\)\. No AI call\.$/.test(c[2])));
  deq([t.log.gpt.length, t.log.claude.length], [0, 0]);
  const r2 = t.ctx.cueSend('faq: kelan po sahod', [], ''); const v2 = t.ctx.cueView_(t.state(r2.request_id));
  deq([v2.help.audience, v2.help.hits[0].id, t.log.helpReads], ['', 'CRW-W-07', 1], 'second question uses the cached list');
  assert.strictEqual(t.ctx.cueHelpSaid_('helpful tips for the event', ''), null, 'not a help command without the colon');
});

test('HQ2 matcher quality on the 200 seed phrasings (leave-one-out): at least 140 right first and 170 in the top three; off-topic questions match nothing', () => {
  const t = sandbox(); let top1 = 0, top3 = 0;
  HELP_QA.forEach(r => r.also.forEach((v, i) => {
    const bank = HELP_QA.map(x => (x === r ? Object.assign({}, x, { also: x.also.filter((_, j) => j !== i) }) : x));
    const rk = t.ctx.cueHelpRank_(bank, v, r.audience);
    if (rk[0].score >= 0.35 && rk[0].r.id === r.id) top1++;
    if (rk[0].score >= 0.35 && rk.slice(0, 3).some(x => x.r.id === r.id)) top3++;
  }));
  assert.ok(top1 >= 140 && top3 >= 170, 'top1 ' + top1 + ', top3 ' + top3); console.log('     HQ2 leave-one-out: ' + top1 + '/200 first, ' + top3 + '/200 in top three');
  ['what time is call time tomorrow', 'can i bring my kid to the event', 'is there parking at the venue', 'what should i wear'].forEach(q =>
    assert.ok(t.ctx.cueHelpRank_(HELP_QA, q, 'Crew')[0].score < 0.35, q));
  deq([...t.ctx.cueHelpToks_('Pano po mag log in sa portal?')].sort(), ['login']);
});

test('HQ3 no match: Needs you; Add as Draft adds the question once through help_qa_add (bridge schema checked); already listed says so', () => {
  const t = helpAsk('help supplier: can we park our truck at the venue overnight?');
  deq([t.v.status, t.v.help.hits.length], ['Needs you', 0]);
  const v = t.ctx.cueHelpAct(t.id, 'draft', '');
  deq([v.status, v.help.added, t.log.helpAdds.length], ['Done', { id: 'CRW-Q-02', existed: false, status: 'Draft' }, 1]);
  deq([t.log.helpAdds[0].request_id, t.log.helpAdds[0].audience, t.log.helpAdds[0].question], ['cuehelp:' + t.id, 'Supplier', 'can we park our truck at the venue overnight?']);
  t.ctx.cueHelpAct(t.id, 'draft', ''); assert.strictEqual(t.log.helpAdds.length, 1, 'a second tap adds nothing');
  assert.ok(bridgeCheck('help_qa_add', { request_id: 'x', question: 'q' }), 'a short request id is refused by the bridge');
  assert.ok(bridgeCheck('help_qa', { audience: 'Staff' }), 'only Crew, Client, Supplier or All');
  const u = helpAsk('help: where do we park the truck overnight?', { helpExisted: true });
  const w = u.ctx.cueHelpAct(u.id, 'draft', '');
  deq([u.log.helpAdds[0].audience, w.help.added.existed], ['All', true]);
  assert.ok(u.tabs.Chat.rows.some(c => c[3] === u.id && /^Already on the list as CRW-Q-01 \(Draft\)\.$/.test(c[2])));
});

test('HQ4 Rephrase is one Claude Haiku call that keeps the facts; picking another match clears it; nothing is sent', () => {
  const t = helpAsk('help crew: Where can I download my signed FSA?');
  const v = t.ctx.cueHelpAct(t.id, 'rephrase', '');
  deq([t.log.claude.length, v.help.reply, v.metrics.ai_calls], [1, 'Hi! Mag-sign in ka po sa crew site, tapos open To sign.', 1]);
  const body = t.log.claude[0]; deq([body.model, body.output_config.effort], ['claude-haiku-5-5', 'low']);
  assert.ok(body.messages[0].content.indexOf(t.v.help.hits[0].answer) >= 0, 'the list\'s answer goes in');
  if (v.help.hits.length > 1) { const p = t.ctx.cueHelpAct(t.id, 'pick', 1); deq([p.help.pick, p.help.reply], [1, '']); }
  assert.throws(() => t.ctx.cueHelpAct(t.id, 'pick', 7), /No such match/);
  assert.throws(() => t.ctx.cueHelpAct(t.id, 'send', ''), /Unknown action/);
  deq([t.log.gmail.length, (t.log.helpAdds || []).length], [0, 0]);
});

test('HQ5 Canvas cannot be read: Failed with the reason; Try again reads it and matches', () => {
  const t = helpAsk('help client: are you VAT registered?', { helpFail: 1 });
  deq([t.v.status, /^Reading the Help Q&A list from Canvas stopped: Canvas refused help_qa \(Blocked\)/.test(t.tabs.Chat.rows.filter(c => c[3] === t.id).slice(-1)[0][2])], ['Failed', true]);
  const v = t.ctx.cueRetry(t.id);
  deq([v.status, v.help.hits[0].id], ['Done', 'CLI-W-02']);
});

test('HQ6 the Help card: answer with Copy reply, Rephrase and Edit answer in bank; close matches; Add as Draft when nothing matches; only the owner taps', () => {
  const html = cuePage();
  const grab = name => { const a = html.indexOf('function ' + name + '('); return html.slice(a, html.indexOf('\n  }\n', a) + 4); };
  const ctx = { esc: x => String(x).replace(/[<>&"']/g, c => '&#' + c.charCodeAt(0) + ';'), metricLine: () => '' };
  vm.createContext(ctx); vm.runInContext(grab('helpCardHtml'), ctx);
  const t = helpAsk('help crew: When will I get paid?'), out = ctx.helpCardHtml(JSON.parse(JSON.stringify(t.v)));
  assert.ok(/data-act="help-copy"/.test(out) && /data-act="help-rephrase"/.test(out) && /Edit answer in bank/.test(out) && /matched by code, no AI call/.test(out), out.slice(0, 300));
  assert.ok(new RegExp('data-help-reply="' + t.id + '"').test(out) && !/data-act="help-draft"/.test(out));
  const n = helpAsk('help: can i bring my dog'), none = ctx.helpCardHtml(JSON.parse(JSON.stringify(n.v)));
  assert.ok(/data-act="help-draft"/.test(none) && /no answer for this yet/.test(none) && !/help-copy/.test(none));
  assert.strictEqual(pageKindName({ kind: 'help' }), 'Help answer');
  const o = sandbox({ viewer: 'someone@example.com' }); assert.throws(() => o.ctx.cueHelpAct(t.id, 'pick', 0), /private/);
  const x = sandbox(); assert.throws(() => x.ctx.cueHelpAct('cue-nope', 'pick', 0), /not a Help card/);
});
