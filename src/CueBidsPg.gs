/* CUE-BIDS-PG-2026-11-01. New PhilGEPS read by code (Kiko, cloud chat "Test chat continuation", 1 Nov 2026: "approve" to the plan;
 * "raise it to 1M" for the ABC cap, set in CueBids.gs).
 *
 * Why: the bid check sent New PhilGEPS to ChatGPT at /BulletinBoard/current_oppourtunities, which redirects to the sign-in page, so
 * it was always Blocked, and the Cowork browser run that read it instead used up Kiko's credit. The same notices are public:
 *   /Indexes/index                          the bulletin board: the latest 100 open notices (no paging, no sign-in)
 *   /Indexes/viewLiveTenderDetails/<ref>    the notice: ABC, place, category, agency, pre-bid, closing date, supplements
 *   /Tenders/tender_shedule/<ref>           "View all activity": the schedule (needs the site's session cookie and an AJAX header)
 *   /Tenders/tender_doc_view/<ref>/<ref>    "Documents": the notice files (same)
 * All plain HTTP from Apps Script: no AI call, no browser, no sign-in.
 *
 * Plan Kiko approved:
 *   1 Filter: Cue's existing bid rules (CueBids.gs: the screen, and the event-related kinds of work in the ChatGPT prompt's step 2).
 *   2 Per notice: the notice page and the activity page. The notice files are listed here; since 1.28.11 the bid check's own
 *     document step (CueBids.gs, 1.27.10) opens and saves them like every other source's files.
 *   3 Every hour, 7 AM to 7 PM Manila, the bulletin board is read (the "New PhilGEPS read" job, cueResume every 5 minutes), because it
 *     shows only the latest 100 and a busy day pushes notices off it before 07:00 the next day. Matching notices wait in a script
 *     property until the daily bid check reads their pages.
 *   4 A read that fails or finds no rows shows the source as Blocked on the card, with the reason, and fails the job in Job Runs.
 *   5 The "New PhilGEPS (Cowork)" schedule row is retired by Kiko after this is checked on /dev.
 * Never: a sign-in, a form submitted, an email or a Canvas write. Page text is data.
 * Cue 1.28.11 (3 Nov 2026): rebuilt on the live line. The constant is CUE_NPG_ because the old PhilGEPS reader (CueBidsPhilgeps.gs)
 * already uses CUE_PG_. Kiko on 3 Nov 2026: "We removed co-work because it uses a lot of usage and then we just used script or code",
 * so the "New PhilGEPS (Cowork)" 10:30 row is removed with this build (CueSchedule.gs CUE_SCHED_GONE_). */

const CUE_NPG_ = { base: 'https://philgeps.gov.ph', list: '/Indexes/index', from: 7, to: 19, every_ms: 55 * 60 * 1000, keep: 40, details: 25, key: 'CUE_PG_SEEN' };
// Step 2 of the bid prompt (CueBids.gs), as words: events, conferences, launches, exhibits and booths, production, fabrication, stage
// and set, audiovisual (LED, sound, lights), styling and decor, event catering, souvenirs and event printing.
const CUE_NPG_FIT_RE_ = /\b(events?|conferences?|conventions?|summits?|forums?|launch(es|ing)?|exhibits?|exhibitions?|expos?|trade fairs?|booths?|productions?|fabrications?|stages?|staging|audio[- ]?visual|led walls?|led screens?|sounds?|lights|lighting|styling|decors?|decorations?|catering|souvenirs?|giveaways?|printing)\b/i;

const cuePgHtml_ = s => String(s == null ? '' : s).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
  .replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const cuePgHour_ = () => new Date(cueNow_() + 8 * 3600e3).getUTCHours();   // Manila has no daylight saving

