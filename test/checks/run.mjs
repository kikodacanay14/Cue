// Cloud check runner (Kiko 27 Oct 2026: "i dont wanna be tied to that computer all day"; spec specs/cue-cloud-check.md).
// A robot Chromium opens Cue's own page (src/Index.html, the file Apps Script serves) and replaces only google.script.run:
// each call the page makes goes to the Cue check link (src/CueCheck.gs), which runs the same server function in check mode.
// A check script (test/checks/*.check.mjs) types and taps like Kiko and asserts the text Cue shows. Every step is screenshotted.
// Usage: CUE_CHECK_URL=... CUE_CHECK_KEY=... node test/checks/run.mjs test/checks/<name>.check.mjs [out-dir]
// Writes <out-dir>/report.html, results.json and one PNG per step, and a table in $GITHUB_STEP_SUMMARY. Exit 1 on any failure.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const [scriptArg, outArg] = process.argv.slice(2);
const URL_ = process.env.CUE_CHECK_URL, KEY = process.env.CUE_CHECK_KEY;
if (!scriptArg || !URL_ || !KEY) { console.error('usage: CUE_CHECK_URL=... CUE_CHECK_KEY=... node test/checks/run.mjs <script> [out-dir]'); process.exit(2); }
const OUT = path.resolve(outArg || 'check-out');
fs.mkdirSync(OUT, { recursive: true });
const config = JSON.parse(fs.readFileSync(process.env.CUE_CHECK_CONFIG || path.join(ROOT, 'test', 'checks', 'config.json'), 'utf8'));   // CUE_CHECK_CONFIG: dry runs only
const script = (await import(pathToFileURL(path.resolve(scriptArg)).href)).default;

/** One call to the check door. Apps Script answers a POST with a redirect to the result, which fetch follows as a GET. */
async function door(action, extra) {
  const res = await fetch(URL_, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(Object.assign({ action, key: KEY }, extra || {})) });
  const text = await res.text();
  try { return JSON.parse(text); } catch (e) { return { ok: false, error: 'The check link did not answer JSON (HTTP ' + res.status + '): ' + text.slice(0, 200) }; }
}

// google.script.run as the page uses it: withSuccessHandler / withFailureHandler, then the function name.
const SHIM = `(() => {
  const mk = (ok, bad) => new Proxy({}, { get: (_, k) => {
    if (k === 'withSuccessHandler') return f => mk(f, bad);
    if (k === 'withFailureHandler') return f => mk(ok, f);
    if (k === 'withUserObject') return () => mk(ok, bad);
    return (...args) => { window.__cueCall(String(k), JSON.parse(JSON.stringify(args))).then(r => {
      if (r && r.ok) { if (ok) ok(r.result); } else if (bad) bad(new Error((r && r.error) || 'no answer')); }); };
  } });
  window.google = { script: { run: mk(null, null), host: { close() {}, setHeight() {}, setWidth() {}, editor: { focus() {} } },
    url: { getLocation: cb => cb({ hash: '', parameter: {}, parameters: {} }) }, history: { push() {}, replace() {}, setChangeHandler() {} } } };
})();`;

const results = [], calls = [];
let page, browser, n = 0;
const slug = t => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const textOf = () => page.evaluate(() => document.body.innerText);

