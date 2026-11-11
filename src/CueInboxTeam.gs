/* The AI team's daily jobs (Kiko 11 Nov 2026: "the goal is for things to run without me", "do not include me in any step", then
 * "okay lets do that" to: each role wakes on a schedule, asks the other roles through the sheet, and the Account Manager has
 * the final say). Once a day after 08:00 Manila, cueResume runs each role's job below: one AI call with the role's instructions
 * and a small piece of real data. The role writes a short note on the Team Daily tab and may send up to 2 Questions or Confirms
 * to other roles on the Team Requests tab, which the intake sends on the next run. Nothing here sends email, spends money or
 * changes Canvas: the only Canvas call is the read-only project board. At most 2 jobs per cueResume run, so no run is long.
 * Charter PO and Chase PO have no data source in Cue yet, so they have no daily job; they still answer Questions. */

const CUE_TEAM_JOBS_ = [
  ['Canvas PO', 'board', 'Look at the Canvas project board below. Name the projects at risk (event soon but still in an early phase, or '
    + 'stuck) and what Canvas or the team should do. Ask the Tech Lead (BSE Apps & Systems) to confirm any change to Canvas you propose.'],
  ['ChatGPT Account Manager', 'board', 'Look at the events below from the client side: what could go wrong for each client in the next 14 '
    + 'days, and what should happen this week. Ask the Canvas PO a Question if something is unclear.'],
  ['Cue PO', 'jobs', 'Look at Cue\'s background jobs that failed in the last 24 hours below. Name the likely cause of each and a fix. Ask '
    + 'QA how to test the fix.'],
  ['QA', 'jobs', 'Look at the failures below. Point out the ones that repeat and the test that would catch each. Ask the Cue PO a '
    + 'Question if the cause is unclear.'],
  ['BSE Apps & Systems', 'decisions', 'Look at the team\'s decisions from the last 24 hours below. Name any you would reverse and why. '
    + 'Send a Confirm to the Account Manager only for one you think must be reversed.']];
const CUE_TEAM_SCHEMA_ = { type: 'object', additionalProperties: false, required: ['note', 'requests'], properties: {
  note: { type: 'string' },
  requests: { type: 'array', maxItems: 2, items: { type: 'object', additionalProperties: false, required: ['to', 'kind', 'message'], properties: {
    to: { type: 'string' }, kind: { type: 'string', enum: ['Question', 'Confirm'] }, message: { type: 'string' } } } } } };

/** Runs from cueResume. Returns how many jobs ran this time. */
function cueTeamDaily_() {
  const now = cueNow_(), day = cueMnlDay_(now), hour = new Date(now + 8 * 3600e3).getUTCHours();
  if (hour < 8) return 0;
  const props = PropertiesService.getScriptProperties();
  const chats = cueInboxRows_('Inbox Chats', CUE_INBOX_CHAT_COLS_).filter(c => c.v[3] === 'Active' && c.v[8]);
  if (!chats.length) return 0;   // the role chats are not set up
  // Claim the jobs under the lock before any AI call (Codex on PR #376): two overlapping runs never pick the same job. A claimed
  // job counts as done for the day even if its call then fails (the failure is written to Team Daily).
  const todo = cueLocked_(() => {
    const st = String(props.getProperty('CUE_TEAM_DAY') || '').split('|');
    const done = st[0] === day ? (st[1] ? st[1].split(',') : []) : [];
    const pick = CUE_TEAM_JOBS_.filter(j => done.indexOf(j[0]) < 0 && chats.some(c => c.v[2] === j[0])).slice(0, 2);
    if (pick.length) props.setProperty('CUE_TEAM_DAY', day + '|' + done.concat(pick.map(j => j[0])).join(','));
    return pick;
  });
  if (!todo.length) return 0;
  const ctx = {};
  let ran = 0;
  todo.forEach(j => {
    const chat = chats.filter(c => c.v[2] === j[0])[0];
    let data = ''; try { data = ctx[j[1]] = ctx[j[1]] || cueTeamContext_(j[1], now); } catch (e) { data = '(could not read: ' + cueStr_(e.message || e, 200) + ')'; }
    const others = chats.filter(c => c.v[2] !== j[0]).map(c => c.v[2] + ' (' + c.v[8] + ')').join(', ');
    const o = { step: 'Team daily', system: cueInboxRoleSystem_(chat.v[8], chat.v[2]), memory: false, maxTokens: 2000, schema: CUE_TEAM_SCHEMA_, name: 'team_daily',
      user: 'Your daily job (' + day + '): ' + j[2] + '\nKeep the note under 120 words. Send at most 2 requests, only when they help; "to" must be one of: '
        + others + '. Use only the role name before the bracket.\n\nData:\n' + data };
    const call = chat.v[1] === 'ChatGPT API' ? cueGpt_(o) : cueClaude_(Object.assign(o, { effort: 'low' }));
    const r = cueAiAll_({ id: 'TEAM-' + day + '-' + j[0], metrics: { ai_calls: 0, calls: [] } }, [call])[0];
    ran++;
    if (!r.ok) { cueSheet_('Team Daily').appendRow([day, j[0], 'Did not run: ' + cueStr_(r.error, 300), 0]); return; }
    const reqs = (r.data.requests || []).filter(q => q && chats.some(c => c.v[2].toLowerCase() === String(q.to || '').trim().toLowerCase())).slice(0, 2);
    reqs.forEach((q, i) => cueSheet_('Team Requests').appendRow([cueInboxId_('TR'), String(q.to).trim(), q.kind, '', cueStr_(q.message, 3000), j[0], '', '', '', '', '', '']));
    cueSheet_('Team Daily').appendRow([day, j[0], cueStr_(r.data.note, 2000), reqs.length]);
  });
  return ran;
}