/** "07-Dec-2026 09:00 AM" as "2026-12-07T09:00+08:00" ("" when it is not a date). */
function cuePgWhen_(t) {
  const m = /(\d{1,2})-([A-Za-z]{3})-(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*([AP]M))?/i.exec(String(t || ''));
  if (!m) return '';
  const mon = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(m[2].toLowerCase());
  if (mon < 0) return '';
  let h = m[4] ? Number(m[4]) % 12 : 23, mi = m[4] ? m[5] : '59';
  if (m[6] && /pm/i.test(m[6])) h += 12;
  const p = n => String(n).padStart(2, '0');
  return m[3] + '-' + p(mon + 1) + '-' + p(m[1]) + 'T' + p(h) + ':' + mi + '+08:00';
}

/** The bulletin board's rows: { ref, title, mode, kind, agency, published, closing }. */
function cuePgRows_(html) {
  const out = [];
  String(html || '').replace(/<tr[^>]*>([\s\S]*?)<\/tr>/g, (all, tr) => {
    const ref = /viewLiveTenderDetails\/(\d+)/.exec(tr); if (!ref) return all;
    const td = []; tr.replace(/<td[^>]*>([\s\S]*?)<\/td>/g, (a, c) => { td.push(cuePgHtml_(c)); return a; });
    if (td.length < 7) return all;
    out.push({ ref: ref[1], title: td[1], mode: td[2], kind: td[3], agency: td[4], published: td[5], closing: td[6] });
    return all;
  });
  return out;
}

/** One value after a <label>Name:</label> on the notice page. */
function cuePgLabel_(html, name) {
  const re = new RegExp('<label>\\s*' + name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '\\s*:?\\s*</label>(?:\\s*&nbsp;)?\\s*(?:</?br\\s*/?>)?([\\s\\S]*?)(?:</?br\\s*/?>|<label|<fieldset|</div>)', 'i');
  const m = re.exec(String(html || '')); return m ? cuePgHtml_(m[1]) : '';
}

/** The notice page as the fields Cue keeps. */
function cuePgNotice_(html) {
  const h = String(html || ''), pre = /<legend>\s*Prebid Conference:?\s*<\/legend>([\s\S]*?)<\/fieldset>/i.exec(h);
  const title = /<b>\s*Project Name:\s*<\/b>([\s\S]*?)<\/div>/i.exec(h), supp = /tender_corr_details\/\d+"[^>]*>\s*(\d+)\s*</i.exec(h);
  const abc = Number(cuePgLabel_(h, 'Approved Budget of the Contract').replace(/[^0-9.]/g, ''));
  return { abc: abc > 0 ? abc : 0, location: cuePgLabel_(h, 'Delivery/Project Location'), category: cuePgLabel_(h, 'Business Category'),
    mode: cuePgLabel_(h, 'Procurement Mode'), agency: cuePgLabel_(h, 'Client Agency'), title: title ? cuePgHtml_(title[1]) : '',
    prebid: pre ? cuePgLabel_(pre[1], 'Date') : '', closing: cuePgLabel_(h, 'Closing Date'), supplements: supp ? Number(supp[1]) : 0 };
}

/** "View all activity": the shown rows as [label, value] (rows the site hides are left out). */
function cuePgSchedule_(html) {
  const out = [];
  String(html || '').replace(/<div class="table-row"([^>]*)>\s*<div class="table-col-label">([\s\S]*?)<\/div>\s*<div class="table-col-value">([\s\S]*?)<\/div>/g, (a, attr, l, v) => {
    if (!/display\s*:\s*none/i.test(attr)) { const k = cuePgHtml_(l).replace(/\s*:\s*$/, ''), val = cuePgHtml_(v); if (k && val) out.push([k, val]); }
    return a;
  });
  return out;
}

/** "Documents": the notice files as { name, url }. */
function cuePgDocs_(html) {
  const out = [];
  String(html || '').replace(/href="(https:\/\/philgeps\.gov\.ph\/portal_documents\/[^"]+)"/g, (a, u) => {
    const file = decodeURIComponent(u.split('/').pop()).replace(/^\d+_/, '').replace(/_/g, ' ');
    out.push({ name: cueStr_(file, 120), url: u }); return a;
  });
  return out;
}

