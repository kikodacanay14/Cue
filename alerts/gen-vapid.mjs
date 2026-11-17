// CUE-ALERTS-2026-11-16: prints a new ES256 key as JWK JSON for `wrangler secret put VAPID_JWK`. Run once: node gen-vapid.mjs
const k = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
console.log(JSON.stringify(await crypto.subtle.exportKey('jwk', k.privateKey)));
