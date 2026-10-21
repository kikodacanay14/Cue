// Cue bubble (draft, 21 Oct): a round Cue button on every page. Drag it anywhere; tap it to open Cue.
// It reads nothing on the page and sends nothing but "open Cue" and where the bubble sits.
(async () => {
  if (window.top !== window) return;
  const { cueUrl = '', cueHidden = {}, cuePos = null } = await chrome.storage.local.get(['cueUrl', 'cueHidden', 'cuePos']);
  const dep = (cueUrl.match(/\/s\/([A-Za-z0-9_-]+)\/exec/) || [])[1];
  if (dep && location.hostname === 'script.google.com' && location.pathname.indexOf('/s/' + dep + '/') >= 0) return;   // not on Cue itself
  try { if (await chrome.runtime.sendMessage({ type: 'cue-is-cue-window' })) return; } catch (e) { /* background asleep: show it */ }
  if (cueHidden[location.hostname]) return;                                // Kiko hid it on this site

  const host = document.createElement('div');
  host.style.cssText = 'all:initial;position:fixed;z-index:2147483646;width:0;height:0;top:0;left:0';
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `<style>
    .b{position:fixed;width:52px;height:52px;border-radius:50%;cursor:grab;touch-action:none;user-select:none;
      background:conic-gradient(#2b0169,#b00c98,#cd5023,#e9d151,#559fef,#2b0169);box-shadow:0 4px 14px rgba(0,0,0,.45);
      display:flex;align-items:center;justify-content:center;transition:transform .12s;}
    .b:hover{transform:scale(1.06)} .b.drag{cursor:grabbing;transform:scale(1.1)}
    .b:focus-visible{outline:3px solid #559fef;outline-offset:3px}
    .in{width:40px;height:40px;border-radius:50%;background:#141518;color:#fff;font:700 15px/40px 'DM Sans','Segoe UI',system-ui,sans-serif;text-align:center}
    .x{position:fixed;display:none;width:20px;height:20px;border-radius:50%;background:#262930;color:#e4e6ea;border:1px solid #3d4250;
      font:700 12px/18px system-ui,sans-serif;text-align:center;cursor:pointer}
    .wrap:hover .x{display:block}
    @media (prefers-reduced-motion: reduce){.b{transition:none}}
  </style><div class="wrap"><div class="b" role="button" tabindex="0" aria-label="Open Cue" title="Open Cue (drag to move)"><div class="in">Cue</div></div>
  <div class="x" title="Hide on this site" aria-label="Hide Cue on this site">×</div></div>`;
  const b = root.querySelector('.b'), x = root.querySelector('.x');
  const clamp = (v, max) => Math.min(Math.max(8, v), max - 60);
  let pos = cuePos || { left: window.innerWidth - 76, top: window.innerHeight - 96 };
  const place = () => { pos.left = clamp(pos.left, window.innerWidth); pos.top = clamp(pos.top, window.innerHeight);
    b.style.left = pos.left + 'px'; b.style.top = pos.top + 'px'; x.style.left = (pos.left + 40) + 'px'; x.style.top = (pos.top - 6) + 'px'; };
  place();
  document.documentElement.appendChild(host);
  window.addEventListener('resize', place);

  let start = null, moved = false;
  b.addEventListener('pointerdown', e => { start = { x: e.clientX, y: e.clientY, l: pos.left, t: pos.top }; moved = false; b.setPointerCapture(e.pointerId); });
  b.addEventListener('pointermove', e => {
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (!moved && Math.hypot(dx, dy) < 5) return;
    moved = true; b.classList.add('drag'); pos = { left: start.l + dx, top: start.t + dy }; place();
  });
  b.addEventListener('pointerup', () => {
    b.classList.remove('drag');
    if (moved) chrome.storage.local.set({ cuePos: pos }); else open();
    start = null;
  });
  b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  x.addEventListener('click', async () => {
    const { cueHidden: h = {} } = await chrome.storage.local.get('cueHidden');
    h[location.hostname] = true; await chrome.storage.local.set({ cueHidden: h }); host.remove();
  });
  // The Cue window opens beside the bubble, inside the screen.
  function open() {
    const left = window.screenX + Math.min(pos.left, window.outerWidth - 460), top = window.screenY + Math.max(40, pos.top - 700);
    chrome.runtime.sendMessage({ type: 'cue-open', near: { left, top } });
  }
  chrome.storage.onChanged.addListener(ch => { if (ch.cuePos && ch.cuePos.newValue) { pos = ch.cuePos.newValue; place(); } });
})();
