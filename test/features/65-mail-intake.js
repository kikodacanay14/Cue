// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: MAIL-INTAKE (CueTriage.gs).
/* Kiko 29 Oct 2026 16:08Z: "does project intake in Cue can not read email subject, header and attached files?" after asking in words for an
 * intake from Ms Ruth Andres's email. A typed intake that names an email from someone now reads that email in Gmail. */
test('MI1 "run a project intake from the latest email from Ms Ruth Andres" reads that email in Gmail: headers, text and files, with Kiko\'s words as his note', () => {
  const t = sandbox({ inbox: INBOX });
  const ask = 'Moldex: find the latest email from Ms Ana Reyes in Gmail and run a project intake from it. The location is in the attached files.';
  deq([t.ctx.cueMailIntakeAsked_(ask), t.ctx.cueMailIntakeAsked_('intake from the email from ana@acme.example'), t.ctx.cueMailIntakeAsked_('find the latest email from Ana Reyes'),
    t.ctx.cueMailIntakeAsked_('add project Acme launch, 200 pax'), t.ctx.cueMailIntakeAsked_('Project Intake for Moldex get the email from Ms Ruth Andres'),
    t.ctx.cueMailIntakeAsked_('Project intake for Moldex from Ms Ruth Andres\'s email'), t.ctx.cueMailIntakeAsked_('run intake on Ruth Andres’ latest email')],
    ['Ana Reyes', 'ana@acme.example', '', '', 'Ruth Andres', 'Ruth Andres', 'Ruth Andres']);
  const out = t.ctx.cueSend(ask, [], '');
  assert.ok(/from:\(Ana Reyes\) -in:sent/.test(t.log.inboxQ), t.log.inboxQ);
  const s = t.state(out.request_id);
  assert.ok(/^New project intake from email\.\nFrom: .*\n(To: .*\n)?(Cc: .*\n)?(Date: .*\n)?Subject: .*\nKiko adds: Moldex: find the latest email/.test(s.text), s.text.slice(0, 300));
  assert.ok(s.files.length >= 1 && s.source && s.source.thread_id, 'the email\'s files and thread go with it');
});
test('MI2 no email from that person: Cue says so in one line and starts nothing', () => {
  const t = sandbox({ inbox: [] }), out = t.ctx.cueSend('run intake from the email from Mr Nobody Here', [], '');
  assert.ok(out.chat && !out.request_id); assert.ok(t.tabs.Chat.rows.some(r => /I found no email from Nobody Here in your Gmail/.test(r[2])));
});
