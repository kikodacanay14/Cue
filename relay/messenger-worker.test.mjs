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

// CUE-MSGR-CONNECT-2026-11-04: Connect Facebook. Facebook's Graph API is stubbed; nothing goes online.
const proof = 'a'.repeat(64), state = crypto.createHash('sha256').update(proof).digest('hex');
const cenv = Object.assign({}, env, { CUE_KEY: '', APP_ID: '585331855684370', PAGE_ID: '110499580567237', LOGIN_CONFIG_ID: '' });
const calls = [];
function fb(pageOk) {
  globalThis.fetch = async u => { u = String(u); calls.push(u);
    const body = u.includes('fb_exchange_token') ? { access_token: 'long-user' } : u.includes('oauth/access_token') ? { access_token: 'short-user' }
      : pageOk ? { access_token: 'PAGE-TOKEN-not-real', name: 'Blank Space Events' } : { error: { message: 'Unsupported get request' } };
    return new Response(JSON.stringify(body), { status: body.error ? 400 : 200 }); };
}
const go = (p, e) => worker.fetch(new Request('https://relay.example' + p), e || cenv);
await t('connect: a good state goes to Facebook sign-in for the app with the relay /oauth return; a bad state is refused', async () => {
  let r = await go('/connect?state=' + state); assert.strictEqual(r.status, 302);
  const to = new URL(r.headers.get('Location'));
  assert.strictEqual(to.origin + to.pathname, 'https://www.facebook.com/v21.0/dialog/oauth');
  assert.strictEqual(to.searchParams.get('client_id'), '585331855684370'); assert.strictEqual(to.searchParams.get('state'), state);
  assert.strictEqual(to.searchParams.get('redirect_uri'), 'https://relay.example/oauth'); assert.ok(to.searchParams.get('scope').includes('pages_messaging'));
  r = await go('/connect?state=' + state, Object.assign({}, cenv, { LOGIN_CONFIG_ID: '123' }));
  assert.strictEqual(new URL(r.headers.get('Location')).searchParams.get('config_id'), '123');
  assert.strictEqual((await go('/connect?state=short')).status, 400);
  assert.ok(!r.headers.get('Location').includes(proof), 'the proof never goes to Facebook');
});
await t('oauth: an account that cannot manage the Page changes nothing', async () => {
  fb(false); const before = kv.size;
  const r = await go('/oauth?code=c1&state=' + state); assert.strictEqual(r.status, 400);
  assert.ok((await r.text()).includes('Nothing was changed')); assert.strictEqual(kv.size, before); assert.strictEqual(kv.get('cue_key'), undefined);
});
await t('oauth: a Page admin sign-in makes a key and holds key + Page token for Cue; the app secret stays in the relay', async () => {
  fb(true); calls.length = 0;
  const r = await go('/oauth?code=c2&state=' + state); assert.strictEqual(r.status, 200);
  const html = await r.text(); assert.ok(html.includes('Finish')); assert.ok(!html.includes('PAGE-TOKEN') && !html.includes('mr_'));
  assert.ok(/^mr_[0-9a-f]{64}$/.test(kv.get('cue_key')));
  assert.ok(calls[0].includes('code=c2') && calls[0].includes('redirect_uri=https%3A%2F%2Frelay.example%2Foauth'));
  assert.ok(calls[2].includes('110499580567237?fields=access_token'));
});
await t('claim: wrong proof gets nothing; the right proof gets key + token once; the new key opens /events', async () => {
  assert.strictEqual((await go('/claim?proof=' + state)).status, 404, 'the public state is not the proof');
  assert.strictEqual((await go('/claim?proof=x')).status, 403);
  const got = await (await go('/claim?proof=' + proof)).json();
  assert.strictEqual(got.token, 'PAGE-TOKEN-not-real'); assert.strictEqual(got.key, kv.get('cue_key'));
  assert.strictEqual((await go('/claim?proof=' + proof)).status, 404, 'one time only');
  const ok = await worker.fetch(new Request('https://relay.example/events', { headers: { Authorization: 'Bearer ' + got.key } }), cenv);
  assert.strictEqual(ok.status, 200);
  const no = await worker.fetch(new Request('https://relay.example/events', { headers: { Authorization: 'Bearer ' } }), cenv);
  assert.strictEqual(no.status, 403, 'an empty key never matches');
});

