// Part of test/cue.test.js. Feature: PHASE1-CARDS-2026-11-25, second file: the shared "Question for you" card (Kiko 25 Nov 2026
// "What if we just have a totally different Questions for you card? reusable by everyone") and how the new cards reach the page.
// Helpers (P1, p1Page, p1Card, p1Text, p1Src, p1First) are in 99-phase1-cards.js, loaded just before this file.
// Kept as a second file only to keep each file short; both files are one feature.
test('P1C12 question card: the question, a From cell naming the agent, what waits, an answer box, and the client message as a second way', () => {
  const P = p1Page(), h = P.agdQuestionHtml(p1Card({ question: P1.questionText }, { agd: { agent: 'AS' } }), true, false), t = p1Text(h);
  assert.ok(/<div class="card cue-r1-inquiry cue-q" data-card="cue-p1-1"><header class="cue-r1-head"><h2>Question for you<\/h2><span class="tag warn">Waiting for you<\/span><\/header>/.test(h));
  assert.ok(/<p class="q-text">Does the organiser supply power, or do we bring a distribution box\?<\/p>/.test(h));
  assert.ok(/<div class="cue-r1-fact"><b>From<\/b><span>Account Specialist<\/span><\/div><div class="cue-r1-fact"><b>Line that waits<\/b><span>BSE-2027-0031-R05 · Lighting and power<\/span><\/div>/.test(h), 'From comes first and names the agent that asks');
  ['Project', 'Source', 'Only this line waits. The other 5 requirements can be approved now.', 'A. I answer here', 'B. Ask the client: I approve the exact message below', 'Your answer',
    'Nothing is sent to the client until you tap Approve message. You can edit the words first.'].forEach(x => assert.ok(t.includes(x), x));
  assert.ok(/<div data-q-pane="B" hidden>/.test(h) && /<textarea rows="5" data-q-client>Hi Bea,/.test(h), 'the client message is hidden until he picks B');
  assert.ok(/<button class="btn" data-act="agd-q" data-q="client" data-id="cue-p1-1" hidden>Approve message<\/button><button class="btn cue-r1-primary" data-act="agd-q" data-q="send" data-id="cue-p1-1" disabled>Send answer<\/button>/.test(h));
  const from = a => /<b>From<\/b><span>([^<]*)</.exec(P.agdQuestionHtml(p1Card({ question: P1.questionCase }, { agd: { agent: a } }), true, false))[1];
  deq([from('MM'), from('ECII agent'), from('Finance')], [P.agdLabel('MM'), P.agdLabel('ECII agent'), P.agdLabel('Finance')], 'any agent can ask; the cell shows the name Kiko sees for it');
  assert.ok(/Multimedia/.test(from('MM')) && /Procurement/.test(from('ECII agent')));
});

