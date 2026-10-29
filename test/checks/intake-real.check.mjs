// Cloud check: project intake on REAL inquiries (backlog card intake-real-check, High, 29 Oct 2026: "intake is built but never run on
// real inquiries; prove it end to end from Gmail Start intake, from a screenshot and from an uploaded file").
// Through the check door (CueCheck.gs, CueIntakeCheck.gs):
//   1 Gmail: Start intake on the newest real inquiry Cue showed (Triage log), the same function the New mail and Inbox triage buttons run.
//   2 Screenshot: the next real inquiry's text drawn as an email screenshot (PNG), sent with no text, the way Kiko pastes a screenshot.
//   3 File: the next one printed as a PDF and sent with one line, the way Kiko attaches a brief.
// Each runs phase 1 for real (GPT read, Canvas duplicate check and Client Desk check, both reads). Phase 1 Approve would add a real project
// to Canvas, so the check never taps it; phases 2 to 4 (Claude's rows, costing from Canvas's evidence with web research, RFQ drafts) run
// on a copy with nothing saved, written or drafted. Mail: none. AI calls: about 5 per inquiry.
const runs = [];
let picks = [];

const RFQ_LEAK = (r, client) => {
  const body = String(r.body || '');
  if (client && client.length >= 4 && body.toLowerCase().indexOf(client.toLowerCase()) >= 0) return 'names the client (' + client + ')';
  if (/\b(PHP|₱)\s?\d/.test(body)) return 'states a price';
  return '';
};

async function runOne(h, label, start) {
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
  if (v.stage === 'Same project?') { r.ok = true; r.note = 'Canvas already has a project that looks the same, so Cue asked first (correct; no phases 2 to 4)'; return r; }
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
  const leak = (r.phase4.rfqs || []).map(q => [q.supplier, RFQ_LEAK(q, r.phase4.client)]).filter(x => x[1]);
  if (leak.length) throw new Error(label + ': RFQ drafts break the RFQ rules: ' + leak.map(x => x[0] + ' ' + x[1]).join('; '));
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
      const r = await h.door('check_call', { fn: 'cueIcPick_', args: [30, 8] });
      if (!r.ok) throw new Error('cueIcPick_ failed: ' + r.error);
      picks = (r.result || []).filter(p => !p.error && String(p.text || '').trim().length >= 40);
      if (!picks.length) throw new Error('No real inquiry with readable text in the last 30 days: ' + JSON.stringify((r.result || []).map(p => [p.subject, p.error])));
      // Gmail first: an email in Kiko's own inbox (with its files) when there is one, else info@.
      picks.sort((a, b) => (a.inbox === 'mine' ? 0 : 1) - (b.inbox === 'mine' ? 0 : 1));
    } },
    { title: 'Gmail: Start intake on a real inquiry, phase 1 to the RFQ drafts', stopOnFail: false, run: async h => {
      const p = picks[0];
      await runOne(h, 'Gmail (' + (p.inbox === 'info' ? 'info@' : 'your inbox') + '): ' + p.subject, () => h.door('check_call', { fn: 'cueIcStart_', args: [p] }));
    } },
    { title: 'Screenshot: a real inquiry pasted as a picture, phase 1 to the RFQ drafts', stopOnFail: false, run: async h => {
      const p = picks[1 % picks.length], data = await drawEmail(h, p, 'png');
      await runOne(h, 'Screenshot: ' + p.subject, () => h.door('check_call', { fn: 'cueSend', args: ['', [{ name: 'image.png', type: 'image/png', data }], ''] }));
    } },
    { title: 'Uploaded file: a real inquiry as a PDF, phase 1 to the RFQ drafts', stopOnFail: false, run: async h => {
      const p = picks[2 % picks.length], data = await drawEmail(h, p, 'pdf');
      await runOne(h, 'PDF: ' + p.subject, () => h.door('check_call', { fn: 'cueSend', args: ['New inquiry, the brief is attached.', [{ name: 'inquiry-brief.pdf', type: 'application/pdf', data }], ''] }));
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
            + (r.phase2 ? '<br>Phase 2: ' + r.phase2.rows.length + ' rows: ' + esc(r.phase2.rows.map(x => x.item + (x.spec ? ' (' + x.spec + ')' : '') + ' x' + x.quantity).join('; ')) : '')
            + (r.phase3 ? '<br>Phase 3: known cost ' + peso(t.known_cost) + ', price ' + peso(t.known_price) + '; ' + t.lines_without_cost + ' need a cost, ' + t.lines_without_price + ' a price' : '')
            + (r.phase4 ? '<br>Phase 4: ' + r.phase4.rfqs.length + ' RFQ draft(s): ' + esc(r.phase4.rfqs.map(q => q.supplier).join(', ')) + '; ' + r.phase4.ai_calls + ' AI calls in all' : '') + '</div>';
        }).join('');
        document.body.appendChild(d);
      }, runs);
      await h.see('Nothing was written to Canvas');
      // The run log keeps what each phase produced, so it can be read without the artifact (the report has the same in pictures).
      console.log('INTAKE-REAL ' + JSON.stringify(runs.map(r => ({ label: r.label, ok: r.ok, phase1: r.phase1, note: r.note || '',
        rows: r.phase2 && r.phase2.rows, questions: r.phase2 && r.phase2.questions, excluded: r.phase2 && r.phase2.excluded,
        totals: r.phase3 && r.phase3.totals, lines: r.phase3 && r.phase3.lines, notes: r.phase3 && r.phase3.notes,
        rfqs: r.phase4 && r.phase4.rfqs.map(q => ({ supplier: q.supplier, subject: q.subject, body: String(q.body || '').slice(0, 600) })), ai_calls: r.phase4 && r.phase4.ai_calls }))));
      const bad = runs.filter(r => !r.ok);
      if (runs.length < 3) throw new Error('Only ' + runs.length + ' of 3 intakes started');
      if (bad.length) throw new Error(bad.length + ' of ' + runs.length + ' intakes did not finish: ' + bad.map(r => r.label).join('; '));
    } }
  ]
};
