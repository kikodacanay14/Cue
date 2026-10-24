/* CUE-TODAY (Kiko 23 Oct 07:37Z, go 24 Oct 06:44Z; spec canvas-integration/specs/daily-digest.md). One "Today" card for the scheduled
 * jobs: what needs Kiko (one row, one button each) and one line for what is done. Kiko 08:49Z: it shows on Kiko's Canvas Home.
 * Kiko 08:52Z: in Canvas's own look, so Canvas draws it from these rows (Dashboard.html, thread "Cue inside Canvas"); Cue only
 * sends them. Kiko 24 Oct 01:31Z: every row names who did the work ("Done by ChatGPT · checked by Cue"), from the AI calls the
 * run really made. Built from what the runs already hold: no AI call, nothing sent, nothing changed. */

const CUE_TODAY_KINDS_ = { sweep: 1, bids: 1, hubspot: 1, status: 1, pipeline: 1, gtask: 1 };
const CUE_TODAY_NEED_ = { 'Needs you': 1, 'Done, drafts incomplete': 1, Failed: 1 };

/** Who did a run's work, from its logged AI calls (CueAi.gs: provider 'GPT' or 'Claude'). */
function cueTodayBy_(r) {
  const p = {}; ((r.metrics && r.metrics.calls) || []).forEach(c => { if (c && c.status === 'OK') p[c.provider] = 1; });
  const who = [p.GPT ? 'ChatGPT' : '', p.Claude ? 'Claude' : ''].filter(Boolean);
  return who.length ? 'Done by ' + who.join(' and ') + ' · checked by Cue' : 'Done by Cue';
}

/** One run as a row (needs Kiko) or a done line. Titles say what is waiting in plain words. */
function cueTodayRow_(r) {
  const n = (k, one, many) => k + ' ' + (k === 1 ? one : many || one + 's'), name = cueTodayName_(r), by = cueTodayBy_(r);
  const row = o => Object.assign({ kind: name, by, thread: r.root || r.id, primary: false }, o);
  if (r.status === 'Failed') return { need: row({ eyebrow: name, title: name + ' didn\'t finish', detail: String(r.error || '').slice(0, 140) || 'Nothing was sent or changed.', button: 'Try again', by: 'Stopped · nothing was sent or changed' }) };
  const need = !!CUE_TODAY_NEED_[r.status];
  if (r.kind === 'sweep') {
    const it = ((r.batch && r.batch.items) || []).filter(x => !x.removed), mail = it.filter(x => !x.no_email && !x.sent), by_ = {};
    it.forEach(x => { by_[x.label] = (by_[x.label] || 0) + 1; });
    const parts = Object.keys(by_).map(k => by_[k] + ' ' + k).join(', ');
    if (!need || !it.length) return { done: 'morning batch (' + (it.length ? parts : 'nothing to chase') + ')', by };
    return { need: row({ eyebrow: 'Morning batch · approved emails go out at 9:00', title: mail.length ? 'Send ' + n(mail.length, 'email') : 'Look at ' + n(it.length, 'morning line'),
      detail: parts + '.', button: mail.length ? 'Review and send' : 'Open', primary: true }) };
  }
  if (r.kind === 'bids') {
    const B = r.bids || {}, items = B.items || [], up = B.updated || [];
    const peso = v => v ? '₱' + (v >= 1000 ? Math.round(v / 1000) + 'k' : v) : '';
    if (!need || !items.length) return { done: 'bid check (' + (items.length ? n(items.length, 'new bid') : 'no new bids') + (up.length ? ', ' + up.length + ' updated' : '') + ')', by };
    return { need: row({ eyebrow: 'Bid check', title: n(items.length, 'new bid') + ' worth a look', button: 'Open bids',
      detail: items.slice(0, 2).map(x => [x.project || x.reference || x.agency, peso(Number(x.abc) || 0)].filter(Boolean).join(' ')).join(' · ') + (items.length > 2 ? ' and ' + (items.length - 2) + ' more' : '') }) };
  }
  if (r.kind === 'hubspot') {
    const H = r.hs || {}, all = [].concat.apply([], (H.groups || []).map(g => g.items)), open = all.filter(x => x.can_fix && !(x.result && x.result.ok));
    if (!need || !open.length) return { done: 'HubSpot check (' + (all.length ? n(all.length, 'finding') + ', ' + (H.fixed || 0) + ' fixed' : 'nothing to fix') + ')', by };
    return { need: row({ eyebrow: H.title || 'HubSpot check', title: n(open.length, 'HubSpot fix', 'HubSpot fixes') + ' to review', detail: open.slice(0, 3).map(x => x.title).join(' · '), button: 'Review fixes' }) };
  }
  if (r.kind === 'status') {
    const T = r.st || {}, up = (T.updates || []).length, items = (T.items || []).length;
    if (!need || T.empty) return { done: 'status report (' + (T.empty ? 'nothing to report' : 'done') + ')', by };
    return { need: row({ eyebrow: T.title || 'Status report', title: 'Status report ready', button: 'Review report',
      detail: [up ? n(up, 'client update') + ' to send' : '', items ? n(items, 'new item') + ' for Canvas' : ''].filter(Boolean).join(' · ') || 'Projects worst first.' }) };
  }
  if (r.kind === 'pipeline') {
    const P = r.pipe || {}, k = P.counts || {};
    if (!need) return { done: 'pipeline review', by };
    return { need: row({ eyebrow: P.title || 'Pipeline review', title: n((k.act || 0) + (k.chase || 0), 'deal') + ' to act on or chase', detail: (k.data || 0) + ' to fix · ' + (k.ok || 0) + ' on track', button: 'Review deals' }) };
  }
  const G = r.gt || {}, f = G.items || [];   // gtask: a ChatGPT task
  if (!need || !f.length) return { done: (G.title || name).toLowerCase() + ' (' + (f.length ? n(f.length, 'finding') : 'nothing new') + ')', by };
  return { need: row({ eyebrow: G.title || name, title: n(f.length, 'finding') + ' to look at', detail: f.slice(0, 2).map(x => x.title || x.company).join(' · ') + (f.length > 2 ? ' and ' + (f.length - 2) + ' more' : ''), button: 'Review' }) };
}
function cueTodayName_(r) {
  return r.kind === 'sweep' ? 'Morning batch' : r.kind === 'bids' ? 'Bid check' : r.kind === 'hubspot' ? 'HubSpot check' : r.kind === 'status' ? 'Status report'
    : r.kind === 'pipeline' ? 'Pipeline review' : (r.gt && (r.gt.title || r.gt.task)) || 'ChatGPT task';
}

