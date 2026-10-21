/* CUE-AR-2026-10-21 (Kiko 07:42Z approved specs/supplier-ars.md). "Prepare ARs for <project>": acknowledgement receipts.
 * Canvas's own AR generator does the work, through three bridge actions: ar_list (read), ar_make (one receipt, only for
 * what Kiko ticked) and ar_email (a supplier's or talent's receipt, from AccountsPayables@ only, sent once).
 * Who does what: GPT picks the command and the project inside the chat call Cue already makes (0 extra AI calls); code finds
 * the project and builds the card; Canvas lists, makes and emails; Kiko ticks and approves. Claude has no step here.
 * Nothing is made or emailed until Kiko approves. At most 15 receipts per approval, so a batch stays under 3 minutes. */

const CUE_AR_MAX_ = 15;
const CUE_AR_SECONDS_ = 150;   // stop starting new receipts after this; Approve again does the rest
const CUE_PID_RE_ = /\bS-\d{3,12}[A-Z0-9]{2}\b/;

/** Starts an AR run for the project Kiko named (a name or a Canvas id). Called from cueSend after the chat call. */
function cueArStart_(project, text, ref) {
  const now = cueNow_(), d = new Date(now);
  const id = 'cue-' + Utilities.formatDate(d, 'Asia/Manila', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 65536).toString(16).padStart(4, '0');
  const s = { id, version: CUE_VERSION_, kind: 'ar', created: d.toISOString(), started: now, text: String(text || '').slice(0, 2000), files: [],
    status: 'Working', stage: 'Finding the project', ref: ref || '', ar: { asked: cueStr_(project, 200).trim() }, metrics: { ai_calls: 0, calls: [] }, notes: [] };
  cueLocked_(() => { const sh = cueSheet_('Requests'); sh.appendRow([id]); cueSave_(sh, sh.getLastRow(), s); });
  cueChat_('Cue', 'Preparing acknowledgement receipts for ' + s.ar.asked + '. Canvas is listing who was paid.', id);
  return id;
}

/** The run up to the card: find the project, then Canvas's list. No AI call. */
function cueArRun_(s, save) {
  const a = s.ar;
  if (s.stage === 'Finding the project') {
    const typed = (String(a.asked).toUpperCase().match(CUE_PID_RE_) || String(s.text).toUpperCase().match(CUE_PID_RE_) || [])[0];
    if (typed) { a.project_id = typed; a.project = typed; }
    else {
      const hits = cueBridge_(s, 'find_similar_projects', { name: a.asked }) || [];
      if (!hits.length) throw new Error('Canvas found no project called "' + a.asked + '". Send the project name as it is in Canvas, or its id (S-...).');
      a.project_id = hits[0].project_id; a.project = hits[0].name || hits[0].project_id;
      a.others = hits.slice(1, 4).map(h => h.name + ' (' + h.project_id + ')');
    }
    s.stage = 'Reading receipts from Canvas'; save();
  }
  if (s.stage === 'Reading receipts from Canvas') {
    const l = cueBridge_(s, 'ar_list', {}, a.project_id);
    a.items = (l.items || []).map(cueArItem_); a.more = !!l.more;
    a.items.forEach(x => { x.tick = !x.why && !x.ar; });
    s.status = 'Needs you'; s.stage = 'Needs you'; s.card_at = cueNow_();
    const ready = a.items.filter(x => x.tick).length;
    cueChat_('Cue', a.items.length ? ready + ' receipt' + (ready === 1 ? '' : 's') + ' ready to make for ' + a.project + '. Tick the ones you want and approve.'
      : 'Canvas shows no paid suppliers, talents or freelancers on ' + a.project + ' yet.', s.id);
  }
}
const cueArView_ = a => a ? { ar_id: cueStr_(a.ar_id, 40), status: cueStr_(a.status, 60), url: /^https:\/\/(drive|docs)\.google\.com\//.test(String(a.url || '')) ? String(a.url) : '',
  emailed: cueStr_(a.emailed, 200), signed_at: cueStr_(a.signed_at, 40) } : null;
function cueArItem_(p) {
  return { key: cueStr_(p.key, 300), kind: ['Supplier', 'Talent', 'Resource'].indexOf(p.kind) >= 0 ? p.kind : 'Supplier', name: cueStr_(p.name, 200),
    role: cueStr_(p.role, 200), amount: Number(p.amount) || 0, paid_on: cueStr_(p.paid_on, 80), request_id: cueStr_(p.request_id, 120),
    has_email: !!p.has_email, why: cueStr_(p.why, 300), ar: cueArView_(p.ar) };
}
const cueArSent_ = x => /^Sent to /.test((x.ar && x.ar.emailed) || '');
/** Receipts that can still be emailed: suppliers and talents with an email, a current receipt, not sent yet. */
const cueArMailable_ = a => (a.items || []).filter(x => x.kind !== 'Resource' && x.has_email && x.ar && !cueArSent_(x));

/**
 * Kiko approves. Stage "Needs you": make the ticked receipts (edits.make: keys; edits.remake: keys of ones already made).
 * Stage "Ready to email": edits.email: keys to email, or edits.finish to stop without emailing.
 */