test('P1C13 question card with lettered options, and after the answer: the pick stays readable, Saved, no buttons', () => {
  const P = p1Page(), c = P.agdQuestionHtml(p1Card({ question: P1.questionCase }), true, false);
  assert.strictEqual((c.match(/<input type="radio" name="q-cue-p1-1"/g) || []).length, 4);
  assert.ok(/<label><input type="radio" name="q-cue-p1-1" value="Fabrication II"><span><b>B\.<\/b> Fabrication II: the client asks us to design a booth and gives measurements<\/span><\/label>/.test(c));
  assert.ok(/<b>Waits<\/b><span>Multimedia&#39;s check of the client&#39;s files<\/span>/.test(c) && !/data-q-answer|data-q="client"/.test(c), 'options only: no answer box, no client message');
  const k = 'AS:pre:a1b2c3d4e5f60718:mm-check', done = P.agdQuestionHtml(p1Card({ question: P1.questionCase }, { agd: { status: 'Replied', replies: [{ text: 'Answer ' + k + ' r1: Event I' }] } }), true, false);
  assert.ok(/<span class="tag good">Answered<\/span>/.test(done) && !/data-act="agd-q"/.test(done) && /<p class="cue-r1-saved" role="status"><span>Saved<\/span><\/p>/.test(done));
  assert.ok(/value="Event I" checked disabled>/.test(done) && /value="Fabrication I" disabled>/.test(done), 'his pick is shown, locked');
  const typed = P.agdQuestionHtml(p1Card({ question: P1.questionText }, { agd: { agent: 'AS', status: 'Replied', replies: [{ text: 'Answer AS:S-2027BSE0031:BSE-2027-0031-R05:q1 r1: Organiser supplies one 15 A outlet.' }] } }), true, false);
  assert.ok(/<textarea rows="2" placeholder="Type your answer" data-q-answer disabled>Organiser supplies one 15 A outlet\.<\/textarea>/.test(typed));
});

test('P1C14 the answers sent from a question card; only the client message asks "Are you sure...?"', () => {
  const P = p1Page(), k = 'AS:S-2027BSE0031:BSE-2027-0031-R05:q1';
  deq([P.agdQNote('send', P1.questionText, ' We bring a box. '), P.agdQNote('send', P1.questionText, ''), P.agdQNote('client', P1.questionText, 'Hi Bea,\nOne question.'),
    P.agdQNote('send', P1.questionCase, 'Event II'), P.agdQNote('send', P1.questionCase, 'Event III')],
    ['Answer ' + k + ' r1: We bring a box.', '', 'Approve client message ' + k + ' r1:\nHi Bea,\nOne question.', 'Answer AS:pre:a1b2c3d4e5f60718:mm-check r1: Event II', '']);
  deq([P.agdSureText('agd-q', 'client'), P.agdSureText('agd-q', 'send'), P.agdSureText('agd-mm', 'approve'), P.agdSureText('agd-mm', 'back'), P.agdSureText('agd-mm', 'source')],
    [['Are you sure you want to approve this message?', 'It is sent to the client as written.'], null, ['Are you sure you want to approve this work?', 'It goes to Account Specialist.'],
      ['Are you sure you want to send this back?', 'Multimedia revises the work with your comments.'], null]);
});

/* ---------- how the cards reach the page ---------- */
test('P1C15 an update that carries an image review or a question is drawn as that card; every other update is drawn as before', () => {
  const cards = p1Src('IndexCards.html'), a = cards.indexOf('  function agdUpdHtml(r) {'), f = cards.slice(a, cards.indexOf('  function agdProjectUpdateHtml(', a));
  assert.ok(f.includes("if (H.project_inquiry) return agdInquiryHtml(r, canReply, unread);\n    if (H.image_review) return agdImageReviewHtml(r, canReply, unread);\n    if (H.question) return agdQuestionHtml(r, canReply, unread);\n    if (H.intake) return agdIntakeHtml(r, canReply, unread);"));
  const page = cuePage(), i = page.indexOf('  function agentDecisionEcho('), ctx = vm.createContext({});
  vm.runInContext(page.slice(i, page.indexOf('\n  }\n', i) + 4), ctx);
  const mm = { agd: { handover: { image_review: {} } } }, q = { agd: { handover: { question: {} } } };
  deq([ctx.agentDecisionEcho(mm, { text: 'Approve image review AS:pre:a1b2c3d4e5f60718:mm-check r1 round 1' }), ctx.agentDecisionEcho(mm, { text: 'Please make it brighter' }),
    ctx.agentDecisionEcho(q, { text: 'Answer AS:x:y:q1 r1: Event I' }), ctx.agentDecisionEcho({ agd: { handover: { project_inquiry: {} } } }, { text: 'Reject intake' }),
    ctx.agentDecisionEcho({ agd: { handover: {} } }, { text: 'Answer AS:x:y:q1 r1: Event I' })], [true, false, true, true, false], 'a tap on these cards is not repeated as a chat bubble; a typed reply still shows');
});

test('P1C16 every label on the new cards is the shared pill, tables centre their headers and the value column, and the page parts still join', () => {
  const P = p1Page(), all = [P.agdImageReviewHtml(p1Card({ image_review: p1First }), true, false), P.agdImageReviewHtml(p1Card({ image_review: P1.imageReviewStopped }), true, false),
    P.agdQuestionHtml(p1Card({ question: P1.questionText }), true, false), P.agdQuestionHtml(p1Card({ question: P1.questionCase }), true, false)].join('');
  const labels = all.replace(/<style>[\s\S]*?<\/style>/g, '').match(/<span class="[^"]*">(Waiting for you|Stopped|Approved|Answered)<\/span>/g) || [];
  assert.ok(labels.length >= 4 && labels.every(x => /^<span class="tag( warn| good| crit)?">/.test(x)), labels.join(' '));
  assert.ok(/\.cue-r1-inquiry \.mm-find th\{text-align:center;vertical-align:middle;/.test(all) && /\.cue-r1-inquiry \.mm-find td\.c\{text-align:center\}/.test(all) && /\.cue-r1-inquiry \.mm-find td\{vertical-align:middle;/.test(all));
  assert.ok(/\.card\.cue-r1-inquiry\.cue-mm,\.card\.cue-r1-inquiry\.cue-q\{border-inline-start:4px solid #281249\}/.test(all), 'purple side line, same as the header');
  const evil = P.agdQuestionHtml(p1Card({ question: Object.assign({}, P1.questionText, { question: '<script>alert(1)</script>', source: '<img onerror=x>' }) }), true, false).replace(/<style>[\s\S]*?<\/style>/g, '');
  assert.ok(!/<script|<img/i.test(evil) && evil.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'text from an agent is escaped');
  const bad = { measurement: '<i>m</i>', value: '<b>6</b>', unit: '<u>m</u>', source: '<s>src</s>' };
  const evil2 = p1Body(P.agdImageReviewHtml(p1Card({ image_review: Object.assign({}, p1First, { findings: [bad, { measurement: 'x', gap: '<em>g</em>' }], mm_case: '<q>c</q>', gaps_note: '<p>n</p>' }) }), true, false));
  assert.ok(!/<(i|u|s|em|q|p)>|<b>6/.test(evil2) &&evil2.includes('&lt;b&gt;6&lt;/b&gt; &lt;u&gt;m&lt;/u&gt;') && evil2.includes('Gap: &lt;em&gt;g&lt;/em&gt;'), 'findings are escaped cell by cell');
  const dir = path.join(__dirname, '..', 'src'), index = fs.readFileSync(path.join(dir, 'Index.html'), 'utf8'), body = index.slice(index.indexOf('<script>'));
  const parts = [...body.matchAll(/cueInclude_\('([A-Za-z0-9]+)'\)/g)].map(m => fs.readFileSync(path.join(dir, m[1] + '.html'), 'utf8').replace(/\n$/, ''));
  assert.doesNotThrow(() => new vm.Script(parts.join('')), 'the parts parse with no line break between them');
  assert.ok(parts.join('').includes('function agdImageReviewHtml(') && parts.join('').includes('function agdQuestionHtml(') && parts.join('').includes('function agdSure('), 'and the joined script holds the new cards');
});
