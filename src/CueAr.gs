/* CUE-AR-2026-10-21 (Kiko 07:42Z approved specs/supplier-ars.md). "Prepare ARs for <project>": acknowledgement receipts.
 * CREW-DOCS-2026-10-26 (Kiko 13:22Z-13:31Z): the same command makes FSAs too ("generate FSAs for <project>"), and both now run
 * as Kiko asked: tick the names, Canvas makes the files in the background ("Generating 15 of 50"), then Cue asks "60 files done.
 * Do you want me to send these files?" and shows the email draft with Send, Edit and Send later.
 * Canvas does the work through four bridge actions: crew_docs (the list and the draft), crew_docs_make (a job; Canvas Client has
 * no Google Docs scope, so Canvas's own documents run makes the PDFs), crew_docs_job (how far it is) and crew_docs_send (one person,
 * sent once; crew only when registered with a crew sign-in; supplier and talent receipts from AccountsPayables@).
 * Who does what: GPT picks the command and the project inside the chat call Cue already makes (0 extra AI calls); code finds
 * the project and builds the card; Canvas lists, makes and emails; Kiko ticks and approves. Claude has no step here.
 * Nothing is made or emailed until Kiko approves, and each email only after Send (or at the Send later time Kiko picked). */

const CUE_AR_MAX_ = 60;        // names per Make (Kiko 13:30Z: "Generating 15 of 50")
const CUE_AR_SECONDS_ = 150;   // stop starting new emails after this; the 5-minute resume sends the rest
const CUE_PID_RE_ = /\bS-\d{3,12}[A-Z0-9]{2}\b/;
const CUE_DOC_ = { ar: { one: 'AR', many: 'ARs', long: 'acknowledgement receipts' }, fsa: { one: 'FSA', many: 'FSAs', long: 'freelancer service agreements' } };
const cueArDocOf_ = text => /\bFSAs?\b|service\s+agreements?/i.test(String(text || '')) ? 'fsa' : 'ar';
const cueArN_ = (n, doc) => n + ' ' + (n === 1 ? CUE_DOC_[doc].one : CUE_DOC_[doc].many);

/** Starts a run for the project Kiko named (a name or a Canvas id). Called from cueSend after the chat call. */
function cueArStart_(project, text, ref) {
  const now = cueNow_(), d = new Date(now), doc = cueArDocOf_(text + ' ' + project);
  const id = 'cue-' + Utilities.formatDate(d, 'Asia/Manila', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 65536).toString(16).padStart(4, '0');
  const s = { id, version: CUE_VERSION_, kind: 'ar', created: d.toISOString(), started: now, text: String(text || '').slice(0, 2000), files: [],
    status: 'Working', stage: 'Finding the project', ref: ref || '', ar: { doc, asked: cueStr_(project, 200).trim() }, metrics: { ai_calls: 0, calls: [] }, notes: [] };
  cueLocked_(() => { const sh = cueSheet_('Requests'); sh.appendRow([id]); cueSave_(sh, sh.getLastRow(), s); });
  cueChat_('Cue', 'Getting the ' + CUE_DOC_[doc].many + ' list for ' + s.ar.asked + ' from Canvas.', id);
  return id;
}

