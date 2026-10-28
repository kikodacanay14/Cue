// Part of test/cue.test.js: STRUCTURE-PHASE-3 3.1 (Kiko 28 Oct 2026 06:05Z): the background job list (CueJobs.gs) and its Job Runs tab.

test('JR1 each tick writes one Job Runs row per job in this build, in order, in one write; a failed job is a Failed row and the next job still runs', () => {
  const t = sandbox();
  const names = t.ctx.cueJobs_().filter(j => typeof t.ctx[j.fn] === 'function').map(j => j.job);
  assert.ok(names.length >= 6 && names[names.length - 1] === 'Schedules', 'the scheduler runs last');
  t.ctx.cueMaTick_ = () => { throw new Error('Gmail down\nat line 2'); };
  t.ctx.cuePlogFlush_ = () => ({ added: 3, skipped: 0 });
  let writes = 0; const real = t.ctx.cueSheet_;
  t.ctx.cueSheet_ = tab => { const sh = real(tab); if (tab === 'Job Runs' && !sh.__w) { const g = sh.getRange; sh.getRange = (...a) => { const r = g(...a); const sv = r.setValues; r.setValues = v => { writes++; return sv(v); }; return r; }; sh.__w = 1; } return sh; };
  t.ctx.cueResume();
  const rows = t.tabs['Job Runs'].rows;
  deq(rows[0], ['Started', 'Finished', 'Job', 'Result', 'Error', 'Count']);
  deq(rows.slice(1).map(r => r[2]), Array.from(names));
  assert.strictEqual(writes, 1, 'one write for the whole tick');
  const ma = rows.find(r => r[2] === 'Emails waiting check'), pl = rows.find(r => r[2] === 'Project log');
  deq([ma[3], ma[4]], ['Failed', 'Gmail down']);
  deq([pl[3], pl[4], pl[5]], ['OK', '', 3]);
  assert.ok(rows.slice(1).every(r => /^\d{4}-\d\d-\d\dT/.test(r[0]) && r[1] >= r[0]));
});

test('JR2 a job whose function this build lacks is skipped with no row; a Job Runs write that fails never stops the tick', () => {
  const t = sandbox();
  const missing = t.ctx.cueJobs_().filter(j => typeof t.ctx[j.fn] !== 'function').map(j => j.job);
  t.ctx.cueResume();
  assert.ok(!t.tabs['Job Runs'].rows.some(r => missing.includes(r[2])));
  const u = sandbox(); const real = u.ctx.cueSheet_;
  u.ctx.cueSheet_ = tab => { if (tab === 'Job Runs') throw new Error('sheet full'); return real(tab); };
  assert.doesNotThrow(() => u.ctx.cueResume());
});

test('JR3 Kiko 06:08Z "Yes, keep 30 days": once a day the rows started more than 30 days ago are deleted, and only those', () => {
  const t = sandbox(); t.ctx.cueResume();
  const sh = t.tabs['Job Runs'], now = Date.parse(sh.rows[1][0]);
  const at = d => new Date(now - d * 864e5).toISOString();
  sh.rows.splice(1, 0, [at(40), at(40), 'Project log', 'OK', '', ''], [at(31), at(31), 'Project log', 'OK', '', ''], [at(29), at(29), 'Project log', 'OK', '', '']);
  t.props.CUE_JOB_TRIM_DAY = '';
  const before = sh.rows.length;
  t.ctx.cueResume();
  assert.ok(!sh.rows.some(r => r[0] === at(40) || r[0] === at(31)), 'older than 30 days: gone');
  assert.ok(sh.rows.some(r => r[0] === at(29)), '29 days: kept');
  const after = sh.rows.length; t.ctx.cueResume();
  assert.ok(sh.rows.length > after && before > 1, 'same day: no second trim, rows only added');
  assert.strictEqual(t.props.CUE_JOB_TRIM_DAY, sh.rows[sh.rows.length - 1][0].slice(0, 10));
});
