// Part of test/cue.test.js. Feature: PHASE1-CARDS-2026-11-25 (Project Intake, Sub Process 1). Kiko approved the mockups on
// 25 Nov 2026 and said "go" to the build in the Project Registration thread. Four pieces: the image review card (one design for
// both Multimedia loops), Multimedia findings and the "Are you sure...?" window on the Project Intake Request card ("lets have a
// notification window instead. Saying "Are you sure..." Yes | No", then "1. Yes. All Cards"), the shared "Question for you" card
// ("a totally different Questions for you card? reusable by everyone") and the registered action note ("Sure. but not as a label
// as an action note"). Sample data: test/fixtures/phase1-cards.json.
const P1 = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'phase1-cards.json'), 'utf8'));
const p1Src = f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
const p1First = Object.assign({}, P1.imageReviewFirst, { source: P1.source, images: P1.images, findings: P1.findings1 });
const p1Upd = (n, agent, ref, handover, o = {}) => agdUpd(n, Object.assign({ agent, item: ref, subject: ref, body: ref, recipient: 'Kiko', reason: 'Waiting for approval',
  handover: Object.assign({ handover_ref: ref, summary: ref, next_owner: 'Kiko', state: 'Waiting for approval' }, handover) }, o));

/* ---------- what Cue keeps from Canvas ---------- */
test('P1C1 an image review, a question and Multimedia findings are kept as sent; a malformed one is dropped', () => {
  const t = sandbox(), H = t.ctx.cueAgdHand_;
  const ir = H({ image_review: p1First }).image_review;
  deq([ir.status, ir.request_key, ir.revision, ir.loop, ir.mm_case, ir.round, ir.image_version, ir.source.subject, ir.images.length, ir.findings.length],
    ['waiting', 'AS:pre:a1b2c3d4e5f60718:mm-check', 'r1', 'pre_registration', 'Fabrication I', 1, 1, P1.source.subject, 3, 6]);
  deq(ir.findings[4], { measurement: 'Counter height', value: '', unit: '', source: '', gap: 'not on the diagram or in the email' });
  deq(ir.findings[0], { measurement: 'Booth footprint', value: '6 × 3', unit: 'm', source: 'Diagram, page 1', gap: '' });
  deq([H({ image_review: { status: 'waiting', round: 1 } }).image_review, H({ image_review: Object.assign({}, p1First, { round: 0 }) }).image_review, H({}).image_review], [null, null, null]);
  const q = H({ question: P1.questionCase }).question;
  deq([q.request_key, q.question, q.options.length, q.options[1].value, q.waits], ['AS:pre:a1b2c3d4e5f60718:mm-check', 'Which Multimedia case is this inquiry?', 4, 'Fabrication II', "Multimedia's check of the client's files"]);
  deq([H({ question: { question: 'No key?' } }).question, H({ question: { request_key: 'AS:x:y:q1' } }).question], [null, null]);
  const mm = t.ctx.cueAgdProjectInquiry_(Object.assign({}, P1.inquiry, { multimedia: Object.assign({}, P1.inquiry.multimedia, { findings: P1.findings2 }) })).multimedia;
  deq([mm.mm_case, mm.round, mm.image_version, mm.review_card_id, mm.findings.length, mm.findings[5].gap], ['Fabrication I', 2, 2, 'DRF-0052', 6, 'the email says "shelves", no number']);
  assert.strictEqual(t.ctx.cueAgdProjectInquiry_(P1.inquiry).source_subject, P1.inquiry.source_subject, 'the rest of the inquiry is unchanged');
  assert.strictEqual(t.ctx.cueAgdProjectInquiry_(Object.assign({}, P1.inquiry, { multimedia: null })).multimedia, null);
});

