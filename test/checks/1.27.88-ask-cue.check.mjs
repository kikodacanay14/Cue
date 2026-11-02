// Cloud check for Ask Cue changes, Cue 1.27.84 to 1.27.88 (CanvasWorkspace docs/specs/ask-cue-changes-spec.md; Kiko 2 Nov 2026:
// "you do that. ive never been asked to do that and i wont"). Read only, through the check door: nothing is saved, no AI call,
// no mail is sent or marked read. The flows themselves (carry-over, email types, one chat per email, typed approve, locks, edit
// log) are covered by tests ACC1 to ACC12; this run proves the same code loads and reads Kiko's real data in Apps Script.
// No own config: the run uses config.json.
let nm = null, acc = {};

export default {
  name: '1.27.88 Ask Cue changes (read only)',
  steps: [
    { title: 'New mail still reads Kiko\'s inbox and filters it (project emails no longer dropped)', run: async h => {
      const r = await h.door('check_call', { fn: 'cueNmCheck', args: [] });
      if (!r.ok) throw new Error('cueNmCheck failed: ' + r.error);
      nm = r.result || {};
      if (!Array.isArray(nm.keep) || !Array.isArray(nm.skip)) throw new Error('No line lists came back');
    } },
    { title: 'Cue Admin › Triage: the email types and their settings load', run: async h => {
      const r = await h.door('check_call', { fn: 'cueAccCheck', args: [] });
      if (!r.ok) throw new Error('cueAccCheck failed: ' + r.error);
      acc = r.result || {};
      const t = (r.result && r.result.types) || [];
      if (t.length < 3) throw new Error('Expected the starting types, got ' + t.length);
      const set = (r.result && r.result.settings) || [];
      if (['Own chat', 'One line', 'Ignore'].some(s => set.indexOf(s) < 0)) throw new Error('Settings list is wrong: ' + set.join(', '));
    } },
    { title: 'Cue Admin › Edit log loads', run: async h => {
      if (!(acc.edits >= 0)) throw new Error('The Canvas edits log could not be read');
    } }
  ]
};
