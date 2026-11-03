// Cloud check for Cue 1.27.86 (Kiko 30 Oct 2026 05:50Z: "project emails stay in Team Cue others are in Ask Cue").
// Read only: the robot reads Canvas's Emails waiting list through the bridge, then asks New mail which lines it would list
// (cueNmCheck, the last day of Kiko's inbox and info@). No project thread may be among them. Nothing is sent, tapped or written.
export default {
  name: '1.27.86 project emails stay out of Ask Cue New mail',
  steps: [
    { title: 'Canvas names the project threads (bridge read mail_waiting)', run: async h => {
      const r = await h.door('check_call', { fn: 'cueMailProjectThreads_', args: [null] });
      if (!r.ok) throw new Error('cueMailProjectThreads_ failed: ' + r.error);
      h.pt = r.result || {};
      console.log('project threads from Canvas: ' + Object.keys(h.pt).length);
    } },
    { title: 'New mail leaves every project thread out and keeps the rest', run: async h => {
      const r = await h.door('check_call', { fn: 'cueNmCheck', args: [] });
      if (!r.ok) throw new Error('cueNmCheck failed: ' + r.error);
      const v = r.result || {}, all = (v.keep || []).concat(v.skip || []), leak = all.filter(l => l.inbox !== 'info' && h.pt[String(l.thread_id)]);
      console.log('inbox threads in the last day: ' + v.threads + '; New mail keeps ' + (v.keep || []).length + ', skips ' + (v.skip || []).length + '; project threads among them: ' + leak.length);
      (v.keep || []).slice(0, 8).forEach(l => console.log('  kept: ' + String(l.who || '').slice(0, 40) + ' | ' + String(l.subject || '').slice(0, 70)));
      if (leak.length) throw new Error('project emails still in Ask Cue: ' + JSON.stringify(leak.map(l => l.subject)).slice(0, 400));
    } }
  ]
};
