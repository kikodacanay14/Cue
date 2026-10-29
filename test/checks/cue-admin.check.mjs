// Cloud check for Cue Admin (CueAdmin.gs; Epic Cue #193, Kiko approved the mockup 29 Oct 2026 02:42Z). Read only: Cue's state
// must carry the deployment address the Settings button opens, and the page opened as ?view=admin must show Cue Admin with the
// four groups and the two new sections. The check door refuses the admin reads (CUE_CHECK_NEVER_), so their panes show that
// refusal; nothing is written to the Cue sheet, Canvas or Gmail.
export default {
  name: 'Cue Admin page (read only)',
  steps: [
    { title: "Cue's state carries the address the Settings button opens", run: async h => {
      const r = await h.door('check_call', { fn: 'cueState', args: [] });
      if (!r.ok) throw new Error('cueState failed: ' + r.error);
      if (!/^https:\/\/script\.google\.com\/.+\/(exec|dev)$/.test(String(r.result && r.result.app_url))) throw new Error('No app address: ' + JSON.stringify(r.result && r.result.app_url));
    } },
    { title: 'Opened as ?view=admin, the page is Cue Admin with its four groups and two new sections', run: async h => {
      const page = h.page();
      await page.addInitScript(() => { try { window.google.script.url.getLocation = cb => cb({ hash: '', parameter: { view: 'admin' }, parameters: { view: ['admin'] } }); } catch (e) {} });
      await page.reload();
      await h.see('Cue Admin');
      for (const t of ['How Cue thinks', 'Rules', 'Jobs', 'System', 'Triage rules', 'Release notes', 'Open Cue chat']) await h.see(t, 20000);
    } },
    { title: 'Nothing was written', run: async h => {
      const bad = h.calls().filter(f => /Del$|Save$|Set$|Delete$/.test(f));
      if (bad.length) throw new Error('The page made write calls: ' + bad.join(', '));
    } }
  ]
};
