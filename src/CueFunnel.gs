/* CUE-FUNNEL (Kiko 24 Oct 13:50Z "How can we place the funnel in Cue? Or the hubspot action items"; Kiko chose "Yes, build both"
 * 13:56Z; spec canvas-integration/specs/sales-funnel-tasks.md). Two Today rows from one run, no AI call:
 *   - Code reads every deal in HubSpot (stage, amount) and counts them per stage: the sales funnel, "₱X waiting for award".
 *   - Code reads Kiko's open HubSpot tasks and the deal each one is on: the HubSpot action items, overdue first.
 *   - Mark done: one tap closes one task in HubSpot (hs_task_status COMPLETED), then Cue reads it back. Nothing closes in bulk.
 * Deal stage and amount are never changed here: Canvas owns them and its hourly sync writes them. Tasks are HubSpot's own records,
 * so the sync never overwrites a task Kiko marked done. Runs daily at 7:00 (Schedule row sys-funnel) and on "show the funnel".
 * CRM-FUNNEL-CANVAS-2026-10-29 (bug): Canvas stopped syncing HubSpot on 29 Oct (V328, Kiko 02:00:59Z "Turn off hubspot"), so the
 * HubSpot deal stages and amounts froze and this card kept showing them as today's funnel. The counts now come from Canvas's own
 * Sales funnel (bridge read crm_funnel: Inquiry, CE sent, Won, Delivered, Paid, with stuck counts; no amounts, which stay Kiko's in
 * Canvas). "Waiting for award" is the CE sent step. HubSpot deals are still read, but only for the name of the deal each HubSpot
 * task is on; their stage and amount are not used.
 * CRM-P-STAGES-2026-10-29 (Kiko 29 Oct 15:59Z "can you align the Sales Funnel in Ask Cue with the latest that we did"): the card now
 * leads with Canvas's Accounts dashboard (design Kiko approved 29 Oct 11:39Z): the companies per P0 to P9 stage from the P0 tab (contacts
 * for P1 to P3, as the dashboard counts them), and its cards: contacts in outreach (P1 and P2), follow-up emails due (P1 and P2, 3 business
 * days since the last email and no reply, Kiko's CRM rule), accreditations open (P4), projects at risk (P8 and P9) and Canvas follow-ups due
 * by tomorrow. The deal track (Inquiry to Paid) stays under P6 and P7, as on the dashboard. HubSpot tasks are kept as they were.
 * CRM-UPDATES-2026-10-29 (Kiko 29 Oct 16:13Z "it has to be able to give updates not a dashboard. you cant fit a dashboard in a chat
 * window"; 16:14Z "yes." to: what moved since yesterday, what is due today, and a link to Accounts in Canvas): the run keeps each
 * company's P stage and compares it with the last funnel run's, then writes a few plain update lines. The counts and bars stay on
 * Canvas's Accounts dashboard; the thread shows the lines and an Open Accounts in Canvas link.
 * HUBSPOT-REMOVAL-2026-11-01 (Kiko 1 Nov 2026: "Delete the Hubspot code"): the funnel reads Canvas only. The deal-name read, the open
 * task list and Mark done are gone, and the run no longer counts open tasks. */

const CUE_FUNNEL_ASK_RE_ = /\b(?:sales\s+)?funnel\b(?![\s\S]{0,20}\breview\b)/i;
const CUE_FUNNEL_STEPS_ = 'Reading Canvas';   // runs saved before 1 Nov kept an older "Reading ..." stage name; cueFunnelRun_ still reads them
// CRM-P-STAGES-2026-10-29: the P stages and their meanings, as Canvas's Accounts dashboard names them (ClientDesk.html STAGES).
const CUE_FUNNEL_P_ = [['P0', 'Prospecting / validation'], ['P1', 'Intro email sent'], ['P2', 'Following up every 3 business days'], ['P3', 'Parking lot'],
  ['P4', 'Accreditation in progress'], ['P5', 'Accredited, waiting for RFPs'], ['P6', 'RFPs received'], ['P7', 'Active project won'], ['P8', 'Project at risk'],
  ['P9', 'Escalated or has issues']];

function cueFunnelAsked_(t) { t = String(t || ''); return CUE_FUNNEL_ASK_RE_.test(t) && !/\breview\s+(?:the\s+|my\s+)?(?:sales\s+)?funnel\b/i.test(t); }   // "review the funnel" is the Thursday ChatGPT task

