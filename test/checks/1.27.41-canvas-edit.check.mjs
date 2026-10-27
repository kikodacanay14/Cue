// Cloud check for Cue 1.27.41 Canvas edits (CueEdit.gs) through the generic bridge. The chat call routes the ask (canvas_edit),
// Cue reads the allow-list and the allowed tabs (allow_list, read_rows: reads), one Claude call picks the row, and the Approve
// card shows old and new values. The robot taps Not that, so nothing is written: write_rows names no project, so check mode
// would stop it anyway. The first run also makes and protects "_Cue Allow List" in the Ledger sheet (the bridge does it).
export default {
  name: '1.27.41 Canvas edit (generic bridge)',
  steps: [
    { title: 'Ask for a change: Cue works it out and shows the Approve card', run: async h => {
      await h.say(h.config.ask);
      const got = await h.see(/Change this in Canvas\?|Already there:|rows? match|No .+ row matches|can't be changed by Cue|not allowed to edit any Canvas tab|Canvas did not|I could not/, 180000);
      if (!/^Change this in Canvas\?/.test(got)) throw new Error('No Approve card. Cue said: ' + got + ' (see the screenshot for the whole line)');
      await h.see(h.config.tab + ', ' + h.config.key_col + ' ' + h.config.key); await h.see('becomes:'); await h.see(h.config.value);
      await h.see('Nothing is saved until you approve.'); await h.see('Approve'); await h.see('Not that');
    } },
    { title: 'Nothing is written before a tap', run: async h => {
      if (h.calls().some(f => f === 'cueAskPick')) throw new Error('a card was answered without a tap');
    } },
    { title: 'Not that: nothing is written', run: async h => {
      await h.tap('Not that');
      await h.see('OK, not changed. Nothing was written to Canvas.', 60000);
    } },
    { title: '"allow cue to ..." shows its Approve card with no AI call; Not that leaves the allow-list as it is', run: async h => {
      await h.say(h.config.allow_ask);
      await h.see(/^Let Cue read /, 60000);
      await h.see('Each edit still needs your Approve.');
      await h.tap('Not that');
      await h.see('OK, the allow-list stays as it is.', 60000);
    } }
  ]
};
