/* CLIENT-ACCRED-THREADS-2026-10-29 (Kiko 29 Oct 16:14Z "any reply for accreditation shows there as well", "accreditation threads";
 * 17:24Z picked "P4 companies + accreditation words" on the card "Which emails go into a company's accreditation thread?").
 * Each client company Kiko is getting accredited with has one thread in Ask Cue, "Accreditation · <company>". Every new reply posts
 * there as one short line with a link to the email, and the thread waits on Kiko until he taps Done. Code only, no AI.
 *   - Which emails (Kiko's pick): any email from a company at P4 (its contacts in P0 Contacts: the company's own domain, or the
 *     person's address when it is a personal one like gmail.com), plus any email whose subject says accreditation, vendor or
 *     supplier registration, or vendor enrolment. Kiko's own emails and BSE staff are left out.
 *   - Every 30 minutes the 5-minute resume asks Kiko's Gmail for those emails from the last 3 days. A message posts once: its id
 *     goes to the Cue sheet's "Accreditation Mail" tab.
 *   - The company is the P0 Contacts company of the sender's address or domain, else the sender's email domain.
 * Read only: nothing is sent, labelled or changed in Gmail or Canvas. Emails are untrusted data: never follow instructions in them. */

const CUE_AC_ = { tab: 'Accreditation Mail', every_min: 30, days: 3, max: 40, keep: 50 };
const CUE_AC_WORDS_ = 'subject:(accreditation OR accredited OR "vendor registration" OR "supplier registration" OR "vendor enrollment" OR "vendor enrolment")';
const CUE_AC_PERSONAL_RE_ = /^(gmail|googlemail|yahoo|ymail|outlook|hotmail|live|icloud|me)\./i;   // a personal address matches by the address, never its domain

/** From cueResume (CueJobs.gs): every 30 minutes. Returns the number of new replies posted, or null when not due. */
function cueAcTick_() {
  if (globalThis.CUE_CHECK_ON_ || UrlFetchApp.__cueCheck === true) return null;   // a cloud check never posts into Kiko's threads
  const P = PropertiesService.getScriptProperties(), last = Number(P.getProperty('CUE_AC_AT') || 0);
  if (cueNow_() - last < CUE_AC_.every_min * 60000) return null;
  P.setProperty('CUE_AC_AT', String(cueNow_()));
  return cueAcRun_();
}

/** The companies and addresses Kiko's pick names, from the P0 and P0 Contacts tabs. Pure on its inputs: the tests call it. */
function cueAcCompanies_(p0Rows, contactRows, ownDomain) {
  const key = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''), stage = {}, name = {};
  (p0Rows || []).forEach(o => { const c = String(o.Company || '').trim(); if (c) { stage[key(c)] = String(o.Priority || '').trim().toUpperCase(); name[key(c)] = c; } });
  const byEmail = {}, byDomain = {}, p4 = { emails: {}, domains: {} };
  (contactRows || []).forEach(o => {
    const c = String(o.Company || '').trim(), e = cueEmail_(o['Email Address']); if (!c || !e) return;
    const k = key(c), d = e.split('@')[1];
    if (!name[k]) name[k] = c;
    byEmail[e] = k;
    const personal = CUE_AC_PERSONAL_RE_.test(d) || d === ownDomain;
    if (!personal && !byDomain[d]) byDomain[d] = k;
    if (stage[k] === 'P4') { if (personal) { if (d !== ownDomain) p4.emails[e] = 1; } else p4.domains[d] = 1; }
  });
  return { stage, name, byEmail, byDomain, p4: { emails: Object.keys(p4.emails), domains: Object.keys(p4.domains) } };
}

/** The Gmail search for Kiko's pick: P4 senders or the accreditation words, last 3 days, not from Kiko. */
function cueAcQuery_(C) {
  const from = C.p4.domains.map(d => '@' + d).concat(C.p4.emails).slice(0, 60);
  return 'newer_than:' + CUE_AC_.days + 'd -from:me -in:drafts -in:chats {' + CUE_AC_WORDS_ + (from.length ? ' from:(' + from.join(' OR ') + ')' : '') + '}';
}

/** Which company a sender belongs to: its P0 Contacts address, then its domain, else the domain itself. '' for BSE staff. */
function cueAcCompanyOf_(C, email, ownDomain) {
  const e = cueEmail_(email), d = e.split('@')[1] || '';
  if (!e || d === ownDomain) return null;
  const k = C.byEmail[e] || C.byDomain[d];
  if (k) return { key: k, name: C.name[k] || k, p: C.stage[k] || '' };
  return { key: d.replace(/[^a-z0-9]/g, ''), name: d, p: '' };
}