function cueArApprove_(id, edits) {
  edits = edits || {};
  const L = cueLocked_(() => {
    const L = cueLoad_(id);
    if (!L) throw new Error('No such request.');
    const s = L.s, a = s.ar, by = {}; (a.items || []).forEach(x => { by[x.key] = x; });
    if (s.status !== 'Needs you') throw new Error('These receipts are ' + s.status + ', not waiting for you.');
    const keys = k => [].concat(edits[k] || []).map(String).filter((v, i, l) => l.indexOf(v) === i);
    if (edits.finish) { L.finish = true; return L; }   // done for now: nothing more is made or emailed
    if (s.stage === 'Ready to email') {
      const mail = keys('email'), ok = cueArMailable_(a).map(x => x.key);
      if (!mail.length) throw new Error('Tick at least one receipt to email, or finish without emailing.');
      mail.forEach(k => { if (ok.indexOf(k) < 0) throw new Error((by[k] ? by[k].name : 'That receipt') + ' cannot be emailed from here.'); });
      a.mail = mail; s.stage = 'Emailing receipts';
    } else {
      const make = keys('make'), remake = keys('remake');
      make.forEach(k => { const x = by[k]; if (!x) throw new Error('That person or payment is not on this card. Refresh.'); if (x.why) throw new Error(x.name + ': ' + x.why); });
      remake.forEach(k => { const x = by[k]; if (!x || !x.ar) throw new Error('Only a receipt that was already made can be remade.'); });
      const all = make.filter(k => !by[k].ar).concat(remake);
      if (!all.length) throw new Error('Tick at least one receipt to make.');
      if (all.length > CUE_AR_MAX_) throw new Error('That is ' + all.length + ' receipts. Tick ' + CUE_AR_MAX_ + ' at most per run, then do the rest.');
      a.items.forEach(x => { x.tick = all.indexOf(x.key) >= 0; x.remake = remake.indexOf(x.key) >= 0; x.error = ''; });
      s.stage = 'Making receipts';
    }
    s.status = 'Writing to Canvas'; s.error = ''; s.approved_at = s.approved_at || new Date(cueNow_()).toISOString();
    cueSave_(L.sh, L.row, s);
    return L;
  });
  const s = L.s, a = s.ar, save = () => cueLocked_(() => cueSave_(L.sh, L.row, s));
  if (L.finish) return cueArFinish_(s, save);
  const t0 = cueNow_(), late = () => cueNow_() - t0 > CUE_AR_SECONDS_ * 1000;
  if (s.stage === 'Making receipts') {
    let made = 0, bad = 0, left = 0;
    a.items.filter(x => x.tick).forEach(x => {
      if (late()) { left++; return; }
      try {
        const r = cueBridge_(s, 'ar_make', Object.assign({ request_id: s.id, key: x.key }, x.remake ? { remake: true } : {}), a.project_id);
        x.ar = cueArView_(r.ar); x.tick = false; x.remake = false; x.made_now = !r.existed; made++;
      } catch (e) { x.error = cueStr_((e && e.message) || e, 300); bad++; }
      save();
    });
    const mail = cueArMailable_(a).length;
    cueChat_('Cue', 'Canvas made ' + made + ' receipt' + (made === 1 ? '' : 's') + ' in the project\'s Acknowledgement Receipts folder.'
      + (bad ? ' ' + bad + ' did not go through; they are still ticked, so approve again to retry.' : '')
      + (left ? ' ' + left + ' left for time; approve again for the rest.' : '')
      + (mail && !bad && !left ? ' ' + mail + ' can be emailed from AccountsPayables@ when you say so.' : ''), s.id);
    if (bad || left) { s.status = 'Needs you'; s.stage = 'Needs you'; save(); return s; }
    if (mail) { s.status = 'Needs you'; s.stage = 'Ready to email'; save(); return s; }
    return cueArFinish_(s, save);
  }
  // Emailing receipts
  let sent = 0, bad = 0;
  a.items.filter(x => (a.mail || []).indexOf(x.key) >= 0).forEach(x => {
    if (late()) return;
    try { const r = cueBridge_(s, 'ar_email', { request_id: s.id, key: x.key }, a.project_id); x.ar.emailed = cueStr_(r.emailed, 200); x.emailed_now = !r.existed; x.error = ''; sent++; }
    catch (e) { x.error = cueStr_((e && e.message) || e, 300); bad++; }
    save();
  });
  a.mail = (a.mail || []).filter(k => a.items.some(x => x.key === k && !cueArSent_(x)));
  cueChat_('Cue', 'Emailed ' + sent + ' receipt' + (sent === 1 ? '' : 's') + ' from AccountsPayables@.' + (a.mail.length ? ' Not sent yet: '
    + a.items.filter(x => a.mail.indexOf(x.key) >= 0).map(x => x.name + (x.error ? ' (' + x.error + ')' : '')).join('; ') + '.' : ''), s.id);
  if (a.mail.length) { s.status = 'Needs you'; s.stage = 'Ready to email'; save(); return s; }
  return cueArFinish_(s, save);
}
function cueArFinish_(s, save) {
  s.status = 'Done'; s.stage = 'Done'; s.ready_at = s.ready_at || cueNow_();
  cueMetrics_(s); save(); cueSummary_(s);
  return s;
}

/** The summary line's parts for an AR run. */
function cueArSummary_(s) {
  const a = s.ar || {}, it = a.items || [], out = [];
  const made = it.filter(x => x.made_now).length, sent = it.filter(x => x.emailed_now).length, wait = it.filter(x => x.kind === 'Resource' && x.made_now).length;
  if (made) out.push('made ' + made + ' receipt' + (made === 1 ? '' : 's'));
  if (sent) out.push('emailed ' + sent + ' from AccountsPayables@');
  if (wait) out.push(wait + ' freelancer receipt' + (wait === 1 ? '' : 's') + ' waiting for signature in Canvas Client');
  const blocked = it.filter(x => x.why).length; if (blocked) out.push(blocked + ' could not be made yet (see the card for why)');
  return out;
}
