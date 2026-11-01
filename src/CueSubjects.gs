/* CUE-SUBJECTS-2026-10-30 (Kiko 30 Oct 2026 03:24:56Z "i felt overwhelmed by this. coz there's so many... then i realized that
 * some of these are duplicates as well. can we remove the duplicates?"; picked "Yes, both changes" on the card "Clean up Ask Cue as
 * shown in the After picture?" 03:55:23Z; picture https://claude.ai/artifact/VZ3edagU6YpS8V4fsR9WdM).
 * Two changes to what a scheduled job leaves in Ask Cue's thread list. Neither sends, writes or calls AI.
 *   1 Old runs close. When a scheduled job posts today's run, its own runs from earlier Manila days that still wait (Needs you or
 *     Failed) close, with one line in their thread. Their cards stay readable under Closed. This replaces the 24 Oct choice that
 *     bids and ChatGPT tasks wait for the "Close older runs" tap; the button stays for anything older. A phased intake never closes.
 *   2 One thread per subject. The jobs below share one thread a day, named "<Subject> · <Day> <d Mon>". The first of them to run
 *     today starts it; the others join it (s.ref), so each card still shows, in one place. The unscheduled check's question joins
 *     the Morning thread when it is there.
 * Only the scheduler calls this (cueSchedRun_), so a run Kiko starts by typing keeps its own thread. */

const CUE_SUBJECTS_ = {
  morning: { title: 'Morning', jobs: ['sweep', 'gtask:daily_plan'] },
  sales: { title: 'Sales', jobs: ['funnel', 'gtask:followups', 'gtask:admin_funnel'] },
  friday: { title: 'Friday events', jobs: ['status', 'gtask:production_readiness'] }
};
const CUE_SUBJ_OLD_ = { bids: 1, gtask: 1, status: 1, relnotes: 1 };   // sweep and funnel already close their own older runs

/** The scheduler's job a saved task belongs to, in the Schedule tab's Run words ('gtask:daily_plan', 'bids'), or ''. */
function cueSubjJob_(s) {
  if (!s || !s.kind) return '';
  if (s.kind === 'gtask') return s.gt && s.gt.key ? 'gtask:' + s.gt.key : '';
  return s.kind;
}
const cueSubjOf_ = job => Object.keys(CUE_SUBJECTS_).filter(k => CUE_SUBJECTS_[k].jobs.indexOf(job) >= 0)[0] || '';
/** "Fri 30 Oct" for a Manila day. */
function cueSubjDay_(day) {
  const d = new Date(Date.parse(day + 'T00:00:00Z'));
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
}

/** Today's thread for a subject: the id of the task that started it, or ''. */
function cueSubjRoot_(key) {
  const today = cueMnlDay_(cueNow_());
  let root = '';
  cueRows_(cueSheet_('Requests')).forEach(r => {
    if (root) return;
    let x = null; try { x = JSON.parse(r.slice(10, 10 + CUE_CELLS_).join('')); } catch (e) { return; }
    if (x && x.subject && x.subject.key === key && x.subject.day === today && !x.ref) root = x.id;
  });
  return root;
}

/** After a scheduled job started task `id`: closes the job's waiting runs from earlier days, then files the task in its subject's
 * thread for today. Returns { closed, subject, ref }. A failure is logged and never stops the job. */
function cueSchedTidy_(id) {
  const out = { closed: [], subject: '', ref: '' };
  if (!id) return out;
  try {
    const L = cueLoad_(id); if (!L) return out;
    const job = cueSubjJob_(L.s), today = cueMnlDay_(cueNow_());
    if (job && CUE_SUBJ_OLD_[L.s.kind]) {
      out.closed = cueCloseSuperseded_(x => x.id !== id && cueSubjJob_(x) === job && !x.phased && !x.approved_at
        && x.created && cueMnlDay_(Date.parse(x.created)) < today, 'Closed: today\'s run of this job replaced it. Nothing was sent or changed.', true);
    }
    const key = cueSubjOf_(job); if (!key) return out;
    const root = cueSubjRoot_(key);
    cueLocked_(() => {
      const M = cueLoad_(id); if (!M) return;
      M.s.subject = { key, day: today, title: CUE_SUBJECTS_[key].title + ' · ' + cueSubjDay_(today) };
      if (root && root !== id && !M.s.ref) M.s.ref = root;
      cueSave_(M.sh, M.row, M.s);
      out.subject = key; out.ref = M.s.ref || '';
    });
  } catch (e) { console.error('Schedule tidy ' + id + ': ' + e); }
  return out;
}
