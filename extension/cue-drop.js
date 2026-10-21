// Cue bubble 1.3.0: runs only in Apps Script page frames, and acts only in the frame that holds Cue's message box.
// It passes a snapshot, selected text or an error from the extension into the box (window message to Cue's own page), and passes
// Cue's 📷 button up to the extension. The page fills the box only; nothing is sent until Kiko presses Enter.
(() => {
  const isCue = () => { const c = document.getElementById('composer'); return !!(c && c.getAttribute('data-cue-app') && document.getElementById('box')); };
  chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    if (!msg || msg.type !== 'cue-drop' || sender.id !== chrome.runtime.id || !isCue()) return;
    keep();
    window.postMessage({ cueDrop: { file: msg.file || null, text: msg.text || '', title: msg.title || '', url: msg.url || '', error: msg.error || '' } }, '*');
    reply(true);
  });
  // Apps Script writes Cue's page into its frame after load, which drops window listeners, so keep re-adding (the same function is added once).
  function onPage(e) {
    if (e.source !== window || !e.data || !isCue()) return;
    if (e.data.cueSnapAsk === 'page' || e.data.cueSnapAsk === 'area') chrome.runtime.sendMessage({ type: 'cue-snap', mode: e.data.cueSnapAsk }).catch(() => {});
    if (e.data.cueBubbleAsk) hello();
    // 1.3.0 (Kiko 21 Oct 13:58Z): Cue's side pane asks for room; the window grows or shrinks by that many pixels.
    if (Number.isFinite(e.data.cueResize)) chrome.runtime.sendMessage({ type: 'cue-resize', by: e.data.cueResize, left: e.data.screenLeft, right: e.data.screenRight }).catch(() => {});
  }
  function hello() { if (isCue()) window.postMessage({ cueBubble: chrome.runtime.getManifest().version }, '*'); }
  let said = false;
  const keep = () => { window.addEventListener('message', onPage); if (!said && isCue()) { said = true; hello(); } };
  keep(); setInterval(keep, 2000);
})();