// What a check script can do. Each waits up to `timeout` ms (default 60 s: Canvas and AI calls can be slow).
const h = {
  config,
  door,
  /** Types in the main chat box and presses Send. */
  async say(text) { await page.fill('#box', text); await page.click('#send'); },
  /** Waits until the page shows the text (string or RegExp); returns the matching text. */
  async see(want, timeout = 60000) {   // a plain string matches in any case (card labels are upper-cased by CSS)
    const re = want instanceof RegExp ? want : new RegExp(want.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const end = Date.now() + timeout;
    for (;;) { const t = await textOf(), m = t.match(re); if (m) return m[0]; if (Date.now() > end) throw new Error('Never showed: ' + re); await page.waitForTimeout(500); }
  },
  /** True when the page shows the text now (no waiting). */
  async has(want) { const re = want instanceof RegExp ? want : new RegExp(want.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); return re.test(await textOf()); },
  /** Fails if the text shows within `ms`. */
  async notSee(want, ms = 3000) {
    await page.waitForTimeout(ms);
    const re = want instanceof RegExp ? want : new RegExp(want.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    if (re.test(await textOf())) throw new Error('Showed but should not: ' + re);
  },
  /** Presses a button (or link) by its visible text: in the newest card that has one, else anywhere on the page. */
  async tap(label, opts = {}) {
    const re = label instanceof RegExp ? label : new RegExp('^\\s*' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$');
    const end = Date.now() + (opts.timeout || 60000);
    for (;;) {
      const inCard = page.locator('.card').filter({ has: page.locator('button, a', { hasText: re }) }).last().locator('button, a', { hasText: re });
      const loc = (await inCard.count()) ? inCard : page.locator('button, a', { hasText: re });
      if (await loc.count() && await loc.first().isVisible()) { await loc.first().click(); return; }
      if (Date.now() > end) throw new Error('No button or link: ' + re);
      await page.waitForTimeout(500);
    }
  },
  /** Answers Cue's own question box (the dialog before Send) with its OK button. */
  async confirm() { const ok = page.locator('#ask-ok'); await ok.waitFor({ state: 'visible', timeout: 15000 }); await ok.click(); },
  /** Ticks or unticks the checkbox in the row that names `name`. */
  async tick(name, on = true) {
    const box = page.locator('label').filter({ hasText: name }).locator('input[type=checkbox]').first();
    await box.waitFor({ timeout: 60000 }); if ((await box.isChecked()) !== on) await box.click();
  },
  /** The checkbox states in the newest card: [{ name, checked, disabled }]. */
  async boxes(attr) {
    return page.$$eval('input[type=checkbox][' + attr + ']', els => els.map(e => ({ value: e.value, checked: e.checked, disabled: e.disabled })));
  },
  /** Fills the first visible field matching the selector. */
  async fill(selector, value) { const f = page.locator(selector).first(); await f.waitFor({ timeout: 60000 }); await f.fill(value); },
  async wait(ms) { await page.waitForTimeout(ms); },
  page: () => page,
  /** Server calls the page made so far (function names), for asserts like "nothing was written". */
  calls: () => calls.slice()
};

async function shot(title) { const f = String(++n).padStart(2, '0') + '-' + slug(title) + '.png'; await page.screenshot({ path: path.join(OUT, f) }); return f; }

let finish = null, fatal = '';
try {
  const ping = await door('check_ping');
  if (!ping.ok) throw new Error('The check link refused the run: ' + ping.error);
  if (ping.project_id !== config.project_id) throw new Error('The check link writes to ' + ping.project_id + ', but config.json names ' + config.project_id);
  if (ping.send !== (config.send === true)) throw new Error('The check link ' + (ping.send ? 'may' : 'may not') + ' email, but config.json says send is ' + (config.send === true));
  const { chromium } = require('playwright');
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await page.exposeFunction('__cueCall', async (fn, args) => { calls.push(fn); return door('check_call', { fn, args }); });
  await page.addInitScript(SHIM);
  const html = fs.readFileSync(path.join(ROOT, 'src', 'Index.html'), 'utf8');
  await page.route('https://cue.check/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: html }));
  await page.goto('https://cue.check/');
  await h.see(ping.version.replace(/^Cue /, ''), 60000).catch(() => {});   // the page has loaded its first state
  for (const step of script.steps) {
    const at = Date.now(), r = { title: step.title, ok: false, ms: 0, error: '', shot: '' };
    // A step may return 'SKIP: why' when what it checks is not offered here; it counts as passed and the report says so.
    try { const got = await step.run(h); r.ok = true; if (typeof got === 'string' && /^SKIP:/.test(got)) r.skipped = got.slice(5).trim(); } catch (e) { r.error = String((e && e.message) || e).slice(0, 600); }
    r.ms = Date.now() - at;
    try { r.shot = await shot(step.title); } catch (e) { r.error += ' (no screenshot: ' + e.message + ')'; }
    results.push(r); console.log((r.ok ? (r.skipped ? 'skip ' : 'ok   ') : 'FAIL ') + step.title + (r.error ? '\n     ' + r.error : r.skipped ? '\n     ' + r.skipped : ''));
    if (!r.ok && step.stopOnFail !== false) break;
  }
} catch (e) { fatal = String((e && e.message) || e); console.error('STOPPED: ' + fatal); }
finally {
  if (browser) await browser.close().catch(() => {});
  finish = await door('check_finish').catch(e => ({ ok: false, error: String(e) }));
}

// The locks are part of the result: anything check mode stopped fails the run, and nothing may be left to send later.
const stopped = (finish && finish.stopped) || [];
const lockOk = !!(finish && finish.ok) && !stopped.length;
const passed = !fatal && results.length === script.steps.length && results.every(r => r.ok) && lockOk;
const out = { name: script.name, build: process.env.GITHUB_SHA || '', passed, fatal, steps: results, finish, calls };
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(out, null, 2));

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const okSteps = results.filter(r => r.ok).length;
fs.writeFileSync(path.join(OUT, 'report.html'), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cue check</title><style>body{font-family:'DM Sans',Arial,sans-serif;margin:0;background:#faf8f5;color:#1d1b22}
.s{height:6px;background:linear-gradient(90deg,#E5322D 0 25%,#F28C28 25% 50%,#F7C934 50% 75%,#6B3FA0 75%)}main{max-width:760px;margin:auto;padding:16px}
.v{border-radius:10px;padding:10px 12px;font-weight:700}.ok{background:#e8f7ee;color:#1f9d55}.no{background:#fdeceb;color:#b42318}
li{margin:10px 0}img{width:100%;border:1px solid #e6e2dc;border-radius:8px;margin-top:6px}.e{color:#b42318;font-size:14px}</style>
<div class="s"></div><main><div style="color:#6b6875">Cue check · ${esc(script.name)}</div><h1 style="margin:4px 0 12px">${passed ? 'Passed' : 'Failed'} ${okSteps} of ${script.steps.length} steps</h1>
<div class="v ${passed ? 'ok' : 'no'}">${passed ? '✓ Ready for your go' : '✗ Not ready: see the red lines'}</div>
${fatal ? `<p class="e">Stopped: ${esc(fatal)}</p>` : ''}
<p>${lockOk ? '✓ Locks held: nothing written outside the test project, no mail outside the test addresses' : '✗ Check mode stopped: ' + esc(stopped.join('; ') || (finish && finish.error) || 'the finish call failed')}.
Closed ${(finish && finish.closed) || 0} check task(s), cancelled ${(finish && finish.later_cancelled) || 0} Send later.</p>
<ol>${results.map(r => `<li>${r.ok ? '✓' : '✗'} <b>${esc(r.title)}</b> <span style="color:#6b6875">${(r.ms / 1000).toFixed(1)} s</span>
${r.error ? `<div class="e">${esc(r.error)}</div>` : ''}${r.skipped ? `<div style="color:#6b6875">Skipped: ${esc(r.skipped)}</div>` : ''}${r.shot ? `<img src="${esc(r.shot)}" alt="${esc(r.title)}">` : ''}</li>`).join('\n')}</ol></main>`);

if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Cue check: ${script.name}: ${passed ? 'PASSED' : 'FAILED'} (${okSteps} of ${script.steps.length} steps)\n\n`
    + (fatal ? `Stopped: ${fatal}\n\n` : '') + `Locks: ${lockOk ? 'held' : 'STOPPED ' + stopped.join('; ')}. Closed ${(finish && finish.closed) || 0} check task(s), cancelled ${(finish && finish.later_cancelled) || 0} Send later.\n\n`
    + '| | Step | Seconds | Problem |\n|---|---|---|---|\n' + results.map(r => `| ${r.ok ? (r.skipped ? '–' : '✓') : '✗'} | ${r.title} | ${(r.ms / 1000).toFixed(1)} | ${(r.error || (r.skipped ? 'skipped: ' + r.skipped : '')).replace(/\|/g, '/').replace(/\n/g, ' ')} |`).join('\n')
    + '\n\nScreenshots and report.html are in the run\'s "cue-check" artifact.\n');
}
console.log(passed ? 'PASSED' : 'FAILED');
process.exit(passed ? 0 : 1);
