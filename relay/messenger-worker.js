/* CUE-MSGR-2026-11-02: the Messenger relay (Kiko 2 Nov 2026: "you built the spec you code it"). A Cloudflare Worker between
 * Meta and Cue. Cue's web app is Google sign-in only, so Meta cannot post to it; instead this relay holds Meta's events and Cue
 * collects them every 5 minutes with its key.
 *   GET  /?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…  Meta's webhook check: echoes the challenge for the right token.
 *   POST /        Meta's message events: the HMAC-SHA256 signature is checked with the app secret, then the event is held (7 days).
 *   GET  /events  Cue only (Authorization: Bearer CUE_KEY): up to 50 held events, oldest first, as { events: [{ id, event }] }.
 *   POST /ack     Cue only: { ids: [...] } drops the events Cue has handled.
 *   GET  /connect?state=…  CUE-MSGR-CONNECT-2026-11-04 (Kiko 4 Nov 02:31Z: no pastes): sends Kiko to Facebook sign-in for the app.
 *   GET  /oauth   Facebook's return: swaps the code (with APP_SECRET, which only the relay holds) for the Page's token, makes a new
 *                 relay key for Cue, and holds both for 10 minutes under the sign-in's state. Nothing changes unless Facebook
 *                 hands over the token of PAGE_ID, so only an admin of that Page can connect.
 *   GET  /claim?proof=…  Cue only, once: takes the held key and Page token. Cue keeps a random 64-hex proof and sends only its
 *                 SHA-256 as the sign-in's state (as PKCE does), so Facebook and the browser never see what /claim needs.
 *   POST /sync    CUE-MSGR-INSTANT-2026-11-05, Cue only: { token?, linked?: [psid] } keeps the Page token and who is linked crew.
 *   Instant taps (Kiko 5 Nov 11:53Z "right after I click I'm crew, automatically there's a response"; 12:00Z "Yes, ship it"): a tap
 *                 on I'm crew or Client or inquiry from someone not linked is answered here at once, with Cue's own words
 *                 (TAP_SAY_, kept equal to CUE_MSGR_SAY_ by Cue's test MS22); the held event is marked relay_replied so Cue does
 *                 not answer it again. Everything else still waits for Cue's 1-minute collection.
 * Bindings: KV namespace MSGR_EVENTS. Vars: APP_ID, PAGE_ID, optional LOGIN_CONFIG_ID (Facebook Login for Business).
 * Secrets (wrangler secret put): VERIFY_TOKEN, APP_SECRET; CUE_KEY is optional now (a key made by /oauth is kept in KV). */
