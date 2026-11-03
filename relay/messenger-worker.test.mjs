// CUE-MSGR-2026-11-02: node relay/messenger-worker.test.mjs (run by Cue's test suite). Synthetic data, no network.
import assert from 'node:assert';
import crypto from 'node:crypto';
import worker from './messenger-worker.js';
const kv = new Map();
const MSGR_EVENTS = { put: async (k, v) => { kv.set(k, v); }, get: async k => kv.get(k) || null, delete: async k => { kv.delete(k); },
  list: async ({ prefix, limit }) => ({ keys: [...kv.keys()].filter(k => k.startsWith(prefix)).sort().slice(0, limit).map(name => ({ name })) }) };
const env = { VERIFY_TOKEN: 'verify-not-real', APP_SECRET: 'secret-not-real', CUE_KEY: 'mr_relay-key-not-real', MSGR_EVENTS };
const sig = b => 'sha256=' + crypto.createHmac('sha256', env.APP_SECRET).update(b).digest('hex');
const ev = JSON.stringify({ object: 'page', entry: [{ messaging: [{ sender: { id: '1001' }, message: { text: 'hi' } }] }] });
const post = (b, h) => worker.fetch(new Request('https://relay.example/', { method: 'POST', body: b, headers: h || {} }), env);
const cue = (path, init) => worker.fetch(new Request('https://relay.example' + path, Object.assign({ headers: { Authorization: 'Bearer ' + env.CUE_KEY } }, init || {})), env);
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok', name); };
await t('GET: right token echoes the challenge; wrong token is 403', async () => {
  let r = await worker.fetch(new Request('https://relay.example/?hub.mode=subscribe&hub.verify_token=verify-not-real&hub.challenge=12345'), env);
  assert.strictEqual(r.status, 200); assert.strictEqual(await r.text(), '12345');
  r = await worker.fetch(new Request('https://relay.example/?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=12345'), env);
  assert.strictEqual(r.status, 403);
});
await t('POST: a good signature is held; a missing, wrong or keyless signature is 401 and nothing is held', async () => {
  assert.strictEqual((await post(ev)).status, 401);
  assert.strictEqual((await post(ev, { 'X-Hub-Signature-256': sig(ev + ' ') })).status, 401);
  assert.strictEqual((await worker.fetch(new Request('https://relay.example/', { method: 'POST', body: ev, headers: { 'X-Hub-Signature-256': sig(ev) } }), Object.assign({}, env, { APP_SECRET: '' }))).status, 401);
  assert.strictEqual(kv.size, 0);
  const r = await post(ev, { 'X-Hub-Signature-256': sig(ev) }); assert.strictEqual(r.status, 200); assert.strictEqual(kv.size, 1);
  assert.ok(/^e:\d{13}:[0-9a-f]{8}$/.test([...kv.keys()][0]));
});
await t('POST: a signed non-page event is answered and not held', async () => {
  const b = '{"object":"instagram"}'; assert.strictEqual((await post(b, { 'X-Hub-Signature-256': sig(b) })).status, 200); assert.strictEqual(kv.size, 1);
});
await t('Cue collects with its key, acks, and the events are gone; without the key it gets 403', async () => {
  assert.strictEqual((await worker.fetch(new Request('https://relay.example/events'), env)).status, 403);
  assert.strictEqual((await worker.fetch(new Request('https://relay.example/events', { headers: { Authorization: 'Bearer wrong' } }), env)).status, 403);
  const got = await (await cue('/events')).json();
  assert.strictEqual(got.events.length, 1); assert.deepStrictEqual(got.events[0].event, JSON.parse(ev));
  const a = await (await cue('/ack', { method: 'POST', body: JSON.stringify({ ids: [got.events[0].id, 'not-an-id'] }) })).json();
  assert.strictEqual(a.dropped, 1); assert.strictEqual(kv.size, 0);
  assert.strictEqual((await worker.fetch(new Request('https://relay.example/ack', { method: 'POST', body: '{"ids":[]}' }), env)).status, 403);
});
console.log(n + ' passed');
