// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: New PhilGEPS read by code (CueBidsPg.gs).
/* ---------- CUE-BIDS-PG-2026-11-01 (Kiko 1 Nov 2026: "approve"; "raise it to 1M") ----------
 * The markup below is copied from the live pages on 1 Nov 2026 (bulletin board row, notice page labels, "View all activity" and
 * "Documents"), cut to the parts the reader uses. "Now" in the sandbox is 21 Oct 2026, 11:00 in Manila. */
const PG_ROW = (ref, title, agency, closing) => `<tr> <td data-label="Bid Notice Reference Number"> <a href="https://philgeps.gov.ph/Indexes/viewLiveTenderDetails/${ref}">${ref}</a> </td> <td data-label="Control Number" style="text-align:left !important;"><span class="wrapped-long-string">${title} </span></td> <td data-label="Mode of Procurement" style="text-align:left !important;"><span>Small Value Procurement </span></td> <td data-label="Business Category" style="text-align:left !important;"><span>Goods </span></td> <td data-label="Agency Name" style="text-align:left !important;"><span>${agency} </span></td> <td data-label="Publish Date"><span>20-Oct-2026 </span></td> <td data-label="Closing date"><span>${closing}</span></td> </tr>`;
const PG_INDEX = '<table><tr><th scope="col">Publish Date</th></tr>' + [
  PG_ROW('119200', 'Event Management Services for the Year-End Conference', 'DEPARTMENT OF TOURISM', '28-Oct-2026 05:00 PM'),
  PG_ROW('119151', 'SBFP HOT MEALS', 'KUBAYAN ELEMENTARY SCHOOL', '04-Nov-2026 09:00 AM'),            // not BSE's kind of work
  PG_ROW('119100', 'Supply of LED Wall for Anniversary', 'CITY OF PASIG', '20-Oct-2026 09:00 AM'),     // already closed
  PG_ROW('119300', 'Sound and Lights Rental for the Town Fiesta', 'MUNICIPALITY OF TAYTAY', '30-Oct-2026 10:00 AM'),
  PG_ROW('119400', 'Stage and Lights for the Provincial Founding Anniversary', 'PROVINCE OF BATAAN', '29-Oct-2026 10:00 AM'),     // Bataan
  PG_ROW('119500', 'Sound System for the Cebu Trade Expo', 'CITY OF CEBU', '29-Oct-2026 10:00 AM')].join('') + '</table>';
