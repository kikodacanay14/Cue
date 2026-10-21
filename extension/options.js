const CUE_RE = /^https:\/\/script\.google\.com\/(a\/macros\/[^/]+|macros)\/s\/[A-Za-z0-9_-]+\/exec$/;
const $ = id => document.getElementById(id);
chrome.storage.local.get('cueUrl').then(({ cueUrl = '' }) => { $('url').value = cueUrl; });
$('save').onclick = async () => {
  const v = $('url').value.trim();
  if (!CUE_RE.test(v)) { $('msg').textContent = 'That is not a Cue web app address. It should start with https://script.google.com/ and end in /exec.'; return; }
  await chrome.storage.local.set({ cueUrl: v });
  $('msg').textContent = 'Saved. Tap the Cue bubble on any page to open Cue.';
};
$('reset').onclick = async () => { await chrome.storage.local.set({ cueHidden: {} }); $('msg').textContent = 'The bubble shows on every site again.'; };