/** Starts a funnel run in its own thread. how = 'chat' | 'daily'. */
function cueFunnelStart_(text, how) {
  const now = cueNow_(), d = new Date(now);
  const id = 'cue-' + Utilities.formatDate(d, 'Asia/Manila', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 65536).toString(16).padStart(4, '0');
  const s = { id, version: CUE_VERSION_, kind: 'funnel', how: how || 'chat', created: d.toISOString(), started: now, text: cueStr_(text || 'Sales funnel', 2000), files: [],
    status: 'Working', stage: CUE_FUNNEL_STEPS_, ref: '', fn: { title: 'Sales funnel' }, metrics: { ai_calls: 0, calls: [] }, notes: [] };
  cueLocked_(() => { const sh = cueSheet_('Requests'); sh.appendRow([id]); cueSave_(sh, sh.getLastRow(), s); });
  if (how !== 'daily') cueChat_('Kiko', s.text, '');
  cueChat_('Cue', 'Cue started ' + (how === 'daily' ? 'the daily' : 'a') + ' sales funnel check. It reads Canvas\'s P0 to P9 accounts and their deals in its own thread and changes nothing in Canvas.',   // CUE-PLAIN-STATUS-2026-11-18
    how === 'daily' && cueK0On_() ? id : '>' + id);   // CUE-K0-2026-10-31 (R2)
  return { request_id: id, task: '' };
}

/** Advances a funnel run: one step, code only. */
function cueFunnelRun_(s, save) {
  if (s.stage === CUE_FUNNEL_STEPS_ || /^Reading /.test(String(s.stage || ''))) { cueFunnelRead_(s); save(); }
}

/* ---------- Canvas reads (code only) ---------- */
function cueFunnelRead_(s) {
  const F = s.fn;
  // CRM-FUNNEL-CANVAS-2026-10-29: the steps and counts are Canvas's Sales funnel, not HubSpot's frozen stages.
  const cf = cueBridge_(s, 'crm_funnel', {}) || {};
  F.src = 'canvas';
  F.stages = (cf.steps || []).map(x => ({ id: cueStr_(x.step, 80), label: cueStr_(x.step, 80), kind: /^(inquiry|ce sent)$/i.test(String(x.step)) ? 'open' : 'won',
    n: Number(x.count) || 0, amount: 0, no_amount: 0, stuck: Number(x.stuck) || 0 }));
  F.fu_due = (cf.due || []).length;   // Canvas follow-ups due by tomorrow (the morning batch lists them one by one)
  // CRM-P-STAGES-2026-10-29: the P0 tab (through Canvas's read_rows when it is allow-listed, else direct), counted as the dashboard does.
  let p0 = null;
  try { p0 = cueGtTab_('p0', s); } catch (e) { s.notes.push('Could not read the P0 to P9 accounts (' + cueStr_(e.message, 120) + ').'); }
  F.p = p0 ? cueFunnelP_(p0.rows, cueMnlDay_(cueNow_())) : null;
  // CRM-UPDATES-2026-10-29: each company's stage now, against the last funnel run that read one, gives what moved.
  if (p0) {
    F.pmap = cueFunnelPmap_(p0.rows);
    const prev = cueFunnelPrevMap_(s.id);
    F.moves = prev ? cueFunnelMoves_(prev.map, F.pmap) : null;
    F.since = prev ? prev.at : '';
  }
  try { F.checks = cueFunnelChecks_(s, cf); } catch (e) { F.checks = null; s.notes.push('Could not run the deal checks (' + cueStr_((e && e.message) || e, 120) + ').'); }   // CUE-FUNNEL-CHECKS-2026-11-01
  F.stuck = (cf.stuck || []).slice(0, 40).map(x => ({ step: cueStr_(x.step, 40), client: cueStr_(x.client || x.name, 120), quiet: Number(x.quiet) || 0 }));
  F.due_list = (cf.due || []).slice(0, 40).map(x => ({ client: cueStr_(x.client, 120), what: cueStr_(x.what, 200), due: cueStr_(x.due, 10) }));
  try { F.accounts_url = cueCanvasBase_() + '?page=clientdesk'; } catch (e) { F.accounts_url = ''; }
  const w = F.stages.filter(x => x.id === 'CE sent')[0];
  F.wait = w ? { id: w.id, label: w.label, n: w.n, amount: 0 } : { id: '', label: '', n: 0, amount: 0 };
  F.none = [];
  F.read_at = new Date(cueNow_()).toISOString();
  F.lines = cueFunnelUpdate_(F);   // CRM-UPDATES-2026-10-29
  s.status = F.wait.n || (F.p && F.p.due) || F.fu_due || (F.moves && F.moves.length) ? 'Needs you' : 'Done'; s.stage = s.status; s.card_at = cueNow_();
  if (s.status === 'Done') s.ready_at = cueNow_();
  cueMetrics_(s);
  // Each run is a full snapshot, so an older one still waiting is closed (nothing in it was written).
  // CUE-PLAIN-STATUS-2026-11-18 (Kiko 08:35Z: "Replaced by a newer funnel. Nothing was changed" needed a click to know what it meant).
  cueCloseSuperseded_(x => x.kind === 'funnel' && x.id !== s.id, x => 'Cue closed the sales funnel check ' + (cueSayWhen_(x && x.created) ? 'from ' + cueSayWhen_(x.created) : 'that was still open')
    + ' because a newer check of Canvas\'s P0 to P9 accounts replaced it. Nothing was changed in Canvas.');
  // CRM-UPDATES-2026-10-29: the update itself, in plain lines (Kiko 16:13Z: updates, not a dashboard).
  // The card below shows every line, so the thread's message carries only the first (Kiko 15:39Z: everything appears once).
  cueChat_('Cue', 'The sales funnel check of Canvas\'s P0 to P9 accounts found ' + cueLcFirst_(String(F.lines[0]).replace(/\.$/, ''))   // CUE-PLAIN-STATUS-2026-11-18
    + (F.lines.length > 1 ? ', plus ' + (F.lines.length - 1) + ' more point' + (F.lines.length > 2 ? 's' : '') + ' on the card below.' : '.'), s.id);
}