const PG_NOTICE = (ref, abc, place, title, cat) => `<div class="col-sm-9"> <label>Notice Reference Number :${ref}</label> </div> <div class="col-sm-3 tamoha_twelvepx"> <label>Bid Validity Period (in Days): </label></br>120</br></br> <label>Approved Budget of the Contract: </label></br> ${abc}</br></br> <label>Procurement Mode: </label></br>Small Value Procurement</br></br> <label>Classification: </label></br>Goods</br></br> <label>Delivery/Project Location: </label></br>${place}</br></br> <label>Business Category: </label></br>${cat}</br></br> <label>Client Agency: </label></br>DEPARTMENT OF TOURISM</br></br> </div> <table><tr> <td width="20%"> <div> <b>Project Name:</b> ${title} </div> </td></tr></table> <div class="col-sm-3 tamoha_twelvepx"> <label>Schedule of activity:</label>&nbsp; <a class="link" rel="facebox" href_path="/Tenders/tender_shedule/${ref}">View all activity</a><br> <fieldset style="border:1px solid #999;padding:8px;"> <legend>Prebid Conference:</legend> <label>Date:</label></br> 23-Oct-2026 10:00 AM </br></br> <label>Venue:</label></br> DOT Office, Makati </br></br> </fieldset> <label>Closing Date:</label></br> 28-Oct-2026 05:00 PM </br></br> <label>Documents:</label>&nbsp; <a class="link" rel="facebox" href_path="/Tenders/tender_doc_view/${ref}/${ref}">Preview</a><br><br> <label>Bid Supplements: </label>&nbsp; <a rel="facebox" href="/Indexes/tender_corr_details/${ref}"> 1 </a></br> </div>`;
const PG_SCHED = `<h4>Schedule of activity</h4> <div id="table"> <div class="table-row"> <div class="table-col-label"><b>Bid Notice Published Date :</b></div> <div class="table-col-value">20-Oct-2026 12:00 AM</div> </div> <div class="table-row"> <div class="table-col-label"><b>Pre-Bid Meeting Start Date and Time :</b></div> <div class="table-col-value">23-Oct-2026 10:00 AM</div> </div> <div class="table-row" style="display:none;"> <div class="table-col-label"><b>Pre-Bid Meeting End Date and Time :</b></div> <div class="table-col-value">23-Oct-2026 10:00 AM</div> </div> <div class="table-row"> <div class="table-col-label"><b>Bid Submission Deadline Date and Time :</b></div> <div class="table-col-value">27-Oct-2026 10:00 AM</div> </div> <div class="table-row"> <div class="table-col-label"><b>Bid Opening Date and Time :</b></div> <div class="table-col-value">27-Oct-2026 11:00 AM</div> </div> </div>`;
const PG_DOCS = ref => `<h4>Bid Notice Documents</h4><table><tr><td>1</td><td><a href="https://philgeps.gov.ph/portal_documents/bid_notice_documents/bid_notice_${ref}/bid_notice_document/1793240247_ITB_Year-End_Conference.pdf">1793240247_ITB_Year-End_Conference.pdf</a></td></tr></table>`;
const pgPage = (code, text, cookie) => ({ getResponseCode: () => code, getContentText: () => text, getAllHeaders: () => (cookie ? { 'Set-Cookie': [cookie + '; path=/; HttpOnly'] } : {}) });
const PG_SITE = (o = {}) => (u, req) => {
  const p = u.replace('https://philgeps.gov.ph', '');
  if (p === '/Indexes/index') return o.index ? o.index() : pgPage(200, PG_INDEX);
  let m = /^\/Indexes\/viewLiveTenderDetails\/(\d+)$/.exec(p);
  if (m && m[1] === '119400') return pgPage(200, PG_NOTICE('119400', '500,000.00', 'Balanga, Bataan', 'Stage and Lights for the Provincial Founding Anniversary', 'Event management services'), 'CAKEPHP=abc123');
  if (m && m[1] === '119500') return pgPage(200, PG_NOTICE('119500', '500,000.00', 'Cebu City', 'Sound System for the Cebu Trade Expo', 'Event management services'), 'CAKEPHP=abc123');
  if (m) return m[1] === '119300' ? pgPage(200, PG_NOTICE('119300', '1,200,000.00', 'Taytay, Rizal', 'Sound and Lights Rental for the Town Fiesta', 'Rental of sound and lights'), 'CAKEPHP=abc123')
    : pgPage(200, PG_NOTICE(m[1], '950,000.00', 'Metro Manila', 'Event Management Services for the Year-End Conference', 'Event management services'), 'CAKEPHP=abc123');
  const ajax = (req.headers || {})['X-Requested-With'] === 'XMLHttpRequest' && /CAKEPHP=abc123/.test((req.headers || {}).Cookie || '');
  if (/^\/Tenders\/tender_shedule\//.test(p)) return pgPage(200, ajax ? PG_SCHED : '<p>Your session has been expired</p>');
  if ((m = /^\/Tenders\/tender_doc_view\/(\d+)\//.exec(p))) return pgPage(200, ajax ? PG_DOCS(m[1]) : '<p>Your session has been expired</p>');
  return pgPage(404, '');
};

test('PGS1 PhilGEPS pages: the bulletin row, the notice labels, the shown schedule rows and the files parse from the live markup', () => {
  const t = sandbox(), c = t.ctx;
  const rows = c.cuePgRows_(PG_INDEX);
  deq(rows.map(r => r.ref), ['119200', '119151', '119100', '119300', '119400', '119500']);
  deq([rows[0].title, rows[0].agency, rows[0].closing], ['Event Management Services for the Year-End Conference', 'DEPARTMENT OF TOURISM', '28-Oct-2026 05:00 PM']);
  const n = c.cuePgNotice_(PG_NOTICE('119200', '2,900,000.00', 'Metro Manila', 'Year-End Conference', 'Event management services'));
  deq([n.abc, n.location, n.category, n.agency, n.title, n.prebid, n.closing, n.supplements],
    [2900000, 'Metro Manila', 'Event management services', 'DEPARTMENT OF TOURISM', 'Year-End Conference', '23-Oct-2026 10:00 AM', '28-Oct-2026 05:00 PM', 1]);
  const s = c.cuePgSchedule_(PG_SCHED);
  assert.ok(s.some(r => r[0] === 'Bid Submission Deadline Date and Time' && r[1] === '27-Oct-2026 10:00 AM'));
  assert.ok(!s.some(r => /End Date/.test(r[0])), 'rows the site hides are left out');
  deq(c.cuePgDocs_(PG_DOCS('119200')).map(d => d.name), ['ITB Year-End Conference.pdf']);
  assert.strictEqual(c.cuePgWhen_('07-Dec-2026 09:00 AM'), '2026-12-07T09:00+08:00');
  assert.strictEqual(c.cuePgWhen_('07-Dec-2026 01:30 PM'), '2026-12-07T13:30+08:00');
  assert.strictEqual(c.cuePgWhen_('12-Dec-2026 12:00 AM'), '2026-12-12T00:00+08:00');
  assert.strictEqual(c.cuePgWhen_('n/a'), '');
});

test('PGS2 hourly read (7 AM to 7 PM Manila, no AI): keeps only open notices that fit BSE\'s work; once an hour; nothing at night', () => {
  const t = sandbox({ pg: PG_SITE() }), c = t.ctx;
  assert.strictEqual(c.cueBidsPgTick_(), 4, '11:00 Manila: the four open event notices (the board has no place column, so place is screened at 07:00)');
  const st = JSON.parse(t.props.CUE_PG_SEEN);
  deq(st.items.map(x => x.r), ['119200', '119300', '119400', '119500'], 'hot meals (not event work) and the closed LED wall are left out');
  assert.strictEqual(t.log.gpt.length, 0, 'no AI call');
  c.cueBidsPgTick_(); assert.strictEqual(t.log.pg.length, 1, 'a second tick within the hour reads nothing');
  t.ctx.__wait(60 * 60 * 1000); assert.strictEqual(c.cueBidsPgTick_(), 0, 'an hour later it reads again and adds nothing twice'); assert.strictEqual(t.log.pg.length, 2);
  t.ctx.__wait(10 * 60 * 60 * 1000); c.cueBidsPgTick_(); assert.strictEqual(t.log.pg.length, 2, '22:00 Manila: no read');
  assert.ok(t.log.pg.every(x => !x.headers.Cookie), 'the board is read with no sign-in and no cookie');
});

test('PGS3 daily bid check: New PhilGEPS comes from code, with ABC, deadline, key dates and files; ₱1,000,000 cap (Kiko "raise it to 1M")', () => {
  const t = bidBox({ pg: PG_SITE() }); const r = t.ctx.cueSend('run bid opportunity check', [], ''); const v = t.ctx.cueRun(r.request_id);
  assert.strictEqual(t.log.gpt.length, 3, 'ChatGPT still checks the other 10 sources');
  const it = v.bids.items.filter(x => x.reference === '119200')[0];
  assert.ok(it, 'the conference (ABC ₱950,000, under the new ₱1,000,000 cap) is on the card');
  deq([it.abc, it.location, it.deadline, it.status], [950000, 'Metro Manila', '2026-10-27T10:00+08:00', 'Within cap and area']);
  assert.ok(/Key dates: .*Pre-Bid Meeting Start 23-Oct-2026 10:00 AM.*Bid Opening 27-Oct-2026 11:00 AM/.test(it.limitations), it.limitations);
  deq(it.documents.map(d => [d.name, d.status]), [['ITB Year-End Conference.pdf', 'not opened']]);
  assert.strictEqual(it.amendments, '1 bid supplement(s) posted');
  assert.ok(!v.bids.items.some(x => x.reference === '119300'), 'ABC ₱1,200,000 is over the cap');
  assert.ok(!v.bids.items.some(x => x.reference === '119400'), 'Bataan is never kept');
  assert.ok(!v.bids.items.some(x => x.reference === '119500'), 'Cebu City is outside the area');
  assert.ok(/outside the area left out/.test(v.bids.checks.filter(x => x.id === 4)[0].detail), 'the process check counts them');
  const src = v.bids.sources.filter(x => x.source === 'New PhilGEPS')[0];
  assert.strictEqual(src.status, 'Checked', JSON.stringify(src));
  assert.ok(/₱1,000,000/.test(v.bids.checks.filter(x => x.id === 3)[0].label));
  const ajax = t.log.pg.filter(x => /\/Tenders\//.test(x.url));
  assert.ok(ajax.length && ajax.every(x => x.headers['X-Requested-With'] === 'XMLHttpRequest' && x.headers.Cookie === 'CAKEPHP=abc123'), 'activity and files use the site\'s own session cookie');
  const row = t.tabs['Web bid findings'].rows.filter(x => x[2] === '119200')[0];
  assert.ok(row && /read by Cue code/.test(row[14]), 'the sheet row says code read it');
  assert.strictEqual(row[16], '', 'Intake?? stays for Kiko');
});

test('PGS4 site down or changed: the source shows Blocked with the reason, the hourly job fails in Job Runs; the rest of the check runs', () => {
  const t = bidBox(); const r = t.ctx.cueSend('run bid opportunity check', [], ''); const v = t.ctx.cueRun(r.request_id);
  const src = v.bids.sources.filter(x => x.source === 'New PhilGEPS')[0];
  assert.strictEqual(src.status, 'Blocked'); assert.ok(/answered 503/.test(src.gap), src.gap);
  assert.ok(v.bids.items.length, 'the other sources still give their notices');
  const t2 = sandbox({ pg: PG_SITE({ index: () => pgPage(200, '<html>new layout</html>') }) });
  assert.throws(() => t2.ctx.cueBidsPgTick_(), /showed no notices/);
  const t3 = sandbox({ pg: PG_SITE({ index: () => pgPage(302, '') }) });
  assert.throws(() => t3.ctx.cueBidsPgTick_(), /sign-in page/);
});

test('PGS5 area (Kiko 1 Nov 2026): Pampanga and CALABARZON / Region IV-A are in; Quezon province is out, Quezon City stays in', () => {
  const t = sandbox(), c = t.ctx, now = c.cueNow_(), at = place => c.cueBidsScreen_({ abc: 500000, location: place, deadline_ms: now + 864e5 }, now);
  ['San Fernando, Pampanga', 'Clark, Pampanga', 'Angeles City', 'CALABARZON', 'Region IV-A', 'Quezon City', 'QC', 'Diliman, QC', 'Quezon Avenue, Quezon City', 'Metro Manila', 'Calamba, Laguna']
    .forEach(p => assert.ok(!at(p).drop, p + ' is in the area'));
  ['Lucena City, Quezon, CALABARZON', 'Quezon', 'Quezon Province', 'Tayabas, Quezon', 'Balanga, Bataan', 'Eastern Samar', 'Leyte', 'Nueva Ecija', 'Cebu City']
    .forEach(p => assert.strictEqual(at(p).drop, 'area', p + ' is outside the area'));
});
