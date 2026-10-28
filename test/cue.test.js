// Local tests for Cue. Apps Script services, GPT, Claude, the Canvas bridge and Gmail are mocked; synthetic data only, no network.
// Bridge calls are checked against the real bridge schema in fixtures/ZapBridge.gs (an exact copy of Canvas src/ZapBridge.gs;
// fixtures/ZapBridge.version names the version and md5). Run: node test/cue.test.js
//
// STRUCTURE-PHASE-1 (Kiko 28 Oct 2026 03:47Z, specs/cue-structure-review.md item 1.4): the tests live in test/features/, one file
// per feature, 00-harness.js first. They load in file-name order into one shared scope, exactly as the single file did, so a
// helper or fixture in one part is still visible to the parts after it. A feature's tests go in its file; a new feature can add
// the next numbered file.
const fs = require('fs'), vm = require('vm'), path = require('path');
const DIR = path.join(__dirname, 'features');
Object.assign(globalThis, { require, __dirname });   // the parts read fixtures and src/ relative to test/, as before
for (const f of fs.readdirSync(DIR).filter(f => /^\d\d-.*\.js$/.test(f)).sort()) {
  vm.runInThisContext(fs.readFileSync(path.join(DIR, f), 'utf8'), { filename: path.join(DIR, f) });
}
const T = vm.runInThisContext('({ tests, sandbox, checkCode, CHECK_KEY, CHECK_PID, txBox, chaseBox })');

if (require.main !== module) module.exports = { sandbox: T.sandbox, checkCode: T.checkCode, CHECK_KEY: T.CHECK_KEY, CHECK_PID: T.CHECK_PID, txBox: T.txBox, chaseBox: T.chaseBox };   // test/checks/dry-run.mjs reuses the sandbox
else {
  let pass = 0;
  for (const [n, f] of T.tests) { try { f(); pass++; console.log('ok   ' + n); } catch (e) { console.log('FAIL ' + n + '\n     ' + (e.stack || e).toString().split('\n').slice(0, +(process.env.LINES || 3)).join('\n     ')); } }
  console.log(pass + '/' + T.tests.length + ' passed');
  process.exit(pass === T.tests.length ? 0 : 1);
}