/** A small, read-only piece of real data for a job. */
function cueTeamContext_(kind, now) {
  if (kind === 'board') {
    const s = { id: 'TEAM-BOARD', metrics: { ai_calls: 0, calls: [] } };
    const ps = ((cueBridge_(s, 'get_project_board', {}) || {}).projects || []).filter(p => p && p.id && CUE_INBOX_OPEN_PHASES_.indexOf(String(p.phase || '')) >= 0);
    return ps.slice(0, 40).map(p => [p.name, p.status, p.phase, p.eventDate || p.date || ''].join(' | ')).join('\n') || 'No open projects.';
  }
  if (kind === 'jobs') {
    const sh = cueSheet_('Job Runs'), n = sh.getLastRow(); if (n < 2) return 'No job runs.';
    // Read back in blocks of 500 until a row is older than 24 hours (Codex on PR #376): Job Runs grows every 5 minutes.
    let rows = [], end = n;
    while (end >= 2) {
      const from = Math.max(2, end - 499), part = sh.getRange(from, 1, end - from + 1, 6).getValues();
      rows = part.concat(rows); end = from - 1;
      if (part.some(r => now - new Date(r[0]).getTime() >= 24 * 3600e3)) break;
    }
    const bad = {};
    rows.filter(r => now - new Date(r[0]).getTime() < 24 * 3600e3 && String(r[3]) !== 'OK').forEach(r => {
      const k = String(r[2]); bad[k] = bad[k] || { n: 0, err: '' }; bad[k].n++; bad[k].err = cueStr_(r[4], 200) || bad[k].err; });
    return Object.keys(bad).map(k => k + ': failed ' + bad[k].n + ' times; last error: ' + bad[k].err).join('\n') || 'No failures in the last 24 hours.';
  }
  if (kind === 'decisions') {
    const msgs = {}; cueInboxRows_('Inbox Messages', CUE_INBOX_MSG_COLS_).forEach(m => { msgs[m.v[0]] = m.v; });
    return cueInboxRows_('Inbox Decisions', CUE_INBOX_DEC_COLS_).filter(d => now - new Date(d.v[3]).getTime() < 24 * 3600e3)
      .map(d => [d.v[2], 'by ' + d.v[5], cueStr_((msgs[d.v[1]] || [])[5], 200), 'reason: ' + cueStr_(d.v[4], 160)].join(' | ')).join('\n') || 'No decisions in the last 24 hours.';
  }
  return '';
}