test('P1C2 the registered action note lands on the Project Intake Request card it belongs to; no second card and no second alert', () => {
  const review = p1Upd(51, 'AS', 'Project Intake Request 2d55a58c', { project_inquiry: P1.inquiry });
  const done = p1Upd(57, 'AS', 'Registered 2d55a58c', { summary: P1.registered, project_inquiry: Object.assign({}, P1.inquiry, { stage: 'register', can_register: false }) });
  const other = p1Upd(49, 'AS', 'Project Intake Request 9f00aa11', { project_inquiry: Object.assign({}, P1.inquiry, { handoff_key: 'EI:19ab12cd34ef5a99', card_version: '9f00aa11' }) });
  const two = sandbox({ bridgeFn: b => b.action === 'agent_drafts' ? { drafts: [review, other] } : undefined });   // the other inquiry's card is the newer one
  delete two.props.CUE_AGD_STATE; two.ctx.cueAgdTick_(); two.ctx.cueAgdSync_([other, review, done]);
  deq(two.tabs.Requests.rows.slice(1).map(r => { try { return JSON.parse(r.slice(10).join('')); } catch (e) { return null; } }).filter(s => s && s.kind === 'agentdraft')
    .map(s => [s.agd.draft_id, s.agd.action_note || '']).sort(), [['DRF-0049', ''], ['DRF-0051', P1.registered]], 'only the card of the same inquiry gets the note');
  const drafts = [review], t = sandbox({ bridgeFn: b => b.action === 'agent_drafts' ? { drafts } : undefined });
  delete t.props.CUE_AGD_STATE; t.ctx.cueAgdTick_();
  const cards = () => t.tabs.Requests.rows.slice(1).map(r => { try { return JSON.parse(r.slice(10).join('')); } catch (e) { return null; } }).filter(s => s && s.kind === 'agentdraft');
  deq([cards().length, cards()[0].agd.action_note || ''], [1, '']);
  const chat0 = t.tabs.Chat.rows.length;
  assert.strictEqual(t.ctx.cueAgdSync_([review, done]), 0, 'no card is added');
  deq([cards().length, cards()[0].agd.action_note], [1, P1.registered]);
  assert.strictEqual(t.tabs.Chat.rows.length, chat0, 'no chat line for the note');
  t.ctx.cueAgdSync_([review, done]);
  deq([cards().length, cards()[0].agd.action_note], [1, P1.registered], 'a second read changes nothing');
  assert.strictEqual(t.ctx.cueAgdView_(cards()[0]).action_note, P1.registered, 'the page gets the note');
  // A register-stage update with no card to land on is still shown as its own card, as before.
  const lone = sandbox({ bridgeFn: b => b.action === 'agent_drafts' ? { drafts: [done] } : undefined });
  delete lone.props.CUE_AGD_STATE; assert.strictEqual(lone.ctx.cueAgdTick_(), 1);
});

