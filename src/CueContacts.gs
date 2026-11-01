/* CUE-CONTACT-FIND-2026-10-30 (Kiko 30 Oct 2026 03:33Z: "can you please teach Cue now how to find contacts! what the format of an
 * email address is!! how to find it where to find it!!!"). At 11:30 Manila that day Kiko asked for Rommel Siena and Archie's
 * addresses on the AMI Group email; Cue searched Canvas projects for the names and said it could not look up contacts.
 * What an address is: CueText.gs cueEmailClean_ (local@domain.tld, display names, angle brackets and mailto: stripped).
 * Where Cue looks for the address of a person Kiko names, in this order. Read only, code only, no AI call:
 *   1. Canvas Client Desk › P0 Contacts (bridge read_rows, Priority book; on the allow-list since Kiko's 28 Oct phase 4 yes):
 *      rows whose Contact Name matches the person. A company alone (e.g. "AMI Group") gives that company's contacts.
 *   2. Kiko's own Gmail, last 3 years: the From, To, Cc and Reply-To headers of emails that name the person, where the display
 *      name (or the address's own name part) matches.
 *   3. When no header matched: the text of the newest 5 of those emails (signatures, "please email Archie at ..."), an address
 *      on the person's line or the 3 lines under it.
 * An address is never made up: no firstname@company patterns. When nothing matches, Cue says where it looked. When more than one
 * address matches, the one on the company's domain, then the most used, goes first and the others are named. */

const CUE_CT_ = { years: 3, list: 20, bodies: 5, below: 3 };
const CUE_CT_STOP_ = ['and', 'or', 'the', 'to', 'cc', 'mr', 'ms', 'mrs', 'sir', 'maam', 'ma', 'am', 'po', 'from', 'of', 'at', 'for', 'with'];

/** The words of a name, lower case, letters and digits only ("Ms. Ruth Andres" -> ["ruth", "andres"]). */
const cueCtWords_ = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/)
  .filter(w => w && CUE_CT_STOP_.indexOf(w) < 0);
/** At most one letter added, dropped or changed ("sienna" and "siena"). */
function cueCtNear_(a, b) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, d = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++d > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return d + (a.length - i) + (b.length - j) <= 1;
}
/** True when every word Kiko gave is one of the candidate's words: the same, a short form of 3+ letters ("Archie" for
 * "Archibald"), or one letter off when both have 5+ letters. */
function cueCtNameHit_(want, have) {
  const w = cueCtWords_(want), h = cueCtWords_(have);
  return !!w.length && !!h.length && w.every(x => h.some(y => x === y || (x.length >= 3 && y.indexOf(x) === 0) || (x.length >= 5 && y.length >= 5 && cueCtNear_(x, y))));
}
/** The people in a To Kiko wrote ("Rommel Siena and Archie", "Ana, Ben & Carlo"). Addresses are kept as they are. */
function cueContactNames_(to) {
  return String(to || '').split(/\s*(?:,|;|&|\/|\+|\band\b|\bat saka\b)\s*/i).map(x => x.trim()).filter(x => cueEmailClean_(x) || cueCtWords_(x).length);
}

/** Canvas P0 Contacts rows for each name (one read_rows each, in one batch). A failed or refused read is noted, never thrown. */
function cueCtCanvas_(s, names, company, tried) {
  const reads = names.map(n => ({ book: 'priority', tab: 'P0 Contacts', where: [{ column: 'Contact Name', contains: cueCtWords_(n)[0] || n }], limit: 100 }));
  if (company) reads.push({ book: 'priority', tab: 'P0 Contacts', where: [{ column: 'Company', contains: company }], limit: 100 });
  let res = [];
  try { res = UrlFetchApp.fetchAll(reads.map(a => cueBridgeReq_(s, 'read_rows', a))); }
  catch (e) { tried.push('Canvas P0 Contacts did not answer (' + cueStr_((e && e.message) || e, 120) + ')'); return reads.map(() => []); }
  let failed = '';
  const rows = res.map(r => { try { return (cueBridgeParse_('read_rows', r) || {}).rows || []; } catch (e) { failed = failed || cueStr_((e && e.message) || e, 120); return []; } });
  tried.push(failed ? 'Canvas P0 Contacts (' + failed + ')' : 'Canvas P0 Contacts');
  return rows;
}

