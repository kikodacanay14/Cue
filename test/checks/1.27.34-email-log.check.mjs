// Cloud check for Cue 1.27.34, the client email log (CueCrmLog.gs; spec canvas-crm-funnel.md F5, Kiko "Log automatically"
// 26 Oct 16:10Z). The log has no card: every hour cueResume reads Kiko's Emails waiting list (bridge mail_waiting) and writes
// one crm_log row per waiting client email. Canvas cannot remove an Activity row, so the check never writes one: it asks the
// check door for one read-only run (cueCrmLogCheck), which reads the real waiting list and returns the rows this hour would
// log. The script checks them against the bridge's crm_log rules and shows them on the page for the screenshot.
// No own config: the run uses config.json (Hiraya). Nothing is written to Canvas, the Cue sheet or Gmail.
const RID = /^[A-Za-z0-9:_-]{8,80}$/, DAY = /^\d{4}-\d{2}-\d{2}$/, MAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
let run = null;

export default {
  name: '1.27.34 client email log (read only)',
  steps: [
    { title: 'One read-only run reads the real Emails waiting list from Canvas', run: async h => {
      const r = await h.door('check_call', { fn: 'cueCrmLogCheck', args: [] });
      if (!r.ok) throw new Error('The check link refused the run: ' + r.error);
      run = r.result || {};
      if (run.note) throw new Error('The email log would do nothing: ' + run.note);
      if (!Array.isArray(run.would)) throw new Error('No row list came back, so this build has no read-only email log');
    } },
    { title: 'Only client emails, each a valid crm_log row (kind Email, request id, date, summary)', run: async h => {
      if (!run.would.length) return 'SKIP: no client email is waiting now (' + run.waiting + ' waiting in all), so there is nothing to check row by row';
      const bad = run.would.filter(a => a.who !== 'Client' || a.kind !== 'Email' || !RID.test(a.request_id) || !/^cuemail:/.test(a.request_id)
        || !DAY.test(a.date) || !MAIL.test(a.email) || a.email !== a.email.toLowerCase() || !/^Email from .+: .+/.test(a.summary) || a.summary.length > 1000);
      if (bad.length) throw new Error(bad.length + ' row(s) Canvas would refuse or should not get: ' + bad.map(a => a.request_id + ' ' + a.who + ' ' + a.email).join('; '));
      const ids = run.would.map(a => a.request_id);
      if (new Set(ids).size !== ids.length) throw new Error('The same email thread is listed twice for one day');
    } },
    { title: 'The rows this hour would log (nothing was written)', run: async h => {
      await h.page().evaluate(r => {
        const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
        const d = document.createElement('div');
        d.id = 'check-email-log';
        d.style.cssText = 'position:fixed;inset:24px;z-index:99999;background:#fff;border:1px solid #e6e2dc;border-radius:12px;padding:16px;overflow:auto;font:14px "DM Sans",Arial,sans-serif;color:#1d1b22';
        d.innerHTML = '<b>Client email log, read-only check</b><p>' + r.waiting + ' email(s) waiting; ' + r.would.length + ' client email(s) would go to Accounts › Activity this hour'
          + (r.skipped ? ' (' + r.skipped + ' more next hour)' : '') + '. Nothing was written.</p><table style="border-collapse:collapse;width:100%">'
          + '<tr><th align="left">Date</th><th align="left">Contact</th><th align="left">Email</th><th align="left">Summary</th></tr>'
          + r.would.map(a => '<tr style="border-top:1px solid #eee"><td>' + esc(a.date) + '</td><td>' + esc(a.contact || '') + '</td><td>' + esc(a.email) + '</td><td>' + esc(a.summary) + '</td></tr>').join('')
          + '</table>';
        document.body.appendChild(d);
      }, run);
      await h.see('Nothing was written.');
    } }
  ]
};