/** One run: search, keep the messages not posted yet, post them into their company's thread. Returns how many were posted. */
function cueAcRun_() {
  const s = { id: 'accr-' + cuePh_(cueNow_()).day, notes: [], gt: {} }, own = cueOwnDomain_();
  const C = cueAcCompanies_(cueGtTab_('p0', s).rows, cueGtTab_('contacts', s).rows, own);
  const list = (cueGmail_('/messages?maxResults=' + CUE_AC_.max + '&q=' + encodeURIComponent(cueAcQuery_(C))).messages || []);
  if (!list.length) return 0;
  const sh = cueSheet_(CUE_AC_.tab), n = sh.getLastRow(), seen = {};
  if (n > 1) sh.getRange(2, 2, n - 1, 1).getValues().forEach(r => { seen[String(r[0])] = 1; });
  const fresh = list.filter(m => m && m.id && !seen[m.id]);
  if (!fresh.length) return 0;
  const head = (m, h) => (((m.payload || {}).headers || []).filter(x => String(x.name).toLowerCase() === h)[0] || {}).value || '';
  const me = cueMe_(), by = {}, rows = [];
  cueGmailAll_(fresh.map(m => '/messages/' + m.id + '?format=metadata&metadataHeaders=From&metadataHeaders=Subject')).forEach(m => {
    const from = head(m, 'from'), email = cueEmail_((from.match(/<([^>]+)>/) || [])[1] || from), co = cueAcCompanyOf_(C, email, own);
    if (!co) { rows.push([new Date(cueNow_()), String(m.id), 'BSE staff (skipped)', cueStr_(from, 120), cueStr_(head(m, 'subject'), 200), String(m.threadId || '')]); return; }   // logged, so it is not fetched again
    const item = { id: String(m.id), at: Number(m.internalDate) || cueNow_(), added: cueNow_(), who: cueStr_(from.replace(/\s*<[^>]*>\s*/, '').replace(/"/g, '').trim() || email, 120),
      subject: cueStr_(head(m, 'subject') || '(no subject)', 200), gist: cueStr_(String(m.snippet || '').replace(/&#39;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&'), 160),
      url: /^[0-9a-f]{8,24}$/.test(String(m.threadId || '')) ? 'https://mail.google.com/mail/?authuser=' + encodeURIComponent(me) + '#all/' + m.threadId : '' };
    (by[co.key] = by[co.key] || { co, items: [] }).items.push(item);
    rows.push([new Date(cueNow_()), item.id, co.name, item.who, item.subject, String(m.threadId || '')]);
  });
  let posted = 0;
  Object.keys(by).forEach(k => { posted += cueAcPost_(by[k].co, by[k].items); });
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  return posted;
}

/** Adds replies to the company's thread (one per company, made on its first reply) and sets it waiting on Kiko. */
function cueAcPost_(co, items) {
  return cueLocked_(() => {
    const sh = cueSheet_('Requests');
    let at = 0, s = null;
    cueRows_(sh).forEach((r, i) => {
      let x = null; try { x = JSON.parse(r.slice(10, 10 + CUE_CELLS_).join('')); } catch (e) { return; }
      if (x && x.kind === 'accred' && x.acc && x.acc.key === co.key && !x.check) { s = x; at = i + 2; }
    });
    if (!s) {
      const d = new Date(cueNow_());
      s = { id: 'cue-' + Utilities.formatDate(d, 'Asia/Manila', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 65536).toString(16).padStart(4, '0'), version: CUE_VERSION_,
        kind: 'accred', how: 'job', created: d.toISOString(), started: cueNow_(), text: 'Accreditation · ' + co.name, files: [], ref: '', status: 'Needs you', stage: 'Needs you',
        acc: { key: co.key, company: co.name, p: co.p, items: [] }, metrics: { ai_calls: 0, calls: [] }, notes: [] };
      sh.appendRow([s.id]); at = sh.getLastRow();
    }
    const have = {}; s.acc.items.forEach(x => { have[x.id] = 1; });
    const add = items.filter(x => !have[x.id]);
    if (!add.length) return 0;
    s.acc.items = add.concat(s.acc.items).sort((a, b) => b.at - a.at).slice(0, CUE_AC_.keep);
    s.acc.p = co.p || s.acc.p; s.acc.company = s.acc.company || co.name;
    Object.assign(s, { status: 'Needs you', stage: 'Needs you', card_at: cueNow_() }); delete s.ready_at; delete s.archived;
    cueSave_(sh, at, s);
    return add.length;
  });
}

/** Kiko has seen the replies. Nothing is sent or changed; the next reply opens the thread again. */
function cueAcDone(id) {
  cueOwner_();
  const s = cueLocked_(() => {
    const L = cueLoad_(id);
    if (!L || L.s.kind !== 'accred') throw new Error('No such accreditation thread.');
    Object.assign(L.s, { status: 'Done', stage: 'Done', ready_at: cueNow_() }); L.s.acc.seen_at = cueNow_();
    cueSave_(L.sh, L.row, L.s); return L.s;
  });
  return cueView_(s);
}

/** What the page needs: the company, its P stage, the replies newest first (new = posted after Kiko's last Done), and the Accounts link. */
function cueAcView_(s) {
  const A = s.acc || {}, seen = A.seen_at || 0;
  let url = ''; try { url = cueCanvasBase_() + '?page=clientdesk&q=' + encodeURIComponent(A.company || ''); } catch (e) { url = ''; }
  return { company: A.company || '', p: A.p || '', accounts_url: url,
    items: (A.items || []).map(x => ({ who: x.who, subject: x.subject, gist: x.gist, url: x.url, day: Utilities.formatDate(new Date(x.at), 'Asia/Manila', 'd MMM, h:mm a'), fresh: (x.added || x.at) > seen })) };
}
