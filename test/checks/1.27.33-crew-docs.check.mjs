// Cloud check for Cue 1.27.33 crew docs (the PC check list canvas-integration/checks/cue-1.27.33-crew-docs-pc-check.md, steps 1 to
// 14), on the Canvas project in config.json. config.doc picks the document Make is tried on ("FSA" or "AR"); the other one is
// listed read-only at the end. The robot ticks the first name it may tick, makes that one file, then Edit, Send later and
// cancel. Send is pressed only when config.send is true (a project whose crew are all Kiko's own aliases); otherwise it
// finishes without sending, and check mode refuses any Canvas send anyway (CUE_CHECK_SEND_, Kiko 27 Oct 09:16Z).
const ESC = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const DOC = { FSA: { many: 'FSAs', label: 'Freelancer service agreements' }, AR: { many: 'ARs', label: 'Acknowledgement receipts' } };
const doc = h => (h.config.doc === 'AR' ? 'AR' : 'FSA'), other = h => (doc(h) === 'AR' ? 'FSA' : 'AR');
const open = async (h, d) => {
  await h.say('generate ' + DOC[d].many + ' for ' + h.config.project_name);
  await h.see('Started a thread for it.');
  await h.tap(new RegExp('^\\s*' + DOC[d].many + ' for ' + ESC(h.config.project_name)));   // a thread's name opens it
  await h.see(new RegExp('Getting the ' + DOC[d].many + ' list for ' + ESC(h.config.project_name) + ' from Canvas'));
};

export default {
  name: '1.27.33 crew docs (generate FSAs and ARs, make, send)',
  steps: [
    { title: 'Ask for the list: Cue gets it from Canvas', run: async h => { await open(h, doc(h)); } },
    { title: 'The card lists the names, ready to make, with nothing ticked', run: async h => {
      await h.see(new RegExp('\\d+ ' + doc(h) + 's? ready to make for .+\\. Tick the ones you want and press Make\\.'), 360000);   // AR lists take up to 5 minutes
      await h.see(DOC[doc(h)].label);
      const boxes = await h.boxes('data-amk');
      if (!boxes.some(b => !b.disabled)) throw new Error('Nothing left to make on ' + h.config.project_name + ': every ' + doc(h) + ' is already made. Put another past project (or doc) in test/checks/config.json.');
      if (boxes.some(b => b.checked)) throw new Error('something was already ticked: ' + boxes.filter(b => b.checked).map(b => b.value).join(', '));
      await h.see(/0 ticked of \d+/); await h.see('Tick all'); await h.see('Untick all');
    }, stopOnFail: false },
    { title: 'A name with no email on file is greyed out and cannot be ticked', run: async h => {
      const rows = await h.page().$$eval('input[data-amk]', els => els.map(e => ({ off: e.disabled, text: (e.closest('label, .row, div') || e).innerText })));
      const noMail = rows.filter(r => /No email on file/.test(r.text));
      if (noMail.some(r => !r.off)) throw new Error('a name with no email on file can be ticked');
    } },
    { title: 'Make with nothing ticked: a warning, nothing written', run: async h => {
      await h.tap('Untick all');
      const before = h.calls().filter(f => f === 'cueApprove').length;
      await h.tap(/^\s*Make ticked/);
      await h.see(/Tick at least one name (first|to make)\./, 15000);   // the page warns before it calls Cue; Cue's own check says "to make"
      if (h.calls().filter(f => f === 'cueApprove').length !== before) throw new Error('the page asked Cue to make something');
      const back = (await h.boxes('data-amk')).filter(b => b.checked);   // PC check step 4 (V81): ticks stay as Kiko left them
      if (back.length) throw new Error('ticks came back after the warning: ' + back.map(b => b.value).join(', '));
    }, stopOnFail: false },
    { title: 'Tick one name and press Make: Canvas makes 1 file', run: async h => {
      await h.tap('Untick all');
      const one = (await h.boxes('data-amk')).find(b => !b.disabled);
      await h.page().locator('input[data-amk]:not([disabled])').first().check();
      await h.see(/1 ticked of \d+/);
      await h.tap(/^\s*Make ticked/);
      await h.see(new RegExp('Canvas is making 1 ' + doc(h) + ' for .+\\. I will tell you when they are done\\.'), 120000);
      console.log('     made for: ' + one.value);
    } },
    { title: 'Generating, then "1 file done", and the email draft when the name can be emailed', run: async h => {
      // First real run (27 Oct 09:36Z): the line reads "1 file done for <project>." and Canvas may take minutes.
      await h.see(/1 file done for .+?\./, 900000);
      if (await h.has('None can be emailed yet')) { h.mail = false; return 'SKIP: this name cannot be emailed yet (no crew sign-in, or a Resource AR signed in Canvas), so there is no draft'; }
      h.mail = true;
      await h.see('Do you want me to send');
      await h.see(/Please sign your /);
      await h.see('Open Canvas');
    } },
    { title: 'Edit changes only the draft; nothing is sent', run: async h => {
      if (!h.mail) return 'SKIP: no draft to edit';
      await h.tap('Edit');
      await h.fill('textarea[data-say^="ar-intro-"]', 'Cloud check: please sign when you can. Thank you!');
      await h.tap('Done editing');
      await h.see('Cloud check: please sign when you can. Thank you!', 15000);
      await h.notSee(/Sent \d+ (FSA|AR)/);
    } },
    { title: 'Send later at a time 2 hours away, then cancel it straight away', run: async h => {
      if (!h.mail) return 'SKIP: nothing to send later';
      await h.tap('Send later');
      const at = new Date(Date.now() + 2 * 3600e3 + 8 * 3600e3).toISOString().slice(0, 16);   // Manila time for the datetime box
      await h.fill('input[type=datetime-local]', at);
      await h.tap('Schedule');
      await h.see(/go out at/, 60000);
      await h.tap('Cancel the later send');
      await h.see('Do you want me to send', 60000);
    } },
    { title: 'Send to the test crew, or finish without sending on a real project', run: async h => {
      if (h.config.send === true && h.mail) {
        await h.tap('Send');
        await h.see('Send 1 email now?', 15000); await h.see('Sent emails cannot be called back.');
        await h.confirm();
        await h.see(new RegExp('Sent 1 ' + doc(h) + ' for '), 180000);
        return;
      }
      await h.tap(/^\s*Finish( without sending)?\s*$/);
      await h.see(new RegExp('made 1 ' + doc(h)), 60000);
      await h.notSee(/emailed \d|Sent \d+ (FSA|AR)/);
    } },
    { title: 'The other document: the same command lists its rows (nothing made)', run: async h => {
      await open(h, other(h));
      await h.see(DOC[other(h)].label, 360000);
      await h.see(new RegExp(other(h) + 's? ready to make for|no paid suppliers, talents or freelancers|already made', 'i'), 360000);
    } }
  ]
};
