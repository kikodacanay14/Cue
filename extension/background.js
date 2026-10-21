// Cue bubble (draft, 21 Oct). Opens Cue, Kiko's own web app, in one small window and brings it back when tapped again.
// Holds no keys: the only setting is Cue's address, which Kiko types in Options.
// 1.2.0 (spec screen-snapshot.md, Kiko approved 21 Oct 08:17Z): snapshots. Only when Kiko asks (📷 in Cue, Alt+Shift+S or the
// right-click menu), the visible part of the Chrome tab is captured and dropped into Cue's message box. Nothing is sent until Kiko presses Enter.
const CUE_RE = /^https:\/\/script\.google\.com\/(a\/macros\/[^/]+|macros)\/s\/[A-Za-z0-9_-]+\/exec$/;
const SNAP_MAX = 1800, TEXT_MAX = 20000;

async function openCue(near) {
  const { cueUrl = '', cueWin = null } = await chrome.storage.local.get(['cueUrl', 'cueWin']);
  if (!CUE_RE.test(cueUrl)) { chrome.runtime.openOptionsPage(); return null; }
  if (cueWin) {
    try { await chrome.windows.update(cueWin, { focused: true, drawAttention: true }); return cueWin; } catch (e) { /* closed */ }
  }
  const w = { url: cueUrl, type: 'popup', width: 440, height: 760, focused: true };
  if (near && Number.isFinite(near.left) && Number.isFinite(near.top)) { w.left = Math.max(0, Math.round(near.left)); w.top = Math.max(0, Math.round(near.top)); }
  const win = await chrome.windows.create(w);
  await chrome.storage.local.set({ cueWin: win.id });
  return win.id;
}

