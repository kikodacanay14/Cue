/**
 * CUE-RUN-NOW-2026-10-28 (Kiko 28 Oct 2026 11:46Z "i was asking for a screen where we can manually trigger"; 12:01Z "i am allowing
 * all notifications except for client sends. also allowed are the chasers"): Canvas > Admin > Chasers (was Run now; Kiko 29 Oct 03:01Z) > Cue chasers.
 *
 * Cue's own chasers (RFQ, accreditation, FSA / AR signatures; never the client chasers: CE awards, payments, sales) wait in today's
 * Morning batch for Kiko. Canvas can't send them (they go from Kiko's Gmail), so every minute, from the RFP sender's trigger
 * (cueRfpKick), Cue:
 *   1. sends Canvas those lines over the bridge (`cue_chasers`), only when they changed or every 30 minutes;
 *   2. gets back the presses waiting in Canvas and runs each: Send ticked sends those lines now (cueSweepSendNow_, the same send
 *      as Approve and send, one line at a time), Find chasers now builds today's batch now when none is waiting;
 *   3. reports each result in a second call. A result Canvas did not get is kept and sent on the next minute.
 * Kiko's press in Canvas is his approval for those lines; the rest of the batch still waits for him in Cue. A cloud check never
 * calls this.
 */
const CUE_RNC_ = { kinds: ['rfq', 'accreditation', 'signature'], every: 30 * 60e3, max: 5 };

/** Today's batch still waiting for Kiko ('Needs you'), or null. */
function cueRncBatch_() {
  const today = cuePh_(cueNow_()).day;
  return cueRecent_(2).filter(x => x.kind === 'sweep' && x.day === today && x.status === 'Needs you' && !x.check)[0] || null;
}
/** The lines Canvas shows: the batch's RFQ, accreditation and signature emails not yet sent, skipped or stopped. */
function cueRncLines_(s) {
  if (!s || !s.batch) return [];
  return (s.batch.items || []).filter(it => CUE_RNC_.kinds.indexOf(it.kind) >= 0 && !it.removed && !it.sent_id && !it.no_email && it.send_ok)
    .slice(0, 60).map(it => ({ key: cueStr_(it.key, 200), batch: s.id, kind: it.kind, label: cueStr_(it.label || it.kind, 80), project: cueStr_(it.project || '', 200),
      who: cueStr_(it.who || '', 200), to: cueStr_(it.to || '', 500), why: cueStr_(it.why || '', 300), times: Number(it.times) || 0,
      subject: cueStr_(it.subject || '', 200), body: cueStr_(it.body || '', 1500) }));
}

/** One minute: lines, presses, results. Returns { ran } or null during a cloud check. */
function cueRunNowTick_() {
  if (globalThis.CUE_CHECK_ON_) return null;
  const P = PropertiesService.getScriptProperties(), s = { id: 'runnow-' + cuePh_(cueNow_()).day }, now = cueNow_();
  let done = []; try { done = JSON.parse(P.getProperty('CUE_RNC_DONE') || '[]') || []; } catch (e) { done = []; }
  const call = d => {
    const lines = cueRncLines_(cueRncBatch_()), sig = cueSha_(JSON.stringify(lines)), args = {};
    if (sig !== P.getProperty('CUE_RNC_SIG') || now - Number(P.getProperty('CUE_RNC_AT') || 0) > CUE_RNC_.every) args.lines = lines;
    if (d.length) args.done = d;
    const r = cueBridge_(s, 'cue_chasers', args) || {};
    if (args.lines) { P.setProperty('CUE_RNC_SIG', sig); P.setProperty('CUE_RNC_AT', String(now)); }
    if (d.length) P.deleteProperty('CUE_RNC_DONE');
    return r;
  };
  const r = call(done);
  const presses = (r.presses || []).filter(x => x && x.press).slice(0, CUE_RNC_.max);
  if (!presses.length) return { ran: 0 };
  const out = presses.map(x => { let o; try { o = cueRncRun_(x); } catch (e) { o = { ok: false, result: 'Failed: ' + String((e && e.message) || e).slice(0, 200) }; }
    return { press: String(x.press), ok: !!o.ok, result: cueStr_(o.result, 300) }; });
  P.setProperty('CUE_RNC_DONE', JSON.stringify(out));
  P.deleteProperty('CUE_RNC_SIG');   // the batch changed: send the new lines with the results
  try { call(out); } catch (e) { console.error('Run now results (sent next minute): ' + e); }
  cueJobLog_(out.map(o => [new Date(now).toISOString(), new Date(cueNow_()).toISOString(), 'Run now: Cue chasers', o.ok ? 'OK' : 'Failed', o.ok ? '' : o.result, o.ok ? 1 : 0]));
  return { ran: out.length };
}

