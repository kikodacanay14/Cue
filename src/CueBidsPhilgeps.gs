/* CUE-BIDS-PHILGEPS-2026-10-29 (bug, Cue issue #221). The daily bid check asked ChatGPT to look at the public PhilGEPS notices site
 * ("Other PhilGEPS"), but ChatGPT only ever saw the category index page and still logged the source as Checked. A read in Kiko's
 * Chrome on 29 Oct found 50 open notices there that pass his screen, none of which had reached his card.
 * Cue's own code now reads that site, between the ChatGPT search and the screen:
 *   - The open lists of four event categories (BusCatID: Events Management 156, Audio and Visual Equipment 60, Catering Services 117,
 *     Printing Services 29). A list is a plain GET; its next pages are ASP.NET postbacks of the same form (nextLB), 20 rows a page.
 *   - Each notice's abstract page, once: the ABC, Area of Delivery, agency, title and closing time sit in spans with fixed ids.
 *     What was read is kept in the Cue sheet's hidden "PhilGEPS notices" tab, so a later day reads only notices new since then.
 *   - The notices go into the same screen as ChatGPT's (Kiko's ₱50,000 to ₱700,000, area list, never Bataan, still open) and the same
 *     dedupe against his bid sheet. Nothing new is decided here: this only opens what the source already lists.
 * The site needs no sign-in. Reads are paced (a pause between batches of abstracts) and capped at about two minutes per run; what is
 * left carries on at the next 5-minute resume. A check version reads page 1 only (a postback is a POST). No AI call. */
const CUE_PG_ = { base: 'https://notices.philgeps.gov.ph/GEPSNONPILOT/Tender/', pages: 40, batch: 8, pause_ms: 1000, budget_ms: 120 * 1000, tab: 'PhilGEPS notices',
  cats: [{ id: 156, name: 'Events Management' }, { id: 60, name: 'Audio and Visual Equipment' }, { id: 117, name: 'Catering Services' }, { id: 29, name: 'Printing Services' }] };
const CUE_PG_HEAD_ = ['Ref', 'Category', 'Agency', 'Title', 'ABC', 'Area', 'Closes', 'Posted', 'Mode', 'Read (UTC)'];

