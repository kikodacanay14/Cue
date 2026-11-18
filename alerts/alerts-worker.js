/* CUE-ALERTS-2026-11-16: Cue alerts on Kiko's Android phone (spec canvas-integration/specs/cue-android-notifications.md, ADR-0198).
 * Kiko 16 Nov 2026: "A. Cue's own push" (15:14:25Z), mockups ALERT-1 to ALERT-3 "Approve all three" (15:18:24Z),
 * "Yes, group within 5 min" (15:20:47Z), "Yes, build it" (17:22:27Z).
 *
 * A Cloudflare Worker, because an Apps Script page cannot register a service worker. Cue (Apps Script) sends here; the phone's
 * Chrome holds a push subscription made on this Worker's own setup page.
 *   GET  /setup?code=…   ALERT-1, the one-time setup page (before Allow, On, Blocked).
 *   GET  /sw.js          The service worker. On a push it asks /next for this phone's alerts and shows them.
 *   POST /pair           { key }: Cue's Connect alerts hands over the key Cue made. Only while KV "pair_open" exists (set for
 *                        30 minutes at deploy time), and only once; then the window closes.
 *   POST /code           Cue only (Authorization: Bearer CUE_ALERTS_KEY): makes a one-time setup code that lasts 10 minutes.
 *   POST /subscribe      { code, subscription }: a valid code adds the phone, once; the code is then spent.
 *   POST /unsubscribe    { endpoint }: Turn off. Removes that phone.
 *   POST /me             { endpoint }: is this phone on, and since when (the setup page's On state).
 *   POST /test           { endpoint }: Send a test alert to that phone only.
 *   POST /send           Cue only: { title, body, url, tag, renotify } to every phone. Kept one hour per phone, then an empty push.
 *   POST /next           { endpoint }: the phone's waiting alerts, handed over once.
 *   GET  /status         Cue only: { phones } for Cue Settings' "1 phone is on".
 *   GET  /icon-192.png, /icon-512.png, /badge.png, /manifest.webmanifest   The Cue logo and the home-screen app (18 Nov 2026).
 * The push is signed with the Worker's VAPID key (ES256, WebCrypto). CUE-ALERTS-2026-11-18 (Kiko 18 Nov 2026 02:22:47Z: "its a
 * generic message"): KV is only eventually consistent between Cloudflare locations, so a phone in Manila could ask /next before
 * an alert Cue stored from Google's US servers had reached it, and showed the generic line. The alert now travels inside the
 * push, encrypted end to end for that phone (RFC 8291 aes128gcm, WebCrypto only), so Google's push service never reads it. A phone
 * whose keys are not known yet still gets an empty push and /next, and its service worker hands its keys over then. `tag` is the Cue thread, so Android replaces that thread's alert.
 * Bindings: KV namespace CUE_ALERTS. Secrets: VAPID_JWK (ES256 private key as JWK JSON), CUE_ALERTS_KEY. */