const enc = new TextEncoder();
const hex = buf => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
async function hmac(secret, body) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(body)));
}
function same(a, b) {   // constant-time compare of two strings
  a = String(a || ''); b = String(b || '');
  if (!a || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const json = (o, status) => new Response(JSON.stringify(o), { status: status || 200, headers: { 'Content-Type': 'application/json' } });
const bearer = req => String(req.headers.get('Authorization') || '').replace(/^Bearer /, '');
async function isCue(req, env) {   // the wrangler secret CUE_KEY, or the key made by the last Facebook sign-in (KV "cue_key")
  const got = bearer(req), kept = await env.MSGR_EVENTS.get('cue_key');
  return same(got, env.CUE_KEY) || same(got, kept);
}
const GRAPH = 'https://graph.facebook.com/v21.0/';
// Cue's CUE_MSGR_SAY_.crew and .help, word for word (Kiko's approved texts).
const TAP_SAY_ = {
  TRI_CREW: 'Welcome to the crew po. Reply ka lang dito with your full name and event, and our team will help you.',
  TRI_CLIENT: 'Happy to help po. Ano pong maitutulong namin? Share mo lang kung para saan ang message mo.'
};
/** Answers each tap it can, at once. Marks what it answered on the event. Never throws: Cue answers whatever this misses. */
async function answerTaps(env, event) {
  let token = '', linked = [];
  try { token = await env.MSGR_EVENTS.get('page_token') || ''; linked = JSON.parse(await env.MSGR_EVENTS.get('linked') || '[]'); } catch (e) { return; }
  if (!token) return;
  for (const en of event.entry || []) for (const m of (en && en.messaging) || []) {
    const psid = String((m.sender || {}).id || ''), msg = m.message || {};
    const say = TAP_SAY_[String((m.postback || {}).payload || (msg.quick_reply || {}).payload || '')];
    if (!say || !/^\d{1,40}$/.test(psid) || msg.is_echo || linked.indexOf(psid) >= 0) continue;
    try {
      const r = await fetch(GRAPH + 'me/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ recipient: { id: psid }, messaging_type: 'RESPONSE', message: { text: say } }) });
      if (r.ok) m.relay_replied = true;
    } catch (e) { /* Cue answers it */ }
  }
}
const STATE = /^[0-9a-f]{64}$/;
const sha = async t => hex(await crypto.subtle.digest('SHA-256', enc.encode(t)));
const page = (title, text, status) => new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
  + '<title>' + title + '</title><body style="font:16px system-ui,sans-serif;max-width:520px;margin:48px auto;padding:0 16px"><h2>' + title + '</h2><p>' + text + '</p></body>',
  { status: status || 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
async function graph(path, params) {
  const r = await fetch(GRAPH + path + '?' + new URLSearchParams(params));
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error((j.error && j.error.message) || ('Facebook answered ' + r.status));
  return j;
}
/** Facebook sign-in finished: the Page's token for PAGE_ID, or an error. Long-lived user token first, so the Page token does not expire. */
async function pageToken(env, code, redirect) {
  const short = await graph('oauth/access_token', { client_id: env.APP_ID, client_secret: env.APP_SECRET, redirect_uri: redirect, code });
  const long = await graph('oauth/access_token', { grant_type: 'fb_exchange_token', client_id: env.APP_ID, client_secret: env.APP_SECRET, fb_exchange_token: short.access_token });
  const pg = await graph(encodeURIComponent(env.PAGE_ID), { fields: 'access_token,name', access_token: long.access_token });
  if (!pg.access_token) throw new Error('This Facebook account cannot manage the Page');
  return pg.access_token;
}
const worker = {
  async fetch(req, env) {
    const url = new URL(req.url), path = url.pathname.replace(/\/+$/, '') || '/';
    if (path === '/connect' && req.method === 'GET') {
      const state = url.searchParams.get('state') || '';
      if (!STATE.test(state) || !env.APP_ID) return page('Not connected', 'Start again from Cue › Settings › Connections › Messenger.', 400);
      const q = { client_id: env.APP_ID, redirect_uri: url.origin + '/oauth', state, response_type: 'code' };
      if (env.LOGIN_CONFIG_ID) q.config_id = env.LOGIN_CONFIG_ID; else q.scope = 'pages_messaging,pages_show_list,pages_manage_metadata';
      return Response.redirect('https://www.facebook.com/v21.0/dialog/oauth?' + new URLSearchParams(q), 302);
    }
    if (path === '/oauth' && req.method === 'GET') {
      const p = url.searchParams, state = p.get('state') || '', code = p.get('code') || '';
      if (!STATE.test(state) || !code) return page('Not connected', 'Facebook did not finish the sign-in. Start again from Cue.', 400);
      if (!env.APP_ID || !env.APP_SECRET || !env.PAGE_ID) return page('Not connected', 'The relay is missing its app settings.', 500);
      let token;
      try { token = await pageToken(env, code, url.origin + '/oauth'); }
      catch (e) { return page('Not connected', 'Facebook said: ' + String(e.message || e).replace(/[<>&"]/g, '').slice(0, 200) + '. Nothing was changed.', 400); }
      const key = 'mr_' + hex(crypto.getRandomValues(new Uint8Array(32)));
      await env.MSGR_EVENTS.put('claim:' + state, JSON.stringify({ key, token }), { expirationTtl: 600 });
      await env.MSGR_EVENTS.put('cue_key', key);
      return page('Connected', 'Go back to Cue and press <b>Finish</b>. You can close this tab.');
    }
    if (path === '/claim' && req.method === 'GET') {
      const proof = url.searchParams.get('proof') || '';
      if (!STATE.test(proof)) return json({ error: 'Not allowed.' }, 403);
      const id = 'claim:' + await sha(proof), v = await env.MSGR_EVENTS.get(id);
      if (!v) return json({ error: 'Nothing to collect. Press Connect Facebook again.' }, 404);
      await env.MSGR_EVENTS.delete(id);
      return json(JSON.parse(v));
    }
    if (path === '/events' && req.method === 'GET') {
      if (!(await isCue(req, env))) return json({ error: 'Not allowed.' }, 403);
      const list = await env.MSGR_EVENTS.list({ prefix: 'e:', limit: 50 }), events = [];
      for (const k of list.keys) { const v = await env.MSGR_EVENTS.get(k.name); if (v) events.push({ id: k.name, event: JSON.parse(v) }); }
      return json({ events });
    }
    if (path === '/sync' && req.method === 'POST') {
      if (!(await isCue(req, env))) return json({ error: 'Not allowed.' }, 403);
      let b = {}; try { b = await req.json(); } catch (e) { return json({ error: 'Bad JSON' }, 400); }
      if (typeof b.token === 'string' && /^[A-Za-z0-9_.|-]{20,1000}$/.test(b.token)) await env.MSGR_EVENTS.put('page_token', b.token);
      if (Array.isArray(b.linked)) await env.MSGR_EVENTS.put('linked', JSON.stringify(b.linked.map(String).filter(x => /^\d{1,40}$/.test(x)).slice(0, 5000)));
      return json({ ok: true });
    }
    if (path === '/ack' && req.method === 'POST') {
      if (!(await isCue(req, env))) return json({ error: 'Not allowed.' }, 403);
      let ids = []; try { ids = (await req.json()).ids || []; } catch (e) { return json({ error: 'Bad JSON' }, 400); }
      const ok = ids.filter(id => /^e:\d{13}:[0-9a-f]{8}$/.test(String(id))).slice(0, 100);
      await Promise.all(ok.map(id => env.MSGR_EVENTS.delete(id)));
      return json({ dropped: ok.length });
    }
    if (req.method === 'GET') {
      const p = url.searchParams;
      if (p.get('hub.mode') === 'subscribe' && env.VERIFY_TOKEN && same(p.get('hub.verify_token'), env.VERIFY_TOKEN)) return new Response(p.get('hub.challenge') || '', { status: 200 });
      return new Response('Forbidden', { status: 403 });
    }
    if (req.method !== 'POST' || path !== '/') return new Response('Not found', { status: 404 });
    const raw = await req.text(), got = String(req.headers.get('X-Hub-Signature-256') || '').replace(/^sha256=/, '');
    if (!env.APP_SECRET || !same(got, await hmac(env.APP_SECRET, raw))) return new Response('Bad signature', { status: 401 });
    let event;
    try { event = JSON.parse(raw); } catch (e) { return new Response('Bad JSON', { status: 400 }); }
    if (!event || event.object !== 'page') return new Response('Ignored', { status: 200 });
    await answerTaps(env, event);
    const id = 'e:' + String(Date.now()).padStart(13, '0') + ':' + hex(crypto.getRandomValues(new Uint8Array(4)));
    await env.MSGR_EVENTS.put(id, JSON.stringify(event), { expirationTtl: 7 * 24 * 3600 });
    return new Response('EVENT_RECEIVED', { status: 200 });
  }
};
export default worker;
