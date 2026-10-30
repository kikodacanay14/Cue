// Cloud check for Cue 1.27.82: Claude answers Ask Cue chat (CueAgent.gs) and looks things up first with read-only tools.
// Through the check door the robot sends three chat messages and reads Cue's reply. Nothing is sent: a draft email stays a draft.
// It is the first live call of the Claude request shape (the build thread had no API key), so a reply that came from the old GPT
// form call instead of Claude shows in the AI Runs tab (Provider GPT instead of Claude); the deploys thread reads those rows after.
const say = async (h, text) => {
  const t0 = Date.now();
  const r = await h.door('check_call', { fn: 'cueSend', args: [text] });
  if (!r.ok) throw new Error('cueSend failed: ' + r.error);
  return { res: r.result || {}, secs: Math.round((Date.now() - t0) / 1000) };
};
export default {
  name: '1.27.82 Claude answers Ask Cue chat (hi, find a contact\'s email, draft to two people; never Send)',
  steps: [
    { title: '"hi" gets a short reply', run: async h => {
      const { res, secs } = await say(h, 'hi');
      if (!res.chat || !String(res.reply || '').trim()) throw new Error('No chat reply: ' + JSON.stringify(res).slice(0, 300));
      console.log('hi (' + secs + ' s): ' + String(res.reply).slice(0, 300));
    } },
    { title: '"find Ruth at Moldex\'s email" gives a real address and where it came from', run: async h => {
      const { res, secs } = await say(h, 'find Ruth at Moldex\'s email');
      const reply = String(res.reply || '');
      console.log('find Ruth (' + secs + ' s): ' + reply.slice(0, 500));
      if (!/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(reply)) throw new Error('No email address in the reply: ' + reply.slice(0, 300));
    } },
    { title: '"email Rommel Siena and Archie about the AMI projects" fills To with both addresses; nothing is sent', run: async h => {
      const { res, secs } = await say(h, 'email Rommel Siena and Archie about the AMI projects');
      console.log('AMI (' + secs + ' s): ' + JSON.stringify(res).slice(0, 800));
      const all = JSON.stringify(res);
      const found = all.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
      const uniq = [...new Set(found.map(x => x.toLowerCase()))].filter(x => !/blankspaceevent\.com$/.test(x));
      if (uniq.length < 2) throw new Error('Expected two addresses for Rommel Siena and Archie, got ' + JSON.stringify(uniq));
    } }
  ]
};
