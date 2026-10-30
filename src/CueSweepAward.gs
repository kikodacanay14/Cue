/* CUE-2026-10-21. CE award chasers, chasing sweep task 3 (spec: specs/ce-award-chasers.md, Kiko approved 08:11Z).
 * Clients with a CE and no award decision get a polite follow-up in the thread Kiko sent the CE in.
 * - Who does what: Canvas lists the projects in For Client Awarding (get_project_board; the next Canvas release adds awaiting.since, the
 *   day the status changed, and the active CE total). Code finds the CE email in Kiko's Sent Gmail (CEs only go from Kiko's own
 *   Gmail, Kiko 08:10Z), checks for a client reply, counts chasers and applies the timing. ChatGPT drafts inside the sweep's one
 *   combined call (no AI call of its own). Kiko approves; client chasers never send on their own.
 * - Timing comes from Kiko's Chaser rules card (ctx.rule('award'); default, Kiko 08:10Z: first chaser 3 business days after
 *   "waiting since", then every 5, at most 3; business days skip weekends). The engine also applies every and max from the Chase log.
 *   After 3: "call the client or mark Not Awarded", no draft. An event within 7 days (or past) is flagged urgent, no draft.
 *   A client reply after the CE or the last chaser: "Client replied", no draft. No CE email in Sent: "chase by hand", no draft.
 * - Chasers count Kiko's own later messages in the thread too, so a nudge sent by hand counts. The file name sorts after
 *   CueSweep.gs on purpose: Apps Script runs files in order, and cueKind_ must exist before this file registers. */

const CUE_AWARD_ = { first: 3, every: 5, max: 3, unit: 'working', urgentDays: 7, projects: 30, status: /^for client awarding$/i };

/** Days in the rule's unit after `from` up to `to` (both YYYY-MM-DD): working days skip weekends. */
function cueAwardGap_(rule, from, to) {
  if (rule.unit !== 'working') return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 864e5);
  return cueBizDays_(from, to);
}
/** Business days (Mon to Fri) after day `from` up to and including `to` (both YYYY-MM-DD). */
function cueBizDays_(from, to) {
  let n = 0;
  for (let d = cueAddDays_(from, 1), i = 0; d <= to && i < 400; d = cueAddDays_(d, 1), i++) { const w = new Date(d + 'T00:00:00Z').getUTCDay(); if (w > 0 && w < 6) n++; }
  return n;
}
/** YYYY-MM-DD from a Canvas date (m/d/yyyy, yyyy-mm-dd or a Date), '' when unreadable. */
function cueAwardDay_(v) {
  if (v instanceof Date) return isNaN(v) ? '' : cuePh_(v.getTime()).day;
  const t = String(v == null ? '' : v).trim(); let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[0];
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? m[3] + '-' + m[1].padStart(2, '0') + '-' + m[2].padStart(2, '0') : '';
}
/** Kiko's Sent mail about this project's CE (not supplier RFQs). */
function cueAwardQuery_(p) {
  const terms = [p.name, p.id].map(cueTerm_).filter((t, i, a) => t && a.indexOf(t) === i);
  return 'in:sent newer_than:180d (' + terms.map(t => '"' + t + '"').join(' OR ') + ') ("cost estimate" OR CE OR proposal OR quotation) -RFQ -requote -"request for quotation"';
}
function cueAwardHeaders_(m) { const h = {}; ((m.payload && m.payload.headers) || []).forEach(x => { h[String(x.name).toLowerCase()] = String(x.value || ''); }); return h; }