import { ICON_192, ICON_512, BADGE } from './icons.js';
const enc = new TextEncoder();
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const hex = buf => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
const json = (o, status) => new Response(JSON.stringify(o), { status: status || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
function same(a, b) {   // constant-time compare of two strings
  a = String(a || ''); b = String(b || '');
  if (!a || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
// Cue's key: the CUE_ALERTS_KEY secret, or the key Cue handed over at /pair (KV "cue_key"), so nobody pastes a key into Cue.
async function isCue(req, env) {
  const got = String(req.headers.get('Authorization') || '').replace(/^Bearer /, '');
  return same(got, env.CUE_ALERTS_KEY) || same(got, await env.CUE_ALERTS.get('cue_key'));
}
const rand = n => hex(crypto.getRandomValues(new Uint8Array(n)));
const subId = async endpoint => hex(await crypto.subtle.digest('SHA-256', enc.encode(String(endpoint)))).slice(0, 32);
const HOUR = 3600, CODE_TTL = 600;
const clip = (s, n) => { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
async function body(req) { try { return await req.json(); } catch (e) { return {}; } }
const goodKeys = k => !!k && unb64uSafe(k.p256dh).length === 65 && unb64uSafe(k.p256dh)[0] === 4 && unb64uSafe(k.auth).length === 16;
function unb64uSafe(s) { try { return unb64u(s || ''); } catch (e) { return new Uint8Array(0); } }
const goodEndpoint = e => /^https:\/\/[A-Za-z0-9.-]+(:\d+)?\/\S{8,2000}$/.test(String(e || ''));

/** The VAPID public key (uncompressed P-256 point) from the private JWK's x and y. */
function vapidPublic(env) {
  const j = JSON.parse(env.VAPID_JWK || '{}'), x = unb64u(j.x || ''), y = unb64u(j.y || '');
  if (x.length !== 32 || y.length !== 32) throw new Error('VAPID_JWK is not a P-256 key');
  const p = new Uint8Array(65); p[0] = 4; p.set(x, 1); p.set(y, 33); return b64u(p);
}
/** RFC 8292 VAPID: an ES256 JWT for the push service's origin. WebCrypto's ECDSA signature is already r||s, as JWS wants. */
async function vapidAuth(env, endpoint, host) {
  const j = JSON.parse(env.VAPID_JWK), key = await crypto.subtle.importKey('jwk', Object.assign({}, j, { key_ops: ['sign'], ext: true }), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * HOUR, sub: 'https://' + host })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(head + '.' + claims));
  return 'vapid t=' + head + '.' + claims + '.' + b64u(sig) + ', k=' + vapidPublic(env);
}
const cat = (...parts) => { const out = new Uint8Array(parts.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of parts) { out.set(x, i); i += x.length; } return out; };
async function hmac(key, data) { return new Uint8Array(await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), data)); }
/** RFC 8291 Web Push message encryption (aes128gcm, one record): only the phone that holds the subscription's private key can read it. */
async function encryptFor(keys, text) {
  const ua = unb64u(keys.p256dh), auth = unb64u(keys.auth), one = new Uint8Array([1]);
  const as = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', ua, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));
  const ikm = await hmac(await hmac(auth, ecdh), cat(enc.encode('WebPush: info\0'), ua, asPub, one));
  const salt = crypto.getRandomValues(new Uint8Array(16)), prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, cat(enc.encode('Content-Encoding: aes128gcm\0'), one))).slice(0, 16);
  const nonce = (await hmac(prk, cat(enc.encode('Content-Encoding: nonce\0'), one))).slice(0, 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, cat(enc.encode(text), new Uint8Array([2]))));
  return cat(salt, new Uint8Array([0, 0, 16, 0, 65]), asPub, ct);   // header: salt, record size 4096, key id length 65, sender key
}
/** Sends one alert to one phone. With the phone's keys the alert rides inside the push, encrypted; without them it is kept one hour
 *  for /next and the push is empty. A phone the push service no longer knows is removed. */
