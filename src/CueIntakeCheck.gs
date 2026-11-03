/* INTAKE-REAL-CHECK (backlog card intake-real-check, High, 29 Oct 2026): intake was built but never run on real inquiries. The
 * cloud check test/checks/intake-real.check.mjs runs it on real ones through the check door (CueCheck.gs): Start intake on real
 * inquiry emails Cue sorted (New mail and the Triage log), then a screenshot and a PDF of real inquiries sent as attachments, the way Kiko pastes them.
 * Every function here ends in _, so the page cannot call it; only the check door does, in check mode, where the locks keep every
 * Canvas write off real projects and no mail goes out. */

/** The newest real inquiries Cue has shown, one per email thread, newest first. Read only. New mail logs every line as "new" in the
 * Triage log and keeps Claude's sort only in its own task, so the inquiries come from the New mail tasks of the window (group
 * "inquiry"), plus Triage log lines the older Inbox triage marked "inquiry". Each comes with its text and its file count, so the check
 * can start the richest one from Gmail and make a screenshot or a PDF of the others. q (optional): only inquiries whose subject or
 * sender has these words, for a check on one project Kiko names. */
function cueIcPick_(days, max, q) {
  const since = cueNow_() - (Number(days) || 30) * 864e5, seen = {}, found = [];
  const words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean), hit = x => words.every(w => (x.subject + ' ' + x.from).toLowerCase().indexOf(w) >= 0);
  const add = x => { if (!/^[0-9a-f]{6,32}$/i.test(x.thread_id) || seen[x.thread_id] || !(x.ms >= since) || !hit(x)) return; seen[x.thread_id] = 1; found.push(x); };
  const nm = [];
  cueRows_(cueSheet_('Requests')).forEach(r => {
    let t = null; try { t = JSON.parse(r.slice(10, 10 + CUE_CELLS_).join('')); } catch (e) { return; }
    if (t && t.kind === 'newmail' && t.nm && !t.check) (t.nm.items || []).forEach(it => { if (it.group === 'inquiry' && it.removed !== 'skip') nm.push([it, t.id]); });
  });
  nm.map(([it, run]) => ({ key: it.key, inbox: it.inbox === 'info' ? 'info' : 'mine', thread_id: String(it.thread_id || ''), from: cueStr_(it.sender, 200),
    subject: cueStr_(it.subject, 300), ms: Number(it.ms) || Date.parse(it.date) || 0, run }))
    .concat(cueRows_(cueSheet_('Triage log')).filter(r => String(r[5]) === 'inquiry').map(r => {
      const key = String(r[1] || ''), info = /^info:/.test(key);
      return { key: info ? key : 'inbox:' + key, inbox: info ? 'info' : 'mine', thread_id: String(r[2] || ''), from: cueStr_(r[3], 200), subject: cueStr_(r[4], 300),
        ms: new Date(r[0]).getTime(), run: String(r[7] || '') };
    }))
    .sort((a, b) => b.ms - a.ms).forEach(add);
  // A project Kiko names that Cue never sorted (older, or read before New mail): the newest Gmail thread with those words.
  if (words.length && !found.length) (cueGmail_('/threads?maxResults=1&q=' + encodeURIComponent(q + ' newer_than:' + (Number(days) || 30) + 'd')).threads || []).slice(0, 1)
    .forEach(t => found.push({ key: 'inbox:' + t.id, inbox: 'mine', thread_id: String(t.id), from: '', subject: q, ms: cueNow_(), run: '' }));
  return found.slice(0, Number(max) || 6).map(f => {
    const x = { key: f.key, inbox: f.inbox, thread_id: f.thread_id, from: f.from, subject: f.subject, at: new Date(f.ms).toISOString(), run: f.run, text: '', files: 0, error: '' };
    try {
      if (x.inbox === 'info') { const it = cueIcInfoItem_(x); x.text = cueStr_((it && (it.text || it.summary)) || '', 6000); }
      else {
        const t = cueGmail_('/threads/' + x.thread_id + '?format=full');
        const m = (t.messages || []).filter(y => (y.labelIds || []).indexOf('SENT') < 0).sort((a, b) => Number(b.internalDate) - Number(a.internalDate))[0];
        const walk = p => (p ? (p.filename && p.body && p.body.attachmentId ? 1 : 0) + (p.parts || []).reduce((n, c) => n + walk(c), 0) : 0);
        if (m) { x.text = cueStr_(cueTriageText_(m.payload) || m.snippet, 6000); x.files = walk(m.payload); }
      }
    } catch (e) { x.error = cueStr_((e && e.message) || e, 300); }
    return x;
  });
}