// CUE-MSGR-INSTANT-2026-11-05: the relay answers I'm crew and Client or inquiry taps at once.
await t('instant taps: only Cue can sync; a tap from someone not linked is answered at once and marked; linked crew, other taps and typed words wait for Cue', async () => {
  kv.clear();
  assert.strictEqual((await worker.fetch(new Request('https://relay.example/sync', { method: 'POST', body: '{"token":"x"}' }), env)).status, 403);
  const tok = 'EAAPageTokenNotReal0123456789';
  assert.strictEqual((await cue('/sync', { method: 'POST', body: JSON.stringify({ token: tok, linked: ['1001', 'x'] }) })).status, 200);
  assert.strictEqual(kv.get('page_token'), tok); assert.strictEqual(kv.get('linked'), '["1001"]');
  const sent = [];
  globalThis.fetch = async (u, init) => { sent.push([String(u), JSON.parse(init.body), init.headers.Authorization]); return new Response('{"message_id":"m"}', { status: 200 }); };
  const body = JSON.stringify({ object: 'page', entry: [{ messaging: [
    { sender: { id: '2002' }, postback: { title: "I'm crew", payload: 'TRI_CREW' } },
    { sender: { id: '3003' }, postback: { title: 'Client or inquiry', payload: 'TRI_CLIENT' } },
    { sender: { id: '1001' }, postback: { title: "I'm crew", payload: 'TRI_CREW' } },
    { sender: { id: '4004' }, postback: { title: 'Get Started', payload: 'TRI_START' } },
    { sender: { id: '5005' }, message: { text: "I'm crew" } }] }] });
  assert.strictEqual((await post(body, { 'X-Hub-Signature-256': sig(body) })).status, 200);
  assert.deepStrictEqual(sent.map(x => [x[0], x[1].recipient.id, x[1].message.text, x[2]]), [
    ['https://graph.facebook.com/v21.0/me/messages', '2002', 'Welcome to the crew po. Reply ka lang dito with your full name and event, and our team will help you.', 'Bearer ' + tok],
    ['https://graph.facebook.com/v21.0/me/messages', '3003', 'Happy to help po. Ano pong maitutulong namin? Share mo lang kung para saan ang message mo.', 'Bearer ' + tok]]);
  const held = JSON.parse([...kv.entries()].find(([k]) => k.startsWith('e:'))[1]).entry[0].messaging;
  assert.deepStrictEqual(held.map(m => !!m.relay_replied), [true, true, false, false, false]);
});
await t('instant taps: Facebook refusing the send leaves the event unmarked, so Cue answers it', async () => {
  kv.clear(); kv.set('page_token', 'EAAPageTokenNotReal0123456789');
  globalThis.fetch = async () => new Response('{"error":{"message":"no"}}', { status: 400 });
  const body = JSON.stringify({ object: 'page', entry: [{ messaging: [{ sender: { id: '2002' }, postback: { payload: 'TRI_CREW' } }] }] });
  await post(body, { 'X-Hub-Signature-256': sig(body) });
  assert.ok(!JSON.parse([...kv.entries()].find(([k]) => k.startsWith('e:'))[1]).entry[0].messaging[0].relay_replied);
  kv.clear();
  await post(body, { 'X-Hub-Signature-256': sig(body) });   // no token yet: nothing sent, held as before
  assert.strictEqual([...kv.keys()].filter(k => k.startsWith('e:')).length, 1);
});
console.log(n + ' passed');
