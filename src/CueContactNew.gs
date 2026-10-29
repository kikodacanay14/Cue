/* CUE-CONTACT-NEW-2026-10-29 (Kiko 29 Oct 13:14Z, backlog thread: "1. my email only 2. one time 3 year scan 3. senders and people
 * copied 4. P0 unless there are contacts 5. once for the 3 year rewind. then we run weekly for ongoing emails"; spec
 * specs/gmail-new-contacts.md, Feature Board card gmail-new-contacts). New contacts and companies from Kiko's own Gmail:
 *   1. Read only, Kiko's Gmail only (this job runs in his account). Each message is read as metadata: the From, Cc, Subject and
 *      date headers. No body, no attachment. The first window is the last 3 years; after it is read, one window a week covers the
 *      mail since the last one. Every person found is one row of the Cue sheet tab "New contacts" (email is the key).
 *   2. Canvas checks each new person (bridge read contact_new_check): already in Canvas (P0 Contacts, PROJ Contacts or the Admin
 *      Directory), or the company they would go to. One email domain is one company. A company already in P0 keeps its P stage; a
 *      company not in P0 starts at P0.
 *   3. When a window is read, one Approve card at a time lists at most 25 companies and 40 people, new companies first, each person
 *      with a tick. Title, company and phone come only from the signature lines of their own emails (the old-email contact scan's
 *      reader, CueContactScan.gs), one Claude Haiku call per 20 people.
 *   4. Approve sends one contact_add, as the one command of a claimed plan, with the ticked people. Canvas adds the P0 and P0
 *      Contacts rows and logs each in CRM Auto Added, so Accounts › Auto add's Undo takes it back. Skip page adds nobody.
 *      Nothing is written to Canvas before Approve. No email, no HubSpot write. */
const CUE_CN_ = { years: 3, page: 100, pages: 4, batch: 50, cos: 25, people: 40, ai: 20, days: 7, check: 200, checks: 5, mails: 2, ms: 60000, tries: 3 };
const CUE_CN_TAB_ = 'New contacts';
const CUE_CN_MODEL_ = 'claude-haiku-5-5';
const CUE_CN_RE_ = /^\s*(?:please\s+)?(?:scan|check|read)\s+(?:my\s+)?(?:gmail|e-?mails?)\s+for\s+new\s+contacts\s*[.!?]?\s*$/i;
// Kiko 29 Oct 2026 13:40Z, "Yes, skip them" on the card "Skip automated senders (no-reply, notifications, mailer-daemon) in the Gmail
// contact scan?": addresses like no-reply@, noreply@, notifications@, mailer-daemon@ and bounce@ never reach the cards.
const CUE_CN_AUTO_ = /^(no-?reply|do-?not-?reply|notifications?|mailer-daemon|bounces?)([+._-]|@)/i;
const CUE_CN_COL_ = { email: 0, name: 1, via: 2, subject: 3, date: 4, thread: 5, status: 6, company: 7, title: 8, phone: 9, updated: 10, run: 11 };

/** PURE. A From or Cc header -> [{ name, email }]: "Ana Reyes <ana@x.com>, \"Lim, Mark\" <mark@y.com>, joy@z.com". */
function cueCnAddrs_(v) {
  const out = [], re = /(?:"([^"]*)"|([^,<>"]*?))\s*<([^<>\s]+@[^<>\s]+)>|([^\s,;<>"]+@[^\s,;<>"]+\.[a-z]{2,})/gi;
  let m;
  while ((m = re.exec(String(v || '')))) {
    const e = cueEmail_(String(m[3] || m[4] || '').toLowerCase()); if (!e) continue;
    const n = String(m[1] || m[2] || '').replace(/\s+/g, ' ').replace(/^['\s]+|['\s]+$/g, '').trim();
    out.push({ name: n.indexOf('@') >= 0 ? '' : cueStr_(n, 120), email: e });
  }
  return out;
}
/** PURE. One message's metadata -> the people in its From and Cc: [{ email, name, via, subject, date, thread }]. */
function cueCnPeople_(m) {
  const h = {}; ((m && m.payload && m.payload.headers) || []).forEach(x => { h[String(x.name).toLowerCase()] = String(x.value || ''); });
  const date = m && m.internalDate ? cueMnlDay_(Number(m.internalDate)) : '', thread = /^[0-9a-f]{6,40}$/.test(String((m && m.threadId) || '')) ? m.threadId : '';
  const out = [];
  [['from', 'From'], ['cc', 'Cc']].forEach(([k, via]) => cueCnAddrs_(h[k]).filter(a => !CUE_CN_AUTO_.test(a.email)).forEach(a => out.push(Object.assign(a, { via, subject: cueStr_(h.subject, 200), date, thread }))));
  return out;
}

