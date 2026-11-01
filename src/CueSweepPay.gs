// File name sorts after CueSweep.gs on purpose: Apps Script loads files in order, and cueKind_ must exist before this file registers.
/* CUE-2026-10-21. Payment chasers: chasing sweep task 4 (spec specs/payment-chasers.md, Kiko approved 08:16Z).
 * - Find (code + Canvas, no AI): one bridge read, overdue_billings, gives every open BI at least 7 days past its due date, with
 *   the balance worked out the way Finance Desk does, the contact to chase (billing contact first, then the invoice's contact)
 *   and the info@ thread that sent the BI. Cue groups a client's BIs into one email, anchored on its oldest BI.
 * - Draft: the sweep's one ChatGPT call writes the words; check() makes sure every BI number and the balance are in it, or the
 *   fixed template is used. Amounts always come from Canvas, never from ChatGPT.
 * - Send (Kiko 08:08-08:09Z): from info@ with Kiko on CC, Approve and send, one by one on the card, never automatic. Canvas
 *   sends through send_payment_chasers (it runs as info@); the engine holds approvals until 09:00 PH. Drafts only saves an
 *   info@ draft. Canvas re-checks the BI is still open and the balance unchanged before anything goes out.
 * - Timing: 7 days after the due date, then every 7 days, at most 3 chasers (defaults; Kiko changes them on the Chaser rules card);
 *   then the engine flags it to Kiko ("call the client").
 * - Finance stays read only: nothing here marks a BI paid or changes any record. */

const CUE_PAY_ = { minLate: 7, every: 7, max: 3 };
const CUE_PAY_BRIEF_ = 'A payment follow-up to a client about billing invoices (BIs) that are past due. It is sent from info@ '
  + '(Blank Space Events) with Kiko copied. Name every BI in facts.bis with its event, its balance exactly as written in balance_text '
  + 'and its due date. If something was already received, thank them and ask only for the balance. Ask when payment can be expected, '
  + 'or whether anything is needed to process it. A second or third follow-up is firmer and asks for a payment date. Never mention '
  + 'interest, penalties or legal action, and never change or round an amount.';

cueKind_({ kind: 'payment', label: 'C7 Payment chasers', every: CUE_PAY_.every, max: CUE_PAY_.max, sendAllowed: true,
  find: cuePayFind_, template: it => cueTplC7_(it) /* CUE-TEMPLATES-2026-10-31: Kiko's C7 wording, no AI call */, check: cuePayCheck_,
  send: (it, s) => cuePaySend_(it, s, 'send'), draft: (it, s) => cuePaySend_(it, s, 'draft') });

/** The day's payment lines: one per client email, anchored on its oldest overdue BI. */
function cuePayFind_(ctx) {
  // Kiko's Chaser rules card (Rules tab): first = days after the due date; every and max are applied by the engine.
  const rule = typeof ctx.rule === 'function' ? ctx.rule('payment') || {} : {};
  if (rule.on === false) return [];
  const res = cueBridge_(ctx.s, 'overdue_billings', { min_days_late: Number(rule.first) >= 0 && rule.first !== '' && rule.first != null ? Number(rule.first) : CUE_PAY_.minLate }) || {};
  (res.skipped || []).forEach(x => ctx.s.notes.push('Payment chasers: ' + (x.no ? 'BI ' + x.no + ' (' + x.project + '): ' : '') + x.why));
  if (res.more) ctx.s.notes.push('Payment chasers: ' + res.more + ' more overdue BIs wait for the next run.');
  const groups = {}, order = [];
  (res.bis || []).forEach(b => {
    const g = b.to ? 'to:' + String(b.to).toLowerCase() : 'co:' + String(b.company || b.project_id).toLowerCase();
    if (!groups[g]) { groups[g] = []; order.push(g); }
    groups[g].push(b);
  });
  return order.map(g => {
    const bis = groups[g].slice().sort((a, b) => String(a.due).localeCompare(String(b.due))), a = bis[0];
    const th = (bis.filter(b => b.thread && b.thread.thread_id)[0] || {}).thread || null;
    const replied = bis.map(b => b.thread && b.thread.client_replied).filter(Boolean).sort((x, y) => String(y.on).localeCompare(String(x.on)))[0];
    const total = cueR2_(bis.reduce((s, b) => s + Number(b.balance || 0), 0));
    const projects = bis.map(b => b.project).filter((p, i, l) => p && l.indexOf(p) === i);
    const it = { key: 'payment:bi:' + a.no, project: projects.length > 1 ? projects.length + ' projects' : projects[0] || a.project_id, project_id: a.project_id,
      who: a.to_name || a.client || a.company, to: a.to || '', thread_id: th ? th.thread_id : '', thread_subject: th ? th.subject : '',
      due_since: a.due, bis: bis.map(b => String(b.no)), balance: total, balances: bis.map(b => Number(b.balance)),
      facts: { from: 'info@ (Blank Space Events), Kiko copied', company: a.company, contact: a.to_name || a.client || '', total_balance_text: cuePayMoney_(total),
        bis: bis.map(b => ({ no: b.no, project: b.project, balance_text: b.balance_text, due: b.due, days_late: b.days_late,
          received_text: Number(b.collected) > 0 ? cuePayMoney_(b.collected) : '' })) } };
    const what = bis.map(b => 'BI ' + b.no).join(', ') + ': ' + cuePayMoney_(total) + ' owed, ' + a.days_late + ' days overdue (due ' + a.due + ')';
    if (replied) return Object.assign(it, { no_email: true, needs_draft: false,
      why: what + '. The client replied on ' + replied.on + ' (' + String(replied.snippet || '').slice(0, 160) + '). Have a look in info@ before chasing again.' });
    if (!it.to) return Object.assign(it, { no_email: true, needs_draft: false, why: what + '. No billing email found: add the billing contact in Client Desk.' });
    return Object.assign(it, { why: what + '. From info@, CC you' + (a.to_source ? ' · to the ' + a.to_source : '') + (th ? '' : ' · new email: no sent BI email found in info@') });
  });
}