test('P1C3 pictures on an image review card are read from the card\'s own email, the same way as on the intake card', () => {
  const src = p1Src('CueAgentDrafts.gs'), f = src.slice(src.indexOf('function cueAgdInquiryImage('), src.indexOf('function cueAgdDecide('));
  assert.ok(/cueOwner_\(\);/.test(f), 'owner only');
  assert.ok(/handover\.project_inquiry \|\| cueAgdReviewMail_\(/.test(f), 'the image review card is read through the same checks');
  const t = sandbox(), m = t.ctx.cueAgdReviewMail_(t.ctx.cueAgdHand_({ image_review: p1First }).image_review);
  deq([m.source_channel, m.source_message_id, m.source_files.map(x => x.name)], ['Email', '19ab12cd34ef5a01', P1.images.map(x => x.name)]);
  assert.strictEqual(t.ctx.cueAgdReviewMail_(t.ctx.cueAgdHand_({ image_review: Object.assign({}, P1.imageReviewSecond) }).image_review), null, 'a card with Drive files has no email to read');
});

/* ---------- the page: the cards drawn from sample data ---------- */
// The card code from the joined page (everything from the intake card's state to the update card), run with the page's own esc and agdLabel.
function p1Page() {
  const page = cuePage(), a = page.indexOf('  var agdInquiryChecking = {};'), b = page.indexOf('  function agdUpdHtml(r) {');
  assert.ok(a > 0 && b > a, 'found the card code');
  const line = s => { const i = page.indexOf(s); return page.slice(i, page.indexOf('\n', i)); };
  const ctx = vm.createContext({ document: { addEventListener() {}, getElementById() { return null; } }, window: {}, state: { requests: [] }, CLOSED: { Done: 1, Rejected: 1, Closed: 1 }, call() {}, render() {} });
  vm.runInContext(line('  function esc(v) {') + '\n' + line('  function agdLabel(v) {') + '\n' + page.slice(a, b), ctx);
  return ctx;
}
const p1Card = (handover, o = {}) => Object.assign({ id: 'cue-p1-1', status: 'Needs you', agd: Object.assign({ draft_id: 'DRF-0052', agent: 'MM', type: 'update', status: 'Unread', replies: [], handover }, o.agd || {}) }, o.r || {});
const p1Body = h => h.replace(/<style>[\s\S]*?<\/style>/g, '');   // the card without its style text
const p1Text = h => p1Body(h).replace(/<[^>]+>/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

test('P1C4 image review, first loop, waiting: email facts, revision cell, pictures, findings with gaps, comment box, two buttons', () => {
  const mail = { agd: { inquiry_mail_url: 'https://mail.google.com/mail/?authuser=kiko%40example.com#all/19ab12cd34ef5a01' } };   // as cueAgdView_ builds it from the card's own email
  const P = p1Page(), h = P.agdImageReviewHtml(p1Card({ image_review: p1First }, mail), true, false), t = p1Text(h);
  assert.ok(/<div class="card cue-r1-inquiry cue-mm" data-card="cue-p1-1"><header class="cue-r1-head"><h2>Image review<\/h2><span class="tag warn">Waiting for you<\/span><\/header>/.test(h), 'title left, status label upper right, shared pill');
  ['Email subject', 'Sender', 'Received', 'Multimedia case', 'Fabrication I', 'Revision', 'Round 1 · image version 1', 'Original images attached', 'Tap a picture to see it larger. Made from: the original email, 3 attachments',
    "Multimedia's findings", 'Measurement', 'Value', 'Where it came from', '6 × 3 m', 'Not given', 'Gap: not on the diagram or in the email', '2 gaps: counter height, number of shelves.',
    'Comments for Multimedia', '(needed to send back)'].forEach(x => assert.ok(t.includes(x), x));
  assert.ok(!/Project<\/b>|Requirement<\/b>|Made with/.test(h), 'no project yet, and nothing was made before registration');
  assert.strictEqual((h.match(/class="cue-r1-thumb"/g) || []).length, 3, 'three pictures, each opens larger');
  assert.strictEqual((h.match(/<tr class="gap">/g) || []).length, 2);
  assert.ok(/<button class="btn" data-act="agd-mm" data-mm="back" data-id="cue-p1-1" disabled>Send back with comments<\/button><button class="btn cue-r1-primary" data-act="agd-mm" data-mm="approve" data-id="cue-p1-1">Approve<\/button>/.test(h), 'Send back is locked until a comment; Approve is the one primary button, last');
  assert.ok(!/cue-r1-saved|mm-rounds/.test(p1Body(h)), 'nothing saved and no earlier round yet');
  assert.ok(!/<button[^>]*data-act="agd-mm"/.test(P.agdImageReviewHtml(p1Card({ image_review: p1First }), false, false)), 'no buttons when he cannot reply');
  // From the independent consistency check, 25 Nov 2026: while the answer travels the card says so, and a picture Cue cannot show still opens.
  const going = P.agdImageReviewHtml(p1Card({ image_review: p1First }, { r: { status: 'Sending' } }), true, false);
  assert.ok(/<p class="small muted">Passing it to Canvas…<\/p>/.test(going) && !/data-act="agd-mm"/.test(going), 'the same line the other agent cards show');
  assert.ok(/<p class="small muted">Passing it to Canvas…<\/p>/.test(P.agdQuestionHtml(p1Card({ question: P1.questionCase }, { r: { status: 'Sending' } }), true, false)));
  P.agdInquiryPics['cue-p1-1|0'] = 'none';
  assert.ok(p1Body(P.agdImageReviewHtml(p1Card({ image_review: p1First }, mail), true, false)).includes('<li class="cue-r1-file"><a href="https://mail.google.com/mail/?authuser=kiko%40example.com#all/19ab12cd34ef5a01" target="_blank" rel="noopener">KapeIsla_booth_diagram_p1.png</a></li>'));
  assert.ok(/\.cue-r1-inquiry textarea:disabled\{opacity:1;/.test(going), 'a locked answer stays readable, like the intake card\'s saved fields');
});

test('P1C5 image review after an answer: sent back shows the comment and no buttons; approved shows Saved with Reopen and where it went', () => {
  const P = p1Page(), key = p1First.request_key;
  const back = P.agdImageReviewHtml(p1Card({ image_review: p1First }, { agd: { status: 'Replied', replies: [{ at: '2026-11-25 10:05', text: P.agdMmNote('back', p1First, 'Counter height is missing.') }] } }), true, false);
  assert.ok(/<span class="tag">Sent back, round 2 pending<\/span>/.test(back) && !/data-act="agd-mm"/.test(back));
  assert.ok(/<details class="mm-rounds" open><summary>Earlier rounds and your comments<\/summary>/.test(back) && /<div class="mm-quote">Counter height is missing\.<\/div>/.test(back));
  assert.ok(/<p class="cue-r1-saved" role="status"><span>Saved<\/span><\/p>/.test(back) && p1Text(back).includes('Multimedia is revising. This card updates when round 2 arrives.'));
  const done = Object.assign({}, p1First, { status: 'approved', round: 2, image_version: 2, findings: P1.findings2, gaps_note: '1 gap left: number of shelves.',
    earlier_rounds: [{ n: 1, at: '25 Nov, 10:05 AM', answer: 'sent_back', comment: 'Counter height is missing.' }] });
  const ok = P.agdImageReviewHtml(p1Card({ image_review: done }, { r: { status: 'Done' }, agd: { status: 'Replied', replies: [{ text: 'Approve image review ' + key + ' r1 round 2' }] } }), true, false);
  assert.ok(/<span class="tag good">Approved<\/span>/.test(ok) && !/data-act="agd-mm"/.test(ok));
  assert.ok(/<p class="cue-r1-saved" role="status"><span>Saved<\/span><button type="button" data-act="reopen" data-id="cue-p1-1">Reopen<\/button><\/p>/.test(ok));
  ['Round 2 · image version 2', 'Round 1 · image version 1 · 25 Nov, 10:05 AM · Sent back by you', 'Round 2 · image version 2 · Approved by you', 'Findings went to Account Specialist. The Project Intake Request card follows.'].forEach(x => assert.ok(p1Text(ok).includes(x), x));
  const old = P.agdImageReviewHtml(p1Card({ image_review: Object.assign({}, done, { answered_on_round: 1 }) }), true, false);
  assert.ok(/<p class="small mm-old"><b>You approved on the round 1 card\.<\/b> Round 2 had already arrived, so your approval counts for round 2, shown here\.<\/p>/.test(old));
});

test('P1C6 image review, second loop: project and requirement replace the email facts, Made with shows, Drive pictures; Stopped asks which file to use', () => {
  const P = p1Page(), h = P.agdImageReviewHtml(p1Card({ image_review: P1.imageReviewSecond }), true, false), t = p1Text(h);
  ['Project', 'BSE-2027-0031 · Kape Isla Booth - Manila Coffee Festival 2027', 'Requirement', 'BSE-2027-0031-R02 · Serving counter', 'Fabrication II', 'Round 2 · image version 2', 'Made with', 'Blender',
    "Multimedia's booth draft", 'Saved as new files beside the client\'s diagram. The diagram itself is unchanged.', 'Your comment, round 1'].forEach(x => assert.ok(t.includes(x), x));
  assert.ok(!/Email subject|Sender<\/b>/.test(h), 'no email details once it is a project');
  assert.ok(h.includes('src="https://drive.google.com/thumbnail?id=1AbCdEfGhIjKlMnOpQrStUvWxYz012345&amp;sz=w320"') && h.includes('<a href="https://drive.google.com/file/d/1QwErTyUiOpAsDfGhJkLzXcVbNm135790/view" target="_blank" rel="noopener">KapeIsla_booth_diagram.pdf, revision 1</a>'));
  assert.ok(p1Text(P.agdImageReviewHtml(p1Card({ image_review: Object.assign({}, P1.imageReviewSecond, { status: 'approved' }) }), true, false)).includes('Approved work went to Account Specialist for this requirement.'));
  // Kiko 25 Nov 2026, on a picture that showed as a broken icon: "its a broken image. if image was made from blender - embed it".
  // When Drive's small picture does not load, Cue reads the file itself and shows it in the card; only if that fails too is it a link.
  assert.ok(h.includes('sz=w320" referrerpolicy="no-referrer" onerror="cueMmThumb(this,\'1AbCdEfGhIjKlMnOpQrStUvWxYz012345\',\'cue-p1-1\',0)">'), 'a Drive picture that fails to load is fetched another way');
  const im = { src: 'drive', onerror: 1 }; let drew = 0; P.render = () => { drew++; };
  P.imgData = (fid, ok) => ok('data:image/png;base64,AAAA'); P.window.cueMmThumb(im, '1AbCdEfGhIjKlMnOpQrStUvWxYz012345', 'cue-p1-1', 0);
  deq([im.src, im.onerror, drew], ['data:image/png;base64,AAAA', null, 0], 'the picture itself is put in the card');
  P.imgData = (fid, ok, bad) => bad(); P.window.cueMmThumb({ src: 'drive' }, '1ZyXwVuTsRqPoNmLkJiHgFeDcBa987654', 'cue-p1-1', 1);
  assert.strictEqual(drew, 1);
  const lost = p1Body(P.agdImageReviewHtml(p1Card({ image_review: P1.imageReviewSecond }), true, false));
  assert.ok(lost.includes('<li class="cue-r1-file"><a href="https://drive.google.com/file/d/1ZyXwVuTsRqPoNmLkJiHgFeDcBa987654/view" target="_blank" rel="noopener">counter_reference.jpg (client)</a></li>') && (lost.match(/class="cue-r1-thumb"/g) || []).length === 1, 'never a broken picture: the one that cannot be read becomes a link');
  const s = P.agdImageReviewHtml(p1Card({ image_review: P1.imageReviewStopped }), true, false);
  assert.ok(/<span class="tag crit">Stopped<\/span>/.test(s) && /What changed/.test(s) && /Which file is the design source\?/.test(s));
  assert.ok(/<input type="radio" name="src-cue-p1-1" value="new">/.test(s) && /<input type="radio" name="src-cue-p1-1" value="keep">/.test(s));
  assert.ok(/<button class="btn cue-r1-primary" data-act="agd-mm" data-mm="source" data-id="cue-p1-1" disabled>Send answer<\/button>/.test(s) && !/data-mm="approve"/.test(s));
});

test('P1C7 the answers sent for an image review name the request, its revision and the round shown; send back needs a comment', () => {
  const P = p1Page(), k = 'AS:pre:a1b2c3d4e5f60718:mm-check';
  deq([P.agdMmNote('approve', p1First), P.agdMmNote('back', p1First, '  Counter height is missing.  '), P.agdMmNote('back', p1First, '  '), P.agdMmNote('source', p1First, 'keep'), P.agdMmNote('source', p1First, 'other')],
    ['Approve image review ' + k + ' r1 round 1', 'Send back image review ' + k + ' r1 round 1: Counter height is missing.', '', 'Design source ' + k + ' r1: keep', '']);
});

/* ---------- the live Project Intake Request card ---------- */
const p1Inq = (o = {}) => Object.assign({}, P1.inquiry, o);
const p1IntakeCard = (inq, o = {}) => p1Card({ project_inquiry: inq }, { agd: Object.assign({ agent: 'AS', draft_id: 'DRF-0051' }, o.agd || {}), r: o.r });
test('P1C8 the intake card shows Multimedia findings above the original message; without findings the card is what it was', () => {
  const P = p1Page(), withMm = p1Inq({ multimedia: Object.assign({}, P1.inquiry.multimedia, { findings: P1.findings2 }) });
  const plain = P.agdInquiryHtml(p1IntakeCard(p1Inq({ multimedia: null })), true, false), h = P.agdInquiryHtml(p1IntakeCard(withMm), true, false);
  assert.ok(!/cue-mmfind/.test(plain.replace(/<style>[\s\S]*?<\/style>/g, '')), 'no block without findings');
  const block = h.slice(h.indexOf('<details open class="cue-mmfind">'), h.indexOf('<details open class="cue-r1-source">'));
  assert.ok(block.length > 100, 'the block sits just above the original message');
  assert.strictEqual(h.replace(block, '').replace(/<style>[\s\S]*?<\/style>/g, ''), plain.replace(/<style>[\s\S]*?<\/style>/g, ''), 'nothing else on the card changes');
  ['Multimedia findings', 'Case: Fabrication I', "Checked: the client's own files, unchanged", 'Approved by you: 25 Nov, 10:52 AM (round 2, image version 2)', 'Measurement', '0.95 m', 'Gap: number of shelves is not given.'].forEach(x => assert.ok(p1Text(block).includes(x), x));
  assert.ok(/<button type="button" class="cue-mm-open" data-agd-goto="DRF-0052">Open the image review card<\/button>/.test(block));
  const settled = P.agdInquiryHtml(p1IntakeCard(withMm, { r: { status: 'Done' }, agd: { status: 'Replied', replies: [{ text: 'Confirm new project 2d55a58c' }] } }), true, false);
  assert.ok(/class="cue-mmfind"/.test(settled) && /<div class="actions"><p class="cue-r1-saved" role="status"><span>Saved<\/span><\/p><button type="button" class="btn ghost" data-act="reopen"/.test(settled)
    && settled.indexOf('class="cue-r1-source"') < settled.indexOf('class="cue-r1-saved"'), 'the findings stay readable after the decision');
});

test('P1C9 Approve and Reject on the intake card still carry the same decision texts, and now ask "Are you sure...?" first', () => {
  const P = p1Page(), h = P.agdInquiryHtml(p1IntakeCard(p1Inq()), true, false);
  assert.ok(h.includes('<button class="btn cue-r1-primary" data-act="agd-inquiry" data-id="cue-p1-1" data-choice="Confirm new project 2d55a58c">Approve</button><button class="btn" data-act="agd-inquiry" data-id="cue-p1-1" data-choice="Reject intake">Reject</button>'), 'the buttons and their decision texts are unchanged');
  deq([P.agdSureText('agd-inquiry', 'Confirm new project 2d55a58c'), P.agdSureText('agd-inquiry', 'Reject intake'), P.agdSureText('agd-inquiry', 'Use project S-31753672PA')],
    [['Are you sure you want to approve this project?', 'Account Specialist registers it in Canvas.'], ['Are you sure you want to reject this inquiry?', 'No project is registered.'], null]);
  const cards = p1Src('IndexCards.html'), a = cards.indexOf("if (act === 'agd-inquiry') {"), f = cards.slice(a, cards.indexOf("if (act === 'agd-rewrite')", a));
  assert.ok(!/data-armed|Confirm New Project/.test(cards), 'the second tap on the button is gone');
  assert.ok(f.includes("var sureText = agdSureText(act, choice);") && f.includes("if (sureText) return agdSure(sureText[0], sureText[1], inquirySend);"), 'Approve and Reject open the window; Yes carries on');
  assert.ok(f.includes("call('cueAgdDecide', [id, { decision: 'reply', note: choice }], inquiryRefresh, function (e) { inquiryRefresh(); alertErr(e, id); });"), 'the reply sent is the button\'s own decision text');
  assert.ok(f.includes("return alertErr(new Error('Save edits before confirming the project.'), id);") && f.includes("choice !== 'Confirm new project ' + inquiry.card_version"), 'the checks before Approve are kept');
  assert.ok(f.indexOf('Save edits before confirming') < f.indexOf('agdSure(sureText[0]'), 'unsaved edits are refused before the window opens');
});

test('P1C10 the "Are you sure...?" window: one dialog on the page body, No and Yes, No in focus, Yes runs the action once', () => {
  const P = p1Page(), made = [], shown = [];
  const el = () => ({ id: '', innerHTML: '', q: { textContent: '' }, p: { textContent: '' }, no: { focus() { shown.push('focus-no'); } }, open: false, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; },
    querySelector(s) { return s === 'h3' ? this.q : s === 'p' ? this.p : this.no; }, addEventListener(t, f) { this['on' + t] = f; }, showModal() { this.open = true; shown.push('modal'); }, close() { this.open = false; } });
  P.document.createElement = tag => { const d = el(); d.tag = tag; made.push(d); return d; };
  P.document.body = { appendChild(d) { d.onBody = true; } };
  P.document.getElementById = id => made.filter(d => d.id === id)[0] || null;
  let ran = 0;
  P.agdSure('Are you sure you want to reject this inquiry?', 'No project is registered.', () => { ran++; });
  const d = made[0];
  deq([made.length, d.tag, d.id, d.onBody, d.q.textContent, d.p.textContent, shown], [1, 'dialog', 'cue-sure', true, 'Are you sure you want to reject this inquiry?', 'No project is registered.', ['modal', 'focus-no']]);
  assert.ok(/<button type="button" data-sure="no">No<\/button><button type="button" class="sure-yes" data-sure="yes">Yes<\/button>/.test(d.innerHTML) && d.attrs['aria-labelledby'] === 'cue-sure-q' && /<h3 id="cue-sure-q">/.test(d.innerHTML), 'the dialog is named by its question');
  d.onclick({ target: { getAttribute: () => 'no' } }); deq([ran, d.open], [0, false], 'No closes and does nothing');
  P.agdSure('Are you sure you want to approve this project?', 'Account Specialist registers it in Canvas.', () => { ran++; });
  assert.strictEqual(made.length, 1, 'the same dialog is used again');
  d.onclick({ target: { getAttribute: () => 'yes' } }); d.onclick({ target: { getAttribute: () => 'yes' } });
  deq([ran, d.open], [1, false], 'Yes runs it once');
});

test('P1C11 after registration the intake card carries an action note, not a label and not a second card', () => {
  const P = p1Page(), reply = { agd: { status: 'Replied', action_note: P1.registered, replies: [{ text: 'Confirm new project 2d55a58c' }] }, r: { status: 'Done' } };
  const h = P.agdInquiryHtml(p1IntakeCard(p1Inq(), reply), true, false);
  assert.ok(h.includes('<p class="cue-r1-note"><b>Action note</b><span>Registered: S-2027BSE0031 · Kape Isla Booth - Manila Coffee Festival 2027. All eight folders checked.</span></p>'));
  assert.ok(!/class="tag[^"]*">Registered/.test(h), 'not a label');
  const b = p1Body(h);
  assert.ok(b.indexOf('cue-r1-saved') > 0 && b.indexOf('cue-r1-saved') < b.indexOf('cue-r1-note') && b.indexOf('cue-r1-note') < b.indexOf('cue-r1-source'), 'under Saved, above the original message');
  assert.ok(!/cue-r1-note/.test(P.agdInquiryHtml(p1IntakeCard(p1Inq()), true, false).replace(/<style>[\s\S]*?<\/style>/g, '')), 'no note before registration');
  assert.ok(!/cue-r1-note/.test(p1Body(P.agdInquiryHtml(p1IntakeCard(p1Inq(), { agd: { action_note: P1.registered } }), true, false))), 'and none while the card still waits for his decision');
});
