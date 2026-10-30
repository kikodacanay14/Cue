// Cloud check for Cue 1.27.86 (Kiko 30 Oct 2026 05:50Z: "project emails stay in Team Cue others are in Ask Cue").
// Read only: the robot reads Canvas's Emails waiting list through the bridge, then runs the inbox sort once and checks that no
// thread Canvas files under a project is among Ask Cue's inbox lines. Nothing is sent, tapped or written to Canvas.
export default {
  name: '1.27.86 project emails stay out of Ask Cue (New mail / Morning batch inbox lines)',
  steps: [
    { title: 'Canvas names the project threads (bridge read mail_waiting)', run: async h => {
      const r = await h.door('check_call', { fn: 'cueMailProjectThreads_', args: [null] });
      if (!r.ok) throw new Error('cueMailProjectThreads_ failed: ' + r.error);
      h.pt = r.result || {};
      console.log('project threads from Canvas: ' + Object.keys(h.pt).length);
    } },
    { title: 'the inbox sort leaves every project thread out and keeps the rest', run: async h => {
      const r = await h.door('check_call', { fn: 'cueTriageFind_', args: [{ s: { id: 'check-1.27.86', metrics: { ai_calls: 0, calls: [] } } }] });
      if (!r.ok) throw new Error('cueTriageFind_ failed: ' + r.error);
      const lines = Array.isArray(r.result) ? r.result : [];
      const leak = lines.filter(l => h.pt[String(l.thread_id)]);
      console.log('Ask Cue inbox lines: ' + lines.length + '; project threads among them: ' + leak.length);
      lines.slice(0, 8).forEach(l => console.log('  kept: ' + String(l.who || '').slice(0, 40) + ' | ' + String(l.subject || '').slice(0, 70)));
      if (leak.length) throw new Error('project emails still in Ask Cue: ' + JSON.stringify(leak.map(l => l.subject)).slice(0, 400));
    } }
  ]
};