/** The run: find the project and read Canvas's list (up to the card), then follow Canvas making the files, then send. No AI call. */
function cueArRun_(s, save) {
  const a = s.ar; a.doc = a.doc || 'ar';
  if (s.stage === 'Finding the project') {
    const typed = (String(a.asked).toUpperCase().match(CUE_PID_RE_) || String(s.text).toUpperCase().match(CUE_PID_RE_) || [])[0];
    if (typed) { a.project_id = typed; a.project = typed; }
    else {
      const hits = cueCanvasFind_(s, a.asked);   // STRUCTURE-PHASE-3: the one project finder (CueCanvas.gs)
      if (!hits.length) throw new Error('Canvas found no project called "' + a.asked + '". Send the project name as it is in Canvas, or its id (S-...).');
      a.project_id = hits[0].project_id; a.project = hits[0].name || hits[0].project_id;
      a.others = hits.slice(1, 4).map(h => h.name + ' (' + h.project_id + ')');
    }
    s.stage = 'Reading the list'; save();
  }
  if (s.stage === 'Reading the list' || s.stage === 'Reading receipts from Canvas') {
    cueArList_(s);
    // PC check 27 Oct 01:53Z: the card opens with nothing ticked, so one tap on Make can never make the whole list.
    a.items.forEach(x => { x.tick = false; });
    s.status = 'Needs you'; s.stage = 'Needs you'; s.card_at = cueNow_();
    const ready = a.items.filter(cueArMakeable_).length;
    cueChat_('Cue', a.items.length ? cueArN_(ready, a.doc) + ' ready to make for ' + a.project + '. Tick the ones you want and press Make.'
      : (a.doc === 'fsa' ? 'Canvas shows no crew on ' + a.project + '\'s Resources yet.' : 'Canvas shows no paid suppliers, talents or freelancers on ' + a.project + ' yet.'), s.id);
    return;
  }
  if (s.stage === 'Canvas is making') return cueArFollow_(s, save);
  if (s.stage === 'Sending') return cueArSend_(s, save);
}
// Canvas's list and draft, kept on the request (no bank details come back).
function cueArList_(s) {
  const a = s.ar, l = cueBridge_(s, 'crew_docs', { kind: a.doc }, a.project_id), old = {};
  (a.items || []).forEach(x => { old[x.key] = x; });
  a.items = (l.items || []).map(p => Object.assign(cueArItem_(p), old[p.key] ? { made_now: !!old[p.key].made_now, emailed_now: !!old[p.key].emailed_now } : {}));
  a.more = !!l.more;
  const d = l.draft || {};
  a.draft = { subject: cueStr_(d.subject, 200), intro: cueStr_(d.intro, 2000), button: cueStr_(d.button || 'Open Canvas', 40) };
}
const cueArDocView_ = d => d ? { id: cueStr_(d.ar_id || d.id, 40), status: cueStr_(d.status, 60), url: /^https:\/\/(drive|docs)\.google\.com\//.test(String(d.url || '')) ? String(d.url) : '',
  sent: cueStr_(d.emailed || d.sent, 200), signed_at: cueStr_(d.signed_at, 40) } : null;
function cueArItem_(p) {
  return { key: cueStr_(p.key, 300), kind: ['Supplier', 'Talent', 'Resource'].indexOf(p.kind) >= 0 ? p.kind : 'Supplier', name: cueStr_(p.name, 200),
    role: cueStr_(p.role, 200), amount: Number(p.amount) || 0, paid_on: cueStr_(p.paid_on, 80), why: cueStr_(p.why, 300),
    has_email: !!p.has_email, registered: !!p.registered, can_sign: !!p.can_sign, send_why: cueStr_(p.send_why, 200), doc: cueArDocView_(p.doc) };
}
// Kiko 12:58Z: a resource with no email has its whole row turned off.
const cueArOff_ = x => x.kind === 'Resource' && !x.has_email;
const cueArMakeable_ = x => !x.why && !x.doc && !cueArOff_(x);
const cueArSent_ = x => !!(x.doc && /^(Sent|Signed)/.test(x.doc.sent || '')) || /^signed$/i.test((x.doc && x.doc.status) || '');
/** Files that can be emailed now: made, not sent or signed yet, not held, and someone Canvas can send to. */
const cueArSendable_ = a => (a.items || []).filter(x => x.doc && !cueArSent_(x) && !x.send_why && !/held until paid/i.test(x.doc.status));