// Is this tab Cue itself (the bubble's window, or Cue's /exec address in any tab)?
async function isCueTab(tab) {
  if (!tab) return false;
  const { cueUrl = '', cueWin = null } = await chrome.storage.local.get(['cueUrl', 'cueWin']);
  const dep = (cueUrl.match(/\/s\/([A-Za-z0-9_-]+)\/exec/) || [])[1];
  return (cueWin != null && tab.windowId === cueWin) || !!(dep && /^https:\/\/script\.google\.com\//.test(tab.url || '') && (tab.url || '').indexOf('/s/' + dep + '/') >= 0);
}

// The last normal Chrome window Kiko used, other than Cue's: the 📷 button in Cue snaps that window's tab.
chrome.windows.onFocusChanged.addListener(async id => {
  if (id === chrome.windows.WINDOW_ID_NONE) return;
  const { cueWin = null } = await chrome.storage.local.get('cueWin');
  if (id === cueWin) return;
  try { const w = await chrome.windows.get(id); if (w.type === 'normal') await chrome.storage.session.set({ lastWin: id }); } catch (e) { /* gone */ }
});
async function targetTab(tab) {
  if (tab && tab.id != null && !(await isCueTab(tab))) return tab;
  const { lastWin = null } = await chrome.storage.session.get('lastWin');
  const wins = await chrome.windows.getAll({ windowTypes: ['normal'] });
  const { cueWin = null } = await chrome.storage.local.get('cueWin');
  const pick = wins.find(w => w.id === lastWin) || wins.find(w => w.focused && w.id !== cueWin) || wins.find(w => w.id !== cueWin);
  if (!pick) return null;
  const [t] = await chrome.tabs.query({ active: true, windowId: pick.id });
  return t && !(await isCueTab(t)) ? t : null;
}

const ask = (tabId, msg) => chrome.tabs.sendMessage(tabId, msg, { frameId: 0 }).catch(() => null);   // no bubble script there: carry on

// Snap the visible part of a tab. mode 'page' or 'area'; from = the Cue tab that asked (📷), so the picture goes back there.
async function snap(mode, tab, from) {
  const t = await targetTab(tab);
  if (!t) return deliver({ error: 'Open the page you want in a Chrome window first, then snap again.' }, from);
  if (!/^(https?|file):/.test(t.url || '')) return deliver({ error: 'Chrome does not let extensions snap this kind of page (' + (t.url || 'a Chrome page').split(/[?#]/)[0] + '). Use Win+Shift+S, then Ctrl+V in Cue.' }, from);
  let area = null;
  if (mode === 'area') {
    await chrome.windows.update(t.windowId, { focused: true });
    area = await ask(t.id, { type: 'cue-area' });
    if (!area || !area.w) return area === null ? deliver({ error: 'Snap an area did not start on this page. Reload the page and try again, or use Snap this page.' }, from) : null;   // Esc: nothing
  }
  await ask(t.id, { type: 'cue-hide' });
  let url;
  try { url = await chrome.tabs.captureVisibleTab(t.windowId, { format: 'jpeg', quality: 90 }); }
  catch (e) { await ask(t.id, { type: 'cue-show' }); return deliver({ error: 'Chrome refused the snapshot: ' + ((e && e.message) || e) }, from); }
  await ask(t.id, { type: 'cue-show' });
  const data = await shrink(url, area);
  return deliver({ file: { name: snapName(new Date()), type: 'image/jpeg', data }, title: String(t.title || '').slice(0, 200), url: String(t.url || '').slice(0, 500) }, from);
}

// Crop to the dragged box (CSS pixels scaled to the picture), then at most 1800 px on the long side, like photos Kiko attaches.
async function shrink(dataUrl, area) {
  const img = await createImageBitmap(await (await fetch(dataUrl)).blob());
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (area) {
    const k = img.width / (area.vw || img.width);
    sx = Math.max(0, Math.round(area.x * k)); sy = Math.max(0, Math.round(area.y * k));
    sw = Math.max(1, Math.min(img.width - sx, Math.round(area.w * k))); sh = Math.max(1, Math.min(img.height - sy, Math.round(area.h * k)));
  }
  const s = Math.min(1, SNAP_MAX / Math.max(sw, sh)), c = new OffscreenCanvas(Math.round(sw * s), Math.round(sh * s));
  c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  const buf = new Uint8Array(await (await c.convertToBlob({ type: 'image/jpeg', quality: 0.85 })).arrayBuffer());
  let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return btoa(bin);
}
function snapName(d) {
  const p = n => String(n).padStart(2, '0'), M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return 'Cue snapshot ' + d.getDate() + ' ' + M[d.getMonth()] + ' ' + p(d.getHours()) + '-' + p(d.getMinutes()) + '-' + p(d.getSeconds()) + '.jpg';
}

// Hand the picture (or text, or an error) to Cue's message box. Cue may be loading, so try for up to 15 seconds.
async function deliver(payload, from) {
  let tabId = from;
  if (tabId != null) { try { const t = await chrome.tabs.get(tabId); await chrome.windows.update(t.windowId, { focused: true }); } catch (e) { return; } }
  else {
    const win = await openCue(null); if (win == null) return;
    const [t] = await chrome.tabs.query({ windowId: win }); if (!t) return;
    tabId = t.id;
  }
  for (let i = 0; i < 30; i++) {
    const ok = await chrome.tabs.sendMessage(tabId, Object.assign({ type: 'cue-drop' }, payload)).catch(() => false);
    if (ok === true) return;
    await new Promise(r => setTimeout(r, 500));
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    const docs = ['http://*/*', 'https://*/*', 'file:///*'], where = ['page', 'frame', 'link', 'image', 'video'];
    chrome.contextMenus.create({ id: 'cue-snap-page', title: 'Cue: snap this page', contexts: where, documentUrlPatterns: docs });
    chrome.contextMenus.create({ id: 'cue-snap-area', title: 'Cue: snap an area', contexts: where, documentUrlPatterns: docs });
    chrome.contextMenus.create({ id: 'cue-send-text', title: 'Send to Cue', contexts: ['selection'], documentUrlPatterns: docs });
  });
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'cue-snap-page') snap('page', tab);
  if (info.menuItemId === 'cue-snap-area') snap('area', tab);
  if (info.menuItemId === 'cue-send-text') deliver({ text: String(info.selectionText || '').slice(0, TEXT_MAX), title: String((tab && tab.title) || '').slice(0, 200), url: String((tab && tab.url) || '').slice(0, 500) });
});
chrome.commands.onCommand.addListener((cmd, tab) => { if (cmd === 'cue-snap') snap('page', tab); });

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg && msg.type === 'cue-open' && sender.tab) openCue(msg.near);
  // Is this page inside the Cue window? Then the bubble stays hidden there (Kiko 21 Oct 05:42Z).
  if (msg && msg.type === 'cue-is-cue-window') {
    chrome.storage.local.get('cueWin').then(({ cueWin = null }) => reply(!!(sender.tab && cueWin && sender.tab.windowId === cueWin)));
    return true;
  }
  // 📷 in Cue: only Cue's own page may ask, and the picture goes back to that tab.
  if (msg && msg.type === 'cue-snap' && sender.tab && (msg.mode === 'page' || msg.mode === 'area')) {
    isCueTab(sender.tab).then(ok => { if (ok) snap(msg.mode, null, sender.tab.id); });
  }
});
chrome.action.onClicked.addListener(() => openCue(null));
chrome.windows.onRemoved.addListener(async id => {
  const { cueWin } = await chrome.storage.local.get('cueWin');
  if (cueWin === id) chrome.storage.local.remove('cueWin');
});
