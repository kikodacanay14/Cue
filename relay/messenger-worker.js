/* CUE-MSGR-2026-11-02: the Messenger relay (Kiko 2 Nov 2026: "you built the spec you code it"). A Cloudflare Worker between
 * Meta and Cue, because Apps Script cannot read Meta's X-Hub-Signature-256 header and answers POSTs with a redirect.
 *   GET  ?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…  Meta's webhook check: echoes the challenge for the right token.
 *   POST (Meta's message events)  checks the HMAC-SHA256 signature with the app secret, answers Meta at once, then forwards the
 *        body to Cue's relay door as { action: 'msgr_event', key, event }. Nothing is stored here.
 * Secrets (wrangler secret put): VERIFY_TOKEN, APP_SECRET, CUE_URL (Cue's relay /exec address), CUE_KEY (= Cue's MSGR_RELAY_KEY). */
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
const worker = {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (req.method === 'GET') {
      const p = url.searchParams;
      if (p.get('hub.mode') === 'subscribe' && env.VERIFY_TOKEN && same(p.get('hub.verify_token'), env.VERIFY_TOKEN)) return new Response(p.get('hub.challenge') || '', { status: 200 });
      return new Response('Forbidden', { status: 403 });
    }
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    const raw = await req.text(), got = String(req.headers.get('X-Hub-Signature-256') || '').replace(/^sha256=/, '');
    if (!env.APP_SECRET || !same(got, await hmac(env.APP_SECRET, raw))) return new Response('Bad signature', { status: 401 });
    let event;
    try { event = JSON.parse(raw); } catch (e) { return new Response('Bad JSON', { status: 400 }); }
    if (!event || event.object !== 'page') return new Response('Ignored', { status: 200 });
    ctx.waitUntil(fetch(env.CUE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, redirect: 'follow',
      body: JSON.stringify({ action: 'msgr_event', key: env.CUE_KEY, event }) }).catch(() => {}));
    return new Response('EVENT_RECEIVED', { status: 200 });   // Meta wants a fast 200; Cue's answer is not waited for
  }
};
export default worker;
