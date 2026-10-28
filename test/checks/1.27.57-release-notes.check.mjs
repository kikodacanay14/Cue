// Cloud check for Cue 1.27.57 daily release notes (CueRelnotes.gs). Through the check door, cueRnCheck starts today's notes from two
// made-up releases, so the real Release Log is never read or marked. The robot opens the thread and checks the card. It edits the
// text, taps Post at 8 PM (which only waits for 8 PM), and then Skip today. A check's notes never reach Canvas: check mode refuses ann_post,
// because it names no test project, and the 8 PM tick skips a check's tasks. The only write is the check's own task rows, and
// check_finish closes them. One Claude call writes the lines.
export default {
  name: '1.27.57 release notes (card, edit, Post at 8 PM, Skip today)',
  steps: [
    { title: 'Start check notes from two made-up releases', run: async h => {
      const r = await h.door('check_call', { fn: 'cueRnCheck', args: [] });
      if (!r.ok) throw new Error('cueRnCheck failed: ' + r.error);
      if (!r.result || !r.result.request_id) throw new Error('No notes started: ' + JSON.stringify(r.result));
      h.rnId = r.result.request_id;
      const v = await h.door('check_call', { fn: 'cueRun', args: [h.rnId] });   // the one Claude call, as the 5-minute tick would run it
      if (!v.ok) throw new Error('cueRun failed: ' + v.error);
      if (v.result.status !== 'Needs you') throw new Error('Expected the card to wait for Kiko, got ' + v.result.status + ' ' + (v.result.error || ''));
      const m = String(v.result.rn.message || '');
      if (!/^(New|Fixed)\n• (Canvas|Cue): /.test(m) || !/Questions\? Ask in Cue\.$/.test(m)) throw new Error('The notes do not read New / Fixed by app: ' + JSON.stringify(m));
    } },
    { title: 'The thread opens on the card: title, text, who it goes to, Post at 8 PM and Skip today', run: async h => {
      await h.tap('Release notes', { timeout: 120000 });   // a thread's name opens it
      await h.see(/Release notes · \d{4}-\d{2}-\d{2}/i);   // the label is upper-cased by CSS
      await h.see('To: staff in Canvas Announcements (Business Lead, Manager, Specialist). Not emailed.');
      await h.see('Ask people to confirm they read it');
      await h.see(/From the release log: 2 releases/);
      await h.see(/Post (at 8 PM|now)/); await h.see('Skip today');
    } },
    { title: 'Edit the text, then Post at 8 PM only waits for 8 PM; nothing reaches Canvas', run: async h => {
      await h.fill('textarea[data-rn-msg]', 'New\n• Canvas: Check line edited by the robot.\n\nQuestions? Ask in Cue.');
      if (await h.has('Post now')) return;   // after 8 PM, Post posts at once, and a check may not post: the next step skips it
      await h.tap('Post at 8 PM');
      await h.see('Posts at 8:00 PM.', 60000);
      await h.see('Check line edited by the robot.');
      await h.see('Post now');
    } },
    { title: 'Skip today: nothing is posted', run: async h => {
      await h.tap('Skip today');
      await h.see('Skipped. Nothing was posted.', 60000);
      const v = await h.door('check_call', { fn: 'cueRun', args: [h.rnId] });
      if (!v.ok || v.result.status !== 'Done' || v.result.rn.posted) throw new Error('Expected Done and not posted, got ' + JSON.stringify(v.result && { status: v.result.status, posted: v.result.rn.posted }));
    } }
  ]
};
