// Cloud check: project intake on REAL inquiries (backlog card intake-real-check, High, 29 Oct 2026: "intake is built but never run on
// real inquiries; prove it end to end from Gmail Start intake, from a screenshot and from an uploaded file").
// Through the check door (CueCheck.gs, CueIntakeCheck.gs):
//   1 Gmail: Start intake on the newest real inquiry Cue sorted (New mail, Triage log), the same function the New mail and Inbox triage buttons run.
//   2 Screenshot: the next real inquiry's text drawn as an email screenshot (PNG), sent with no text, the way Kiko pastes a screenshot.
//   3 File: the next one printed as a PDF and sent with one line, the way Kiko attaches a brief.
// Each runs phase 1 for real (GPT read, Canvas duplicate check and Client Desk check, both reads). Phase 1 Approve would add a real project
// to Canvas, so the check never taps it; phases 2 to 4 (Claude's rows, costing from Canvas's evidence with web research, RFQ drafts) run
// on a copy with nothing saved, written or drafted. Mail: none. AI calls: about 5 per inquiry.
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const runs = [];
let picks = [];
// One project Kiko names (29 Oct 15:09Z "how do we test the intake? i have a project"): words from its subject or sender, one line, in
// intake-real.only.txt next to this file. The three runs then all use that inquiry, and a match in Canvas goes on as a new project.
const ONLY_FILE = new URL('./intake-real.only.txt', import.meta.url);
const ONLY = existsSync(ONLY_FILE) ? readFileSync(ONLY_FILE, 'utf8').trim() : '';

// R1 to R3 and the AC2/AC4 tests live in intake-rules.cjs so test/features/63-intake-real-check.js can test them too (spec approved 7 Nov 2026).
const rules = createRequire(import.meta.url)('./intake-rules.cjs');

async function runOne(h, label, start, src) {
  const r = { label, ok: false, steps: [] };
  runs.push(r);
  const st = await start();
  if (!st.ok) throw new Error(label + ': could not start: ' + st.error);
  r.id = st.result.request_id;
  const run = await h.door('check_call', { fn: 'cueRun', args: [r.id] });
  if (!run.ok) throw new Error(label + ': phase 1 failed: ' + run.error);
  const v = run.result || {};
  r.phase1 = { status: v.status, stage: v.stage, name: v.name || '', error: v.error || '' };
  if (v.status === 'Failed' || v.error) throw new Error(label + ': phase 1 ended ' + v.status + ': ' + (v.error || v.stage));
  // Run of 7 Nov 2026 14:05Z: all three real inquiries already had a Canvas project, so every start stopped at "Same project?" and
  // phases 2 to 4 never ran. Asking first is correct, but it proves nothing past phase 1 (spec A11), so the check always goes on as a new
  // project. In check mode that writes nothing: the phase 1 card still waits for an Approve the check never taps.
  if (v.stage === 'Same project?') {
    r.same = (v.same || []).map(x => x.name);
    const a = await h.door('check_call', { fn: 'cueSameAnswer', args: [r.id, 'new'] });
    if (!a.ok) throw new Error(label + ': could not go on as a new project: ' + a.error);
    Object.assign(v, a.result || {});
    r.phase1 = { status: v.status, stage: v.stage, name: v.name || '', error: v.error || '', same_as: r.same };
  }
  if (r.same) r.note = 'Canvas already has a project that looks the same (' + r.same.join(', ') + '), so Cue asked first (correct); the check went on as a new project to run phases 2 to 4';
  if (v.status !== 'Needs you' || !(v.ph && v.ph.phase === 1)) throw new Error(label + ': expected the phase 1 card, got ' + v.status + ' / ' + v.stage);
  for (const n of [2, 3, 4]) {
    const d = await h.door('check_call', { fn: 'cueIcDeep_', args: [r.id, n] });
    if (!d.ok) throw new Error(label + ': phase ' + n + ' failed: ' + d.error);
    r['phase' + n] = d.result;
  }
  const rows = r.phase2.rows || [];
  if (!rows.length) throw new Error(label + ': no requirement rows');
  const long = rows.filter(x => String(x.item).split(/\s+/).length > 6 || String(x.spec).split(/\s+/).filter(Boolean).length > 12);
  if (long.length) throw new Error(label + ': rows over the 6/12-word limit: ' + JSON.stringify(long));
  if ((r.phase3.lines || []).length !== rows.length) throw new Error(label + ': costing has ' + (r.phase3.lines || []).length + ' lines for ' + rows.length + ' rows');
  // AC2: the phase 1 client and event, side by side with the inquiry (kept in the run log either way).
  r.readback = rules.readBack({ client: r.phase2.client, event: r.phase2.event }, src);
  const fails = [];
  if (r.readback.client_in_inquiry === false || r.readback.event_in_inquiry === false) fails.push('phase 1 read a client or event the inquiry does not name: ' + JSON.stringify(r.readback));
  // AC4 and CUE-048 (R1 to R3): each draft's supplier, TBC for blank event details, no client, no price, no other supplier.
  const rfqs = r.phase4.rfqs || [], names = rfqs.map(q => q.supplier);
  r.rfq_breaks = rfqs.map(q => [q.supplier, [].concat(rules.supplierBreaks(q, r.phase3.lines), rules.tbcBreaks(q, r.phase2.event),
    rules.rfqBreaks(q, { client: r.phase4.client, suppliers: names }))]).filter(x => x[1].length);
  if (r.rfq_breaks.length) fails.push('RFQ drafts break the rules: ' + r.rfq_breaks.map(x => x[0] + ': ' + x[1].join(', ')).join('; '));
  if (fails.length) throw new Error(label + ': ' + fails.join(' | '));
  r.ok = true;
  return r;
}

