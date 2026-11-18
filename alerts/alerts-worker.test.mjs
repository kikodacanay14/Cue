// CUE-ALERTS-2026-11-16: node alerts/alerts-worker.test.mjs (run by Cue's test suite, test/features/99-phone-alerts.js).
// Synthetic data, no network: the push service is stubbed.
import assert from 'node:assert';
import worker from './alerts-worker.js';
const kv = new Map();
const CUE_ALERTS = { put: async (k, v) => { kv.set(k, v); }, get: async k => kv.get(k) || null, delete: async k => { kv.delete(k); },
  list: async ({ prefix, limit }) => ({ keys: [...kv.keys()].filter(k => k.startsWith(prefix)).sort().slice(0, limit || 1000).map(name => ({ name })), list_complete: true }) };
const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const env = { CUE_ALERTS, CUE_ALERTS_KEY: 'ca-key-not-real', VAPID_JWK: JSON.stringify(await crypto.subtle.exportKey('jwk', pair.privateKey)) };
const pushes = [];
let pushStatus = 201;
globalThis.fetch = async (u, init) => { pushes.push({ u: String(u), init }); return new Response('', { status: pushStatus }); };
const call = (path, o, h) => worker.fetch(new Request('https://alerts.example' + path, Object.assign({ method: 'POST', body: JSON.stringify(o || {}) }, h ? { headers: h } : {})), env);
const cue = (path, o) => call(path, o, { Authorization: 'Bearer ' + env.CUE_ALERTS_KEY });
const EP = 'https://fcm.googleapis.com/fcm/send/phone-one-not-real';
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok', name); };

