// CUE-MSGR-2026-11-02: node relay/messenger-worker.test.mjs (run by test/features/70-messenger.js). Synthetic data, no network.
import assert from 'node:assert';
import crypto from 'node:crypto';
import worker from './messenger-worker.js';
const env = { VERIFY_TOKEN: 'verify-not-real', APP_SECRET: 'secret-not-real', CUE_URL: 'https://script.google.com/macros/s/CUE/exec', CUE_KEY: 'relay-key-not-real' };
const sent = []; globalThis.fetch = async (u, init) => { sent.push([u, init]); return new Response('{"ok":true}'); };
const ctx = () => { const w = []; return { w, waitUntil: p => w.push(p) }; };
const sig = b => 'sha256=' + crypto.createHmac('sha256', env.APP_SECRET).update(b).digest('hex');
const ev = JSON.stringify({ object: 'page', entry: [{ messaging: [{ sender: { id: '1001' }, message: { text: 'hi' } }] }] });
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok', name); };
await t('GET: right token echoes the challenge; wrong token is 403', async () => {
  let r = await worker.fetch(new Request('https://relay.example/?hub.mode=subscribe&hub.verify_token=verify-not-real&hub.challenge=12345'), env, ctx());
  assert.strictEqual(r.status, 200); assert.strictEqual(await r.text(), '12345');
  r = await worker.fetch(new Request('https://relay.example/?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=12345'), env, ctx());
  assert.strictEqual(r.status, 403);
});
await t('POST: a good signature answers 200 and forwards the event to Cue with the relay key', async () => {
  const c = ctx(), r = await worker.fetch(new Request('https://relay.example/', { method: 'POST', body: ev, headers: { 'X-Hub-Signature-256': sig(ev) } }), env, c);
  assert.strictEqual(r.status, 200); await Promise.all(c.w);
  assert.strictEqual(sent.length, 1); assert.strictEqual(sent[0][0], env.CUE_URL); assert.strictEqual(sent[0][1].redirect, 'follow');
  assert.deepStrictEqual(JSON.parse(sent[0][1].body), { action: 'msgr_event', key: 'relay-key-not-real', event: JSON.parse(ev) });
});
await t('POST: a missing or wrong signature is 401 and nothing is forwarded', async () => {
  const before = sent.length;
  let r = await worker.fetch(new Request('https://relay.example/', { method: 'POST', body: ev }), env, ctx()); assert.strictEqual(r.status, 401);
  r = await worker.fetch(new Request('https://relay.example/', { method: 'POST', body: ev, headers: { 'X-Hub-Signature-256': sig(ev + ' ') } }), env, ctx()); assert.strictEqual(r.status, 401);
  r = await worker.fetch(new Request('https://relay.example/', { method: 'POST', body: ev, headers: { 'X-Hub-Signature-256': sig(ev) } }), Object.assign({}, env, { APP_SECRET: '' }), ctx());
  assert.strictEqual(r.status, 401); assert.strictEqual(sent.length, before);
});
await t('POST: a signed non-page event is answered and not forwarded', async () => {
  const before = sent.length, b = '{"object":"instagram"}';
  const r = await worker.fetch(new Request('https://relay.example/', { method: 'POST', body: b, headers: { 'X-Hub-Signature-256': sig(b) } }), env, ctx());
  assert.strictEqual(r.status, 200); assert.strictEqual(sent.length, before);
});
console.log(n + ' passed');
