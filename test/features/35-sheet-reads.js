// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: sheet-reads.
// CUE-SHEET-READS-2026-10-27 (spec specs/bridge-sheet-reads.md): allow-listed records tabs come through read_rows; the rest stay direct.
const SR_TR = { book: 'scopes', tab: 'Transfers', key: 'Request ID', mode: 'read', columns: ['Request ID', 'PAID AMOUNT', 'CONFIRMATION NUMBER'], writable: [],
  rows: Array.from({ length: 1200 }, (_, i) => ({ _row: i + 2, 'Request ID': 'PR-' + (i + 1), 'PAID AMOUNT': '1,250.00', 'CONFIRMATION NUMBER': 'REF' + (1000 + i) })) };
const srBox = (allow) => { const t = gtBox({ allow }); const pr = gridSheet([['Request ID', 'Payee', 'Amount'], ['PR-9', 'Ana', 500]]);
  t.tabs['Payment Request'] = pr; return t; };
test('SH1 a records tab on the allow-list is read through read_rows in 500-row pages (no direct read); one not on it stays direct; P0 never goes through the bridge', () => {
  const t = srBox([SR_TR, { book: 'priority', tab: 'P0', key: 'Company', mode: 'read', columns: ['Company'], writable: [], rows: [] }]);
  const s = { id: 'cue-sh1', notes: [], gt: {} };
  const tr = t.ctx.cueGtTry_(s, 'transfers');
  assert.strictEqual(tr.rows.length, 1200, 'every page read'); assert.strictEqual(tr.rows[1199]['Request ID'], 'PR-1200'); assert.strictEqual(tr.rows[0]._row, 2);
  deq(tr.head, ['Request ID', 'PAID AMOUNT', 'CONFIRMATION NUMBER']);
  const reads = t.log.readRows.filter(a => a.tab === 'Transfers'); deq(reads.map(a => [a.start || 0, a.limit]), [[0, 500], [500, 500], [1000, 500]]);
  const pr = t.ctx.cueGtTry_(s, 'payreq'); assert.strictEqual(pr.rows[0].Payee, 'Ana', 'not on the allow-list: read direct as before');
  assert.ok(!t.log.readRows.some(a => a.tab === 'Payment Request' || a.tab === 'P0'), 'no bridge read for a tab not listed, nor for P0');
  assert.strictEqual(t.log.bridge.filter(b => b.action === 'allow_list').length, 1, 'the allow-list is read once per run');
  assert.strictEqual(s.notes.length, 0);
});
test('SH2 the personal-expense check reads Transfers through read_rows when it is allowed; text amounts and references match as before', () => {
  const t = srBox([SR_TR]); const s = { id: 'cue-sh2', notes: [], gt: {} };
  const b = t.ctx.cuePeBse_(s);
  assert.strictEqual(b.tr.rows.length, 1200); assert.strictEqual(b.tr.rows[4][b.tr.col('CONFIRMATION NUMBER')], 'REF1004');
  assert.strictEqual(b.pr.rows[0][b.pr.col('Payee')], 'Ana', 'Payment Request not allowed: direct');
});
test('GT9 PC test 22 Oct: Canvas not answering the project list is tried once more, then stops with Try again (never "Nothing new, all passed"); one miss recovers', () => {
  const P = [{ id: 'S-10000001AA', name: 'Acme Gala', status: 'For Production Start', eventDate: '2026-10-30' }];
  const t = gtBox({ board404: 9, projects: P }); const v = t.ctx.cueRun(t.ctx.cueSend('friday readiness', [], '').request_id);
  assert.strictEqual(t.log.board, 2, 'tried twice'); assert.strictEqual(v.status, 'Failed'); assert.ok(/Canvas projects could not be read: Canvas did not answer get_project_board \(HTTP 404\)/.test(v.error), v.error);
  assert.strictEqual(t.log.gpt.length, 0, 'no ChatGPT call on nothing');
  const u = gtBox({ board404: 1, projects: P, gpt: { gtask: { summary: 'Fine.', coverage: { checked: 'Canvas checklists', not_checked: 'none' }, steps: [1, 2, 3, 4, 5].map(n => ({ step: n, done: true, note: '' })), findings: [] } } });
  const w = u.ctx.cueRun(u.ctx.cueSend('friday readiness', [], '').request_id);
  assert.strictEqual(u.log.board, 2); assert.ok(!(w.gt.fails || []).length || !/Canvas/.test(w.gt.checks.find(c => c.id === 8).detail)); assert.ok(u.log.gpt[0].input.indexOf('Acme Gala') >= 0);
});
test('GT11 PC test 22 Oct: a ChatGPT task\'s thread is named for its skill and its chat lines never say "Project intake"', () => {
  const t = gtBox(); const id = t.ctx.cueSend('plan my day', [], '').request_id; const v = t.ctx.cueRun(id);
  assert.ok(/^Daily plan \d\d\/\d\d$/i.test(v.name) || v.name === v.gt.title, 'name: ' + v.name); assert.strictEqual(v.name, v.gt.title);
  t.ctx.cueGtClose(id);
  const lines = t.tabs.Chat.rows.filter(x => x[3] === id || x[3] === '>' + id).map(x => x[2]);
  assert.ok(lines.length && !lines.some(x => /Project intake/.test(x)), lines.join(' | '));
});
test('GT10 PC test 22 Oct: "What was checked" keeps ChatGPT\'s plain words and drops talk of its instructions or the records tags', () => {
  const t = gtBox({ gpt: { gtask: Object.assign({}, GT_ANS, { coverage: { checked: 'All records between <records> tags were reviewed. The Tasks tab and TRI rows due today.', not_checked: 'LinkedIn (sign-in). Nothing outside the prompt.' } }) } });
  const v = t.ctx.cueRun(t.ctx.cueSend('plan my day', [], '').request_id);
  assert.strictEqual(v.gt.coverage.checked, 'The Tasks tab and TRI rows due today.'); assert.strictEqual(v.gt.coverage.not_checked, 'LinkedIn (sign-in).');
  assert.ok(/Never mention tags/.test(t.log.gpt[0].instructions || JSON.stringify(t.log.gpt[0])));
});

