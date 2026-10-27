// Dry run of the cloud check with no Google and no Canvas: a local check link answers with Cue's real server code in the test
// sandbox (test/cue.test.js: Canvas, Gmail and the AI are mocked), and the runner drives the real page against it. It proves the
// runner, the page stand-in and a check script work together before a real run. Needs Playwright with Chromium.
// Usage: node test/checks/dry-run.mjs [test/checks/<name>.check.mjs] [out-dir]
// DRY_BOX=tx adds the Transfers sheet and Canvas's invoice list (txBox); DRY_BOX=chase adds RFQ and accreditation chasers (chaseBox); DRY_CONFIG=<file> takes a script's own config.
// DRY_DOC=AR tries Make on an AR; DRY_SEND=no runs it as on a real stand-in project (send locked, finish without sending).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const { sandbox, checkCode, CHECK_KEY, CHECK_PID, txBox, chaseBox } = require('../cue.test.js');
const script = process.argv[2] || path.join(HERE, '1.27.33-crew-docs.check.mjs'), out = process.argv[3] || path.join(os.tmpdir(), 'cue-check-dry');

// The sandbox's crew (FSA_ITEMS): Juan Cruz has an email and is registered, Ana Reyes is not registered, Carla Lim has no email.
const t = ({ tx: txBox, chase: chaseBox }[process.env.DRY_BOX] || sandbox)({ code: checkCode({ until: Date.parse('2030-01-01T00:00:00Z'), send: process.env.DRY_SEND === 'no' ? 'no' : 'on' }), notReg: ['Ana Reyes'], step: 50 });
const config = process.env.DRY_CONFIG ? Object.assign(JSON.parse(fs.readFileSync(process.env.DRY_CONFIG, 'utf8')), { project_id: CHECK_PID, send: process.env.DRY_SEND !== 'no' }) : { project_id: CHECK_PID, project_name: CHECK_PID, doc: process.env.DRY_DOC || 'FSA', send: process.env.DRY_SEND !== 'no', mail: '^kiko\\+[a-z0-9-]+@example\\.com$' };
const cfgFile = path.join(os.tmpdir(), 'cue-check-dry-config.json');
fs.writeFileSync(cfgFile, JSON.stringify(config));

const server = http.createServer((req, res) => {
  let body = ''; req.on('data', c => { body += c; });
  req.on('end', () => { let text; try { text = t.ctx.doPost({ postData: { contents: body } }).text; } catch (e) { text = JSON.stringify({ ok: false, error: String(e) }); }
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(text); });
});
server.listen(0, '127.0.0.1', () => {
  const url = 'http://127.0.0.1:' + server.address().port + '/exec';
  // Not spawnSync: this process must keep answering the runner's calls while it runs.
  spawn(process.execPath, [path.join(HERE, 'run.mjs'), script, out], { stdio: 'inherit',
    env: Object.assign({}, process.env, { CUE_CHECK_URL: url, CUE_CHECK_KEY: CHECK_KEY, CUE_CHECK_CONFIG: cfgFile }) }).on('exit', code => {
    server.close();
    console.log('Dry run: Canvas got ' + t.log.bridge.map(b => b.action + (b.project_id ? ' ' + b.project_id : '')).join(', '));
    console.log('Report: ' + path.join(out, 'report.html'));
    process.exit(code);
  });
});
