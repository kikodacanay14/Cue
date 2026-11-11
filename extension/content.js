// Cue bubble (draft, 21 Oct): a round Cue button on every page. Drag it anywhere; tap it to open Cue.
// It reads nothing on the page and sends nothing but "open Cue" and where the bubble sits.
// 1.2.0: when Kiko snaps a page, the bubble steps out of the picture, and "Snap an area" lets Kiko drag a box (Esc cancels).
let cueHost = null;
if (window.top === window) chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg || sender.id !== chrome.runtime.id) return;
  if (msg.type === 'cue-hide') { if (cueHost) cueHost.style.visibility = 'hidden'; frames2(() => reply(true)); return true; }
  if (msg.type === 'cue-show') { if (cueHost) cueHost.style.visibility = ''; reply(true); }
  if (msg.type === 'cue-area') { pickArea(reply); return true; }
});
function frames2(fn) { requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(fn, 30))); }
function pickArea(reply) {
  const host = document.createElement('div');
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647';
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `<style>
    .o{position:fixed;inset:0;cursor:crosshair;background:rgba(20,21,24,.35)}
    .r{position:fixed;display:none;border:2px solid #559fef;background:rgba(85,159,239,.12);box-shadow:0 0 0 9999px rgba(20,21,24,.35)}
    .t{position:fixed;left:50%;top:16px;transform:translateX(-50%);background:#1d1f24;color:#e4e6ea;border:1px solid #34373f;border-radius:9999px;
      padding:8px 16px;font:600 14px/1.4 'DM Sans','Segoe UI',system-ui,sans-serif;pointer-events:none}
  </style><div class="o" tabindex="-1"></div><div class="r"></div><div class="t">Drag over what Cue should read. Esc cancels.</div>`;
  const o = root.querySelector('.o'), r = root.querySelector('.r'), tip = root.querySelector('.t');
  let a = null, box = null, done = false;
  const finish = res => {
    if (done) return; done = true; document.removeEventListener('keydown', key, true); host.remove();
    if (!res) return reply({ cancel: true });
    frames2(() => reply(res));                                     // the box is gone before the picture is taken
  };
  const key = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(null); } };
  document.addEventListener('keydown', key, true);
  o.addEventListener('pointerdown', e => { a = { x: e.clientX, y: e.clientY }; o.setPointerCapture(e.pointerId); tip.style.display = 'none'; o.style.background = 'transparent'; });
  o.addEventListener('pointermove', e => {
    if (!a) return;
    box = { x: Math.min(a.x, e.clientX), y: Math.min(a.y, e.clientY), w: Math.abs(e.clientX - a.x), h: Math.abs(e.clientY - a.y) };
    Object.assign(r.style, { display: 'block', left: box.x + 'px', top: box.y + 'px', width: box.w + 'px', height: box.h + 'px' });
  });
  o.addEventListener('pointerup', () => { finish(box && box.w > 8 && box.h > 8 ? Object.assign(box, { vw: window.innerWidth }) : null); });
  document.documentElement.appendChild(host);
  o.focus();
}

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
      background:linear-gradient(135deg,#23006F 2%,#56009C 34%,#F000AA 62%,#F06A25 84%,#F4F12C 100%);box-shadow:0 4px 14px rgba(0,0,0,.45);
      display:flex;align-items:center;justify-content:center;transition:transform .12s;}
    .b:hover{transform:scale(1.06)} .b.drag{cursor:grabbing;transform:scale(1.1)}
    .b:focus-visible{outline:3px solid #559fef;outline-offset:3px}
    /* Kiko 28 Oct 04:29Z chose the chat bubble: the old colour wheel read as a loading spinner. */
    .in{width:32px;height:32px;display:block}
    .x{position:fixed;display:none;width:20px;height:20px;border-radius:50%;background:#262930;color:#e4e6ea;border:1px solid #3d4250;
      font:700 12px/18px system-ui,sans-serif;text-align:center;cursor:pointer}
    .wrap:hover .x{display:block}
    @media (prefers-reduced-motion: reduce){.b{transition:none}}
  </style><div class="wrap"><div class="b" role="button" tabindex="0" aria-label="Open Cue" title="Open Cue (drag to move)"><svg class="in" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 5C9.4 5 4 9.6 4 15.3c0 3.2 1.7 6 4.4 7.9L7.3 28l5.6-3c1 .2 2 .3 3.1.3 6.6 0 12-4.6 12-10.2S22.6 5 16 5z" fill="#fff"/><text x="16" y="19.6" text-anchor="middle" font-family="DM Sans,Segoe UI,system-ui,sans-serif" font-weight="700" font-size="11" fill="#23006F">C</text></svg></div>
  <div class="x" title="Hide on this site" aria-label="Hide Cue on this site">×</div></div>`;
  const b = root.querySelector('.b'), x = root.querySelector('.x');
  const clamp = (v, max) => Math.min(Math.max(8, v), max - 60);
  let pos = cuePos || { left: window.innerWidth - 76, top: window.innerHeight - 96 };
  const place = () => { pos.left = clamp(pos.left, window.innerWidth); pos.top = clamp(pos.top, window.innerHeight);
    b.style.left = pos.left + 'px'; b.style.top = pos.top + 'px'; x.style.left = (pos.left + 40) + 'px'; x.style.top = (pos.top - 6) + 'px'; };
  place();
  document.documentElement.appendChild(host); cueHost = host;
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
    h[location.hostname] = true; await chrome.storage.local.set({ cueHidden: h }); host.remove(); cueHost = null;
  });
  // The Cue window opens beside the bubble, inside the screen.
  function open() {
    const left = window.screenX + Math.min(pos.left, window.outerWidth - 460), top = window.screenY + Math.max(40, pos.top - 700);
    chrome.runtime.sendMessage({ type: 'cue-open', near: { left, top } });
  }
  chrome.storage.onChanged.addListener(ch => { if (ch.cuePos && ch.cuePos.newValue) { pos = ch.cuePos.newValue; place(); } });
})();