/**
 * Kiko approves. Stage "Needs you": edits.make = the ticked keys; Canvas makes them in the background.
 * Stage "Ready to send": edits.send = keys, edits.intro = Kiko's edited message (optional), edits.later = when to send (ms or ISO).
 * Stage "Send later": edits.now sends at once, edits.cancel goes back to the draft. edits.finish stops without sending.
 */
function cueArApprove_(id, edits) {
  edits = edits || {};
  const L = cueLocked_(() => {
    const L = cueLoad_(id);
    if (!L) throw new Error('No such request.');
    const s = L.s, a = s.ar, by = {}; a.doc = a.doc || 'ar'; (a.items || []).forEach(x => { by[x.key] = x; });
    if (s.status !== 'Needs you') throw new Error('These ' + CUE_DOC_[a.doc].many + ' are ' + s.status + ', not waiting for you.');
    const keys = k => [].concat(edits[k] || []).map(String).filter((v, i, l) => l.indexOf(v) === i);
    if (edits.finish) { L.finish = true; return L; }   // done for now: nothing more is made or emailed
    if (s.stage === 'Send later') {
      if (edits.cancel) { delete a.send_at; s.stage = 'Ready to send'; cueSave_(L.sh, L.row, s); L.view = true; return L; }
      if (!edits.now) throw new Error('Send now, cancel the later send, or finish.');
      s.stage = 'Sending';
    } else if (s.stage === 'Ready to send') {
      const mail = keys('send'), ok = cueArSendable_(a).map(x => x.key);
      if (!mail.length) throw new Error('Tick at least one name to send to, or finish without sending.');
      mail.forEach(k => { if (ok.indexOf(k) < 0) throw new Error((by[k] ? by[k].name + ': ' + (by[k].send_why || 'already sent or not made') : 'That name') + '.'); });
      a.mail = mail; a.intro = cueStr_(edits.intro, 2000).trim(); if (a.intro === (a.draft || {}).intro) a.intro = '';
      if (edits.later != null && edits.later !== '') {
        const at = typeof edits.later === 'number' ? edits.later : Date.parse(edits.later);
        if (!(at > cueNow_())) throw new Error('Pick a time later than now.');
        if (at > cueNow_() + 14 * 864e5) throw new Error('Pick a time within the next 2 weeks.');
        a.send_at = at; s.stage = 'Send later'; s.approved_at = s.approved_at || new Date(cueNow_()).toISOString(); cueSave_(L.sh, L.row, s);
        L.later = true; return L;
      }
      s.stage = 'Sending';
    } else {
      const make = keys('make');
      make.forEach(k => { const x = by[k]; if (!x) throw new Error('That person or payment is not on this card. Refresh.'); if (x.why) throw new Error(x.name + ': ' + x.why);
        if (cueArOff_(x)) throw new Error(x.name + ': no email on file. Add an email to this resource first.');
        if (x.doc) throw new Error(x.name + ' already has one. Open it in Canvas to remake it.'); });
      if (!make.length) throw new Error('Tick at least one name to make.');
      if (make.length > CUE_AR_MAX_) throw new Error('That is ' + make.length + ' names. Tick ' + CUE_AR_MAX_ + ' at most, then do the rest.');
      a.runs = (a.runs || 0) + 1; a.job = s.id + '-m' + a.runs; a.making = make;
      a.items.forEach(x => { x.tick = false; x.state = make.indexOf(x.key) >= 0 ? 'waiting' : ''; x.error = ''; });
      a.progress = { made: 0, failed: 0, total: make.length };
      s.stage = 'Canvas is making';
    }
    s.status = 'Working'; s.error = ''; s.approved_at = s.approved_at || new Date(cueNow_()).toISOString();
    cueSave_(L.sh, L.row, s);
    return L;
  });
  const s = L.s, a = s.ar, save = () => cueLocked_(() => cueSave_(L.sh, L.row, s));
  if (L.finish) return cueArFinish_(s, save);
  if (L.view) return s;
  if (L.later) { cueChat_('Cue', 'OK. I will send ' + cueArN_(a.mail.length, a.doc) + ' at ' + Utilities.formatDate(new Date(a.send_at), 'Asia/Manila', 'EEE d MMM, h:mm a') + ' (Manila time).', s.id); return s; }
  if (s.stage === 'Canvas is making') {
    try { const r = cueBridge_(s, 'crew_docs_make', { request_id: a.job, kind: a.doc, keys: a.making }, a.project_id); if (r && r.job) cueArJob_(a, r.job); }
    catch (e) { s.status = 'Needs you'; s.stage = 'Needs you'; s.error = cueStr_((e && e.message) || e, 300); save(); throw e; }
    cueChat_('Cue', 'Canvas is making ' + cueArN_(a.making.length, a.doc) + ' for ' + a.project + '. I will tell you when they are done.', s.id);
    save(); return s;
  }
  return cueArSend_(s, save);
}
// The job's progress onto the card: "Generating 15 of 50".
function cueArJob_(a, j) {
  const by = {}; (j.items || []).forEach(x => { by[x.key] = x; });
  (a.items || []).forEach(x => { const y = by[x.key]; if (!y) return; x.state = y.state === 'made' ? 'made' : y.state === 'failed' ? 'failed' : 'waiting';
    x.error = y.state === 'failed' ? cueStr_(y.error, 200) : ''; if (y.state === 'made') x.made_now = true; });
  const it = j.items || [];
  a.progress = { made: it.filter(x => x.state === 'made').length, failed: it.filter(x => x.state === 'failed').length, total: it.length };
  return !j.left && !!j.finished;
}
/** Stage "Canvas is making" (cueResume every 5 minutes, or the page): reads the job; once done, asks Kiko to send. */
function cueArFollow_(s, save) {
  const a = s.ar, j = cueBridge_(s, 'crew_docs_job', { request_id: a.job });
  if (j && j.missing) throw new Error('Canvas lost the job for these ' + CUE_DOC_[a.doc].many + '. Tick them again and press Make.');
  if (!cueArJob_(a, j || {})) { save(); return; }   // still making: the next resume looks again
  const p = a.progress, failed = a.items.filter(x => x.state === 'failed');
  cueArList_(s);
  a.items.forEach(x => { const f = failed.filter(y => y.key === x.key)[0]; if (f) { x.state = 'failed'; x.error = f.error; } });
  const can = cueArSendable_(a);
  can.forEach(x => { x.tick = true; });
  s.status = 'Needs you'; s.stage = can.length ? 'Ready to send' : 'Needs you'; s.card_at = s.card_at || cueNow_();
  const not = a.items.filter(x => x.made_now && x.send_why).length;
  cueChat_('Cue', p.made + ' ' + (p.made === 1 ? 'file' : 'files') + ' done for ' + a.project + '.'
    + (failed.length ? ' ' + failed.length + ' not made: ' + failed.map(x => x.name + ' (' + x.error + ')').join('; ') + '.' : '')
    + (can.length ? ' Do you want me to send ' + (can.length === p.made ? 'these files' : 'the ' + can.length + ' that can be emailed') + '?' : ' None can be emailed yet.')
    + (not ? ' ' + not + ' made but not emailed (not registered or no crew sign-in yet).' : ''), s.id);
  save();
}
/** Stage "Sending": one crew_docs_send per ticked person. Left for time: the next resume sends the rest. */
function cueArSend_(s, save) {
  const a = s.ar, t0 = cueNow_(), late = () => cueNow_() - t0 > CUE_AR_SECONDS_ * 1000;
  let sent = 0, bad = 0, left = false;
  a.items.filter(x => (a.mail || []).indexOf(x.key) >= 0 && !x.emailed_now).forEach(x => {
    if (late()) { left = true; return; }
    try { const r = cueBridge_(s, 'crew_docs_send', Object.assign({ request_id: s.id, kind: a.doc, key: x.key }, a.intro ? { intro: a.intro } : {}), a.project_id);
      x.doc = Object.assign({}, x.doc, { sent: cueStr_(r.emailed, 200) }); x.emailed_now = !r.existed; x.error = ''; sent++; }
    catch (e) { x.error = cueStr_((e && e.message) || e, 300); bad++; }
    save();
  });
  if (left) { save(); return s; }   // status stays Working
  a.mail = (a.mail || []).filter(k => a.items.some(x => x.key === k && !x.emailed_now && !cueArSent_(x)));
  delete a.send_at;
  const all = a.items.filter(x => x.emailed_now).length;
  cueChat_('Cue', 'Sent ' + cueArN_(all, a.doc) + ' for ' + a.project + '.' + (a.mail.length ? ' Not sent yet: '
    + a.items.filter(x => a.mail.indexOf(x.key) >= 0).map(x => x.name + (x.error ? ' (' + x.error + ')' : '')).join('; ') + '.' : ''), s.id);
  if (a.mail.length) { s.status = 'Needs you'; s.stage = 'Ready to send'; save(); return s; }
  return cueArFinish_(s, save);
}
/** cueResume: a Send later whose time has come starts sending. */
function cueArDue_() {
  const now = cueNow_();
  cueRows_(cueSheet_('Requests')).forEach(r => {
    if (String(r[2]) !== 'Needs you') return;
    let s = null; try { s = JSON.parse(r.slice(10, 10 + CUE_CELLS_).join('')); } catch (e) { return; }
    if (s.kind !== 'ar' || s.stage !== 'Send later' || !(s.ar && s.ar.send_at <= now) || s.check) return;   // a cloud check's Send later never sends
    cueLocked_(() => { const L = cueLoad_(s.id); if (!L || L.s.status !== 'Needs you' || L.s.stage !== 'Send later') return;
      L.s.status = 'Working'; L.s.stage = 'Sending'; cueSave_(L.sh, L.row, L.s); });
  });
}
function cueArFinish_(s, save) {
  s.status = 'Done'; s.stage = 'Done'; s.ready_at = s.ready_at || cueNow_();
  cueMetrics_(s); save(); cueSummary_(s);
  return s;
}

