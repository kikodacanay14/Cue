// Cloud check for the Cue Help answers card (CueHelp.gs). Read only: Cue reads the Live rows of Canvas's "Help Q&A" tab through
// the bridge (help_qa, a read) and matches the question in code. The check never taps Add as Draft; help_qa_add would be refused
// anyway, since it names no project and check mode stops every write that does not name the test project. Nothing is sent.
export default {
  name: 'Help answers (read only)',
  steps: [
    { title: 'A crew pay question gets the pay answer from the Help Q&A list, with no AI call', run: async h => {
      await h.say('help crew: kelan po ba ang sahod namin?');
      await h.see(/Best match: .*\(CRW-W-07\)\. No AI call\./, 120000);
      await h.tap(/^\s*Help · kelan po ba ang sahod namin\?/);   // a thread's name opens it
      await h.see(/Copy reply/, 60000);
      await h.see(/matched by code, no AI call/, 60000);
    } },
    { title: 'A question the list has no answer for says so and offers Add as Draft', run: async h => {
      await h.say('help supplier: can we park our truck at the venue overnight?');
      await h.see(/Help · can we park our truck at the venue overnight\?/, 120000);
      await h.tap(/^\s*Help · can we park our truck/);
      await h.see(/no answer for this yet/, 60000);
      await h.see(/Add as Draft/, 60000);
    } }
  ]
};
