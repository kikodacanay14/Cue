// Cloud check for Cue 1.27.56 (structure review phase 4, Cue-only group: 4.1, 4.3, 4.4). Read-only: nothing is written to Canvas
// and no mail goes out.
//   4.4: a transfer lookup in the chat answers from BSE Scopes and Transfers, now through Canvas's read_rows when the allow-list
//        has Transfers and Payment Request (it does: seeded 27 Oct). No AI call, no account number on the page.
//   4.3: the check door works out the crm_lead requests the newest bid check would send, with nothing sent (a check run never
//        claims a plan). Each must carry source "Bid finder" and a bid:<key> request id.
//   4.6: the usage section reads Canvas's AI Runs when Canvas lists it; before the Canvas release it says so plainly (read only).
//   4.1 (the chase count on a project log line) only runs when a chaser is really sent, so the local tests (P4c) carry it.
//   Dry run: DRY_ALLOW must hold an allow-list with Transfers and Payment Request rows (the sandbox default has neither with rows).
export default {
  name: '1.27.56 Cue into Canvas (transfer lookup through the bridge, bid leads, one AI cost view)',
  steps: [
    { title: 'A transfer lookup answers from the bridge, read only', run: async h => {
      await h.say('is there a gcash transfer of 1,200 on 12 Oct?');
      const got = await h.see(/Read only\. Nothing was changed\.|I could not open BSE Scopes and Transfers|Which payment\?/, 120000);
      if (/could not open/.test(got)) throw new Error('The lookup could not read Transfers: ' + got);
      if (/\b09\d{9}\b/.test(got)) throw new Error('An account number is on the page: ' + got);
      if (h.calls().some(f => /^cue(Approve|AskPick)$/.test(f))) throw new Error('a card was answered without a tap');
    } },
    { title: 'Bid leads: worked out, nothing sent', run: async h => {
      const r = await h.door('check_call', { fn: 'cueBidsLeadsCheck', args: [] });
      if (!r.ok) throw new Error('cueBidsLeadsCheck failed: ' + r.error);
      const w = (r.result && r.result.would) || [];
      const bad = w.filter(a => a.source !== 'Bid finder' || !/^bid:[A-Za-z0-9:_-]{4,}$/.test(a.request_id) || !a.name);
      if (bad.length) throw new Error('Lead requests not in the agreed shape: ' + JSON.stringify(bad));
    } },
    { title: 'Usage: Canvas AI calls join the view, or a plain note says why not', run: async h => {
      const r = await h.door('check_call', { fn: 'cueUsage', args: [] });
      if (!r.ok) throw new Error('cueUsage failed: ' + r.error);
      const c = (r.result && r.result.canvas) || null;
      if (!c) throw new Error('The usage view has no Canvas part: ' + JSON.stringify(Object.keys(r.result || {})));
      if (/could not be read/.test(c.note || '')) throw new Error(c.note);
    } },
    { title: 'Cue opens as usual', run: async h => { await h.see(/Cue/, 60000); } }
  ]
};
