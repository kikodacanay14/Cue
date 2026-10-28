/* CUE-2026-10-21. FSA and AR signature chasers, chasing sweep task 6 (spec: specs/06-freelancer-signatures.md, Kiko approved 08:16Z).
 * Freelancers who still haven't signed their FSA or AR get one reminder each, from freelancers@ (Kiko 08:09Z).
 * - Who does what: Canvas lists every FSA and freelancer AR "Waiting for signature" with the project's event dates
 *   (list_unsigned_docs, one read). Code groups them by person and applies the timing. A fixed template writes the reminder,
 *   so there is no AI call. Kiko approves; Canvas sends it from freelancers@ (send_doc_reminder), only for docs still unsigned.
 * - Timing (Kiko 08:08Z): chasing starts the day after the event's last day (Chaser rules "first", 1 day), then every 2 days,
 *   at most 3. An AR made after the event (late payment) starts the day after it was made. Supplier ARs are not chased here.
 * - Drafts only puts the reminder in Kiko's own Gmail Drafts (freelancers@ lives in info@, which Cue can't draft in).
 * - The file name sorts after CueSweep.gs on purpose: Apps Script runs files in order, and cueKind_ must exist first. */

const CUE_SIGN_ = { closed: /cancel|not awarded|dropped|void|lost/i, from: 'Blank Space Events – Freelancers' };

/** find(ctx): one item per freelancer whose unsigned FSAs or ARs are due today. */
function cueSignFind_(ctx) {
  const rule = ctx.rule('signature'), first = rule.first || 1;
  const o = cueBridge_(ctx.s, 'list_unsigned_docs', {}) || {}, url = cueStr_(o.sign_url || '', 200), by = {};
  (o.docs || []).forEach(d => {
    if (CUE_SIGN_.closed.test(String(d.project_status || '') + ' ' + String(d.admin_status || ''))) return;
    // Kiko 28 Oct 04:46Z: papers on a project whose status does not fit (e.g. On Hold) are left out, named in the batch note.
    const st = { status: d.project_status, admin: d.admin_status };
    if (!cueStatusFits_('signature', st)) { if (ctx.leftOut) ctx.leftOut.push(cueStatusLine_('Signature chasers', d.project || d.project_id, st)); return; }
    const end = cueSignDay_(d.event_end) || cueSignDay_(d.event_date), made = cueSignDay_(d.generated);
    if (!end) return;   // no event date in Canvas: nothing to time it from
    const start = [cueAddDays_(end, first), made ? cueAddDays_(made, first) : ''].sort().pop();
    if (start > ctx.today) return;
    const email = cueEmail_(d.email), k = email ? email.toLowerCase() : 'name:' + String(d.name || '').trim().toLowerCase();
    const p = by[k] || (by[k] = { email, name: cueStr_(d.name, 120), docs: [], since: start });
    p.docs.push({ doc: d.doc === 'AR' ? 'AR' : 'FSA', id: cueStr_(d.id, 60), project: cueStr_(d.project || d.project_id, 200), project_id: cueStr_(d.project_id, 30),
      role: cueStr_(d.role, 120), event_end: end });
    if (start < p.since) p.since = start;
  });
  return Object.keys(by).map(k => {
    const p = by[k], projects = p.docs.map(d => d.project).filter((x, i, a) => a.indexOf(x) === i);
    // Keyed by person and projects, so a new project's papers start a fresh count instead of inheriting an old one.
    const pids = p.docs.map(d => d.project_id).filter((x, i, a) => a.indexOf(x) === i).sort();
    const base = { key: 'signature:' + k + ':' + pids.join('+'), who: p.name || p.email, to: p.email, project: projects.join(', '), project_id: p.docs[0].project_id,
      due_since: p.since, docs: p.docs, sign_url: url, status_checked: true,
      why: cueSignList_(p.docs) + ' not signed yet. Event ended ' + p.docs.map(d => d.event_end).sort()[0] + '.' };
    return p.email ? base : Object.assign(base, { no_email: true, why: base.why + ' No email on file in Canvas: remind them by text or call.' });
  });
}
/** "FSA for Expo (Usher) and AR for Expo (Usher)" */
function cueSignList_(docs) {
  const one = d => d.doc + ' for ' + d.project + (d.role ? ' (' + d.role + ')' : '');
  const l = docs.map(one);
  return l.length < 2 ? l.join('') : l.slice(0, -1).join(', ') + ' and ' + l[l.length - 1];
}
/** YYYY-MM-DD from Canvas ('2026-11-14', '2026-11-01 10:00', '11/14/2026'), '' when unreadable. */
function cueSignDay_(v) {
  const t = String(v == null ? '' : v).trim(); let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[0];
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? m[3] + '-' + m[1].padStart(2, '0') + '-' + m[2].padStart(2, '0') : '';
}

/** The fixed reminder. Firmer, still polite, after an earlier one. */
function cueSignTemplate_(it) {
  const docs = it.docs || [], what = docs.every(d => d.doc === 'FSA') ? 'FSA' : docs.every(d => d.doc === 'AR') ? 'AR' : 'FSA and AR';
  const name = String(it.who || '').split(/\s+/)[0] || 'there', again = (it.times || 0) > 0;
  const body = ['Hi ' + name + ',', '',
    (again ? 'Following up on our earlier reminder: your ' : 'Thank you for working with us. Your ') + cueSignList_(docs)
      + (docs.length > 1 ? ' are' : ' is') + ' still waiting for your signature.', '',
    'You can sign ' + (docs.length > 1 ? 'them' : 'it') + ' in Canvas' + (it.sign_url ? ': ' + it.sign_url : '') + ' (sign in with your mobile number or email).',
    again ? 'Please sign as soon as you can so we can close the project.' : '', '',
    'Thank you!', CUE_SIGN_.from].filter((x, i, a) => x || a[i - 1] !== '').join('\n');
  return { subject: (again ? 'Reminder: ' : '') + 'Please sign your ' + what + ' · ' + it.project, body };
}

/** Approved and due to go: Canvas sends it from freelancers@, only for the docs still unsigned. */
function cueSignSend_(it, s) {
  if (!it.to) throw new Error('No email on file for ' + it.who + '.');
  const id = ('sig:' + s.id + ':' + it.to.toLowerCase().replace(/[^a-z0-9._-]/g, '_')).slice(0, 120);
  const r = cueBridge_(s, 'send_doc_reminder', { reminder_id: id, email: it.to, docs: (it.docs || []).map(d => ({ doc: d.doc, id: d.id })),
    subject: cueStr_(it.subject, 200), body: cueStr_(it.body, 4000) }) || {};
  if (r.sent === false) { it.note = 'Already signed'; return 'signed'; }
  return id;
}

cueKind_({ kind: 'signature', label: 'FSA / AR signatures', every: 2, max: 3, unit: 'days', sendAllowed: true, draftBrief: null,
  find: cueSignFind_, template: cueSignTemplate_, send: cueSignSend_ });