await t('CA1 Cue-only doors refuse a missing or wrong key', async () => {
  for (const p of ['/code', '/send']) { assert.strictEqual((await call(p, {})).status, 403); assert.strictEqual((await call(p, {}, { Authorization: 'Bearer nope' })).status, 403); }
  assert.strictEqual((await worker.fetch(new Request('https://alerts.example/status'), env)).status, 403);
});
await t('CA2 a bad, missing or spent setup code is refused; a good one adds the phone once', async () => {
  const sub = { endpoint: EP, keys: { p256dh: 'x', auth: 'y' } };
  let r = await call('/subscribe', { code: 'deadbeef', subscription: sub }); assert.strictEqual(r.status, 403);
  assert.ok(/expired/.test((await r.json()).error));
  const c = await (await cue('/code')).json();
  assert.ok(/^[a-f0-9]{32}$/.test(c.code) && c.url === 'https://alerts.example/setup?code=' + c.code && c.minutes === 10);
  r = await call('/subscribe', { code: c.code, subscription: sub }); assert.strictEqual(r.status, 200); assert.strictEqual((await r.json()).on, true);
  assert.strictEqual((await call('/subscribe', { code: c.code, subscription: sub })).status, 403, 'one-time code');
  assert.strictEqual((await (await worker.fetch(new Request('https://alerts.example/status', { headers: { Authorization: 'Bearer ' + env.CUE_ALERTS_KEY } }), env)).json()).phones, 1);
  assert.strictEqual((await (await call('/me', { endpoint: EP })).json()).on, true);
});
await t('CA3 send keeps the alert for the phone and sends an empty VAPID-signed push; next hands it over once', async () => {
  pushes.length = 0;
  const r = await (await cue('/send', { title: 'Account Specialist · 2 updates', body: 'KLM party: venue handover', url: 'https://script.google.com/macros/s/X/exec?thread=cue-1', tag: 'cue-1', renotify: false, extra: 'dropped' })).json();
  deepEq([r.phones, r.sent], [1, 1]);
  assert.strictEqual(pushes.length, 1); assert.strictEqual(pushes[0].u, EP);
  const h = pushes[0].init.headers; assert.strictEqual(h['Content-Length'], '0'); assert.ok(!pushes[0].init.body, 'empty push');
  const m = /^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/.exec(h.Authorization); assert.ok(m, h.Authorization);
  const claims = JSON.parse(Buffer.from(m[2], 'base64url').toString()); assert.strictEqual(claims.aud, 'https://fcm.googleapis.com'); assert.strictEqual(claims.sub, 'https://alerts.example');
  assert.ok(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pair.publicKey, Buffer.from(m[3], 'base64url'), new TextEncoder().encode(m[1] + '.' + m[2])), 'ES256 signature checks');
  assert.strictEqual(Buffer.from(m[4], 'base64url').length, 65);
  const got = await (await call('/next', { endpoint: EP })).json();
  deepEq(got.alerts, [{ title: 'Account Specialist · 2 updates', body: 'KLM party: venue handover', url: 'https://script.google.com/macros/s/X/exec?thread=cue-1', tag: 'cue-1', renotify: false }]);
  deepEq((await (await call('/next', { endpoint: EP })).json()).alerts, [], 'handed over once');
  assert.strictEqual((await call('/next', { endpoint: 'https://fcm.googleapis.com/fcm/send/someone-else' })).status, 404);
});
await t('CA4 a non-https url is dropped; test goes to that phone only', async () => {
  await cue('/send', { title: 'x', body: 'y', url: 'javascript:alert(1)', tag: 'a b<c' });
  const a = (await (await call('/next', { endpoint: EP })).json()).alerts[0]; assert.strictEqual(a.url, ''); assert.strictEqual(a.tag, 'abc');
  pushes.length = 0; assert.strictEqual((await (await call('/test', { endpoint: EP })).json()).result, 'sent'); assert.strictEqual(pushes.length, 1);
  assert.strictEqual((await (await call('/next', { endpoint: EP })).json()).alerts[0].title, 'Cue test alert');
});
await t('CA5 a phone the push service no longer knows is removed; Turn off removes the phone', async () => {
  pushStatus = 410; const r = await (await cue('/send', { title: 'x', body: 'y', tag: 't' })).json(); deepEq(r.results, ['gone']);
  assert.strictEqual((await call('/me', { endpoint: EP })).status, 404); pushStatus = 201;
  const c = await (await cue('/code')).json(); await call('/subscribe', { code: c.code, subscription: { endpoint: EP } });
  assert.strictEqual((await (await call('/unsubscribe', { endpoint: EP })).json()).on, false);
  assert.strictEqual((await call('/me', { endpoint: EP })).status, 404);
});
await t('CA6 the setup page carries the public key and the code, and the service worker shows /next alerts', async () => {
  const r = await worker.fetch(new Request('https://alerts.example/setup?code=ab12<x>'), env); const html = await r.text();
  assert.strictEqual(r.status, 200); assert.ok(/frame-ancestors 'none'/.test(r.headers.get('Content-Security-Policy')));
  assert.ok(/worker-src 'self'/.test(r.headers.get('Content-Security-Policy')), 'the page may register /sw.js (Kiko phone, 17 Nov 2026)');
  assert.ok(html.includes('"ab12"') && !html.includes('<script>"'), 'code cleaned');
  for (const s of ['Get Cue alerts on this phone', 'Turn on alerts', 'Alerts are on', 'Send a test alert', 'Turn off', 'Alerts are blocked', 'Try again', 'Alerts never show bank details, amounts or files.']) assert.ok(html.includes(s), s);
  const sw = await (await worker.fetch(new Request('https://alerts.example/sw.js'), env)).text();
  assert.ok(/fetch\('\/next'/.test(sw) && /notificationclick/.test(sw) && /renotify: !!a\.renotify/.test(sw));
  assert.strictEqual((await worker.fetch(new Request('https://alerts.example/setup'), Object.assign({}, env, { VAPID_JWK: '' }))).status, 503);
});
await t('CA8 a tap on an alert with no link opens Cue (the address Cue last sent), else the setup page', async () => {
  kv.delete('cue_home');
  let r = await worker.fetch(new Request('https://alerts.example/open'), env); assert.strictEqual(r.status, 302); assert.strictEqual(r.headers.get('Location'), '/setup');
  await cue('/send', { title: 'x', body: 'y', url: 'https://script.google.com/macros/s/X/exec?thread=cue-9', tag: 't' });
  r = await worker.fetch(new Request('https://alerts.example/open'), env); assert.strictEqual(r.headers.get('Location'), 'https://script.google.com/macros/s/X/exec');
  const sw = await (await worker.fetch(new Request('https://alerts.example/sw.js'), env)).text();
  assert.ok(/\|\| '\/open'; e\.waitUntil\(clients\.openWindow\(u\)\)/.test(sw), 'no link opens /open');
});
await t('CA7 pairing: closed without the window; open once hands Cue\'s key over, then the window is shut', async () => {
  const k = 'k'.repeat(64);
  assert.strictEqual((await call('/pair', { key: k })).status, 403);
  kv.set('pair_open', '1');
  assert.strictEqual((await call('/pair', { key: 'short' })).status, 400);
  assert.strictEqual((await (await call('/pair', { key: k })).json()).paired, true);
  assert.ok(!kv.has('pair_open'));
  assert.strictEqual((await call('/pair', { key: 'x'.repeat(64) })).status, 403, 'only once');
  const r = await worker.fetch(new Request('https://alerts.example/code', { method: 'POST', headers: { Authorization: 'Bearer ' + k } }), Object.assign({}, env, { CUE_ALERTS_KEY: '' }));
  assert.strictEqual(r.status, 200, 'the paired key works without the secret');
  assert.strictEqual((await worker.fetch(new Request('https://alerts.example/code', { method: 'POST' }), Object.assign({}, env, { CUE_ALERTS_KEY: '' }))).status, 403, 'no key, no entry');
});
// CUE-ALERTS-2026-11-18 (Kiko 18 Nov 2026 02:22:47Z: "its a generic message ... show the Cue icon not google chrome").
// A phone-side RFC 8291 decrypter, written apart from the Worker's encrypter and first proved on the RFC's own Appendix A message.
const H = async (k, d) => new Uint8Array(await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', k, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), d));
const B = s => new Uint8Array(Buffer.from(s, 'base64url'));
async function phoneDecrypt(msg, uaPriv, uaPub, auth) {
  msg = new Uint8Array(msg); const salt = msg.slice(0, 16), rs = new DataView(msg.buffer, msg.byteOffset + 16, 4).getUint32(0), idlen = msg[20], asPub = msg.slice(21, 21 + idlen);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: await crypto.subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []) }, uaPriv, 256));
  const ikm = await H(await H(auth, ecdh), Buffer.concat([Buffer.from('WebPush: info\0'), uaPub, asPub, Buffer.from([1])]));
  const prk = await H(salt, ikm);
  const cek = (await H(prk, Buffer.concat([Buffer.from('Content-Encoding: aes128gcm\0'), Buffer.from([1])]))).slice(0, 16);
  const nonce = (await H(prk, Buffer.concat([Buffer.from('Content-Encoding: nonce\0'), Buffer.from([1])]))).slice(0, 12);
  const pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']), msg.slice(21 + idlen)));
  let end = pt.length - 1; while (end > 0 && pt[end] === 0) end--; assert.strictEqual(pt[end], 2, 'last-record delimiter');
  return { rs, idlen, text: Buffer.from(pt.slice(0, end)).toString() };
}
await t('CA9 the alert rides inside the push, encrypted for that phone only (RFC 8291); Google sees no alert text', async () => {
  const vPub = B('BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4');
  const vPriv = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', d: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94', x: Buffer.from(vPub.slice(1, 33)).toString('base64url'), y: Buffer.from(vPub.slice(33)).toString('base64url') }, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  const rfc = await phoneDecrypt(B('DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN'), vPriv, vPub, B('BTBZMqHH6r4Tts7J_aSIgg'));
  assert.strictEqual(rfc.text, 'When I grow up, I want to be a watermelon', 'test decrypter matches RFC 8291 Appendix A');
  const ua = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']), uaPub = new Uint8Array(await crypto.subtle.exportKey('raw', ua.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16)), keys = { p256dh: Buffer.from(uaPub).toString('base64url'), auth: Buffer.from(auth).toString('base64url') };
  const EP2 = 'https://fcm.googleapis.com/fcm/send/phone-two-not-real';
  const c = await (await cue('/code')).json(); await call('/subscribe', { code: c.code, subscription: { endpoint: EP2, keys } });
  pushes.length = 0; for (const k of [...kv.keys()]) if (k.startsWith('p:')) kv.delete(k);
  const alert = { title: '8 AM update: 3 items for your OK', body: 'KLM party: approve the venue deposit', url: 'https://script.google.com/macros/s/X/exec?thread=k0', tag: 'cue-k0', renotify: true };
  const r = await (await cue('/send', alert)).json(); assert.strictEqual(r.sent, 1);
  const h = pushes[0].init.headers; assert.strictEqual(h['Content-Encoding'], 'aes128gcm'); assert.strictEqual(h['Content-Type'], 'application/octet-stream');
  const body = pushes[0].init.body; assert.strictEqual(String(body.length), h['Content-Length']);
  assert.ok(!Buffer.from(body).toString('latin1').includes('8 AM'), 'no alert text in the clear');
  const got = await phoneDecrypt(body, ua.privateKey, uaPub, auth); assert.strictEqual(got.rs, 4096); assert.strictEqual(got.idlen, 65);
  deepEq(JSON.parse(got.text), alert);
  assert.ok(![...kv.keys()].some(k => k.startsWith('p:')), 'nothing waits in KV when the alert rides in the push');
  await call('/unsubscribe', { endpoint: EP2 });
});
await t('CA10 a phone set up before its keys were kept hands them over at /next, and later alerts ride in the push', async () => {
  const c = await (await cue('/code')).json(); await call('/subscribe', { code: c.code, subscription: { endpoint: EP } });
  pushes.length = 0; await cue('/send', { title: 'Old phone', body: 'b', tag: 't' }); assert.strictEqual(pushes[0].init.headers['Content-Length'], '0', 'no keys: empty push');
  const ua = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']), uaPub = new Uint8Array(await crypto.subtle.exportKey('raw', ua.publicKey)), auth = crypto.getRandomValues(new Uint8Array(16));
  const keys = { p256dh: Buffer.from(uaPub).toString('base64url'), auth: Buffer.from(auth).toString('base64url') };
  assert.strictEqual((await (await call('/next', { endpoint: EP, keys: { p256dh: 'bad', auth: 'bad' } })).json()).alerts[0].title, 'Old phone', 'bad keys are ignored, the alert still comes');
  await call('/next', { endpoint: EP, keys });
  pushes.length = 0; await cue('/send', { title: 'Now in the push', body: 'b', tag: 't' });
  deepEq(JSON.parse((await phoneDecrypt(pushes[0].init.body, ua.privateKey, uaPub, auth)).text).title, 'Now in the push');
  await call('/unsubscribe', { endpoint: EP });
});
await t('CA11 the Cue logo: alerts carry icon and badge, the Worker serves them and the home-screen manifest; the page offers Add to home screen', async () => {
  for (const [p, size] of [['/icon-192.png', 192], ['/icon-512.png', 512], ['/badge.png', 96]]) {
    const r = await worker.fetch(new Request('https://alerts.example' + p), env); assert.strictEqual(r.headers.get('Content-Type'), 'image/png');
    const b = Buffer.from(await r.arrayBuffer()); assert.strictEqual(b.toString('latin1', 1, 4), 'PNG'); assert.strictEqual(b.readUInt32BE(16), size, p + ' width');
  }
  const m = await (await worker.fetch(new Request('https://alerts.example/manifest.webmanifest'), env)).json();
  deepEq([m.name, m.short_name, m.display, m.start_url, m.icons.map(i => i.sizes)], ['Cue', 'Cue', 'standalone', '/setup', ['192x192', '512x512']]);
  const sw = await (await worker.fetch(new Request('https://alerts.example/sw.js'), env)).text();
  assert.ok(/icon: '\/icon-192\.png', badge: '\/badge\.png'/.test(sw) && (sw.match(/badge: LOOK\.badge/g) || []).length === 2, 'every alert, even the generic line, has the Cue icon and badge');
  assert.ok(/e\.data && e\.data\.json\(\)/.test(sw) && /waits = \[0, 2000, 5000, 10000, 20000\]/.test(sw) && /keys: j\.keys/.test(sw), 'push data first, then /next with retries');
  const r = await worker.fetch(new Request('https://alerts.example/setup?code=ab'), env), html = await r.text(), csp = r.headers.get('Content-Security-Policy');
  assert.ok(/img-src 'self'/.test(csp) && /manifest-src 'self'/.test(csp));
  for (const s of ['<link rel="manifest" href="/manifest.webmanifest">', '<img class="logo" src="/icon-192.png"', 'Show alerts as Cue', 'Add to home screen', 'beforeinstallprompt', 'Add to Home screen.']) assert.ok(html.includes(s), s);
});
await t('CA12 the service worker runs: push text shows at once with the Cue look; an empty push asks /next again until the alert arrives', async () => {
  const src = await (await worker.fetch(new Request('https://alerts.example/sw.js'), env)).text();
  const shown = [], ls = {}, waits = []; let nextCalls = 0, readyAt = 3;
  const self = { addEventListener: (n, f) => { ls[n] = f; }, skipWaiting() {}, clients: { claim() {} },
    registration: { showNotification: async (title, o) => { shown.push(Object.assign({ title }, o)); }, pushManager: { getSubscription: async () => ({ toJSON: () => ({ endpoint: EP, keys: { p256dh: 'k', auth: 'a' } }) }) } } };
  const fetch = async (u, init) => { nextCalls++; const b = JSON.parse(init.body); assert.deepStrictEqual(b.keys, { p256dh: 'k', auth: 'a' });
    return new Response(JSON.stringify({ alerts: nextCalls >= readyAt ? [{ title: 'Late alert', body: 'b', tag: 't', url: '', renotify: true }] : [] })); };
  const setTimeout = (f, ms) => { waits.push(ms); f(); };
  new Function('self', 'fetch', 'setTimeout', 'clients', src)(self, fetch, setTimeout, {});
  const push = async data => { let p; ls.push({ data, waitUntil: x => { p = x; } }); await p; };
  await push({ json: () => ({ title: 'Agent · KLM', body: 'Venue confirmed', tag: 'cue-7', url: 'https://x.example/', renotify: true }) });
  deepEq([shown[0].title, shown[0].body, shown[0].icon, shown[0].badge, shown[0].data.url, nextCalls], ['Agent · KLM', 'Venue confirmed', '/icon-192.png', '/badge.png', 'https://x.example/', 0]);
  await push(null); deepEq([shown[1].title, nextCalls, waits], ['Late alert', 3, [2000, 5000]], 'asked again after 2 s and 5 s');
  nextCalls = 0; readyAt = 99; waits.length = 0; await push(null);
  deepEq([shown[2].title, shown[2].body, shown[2].icon, nextCalls, waits], ['Cue', 'Open Cue to see what is new.', '/icon-192.png', 5, [2000, 5000, 10000, 20000]], 'generic line only after about 37 s');
});
function deepEq(a, b, m) { assert.deepStrictEqual(a, b, m); }
console.log(n + ' alerts worker tests passed');