/** CRM-P-STAGES-2026-10-29: companies per P stage from the P0 tab's rows ({ Priority, Company, 'Contact Count', 'Last Outreach Date',
 * 'Reply Status' }), the way Canvas's Accounts dashboard counts them (Code.gs buildFunnel_, ClientDesk.html drawFunnel). Pure: the tests
 * call it directly. A row with no company or no P0 to P9 stage is left out. */
function cueFunnelP_(rows, today) {
  const by = {}; CUE_FUNNEL_P_.forEach(x => { by[x[0]] = { p: x[0], label: x[1], n: 0, contacts: 0 }; });
  const get = (o, k) => { const v = o[k]; return v == null ? '' : v; };
  let due = 0;
  (rows || []).forEach(o => {
    const co = String(get(o, 'Company')).trim(), p = String(get(o, 'Priority')).trim().toUpperCase(), x = by[p];
    if (!co || !x) return;
    x.n++;
    const k = Number(String(get(o, 'Contact Count')).replace(/[^0-9.]/g, '')); if (k > 0) x.contacts += Math.round(k);
    // Kiko's P1 and P2 rule: a follow-up email 3 business days after the last one when there is no reply.
    const lo = cueGtDay_(get(o, 'Last Outreach Date')), rs = String(get(o, 'Reply Status'));
    const replied = /repl|respon/i.test(rs) && !/no repl|no respon|not repl/i.test(rs);
    if ((p === 'P1' || p === 'P2') && lo && lo <= today && !replied && cuePipeWorkDays_(Date.parse(lo + 'T04:00:00Z'), Date.parse(today + 'T04:00:00Z')) >= 3) due++;
  });
  const stages = CUE_FUNNEL_P_.map(x => by[x[0]]);
  const risk_names = (rows || []).filter(o => /^P[89]$/i.test(String(o.Priority || '').trim()) && String(o.Company || '').trim()).map(o => cueStr_(String(o.Company).trim(), 120) + ' (' + String(o.Priority).trim().toUpperCase() + ')');
  return { stages, outreach: by.P1.contacts + by.P2.contacts, due, p4: by.P4.n, risk: by.P8.n + by.P9.n, risk_names, p6: by.P6.n, p7: by.P7.n,
    total: stages.reduce((t, x) => t + x.n, 0) };
}

