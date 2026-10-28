// Cloud check for Cue 1.27.56 New mail (CueNewMail.gs; spec new-mail-check.md, Kiko yes 27 Oct 2026 09:32Z). Read only: through the
// check door, cueNmCheck reads the last day of Kiko's real inbox (Gmail profile, inbox threads, headers) and asks Canvas for info@'s
// new mail (inbox_new), then runs New mail's code filters. Nothing is saved (no thread, no Triage log row, no property), there is no
// AI call and no mail is sent, labelled or archived. The card, buttons and Draft reply are covered by tests NM1 to NM5.
// No own config: the run uses config.json.
let run = null;

export default {
  name: '1.27.56 New mail (read only)',
  steps: [
    { title: 'Kiko\'s inbox is read through Gmail history, read only', run: async h => {
      const r = await h.door('check_call', { fn: 'cueNmCheck', args: [] });
      if (!r.ok) throw new Error('cueNmCheck failed: ' + r.error);
      run = r.result || {};
      if (!/^\d+$/.test(String(run.history || ''))) throw new Error('No Gmail history id came back: ' + JSON.stringify(run.history));
      if (!Array.isArray(run.keep) || !Array.isArray(run.skip)) throw new Error('No line lists came back');
    } },
    { title: 'The code filters sort the last day\'s mail into shown and skipped', run: async h => {
      const bad = run.keep.concat(run.skip).filter(l => ['mine', 'info'].indexOf(l.inbox) < 0 || !l.who);
      if (bad.length) throw new Error(bad.length + ' line(s) with no inbox or sender');
      if (run.skip.some(l => !l.why)) throw new Error('A skipped line has no reason');
      if (!run.threads) return 'SKIP: no inbox mail in the last day, so there is nothing to filter';
    } },
    { title: 'info@ through Canvas (needs the inbox_new release)', run: async h => {
      if (run.info_error) return 'SKIP: Canvas answered "' + run.info_error + '". The info@ lines start once the inbox_new release is live.';
    } },
    { title: 'What New mail would show now (nothing was saved)', run: async h => {
      await h.page().evaluate(r => {
        const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
        const d = document.createElement('div');
        d.id = 'check-new-mail';
        d.style.cssText = 'position:fixed;inset:24px;z-index:99999;background:#fff;border:1px solid #e6e2dc;border-radius:12px;padding:16px;overflow:auto;font:14px "DM Sans",Arial,sans-serif;color:#1d1b22';
        const row = l => '<tr style="border-top:1px solid #eee"><td>' + (l.inbox === 'info' ? 'info@' : 'yours') + '</td><td>' + esc(l.who) + '</td><td>' + esc(l.subject) + '</td><td>' + esc(l.why) + '</td></tr>';
        d.innerHTML = '<b>New mail, read-only check</b><p>' + r.threads + ' inbox thread(s) in the last day; ' + r.keep.length + ' would show, ' + r.skip.length + ' skipped'
          + (r.info_error ? '; info@ not ready (' + esc(r.info_error) + ')' : '') + '. Nothing was saved.</p><table style="border-collapse:collapse;width:100%">'
          + '<tr><th align="left">Inbox</th><th align="left">From</th><th align="left">Subject</th><th align="left">Skipped because</th></tr>'
          + r.keep.concat(r.skip).map(row).join('') + '</table>';
        document.body.appendChild(d);
      }, run);
      await h.see('Nothing was saved.');
    } }
  ]
};