/** Code's check on ChatGPT's draft: every BI number, and the balance (in total, or per BI), exactly as Canvas has it. */
function cuePayCheck_(it) { return cuePaySays_(it.body, it.bis || [], it.balance, it.balances || []); }
function cuePaySays_(body, bis, total, each) {
  const text = String(body || ''), flat = text.replace(/,/g, '');
  const has = n => flat.indexOf(Number(n).toFixed(2)) >= 0 || (Math.round(n) === n && new RegExp('(^|[^0-9.])' + n + '([^0-9]|$)').test(flat));
  return bis.length > 0 && bis.every(no => new RegExp('(^|[^0-9A-Za-z])' + String(no).replace(/[^0-9A-Za-z-]/g, '') + '([^0-9A-Za-z]|$)').test(text))
    && (has(total) || (each.length === bis.length && each.every(has)));
}
function cuePayMoney_(n) { return 'PHP ' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

/** The fixed wording, used when ChatGPT fails or its draft leaves out a BI or the amount. */
function cuePayTemplate_(it) {
  const f = it.facts || {}, bis = f.bis || [], n = it.times || 0;
  const lines = bis.map(b => '- BI ' + b.no + ', ' + b.project + ': ' + b.balance_text + ' balance, due ' + b.due
    + (b.received_text ? ' (we received ' + b.received_text + ', thank you)' : ''));
  // VOICE-2026-10-29 (brand voice guide): "Hi <name>," to open, and no "!" in payment mail, so "Dear" and "Good day!" are gone.
  const open = n === 0 ? 'This is a reminder about the following billing invoice' + (bis.length > 1 ? 's' : '') + ' from Blank Space Events:'
    : 'We are following up again on the billing invoice' + (bis.length > 1 ? 's' : '') + ' below, which ' + (bis.length > 1 ? 'are' : 'is') + ' now past due:';
  const ask = n === 0 ? 'May we know when we can expect the payment, or whether anything else is needed to process it?'
    : 'Could you please confirm the payment date' + (n >= 2 ? ' this week' : '') + ', or let us know if anything is holding it up?';
  return { subject: 'Payment follow-up: ' + bis.map(b => 'BI ' + b.no).join(', ') + (it.project ? ' (' + it.project + ')' : ''),
    body: 'Hi ' + (f.contact || 'Accounts Payable team') + ',\n\n' + open + '\n\n' + lines.join('\n')
      + (bis.length > 1 ? '\n\nTotal balance: ' + f.total_balance_text : '') + '\n\n' + ask + '\n\nThank you,\nKiko\nBlank Space Events' };
}

/** Through Canvas, as info@: mode 'send' (Approve and send, at 09:00) or 'draft' (Drafts only). Returns the Gmail id. */
function cuePaySend_(it, s, mode) {
  if (!cuePaySays_(it.body, it.bis || [], it.balance, it.balances || []))
    throw new Error('The email must name ' + (it.bis || []).map(b => 'BI ' + b).join(', ') + ' and state the balance (' + cuePayMoney_(it.balance) + '). Edit it and retry.');
  const r = cueBridge_(s, 'send_payment_chasers', Object.assign({ key: it.key + ':c' + ((it.times || 0) + 1), mode, bis: it.bis, balance: it.balance, to: it.to,
    subject: cueStr_(it.subject || 'Payment follow-up', 200).replace(/[\r\n]+/g, ' '), body: cueStr_(it.body, 6000) }, it.thread_id ? { thread_id: it.thread_id } : {}));
  if (!r || !r.ok || !r.id) throw new Error('Canvas did not ' + (mode === 'send' ? 'send' : 'save') + ' it.');
  return String(r.id);
}