/** An info@ line as New mail keeps it (CueNewMail.gs), from the New mail task that showed it. Read only. */
function cueIcInfoItem_(x) {
  const L = x.run ? cueLoad_(x.run) : null;
  return L && L.s.nm ? (L.s.nm.items || []).find(it => it.key === x.key) || null : null;
}

/** Start intake on one picked inquiry, as the New mail and Inbox triage buttons do, without marking Kiko's own line as acted on. */
function cueIcStart_(pick) {
  if (!pick || !pick.thread_id) throw new Error('No inquiry to start.');
  if (pick.inbox !== 'info') return cueTriageIntake(pick.thread_id);
  const it = cueIcInfoItem_(pick);
  if (!it) throw new Error('The New mail line for this info@ email is gone.');
  return cueNmInfoIntake_(it);
}

/** One of phases 2 to 4 of a check's intake, run from the phase 1 card without Approve: 2 = Claude's requirement rows, 3 = costing from
 * Canvas's evidence (read only) with web research, 4 = the RFQ drafts. Approve would write to Canvas, so the check never taps it; this runs
 * the same steps on a copy. Nothing is saved to the task, nothing is written to Canvas and no Gmail draft is made. The copy waits in the
 * script cache between calls, so each call stays well under Apps Script's six minutes. Returns what that phase's card would show. */
function cueIcDeep_(id, phase) {
  phase = Number(phase) || 2;
  const key = 'cue-ic-' + id, c = CacheService.getScriptCache();
  let s = null;
  if (phase === 2) {
    const L = cueLoad_(id);
    if (!L) throw new Error('No such request.');
    if (L.s.status !== 'Needs you' || L.s.phase !== 1) throw new Error('The intake is at ' + L.s.stage + ', not the phase 1 card.');
    s = JSON.parse(JSON.stringify(L.s));
  } else {
    try { s = JSON.parse(c.get(key) || 'null'); } catch (e) { s = null; }
    if (!s || s.phase !== phase - 1) throw new Error('Run phase ' + (phase - 1) + ' of this check first.');
  }
  if (phase === 2) cuePhBreak_(s); else if (phase === 3) cuePhCost_(s, () => {}); else cuePhRfqs_(s);
  try { c.put(key, JSON.stringify(s), 21600); } catch (e) { console.error('Intake check cache: ' + e); }
  const out = { phase: s.phase, stage: s.stage, status: s.status, client: (s.x.client || {}).company || '', ai_calls: s.metrics.ai_calls, notes: s.notes || [] };
  if (phase === 2) return Object.assign(out, { rows: s.reqs.map(r => ({ scope: r.category, item: r.item, spec: r.spec, quantity: r.quantity, days: r.occurrence, status: r.status })),
    excluded: s.excluded || [], questions: s.x.questions || [] });
  const p = s.proposal;
  if (phase === 3) return Object.assign(out, { totals: p.totals, lines: p.lines.map(l => ({ item: l.item, execution: l.execution, unit_cost: l.unit_cost, cost_basis: l.cost_basis,
    unit_price: l.unit_price, price_basis: l.price_basis, suppliers: (l.suppliers || []).map(x => x.name || x), flags: l.flags || [] })) });
  return Object.assign(out, { rfqs: (p.rfqs || []).map(r => ({ supplier: ((r.suppliers || [])[0] || {}).name || '', subject: r.subject, body: r.body })) });
}