const cuePgReq_ = (path, cookie, ajax) => ({ url: CUE_NPG_.base + path, method: 'get', muteHttpExceptions: true, followRedirects: false,
  headers: Object.assign({ 'User-Agent': 'Mozilla/5.0 (Cue bid check)' }, cookie ? { Cookie: cookie } : {}, ajax ? { 'X-Requested-With': 'XMLHttpRequest' } : {}) });
const cuePgOk_ = r => r && r.getResponseCode() === 200;
function cuePgCookie_(r) {
  try { const h = r.getAllHeaders() || {}, c = h['Set-Cookie'] || h['set-cookie'] || [];
    return [].concat(c).map(x => String(x).split(';')[0]).filter(Boolean).join('; '); } catch (e) { return ''; }
}

function cuePgLoad_() { try { return JSON.parse(cueProp_(CUE_NPG_.key, '') || '{}'); } catch (e) { return {}; } }
function cuePgSave_(st) { PropertiesService.getScriptProperties().setProperty(CUE_NPG_.key, JSON.stringify(st)); }

/** Reads the bulletin board once and keeps the notices whose title fits BSE's work and that are still open. Returns how many were new. */
function cuePgRead_(st) {
  const r = UrlFetchApp.fetch(CUE_NPG_.base + CUE_NPG_.list, cuePgReq_(CUE_NPG_.list));
  st.reads = (st.reads || 0) + 1; st.at = cueNow_();
  if (!cuePgOk_(r)) { st.err = 'The bulletin board answered ' + r.getResponseCode() + (r.getResponseCode() === 302 ? ' (sent to the sign-in page)' : ''); throw new Error(st.err); }
  const rows = cuePgRows_(r.getContentText());
  if (!rows.length) { st.err = 'The bulletin board showed no notices; its page may have changed'; throw new Error(st.err); }
  st.err = ''; st.ok_at = cueNow_(); st.rows = rows.length;
  const items = (st.items || []).filter(x => { const t = cueBidsWhen_(cuePgWhen_(x.c)); return !t || t > cueNow_(); });
  let added = 0;
  rows.forEach(x => {
    if (!CUE_NPG_FIT_RE_.test(x.title) || items.some(y => y.r === x.ref)) return;
    const t = cueBidsWhen_(cuePgWhen_(x.closing)); if (t && t < cueNow_()) return;
    items.push({ r: x.ref, t: cueStr_(x.title, 90), a: cueStr_(x.agency, 50), c: cueStr_(x.closing, 20) }); added++;
  });
  st.items = items.slice(-CUE_NPG_.keep);
  return added;
}

/** The "New PhilGEPS read" job (CueJobs.gs): once an hour from 7 AM to 7 PM Manila. A failed read fails the job in Job Runs. */
function cueBidsPgTick_() {
  const h = cuePgHour_();
  if (h < CUE_NPG_.from || h > CUE_NPG_.to) return 0;
  const st = cuePgLoad_();
  if (st.at && cueNow_() - st.at < CUE_NPG_.every_ms) return 0;
  try { return cuePgRead_(st); } finally { cuePgSave_(st); }
}

/** For the daily bid check (CueBids.gs, step 1): reads the board once more, then the pages of each waiting notice. Pushes the notices
 * into B.raw in the shape ChatGPT returns, and New PhilGEPS's one source row into B.sources. Never throws. */