/** The window being read: { from, to (ms), token, done, kind, tries }. The first is the 3-year rewind; then one a week. */
function cueCnState_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('CUE_CN_STATE') || 'null'); } catch (e) { return null; } }
function cueCnSave_(st) { PropertiesService.getScriptProperties().setProperty('CUE_CN_STATE', JSON.stringify(st)); }

/** The tab as { sh, rows, at: { email: index } }. Text cells come back as text (a leading ' keeps Sheets from reading them as a
 *  date, a number or a formula). */
function cueCnRead_() {
  const sh = cueSheet_(CUE_CN_TAB_), n = sh.getLastRow(), rows = n > 1 ? sh.getRange(2, 1, n - 1, 12).getValues() : [], at = {};
  rows.forEach((r, i) => { [1, 3, 4, 5, 7, 8, 9].forEach(j => { r[j] = String(r[j] == null ? '' : r[j]).replace(/^'/, ''); }); at[String(r[0]).toLowerCase()] = i; });
  return { sh, rows, at };
}
/** A row as written: every text cell after the email starts with ' so Sheets keeps it as typed. */
const cueCnRow_ = r => r.map((v, j) => [1, 3, 4, 5, 7, 8, 9].indexOf(j) >= 0 && String(v) !== '' ? "'" + v : v);
function cueCnPut_(T, i) { T.sh.getRange(i + 2, 1, 1, 12).setValues([cueCnRow_(T.rows[i])]); }

/** Reads Gmail pages of the open window until the time or page budget ends. Returns how many new people it found. */
function cueCnCollect_(st, T, until) {
  let added = 0, pages = 0;
  const q = 'after:' + Math.floor(st.from / 1000) + ' before:' + Math.floor(st.to / 1000) + ' -in:chats';
  while (!st.done && pages < CUE_CN_.pages && cueNow_() < until) {
    const list = cueCsGmail_(['/messages?maxResults=' + CUE_CN_.page + '&q=' + encodeURIComponent(q) + (st.token ? '&pageToken=' + encodeURIComponent(st.token) : '')])[0];
    if (!list) throw new Error('Gmail did not list messages');
    const ids = (list.messages || []).map(x => x.id), got = [];
    let failed = 0;
    for (let i = 0; i < ids.length; i += CUE_CN_.batch) {
      cueCsGmail_(ids.slice(i, i + CUE_CN_.batch).map(id => '/messages/' + id + '?format=metadata&metadataHeaders=From&metadataHeaders=Cc&metadataHeaders=Subject'))
        .forEach(m => { if (m) got.push(m); else failed++; });
    }
    const now = new Date(cueNow_()), fresh = [];
    got.forEach(m => cueCnPeople_(m).forEach(p => {
      const k = p.email, i = T.at[k];
      if (i === undefined) { T.at[k] = T.rows.length + fresh.length; fresh.push([k, p.name, p.via, p.subject, p.date, p.thread, 'Waiting', '', '', '', now, '']); return; }
      const r = i < T.rows.length ? T.rows[i] : fresh[i - T.rows.length];
      if (r[6] === 'Waiting' && p.date > String(r[4])) { r[2] = p.via; r[3] = p.subject; r[4] = p.date; r[5] = p.thread; if (!r[1]) r[1] = p.name; if (i < T.rows.length) cueCnPut_(T, i); }
    }));
    if (fresh.length) { T.sh.getRange(T.rows.length + 2, 1, fresh.length, 12).setValues(fresh.map(cueCnRow_)); T.rows = T.rows.concat(fresh); added += fresh.length; }
    pages++;
    if (failed && (st.tries || 0) + 1 < CUE_CN_.tries) { st.tries = (st.tries || 0) + 1; break; }   // read this page again next time; the people already found stay
    st.tries = 0; st.token = list.nextPageToken || ''; st.read = (st.read || 0) + ids.length;
    if (!st.token) { st.done = true; st.doneAt = cueNow_(); }
  }
  return added;
}

/** Canvas's check for the Waiting rows: Known, or New with the company they would go to. At most 5 calls a run. */
function cueCnCheck_(s, T) {
  for (let n = 0; n < CUE_CN_.checks; n++) {
    const idx = []; T.rows.forEach((r, i) => { if (r[6] === 'Waiting' && idx.length < CUE_CN_.check) idx.push(i); });
    if (!idx.length) return;
    const res = cueBridge_(s, 'contact_new_check', { people: idx.map(i => ({ email: String(T.rows[i][0]) })) }) || {}, now = new Date(cueNow_()), co = {};
    (res.groups || []).forEach(g => (g.emails || []).forEach(e => { co[e] = g; }));
    (res.known || []).forEach(e => { co[e] = { known: true }; });
    idx.forEach(i => { const r = T.rows[i], g = co[String(r[0])]; if (!g) return;
      r[6] = g.known ? 'Known' : 'New'; r[7] = g.known ? '' : g.company || ''; r[10] = now; cueCnPut_(T, i); });
  }
}

/** Signature lines of each person's own newest emails, read by one Claude Haiku call per 20 people. Sets x.title, x.company, x.phone. */
function cueCnSign_(s, people) {
  const own = cueOwnDomain_(), lists = cueCsGmail_(people.map(x => '/messages?maxResults=' + CUE_CN_.mails + '&q=' + encodeURIComponent('from:' + x.email + ' newer_than:' + CUE_CN_.years + 'y -in:chats')));
  const want = []; people.forEach((x, i) => { x.sig = []; ((lists[i] || {}).messages || []).slice(0, CUE_CN_.mails).forEach(m => want.push({ i, id: m.id })); });
  const full = cueCsGmail_(want.map(w => '/messages/' + w.id + '?format=full')), byId = {};
  full.forEach(m => { if (m) byId[m.id] = m; });
  want.forEach(w => { const m = byId[w.id], x = people[w.i]; if (!m || x.sig.length) return; x.sig = cueCsSig_(cueStyleBody_(m.payload), own); });
  const asked = people.filter(x => x.sig.length), calls = [];
  for (let i = 0; i < asked.length; i += CUE_CN_.ai) {
    const part = asked.slice(i, i + CUE_CN_.ai);
    calls.push(cueClaude_({ step: 'new contacts', model: CUE_CN_MODEL_, system: CUE_CS_SYSTEM_, schema: CUE_CS_SCHEMA_, maxTokens: 3000, effort: 'low',
      user: part.map((x, j) => 'P' + (j + 1) + ' (' + x.email + ') blank: title, company, phone\n' + x.sig.map(l => '  ' + l).join('\n')).join('\n\n') }));
  }
  cueAiAll_(s, calls).forEach((r, c) => { if (!r.ok) return;
    (r.data.people || []).forEach(p => { const j = Number(String(p.k || '').replace(/\D/g, '')) - 1, x = j >= 0 && j < CUE_CN_.ai ? asked[c * CUE_CN_.ai + j] : null; if (!x) return;
      x.title = cueCsKeep_(x.sig, p.title, p.title_line, false); x.company = cueCsKeep_(x.sig, p.company, p.company_line, false); x.phone = cueCsKeep_(x.sig, p.phone, p.phone_line, true); }); });
}

/** One card: the next New rows, at most 25 companies and 40 people, new companies first. Returns the card's id, '' when everyone
 *  turned out to be in Canvas (the next run makes the next card), or null when nobody is left to show. */
function cueCnCard_(s, T, st) {
  const by = {}, order = [];
  T.rows.forEach((r, i) => { if (r[6] !== 'New') return; const g = String(r[7]) ? 'c|' + String(r[7]).toLowerCase() : 'd|' + String(r[0]).split('@')[1];
    if (!by[g]) { by[g] = []; order.push(g); } by[g].push(i); });
  if (!order.length) return null;
  const pick = [];
  for (let n = 0; n < order.length && n < CUE_CN_.cos && pick.length < CUE_CN_.people; n++) by[order[n]].slice(0, CUE_CN_.people - pick.length).forEach(i => pick.push(i));
  const people = pick.map(i => ({ i, email: String(T.rows[i][0]), name: String(T.rows[i][1]) }));
  cueCnSign_(s, people);
  const res = cueBridge_(s, 'contact_new_check', { people: people.map(x => Object.assign({ email: x.email }, x.company ? { company: x.company } : {})) }) || {};
  const now = new Date(cueNow_()), known = {}, rowOf = {};
  (res.known || []).forEach(e => { known[e] = 1; });
  people.forEach(x => { rowOf[x.email] = x; const r = T.rows[x.i];
    if (known[x.email]) r[6] = 'Known'; else { r[6] = 'On card'; r[8] = x.title || ''; r[9] = x.phone || ''; r[11] = s.id; }
    r[10] = now; });
  const groups = (res.groups || []).filter(g => (g.emails || []).length).sort((a, b) => (a.status === 'new' ? 0 : a.status === 'keep' ? 1 : 2) - (b.status === 'new' ? 0 : b.status === 'keep' ? 1 : 2));
  const lines = [], emails = []; let n = 0;
  groups.forEach(g => {
    lines.push((g.company || 'No company (personal email)') + (g.domain ? ' · ' + g.domain : '') + ' · ' + (g.status === 'new' ? 'New company, P0' : g.status === 'keep' ? 'In Canvas' + (g.p ? ', ' + g.p : '') + ', stage stays' : 'contact only'));
    g.emails.forEach(e => { const x = rowOf[e]; if (!x) return; const r = T.rows[x.i]; r[7] = g.company || ''; n++; emails.push(e);
      lines.push('☐' + n + ' ' + [x.name || e.split('@')[0], x.title || 'title not in signature', e, r[2], r[3] ? '"' + r[3] + '"' : '', String(r[4])].filter(Boolean).join(' · ')); });
  });
  people.forEach(x => cueCnPut_(T, x.i));
  if (!emails.length) return '';
  const left = T.rows.filter(r => r[6] === 'New').length, cos = groups.filter(g => g.status !== 'none').length;
  return cueAskOpen_({ type: 'contactnew', run: s.id, emails },
    'Add new contacts to Canvas? From the From and Cc of your Gmail (' + (st.kind === 'weekly' ? 'the last week' : 'the last ' + CUE_CN_.years + ' years') + '): '
    + cos + ' compan' + (cos === 1 ? 'y' : 'ies') + ', ' + emails.length + ' ' + (emails.length === 1 ? 'person' : 'people') + (left ? ', ' + left + ' more after this card' : '') + '.\n'
    + lines.join('\n') + '\nUntick anyone you don\'t want. Nothing is added until you tap Approve. Undo any of it in Canvas › Accounts › Auto add.', ['approve', 'skippage'], '');
  return true;
}

/** The 5-minute job (CueJobs.gs): read Gmail, check with Canvas, post the next card when none is open. Returns new people found. */
function cueCnTick_() {
  const P = PropertiesService.getScriptProperties(), until = cueNow_() + CUE_CN_.ms;
  let st = cueCnState_();
  if (!st) { const now = cueNow_(); st = { kind: 'rewind', from: now - CUE_CN_.years * 365.25 * 864e5, to: now, token: '', done: false }; }
  if (st.done && cueNow_() - st.to >= CUE_CN_.days * 864e5) st = { kind: 'weekly', from: st.to, to: cueNow_(), token: '', done: false };
  const s = { id: 'cue-cn-' + cueNow_().toString(36) + Math.floor(Math.random() * 4096).toString(36), metrics: { ai_calls: 0, calls: [] } };
  const T = cueCnRead_();
  let added = 0;
  try { added = cueCnCollect_(st, T, until); } finally { cueCnSave_(st); }
  if (!st.done) return added;
  cueCnCheck_(s, T);
  const open = P.getProperty('CUE_CN_CARD');
  if (open && P.getProperty('CUE_ASK_' + open)) return added;   // one card at a time
  if (T.rows.some(r => r[6] === 'Waiting')) return added;       // Canvas checks the rest first
  const id = cueCnCard_(s, T, st);
  if (id) P.setProperty('CUE_CN_CARD', id); else P.deleteProperty('CUE_CN_CARD');
  return added;
}

/** Approve or Skip page on the card (CueRoute.gs cueAskPick). note = "skip:2,5": the rows Kiko unticked. */
function cueCnPick_(o, pick, done, note) {
  const skip = {}; (String(note || '').match(/^skip:([\d,]*)$/) || ['', ''])[1].split(',').filter(Boolean).forEach(n => { skip[Number(n)] = 1; });
  const want = (o.emails || []).filter((e, i) => !skip[i + 1]);
  cueChat_('Kiko', pick === 'approve' ? 'Approve ' + want.length : 'Skip page', done);
  PropertiesService.getScriptProperties().deleteProperty('CUE_CN_CARD');
  const T = cueCnRead_(), now = new Date(cueNow_()), mark = (list, status) => list.forEach(e => { const i = T.at[e]; if (i === undefined) return; T.rows[i][6] = status; T.rows[i][10] = now; cueCnPut_(T, i); });
  if (pick !== 'approve' || !want.length) { mark(o.emails || [], 'Skipped'); cueChat_('Cue', 'OK, nobody added. Nothing was written to Canvas. The next page comes in a few minutes.', done); return { chat: true }; }
  const people = want.map(e => { const r = T.rows[T.at[e]] || []; const x = { email: e }, put = (k, v) => { if (String(v || '').trim()) x[k] = String(v).trim(); };
    put('name', cueStr_(r[1], 120)); put('title', cueStr_(r[8], 120)); put('phone', r[9]); put('company', cueStr_(r[7], 120)); put('via', r[2]); put('subject', cueStr_(r[3], 200));
    put('date', CUE_DATE_RE_.test(String(r[4])) ? r[4] : ''); put('thread', r[5]); return x; });
  const s = { id: 'cue-cn-' + cueNow_().toString(36) + Math.floor(Math.random() * 4096).toString(36) };
  const args = { request_id: s.id, people }, cmd = { command_id: 'cue:' + s.id + ':contact_add:0', action: 'contact_add', args, pid: '' };
  let r;
  try { cueBridgePlan_(s, [cmd]); r = cueBridgeParse_('contact_add', UrlFetchApp.fetchAll([cueBridgeReq_(s, 'contact_add', args, '', cmd.command_id)])[0]) || {}; }
  catch (e) { mark(o.emails || [], 'New'); cueChat_('Cue', 'Canvas did not save it (' + cueStr_((e && e.message) || e, 300) + '). Nobody was added. The same people come back on the next card in a few minutes.', done); return { chat: true }; }
  if (r.refused) { mark(o.emails || [], 'New'); cueChat_('Cue', 'Canvas refused: ' + cueStr_(r.refused, 300) + ' Nobody was added.', done); return { chat: true }; }
  const added = (r.contacts || []).map(x => x.email), kn = r.known || [];
  mark(added, 'Added'); mark(kn, 'Known'); mark((o.emails || []).filter(e => added.indexOf(e) < 0 && kn.indexOf(e) < 0), 'Not added');
  cueChat_('Cue', 'Added ' + added.length + ' contact' + (added.length === 1 ? '' : 's') + ((r.companies || []).length ? ' and ' + r.companies.length + ' new compan' + (r.companies.length === 1 ? 'y' : 'ies') + ' at P0' : '') + ' to Canvas.'
    + (kn.length ? ' ' + kn.length + ' already in Canvas, left alone.' : '') + ' Undo any of it in Canvas › Accounts › Auto add. The next page comes in a few minutes.', done);
  return { chat: true };
}

/** "scan my gmail for new contacts": runs the job now and says where it is. */
function cueCnSaid_(text, ref) {
  if (!CUE_CN_RE_.test(String(text || ''))) return null;
  const home = ref || '';
  cueChat_('Kiko', String(text).trim(), home);
  let err = '';
  try { cueCnTick_(); } catch (e) { err = cueStr_((e && e.message) || e, 200); }
  const st = cueCnState_() || {}, T = cueCnRead_(), c = k => T.rows.filter(r => r[6] === k).length;
  cueChat_('Cue', (err ? 'The scan stopped (' + err + '). It tries again in 5 minutes. ' : '')
    + (st.done ? 'Read ' + (st.kind === 'weekly' ? 'this week\'s' : 'all ' + CUE_CN_.years + ' years of') + ' mail. ' : 'Reading your Gmail (' + (st.kind === 'weekly' ? 'the last week' : 'the last ' + CUE_CN_.years + ' years') + '), ' + (st.read || 0) + ' emails so far. ')
    + T.rows.length + ' people found: ' + c('Known') + ' already in Canvas, ' + c('Added') + ' added, ' + (c('New') + c('Waiting')) + ' to show you, ' + c('On card') + ' on the open card.', home);
  return { chat: true, task: home };
}
