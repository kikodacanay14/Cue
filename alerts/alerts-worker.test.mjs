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
  assert.ok(html.includes('"ab12"') && !html.includes('<script>"'), 'code cleaned');
  for (const s of ['Get Cue alerts on this phone', 'Turn on alerts', 'Alerts are on', 'Send a test alert', 'Turn off', 'Alerts are blocked', 'Try again', 'Alerts never show bank details, amounts or files.']) assert.ok(html.includes(s), s);
  const sw = await (await worker.fetch(new Request('https://alerts.example/sw.js'), env)).text();
  assert.ok(/fetch\('\/next'/.test(sw) && /notificationclick/.test(sw) && /renotify: !!a\.renotify/.test(sw));
  assert.strictEqual((await worker.fetch(new Request('https://alerts.example/setup'), Object.assign({}, env, { VAPID_JWK: '' }))).status, 503);
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
function deepEq(a, b, m) { assert.deepStrictEqual(a, b, m); }
console.log(n + ' alerts worker tests passed');