async function drawEmail(h, p, as) {
  const pg = await h.page().context().browser().newPage({ viewport: { width: 900, height: 1200 } });
  const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  await pg.setContent('<body style="margin:0;font:15px Arial,sans-serif;color:#202124;background:#fff"><div style="padding:24px 32px">'
    + '<div style="font-size:22px;margin-bottom:16px">' + esc(p.subject) + '</div><div style="color:#5f6368;margin-bottom:20px">' + esc(p.from) + '</div>'
    + '<div style="white-space:pre-wrap;line-height:1.45">' + esc(p.text) + '</div></div></body>');
  const data = as === 'pdf' ? (await pg.pdf({ format: 'A4' })).toString('base64') : (await pg.screenshot({ fullPage: true, type: 'png' })).toString('base64');
  await pg.close();
  return data;
}

export default {
  name: 'Project intake on real inquiries: Gmail Start intake, a screenshot, an uploaded PDF (nothing written, nothing sent)',
  steps: [
    { title: 'Real inquiries Cue showed in the last 30 days', run: async h => {
      const r = await h.door('check_call', { fn: 'cueIcPick_', args: [ONLY ? 120 : 30, 8, ONLY] });
      if (!r.ok) throw new Error('cueIcPick_ failed: ' + r.error);
      picks = (r.result || []).filter(p => !p.error && String(p.text || '').trim().length >= 40);
      if (!picks.length && ONLY) throw new Error('No inquiry matches "' + ONLY + '" in the last 120 days: ' + JSON.stringify((r.result || []).map(p => [p.subject, p.error])));
      if (!picks.length) throw new Error('No real inquiry with readable text in the last 30 days: ' + JSON.stringify((r.result || []).map(p => [p.subject, p.error])));
      // Gmail first: an email in Kiko's own inbox with files when there is one, else his inbox, else info@ (newest first within each).
      const rank = p => (p.inbox === 'mine' ? 0 : 2) + (p.files ? 0 : 1);
      picks = picks.map((p, i) => [p, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(x => x[0]);
    } },
    { title: 'Gmail: Start intake on a real inquiry, phase 1 to the RFQ drafts', stopOnFail: false, run: async h => {
      const p = picks[0];
      await runOne(h, 'Gmail (' + (p.inbox === 'info' ? 'info@' : 'your inbox') + '): ' + p.subject, () => h.door('check_call', { fn: 'cueIcStart_', args: [p] }), p);
    } },
    { title: 'Screenshot: a real inquiry pasted as a picture, phase 1 to the RFQ drafts', stopOnFail: false, run: async h => {
      const p = picks[1 % picks.length], data = await drawEmail(h, p, 'png');
      await runOne(h, 'Screenshot: ' + p.subject, () => h.door('check_call', { fn: 'cueSend', args: ['', [{ name: 'image.png', type: 'image/png', data }], ''] }), p);
    } },
    { title: 'Uploaded file: a real inquiry as a PDF, phase 1 to the RFQ drafts', stopOnFail: false, run: async h => {
      const p = picks[2 % picks.length], data = await drawEmail(h, p, 'pdf');
      await runOne(h, 'PDF: ' + p.subject, () => h.door('check_call', { fn: 'cueSend', args: ['New inquiry, the brief is attached.', [{ name: 'inquiry-brief.pdf', type: 'application/pdf', data }], ''] }), p);
    } },
    { title: 'What each intake produced (nothing written to Canvas, nothing sent)', run: async h => {
      await h.page().evaluate(rs => {
        const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
        const peso = n => 'PHP ' + Math.round(n || 0).toLocaleString('en-US');
        const d = document.createElement('div');
        d.id = 'check-intake-real';
        d.style.cssText = 'position:fixed;inset:16px;z-index:99999;background:#fff;border:1px solid #e6e2dc;border-radius:12px;padding:16px;overflow:auto;font:13px Quicksand,Arial,sans-serif;color:#1d1b22';
        d.innerHTML = '<b style="font-size:16px">Intake on real inquiries</b><p>Nothing was written to Canvas and nothing was sent.</p>' + rs.map(r => {
          const t = (r.phase3 && r.phase3.totals) || {};
          return '<div style="border-top:1px solid #eee;padding:8px 0"><b>' + (r.ok ? '✓ ' : '✗ ') + esc(r.label) + '</b><br>Phase 1: ' + esc(r.phase1 && r.phase1.name) + ' (' + esc(r.phase1 && r.phase1.stage) + ')'
            + (r.note ? '<br>' + esc(r.note) : '')
            + (r.readback ? '<br>Read from the inquiry: client "' + esc(r.readback.client) + '" ' + (r.readback.client_in_inquiry === 'unverified' ? '? (only in an attachment)' : r.readback.client_in_inquiry ? '✓' : '✗') + ', event "' + esc(r.readback.event) + '" ' + (r.readback.event_in_inquiry === 'unverified' ? '? (only in an attachment)' : r.readback.event_in_inquiry ? '✓' : '✗') : '')
            + (r.rfq_breaks && r.rfq_breaks.length ? '<br>RFQ rule breaks: ' + esc(r.rfq_breaks.map(x => x[0] + ': ' + x[1].join(', ')).join('; ')) : '')
            + (r.phase2 ? '<br>Phase 2: ' + r.phase2.rows.length + ' rows: ' + esc(r.phase2.rows.map(x => x.item + (x.spec ? ' (' + x.spec + ')' : '') + ' x' + x.quantity).join('; ')) : '')
            + (r.phase3 ? '<br>Phase 3: known cost ' + peso(t.known_cost) + ', price ' + peso(t.known_price) + '; ' + t.lines_without_cost + ' need a cost, ' + t.lines_without_price + ' a price' : '')
            + (r.phase4 ? '<br>Phase 4: ' + r.phase4.rfqs.length + ' RFQ draft(s): ' + esc(r.phase4.rfqs.map(q => q.supplier).join(', ')) + '; ' + r.phase4.ai_calls + ' AI calls in all' : '') + '</div>';
        }).join('');
        document.body.appendChild(d);
      }, runs);
      await h.see('Nothing was written to Canvas');
      // The run log keeps what each phase produced, so it can be read without the artifact (the report has the same in pictures).
      console.log('INTAKE-REAL ' + JSON.stringify(runs.map(r => ({ label: r.label, ok: r.ok, phase1: r.phase1, note: r.note || '',
        readback: r.readback, rfq_breaks: r.rfq_breaks || [], event: r.phase2 && r.phase2.event,
        rows: r.phase2 && r.phase2.rows, questions: r.phase2 && r.phase2.questions, excluded: r.phase2 && r.phase2.excluded,
        totals: r.phase3 && r.phase3.totals, lines: r.phase3 && r.phase3.lines, notes: r.phase3 && r.phase3.notes,
        rfqs: r.phase4 && r.phase4.rfqs.map(q => ({ supplier: q.supplier, subject: q.subject, body: String(q.body || '').slice(0, 600) })), ai_calls: r.phase4 && r.phase4.ai_calls }))));
      const bad = runs.filter(r => !r.ok);
      if (runs.length < 3) throw new Error('Only ' + runs.length + ' of 3 intakes started');
      if (bad.length) throw new Error(bad.length + ' of ' + runs.length + ' intakes did not finish: ' + bad.map(r => r.label).join('; '));
    } }
  ]
};
