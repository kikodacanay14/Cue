// Cloud check for Cue 1.27.58 RFPs from Kiko's Gmail (CueRfpSend.gs). Through the check door, the RFP job runs once in check mode:
// it reads Canvas's RFP Outbox over the bridge (rfp_outbox, a read) and returns what this tick would send. Check mode sends no email
// and reports nothing back to Canvas (no rfp_sent), so the only effect is the bridge read. Needs Canvas V316, which adds the outbox.
export default {
  name: '1.27.58 RFPs from your Gmail (reads the RFP Outbox, sends nothing)',
  steps: [
    { title: 'The RFP job reads the RFP Outbox through the bridge and sends nothing', run: async h => {
      const r = await h.door('check_call', { fn: 'cueRfpSendTick_', args: [] });
      if (!r.ok) throw new Error('cueRfpSendTick_ failed: ' + r.error);
      const o = r.result || {};
      if (o.note) throw new Error('The outbox read failed: ' + o.note);
      if (o.sent || o.failed || o.reported) throw new Error('Check mode sent or reported something: ' + JSON.stringify(o));
      if (!Array.isArray(o.would)) throw new Error('No outbox list came back: ' + JSON.stringify(o));
    } }
  ]
};
