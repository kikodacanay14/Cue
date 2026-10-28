// Cloud check for the morning batch's "Sales: do these today" lines (CueSweepFunnel.gs; spec canvas-crm-funnel.md F6). Needs the
// Canvas CRM funnel release live first (bridge read crm_funnel, CanvasWorkspace PR #232). Through the check door, one read-only run
// asks Canvas for the real funnel and returns the lines today's batch would list. Nothing is written to Canvas, the Cue sheet or Gmail.
const KEY = /^(crmfu|funnel|inq|winback):[A-Za-z0-9#._-]+$/;
let lines = null;

export default {
  name: 'Sales funnel: do these today (read only)',
  steps: [
    { title: 'One read-only run reads the real Sales funnel from Canvas', run: async h => {
      const r = await h.door('check_call', { fn: 'cueFunnelCheck', args: [] });
      if (!r.ok) throw new Error('The funnel read failed (is the Canvas CRM funnel release live?): ' + r.error);
      if (!Array.isArray(r.result)) throw new Error('No line list came back: ' + JSON.stringify(r.result));
      lines = r.result;
    } },
    { title: 'Each line has a key, a name and what to do; no amounts', run: async h => {
      if (!lines.length) return 'SKIP: nothing is due or quiet in the funnel today, so there is nothing to check line by line';
      const bad = lines.filter(i => !KEY.test(i.key) || !i.project || !/^(Overdue since|Due today|Due tomorrow|Inquiry, quiet|Delivered, quiet|Inquiry from|Last event)/.test(i.why));
      if (bad.length) throw new Error(bad.length + ' line(s) look wrong: ' + JSON.stringify(bad.slice(0, 3)));
      if (/₱|PHP|amount/i.test(JSON.stringify(lines))) throw new Error('A line carries an amount');
      const bad2 = lines.filter(i => /^(inq|winback):/.test(i.key) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.to || ''));
      if (bad2.length) throw new Error(bad2.length + ' draft line(s) have no valid email: ' + bad2.map(i => i.key).join(', '));
    } },
    { title: 'The lines the morning batch would list (nothing was written)', run: async h => {
      await h.page().evaluate(L => {
        const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
        const d = document.createElement('div');
        d.id = 'check-funnel';
        d.style.cssText = 'position:fixed;inset:24px;z-index:99999;background:#fff;border:1px solid #e6e2dc;border-radius:12px;padding:16px;overflow:auto;font:14px "DM Sans",Arial,sans-serif;color:#1d1b22';
        d.innerHTML = '<b>Sales: do these today, read-only check</b><p>' + L.length + ' line(s) the morning batch would list. Nothing was written.</p>'
          + L.map(i => '<div style="border-top:1px solid #eee;padding:6px 0"><b>' + esc(i.project) + '</b> ' + esc(i.who || '') + (i.priority === 'urgent' ? ' <b style="color:#c62828">urgent</b>' : '')
            + '<br><span style="color:#6b6670">' + esc(i.why) + '</span></div>').join('');
        document.body.appendChild(d);
      }, lines);
      await h.see('Nothing was written.');
    } }
  ]
};
