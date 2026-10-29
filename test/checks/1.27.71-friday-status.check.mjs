// Cloud check for Cue 1.27.71 Friday status updates (CueStatus.gs). Through the check door Cue starts "status of" the check project
// (config.json), Canvas runs its readiness scan and builds the one client email (client_status, read only), and the robot opens the
// card: the To dropdown, Preview (the email as the client sees it) and Skip. The robot never taps Send: the check project's contacts
// are real people. Skip settles the card as Done with nothing sent.
export default {
  name: '1.27.71 Friday status updates (card, To dropdown, Preview, Skip; never Send)',
  steps: [
    { title: 'Start "status of" the check project; Canvas scans and builds its client email', run: async h => {
      const r = await h.door('check_call', { fn: 'cueSend', args: ['status of ' + h.config.project_id] });
      if (!r.ok) throw new Error('cueSend failed: ' + r.error);
      h.stId = r.result && r.result.request_id;
      if (!h.stId) throw new Error('No status update started: ' + JSON.stringify(r.result));
      let v;
      for (let i = 0; i < 8; i++) {   // the readiness scan can stop part way; each run goes on from there
        v = await h.door('check_call', { fn: 'cueRun', args: [h.stId] });
        if (!v.ok) throw new Error('cueRun failed: ' + v.error);
        if (v.result.status !== 'Working') break;
      }
      if (v.result.status !== 'Needs you') throw new Error('Expected the card to wait for Kiko, got ' + v.result.status + ' ' + (v.result.error || (v.result.st && v.result.st.empty) || ''));
      const ms = (v.result.st && v.result.st.mails) || [];
      if (ms.length !== 1) throw new Error('Expected one email, got ' + ms.length);
      if (ms[0].sent_id) throw new Error('An email shows as sent before any tap');
      h.stK = ms[0].k;
    } },
    { title: 'The thread opens on the card: the event, its facts, To, Preview, Send and Skip', run: async h => {
      await h.tap('Status update for ' + h.config.project_id, { timeout: 120000 });   // a thread's name opens it
      await h.see('Friday status updates');
      await h.see(h.config.project_name);
      await h.see(/Readiness \d+%|No readiness score/);
      await h.see('Nothing goes out before you tap Send.');
      await h.see('Preview'); await h.see('Skip'); await h.see('Send');
      const to = h.page().locator('[data-stsel], [data-stto]');
      if (!(await to.count())) throw new Error('No To dropdown or box on the email');
    } },
    { title: 'Preview shows the email as the client sees it; nothing is sent', run: async h => {
      await h.tap('Preview');
      await h.see('Hide preview', 60000);
      const fr = h.page().locator('iframe[title^="Preview of"]');
      await fr.first().waitFor({ timeout: 30000 });
      const html = await fr.first().getAttribute('srcdoc');
      if (!html || html.length < 200) throw new Error('The preview is empty');
      if (/\bP\s?\d{1,3}(,\d{3})+|₱/.test(html.replace(/<[^>]+>/g, ' '))) throw new Error('The preview shows an amount');
    } },
    { title: 'Skip: the card is Done and nothing was sent', run: async h => {
      await h.tap('Skip');
      await h.see('Skipped the update for', 60000);
      const v = await h.door('check_call', { fn: 'cueRun', args: [h.stId] });
      if (!v.ok) throw new Error('cueRun failed: ' + v.error);
      const m = ((v.result.st && v.result.st.mails) || [])[0] || {};
      if (v.result.status !== 'Done' || m.sent_id || !m.skipped) throw new Error('Expected Done, skipped and not sent, got ' + JSON.stringify({ status: v.result.status, sent: !!m.sent_id, skipped: m.skipped }));
    } }
  ]
};