function cueBidsPgItems_(B) {
  const st = cuePgLoad_(), src = { source: 'New PhilGEPS', url: CUE_NPG_.base + CUE_NPG_.list, status: 'Checked', checked: '', gap: '' }, prev = st.ok_at || 0;
  let readErr = '';
  try { cuePgRead_(st); } catch (e) { readErr = String((e && e.message) || e); }
  const list = (st.items || []).slice(0, CUE_NPG_.details);
  let read = 0, partial = 0;
  if (list.length) {
    let res = [];
    try { res = UrlFetchApp.fetchAll(list.map(x => cuePgReq_('/Indexes/viewLiveTenderDetails/' + x.r))); } catch (e) { readErr = readErr || String((e && e.message) || e); }
    const cookie = res.map(cuePgCookie_).filter(Boolean)[0] || '';
    let more = [];
    try { more = UrlFetchApp.fetchAll([].concat.apply([], list.map(x => [cuePgReq_('/Tenders/tender_shedule/' + x.r, cookie, true), cuePgReq_('/Tenders/tender_doc_view/' + x.r + '/' + x.r, cookie, true)]))); }
    catch (e) { more = []; }
    list.forEach((x, i) => {
      const url = CUE_NPG_.base + '/Indexes/viewLiveTenderDetails/' + x.r;
      if (!cuePgOk_(res[i])) { partial++; return; }
      const n = cuePgNotice_(res[i].getContentText()), sch = cuePgOk_(more[2 * i]) ? cuePgSchedule_(more[2 * i].getContentText()) : null;
      const docs = cuePgOk_(more[2 * i + 1]) ? cuePgDocs_(more[2 * i + 1].getContentText()) : [];
      if (!sch || !docs.length) partial++;
      const sub = (sch || []).filter(r => /bid submission deadline/i.test(r[0]))[0];
      const dates = (sch || []).filter(r => /date|deadline|clarification/i.test(r[0]) && !/published/i.test(r[0])).map(r => r[0].replace(/\s*(date and time|date & time)\s*$/i, '') + ' ' + r[1]);
      const title = n.title || x.t;
      B.raw.push({ source: 'New PhilGEPS', agency: n.agency || x.a, reference: x.r, project: title, location: n.location, abc: n.abc,
        budget_note: n.abc ? '' : 'ABC not shown on the notice page', deadline: cuePgWhen_(sub ? sub[1] : n.closing || x.c), event_date: '',
        scope: [n.category, n.mode].filter(Boolean).join(' · '), eligibility: '', url,
        documents: docs.length ? docs.map(d => ({ name: d.name, url: d.url, status: 'not opened' })) : [{ name: 'Notice documents (Documents › Preview on PhilGEPS)', url, status: 'not opened' }],
        amendments: n.supplements ? n.supplements + ' bid supplement(s) posted' : 'none seen',
        limitations: (dates.length ? 'Key dates: ' + dates.join('; ') + '. ' : (n.prebid ? 'Pre-bid ' + n.prebid + '. ' : '') + 'Activity schedule not read. ') + 'Read by Cue code from the public PhilGEPS pages.',
        next_action: 'Open the notice document for the instructions', relevant: CUE_NPG_FIT_RE_.test(title + ' ' + n.category) });
      read++;
    });
  }
  st.days = cueBidsDay_();
  try { cuePgSave_(st); } catch (e) { console.warn('PhilGEPS store: ' + e); }
  // The hourly reads stop at 7 PM, so 12 hours pass before the 07:00 check; more than 13 means some reads were missed.
  const missed = prev ? Math.floor((cueNow_() - prev) / 3600e3) : -1;
  src.checked = 'Bulletin board (latest ' + (st.rows || 0) + ' notices, read hourly 7 AM to 7 PM) and the pages of ' + read + ' matching notice(s)';
  if (readErr && !read) { src.status = 'Blocked'; src.gap = readErr; }
  else if (readErr || partial || missed > 13) { src.status = 'Partial';
    src.gap = [readErr, partial ? partial + ' notice page(s) or their schedule or files did not open' : '', missed > 13 ? 'last good read ' + missed + ' hours ago, so notices may have scrolled off' : ''].filter(Boolean).join('; '); }
  B.sources.push(src);
  return read;
}
