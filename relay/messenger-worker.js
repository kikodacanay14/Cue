/* CUE-MSGR-2026-11-02: the Messenger relay (Kiko 2 Nov 2026: "you built the spec you code it"). A Cloudflare Worker between
 * Meta and Cue. Cue's web app is Google sign-in only, so Meta cannot post to it; instead this relay holds Meta's events and Cue
 * collects them every 5 minutes with its key.
 *   GET  /?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…  Meta's webhook check: echoes the challenge for the right token.
 *   POST /        Meta's message events: the HMAC-SHA256 signature is checked with the app secret, then the event is held (7 days).
 *   GET  /events  Cue only (Authorization: Bearer CUE_KEY): up to 50 held events, oldest first, as { events: [{ id, event }] }.
 *   POST /ack     Cue only: { ids: [...] } drops the events Cue has handled.
 * Bindings: KV namespace MSGR_EVENTS. Secrets (wrangler secret put): VERIFY_TOKEN, APP_SECRET, CUE_KEY. */
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
const isCue = (req, env) => !!env.CUE_KEY && same(String(req.headers.get('Authorization') || '').replace(/^Bearer /, ''), env.CUE_KEY);
const worker = {
  async fetch(req, env) {
    const url = new URL(req.url), path = url.pathname.replace(/\/+$/, '') || '/';
    if (path === '/events' && req.method === 'GET') {
      if (!isCue(req, env)) return json({ error: 'Not allowed.' }, 403);
      const list = await env.MSGR_EVENTS.list({ prefix: 'e:', limit: 50 }), events = [];
      for (const k of list.keys) { const v = await env.MSGR_EVENTS.get(k.name); if (v) events.push({ id: k.name, event: JSON.parse(v) }); }
      return json({ events });
    }
    if (path === '/ack' && req.method === 'POST') {
      if (!isCue(req, env)) return json({ error: 'Not allowed.' }, 403);
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
    const id = 'e:' + String(Date.now()).padStart(13, '0') + ':' + hex(crypto.getRandomValues(new Uint8Array(4)));
    await env.MSGR_EVENTS.put(id, raw, { expirationTtl: 7 * 24 * 3600 });
    return new Response('EVENT_RECEIVED', { status: 200 });
  }
};
export default worker;
