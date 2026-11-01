// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: part 2 of the message redesign
// (cue-message-redesign-spec.md, Kiko 31 Oct 2026): Kiko's revised chaser templates, "Full design, in the same thread", business days
// without Philippine holidays, C3 framing, and Emails waiting off.
test('CT1 a chaser goes as Kiko\'s template in the designed email: text and html, as a reply in the same thread, no AI call', () => {
  const t = rfqBox(); t.ctx.cueSweep(); const id = rfqBatch(t).id;
  assert.strictEqual(t.log.gpt.filter(g => g.text.format.name === 'chasers').length, 0, 'no AI call');
  t.at('2026-10-21', 9, 30); t.ctx.cueApprove(id, { send: false });
  const raw = String((t.log.replies || [])[0].payload);
  assert.ok(/multipart\/alternative/.test(raw) && /text\/plain/.test(raw) && /text\/html/.test(raw), 'text and html');
  assert.ok(/In-Reply-To: </.test(raw), 'a reply in the original thread');
  const html = Buffer.from((raw.match(/text\/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n([A-Za-z0-9+/=\r\n]+)/) || [])[1].replace(/\r\n/g, ''), 'base64').toString('utf8');
  assert.ok(/bgcolor="#CD5023"/.test(html) && /BLANK SPACE EVENTS/.test(html) && /Thanks!/.test(html), 'the supplier banner and Kiko\'s close');
});

test('CT2 Kiko\'s own edit goes as plain text, exactly as he typed it', () => {
  const t = rfqBox(); t.ctx.cueSweep(); const b = rfqBatch(t), key = b.batch.items.filter(i => !i.no_email)[0].key;
  t.at('2026-10-21', 9, 30); t.ctx.cueApprove(b.id, { send: false, bodies: { [key]: 'Hi, any update? Kiko' } });
  assert.ok((t.log.replies || []).some(r => !/text\/html/.test(String(r.payload))), 'the edited one has no html');
});

test('CT3 business days skip weekends and Philippine holidays; CUE_HOLIDAYS adds the proclaimed ones', () => {
  const t = sandbox();
  assert.strictEqual(t.ctx.cueAddWork_('2026-12-23', 1), '2026-12-28', 'Dec 24 and 25 are holidays, 26 and 27 the weekend');
  assert.strictEqual(t.ctx.cueWorkDays_('2026-11-27', '2026-12-01'), 1, 'Nov 30 Bonifacio Day does not count');
  const u = sandbox({ props: { CUE_HOLIDAYS: '2026-11-03' } });
  assert.strictEqual(u.ctx.cueAddWork_('2026-11-02', 1), '2026-11-04');
});

test('CT4 C3: the AI writes only the middle; the greeting, "Great to hear from you!", the closing line and the sign-off are Kiko\'s', () => {
  const t = sandbox(), k = t.ctx.cueKinds_().filter(x => x.kind === 'inbox')[0];
  assert.strictEqual(k.label, 'C3 Replies waiting on you'); deq(k.template({}), {}, 'no holding reply any more');
  const m = k.wrap({ who: 'Ana Reyes', subject: 'Venue for the gala' }, 'Yes, the 15th works for the walkthrough.');
  assert.strictEqual(m.subject, 'Re: Venue for the gala');
  assert.strictEqual(m.body, 'Hi Ana,\n\nGreat to hear from you! Yes, the 15th works for the walkthrough.\n\nAnything else you’d like us to work into the plan? Just reply here.\n\nThanks!\nKiko Dacanay\nBlank Space Events');
  assert.ok(/bgcolor="#559FEF"/.test(m.html), 'the client banner');
});

test('CT5 Emails waiting is dropped: Canvas\'s card gets on:false and no threads, while the project log still reads the inbox', () => {
  const now = Date.parse('2026-10-27T02:00:00Z');
  const t = maBox([{ id: 'z1', h: '1', msgs: [maMsg('Ana Reyes <ana@acme.example>', now - 3e6, ['INBOX'])] }]);
  t.ctx.cueNow_ = () => now; t.ctx.cueMaTick_();
  deq([t.files.F1.on, t.files.F1.threads], [false, []]);
  assert.ok(JSON.parse(t.props.CUE_PLOG_Q).some(l => l.email === 'ana@acme.example'), 'the project log still gets the email');
});

test('CT6 one "Threads" (Kiko 1 Nov): the pane header no longer repeats it, and the ☰ Threads badge counts waiting threads, not tasks', () => {
  const js = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'IndexThreads.html'), 'utf8');
  assert.ok(!/<span class="pname">Threads<\/span>/.test(js), 'no second "Threads" in the pane header');
  assert.ok(/function needThreadsN\(th\)/.test(js) && /\$\('needCount'\)\.textContent = nn;/.test(js), 'the badge uses the thread count');
});
