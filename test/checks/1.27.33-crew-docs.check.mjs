// Cloud check for Cue 1.27.33 crew docs (the PC check list canvas-integration/checks/cue-1.27.33-crew-docs-pc-check.md, steps 1 to
// 14), on the Canvas test project in config.json. Unlike the PC check it also presses Send: the test crew's emails are Kiko's own
// aliases, so the email lands in Kiko's inbox. Crew: One (email, registered), Two (email, not registered), Three (no email).
const ESC = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default {
  name: '1.27.33 crew docs (generate FSAs and ARs, make, send)',
  steps: [
    { title: 'Ask for the FSAs: Cue gets the list from Canvas', run: async h => {
      await h.say('generate FSAs for ' + h.config.project_name);
      await h.see('Started a thread for it.');
      await h.tap(new RegExp('^\\s*FSAs for ' + ESC(h.config.project_name)));   // a thread's name opens it
      await h.see(new RegExp('Getting the FSAs list for ' + ESC(h.config.project_name) + ' from Canvas'));
    } },
    { title: 'The card lists the crew, ready to make, with nothing ticked', run: async h => {
      await h.see(/\d+ FSAs? ready to make for .+\. Tick the ones you want and press Make\./, 120000);
      await h.see('Freelancer service agreements');
      const boxes = await h.boxes('data-amk');
      if (!boxes.length) throw new Error('no tick boxes on the card');
      if (boxes.some(b => b.checked)) throw new Error('something was already ticked: ' + boxes.filter(b => b.checked).map(b => b.value).join(', '));
      await h.see(/0 ticked of \d+/); await h.see('Tick all'); await h.see('Untick all');
    }, stopOnFail: false },
    { title: 'A crew member with no email is greyed out and cannot be ticked', run: async h => {
      const three = h.config.crew.find(c => !c.email);
      await h.see(three.name); await h.see('No email on file');
      const off = (await h.boxes('data-amk')).filter(b => b.disabled);
      if (!off.length) throw new Error(three.name + ' can be ticked');
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
    { title: 'Tick one name and press Make: Canvas makes 1 FSA', run: async h => {
      const one = h.config.crew.find(c => c.email && c.registered);
      await h.tap('Untick all');
      await h.tick(one.name);
      await h.see(/1 ticked of \d+/);
      await h.tap(/^\s*Make ticked/);
      await h.see(/Canvas is making 1 FSA for .+\. I will tell you when they are done\./, 120000);
    } },
    { title: 'Generating, then "1 file done" and the email draft', run: async h => {
      await h.see(/1 file done\./, 300000);
      await h.see('Do you want me to send these files?');
      await h.see(/Please sign your Freelancer Service Agreement/);
      await h.see('Open Canvas');
    } },
    { title: 'Edit changes only the draft; nothing is sent', run: async h => {
      await h.tap('Edit');
      await h.fill('textarea[data-say^="ar-intro-"]', 'Cloud check: please sign when you can. Thank you!');
      await h.tap('Done editing');
      await h.see('Cloud check: please sign when you can. Thank you!', 15000);
      await h.notSee(/Sent \d+ FSA/);
    } },
    { title: 'Send later at a time 2 hours away, then cancel it straight away', run: async h => {
      await h.tap('Send later');
      const at = new Date(Date.now() + 2 * 3600e3 + 8 * 3600e3).toISOString().slice(0, 16);   // Manila time for the datetime box
      await h.fill('input[type=datetime-local]', at);
      await h.tap('Schedule');
      await h.see(/go out at/, 60000);
      await h.tap('Cancel the later send');
      await h.see('Do you want me to send these files?', 60000);
    } },
    { title: 'Send: Canvas emails the FSA to the test crew (Kiko\'s alias)', run: async h => {
      await h.tap('Send');
      await h.see('Send 1 email now?', 15000); await h.see('Sent emails cannot be called back.');
      await h.confirm();
      await h.see(/Sent 1 FSA for /, 180000);
    } },
    { title: 'ARs: the same command lists AR rows (no AR is made)', run: async h => {
      await h.say('generate ARs for ' + h.config.project_name);
      await h.see('Started a thread for it.');
      await h.tap(new RegExp('^\\s*ARs for ' + ESC(h.config.project_name)));
      await h.see(new RegExp('Getting the ARs list for ' + ESC(h.config.project_name) + ' from Canvas'));
      await h.see('Acknowledgement receipts', 120000);
      await h.see(/ARs? ready to make for|no paid suppliers, talents or freelancers/, 120000);
    } }
  ]
};