async function deliver(env, id, sub, alert, host) {
  const headers = { TTL: String(HOUR), Urgency: 'high', Authorization: await vapidAuth(env, sub.endpoint, host) };
  let payload = null;
  if (goodKeys(sub.keys)) { payload = await encryptFor(sub.keys, JSON.stringify(alert)); headers['Content-Encoding'] = 'aes128gcm'; headers['Content-Type'] = 'application/octet-stream'; headers['Content-Length'] = String(payload.length); }
  else { await env.CUE_ALERTS.put('p:' + id + ':' + String(Date.now()).padStart(13, '0') + ':' + rand(4), JSON.stringify(alert), { expirationTtl: HOUR }); headers['Content-Length'] = '0'; }
  try {
    const r = await fetch(sub.endpoint, payload ? { method: 'POST', headers, body: payload } : { method: 'POST', headers });
    if (r.status === 404 || r.status === 410) { await env.CUE_ALERTS.delete('sub:' + id); return 'gone'; }
    return r.ok ? 'sent' : 'failed ' + r.status;
  } catch (e) { return 'failed'; }
}
async function phones(env) {
  const out = [];
  let cursor;
  do { const l = await env.CUE_ALERTS.list({ prefix: 'sub:', cursor }); for (const k of l.keys) { const v = await env.CUE_ALERTS.get(k.name); if (v) out.push([k.name.slice(4), JSON.parse(v)]); } cursor = l.list_complete === false ? l.cursor : null; } while (cursor);
  return out;
}
function alertOf(o) {   // only text, a Cue https link and the thread tag go on; nothing else Cue might send
  const url = /^https:\/\/[^\s"'<>]{1,500}$/.test(String(o.url || '')) ? String(o.url) : '';
  return { title: clip(o.title, 80) || 'Cue', body: clip(o.body, 160), url, tag: clip(o.tag, 80).replace(/[^\w:.-]/g, '') || 'cue', renotify: o.renotify !== false };
}

export default {
  async fetch(req, env) {
    const u = new URL(req.url), p = u.pathname, host = u.host;
    if (req.method === 'GET' && p === '/sw.js') return new Response(SW_JS, { headers: { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-cache', 'Service-Worker-Allowed': '/' } });
    if (req.method === 'GET' && ICONS[p]) return new Response(Uint8Array.from(atob(ICONS[p]), c => c.charCodeAt(0)), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' } });
    if (req.method === 'GET' && p === '/manifest.webmanifest') return new Response(JSON.stringify(MANIFEST), { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=3600' } });
    if (req.method === 'GET' && p === '/open') {   // a tap on an alert with no link of its own: open Cue (the address Cue last sent), else this setup page
      const home = await env.CUE_ALERTS.get('cue_home');
      return new Response(null, { status: 302, headers: { Location: /^https:\/\//.test(home || '') ? home : '/setup', 'Cache-Control': 'no-store' } });
    }
    if (req.method === 'GET' && p === '/setup') {
      let key = ''; try { key = vapidPublic(env); } catch (e) { return new Response('Cue alerts are not set up yet.', { status: 503 }); }
      return new Response(setupPage(key, String(u.searchParams.get('code') || '').replace(/[^a-f0-9]/g, '').slice(0, 64)),
        { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
          'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self'; worker-src 'self'; img-src 'self'; manifest-src 'self'; frame-ancestors 'none'" } });
    }
    if (req.method === 'GET' && p === '/status') {
      if (!(await isCue(req, env))) return json({ error: 'forbidden' }, 403);
      return json({ phones: (await phones(env)).length });
    }
    if (req.method !== 'POST') return new Response('Not found', { status: 404 });
    if (p === '/pair') {   // Connect alerts in Cue: Cue hands over the key it made, once, while the pairing window is open
      const b = await body(req), key = String(b.key || '');
      if (!(await env.CUE_ALERTS.get('pair_open'))) return json({ error: 'Pairing is closed.' }, 403);
      if (!/^[A-Za-z0-9_-]{32,128}$/.test(key)) return json({ error: 'bad key' }, 400);
      await env.CUE_ALERTS.put('cue_key', key); await env.CUE_ALERTS.delete('pair_open');
      return json({ paired: true });
    }
    if (p === '/code') {
      if (!(await isCue(req, env))) return json({ error: 'forbidden' }, 403);
      const code = rand(16); await env.CUE_ALERTS.put('code:' + code, '1', { expirationTtl: CODE_TTL });
      return json({ code, url: 'https://' + host + '/setup?code=' + code, minutes: CODE_TTL / 60 });
    }
    if (p === '/send') {
      if (!(await isCue(req, env))) return json({ error: 'forbidden' }, 403);
      const a = alertOf(await body(req)), list = await phones(env), res = [];
      if (a.url) { const home = a.url.split(/[?#]/)[0]; if (home !== (await env.CUE_ALERTS.get('cue_home'))) await env.CUE_ALERTS.put('cue_home', home); }   // where a tap on a link-less alert goes
      for (const [id, sub] of list) res.push(await deliver(env, id, sub, a, host));
      return json({ phones: list.length, sent: res.filter(x => x === 'sent').length, results: res });
    }
    const b = await body(req);
    if (p === '/subscribe') {
      const code = String(b.code || '').replace(/[^a-f0-9]/g, ''), s = b.subscription || {};
      if (!code || !(await env.CUE_ALERTS.get('code:' + code))) return json({ error: 'This link has expired. Open the setup page again from Cue Settings.' }, 403);
      if (!goodEndpoint(s.endpoint)) return json({ error: 'bad subscription' }, 400);
      await env.CUE_ALERTS.delete('code:' + code);
      const id = await subId(s.endpoint), at = new Date().toISOString();
      await env.CUE_ALERTS.put('sub:' + id, JSON.stringify(Object.assign({ endpoint: s.endpoint, at, ua: clip(req.headers.get('User-Agent'), 200) }, goodKeys(s.keys) ? { keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } } : {})));
      return json({ on: true, at });
    }
    if (!goodEndpoint(b.endpoint)) return json({ error: 'bad endpoint' }, 400);
    const id = await subId(b.endpoint), raw = await env.CUE_ALERTS.get('sub:' + id), sub = raw ? JSON.parse(raw) : null;
    if (!sub || sub.endpoint !== b.endpoint) return json({ on: false, alerts: [] }, p === '/unsubscribe' ? 200 : 404);
    if ((p === '/me' || p === '/next') && goodKeys(b.keys) && (!sub.keys || sub.keys.p256dh !== b.keys.p256dh || sub.keys.auth !== b.keys.auth)) {   // a phone set up before 18 Nov hands its keys over
      sub.keys = { p256dh: b.keys.p256dh, auth: b.keys.auth }; await env.CUE_ALERTS.put('sub:' + id, JSON.stringify(sub));
    }
    if (p === '/me') return json({ on: true, at: sub.at });
    if (p === '/unsubscribe') { await env.CUE_ALERTS.delete('sub:' + id); return json({ on: false }); }
    if (p === '/test') return json({ result: await deliver(env, id, sub, alertOf({ title: 'Cue test alert', body: 'Alerts are working on this phone.', tag: 'cue-test', url: '' }), host) });
    if (p === '/next') {
      const l = await env.CUE_ALERTS.list({ prefix: 'p:' + id + ':', limit: 20 }), alerts = [];
      for (const k of l.keys) { const v = await env.CUE_ALERTS.get(k.name); if (v) alerts.push(JSON.parse(v)); await env.CUE_ALERTS.delete(k.name); }
      return json({ alerts });
    }
    return new Response('Not found', { status: 404 });
  }
};

// The phone's service worker. The alert comes inside the push (encrypted for this phone). An empty push asks /next, and asks
// again for up to about 40 seconds while the alert reaches this Cloudflare location. Chrome requires every push to show a
// notification, so only when nothing arrives does it show the one generic line.
const SW_JS = `var LOOK = { icon: '/icon-192.png', badge: '/badge.png' };
function show(a) { return self.registration.showNotification(a.title || 'Cue', { body: a.body || '', tag: a.tag || 'cue', renotify: !!a.renotify, silent: !a.renotify, icon: LOOK.icon, badge: LOOK.badge, data: { url: a.url || '' } }); }
self.addEventListener('push', function (e) { e.waitUntil((async function () {
  var a = null; try { a = e.data && e.data.json(); } catch (x) {}
  if (a && a.title) return show(a);
  var sub = await self.registration.pushManager.getSubscription(), list = [], j = sub ? sub.toJSON() : {}, waits = [0, 2000, 5000, 10000, 20000];
  for (var w = 0; w < waits.length && !list.length; w++) {
    if (waits[w]) await new Promise(function (ok) { setTimeout(ok, waits[w]); });
    try { var r = await fetch('/next', { method: 'POST', body: JSON.stringify({ endpoint: j.endpoint, keys: j.keys }) }); list = (await r.json()).alerts || []; } catch (x) {}
  }
  if (!list.length) return self.registration.showNotification('Cue', { body: 'Open Cue to see what is new.', tag: 'cue', icon: LOOK.icon, badge: LOOK.badge });
  for (var i = 0; i < list.length; i++) await show(list[i]);
})()); });
self.addEventListener('notificationclick', function (e) { e.notification.close(); var u = (e.notification.data || {}).url || '/open'; e.waitUntil(clients.openWindow(u)); });
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
`;

const ICONS = { '/icon-192.png': ICON_192, '/icon-512.png': ICON_512, '/badge.png': BADGE };
// Add to Home screen makes Cue its own app on the phone, so Android names alerts "Cue" instead of "Chrome".
const MANIFEST = { name: 'Cue', short_name: 'Cue', start_url: '/setup', scope: '/', display: 'standalone', background_color: '#F7F3EA', theme_color: '#23006F',
  icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }] };

// ALERT-1, as approved (mockup-375.png): Cue tokens from src/IndexStyle.html, Quicksand, three states.
function setupPage(key, code) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Cue alerts</title>
<link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#23006F"><link rel="icon" href="/icon-192.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--font:'Quicksand',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;--bg:#F7F3EA;--head:#FFFFFF;--panel:#FFFFFF;--line:#E2DCCF;--line2:#CFC7B5;--muted:#5B5766;--text:#16151B;--act:#23006F;--bad:#C2410C}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:500 15px/1.5 var(--font)}
header{background:var(--head);border-bottom:1px solid var(--line);display:flex;align-items:center;gap:12px;padding:10px 16px}
.logo{width:32px;height:32px;border-radius:50%;flex:none;display:block}
header h1{margin:0;font:700 18px/1.1 var(--font)}
main{padding:18px 16px 22px;display:flex;flex-direction:column;gap:12px;max-width:560px;min-height:calc(100vh - 54px)}
h2{margin:0;font:700 16px/1.3 var(--font);color:var(--act)}p{margin:0;font-size:14px}.muted{color:var(--muted);font-size:13px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px}
.btns{display:flex;justify-content:flex-end;gap:8px;margin-top:auto;flex-wrap:wrap}
.btn{all:unset;cursor:pointer;display:inline-flex;align-items:center;min-height:36px;padding:0 16px;border-radius:9999px;border:1px solid var(--line2);background:var(--panel);font:700 14px var(--font);color:var(--text);white-space:nowrap}
.btn.pri{background:var(--text);color:#fff;border-color:var(--text)}.btn:focus-visible{outline:2px solid var(--act);outline-offset:2px}.btn[disabled]{opacity:.5;cursor:default}
.tag{display:inline-flex;align-items:center;padding:2px 10px;border-radius:4px;font-size:12px;font-weight:600;line-height:1.5;white-space:nowrap;vertical-align:middle}
.tag.good{background:#E5F3EA;color:#1E7A46}.tag.crit{background:#FBE9E7;color:#B3261E}
ol{margin:0;padding-left:20px;font-size:14px}.err{color:var(--bad);font-size:13px}[hidden]{display:none!important}
</style></head><body>
<header><img class="logo" src="/icon-192.png" alt="" width="32" height="32"><h1>Cue</h1></header>
<main>
 <section id="off" hidden><h2>Get Cue alerts on this phone</h2>
  <p style="margin-top:12px">Cue will tell you here when something needs you: the 8 AM update, items for your OK, agent updates, Messenger messages for you and failed jobs.</p>
  <p class="muted" style="margin-top:12px">Alerts never show bank details, amounts or files. Tap an alert to open that thread in Cue.</p></section>
 <section id="on" hidden><h2>Alerts are on <span class="tag good">On</span></h2>
  <div class="card" style="margin-top:12px"><p><b>This phone</b></p><p class="muted" id="since"></p></div>
  <div class="card" id="app" style="margin-top:12px" hidden><p><b>Show alerts as Cue</b></p>
   <p class="muted">Add Cue to your home screen once. Your alerts then say Cue instead of Chrome.</p>
   <p class="muted" id="app-how" hidden>In Chrome, tap ⋮ › Add to Home screen.</p>
   <div class="btns" id="install-row" style="margin-top:10px" hidden><button type="button" class="btn" id="install">Add to home screen</button></div></div>
  <p class="muted" style="margin-top:12px">Change which alerts you get in Cue Settings › Jobs › Phone alerts.</p></section>
 <section id="blocked" hidden><h2>Alerts are blocked <span class="tag crit">Blocked</span></h2>
  <p style="margin-top:12px">Chrome is set to block alerts from this page. To turn them on:</p>
  <ol style="margin-top:8px"><li>Tap the lock icon next to the address.</li><li>Tap Permissions, then Notifications.</li><li>Choose Allow, then come back here.</li></ol></section>
 <p class="err" id="err" role="alert" hidden></p>
 <div class="btns" id="b-off" hidden><button type="button" class="btn pri" id="turn-on">Turn on alerts</button></div>
 <div class="btns" id="b-on" hidden><button type="button" class="btn" id="turn-off">Turn off</button><button type="button" class="btn pri" id="test">Send a test alert</button></div>
 <div class="btns" id="b-blocked" hidden><button type="button" class="btn pri" id="again">Try again</button></div>
</main>
<script>
(function () {
  var KEY = ${JSON.stringify(key)}, CODE = ${JSON.stringify(code)}, $ = function (i) { return document.getElementById(i); };
  function show(s, at) { ['off', 'on', 'blocked'].forEach(function (k) { $(k).hidden = k !== s; $('b-' + k).hidden = k !== s; });
    if (at) { var d = new Date(at); $('since').textContent = 'Chrome on Android · turned on ' + d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); } }
  function err(t) { $('err').textContent = t || ''; $('err').hidden = !t; }
  function post(path, o) { return fetch(path, { method: 'POST', body: JSON.stringify(o) }).then(function (r) { return r.json().then(function (j) { if (!r.ok && j.error) throw new Error(j.error); return j; }); }); }
  function key() { var s = atob(KEY.replace(/-/g, '+').replace(/_/g, '/')), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
  function reg() { return navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(function () { return navigator.serviceWorker.ready; }); }
  function start() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) { show('off'); $('turn-on').disabled = true; return err('This browser cannot get alerts. Open this link in Chrome on your phone.'); }
    if (Notification.permission === 'denied') return show('blocked');
    reg().then(function (r) { return r.pushManager.getSubscription(); }).then(function (s) {
      if (!s) return show('off');
      var j = s.toJSON(); return post('/me', { endpoint: j.endpoint, keys: j.keys }).then(function (m) { show(m.on ? 'on' : 'off', m.at); }, function () { show('off'); });
    }).catch(function () { show('off'); });
  }
  $('turn-on').onclick = function () { var b = this; b.disabled = true; err('');
    if (!CODE) { b.disabled = false; return err('This link has no setup code. Open the setup page again from Cue Settings.'); }
    Notification.requestPermission().then(function (p) {
      if (p !== 'granted') { b.disabled = false; return show(p === 'denied' ? 'blocked' : 'off'); }
      return reg().then(function (r) { return r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key() }); })
        .then(function (s) { return post('/subscribe', { code: CODE, subscription: s.toJSON() }); })
        .then(function (m) { b.disabled = false; show('on', m.at); });
    }).catch(function (e) { b.disabled = false; err(e.message || 'Could not turn on alerts. Try again.'); });
  };
  $('turn-off').onclick = function () { var b = this; b.disabled = true; err('');
    reg().then(function (r) { return r.pushManager.getSubscription(); }).then(function (s) {
      if (!s) return;
      return post('/unsubscribe', { endpoint: s.endpoint }).then(function () { return s.unsubscribe(); });
    }).then(function () { b.disabled = false; show('off'); }, function () { b.disabled = false; err('Could not turn off alerts. Try again.'); });
  };
  $('test').onclick = function () { var b = this; b.disabled = true; err('');
    reg().then(function (r) { return r.pushManager.getSubscription(); }).then(function (s) { return post('/test', { endpoint: s && s.endpoint }); })
      .then(function (r) { b.disabled = false; if (r.result !== 'sent') err('The test alert did not go out. Try again.'); }, function () { b.disabled = false; err('The test alert did not go out. Try again.'); });
  };
  $('again').onclick = function () { start(); };
  var ask = null, app = matchMedia('(display-mode: standalone)').matches || navigator.standalone;   // already on the home screen: no card
  $('app').hidden = !!app; $('app-how').hidden = !!app;
  addEventListener('beforeinstallprompt', function (ev) { ev.preventDefault(); ask = ev; $('install-row').hidden = false; $('app-how').hidden = true; });
  addEventListener('appinstalled', function () { $('app').hidden = true; });
  $('install').onclick = function () { if (!ask) return; ask.prompt(); ask.userChoice.then(function (c) { if (c.outcome === 'accepted') $('app').hidden = true; ask = null; $('install-row').hidden = true; }); };
  start();
})();
</script></body></html>`;
}