const cueBidsPgList_ = id => CUE_PG_.base + 'SplashOpportunitiesSearchUI.aspx?menuIndex=3&BusCatID=' + id + '&type=category&ClickFrom=OpenOpp';
const cueBidsPgAbs_ = ref => CUE_PG_.base + 'SplashBidNoticeAbstractUI.aspx?menuIndex=3&refID=' + ref;
const cueBidsPgUnesc_ = t => String(t || '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&#039;/g, '\'').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(Number(n)));
const cueBidsPgText_ = h => cueBidsPgUnesc_(String(h || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

/** The notice rows of one list page: { ref, posted, closes }. */
function cueBidsPgRows_(html) {
  const out = [];
  String(html || '').split(/<tr[^>]*class="GridItem"/i).slice(1).forEach(chunk => {
    const tr = chunk.split(/<\/tr>/i)[0], m = tr.match(/refID=(\d+)/);
    if (!m) return;
    const td = tr.split(/<td/i).slice(1).map(x => cueBidsPgText_('<td' + x));
    out.push({ ref: m[1], posted: td[1] || '', closes: td[2] || '' });
  });
  return out;
}
/** Every named input of the page's form, for the next-page postback. */
function cueBidsPgForm_(html) {
  const f = {};
  (String(html || '').match(/<input\b[^>]*>/gi) || []).forEach(t => {
    if (/type="(submit|button|image|checkbox|radio)"/i.test(t)) return;
    const n = (t.match(/\bname="([^"]*)"/i) || [])[1]; if (!n) return;
    f[cueBidsPgUnesc_(n)] = cueBidsPgUnesc_((t.match(/\bvalue="([^"]*)"/i) || [])[1] || '');
  });
  return f;
}
const cueBidsPgHasNext_ = html => /__doPostBack\(&#39;pgCtrlDetailedSearch\$nextLB&#39;|__doPostBack\('pgCtrlDetailedSearch\$nextLB'/.test(String(html || ''));
/** "06/11/2026 2:00 PM" (day first, Manila) as "2026-11-06T14:00+08:00"; a bare date as "2026-11-06". "" when unclear. */
function cueBidsPgWhen_(t) {
  const m = String(t || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*([AP]M))?/i);
  if (!m) return '';
  const d = m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  if (!m[4]) return d;
  let h = Number(m[4]) % 12; if (/p/i.test(m[6])) h += 12;
  return d + 'T' + ('0' + h).slice(-2) + ':' + m[5] + '+08:00';
}
/** One abstract page as a row of the tab, or null when it does not look like a notice. */
function cueBidsPgAbstract_(html, ref, cat) {
  const sp = id => { const m = String(html || '').match(new RegExp('id="' + id + '"[^>]*>([\\s\\S]*?)</span>', 'i')); return m ? cueBidsPgText_(m[1]) : ''; };
  const title = sp('lblDisplayTitle'); if (!title) return null;
  const abc = Number(sp('lblDisplayBudget').replace(/[^\d.]/g, '')) || 0;
  return [String(ref), cat, sp('lblDisplayProcuringEntity'), title, abc, sp('lblDisplayAOD'), cueBidsPgWhen_(sp('lblDisplayCloseDateTime')), cueBidsPgWhen_(sp('lblDisplayDatePublish')),
    sp('lblDisplayProcureMode'), new Date(cueNow_()).toISOString()];
}
/** CUE-BIDS-NOTICE-COPY (Kiko 30 Oct 2026 05:52Z: "Summary of requirements: What about audio and visual? what actions are requested
 * from us? add more details - if theres a document attach it to the card"; 05:53Z "yes in saving a copy of the notice").
 * The rest of an abstract page: the agency's own description, the contact person, delivery period, solicitation number, the site's
 * category and mode, and how many suppliers have asked for the documents. Read in Kiko's Chrome on 30 Oct (ref 13318074 and two more):
 * the documents themselves sit behind the paid Order step, so they are never fetched; the page has no free file link. */
function cueBidsPgDetails_(html) {
  const raw = id => { const m = String(html || '').match(new RegExp('id="' + id + '"[^>]*>([\\s\\S]*?)</span>', 'i')); return m ? m[1] : ''; };
  const lines = id => cueBidsPgUnesc_(raw(id).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ' ')).split('\n').map(x => x.replace(/\s+/g, ' ').trim());
  const sp = id => cueBidsPgText_(raw(id));
  const desc = lines('lblAbstractText').join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const c = lines('lblDisplayContactPerson').filter(Boolean), email = c.filter(x => /@/.test(x))[0] || '', phones = c.filter(x => /^\+?[\d\s()\-]{6,}(?:\s*Ext\.?\s*\d+)?$/i.test(x));
  return { description: desc.length > 2000 ? desc.slice(0, 1999) + '…' : desc, contact: c.length ? { name: c[0], role: c[1] || '', email, phone: phones.join(', ') } : null,
    solicitation: sp('lblDisplaySolNumber'), delivery: sp('lblDisplayPeriod'), category: sp('lblDisplayCategory'), mode: sp('lblDisplayProcureMode'),
    doc_requests: /^\d+$/.test(sp('lblDisplayDocReqList')) ? Number(sp('lblDisplayDocReqList')) : '' };
}
function cueBidsPgSheet_() {
  const ss = SpreadsheetApp.openById(cueProp_('CUE_SHEET_ID', ''));
  let sh = ss.getSheetByName(CUE_PG_.tab);
  if (!sh) { sh = ss.insertSheet(CUE_PG_.tab); sh.appendRow(CUE_PG_HEAD_); sh.setFrozenRows(1); if (sh.hideSheet) sh.hideSheet(); }
  const n = sh.getLastRow() - 1, by = {};
  (n > 0 ? sh.getRange(2, 1, n, CUE_PG_HEAD_.length).getValues() : []).forEach(v => { if (v[0]) by[String(v[0])] = v; });
  return { sh, by };
}
const cueBidsPgGet_ = (url, extra) => UrlFetchApp.fetch(url, Object.assign({ muteHttpExceptions: true, followRedirects: true, headers: { 'User-Agent': 'Mozilla/5.0 (BSE Cue bid check)' } }, extra || {}));

/** The stage between the ChatGPT search and the screen. Lists, then abstracts, then the notices into B.raw. Returns when the time is up. */
function cueBidsPg_(s, save) {
  const B = s.bids, t0 = cueNow_(), P = B.pg || (B.pg = { cat: 0, open: [], queue: [], cats: [] }), late = () => cueNow_() - t0 > CUE_PG_.budget_ms;
  const store = cueBidsPgSheet_();
  // 1. The open lists. A category is read in one go: its postback pages chain on the page before.
  while (P.cat < CUE_PG_.cats.length) {
    if (late()) return;
    const c = CUE_PG_.cats[P.cat], seen = [];
    let note = '', pages = 0;
    try {
      let r = cueBidsPgGet_(cueBidsPgList_(c.id)), html = r.getContentText();
      if (r.getResponseCode() !== 200) throw new Error('HTTP ' + r.getResponseCode());
      for (pages = 1; ; pages++) {
        cueBidsPgRows_(html).forEach(x => { if (seen.indexOf(x.ref) < 0) seen.push(x.ref); });
        if (!cueBidsPgHasNext_(html)) break;
        if (pages >= CUE_PG_.pages || UrlFetchApp.__cueCheck === true || late()) { note = 'stopped at page ' + pages; break; }
        const f = cueBidsPgForm_(html); f.__EVENTTARGET = 'pgCtrlDetailedSearch$nextLB'; f.__EVENTARGUMENT = '';
        Utilities.sleep(CUE_PG_.pause_ms);
        r = cueBidsPgGet_(cueBidsPgList_(c.id), { method: 'post', payload: f });
        if (r.getResponseCode() !== 200) { note = 'page ' + (pages + 1) + ' gave HTTP ' + r.getResponseCode(); break; }
        html = r.getContentText();
      }
    } catch (e) { note = 'could not open: ' + cueStr_((e && e.message) || e, 120); }
    P.cats.push({ name: c.name, listed: seen.length, pages, note });
    seen.forEach(ref => { if (P.open.indexOf(ref) < 0) { P.open.push(ref); if (!store.by[ref]) P.queue.push([ref, P.cat]); } });
    P.cat++; save();
  }
  // 2. Each new notice's abstract, once, in small paced batches.
  while (P.queue.length) {
    if (late()) return;
    const part = P.queue.slice(0, CUE_PG_.batch);
    let res = [];
    try { res = UrlFetchApp.fetchAll(part.map(q => ({ url: cueBidsPgAbs_(q[0]), muteHttpExceptions: true, followRedirects: true }))); }
    catch (e) { res = part.map(() => null); }
    const rows = [];
    part.forEach((q, i) => { const r = res[i]; const row = r && r.getResponseCode() === 200 ? cueBidsPgAbstract_(r.getContentText(), q[0], CUE_PG_.cats[q[1]].name) : null;
      if (row) { rows.push(row); store.by[q[0]] = row; } else P.failed = (P.failed || 0) + 1; });
    if (rows.length) store.sh.getRange(store.sh.getLastRow() + 1, 1, rows.length, CUE_PG_HEAD_.length).setValues(rows);
    P.queue = P.queue.slice(part.length); save();
    if (P.queue.length) Utilities.sleep(CUE_PG_.pause_ms);
  }
  // 3. Today's open notices go to the screen with ChatGPT's.
  B.raw = B.raw || [];
  const order = CUE_PG_.cats.map(c => c.name);
  P.open.map(ref => store.by[ref]).filter(Boolean).sort((a, b) => order.indexOf(a[1]) - order.indexOf(b[1])).forEach(v => B.raw.push({
    source: 'Other PhilGEPS', agency: String(v[2]), reference: String(v[0]), project: String(v[3]), location: String(v[5]), abc: Number(v[4]) || 0,
    budget_note: Number(v[4]) ? '' : 'ABC not stated on the PhilGEPS notice', posted: cueBidsDate_(v[7]), deadline: v[6] instanceof Date ? Utilities.formatDate(v[6], 'Asia/Manila', 'yyyy-MM-dd\'T\'HH:mm') + '+08:00' : String(v[6]),
    event_date: '', summary: v[1] + (v[8] ? ', ' + v[8] : ''), scope: '', eligibility: '', url: cueBidsPgAbs_(v[0]), documents: [], amendments: 'none seen',
    limitations: '', next_action: '', relevant: true }));
  // The source line says what code saw, in place of ChatGPT's view of the index page.
  const listed = P.cats.reduce((n, c) => n + c.listed, 0), gaps = P.cats.filter(c => c.note).map(c => c.name + ' ' + c.note);
  const src = (B.sources || []).filter(x => x.source === 'Other PhilGEPS')[0] || ((B.sources = B.sources || []).push({ source: 'Other PhilGEPS', url: CUE_BIDS_SOURCES_[1].url }), B.sources[B.sources.length - 1]);
  src.status = !listed && gaps.length ? 'Blocked' : gaps.length || P.failed ? 'Partial' : 'Checked';
  src.checked = 'Cue opened ' + P.cats.map(c => c.name + ' (' + c.listed + ')').join(', ') + ': ' + listed + ' open notices, each notice page read for ABC and area';
  src.gap = gaps.concat(P.failed ? [P.failed + ' notice page' + (P.failed === 1 ? '' : 's') + ' did not open'] : []).join('; ');
  delete B.pg;
  s.stage = 'Checking';
}