/** The summary line's parts for a run. */
function cueArSummary_(s) {
  const a = s.ar || {}, it = a.items || [], out = [], doc = a.doc || 'ar';
  const made = it.filter(x => x.made_now).length, sent = it.filter(x => x.emailed_now).length, wait = it.filter(x => x.made_now && x.send_why).length;
  if (made) out.push('made ' + cueArN_(made, doc));
  if (sent) out.push('emailed ' + sent);
  if (wait) out.push(wait + ' made but not emailed (not registered or no crew sign-in yet)');
  const blocked = it.filter(x => x.why || cueArOff_(x)).length; if (blocked) out.push(blocked + ' could not be made yet (see the card for why)');
  return out;
}
/** The card's view of the run (cueView_). */
function cueArViewOf_(s) {
  const a = s.ar, doc = a.doc || 'ar';
  return { doc, doc_one: CUE_DOC_[doc].one, doc_many: CUE_DOC_[doc].many, project: a.project || a.asked || '', project_id: a.project_id || '', others: a.others || [], more: !!a.more, max: CUE_AR_MAX_,
    progress: a.progress || null, draft: a.draft || null, intro: a.intro || '', send_at: a.send_at || 0, mail: a.mail || [],
    items: (a.items || []).map(x => ({ key: x.key, kind: x.kind, name: x.name, role: x.role, amount: x.amount, paid_on: x.paid_on, why: x.why, has_email: x.has_email,
      registered: x.registered, can_sign: x.can_sign, send_why: x.send_why, off: cueArOff_(x), doc: x.doc, tick: !!x.tick, state: x.state || '', made_now: !!x.made_now,
      emailed_now: !!x.emailed_now, error: x.error || '' })) };
}
