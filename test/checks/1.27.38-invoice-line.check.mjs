// Cloud check for Cue 1.27.38 invoice line edit (CueLookup.gs) on the project in its config. Cue finds the invoice through
// Canvas's bi_list (a read) and shows the Approve card. With approve false (the default) the robot taps Not that, so nothing is
// written; with approve true it taps Approve and Canvas's invoice_line writes once, inside check mode's write lock.
const ESC = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default {
  name: '1.27.38 invoice line edit',
  steps: [
    { title: 'Ask to add the line: Cue finds the project\'s invoice and shows the Approve card', run: async h => {
      await h.say(h.config.ask);
      const got = await h.see(/Put this line on .+'s invoice\?|Already there:|has \d+ open invoices|is locked|Every invoice of|has no invoice and no PO|No project with a billing invoice|Which one\?|did not answer the invoice lookup/, 120000);
      if (!/^Put this line on/.test(got)) throw new Error('No Approve card. Cue said: ' + got + ' (see the screenshot for the whole line)');
      await h.see(h.config.line); await h.see('Where:'); await h.see('Description becomes:'); await h.see('Purchase Order #');
      await h.see('Approve'); await h.see('Not that');
    } },
    { title: 'Nothing is written before a tap', run: async h => {
      if (h.calls().some(f => f === 'cueAskPick')) throw new Error('a card was answered without a tap');
    } },
    { title: 'Approve (only with the config\'s approve) or Not that', run: async h => {
      if (h.config.approve === true) {
        await h.tap('Approve');
        await h.see(new RegExp('Saved(\\.| on PO)[^\\n]*' + ESC(h.config.line)), 120000);
        return;
      }
      await h.tap('Not that');
      await h.see('OK, not added. Nothing was changed.', 60000);
      return 'SKIP: Approve not pressed (approve is false in the config: it edits a real client invoice)';
    } }
  ]
};