/** CRM-UPDATES-2026-10-29: { company: 'P4' } from the P0 tab's rows (companies with a P0 to P9 stage only). Pure. */
function cueFunnelPmap_(rows) {
  const m = {}, ok = {}; CUE_FUNNEL_P_.forEach(x => { ok[x[0]] = 1; });
  (rows || []).forEach(o => { const co = cueStr_(String(o.Company == null ? '' : o.Company).trim(), 120), p = String(o.Priority == null ? '' : o.Priority).trim().toUpperCase(); if (co && ok[p]) m[co] = p; });
  return m;
}
/** The newest earlier funnel run that kept a P map: { map, at } or null (the first run has nothing to compare). */
function cueFunnelPrevMap_(id) {
  let best = null;
  cueRows_(cueSheet_('Requests')).forEach(r => {
    if (String(r[0]) === String(id)) return;
    let x = null; try { x = JSON.parse(r.slice(10, 10 + CUE_CELLS_).join('')); } catch (e) { return; }
    if (!x || x.kind !== 'funnel' || x.check || !x.fn || !x.fn.pmap || !x.fn.read_at) return;
    if (!best || x.fn.read_at > best.at) best = { map: x.fn.pmap, at: x.fn.read_at };
  });
  return best;
}
/** What moved between two P maps: [{ company, from, to }], new companies with from ''. Removed companies are left out. Pure. */
function cueFunnelMoves_(before, now) {
  return Object.keys(now).filter(c => before[c] !== now[c]).map(c => ({ company: c, from: before[c] || '', to: now[c] }))
    .sort((a, b) => b.to.localeCompare(a.to) || a.company.localeCompare(b.company));
}
/** CRM-UPDATES-2026-10-29: the update lines Ask Cue shows and posts (a few plain sentences, never a table). Pure: the tests call it. */
function cueFunnelUpdate_(F) {
  const out = [], P = F.p, pl = (n, w, many) => n + ' ' + (n === 1 ? w : many || w + 's');
  const names = (l, k) => l.slice(0, k).join(', ') + (l.length > k ? ' and ' + (l.length - k) + ' more' : '');
  const mv = F.moves;
  if (mv) {
    const real = mv.filter(x => x.from), fresh = mv.filter(x => !x.from);
    out.push(real.length ? pl(real.length, 'company', 'companies') + ' moved: ' + names(real.map(x => x.company + ' ' + x.from + ' to ' + x.to), 4) + '.' : 'No P stage changes since the last update.');
    if (fresh.length) out.push(pl(fresh.length, 'new company', 'new companies') + ' on the list: ' + names(fresh.map(x => x.company + ' (' + x.to + ')'), 3) + '.');
  }
  if (P && P.due) out.push(pl(P.due, 'follow-up email') + ' due (P1 and P2, 3 business days with no reply).');
  const du = F.due_list || [];
  if (du.length) out.push(pl(du.length, 'follow-up') + ' due by tomorrow: ' + names(du.map(x => x.client || x.what), 3) + '.');
  const w = F.wait || {}, st = F.stuck || [];
  if (w.n || st.length) out.push([w.n ? pl(w.n, 'deal') + ' waiting for award' : '', st.length ? pl(st.length, 'deal') + ' gone quiet: ' + names(st.map(x => x.client + ' (' + x.step + ', ' + x.quiet + ' days)'), 3) : ''].filter(Boolean).join('; ') + '.');
  if (P && P.risk) out.push(pl(P.risk, 'project') + ' at risk or escalated: ' + names(P.risk_names || [], 3) + '.');
  const C = F.checks;   // CUE-FUNNEL-CHECKS-2026-11-01
  if (C) {
    if (C.wrote.length) out.push('Waiting on your reply: ' + names(C.wrote.map(x => x.client + ' (' + x.days + ' working day' + (x.days === 1 ? '' : 's') + ')'), 4) + '.');
    if (C.soon.length) out.push('Event soon, not won yet: ' + names(C.soon.map(x => x.client + ' (' + (x.days === 0 ? 'today' : 'in ' + x.days + ' day' + (x.days === 1 ? '' : 's')) + ')'), 4) + '.');
    if (C.fix.length) out.push('Fix in Canvas: ' + names(C.fix.map(x => x.client + ': ' + x.what), 4) + '.');
  }
  if (!out.length) out.push('Nothing new in Accounts today.');
  return out;
}

