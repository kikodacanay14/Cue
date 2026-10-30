// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: View opportunity on bid cards (Kiko 30 Oct 2026 05:37Z).
/* ---------- each notice gets a button that opens the bid's own page on the source website, by its reference number ---------- */
test('BO1 View opportunity links PhilGEPS notices by reference number (old site public page, Bulletin Board notice) and other notices by their own link', () => {
  const rows = [['2026-10-30', 'AMANG RODRIGUEZ MEMORIAL MEDICAL CENTER', '13318074', 'Procurement of Office Supplies', 'Within cap and area', 'Metro Manila', 251100, 'PHP', '2026-11-04T10:00+08:00', '', '', '',
      'https://notices.philgeps.gov.ph/GEPSNONPILOT/Tender/SplashBidNoticeAbstractUI.aspx?menuIndex=3&refID=13318074', '', '', '', ''],
    ['2026-10-20', 'NCCA', '114505', 'Tokens for delegates', 'Open', 'Metro Manila', 356000, 'PHP', '2026-11-04T17:00+08:00', '', '', '', 'https://philgeps.gov.ph/tenders/viewBidNotice/114505', '', '', '', ''],
    ['2026-10-20', 'TPB', 'OLD-1', 'Travel fair booth', 'Open', 'Makati', 600000, 'PHP', '2026-11-27T17:00+08:00', '', '', '', 'https://tpb.gov.ph/x', '', '', '', '']];
  const { t, v } = bidV3(rows);
  const opp = ref => v.bids.still.concat(v.bids.items).filter(x => x.reference === ref)[0].opp;
  assert.strictEqual(opp('13318074'), 'https://notices.philgeps.gov.ph/GEPSNONPILOT/Tender/SplashBidNoticeAbstractUI.aspx?refID=13318074', 'old site: refID alone opens the notice');
  assert.strictEqual(opp('114505'), 'https://philgeps.gov.ph/tenders/viewBidNotice/114505', 'Bulletin Board notice by reference');
  assert.strictEqual(opp('OLD-1'), 'https://tpb.gov.ph/x', 'other sources: the notice link the scan found');
  const page = cuePage(), fn = page.match(/function bidsCardHtml\(r\) \{[\s\S]*?\n  \}\n/)[0];
  const r = JSON.parse(JSON.stringify(t.ctx.cueView_(t.state(v.id))));
  const box = { esc: x => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]), metricLine: () => '', r };
  const h = vm.runInNewContext(fn + 'bidsCardHtml(r)', box);
  assert.ok(/<a class="btn sm ghost"[^>]*href="https:\/\/notices\.philgeps\.gov\.ph\/GEPSNONPILOT\/Tender\/SplashBidNoticeAbstractUI\.aspx\?refID=13318074" target="_blank" rel="noopener">View opportunity<\/a>/.test(h), 'button opens the bid in a new tab');
  assert.ok(/data-act="bids-view"[^>]*>View details<\/button><a class="btn sm ghost"[^>]*>View opportunity</.test(h), 'right after View details');
  assert.ok(/>Official notice</.test(h), 'Official notice stays');
});
test('BO2 bid card uses the small standard button and the standard label for the source (Kiko 30 Oct 05:52Z)', () => {
  const page = cuePage(), fn = page.match(/function bidsCardHtml\(r\) \{[\s\S]*?\n  \}\n/)[0];
  assert.ok(!/class="btn"|class="btn ghost"/.test(fn) && /class="btn sm/.test(fn), 'every bid card button is small');
  assert.ok(!/class="tag" style="background:var\(--act\)/.test(fn), 'the source is a label, not a filled button look');
  assert.ok(/\.btn\.sm \{ min-height:30px; padding:0 12px; font-size:12px; \}/.test(page), 'small button size from Brand.html');
});

/* ---------- Cue's copy of the notice and the fuller card (Kiko 30 Oct 05:52Z-05:53Z) ---------- */
// The parts of the old PhilGEPS abstract page for ref 13318074, as read in Kiko's Chrome on 30 Oct (span ids and <BR> line breaks kept).
const PG_ABS_FULL = '<html><span id="lblDisplayReferenceNo" class="DisplayText5">13318074</span><span id="lblDisplayProcuringEntity" class="DisplayText5">AMANG RODRIGUEZ MEMORIAL MEDICAL CENTER</span>'
  + '<span id="lblDisplayTitle" class="DisplayText5">Procurement of Office Supplies</span><span id="lblDisplayAOD" class="DisplayText5">Metro Manila</span>'
  + '<span id="lblDisplaySolNumber" class="DisplayText5">Goods 2026-150</span><span id="lblDisplayProcureMode" class="DisplayText5">Negotiated Procurement - Small Value Procurement (Sec. 34)</span>'
  + '<span id="lblDisplayCategory" class="DisplayText5">Audio and Visual Equipment</span><span id="lblDisplayBudget" class="DisplayText5">251,100.00</span>'
  + '<span id="lblDisplayPeriod" class="DisplayText5">30 Day/s</span><span id="lblDisplayContactPerson" class="DisplayText5">Efren Ribano III<BR>BAC Secretary<BR>Sumulong Highway,<BR>Marikina City<BR>Philippines 1800<BR>63-2-9415854 Ext.127<BR>63-2-9416841<BR>armmcquotations@gmail.com</span>'
  + '<span id="lblDisplayDocReqList" class="DisplayText5">11</span><span id="lblDisplayDatePublish" class="DisplayText5">30/10/2026</span><span id="lblDisplayCloseDateTime" class="DisplayText5">04/11/2026 10:00 AM</span>'
  + '<span id="lblAbstractText" class="DisplayText5">Good day!<Br><Br>Kindly refer to the attached RFQ Form for instructions and further details.<Br><Br>Deadline of Submission will be on November 4, 2026, at 10:00 a.m. at the Procurement Section Office</span></html>';
test('BO3 the notice page gives the agency\'s description, contact, delivery period, solicitation number, category, mode and document requests', () => {
  const t = sandbox(), f = JSON.parse(JSON.stringify(t.ctx.cueBidsPgDetails_(PG_ABS_FULL)));
  assert.ok(/^Good day!\n\nKindly refer to the attached RFQ Form/.test(f.description), f.description);
  deq(f.contact, { name: 'Efren Ribano III', role: 'BAC Secretary', email: 'armmcquotations@gmail.com', phone: '63-2-9415854 Ext.127, 63-2-9416841' });
  deq([f.solicitation, f.delivery, f.category, f.mode, f.doc_requests], ['Goods 2026-150', '30 Day/s', 'Audio and Visual Equipment', 'Negotiated Procurement - Small Value Procurement (Sec. 34)', 11]);
});
test('BO4 Cue saves a PDF copy of each old PhilGEPS notice once, and the card shows the description, category, delivery period and the copy', () => {
  const site = log => req => { const m = req.url.match(/refID=(\d+)/); if (m && m[1] === '13310846') { (log.abs = log.abs || []).push(req.url); return PG_ABS_FULL.replace(/13318074/g, '13310846').replace('251,100.00', '500,000.00'); } return PG_SITE(log)(req); };
  const t = bidBox({ gpt: { bids: [{ sources: SRC(['New PhilGEPS', 'Other PhilGEPS']), items: [] }, { sources: [], items: [] }, { sources: [], items: [] }], bid_docs: BID_DOCS }, philgeps: req => site(t.log)(req) });
  const v = t.ctx.cueRun(t.ctx.cueSend('run bid opportunity check', [], '').request_id);
  const x = v.bids.items.filter(i => i.reference === '13310846')[0];
  assert.ok(x, 'the notice is on the card');
  assert.ok(/^Good day! Kindly refer to the attached RFQ Form/.test(x.summary), 'the agency\'s description, not the category and mode: ' + x.summary);
  deq(x.details, { category: 'Audio and Visual Equipment', mode: 'Negotiated Procurement - Small Value Procurement (Sec. 34)', delivery: '30 Day/s', solicitation: 'Goods 2026-150', doc_requests: 11 });
  deq(x.contacts.map(c => c.email), ['armmcquotations@gmail.com']);
  assert.ok(/^https:\/\/drive\.google\.com\/file\/d\/f\d+\/view$/.test(x.copy.drive), 'Cue\'s copy');
  const id = x.copy.drive.match(/\/d\/(f\d+)\//)[1], pdf = t.drive.files[id].toString('utf8');
  assert.ok(/^%PDF/.test(pdf) && /Procurement Section Office/.test(pdf) && /Efren Ribano III/.test(pdf) && /Delivery period/.test(pdf), 'the PDF holds the notice');
  assert.ok(t.tabs['Bid documents'].rows.some(r => /^copy:https:\/\/notices\.philgeps\.gov\.ph\/.*refID=13310846/.test(r[0]) && r[3] === 'Opened · saved (pdf)'), 'recorded once');
  const page = cuePage(), fn = page.match(/function bidsCardHtml\(r\) \{[\s\S]*?\n  \}\n/)[0];
  const r = JSON.parse(JSON.stringify(v)), box = { esc: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]), metricLine: () => '', r };
  const h = vm.runInNewContext(fn + 'bidsCardHtml(r)', box);
  assert.ok(/Category:<\/span> Audio and Visual Equipment · Negotiated Procurement/.test(h) && /Delivery period:<\/span> 30 Day\/s/.test(h), 'details on the card');
  assert.ok(/Notice:<\/span> <a href="https:\/\/drive\.google\.com\/file\/d\/f\d+\/view" target="_blank" rel="noopener">Cue&#39;s copy \(PDF\)<\/a>/.test(h), 'the copy is linked on the card, outside View details');
  assert.ok(/Document requests so far:<\/span> 11/.test(h) && /Solicitation number:<\/span> Goods 2026-150/.test(h), 'the rest under View details');
  // The next day the notice is Still open: its page is not fetched again and the card keeps the copy and the details.
  const n = (t.log.abs || []).length; t.ctx.__wait(864e5); t.log.gptN = {};
  const w = t.ctx.cueRun(t.ctx.cueSend('run bid opportunity check', [], '').request_id), s = w.bids.still.filter(i => i.reference === '13310846')[0];
  assert.strictEqual((t.log.abs || []).length, n, 'no second fetch'); assert.ok(s.copy.drive && s.details.delivery === '30 Day/s');
});
test('BO5 field names are dark and bold, values regular, section headers dark (Kiko 30 Oct 06:06Z)', () => {
  const page = cuePage();
  assert.ok(/\.fk \{ color:var\(--text\); font-weight:700; \} \.card \.small \{ font-weight:400; \}/.test(page), 'field name and value styles');
  assert.ok(/\.label \{[^}]*color:var\(--text\)/.test(page), 'section headers in the text colour');
  assert.ok(!/<span class="muted">[^<']*:<\/span>/.test(page) && !/class="muted">' \+ esc\(k\) \+ ':/.test(page), 'no field name left in the light grey');
});
test('BO6 Summary of requirements is justified; other lines keep their alignment (Kiko 30 Oct 06:15Z)', () => {
  const fn = cuePage().match(/function bidsCardHtml\(r\) \{[\s\S]*?\n  \}\n/)[0];
  assert.ok(/row\('Summary of requirements', x\.summary \|\| '', false, true\)/.test(fn) && /\(just \? ';text-align:justify' : ''\)/.test(fn));
  assert.ok(/row\('Budget', peso\(x\.abc\), true\)/.test(fn), 'Budget is not justified');
});