test('TU20 live 01:22Z: Go or Change on a plan card runs the started request right away, like a send', () => {
  const html = cuePage();
  assert.ok(/call\('cueAskPick', \[id, b\.getAttribute\('data-pick'\)\], started, fail\)/.test(html), 'Go/Not that use started');
  assert.ok(/call\('cueAskPick', \[id, 'change', v\], started, fail\)/.test(html), 'Change uses started');
  assert.ok(/var started = function \(r\) \{ done\(\); if \(!r \|\| r\.chat \|\| !r\.request_id\) return;[\s\S]{0,80}call\('cueRun', \[r\.request_id\]/.test(html), 'started kicks cueRun only for a run');
});

test('SC9 PC test 01:41Z: a Time cell Sheets turned into a date reads back as HH:mm, not "Sat Dec 30 1899"', () => {
  const t = sandbox({});
  t.ctx.cueSchedSeed_();
  const rows = t.tabs.Schedule.rows, i = rows.findIndex((r, k) => k > 0 && r[0]);
  rows[i][7] = new Date(1899, 11, 30, 7, 5, 0);
  const x = t.ctx.cueSchedRead_(t.tabs.Schedule).filter(y => y.id === rows[i][0])[0];
  assert.strictEqual(x.time, '07:05');
  rows[i][7] = "'16:00"; assert.strictEqual(t.ctx.cueSchedRead_(t.tabs.Schedule).filter(y => y.id === rows[i][0])[0].time, '16:00');
});

test('TU21 PC test 01:41Z: a preview marks the pushed Cue.gs as the test build, and its Go taps never count toward graduation', () => {
  const tool = fs.readFileSync(path.join(__dirname, '..', 'tools', 'deploy.mjs'), 'utf8'), cue = fs.readFileSync(path.join(__dirname, '..', 'src', 'Cue.gs'), 'utf8');
  assert.ok(/^const CUE_DEV_ = false;$/m.test(cue), 'src keeps the live value');
  assert.ok(/if \(mode === 'preview'\) \{[\s\S]{0,400}replace\(\/\^const CUE_DEV_ = false;\/m, 'const CUE_DEV_ = true;'\)[\s\S]{0,200}want\['Cue\.gs'\] = md5\(f\)/.test(tool), 'preview stamps only the pushed copy and checks head against it');
  const tut = fs.readFileSync(path.join(__dirname, '..', 'src', 'CueTutor.gs'), 'utf8');
  assert.ok(/if \(!CUE_DEV_\) \{[^\n]*\n\s+try \{ const p = cuePatApprove_/.test(tut), 'graduation counted only off /dev');
});

test('RD20 live 01:29Z: the readiness card returns what it built, and cardHtml survives a card that draws nothing', () => {
  const html = cuePage();
  const body = html.slice(html.indexOf('function readyCardHtml('), html.indexOf('\n  }\n', html.indexOf('function readyCardHtml(')) + 4);
  assert.ok(/\n    return h;[^\n]*\n  }$/.test(body), 'readyCardHtml ends with return h');
  assert.ok(/var h = cardBody\(r\) \|\| '';/.test(html), 'cardHtml guards an empty card');
});

test('TU21 22 Oct: a learned pattern under 3 Go taps shows Reset, which puts its count back to 0; graduated shows Demote; a count of 0 shows neither', () => {
  const t = sandbox({ tutor: true, plan: PLAN() });
  ['a', 'b'].forEach(x => t.ctx.cuePatApprove_('Supplier search: find suppliers for <item>', 'vendor', 'find ' + x, null));
  ['a', 'b', 'c'].forEach(x => t.ctx.cuePatApprove_('Readiness check: is <project> ready?', 'readiness', 'is ' + x + ' ready', null));
  t.ctx.cuePatApprove_('ARs: prepare ARs', 'ar', 'prepare ars', null);
  let v = t.ctx.cueMyPatternDemote('ARs: prepare ARs');
  deq(v.patterns.map(x => [x.key, x.n, x.graduated]), [['Readiness check: is <project> ready?', 3, true], ['Supplier search: find suppliers for <item>', 2, false], ['ARs: prepare ARs', 0, false]]);
  const html = cuePage();
  const a = html.indexOf('function patternsHtml('), src = html.slice(a, html.indexOf('\n  }\n', a) + 4);
  const run = vm.runInNewContext('(' + src + ')', { myPat: true, esc: x => String(x).replace(/[<>&"]/g, c => '&#' + c.charCodeAt(0) + ';') });
  const out = run(v.patterns), btn = k => { const m = out.split('<div').filter(r => r.indexOf(k) >= 0)[0].match(/data-my="demote"[^>]*>(\w+)</); return m ? m[1] : ''; };
  deq([btn('Readiness'), btn('Supplier'), btn('ARs')], ['Demote', 'Reset', '']);
});
