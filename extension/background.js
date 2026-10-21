// Cue bubble (draft, 21 Oct). Opens Cue, Kiko's own web app, in one small window and brings it back when tapped again.
// Holds no keys and reads no pages: the only setting is Cue's address, which Kiko types in Options.
const CUE_RE = /^https:\/\/script\.google\.com\/(a\/macros\/[^/]+|macros)\/s\/[A-Za-z0-9_-]+\/exec$/;

async function openCue(near) {
  const { cueUrl = '', cueWin = null } = await chrome.storage.local.get(['cueUrl', 'cueWin']);
  if (!CUE_RE.test(cueUrl)) { chrome.runtime.openOptionsPage(); return; }
  if (cueWin) {
    try { await chrome.windows.update(cueWin, { focused: true, drawAttention: true }); return; } catch (e) { /* closed */ }
  }
  const w = { url: cueUrl, type: 'popup', width: 440, height: 760, focused: true };
  if (near && Number.isFinite(near.left) && Number.isFinite(near.top)) { w.left = Math.max(0, Math.round(near.left)); w.top = Math.max(0, Math.round(near.top)); }
  const win = await chrome.windows.create(w);
  await chrome.storage.local.set({ cueWin: win.id });
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg && msg.type === 'cue-open' && sender.tab) openCue(msg.near);
  // Is this page inside the Cue window? Then the bubble stays hidden there (Kiko 21 Oct 05:42Z).
  if (msg && msg.type === 'cue-is-cue-window') {
    chrome.storage.local.get('cueWin').then(({ cueWin = null }) => reply(!!(sender.tab && cueWin && sender.tab.windowId === cueWin)));
    return true;
  }
});
chrome.action.onClicked.addListener(() => openCue(null));
chrome.windows.onRemoved.addListener(async id => {
  const { cueWin } = await chrome.storage.local.get('cueWin');
  if (cueWin === id) chrome.storage.local.remove('cueWin');
});