/** The card from the page's request views (cueView_), for one Manila day. Pure: the tests call it directly. */
function cueTodayFrom_(views, day) {
  const by = {}; views.forEach(r => { by[r.id] = r; });
  const root = id => { for (let i = 0; i < 8 && by[id] && by[id].ref; i++) id = by[id].ref; return id; };
  const rows = [], done = [];
  views.filter(r => CUE_TODAY_KINDS_[r.kind] && !r.archived && r.status !== 'Working' && cuePh_(Date.parse(r.created) || 0).day === day)
    .sort((a, b) => String(a.created).localeCompare(String(b.created)))
    .forEach(r => { const x = cueTodayRow_(Object.assign({}, r, { root: root(r.id) })); if (x.need) rows.push(x.need); else if (x.done) done.push(x); });
  // The chasers go first: their 9:00 send is the only one with a clock.
  rows.sort((a, b) => (b.primary ? 1 : 0) - (a.primary ? 1 : 0));
  const byW = {}; done.forEach(d => { const w = /Claude/.test(d.by) ? (/ChatGPT/.test(d.by) ? 'ChatGPT and Claude' : 'Claude') : /ChatGPT/.test(d.by) ? 'ChatGPT' : 'Cue'; (byW[w] = byW[w] || []).push(d.done); });
  return { day, count: rows.length, rows, done: Object.keys(byW).map(w => byW[w].join(', ') + ' (by ' + w + ')').join('; ') };
}

/** Canvas Home's hidden Cue frame (Today.html) asks for this. Owner only, like every Cue page call. */
function cueToday() {
  cueOwner_();
  const list = [];
  cueRows_(cueSheet_('Requests')).slice(-60).forEach(r => { let s = null; try { s = JSON.parse(r.slice(10, 10 + CUE_CELLS_).join('')); } catch (e) { s = null; } if (s) list.push(cueView_(s)); });
  return cueTodayFrom_(list, cuePh_(cueNow_()).day);
}