/** find(ctx) for the sweep: one item per project in For Client Awarding that is due, flagged or needs Kiko's eye. */
function cueAwardFind_(ctx) {
  const list = (((ctx.board() || {}).projects) || []).filter(p => p && p.id && CUE_AWARD_.status.test(String(p.status || '').trim())).slice(0, CUE_AWARD_.projects);
  const rule = Object.assign({}, CUE_AWARD_, ctx.rule ? ctx.rule('award') : {});   // Kiko's Chaser rules card (first, every, max, unit)
  if (!list.length || rule.on === false) return [];
  const auth = { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, own = cueOwnDomain_(), log = cueChaseLog_();
  const gmail = res => {
    if (res.getResponseCode() === 403 && /scope/i.test(res.getContentText())) throw new Error('Cue does not have Gmail access yet. Tap Fix Google access in the Threads pane.');
    return res.getResponseCode() === 200 ? JSON.parse(res.getContentText() || '{}') : null;
  };
  // Two batched rounds: one search per project, then each thread found (headers only).
  const tids = UrlFetchApp.fetchAll(list.map(p => ({ url: CUE_GMAIL_ + '/messages?maxResults=5&q=' + encodeURIComponent(cueAwardQuery_(p)), muteHttpExceptions: true, headers: auth })))
    .map(res => { const o = gmail(res); return o && o.messages && o.messages[0] ? String(o.messages[0].threadId) : ''; });
  const want = tids.filter((t, i, a) => t && a.indexOf(t) === i), threads = {};
  const meta = ['From', 'To', 'Subject', 'Message-ID'].map(h => 'metadataHeaders=' + h).join('&');
  (want.length ? UrlFetchApp.fetchAll(want.map(t => ({ url: CUE_GMAIL_ + '/threads/' + encodeURIComponent(t) + '?format=metadata&' + meta, muteHttpExceptions: true, headers: auth }))) : [])
    .forEach((res, i) => { const o = gmail(res); if (o) threads[want[i]] = o; });
  return list.map((p, i) => cueAwardItem_(p, threads[tids[i]] || null, log['award:' + String(p.id).trim()] || null, ctx.today, own, rule)).filter(Boolean);
}

/** One project → an item (a draft, or a flag with no email), or null when nothing is due today. */
function cueAwardItem_(p, th, L, today, own, rule) {
  rule = rule || CUE_AWARD_;
  const pid = String(p.id).trim(), aw = p.awaiting || {}, ev = cueAwardDay_(p.date || p.eventDate);
  const facts = { account: cueStr_(p.account, 200), event_date: ev };   // the CE total stays out of facts: drafts never quote prices
  const ce$ = (aw.ce_no ? cueStr_(aw.ce_no, 60) : '') + (typeof aw.ce_total === 'number' ? (aw.ce_no ? ', ' : '') + 'PHP ' + aw.ce_total.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '');
  const base = { key: 'award:' + pid, project: cueStr_(p.name || pid, 200), project_id: pid, facts };
  const flag = (why, priority) => Object.assign(base, { why, priority: priority || 'normal', no_email: true, needs_draft: false });
  // The CE thread: Kiko's first message in it is the CE; Kiko's later ones are chasers.
  const ms = ((th && th.messages) || []).map(m => ({ sent: (m.labelIds || []).indexOf('SENT') >= 0, ms: Number(m.internalDate) || 0, h: cueAwardHeaders_(m) }))
    .sort((a, b) => a.ms - b.ms);
  const ce = ms.filter(m => m.sent)[0] || null, after = ce ? ms.filter(m => m.ms > ce.ms) : [], last = ms[ms.length - 1];
  const kiko = after.filter(m => m.sent), ceDay = ce ? cuePh_(ce.ms).day : '';
  const since = cueAwardDay_(aw.since) || ceDay;
  facts.waiting_since = since; facts.ce_sent = ceDay;
  // AWARD-TAP-2026-10-30 (Kiko 30 Oct 2026 03:54Z, card "Yes, build all"): a past event gets Open in Canvas to set the award status;
  // an event within 7 days whose CE thread waits on the client gets an urgent draft that goes only when Kiko taps Send follow-up.
  const soon = !!ev && ev <= cueAddDays_(today, CUE_AWARD_.urgentDays);
  const urgent = () => {
    if (th) Object.assign(base, { thread_id: String(th.id || '') });
    if (ev < today) { try { base.canvas_url = cueCanvasLink_({ what: 'project', project_id: pid, name: p.name }).url; } catch (e) { /* no link: the line still says what to do */ } }
    return Object.assign(flag(ev < today ? 'The event date (' + ev + ') has passed and there is still no award. Update the status in Canvas.'
      : 'Event on ' + ev + ' and still no award. Call the client today.', 'urgent'), { short: ev < today ? 'Event passed ' + ev : 'Event ' + ev });
  };
  if (soon && ev < today) return urgent();
  if (soon && !ce) return urgent();
  if (!ce) return since && cueAwardGap_(rule, since, today) < rule.first ? null
    : flag('No CE email found in your Sent mail for this project. Chase the client by hand.');
  const addr = String(ce.h.to || '').split(',').map(a => ({ name: (a.match(/^\s*"?([^"<]*?)"?\s*</) || [])[1] || '', email: cueEmail_((a.match(/<([^>]+)>/) || [0, a])[1].trim()) }))
    .filter(a => a.email && (!own || a.email.toLowerCase().split('@')[1] !== own))[0];
  Object.assign(base, { thread_id: String(th.id || ''), message_id: cueStr_(last.h['message-id'], 300), thread_subject: cueStr_(ce.h.subject, 300),
    to: addr ? addr.email : '', who: addr ? cueStr_(addr.name || addr.email, 200) : '', due_since: since });
  if (soon && (!addr || !last.sent)) return urgent();
  if (soon) {
    const times = Math.max(kiko.length, L ? L.times : 0);
    facts.chaser_number = times + 1; facts.urgent = true;
    return Object.assign(base, { priority: 'urgent', tap: true, short: 'Event ' + ev,
      why: 'Event on ' + ev + ' and still no award. Send an urgent follow-up in the CE thread, or call the client' });
  }
  if (!last.sent) return flag('The client replied on ' + cuePh_(last.ms).day + '. Have a look and answer them.');
  const times = Math.max(kiko.length, L ? L.times : 0);
  const lastChase = [kiko.length ? cuePh_(kiko[kiko.length - 1].ms).day : '', L ? L.last : ''].sort().pop();
  if (times >= rule.max) return lastChase && cueAwardGap_(rule, lastChase, today) < rule.every ? null
    : flag('Chased ' + times + ' times with no decision. Call the client, or mark it Not Awarded in Canvas.');
  const waited = cueAwardGap_(rule, since, today);
  if (times === 0 ? waited < rule.first : !lastChase || cueAwardGap_(rule, lastChase, today) < rule.every) return null;
  facts.chaser_number = times + 1; facts.days_waiting = waited;
  return Object.assign(base, { why: 'CE sent ' + ceDay + (ce$ ? ' (' + ce$ + ')' : '') + ', ' + waited + ' ' + (rule.unit === 'working' ? 'business ' : '') + (waited === 1 ? 'day' : 'days') + ' with no award decision'
    + (ev ? '. Event ' + ev : '') + '. Chaser ' + (times + 1) + ' of ' + rule.max });
}

/** The fallback draft when ChatGPT can't write one. */
function cueAwardTemplate_(it) {
  const f = it.facts || {}, first = String(it.who || '').split(/[\s@]/)[0] || 'there', n = Number(f.chaser_number) || 1;
  if (f.urgent) return { subject: 'Following up: cost estimate for ' + it.project, body: 'Hi ' + first + ',\n\nFollowing up on the cost estimate we sent for ' + it.project
    + '. With the event on ' + f.event_date + ', could you let us know today if we can proceed? We are ready to move as soon as you confirm.\n\nThank you,\nKiko\nBlank Space Events' };
  const ask = n === 1 ? 'I\'m following up on the cost estimate we sent for ' + it.project + '. Have you had a chance to review it? If anything needs to change, we\'re happy to revise it.'
    : 'Checking in again on the cost estimate for ' + it.project + '. Could you let us know where your decision stands, or whether anything in it should change?'; // VOICE-2026-10-29
  return { subject: 'Following up: cost estimate for ' + it.project, body: 'Hi ' + first + ',\n\n' + ask + (f.event_date ? ' The event is on ' + f.event_date + '.' : '') + '\n\nThank you,\nKiko\nBlank Space Events' };
}

cueKind_({ kind: 'award', label: 'CE award chasers', every: CUE_AWARD_.every, max: CUE_AWARD_.max, unit: CUE_AWARD_.unit, sendAllowed: true, find: cueAwardFind_, template: cueAwardTemplate_,
  draftBrief: 'The client received a cost estimate (CE) from BSE for this event and has not decided on the award. Reply in the CE thread: '
    + 'ask politely whether they have reviewed it and have a decision, and offer to revise the CE if anything needs to change. Name the '
    + 'project and the event date from facts. facts.chaser_number 1 is a gentle first follow-up; 2 and 3 are firmer but still warm. '
    + 'When facts.urgent is true the event is only days away: ask kindly for a decision today so BSE can proceed. '
    + 'Never mention prices, totals, discounts, deadlines or holds, and never promise anything.' });