/* ---------- CUE-FUNNEL-CHECKS-2026-11-01: the 3 checks kept from the old pipeline review ----------
 * Kiko 1 Nov 2026 ("add the 3 missing"), on the proposal to keep only what the chasers do not already cover, as lines in the 2 PM
 * update's Funnel section. Code only, no AI call, nothing written. Canvas's open deals (crm_funnel open[], steps Inquiry and CE sent):
 *   1 Waiting on your reply: the newest email with the deal's contact (Kiko's Gmail, read only) came from them, 1 working day or more ago.
 *   2 Event soon, not won yet: the event is today or within 14 days.
 *   3 Fix in Canvas: the event date passed with the deal still open; no amount, event date or contact; or Gmail shows who BSE writes
 *     with but Canvas has no contact. */
const CUE_FUNNEL_CHECK_ = { deals: 40, soon: 14, mail_days: 120 };
const CUE_FUNNEL_AUTO_FROM_ = /(^|[._-])(no-?reply|do-?not-?reply|do_not_reply|notifications?|mailer-daemon|postmaster|bounces?|alerts?|automated|system)([._-]|@)|@([a-z0-9-]+\.)*(hs-?mail|coupahost|coupa|salesforce|mailchimp|mcsv|sendgrid|amazonses)\./i;
const CUE_FUNNEL_AUTO_SUBJ_ = /verification code|login code|one[- ]time (pass)?code|\bOTP\b|password reset|reset your password|you've been assigned|has been assigned to you|unsubscribe/i;
function cueFunnelChecks_(s, cf) {
  const today = cueMnlDay_(cueNow_()), now = cueNow_(), out = { wrote: [], soon: [], fix: [] };
  if (!Array.isArray(cf.open)) return out;
  const ev = d => { const e = String(d.date || '').slice(0, 10); return CUE_DATE_RE_.test(e) ? e : ''; };
  const deals = cf.open.filter(r => ['Inquiry', 'CE sent'].indexOf(String(r.step)) >= 0).map(d => {
    const e = ev(d), mail = cueEmail_(d.email);
    return { client: cueStr_(d.client, 120) || cueStr_(String(d.name || '').split(/\s+[—–-]\s+/)[0], 120), event: e, mail,
      days: e ? Math.round((Date.parse(e + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / CUE_DAY_) : null,
      priced: d.priced == null ? null : !!d.priced, contact: !!(mail || String(d.contact || '').trim()) };
  }).sort((a, b) => (a.event || '9999') < (b.event || '9999') ? -1 : (a.event || '9999') > (b.event || '9999') ? 1 : 0).slice(0, CUE_FUNNEL_CHECK_.deals);
  // Gmail, read only: the newest email a person sent with each deal's contact (3 newest, system mail skipped).
  const withMail = deals.filter(d => d.mail);
  if (withMail.length) {
    const auth = { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, own = cueOwnDomain_();
    const all = reqs => { let o = []; for (let i = 0; i < reqs.length; i += 20) o = o.concat(UrlFetchApp.fetchAll(reqs.slice(i, i + 20))); return o; };
    const q = d => 'newer_than:' + CUE_FUNNEL_CHECK_.mail_days + 'd (from:' + d.mail + ' OR to:' + d.mail + ')';
    const lists = all(withMail.map(d => ({ url: CUE_GMAIL_ + '/messages?maxResults=3&q=' + encodeURIComponent(q(d)), muteHttpExceptions: true, headers: auth })));
    const ids = []; lists.forEach((r, i) => { if (r.getResponseCode() === 200) (JSON.parse(r.getContentText() || '{}').messages || []).slice(0, 3).forEach(m => ids.push([withMail[i], m.id])); });
    const got = all(ids.map(x => ({ url: CUE_GMAIL_ + '/messages/' + x[1] + '?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Auto-Submitted&metadataHeaders=Precedence&metadataHeaders=List-Unsubscribe',
      muteHttpExceptions: true, headers: auth })));
    got.forEach((r, i) => {
      const d = ids[i][0]; if (d.last || r.getResponseCode() !== 200) return;
      const m = JSON.parse(r.getContentText()), h = {}; ((m.payload && m.payload.headers) || []).forEach(x => { h[String(x.name).toLowerCase()] = String(x.value || ''); });
      const as = String(h['auto-submitted'] || '').toLowerCase();
      if ((as && as !== 'no') || /^(bulk|list|junk)$/i.test(String(h.precedence || '').trim()) || h['list-unsubscribe'] || CUE_FUNNEL_AUTO_FROM_.test(h.from || '') || CUE_FUNNEL_AUTO_SUBJ_.test(h.subject || '')) return;
      const from = cueEmail_((String(h.from || '').match(/<([^>]+)>/) || [0, h.from])[1]), sent = (m.labelIds || []).indexOf('SENT') >= 0;
      d.last = { dir: sent ? 'out' : from && (!own || from.split('@')[1] !== own) ? 'in' : 'internal', ms: Number(m.internalDate) || 0 };
    });
  }
  deals.forEach(d => {
    if (d.last && d.last.dir === 'in') { const n = cuePipeWorkDays_(d.last.ms, now); if (n >= 1) out.wrote.push({ client: d.client, days: n }); }
    if (d.days != null && d.days >= 0 && d.days <= CUE_FUNNEL_CHECK_.soon) out.soon.push({ client: d.client, days: d.days });
    const miss = [d.priced === false && 'no amount', !d.event && 'no event date', !d.contact && 'no contact'].filter(Boolean);
    if (d.days != null && d.days < 0) miss.unshift('event date passed, deal still open');
    if (miss.length) out.fix.push({ client: d.client, what: miss.join(', ') });
  });
  return out;
}

/** Kiko is done looking. Nothing is written. */
function cueFunnelDone(id) {
  cueOwner_();
  const s = cueLocked_(() => {
    const L = cueLoad_(id);
    if (!L || L.s.kind !== 'funnel') throw new Error('No such funnel.');
    if (L.s.status === 'Needs you') { Object.assign(L.s, { status: 'Done', stage: 'Done', ready_at: L.s.ready_at || cueNow_() }); cueMetrics_(L.s); cueSave_(L.sh, L.row, L.s); }
    return L.s;
  });
  return cueView_(s);
}

/* ---------- words and the page ---------- */
/** The P stages, then Canvas's deal steps: "P0 212 · P1 96 · deals: 2 Inquiry (1 stuck) · 12 CE sent · 5 Won". */
function cueFunnelLine_(F) {
  const deals = (F.stages || []).filter(x => x.n).map(x => x.n + ' ' + x.label + (x.stuck ? ' (' + x.stuck + ' stuck)' : '')).join(' · ') || 'no open deals';
  return F.p ? F.p.stages.filter(x => x.n).map(x => x.p + ' ' + x.n).join(' · ') + ' · deals: ' + deals : deals;
}

/** What the page needs. */
function cueFunnelView_(s) {
  const F = s.fn || {};
  return { src: 'canvas', title: 'Sales funnel', lines: F.lines || null, accounts_url: F.accounts_url || '', p: F.p || null, read: F.read_at ? new Date(Date.parse(F.read_at) + CUE_MNL_).toISOString().slice(11, 16) : '', line: F.stages ? cueFunnelLine_(F) : '', wait: F.wait || null,
    stages: (F.stages || []).map(x => ({ id: x.id, label: x.label, kind: x.kind, n: x.n, stuck: x.stuck || 0 })) };
}

/** The Today row (CueToday.gs): the funnel. From the page's view of the run. */
function cueFunnelToday_(r, row) {
  const F = r.fn || {}, w = F.wait || {};
  // PC check 24 Oct 14:29Z: "#fn-" opens the thread at this run's funnel card.
  const at = spot => (r.root || r.id) + '#' + spot + '-' + r.id;
  // CRM-UPDATES-2026-10-29: with update lines, the row is the update: its first line as the title, the next two as the detail.
  const L = F.lines || [];
  return [row(L.length ? { eyebrow: 'Sales update · from Canvas Accounts', title: L[0].replace(/\.$/, ''), detail: L.slice(1, 3).join(' '), button: 'Open update', thread: at('fn') }
    : { eyebrow: 'Sales funnel · from Canvas', title: (w.n || 0) + ' deal' + (w.n === 1 ? '' : 's') + ' waiting for award', detail: F.line || '', button: 'Open funnel', thread: at('fn') })];
}
