// Part of test/cue.test.js: STRUCTURE-PHASE-3 3.3 (Kiko 28 Oct 2026 06:05Z): one project finder (cueCanvasFind_ in CueCanvas.gs).

test('PF1 the one finder: an S- id as typed; else every word (search_projects); else a similar name; one exact name wins', () => {
  const UNI = [{ project_id: 'S-40000001UN', name: 'Unilever Town Hall', account: 'Unilever', date: '2026-11-20', status: 'Proposal' },
    { project_id: 'S-40000002UN', name: 'Unilever Sports Fest', account: 'Unilever', date: '2026-10-01', status: 'Completed' }];
  const t = sandbox({ search: { unilever: { projects: UNI, total: 2 }, 'unilever town hall': { projects: UNI.slice(0, 1), total: 1 } }, similar: [] });
  const s = { id: 'pf-1' };
  deq(Array.from(t.ctx.cueCanvasFind_(s, 'S-40000002UN'), x => x.project_id), ['S-40000002UN']);
  const all = t.ctx.cueCanvasFind_(s, 'Unilever');
  deq(Array.from(all, x => [x.project_id, x.status]), [['S-40000001UN', 'Proposal'], ['S-40000002UN', 'Completed']], 'status comes along for callers that skip done projects');
  assert.ok(!t.log.bridge.some(b => b.action === 'find_similar_projects'), 'a word match needs no similar-name read');
  deq(Array.from(t.ctx.cueCanvasFind_(s, 'Unilever Town Hall'), x => x.project_id), ['S-40000001UN']);
  const u = sandbox({ similar: [UNI[1]] });
  deq(Array.from(u.ctx.cueCanvasFind_(s, 'Sports Fest 2026'), x => x.project_id), ['S-40000002UN'], 'no word match: similar name');
});

test('PF2 every command that turns a project name into a Canvas project asks the one finder; find_similar_projects is left only to the intake duplicate check', () => {
  const src = f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
  ['CueAr.gs', 'CueReady.gs', 'CueVendor.gs', 'CueCeCost.gs', 'CueExpense.gs', 'CueTri.gs'].forEach(f => assert.ok(/cueCanvasFind_\(s, /.test(src(f)), f + ' uses the finder'));
  const direct = fs.readdirSync(path.join(__dirname, '..', 'src')).filter(f => /\.gs$/.test(f) && /cueBridge_\(s, 'find_similar_projects'|\['find_similar_projects', \{/.test(src(f))).sort();
  deq(direct, ['CueCanvas.gs', 'CueIntake.gs', 'CueIntakePhases.gs'], 'the finder itself, and the duplicate check before a new project');
});
