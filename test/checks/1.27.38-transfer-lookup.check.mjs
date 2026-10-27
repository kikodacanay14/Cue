// Cloud check for Cue 1.27.38 transfer lookup (CueLookup.gs): read only. Cue reads BSE Scopes and Transfers through check
// mode's read-only view; any change to that sheet, to Canvas or to mail stops the run.
const ESC = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default {
  name: '1.27.38 transfer lookup (read only)',
  steps: [
    { title: 'Ask by request ID: Cue answers from the Transfers tab with no AI call', run: async h => {
      await h.say('any transfer for ' + h.config.request_id);
      await h.see(/Found \d+ .*transfers? of ₱|No .*transfer of ₱/, 120000);
      if (h.calls().some(f => f === 'cueRun')) throw new Error('the lookup started a task run (it should answer in the chat)');
    } },
    { title: 'Ask by an amount alone: Cue says which payment it needs, or matches by amount and says to check the payee', run: async h => {
      await h.say('is there a gcash transfer of 999,999.99 yesterday');
      await h.see(/No GCash transfer of ₱999,999\.99|Which payment\?|Same amount only/, 120000);
    } },
    { title: 'A reference that does not exist: Cue says so', run: async h => {
      await h.say('find transfer 900000000000001');
      await h.see(/No transfer in the Transfers tab has reference 900000000000001\./, 120000);
    } },
    { title: 'No account number on the page', run: async h => {
      const t = await h.page().evaluate(() => document.body.innerText);
      const acct = (t.match(/\b(?:acct|account)\s*(?:no\.?|number|#)?\s*[:#]?\s*\d{8,}/i) || [])[0];
      if (acct) throw new Error('an account number shows: ' + acct);
    } }
  ]
};