/** Gmail ids for each search, in one fetchAll; [] for a search that failed. */
function cueCtList_(qs) {
  const auth = { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() };
  return UrlFetchApp.fetchAll(qs.map(q => ({ url: CUE_GMAIL_ + '/messages?maxResults=' + CUE_CT_.list + '&q=' + encodeURIComponent(q), muteHttpExceptions: true, headers: auth })))
    .map(r => { if (r.getResponseCode() !== 200) return []; try { return JSON.parse(r.getContentText()).messages || []; } catch (e) { return []; } });
}
function cueCtGet_(ids, how) {
  if (!ids.length) return [];
  const auth = { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, meta = '&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Reply-To&metadataHeaders=Subject';
  return UrlFetchApp.fetchAll(ids.map(id => ({ url: CUE_GMAIL_ + '/messages/' + id + '?format=' + how + (how === 'metadata' ? meta : ''), muteHttpExceptions: true, headers: auth })))
    .map(r => { if (r.getResponseCode() !== 200) return null; try { return JSON.parse(r.getContentText()); } catch (e) { return null; } });
}
/** One header value as [{ name, email }]: "Ana Reyes <ana@x.ph>, b@y.com" -> two people. */
function cueCtPeople_(v) {
  return (String(v || '').match(/(?:"[^"]*"|[^,"])+/g) || []).map(p => {
    const email = cueEmailClean_(p); if (!email) return null;
    const name = p.replace(/<[^>]*>/, '').replace(/["']/g, '').trim();
    return { name: cueEmailClean_(name) ? '' : name, email };
  }).filter(Boolean);
}

/** Finds the address of each person (or of a company's contacts when Kiko gave only a company). Never throws.
 *  names: ["Rommel Siena", "Archie"]; company: "AMI Group" or "". Returns { found: [{ name, email, source, also: [] }],
 *  missing: [names], company: [{ name, email }] (a company's P0 contacts when no person was named), tried: [where Cue looked] }. */
function cueContactFind_(s, names, company) {
  const tried = [], me = cueMe_().toLowerCase(), co = cueCtWords_(company).filter(w => w.length >= 3);
  const out = { found: [], missing: [], company: [], tried };
  const people = [];
  (names || []).forEach(n => { const e = cueEmailClean_(n); if (e) out.found.push({ name: n, email: e, source: 'as you wrote it', also: [] }); else if (cueCtWords_(n).length) people.push(String(n).trim()); });
  if (!people.length && !co.length) return out;
  const cand = people.map(() => ({}));   // per person: email -> { email, n, source, co }
  const add = (i, email, source, w) => { if (!email || email === me) return; const c = cand[i];
    if (!c[email]) c[email] = { email, n: 0, source, co: co.some(x => email.split('@')[1].indexOf(x) >= 0) };
    c[email].n += w || 1; };
  // 1. Canvas P0 Contacts.
  const rows = cueCtCanvas_(s, people, co.length && !people.length ? company : '', tried);
  people.forEach((n, i) => (rows[i] || []).forEach(r => { if (cueCtNameHit_(n, r['Contact Name'])) add(i, cueEmailsIn_(r['Email Address'])[0], 'Canvas P0 Contacts' + (r.Company ? ' (' + cueStr_(r.Company, 60) + ')' : ''), 100); }));
  if (!people.length) {
    (rows[0] || []).forEach(r => { const e = cueEmailsIn_(r['Email Address'])[0]; if (e && !out.company.some(x => x.email === e)) out.company.push({ name: cueStr_(r['Contact Name'], 80), email: e }); });
    return out;
  }
  // 2 and 3. Kiko's Gmail, for the people Canvas did not have.
  const left = people.map((n, i) => i).filter(i => !Object.keys(cand[i]).length);
  if (left.length) {
    try {
      const lists = cueCtList_(left.map(i => '"' + cueCtWords_(people[i]).join(' ') + '" newer_than:' + CUE_CT_.years + 'y -in:chats -in:drafts'));
      tried.push('your Gmail (last ' + CUE_CT_.years + ' years)');
      const ids = [], at = [];
      left.forEach((i, k) => (lists[k] || []).forEach(m => { ids.push(m.id); at.push(i); }));
      const meta = cueCtGet_(ids, 'metadata'), seen = {};
      meta.forEach((m, k) => { if (!m) return; const i = at[k], h = {};
        ((m.payload && m.payload.headers) || []).forEach(x => { h[String(x.name).toLowerCase()] = String(x.value || ''); });
        ['from', 'reply-to', 'to', 'cc'].forEach(f => cueCtPeople_(h[f]).forEach(p => {
          if (cueCtNameHit_(people[i], p.name) || cueCtNameHit_(people[i], p.email.split('@')[0].replace(/[._-]+/g, ' ')))
            add(i, p.email, 'your Gmail, "' + cueStr_(h.subject || '(no subject)', 80) + '"' + (m.internalDate ? ' (' + cueMnlDay_(Number(m.internalDate)) + ')' : ''));
        }));
        seen[i] = (seen[i] || []).concat([m.id]);
      });
      const need = left.filter(i => !Object.keys(cand[i]).length && (seen[i] || []).length);
      if (need.length) {
        const bid = [], bat = [];
        need.forEach(i => seen[i].slice(0, CUE_CT_.bodies).forEach(id => { bid.push(id); bat.push(i); }));
        cueCtGet_(bid, 'full').forEach((m, k) => { if (!m) return; const i = bat[k];
          const lines = cueStyleBody_(m.payload).replace(/\r\n?/g, '\n').split('\n').map(l => l.replace(/^[>\s]+/, '').trim());
          lines.forEach((l, j) => { if (!cueCtNameHit_(people[i], l.replace(/\S+@\S+/g, ' '))) return;
            lines.slice(j, j + 1 + CUE_CT_.below).forEach(x => cueEmailsIn_(x).forEach(e => add(i, e, 'an email in your Gmail that names them, "' + cueStr_(((m.payload.headers || []).filter(x => /^subject$/i.test(x.name))[0] || {}).value || '(no subject)', 80) + '"'))); });
        });
      }
    } catch (e) { tried.push('your Gmail did not answer (' + cueStr_((e && e.message) || e, 120) + ')'); }
  }
  people.forEach((n, i) => {
    const list = Object.keys(cand[i]).map(k => cand[i][k]).sort((a, b) => (b.co - a.co) || (b.n - a.n));
    if (!list.length) { out.missing.push(n); return; }
    out.found.push({ name: n, email: list[0].email, source: list[0].source, also: list.slice(1, 4).map(x => x.email) });
  });
  return out;
}

/** One plain line per person for a note or the chat call. */
function cueContactLines_(r) {
  const l = r.found.map(f => f.name + ': ' + f.email + ' (from ' + f.source + ')' + (f.also.length ? '; also seen: ' + f.also.join(', ') : ''));
  r.missing.forEach(n => l.push(n + ': no email address found in ' + (r.tried.join(', ') || 'Canvas or your Gmail') + '. Cue does not guess addresses.'));
  if (r.company.length) l.push('Contacts on file: ' + r.company.slice(0, 8).map(c => (c.name || '?') + ' <' + c.email + '>').join(', '));
  return l;
}

/* The chat call (Cue.gs cueTalk_) gets the addresses of people Kiko names, so it answers "look for Rommel Siena and Archie" with
 * their addresses instead of a project search. Runs only in an email's thread or when the message is about an email, a contact or
 * an address, for at most 3 capitalised names. Returns '' when it did not run. */
const CUE_CT_ASK_RE_ = /\b(e-?mails?|contacts?|address(es)?|look\s*(for|up)|find|search|who\s+is|send\s+(it\s+)?to|cc|bcc|recipients?)\b|\bto:/i;
const CUE_CT_NOT_NAME_ = ['i', 'cue', 'canvas', 'kiko', 'gmail', 'bse', 'find', 'look', 'email', 'emails', 'contact', 'contacts', 'change', 'please', 'hi', 'hello',
  'not', 'that', 'the', 'can', 'you', 'its', 'it', 'this', 'yes', 'no', 'ok', 'okay', 'go', 'send', 'draft', 'to', 'cc', 'in', 'is', 'my', 'our', 'their', 'client', 'supplier', 'crew', 'staff', 'project'];
function cueChatNames_(t) {
  return (String(t || '').match(/\b[A-Z][a-z][\p{L}'-]*(?:\s+[A-Z][a-z][\p{L}'-]*){0,2}/gu) || [])
    .map(n => n.split(/\s+/).filter(w => CUE_CT_NOT_NAME_.indexOf(w.toLowerCase()) < 0).join(' ').trim())
    .filter((n, i, a) => n.length >= 3 && a.indexOf(n) === i).slice(0, 3);
}
function cueChatContacts_(s, t, inMail) {
  if (!inMail && !CUE_CT_ASK_RE_.test(String(t || ''))) return '';
  const names = cueChatNames_(t);
  if (!names.length) return '';
  try { return cueContactLines_(cueContactFind_(s, names, '')).join('\n'); } catch (e) { return 'the contact search failed just now (' + cueStr_((e && e.message) || e, 120) + ')'; }
}