/** Runs one press. Returns { ok, result }. */
function cueRncRun_(x) {
  if (x.what === 'find') {
    const open = cueRncBatch_();
    if (open) return { ok: true, result: 'Today\'s batch is already waiting: ' + cueRncLines_(open).length + ' to send here' };
    const b = cueSweepStart_('manual'), n = cueRncLines_(b && b.status === 'Needs you' ? b : null).length;
    return { ok: true, result: n ? 'Found ' + n + ' to send' : 'Nothing to chase today' };
  }
  const r = cueSweepSendNow_(String(x.batch || ''), (x.keys || []).map(String));
  return { ok: r.sent > 0 && !r.failed.length, result: 'Sent ' + r.sent + ' of ' + r.asked + (r.failed.length ? '. Not sent: ' + r.failed.join('; ') : '') };
}

/** Sends some lines of a waiting batch now, as Approve and send would, and takes them off the batch (Kiko pressed Send in
 *  Canvas > Run now). Returns { asked, sent, failed: ['who: why'] }. The rest of the batch still waits for Kiko. */
function cueSweepSendNow_(id, keys) {
  const L = cueLocked_(() => {
    const L = cueLoad_(id);
    if (!L || L.s.kind !== 'sweep') throw new Error('No such batch.');
    if (L.s.status !== 'Needs you') throw new Error('This batch is ' + String(L.s.status).toLowerCase() + '.');
    L.s.status = 'Making drafts'; cueSave_(L.sh, L.row, L.s); return L;
  });
  const s = L.s, b = s.batch, log = cueChaseLog_(), today = cuePh_(cueNow_()).day, rules = cueRules_(), out = { asked: keys.length, sent: 0, failed: [] };
  try {
    keys.forEach(key => {
      const it = b.items.filter(x => x.key === key)[0];
      if (!it || CUE_RNC_.kinds.indexOf(it.kind) < 0 || it.removed || it.sent_id || it.no_email || !it.send_ok) { out.failed.push(key + ': not in this batch any more'); return; }
      const k = cueKinds_().filter(x => x.kind === it.kind)[0];
      try {
        if (typeof k.send === 'function') it.sent_id = String(k.send(it, s) || 'sent');
        else {
          if (!it.draft_id) it.draft_id = it.thread_id ? cueGmailReply_({ to: it.to, subject: it.thread_subject || it.subject, message_id: it.message_id || '', thread_id: it.thread_id }, it.body, [])
            : cueGmailDraft_(it.to, it.subject, it.body);
          it.sent_id = cueGmailSend_(it.draft_id);
        }
        it.sent_at = new Date(cueNow_()).toISOString(); it.error = ''; it.run_now = true; it.removed = 'sent'; it.selected = false;
        try { cuePlogChaser_(it, s); } catch (e) { console.error('Project log (chaser): ' + e); }
        cueChaseWrite_(log, it, { last: today, times: (it.times || 0) + 1, next: cueNextDue_(cueRuleFor_(rules, k), today, it), note: 'sent' });
        out.sent++;
      } catch (e) { it.error = String((e && e.message) || e).slice(0, 300); out.failed.push((it.who || it.to || key) + ': ' + it.error); }
    });
  } finally {
    s.status = b.items.concat(b.stopped || []).some(x => !x.removed) ? 'Needs you' : 'Done';
    cueSave_(L.sh, L.row, s);
  }
  if (out.sent) cueChat_('Cue', 'Sent ' + out.sent + ' chaser' + (out.sent === 1 ? '' : 's') + ' from Canvas Chasers.' + (s.status === 'Needs you' ? ' The rest of the batch still waits for you.' : ''), s.id);
  return out;
}
